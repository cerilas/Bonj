param(
    [switch]$SkipDelay
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir "config.json"
$bridgePath = Join-Path $scriptDir "BonjPOSBridge.ps1"
$logPath = Join-Path $scriptDir "bonj-pos.log"

function Write-Log {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $logPath -Value $line -Encoding UTF8
}

if (-not (Test-Path $configPath)) {
    throw "config.json bulunamadi: $configPath"
}

$config = Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$baseUrl = ([string]$config.baseUrl).TrimEnd("/")
$adminUrl = "$baseUrl$($config.adminPath)"
$customerUrl = "$baseUrl$($config.customerPath)"
$profileDir = [string]$config.profileDir
$swapScreens = [bool]$config.swapScreens
$kioskPrinting = [bool]$config.kioskPrinting
$startupDelay = [int]$config.startupDelaySeconds
$waitNetworkSec = [int]$config.waitForNetworkSeconds
$waitScreenSec = [int]$config.waitForSecondScreenSeconds
$bridgePort = if ($config.bridgePort) { [int]$config.bridgePort } else { 4895 }

if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

Write-Log "=== Bonj POS Baslatiliyor ==="

if (-not $SkipDelay -and $startupDelay -gt 0) {
    Start-Sleep -Seconds $startupDelay
}

# Start local Windows hardware bridge (screens + thermal printers) if not already listening
if (Test-Path $bridgePath) {
    $bridgeAlive = $false
    try {
        $health = Invoke-WebRequest -Uri "http://127.0.0.1:$bridgePort/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($health.StatusCode -eq 200) { $bridgeAlive = $true }
    } catch {}

    if (-not $bridgeAlive) {
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$bridgePath`"" -WindowStyle Hidden
        Write-Log "Yerel donanim koprusu baslatildi (port $bridgePort)."
        Start-Sleep -Milliseconds 600
    } else {
        Write-Log "Yerel donanim koprusu zaten calisiyor (port $bridgePort)."
    }
}

function Find-ChromePath {
    $candidates = @(
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LocalAppData "Google\Chrome\Application\chrome.exe")
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path $p)) {
            return $p
        }
    }
    $cmd = Get-Command chrome.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$chromePath = Find-ChromePath
if (-not $chromePath) {
    Write-Log "HATA: Google Chrome bulunamadi."
    exit 1
}

# Wait for site reachability on boot so Chrome does not show offline page
$deadline = (Get-Date).AddSeconds($waitNetworkSec)
$siteReady = $false
while ((Get-Date) -lt $deadline) {
    try {
        $resp = Invoke-WebRequest -Uri $baseUrl -Method Head -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
            $siteReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}
Write-Log "Site durumu: $siteReady ($baseUrl)"

Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class BonjWin32 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const int SW_RESTORE = 9;
    public const byte VK_MENU = 0x12;
    public const byte VK_F11 = 0x7A;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static List<IntPtr> GetChromeWindows() {
        var list = new List<IntPtr>();
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            var cls = new StringBuilder(64);
            GetClassName(hWnd, cls, cls.Capacity);
            if (cls.ToString() == "Chrome_WidgetWin_1") {
                var title = new StringBuilder(256);
                GetWindowText(hWnd, title, title.Capacity);
                if (title.Length > 0) {
                    list.Add(hWnd);
                }
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static void ForceFocus(IntPtr hWnd) {
        IntPtr fg = GetForegroundWindow();
        uint pid;
        uint fgThread = fg != IntPtr.Zero ? GetWindowThreadProcessId(fg, out pid) : 0;
        uint curThread = GetCurrentThreadId();

        keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        if (fgThread != 0 && fgThread != curThread) {
            AttachThreadInput(curThread, fgThread, true);
        }
        ShowWindow(hWnd, SW_RESTORE);
        SetForegroundWindow(hWnd);
        if (fgThread != 0 && fgThread != curThread) {
            AttachThreadInput(curThread, fgThread, false);
        }
    }

    public static void SendF11() {
        keybd_event(VK_F11, 0, 0, UIntPtr.Zero);
        keybd_event(VK_F11, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static bool IsBoundsFullscreen(IntPtr hWnd, int targetWidth, int targetHeight) {
        RECT r;
        if (!GetWindowRect(hWnd, out r)) return false;
        int w = r.Right - r.Left;
        int h = r.Bottom - r.Top;
        return Math.Abs(w - targetWidth) <= 6 && Math.Abs(h - targetHeight) <= 6;
    }
}
"@

# Close existing Chrome instances tied only to BonjPOS profile so relaunches stay clean
try {
    $escapedProfile = [Regex]::Escape($profileDir)
    $existingPosChrome = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match $escapedProfile }
    if ($existingPosChrome) {
        Write-Log "Onceki BonjPOS Chrome pencereleri kapatiliyor..."
        foreach ($proc in $existingPosChrome) {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Milliseconds 900
    }
} catch {
    Write-Log "Uyari: Onceki surec kontrolu atlandi ($($_.Exception.Message))"
}

# Enable DPI awareness so multi-monitor coordinates are exact even with mixed Windows scaling
[void][BonjWin32]::SetProcessDPIAware()

# Wait briefly for secondary monitor if HDMI/DP wakes slowly after login
$screenDeadline = (Get-Date).AddSeconds($waitScreenSec)
$screens = [System.Windows.Forms.Screen]::AllScreens
while ($screens.Count -lt 2 -and (Get-Date) -lt $screenDeadline) {
    Start-Sleep -Milliseconds 500
    $screens = [System.Windows.Forms.Screen]::AllScreens
}

$cashierIdx = if ($null -ne $config.cashierScreenIndex) { [int]$config.cashierScreenIndex } else { 0 }
$customerIdx = if ($null -ne $config.customerScreenIndex) { [int]$config.customerScreenIndex } else { 1 }

if ($swapScreens -and $screens.Count -ge 2) {
    $tmp = $cashierIdx
    $cashierIdx = $customerIdx
    $customerIdx = $tmp
}

if ($cashierIdx -lt 0 -or $cashierIdx -ge $screens.Count) { $cashierIdx = 0 }
$cashierScreen = $screens[$cashierIdx]

$customerScreen = $null
if ($screens.Count -ge 2) {
    if ($customerIdx -lt 0 -or $customerIdx -ge $screens.Count) {
        $customerIdx = if ($cashierIdx -eq 0) { 1 } else { 0 }
    }
    $customerScreen = $screens[$customerIdx]
}

Write-Log ("Ekran sayisi: {0} | Kasa (Ekran {1}): {2}x{3} ({4},{5})" -f $screens.Count, ($cashierIdx + 1), $cashierScreen.Bounds.Width, $cashierScreen.Bounds.Height, $cashierScreen.Bounds.X, $cashierScreen.Bounds.Y)
if ($customerScreen) {
    Write-Log ("Musteri ekrani (Ekran {0}): {1}x{2} ({3},{4})" -f ($customerIdx + 1), $customerScreen.Bounds.Width, $customerScreen.Bounds.Height, $customerScreen.Bounds.X, $customerScreen.Bounds.Y)
}

function Launch-And-Place-Window {
    param(
        [string]$Url,
        [System.Windows.Forms.Screen]$Screen,
        [string]$Label
    )

    $before = New-Object 'System.Collections.Generic.HashSet[IntPtr]'
    foreach ($h in [BonjWin32]::GetChromeWindows()) {
        [void]$before.Add($h)
    }

    $bx = $Screen.Bounds.X
    $by = $Screen.Bounds.Y
    $bw = $Screen.Bounds.Width
    $bh = $Screen.Bounds.Height

    $args = @(
        "--user-data-dir=`"$profileDir`"",
        "--app=`"$Url`"",
        "--new-window",
        "--window-position=$bx,$by",
        "--window-size=$bw,$bh",
        "--autoplay-policy=no-user-gesture-required",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble"
    )
    if ($kioskPrinting) {
        $args += "--kiosk-printing"
    }

    Start-Process -FilePath $chromePath -ArgumentList ($args -join " ") | Out-Null

    $newHwnd = [IntPtr]::Zero
    $winDeadline = (Get-Date).AddSeconds(18)
    while ((Get-Date) -lt $winDeadline) {
        Start-Sleep -Milliseconds 250
        foreach ($h in [BonjWin32]::GetChromeWindows()) {
            if (-not $before.Contains($h)) {
                $newHwnd = $h
                break
            }
        }
        if ($newHwnd -ne [IntPtr]::Zero) { break }
    }

    if ($newHwnd -eq [IntPtr]::Zero) {
        Write-Log "UYARI: $Label penceresi tespit edilemedi."
        return [IntPtr]::Zero
    }

    Start-Sleep -Milliseconds 450
    [BonjWin32]::ForceFocus($newHwnd)
    Start-Sleep -Milliseconds 150
    [void][BonjWin32]::MoveWindow($newHwnd, $bx, $by, $bw, $bh, $true)
    Start-Sleep -Milliseconds 250

    if (-not [BonjWin32]::IsBoundsFullscreen($newHwnd, $bw, $bh)) {
        [BonjWin32]::ForceFocus($newHwnd)
        Start-Sleep -Milliseconds 120
        [BonjWin32]::SendF11()
        Start-Sleep -Milliseconds 350
    }

    Write-Log "$Label yerlestirildi ve tam ekran yapildi (HWND: $newHwnd)."
    return $newHwnd
}

# 1. Launch Admin POS on Cashier Screen
$cashierHwnd = Launch-And-Place-Window -Url $adminUrl -Screen $cashierScreen -Label "Admin POS"

# 2. Launch Customer Display on Secondary Screen (if connected)
if ($customerScreen) {
    Start-Sleep -Milliseconds 600
    $customerHwnd = Launch-And-Place-Window -Url $customerUrl -Screen $customerScreen -Label "Musteri Ekrani"
} else {
    Write-Log "UYARI: Ikinci ekran algilanmadi, sadece Kasa ekrani acildi."
}

# Keep focus on Cashier touch screen
if ($cashierHwnd -ne [IntPtr]::Zero) {
    Start-Sleep -Milliseconds 250
    [BonjWin32]::ForceFocus($cashierHwnd)
}

Write-Log "=== Bonj POS Hazir ==="
