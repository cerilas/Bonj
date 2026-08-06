import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "../../components/BrandLogo";
import { InstagramIcon } from "../../components/InstagramIcon";
import { notFound } from "next/navigation";
import { getLegalContent } from "./content";

const legalTitles: Record<string, string> = {
  "kvkk-aydinlatma-metni": "KVKK Aydınlatma Metni",
  "gizlilik-politikasi": "Gizlilik Politikası",
  "cerez-politikasi": "Çerez Politikası",
  "mesafeli-satis-sozlesmesi": "Mesafeli Satış Sözleşmesi",
  "iptal-ve-iade-kosullari": "İptal ve İade Koşulları",
  "kullanim-kosullari": "Kullanım Koşulları",
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = legalTitles[slug] || "Yasal Metin";
  
  return {
    title: `${title} | Bonj Cake Story`,
    description: `Bonj Cake Story ${title} sayfası.`,
  };
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const title = legalTitles[slug];

  if (!title) {
    notFound();
  }

  return (
    <main className="contact-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="contact-header">
        <Link className="brand" href="/" aria-label="Bonj Cake Story ana sayfa">
          <BrandLogo className="contact-header-logo bonj-brand-logo--light" alt="" />
        </Link>
        <nav aria-label="Yasal sayfa navigasyonu">
          <Link href="/">Ana sayfa</Link>
          <span>Yasal Metinler</span>
        </nav>
        <a className="contact-header-location" href="https://www.instagram.com/bonjcakestory/" target="_blank" rel="noreferrer">
          <InstagramIcon /> Instagram
        </a>
      </header>

      <section style={{ flex: 1, padding: '120px 24px 60px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '40px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', opacity: 0.6 }}>YASAL METİNLER</span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '8px', marginBottom: '24px', letterSpacing: '-0.03em' }}>{title}</h1>
          <hr style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }} />
        </div>
        
        <div style={{ fontSize: '16px', lineHeight: 1.6, opacity: 0.9 }}>
          {getLegalContent(slug) || <p>Bu sayfanın içeriği ({title}) henüz eklenmemiştir. Güncellenmektedir.</p>}
        </div>
      </section>

      <footer className="contact-footer" style={{ marginTop: 'auto' }}>
        <div><BrandLogo className="contact-footer-logo bonj-brand-logo--light" /></div>
        <p>Gaziantep’in tatlı frekansı.</p>
        <a href="https://www.instagram.com/bonjcakestory/" target="_blank" rel="noreferrer"><InstagramIcon /> Instagram <span>↗</span></a>
      </footer>
    </main>
  );
}
