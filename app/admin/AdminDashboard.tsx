"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminCategory, AdminProduct, AdminProductPage } from "@/lib/admin-data";
import type { AdminContactMessage, AdminMessagePage } from "@/lib/admin-messages";
import type { AdminOrder, AdminOrderPage } from "@/lib/admin-orders";
import type { AdminCateringPage, AdminCateringRequest } from "@/lib/admin-catering";
import type { AdminNotificationSettings } from "@/lib/admin-notification-settings";
import type { AdminUser } from "@/lib/admin-users";
import { AdminNotificationSettingsPanel } from "./AdminNotificationSettingsPanel";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { AdminAnalyticsPanel } from "./AdminAnalyticsPanel";
import { BrandLogo } from "../components/BrandLogo";

type DropdownOption = {
  value: string;
  label: string;
  tone?: string;
};

type ProductForm = {
  id?: number;
  categoryId: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  allergenInfo: string;
  estimatedCalories: string;
  imageAlt: string;
  price: string;
  badge: string;
  accent: string;
  isFeatured: boolean;
  isActive: boolean;
  imageUrl: string | null;
};

type CategoryForm = {
  id?: number;
  name: string;
  description: string;
  imageAlt: string;
  sortOrder: string;
  isActive: boolean;
  imageUrl: string | null;
};

type MessageStatus = "all" | "new" | "read" | "resolved";
type OrderStatus = "all" | "new" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
type CateringStatus = "all" | "new" | "contacted" | "quoted" | "confirmed" | "completed" | "declined";
export type AdminView = "analytics" | "products" | "categories" | "orders" | "messages" | "catering" | "users" | "notifications";

type AdminConfirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

function AdminDropdown({
  label,
  value,
  options,
  onChange,
  required = false,
  placement = "bottom",
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  required?: boolean;
  placement?: "top" | "bottom";
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  function openMenu() {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function selectOption(option: DropdownOption) {
    onChange(option.value);
    setActiveIndex(options.indexOf(option));
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) openMenu();
      setActiveIndex((current) => {
        if (event.key === "Home") return 0;
        if (event.key === "End") return options.length - 1;
        const direction = event.key === "ArrowDown" ? 1 : -1;
        return (current + direction + options.length) % options.length;
      });
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      selectOption(options[activeIndex]);
    }
  }

  return (
    <div className={`admin-dropdown-field placement-${placement}`}>
      <span className="admin-dropdown-label" id={`${id}-label`}>
        {label}{required && " *"}
      </span>
      <div className={`admin-dropdown ${open ? "is-open" : ""}`} ref={rootRef}>
        <button
          className="admin-dropdown-trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-value`}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={handleKeyDown}
        >
          <span className={!selected ? "is-placeholder" : ""} id={`${id}-value`}>
            {selected?.tone && (
              <i className={`admin-dropdown-swatch tone-${selected.tone}`} aria-hidden="true" />
            )}
            {selected?.label ?? "Seçin"}
          </span>
          <i className="admin-dropdown-chevron" aria-hidden="true" />
        </button>

        <div
          className="admin-dropdown-menu"
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {options.map((option, index) => (
            <button
              className={`${option.value === value ? "is-selected" : ""} ${index === activeIndex ? "is-highlighted" : ""}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              <span>
                {option.tone && (
                  <i className={`admin-dropdown-swatch tone-${option.tone}`} aria-hidden="true" />
                )}
                {option.label}
              </span>
              <i className="admin-dropdown-check" aria-hidden="true">✓</i>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccentPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="admin-accent-picker">
      <legend>Renk teması</legend>
      <div className="admin-accent-options">
        {options.map((option) => (
          <button
            className={option.value === value ? "is-selected" : ""}
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
          >
            <i className={`admin-accent-swatch tone-${option.tone}`} aria-hidden="true" />
            <span>{option.label}</span>
            <small aria-hidden="true">✓</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function money(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

async function readAdminApi<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const error = parsed && typeof parsed === "object" && "error" in parsed
      ? String((parsed as { error: unknown }).error)
      : "Sunucudan geçerli bir yanıt alınamadı. Lütfen tekrar deneyin.";
    throw new Error(error);
  }
  if (!parsed) throw new Error("Sunucu boş yanıt verdi. Lütfen tekrar deneyin.");
  return parsed as T;
}

async function fetchAdminApi(url: string) {
  let response = await fetch(url, { cache: "no-store" });
  if (response.status === 503) {
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    response = await fetch(url, { cache: "no-store" });
  }
  return response;
}

function paginationItems(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((left, right) => left - right);
  const items: Array<number | string> = [];
  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous && page - previous > 1) items.push(`gap-${previous}`);
    items.push(page);
  });
  return items;
}

function messageTopic(topic: string) {
  return {
    collaboration: "İş birliği",
    question: "Soru",
    suggestion: "Öneri",
    complaint: "Şikâyet",
  }[topic] ?? "Mesaj";
}

function messageDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function orderStatusLabel(status: string) {
  return {
    new: "Yeni",
    accepted: "Onaylandı",
    preparing: "Hazırlanıyor",
    ready: "Hazır",
    completed: "Tamamlandı",
    cancelled: "İptal",
  }[status] ?? status;
}

function cateringStatusLabel(status: string) {
  return {
    new: "Yeni",
    contacted: "Görüşüldü",
    quoted: "Teklif verildi",
    confirmed: "Onaylandı",
    completed: "Tamamlandı",
    declined: "Olumsuz",
  }[status] ?? status;
}

function cateringEventLabel(type: string) {
  return {
    "bridal-room": "Gelin Odası",
    engagement: "Söz / Nişan",
    henna: "Kına Gecesi",
    wedding: "Düğün",
    birthday: "Doğum Günü",
    baby: "Baby Shower",
    "corporate-meeting": "Kurumsal Toplantı",
    launch: "Lansman / Açılış",
    workshop: "Workshop / Seminer",
    "public-event": "Festival / Etkinlik",
    "private-event": "Özel Davet",
    other: "Diğer",
  }[type] ?? type;
}

function cateringMenuLabel(value: string) {
  return {
    brunch: "Brunch / kahvaltı",
    savory: "Tuzlu atıştırmalıklar",
    "dessert-table": "Tatlı masası",
    cheesecake: "San Sebastian & cheesecake",
    cake: "Özel gün pastası",
    coffee: "Yeni nesil kahve",
    "cold-drinks": "Soğuk içecekler",
    boxed: "Kişiye özel ikram kutusu",
  }[value] ?? value;
}

function cateringServiceLabel(value: string) {
  return { delivery: "Paketli teslimat", buffet: "Kurulumlu büfe", served: "Yerinde servis", "coffee-bar": "Mobil kahve barı", unsure: "Birlikte karar verilecek" }[value] ?? value;
}

function cateringVenueLabel(value: string) {
  return { indoor: "Kapalı alan", outdoor: "Açık alan", mixed: "Karma alan", unsure: "Henüz belli değil" }[value] ?? value;
}

function cateringBudgetLabel(value: string) {
  return { unsure: "Henüz net değil", "under-500": "Kişi başı 500 ₺ altı", "500-750": "Kişi başı 500–750 ₺", "750-1000": "Kişi başı 750–1.000 ₺", "over-1000": "Kişi başı 1.000 ₺ üzeri" }[value] ?? "Belirtilmedi";
}

function cateringContactLabel(value: string) {
  return { phone: "Telefon", whatsapp: "WhatsApp", email: "E-posta" }[value] ?? value;
}

function emptyForm(categoryId?: number): ProductForm {
  return {
    categoryId: categoryId ? String(categoryId) : "",
    name: "",
    shortDescription: "",
    longDescription: "",
    allergenInfo: "",
    estimatedCalories: "",
    imageAlt: "",
    price: "",
    badge: "",
    accent: "cream",
    isFeatured: false,
    isActive: true,
    imageUrl: null,
  };
}

function formFromProduct(product: AdminProduct): ProductForm {
  return {
    id: product.id,
    categoryId: String(product.categoryId),
    name: product.name,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    allergenInfo: product.allergenInfo,
    estimatedCalories: product.estimatedCalories?.toString() ?? "",
    imageAlt: product.imageAlt,
    price: product.priceInKurus == null ? "" : (product.priceInKurus / 100).toString(),
    badge: product.badge,
    accent: product.accent,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    imageUrl: product.imageUrl,
  };
}

function payloadFromForm(form: ProductForm) {
  const numericPrice = form.price.trim() === "" ? null : Number(form.price.replace(",", "."));
  return {
    categoryId: Number(form.categoryId),
    name: form.name,
    shortDescription: form.shortDescription,
    longDescription: form.longDescription,
    allergenInfo: form.allergenInfo,
    estimatedCalories:
      form.estimatedCalories.trim() === "" ? null : Number(form.estimatedCalories),
    imageAlt: form.imageAlt,
    priceInKurus: numericPrice == null ? null : Math.round(numericPrice * 100),
    badge: form.badge,
    accent: form.accent,
    isFeatured: form.isFeatured,
    isActive: form.isActive,
  };
}

function emptyCategoryForm(sortOrder: number): CategoryForm {
  return {
    name: "",
    description: "",
    imageAlt: "",
    sortOrder: String(sortOrder),
    isActive: true,
    imageUrl: null,
  };
}

function formFromCategory(category: AdminCategory): CategoryForm {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    imageAlt: category.imageAlt,
    sortOrder: String(category.sortOrder),
    isActive: category.isActive,
    imageUrl: category.imageUrl,
  };
}

function payloadFromCategoryForm(form: CategoryForm) {
  return {
    name: form.name,
    description: form.description,
    imageAlt: form.imageAlt,
    sortOrder: Number(form.sortOrder),
    isActive: form.isActive,
  };
}

export function AdminDashboard({
  adminId,
  adminName,
  adminEmail,
  initialProductPage,
  categories: initialCategories,
  initialNotificationSettings,
  dailySummaryCronUrl,
  initialUsers,
  initialView,
  initialSelectedOrder,
  initialSelectedMessage,
  initialSelectedCatering,
}: {
  adminId: number;
  adminName: string;
  adminEmail: string;
  initialProductPage: AdminProductPage;
  categories: AdminCategory[];
  initialNotificationSettings: AdminNotificationSettings;
  dailySummaryCronUrl: string;
  initialUsers: AdminUser[];
  initialView: AdminView;
  initialSelectedOrder: AdminOrder | null;
  initialSelectedMessage: AdminContactMessage | null;
  initialSelectedCatering: AdminCateringRequest | null;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProductPage.products);
  const [productPagination, setProductPagination] = useState(initialProductPage.pagination);
  const [productSummary, setProductSummary] = useState(initialProductPage.summary);
  const [productPage, setProductPage] = useState(initialProductPage.pagination.page);
  const [productsLoading, setProductsLoading] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [activeView, setActiveView] = useState<AdminView>(initialView);
  const [viewTransitioning, setViewTransitioning] = useState(false);
  const viewTransitionTimer = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "passive">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm(categories[0]?.id));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(
    emptyCategoryForm(initialCategories.length + 1),
  );
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [categoryNotice, setCategoryNotice] = useState("");
  const productRequest = useRef<AbortController | null>(null);
  const initialProductLoad = useRef(true);
  const [messageData, setMessageData] = useState<AdminMessagePage>({
    messages: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    summary: { total: 0, new: 0, resolved: 0 },
  });
  const [messageStatus, setMessageStatus] = useState<MessageStatus>("all");
  const [messagePage, setMessagePage] = useState(1);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageLoadError, setMessageLoadError] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<AdminContactMessage | null>(initialSelectedMessage);
  const [orderData, setOrderData] = useState<AdminOrderPage>({
    orders: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    summary: { total: 0, new: 0, active: 0 },
  });
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("all");
  const [orderPage, setOrderPage] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderLoadError, setOrderLoadError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(initialSelectedOrder);
  const [cateringData, setCateringData] = useState<AdminCateringPage>({
    requests: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    summary: { total: 0, new: 0, active: 0 },
  });
  const [cateringStatus, setCateringStatus] = useState<CateringStatus>("all");
  const [cateringPage, setCateringPage] = useState(1);
  const [cateringLoading, setCateringLoading] = useState(false);
  const [cateringLoadError, setCateringLoadError] = useState("");
  const [selectedCatering, setSelectedCatering] = useState<AdminCateringRequest | null>(initialSelectedCatering);
  const [confirmation, setConfirmation] = useState<AdminConfirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");

  const previewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const categoryPreviewUrl = useMemo(
    () => (categoryImageFile ? URL.createObjectURL(categoryImageFile) : null),
    [categoryImageFile],
  );
  useEffect(() => {
    return () => {
      if (categoryPreviewUrl) URL.revokeObjectURL(categoryPreviewUrl);
    };
  }, [categoryPreviewUrl]);

  useEffect(() => {
    if (!qrOpen) return;
    import("qrcode").then(({ default: QRCode }) =>
      QRCode.toDataURL(`${window.location.origin}/menu`, {
        width: 900,
        margin: 2,
        color: { dark: "#120e10", light: "#fbf4e8" },
        errorCorrectionLevel: "H",
      }).then(setQrUrl),
    );
  }, [qrOpen]);

  const loadProducts = useCallback(async () => {
    productRequest.current?.abort();
    const controller = new AbortController();
    productRequest.current = controller;
    setProductsLoading(true);
    const params = new URLSearchParams({
      page: String(productPage),
      pageSize: String(productPagination.pageSize),
      query,
      status,
    });

    try {
      const response = await fetch(`/api/admin/products?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 401) {
        router.refresh();
        return;
      }
      const data = (await response.json()) as AdminProductPage;
      setProducts(data.products);
      setProductPagination(data.pagination);
      setProductSummary(data.summary);
      if (data.pagination.page !== productPage) setProductPage(data.pagination.page);
    } catch (requestError) {
      if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
        setProducts([]);
      }
    } finally {
      if (productRequest.current === controller) setProductsLoading(false);
    }
  }, [productPage, productPagination.pageSize, query, router, status]);

  useEffect(() => {
    if (initialProductLoad.current) {
      initialProductLoad.current = false;
      return;
    }
    const timer = window.setTimeout(() => void loadProducts(), query ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts, query]);

  useEffect(() => () => productRequest.current?.abort(), []);

  useEffect(() => () => {
    if (viewTransitionTimer.current) window.clearTimeout(viewTransitionTimer.current);
  }, []);

  const loadMessages = useCallback(async () => {
    setMessagesLoading(true);
    setMessageLoadError("");
    const params = new URLSearchParams({ page: String(messagePage), status: messageStatus });
    try {
      const response = await fetchAdminApi(`/api/admin/messages?${params}`);
      if (response.status === 401) {
        router.refresh();
        return;
      }
      const data = await readAdminApi<AdminMessagePage>(response);
      setMessageData(data);
      if (data.pagination.page !== messagePage) setMessagePage(data.pagination.page);
    } catch (requestError) {
      setMessageLoadError(requestError instanceof Error ? requestError.message : "Mesajlar yüklenemedi.");
    } finally {
      setMessagesLoading(false);
    }
  }, [messagePage, messageStatus, router]);

  useEffect(() => {
    if (activeView === "messages") void loadMessages();
  }, [activeView, loadMessages]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrderLoadError("");
    const params = new URLSearchParams({ page: String(orderPage), status: orderStatus });
    try {
      const response = await fetchAdminApi(`/api/admin/orders?${params}`);
      if (response.status === 401) {
        router.refresh();
        return;
      }
      const data = await readAdminApi<AdminOrderPage>(response);
      setOrderData(data);
      if (data.pagination.page !== orderPage) setOrderPage(data.pagination.page);
    } catch (requestError) {
      setOrderLoadError(requestError instanceof Error ? requestError.message : "Siparişler yüklenemedi.");
    } finally {
      setOrdersLoading(false);
    }
  }, [orderPage, orderStatus, router]);

  useEffect(() => {
    if (activeView === "orders") void loadOrders();
  }, [activeView, loadOrders]);

  const loadCatering = useCallback(async () => {
    setCateringLoading(true);
    setCateringLoadError("");
    const params = new URLSearchParams({ page: String(cateringPage), status: cateringStatus });
    try {
      const response = await fetchAdminApi(`/api/admin/catering?${params}`);
      if (response.status === 401) {
        router.refresh();
        return;
      }
      const data = await readAdminApi<AdminCateringPage>(response);
      setCateringData(data);
      if (data.pagination.page !== cateringPage) setCateringPage(data.pagination.page);
    } catch (requestError) {
      setCateringLoadError(requestError instanceof Error ? requestError.message : "Catering talepleri yüklenemedi.");
    } finally {
      setCateringLoading(false);
    }
  }, [cateringPage, cateringStatus, router]);

  useEffect(() => {
    if (activeView === "catering") void loadCatering();
  }, [activeView, loadCatering]);

  useEffect(() => {
    if (!selectedMessage && !selectedOrder && !selectedCatering && !confirmation) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmation && !confirming) {
          setConfirmation(null);
          setConfirmationError("");
          return;
        }
        setSelectedMessage(null);
        setSelectedOrder(null);
        setSelectedCatering(null);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedMessage, selectedOrder, selectedCatering, confirmation, confirming]);

  function requestConfirmation(options: AdminConfirmation) {
    setConfirmationError("");
    setConfirmation(options);
  }

  async function acceptConfirmation() {
    if (!confirmation || confirming) return;
    setConfirming(true);
    setConfirmationError("");
    try {
      await confirmation.action();
      setConfirmation(null);
    } catch (confirmationFailure) {
      setConfirmationError(
        confirmationFailure instanceof Error
          ? confirmationFailure.message
          : "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
      );
    } finally {
      setConfirming(false);
    }
  }

  async function refreshProducts() {
    await loadProducts();
  }

  async function refreshCategories() {
    const response = await fetch("/api/admin/categories", { cache: "no-store" });
    if (response.status === 401) {
      router.refresh();
      return;
    }
    const data = (await response.json()) as { categories: AdminCategory[] };
    setCategories(data.categories);
  }

  function openNewProduct() {
    setForm(emptyForm(categories.find((category) => category.isActive)?.id ?? categories[0]?.id));
    setImageFile(null);
    setError("");
    setEditorOpen(true);
  }

  function openProduct(product: AdminProduct) {
    setForm(formFromProduct(product));
    setImageFile(null);
    setError("");
    setEditorOpen(true);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const response = await fetch(
      form.id ? `/api/admin/products/${form.id}` : "/api/admin/products",
      {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm(form)),
      },
    );
    const result = (await response.json()) as { id?: number; error?: string };
    if (!response.ok) {
      setError(result.error ?? "Ürün kaydedilemedi.");
      setSaving(false);
      return;
    }

    const productId = form.id ?? result.id;
    if (imageFile && productId) {
      const imageData = new FormData();
      imageData.append("image", imageFile);
      const imageResponse = await fetch(`/api/admin/products/${productId}/image`, {
        method: "POST",
        body: imageData,
      });
      const imageResult = (await imageResponse.json()) as { error?: string };
      if (!imageResponse.ok) {
        setError(imageResult.error ?? "Görsel yüklenemedi.");
        setSaving(false);
        return;
      }
    }

    await refreshProducts();
    setSaving(false);
    setEditorOpen(false);
    router.refresh();
  }

  async function toggleProduct(product: AdminProduct) {
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payloadFromForm(formFromProduct(product)),
        isActive: !product.isActive,
      }),
    });
    if (response.ok) await refreshProducts();
  }

  function removeImage() {
    if (!form.id || !form.imageUrl) return;
    const productId = form.id;
    requestConfirmation({
      title: "Ürün görseli kaldırılsın mı?",
      description: "Mevcut görsel ürün kartından kaldırılacak. Daha sonra yeni bir görsel yükleyebilirsin.",
      confirmLabel: "Görseli kaldır",
      action: async () => {
        const response = await fetch(`/api/admin/products/${productId}/image`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Ürün görseli kaldırılamadı.");
        setForm((current) => ({ ...current, imageUrl: null }));
        await refreshProducts();
      },
    });
  }

  function openNewCategory() {
    const nextOrder = Math.max(0, ...categories.map((category) => category.sortOrder)) + 1;
    setCategoryForm(emptyCategoryForm(nextOrder));
    setCategoryImageFile(null);
    setCategoryError("");
    setCategoryEditorOpen(true);
  }

  function openCategory(category: AdminCategory) {
    setCategoryForm(formFromCategory(category));
    setCategoryImageFile(null);
    setCategoryError("");
    setCategoryEditorOpen(true);
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategorySaving(true);
    setCategoryError("");

    const response = await fetch(
      categoryForm.id
        ? `/api/admin/categories/${categoryForm.id}`
        : "/api/admin/categories",
      {
        method: categoryForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromCategoryForm(categoryForm)),
      },
    );
    const result = (await response.json()) as { id?: number; error?: string };
    if (!response.ok) {
      setCategoryError(result.error ?? "Kategori kaydedilemedi.");
      setCategorySaving(false);
      return;
    }

    const categoryId = categoryForm.id ?? result.id;
    if (categoryImageFile && categoryId) {
      const imageData = new FormData();
      imageData.append("image", categoryImageFile);
      const imageResponse = await fetch(`/api/admin/categories/${categoryId}/image`, {
        method: "POST",
        body: imageData,
      });
      const imageResult = (await imageResponse.json()) as { error?: string };
      if (!imageResponse.ok) {
        setCategoryError(imageResult.error ?? "Kategori görseli yüklenemedi.");
        setCategorySaving(false);
        return;
      }
    }

    await Promise.all([refreshCategories(), refreshProducts()]);
    setCategorySaving(false);
    setCategoryEditorOpen(false);
    setCategoryNotice("Kategori kaydedildi.");
    router.refresh();
  }

  async function toggleCategory(category: AdminCategory) {
    setCategoryNotice("");
    const response = await fetch(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: category.name,
        description: category.description,
        imageAlt: category.imageAlt,
        sortOrder: category.sortOrder,
        isActive: !category.isActive,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setCategoryNotice(result.error ?? "Kategori durumu değiştirilemedi.");
      return;
    }
    await refreshCategories();
    router.refresh();
  }

  function removeCategory(category: AdminCategory) {
    setCategoryNotice("");
    requestConfirmation({
      title: `“${category.name}” silinsin mi?`,
      description: "Kategori kalıcı olarak silinecek. Kategoriye bağlı ürün varsa sistem silme işlemini güvenlik nedeniyle durdurur.",
      confirmLabel: "Kategoriyi sil",
      action: async () => {
        const response = await fetch(`/api/admin/categories/${category.id}`, {
          method: "DELETE",
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Kategori silinemedi.");
        await refreshCategories();
        setCategoryNotice("Kategori silindi.");
        router.refresh();
      },
    });
  }

  function removeCategoryImage() {
    if (!categoryForm.id || !categoryForm.imageUrl) return;
    const categoryId = categoryForm.id;
    requestConfirmation({
      title: "Kategori görseli kaldırılsın mı?",
      description: "Kategori kapak görseli kaldırılacak ve canlı menüde görselsiz görünüm kullanılacak.",
      confirmLabel: "Görseli kaldır",
      action: async () => {
        const response = await fetch(`/api/admin/categories/${categoryId}/image`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Kategori görseli kaldırılamadı.");
        setCategoryForm((current) => ({ ...current, imageUrl: null }));
        await refreshCategories();
      },
    });
  }

  async function updateMessageStatus(message: AdminContactMessage, nextStatus: Exclude<MessageStatus, "all">) {
    const response = await fetch(`/api/admin/messages/${message.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) {
      setSelectedMessage((current) => current?.id === message.id ? { ...current, status: nextStatus } : current);
      await loadMessages();
    }
  }

  function openMessage(message: AdminContactMessage) {
    setSelectedMessage(message.status === "new" ? { ...message, status: "read" } : message);
    if (message.status === "new") void updateMessageStatus(message, "read");
  }

  function removeMessage(message: AdminContactMessage) {
    requestConfirmation({
      title: "Mesaj silinsin mi?",
      description: `“${message.fullName}” tarafından gönderilen mesaj kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmLabel: "Mesajı sil",
      action: async () => {
        const response = await fetch(`/api/admin/messages/${message.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Mesaj silinemedi.");
        setSelectedMessage((current) => current?.id === message.id ? null : current);
        await loadMessages();
      },
    });
  }

  async function updateOrderStatus(order: AdminOrder, nextStatus: Exclude<OrderStatus, "all">) {
    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) {
      setSelectedOrder((current) => current?.id === order.id ? { ...current, status: nextStatus } : current);
      await loadOrders();
    }
  }

  async function updateCateringStatus(request: AdminCateringRequest, nextStatus: Exclude<CateringStatus, "all">) {
    const response = await fetch(`/api/admin/catering/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) {
      setSelectedCatering((current) => current?.id === request.id ? { ...current, status: nextStatus } : current);
      await loadCatering();
    }
  }

  function removeCateringRequest(request: AdminCateringRequest) {
    requestConfirmation({
      title: "Catering talebi silinsin mi?",
      description: `“${request.fullName}” adına oluşturulan ${request.requestNumber} numaralı talep kalıcı olarak silinecek.`,
      confirmLabel: "Talebi sil",
      action: async () => {
        const response = await fetch(`/api/admin/catering/${request.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Catering talebi silinemedi.");
        setSelectedCatering(null);
        await loadCatering();
      },
    });
  }

  async function logout() {
    await fetch("/api/admin/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    router.refresh();
  }

  function changeAdminView(nextView: AdminView) {
    if (nextView === activeView) return;
    if (viewTransitionTimer.current) window.clearTimeout(viewTransitionTimer.current);
    setViewTransitioning(true);
    setActiveView(nextView);
    viewTransitionTimer.current = window.setTimeout(() => {
      setViewTransitioning(false);
      viewTransitionTimer.current = null;
    }, 480);
  }

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: `${category.name}${category.isActive ? "" : " · Pasif"}`,
    tone: category.slug,
  }));
  const activeCategoryCount = categories.filter((category) => category.isActive).length;
  const accentOptions: DropdownOption[] = [
    { value: "cream", label: "Krem", tone: "cream" },
    { value: "berry", label: "Çilek", tone: "berry" },
    { value: "coffee", label: "Kahve", tone: "coffee" },
    { value: "citrus", label: "Limon", tone: "citrus" },
    { value: "avocado", label: "Avokado", tone: "avocado" },
  ];
  const activeViewLoading = viewTransitioning
    || (activeView === "products" && productsLoading)
    || (activeView === "messages" && messagesLoading)
    || (activeView === "orders" && ordersLoading)
    || (activeView === "catering" && cateringLoading);

  return (
    <main className="admin-dashboard">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="Bonj ana sayfa">
          <BrandLogo className="admin-sidebar-logo bonj-brand-logo--light" alt="" priority />
        </Link>
        <nav aria-label="Yönetim bölümleri">
          <button className={activeView === "analytics" ? "is-current" : ""} type="button" onClick={() => changeAdminView("analytics")}><i>01</i><span>İstatistikler</span></button>
          <button className={activeView === "products" ? "is-current" : ""} type="button" onClick={() => changeAdminView("products")}><i>02</i><span>Menü</span></button>
          <button className={activeView === "categories" ? "is-current" : ""} type="button" onClick={() => changeAdminView("categories")}><i>03</i><span>Kategoriler</span></button>
          <button className={activeView === "orders" ? "is-current" : ""} type="button" onClick={() => changeAdminView("orders")}><i>04</i><span>Siparişler</span></button>
          <button className={activeView === "messages" ? "is-current" : ""} type="button" onClick={() => changeAdminView("messages")}><i>05</i><span>Mesajlar</span></button>
          <button className={activeView === "catering" ? "is-current" : ""} type="button" onClick={() => changeAdminView("catering")}><i>06</i><span>Catering</span></button>
          <button className={activeView === "users" ? "is-current" : ""} type="button" onClick={() => changeAdminView("users")}><i>07</i><span>Kullanıcılar</span></button>
          <button className={activeView === "notifications" ? "is-current" : ""} type="button" onClick={() => changeAdminView("notifications")}><i>08</i><span>Bildirim Ayarları</span></button>
          <button type="button" onClick={() => setQrOpen(true)}><i>09</i><span>QR Menü</span></button>
          <a href="/menu" target="_blank"><i>10</i><span>Canlı menü ↗</span></a>
        </nav>
        <div className="admin-account">
          <span>{adminName.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
          <div><strong>{adminEmail}</strong><small>{adminName}</small></div>
          <button type="button" onClick={logout} aria-label="Çıkış yap">↪</button>
        </div>
      </aside>

      <div
        className={`admin-page-loader ${activeViewLoading ? "is-visible" : ""}`}
        role="status"
        aria-live="polite"
        aria-hidden={!activeViewLoading}
      >
        <div className="admin-page-loader-card">
          <span className="admin-page-loader-mark" aria-hidden="true"><BrandLogo className="admin-loader-logo bonj-brand-logo--light" alt="" /></span>
          <div>
            <strong>CAKE STORY</strong>
            <small>İçerik hazırlanıyor</small>
            <i aria-hidden="true"><b /></i>
          </div>
        </div>
      </div>

      {activeView === "analytics" ? <AdminAnalyticsPanel /> : activeView === "products" ? <section className="admin-main" id="products">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">MENÜ YÖNETİMİ / CANLI</span>
            <h1>Günün<br /><em>menüsü.</em></h1>
          </div>
          <button className="admin-primary-button admin-add-button" type="button" onClick={openNewProduct}>
            <span aria-hidden="true">＋</span> Yeni ürün
          </button>
        </header>

        <div className="admin-stats" aria-label="Menü özeti">
          <div><span>Aktif ürün</span><strong>{productSummary.active.toString().padStart(2, "0")}</strong></div>
          <div><span>Pasif ürün</span><strong>{productSummary.passive.toString().padStart(2, "0")}</strong></div>
          <div><span>Kategori</span><strong>{activeCategoryCount.toString().padStart(2, "0")}</strong></div>
        </div>

        <div className="admin-toolbar">
          <label className="admin-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setProductPage(1);
              }}
              placeholder="Ürün veya kategori ara"
              aria-label="Ürün ara"
            />
          </label>
          <div className="admin-status-filter" role="group" aria-label="Durum filtresi">
            {(["all", "active", "passive"] as const).map((item) => (
              <button
                type="button"
                key={item}
                className={status === item ? "is-active" : ""}
                onClick={() => {
                  setStatus(item);
                  setProductPage(1);
                }}
              >
                {item === "all" ? "Tümü" : item === "active" ? "Aktif" : "Pasif"}
              </button>
            ))}
          </div>
        </div>

        <div className={`admin-product-list ${productsLoading ? "is-loading" : ""}`} aria-busy={productsLoading}>
          <div className="admin-list-head">
            <span>Ürün</span><span>Kategori</span><span>Fiyat</span><span>Durum</span><span />
          </div>
          {products.map((product) => (
            <article className="admin-product-row" key={product.id}>
              <div className="admin-product-identity">
                <div className={`admin-product-thumb accent-${product.accent}`}>
                  {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span />}
                </div>
                <div><strong>{product.name}</strong><small>{product.shortDescription}</small></div>
              </div>
              <span className="admin-category-chip">{product.categoryName}</span>
              <strong className="admin-row-price">{money(product.priceInKurus)}</strong>
              <button
                className={`admin-toggle ${product.isActive ? "is-on" : ""}`}
                type="button"
                onClick={() => toggleProduct(product)}
                aria-label={`${product.name} ürününü ${product.isActive ? "pasife" : "aktife"} al`}
                aria-pressed={product.isActive}
              ><i /><span>{product.isActive ? "Aktif" : "Pasif"}</span></button>
              <button className="admin-edit-button" type="button" onClick={() => openProduct(product)}>
                Düzenle <span aria-hidden="true">↗</span>
              </button>
            </article>
          ))}
          {products.length === 0 && !productsLoading && (
            <div className="admin-empty">Bu filtrede ürün bulunamadı.</div>
          )}
        </div>

        <nav className="admin-pagination" aria-label="Ürün sayfaları">
          <span>
            {productPagination.total === 0
              ? "0 ürün"
              : `${(productPagination.page - 1) * productPagination.pageSize + 1}–${Math.min(productPagination.page * productPagination.pageSize, productPagination.total)} / ${productPagination.total} ürün`}
          </span>
          <div>
            <button
              type="button"
              onClick={() => setProductPage((current) => Math.max(1, current - 1))}
              disabled={productPagination.page <= 1 || productsLoading}
              aria-label="Önceki sayfa"
            >←</button>
            {paginationItems(productPagination.page, productPagination.totalPages).map((item) =>
              typeof item === "number" ? (
                <button
                  className={item === productPagination.page ? "is-current" : ""}
                  type="button"
                  key={item}
                  onClick={() => setProductPage(item)}
                  disabled={productsLoading}
                  aria-label={`${item}. sayfa`}
                  aria-current={item === productPagination.page ? "page" : undefined}
                >{item}</button>
              ) : <i key={item}>…</i>,
            )}
            <button
              type="button"
              onClick={() => setProductPage((current) => Math.min(productPagination.totalPages, current + 1))}
              disabled={productPagination.page >= productPagination.totalPages || productsLoading}
              aria-label="Sonraki sayfa"
            >→</button>
          </div>
        </nav>
      </section> : activeView === "categories" ? <section className="admin-main" id="categories">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">KATEGORİ YÖNETİMİ / MENÜ HARİTASI</span>
            <h1>Menünün<br /><em>haritası.</em></h1>
          </div>
          <button className="admin-primary-button admin-add-button" type="button" onClick={openNewCategory}>
            <span aria-hidden="true">＋</span> Yeni kategori
          </button>
        </header>

        <div className="admin-stats" aria-label="Kategori özeti">
          <div><span>Aktif kategori</span><strong>{activeCategoryCount.toString().padStart(2, "0")}</strong></div>
          <div><span>Pasif kategori</span><strong>{(categories.length - activeCategoryCount).toString().padStart(2, "0")}</strong></div>
          <div><span>Toplam ürün</span><strong>{productSummary.total.toString().padStart(2, "0")}</strong></div>
        </div>

        {categoryNotice && (
          <div className="admin-category-notice" role="status">
            <span>{categoryNotice}</span>
            <button type="button" onClick={() => setCategoryNotice("")} aria-label="Bildirimi kapat">×</button>
          </div>
        )}

        <div className="admin-category-list">
          <div className="admin-category-list-head">
            <span>Kategori</span><span>Açıklama</span><span>Ürün</span><span>Sıra</span><span>Durum</span><span>İşlem</span>
          </div>
          {categories.map((category, index) => (
            <article className="admin-category-row" key={category.id}>
              <div className="admin-category-identity">
                <div className={`admin-category-thumb tone-${category.slug}`}>
                  {category.imageUrl ? (
                    <img src={category.imageUrl} alt={category.imageAlt || ""} />
                  ) : (
                    <div><strong>B</strong><span>{String(index + 1).padStart(2, "0")}</span></div>
                  )}
                </div>
                <div>
                  <strong>{category.name}</strong>
                  <small>/{category.slug}</small>
                </div>
              </div>
              <p className="admin-category-copy">{category.description || "Henüz açıklama eklenmedi."}</p>
              <span className="admin-category-count"><strong>{category.productCount}</strong> ürün</span>
              <span className="admin-category-order">{String(category.sortOrder).padStart(2, "0")}</span>
              <button
                className={`admin-toggle admin-category-toggle ${category.isActive ? "is-on" : ""}`}
                type="button"
                onClick={() => toggleCategory(category)}
                aria-label={`${category.name} kategorisini ${category.isActive ? "pasife" : "aktife"} al`}
                aria-pressed={category.isActive}
              ><i /><span>{category.isActive ? "Aktif" : "Pasif"}</span></button>
              <div className="admin-category-actions">
                <button type="button" onClick={() => openCategory(category)}>Düzenle <span aria-hidden="true">↗</span></button>
                <button className="is-danger" type="button" onClick={() => removeCategory(category)} aria-label={`${category.name} kategorisini sil`}>×</button>
              </div>
            </article>
          ))}
          {categories.length === 0 && <div className="admin-empty">Henüz kategori eklenmedi.</div>}
        </div>
      </section> : activeView === "messages" ? <section className="admin-main" id="messages">
        <header className="admin-topbar admin-message-topbar">
          <div>
            <span className="admin-eyebrow">İLETİŞİM / GELEN KUTUSU</span>
            <h1>Gelen<br /><em>sesler.</em></h1>
          </div>
          <Link className="admin-primary-button admin-add-button" href="/iletisim" target="_blank">
            Formu aç <span aria-hidden="true">↗</span>
          </Link>
        </header>

        <div className="admin-stats" aria-label="Mesaj özeti">
          <div><span>Yeni mesaj</span><strong>{messageData.summary.new.toString().padStart(2, "0")}</strong></div>
          <div><span>Çözüldü</span><strong>{messageData.summary.resolved.toString().padStart(2, "0")}</strong></div>
          <div><span>Toplam mesaj</span><strong>{messageData.summary.total.toString().padStart(2, "0")}</strong></div>
        </div>

        <div className="admin-toolbar admin-message-toolbar">
          <p>İletişim formundan gelen son mesajlar</p>
          <div className="admin-status-filter" role="group" aria-label="Mesaj durumu filtresi">
            {(["all", "new", "read", "resolved"] as const).map((item) => (
              <button
                type="button"
                key={item}
                className={messageStatus === item ? "is-active" : ""}
                onClick={() => {
                  setMessageStatus(item);
                  setMessagePage(1);
                }}
              >
                {item === "all" ? "Tümü" : item === "new" ? "Yeni" : item === "read" ? "Okundu" : "Çözüldü"}
              </button>
            ))}
          </div>
        </div>

        {messageLoadError && (
          <div className="admin-load-error" role="alert">
            <span><strong>Mesajlar yenilenemedi.</strong>{messageLoadError}</span>
            <button type="button" onClick={() => void loadMessages()}>Tekrar dene <i aria-hidden="true">↻</i></button>
          </div>
        )}

        <div className={`admin-message-list ${messagesLoading ? "is-loading" : ""}`} aria-busy={messagesLoading}>
          <div className="admin-message-list-head">
            <span>Durum / Konu</span><span>Gönderen</span><span>Mesaj</span><span>Tarih</span><span />
          </div>
          {messageData.messages.map((message) => (
            <button
              className={`admin-message-row status-${message.status}`}
              type="button"
              key={message.id}
              onClick={() => openMessage(message)}
            >
              <span className="admin-message-row-status">
                <i aria-hidden="true" />
                <span>{message.status === "new" ? "Yeni" : message.status === "read" ? "Okundu" : "Çözüldü"}</span>
                <strong>{messageTopic(message.topic)}</strong>
              </span>
              <span className="admin-message-row-person">
                <i>{message.fullName.slice(0, 1).toLocaleUpperCase("tr-TR")}</i>
                <span><strong>{message.fullName}</strong><small>{message.email}</small></span>
              </span>
              <span className="admin-message-row-copy">{message.message}</span>
              <time dateTime={message.createdAt}>{messageDate(message.createdAt)}</time>
              <span className="admin-message-row-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
          {!messageData.messages.length && !messagesLoading && <div className="admin-empty">Bu durumda mesaj bulunmuyor.</div>}
        </div>

        {messageData.pagination.totalPages > 1 && (
          <nav className="admin-pagination" aria-label="Mesaj sayfaları">
            <span>{messageData.pagination.total} mesaj</span>
            <div>
              <button type="button" onClick={() => setMessagePage((current) => Math.max(1, current - 1))} disabled={messagePage <= 1}>←</button>
              {paginationItems(messageData.pagination.page, messageData.pagination.totalPages).map((item) =>
                typeof item === "number" ? (
                  <button className={item === messageData.pagination.page ? "is-current" : ""} type="button" key={item} onClick={() => setMessagePage(item)}>{item}</button>
                ) : <i key={item}>…</i>,
              )}
              <button type="button" onClick={() => setMessagePage((current) => Math.min(messageData.pagination.totalPages, current + 1))} disabled={messagePage >= messageData.pagination.totalPages}>→</button>
            </div>
          </nav>
        )}
      </section> : activeView === "catering" ? <section className="admin-main" id="catering">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">CATERING / TALEP MERKEZİ</span>
            <h1>Yeni<br /><em>davetler.</em></h1>
          </div>
          <Link className="admin-primary-button admin-add-button" href="/catering" target="_blank">
            Formu aç <span aria-hidden="true">↗</span>
          </Link>
        </header>

        <div className="admin-stats" aria-label="Catering talep özeti">
          <div><span>Yeni talep</span><strong>{cateringData.summary.new.toString().padStart(2, "0")}</strong></div>
          <div><span>Aktif görüşme</span><strong>{cateringData.summary.active.toString().padStart(2, "0")}</strong></div>
          <div><span>Toplam talep</span><strong>{cateringData.summary.total.toString().padStart(2, "0")}</strong></div>
        </div>

        <div className="admin-toolbar admin-catering-toolbar">
          <p>Catering formundan gelen organizasyon talepleri</p>
          <div className="admin-status-filter" role="group" aria-label="Catering durumu filtresi">
            {(["all", "new", "contacted", "quoted", "confirmed", "completed", "declined"] as const).map((item) => (
              <button type="button" key={item} className={cateringStatus === item ? "is-active" : ""} onClick={() => { setCateringStatus(item); setCateringPage(1); }}>
                {item === "all" ? "Tümü" : cateringStatusLabel(item)}
              </button>
            ))}
          </div>
        </div>

        {cateringLoadError && (
          <div className="admin-load-error" role="alert">
            <span><strong>Catering talepleri yenilenemedi.</strong>{cateringLoadError}</span>
            <button type="button" onClick={() => void loadCatering()}>Tekrar dene <i aria-hidden="true">↻</i></button>
          </div>
        )}

        <div className={`admin-catering-list ${cateringLoading ? "is-loading" : ""}`} aria-busy={cateringLoading}>
          <div className="admin-catering-list-head"><span>Durum / Kod</span><span>Organizasyon</span><span>İletişim</span><span>Tarih / Kişi</span><span /></div>
          {cateringData.requests.map((request) => (
            <button className={`admin-catering-row status-${request.status}`} type="button" key={request.id} onClick={() => setSelectedCatering(request)}>
              <span className="admin-catering-row-status"><i /><span>{cateringStatusLabel(request.status)}</span><strong>{request.requestNumber}</strong></span>
              <span className="admin-catering-event"><strong>{cateringEventLabel(request.eventType)}</strong><small>{request.venueName || request.venueAddress}</small></span>
              <span className="admin-catering-person"><i>{request.fullName.slice(0, 1).toLocaleUpperCase("tr-TR")}</i><span><strong>{request.fullName}</strong><small>{request.phone}</small></span></span>
              <span className="admin-catering-date"><strong>{messageDate(request.eventAt)}</strong><small>{request.guestCount} kişi</small></span>
              <span className="admin-catering-arrow">↗</span>
            </button>
          ))}
          {!cateringData.requests.length && !cateringLoading && <div className="admin-empty">Bu durumda catering talebi bulunmuyor.</div>}
        </div>

        {cateringData.pagination.totalPages > 1 && (
          <nav className="admin-pagination" aria-label="Catering talep sayfaları">
            <span>{cateringData.pagination.total} talep</span>
            <div>
              <button type="button" onClick={() => setCateringPage((current) => Math.max(1, current - 1))} disabled={cateringPage <= 1}>←</button>
              {paginationItems(cateringData.pagination.page, cateringData.pagination.totalPages).map((item) => typeof item === "number"
                ? <button className={item === cateringData.pagination.page ? "is-current" : ""} type="button" key={item} onClick={() => setCateringPage(item)}>{item}</button>
                : <i key={item}>…</i>)}
              <button type="button" onClick={() => setCateringPage((current) => Math.min(cateringData.pagination.totalPages, current + 1))} disabled={cateringPage >= cateringData.pagination.totalPages}>→</button>
            </div>
          </nav>
        )}
      </section> : activeView === "users" ? (
        <AdminUsersPanel currentUserId={adminId} initialUsers={initialUsers} onRequestConfirmation={requestConfirmation} />
      ) : activeView === "notifications" ? (
        <AdminNotificationSettingsPanel initialSettings={initialNotificationSettings} cronEndpointUrl={dailySummaryCronUrl} />
      ) : <section className="admin-main" id="orders">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">SİPARİŞ / CANLI AKIŞ</span>
            <h1>Yeni<br /><em>siparişler.</em></h1>
          </div>
          <Link className="admin-primary-button admin-add-button" href="/menu" target="_blank">
            Menüyü aç <span aria-hidden="true">↗</span>
          </Link>
        </header>

        <div className="admin-stats" aria-label="Sipariş özeti">
          <div><span>Yeni sipariş</span><strong>{orderData.summary.new.toString().padStart(2, "0")}</strong></div>
          <div><span>Aktif hazırlık</span><strong>{orderData.summary.active.toString().padStart(2, "0")}</strong></div>
          <div><span>Toplam sipariş</span><strong>{orderData.summary.total.toString().padStart(2, "0")}</strong></div>
        </div>

        <div className="admin-toolbar admin-order-toolbar">
          <p>Masa ve geliş zamanı siparişleri</p>
          <div className="admin-status-filter" role="group" aria-label="Sipariş durumu filtresi">
            {(["all", "new", "accepted", "preparing", "ready", "completed", "cancelled"] as const).map((item) => (
              <button
                type="button"
                key={item}
                className={orderStatus === item ? "is-active" : ""}
                onClick={() => {
                  setOrderStatus(item);
                  setOrderPage(1);
                }}
              >{item === "all" ? "Tümü" : orderStatusLabel(item)}</button>
            ))}
          </div>
        </div>

        {orderLoadError && (
          <div className="admin-load-error" role="alert">
            <span><strong>Siparişler yenilenemedi.</strong>{orderLoadError}</span>
            <button type="button" onClick={() => void loadOrders()}>Tekrar dene <i aria-hidden="true">↻</i></button>
          </div>
        )}

        <div className={`admin-order-list ${ordersLoading ? "is-loading" : ""}`} aria-busy={ordersLoading}>
          <div className="admin-order-list-head">
            <span>Durum / Kod</span><span>Müşteri</span><span>Teslim</span><span>Ürünler</span><span>Toplam / Tarih</span><span />
          </div>
          {orderData.orders.map((order) => (
            <button className={`admin-order-row status-${order.status}`} type="button" key={order.id} onClick={() => setSelectedOrder(order)}>
              <span className="admin-order-row-status"><i /><span>{orderStatusLabel(order.status)}</span><strong>{order.orderNumber}</strong></span>
              <span className="admin-order-customer"><i>{order.customerName.slice(0, 1).toLocaleUpperCase("tr-TR")}</i><span><strong>{order.customerName}</strong><small>{order.phone}</small></span></span>
              <span className="admin-order-fulfillment">
                <strong>{order.fulfillmentType === "table" ? `Masa ${order.tableNumber}` : "Gelip alacak"}</strong>
                <small>{order.fulfillmentType === "pickup" && order.pickupAt ? messageDate(order.pickupAt) : "Bonj’da"}</small>
              </span>
              <span className="admin-order-items-preview">{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ")}</span>
              <span className="admin-order-total"><strong>{money(order.totalInKurus)}</strong><small>{messageDate(order.createdAt)}</small></span>
              <span className="admin-order-arrow">↗</span>
            </button>
          ))}
          {!orderData.orders.length && !ordersLoading && <div className="admin-empty">Bu durumda sipariş bulunmuyor.</div>}
        </div>

        {orderData.pagination.totalPages > 1 && (
          <nav className="admin-pagination" aria-label="Sipariş sayfaları">
            <span>{orderData.pagination.total} sipariş</span>
            <div>
              <button type="button" onClick={() => setOrderPage((current) => Math.max(1, current - 1))} disabled={orderPage <= 1}>←</button>
              {paginationItems(orderData.pagination.page, orderData.pagination.totalPages).map((item) =>
                typeof item === "number" ? (
                  <button className={item === orderData.pagination.page ? "is-current" : ""} type="button" key={item} onClick={() => setOrderPage(item)}>{item}</button>
                ) : <i key={item}>…</i>,
              )}
              <button type="button" onClick={() => setOrderPage((current) => Math.min(orderData.pagination.totalPages, current + 1))} disabled={orderPage >= orderData.pagination.totalPages}>→</button>
            </div>
          </nav>
        )}
      </section>}

      {selectedMessage && (
        <div
          className="admin-message-detail-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setSelectedMessage(null)}
        >
          <aside className="admin-message-detail" role="dialog" aria-modal="true" aria-labelledby="message-detail-title">
            <header>
              <div>
                <span className="admin-eyebrow">{messageTopic(selectedMessage.topic)} / {selectedMessage.status === "new" ? "YENİ" : selectedMessage.status === "read" ? "OKUNDU" : "ÇÖZÜLDÜ"}</span>
                <time dateTime={selectedMessage.createdAt}>{messageDate(selectedMessage.createdAt)}</time>
              </div>
              <button type="button" onClick={() => setSelectedMessage(null)} aria-label="Mesaj detayını kapat">×</button>
            </header>

            <div className="admin-message-detail-body">
              <div className="admin-message-detail-person">
                <span>{selectedMessage.fullName.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                <div>
                  <small>Gönderen</small>
                  <h2 id="message-detail-title">{selectedMessage.fullName}</h2>
                  <a href={`mailto:${selectedMessage.email}`}>{selectedMessage.email}</a>
                </div>
              </div>

              {(selectedMessage.company || selectedMessage.phone) && (
                <div className="admin-message-detail-contact">
                  {selectedMessage.company && <div><span>Marka / Şirket</span><strong>{selectedMessage.company}</strong></div>}
                  {selectedMessage.phone && <div><span>Telefon</span><a href={`tel:${selectedMessage.phone}`}>{selectedMessage.phone}</a></div>}
                </div>
              )}

              <div className="admin-message-detail-copy">
                <span>Mesaj</span>
                <p>{selectedMessage.message}</p>
              </div>
            </div>

            <footer>
              <div className="admin-message-state-picker" role="group" aria-label="Mesaj durumu">
                {(["new", "read", "resolved"] as const).map((item) => (
                  <button
                    className={selectedMessage.status === item ? "is-current" : ""}
                    type="button"
                    key={item}
                    onClick={() => updateMessageStatus(selectedMessage, item)}
                  >{item === "new" ? "Yeni" : item === "read" ? "Okundu" : "Çözüldü"}</button>
                ))}
              </div>
              <div className="admin-message-detail-actions">
                <button className="is-delete" type="button" onClick={() => removeMessage(selectedMessage)}>Sil</button>
                <a href={`mailto:${selectedMessage.email}`}>Yanıtla <span>↗</span></a>
              </div>
            </footer>
          </aside>
        </div>
      )}

      {selectedCatering && (
        <div className="admin-catering-detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedCatering(null)}>
          <aside className="admin-catering-detail" role="dialog" aria-modal="true" aria-labelledby="catering-detail-title">
            <header>
              <div><span className="admin-eyebrow">{cateringStatusLabel(selectedCatering.status)} / {selectedCatering.requestNumber}</span><time>{messageDate(selectedCatering.createdAt)}</time></div>
              <button type="button" onClick={() => setSelectedCatering(null)} aria-label="Catering detayını kapat">×</button>
            </header>
            <div className="admin-catering-detail-body">
              <div className="admin-catering-detail-person">
                <span>{selectedCatering.fullName.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                <div><small>Talep sahibi</small><h2 id="catering-detail-title">{selectedCatering.fullName}</h2><a href={`tel:${selectedCatering.phone}`}>{selectedCatering.phone}</a>{selectedCatering.email && <a href={`mailto:${selectedCatering.email}`}>{selectedCatering.email}</a>}</div>
              </div>

              <div className="admin-catering-event-card">
                <div><span>Organizasyon</span><strong>{cateringEventLabel(selectedCatering.eventType)}</strong></div>
                <div><span>Tarih ve saat</span><strong>{messageDate(selectedCatering.eventAt)}</strong></div>
                <div><span>Katılımcı</span><strong>{selectedCatering.guestCount} kişi</strong></div>
              </div>

              <dl className="admin-catering-facts">
                <div><dt>Mekân</dt><dd>{selectedCatering.venueName || "Mekân adı belirtilmedi"}<small>{selectedCatering.venueAddress}</small></dd></div>
                <div><dt>Alan tipi</dt><dd>{cateringVenueLabel(selectedCatering.venueSetting)}</dd></div>
                <div><dt>Servis biçimi</dt><dd>{cateringServiceLabel(selectedCatering.serviceStyle)}</dd></div>
                <div><dt>Kişi başı bütçe</dt><dd>{cateringBudgetLabel(selectedCatering.budgetRange)}</dd></div>
                <div><dt>İletişim tercihi</dt><dd>{cateringContactLabel(selectedCatering.preferredContact)}</dd></div>
                {selectedCatering.company && <div><dt>Şirket / marka</dt><dd>{selectedCatering.company}</dd></div>}
              </dl>

              <section className="admin-catering-menu"><span>Menü ilgileri</span><div>{selectedCatering.menuInterests.map((item) => <i key={item}>{cateringMenuLabel(item)}</i>)}</div></section>
              {selectedCatering.dietaryNeeds && <section className="admin-catering-note"><span>Beslenme / alerjen</span><p>{selectedCatering.dietaryNeeds}</p></section>}
              {selectedCatering.notes && <section className="admin-catering-note"><span>Ek not</span><p>{selectedCatering.notes}</p></section>}
            </div>
            <footer>
              <div className="admin-catering-state-picker" role="group" aria-label="Catering talep durumu">
                {(["new", "contacted", "quoted", "confirmed", "completed", "declined"] as const).map((item) => <button className={selectedCatering.status === item ? "is-current" : ""} type="button" key={item} onClick={() => updateCateringStatus(selectedCatering, item)}>{cateringStatusLabel(item)}</button>)}
              </div>
              <div className="admin-catering-detail-actions"><button type="button" onClick={() => removeCateringRequest(selectedCatering)}>Sil</button><a href={`tel:${selectedCatering.phone}`}>Ara <span>↗</span></a></div>
            </footer>
          </aside>
        </div>
      )}

      {selectedOrder && (
        <div
          className="admin-order-detail-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setSelectedOrder(null)}
        >
          <aside className="admin-order-detail" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
            <header>
              <div><span className="admin-eyebrow">{orderStatusLabel(selectedOrder.status)} / {selectedOrder.orderNumber}</span><time>{messageDate(selectedOrder.createdAt)}</time></div>
              <button type="button" onClick={() => setSelectedOrder(null)} aria-label="Sipariş detayını kapat">×</button>
            </header>
            <div className="admin-order-detail-body">
              <div className="admin-order-detail-customer">
                <span>{selectedOrder.customerName.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                <div><small>Müşteri</small><h2 id="order-detail-title">{selectedOrder.customerName}</h2><a href={`tel:${selectedOrder.phone}`}>{selectedOrder.phone}</a></div>
              </div>

              <div className="admin-order-delivery-card">
                <span>{selectedOrder.fulfillmentType === "table" ? "BONJ’DAYIM" : "BONJ’A GELİYORUM"}</span>
                <strong>{selectedOrder.fulfillmentType === "table" ? `Masa ${selectedOrder.tableNumber}` : selectedOrder.pickupAt ? messageDate(selectedOrder.pickupAt) : "Saat belirtilmedi"}</strong>
              </div>

              <div className="admin-order-detail-items">
                <span>Sipariş</span>
                {selectedOrder.items.map((item) => (
                  <div key={item.id}>
                    <strong>{item.quantity}<i>×</i></strong>
                    <span>{item.productName}<small>{money(item.unitPriceInKurus)} / adet</small></span>
                    <b>{money(item.lineTotalInKurus)}</b>
                  </div>
                ))}
                <footer><span>Toplam</span><strong>{money(selectedOrder.totalInKurus)}</strong></footer>
              </div>

              {selectedOrder.note && <div className="admin-order-note"><span>Sipariş notu</span><p>{selectedOrder.note}</p></div>}
            </div>
            <footer>
              <div className="admin-order-state-picker" role="group" aria-label="Sipariş durumu">
                {(["new", "accepted", "preparing", "ready", "completed", "cancelled"] as const).map((item) => (
                  <button className={selectedOrder.status === item ? "is-current" : ""} type="button" key={item} onClick={() => updateOrderStatus(selectedOrder, item)}>{orderStatusLabel(item)}</button>
                ))}
              </div>
              <div className="admin-order-detail-actions">
                <button type="button" onClick={() => window.print()}>Yazdır <span aria-hidden="true">↗</span></button>
                <a href={`tel:${selectedOrder.phone}`}>Ara <span>↗</span></a>
              </div>
            </footer>
          </aside>
        </div>
      )}

      {selectedOrder && (
        <section className="admin-order-print">
          <header>
            <div><BrandLogo className="admin-print-logo" /></div>
            <p>SİPARİŞ FİŞİ</p>
          </header>
          <div className="admin-order-print-code">
            <span>{orderStatusLabel(selectedOrder.status)}</span>
            <strong>{selectedOrder.orderNumber}</strong>
            <time>{messageDate(selectedOrder.createdAt)}</time>
          </div>
          <dl>
            <div><dt>Müşteri</dt><dd>{selectedOrder.customerName}</dd></div>
            <div><dt>Telefon</dt><dd>{selectedOrder.phone}</dd></div>
            <div><dt>Teslim</dt><dd>{selectedOrder.fulfillmentType === "table" ? `Masa ${selectedOrder.tableNumber}` : selectedOrder.pickupAt ? `Gel-al · ${messageDate(selectedOrder.pickupAt)}` : "Gel-al"}</dd></div>
          </dl>
          <table>
            <thead><tr><th>Adet</th><th>Ürün</th><th>Tutar</th></tr></thead>
            <tbody>
              {selectedOrder.items.map((item) => (
                <tr key={item.id}><td>{item.quantity}×</td><td>{item.productName}<small>{money(item.unitPriceInKurus)} / adet</small></td><td>{money(item.lineTotalInKurus)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={2}>Toplam</th><td>{money(selectedOrder.totalInKurus)}</td></tr></tfoot>
          </table>
          {selectedOrder.note && <div className="admin-order-print-note"><span>Sipariş notu</span><p>{selectedOrder.note}</p></div>}
          <footer><span>Bonj Cake Story · Gaziantep</span><small>bonj · order / {selectedOrder.id}</small></footer>
        </section>
      )}

      {editorOpen && (
        <div className="admin-modal-backdrop" role="presentation">
          <form className="admin-editor" onSubmit={saveProduct}>
            <header>
              <div><span className="admin-eyebrow">ÜRÜN KARTI</span><h2>{form.id ? "Ürünü düzenle" : "Yeni ürün ekle"}</h2></div>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label="Pencereyi kapat">×</button>
            </header>

            <div className="admin-editor-grid">
              <div className="admin-image-field">
                <div className="admin-image-preview">
                  {(previewUrl || form.imageUrl) ? (
                    <img src={previewUrl || form.imageUrl || ""} alt="Ürün önizlemesi" />
                  ) : (
                    <div><strong>＋</strong><span>Ürün görseli</span><small>JPG, PNG veya WebP · Maks. 5 MB</small></div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    aria-label="Ürün görseli seç"
                  />
                </div>
                {form.imageUrl && !previewUrl && (
                  <button className="admin-remove-image" type="button" onClick={removeImage}>Görseli kaldır</button>
                )}
                <label>Görsel açıklaması<input value={form.imageAlt} onChange={(e) => setForm({ ...form, imageAlt: e.target.value })} placeholder="Örn. Çilekli cheesecake dilimi" /></label>
              </div>

              <div className="admin-fields">
                <div className="admin-field-row">
                  <label>Ürün adı *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                  <AdminDropdown
                    label="Kategori"
                    value={form.categoryId}
                    options={categoryOptions}
                    onChange={(categoryId) => setForm({ ...form, categoryId })}
                    required
                  />
                </div>
                <label>Kısa açıklama *<textarea required rows={2} maxLength={500} value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} /></label>
                <label>Uzun açıklama<textarea rows={4} maxLength={5000} value={form.longDescription} onChange={(e) => setForm({ ...form, longDescription: e.target.value })} /></label>
                <label>Alerjen bilgisi<textarea rows={2} maxLength={1000} value={form.allergenInfo} onChange={(e) => setForm({ ...form, allergenInfo: e.target.value })} placeholder="Gluten, süt ürünü, yumurta…" /></label>
                <div className="admin-field-row admin-field-row-three">
                  <label>Fiyat (₺)<input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="245" /></label>
                  <label>Tahmini kalori<input type="number" min="0" max="10000" value={form.estimatedCalories} onChange={(e) => setForm({ ...form, estimatedCalories: e.target.value })} placeholder="≈ kcal" /></label>
                  <label>Etiket<input maxLength={40} value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="Yeni" /></label>
                </div>
                <div className="admin-product-settings">
                  <AccentPicker
                    value={form.accent}
                    options={accentOptions}
                    onChange={(accent) => setForm({ ...form, accent })}
                  />
                  <div className="admin-checkboxes admin-product-checkboxes">
                    <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><span>Aktif</span></label>
                    <label><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /><span>Öne çıkar</span></label>
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="admin-form-error" role="alert">{error}</div>}
            <footer><button type="button" onClick={() => setEditorOpen(false)}>Vazgeç</button><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Ürünü kaydet"}<span>↗</span></button></footer>
          </form>
        </div>
      )}

      {categoryEditorOpen && (
        <div className="admin-modal-backdrop" role="presentation">
          <form className="admin-editor admin-category-editor" onSubmit={saveCategory}>
            <header>
              <div><span className="admin-eyebrow">KATEGORİ KARTI</span><h2>{categoryForm.id ? "Kategoriyi düzenle" : "Yeni kategori ekle"}</h2></div>
              <button type="button" onClick={() => setCategoryEditorOpen(false)} aria-label="Pencereyi kapat">×</button>
            </header>

            <div className="admin-editor-grid">
              <div className="admin-image-field">
                <div className="admin-image-preview admin-category-image-preview">
                  {(categoryPreviewUrl || categoryForm.imageUrl) ? (
                    <img src={categoryPreviewUrl || categoryForm.imageUrl || ""} alt="Kategori önizlemesi" />
                  ) : (
                    <div><strong>＋</strong><span>Kategori görseli</span><small>JPG, PNG veya WebP · Maks. 5 MB</small></div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setCategoryImageFile(event.target.files?.[0] ?? null)}
                    aria-label="Kategori görseli seç"
                  />
                </div>
                {categoryForm.imageUrl && !categoryPreviewUrl && (
                  <button className="admin-remove-image" type="button" onClick={removeCategoryImage}>Görseli kaldır</button>
                )}
                <label>Görsel açıklaması<input maxLength={180} value={categoryForm.imageAlt} onChange={(event) => setCategoryForm({ ...categoryForm, imageAlt: event.target.value })} placeholder="Örn. Çikolatalı cheesecake seçkisi" /></label>
              </div>

              <div className="admin-fields">
                <label>Kategori adı *<input required maxLength={80} value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} placeholder="Örn. İmza Tatlılar" /></label>
                <label>Açıklama<textarea rows={6} maxLength={2000} value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} placeholder="Bu kategoride neler var?" /></label>
                <div className="admin-field-row">
                  <label>Menü sırası *<input required type="number" min="0" max="10000" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: event.target.value })} /></label>
                  <div className="admin-checkboxes admin-category-checkboxes">
                    <label><input type="checkbox" checked={categoryForm.isActive} onChange={(event) => setCategoryForm({ ...categoryForm, isActive: event.target.checked })} /><span>Aktif</span></label>
                  </div>
                </div>
                <p className="admin-editor-hint">Kategori pasif olduğunda kendisi ve içindeki ürünler canlı menüde gösterilmez. Mevcut kategori adresi, isim değişse bile bozulmaz.</p>
              </div>
            </div>

            {categoryError && <div className="admin-form-error" role="alert">{categoryError}</div>}
            <footer><button type="button" onClick={() => setCategoryEditorOpen(false)}>Vazgeç</button><button className="admin-primary-button" type="submit" disabled={categorySaving}>{categorySaving ? "Kaydediliyor…" : "Kategoriyi kaydet"}<span>↗</span></button></footer>
          </form>
        </div>
      )}

      {qrOpen && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setQrOpen(false)}>
          <section className="admin-qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
            <button type="button" className="admin-qr-close" onClick={() => setQrOpen(false)} aria-label="QR penceresini kapat">×</button>
            <span className="admin-eyebrow">MASA / MENÜ</span>
            <h2 id="qr-title">QR menün<br /><em>hazır.</em></h2>
            <div className="admin-qr-image">{qrUrl ? <img src={qrUrl} alt="Bonj dijital menü QR kodu" /> : <span>Hazırlanıyor…</span>}</div>
            <p>QR kodu <strong>{typeof window !== "undefined" ? `${window.location.origin}/menu` : "/menu"}</strong> adresini açar.</p>
            {qrUrl && <a className="admin-primary-button" href={qrUrl} download="bonj-qr-menu.png">QR’ı indir <span>↓</span></a>}
          </section>
        </div>
      )}

      {confirmation && (
        <div
          className="admin-confirm-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !confirming) {
              setConfirmation(null);
              setConfirmationError("");
            }
          }}
        >
          <section
            className="admin-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
            aria-describedby="admin-confirm-description"
          >
            <div className="admin-confirm-symbol" aria-hidden="true"><span>!</span></div>
            <span className="admin-eyebrow">İŞLEM ONAYI / DİKKAT</span>
            <h2 id="admin-confirm-title">{confirmation.title}</h2>
            <p id="admin-confirm-description">{confirmation.description}</p>
            {confirmationError && <div className="admin-confirm-error" role="alert">{confirmationError}</div>}
            <div className="admin-confirm-actions">
              <button
                type="button"
                autoFocus
                disabled={confirming}
                onClick={() => {
                  setConfirmation(null);
                  setConfirmationError("");
                }}
              >Vazgeç</button>
              <button className="is-danger" type="button" disabled={confirming} onClick={() => void acceptConfirmation()}>
                {confirming ? "İşleniyor…" : confirmation.confirmLabel}<span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
