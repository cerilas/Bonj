"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./BrandLogo";
import { InstagramIcon } from "./InstagramIcon";

const mapsUrl =
  "https://www.google.com/maps/place//data=!4m2!3m1!1s0x1531e1303b6f3d83:0x2d766629ff77a0b9?sa=X&ved=1t:8290&ictx=111";

const mapsEmbedUrl =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3183.701471761587!2d37.328191499999996!3d37.0645966!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1531e1303b6f3d83%3A0x2d766629ff77a0b9!2sBonj%20Cake%20Story!5e0!3m2!1str!2str!4v1784531620012!5m2!1str!2str";

const instagramUrl = "https://www.instagram.com/bonjcakestory/";

const menuLinks = [
  ["Menü", "/#menu"],
  ["Brunch", "/#brunch"],
  ["Catering", "/catering"],
  ["Hikâyemiz", "/#hikaye"],
  ["Mekân", "/#mekan"],
  ["İletişim", "/iletisim"],
  ["Sepet", "/sepet"],
] as const;

const legalLinks = [
  "KVKK Aydınlatma Metni",
  "Gizlilik Politikası",
  "Çerez Politikası",
  "Mesafeli Satış Sözleşmesi",
  "İptal ve İade Koşulları",
  "Kullanım Koşulları",
] as const;

const discoveryLinks = [
  "Gaziantep San Sebastian",
  "Gaziantep San Sebastian Cheesecake",
  "Gaziantep San Sebastian Sipariş",
  "Gaziantep Cheesecake",
  "Gaziantep Cheesecake Sipariş",
  "Gaziantep Lotus Cheesecake",
  "Gaziantep Frambuaz Cheesecake",
  "Gaziantep Antep Fıstıklı Cheesecake",
  "Gaziantep Kafe",
  "Gaziantep Kafeler",
  "Şehitkamil Kafe",
  "Gaziantep Kahvaltı",
  "Gaziantep Kahvaltı Mekanları",
  "Şehitkamil Kahvaltı",
  "Gaziantep Brunch",
  "Şehitkamil Brunch",
  "Gaziantep Kruvasan",
  "Gaziantep Avokadolu Kruvasan",
  "Gaziantep Kahve",
  "Gaziantep Kahveci",
  "Gaziantep Üçüncü Nesil Kahve",
  "Gaziantep Espresso",
  "Gaziantep Latte",
  "Gaziantep Filtre Kahve",
  "Gaziantep Soğuk Kahve",
  "Gaziantep Cold Brew",
  "Gaziantep Iced Latte",
  "Gaziantep Matcha Latte",
  "Gaziantep Tatlı",
  "Gaziantep Tatlıcı",
  "Gaziantep Pasta",
  "Gaziantep Limonata",
  "Gaziantep Catering",
  "Gaziantep Catering Firması",
  "Gaziantep Kurumsal Catering",
  "Gaziantep Etkinlik Catering",
  "Gaziantep Kurumsal İkram",
  "Gaziantep Doğum Günü Pastası",
  "Gaziantep Özel Gün Pastası",
  "Gaziantep Butik Pasta",
] as const;

export function PublicFooter() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <section className="public-location" aria-labelledby="public-location-title">
        <div className="public-location-heading">
          <div>
            <span>BONJ / GAZİANTEP</span>
            <h2 id="public-location-title">Bizi bul.</h2>
          </div>
          <div className="public-location-address">
            <p>Osmangazi, Ahmet Şireci Blv.<br />Riva Apt. No: 18/I-E, Şehitkamil</p>
            <a href={mapsUrl} target="_blank" rel="noreferrer">Yol tarifi al <i aria-hidden="true">↗</i></a>
          </div>
        </div>

        <div className="public-location-map">
          <iframe
            src={mapsEmbedUrl}
            title="Bonj Cake Story Google Maps konumu"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </section>

      <footer className="public-site-footer">
      <div className="public-footer-top">
        <section className="public-footer-brand" aria-label="Bonj Cake Story">
          <Link href="/" aria-label="Bonj Cake Story ana sayfa"><BrandLogo className="public-footer-logo" alt="" /></Link>
          <p>Gaziantep’te cheesecake, güçlü kahve, gün boyu brunch ve özenli tatlı ritüelleri.</p>
          <a className="public-footer-address" href={mapsUrl} target="_blank" rel="noreferrer">
            Osmangazi, Ahmet Şireci Blv. Riva Apt. No: 18/I-E, 27000 Şehitkamil/Gaziantep <i aria-hidden="true">↗</i>
          </a>
          <a className="public-footer-phone" href="tel:+9050764477985">0507 644 79 85</a>
          <a className="public-footer-instagram" href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Bonj Cake Story Instagram hesabı">
            <InstagramIcon /><span>@bonjcakestory</span><i aria-hidden="true">↗</i>
          </a>
        </section>

        <nav className="public-footer-column" aria-label="Bonj sayfaları">
          <h2>Keşfet</h2>
          {menuLinks.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
        </nav>

        <nav className="public-footer-column" aria-label="Yasal metinler">
          <h2>Yasal Metinler</h2>
          {legalLinks.map((label) => <Link href="/menu" key={label}>{label}</Link>)}
        </nav>

        <section className="public-footer-column public-footer-contact">
          <h2>İletişim</h2>
          <Link href="/iletisim">İş birlikleri</Link>
          <Link href="/catering">Catering talebi</Link>
          <Link href="/iletisim">Soru ve cevap</Link>
          <Link href="/iletisim">Öneri ve şikâyet</Link>
          <a href={mapsUrl} target="_blank" rel="noreferrer">Yol tarifi ↗</a>
          <a href="tel:+9050764477985">Hemen ara</a>
          <a href={instagramUrl} target="_blank" rel="noreferrer">Instagram ↗</a>
        </section>
      </div>

      <section className="public-footer-discovery" aria-labelledby="footer-discovery-title">
        <div>
          <span>GAZİANTEP / KEŞFET</span>
          <h2 id="footer-discovery-title">Aradığın tat, Bonj’da.</h2>
        </div>
        <nav aria-label="Gaziantep ürün ve hizmet aramaları">
          {discoveryLinks.map((label) => (
            <Link href={label.includes("Catering") || label.includes("Kurumsal İkram") ? "/catering" : "/menu"} key={label}>{label}</Link>
          ))}
        </nav>
      </section>

      <div className="public-footer-bottom">
        <span>© {new Date().getFullYear()} Bonj Cake Story. Tüm hakları saklıdır.</span>
        <div><a href={instagramUrl} target="_blank" rel="noreferrer"><InstagramIcon /> @bonjcakestory</a><Link href="/menu">Dijital menü ↗</Link></div>
      </div>
      </footer>
    </>
  );
}
