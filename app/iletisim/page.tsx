import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "./ContactForm";
import { BrandLogo } from "../components/BrandLogo";
import { InstagramIcon } from "../components/InstagramIcon";
import "./iletisim.css";

export const metadata: Metadata = {
  title: "İletişim",
  description: "Bonj Cake Story ile iş birlikleri, soru, öneri ve şikâyetleriniz için iletişime geçin.",
  alternates: { canonical: "/iletisim" },
};

export default function ContactPage() {
  return (
    <main className="contact-page">
      <header className="contact-header">
        <Link className="brand" href="/" aria-label="Bonj Cake Story ana sayfa">
          <BrandLogo className="contact-header-logo bonj-brand-logo--light" alt="" />
        </Link>
        <nav aria-label="İletişim sayfası navigasyonu">
          <Link href="/">Ana sayfa</Link>
          <Link href="/menu">Menü</Link>
          <span>İletişim</span>
        </nav>
        <a className="contact-header-location" href="https://www.instagram.com/bonjcakestory/" target="_blank" rel="noreferrer">
          <InstagramIcon /> Instagram
        </a>
      </header>

      <section className="contact-hero">
        <div className="contact-intro">
          <span className="contact-index">06 / İLETİŞİM HATTI</span>
          <p className="contact-overline">Tatlı bir fikir mi var?</p>
          <h1>Bir şey<br /><em>söyle.</em></h1>
          <p className="contact-lead">İş birliği, merak ettiğin bir detay, daha iyisi için bir öneri ya da yolunda gitmeyen bir şey… Hepsini duymak istiyoruz.</p>

          <div className="contact-signal" aria-hidden="true">
            <i /><i /><i />
            <span>48<small>SAAT</small></span>
            <b>Yanıt frekansı</b>
          </div>
        </div>
        <div className="contact-form-wrap">
          <ContactForm />
        </div>
      </section>

      <section className="contact-principles">
        <article><span>01</span><h2>Okuyoruz.</h2><p>Her mesaj gerçek bir ekip üyesine ulaşır; otomatik yanıtların arkasına saklanmayız.</p></article>
        <article><span>02</span><h2>Dinliyoruz.</h2><p>Şikâyetlerde savunmaya geçmeden önce ne yaşadığını anlamaya çalışırız.</p></article>
        <article><span>03</span><h2>Dönüyoruz.</h2><p>Yoğunluğa göre değişse de mesajlara çoğunlukla 48 saat içinde yanıt veririz.</p></article>
      </section>

      <section className="contact-faq">
        <div>
          <span className="contact-index">KISA KISA / SSS</span>
          <h2>Belki cevabı<br /><em>buradadır.</em></h2>
        </div>
        <div className="contact-faq-list">
          <details>
            <summary>İş birliği teklifinde hangi bilgileri paylaşmalıyım?<span>＋</span></summary>
            <p>Markanı, fikrini, hedeflediğin tarih aralığını ve varsa örnek çalışmalarını yazman değerlendirmeyi hızlandırır.</p>
          </details>
          <details>
            <summary>Alerjen veya ürün içeriği sorabilir miyim?<span>＋</span></summary>
            <p>Elbette. İlgili ürünün adını yaz; içerik ve alerjen bilgileri için ekibimizden net bilgi alalım.</p>
          </details>
          <details>
            <summary>Şikâyetimi nasıl daha hızlı çözebilirsiniz?<span>＋</span></summary>
            <p>Ziyaret tarihini, yaklaşık saati ve yaşadığın durumu paylaş. Sipariş detayı varsa eklemen doğru ekibe ulaşmamızı kolaylaştırır.</p>
          </details>
        </div>
      </section>

      <footer className="contact-footer">
        <div><BrandLogo className="contact-footer-logo bonj-brand-logo--light" /></div>
        <p>Gaziantep’in tatlı frekansı.</p>
        <a href="https://www.instagram.com/bonjcakestory/" target="_blank" rel="noreferrer"><InstagramIcon /> Instagram <span>↗</span></a>
      </footer>
    </main>
  );
}
