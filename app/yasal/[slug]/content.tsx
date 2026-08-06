import React from 'react';

const COMPANY_NAME = "Fadile Bahar Çolak (BONJ CAKE STORY)";
const BRAND_NAME = "Bonj Cake Story";
const VKN = "11144262360";
const ADDRESS = "Osmangazi, Ahmet Şireci Blv. Riva Apt. No: 18/I-E, 27000 Şehitkamil/Gaziantep";
const PHONE = "0507 644 79 85";
const EMAIL = "iletisim@bonjcakestory.com";
const WEBSITE = "www.bonjcakestory.com";

const sectionStyle = { marginBottom: '2rem' };
const h2Style = { fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#111827', marginTop: '1.5rem' };
const h3Style = { fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827', marginTop: '1rem' };
const pStyle = { marginBottom: '1rem', color: '#374151', lineHeight: 1.7 };
const listStyle = { listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1rem', color: '#374151', lineHeight: 1.7 };
const strongStyle = { fontWeight: 600, color: '#111827' };

export function getLegalContent(slug: string) {
  switch (slug) {
    case 'kvkk-aydinlatma-metni':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section style={sectionStyle}>
            <p style={pStyle}>
              İşbu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, veri sorumlusu sıfatıyla <span style={strongStyle}>{COMPANY_NAME}</span> (“Şirket” veya “{BRAND_NAME}”) tarafından, internet sitemizi ({WEBSITE}) ziyaret eden kullanıcıların, müşterilerimizin ve iş ortaklarımızın kişisel verilerinin işlenmesine ilişkin usul ve esaslar hakkında bilgilendirme amacıyla hazırlanmıştır.
            </p>
            
            <h2 style={h2Style}>1. Veri Sorumlusunun Kimliği</h2>
            <p style={pStyle}>
              KVKK uyarınca muhatap veri sorumlusu bilgilerimiz aşağıda yer almaktadır:<br/>
              <span style={strongStyle}>Unvan:</span> {COMPANY_NAME}<br/>
              <span style={strongStyle}>VKN:</span> {VKN}<br/>
              <span style={strongStyle}>Adres:</span> {ADDRESS}<br/>
              <span style={strongStyle}>E-posta:</span> {EMAIL}
            </p>

            <h2 style={h2Style}>2. İşlenen Kişisel Verileriniz</h2>
            <p style={pStyle}>Sitemizi kullanımınız ve e-ticaret süreçleriniz kapsamında aşağıdaki kişisel verileriniz işlenmektedir:</p>
            <ul style={listStyle}>
              <li><span style={strongStyle}>Kimlik Bilgileri:</span> Ad, soyad, TCKN (Fatura kesimi için gerektiğinde).</li>
              <li><span style={strongStyle}>İletişim Bilgileri:</span> E-posta adresi, telefon numarası, fatura adresi, teslimat adresi.</li>
              <li><span style={strongStyle}>Müşteri İşlem Bilgileri:</span> Sipariş geçmişi, sepet bilgileri, satın alınan ürünler, IP adresi, iptal ve iade kayıtları.</li>
              <li><span style={strongStyle}>Finansal Bilgiler:</span> Ödeme yapılan kredi kartının ilk ve son 4 hanesi (Kartın tamamı şirketimiz tarafından saklanmaz, lisanslı Sanal POS firmasında tutulur), fatura detayları.</li>
            </ul>

            <h2 style={h2Style}>3. Kişisel Verilerin İşlenme Amaçları</h2>
            <p style={pStyle}>Toplanan kişisel verileriniz, aşağıda belirtilen amaçlarla işlenmektedir:</p>
            <ul style={listStyle}>
              <li>Mesafeli satış sözleşmesinin kurulması ve ifası,</li>
              <li>Sanal POS üzerinden elektronik ortamda ödeme işlemlerinin güvenli bir şekilde gerçekleştirilmesi,</li>
              <li>Siparişlerin hazırlanması, paketlenmesi ve kargo/kurye ile teslim edilmesi,</li>
              <li>Faturalandırma ve yasal muhasebe süreçlerinin yürütülmesi,</li>
              <li>Müşteri hizmetleri operasyonlarının yönetilmesi, talep ve şikayetlerin alınması, çözümlenmesi,</li>
              <li>Tüketici mevzuatı ve Elektronik Ticaret mevzuatından kaynaklanan yasal yükümlülüklerimizin yerine getirilmesi,</li>
              <li>Açık rıza vermeniz halinde kampanya, indirim ve yeni ürün bildirimlerinin gönderilmesi.</li>
            </ul>

            <h2 style={h2Style}>4. Kişisel Verilerin Aktarımı</h2>
            <p style={pStyle}>Kişisel verileriniz, yukarıdaki amaçlarla sınırlı olmak kaydıyla:</p>
            <ul style={listStyle}>
              <li>Teslimat süreçlerinin yürütülmesi için anlaşmalı olduğumuz lojistik/kurye firmalarına,</li>
              <li>Ödeme tahsilatının yapılabilmesi için BDDK onaylı ödeme kuruluşlarına (Sanal POS altyapı sağlayıcıları),</li>
              <li>Muhasebe ve finans süreçleri için yetkili mali müşavirlik firmalarına,</li>
              <li>Hukuki uyuşmazlıklarda yetkili kamu kurumlarına, mahkemelere ve avukatlarımıza aktarılabilecektir.</li>
            </ul>

            <h2 style={h2Style}>5. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi</h2>
            <p style={pStyle}>
              Kişisel verileriniz, sitemize üye olurken, sipariş verirken, iletişim formlarını doldururken elektronik olarak toplanmaktadır. Bu veriler KVKK Madde 5/2-c (Sözleşmenin ifası), Madde 5/2-ç (Hukuki yükümlülüğün yerine getirilmesi) ve Madde 5/2-f (Veri sorumlusunun meşru menfaati) hukuki sebeplerine dayalı olarak işlenmektedir.
            </p>

            <h2 style={h2Style}>6. Kişisel Veri Sahibinin Hakları</h2>
            <p style={pStyle}>
              KVKK Madde 11 uyarınca, veri sorumlusuna başvurarak kendinizle ilgili; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenme amacını ve aktarıldığı 3. kişileri bilme, eksik/yanlış verilerin düzeltilmesini isteme, verilerin silinmesini veya yok edilmesini talep etme haklarına sahipsiniz. Taleplerinizi <strong>{EMAIL}</strong> adresi üzerinden yazılı olarak bize iletebilirsiniz.
            </p>
          </section>
        </div>
      );

    case 'gizlilik-politikasi':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section style={sectionStyle}>
            <h2 style={h2Style}>Gizlilik ve Veri Güvenliği Politikası</h2>
            <p style={pStyle}>
              Bu Gizlilik Politikası, {COMPANY_NAME} (“{BRAND_NAME}”) tarafından işletilen {WEBSITE} internet sitesi aracılığıyla toplanan verilerin gizliliği ve güvenliği konularında kullanıcıları bilgilendirmek amacıyla hazırlanmıştır.
            </p>
            
            <h3 style={h3Style}>1. Bilgi Toplama ve Kullanım</h3>
            <p style={pStyle}>
              Sitemiz üzerinden ürün satın alırken veya üye olurken verdiğiniz isim, adres, iletişim numarası ve e-posta gibi bilgileriniz, sadece siparişinizin sorunsuz bir şekilde teslim edilmesi ve tarafınızla iletişim kurulması amacıyla kullanılır. Bilgileriniz kesinlikle reklam ajansları veya veri pazarlama şirketleri ile paylaşılmaz.
            </p>

            <h3 style={h3Style}>2. Kredi Kartı ve Ödeme Güvenliği (Sanal POS)</h3>
            <p style={pStyle}>
              Müşterilerimizin finansal güvenliği şirketimiz için en üst seviye önceliktir. Web sitemizden yapacağınız alışverişlerde kredi kartı bilgileriniz <strong>kesinlikle sunucularımızda saklanmaz veya kaydedilmez.</strong> 
              Ödeme ekranında girdiğiniz kart bilgileri, 256-bit SSL (Secure Sockets Layer) şifreleme teknolojisi kullanılarak doğrudan ve güvenli bir şekilde bankanıza veya BDDK lisanslı Sanal POS sağlayıcımıza iletilir.
              Sitemiz, ödeme sayfalarında yeşil kilit simgesi ile belgelenen GlobalSign/RapidSSL vb. güvenlik sertifikalarına sahiptir.
            </p>

            <h3 style={h3Style}>3. Şifre Güvenliği</h3>
            <p style={pStyle}>
              Kullanıcı hesabınıza ait şifreler, veritabanımızda geri döndürülemez şekilde (hash edilerek) kriptolanmış olarak saklanır. Şifrenizi unutmanız durumunda, mevcut şifreniz size gönderilmez, sadece yeni bir şifre oluşturmanız için sıfırlama bağlantısı iletilir. Şifrenizin üçüncü kişilerle paylaşılmaması kullanıcının kendi sorumluluğundadır.
            </p>

            <h3 style={h3Style}>4. Veri İhlali Bildirimi</h3>
            <p style={pStyle}>
              Olası bir siber saldırı veya sistem ihlali durumunda, sitemiz KVKK yönergeleri doğrultusunda en geç 72 saat içerisinde yetkili kurumlara ve etkilenen kullanıcılara durumu bildirmeyi taahhüt eder.
            </p>

            <h3 style={h3Style}>5. Yasal Açıklamalar</h3>
            <p style={pStyle}>
              Şirketimiz, yürürlükteki yasalar ve yasal süreçler gerektirdiği takdirde, veya yetkili idari ve adli otoritelerce yazılı olarak talep edilmesi halinde, müşteri verilerini yasal makamlarla paylaşma yükümlülüğünü saklı tutar.
            </p>
          </section>
        </div>
      );

    case 'cerez-politikasi':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section style={sectionStyle}>
            <h2 style={h2Style}>Çerez (Cookie) Politikası</h2>
            <p style={pStyle}>
              {BRAND_NAME} olarak, çevrimiçi mecralarımızı ziyaretleriniz sırasında deneyiminizi geliştirmek için çerezler, pikseller ve benzeri teknolojilerden faydalanmaktayız.
            </p>

            <h3 style={h3Style}>1. Çerez Nedir?</h3>
            <p style={pStyle}>
              Çerezler, bir web sitesini ziyaret ettiğinizde tarayıcınız aracılığıyla cihazınıza (bilgisayar, telefon, tablet) kaydedilen küçük metin dosyalarıdır. Çerezler sitenin daha verimli çalışmasını, alışveriş sepetinizin hatırlanmasını ve size daha uygun içeriklerin sunulmasını sağlar.
            </p>

            <h3 style={h3Style}>2. Sitemizde Kullanılan Çerez Türleri</h3>
            <ul style={listStyle}>
              <li><span style={strongStyle}>Zorunlu Çerezler:</span> Sitenin düzgün çalışması, üyeliğinize giriş yapabilmeniz, sepetinize ürün ekleyebilmeniz ve ödeme (Sanal POS) işlemlerini tamamlayabilmeniz için kesinlikle gereklidir. Bu çerezler kapatılamaz.</li>
              <li><span style={strongStyle}>Performans ve Analitik Çerezleri:</span> Kullanıcıların sitemizi nasıl kullandığını analiz etmek için kullanılır. Hangi sayfaların daha çok ziyaret edildiğini anlamamıza ve teknik sorunları tespit etmemize yarar (Örn: Google Analytics).</li>
              <li><span style={strongStyle}>İşlevsellik Çerezleri:</span> Dil tercihleriniz veya adres seçimleriniz gibi geçmiş tercihlerinizi hatırlayarak size kişiselleştirilmiş bir deneyim sunar.</li>
              <li><span style={strongStyle}>Pazarlama Çerezleri:</span> İlgi alanlarınıza yönelik kampanyalar sunmak amacıyla, onay vermeniz halinde 3. parti platformlar (Facebook Pixel, Google Ads vb.) aracılığıyla kullanılır.</li>
            </ul>

            <h3 style={h3Style}>3. Çerezlerin Yönetimi</h3>
            <p style={pStyle}>
              İnternet tarayıcınızın ayarlarını değiştirerek çerezleri reddedebilir veya silebilirsiniz. Ancak, zorunlu çerezleri engellemeniz halinde sitemizin alışveriş sepeti ve ödeme adımları gibi temel özellikleri çalışmayacaktır.
            </p>
            <p style={pStyle}>
              Google Chrome: Ayarlar &gt; Gizlilik ve Güvenlik &gt; Çerezler<br/>
              Safari: Tercihler &gt; Gizlilik &gt; Çerezleri Engelle<br/>
              Mozilla Firefox: Seçenekler &gt; Gizlilik ve Güvenlik &gt; Çerezler
            </p>
          </section>
        </div>
      );

    case 'mesafeli-satis-sozlesmesi':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section style={sectionStyle}>
            <h2 style={h2Style}>Mesafeli Satış Sözleşmesi</h2>
            
            <h3 style={h3Style}>Madde 1 - Taraflar</h3>
            <p style={pStyle}>
              <span style={strongStyle}>SATICI:</span><br/>
              Unvan: {COMPANY_NAME}<br/>
              Adres: {ADDRESS}<br/>
              Telefon: {PHONE}<br/>
              VKN: {VKN}<br/>
              E-posta: {EMAIL}<br/><br/>
              <span style={strongStyle}>ALICI (TÜKETİCİ):</span><br/>
              Sipariş veren müşteri (İnternet sitesi üzerinden üyelik/sipariş formunda doldurulan adres ve iletişim bilgileri esas alınır.)
            </p>

            <h3 style={h3Style}>Madde 2 - Sözleşmenin Konusu</h3>
            <p style={pStyle}>
              İşbu sözleşmenin konusu, ALICI'nın SATICI'ya ait {WEBSITE} internet sitesinden elektronik ortamda siparişini verdiği, sitede nitelikleri ve satış fiyatı belirtilen ürünlerin (pasta, unlu mamul, catering hizmetleri, yiyecek, içecek vb.) satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve 29188 sayılı Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin saptanmasıdır.
            </p>

            <h3 style={h3Style}>Madde 3 - Ürün Özellikleri ve Fiyat</h3>
            <p style={pStyle}>
              Satın alınan ürünlerin cinsi, türü, miktarı, temel özellikleri, KDV dahil satış fiyatı, ödeme şekli ve teslimat bedeli, siparişin sonuçlandığı ekranda ve sipariş onay e-postasında belirtildiği gibidir. SATICI, teknik nedenlerden kaynaklanan fiyat ve içerik güncellemeleri yapma hakkını saklı tutar.
            </p>

            <h3 style={h3Style}>Madde 4 - Ödeme ve Teslimat Koşulları</h3>
            <p style={pStyle}>
              4.1. ALICI, sipariş bedelini kredi kartı, banka kartı veya SATICI'nın sunduğu diğer elektronik ödeme yöntemleri (Sanal POS) aracılığıyla peşin olarak öder.<br/>
              4.2. Siparişe konu ürün, gıda maddesi niteliğinde olduğu için sipariş aşamasında ALICI tarafından seçilen gün ve saat diliminde kurye ile belirtilen adrese veya mağazadan teslim alınmak üzere hazırlanır.<br/>
              4.3. ALICI'nın teslimat adresinde bulunmaması durumunda SATICI edimini tam ve eksiksiz olarak yerine getirmiş kabul edilecektir. Gıda ürünlerinin doğası gereği, ALICI adresinde bulunmadığı için teslim edilemeyen ürünlerin bozulmasından veya iade edilmesinden SATICI sorumlu tutulamaz.
            </p>

            <h3 style={h3Style}>Madde 5 - Cayma Hakkı ve Cayma Hakkının Kullanılamayacağı Haller</h3>
            <p style={pStyle}>
              5.1. Mesafeli Sözleşmeler Yönetmeliği’nin 15. maddesi 1. fıkrasının (c) bendi uyarınca; <span style={strongStyle}>"Çabuk bozulabilen veya son kullanma tarihi geçebilecek malların teslimine ilişkin sözleşmelerde" CAYMA HAKKI KULLANILAMAZ.</span><br/>
              5.2. SATICI'nın ürettiği pasta, tatlı, catering, yiyecek ve içeceklerin tamamı çabuk bozulabilen, kişiye/siparişe özel anlık hazırlanan gıda ürünleri statüsünde olduğundan, sipariş onayı sonrasında yasal cayma hakkı bulunmamaktadır.<br/>
              5.3. Özel tasarım, kişiselleştirilmiş pasta siparişlerinde (isim yazılı vb.) üretime başlandıktan sonra koşulsuz iptal yapılamaz.
            </p>

            <h3 style={h3Style}>Madde 6 - Uyuşmazlıkların Çözümü</h3>
            <p style={pStyle}>
              İşbu sözleşmenin uygulanmasında, Ticaret Bakanlığı'nca ilan edilen değere kadar ALICI'nın yerleşim yerindeki veya SATICI'nın yerleşim yerindeki Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir. İşbu sözleşme elektronik ortamda onaylandığı tarihte yürürlüğe girer.
            </p>
          </section>
        </div>
      );

    case 'iptal-ve-iade-kosullari':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section style={sectionStyle}>
            <h2 style={h2Style}>İptal, İade ve Değişim Koşulları</h2>
            
            <h3 style={h3Style}>1. İptal Koşulları</h3>
            <p style={pStyle}>
              Firmamız {COMPANY_NAME} tarafından sunulan ürünler, sipariş üzerine günlük ve taze hazırlanan gıda ürünleridir. <br/>
              <span style={strongStyle}>Standart Ürünler:</span> Siparişinizin hazırlık aşamasına geçilmeden (sipariş saatinden en geç 1 saat sonrasına kadar) iptal talebinizi {PHONE} numaralı iletişim hattımızdan bize iletebilirsiniz. Hazırlanmaya başlanmış siparişlerin iptali ne yazık ki yapılamamaktadır.<br/>
              <span style={strongStyle}>Özel Tasarım / Butik Ürünler:</span> Butik pastalar ve catering siparişleri için üretim planlaması günler öncesinden yapılmaktadır. Bu nedenle, özel siparişlerin teslimat tarihinden en geç 48 saat öncesine kadar iptal edilmesi gerekmektedir. Son 48 saat içerisinde yapılan iptal taleplerinde ücret iadesi sağlanmamaktadır.
            </p>

            <h3 style={h3Style}>2. İade ve Değişim Koşulları</h3>
            <p style={pStyle}>
              Türk Ticaret Kanunu ve Mesafeli Sözleşmeler Yönetmeliği (Madde 15/1-c) gereğince gıda maddeleri, içecekler ve çabuk bozulabilen diğer tüketim maddelerinde <span style={strongStyle}>cayma ve iade hakkı bulunmamaktadır.</span> Hijyen ve sağlık standartları gereği gıda ürünleri kesinlikle iade alınamamaktadır.
            </p>
            <p style={pStyle}>
              Ancak aşağıdaki <strong>istisnai durumlarda</strong> iade veya telafi süreci işletilir:
            </p>
            <ul style={listStyle}>
              <li>Sipariş ettiğiniz ürünün içeriğinden tamamen farklı bir ürün teslim edilmesi.</li>
              <li>Ürünün taşıma/kurye aşamasında formunu kaybedecek düzeyde (pastanın ezilmesi, dağılması vb.) hasar görmüş olması.</li>
              <li>Üründe tüketime mani, firmamız kaynaklı bariz bir üretim veya kalite kusuru bulunması (bozuk, eksik vb.).</li>
            </ul>

            <h3 style={h3Style}>3. Hasarlı ve Kusurlu Ürün Bildirimi</h3>
            <p style={pStyle}>
              Kurye ile yapılan teslimatlarda, siparişinizi teslim alırken paketi kontrol etmeniz gerekmektedir. Üründe bir hasar varsa kuryeye tutanak tutturarak ürünü teslim almamalısınız. Eğer paketi açtıktan sonra bir sorun tespit ederseniz, ürünün tüketimini derhal durdurup, ürünün hasarını/kusurunu gösteren net fotoğrafları teslimat günü içerisinde {EMAIL} adresine veya {PHONE} numaralı destek hattımıza iletmeniz gerekmektedir. Değerlendirme sonucunda mağduriyetiniz, yeni ürün gönderimi veya sipariş bedelinin iadesi yoluyla giderilir.
            </p>

            <h3 style={h3Style}>4. İade İşlemi ve Süresi</h3>
            <p style={pStyle}>
              Talebine istinaden onaylanan ücret iadeleri, ödeme yapmış olduğunuz sanal POS altyapısı üzerinden aynı gün içerisinde başlatılır. Kredi kartlarına yapılan iadelerin banka hesaplarınıza/ekstrelerinize yansıması, bankanızın iç süreçlerine bağlı olarak ortalama 1 ila 7 iş günü sürebilmektedir. Bu sürece tarafımızın müdahale hakkı bulunmamaktadır.
            </p>
          </section>
        </div>
      );

    case 'kullanim-kosullari':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <section style={sectionStyle}>
            <h2 style={h2Style}>İnternet Sitesi Kullanım Koşulları</h2>
            <p style={pStyle}>
              Bu internet sitesine ({WEBSITE}) erişim sağlayarak veya siteyi kullanarak, aşağıda belirtilen kullanım koşullarını tamamen okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan etmiş sayılırsınız. {COMPANY_NAME} (“{BRAND_NAME}”), bu koşullarda dilediği zaman tek taraflı değişiklik yapma hakkını saklı tutar.
            </p>

            <h3 style={h3Style}>1. Fikri Mülkiyet Hakları</h3>
            <p style={pStyle}>
              Sitede yer alan tüm metinler, görseller, logolar, ürün fotoğrafları, grafikler, ses dosyaları, tasarımlar, yazılımlar ve ticari markaların ("İçerik") fikri mülkiyet hakları {COMPANY_NAME}'ye aittir veya lisanslı olarak kullanılmaktadır. Önceden yazılı izin alınmaksızın site içeriğinin kısmen veya tamamen kopyalanması, çoğaltılması, dağıtılması, yayımlanması veya ticari amaçlarla kullanılması kesinlikle yasaktır ve hukuki yaptırımlara tabidir.
            </p>

            <h3 style={h3Style}>2. Kullanıcı Sorumlulukları</h3>
            <ul style={listStyle}>
              <li>Kullanıcılar, siteyi hukuka aykırı, hileli veya üçüncü kişilerin haklarına zarar verecek şekilde kullanamaz.</li>
              <li>Üyelik veya sipariş aşamasında verilen bilgilerin doğruluğundan kullanıcı sorumludur. Yanlış adres, e-posta veya telefon beyanı sebebiyle yaşanacak teslimat problemlerinden SATICI sorumlu tutulamaz.</li>
              <li>Site üzerinden başkası adına yetkisiz ödeme işlemi (çalıntı kredi kartı vb.) gerçekleştirenler hakkında derhal yasal işlem başlatılacaktır.</li>
            </ul>

            <h3 style={h3Style}>3. Hizmetin Kesintiye Uğraması ve Feragat</h3>
            <p style={pStyle}>
              {BRAND_NAME}, sitenin kesintisiz, hatasız veya virüssüz çalışacağını garanti etmez. Planlı bakımlar, sistem güncellemeleri veya siber saldırılar gibi mücbir sebeplerden ötürü siteye erişimin geçici olarak durmasından dolayı oluşabilecek zararlardan şirketimiz sorumlu değildir.
            </p>

            <h3 style={h3Style}>4. Fiyat ve İçerik Değişiklikleri</h3>
            <p style={pStyle}>
              Sitede yer alan ürünlerin özellikleri, içerikleri ve satış fiyatları önceden bildirim yapılmaksızın değiştirilebilir. Tipografik hatalardan (sistemsel fiyat yanlışlıkları vb.) {BRAND_NAME} sorumlu değildir ve bu gibi bariz hatalı işlemlerde siparişi iptal ederek ücret iadesi yapma hakkını saklı tutar.
            </p>

            <h3 style={h3Style}>5. Yetkili Mahkeme</h3>
            <p style={pStyle}>
              İşbu Kullanım Koşulları'nın uygulanmasından veya yorumlanmasından doğacak her türlü ihtilafta Türk Hukuku uygulanacak olup, Gaziantep Mahkemeleri ve İcra Daireleri yetkilidir.
            </p>
          </section>
        </div>
      );

    default:
      return null;
  }
}
