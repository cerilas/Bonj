@echo off
title Bonj Kasa POS - Tek Tikla Kurulum
echo.
echo ===================================================
echo   Bonj Kasa POS - Otomatik Windows Kurulumu
echo ===================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop'; " ^
  "$dir = 'C:\BonjPOS'; " ^
  "if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }; " ^
  "$zip = Join-Path $env:TEMP 'BonjPOS-Windows.zip'; " ^
  "$urls = @('https://bonjcakestory.com/downloads/BonjPOS-Windows.zip', 'https://raw.githubusercontent.com/cerilas/Bonj/main/public/downloads/BonjPOS-Windows.zip'); " ^
  "$downloaded = $false; " ^
  "foreach ($u in $urls) { " ^
  "  try { " ^
  "    Write-Host ('Indiriliyor: ' + $u); " ^
  "    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
  "    Invoke-WebRequest -Uri $u -OutFile $zip -UseBasicParsing -TimeoutSec 20; " ^
  "    $downloaded = $true; break " ^
  "  } catch { Write-Host ('Alternatif deneniyor...') } " ^
  "}; " ^
  "if (-not $downloaded) { throw 'Kurulum paketi indirilemedi. Internet baglantinizi kontrol edin.' }; " ^
  "$extract = Join-Path $env:TEMP 'BonjPOS-Extract'; " ^
  "if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }; " ^
  "Expand-Archive -Path $zip -DestinationPath $extract -Force; " ^
  "$installer = Get-ChildItem -Path $extract -Recurse -Filter 'Install-BonjPOS.ps1' | Select-Object -First 1; " ^
  "if (-not $installer) { throw 'Install-BonjPOS.ps1 bulunamadi.' }; " ^
  "& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer.FullName; " ^
  "Remove-Item $zip -Force -ErrorAction SilentlyContinue; " ^
  "Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue"
echo.
if errorlevel 1 (
  echo Kurulum sirasinda bir hata olustu. Lutfen internet baglantinizi kontrol edin.
  pause
) else (
  echo Kurulum basariyla tamamlandi!
  timeout /t 4 >nul
)
