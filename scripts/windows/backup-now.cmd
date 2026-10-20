@echo off
rem Double-click to take a backup now.
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0backup.ps1"
