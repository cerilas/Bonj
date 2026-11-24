"use client";

import { useEffect, useRef, useState } from "react";
import {
  CUSTOMER_DISPLAY_CHANNEL,
  CUSTOMER_DISPLAY_STORAGE_KEY,
  readCustomerDisplayState,
  type CustomerDisplayState,
} from "@/lib/customer-display";
import { BrandLogo } from "../components/BrandLogo";
import { UiIcon } from "../components/UiIcon";

function money(kurus: number) {
  return `${(kurus / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

function methodLabel(method: "cash" | "card" | "split" | "free" | null) {
  if (method === "cash") return "Nakit Ödeme";
  if (method === "card") return "Kredi Kartı";
  if (method === "split") return "Parçalı (Nakit + Kart)";
  if (method === "free") return "İkram";
  return "Ödeme Bekleniyor";
}

export function CustomerDisplayExperience() {
  const [state, setState] = useState<CustomerDisplayState>({ mode: "idle", updatedAt: 0 });
  const [now, setNow] = useState(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOsFullscreen, setIsOsFullscreen] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setState(readCustomerDisplayState());
      checkFullscreenState();
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key === CUSTOMER_DISPLAY_STORAGE_KEY && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as CustomerDisplayState);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
      channel.onmessage = (event: MessageEvent<CustomerDisplayState>) => {
        if (event.data && typeof event.data === "object" && "mode" in event.data) {
          setState(event.data);
        }
      };
    }

    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const checkFullscreenState = () => {
      const apiFs = Boolean(document.fullscreenElement);
      const viewportFs =
        window.innerHeight >= window.screen.height - 4 &&
        window.innerWidth >= window.screen.width - 4;
      setIsFullscreen(apiFs);
      setIsOsFullscreen(apiFs || viewportFs);
    };
    document.addEventListener("fullscreenchange", checkFullscreenState);
    window.addEventListener("resize", checkFullscreenState);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("storage", onStorage);
      channel?.close();
      window.clearInterval(clock);
      document.removeEventListener("fullscreenchange", checkFullscreenState);
      window.removeEventListener("resize", checkFullscreenState);
    };
  }, []);

  // Automatically return from "paid" celebration back to "idle" after 6 seconds
  useEffect(() => {
    if (state.mode !== "paid") return;
    const timer = window.setTimeout(() => {
      setState((curr) => (curr.mode === "paid" ? { mode: "idle", updatedAt: Date.now() } : curr));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [state]);

  // Draw scannable Menu QR code in idle mode
  useEffect(() => {
    if (state.mode !== "idle" || !qrCanvasRef.current) return;
    const canvas = qrCanvasRef.current;
    const isLocalHost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const menuUrl = isLocalHost
      ? "https://bonjcakestory.com/menu"
      : `${window.location.origin}/menu`;
    void import("qrcode").then(({ default: QRCode }) =>
      QRCode.toCanvas(canvas, menuUrl, {
        width: 144,
        margin: 1,
        color: { dark: "#171114", light: "#fffaf3" },
        errorCorrectionLevel: "M",
      }).catch(() => {}),
    );
  }, [state.mode]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  }

  const timeText = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const dateText = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(now);

  const itemCount =
    state.mode === "checkout"
      ? state.items.reduce((sum, i) => sum + i.quantity, 0)
      : state.mode === "paid"
        ? state.itemCount
        : 0;

  const densityClass =
    state.mode === "checkout"
      ? state.items.length > 14
        ? "is-ultra-dense"
        : state.items.length > 7
          ? "is-two-col"
          : ""
      : "";

  return (
    <main className={`cd-screen ${state.mode === "idle" ? "is-idle" : ""}`}>
      {state.mode !== "idle" && (
        <header className="cd-header">
          <div className="cd-brand">
            <BrandLogo className="cd-logo" alt="bonj" priority />
            <div className="cd-brand-copy">
              <strong>bonj cake story</strong>
              <span>Kasa Müşteri Ekranı</span>
            </div>
          </div>

          <div className="cd-header-right">
            <span className={`cd-status-pill is-${state.mode}`}>
              <i aria-hidden="true" />
              {state.mode === "checkout" ? state.sourceLabel : "Ödeme Tamamlandı"}
            </span>
            <div className="cd-clock">
              <strong>{timeText}</strong>
              <small>{dateText}</small>
            </div>
            {!isOsFullscreen && (
              <button
                type="button"
                className="cd-fs-btn"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Tam ekrandan çık" : "Tam ekran"}
              >
                {isFullscreen ? "Küçült" : "Tam Ekran"}
              </button>
            )}
          </div>
        </header>
      )}

      {state.mode === "idle" && (
        <section className="cd-idle">
          <video
            className="cd-idle-video"
            src="/videos/customer-screen-video.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="cd-idle-scrim" aria-hidden="true" />

          <div className="cd-idle-top-right">
            <span className="cd-idle-clock">{timeText}</span>
            {!isOsFullscreen && (
              <button
                type="button"
                className="cd-idle-fs-btn"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Tam ekrandan çık" : "Tam ekran"}
              >
                {isFullscreen ? "Küçült" : "Tam Ekran"}
              </button>
            )}
          </div>

          <div className="cd-idle-card">
            <BrandLogo className="cd-idle-logo" alt="bonj" />
            <h1>
              <em>hoş geldiniz.</em>
            </h1>
            <div className="cd-idle-qr-wrap">
              <div className="cd-idle-qr-box">
                <canvas
                  ref={qrCanvasRef}
                  className="cd-idle-qr-canvas"
                  aria-label="Menü QR Kodu"
                />
              </div>
              <span>MENÜ</span>
            </div>
          </div>

          <span className="cd-idle-cerilas" aria-hidden="true">
            Cerilas
          </span>
        </section>
      )}

      {state.mode === "checkout" && (
        <section className="cd-checkout">
          <div className="cd-items-panel">
            <div className="cd-panel-head">
              <div>
                <span className="cd-eyebrow">SİPARİŞ ÖZETİ</span>
                <h2>
                  {state.sourceLabel}
                  {state.customerName ? ` · ${state.customerName}` : ""}
                </h2>
              </div>
              <span className="cd-count-badge">{itemCount} ürün</span>
            </div>

            {state.items.length === 0 ? (
              <div className="cd-items-empty">
                <p>Ürünler ekleniyor…</p>
              </div>
            ) : (
              <ul className={`cd-items-list ${densityClass}`}>
                {state.items.map((item, idx) => (
                  <li key={`${item.productName}-${idx}`} className="cd-item-row">
                    <span className="cd-item-qty">{item.quantity}×</span>
                    <div className="cd-item-name">
                      <strong>{item.productName}</strong>
                      <small>{money(item.unitPriceInKurus)} / adet</small>
                    </div>
                    <b className="cd-item-total">{money(item.lineTotalInKurus)}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="cd-summary-panel">
            <div className="cd-summary-top">
              <span className="cd-eyebrow">ÖDEME BİLGİSİ</span>
              <div className="cd-method-chip">{methodLabel(state.paymentMethod)}</div>
            </div>

            <div className="cd-totals">
              <div className="cd-total-row">
                <span>Ara Toplam</span>
                <strong>{money(state.subtotalInKurus)}</strong>
              </div>
              {state.discountInKurus > 0 && (
                <div className="cd-total-row is-discount">
                  <span>İndirim</span>
                  <strong>−{money(state.discountInKurus)}</strong>
                </div>
              )}
              {state.paymentMethod === "split" && (state.splitCashInKurus > 0 || state.splitCardInKurus > 0) && (
                <>
                  <div className="cd-total-row">
                    <span>Nakit Payı</span>
                    <strong>{money(state.splitCashInKurus)}</strong>
                  </div>
                  <div className="cd-total-row">
                    <span>Kart Payı</span>
                    <strong>{money(state.splitCardInKurus)}</strong>
                  </div>
                </>
              )}
            </div>

            <div className="cd-grand-total">
              <span>Ödenecek Tutar</span>
              <strong>{money(state.totalInKurus)}</strong>
            </div>

            {state.paymentMethod === "cash" && state.cashTenderedInKurus > 0 && (
              <div className="cd-cash-change">
                <div>
                  <span>Verilen Nakit</span>
                  <strong>{money(state.cashTenderedInKurus)}</strong>
                </div>
                <div>
                  <span>Para Üstü</span>
                  <strong className="is-change">{money(state.changeInKurus)}</strong>
                </div>
              </div>
            )}

            <p className="cd-summary-foot">
              Lütfen ekranınızdaki tutarı kontrol ediniz. Afiyet olsun.
            </p>
          </aside>
        </section>
      )}

      {state.mode === "paid" && (
        <section className="cd-paid">
          <div className="cd-paid-card">
            <span className="cd-paid-icon" aria-hidden="true">
              <UiIcon name="check" />
            </span>
            <span className="cd-eyebrow">{state.sourceLabel}</span>
            <h1>
              Ödemeniz alındı.<br />
              <em>Afiyet olsun.</em>
            </h1>
            <div className="cd-paid-details">
              <div>
                <span>Ödenen Tutar</span>
                <strong>{money(state.totalInKurus)}</strong>
              </div>
              <div>
                <span>Ödeme Yöntemi</span>
                <strong>{methodLabel(state.paymentMethod)}</strong>
              </div>
              {state.changeInKurus > 0 && (
                <div>
                  <span>Para Üstü</span>
                  <strong className="is-change">{money(state.changeInKurus)}</strong>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {state.mode !== "idle" && (
        <footer className="cd-footer">
          <span>bonj cake story</span>
          <span>@bonjcakestory</span>
        </footer>
      )}
    </main>
  );
}
