"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/use-cart";
import { BrandLogo } from "../components/BrandLogo";

type Fulfillment = "table" | "pickup";

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function localDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function CartExperience() {
  const { items, ready, count, totalInKurus, setQuantity, clearCart } = useCart();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("table");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<{ orderNumber: string; total: number } | null>(null);
  const earliestPickup = useMemo(() => localDateTimeValue(new Date(Date.now() + 10 * 60_000)), []);
  const defaultPickup = useMemo(() => localDateTimeValue(new Date(Date.now() + 30 * 60_000)), []);

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const pickupInput = String(form.get("pickupAt") ?? "");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: form.get("customerName"),
        phone: form.get("phone"),
        fulfillmentType: fulfillment,
        tableNumber: form.get("tableNumber"),
        pickupAt: fulfillment === "pickup" && pickupInput
          ? new Date(pickupInput).toISOString()
          : null,
        note: form.get("note"),
        items: items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
      }),
    });
    const result = (await response.json()) as {
      error?: string;
      orderNumber?: string;
      totalInKurus?: number;
    };
    setSending(false);
    if (!response.ok) {
      setError(result.error ?? "Siparişiniz oluşturulamadı.");
      return;
    }
    setCompleted({
      orderNumber: result.orderNumber ?? "BONJ-SİPARİŞ",
      total: result.totalInKurus ?? totalInKurus,
    });
    clearCart();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (completed) {
    return (
      <main className="cart-page cart-completed-page">
        <header className="cart-header">
          <Link className="cart-brand" href="/" aria-label="Bonj Cake Story ana sayfa"><BrandLogo className="cart-header-logo" alt="" /></Link>
          <Link href="/menu">Menüye dön ↗</Link>
        </header>
        <section className="cart-success">
          <div className="cart-success-orbit" aria-hidden="true"><i /><i /><span>✓</span></div>
          <span className="cart-kicker">SİPARİŞİN BİZDE</span>
          <h1>Tamamdır,<br /><em>hazırlıyoruz.</em></h1>
          <p>Ödeme almıyoruz. Siparişin Bonj ekibine iletildi; seçtiğin teslim biçimine göre seni bekliyor olacağız.</p>
          <div className="cart-receipt">
            <span>Sipariş kodu<strong>{completed.orderNumber}</strong></span>
            <span>Toplam<strong>{money(completed.total)}</strong></span>
          </div>
          <Link className="cart-primary-link" href="/menu">Menüye dön <span>↗</span></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <header className="cart-header">
        <Link className="cart-brand" href="/" aria-label="Bonj Cake Story ana sayfa"><BrandLogo className="cart-header-logo" alt="" /></Link>
        <div><span>SEPET / {count.toString().padStart(2, "0")}</span><Link href="/menu">Menüye dön ↗</Link></div>
      </header>

      <section className="cart-intro">
        <span className="cart-kicker">SON BİR KONTROL</span>
        <h1>Sen seçtin,<br /><em>biz hazırlayalım.</em></h1>
      </section>

      {!ready ? (
        <div className="cart-loading">Sepetin hazırlanıyor…</div>
      ) : items.length === 0 ? (
        <section className="cart-empty">
          <span>0</span>
          <h2>Sepetin<br /><em>henüz boş.</em></h2>
          <p>Cheesecake, kahve ya da güzel bir brunch… Menüden canının çektiğini ekle.</p>
          <Link className="cart-primary-link" href="/menu">Menüyü aç <span>↗</span></Link>
        </section>
      ) : (
        <div className="cart-layout">
          <section className="cart-items" aria-label="Sepet ürünleri">
            <div className="cart-section-heading"><span>01 / SEPETİN</span><strong>{count} ürün</strong></div>
            {items.map((item, index) => (
              <article className="cart-item" key={item.menuItemId}>
                <div className={`cart-item-image accent-${item.accent}`}>
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.imageAlt} /> : <span />}
                  <i>{String(index + 1).padStart(2, "0")}</i>
                </div>
                <div className="cart-item-copy">
                  <h2>{item.name}</h2>
                  <span>{money(item.priceInKurus)} / adet</span>
                  <button type="button" onClick={() => setQuantity(item.menuItemId, 0)}>Kaldır</button>
                </div>
                <div className="cart-quantity" aria-label={`${item.name} adedi`}>
                  <button type="button" onClick={() => setQuantity(item.menuItemId, item.quantity - 1)} aria-label="Bir azalt">−</button>
                  <strong>{item.quantity}</strong>
                  <button type="button" onClick={() => setQuantity(item.menuItemId, item.quantity + 1)} disabled={item.quantity >= 20} aria-label="Bir artır">＋</button>
                </div>
                <strong className="cart-line-total">{money(item.priceInKurus * item.quantity)}</strong>
              </article>
            ))}
            <div className="cart-total"><span>Toplam</span><strong>{money(totalInKurus)}</strong></div>
          </section>

          <form className="cart-checkout" onSubmit={submitOrder}>
            <div className="cart-section-heading"><span>02 / SİPARİŞ BİLGİSİ</span><strong>Ödeme yok</strong></div>

            <fieldset className="cart-fulfillment">
              <legend>Nasıl teslim alacaksın?</legend>
              <button className={fulfillment === "table" ? "is-selected" : ""} type="button" onClick={() => setFulfillment("table")} aria-pressed={fulfillment === "table"}>
                <small>01</small><strong>BONJ’dayım</strong><span>Masa numaram belli</span><i>✓</i>
              </button>
              <button className={fulfillment === "pickup" ? "is-selected" : ""} type="button" onClick={() => setFulfillment("pickup")} aria-pressed={fulfillment === "pickup"}>
                <small>02</small><strong>BONJ’a geliyorum</strong><span>Şu saatte hazır olsun</span><i>✓</i>
              </button>
            </fieldset>

            <div className="cart-customer-fields">
              <label>Adın soyadın *<input name="customerName" required maxLength={120} autoComplete="name" placeholder="Nasıl hitap edelim?" /></label>
              <label>Telefonun *<input name="phone" required maxLength={32} type="tel" inputMode="tel" autoComplete="tel" placeholder="05__ ___ __ __" /></label>
              {fulfillment === "table" ? (
                <label className="cart-dynamic-field">Masa numaran *<input name="tableNumber" required maxLength={20} inputMode="numeric" placeholder="Örn. 12" /></label>
              ) : (
                <label className="cart-dynamic-field cart-pickup-field">
                  <span className="cart-field-label">Geliş tarihi ve saati *</span>
                  <span className="cart-datetime-control">
                    <i className="cart-date-icon" aria-hidden="true" />
                    <input
                      name="pickupAt"
                      required
                      type="datetime-local"
                      min={earliestPickup}
                      defaultValue={defaultPickup}
                      aria-describedby="pickup-help"
                    />
                  </span>
                  <small id="pickup-help">Mutfağın hazırlanması için en az 10 dakika ayırıyoruz.</small>
                </label>
              )}
              <label>Sipariş notun<textarea name="note" maxLength={1000} rows={3} placeholder="Opsiyonel — örn. şekersiz, çatal istemiyorum…" /></label>
            </div>

            <div className="cart-payment-note"><i>i</i><p>Online ödeme alınmaz. Tutarı siparişini teslim alırken Bonj’da ödeyebilirsin.</p></div>
            {error && <p className="cart-error" role="alert">{error}</p>}
            <button className="cart-submit" type="submit" disabled={sending}>
              <span>{sending ? "Sipariş iletiliyor…" : "Siparişi tamamla"}<small>{money(totalInKurus)}</small></span>
              <i>↗</i>
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
