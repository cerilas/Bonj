param(
    [string]$PrinterIp = "",
    [int]$PrinterPort = 9100
)

$ErrorActionPreference = "Continue"

# Auto-elevate to Administrator (required for Windows NIC IP & Printer setup)
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Yonetici izni isteniyor..." -ForegroundColor Yellow
    $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    if ($PrinterIp) { $argList += " -PrinterIp `"$PrinterIp`" -PrinterPort $PrinterPort" }
    Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs
    exit 0
}

[Console]::Title = "Bonj POS - Modem / Ethernet Termal Yazici Kurulumu"

function Test-PrinterTcp {
    param(
        [string]$HostIp,
        [int]$Port = 9100,
        [int]$TimeoutMs = 1500
    )
    if (-not $HostIp) { return $false }
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
    if (-not $Ip) { return "" }
    $parts = $Ip.Split(".")
    if ($parts.Length -eq 4) {
        return "$($parts[0]).$($parts[1]).$($parts[2])"
    }
    return ""
}

function Convert-PrefixToMask {
    param([int]$PrefixLength)
    if ($PrefixLength -le 0 -or $PrefixLength -gt 32) { return "255.255.255.0" }
    if ($PrefixLength -eq 24) { return "255.255.255.0" }
    if ($PrefixLength -eq 16) { return "255.255.0.0" }
    if ($PrefixLength -eq 8) { return "255.0.0.0" }
    $maskInt = ([uint32]::MaxValue) -shl (32 - $PrefixLength)
    $bytes = @(
        (($maskInt -shr 24) -band 0xFF),
        (($maskInt -shr 16) -band 0xFF),
        (($maskInt -shr 8) -band 0xFF),
        ($maskInt -band 0xFF)
    )
    return ($bytes -join ".")
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
            throw "TCP baglanti zaman asimi (${HostIp}:${Port})"
        }
        $client.EndConnect($ar)
        $stream = $client.GetStream()
        $stream.WriteTimeout = 4000
        $stream.Write($payload, 0, $payload.Length)
        $stream.Flush()
        Start-Sleep -Milliseconds 150
    } finally {
        $client.Close()
    }
}

try {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "   bonj POS - Modem / Ethernet Termal Yazici Kurulumu" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host ""

    # 1. Detect active physical network adapter
    $allConfigs = @(Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object {
        $_.IPv4Address -ne $null -and $_.NetAdapter.Status -eq "Up"
    })
    $netCfg = $allConfigs | Where-Object {
        $_.IPv4DefaultGateway -ne $null -and $_.InterfaceAlias -notmatch "Loopback|vEthernet|VMware|VirtualBox|Bluetooth"
    } | Select-Object -First 1

    if (-not $netCfg) {
        $netCfg = $allConfigs | Where-Object { $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1
    }
    if (-not $netCfg) {
        $netCfg = $allConfigs | Select-Object -First 1
    }
    if (-not $netCfg) {
        throw "Aktif bir Ethernet veya Wi-Fi ag baglantisi bulunamadi."
    }

    $ifIndex = [int]$netCfg.InterfaceIndex
    $ifAlias = [string]$netCfg.InterfaceAlias
    $pcIpObj = $netCfg.IPv4Address | Select-Object -First 1
    $pcIp = [string]$pcIpObj.IPAddress
    $pcPrefix = [int]$pcIpObj.PrefixLength
    $pcMask = Convert-PrefixToMask -PrefixLength $pcPrefix
    $gwIp = if ($netCfg.IPv4DefaultGateway) { [string]$netCfg.IPv4DefaultGateway[0].NextHop } else { "" }
    $pcSubnet = Get-SubnetPrefix -Ip $pcIp

    Write-Host "Aktif Ag Karti : $ifAlias" -ForegroundColor Green
    Write-Host "Bilgisayar IP  : $pcIp ($pcMask)"
    if ($gwIp) {
        Write-Host "Modem (Gateway): $gwIp"
    }
    Write-Host ""

    # 2. Ask Printer IP, Role, and Label
    if (-not $PrinterIp) {
        $inputIp = Read-Host "Termal yazicinin mevcut IP adresini yazin [Enter = 192.168.123.100]"
        $PrinterIp = if ($inputIp -and $inputIp.Trim()) { $inputIp.Trim() } else { "192.168.123.100" }
    }
    if (-not ($PrinterIp -match "^[0-9]{1,3}(\.[0-9]{1,3}){3}$")) {
        throw "Gecersiz IP adresi: $PrinterIp"
    }

    $roleInput = Read-Host "Bu yazici hangi gorevde calissin? (1 = Mutfak Yazicisi, 2 = Kasa Yazicisi) [Enter = 1]"
    $role = if ($roleInput -and $roleInput.Trim() -eq "2") { "cashier" } else { "kitchen" }
    $roleTitle = if ($role -eq "cashier") { "Kasa" } else { "Mutfak" }
    $defaultName = "$roleTitle Ethernet ($PrinterIp)"
    $nameInput = Read-Host "Yazici adi [Enter = $defaultName]"
    $printerLabel = if ($nameInput -and $nameInput.Trim()) { $nameInput.Trim() } else { $defaultName }

    Write-Host ""
    Write-Host "[1/4] Yaziciya erisim kontrol ediliyor (${PrinterIp}:${PrinterPort})..." -ForegroundColor Cyan

    $targetIp = $PrinterIp
    $reachable = Test-PrinterTcp -HostIp $targetIp -Port $PrinterPort -TimeoutMs 1200
    $prSubnet = Get-SubnetPrefix -Ip $PrinterIp

    if ($reachable) {
        Write-Host "      -> Port ${PrinterPort} dogrudan acik!" -ForegroundColor Green
    } else {
        Write-Host "      -> Dogrudan ulasilamadi." -ForegroundColor Yellow
        if ($pcSubnet -and $prSubnet -and $pcSubnet -ne $prSubnet) {
            Write-Host ""
            Write-Host "FARKLI ALT AG TESPIT EDILDI:" -ForegroundColor Yellow
            Write-Host "  Bilgisayariniz '$pcSubnet.x' aginda, yazici '$prSubnet.x' aginda."
            Write-Host ""
            Write-Host "  [1] Hizli Cozum (Onerilen): Bilgisayar ag kartina ikinci IP ($prSubnet.50) ekle."
            Write-Host "      Hem internet hem yazici ($PrinterIp) ayni anda calisir."
            Write-Host "  [2] Yaziciyi Modem Agina Tasi: Yazici web sayfasini (http://$PrinterIp) ac,"
            Write-Host "      yaziciyi '$pcSubnet.200' yap ve bilgisayari DHCP'ye dondur."
            Write-Host ""
            $modeChoice = Read-Host "Seciminiz (1 veya 2) [Enter = 1]"
            $mode = if ($modeChoice -and $modeChoice.Trim() -eq "2") { "2" } else { "1" }

            $bridgeIp = if ($PrinterIp -eq "$prSubnet.50") { "$prSubnet.51" } else { "$prSubnet.50" }
            $ipIface = Get-NetIPInterface -InterfaceIndex $ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
            $wasDhcp = ($ipIface -and $ipIface.Dhcp -eq "Enabled")
            $origDns = @()
            try {
                $dnsObj = Get-DnsClientServerAddress -InterfaceIndex $ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
                if ($dnsObj -and $dnsObj.ServerAddresses) {
                    $origDns = @($dnsObj.ServerAddresses | Where-Object { $_ -match "^[0-9]+\." })
                }
            } catch {}

            if ($mode -eq "1") {
                Write-Host ""
                Write-Host "[2/4] '$ifAlias' ag kartina ikinci IP ($bridgeIp) ekleniyor..." -ForegroundColor Cyan

                if ($wasDhcp) {
                    if ($gwIp) {
                        & netsh interface ipv4 set address name="$ifAlias" source=static address=$pcIp mask=$pcMask gateway=$gwIp gwmetric=1 | Out-Null
                    } else {
                        & netsh interface ipv4 set address name="$ifAlias" source=static address=$pcIp mask=$pcMask | Out-Null
                    }
                    $dns1 = if ($origDns.Count -gt 0) { $origDns[0] } elseif ($gwIp) { $gwIp } else { "8.8.8.8" }
                    & netsh interface ipv4 set dnsservers name="$ifAlias" source=static address=$dns1 register=primary validate=no | Out-Null
                    if ($origDns.Count -gt 1) {
                        & netsh interface ipv4 add dnsservers name="$ifAlias" address=$($origDns[1]) index=2 validate=no | Out-Null
                    } elseif ($dns1 -ne "8.8.8.8") {
                        & netsh interface ipv4 add dnsservers name="$ifAlias" address=8.8.8.8 index=2 validate=no | Out-Null
                    }
                }

                & netsh interface ipv4 add address name="$ifAlias" address=$bridgeIp mask=255.255.255.0 | Out-Null
                Start-Sleep -Seconds 2

                $pingOk = Test-Connection -ComputerName $targetIp -Count 1 -Quiet -ErrorAction SilentlyContinue
                $reachable = Test-PrinterTcp -HostIp $targetIp -Port $PrinterPort -TimeoutMs 2000
                Write-Host ("      -> Ping: {0} | Port {1}: {2}" -f $pingOk, $PrinterPort, $reachable)

                if (-not $reachable) {
                    Write-Host ""
                    Write-Host "UYARI: Ikinci IP ($bridgeIp) eklendi ama ${targetIp}:${PrinterPort} yanit vermedi." -ForegroundColor Yellow
                    Write-Host "Yazicinin gucunun acik oldugunu ve Ethernet kablosunun modeme takili oldugunu kontrol edin."
                    $rollbackAns = Read-Host "Gecici ag ayari geri alinsin mi? (E/H) [Enter = E]"
                    if (-not $rollbackAns -or $rollbackAns.Trim() -ne "H" -and $rollbackAns.Trim() -ne "h") {
                        & netsh interface ipv4 delete address name="$ifAlias" address=$bridgeIp | Out-Null
                        if ($wasDhcp) {
                            & netsh interface ipv4 set address name="$ifAlias" source=dhcp | Out-Null
                            & netsh interface ipv4 set dnsservers name="$ifAlias" source=dhcp | Out-Null
                            & ipconfig /renew | Out-Null
                        }
                        Write-Host "Ag ayarlari eski haline donduruldu."
                        throw "Yaziciya erisilemedigi icin islem iptal edildi."
                    }
                }
            } else {
                $suggestedNewIp = "$pcSubnet.200"
                Write-Host ""
                Write-Host "[2/4] Gecici kopru ($bridgeIp) aciliyor ve tarayicida http://$PrinterIp aciliyor..." -ForegroundColor Cyan
                try {
                    if ($wasDhcp) {
                        if ($gwIp) {
                            & netsh interface ipv4 set address name="$ifAlias" source=static address=$pcIp mask=$pcMask gateway=$gwIp gwmetric=1 | Out-Null
                        } else {
                            & netsh interface ipv4 set address name="$ifAlias" source=static address=$pcIp mask=$pcMask | Out-Null
                        }
                    }
                    & netsh interface ipv4 add address name="$ifAlias" address=$bridgeIp mask=255.255.255.0 | Out-Null
                    Start-Sleep -Seconds 2
                    Start-Process "http://$PrinterIp"

                    Write-Host ""
                    Write-Host "Acilan yazici sayfasinda su ayarlari girip kaydedin ve yaziciyi kapatip acin:" -ForegroundColor Yellow
                    Write-Host "  IP Address : $suggestedNewIp"
                    Write-Host "  Subnet Mask: 255.255.255.0"
                    if ($gwIp) { Write-Host "  Gateway    : $gwIp" }
                    Write-Host ""
                    $newIpAns = Read-Host "Yaziciya verdiginiz yeni IP adresini yazin [Enter = $suggestedNewIp]"
                    $targetIp = if ($newIpAns -and $newIpAns.Trim()) { $newIpAns.Trim() } else { $suggestedNewIp }
                    if (-not ($nameInput -and $nameInput.Trim())) {
                        $printerLabel = "$roleTitle Ethernet ($targetIp)"
                    }
                } finally {
                    Write-Host "Bilgisayar eski ag ayarina donduruluyor..." -ForegroundColor Cyan
                    & netsh interface ipv4 delete address name="$ifAlias" address=$bridgeIp | Out-Null
                    if ($wasDhcp) {
                        & netsh interface ipv4 set address name="$ifAlias" source=dhcp | Out-Null
                        & netsh interface ipv4 set dnsservers name="$ifAlias" source=dhcp | Out-Null
                        & ipconfig /renew | Out-Null
                    }
                    Start-Sleep -Seconds 3
                }
                $reachable = Test-PrinterTcp -HostIp $targetIp -Port $PrinterPort -TimeoutMs 2500
            }
        }
    }

    if (-not $reachable) {
        Write-Host ""
        Write-Host "UYARI: ${targetIp}:${PrinterPort} adresine su an baglanilamadi." -ForegroundColor Yellow
        $saveAnyway = Read-Host "Yine de Bonj POS ayarlarina kaydedilsin mi? (E/H) [Enter = E]"
        if ($saveAnyway -and ($saveAnyway.Trim() -eq "H" -or $saveAnyway.Trim() -eq "h")) {
            throw "Kullanici tarafindan iptal edildi."
        }
    } else {
        Write-Host "[2/4] Yaziciya baglanti BASARILI (${targetIp}:${PrinterPort})!" -ForegroundColor Green
    }

    # 3. Also try registering Windows TCP/IP port + Printer if a driver exists
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
                Write-Host "      -> Windows yazicisi da eklendi: $winPrinterName" -ForegroundColor Green
            }
        }
    } catch {}

    # 4. Save direct LAN ESC/POS printer to BonjPOS config.json
    Write-Host "[3/4] Bonj POS yapilandirmasi kaydediliyor..." -ForegroundColor Cyan
    $configCandidates = @(
        "C:\BonjPOS\config.json",
        (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "config.json")
    ) | Select-Object -Unique

    $savedAny = $false
    foreach ($cfgPath in $configCandidates) {
        if (Test-Path $cfgPath) {
            $cfg = Get-Content -Path $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $list = @()
            if ($null -ne $cfg.networkPrinters) {
                foreach ($item in @($cfg.networkPrinters)) {
                    if ($null -ne $item -and [string]$item.host -ne $targetIp -and [string]$item.name -ne $printerLabel) {
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
            $savedAny = $true
            Write-Host "      -> Kaydedildi: $cfgPath ($printerLabel)" -ForegroundColor Green
        }
    }
    if (-not $savedAny) {
        Write-Host "      -> Uyari: C:\BonjPOS\config.json bulunamadi (Once BonjPOS-TekTiklaKur.bat calistirin)." -ForegroundColor Yellow
    }

    # 5. Send real ESC/POS Test Print right now
    Write-Host "[4/4] Test fisi yazdiriliyor..." -ForegroundColor Cyan
    if ($reachable) {
        Send-RawEscPosTest -HostIp $targetIp -Port $PrinterPort -Label $printerLabel
        Write-Host "      -> TEST FISI GONDERILDI! Yazicidan kagit cikmis olmalidir." -ForegroundColor Green
    } else {
        Write-Host "      -> Yazici cevrimdisi oldugu icin test fisi atlandi." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "ISLEM TAMAMLANDI!" -ForegroundColor Green
    Write-Host "Admin Panel -> Donanim / Yazicilar -> 'Donanimi Tara / Yenile' diyerek"
    Write-Host "'$printerLabel' yazicisini gorup 'Donanim Ayarlarini Kaydet' diyebilirsiniz."
} catch {
    Write-Host ""
    Write-Host "HATA OLUSTU: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Write-Host ""
    Read-Host "Kapatmak icin Enter tusuna basin"
}
