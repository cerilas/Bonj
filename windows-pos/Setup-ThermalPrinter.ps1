param(
    [string]$PrinterIp = "",
    [int]$PrinterPort = 9100
)

$ErrorActionPreference = "Stop"

# Auto-elevate to Administrator (required for Windows NIC IP & Printer Port setup)
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Yonetici izni isteniyor..." -ForegroundColor Yellow
    $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    if ($PrinterIp) { $argList += " -PrinterIp `"$PrinterIp`" -PrinterPort $PrinterPort" }
    Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs
    exit 0
}

[Console]::Title = "Bonj POS - Modem / Ethernet Termal Yazici Kurulumu"
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   bonj POS - Modem / Ethernet Termal Yazici Kurulumu" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

function Test-PrinterTcp {
    param(
        [string]$HostIp,
        [int]$Port = 9100,
        [int]$TimeoutMs = 1200
    )
    $client = $null
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $ar = $client.BeginConnect($HostIp, $Port, $null, $null)
        if (-not $ar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            return $false
        }
        $client.EndConnect($ar)
        return $true
    } catch {
        return $false
    } finally {
        if ($client) {
            try { $client.Close() } catch {}
        }
    }
}

function Get-SubnetPrefix {
    param([string]$Ip)
    $parts = $Ip.Split(".")
    if ($parts.Length -eq 4) {
        return "$($parts[0]).$($parts[1]).$($parts[2])"
    }
    return ""
}

function Send-RawEscPosTest {
    param(
        [string]$HostIp,
        [int]$Port,
        [string]$Label
    )
    $lines = @(
        "bonj cake story",
        "--------------------------------------",
        "MODEM / ETHERNET YAZICI TESTI",
        "Yazici : $Label",
        "IP     : ${HostIp}:${Port}",
        "PC     : $env:COMPUTERNAME",
        "Tarih  : $((Get-Date).ToString('dd.MM.yyyy HH:mm:ss'))",
        "--------------------------------------",
        "Ag baglantisi basarili!"
    )
    $buf = New-Object 'System.Collections.Generic.List[byte]'
    $buf.AddRange([byte[]]@(0x1B, 0x40, 0x1B, 0x74, 0x12))
    foreach ($ln in $lines) {
        $ascii = [System.Text.Encoding]::ASCII.GetBytes($ln)
        $buf.AddRange($ascii)
        $buf.Add(0x0A)
    }
    $buf.AddRange([byte[]]@(0x1B, 0x64, 0x04, 0x1D, 0x56, 0x42, 0x03))
    $payload = $buf.ToArray()

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $ar = $client.BeginConnect($HostIp, $Port, $null, $null)
        if (-not $ar.AsyncWaitHandle.WaitOne(2500, $false)) {
            throw "TCP baglanti zaman asimi"
        }
        $client.EndConnect($ar)
        $stream = $client.GetStream()
        $stream.Write($payload, 0, $payload.Length)
        $stream.Flush()
    } finally {
        $client.Close()
    }
}

# 1. Detect active Windows network adapter with Gateway
$netCfg = Get-NetIPConfiguration | Where-Object {
    $_.IPv4DefaultGateway -ne $null -and $_.IPv4Address -ne $null
} | Select-Object -First 1

if (-not $netCfg) {
    $netCfg = Get-NetIPConfiguration | Where-Object { $_.IPv4Address -ne $null } | Select-Object -First 1
}

if (-not $netCfg) {
    Write-Host "HATA: Aktif bir ag baglantisi (Ethernet/Wi-Fi) bulunamadi." -ForegroundColor Red
    pause
    exit 1
}

$ifIndex = $netCfg.InterfaceIndex
$ifAlias = $netCfg.InterfaceAlias
$pcIpObj = $netCfg.IPv4Address | Select-Object -First 1
$pcIp = [string]$pcIpObj.IPAddress
$pcPrefix = [int]$pcIpObj.PrefixLength
$gwIp = if ($netCfg.IPv4DefaultGateway) { [string]$netCfg.IPv4DefaultGateway[0].NextHop } else { "" }
$pcSubnet = Get-SubnetPrefix -Ip $pcIp

Write-Host "Aktif Ag Karti : $ifAlias" -ForegroundColor Green
Write-Host "Bilgisayar IP  : $pcIp /$pcPrefix"
if ($gwIp) {
    Write-Host "Modem (Gateway): $gwIp"
}
Write-Host ""

# 2. Ask Printer IP & Role
if (-not $PrinterIp) {
    $inputIp = Read-Host "Termal yazicinin mevcut IP adresini yazin [Enter = 192.168.123.100]"
    $PrinterIp = if ($inputIp.Trim()) { $inputIp.Trim() } else { "192.168.123.100" }
}

if (-not ($PrinterIp -match "^[0-9]{1,3}(\.[0-9]{1,3}){3}$")) {
    Write-Host "HATA: Gecersiz IP adresi: $PrinterIp" -ForegroundColor Red
    pause
    exit 1
}

$roleInput = Read-Host "Bu yazici hangi gorevde calissin? (1 = Mutfak Yazicisi, 2 = Kasa Yazicisi) [Enter = 1]"
$role = if ($roleInput.Trim() -eq "2") { "cashier" } else { "kitchen" }
$roleTitle = if ($role -eq "cashier") { "Kasa" } else { "Mutfak" }
$defaultName = "$roleTitle Ethernet ($PrinterIp)"
$nameInput = Read-Host "Yazici adi [Enter = $defaultName]"
$printerLabel = if ($nameInput.Trim()) { $nameInput.Trim() } else { $defaultName }

Write-Host ""
Write-Host "Yaziciya baglaniliyor ($PrinterIp`:$PrinterPort)..." -ForegroundColor Cyan

$targetIp = $PrinterIp
$reachable = Test-PrinterTcp -HostIp $targetIp -Port $PrinterPort -TimeoutMs 1000
$prSubnet = Get-SubnetPrefix -Ip $PrinterIp

if (-not $reachable -and $pcSubnet -and $prSubnet -and $pcSubnet -ne $prSubnet) {
    Write-Host ""
    Write-Host "FARKLI ALT AG TESPIT EDILDI:" -ForegroundColor Yellow
    Write-Host "  Bilgisayariniz '$pcSubnet.x' aginda, yazici ise '$prSubnet.x' aginda."
    Write-Host ""
    Write-Host "Nasil baglayalim?"
    Write-Host "  [1] Hizli Cozum (Onerilen): Bilgisayarin ag kartina ikinci IP ($prSubnet.50) ekle."
    Write-Host "      Yazici $PrinterIp olarak kalir, hem internet hem yazici ayni anda calisir."
    Write-Host "  [2] Modem Agina Tasi: Yazicinin web ayar sayfasini (http://$PrinterIp) ac,"
    Write-Host "      yaziciyi '$pcSubnet.200' yap ve bilgisayari eski Otomatik (DHCP) ayarina dondur."
    Write-Host ""
    $modeChoice = Read-Host "Seciminiz (1 veya 2) [Enter = 1]"
    $mode = if ($modeChoice.Trim() -eq "2") { "2" } else { "1" }

    $bridgeIp = if ($PrinterIp -eq "$prSubnet.50") { "$prSubnet.51" } else { "$prSubnet.50" }
    $ipIface = Get-NetIPInterface -InterfaceIndex $ifIndex -AddressFamily IPv4
    $wasDhcp = ($ipIface.Dhcp -eq "Enabled")
    $origDns = @()
    try {
        $dnsObj = Get-DnsClientServerAddress -InterfaceIndex $ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
        if ($dnsObj -and $dnsObj.ServerAddresses) {
            $origDns = @($dnsObj.ServerAddresses)
        }
    } catch {}

    if ($mode -eq "1") {
        Write-Host ""
        Write-Host "Ag kartina ikinci IP ($bridgeIp) ekleniyor..." -ForegroundColor Cyan
        try {
            if ($wasDhcp) {
                # Convert current DHCP lease cleanly to same static IP + gateway + bridge secondary IP
                Set-NetIPInterface -InterfaceIndex $ifIndex -AddressFamily IPv4 -Dhcp Disabled -ErrorAction Stop
                $existingPrimary = Get-NetIPAddress -InterfaceIndex $ifIndex -AddressFamily IPv4 -IPAddress $pcIp -ErrorAction SilentlyContinue
                if (-not $existingPrimary) {
                    if ($gwIp) {
                        New-NetIPAddress -InterfaceIndex $ifIndex -IPAddress $pcIp -PrefixLength $pcPrefix -DefaultGateway $gwIp -ErrorAction Stop | Out-Null
                    } else {
                        New-NetIPAddress -InterfaceIndex $ifIndex -IPAddress $pcIp -PrefixLength $pcPrefix -ErrorAction Stop | Out-Null
                    }
                }
                if ($origDns.Count -gt 0) {
                    Set-DnsClientServerAddress -InterfaceIndex $ifIndex -ServerAddresses $origDns -ErrorAction SilentlyContinue
                } elseif ($gwIp) {
                    Set-DnsClientServerAddress -InterfaceIndex $ifIndex -ServerAddresses @($gwIp, "8.8.8.8") -ErrorAction SilentlyContinue
                }
            }

            $existingBridge = Get-NetIPAddress -InterfaceIndex $ifIndex -AddressFamily IPv4 -IPAddress $bridgeIp -ErrorAction SilentlyContinue
            if (-not $existingBridge) {
                New-NetIPAddress -InterfaceIndex $ifIndex -IPAddress $bridgeIp -PrefixLength 24 -ErrorAction Stop | Out-Null
            }
            Start-Sleep -Milliseconds 1500
            $reachable = Test-PrinterTcp -HostIp $targetIp -Port $PrinterPort -TimeoutMs 1800

            if (-not $reachable) {
                Write-Host "UYARI: Ikinci IP eklendi ancak ${targetIp}:${PrinterPort} yanit vermedi." -ForegroundColor Yellow
                Write-Host "Yazici acik mi ve modeme Ethernet kablosuyla bagli mi kontrol edin."
                $rollbackAns = Read-Host "Gecici ag ayari geri alinsin mi? (E/H) [Enter = E]"
                if ($rollbackAns.Trim() -ne "H" -and $rollbackAns.Trim() -ne "h") {
                    Remove-NetIPAddress -InterfaceIndex $ifIndex -IPAddress $bridgeIp -Confirm:$false -ErrorAction SilentlyContinue
                    if ($wasDhcp) {
                        Remove-NetIPAddress -InterfaceIndex $ifIndex -IPAddress $pcIp -Confirm:$false -ErrorAction SilentlyContinue
                        Set-NetIPInterface -InterfaceIndex $ifIndex -AddressFamily IPv4 -Dhcp Enabled -ErrorAction SilentlyContinue
                        Set-DnsClientServerAddress -InterfaceIndex $ifIndex -ResetServerAddresses -ErrorAction SilentlyContinue
                        ipconfig /renew | Out-Null
                    }
                    Write-Host "Ag ayarlari eski haline donduruldu."
                    pause
                    exit 1
                }
            }
        } catch {
            Write-Host "HATA: Ag ayari uygulanamadi: $($_.Exception.Message)" -ForegroundColor Red
            if ($wasDhcp) {
                Set-NetIPInterface -InterfaceIndex $ifIndex -AddressFamily IPv4 -Dhcp Enabled -ErrorAction SilentlyContinue
                Set-DnsClientServerAddress -InterfaceIndex $ifIndex -ResetServerAddresses -ErrorAction SilentlyContinue
            }
            pause
            exit 1
        }
    } else {
        # Mode 2: Temporarily bridge to open printer web config, then restore DHCP
        $suggestedNewIp = "$pcSubnet.200"
        Write-Host ""
        Write-Host "Gecici baglanti kuruluyor ($bridgeIp) ve tarayicida http://$PrinterIp aciliyor..." -ForegroundColor Cyan
        try {
            if ($wasDhcp) {
                Set-NetIPInterface -InterfaceIndex $ifIndex -AddressFamily IPv4 -Dhcp Disabled -ErrorAction Stop
            }
            $existingBridge = Get-NetIPAddress -InterfaceIndex $ifIndex -AddressFamily IPv4 -IPAddress $bridgeIp -ErrorAction SilentlyContinue
            if (-not $existingBridge) {
                New-NetIPAddress -InterfaceIndex $ifIndex -IPAddress $bridgeIp -PrefixLength 24 -ErrorAction Stop | Out-Null
            }
            Start-Sleep -Milliseconds 1200
            Start-Process "http://$PrinterIp"

            Write-Host ""
            Write-Host "Acilan yazici sayfasinda su ayarlari girin ve kaydedip yaziciyi yeniden baslatin:" -ForegroundColor Yellow
            Write-Host "  IP Address : $suggestedNewIp"
            Write-Host "  Subnet Mask: 255.255.255.0"
            if ($gwIp) { Write-Host "  Gateway    : $gwIp" }
            Write-Host ""
            $newIpAns = Read-Host "Yaziciya verdiginiz yeni IP adresini yazin [Enter = $suggestedNewIp]"
            $targetIp = if ($newIpAns.Trim()) { $newIpAns.Trim() } else { $suggestedNewIp }
            if ($nameInput.Trim() -eq "") {
                $printerLabel = "$roleTitle Ethernet ($targetIp)"
            }
        } finally {
            Write-Host "Bilgisayar eski ag ayarina donduruluyor..." -ForegroundColor Cyan
            Remove-NetIPAddress -InterfaceIndex $ifIndex -IPAddress $bridgeIp -Confirm:$false -ErrorAction SilentlyContinue
            if ($wasDhcp) {
                Set-NetIPInterface -InterfaceIndex $ifIndex -AddressFamily IPv4 -Dhcp Enabled -ErrorAction SilentlyContinue
                Set-DnsClientServerAddress -InterfaceIndex $ifIndex -ResetServerAddresses -ErrorAction SilentlyContinue
                ipconfig /renew | Out-Null
            }
            Start-Sleep -Seconds 3
        }
        $reachable = Test-PrinterTcp -HostIp $targetIp -Port $PrinterPort -TimeoutMs 2500
    }
}

if (-not $reachable) {
    Write-Host ""
    Write-Host "HATA: ${targetIp}:${PrinterPort} adresine erisilemedi." -ForegroundColor Red
    Write-Host "Lutfen yazicinin acik oldugundan ve Ethernet kablosunun modeme takili oldugundan emin olun."
    pause
    exit 1
}

Write-Host "Yaziciya baglanti BASARILI (${targetIp}:${PrinterPort})!" -ForegroundColor Green

# 3. Also add Windows Printer Port + Printer if a compatible driver is installed
try {
    $portName = "IP_$targetIp"
    if (-not (Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue)) {
        Add-PrinterPort -Name $portName -PrinterHostAddress $targetIp -PortNumber $PrinterPort -ErrorAction SilentlyContinue
    }
    $drivers = Get-PrinterDriver -ErrorAction SilentlyContinue
    $bestDriver = $drivers | Where-Object { $_.Name -match "POS-80|XP-80|POS80|EPSON|HPRT|Thermal|Rongta|Zywell|Bixolon|Star" } | Select-Object -First 1
    if (-not $bestDriver) {
        $bestDriver = $drivers | Where-Object { $_.Name -match "Generic / Text Only" } | Select-Object -First 1
    }
    if ($bestDriver) {
        $winPrinterName = "$roleTitle Yazicisi"
        if (-not (Get-Printer -Name $winPrinterName -ErrorAction SilentlyContinue)) {
            Add-Printer -Name $winPrinterName -DriverName $bestDriver.Name -PortName $portName -ErrorAction SilentlyContinue
            Write-Host "Windows yazicisi da eklendi: $winPrinterName (Surucu: $($bestDriver.Name))" -ForegroundColor Green
        }
    }
} catch {}

# 4. Save direct LAN ESC/POS printer to BonjPOS config.json
$configCandidates = @(
    "C:\BonjPOS\config.json",
    (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "config.json")
)
foreach ($cfgPath in $configCandidates) {
    if (Test-Path $cfgPath) {
        try {
            $cfg = Get-Content -Path $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $list = @()
            if ($null -ne $cfg.networkPrinters) {
                foreach ($item in @($cfg.networkPrinters)) {
                    if ([string]$item.host -ne $targetIp -and [string]$item.name -ne $printerLabel) {
                        $list += $item
                    }
                }
            }
            $list += [PSCustomObject]@{
                name = $printerLabel
                host = $targetIp
                port = $PrinterPort
            }
            if ($cfg.PSObject.Properties["networkPrinters"]) {
                $cfg.networkPrinters = $list
            } else {
                $cfg | Add-Member -NotePropertyName "networkPrinters" -NotePropertyValue $list
            }
            if ($role -eq "cashier") {
                $cfg.cashierPrinterName = $printerLabel
            } else {
                $cfg.kitchenPrinterName = $printerLabel
            }
            $cfg | ConvertTo-Json -Depth 6 | Set-Content -Path $cfgPath -Encoding UTF8
            Write-Host "Bonj POS ayari guncellendi: $cfgPath" -ForegroundColor Green
        } catch {
            Write-Host "Uyari: $cfgPath guncellenemedi ($($_.Exception.Message))" -ForegroundColor Yellow
        }
    }
}

# 5. Send real ESC/POS Test Print right now
Write-Host ""
Write-Host "Test fisi yazdiriliyor..." -ForegroundColor Cyan
try {
    Send-RawEscPosTest -HostIp $targetIp -Port $PrinterPort -Label $printerLabel
    Write-Host "TEST FISI GONDERILDI! Yazicidan kagit cikmis olmalidir." -ForegroundColor Green
} catch {
    Write-Host "Test fisi hatasi: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Kurulum tamamlandi!" -ForegroundColor Green
Write-Host "Simdi Admin Panel -> Donanim / Yazicilar -> 'Donanimi Tara / Yenile' butonuna"
Write-Host "basarak '$printerLabel' yazicisini gorebilir ve 'Donanim Ayarlarini Kaydet' diyebilirsiniz."
Write-Host ""
pause
