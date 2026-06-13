@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-site.ps1"
if errorlevel 1 (
  echo.
  echo Zen Noise did not start. Review the message above, then press any key to close.
  pause >nul
)
