"use client";

import { useMemo, useState } from "react";
import { UiIcon } from "../components/UiIcon";

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ApiAuth = "public" | "session" | "cron" | "jwt";

type ApiEndpoint = {
  id: string;
  section: string;
  method: ApiMethod;
  path: string;
  title: string;
  description: string;
  auth: ApiAuth;
  query?: string[];
  body?: unknown;
  response?: unknown;
  contentType?: "json" | "multipart";
  responseType?: "json" | "binary";
  note?: string;
};

const sections = [
  { id: "auth", label: "Kimlik", short: "Oturum" },
  { id: "menu", label: "Menü & Kategori", short: "Ürün" },
  { id: "orders", label: "Siparişler", short: "Sipariş" },
  { id: "inbox", label: "Mesaj & Catering", short: "Formlar" },
  { id: "users", label: "Kullanıcılar", short: "Erişim" },
  { id: "notifications", label: "Bildirim & SMS", short: "SMS" },
  { id: "analytics", label: "Analitik & Sistem", short: "Sistem" },
] as const;

const authLabels: Record<ApiAuth, string> = {
  public: "Açık",
  session: "Admin oturumu",
  cron: "Bearer CRON_SECRET",
  jwt: "Cerilas JWT",
};

const endpoints: ApiEndpoint[] = [
  {
    id: "admin-login",
    section: "auth",
    method: "POST",
    path: "/api/admin/login",
    title: "Admin girişi",
    description: "E-posta ve parola ile 7 gün geçerli, HttpOnly admin oturumu oluşturur.",
    auth: "public",
    contentType: "json",
    body: { email: "admin@bonj.com", password: "********" },
    response: { ok: true },
    note: "Mobil istemci Set-Cookie ile dönen bonj_admin_session çerezini saklamalı ve sonraki admin isteklerinde göndermelidir.",
  },
  {
    id: "admin-logout",
    section: "auth",
    method: "POST",
    path: "/api/admin/logout",
    title: "Admin çıkışı",
    description: "Aktif oturumu veritabanından ve istemci çerezinden kaldırır.",
    auth: "session",
    contentType: "json",
    body: {},
    response: { ok: true },
  },
  {
    id: "public-menu",
    section: "menu",
    method: "GET",
    path: "/api/menu",
    title: "Canlı menüyü listele",
    description: "Aktif kategori ve aktif ürünleri mobil uygulama için sıralı olarak döndürür.",
    auth: "public",
    response: { items: [{ id: 1, name: "San Sebastian", categoryName: "Cheesecake", priceInKurus: 24500, imageUrl: "/api/menu/images/1?v=..." }], source: "database" },
  },
  {
    id: "public-product-image",
    section: "menu",
    method: "GET",
    path: "/api/menu/images/:id",
    title: "Ürün görselini getir",
    description: "Ürünün JPG, PNG veya WebP görsel verisini uzun süreli cache başlıklarıyla döndürür.",
    auth: "public",
    responseType: "binary",
    note: "Menü cevabındaki imageUrl alanını doğrudan kullanın; :id ürün kimliğidir.",
  },
  {
    id: "public-category-image",
    section: "menu",
    method: "GET",
    path: "/api/menu/category-images/:id",
    title: "Kategori görselini getir",
    description: "Kategoriye ait görsel verisini döndürür.",
    auth: "public",
    responseType: "binary",
  },
  {
    id: "admin-products-list",
    section: "menu",
    method: "GET",
    path: "/api/admin/products",
    title: "Ürünleri listele",
    description: "Aktif/pasif filtreli, aramalı ve sayfalı yönetim listesi döndürür.",
    auth: "session",
    query: ["page: 1…n", "pageSize: 1…50", "query: ürün adı araması", "status: all | active | passive"],
    response: { products: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }, summary: { total: 0, active: 0, passive: 0 } },
  },
  {
    id: "admin-product-create",
    section: "menu",
    method: "POST",
    path: "/api/admin/products",
    title: "Ürün ekle",
    description: "Yeni ürün oluşturur ve sıralamanın sonuna ekler. Fiyat kuruş cinsindedir.",
    auth: "session",
    contentType: "json",
    body: { categoryId: 1, name: "Yeni ürün", shortDescription: "Kısa açıklama", longDescription: "Uzun açıklama", allergenInfo: "Süt, gluten", estimatedCalories: 420, imageAlt: "Ürün görseli", priceInKurus: 24500, badge: "Yeni", accent: "cream", isFeatured: true, isActive: true },
    response: { ok: true, id: 42 },
  },
  {
    id: "admin-product-update",
    section: "menu",
    method: "PATCH",
    path: "/api/admin/products/:id",
    title: "Ürünü düzenle",
    description: "Ürün metinlerini, fiyatını, kategorisini, temasını ve aktiflik durumunu günceller.",
    auth: "session",
    contentType: "json",
    body: { categoryId: 1, name: "San Sebastian", shortDescription: "Kısa açıklama", longDescription: "Uzun açıklama", allergenInfo: "Süt, yumurta", estimatedCalories: 480, imageAlt: "San Sebastian cheesecake", priceInKurus: 24500, badge: "İmza", accent: "cream", isFeatured: true, isActive: true },
    response: { ok: true },
    note: "Kalıcı ürün silme yerine isActive: false ile ürün menüden güvenli biçimde kaldırılır.",
  },
  {
    id: "admin-product-image-upload",
    section: "menu",
    method: "POST",
    path: "/api/admin/products/:id/image",
    title: "Ürün görseli yükle",
    description: "Ürün görselini PostgreSQL içerisinde saklar veya mevcut görseli değiştirir.",
    auth: "session",
    contentType: "multipart",
    response: { ok: true },
    note: "FormData alanı image olmalıdır. JPG, PNG ve WebP kabul edilir; üst sınır 5 MB.",
  },
  {
    id: "admin-product-image-delete",
    section: "menu",
    method: "DELETE",
    path: "/api/admin/products/:id/image",
    title: "Ürün görselini sil",
    description: "Ürüne bağlı görsel kaydını kalıcı olarak kaldırır.",
    auth: "session",
    response: { ok: true },
  },
  {
    id: "admin-categories-list",
    section: "menu",
    method: "GET",
    path: "/api/admin/categories",
    title: "Kategorileri listele",
    description: "Tüm aktif ve pasif kategorileri ürün adetleriyle döndürür.",
    auth: "session",
    response: { categories: [] },
  },
  {
    id: "admin-category-create",
    section: "menu",
    method: "POST",
    path: "/api/admin/categories",
    title: "Kategori ekle",
    description: "Slug ve varsayılan sıra bilgisi otomatik hesaplanan yeni kategori oluşturur.",
    auth: "session",
    contentType: "json",
    body: { name: "Cheesecake", description: "Günlük hazırlanan tatlılar", imageAlt: "Cheesecake kategorisi", sortOrder: 1, isActive: true },
    response: { ok: true, id: 7 },
  },
  {
    id: "admin-category-update",
    section: "menu",
    method: "PATCH",
    path: "/api/admin/categories/:id",
    title: "Kategoriyi düzenle",
    description: "Kategori adı, açıklama, görsel alt metni, sıra ve aktiflik bilgisini günceller.",
    auth: "session",
    contentType: "json",
    body: { name: "Cheesecake", description: "Günlük hazırlanan tatlılar", imageAlt: "Cheesecake kategorisi", sortOrder: 1, isActive: true },
    response: { ok: true },
  },
  {
    id: "admin-category-delete",
    section: "menu",
    method: "DELETE",
    path: "/api/admin/categories/:id",
    title: "Kategoriyi sil",
    description: "İçinde ürün bulunmayan kategoriyi kalıcı olarak kaldırır.",
    auth: "session",
    response: { ok: true },
    note: "Kategori içinde ürün varsa API 409 döndürür; önce ürünleri başka kategoriye taşıyın.",
  },
  {
    id: "admin-category-image-upload",
    section: "menu",
    method: "POST",
    path: "/api/admin/categories/:id/image",
    title: "Kategori görseli yükle",
    description: "Kategori görselini yükler veya mevcut görseli değiştirir.",
    auth: "session",
    contentType: "multipart",
    response: { ok: true },
    note: "FormData alanı image olmalıdır. JPG, PNG ve WebP kabul edilir; üst sınır 5 MB.",
  },
  {
    id: "admin-category-image-delete",
    section: "menu",
    method: "DELETE",
    path: "/api/admin/categories/:id/image",
    title: "Kategori görselini sil",
    description: "Kategoriye bağlı görsel kaydını kaldırır.",
    auth: "session",
    response: { ok: true },
  },
  {
    id: "order-create",
    section: "orders",
    method: "POST",
    path: "/api/orders",
    title: "Sipariş al",
    description: "Masa veya gel-al siparişi oluşturur; fiyatı sunucudaki güncel ürünlerden hesaplar ve SMS bildirimini tetikler.",
    auth: "public",
    contentType: "json",
    body: { customerName: "Deniz Yılmaz", phone: "05071234567", fulfillmentType: "table", tableNumber: "12", pickupAt: null, note: "Şekersiz olsun", items: [{ menuItemId: 1, quantity: 2 }] },
    response: { ok: true, orderNumber: "BONJ-200726-A1B2C3", totalInKurus: 49000 },
    note: "fulfillmentType table veya pickup olabilir. Pickup için pickupAt ISO tarih olmalı; en erken 10 dakika, en geç 30 gün sonrası kabul edilir.",
  },
  {
    id: "admin-orders-list",
    section: "orders",
    method: "GET",
    path: "/api/admin/orders",
    title: "Siparişleri görüntüle",
    description: "Siparişleri ürün satırlarıyla birlikte sayfalı olarak döndürür.",
    auth: "session",
    query: ["page: 1…n", "status: all | new | accepted | preparing | ready | completed | cancelled"],
    response: { orders: [{ id: 12, orderNumber: "BONJ-...", items: [] }], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }, summary: { total: 1, new: 1, active: 0 } },
  },
  {
    id: "admin-order-update",
    section: "orders",
    method: "PATCH",
    path: "/api/admin/orders/:id",
    title: "Sipariş durumunu değiştir",
    description: "Siparişi kabul, hazırlık, hazır, tamamlandı veya iptal akışında ilerletir.",
    auth: "session",
    contentType: "json",
    body: { status: "preparing" },
    response: { ok: true },
  },
  {
    id: "admin-order-delete",
    section: "orders",
    method: "DELETE",
    path: "/api/admin/orders/:id",
    title: "Siparişi sil",
    description: "Siparişi ve ona bağlı ürün satırlarını kalıcı olarak siler.",
    auth: "session",
    response: { ok: true },
    note: "Bu işlem geri alınamaz. Mobil uygulamada ikinci bir kullanıcı onayı gösterin.",
  },
  {
    id: "contact-create",
    section: "inbox",
    method: "POST",
    path: "/api/contact",
    title: "İletişim mesajı gönder",
    description: "İş birliği, soru, öneri veya şikâyet mesajını kaydeder ve admin bildirimini tetikler.",
    auth: "public",
    contentType: "json",
    body: { topic: "collaboration", fullName: "Deniz Yılmaz", email: "deniz@example.com", phone: "05071234567", company: "Cerilas", message: "En az yirmi karakterlik mesaj içeriği.", consent: true, website: "" },
    response: { ok: true, reference: "BONJ-00042" },
    note: "topic: collaboration | question | suggestion | complaint. website alanı bot tuzağıdır ve boş bırakılmalıdır.",
  },
  {
    id: "admin-messages-list",
    section: "inbox",
    method: "GET",
    path: "/api/admin/messages",
    title: "İletişim mesajlarını listele",
    description: "Mesajları durum filtresi ve sayfalama ile döndürür.",
    auth: "session",
    query: ["page: 1…n", "status: all | new | read | resolved"],
    response: { messages: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }, summary: { total: 0, new: 0, resolved: 0 } },
  },
  {
    id: "admin-message-update",
    section: "inbox",
    method: "PATCH",
    path: "/api/admin/messages/:id",
    title: "Mesaj durumunu değiştir",
    description: "Mesajı yeni, okundu veya çözüldü olarak işaretler.",
    auth: "session",
    contentType: "json",
    body: { status: "resolved" },
    response: { ok: true },
  },
  {
    id: "admin-message-delete",
    section: "inbox",
    method: "DELETE",
    path: "/api/admin/messages/:id",
    title: "Mesajı sil",
    description: "İletişim mesajını kalıcı olarak siler.",
    auth: "session",
    response: { ok: true },
  },
  {
    id: "catering-create",
    section: "inbox",
    method: "POST",
    path: "/api/catering",
    title: "Catering talebi oluştur",
    description: "Organizasyon ön görüşme formunu kaydeder ve catering SMS bildirimini tetikler.",
    auth: "public",
    contentType: "json",
    body: { eventType: "engagement", fullName: "Deniz Yılmaz", phone: "05071234567", email: "deniz@example.com", company: "", eventDate: "2026-09-20", eventTime: "19:30", guestCount: 120, venueName: "Riva", venueAddress: "Şehitkamil / Gaziantep", venueSetting: "indoor", serviceStyle: "buffet", menuInterests: ["dessert-table", "coffee"], dietaryNeeds: "", budgetRange: "750-1000", preferredContact: "whatsapp", notes: "", consent: true, website: "" },
    response: { ok: true, reference: "BONJ-CAT-ABC123" },
  },
  {
    id: "admin-catering-list",
    section: "inbox",
    method: "GET",
    path: "/api/admin/catering",
    title: "Catering taleplerini listele",
    description: "Talepleri durum filtresi ve sayfalama ile döndürür.",
    auth: "session",
    query: ["page: 1…n", "status: all | new | contacted | quoted | confirmed | completed | declined"],
    response: { requests: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }, summary: { total: 0, new: 0, active: 0 } },
  },
  {
    id: "admin-catering-update",
    section: "inbox",
    method: "PATCH",
    path: "/api/admin/catering/:id",
    title: "Catering durumunu değiştir",
    description: "Talebi iletişime geçildi, teklif, onay, tamamlandı veya reddedildi durumuna taşır.",
    auth: "session",
    contentType: "json",
    body: { status: "quoted" },
    response: { ok: true },
  },
  {
    id: "admin-catering-delete",
    section: "inbox",
    method: "DELETE",
    path: "/api/admin/catering/:id",
    title: "Catering talebini sil",
    description: "Catering talebini kalıcı olarak kaldırır.",
    auth: "session",
    response: { ok: true },
  },
  {
    id: "admin-users-list",
    section: "users",
    method: "GET",
    path: "/api/admin/users",
    title: "Admin kullanıcılarını listele",
    description: "Panel erişimi olan kullanıcıları ve aktif kullanıcının kimliğini döndürür.",
    auth: "session",
    response: { users: [], currentUserId: 1 },
  },
  {
    id: "admin-user-create",
    section: "users",
    method: "POST",
    path: "/api/admin/users",
    title: "Admin kullanıcısı ekle",
    description: "Hashlenmiş parola ile yeni panel kullanıcısı oluşturur.",
    auth: "session",
    contentType: "json",
    body: { name: "Yeni Yönetici", email: "yonetici@example.com", phone: "05071234567", password: "guclu-parola", isActive: true },
    response: { ok: true, id: 5 },
  },
  {
    id: "admin-user-update",
    section: "users",
    method: "PATCH",
    path: "/api/admin/users/:id",
    title: "Admin kullanıcısını düzenle",
    description: "İsim, e-posta, telefon, aktiflik ve isteğe bağlı parola bilgisini günceller.",
    auth: "session",
    contentType: "json",
    body: { name: "Yeni Yönetici", email: "yonetici@example.com", phone: "05071234567", password: "", isActive: true },
    response: { ok: true, signedOut: false },
  },
  {
    id: "admin-user-delete",
    section: "users",
    method: "DELETE",
    path: "/api/admin/users/:id",
    title: "Admin kullanıcısını sil",
    description: "Kullanıcıyı ve aktif oturumlarını kaldırır.",
    auth: "session",
    response: { ok: true },
    note: "Kullanıcı kendi hesabını ve sistemdeki son aktif yönetici hesabını silemez.",
  },
  {
    id: "admin-user-access-sms",
    section: "users",
    method: "POST",
    path: "/api/admin/users/:id/access-sms",
    title: "Giriş bilgilerini SMS ile gönder",
    description: "Geçici parola üretir, kullanıcı parolasını yeniler ve panel URL’siyle SMS gönderir.",
    auth: "session",
    response: { ok: true, signedOut: false, message: "Giriş bilgileri gönderildi." },
    note: "Kullanıcı aktif ve telefon numarası kayıtlı olmalıdır. Aynı kullanıcı için 30 saniye bekleme süresi vardır.",
  },
  {
    id: "notification-settings-get",
    section: "notifications",
    method: "GET",
    path: "/api/admin/notification-settings",
    title: "Bildirim ayarlarını getir",
    description: "Sipariş, iletişim, catering ve günlük özet alıcı numaralarını döndürür.",
    auth: "session",
    response: { settings: { orders: [], contact: [], catering: [], dailySummary: [] } },
  },
  {
    id: "notification-settings-save",
    section: "notifications",
    method: "PUT",
    path: "/api/admin/notification-settings",
    title: "Bildirim ayarlarını kaydet",
    description: "Her bildirim türü için en fazla 10 benzersiz telefon numarası kaydeder.",
    auth: "session",
    contentType: "json",
    body: { settings: { orders: ["05071234567"], contact: ["05071234567"], catering: ["05071234567"], dailySummary: ["05071234567"] } },
    response: { ok: true, settings: {} },
  },
  {
    id: "notification-test",
    section: "notifications",
    method: "POST",
    path: "/api/admin/notification-settings",
    title: "Test bildirimi gönder",
    description: "Seçilen bildirim türü için verilen telefona kısa bağlantılı test SMS’i yollar.",
    auth: "session",
    contentType: "json",
    body: { type: "orders", phone: "05071234567" },
    response: { ok: true, message: "Test SMS’i gönderildi." },
    note: "type: orders | contact | catering | dailySummary.",
  },
  {
    id: "admin-sms-send",
    section: "notifications",
    method: "POST",
    path: "/api/admin/sms/send",
    title: "SMS gönder",
    description: "Cerilas servis hesabını mobil uygulamaya açmadan, admin oturumuyla güvenli SMS gönderir.",
    auth: "session",
    contentType: "json",
    body: { phone: "05071234567", message: "Gönderilecek mesaj metni" },
    response: { ok: true, message: "SMS gönderildi." },
    note: "Mobil uygulamada kullanılması önerilen endpoint budur. Aynı numaraya yönetici başına dakikada en fazla 5 SMS gönderilebilir.",
  },
  {
    id: "cerilas-login",
    section: "notifications",
    method: "POST",
    path: "https://www.cerilas.com/api/auth/login",
    title: "Cerilas SMS JWT al",
    description: "Cerilas SMS servisi için JWT üretir. Yalnızca güvenli sunucu katmanından çağrılmalıdır.",
    auth: "public",
    contentType: "json",
    body: { email: "SMS_SERVICE_EMAIL", password: "SMS_SERVICE_PASSWORD" },
    response: { token: "JWT_TOKEN" },
    note: "Cerilas kullanıcı bilgilerini mobil uygulama paketine kesinlikle gömmeyin.",
  },
  {
    id: "cerilas-send",
    section: "notifications",
    method: "POST",
    path: "https://www.cerilas.com/api/sms/send",
    title: "SMS gönder",
    description: "Cerilas/Netgsm üzerinden hedef numaraya SMS gönderir.",
    auth: "jwt",
    contentType: "json",
    body: { msg: "Gönderilecek mesaj metni", no: "5071234567" },
    response: { ok: true },
    note: "Telefon numarası başında 0 olmadan gönderilir. Authorization: Bearer JWT_TOKEN zorunludur.",
  },
  {
    id: "analytics-track",
    section: "analytics",
    method: "POST",
    path: "/api/analytics/track",
    title: "Ziyaret olayı kaydet",
    description: "Sayfa görüntüleme, heartbeat ve çıkış olaylarını ziyaretçi/oturum kimlikleriyle kaydeder.",
    auth: "public",
    contentType: "json",
    body: { event: "pageview", visitorId: "UUID", sessionId: "UUID", viewId: "UUID", path: "/menu", title: "Bonj Cake Story: Menü", referrer: "", pageDurationSeconds: 0, sessionDurationSeconds: 0 },
    response: { ok: true },
    note: "event: pageview | heartbeat | leave. Kimlik alanları geçerli UUID olmalıdır; bot trafiği kaydedilmez.",
  },
  {
    id: "admin-analytics",
    section: "analytics",
    method: "GET",
    path: "/api/admin/analytics",
    title: "İstatistikleri getir",
    description: "Ziyaret, tekil ziyaretçi, süre, konum, sayfalar, sipariş ve form metriklerini döndürür.",
    auth: "session",
    query: ["period: today | 3d | 7d | 30d | 90d"],
    response: { period: "30d", totals: {}, timeline: [], locations: [], pages: [] },
  },
  {
    id: "daily-summary",
    section: "analytics",
    method: "POST",
    path: "/api/cron/daily-summary",
    title: "Günlük özeti gönder",
    description: "İstanbul gününe ait sipariş, ciro, mesaj ve catering sayılarını SMS özeti olarak gönderir.",
    auth: "cron",
    response: { ok: true, date: "20.07.2026", summary: { orderCount: 4, revenueInKurus: 125000, messageCount: 2, cateringCount: 1 } },
  },
  {
    id: "health",
    section: "analytics",
    method: "GET",
    path: "/api/health",
    title: "Servis sağlık kontrolü",
    description: "Deploy ve uptime sistemleri için uygulamanın ayakta olduğunu doğrular.",
    auth: "public",
    response: { status: "ok", service: "bonj-cake-story" },
  },
];

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function exampleCode(endpoint: ApiEndpoint, baseUrl: string) {
  const absolute = endpoint.path.startsWith("http")
    ? endpoint.path
    : `${baseUrl}${endpoint.path}`;
  if (endpoint.contentType === "multipart") {
    return `const formData = new FormData();\nformData.append("image", imageFile);\n\nconst response = await fetch("${absolute}", {\n  method: "${endpoint.method}",\n  credentials: "include",\n  body: formData\n});`;
  }

  const options: string[] = [`method: "${endpoint.method}"`];
  if (endpoint.auth === "session" || endpoint.id === "admin-login") options.push(`credentials: "include"`);
  if (endpoint.auth === "cron") options.push(`headers: { Authorization: "Bearer " + CRON_SECRET }`);
  if (endpoint.auth === "jwt") {
    options.push(`headers: {\n    "Content-Type": "application/json",\n    Authorization: "Bearer " + token\n  }`);
  } else if (endpoint.body !== undefined) {
    options.push(`headers: { "Content-Type": "application/json" }`);
  }
  if (endpoint.body !== undefined) {
    options.push(`body: JSON.stringify(${formatJson(endpoint.body)})`);
  }

  const parse = endpoint.responseType === "binary"
    ? "const imageBlob = await response.blob();"
    : "const data = await response.json();";
  return `const response = await fetch("${absolute}", {\n  ${options.join(",\n  ")}\n});\n\n${parse}`;
}

function CopyButton({ value, label = "Kopyala" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button className={copied ? "is-copied" : ""} type="button" onClick={copy}>
      <span aria-hidden="true"><UiIcon name={copied ? "check" : "copy"} /></span>{copied ? "Kopyalandı" : label}
    </button>
  );
}

export function AdminApiDocsPanel({ baseUrl }: { baseUrl: string }) {
  const [activeSection, setActiveSection] = useState("all");
  const [query, setQuery] = useState("");
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    return endpoints.filter((endpoint) => {
      const sectionMatches = activeSection === "all" || endpoint.section === activeSection;
      const queryMatches = !needle || [endpoint.title, endpoint.path, endpoint.description, endpoint.method]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle);
      return sectionMatches && queryMatches;
    });
  }, [activeSection, query]);

  const grouped = sections
    .map((section) => ({ ...section, endpoints: filtered.filter((endpoint) => endpoint.section === section.id) }))
    .filter((section) => section.endpoints.length);

  return (
    <section className="admin-main admin-api-docs" id="api-docs">
      <header className="admin-api-hero">
        <div>
          <span className="admin-eyebrow">MOBİL UYGULAMA / API V1</span>
          <h1>API<br /><em>atlası.</em></h1>
          <p>Bonj mobil uygulaması, yönetim araçları ve entegrasyonlar için yaşayan endpoint rehberi.</p>
        </div>
        <div className="admin-api-summary" aria-label="API özeti">
          <span><strong>{endpoints.length}</strong><small>Endpoint</small></span>
          <span><strong>{endpoints.filter((item) => item.auth === "public").length}</strong><small>Açık servis</small></span>
          <span><strong>v1</strong><small>Aktif sürüm</small></span>
        </div>
      </header>

      <div className="admin-api-base">
        <span aria-hidden="true"><UiIcon name="link" /></span>
        <div><small>BASE URL</small><code>{normalizedBaseUrl}</code></div>
        <CopyButton value={normalizedBaseUrl} />
      </div>

      <div className="admin-api-security">
        <span aria-hidden="true"><UiIcon name="shield" /></span>
        <div>
          <strong>Mobil kimlik doğrulama</strong>
          <p><code>/api/admin/login</code> yanıtındaki HttpOnly oturum çerezini saklayın. Admin çağrılarında cookie jar veya <code>credentials: &quot;include&quot;</code> kullanın. Cerilas SMS parolasını uygulama paketine koymayın.</p>
        </div>
      </div>

      <div className="admin-api-toolbar">
        <label>
          <span aria-hidden="true"><UiIcon name="search" /></span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Endpoint, işlem veya yol ara…" />
        </label>
        <div role="tablist" aria-label="API bölümleri">
          <button className={activeSection === "all" ? "is-active" : ""} type="button" onClick={() => setActiveSection("all")}>Tümü</button>
          {sections.map((section) => (
            <button className={activeSection === section.id ? "is-active" : ""} type="button" key={section.id} onClick={() => setActiveSection(section.id)}>{section.short}</button>
          ))}
        </div>
      </div>

      <div className="admin-api-content">
        <aside aria-label="Sayfa içi API navigasyonu">
          <span>İÇİNDEKİLER</span>
          {grouped.map((section) => <a href={`#api-${section.id}`} key={section.id}><i>{String(section.endpoints.length).padStart(2, "0")}</i>{section.label}</a>)}
        </aside>

        <div className="admin-api-sections">
          {grouped.map((section, sectionIndex) => (
            <section className="admin-api-section" id={`api-${section.id}`} key={section.id}>
              <header>
                <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
                <div><h2>{section.label}</h2><p>{section.endpoints.length} kullanılabilir işlem</p></div>
              </header>

              <div className="admin-api-endpoints">
                {section.endpoints.map((endpoint) => {
                  const code = exampleCode(endpoint, normalizedBaseUrl);
                  return (
                    <details className={`admin-api-endpoint method-${endpoint.method.toLocaleLowerCase("tr-TR")}`} key={endpoint.id}>
                      <summary>
                        <span className="admin-api-method">{endpoint.method}</span>
                        <code>{endpoint.path}</code>
                        <div><strong>{endpoint.title}</strong><small>{endpoint.description}</small></div>
                        <span className={`admin-api-auth auth-${endpoint.auth}`}>{authLabels[endpoint.auth]}</span>
                        <i aria-hidden="true"><UiIcon name="plus" /></i>
                      </summary>

                      <div className="admin-api-detail">
                        <div className="admin-api-detail-main">
                          {endpoint.query?.length ? (
                            <section><h3>Query parametreleri</h3><ul>{endpoint.query.map((item) => <li key={item}><code>{item}</code></li>)}</ul></section>
                          ) : null}
                          {endpoint.body !== undefined ? (
                            <section><h3>İstek gövdesi</h3><pre><code>{formatJson(endpoint.body)}</code></pre></section>
                          ) : null}
                          {endpoint.note ? <p className="admin-api-note"><span>!</span>{endpoint.note}</p> : null}
                          <section>
                            <div className="admin-api-code-head"><h3>JavaScript örneği</h3><CopyButton value={code} label="Kodu kopyala" /></div>
                            <pre><code>{code}</code></pre>
                          </section>
                        </div>
                        <aside>
                          <span>Başarılı yanıt</span>
                          {endpoint.responseType === "binary"
                            ? <p>Binary image response<br /><code>Content-Type: image/*</code></p>
                            : <pre><code>{formatJson(endpoint.response ?? { ok: true })}</code></pre>}
                          <dl>
                            <div><dt>Yetki</dt><dd>{authLabels[endpoint.auth]}</dd></div>
                            <div><dt>Format</dt><dd>{endpoint.contentType === "multipart" ? "multipart/form-data" : endpoint.responseType === "binary" ? "binary" : "application/json"}</dd></div>
                          </dl>
                        </aside>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          ))}

          {!grouped.length ? <div className="admin-api-empty"><span><UiIcon name="search" /></span><strong>Endpoint bulunamadı.</strong><p>Arama ifadesini değiştirerek tekrar deneyin.</p></div> : null}
        </div>
      </div>
    </section>
  );
}
