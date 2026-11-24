$ErrorActionPreference = "Stop"

$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetDir = "C:\BonjPOS"

Write-Host "Bonj POS kurulumu baslatiliyor..." -ForegroundColor Cyan

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# Restart existing BonjPOSBridge process if upgrading
try {
    $oldBridge = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "BonjPOSBridge\.ps1" }
    foreach ($p in $oldBridge) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
} catch {}

# Copy launcher & bridge scripts (preserve existing config.json if customized)
$files = @("BonjPOS.ps1", "BonjPOSBridge.ps1", "Start-BonjPOS.bat", "Swap-Screens.bat", "Uninstall-BonjPOS.bat", "README.md")
foreach ($f in $files) {
    $src = Join-Path $sourceDir $f
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $targetDir $f) -Force
    }
}

$targetConfig = Join-Path $targetDir "config.json"
if (-not (Test-Path $targetConfig)) {
    Copy-Item -Path (Join-Path $sourceDir "config.json") -Destination $targetConfig -Force
}

$chromeIcon = @(
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LocalAppData "Google\Chrome\Application\chrome.exe")
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$wsh = New-Object -ComObject WScript.Shell

# 1. Desktop shortcut
$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcut = $wsh.CreateShortcut((Join-Path $desktopPath "Bonj Kasa POS.lnk"))
$desktopShortcut.TargetPath = "powershell.exe"
$desktopShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$targetDir\BonjPOS.ps1`" -SkipDelay"
$desktopShortcut.WorkingDirectory = $targetDir
if ($chromeIcon) { $desktopShortcut.IconLocation = "$chromeIcon,0" }
$desktopShortcut.Save()

# 2. Windows Startup folder shortcut (auto-starts on Windows logon)
$startupPath = [Environment]::GetFolderPath("Startup")
$startupShortcut = $wsh.CreateShortcut((Join-Path $startupPath "Bonj Kasa POS.lnk"))
$startupShortcut.TargetPath = "powershell.exe"
$startupShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$targetDir\BonjPOS.ps1`""
$startupShortcut.WorkingDirectory = $targetDir
if ($chromeIcon) { $startupShortcut.IconLocation = "$chromeIcon,0" }
$startupShortcut.Save()

Write-Host ""
Write-Host "Kurulum tamamlandi!" -ForegroundColor Green
Write-Host " - Kurulum klasoru : $targetDir"
Write-Host " - Otomatik baslatma: $startupPath\Bonj Kasa POS.lnk"
Write-Host " - Masaustu kisayolu : $desktopPath\Bonj Kasa POS.lnk"
Write-Host " - Donanim koprusu  : http://127.0.0.1:4895"
Write-Host ""
Write-Host "Simdi POS, Musteri Ekrani ve Yazici Koprusu aciliyor..." -ForegroundColor Yellow

Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$targetDir\BonjPOS.ps1`" -SkipDelay"
