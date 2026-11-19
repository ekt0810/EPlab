param(
    [ValidateSet('Install','Start','Stop','Restart','Status','Backup','VerifyBackup','ExportRecovery','Uninstall')]
    [string]$Action = 'Status'
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$root = Split-Path -Parent $PSScriptRoot
$ops = Join-Path $root 'data\operations'
$taskName = 'EP LAB Local Server'
$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'EP LAB Server.lnk'
$powershell = Join-Path $PSHOME 'powershell.exe'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'server-host.ps1') + '"'
function Start-Server {
    if (-not (Test-Path -LiteralPath (Join-Path $ops 'install.json'))) { throw 'Run -Action Install first.' }
    Remove-Item -LiteralPath (Join-Path $ops 'disabled') -ErrorAction SilentlyContinue
    $install = Get-Content -LiteralPath (Join-Path $ops 'install.json') -Raw | ConvertFrom-Json
    if ($install.autostart -eq 'scheduled-task') { Start-ScheduledTask -TaskName $taskName }
    else { Start-Process -FilePath $powershell -ArgumentList $arguments -WindowStyle Hidden }
    Write-Output 'EP LAB start requested. Use -Action Status in about 15 seconds.'
}
function Stop-Server {
    if (-not (Test-Path -LiteralPath $ops)) { return }
    Set-Content -LiteralPath (Join-Path $ops 'disabled') -Value ([DateTime]::UtcNow.ToString('o')) -Encoding ascii
    for ($n = 0; $n -lt 90; $n++) {
        $s = Get-Content -LiteralPath (Join-Path $ops 'status.json') -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
        if (-not $s) { Write-Output 'EP LAB stopped.'; return }
        if ($s.phase -eq 'stopped') {
            if (Get-Process -Id $s.supervisorPid -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 1; continue }
            $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
            if ($task -and $task.State -eq 'Running') { Start-Sleep -Seconds 1; continue }
            Write-Output 'EP LAB stopped.'; return
        }
        if (-not (Get-Process -Id $s.supervisorPid -ErrorAction SilentlyContinue)) { Write-Output 'Supervisor already stopped.'; return }
        Start-Sleep -Seconds 1
    }
    throw 'Stop is taking longer than 90 seconds. Check backup/status logs; do not force-stop a running backup.'
}
switch ($Action) {
    'Install' {
        if (-not (Test-Path -LiteralPath (Join-Path $root 'apps\web\.next\BUILD_ID'))) { throw 'Run npm run build first.' }
        New-Item -ItemType Directory -Path $ops -Force | Out-Null
        # These private paths belong only to this Windows user, SYSTEM and Administrators.
        foreach ($private in @((Join-Path $root '.env'), (Join-Path $root 'data'), (Join-Path $root 'backups'))) {
            if (-not (Test-Path -LiteralPath $private)) { New-Item -ItemType Directory -Path $private -Force | Out-Null }
            $grant = if ((Get-Item -LiteralPath $private).PSIsContainer) { '(OI)(CI)F' } else { 'F' }
            & icacls.exe $private /inheritance:r /grant:r "${identity}:$grant" "*S-1-5-18:$grant" "*S-1-5-32-544:$grant" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not secure private directory ACL.' }
        }
        if (-not (Test-Path -LiteralPath (Join-Path $ops 'backup-key.dpapi'))) {
            $bytes = New-Object byte[] 32
            $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
            $rng.GetBytes($bytes); $rng.Dispose()
            $secret = [Convert]::ToBase64String($bytes) | ConvertTo-SecureString -AsPlainText -Force
            ConvertFrom-SecureString $secret | Set-Content -LiteralPath (Join-Path $ops 'backup-key.dpapi') -Encoding ascii
            [Array]::Clear($bytes, 0, $bytes.Length)
        }
        $mode = 'startup-shortcut'
        try {
            $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
            if ($existing -and $existing.Description -ne 'EP LAB managed local server') { throw 'Task name already in use.' }
            $taskAction = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $root
            $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
            $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
            $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
            Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $trigger -Principal $principal -Settings $settings -Description 'EP LAB managed local server' -Force | Out-Null
            $mode = 'scheduled-task'
            if (Test-Path -LiteralPath $startup) { Remove-Item -LiteralPath $startup }
        } catch {
            $shell = New-Object -ComObject WScript.Shell
            $link = $shell.CreateShortcut($startup)
            $link.TargetPath = $powershell; $link.Arguments = $arguments; $link.WorkingDirectory = $root; $link.WindowStyle = 7
            $link.Description = 'EP LAB managed local server'; $link.Save()
            Write-Output 'Windows did not allow registering a scheduled task. Installed a per-user Startup shortcut instead.'
        }
        @{ node = (Get-Command node.exe).Source; root = $root; installedAt = [DateTime]::UtcNow.ToString('o'); user = $identity; autostart = $mode } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ops 'install.json') -Encoding utf8
        Start-Server
    }
    'Start' { Start-Server }
    'Stop' { Stop-Server }
    'Restart' { Stop-Server; Start-Server }
    'Status' {
        Get-Content -LiteralPath (Join-Path $ops 'install.json') -Raw -ErrorAction SilentlyContinue
        Get-Content -LiteralPath (Join-Path $ops 'status.json') -Raw -ErrorAction SilentlyContinue
        Get-Content -LiteralPath (Join-Path $ops 'backup-status.json') -Raw -ErrorAction SilentlyContinue
        try { Invoke-RestMethod -Uri 'http://127.0.0.1:4100/api/health' -TimeoutSec 5 | ConvertTo-Json } catch { Write-Output 'Health endpoint unavailable.' }
    }
    'Backup' { & (Join-Path $PSScriptRoot 'server-backup.ps1') }
    { $_ -in 'ExportRecovery','VerifyBackup' } {
        Set-Location -LiteralPath $root
        $protected = (Get-Content -LiteralPath (Join-Path $ops 'backup-key.dpapi') -Raw).Trim() | ConvertTo-SecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($protected)
        try {
            $env:BACKUP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
            $node = (Get-Content -LiteralPath (Join-Path $ops 'install.json') -Raw | ConvertFrom-Json).node
            if ($Action -eq 'VerifyBackup') { & $node --import tsx scripts/backup-check.ts --automatic }
            else { & $node --import tsx scripts/recovery-kit.ts }
            if ($LASTEXITCODE -ne 0) { throw 'Recovery export failed.' }
        } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); Remove-Item Env:\BACKUP_PASSWORD -ErrorAction SilentlyContinue }
    }
    'Uninstall' {
        Stop-Server
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($task -and $task.Description -eq 'EP LAB managed local server') { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
        if (Test-Path -LiteralPath $startup) { Remove-Item -LiteralPath $startup }
        Write-Output 'Autostart removed. Source, data and backups are preserved.'
    }
}
