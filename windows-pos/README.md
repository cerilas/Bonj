# Bonj Kasa POS — Windows Çift Ekran & Termal Yazıcı Entegrasyonu

Bu paket Windows kasa bilgisayarına hiçbir harici program (Node.js, Python vb.) kurmadan:
1. Bilgisayar açılır açılmaz **1. ekranda Admin POS (`/admin?view=tables`)**, **2. ekranda Müşteri Ekranı (`/musteri-ekrani`)** pencerelerini otomatik ve tam ekran (`F11` app modu) açar.
2. Arka planda sessizce çalışan yerel **Donanım & Yazıcı Köprüsü** (`http://127.0.0.1:4895`) üzerinden `bonjcakestory.com/admin` paneline:
   - Bağlı tüm monitörleri canlı listeleme ve panelden ekran seçip anında pencereleri taşıma,
   - Kasa yanı termal yazıcı ve mutfak yazıcısının **bağlı / çevrimdışı / kağıt bitti** durumunu canlı görme,
   - Hangisinin Kasa Yazıcısı, hangisinin Mutfak Yazıcısı olduğunu seçip **test fişi** ve **sessiz otomatik fiş** bastırma imkânı verir.

## Kurulum (Tek Seferlik)

1. `windows-pos` klasörünü Windows kasa bilgisayarına kopyalayın.
2. **`Install-BonjPOS.bat`** dosyasına çift tıklayın.
   - `C:\BonjPOS` altına kurulum yapar.
   - Windows Başlangıç (`Startup`) klasörüne ve Masaüstüne `Bonj Kasa POS` kısayolunu ekler.
   - Yerel donanım köprüsünü ve her iki ekranı hemen açar.
3. İlk açılışta kasiyer ekranından admin girişinizi yapın, ardından sol menüdeki **11 · Donanım & Yazıcılar** sekmesine girin:
   - **Ekran Seçimi:** Hangi monitörün Kasa, hangisinin Müşteri Ekranı olacağını seçip **"Kaydet ve Ekranları Şimdi Taşı"** butonuna basın.
   - **Yazıcı Seçimi:** Windows'a bağlı termal yazıcılar arasından **Kasa Yanı Termal Yazıcı** ve **Mutfak Yazıcısı** atamalarını yapın, **"Kasa Test Fişi"** / **"Mutfak Test Fişi"** ile doğrulayın ve kaydedin.

## Günlük Kullanım
- **Masalar & Kasa:** Adisyon bölümündeki **Mutfak Fişi** butonu doğrudan Mutfak Yazıcısından; **Kapat & Fiş Yazdır** ise Kasa Yazıcısından (tarayıcı yazdırma penceresi açmadan) fiş basar.
- **Ekranları Hızlı Değiştirme:** Gerekirse `C:\BonjPOS\Swap-Screens.bat` ile ekranlar anında yer değiştirilir.
- **Otomatik Açılışı Kaldırma:** `C:\BonjPOS\Uninstall-BonjPOS.bat` dosyasını çalıştırın.
