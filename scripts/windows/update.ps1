# Installs the newest version of AURA: backup, download, build, restart.
. (Join-Path $PSScriptRoot "common.ps1")
Assert-Admin
Set-Location $AppDir

Write-Step "Backing up first"
& (Join-Path $PSScriptRoot "backup.ps1") -Label "before-update"

Write-Step "Downloading the new version"
Invoke-Checked "git" @("pull", "--ff-only")

Write-Step "Stopping the app"
Stop-App

Write-Step "Installing and building"
Invoke-Checked "npm.cmd" @("ci", "--no-audit", "--no-fund")
# npm ci doesn't always generate the database client on Windows; the build needs it.
Invoke-Checked "npx.cmd" @("prisma", "generate")
Invoke-Checked "npx.cmd" @("prisma", "migrate", "deploy")
Invoke-Checked "npm.cmd" @("run", "build")

Write-Step "Starting the app"
Start-App
Write-Host "AURA is updated." -ForegroundColor Green
