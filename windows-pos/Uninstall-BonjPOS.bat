@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s = Join-Path ([Environment]::GetFolderPath('Startup')) 'Bonj Kasa POS.lnk'; $d = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Bonj Kasa POS.lnk'; if (Test-Path $s) { Remove-Item $s -Force }; if (Test-Path $d) { Remove-Item $d -Force }; Write-Host 'Bonj Kasa POS otomatik baslatma kaldirildi.'"
pause
