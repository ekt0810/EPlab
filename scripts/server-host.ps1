$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ops = Join-Path $root 'data\operations'
$hash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToLowerInvariant()))).Replace('-', '').Substring(0,16)
$mutex = New-Object Threading.Mutex($false, "Local\EP-LAB-$hash")
$owned = $false
try {
    try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
    if (-not $owned) { exit 0 }
    Set-Location -LiteralPath $root
    $node = (Get-Content -LiteralPath (Join-Path $ops 'install.json') -Raw | ConvertFrom-Json).node
    while (-not (Test-Path -LiteralPath (Join-Path $ops 'disabled'))) {
        & $node (Join-Path $PSScriptRoot 'server-supervisor.mjs') 2>&1 | Out-File -LiteralPath (Join-Path $ops 'host-last.log') -Encoding utf8
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 10
    }
} finally { if ($owned) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
