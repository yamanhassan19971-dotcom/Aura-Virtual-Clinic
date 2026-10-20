# Puts the clinic back to a backup.
#   restore.ps1                       lists the backups
#   restore.ps1 aura-2026-10-20_2130.dump
# The app is stopped, the current data is backed up first, then restored, then
# the app starts again.
param([string]$Backup = "")
. (Join-Path $PSScriptRoot "common.ps1")

$env:PG_BIN = Find-PgBin
$node = Find-NodeExe
$script = Join-Path $AppDir "scripts\clinic\restore.mjs"
Set-Location $AppDir

if (-not $Backup) {
  & $node $script
  exit 0
}

Assert-Admin
$answer = Read-Host "This replaces ALL clinic data with $Backup. Type YES to continue"
if ($answer -ne "YES") { Write-Host "Nothing changed."; exit 0 }

Write-Step "Stopping the app"
Stop-App
try {
  Invoke-Checked $node @($script, $Backup, "--yes")
} finally {
  Write-Step "Starting the app"
  Start-App
}
Write-Host "Done. Open AURA and check the latest patients and appointments." -ForegroundColor Green
