"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MenuItem } from "@/lib/menu";
import { useCart } from "@/lib/use-cart";
import { BrandLogo } from "../components/BrandLogo";

function price(value: number | null | undefined) {
  if (value == null) return null;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function MenuExperience({ items }: { items: MenuItem[] }) {
  const { items: cartItems, count, totalInKurus, addItem } = useCart();
  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    items.forEach((item) => unique.set(item.category, item.categoryName));
    return Array.from(unique, ([id, label]) => ({ id, label }));
  }, [items]);
  const [filter, setFilter] = useState("all");
  const visibleItems =
    filter === "all" ? items : items.filter((item) => item.category === filter);

  return (
    <main className="qr-menu-page">
      <header className="qr-menu-header">
        <Link className="qr-menu-brand" href="/">
          <BrandLogo className="qr-menu-header-logo" alt="" />
        </Link>
        <div className="qr-menu-actions">
          <span><i /> GAZİANTEP</span>
          <Link className="qr-header-cart" href="/sepet" aria-label={`Sepeti aç, ${count} ürün`}>
            Sepet <strong>{count}</strong>
          </Link>
        </div>
      </header>

      <section className="qr-menu-intro">
        <span>GÜNCEL / DİJİTAL MENÜ</span>
        <h1>Bugün neye<br /><em>düşersin?</em></h1>
        <p>Günlük üretim, güçlü kahve ve Bonj’a özgü katmanlar.</p>
      </section>

      <nav className="qr-menu-filters" aria-label="Menü kategorileri">
        <button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")} type="button">Hepsi</button>
        {categories.map((category) => (
          <button className={filter === category.id ? "is-active" : ""} onClick={() => setFilter(category.id)} type="button" key={category.id}>{category.label}</button>
        ))}
      </nav>

      <section className="qr-product-grid" aria-live="polite">
        {visibleItems.map((item, index) => (
          <article className="qr-product" key={item.slug}>
            <div className={`qr-product-visual accent-${item.accent}`}>
              {item.imageUrl ? <img src={item.imageUrl} alt={item.imageAlt || item.name} loading="lazy" /> : <><span /><i>{String(index + 1).padStart(2, "0")}</i></>}
              {item.badge && <mark>{item.badge}</mark>}
            </div>
            <div className="qr-product-copy">
              <div className="qr-product-meta"><span>{item.categoryName}</span>{price(item.priceInKurus) && <strong>{price(item.priceInKurus)}</strong>}</div>
              <h2>{item.name}</h2>
              <p>{item.longDescription || item.description}</p>
              {(item.estimatedCalories != null || item.allergenInfo) && (
                <dl>
                  {item.estimatedCalories != null && <div><dt>Enerji</dt><dd>≈ {item.estimatedCalories} kcal</dd></div>}
                  {item.allergenInfo && <div><dt>Alerjen</dt><dd>{item.allergenInfo}</dd></div>}
                </dl>
              )}
              {item.id && item.priceInKurus != null ? (
                <button
                  className={`qr-add-button ${cartItems.some((entry) => entry.menuItemId === item.id) ? "is-added" : ""}`}
                  type="button"
                  onClick={() => addItem({
                    menuItemId: item.id as number,
                    name: item.name,
                    priceInKurus: item.priceInKurus as number,
                    imageUrl: item.imageUrl ?? null,
                    imageAlt: item.imageAlt ?? item.name,
                    accent: item.accent,
                  })}
                >
                  <span>{cartItems.some((entry) => entry.menuItemId === item.id) ? "Bir tane daha ekle" : "Sepete ekle"}</span>
                  <strong>{cartItems.find((entry) => entry.menuItemId === item.id)?.quantity ?? "＋"}</strong>
                </button>
              ) : (
                <span className="qr-unavailable">Şu an siparişe kapalı</span>
              )}
            </div>
          </article>
        ))}
      </section>

      {count > 0 && (
        <Link className="qr-cart-float" href="/sepet">
          <span><strong>{count}</strong> ürün</span>
          <span>Sepeti gör · {price(totalInKurus)} <i>→</i></span>
        </Link>
      )}

      <footer className="qr-menu-footer">
        <div><BrandLogo className="qr-menu-footer-logo bonj-brand-logo--light" /></div>
        <p>Fiyatlara KDV dahildir. Alerjen hassasiyetinizi sipariş öncesinde ekibimizle paylaşın.</p>
        <Link href={count ? "/sepet" : "/"}>{count ? "Sepete git" : "Deneyimi keşfet"} ↗</Link>
      </footer>
    </main>
  );
}
