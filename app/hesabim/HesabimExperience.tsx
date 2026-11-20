"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { AuthModal } from "../components/AuthModal";
import { UiIcon } from "../components/UiIcon";
import { useUser } from "@/lib/use-user";

function MapController({ onReady }: { onReady: (map: google.maps.Map | null) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

const GAZIANTEP_CENTER = { lat: 37.0662, lng: 37.3833 };

const GAZIANTEP_DISTRICTS = [
  "Şahinbey",
  "Şehitkamil",
  "Nizip",
  "İslahiye",
  "Oğuzeli",
  "Nurdağı",
  "Araban",
  "Yavuzeli",
  "Karkamış",
];

type AddressItem = {
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
  isDefault: boolean;
};

type OrderItem = {
  id: number;
  productName: string;
  unitPriceInKurus: number;
  quantity: number;
  lineTotalInKurus: number;
};

type OrderRecord = {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  fulfillmentType: string;
  tableNumber: string | null;
  pickupAt: string | null;
  address: string | null;
  note: string | null;
  status: string;
  paymentStatus: string;
  totalInKurus: number;
  createdAt: string;
  items: OrderItem[];
};

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(kurus / 100);
}

function formatDate(isoString: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function orderStatusBadge(status: string) {
  switch (status) {
    case "new":
      return { label: "Sipariş Alındı", className: "status-new" };
    case "preparing":
      return { label: "Hazırlanıyor", className: "status-preparing" };
    case "ready":
      return { label: "Hazırlandı", className: "status-ready" };
    case "on_the_way":
      return { label: "Kuryede / Yolda", className: "status-shipping" };
    case "delivered":
      return { label: "Teslim Edildi", className: "status-delivered" };
    case "cancelled":
      return { label: "İptal Edildi", className: "status-cancelled" };
    default:
      return { label: status, className: "status-default" };
  }
}

export function HesabimExperience({ googleMapsApiKey = "" }: { googleMapsApiKey?: string }) {
  const mapsApiKey = googleMapsApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { user, isLoggedIn, isLoading: authLoading, logout, refreshUser } = useUser();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"profile" | "addresses" | "orders">("profile");

  // Profile Form state
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Addresses state
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);

  // Address Modal Form
  const [addrTitle, setAddrTitle] = useState("Evim");
  const [addrFullName, setAddrFullName] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrDistrict, setAddrDistrict] = useState("Şehitkamil");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrLine, setAddrLine] = useState("");
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [addrPin, setAddrPin] = useState<{ lat: number; lng: number } | null>(GAZIANTEP_CENTER);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);
  const onMapReady = useCallback((map: google.maps.Map | null) => {
    mapRef.current = map;
  }, []);

  // Orders state
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const requestUserLocation = useCallback((autoFill = false) => {
    if (typeof window === "undefined" || !navigator.geolocation) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const coords = { lat, lng };
        setAddrPin(coords);
        mapRef.current?.panTo(coords);
        setIsLocating(false);

        // Reverse geocode to detect district / street
        try {
          const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
          if (res.ok) {
            const data = await res.json();
            if (data.address) {
              const matchedDistrict = GAZIANTEP_DISTRICTS.find((d) =>
                data.address.toLowerCase().includes(d.toLowerCase())
              );
              if (matchedDistrict) {
                setAddrDistrict(matchedDistrict);
              }
              if (autoFill) {
                setAddrStreet((prev) => prev ? prev : data.address.split(",")[0]?.trim() || "");
              }
            }
          }
        } catch (err) {
          console.warn("Geocoding failed:", err);
        }
      },
      (error) => {
        console.warn("Kullanıcı konumu alınamadı, Gaziantep merkez kullanılıyor:", error);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (user) {
      setProfileName(user.fullName ?? "");
      setProfileEmail(user.email ?? "");
    }
  }, [user]);

  const fetchAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const res = await fetch("/api/user/addresses");
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses ?? []);
      }
    } catch (err) {
      console.error("Adresler yüklenemedi", err);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/user/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    } catch (err) {
      console.error("Siparişler yüklenemedi", err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      if (activeTab === "addresses") {
        fetchAddresses();
      } else if (activeTab === "orders") {
        fetchOrders();
      }
    }
  }, [isLoggedIn, activeTab, fetchAddresses, fetchOrders]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: profileName,
          email: profileEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ type: "error", text: data.error || "Güncelleme başarısız." });
      } else {
        setProfileMsg({ type: "success", text: "Profil bilgileriniz başarıyla güncellendi." });
        refreshUser();
      }
    } catch {
      setProfileMsg({ type: "error", text: "Bağlantı hatası oluştu." });
    } finally {
      setProfileSaving(false);
    }
  }

  function openNewAddressModal() {
    setEditingAddressId(null);
    setAddrTitle("Evim");
    setAddrFullName(user?.fullName || "");
    setAddrPhone(user?.phone ? `0${user.phone}` : "");
    setAddrDistrict("Şehitkamil");
    setAddrStreet("");
    setAddrLine("");
    setAddrIsDefault(addresses.length === 0);
    setAddrPin(GAZIANTEP_CENTER);
    setAddrError("");
    setIsAddressModalOpen(true);

    if (mapRef.current) {
      mapRef.current.panTo(GAZIANTEP_CENTER);
      mapRef.current.setZoom(16);
    }

    // Automatically prompt and center map on user's current GPS location
    requestUserLocation(true);
  }

  function openEditAddressModal(addr: AddressItem) {
    setEditingAddressId(addr.id);
    setAddrTitle(addr.title);
    setAddrFullName(addr.fullName);
    setAddrPhone(addr.phone);
    setAddrDistrict(addr.district);
    setAddrStreet(addr.street);
    setAddrLine(addr.addressLine);
    setAddrIsDefault(addr.isDefault);
    const pin = addr.lat && addr.lng ? { lat: parseFloat(addr.lat), lng: parseFloat(addr.lng) } : GAZIANTEP_CENTER;
    setAddrPin(pin);
    setAddrError("");
    setIsAddressModalOpen(true);

    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.panTo(pin);
        mapRef.current.setZoom(16);
      }
    }, 100);
  }

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddrSaving(true);
    setAddrError("");

    const payload = {
      title: addrTitle,
      fullName: addrFullName,
      phone: addrPhone,
      city: "Gaziantep", // Strictly Gaziantep
      district: addrDistrict,
      street: addrStreet,
      addressLine: addrLine,
      isDefault: addrIsDefault,
      lat: addrPin ? addrPin.lat.toFixed(6) : null,
      lng: addrPin ? addrPin.lng.toFixed(6) : null,
    };

    try {
      const url = editingAddressId
        ? `/api/user/addresses/${editingAddressId}`
        : "/api/user/addresses";
      const method = editingAddressId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddrError(data.error || "Adres kaydedilemedi.");
        return;
      }

      setIsAddressModalOpen(false);
      fetchAddresses();
    } catch {
      setAddrError("Bağlantı hatası oluştu.");
    } finally {
      setAddrSaving(false);
    }
  }

  async function handleDeleteAddress(id: number) {
    if (!confirm("Bu adresi silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/user/addresses/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAddresses();
      }
    } catch (err) {
      console.error("Adres silinemedi", err);
    }
  }

  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }
    geocodeTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data.address) {
            const matchedDistrict = GAZIANTEP_DISTRICTS.find((d) =>
              data.address.toLowerCase().includes(d.toLowerCase())
            );
            if (matchedDistrict) {
              setAddrDistrict(matchedDistrict);
            }
            const parts = data.address.split(",");
            if (parts.length > 0) {
              setAddrStreet(parts[0].trim());
            }
          }
        }
      } catch (err) {
        console.warn("Ters konumlandırma hatası:", err);
      }
    }, 400);
  }, []);

  // When camera moves (user drags/pans the map)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCameraChange = useCallback((ev: any) => {
    if (ev.detail && ev.detail.center) {
      const center = ev.detail.center;
      setAddrPin(center);
      reverseGeocode(center.lat, center.lng);
    }
  }, [reverseGeocode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMapClick = useCallback((e: any) => {
    if (e.detail?.latLng) {
      const lat = e.detail.latLng.lat;
      const lng = e.detail.latLng.lng;
      const coords = { lat, lng };
      setAddrPin(coords);
      mapRef.current?.panTo(coords);
      reverseGeocode(lat, lng);
    }
  }, [reverseGeocode]);

  if (authLoading) {
    return (
      <main className="bonj-auth-page">
        <div className="bonj-auth-shell">
          <div className="bonj-auth-loading">Hesabınız yükleniyor…</div>
        </div>
      </main>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <main className="bonj-auth-page">
        <div className="bonj-auth-shell">
          <AuthModal
            inline
            title="Hesabınıza Giriş Yapın"
            subtitle="Profilinize, kayıtlı Gaziantep adreslerinize ve siparişlerinize erişmek için lütfen telefonunuzla giriş yapın."
            onSuccess={() => {
              refreshUser();
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="bonj-portal-page">
      {/* Portal Hero Section (Single unified header across site) */}
      <section className="bonj-portal-hero">
        <div className="bonj-portal-hero-copy">
          <span className="bonj-portal-kicker">MÜŞTERİ PORTALI</span>
          <h1>
            Hesabım, <em>{user.fullName ? user.fullName.split(" ")[0] : "Değerli Müşterimiz"}</em>
          </h1>
          <p>Kayıtlı Gaziantep adreslerinizi, geçmiş siparişlerinizi ve iletişim bilgilerinizi buradan yönetebilirsiniz.</p>
        </div>

        <div className="bonj-portal-user-card">
          <div className="bonj-portal-user-info">
            <div className="bonj-portal-avatar">
              <UiIcon name="user" />
            </div>
            <div>
              <strong className="bonj-portal-name">{user.fullName || "Müşterimiz"}</strong>
              <span className="bonj-portal-phone">0{user.phone}</span>
            </div>
          </div>
          <button
            type="button"
            className="bonj-portal-logout-btn"
            onClick={() => {
              logout();
              router.push("/");
            }}
            title="Oturumu Kapat"
          >
            <UiIcon name="logout" /> Çıkış Yap
          </button>
        </div>
      </section>

      {/* Navigation Tabs (Zero emojis) */}
      <nav className="bonj-portal-tabs" aria-label="Hesap bölümleri">
        <button
          type="button"
          className={activeTab === "profile" ? "is-active" : ""}
          onClick={() => setActiveTab("profile")}
        >
          <UiIcon name="user" /> Profilim
        </button>
        <button
          type="button"
          className={activeTab === "addresses" ? "is-active" : ""}
          onClick={() => setActiveTab("addresses")}
        >
          <UiIcon name="pin" /> Adreslerim
        </button>
        <button
          type="button"
          className={activeTab === "orders" ? "is-active" : ""}
          onClick={() => setActiveTab("orders")}
        >
          <UiIcon name="bag" /> Siparişlerim
        </button>
      </nav>

      {/* Main Content Area */}
      <div className="bonj-portal-content">
        {/* TAB 1: PROFİLİM */}
        {activeTab === "profile" && (
          <section className="bonj-portal-section">
            <div className="bonj-section-head">
              <h2>Profil Bilgilerim</h2>
              <p>İletişim ve teslimat bilgilerinizin güncel olduğundan emin olun.</p>
            </div>

            {profileMsg && (
              <div className={`bonj-portal-alert ${profileMsg.type}`}>
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleProfileSave} className="bonj-profile-form">
              <label className="bonj-input-group">
                <span>Adınız Soyadınız</span>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Ad Soyad"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
              </label>

              <label className="bonj-input-group">
                <span>E-posta Adresiniz</span>
                <input
                  type="email"
                  maxLength={180}
                  placeholder="ornek@alanadi.com"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                />
              </label>

              <label className="bonj-input-group is-readonly">
                <span>Kayıtlı Telefon Numaranız</span>
                <div className="bonj-readonly-phone">
                  <span>0{user.phone}</span>
                  <small className="bonj-verified-badge">
                    <UiIcon name="check" /> Doğrulandı
                  </small>
                </div>
                <small className="bonj-hint-text">
                  Telefon numaranız şifresiz giriş için kimlik bilginizdir.
                </small>
              </label>

              <button
                type="submit"
                className="bonj-primary-save-btn"
                disabled={profileSaving}
              >
                {profileSaving ? "Kaydediliyor..." : "Bilgilerimi Güncelle"}
              </button>
            </form>
          </section>
        )}

        {/* TAB 2: ADRESLERİM */}
        {activeTab === "addresses" && (
          <section className="bonj-portal-section">
            <div className="bonj-section-head has-action">
              <div>
                <h2>Kayıtlı Adreslerim</h2>
                <p>
                  Siparişlerinizi en hızlı şekilde ulaştırabilmemiz için yalnızca{" "}
                  <strong>Gaziantep</strong> içi adresler kaydedilebilir.
                </p>
              </div>
              <button
                type="button"
                className="bonj-add-addr-btn"
                onClick={openNewAddressModal}
              >
                <UiIcon name="plus" /> Yeni Adres Ekle
              </button>
            </div>

            {loadingAddresses ? (
              <div className="bonj-loading-box">Adresleriniz getiriliyor…</div>
            ) : addresses.length === 0 ? (
              <div className="bonj-empty-box">
                <span className="bonj-empty-icon">
                  <UiIcon name="pin" />
                </span>
                <h3>Henüz kayıtlı bir adresiniz yok</h3>
                <p>
                  Gaziantep içi siparişlerinizi tek tıkla teslim alabilmek için
                  ev veya iş adresinizi haritadan pinleyerek ekleyin.
                </p>
                <button
                  type="button"
                  className="bonj-primary-save-btn"
                  onClick={openNewAddressModal}
                >
                  <UiIcon name="plus" /> İlk Adresinizi Ekleyin
                </button>
              </div>
            ) : (
              <div className="bonj-address-grid">
                {addresses.map((addr) => (
                  <article className="bonj-address-card" key={addr.id}>
                    <div className="bonj-addr-card-header">
                      <div className="bonj-addr-title-wrap">
                        <h3>{addr.title}</h3>
                        {addr.isDefault && (
                          <span className="bonj-default-badge">Varsayılan</span>
                        )}
                      </div>
                      <div className="bonj-addr-actions">
                        <button
                          type="button"
                          onClick={() => openEditAddressModal(addr)}
                          aria-label="Düzenle"
                          title="Düzenle"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="is-delete"
                          aria-label="Sil"
                          title="Sil"
                        >
                          Sil
                        </button>
                      </div>
                    </div>

                    <div className="bonj-addr-card-body">
                      <p className="bonj-addr-recipient">
                        <strong>{addr.fullName}</strong> — <span>{addr.phone}</span>
                      </p>
                      <p className="bonj-addr-city-line">
                        <strong>{addr.district}</strong> / Gaziantep
                      </p>
                      <p className="bonj-addr-street-line">{addr.street}</p>
                      <p className="bonj-addr-detail-line">{addr.addressLine}</p>
                      {addr.lat && addr.lng && (
                        <div className="bonj-addr-pin-badge">
                          <UiIcon name="pin" /> Harita Konumu Kayıtlı ({parseFloat(addr.lat).toFixed(4)}, {parseFloat(addr.lng).toFixed(4)})
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: SİPARİŞLERİM */}
        {activeTab === "orders" && (
          <section className="bonj-portal-section">
            <div className="bonj-section-head">
              <h2>Geçmiş Siparişlerim</h2>
              <p>Bonj Cake Story üzerinden verdiğiniz tüm siparişlerin durumunu ve detaylarını inceleyin.</p>
            </div>

            {loadingOrders ? (
              <div className="bonj-loading-box">Siparişleriniz yükleniyor…</div>
            ) : orders.length === 0 ? (
              <div className="bonj-empty-box">
                <span className="bonj-empty-icon">
                  <UiIcon name="bag" />
                </span>
                <h3>Henüz bir siparişiniz bulunmuyor</h3>
                <p>Enfes cheesecake, tatlı ve brunch lezzetlerimizi keşfetmek için menüyü inceleyin.</p>
                <Link href="/menu" className="bonj-primary-save-btn">
                  Menüyü İncele <UiIcon name="arrow-right" />
                </Link>
              </div>
            ) : (
              <div className="bonj-orders-list">
                {orders.map((ord) => {
                  const badge = orderStatusBadge(ord.status);
                  return (
                    <article className="bonj-order-card" key={ord.id}>
                      <div className="bonj-order-card-header">
                        <div>
                          <span className="bonj-order-num">{ord.orderNumber}</span>
                          <span className="bonj-order-date">{formatDate(ord.createdAt)}</span>
                        </div>
                        <div className="bonj-order-badge-row">
                          <span className={`bonj-order-status ${badge.className}`}>
                            <span className="bonj-status-dot" /> {badge.label}
                          </span>
                          <strong className="bonj-order-total">
                            {formatMoney(ord.totalInKurus)}
                          </strong>
                        </div>
                      </div>

                      <div className="bonj-order-card-meta">
                        <span className="bonj-order-fulfillment">
                          {ord.fulfillmentType === "delivery" ? (
                            <><UiIcon name="pin" /> Adrese Teslimat (Gaziantep)</>
                          ) : ord.fulfillmentType === "pickup" ? (
                            <><UiIcon name="bag" /> Gel-Al Siparişi</>
                          ) : (
                            <><UiIcon name="building" /> Masa {ord.tableNumber || ""}</>
                          )}
                        </span>
                        {ord.address && (
                          <p className="bonj-order-address-snippet">
                            <UiIcon name="pin" /> {ord.address}
                          </p>
                        )}
                      </div>

                      <div className="bonj-order-items-table">
                        {ord.items.map((item) => (
                          <div className="bonj-order-item-row" key={item.id}>
                            <span className="bonj-order-item-qty">{item.quantity}x</span>
                            <span className="bonj-order-item-name">{item.productName}</span>
                            <span className="bonj-order-item-price">
                              {formatMoney(item.lineTotalInKurus)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="bonj-order-card-footer">
                        <a href="tel:+905076447985" className="bonj-order-call-btn">
                          <UiIcon name="phone" />
                          <span>bonj’u Ara · 0507 644 79 85</span>
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* NEW / EDIT ADDRESS MODAL */}
      {isAddressModalOpen && (
        <div
          className="bonj-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddressModalOpen(false);
          }}
        >
          <div className="bonj-address-modal-card">
            <button
              type="button"
              className="bonj-auth-close"
              onClick={() => setIsAddressModalOpen(false)}
            >
              <UiIcon name="close" />
            </button>

            <div className="bonj-address-modal-header">
              <span className="bonj-auth-kicker">Gaziantep Teslimat Adresi</span>
              <h3>{editingAddressId ? "Adresi Düzenle" : "Yeni Gaziantep Adresi Ekle"}</h3>
              <p>Haritadan tam konumunuzu pinleyip açık adres bilgilerinizi girin.</p>
            </div>

            {addrError && <div className="bonj-auth-error">{addrError}</div>}

            <form onSubmit={handleSaveAddress} className="bonj-address-form">
              <div className="bonj-form-row">
                <label className="bonj-input-group">
                  <span>Adres Başlığı *</span>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Evim, Ofis, İş Yeri"
                    value={addrTitle}
                    onChange={(e) => setAddrTitle(e.target.value)}
                  />
                </label>

                <label className="bonj-input-group">
                  <span>Teslim Alacak Ad Soyad *</span>
                  <input
                    type="text"
                    required
                    placeholder="Adınız Soyadınız"
                    value={addrFullName}
                    onChange={(e) => setAddrFullName(e.target.value)}
                  />
                </label>
              </div>

              <div className="bonj-form-row">
                <label className="bonj-input-group">
                  <span>İletişim Telefonu *</span>
                  <input
                    type="tel"
                    required
                    placeholder="05XX XXX XX XX"
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                  />
                </label>

                <label className="bonj-input-group">
                  <span>Şehir (Kilitli / Sabit)</span>
                  <div className="is-locked-city-wrap">
                    <UiIcon name="lock" />
                    <span>Gaziantep</span>
                  </div>
                  <small className="bonj-hint-text">Yalnızca Gaziantep içi teslimat hizmeti verilmektedir.</small>
                </label>
              </div>

              <div className="bonj-form-row">
                <label className="bonj-input-group">
                  <span>İlçe *</span>
                  <select
                    value={addrDistrict}
                    onChange={(e) => setAddrDistrict(e.target.value)}
                    required
                  >
                    {GAZIANTEP_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bonj-input-group">
                  <span>Sokak / Cadde *</span>
                  <input
                    type="text"
                    required
                    placeholder="Örn: İncilipınar Mah. Muammer Aksoy Blv."
                    value={addrStreet}
                    onChange={(e) => setAddrStreet(e.target.value)}
                  />
                </label>
              </div>

              <label className="bonj-input-group">
                <span>Bina No, Daire, Kat ve Açık Adres Tarifi *</span>
                <textarea
                  rows={2}
                  required
                  placeholder="Bina No, Kat, Daire, Varsa site adı veya kapı tarifi..."
                  value={addrLine}
                  onChange={(e) => setAddrLine(e.target.value)}
                />
              </label>

              {/* Interactive Google Map Pin Picker */}
              <div className="bonj-map-picker-group">
                <div className="bonj-map-picker-header">
                  <div className="bonj-map-picker-header-title">
                    <span><UiIcon name="pin" /> Harita Üzerinden Konum Pinleyin</span>
                    {addrPin && (
                      <small>
                        ({addrPin.lat.toFixed(5)}, {addrPin.lng.toFixed(5)})
                      </small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="bonj-detect-location-btn"
                    onClick={() => requestUserLocation(false)}
                    disabled={isLocating}
                    title="Mevcut GPS konumunuzu bulun ve haritayı ortalayın"
                  >
                    <UiIcon name="pin" />
                    <span>{isLocating ? "Konum Alınıyor…" : "Mevcut Konumumu Bul"}</span>
                  </button>
                </div>

                {mapsApiKey ? (
                  <div className="bonj-modal-map-wrap">
                    {isLocating && (
                      <div className="bonj-map-locating-overlay">
                        <span className="bonj-locating-spinner" />
                        <span>Mevcut GPS konumunuz tespit ediliyor…</span>
                      </div>
                    )}
                    <APIProvider apiKey={mapsApiKey}>
                      <Map
                        defaultCenter={addrPin || GAZIANTEP_CENTER}
                        defaultZoom={16}
                        onCameraChanged={handleCameraChange}
                        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined}
                        onClick={handleMapClick}
                        disableDefaultUI={false}
                        gestureHandling="greedy"
                      >
                        <MapController onReady={onMapReady} />
                      </Map>
                    </APIProvider>

                    {/* Center Pin Indicator for map drag */}
                    <div className="bonj-map-center-pin-wrap" aria-hidden="true">
                      <div className="bonj-map-center-pin">
                        <UiIcon name="pin" />
                      </div>
                      <div className="bonj-map-center-pulse" />
                    </div>
                  </div>
                ) : (
                  <div className="bonj-map-missing-key">
                    Harita servisi yapılandırılamadı.
                  </div>
                )}
                <small className="bonj-hint-text">
                  Kuryemizin adresinizi kolayca bulabilmesi için haritayı sürükleyerek veya haritaya tıklayarak bina girişinizi ortadaki pine hizalayın.
                </small>
              </div>

              <label className="bonj-checkbox-label">
                <input
                  type="checkbox"
                  checked={addrIsDefault}
                  onChange={(e) => setAddrIsDefault(e.target.checked)}
                />
                <span>Bu adresi varsayılan teslimat adresim yap</span>
              </label>

              <div className="bonj-modal-footer">
                <button
                  type="button"
                  className="bonj-cancel-btn"
                  onClick={() => setIsAddressModalOpen(false)}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="bonj-primary-save-btn"
                  disabled={addrSaving}
                >
                  {addrSaving ? "Kaydediliyor..." : "Adresi Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
