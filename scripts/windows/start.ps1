# Runs the AURA app. Started by the "AURA Clinic App" scheduled task when the
# laptop boots; not normally run by hand.
. (Join-Path $PSScriptRoot "common.ps1")

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $AppDir
$env:NODE_ENV = "production"
$node = Find-NodeExe
$log = Join-Path $LogDir ("app-" + (Get-Date -Format "yyyy-MM") + ".log")
Add-Content -Path $log -Value "`r`n[$(Get-Date -Format s)] Starting AURA on port $Port"
& $node "node_modules\next\dist\bin\next" start -H 0.0.0.0 -p $Port *>> $log
