$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$stateFile = Join-Path $root 'data\operations\status.json'
$results = @()
function Wait-Healthy($differentField = '', $oldPid = 0) {
    for ($i=0; $i -lt 75; $i++) {
        try {
            $s = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
            $fresh = ([DateTime]::UtcNow - [DateTime]::Parse($s.updatedAt).ToUniversalTime()).TotalSeconds -lt 25
            $changed = (-not $differentField) -or ($s.$differentField -and $s.$differentField -ne $oldPid)
            if ($fresh -and $changed -and $s.phase -eq 'healthy') {
                $health = Invoke-RestMethod 'http://127.0.0.1:4100/api/health' -TimeoutSec 5
                $web = Invoke-WebRequest 'http://127.0.0.1:3100' -UseBasicParsing -TimeoutSec 5
                if ($health.status -eq 'ok' -and -not $health.maintenance -and $web.StatusCode -eq 200) { return $s }
            }
        } catch {}
        Start-Sleep -Seconds 2
    }
    throw 'Server did not recover within the test deadline.'
}
foreach ($scenario in @(
    @{ field='webPid'; pattern='*node_modules*next*'; label='frontend-process-failure' },
    @{ field='apiPid'; pattern='*scripts/local.ts*'; label='api-process-failure' },
    @{ field='supervisorPid'; pattern='*server-supervisor.mjs*'; label='supervisor-process-failure' }
)) {
    $before = Wait-Healthy
    $target = [int]$before.($scenario.field)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$target"
    if (-not $process -or $process.CommandLine -notlike $scenario.pattern) { throw 'Unexpected PID; refusing to stop it.' }
    $clock = [Diagnostics.Stopwatch]::StartNew()
    Stop-Process -Id $target
    $after = Wait-Healthy $scenario.field $target
    $clock.Stop()
    $results += @{ scenario=$scenario.label; passed=$true; recoverySeconds=[Math]::Round($clock.Elapsed.TotalSeconds,2) }
    Write-Output ($scenario.label + ' recovered in ' + [Math]::Round($clock.Elapsed.TotalSeconds,2) + ' seconds.')
}
$before = Wait-Healthy
$clock = [Diagnostics.Stopwatch]::StartNew()
& node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe stop -D data/postgres -m fast -w -t 30 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not perform the controlled PostgreSQL outage.' }
$after = Wait-Healthy 'apiPid' $before.apiPid
$clock.Stop()
$results += @{ scenario='postgresql-outage'; passed=$true; recoverySeconds=[Math]::Round($clock.Elapsed.TotalSeconds,2) }
Write-Output ('PostgreSQL outage recovered in ' + [Math]::Round($clock.Elapsed.TotalSeconds,2) + ' seconds.')
& node --import tsx scripts/restart-check.ts
if ($LASTEXITCODE -ne 0) { throw 'Data digest changed during restart testing.' }
$listeners = @(Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 3100,4100,55432 | Select-Object LocalAddress,LocalPort)
if ($listeners.Count -ne 3 -or ($listeners | Where-Object LocalAddress -ne '127.0.0.1')) { throw 'Listener scope differs from local-only installation.' }
$report = @{ checkedAt=[DateTime]::UtcNow.ToString('o'); status='passed'; scenarios=$results; loopbackOnly=$true; taskAutostart='AtLogOn Interactive Limited'; windowsRebootTested=$false; dataDigestsUnchanged=$true }
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath 'test-results/server-check.json' -Encoding utf8
Write-Output 'Server lifecycle checks passed.'
