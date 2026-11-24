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

function Apply-ScreenPlacement {
    $cfg = Get-ConfigObject
    $screens = [System.Windows.Forms.Screen]::AllScreens
    if ($screens.Count -eq 0) { return }

    $cIdx = [int]$cfg.cashierScreenIndex
    $mIdx = [int]$cfg.customerScreenIndex
    if ($cIdx -lt 0 -or $cIdx -ge $screens.Count) { $cIdx = 0 }
    if ($mIdx -lt 0 -or $mIdx -ge $screens.Count) {
        $mIdx = if ($screens.Count -gt 1) { 1 } else { 0 }
    }

    $profileDir = [string]$cfg.profileDir
    $escapedProfile = [Regex]::Escape($profileDir)
    $posPids = New-Object 'System.Collections.Generic.HashSet[uint32]'
    try {
        $procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -match $escapedProfile }
        foreach ($pr in $procs) {
            [void]$posPids.Add([uint32]$pr.ProcessId)
        }
    } catch {}

    $allWins = [BonjBridgeWin32]::GetChromeWindows()
    $targetWins = @()
    foreach ($w in $allWins) {
        if ($posPids.Count -eq 0 -or $posPids.Contains($w.Pid)) {
            $targetWins += $w
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

    if ($cashierWin) {
        $sc = $screens[$cIdx]
        $wasFs = [BonjBridgeWin32]::IsBoundsFullscreen($cashierWin.Handle, $sc.Bounds.Width, $sc.Bounds.Height)
        if (-not $wasFs) {
            [BonjBridgeWin32]::ForceFocus($cashierWin.Handle)
            Start-Sleep -Milliseconds 120
            [void][BonjBridgeWin32]::MoveWindow($cashierWin.Handle, $sc.Bounds.X, $sc.Bounds.Y, $sc.Bounds.Width, $sc.Bounds.Height, $true)
            Start-Sleep -Milliseconds 200
            if (-not [BonjBridgeWin32]::IsBoundsFullscreen($cashierWin.Handle, $sc.Bounds.Width, $sc.Bounds.Height)) {
                [BonjBridgeWin32]::SendF11()
                Start-Sleep -Milliseconds 250
            }
        }
    }

    if ($customerWin -and $screens.Count -ge 2) {
        $sm = $screens[$mIdx]
        $wasFs2 = [BonjBridgeWin32]::IsBoundsFullscreen($customerWin.Handle, $sm.Bounds.Width, $sm.Bounds.Height)
        if (-not $wasFs2) {
            [BonjBridgeWin32]::ForceFocus($customerWin.Handle)
            Start-Sleep -Milliseconds 120
            [void][BonjBridgeWin32]::MoveWindow($customerWin.Handle, $sm.Bounds.X, $sm.Bounds.Y, $sm.Bounds.Width, $sm.Bounds.Height, $true)
            Start-Sleep -Milliseconds 200
            if (-not [BonjBridgeWin32]::IsBoundsFullscreen($customerWin.Handle, $sm.Bounds.Width, $sm.Bounds.Height)) {
                [BonjBridgeWin32]::SendF11()
                Start-Sleep -Milliseconds 250
            }
        }
    }

    if ($cashierWin) {
        [BonjBridgeWin32]::ForceFocus($cashierWin.Handle)
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

    $widthHundredths = if ($PaperWidthMm -eq 58) { 225 } else { 310 }
    $estimatedHeight = [Math]::Max(320, (120 + ($Lines.Count * 22)))

    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $PrinterName
    if (-not $doc.PrinterSettings.IsValid) {
        throw "Yazici Windows'ta bulunamadi veya gecersiz: $PrinterName"
    }

    $paperSize = New-Object System.Drawing.Printing.PaperSize("BonjThermal", $widthHundredths, $estimatedHeight)
    $doc.DefaultPageSettings.PaperSize = $paperSize
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(8, 8, 10, 14)

    $fontTitle = New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Bold)
    $fontBody = New-Object System.Drawing.Font("Consolas", 8.5, [System.Drawing.FontStyle]::Regular)
    $fontBold = New-Object System.Drawing.Font("Consolas", 9, [System.Drawing.FontStyle]::Bold)

    $doc.add_PrintPage({
        param($sender, $ev)
        $g = $ev.Graphics
        $x = [float]$ev.MarginBounds.Left
        $y = [float]$ev.MarginBounds.Top
        $w = [float]$ev.MarginBounds.Width
        $brush = [System.Drawing.Brushes]::Black
        $fmtCenter = New-Object System.Drawing.StringFormat
        $fmtCenter.Alignment = [System.Drawing.StringAlignment]::Center
        $fmtLeft = New-Object System.Drawing.StringFormat

        if ($TitleLine) {
            $titleSize = $g.MeasureString($TitleLine, $fontTitle, [int]$w, $fmtCenter)
            $rect = New-Object System.Drawing.RectangleF($x, $y, $w, ($titleSize.Height + 6))
            $g.DrawString($TitleLine, $fontTitle, $brush, $rect, $fmtCenter)
            $y += ($titleSize.Height + 8)
        }

        foreach ($line in $Lines) {
            if ($line -like "BOLD:*") {
                $txt = $line.Substring(5)
                $sz = $g.MeasureString($txt, $fontBold, [int]$w, $fmtLeft)
                $h = [Math]::Max(18, $sz.Height + 3)
                $rect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
                $g.DrawString($txt, $fontBold, $brush, $rect, $fmtLeft)
                $y += ($h + 2)
            } else {
                $sz = $g.MeasureString($line, $fontBody, [int]$w, $fmtLeft)
                $h = [Math]::Max(15, $sz.Height + 2)
                $rect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
                $g.DrawString($line, $fontBody, $brush, $rect, $fmtLeft)
                $y += ($h + 2)
            }
        }
        $ev.HasMorePages = $false
    })

    $doc.Print()
    $fontTitle.Dispose()
    $fontBody.Dispose()
    $fontBold.Dispose()
    $doc.Dispose()
}

function Build-ReceiptLines {
    param($Payload, [int]$PaperWidthMm)
    $isKitchen = ($Payload.target -eq "kitchen")
    $cols = if ($PaperWidthMm -eq 58) { 30 } else { 42 }
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

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
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
