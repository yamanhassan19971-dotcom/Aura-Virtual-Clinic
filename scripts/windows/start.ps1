# Runs the AURA app. Started by the "AURA Clinic App" scheduled task when the
# laptop boots; not normally run by hand.
. (Join-Path $PSScriptRoot "common.ps1")

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $AppDir
$env:NODE_ENV = "production"
$node = Find-NodeExe
$log = Join-Path $LogDir ("app-" + (Get-Date -Format "yyyy-MM") + ".log")
Add-Content -Path $log -Encoding utf8 -Value "`r`n[$(Get-Date -Format s)] Starting AURA on port $Port"
# Windows PowerShell 5.1 turns every line a native program writes to stderr
# into an error record; with common.ps1's "Stop" preference the first warning
# from Next.js would end this script and take the app down with it.
$ErrorActionPreference = "Continue"
& $node "node_modules\next\dist\bin\next" start -H 0.0.0.0 -p $Port 2>&1 |
  ForEach-Object { "$_" } |
  Out-File -FilePath $log -Append -Encoding utf8
exit $LASTEXITCODE
