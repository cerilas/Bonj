"use client";

import { useEffect, useMemo, useState } from "react";
import type { PointerEvent } from "react";
import { categoryLabels, type MenuCategory, type MenuItem } from "@/lib/menu";
import { useCart } from "@/lib/use-cart";
import { BrandLogo } from "./BrandLogo";
import { InstagramIcon } from "./InstagramIcon";
import InfiniteMenu from "./InfiniteMenu";
import { UiIcon } from "./UiIcon";

type Filter = "all" | MenuCategory;

const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Bonj%20Cake%20Story%20Gaziantep";
const instagramUrl = "https://www.instagram.com/bonjcakestory/";

function TiltCard({ children }: { children: React.ReactNode }) {
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const card = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.style.setProperty("--rx", `${-y * 8}deg`);
    card.style.setProperty("--ry", `${x * 10}deg`);
    card.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
    card.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  };

  const reset = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--rx", "0deg");
    event.currentTarget.style.setProperty("--ry", "0deg");
  };

  return (
    <div
      className="tilt-card"
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
    >
      {children}
    </div>
  );
}

function formatPrice(priceInKurus: number | null | undefined) {
  if (priceInKurus == null) return null;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(priceInKurus / 100);
}

export function CafeExperience({
  initialMenuItems,
}: {
  initialMenuItems: MenuItem[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const { items: cartItems, count, totalInKurus, addItem } = useCart();

  const filteredItems = useMemo(
    () =>
      filter === "all"
        ? initialMenuItems
        : initialMenuItems.filter((item) => item.category === filter),
    [filter, initialMenuItems],
  );

  const infiniteMenuItems = useMemo(
    () => initialMenuItems.slice(0, 16).map((item) => ({
      image: item.imageUrl || (item.category === "kahvalti"
        ? "/images/bonj-brunch-croissant.webp"
        : "/images/bonj-hero-plate.webp"),
      link: "/menu",
      title: item.name,
      description: item.description,
    })),
    [initialMenuItems],
  );

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [filter]);

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".hero");
    const art = hero?.querySelector<HTMLElement>(".hero-art");
    const cake = hero?.querySelector<HTMLElement>(".hero-cake-fx");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileViewport = window.matchMedia("(max-width: 720px)");
    let frame = 0;
    let targetProgress = 0;
    let currentProgress = 0;
    let previousFrameTime = 0;

    if (!hero || !art || !cake) return;

    const applyProgress = (progress: number) => {
      const scaleAmount = mobileViewport.matches ? 0.09 : 0.105;
      cake.style.setProperty("--cake-scale", String(1 + progress * scaleAmount));
      cake.style.setProperty("--cake-x", `${progress * -0.7}%`);
      cake.style.setProperty("--cake-y", `${progress * -2.6}%`);

      if (!mobileViewport.matches) {
        cake.style.setProperty("--cake-brightness", String(1 + progress * 0.07));
        art.style.setProperty("--sheen-x", `${-90 + progress * 250}%`);
        art.style.setProperty("--sheen-opacity", String(0.1 + progress * 0.24));
      }
    };

    const animateCake = (time: number) => {
      const elapsed = previousFrameTime ? Math.min(time - previousFrameTime, 48) : 16;
      previousFrameTime = time;
      const smoothing = 1 - Math.exp(-elapsed * 0.014);

      currentProgress += (targetProgress - currentProgress) * smoothing;
      if (Math.abs(targetProgress - currentProgress) < 0.0004) {
        currentProgress = targetProgress;
      }
      applyProgress(currentProgress);

      if (currentProgress !== targetProgress) {
        frame = requestAnimationFrame(animateCake);
      } else {
        frame = 0;
        previousFrameTime = 0;
      }
    };

    const measureTarget = () => {
      const rect = hero.getBoundingClientRect();
      const travel = Math.max(hero.offsetHeight - window.innerHeight, 1);
      const rawProgress = Math.min(Math.max(-rect.top / travel, 0), 1);
      targetProgress = reducedMotion.matches ? 0 : rawProgress;

      if (!frame && currentProgress !== targetProgress) {
        frame = requestAnimationFrame(animateCake);
      }
    };

    const resetMotionMode = () => {
      if (mobileViewport.matches) {
        cake.style.setProperty("--cake-brightness", "1");
        art.style.setProperty("--sheen-x", "-90%");
        art.style.setProperty("--sheen-opacity", "0");
      }
      applyProgress(currentProgress);
      measureTarget();
    };

    measureTarget();
    currentProgress = targetProgress;
    applyProgress(currentProgress);
    window.addEventListener("scroll", measureTarget, { passive: true });
    window.addEventListener("resize", measureTarget);
    reducedMotion.addEventListener("change", measureTarget);
    mobileViewport.addEventListener("change", resetMotionMode);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measureTarget);
      window.removeEventListener("resize", measureTarget);
      reducedMotion.removeEventListener("change", measureTarget);
      mobileViewport.removeEventListener("change", resetMotionMode);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen || selectedItem ? "hidden" : "";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSelectedItem(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen, selectedItem]);

  const closeMenu = () => setMenuOpen(false);

  const cartQuantity = (item: MenuItem) =>
    item.id
      ? cartItems.find((entry) => entry.menuItemId === item.id)?.quantity ?? 0
      : 0;

  const addMenuItem = (item: MenuItem) => {
    if (!item.id || item.priceInKurus == null) return;
    addItem({
      menuItemId: item.id,
      name: item.name,
      priceInKurus: item.priceInKurus,
      imageUrl: item.imageUrl ?? null,
      imageAlt: item.imageAlt ?? item.name,
      accent: item.accent,
    });
  };

  return (
    <main>
      <a className="skip-link" href="#menu">
        Menüye geç
      </a>

      <header className="site-header" aria-label="Ana navigasyon">
        <a className="brand" href="#top" aria-label="Bonj Cake Story ana sayfa">
          <BrandLogo className="home-header-logo" alt="" priority />
        </a>

        <nav className="desktop-nav" aria-label="Sayfa bölümleri">
          <a href="#menu">Menü</a>
          <a href="#brunch">Brunch</a>
          <a href="#hikaye">Hikâyemiz</a>
          <a href="#mekan">Mekân</a>
          <a href="/iletisim">İletişim</a>
          <a className="desktop-cart-link" href="/sepet">Sepet <strong>{count}</strong></a>
        </nav>

        <a
          className="header-location"
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Bonj Cake Story Instagram hesabı"
        >
          <InstagramIcon />
          Instagram
        </a>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </header>

      <div
        className={`mobile-menu ${menuOpen ? "is-open" : ""}`}
        id="mobile-navigation"
        aria-hidden={!menuOpen}
      >
        <nav aria-label="Mobil navigasyon">
          <a href="#menu" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>01 — Menü</a>
          <a href="#brunch" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>02 — Brunch</a>
          <a href="#hikaye" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>03 — Hikâyemiz</a>
          <a href="#mekan" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>04 — Mekân</a>
          <a href="/iletisim" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>05 — İletişim</a>
          <a href="/sepet" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>06 — Sepet ({count})</a>
          <a href={instagramUrl} target="_blank" rel="noreferrer" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>07 — Instagram <UiIcon name="arrow-up-right" /></a>
        </nav>
        <p>Gaziantep’in tatlı frekansı.</p>
      </div>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-sticky">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-art" aria-hidden="true">
            <img
              className="hero-background"
              src="/images/bonj-hero-plate.webp"
              alt=""
              width="1672"
              height="941"
              fetchPriority="high"
            />
            <div className="hero-cake-fx">
              <img
                className="hero-cake-layer"
                src="/images/bonj-cake-layer.png"
                alt=""
                width="1672"
                height="941"
              />
              <span className="hero-cake-sheen" />
            </div>
          </div>

          <div className="hero-content">
          <div className="eyebrow hero-eyebrow">
            <span>37.0662° N</span>
            <i />
            <span>Gaziantep</span>
          </div>
          <h1 id="hero-title">
            Tatlıya
            <span>yeni bir boyut.</span>
          </h1>
          <p>
            Karamelize yüzey, akışkan merkez, güçlü kahve. Bonj’da her katman
            merak uyandırmak için tasarlandı.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#menu">
              Menüye dal
              <span aria-hidden="true"><UiIcon name="arrow-down-right" /></span>
            </a>
            <a
              className="button button-ghost"
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Yolunu bul
              <span aria-hidden="true"><UiIcon name="arrow-up-right" /></span>
            </a>
          </div>
          </div>

          <div className="hero-stamp" aria-label="Günlük üretim">
          <BrandLogo className="hero-badge-logo bonj-brand-logo--light" alt="" />
          </div>

          <a className="scroll-cue" href="#menu" aria-label="Menüye kaydır">
          <span>KEŞFET</span>
          <i aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="infinite-menu-section" aria-labelledby="infinite-menu-title">
        <div className="infinite-menu-heading section-shell" data-reveal>
          <span className="section-index">01 / ETKİLEŞİMLİ MENÜ</span>
          <h2 id="infinite-menu-title">Tut, çevir.<br /><em>İştahına yaklaş.</em></h2>
          <p>Küreyi sürükle; Bonj seçkisi ellerinin arasında dönsün. Ortadaki ürüne dokunarak menüye geç.</p>
        </div>
        <div className="infinite-menu-frame">
          <InfiniteMenu items={infiniteMenuItems} scale={1} />
        </div>
      </section>

      <div className="flavor-marquee" aria-hidden="true">
        <div>
          <span>KADİFEMSİ</span><i>●</i><span>KREMSİ</span><i>●</i>
          <span>RAFİNE</span><i>●</i><span>TAZE</span><i>●</i>
          <span>KADİFEMSİ</span><i>●</i><span>KREMSİ</span><i>●</i>
          <span>RAFİNE</span><i>●</i><span>TAZE</span><i>●</i>
        </div>
      </div>

      <section className="menu-section section-shell" id="menu">
        <div className="section-heading" data-reveal>
          <div>
            <span className="section-index">02 / MENÜ</span>
            <h2>Bugün neye<br /><em>düşersin?</em></h2>
          </div>
          <p>
            Klasikleri yeniden kuruyor, her ürünü kendi ritminde servis ediyoruz.
          </p>
        </div>

        <div className="filter-row" data-reveal role="group" aria-label="Menü filtreleri">
          {categoryLabels.map((category) => (
            <button
              key={category.id}
              type="button"
              className={filter === category.id ? "is-active" : ""}
              onClick={() => setFilter(category.id)}
              aria-pressed={filter === category.id}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="menu-grid" aria-live="polite">
          {filteredItems.map((item, index) => (
            <article
              className={`menu-card-wrap ${item.id && item.priceInKurus != null ? "has-order-action" : ""}`}
              key={item.slug}
              data-reveal
            >
              <TiltCard>
                <button
                  className={`menu-card accent-${item.accent}`}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  aria-label={`${item.name} ürün detaylarını aç`}
                >
                  <div className="card-visual" aria-hidden="true">
                    {item.imageUrl ? (
                      <img
                        className="menu-product-image"
                        src={item.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <>
                        <span className="visual-disc disc-back" />
                        <span className="visual-disc disc-front" />
                        <span className="visual-core">{String(index + 1).padStart(2, "0")}</span>
                      </>
                    )}
                  </div>
                  <div className="card-copy">
                    <div className="card-meta">
                      <span>{item.categoryName}</span>
                      {item.badge && <mark>{item.badge}</mark>}
                      {formatPrice(item.priceInKurus) && (
                        <strong>{formatPrice(item.priceInKurus)}</strong>
                      )}
                    </div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <span className="card-arrow" aria-hidden="true"><UiIcon name="arrow-up-right" /></span>
                  </div>
                </button>
              </TiltCard>
              {item.id && item.priceInKurus != null && (
                <button
                  className={`home-menu-add ${cartQuantity(item) ? "is-added" : ""}`}
                  type="button"
                  onClick={() => addMenuItem(item)}
                  aria-label={`${item.name} ürününü sepete ekle`}
                >
                  <span>{cartQuantity(item) ? "Bir tane daha ekle" : "Sepete ekle"}</span>
                  <strong>{cartQuantity(item) || <UiIcon name="plus" />}</strong>
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      {selectedItem && (
        <div
          className="menu-detail-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedItem(null);
          }}
        >
          <section
            className="menu-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-detail-title"
          >
            <button
              className="menu-detail-close"
              type="button"
              onClick={() => setSelectedItem(null)}
              aria-label="Ürün detayını kapat"
            >
              <UiIcon name="close" />
            </button>
            <div className={`menu-detail-visual accent-${selectedItem.accent}`}>
              {selectedItem.imageUrl ? (
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.imageAlt || selectedItem.name}
                />
              ) : (
                <span className="detail-disc" aria-hidden="true" />
              )}
            </div>
            <div className="menu-detail-copy">
              <span>{selectedItem.categoryName}</span>
              <h2 id="menu-detail-title">{selectedItem.name}</h2>
              <p>{selectedItem.longDescription || selectedItem.description}</p>
              <dl>
                {selectedItem.estimatedCalories != null && (
                  <div><dt>Tahmini enerji</dt><dd>≈ {selectedItem.estimatedCalories} kcal</dd></div>
                )}
                {selectedItem.allergenInfo && (
                  <div><dt>Alerjen</dt><dd>{selectedItem.allergenInfo}</dd></div>
                )}
              </dl>
              {selectedItem.id && selectedItem.priceInKurus != null && (
                <div className="menu-detail-purchase">
                  <strong className="menu-detail-price">
                    {formatPrice(selectedItem.priceInKurus)}
                  </strong>
                  <button
                    className={cartQuantity(selectedItem) ? "is-added" : ""}
                    type="button"
                    onClick={() => addMenuItem(selectedItem)}
                  >
                    <span>{cartQuantity(selectedItem) ? "Bir tane daha ekle" : "Sepete ekle"}</span>
                    <strong>{cartQuantity(selectedItem) || <UiIcon name="plus" />}</strong>
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {count > 0 && (
        <a className="home-cart-float" href="/sepet" aria-label={`Sepete git, ${count} ürün`}>
          <span><strong>{count}</strong> ürün</span>
          <span>Sepeti gör · {formatPrice(totalInKurus)} <i><UiIcon name="arrow-right" /></i></span>
        </a>
      )}

      <section className="brunch-section" id="brunch" aria-labelledby="brunch-title">
        <div className="brunch-word" aria-hidden="true">BRUNCH</div>
        <div className="brunch-layout section-shell">
          <div className="brunch-copy" data-reveal>
            <span className="section-index">03 / BONJ BRUNCH</span>
            <p className="brunch-kicker">Kahvaltının yeni katmanı</p>
            <h2 id="brunch-title">
              Kat kat.<br />
              <em>Dolu dolu.</em>
            </h2>
            <p className="brunch-description">
              Sade bir kruvasan değil. Dışı tereyağlı ve çıtır; içi avokado,
              yumuşacık scrambled egg, taze roka ve otlu labneyle dolu.
            </p>
            <ul className="brunch-ingredients" aria-label="İçindekiler">
              <li><span>01</span> Avokado</li>
              <li><span>02</span> Scrambled egg</li>
              <li><span>03</span> Taze roka</li>
              <li><span>04</span> Otlu labne</li>
            </ul>
          </div>

          <div className="brunch-stage" data-reveal>
            <span className="brunch-orbit orbit-outer" aria-hidden="true" />
            <span className="brunch-orbit orbit-inner" aria-hidden="true" />
            <span className="brunch-label label-avocado" aria-hidden="true">
              <b>01</b> AVO
            </span>
            <span className="brunch-label label-egg" aria-hidden="true">
              <b>02</b> EGG
            </span>
            <img
              className="brunch-product"
              src="/images/bonj-brunch-croissant.webp"
              alt="Avokado, scrambled egg ve roka dolgulu tereyağlı brunch kruvasanı"
              width="1536"
              height="1024"
              loading="lazy"
              decoding="async"
            />
            <span className="brunch-badge" aria-hidden="true">
              <BrandLogo className="brunch-badge-logo bonj-brand-logo--light" alt="" />
            </span>
          </div>
        </div>
      </section>

      <section className="story-section" id="hikaye">
        <div className="story-blob blob-one" aria-hidden="true" />
        <div className="story-blob blob-two" aria-hidden="true" />
        <div className="section-shell story-inner">
          <div className="story-title" data-reveal>
            <span className="section-index">04 / BONJ HİKÂYESİ</span>
            <h2>
              Tarif değil,
              <em>his bırakıyoruz.</em>
            </h2>
          </div>
          <div className="story-copy" data-reveal>
            <p>
              Bonj, tanıdık tatları daha cesur dokularla buluşturan bir şehir
              molası. Her dilim günlük hazırlanır; her kahve, tatlının ritmine
              göre demlenir.
            </p>
            <div className="story-facts">
              <div><strong>01</strong><span>Günlük<br />üretim</span></div>
              <div><strong>02</strong><span>Özenli<br />demleme</span></div>
              <div><strong>03</strong><span>Cesur<br />eşleşmeler</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="motion-section" aria-labelledby="motion-title">
        <div className="motion-word" aria-hidden="true">FRESH</div>
        <div className="motion-layout section-shell">
          <div className="motion-copy" data-reveal>
            <span className="section-index">05 / MUTFAKTAN</span>
            <p className="motion-kicker">Bonj, hareket halinde.</p>
            <h2 id="motion-title">Mutfakta başlar,<br /><em>masada iz bırakır.</em></h2>
            <p className="motion-description">Her katman elde, her dokunuş o gün. Kamera sadece son halini değil, Bonj’un mutfaktaki gerçek ritmini de yakalıyor.</p>
          </div>

          <div className="motion-stage" data-reveal>
            <span className="motion-orbit motion-orbit-one" aria-hidden="true" />
            <span className="motion-orbit motion-orbit-two" aria-hidden="true" />
            <div className="motion-video-shell">
              <video
                className="motion-video"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/videos/bonj-video-poster.png"
                aria-label="Bonj mutfağında hazırlanan özel pastanın videosu"
              >
                <source src="/videos/bonj-video.mp4" type="video/mp4" />
              </video>
            </div>
            <span className="motion-seal" aria-hidden="true"><BrandLogo className="motion-badge-logo bonj-brand-logo--light" alt="" /></span>
          </div>
        </div>
      </section>

      <section className="ritual-section section-shell">
        <div className="section-heading compact" data-reveal>
          <div>
            <span className="section-index">06 / RİTÜEL</span>
            <h2>Sıradan bir<br /><em>kahve molası değil.</em></h2>
          </div>
        </div>
        <div className="ritual-grid">
          <article data-reveal>
            <span>01</span>
            <h3>Katmanı kır</h3>
            <p>Karamelize yüzeyin altındaki ipeksi dokuyu keşfet.</p>
          </article>
          <article data-reveal>
            <span>02</span>
            <h3>Yudumu eşleştir</h3>
            <p>Kahveni ya da limonatanı tatlının karakterine göre seç.</p>
          </article>
          <article data-reveal>
            <span>03</span>
            <h3>Anı uzat</h3>
            <p>Şehrin hızını kapıda bırak. Masada sadece tat kalsın.</p>
          </article>
        </div>
      </section>

      <section className="location-section" id="mekan">
        <div className="location-orb" aria-hidden="true">
          <span />
          <i />
        </div>
        <div className="location-content" data-reveal>
          <span className="section-index">07 / MEKÂN</span>
          <p>Şimdi sıra sende.</p>
          <h2>Gaziantep’te<br /><em>buluşalım.</em></h2>
          <a
            className="button button-light"
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Haritada aç <span aria-hidden="true"><UiIcon name="arrow-up-right" /></span>
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <BrandLogo className="home-footer-logo bonj-brand-logo--light" />
        </div>
        <div className="footer-note">
          <span>GAZİANTEP / TÜRKİYE</span>
          <p>San Sebastian · Cheesecake · Coffee</p>
        </div>
        <a href="#top">Başa dön <UiIcon name="arrow-up" /></a>
      </footer>
    </main>
  );
}
