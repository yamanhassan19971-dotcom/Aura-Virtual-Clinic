# Shared by the clinic's Windows scripts. Written for Windows PowerShell 5.1,
# which every Windows 10/11 laptop already has.

$ErrorActionPreference = "Stop"
$AppDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$DataRoot = "C:\AURA"
$LogDir = Join-Path $DataRoot "logs"
$AppTask = "AURA Clinic App"
$BackupTask = "AURA Daily Backup"
$Port = 3000

function Write-Step($message) {
  Write-Host ""
  Write-Host "== $message" -ForegroundColor Cyan
}

function Assert-Admin {
  $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Please run this as Administrator (right-click > Run as administrator)."
  }
}

function Find-NodeExe {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Node.js is not installed. Install Node.js 22 LTS from nodejs.org, then run this again." }
  return $cmd.Source
}

function Find-PgBin {
  $root = "C:\Program Files\PostgreSQL"
  if (-not (Test-Path $root)) { throw "PostgreSQL is not installed. Install PostgreSQL 16 first, then run this again." }
  $bin = Get-ChildItem $root -Directory |
    Sort-Object { [int]($_.Name -replace "\D", "") } -Descending |
    ForEach-Object { Join-Path $_.FullName "bin" } |
    Where-Object { Test-Path (Join-Path $_ "psql.exe") } |
    Select-Object -First 1
  if (-not $bin) { throw "Could not find psql.exe under $root." }
  return $bin
}

# Runs a command-line program and stops the script if it fails.
function Invoke-Checked {
  param([string]$File, [string[]]$Arguments)
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$File $($Arguments -join ' ') failed (exit $LASTEXITCODE)" }
}

function Stop-App {
  Stop-ScheduledTask -TaskName $AppTask -ErrorAction SilentlyContinue
  # The task's PowerShell host stops, but node can outlive it; stop the app's own node.
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like "*next*start*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Start-App {
  Start-ScheduledTask -TaskName $AppTask
}

function Get-LanAddresses {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -ExpandProperty IPAddress
}
