$ErrorActionPreference = 'Stop'
# npm/cmd can inherit PowerShell 7 module paths into Windows PowerShell 5.1.
# Load this host's DPAPI cmdlets explicitly instead of an incompatible module.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$root = Split-Path -Parent $PSScriptRoot
$ops = Join-Path $root 'data\operations'
$mutex = New-Object Threading.Mutex($false, 'Local\EP-LAB-Backup')
$owned = $false
$ok = $false
try {
    try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
    if (-not $owned) { exit 0 }
    Set-Location -LiteralPath $root
    $protected = (Get-Content -LiteralPath (Join-Path $ops 'backup-key.dpapi') -Raw).Trim() | ConvertTo-SecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($protected)
    try { $env:BACKUP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $node = (Get-Content -LiteralPath (Join-Path $ops 'install.json') -Raw | ConvertFrom-Json).node
    $result = & $node --import tsx scripts/backup.ts
    if ($LASTEXITCODE -ne 0) { throw 'Backup command failed.' }
    $parsed = ($result -join "`n") | ConvertFrom-Json
    $ok = $true
    @{ ok = $true; completedAt = [DateTime]::UtcNow.ToString('o'); file = $parsed.file; checksum = $parsed.checksum; rows = $parsed.rows } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $ops 'backup-status.json') -Encoding utf8
    Write-Output 'Encrypted EP LAB backup completed.'
} catch {
    @{ ok = $false; completedAt = [DateTime]::UtcNow.ToString('o'); error = 'Backup failed; inspect private operation logs.' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ops 'backup-status.json') -Encoding utf8
    Write-Error $_
} finally {
    Remove-Item Env:\BACKUP_PASSWORD -ErrorAction SilentlyContinue
    if ($owned) { $mutex.ReleaseMutex() }; $mutex.Dispose()
}
if (-not $ok) { exit 1 }
