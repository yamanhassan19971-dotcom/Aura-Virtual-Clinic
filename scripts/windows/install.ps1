# One-time install of AURA on the clinic laptop. Run as Administrator from
# the AURA folder (install.cmd does that). Safe to run again: steps already
# done are skipped, and existing data, settings and passwords are kept.
#
# Before running: Node.js 22 LTS and PostgreSQL 16 are installed (see
# docs/CLINIC-INSTALL-AR.md).
. (Join-Path $PSScriptRoot "common.ps1")
Assert-Admin
Set-Location $AppDir

Write-Step "Checking Node.js and PostgreSQL"
$node = Find-NodeExe
$nodeVersion = (& $node --version)
if ([int]($nodeVersion.TrimStart("v").Split(".")[0]) -lt 22) { throw "Node.js $nodeVersion is too old; install Node.js 22 LTS." }
$pgBin = Find-PgBin
Write-Host "Node.js $nodeVersion, PostgreSQL in $pgBin"

foreach ($dir in @($DataRoot, $LogDir, (Join-Path $DataRoot "documents"), (Join-Path $DataRoot "backups"))) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

$envFile = Join-Path $AppDir ".env"
if (Test-Path $envFile) {
  Write-Step "Settings file .env already exists; keeping it"
} else {
  Write-Step "Creating the database"
  $pgPassword = Read-Host "PostgreSQL password for the 'postgres' user (chosen when PostgreSQL was installed)" -AsSecureString
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPassword))
  $psql = Join-Path $pgBin "psql.exe"
  $appPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  $roleExists = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'aura'"
  if ($LASTEXITCODE -ne 0) { throw "Could not connect to PostgreSQL. Check the password." }
  if ($roleExists -eq "1") {
    Invoke-Checked $psql @("-U", "postgres", "-h", "localhost", "-c", "ALTER ROLE aura WITH LOGIN PASSWORD '$appPassword'")
  } else {
    Invoke-Checked $psql @("-U", "postgres", "-h", "localhost", "-c", "CREATE ROLE aura WITH LOGIN PASSWORD '$appPassword'")
  }
  $dbExists = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname = 'aura_clinic'"
  if ($dbExists -ne "1") {
    Invoke-Checked $psql @("-U", "postgres", "-h", "localhost", "-c", "CREATE DATABASE aura_clinic OWNER aura")
  }
  Remove-Item Env:\PGPASSWORD

  Write-Step "Writing settings (.env)"
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $copyDir = Read-Host "Drive letter of the backup USB drive, e.g. E (leave empty to skip)"
  $lines = @(
    "DATABASE_URL=`"postgresql://aura:$appPassword@localhost:5432/aura_clinic`"",
    "AUTH_SECRET=`"$([Convert]::ToBase64String($bytes))`"",
    "# Lets phones and the iPad sign in using the laptop's address.",
    "AUTH_TRUST_HOST=true",
    # Forward slashes: Windows accepts them, and a backslash before a quote would confuse the .env reader.
    "DOCUMENT_STORAGE_ROOT=`"C:/AURA/documents`"",
    "BACKUP_DIR=`"C:/AURA/backups`""
  )
  if ($copyDir) { $lines += "BACKUP_COPY_DIR=`"$($copyDir.TrimEnd(':', '\', '/')):/`"" }
  # UTF-8 without a byte-order mark, which is what Node expects.
  [IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding $false))
}

Write-Step "Installing AURA (this takes a few minutes)"
Invoke-Checked "npm.cmd" @("ci", "--no-audit", "--no-fund")
Invoke-Checked "npx.cmd" @("prisma", "migrate", "deploy")
Invoke-Checked "npm.cmd" @("run", "build")

Write-Step "Setting up the clinic: doctors, hours, prices, staff accounts"
Invoke-Checked "npm.cmd" @("run", "db:setup-clinic")
Write-Host ""
Write-Host "Write down the one-time passwords above NOW. They are not shown again." -ForegroundColor Yellow
Read-Host "Press Enter when you have written them down"

Write-Step "Starting AURA automatically when the laptop turns on"
$powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$appAction = New-ScheduledTaskAction -Execute $powershell -WorkingDirectory $AppDir `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'start.ps1')`""
$appSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $AppTask -Force -Action $appAction -Settings $appSettings `
  -Trigger (New-ScheduledTaskTrigger -AtStartup) `
  -Principal (New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest) | Out-Null

Write-Step "Backing up every night at 21:30"
$backupAction = New-ScheduledTaskAction -Execute $powershell -WorkingDirectory $AppDir `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'backup.ps1')`""
# If the laptop was off at 21:30, the backup runs as soon as it's back on.
$backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $BackupTask -Force -Action $backupAction -Settings $backupSettings `
  -Trigger (New-ScheduledTaskTrigger -Daily -At "21:30") `
  -Principal (New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest) | Out-Null

Write-Step "Letting phones and the iPad on the clinic Wi-Fi reach AURA"
if (-not (Get-NetFirewallRule -DisplayName "AURA Clinic" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "AURA Clinic" -Direction Inbound -Protocol TCP -LocalPort $Port `
    -Action Allow -Profile Private | Out-Null
}
# The rule above only applies on a Private network; the clinic Wi-Fi must be Private, not Public.
Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq "Public" } |
  ForEach-Object { Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private }

Write-Step "Keeping the laptop awake while plugged in"
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

Write-Step "Starting AURA"
Stop-App
Start-App
Start-Sleep -Seconds 8
& (Join-Path $PSScriptRoot "backup.ps1") -Label "first"

Write-Host ""
Write-Host "AURA is installed." -ForegroundColor Green
Write-Host "On this laptop:      http://localhost:$Port"
foreach ($ip in Get-LanAddresses) { Write-Host "On the clinic Wi-Fi: http://${ip}:$Port" }
