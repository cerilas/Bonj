"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { MenuItem } from "@/lib/menu";
import { useCart } from "@/lib/use-cart";
import { BrandLogo } from "../components/BrandLogo";
import { UiIcon } from "../components/UiIcon";

function price(value: number | null | undefined) {
  if (value == null) return null;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function MenuExperience({ items }: { items: MenuItem[] }) {
  const { items: cartItems, count, totalInKurus, addItem, setQuantity } = useCart();
  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    items.forEach((item) => unique.set(item.category, item.categoryName));
    return Array.from(unique, ([id, label]) => ({ id, label }));
  }, [items]);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function selectCategory(next: string, buttonEl?: HTMLButtonElement | null) {
    setFilter(next);
    if (buttonEl) {
      buttonEl.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const visibleItems = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return items.filter((item) => {
      if (filter !== "all" && item.category !== filter) return false;
      if (q) {
        const hay = `${item.name} ${item.description} ${item.categoryName}`.toLocaleLowerCase("tr-TR");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, search]);

  const qtyOf = (menuItemId?: number) =>
    menuItemId ? cartItems.find((entry) => entry.menuItemId === menuItemId)?.quantity ?? 0 : 0;

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
        <p>Günlük üretim, güçlü kahve ve bonj’a özgü katmanlar.</p>
      </section>

      <div className="qr-menu-sticky-top">
        <div className="qr-menu-search-bar">
          <UiIcon name="search" />
          <input
            type="search"
            placeholder="Menüde ara… (Cheesecake, Latte, Kruvasan)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Menüde ürün ara"
          />
          {search && (
            <button
              type="button"
              className="qr-search-clear"
              onClick={() => setSearch("")}
              aria-label="Aramayı temizle"
            >
              <UiIcon name="close" />
            </button>
          )}
        </div>

        <nav className="qr-menu-filters" aria-label="Menü kategorileri">
          <button
            className={filter === "all" ? "is-active" : ""}
            onClick={(e) => selectCategory("all", e.currentTarget)}
            type="button"
          >
            Hepsi
          </button>
          {categories.map((category) => (
            <button
              className={filter === category.id ? "is-active" : ""}
              onClick={(e) => selectCategory(category.id, e.currentTarget)}
              type="button"
              key={category.id}
            >
              {category.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="qr-menu-scroll" ref={scrollRef}>
        <div className="qr-menu-section-head">
          <strong>
            {filter === "all"
              ? "Tüm Ürünler"
              : categories.find((c) => c.id === filter)?.label ?? "Menü"}
          </strong>
          <span>{visibleItems.length} ürün</span>
        </div>

        {visibleItems.length === 0 ? (
          <div className="qr-menu-empty">
            <p>Aradığınız kritere uygun ürün bulunamadı.</p>
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
            >
              Tüm Menüyü Göster
            </button>
          </div>
        ) : (
          <section className="qr-product-grid" aria-live="polite">
            {visibleItems.map((item, index) => {
              const qty = qtyOf(item.id);
              return (
                <article className="qr-product" key={item.slug}>
                  <button
                    type="button"
                    className={`qr-product-visual accent-${item.accent}`}
                    onClick={() => setSelectedItem(item)}
                    aria-label={`${item.name} detaylarını gör`}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.imageAlt || item.name} loading="lazy" />
                    ) : (
                      <>
                        <span />
                        <i>{String(index + 1).padStart(2, "0")}</i>
                      </>
                    )}
                    {item.badge && <mark>{item.badge}</mark>}
                  </button>

                  <div className="qr-product-copy">
                    <button
                      type="button"
                      className="qr-product-info-btn"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="qr-product-meta">
                        <span>{item.categoryName}</span>
                        {price(item.priceInKurus) && <strong>{price(item.priceInKurus)}</strong>}
                      </div>
                      <h2>{item.name}</h2>
                      <p>{item.longDescription || item.description}</p>
                    </button>

                    {(item.estimatedCalories != null || item.allergenInfo) && (
                      <dl>
                        {item.estimatedCalories != null && (
                          <div>
                            <dt>Enerji</dt>
                            <dd>≈ {item.estimatedCalories} kcal</dd>
                          </div>
                        )}
                        {item.allergenInfo && (
                          <div>
                            <dt>Alerjen</dt>
                            <dd>{item.allergenInfo}</dd>
                          </div>
                        )}
                      </dl>
                    )}

                    {item.id && item.priceInKurus != null ? (
                      qty > 0 ? (
                        <div className="qr-qty-control" aria-label={`${item.name} adedi`}>
                          <button
                            type="button"
                            onClick={() => setQuantity(item.id as number, qty - 1)}
                            aria-label="Bir azalt"
                          >
                            −
                          </button>
                          <strong>{qty}</strong>
                          <button
                            type="button"
                            onClick={() =>
                              addItem({
                                menuItemId: item.id as number,
                                name: item.name,
                                priceInKurus: item.priceInKurus as number,
                                imageUrl: item.imageUrl ?? null,
                                imageAlt: item.imageAlt ?? item.name,
                                accent: item.accent,
                              })
                            }
                            aria-label="Bir artır"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          className="qr-add-button"
                          type="button"
                          onClick={() =>
                            addItem({
                              menuItemId: item.id as number,
                              name: item.name,
                              priceInKurus: item.priceInKurus as number,
                              imageUrl: item.imageUrl ?? null,
                              imageAlt: item.imageAlt ?? item.name,
                              accent: item.accent,
                            })
                          }
                        >
                          <span>Sepete ekle</span>
                          <strong>
                            <UiIcon name="plus" />
                          </strong>
                        </button>
                      )
                    ) : (
                      <span className="qr-unavailable">Şu an siparişe kapalı</span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <footer className="qr-menu-footer">
          <div>
            <BrandLogo className="qr-menu-footer-logo bonj-brand-logo--light" />
          </div>
          <p>
            bonj cake story · Osmangazi, Ahmet Şireci Blv. Riva Apt. No: 18/I-E, Şehitkamil / Gaziantep.
          </p>
          <Link href="/">Ana sayfaya dön</Link>
        </footer>
      </div>

      {count > 0 && (
        <Link className="qr-cart-float" href="/sepet">
          <span>
            <strong>{count}</strong> ürün
          </span>
          <span>
            Sepeti gör · {price(totalInKurus)} <i><UiIcon name="arrow-right" /></i>
          </span>
        </Link>
      )}

      {selectedItem && (
        <div
          className="qr-detail-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={selectedItem.name}
          onClick={() => setSelectedItem(null)}
        >
          <div className="qr-detail-sheet" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="qr-detail-close"
              onClick={() => setSelectedItem(null)}
              aria-label="Kapat"
            >
              <UiIcon name="close" />
            </button>
            <div className={`qr-detail-visual accent-${selectedItem.accent}`}>
              {selectedItem.imageUrl ? (
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.imageAlt || selectedItem.name}
                />
              ) : (
                <span />
              )}
              {selectedItem.badge && <mark>{selectedItem.badge}</mark>}
            </div>
            <div className="qr-detail-body">
              <div className="qr-product-meta">
                <span>{selectedItem.categoryName}</span>
                {price(selectedItem.priceInKurus) && (
                  <strong>{price(selectedItem.priceInKurus)}</strong>
                )}
              </div>
              <h2>{selectedItem.name}</h2>
              <p>{selectedItem.longDescription || selectedItem.description}</p>
              {(selectedItem.estimatedCalories != null || selectedItem.allergenInfo) && (
                <dl className="qr-detail-specs">
                  {selectedItem.estimatedCalories != null && (
                    <div>
                      <dt>Enerji</dt>
                      <dd>≈ {selectedItem.estimatedCalories} kcal</dd>
                    </div>
                  )}
                  {selectedItem.allergenInfo && (
                    <div>
                      <dt>Alerjen</dt>
                      <dd>{selectedItem.allergenInfo}</dd>
                    </div>
                  )}
                </dl>
              )}
              {selectedItem.id && selectedItem.priceInKurus != null && (
                <button
                  type="button"
                  className="qr-detail-add-btn"
                  onClick={() => {
                    addItem({
                      menuItemId: selectedItem.id as number,
                      name: selectedItem.name,
                      priceInKurus: selectedItem.priceInKurus as number,
                      imageUrl: selectedItem.imageUrl ?? null,
                      imageAlt: selectedItem.imageAlt ?? selectedItem.name,
                      accent: selectedItem.accent,
                    });
                    setSelectedItem(null);
                  }}
                >
                  <span>Sepete ekle</span>
                  <strong>{price(selectedItem.priceInKurus)}</strong>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
