$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (Test-Path -LiteralPath (Join-Path $projectRoot 'data\operations\install.json')) {
    & (Join-Path $PSScriptRoot 'server-control.ps1') -Action Start
    return
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Cần Node.js 24 LTS.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Cài dependency thất bại.' }
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env'))) {
    npm run setup
    if ($LASTEXITCODE -ne 0) { throw 'Thiết lập dữ liệu thất bại.' }
}
npm run dev
