$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir "config.json"
$logPath = Join-Path $scriptDir "bonj-bridge.log"

function Write-BridgeLog {
    param([string]$Message)
    try {
        $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
        Add-Content -Path $logPath -Value $line -Encoding UTF8
    } catch {}
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class BonjBridgeWin32 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public class WinInfo {
        public IntPtr Handle;
        public string Title;
        public uint Pid;
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
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const int SW_RESTORE = 9;
    public const byte VK_MENU = 0x12;
    public const byte VK_F11 = 0x7A;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static List<WinInfo> GetChromeWindows() {
        var list = new List<WinInfo>();
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            var cls = new StringBuilder(64);
            GetClassName(hWnd, cls, cls.Capacity);
            if (cls.ToString() == "Chrome_WidgetWin_1") {
                var title = new StringBuilder(512);
                GetWindowText(hWnd, title, title.Capacity);
                if (title.Length > 0) {
                    uint pid;
                    GetWindowThreadProcessId(hWnd, out pid);
                    list.Add(new WinInfo { Handle = hWnd, Title = title.ToString(), Pid = pid });
                }
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static void ForceFocus(IntPtr hWnd) {
        if (IsIconic(hWnd)) {
            ShowWindow(hWnd, SW_RESTORE);
        }
        SwitchToThisWindow(hWnd, true);
        BringWindowToTop(hWnd);
        SetForegroundWindow(hWnd);
    }

    public static void SendF11() {
        keybd_event(VK_F11, 0, 0, UIntPtr.Zero);
        keybd_event(VK_F11, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static bool IsTrueFullscreen(IntPtr hWnd, int targetX, int targetY, int targetWidth, int targetHeight) {
        if (IsIconic(hWnd)) return false;
        RECT wr;
        if (!GetWindowRect(hWnd, out wr)) return false;
        RECT cr;
        if (!GetClientRect(hWnd, out cr)) return false;
        int ww = wr.Right - wr.Left;
        int wh = wr.Bottom - wr.Top;
        int cw = cr.Right - cr.Left;
        int ch = cr.Bottom - cr.Top;
        bool onTargetMonitor = Math.Abs(wr.Left - targetX) <= 12 && Math.Abs(wr.Top - targetY) <= 12;
        bool matchesOuter = Math.Abs(ww - targetWidth) <= 8 && Math.Abs(wh - targetHeight) <= 8;
        bool matchesClient = cw >= (targetWidth - 10) && ch >= (targetHeight - 10);
        return onTargetMonitor && matchesOuter && matchesClient;
    }

    public static bool NeedsExitFullscreenForMove(IntPtr hWnd, int targetX, int targetY) {
        RECT wr;
        if (!GetWindowRect(hWnd, out wr)) return false;
        RECT cr;
        if (!GetClientRect(hWnd, out cr)) return false;
        bool onTarget = Math.Abs(wr.Left - targetX) <= 12 && Math.Abs(wr.Top - targetY) <= 12;
        if (onTarget) return false;
        int ww = wr.Right - wr.Left;
        int wh = wr.Bottom - wr.Top;
        int cw = cr.Right - cr.Left;
        int ch = cr.Bottom - cr.Top;
        return Math.Abs(ww - cw) <= 6 && Math.Abs(wh - ch) <= 6;
    }
}
"@

[void][BonjBridgeWin32]::SetProcessDPIAware()

function Get-ConfigObject {
    if (Test-Path $configPath) {
        return (Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    }
    return [PSCustomObject]@{
        baseUrl = "https://bonjcakestory.com"
        adminPath = "/admin?view=tables"
        customerPath = "/musteri-ekrani"
        profileDir = "C:\BonjPOS\ChromeProfile"
        cashierScreenIndex = 0
        customerScreenIndex = 1
        cashierPrinterName = ""
        kitchenPrinterName = ""
        paperWidthMm = 80
        swapScreens = $false
        kioskPrinting = $false
        bridgePort = 4895
    }
}

function Save-ConfigObject {
    param($Config)
    $Config | ConvertTo-Json -Depth 6 | Set-Content -Path $configPath -Encoding UTF8
}

function Get-MonitorsList {
    $screens = [System.Windows.Forms.Screen]::AllScreens
    $list = @()
    for ($i = 0; $i -lt $screens.Count; $i++) {
        $s = $screens[$i]
        $primTag = if ($s.Primary) { " (Ana Ekran)" } else { "" }
        $list += [PSCustomObject]@{
            index = $i
            deviceName = $s.DeviceName
            primary = [bool]$s.Primary
            width = [int]$s.Bounds.Width
            height = [int]$s.Bounds.Height
            x = [int]$s.Bounds.X
            y = [int]$s.Bounds.Y
            label = ("Ekran {0}{1} - {2}x{3}" -f ($i + 1), $primTag, $s.Bounds.Width, $s.Bounds.Height)
        }
    }
    return ,$list
}

function Get-PrintersList {
    $result = @()
    $wmiPrinters = @()
    try {
        $wmiPrinters = Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop
    } catch {
        $wmiPrinters = @()
    }

    if ($wmiPrinters.Count -gt 0) {
        foreach ($p in $wmiPrinters) {
            $name = [string]$p.Name
            $port = [string]$p.PortName
            $driver = [string]$p.DriverName
            $workOffline = [bool]$p.WorkOffline
            $status = [int]$p.PrinterStatus
            $errState = [int]$p.DetectedErrorState

            $isOnline = (-not $workOffline) -and ($status -ne 7)
            $statusText = "Bagli / Hazir"
            if ($workOffline -or $status -eq 7) {
                $isOnline = $false
                $statusText = "Cevrimdisi / Bagli Degil"
            } elseif ($errState -eq 4) {
                $isOnline = $false
                $statusText = "Kagit Bitti"
            } elseif ($errState -eq 5) {
                $isOnline = $false
                $statusText = "Kagit Sikisti"
            } elseif ($errState -eq 6) {
                $isOnline = $false
                $statusText = "Kapak Acik"
            } elseif ($errState -gt 2) {
                $isOnline = $false
                $statusText = "Yazici Hatasi"
            } elseif ($status -eq 4) {
                $statusText = "Yazdiriyor"
            }

            $hay = ("{0} {1} {2}" -f $name, $port, $driver).ToLowerInvariant()
            $isThermal = $hay -match "pos|thermal|receipt|80mm|58mm|xprinter|epson|tm-|bixolon|star|rongta|zywell|hprt|sewoo|sunmi|usb"

            $result += [PSCustomObject]@{
                name = $name
                isDefault = [bool]$p.Default
                portName = $port
                driverName = $driver
                isOnline = $isOnline
                statusText = $statusText
                isThermalLikely = [bool]$isThermal
            }
        }
    } else {
        foreach ($pname in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters) {
            $hay = ([string]$pname).ToLowerInvariant()
            $isThermal = $hay -match "pos|thermal|receipt|80mm|58mm|xprinter|epson|tm-|bixolon|star|rongta|zywell|hprt|sewoo|sunmi"
            $result += [PSCustomObject]@{
                name = [string]$pname
                isDefault = $false
                portName = ""
                driverName = ""
                isOnline = $true
                statusText = "Kurulu"
                isThermalLikely = [bool]$isThermal
            }
        }
    }

    return ,$result
}

$script:bridgeStartTime = Get-Date
$script:lastWatchdogRun = Get-Date
$script:lastCustomerLaunchAt = [DateTime]::MinValue
$script:lastCashierLaunchAt = [DateTime]::MinValue

function Find-ChromePath {
    $candidates = @(
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LocalAppData "Google\Chrome\Application\chrome.exe")
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    $cmd = Get-Command chrome.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Ensure-WindowFullscreen {
    param(
        [IntPtr]$Handle,
        [System.Windows.Forms.Screen]$Screen,
        [string]$Label
    )

    if ($Handle -eq [IntPtr]::Zero -or $null -eq $Screen) { return $false }

    $bx = $Screen.Bounds.X
    $by = $Screen.Bounds.Y
    $bw = $Screen.Bounds.Width
    $bh = $Screen.Bounds.Height

    if ([BonjBridgeWin32]::IsTrueFullscreen($Handle, $bx, $by, $bw, $bh)) {
        return $false
    }

    $ix = $bx + 30
    $iy = $by + 30
    $iw = [Math]::Max(800, $bw - 60)
    $ih = [Math]::Max(600, $bh - 60)

    if ([BonjBridgeWin32]::NeedsExitFullscreenForMove($Handle, $bx, $by)) {
        [BonjBridgeWin32]::ForceFocus($Handle)
        Start-Sleep -Milliseconds 120
        [BonjBridgeWin32]::SendF11()
        Start-Sleep -Milliseconds 300
    }

    for ($attempt = 1; $attempt -le 4; $attempt++) {
        if ([BonjBridgeWin32]::IsTrueFullscreen($Handle, $bx, $by, $bw, $bh)) {
            break
        }
        [BonjBridgeWin32]::ForceFocus($Handle)
        Start-Sleep -Milliseconds 120
        [void][BonjBridgeWin32]::MoveWindow($Handle, $ix, $iy, $iw, $ih, $true)
        Start-Sleep -Milliseconds 150
        [BonjBridgeWin32]::SendF11()

        for ($poll = 0; $poll -lt 6; $poll++) {
            Start-Sleep -Milliseconds 150
            if ([BonjBridgeWin32]::IsTrueFullscreen($Handle, $bx, $by, $bw, $bh)) {
                break
            }
        }
    }

    $ok = [BonjBridgeWin32]::IsTrueFullscreen($Handle, $bx, $by, $bw, $bh)
    Write-BridgeLog "$Label tam ekran zorlandi (Basarili: $ok)."
    return $true
}

function Launch-PosChromeWindow {
    param(
        [string]$Url,
        [System.Windows.Forms.Screen]$Screen,
        [string]$ProfileDir,
        [bool]$KioskPrinting,
        [string]$Label
    )

    $chromePath = Find-ChromePath
    if (-not $chromePath -or $null -eq $Screen) { return [IntPtr]::Zero }

    $before = New-Object 'System.Collections.Generic.HashSet[IntPtr]'
    foreach ($w in [BonjBridgeWin32]::GetChromeWindows()) {
        [void]$before.Add($w.Handle)
    }

    $bx = $Screen.Bounds.X
    $by = $Screen.Bounds.Y
    $bw = $Screen.Bounds.Width
    $bh = $Screen.Bounds.Height
    $ix = $bx + 30
    $iy = $by + 30
    $iw = [Math]::Max(800, $bw - 60)
    $ih = [Math]::Max(600, $bh - 60)

    $args = @(
        "--user-data-dir=`"$ProfileDir`"",
        "--app=`"$Url`"",
        "--new-window",
        "--window-position=$ix,$iy",
        "--window-size=$iw,$ih",
        "--touch-events=enabled",
        "--disable-pinch",
        "--overscroll-history-navigation=0",
        "--disable-features=TouchpadOverscrollHistoryNavigation",
        "--autoplay-policy=no-user-gesture-required",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble"
    )
    if ($KioskPrinting) { $args += "--kiosk-printing" }

    Start-Process -FilePath $chromePath -ArgumentList ($args -join " ") | Out-Null

    $newHwnd = [IntPtr]::Zero
    $winDeadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $winDeadline) {
        Start-Sleep -Milliseconds 250
        foreach ($w in [BonjBridgeWin32]::GetChromeWindows()) {
            if (-not $before.Contains($w.Handle)) {
                $newHwnd = $w.Handle
                break
            }
        }
        if ($newHwnd -ne [IntPtr]::Zero) { break }
    }

    if ($newHwnd -eq [IntPtr]::Zero) {
        Write-BridgeLog "UYARI: $Label yeniden acilamadi (pencere bulunamadi)."
        return [IntPtr]::Zero
    }

    Start-Sleep -Milliseconds 450
    [void](Ensure-WindowFullscreen -Handle $newHwnd -Screen $Screen -Label $Label)
    return $newHwnd
}

function Apply-ScreenPlacement {
    param(
        [bool]$AllowReopen = $true
    )

    $cfg = Get-ConfigObject
    $screens = [System.Windows.Forms.Screen]::AllScreens
    if ($screens.Count -eq 0) { return }

    $cIdx = [int]$cfg.cashierScreenIndex
    $mIdx = [int]$cfg.customerScreenIndex
    if ($cIdx -lt 0 -or $cIdx -ge $screens.Count) { $cIdx = 0 }
    if ($mIdx -lt 0 -or $mIdx -ge $screens.Count) {
        $mIdx = if ($screens.Count -gt 1) { 1 } else { 0 }
    }
    if ($screens.Count -ge 2 -and $mIdx -eq $cIdx) {
        $mIdx = if ($cIdx -eq 0) { 1 } else { 0 }
    }

    $profileDir = if ($cfg.profileDir) { [string]$cfg.profileDir } else { "C:\BonjPOS\ChromeProfile" }
    $baseUrl = if ($cfg.baseUrl) { ([string]$cfg.baseUrl).TrimEnd("/") } else { "https://bonjcakestory.com" }
    $adminPath = if ($cfg.adminPath) { [string]$cfg.adminPath } else { "/admin?view=tables" }
    $customerPath = if ($cfg.customerPath) { [string]$cfg.customerPath } else { "/musteri-ekrani" }
    $kioskPrinting = [bool]$cfg.kioskPrinting

    $escapedProfile = [Regex]::Escape($profileDir)
    $posPids = New-Object 'System.Collections.Generic.HashSet[uint32]'
    try {
        $procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -match $escapedProfile }
        foreach ($pr in $procs) {
            [void]$posPids.Add([uint32]$pr.ProcessId)
        }
    } catch {}

    $targetWins = @()
    if ($posPids.Count -gt 0) {
        $allWins = [BonjBridgeWin32]::GetChromeWindows()
        foreach ($w in $allWins) {
            if ($posPids.Contains($w.Pid)) {
                $targetWins += $w
            }
        }
    }

    $cashierWin = $null
    $customerWin = $null
    foreach ($w in $targetWins) {
        if ($w.Title -match "M\u00fc\u015fteri Ekran\u0131|Musteri Ekrani|musteri-ekrani") {
            $customerWin = $w
        } else {
            if (-not $cashierWin) { $cashierWin = $w }
        }
    }

    $changed = $false
    $cashierHandle = if ($cashierWin) { $cashierWin.Handle } else { [IntPtr]::Zero }

    if ($cashierWin) {
        if (Ensure-WindowFullscreen -Handle $cashierWin.Handle -Screen $screens[$cIdx] -Label "Admin POS") {
            $changed = $true
        }
    } elseif ($AllowReopen) {
        $now = Get-Date
        if (($now - $script:lastCashierLaunchAt).TotalSeconds -ge 20) {
            $script:lastCashierLaunchAt = $now
            Write-BridgeLog "Watchdog: Admin POS penceresi kapali, yeniden aciliyor..."
            $launched = Launch-PosChromeWindow -Url "$baseUrl$adminPath" -Screen $screens[$cIdx] -ProfileDir $profileDir -KioskPrinting $kioskPrinting -Label "Admin POS"
            if ($launched -ne [IntPtr]::Zero) {
                $cashierHandle = $launched
                $changed = $true
            }
        }
    }

    if ($screens.Count -ge 2 -and $mIdx -ne $cIdx) {
        if ($customerWin) {
            if (Ensure-WindowFullscreen -Handle $customerWin.Handle -Screen $screens[$mIdx] -Label "Musteri Ekrani") {
                $changed = $true
            }
        } elseif ($AllowReopen -and $targetWins.Count -lt 2) {
            $now = Get-Date
            if (($now - $script:lastCustomerLaunchAt).TotalSeconds -ge 15) {
                $script:lastCustomerLaunchAt = $now
                Write-BridgeLog "Watchdog: Musteri Ekrani kapali, 2. ekranda tam ekran aciliyor..."
                $launchedCust = Launch-PosChromeWindow -Url "$baseUrl$customerPath" -Screen $screens[$mIdx] -ProfileDir $profileDir -KioskPrinting $kioskPrinting -Label "Musteri Ekrani"
                if ($launchedCust -ne [IntPtr]::Zero) {
                    $changed = $true
                }
            }
        }
    }

    if ($changed -and $cashierHandle -ne [IntPtr]::Zero) {
        Start-Sleep -Milliseconds 150
        [BonjBridgeWin32]::ForceFocus($cashierHandle)
    }
}

function Format-Money {
    param([int]$Kurus)
    $tl = $Kurus / 100.0
    return ($tl.ToString("N2") + " TL")
}

function Invoke-ThermalPrint {
    param(
        [string]$PrinterName,
        [int]$PaperWidthMm,
        [string[]]$Lines,
        [string]$TitleLine
    )

    if (-not $PrinterName) {
        throw "Yazici secilmedi."
    }

    $logoFile = Join-Path $scriptDir "bonj-logo.png"
    $logoImg = $null
    if (Test-Path $logoFile) {
        try {
            $logoImg = [System.Drawing.Image]::FromFile($logoFile)
        } catch {
            $logoImg = $null
        }
    }

    $widthHundredths = if ($PaperWidthMm -eq 58) { 192 } else { 280 }
    $marginL = 4
    $marginR = 4
    $marginT = 2
    $marginB = 8
    $contentW = [float]($widthHundredths - $marginL - $marginR)

    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $PrinterName
    if (-not $doc.PrinterSettings.IsValid) {
        if ($logoImg) { $logoImg.Dispose() }
        throw "Yazici Windows'ta bulunamadi veya gecersiz: $PrinterName"
    }

    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController

    $fontTitle = New-Object System.Drawing.Font("Consolas", 10.5, [System.Drawing.FontStyle]::Bold)
    $fontBody = New-Object System.Drawing.Font("Consolas", 8.5, [System.Drawing.FontStyle]::Regular)
    $fontBold = New-Object System.Drawing.Font("Consolas", 9, [System.Drawing.FontStyle]::Bold)

    $fmtCenter = New-Object System.Drawing.StringFormat
    $fmtCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $fmtLeft = New-Object System.Drawing.StringFormat

    # Measure true height at 100 DPI (same 1/100 inch unit as PrintDocument)
    $measureBmp = New-Object System.Drawing.Bitmap(1, 1)
    $measureBmp.SetResolution(100, 100)
    $measureG = [System.Drawing.Graphics]::FromImage($measureBmp)
    $measureG.PageUnit = [System.Drawing.GraphicsUnit]::Display

    $measureY = [float]$marginT
    if ($logoImg) {
        $drawW = [Math]::Min($contentW * 0.56, 138.0)
        $drawH = $drawW * ($logoImg.Height / [double]$logoImg.Width)
        $measureY += ([float]$drawH + 4)
    } elseif ($TitleLine) {
        $titleSize = $measureG.MeasureString($TitleLine, $fontTitle, [int]$contentW, $fmtCenter)
        $measureY += ($titleSize.Height + 6)
    }

    foreach ($line in $Lines) {
        if ($line -like "BOLD:*") {
            $txt = $line.Substring(5)
            $sz = $measureG.MeasureString($txt, $fontBold, [int]$contentW, $fmtLeft)
            $h = [Math]::Max(17, ($sz.Height + 3))
            $measureY += ($h + 2)
        } else {
            $sz = $measureG.MeasureString($line, $fontBody, [int]$contentW, $fmtLeft)
            $h = [Math]::Max(14, ($sz.Height + 2))
            $measureY += ($h + 2)
        }
    }

    $measureG.Dispose()
    $measureBmp.Dispose()

    $exactHeight = [int][Math]::Ceiling($measureY + 42)
    $paperSize = New-Object System.Drawing.Printing.PaperSize("BonjThermal", $widthHundredths, [Math]::Max(220, $exactHeight))
    $doc.DefaultPageSettings.PaperSize = $paperSize
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins($marginL, $marginR, $marginT, $marginB)
    $doc.OriginAtMargins = $false

    $doc.add_PrintPage({
        param($sender, $ev)
        $g = $ev.Graphics
        $x = [float]$marginL
        $y = [float]$marginT
        $w = [float]$contentW
        $brush = [System.Drawing.Brushes]::Black

        if ($logoImg) {
            $drawW = [Math]::Min($w * 0.56, 138.0)
            $drawH = $drawW * ($logoImg.Height / [double]$logoImg.Width)
            $drawX = $x + (($w - $drawW) / 2.0)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($logoImg, [float]$drawX, [float]$y, [float]$drawW, [float]$drawH)
            $y += ([float]$drawH + 4)
        } elseif ($TitleLine) {
            $titleSize = $g.MeasureString($TitleLine, $fontTitle, [int]$w, $fmtCenter)
            $rect = New-Object System.Drawing.RectangleF($x, $y, $w, ($titleSize.Height + 4))
            $g.DrawString($TitleLine, $fontTitle, $brush, $rect, $fmtCenter)
            $y += ($titleSize.Height + 6)
        }

        foreach ($line in $Lines) {
            if ($line -like "BOLD:*") {
                $txt = $line.Substring(5)
                $sz = $g.MeasureString($txt, $fontBold, [int]$w, $fmtLeft)
                $h = [Math]::Max(17, ($sz.Height + 3))
                $rect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
                $g.DrawString($txt, $fontBold, $brush, $rect, $fmtLeft)
                $y += ($h + 2)
            } else {
                $sz = $g.MeasureString($line, $fontBody, [int]$w, $fmtLeft)
                $h = [Math]::Max(14, ($sz.Height + 2))
                $rect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
                $g.DrawString($line, $fontBody, $brush, $rect, $fmtLeft)
                $y += ($h + 2)
            }
        }

        # Tiny feed anchor so thermal drivers that trim trailing whitespace feed past the footer before auto-cut
        $feedRect = New-Object System.Drawing.RectangleF($x, ($y + 18), $w, 12)
        $g.DrawString(".", $fontBody, $brush, $feedRect, $fmtCenter)

        $ev.HasMorePages = $false
    })

    try {
        $doc.Print()
    } finally {
        if ($logoImg) { $logoImg.Dispose() }
        $fmtCenter.Dispose()
        $fmtLeft.Dispose()
        $fontTitle.Dispose()
        $fontBody.Dispose()
        $fontBold.Dispose()
        $doc.Dispose()
    }
}

function Build-ReceiptLines {
    param($Payload, [int]$PaperWidthMm)
    $isKitchen = ($Payload.target -eq "kitchen")
    $cols = if ($PaperWidthMm -eq 58) { 26 } else { 38 }
    $sep = "-" * $cols
    $lines = @()

    $nowStr = (Get-Date).ToString("dd.MM.yyyy HH:mm")
    if ($isKitchen) {
        $lines += "BOLD:MUTFAK / HAZIRLIK FISI"
        $lines += "BOLD:$($Payload.tableZone) - $($Payload.tableName)"
        $lines += "Saat: $nowStr"
        if ($Payload.customerName) {
            $lines += "Musteri: $($Payload.customerName)"
        }
        $lines += $sep
        foreach ($item in $Payload.items) {
            $lines += ("BOLD:{0}x {1}" -f $item.quantity, $item.productName)
        }
        if ($Payload.note) {
            $lines += $sep
            $lines += "BOLD:NOT: $($Payload.note)"
        }
        $lines += $sep
        $lines += "Afiyet olsun / Bonj Mutfak"
        return @{
            Title = "bonj cake story"
            Lines = $lines
        }
    } else {
        $lines += "MASA ADISYON FISI"
        $lines += "BOLD:$($Payload.tableZone) - $($Payload.tableName)"
        $lines += "Tarih : $nowStr"
        $lines += "Kisi  : $($Payload.guestCount)"
        if ($Payload.customerName) {
            $lines += "Musteri: $($Payload.customerName)"
        }
        if ($Payload.paymentMethod) {
            $lines += "Odeme : $($Payload.paymentMethod)"
        }
        $lines += $sep
        foreach ($item in $Payload.items) {
            $qtyName = "{0}x {1}" -f $item.quantity, $item.productName
            $amt = Format-Money -Kurus ([int]$item.lineTotalInKurus)
            $pad = [Math]::Max(1, $cols - $qtyName.Length - $amt.Length)
            if ($qtyName.Length + $amt.Length + 1 -le $cols) {
                $lines += ($qtyName + (" " * $pad) + $amt)
            } else {
                $lines += $qtyName
                $lines += ((" " * [Math]::Max(0, $cols - $amt.Length)) + $amt)
            }
        }
        $lines += $sep
        $subStr = Format-Money -Kurus ([int]$Payload.subtotalInKurus)
        $lines += ("Ara Toplam" + (" " * [Math]::Max(1, $cols - 10 - $subStr.Length)) + $subStr)
        if ([int]$Payload.discountInKurus -gt 0) {
            $discStr = "-" + (Format-Money -Kurus ([int]$Payload.discountInKurus))
            $lines += ("Indirim" + (" " * [Math]::Max(1, $cols - 7 - $discStr.Length)) + $discStr)
        }
        $totStr = Format-Money -Kurus ([int]$Payload.totalInKurus)
        $lines += ("BOLD:TOPLAM" + (" " * [Math]::Max(1, $cols - 6 - $totStr.Length)) + $totStr)
        if ($Payload.note) {
            $lines += $sep
            $lines += "Not: $($Payload.note)"
        }
        $lines += $sep
        $lines += "Tesekkur ederiz - bonj"
        return @{
            Title = "bonj cake story"
            Lines = $lines
        }
    }
}

$cfgInit = Get-ConfigObject
$port = if ($cfgInit.bridgePort) { [int]$cfgInit.bridgePort } else { 4895 }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
} catch {
    Write-BridgeLog "Dinleme baslatilamadi (port $port mesgul olabilir): $($_.Exception.Message)"
    exit 0
}

Write-BridgeLog "Bonj POS Donanim Koprusu baslatildi: http://127.0.0.1:$port/"

function Send-JsonResponse {
    param(
        [System.Net.HttpListenerContext]$Ctx,
        [int]$StatusCode,
        $BodyObject
    )
    $res = $Ctx.Response
    $res.StatusCode = $StatusCode
    $origin = $Ctx.Request.Headers["Origin"]
    if ($origin) {
        $res.Headers["Access-Control-Allow-Origin"] = $origin
    } else {
        $res.Headers["Access-Control-Allow-Origin"] = "*"
    }
    $res.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    $res.Headers["Access-Control-Allow-Headers"] = "Content-Type"
    $res.Headers["Access-Control-Allow-Private-Network"] = "true"
    $res.ContentType = "application/json; charset=utf-8"

    $json = $BodyObject | ConvertTo-Json -Depth 6
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.OutputStream.Close()
}

$asyncCtx = $null
while ($listener.IsListening) {
    try {
        if ($null -eq $asyncCtx) {
            $asyncCtx = $listener.BeginGetContext($null, $null)
        }
        $signaled = $asyncCtx.AsyncWaitHandle.WaitOne(3500)
        if (-not $signaled) {
            $now = Get-Date
            $pauseFile = Join-Path $scriptDir "watchdog.paused"
            if (-not (Test-Path $pauseFile)) {
                if ((($now - $script:bridgeStartTime).TotalSeconds -ge 15) -and (($now - $script:lastWatchdogRun).TotalSeconds -ge 12)) {
                    $script:lastWatchdogRun = $now
                    try {
                        Apply-ScreenPlacement -AllowReopen $true
                    } catch {
                        Write-BridgeLog "Watchdog hatasi: $($_.Exception.Message)"
                    }
                }
            }
            continue
        }

        $ctx = $listener.EndGetContext($asyncCtx)
        $asyncCtx = $null
        $req = $ctx.Request
        $path = $req.Url.AbsolutePath.TrimEnd("/").ToLowerInvariant()

        if ($req.HttpMethod -eq "OPTIONS") {
            Send-JsonResponse -Ctx $ctx -StatusCode 200 -BodyObject @{ ok = $true }
            continue
        }

        if ($req.HttpMethod -eq "GET" -and $path -eq "/health") {
            Send-JsonResponse -Ctx $ctx -StatusCode 200 -BodyObject @{
                ok = $true
                hostname = $env:COMPUTERNAME
                os = [System.Environment]::OSVersion.VersionString
            }
            continue
        }

        if ($req.HttpMethod -eq "GET" -and $path -eq "/hardware") {
            $cfg = Get-ConfigObject
            $monitors = Get-MonitorsList
            $printers = Get-PrintersList
            Send-JsonResponse -Ctx $ctx -StatusCode 200 -BodyObject @{
                ok = $true
                hostname = $env:COMPUTERNAME
                os = [System.Environment]::OSVersion.VersionString
                monitors = $monitors
                printers = $printers
                config = @{
                    cashierScreenIndex = [int]$cfg.cashierScreenIndex
                    customerScreenIndex = [int]$cfg.customerScreenIndex
                    cashierPrinterName = [string]$cfg.cashierPrinterName
                    kitchenPrinterName = [string]$cfg.kitchenPrinterName
                    paperWidthMm = if ([int]$cfg.paperWidthMm -eq 58) { 58 } else { 80 }
                    swapScreens = [bool]$cfg.swapScreens
                }
            }
            continue
        }

        $bodyObj = $null
        if ($req.HasEntityBody) {
            $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
            $rawBody = $reader.ReadToEnd()
            $reader.Close()
            if ($rawBody) {
                $bodyObj = $rawBody | ConvertFrom-Json
            }
        }

        if ($req.HttpMethod -eq "POST" -and $path -eq "/config") {
            $cfg = Get-ConfigObject
            if ($null -ne $bodyObj.cashierScreenIndex) { $cfg.cashierScreenIndex = [int]$bodyObj.cashierScreenIndex }
            if ($null -ne $bodyObj.customerScreenIndex) { $cfg.customerScreenIndex = [int]$bodyObj.customerScreenIndex }
            if ($null -ne $bodyObj.cashierPrinterName) { $cfg.cashierPrinterName = [string]$bodyObj.cashierPrinterName }
            if ($null -ne $bodyObj.kitchenPrinterName) { $cfg.kitchenPrinterName = [string]$bodyObj.kitchenPrinterName }
            if ($null -ne $bodyObj.paperWidthMm) {
                $cfg.paperWidthMm = if ([int]$bodyObj.paperWidthMm -eq 58) { 58 } else { 80 }
            }
            $cfg.swapScreens = $false
            Save-ConfigObject -Config $cfg
            Write-BridgeLog "Config guncellendi."
            Send-JsonResponse -Ctx $ctx -StatusCode 200 -BodyObject @{ ok = $true }
            continue
        }

        if ($req.HttpMethod -eq "POST" -and $path -eq "/screens/apply") {
            Apply-ScreenPlacement
            Send-JsonResponse -Ctx $ctx -StatusCode 200 -BodyObject @{ ok = $true }
            continue
        }

        if ($req.HttpMethod -eq "POST" -and $path -eq "/print/test") {
            $cfg = Get-ConfigObject
            $target = if ($bodyObj.target -eq "kitchen") { "kitchen" } else { "cashier" }
            $printerName = if ($bodyObj.printerName) {
                [string]$bodyObj.printerName
            } elseif ($target -eq "kitchen") {
                [string]$cfg.kitchenPrinterName
            } else {
                [string]$cfg.cashierPrinterName
            }
            $pw = if ($bodyObj.paperWidthMm) { [int]$bodyObj.paperWidthMm } elseif ($cfg.paperWidthMm) { [int]$cfg.paperWidthMm } else { 80 }
            $roleLabel = if ($target -eq "kitchen") { "MUTFAK YAZICISI TESTI" } else { "KASA YAZICISI TESTI" }
            $lines = @(
                "BOLD:$roleLabel",
                "Bilgisayar: $env:COMPUTERNAME",
                "Yazici    : $printerName",
                "Rulo      : ${pw}mm",
                "Tarih     : $((Get-Date).ToString('dd.MM.yyyy HH:mm:ss'))",
                "--------------------------------",
                "Baglanti basarili - bonj POS"
            )
            Invoke-ThermalPrint -PrinterName $printerName -PaperWidthMm $pw -TitleLine "bonj cake story" -Lines $lines
            Send-JsonResponse -Ctx $ctx -StatusCode 200 -BodyObject @{ ok = $true; printerName = $printerName }
            continue
        }

        if ($req.HttpMethod -eq "POST" -and $path -eq "/print/receipt") {
            $cfg = Get-ConfigObject
            $target = if ($bodyObj.target -eq "kitchen") { "kitchen" } else { "cashier" }
            $printerName = if ($bodyObj.printerName) {
                [string]$bodyObj.printerName
            } elseif ($target -eq "kitchen") {
                [string]$cfg.kitchenPrinterName
            } else {
                [string]$cfg.cashierPrinterName
            }
            $pw = if ($bodyObj.paperWidthMm) { [int]$bodyObj.paperWidthMm } elseif ($cfg.paperWidthMm) { [int]$cfg.paperWidthMm } else { 80 }
            $built = Build-ReceiptLines -Payload $bodyObj -PaperWidthMm $pw
            Invoke-ThermalPrint -PrinterName $printerName -PaperWidthMm $pw -TitleLine $built.Title -Lines $built.Lines
            Send-JsonResponse -Ctx $ctx -StatusCode 200 -BodyObject @{ ok = $true; printerName = $printerName }
            continue
        }

        Send-JsonResponse -Ctx $ctx -StatusCode 404 -BodyObject @{ error = "Bilinmeyen endpoint." }
    } catch {
        Write-BridgeLog "Hata: $($_.Exception.Message)"
        try {
            Send-JsonResponse -Ctx $ctx -StatusCode 400 -BodyObject @{ error = $_.Exception.Message }
        } catch {}
    }
}
