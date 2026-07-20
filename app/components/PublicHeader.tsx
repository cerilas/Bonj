"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/use-cart";
import { BrandLogo } from "./BrandLogo";
import { InstagramIcon } from "./InstagramIcon";
import { UiIcon } from "./UiIcon";

const instagramUrl = "https://www.instagram.com/bonjcakestory/";

export function PublicHeader() {
  const pathname = usePathname();
  const { count } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  if (pathname.startsWith("/admin")) return null;

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <header className="public-site-header" aria-label="Ana navigasyon">
        <Link className="public-header-brand" href="/" onClick={closeMenu} aria-label="Bonj Cake Story ana sayfa">
          <BrandLogo className="public-header-logo" alt="" priority />
        </Link>

        <nav className="public-header-links" aria-label="Sayfa bölümleri">
          <Link href="/#menu">Menü</Link>
          <Link href="/#brunch">Brunch</Link>
          <Link href="/catering">Catering</Link>
          <Link href="/#hikaye">Hikâyemiz</Link>
          <Link href="/#mekan">Mekân</Link>
          <Link href="/iletisim">İletişim</Link>
        </nav>

        <div className="public-header-actions">
          <a className="public-header-instagram" href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Bonj Cake Story Instagram hesabı">
            <InstagramIcon /> Instagram
          </a>
          <Link className="public-header-cart" href="/sepet" aria-label={`Sepete git, ${count} ürün`}>
            Sepet <strong>{count}</strong>
          </Link>
          <button
            className="public-header-menu-toggle"
            type="button"
            aria-label={isOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={isOpen}
            aria-controls="public-mobile-navigation"
            onClick={() => setIsOpen((open) => !open)}
          >
            <span /><span />
          </button>
        </div>
      </header>

      <div className={`public-mobile-menu ${isOpen ? "is-open" : ""}`} id="public-mobile-navigation" aria-hidden={!isOpen}>
        <nav aria-label="Mobil navigasyon">
          <Link href="/#menu" onClick={closeMenu}>01 — Menü</Link>
          <Link href="/#brunch" onClick={closeMenu}>02 — Brunch</Link>
          <Link href="/catering" onClick={closeMenu}>03 — Catering</Link>
          <Link href="/#hikaye" onClick={closeMenu}>04 — Hikâyemiz</Link>
          <Link href="/#mekan" onClick={closeMenu}>05 — Mekân</Link>
          <Link href="/iletisim" onClick={closeMenu}>06 — İletişim</Link>
          <Link href="/sepet" onClick={closeMenu}>07 — Sepet ({count})</Link>
          <a href={instagramUrl} target="_blank" rel="noreferrer" onClick={closeMenu}>08 — Instagram <UiIcon name="arrow-up-right" /></a>
        </nav>
        <a className="public-mobile-instagram" href={instagramUrl} target="_blank" rel="noreferrer"><InstagramIcon /> @bonjcakestory</a>
      </div>
    </>
  );
}
