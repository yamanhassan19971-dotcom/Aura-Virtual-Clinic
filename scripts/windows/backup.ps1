# Takes a backup now. The "AURA Daily Backup" task runs this every night;
# run it by hand before anything risky. Optional: -Label before-update
param([string]$Label = "")
. (Join-Path $PSScriptRoot "common.ps1")

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$env:PG_BIN = Find-PgBin
$node = Find-NodeExe
$log = Join-Path $LogDir "backup.log"
$arguments = @((Join-Path $AppDir "scripts\clinic\backup.mjs"))
if ($Label) { $arguments += @("--label", $Label) }
& $node @arguments 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) { throw "Backup failed; see $log" }
