@echo off
title Bonj POS - Modem / Ethernet Yazici Kurulumu
echo.
if exist "C:\BonjPOS\Setup-ThermalPrinter.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\BonjPOS\Setup-ThermalPrinter.ps1"
  exit /b %errorlevel%
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop'; " ^
  "$dir = 'C:\BonjPOS'; " ^
  "if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; " ^
  "$zip = Join-Path $env:TEMP 'BonjPOS-Windows.zip'; " ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::Tls12; " ^
  "Invoke-WebRequest -Uri 'https://bonjcakestory.com/downloads/BonjPOS-Windows.zip' -OutFile $zip -UseBasicParsing -TimeoutSec 20; " ^
  "$extract = Join-Path $env:TEMP 'BonjPOS-NetSetup'; " ^
  "if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }; " ^
  "Expand-Archive -Path $zip -DestinationPath $extract -Force; " ^
  "$script = Get-ChildItem -Path $extract -Recurse -Filter 'Setup-ThermalPrinter.ps1' | Select-Object -First 1; " ^
  "if ($script) { Copy-Item $script.FullName (Join-Path $dir 'Setup-ThermalPrinter.ps1') -Force; & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dir 'Setup-ThermalPrinter.ps1') }; " ^
  "Remove-Item $zip -Force -ErrorAction SilentlyContinue; " ^
  "Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue"
