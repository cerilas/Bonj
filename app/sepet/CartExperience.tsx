"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";

function MapController({ onReady }: { onReady: (map: google.maps.Map | null) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}
import { useCart } from "@/lib/use-cart";
import { BrandLogo } from "../components/BrandLogo";
import { TouchDateTimePicker } from "../components/TouchDateTimePicker";
import { UiIcon } from "../components/UiIcon";
import { useUser } from "@/lib/use-user";
import { AuthModal } from "../components/AuthModal";

type Fulfillment = "table" | "pickup" | "delivery";

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

export function CartExperience({ googleMapsApiKey = "" }: { googleMapsApiKey?: string }) {
  const mapsApiKey = googleMapsApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { items, ready, count, totalInKurus, setQuantity, clearCart } = useCart();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("table");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<{ orderNumber: string; total: number } | null>(null);
  const [pickupAt, setPickupAt] = useState("");
  const [pickupWindow, setPickupWindow] = useState({ earliest: "", latestDate: "" });
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [address, setAddress] = useState("");
  const [ccHolderName, setCcHolderName] = useState("");
  const [ccNo, setCcNo] = useState("");
  const [ccExpiryMonth, setCcExpiryMonth] = useState("");
  const [ccExpiryYear, setCcExpiryYear] = useState("");
  const [ccCvv, setCcCvv] = useState("");
  const [htmlFormContent, setHtmlFormContent] = useState<string | null>(null);

  // User membership & addresses
  const { user, isLoggedIn } = useUser();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const applySavedAddress = useCallback((addr: {
    id: number;
    title: string;
    fullName: string;
    phone: string;
    city: string;
    district: string;
    street: string;
    addressLine: string;
    lat: string | null;
    lng: string | null;
  }) => {
    setSelectedAddressId(addr.id);
    setCustomerName(addr.fullName);
    setPhone(addr.phone);
    const fullText = `${addr.street}, ${addr.district} / Gaziantep - ${addr.addressLine}`;
    setAddress(fullText);
    if (addr.lat && addr.lng) {
      const lat = parseFloat(addr.lat);
      const lng = parseFloat(addr.lng);
      setPinLocation({ lat, lng });
      mapRef.current?.panTo({ lat, lng });
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (!customerName && user.fullName) setCustomerName(user.fullName);
      if (!phone && user.phone) setPhone(`0${user.phone}`);
    }
  }, [user, customerName, phone]);

  useEffect(() => {
    if (isLoggedIn) {
      fetch("/api/user/addresses")
        .then((res) => res.json())
        .then((data) => {
          if (data.addresses && Array.isArray(data.addresses)) {
            setSavedAddresses(data.addresses);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const def = data.addresses.find((a: any) => a.isDefault) || data.addresses[0];
            if (def && !address) {
              applySavedAddress(def);
            }
          }
        })
        .catch((err) => console.error("Adresler yüklenemedi", err));
    }
  }, [isLoggedIn, address, applySavedAddress]);

  // Map state - Default center Gaziantep
  const [mapCenter] = useState({ lat: 37.0662, lng: 37.3833 });
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const onMapReady = useCallback((map: google.maps.Map | null) => {
    mapRef.current = map;
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();

  const handleLocationChange = useCallback(async (lat: number, lng: number) => {
    setPinLocation({ lat, lng });
    setIsGeocoding(true);
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data.address) {
        setAddress(data.address);
      }
    } catch (err) {
      console.error("Geocoding failed", err);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapClick = useCallback((e: any) => {
    if (e.detail.latLng) {
      handleLocationChange(e.detail.latLng.lat, e.detail.latLng.lng);
    }
  }, [handleLocationChange]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMarkerDragEnd = useCallback((e: any) => {
    const latLng = e.latLng || (e.target && e.target.position);
    if (latLng) {
      const lat = typeof latLng.lat === "function" ? latLng.lat() : latLng.lat;
      const lng = typeof latLng.lng === "function" ? latLng.lng() : latLng.lng;
      handleLocationChange(lat, lng);
    }
  }, [handleLocationChange]);

  useEffect(() => {
    if (fulfillment === "delivery" && !pinLocation && !isLocating) {
      setIsLocating(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            mapRef.current?.panTo({ lat, lng });
            handleLocationChange(lat, lng);
            setIsLocating(false);
          },
          (error) => {
            console.error("Geolocation error:", error);
            handleLocationChange(mapCenter.lat, mapCenter.lng);
            setIsLocating(false);
          },
          { enableHighAccuracy: true }
        );
      } else {
        handleLocationChange(mapCenter.lat, mapCenter.lng);
        setIsLocating(false);
      }
    }
  }, [fulfillment, pinLocation, isLocating, handleLocationChange, mapCenter.lat, mapCenter.lng]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompleted({
        orderNumber: searchParams.get("orderNumber") || "BONJ-SİPARİŞ",
        total: 0,
      });
      clearCart();
    } else if (status === "cancel" || status === "failed") {
      const reason = searchParams.get("reason");
      setError(
        reason
          ? `Ödeme başarısız oldu: ${reason}`
          : "Ödeme işleminiz başarısız oldu veya iptal edildi. Lütfen tekrar deneyin."
      );
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = Date.now();
      const earliest = localDateTimeValue(new Date(now + 10 * 60_000));
      const initial = localDateTimeValue(new Date(now + 30 * 60_000));
      const latestDate = localDateTimeValue(new Date(now + 30 * 24 * 60 * 60_000)).slice(0, 10);
      setPickupWindow({ earliest, latestDate });
      setPickupAt(initial);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const pickupDate = pickupAt.slice(0, 10);
  const pickupTime = pickupAt.slice(11, 16);
  const pickupMinTime = pickupDate === pickupWindow.earliest.slice(0, 10)
    ? pickupWindow.earliest.slice(11, 16)
    : undefined;

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
        address: fulfillment === "delivery" ? address : null,
        addressId: fulfillment === "delivery" ? selectedAddressId : null,
        note: form.get("note"),
        items: items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
        payment: {
          ccHolderName,
          ccNo: ccNo.replace(/\s+/g, ""),
          ccExpiryMonth,
          ccExpiryYear,
          ccCvv,
        }
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

    if ((result as any).redirectUrl) {
      window.location.href = (result as any).redirectUrl;
      return;
    }

    if ((result as any).paymentHtml) {
      // API returned 3D secure HTML, inject it to redirect the user to bank
      setHtmlFormContent((result as any).paymentHtml);
      return;
    }

    setCompleted({
      orderNumber: result.orderNumber ?? "BONJ-SİPARİŞ",
      total: result.totalInKurus ?? totalInKurus,
    });
    clearCart();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (htmlFormContent) {
      const formDiv = document.getElementById("halkode-3d-form");
      if (formDiv) {
        const form = formDiv.querySelector("form");
        if (form) {
          const bankUrlInput = form.querySelector('input[name="bank_url"]') as HTMLInputElement | null;
          if (bankUrlInput?.value) {
            form.action = bankUrlInput.value;
          }
          try {
            HTMLFormElement.prototype.submit.call(form);
          } catch {
            form.submit();
          }
        }
      }
    }
  }, [htmlFormContent]);

  if (htmlFormContent) {
    return (
      <main className="cart-page">
        <header className="cart-header">
          <Link className="cart-brand" href="/" aria-label="Bonj Cake Story ana sayfa"><BrandLogo className="cart-header-logo" alt="" /></Link>
        </header>
        <section className="cart-intro" style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <h1>Güvenli Ödeme<br /><em>Yönlendiriliyorsunuz...</em></h1>
          <p style={{ marginTop: "1rem" }}>Banka onay sayfasına aktarılıyorsunuz. Lütfen bekleyin.</p>
          <button
            type="button"
            className="cart-primary-link"
            style={{ margin: "2rem auto 0", cursor: "pointer" }}
            onClick={() => {
              const form = document.getElementById("halkode-3d-form")?.querySelector("form");
              if (form) {
                const bankUrlInput = form.querySelector('input[name="bank_url"]') as HTMLInputElement | null;
                if (bankUrlInput?.value) {
                  form.action = bankUrlInput.value;
                }
                try {
                  HTMLFormElement.prototype.submit.call(form);
                } catch {
                  form.submit();
                }
              }
            }}
          >
            Sayfa açılmazsa buraya tıklayın
          </button>
          <div
            id="halkode-3d-form"
            dangerouslySetInnerHTML={{ __html: htmlFormContent }}
            style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
          />
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="cart-page cart-completed-page">
        <header className="cart-header">
          <Link className="cart-brand" href="/" aria-label="Bonj Cake Story ana sayfa"><BrandLogo className="cart-header-logo" alt="" /></Link>
          <Link href="/menu">Menüye dön <UiIcon name="arrow-up-right" /></Link>
        </header>
        <section className="cart-success">
          <div className="cart-success-orbit" aria-hidden="true"><i /><i /><span><UiIcon name="check" /></span></div>
          <span className="cart-kicker">SİPARİŞİN BİZDE</span>
          <h1>Tamamdır,<br /><em>hazırlıyoruz.</em></h1>
          <p>Ödemeniz başarıyla alındı. Siparişiniz Bonj ekibine iletildi; seçtiğiniz teslim biçimine göre hazırlanıyor.</p>
          <div className="cart-receipt">
            <span>Sipariş kodu<strong>{completed.orderNumber}</strong></span>
            <span>Toplam<strong>{money(completed.total)}</strong></span>
          </div>
          <Link className="cart-primary-link" href="/menu">Menüye dön <span><UiIcon name="arrow-up-right" /></span></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <header className="cart-header">
        <Link className="cart-brand" href="/" aria-label="Bonj Cake Story ana sayfa"><BrandLogo className="cart-header-logo" alt="" /></Link>
        <div><span>SEPET / {count.toString().padStart(2, "0")}</span><Link href="/menu">Menüye dön <UiIcon name="arrow-up-right" /></Link></div>
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
          <Link className="cart-primary-link" href="/menu">Menüyü aç <span><UiIcon name="arrow-up-right" /></span></Link>
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
                  <button type="button" onClick={() => setQuantity(item.menuItemId, item.quantity + 1)} disabled={item.quantity >= 20} aria-label="Bir artır"><UiIcon name="plus" /></button>
                </div>
                <strong className="cart-line-total">{money(item.priceInKurus * item.quantity)}</strong>
              </article>
            ))}
            <div className="cart-total"><span>Toplam</span><strong>{money(totalInKurus)}</strong></div>
          </section>

          <form className="cart-checkout" onSubmit={submitOrder}>
            {!isLoggedIn ? (
              <aside className="bonj-checkout-promote-card" aria-label="Üyelik Fırsatı">
                <div className="bonj-promote-content">
                  <span className="bonj-promote-icon"><UiIcon name="sparkles" /></span>
                  <div className="bonj-promote-text">
                    <strong>Üye Ol, Daha Hızlı Sipariş Ver!</strong>
                    <span>Kayıtlı Gaziantep adreslerinizi tek tıkla seçin, siparişinizi anında tamamlayın.</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="bonj-promote-btn"
                  onClick={() => setIsAuthModalOpen(true)}
                >
                  Giriş Yap / Üye Ol
                </button>
              </aside>
            ) : (
              <div className="bonj-checkout-user-badge">
                <span className="bonj-checkout-user-badge-left">
                  <UiIcon name="user" />
                  <span><span className="bonj-checkout-user-name">{user?.fullName || "Değerli Müşterimiz"}</span> (0{user?.phone}) olarak sipariş veriyorsunuz.</span>
                </span>
                <Link href="/hesabim" className="bonj-checkout-user-link">
                  Hesabım →
                </Link>
              </div>
            )}

            <div className="cart-section-heading"><span>02 / SİPARİŞ BİLGİSİ</span><strong>Kart ile Güvenli Ödeme</strong></div>

            <fieldset className="cart-fulfillment">
              <legend>Nasıl teslim alacaksın?</legend>
              <button className={fulfillment === "table" ? "is-selected" : ""} type="button" onClick={() => setFulfillment("table")} aria-pressed={fulfillment === "table"}>
                <small>01</small><strong>BONJ’dayım</strong><span>Masa numaram belli</span><i><UiIcon name="check" /></i>
              </button>
              <button className={fulfillment === "pickup" ? "is-selected" : ""} type="button" onClick={() => setFulfillment("pickup")} aria-pressed={fulfillment === "pickup"}>
                <small>02</small><strong>BONJ’a geliyorum</strong><span>Şu saatte hazır olsun</span><i><UiIcon name="check" /></i>
              </button>
              <button className={fulfillment === "delivery" ? "is-selected" : ""} type="button" onClick={() => setFulfillment("delivery")} aria-pressed={fulfillment === "delivery"}>
                <small>03</small><strong>BONJ evime gelsin</strong><span>Adresime teslim</span><i><UiIcon name="check" /></i>
              </button>
            </fieldset>

            <div className="cart-customer-fields">
              <label>Adın soyadın *<input name="customerName" required maxLength={120} autoComplete="name" placeholder="Nasıl hitap edelim?" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></label>
              <label>Telefonun *<input name="phone" required maxLength={32} type="tel" inputMode="tel" autoComplete="tel" placeholder="05__ ___ __ __" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
              {fulfillment === "table" && (
                <label className="cart-dynamic-field">Masa numaran *<input name="tableNumber" required maxLength={20} inputMode="numeric" placeholder="Örn. 12" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} /></label>
              )}
              {fulfillment === "delivery" && (
                <div className="cart-dynamic-field cart-delivery-field">
                  {isLoggedIn && savedAddresses.length > 0 && (
                    <div className="bonj-checkout-saved-addresses">
                      <div className="bonj-saved-addr-header">
                        <span className="bonj-saved-addr-label">
                          <UiIcon name="pin" /> Kayıtlı adresleriniz
                        </span>
                        <Link href="/hesabim" className="bonj-saved-addr-manage-link">
                          Yönet
                        </Link>
                      </div>
                      <div className="bonj-saved-addr-pills">
                        {savedAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            className={`bonj-saved-addr-pill ${selectedAddressId === addr.id ? "is-active" : ""}`}
                            onClick={() => applySavedAddress(addr)}
                          >
                            <span className="bonj-saved-addr-icon">
                              {addr.title.toLowerCase().includes("ev") ? <UiIcon name="home" /> : <UiIcon name="building" />}
                            </span>
                            <span className="bonj-saved-addr-title">{addr.title}</span>
                            <span className="bonj-saved-addr-district">({addr.district})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <span className="cart-field-label">Açık Adresin *</span>
                  {mapsApiKey ? (
                    <div
                      style={{ height: '240px', width: '100%', borderRadius: '8px', overflow: 'hidden', marginBottom: '0.5rem', position: 'relative' }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {isLocating && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontWeight: '500', color: '#000', fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>Konumunuz bulunuyor...</span>
                        </div>
                      )}
                      <APIProvider apiKey={mapsApiKey}>
                        <Map
                          defaultCenter={mapCenter}
                          defaultZoom={15}
                          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined}
                          onClick={handleMapClick}
                          disableDefaultUI={true}
                          keyboardShortcuts={false}
                          gestureHandling="greedy"
                        >
                          <MapController onReady={onMapReady} />
                          {pinLocation && (
                            <Marker
                              position={pinLocation}
                              draggable={true}
                              onDragEnd={handleMarkerDragEnd}
                            />
                          )}
                        </Map>
                      </APIProvider>
                    </div>
                  ) : (
                    <div style={{ padding: '0.5rem', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', marginBottom: '0.5rem', fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>
                      Google Maps API Key eksik. Harita üzerinden seçim yapılamıyor.
                    </div>
                  )}
                  <textarea
                    name="address"
                    required
                    maxLength={500}
                    rows={3}
                    placeholder="Lütfen haritadan seçin veya açık adresinizi girin..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isGeocoding}
                  />
                </div>
              )}
              {fulfillment === "pickup" && (
                <div className="cart-dynamic-field cart-pickup-field">
                  <span className="cart-field-label">Geliş tarihi ve saati *</span>
                  <input type="hidden" name="pickupAt" value={pickupAt} />
                  {pickupAt ? (
                    <TouchDateTimePicker
                      date={pickupDate}
                      time={pickupTime}
                      minDate={pickupWindow.earliest.slice(0, 10)}
                      maxDate={pickupWindow.latestDate}
                      minTime={pickupMinTime}
                      helperText="Hazırlık süresi nedeniyle en erken uygun saat gösterilir."
                      onDateChange={(value) => {
                        const earliestDate = pickupWindow.earliest.slice(0, 10);
                        const earliestTime = pickupWindow.earliest.slice(11, 16);
                        const nextTime = value === earliestDate && pickupTime < earliestTime
                          ? earliestTime
                          : pickupTime;
                        setPickupAt(`${value}T${nextTime}`);
                      }}
                      onTimeChange={(value) => setPickupAt(`${pickupDate}T${value}`)}
                    />
                  ) : (
                    <span className="cart-picker-loading">Uygun saatler hazırlanıyor…</span>
                  )}
                </div>
              )}
              <label>Sipariş notun<textarea name="note" maxLength={1000} rows={3} placeholder="Opsiyonel — örn. şekersiz, çatal istemiyorum…" /></label>
            </div>

            <div className="cart-section-heading" style={{ marginTop: "3rem" }}><span>03 / ÖDEME</span><strong>Kredi/Banka Kartı</strong></div>
            <div className="cart-customer-fields">
              <label>Kart Üzerindeki İsim *<input required maxLength={120} value={ccHolderName} onChange={e => setCcHolderName(e.target.value)} placeholder="Ad Soyad" /></label>
              <label>Kart Numarası *<input required maxLength={19} type="tel" inputMode="numeric" value={ccNo} onChange={e => setCcNo(e.target.value)} placeholder="0000 0000 0000 0000" /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <label>Son Kul. (Ay/Yıl) *
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input required maxLength={2} type="tel" inputMode="numeric" value={ccExpiryMonth} onChange={e => setCcExpiryMonth(e.target.value)} placeholder="Ay (AA)" />
                    <input required maxLength={4} type="tel" inputMode="numeric" value={ccExpiryYear} onChange={e => setCcExpiryYear(e.target.value)} placeholder="Yıl (YYYY)" />
                  </div>
                </label>
                <label>CVV *<input required maxLength={4} type="tel" inputMode="numeric" value={ccCvv} onChange={e => setCcCvv(e.target.value)} placeholder="123" /></label>
              </div>
            </div>

            <div className="cart-payment-note"><i>i</i><p>Ödemeniz 3D Secure güvencesiyle bankanız üzerinden gerçekleşecektir.</p></div>
            {error && <p className="cart-error" role="alert">{error}</p>}
            <button className="cart-submit" type="submit" disabled={sending}>
              <span>{sending ? "Sipariş iletiliyor…" : "Siparişi tamamla (3D Secure)"}<small>{money(totalInKurus)}</small></span>
              <i><UiIcon name="arrow-up-right" /></i>
            </button>
          </form>
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
      />
    </main>
  );
}
