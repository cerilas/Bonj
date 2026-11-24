@echo off
title Bonj POS - Modem / Ethernet Yazici Kurulumu
echo.
echo En guncel ag yazicisi kurulum araci hazirlaniyor...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop'; " ^
  "$dir = 'C:\BonjPOS'; " ^
  "if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; " ^
  "$target = Join-Path $dir 'Setup-ThermalPrinter.ps1'; " ^
  "$zip = Join-Path $env:TEMP 'BonjPOS-Windows.zip'; " ^
  "$extract = Join-Path $env:TEMP 'BonjPOS-NetSetup'; " ^
  "try { " ^
  "  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::Tls12; " ^
  "  Invoke-WebRequest -Uri 'https://bonjcakestory.com/downloads/BonjPOS-Windows.zip' -OutFile $zip -UseBasicParsing -TimeoutSec 20; " ^
  "  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }; " ^
  "  Expand-Archive -Path $zip -DestinationPath $extract -Force; " ^
  "  $script = Get-ChildItem -Path $extract -Recurse -Filter 'Setup-ThermalPrinter.ps1' | Select-Object -First 1; " ^
  "  if ($script) { Copy-Item $script.FullName $target -Force } " ^
  "} catch { Write-Host 'Indirme atlandi, yerel dosya deneniyor...' }; " ^
  "Remove-Item $zip -Force -ErrorAction SilentlyContinue; " ^
  "Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue; " ^
  "if (-not (Test-Path $target)) { Write-Host 'HATA: Setup-ThermalPrinter.ps1 bulunamadi.'; pause; exit 1 }; " ^
  "& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $target"
