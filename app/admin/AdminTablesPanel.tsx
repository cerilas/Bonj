"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminCafeTable, AdminClosedTableSession, AdminTablesSnapshot } from "@/lib/admin-tables";
import { BrandLogo } from "../components/BrandLogo";
import { UiIcon } from "../components/UiIcon";

type CatalogItem = {
  id?: number;
  slug: string;
  name: string;
  priceInKurus?: number | null;
  category: string;
  categoryName: string;
};

export type PosPrintReceiptData = {
  tableName: string;
  tableZone: string;
  openedAt: string;
  closedAt: string | null;
  guestCount: number;
  customerName: string | null;
  note: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPriceInKurus: number;
    lineTotalInKurus: number;
  }>;
  subtotalInKurus: number;
  discountInKurus: number;
  totalInKurus: number;
  paymentMethod: string | null;
};

function money(kurus: number) {
  return `${(kurus / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

function formatDuration(openedAtIso: string, nowMs: number) {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(openedAtIso).getTime()) / 1000));
  const hours = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (hours > 0) return `${hours} sa ${String(mins).padStart(2, "0")} dk`;
  if (mins > 0) return `${mins} dk ${String(secs).padStart(2, "0")} sn`;
  return `${secs} sn`;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function posPaymentLabel(method: string | null) {
  if (method === "cash") return "Nakit";
  if (method === "card") return "Kredi Kartı";
  if (method === "split") return "Parçalı (Nakit + Kart)";
  if (method === "free") return "İkram";
  return "Açık Hesap";
}

export function AdminTablesPanel({
  onNavigateToOrders,
  onPrintReceiptChange,
  staffMode = false,
  focusTableId,
  onFocusTableHandled,
}: {
  onNavigateToOrders?: () => void;
  onPrintReceiptChange?: (receipt: PosPrintReceiptData | null) => void;
  staffMode?: boolean;
  focusTableId?: number | null;
  onFocusTableHandled?: () => void;
}) {
  const [snapshot, setSnapshot] = useState<AdminTablesSnapshot | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "free" | "qr">("all");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Open table form
  const [guestCount, setGuestCount] = useState("2");
  const [customerName, setCustomerName] = useState("");

  // Session note edit
  const [sessionNoteDraft, setSessionNoteDraft] = useState("");

  // Add table inline form
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableCode, setNewTableCode] = useState("");
  const [newTableZone, setNewTableZone] = useState("Salon");
  const [newTableCap, setNewTableCap] = useState("4");

  // Catalog search & category
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCat, setCatalogCat] = useState("all");
  const [addQty, setAddQty] = useState("1");
  const [addingLabel, setAddingLabel] = useState("");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");

  // Move table
  const [moveTargetId, setMoveTargetId] = useState("");

  // Close & payment
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "split" | "free">("cash");
  const [discountTl, setDiscountTl] = useState("");
  const [cashTenderedTl, setCashTenderedTl] = useState("");
  const [splitCashTl, setSplitCashTl] = useState("");
  const [splitCardTl, setSplitCardTl] = useState("");
  const [closeOnlineOrders, setCloseOnlineOrders] = useState(true);
  const [busy, setBusy] = useState(false);

  // Receipt preview modal
  const [previewReceipt, setPreviewReceipt] = useState<PosPrintReceiptData | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tables", { cache: "no-store" });
      if (!res.ok) throw new Error("Masalar yüklenemedi.");
      const data = (await res.json()) as AdminTablesSnapshot;
      setSnapshot(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Masalar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
    fetch("/api/menu")
      .then((r) => r.json())
      .then((d: { items?: CatalogItem[] }) => {
        if (Array.isArray(d.items)) setCatalog(d.items);
      })
      .catch(() => {});
  }, [loadSnapshot]);

  // Live 1-second timer for open table durations
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll tables every 15s to catch incoming QR orders
  useEffect(() => {
    const id = setInterval(() => void loadSnapshot(), 15000);
    return () => clearInterval(id);
  }, [loadSnapshot]);

  useEffect(() => {
    if (focusTableId) {
      setSelectedTableId(focusTableId);
      void loadSnapshot();
      onFocusTableHandled?.();
    }
  }, [focusTableId, loadSnapshot, onFocusTableHandled]);

  const zones = useMemo(() => {
    if (!snapshot) return ["all"];
    const set = new Set(snapshot.tables.map((t) => t.zone));
    return ["all", ...Array.from(set)];
  }, [snapshot]);

  const visibleTables = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.tables.filter((t) => {
      if (zoneFilter !== "all" && t.zone !== zoneFilter) return false;
      if (statusFilter === "open" && !t.activeSession) return false;
      if (statusFilter === "free" && (t.activeSession !== null || t.onlineOrders.length > 0)) return false;
      if (statusFilter === "qr" && t.onlineOrders.length === 0) return false;
      return true;
    });
  }, [snapshot, zoneFilter, statusFilter]);

  const selectedTable: AdminCafeTable | null = useMemo(() => {
    if (!snapshot || selectedTableId === null) return null;
    return snapshot.tables.find((t) => t.id === selectedTableId) ?? null;
  }, [snapshot, selectedTableId]);

  useEffect(() => {
    setSessionNoteDraft(selectedTable?.activeSession?.note ?? "");
    setCashTenderedTl("");
    setDiscountTl("");
    setSplitCashTl("");
    setSplitCardTl("");
  }, [selectedTable?.id, selectedTable?.activeSession?.id]);

  const freeTablesForMove = useMemo(() => {
    if (!snapshot || !selectedTable) return [];
    return snapshot.tables.filter(
      (t) => t.id !== selectedTable.id && t.activeSession === null,
    );
  }, [snapshot, selectedTable]);

  const catalogCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of catalog) {
      if (!map.has(item.category)) map.set(item.category, item.categoryName);
    }
    return Array.from(map.entries());
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return catalog.filter((item) => {
      if (catalogCat !== "all" && item.category !== catalogCat) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, catalogCat, catalogSearch]);

  function flashNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice((curr) => (curr === msg ? "" : curr)), 3500);
  }

  function openReceiptPreview(receipt: PosPrintReceiptData, autoPrint = false) {
    setPreviewReceipt(receipt);
    onPrintReceiptChange?.(receipt);
    if (autoPrint) {
      setTimeout(() => window.print(), 120);
    }
  }

  function closeReceiptPreview() {
    setPreviewReceipt(null);
    onPrintReceiptChange?.(null);
  }

  async function handleOpenTable() {
    if (!selectedTable || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tables/${selectedTable.id}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestCount: Number(guestCount) || 2,
          customerName: customerName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Masa açılamadı.");
      setCustomerName("");
      flashNotice(`${selectedTable.name} açıldı.`);
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Masa açılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateSessionMeta(payload: { guestCount?: number; note?: string }) {
    if (!selectedTable?.activeSession || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tables/${selectedTable.id}/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await loadSnapshot();
        if (payload.note !== undefined) flashNotice("Masa notu kaydedildi.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMenuItem(item: CatalogItem) {
    if (!selectedTable || !item.id || busy) return;
    const qty = Math.max(1, Math.min(99, Math.round(Number(addQty) || 1)));
    setBusy(true);
    setAddingLabel(`${item.name} (${qty}×) masaya ekleniyor…`);
    setError("");
    try {
      const res = await fetch(`/api/admin/tables/${selectedTable.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId: item.id, quantity: qty }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Ürün eklenemedi.");
      setAddQty("1");
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ürün eklenemedi.");
    } finally {
      setAddingLabel("");
      setBusy(false);
    }
  }

  async function handleAddCustomItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTable || busy) return;
    const priceKurus = Math.round((Number(customItemPrice.replace(",", ".")) || 0) * 100);
    if (!customItemName.trim()) return;
    const qty = Math.max(1, Math.min(99, Math.round(Number(addQty) || 1)));
    setBusy(true);
    setAddingLabel(`${customItemName.trim()} (${qty}×) ekleniyor…`);
    setError("");
    try {
      const res = await fetch(`/api/admin/tables/${selectedTable.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: customItemName.trim(),
          unitPriceInKurus: priceKurus,
          quantity: qty,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Kalem eklenemedi.");
      setCustomItemName("");
      setCustomItemPrice("");
      setAddQty("1");
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kalem eklenemedi.");
    } finally {
      setAddingLabel("");
      setBusy(false);
    }
  }

  async function handleUpdateItemQty(itemId: number, nextQty: number) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/tables/session-items/${itemId}`, {
        method: nextQty <= 0 ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: nextQty <= 0 ? undefined : JSON.stringify({ quantity: nextQty }),
      });
      await loadSnapshot();
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveTable() {
    if (!selectedTable || !moveTargetId || busy) return;
    setBusy(true);
    setError("");
    try {
      const targetId = Number(moveTargetId);
      const res = await fetch(`/api/admin/tables/${selectedTable.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTableId: targetId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Masa taşınamadı.");
      setMoveTargetId("");
      setSelectedTableId(targetId);
      flashNotice("Masa taşındı.");
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Masa taşınamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkQrOrderCompleted(orderId: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        flashNotice("QR siparişi teslim edildi olarak işaretlendi.");
        await loadSnapshot();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseTable(andPrint = false) {
    if (!selectedTable?.activeSession || busy) return;
    setBusy(true);
    setError("");
    const sessionSnapshot = selectedTable.activeSession;
    const discountInKurus = Math.max(0, Math.round((Number(discountTl.replace(",", ".")) || 0) * 100));
    const paidCashInKurus = Math.max(0, Math.round((Number(splitCashTl.replace(",", ".")) || 0) * 100));
    const paidCardInKurus = Math.max(0, Math.round((Number(splitCardTl.replace(",", ".")) || 0) * 100));
    const finalTotal = Math.max(0, sessionSnapshot.subtotalInKurus - discountInKurus);

    try {
      const res = await fetch(`/api/admin/tables/${selectedTable.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          discountInKurus,
          paidCashInKurus,
          paidCardInKurus,
          note: sessionNoteDraft.trim() || undefined,
          onlineOrderIds: closeOnlineOrders ? selectedTable.onlineOrders.map((o) => o.id) : [],
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Hesap kapatılamadı.");

      const receipt: PosPrintReceiptData = {
        tableName: selectedTable.name,
        tableZone: selectedTable.zone,
        openedAt: sessionSnapshot.openedAt,
        closedAt: new Date().toISOString(),
        guestCount: sessionSnapshot.guestCount,
        customerName: sessionSnapshot.customerName,
        note: sessionNoteDraft.trim() || null,
        items: sessionSnapshot.items,
        subtotalInKurus: sessionSnapshot.subtotalInKurus,
        discountInKurus,
        totalInKurus: finalTotal,
        paymentMethod,
      };

      setDiscountTl("");
      setCashTenderedTl("");
      setSplitCashTl("");
      setSplitCardTl("");
      flashNotice(`${selectedTable.name} hesabı kapatıldı (${money(finalTotal)}).`);
      await loadSnapshot();

      if (andPrint) {
        openReceiptPreview(receipt, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hesap kapatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTable(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !newTableName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTableName.trim(),
          code: newTableCode.trim() || undefined,
          zone: newTableZone.trim() || "Salon",
          capacity: Number(newTableCap) || 4,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Masa eklenemedi.");
      setNewTableName("");
      setNewTableCode("");
      setShowAddTable(false);
      flashNotice("Yeni masa eklendi.");
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Masa eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTable(table: AdminCafeTable) {
    if (busy || table.activeSession) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tables/${table.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Masa silinemedi.");
      setSelectedTableId(null);
      flashNotice(`${table.name} kaldırıldı.`);
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Masa silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  const activeSession = selectedTable?.activeSession ?? null;
  const discountKurus = Math.max(0, Math.round((Number(discountTl.replace(",", ".")) || 0) * 100));
  const posSubtotal = activeSession?.subtotalInKurus ?? 0;
  const payableKurus = Math.max(0, posSubtotal - discountKurus);
  const cashTenderedKurus = Math.max(0, Math.round((Number(cashTenderedTl.replace(",", ".")) || 0) * 100));
  const changeKurus = cashTenderedKurus > payableKurus ? cashTenderedKurus - payableKurus : 0;

  return (
    <section className="admin-pos-wrap">
      {!staffMode ? (
        <div className="admin-pos-summary">
          <div className="admin-pos-kpi">
            <span>Açık Masalar</span>
            <strong>
              {snapshot ? `${snapshot.summary.openTables} / ${snapshot.summary.totalTables}` : "—"}
            </strong>
          </div>
          <div className="admin-pos-kpi">
            <span>Açık Adisyon Toplamı</span>
            <strong>{snapshot ? money(snapshot.summary.openTotalInKurus) : "—"}</strong>
          </div>
          <div className="admin-pos-kpi">
            <span>Bugün Nakit</span>
            <strong>{snapshot ? money(snapshot.summary.todayCashInKurus) : "—"}</strong>
          </div>
          <div className="admin-pos-kpi">
            <span>Bugün Kart</span>
            <strong>{snapshot ? money(snapshot.summary.todayCardInKurus) : "—"}</strong>
          </div>
          <div className="admin-pos-kpi">
            <span>Kapanan Masa (Bugün)</span>
            <strong>{snapshot ? snapshot.summary.todayClosedCount : "—"}</strong>
          </div>
        </div>
      ) : (
        <div className="admin-pos-staff-summary">
          <div>
            <span>Açık Masa</span>
            <strong>{snapshot ? `${snapshot.summary.openTables} / ${snapshot.summary.totalTables}` : "—"}</strong>
          </div>
          <div>
            <span>QR Siparişli</span>
            <strong>{snapshot ? snapshot.tables.filter((t) => t.onlineOrders.length > 0).length : "—"}</strong>
          </div>
        </div>
      )}

      <div className="admin-pos-toolbar">
        <div className="admin-pos-filters-group">
          <div className="admin-pos-zones">
            {zones.map((z) => (
              <button
                key={z}
                type="button"
                className={zoneFilter === z ? "is-current" : ""}
                onClick={() => setZoneFilter(z)}
              >
                {z === "all" ? "Tüm Bölgeler" : z}
              </button>
            ))}
          </div>
          <div className="admin-pos-zones">
            {(
              [
                ["all", "Hepsi"],
                ["open", "Açık"],
                ["free", "Boş"],
                ["qr", "QR Sipariş"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={statusFilter === key ? "is-current" : ""}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-pos-toolbar-actions">
          {!staffMode && (
            <button type="button" onClick={() => setShowAddTable((v) => !v)}>
              {showAddTable ? "Vazgeç" : "+ Masa Ekle"}
            </button>
          )}
          <button type="button" onClick={() => void loadSnapshot()}>
            Yenile
          </button>
        </div>
      </div>

      {error && <p className="admin-pos-error" role="alert">{error}</p>}
      {notice && <p className="admin-pos-notice" role="status">{notice}</p>}

      {showAddTable && (
        <form className="admin-pos-add-table-form" onSubmit={handleCreateTable}>
          <input
            type="text"
            placeholder="Masa Adı (Örn: Teras 1)"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Kodu (Örn: T1)"
            value={newTableCode}
            onChange={(e) => setNewTableCode(e.target.value)}
          />
          <input
            type="text"
            placeholder="Bölge (Salon / Bahçe / Teras)"
            value={newTableZone}
            onChange={(e) => setNewTableZone(e.target.value)}
          />
          <input
            type="number"
            min={1}
            max={30}
            placeholder="Kapasite"
            value={newTableCap}
            onChange={(e) => setNewTableCap(e.target.value)}
          />
          <button type="submit" disabled={busy}>Kaydet</button>
        </form>
      )}

      <div className="admin-pos-workspace">
        <div className="admin-pos-grid">
          {loading ? (
            <p className="admin-pos-empty">Masalar yükleniyor…</p>
          ) : visibleTables.length === 0 ? (
            <p className="admin-pos-empty">Bu filtreye uyan masa bulunamadı.</p>
          ) : (
            visibleTables.map((table) => {
              const isOpen = table.activeSession !== null;
              const hasQr = table.onlineOrders.length > 0;
              const isSelected = selectedTable?.id === table.id;
              const totalKurus =
                (table.activeSession?.subtotalInKurus ?? 0) +
                table.onlineOrders.reduce((s, o) => s + o.totalInKurus, 0);

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedTableId(table.id)}
                  className={`admin-pos-table-card ${isOpen ? "is-open" : "is-free"} ${hasQr ? "has-qr" : ""} ${isSelected ? "is-selected" : ""}`}
                >
                  <div className="admin-pos-table-head">
                    <span className="admin-pos-table-zone">{table.zone}</span>
                    <span className="admin-pos-table-badge">
                      {isOpen ? "Açık" : hasQr ? "QR Sipariş" : "Boş"}
                    </span>
                  </div>
                  <strong className="admin-pos-table-name">{table.name}</strong>
                  <div className="admin-pos-table-meta">
                    {table.activeSession ? (
                      <>
                        <span className="admin-pos-timer">
                          ⏱ {formatDuration(table.activeSession.openedAt, nowMs)}
                        </span>
                        <span className="admin-pos-guests">
                          {table.activeSession.guestCount} kişi
                        </span>
                      </>
                    ) : (
                      <span>{table.capacity} kişilik</span>
                    )}
                  </div>
                  {(isOpen || hasQr) && (
                    <div className="admin-pos-table-total">
                      <strong>{money(totalKurus)}</strong>
                      {hasQr && <small>QR ({table.onlineOrders.length})</small>}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <aside className={`admin-pos-drawer ${selectedTable ? "has-selection" : ""}`}>
          {!selectedTable ? (
            <div className="admin-pos-drawer-empty">
              <h3>Masa Seçin</h3>
              <p>
                Masa açmak, ürün eklemek, masa taşımak, fiş yazdırmak veya tahsilat alıp hesabı kapatmak için soldan bir masa seçin.
              </p>
            </div>
          ) : (
            <div className="admin-pos-drawer-body">
              <div className="admin-pos-mobile-sheet-bar">
                <button
                  type="button"
                  className="admin-pos-mobile-back"
                  onClick={() => setSelectedTableId(null)}
                >
                  ← Masalara Dön
                </button>
                <strong>{selectedTable.name}</strong>
              </div>
              <header className="admin-pos-drawer-head">
                <div>
                  <span className="admin-pos-drawer-zone">{selectedTable.zone} · Kod: {selectedTable.code}</span>
                  <h3>{selectedTable.name}</h3>
                </div>
                {activeSession ? (
                  <div className="admin-pos-drawer-timer">
                    <span>Oturum Süresi</span>
                    <strong>{formatDuration(activeSession.openedAt, nowMs)}</strong>
                  </div>
                ) : !staffMode ? (
                  <button
                    type="button"
                    className="admin-pos-delete-table-btn"
                    onClick={() => void handleDeleteTable(selectedTable)}
                    disabled={busy}
                  >
                    Masayı Kaldır
                  </button>
                ) : null}
              </header>

              {selectedTable.onlineOrders.length > 0 && (
                <div className="admin-pos-qr-box">
                  <div className="admin-pos-qr-head">
                    <strong>QR Masaya Siparişler ({selectedTable.onlineOrders.length})</strong>
                    {onNavigateToOrders && (
                      <button type="button" onClick={onNavigateToOrders}>
                        Siparişlerde Gör
                      </button>
                    )}
                  </div>
                  {selectedTable.onlineOrders.map((ord) => (
                    <div key={ord.id} className="admin-pos-qr-order">
                      <div className="admin-pos-qr-order-top">
                        <div>
                          <b>{ord.orderNumber}</b> · {ord.customerName}
                          <small>
                            {ord.paymentStatus === "paid" ? "Online Ödendi" : "Ödeme Bekliyor"} · {money(ord.totalInKurus)}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="admin-pos-qr-done-btn"
                          onClick={() => void handleMarkQrOrderCompleted(ord.id)}
                          disabled={busy}
                        >
                          Teslim Et
                        </button>
                      </div>
                      <ul>
                        {ord.items.map((it) => (
                          <li key={it.id}>
                            {it.quantity}× {it.productName} — {money(it.lineTotalInKurus)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {!activeSession ? (
                <div className="admin-pos-open-box">
                  <h4>Masa Aç</h4>
                  <div className="admin-pos-open-fields">
                    <label>
                      <span>Kişi Sayısı</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={guestCount}
                        onChange={(e) => setGuestCount(e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Müşteri / Masa Notu (Opsiyonel)</span>
                      <input
                        type="text"
                        placeholder="Örn: Deniz Bey"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="admin-pos-primary-btn"
                    onClick={() => void handleOpenTable()}
                    disabled={busy}
                  >
                    Masayı Aç
                  </button>
                  <p className="admin-pos-hint">
                    İpucu: Aşağıdan doğrudan ürün seçerseniz masa otomatik açılır.
                  </p>
                </div>
              ) : (
                <>
                  <div className="admin-pos-session-meta">
                    <div className="admin-pos-guest-stepper">
                      <span>Kişi:</span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleUpdateSessionMeta({
                            guestCount: Math.max(1, activeSession.guestCount - 1),
                          })
                        }
                        disabled={busy || activeSession.guestCount <= 1}
                      >
                        −
                      </button>
                      <strong>{activeSession.guestCount}</strong>
                      <button
                        type="button"
                        onClick={() =>
                          void handleUpdateSessionMeta({
                            guestCount: activeSession.guestCount + 1,
                          })
                        }
                        disabled={busy}
                      >
                        +
                      </button>
                    </div>
                    <div className="admin-pos-note-row">
                      <input
                        type="text"
                        placeholder="Masa notu (Örn: Doğum günü, pencere kenarı)"
                        value={sessionNoteDraft}
                        onChange={(e) => setSessionNoteDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => void handleUpdateSessionMeta({ note: sessionNoteDraft })}
                        disabled={busy}
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>

                  <div className="admin-pos-move-row">
                    <select
                      value={moveTargetId}
                      onChange={(e) => setMoveTargetId(e.target.value)}
                    >
                      <option value="">Masa Taşı: Hedef boş masa seç…</option>
                      {freeTablesForMove.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.zone})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!moveTargetId || busy}
                      onClick={() => void handleMoveTable()}
                    >
                      Taşı
                    </button>
                  </div>

                  <div className="admin-pos-bill">
                    <div className="admin-pos-bill-head">
                      <h4>Adisyon ({activeSession.items.length} kalem)</h4>
                      <button
                        type="button"
                        onClick={() =>
                          openReceiptPreview({
                            tableName: selectedTable.name,
                            tableZone: selectedTable.zone,
                            openedAt: activeSession.openedAt,
                            closedAt: null,
                            guestCount: activeSession.guestCount,
                            customerName: activeSession.customerName,
                            note: sessionNoteDraft.trim() || null,
                            items: activeSession.items,
                            subtotalInKurus: posSubtotal,
                            discountInKurus: discountKurus,
                            totalInKurus: payableKurus,
                            paymentMethod: null,
                          })
                        }
                      >
                        Fiş Önizle / Yazdır <UiIcon name="arrow-up-right" />
                      </button>
                    </div>

                    {activeSession.items.length === 0 ? (
                      <p className="admin-pos-empty">Henüz ürün eklenmedi.</p>
                    ) : (
                      <div className="admin-pos-bill-items">
                        {activeSession.items.map((item) => (
                          <div key={item.id} className="admin-pos-bill-item">
                            <div className="admin-pos-bill-item-info">
                              <strong>{item.productName}</strong>
                              <small>{money(item.unitPriceInKurus)} / adet</small>
                            </div>
                            <div className="admin-pos-qty">
                              <button
                                type="button"
                                onClick={() => void handleUpdateItemQty(item.id, item.quantity - 1)}
                                disabled={busy}
                              >
                                −
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => void handleUpdateItemQty(item.id, item.quantity + 1)}
                                disabled={busy}
                              >
                                +
                              </button>
                            </div>
                            <b className="admin-pos-bill-line-total">{money(item.lineTotalInKurus)}</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="admin-pos-checkout">
                    <h4>Tahsilat &amp; Hesap Kapatma</h4>
                    <div className="admin-pos-pay-methods">
                      {(
                        [
                          ["cash", "Nakit"],
                          ["card", "Kredi Kartı"],
                          ["split", "Parçalı"],
                          ["free", "İkram"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={paymentMethod === key ? "is-current" : ""}
                          onClick={() => setPaymentMethod(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="admin-pos-pay-inputs">
                      <label>
                        <span>İndirim (₺)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={discountTl}
                          onChange={(e) => setDiscountTl(e.target.value)}
                        />
                      </label>
                      {paymentMethod === "cash" && (
                        <label>
                          <span>Alınan Nakit (₺)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Para üstü için…"
                            value={cashTenderedTl}
                            onChange={(e) => setCashTenderedTl(e.target.value)}
                          />
                        </label>
                      )}
                      {paymentMethod === "split" && (
                        <>
                          <label>
                            <span>Nakit (₺)</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={splitCashTl}
                              onChange={(e) => setSplitCashTl(e.target.value)}
                            />
                          </label>
                          <label>
                            <span>Kart (₺)</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={splitCardTl}
                              onChange={(e) => setSplitCardTl(e.target.value)}
                            />
                          </label>
                        </>
                      )}
                    </div>

                    {paymentMethod === "cash" && cashTenderedKurus > 0 && (
                      <div className="admin-pos-change-box">
                        <span>Para Üstü</span>
                        <strong>{money(changeKurus)}</strong>
                      </div>
                    )}

                    {selectedTable.onlineOrders.length > 0 && (
                      <label className="admin-pos-checkbox">
                        <input
                          type="checkbox"
                          checked={closeOnlineOrders}
                          onChange={(e) => setCloseOnlineOrders(e.target.checked)}
                        />
                        <span>Bu masadaki QR siparişleri de &ldquo;Teslim Edildi&rdquo; olarak kapat</span>
                      </label>
                    )}

                    <div className="admin-pos-payable">
                      <span>Ödenecek Tutar</span>
                      <strong>{money(payableKurus)}</strong>
                    </div>

                    <div className="admin-pos-close-actions">
                      <button
                        type="button"
                        className="admin-pos-primary-btn"
                        onClick={() => void handleCloseTable(false)}
                        disabled={busy}
                      >
                        Tahsil Et &amp; Kapat
                      </button>
                      <button
                        type="button"
                        className="admin-pos-secondary-btn"
                        onClick={() => void handleCloseTable(true)}
                        disabled={busy}
                      >
                        Kapat &amp; Fiş Yazdır
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="admin-pos-catalog">
                <div className="admin-pos-catalog-head">
                  <h4>Masaya Ürün Ekle</h4>
                  <div className="admin-pos-quick-qty" role="group" aria-label="Hızlı adet seçimi">
                    <span>Adet:</span>
                    {([1, 2, 3, 5] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={Number(addQty) === q ? "is-current" : ""}
                        onClick={() => setAddQty(String(q))}
                      >
                        {q}×
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      aria-label="Özel adet"
                    />
                  </div>
                </div>

                {addingLabel && (
                  <div className="admin-pos-loading-wrap" role="status" aria-live="polite">
                    <div className="admin-pos-loading-bar">
                      <span />
                    </div>
                    <small>{addingLabel}</small>
                  </div>
                )}

                <div className="admin-pos-catalog-filters">
                  <input
                    type="search"
                    placeholder="Ürün ara…"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                  <select
                    value={catalogCat}
                    onChange={(e) => setCatalogCat(e.target.value)}
                  >
                    <option value="all">Tüm Kategoriler</option>
                    {catalogCategories.map(([slug, label]) => (
                      <option key={slug} value={slug}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-pos-catalog-grid">
                  {filteredCatalog.slice(0, 36).map((item) => (
                    <button
                      key={item.slug}
                      type="button"
                      disabled={busy || !item.id}
                      onClick={() => void handleAddMenuItem(item)}
                    >
                      <span>{item.name}</span>
                      <strong>{item.priceInKurus ? money(item.priceInKurus) : "—"}</strong>
                    </button>
                  ))}
                </div>

                <form className="admin-pos-custom-item" onSubmit={handleAddCustomItem}>
                  <input
                    type="text"
                    placeholder="Özel ürün / ek kalem"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Tutar (₺)"
                    value={customItemPrice}
                    onChange={(e) => setCustomItemPrice(e.target.value)}
                  />
                  <button type="submit" disabled={busy}>+ Ekle</button>
                </form>
              </div>

              <div className="admin-pos-logs">
                <h4>Son İşlemler (24 Saat)</h4>
                {selectedTable.recentLogs.length === 0 ? (
                  <p className="admin-pos-empty">Son 24 saatte kayıtlı işlem yok.</p>
                ) : (
                  <ul className="admin-pos-log-list">
                    {selectedTable.recentLogs.map((log) => (
                      <li key={log.id}>
                        <span>{log.summary}</span>
                        <time>{formatTime(log.createdAt)}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {snapshot && snapshot.recentClosed.length > 0 && (
        <div className="admin-pos-history">
          <h4>Son Kapanan Masalar</h4>
          <div className="admin-pos-history-list">
            {snapshot.recentClosed.map((s: AdminClosedTableSession) => (
              <div key={s.id} className="admin-pos-history-row">
                <div>
                  <strong>{s.tableName}</strong>
                  <small>
                    {formatTime(s.openedAt)} → {s.closedAt ? formatTime(s.closedAt) : "—"} · {posPaymentLabel(s.paymentMethod)}
                  </small>
                </div>
                <div className="admin-pos-history-right">
                  <b>{money(Math.max(0, s.subtotalInKurus - s.discountInKurus))}</b>
                  <button
                    type="button"
                    onClick={() =>
                      openReceiptPreview({
                        tableName: s.tableName,
                        tableZone: s.tableZone,
                        openedAt: s.openedAt,
                        closedAt: s.closedAt,
                        guestCount: s.guestCount,
                        customerName: s.customerName,
                        note: s.note,
                        items: s.items,
                        subtotalInKurus: s.subtotalInKurus,
                        discountInKurus: s.discountInKurus,
                        totalInKurus: Math.max(0, s.subtotalInKurus - s.discountInKurus),
                        paymentMethod: s.paymentMethod,
                      })
                    }
                  >
                    Fiş
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewReceipt && (
        <div
          className="admin-pos-receipt-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Masa Adisyon Fişi"
          onClick={closeReceiptPreview}
        >
          <div className="admin-pos-receipt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-pos-receipt-paper">
              <div className="admin-pos-receipt-head">
                <BrandLogo className="admin-pos-receipt-logo" alt="Bonj Cake Story" />
                <span>MASA ADİSYON FİŞİ</span>
              </div>
              <div className="admin-pos-receipt-title">
                <small>{previewReceipt.tableZone}</small>
                <strong>{previewReceipt.tableName}</strong>
                <time>{formatDateTime(previewReceipt.closedAt ?? previewReceipt.openedAt)}</time>
              </div>
              <dl className="admin-pos-receipt-meta">
                <div><dt>Açılış</dt><dd>{formatTime(previewReceipt.openedAt)}</dd></div>
                {previewReceipt.closedAt && (
                  <div><dt>Kapanış</dt><dd>{formatTime(previewReceipt.closedAt)}</dd></div>
                )}
                <div><dt>Kişi</dt><dd>{previewReceipt.guestCount}</dd></div>
                {previewReceipt.customerName && (
                  <div><dt>Müşteri</dt><dd>{previewReceipt.customerName}</dd></div>
                )}
                <div><dt>Ödeme</dt><dd>{posPaymentLabel(previewReceipt.paymentMethod)}</dd></div>
              </dl>
              <table className="admin-pos-receipt-table">
                <thead>
                  <tr>
                    <th>Adet</th>
                    <th>Ürün</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {previewReceipt.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.quantity}×</td>
                      <td>
                        {item.productName}
                        <small>{money(item.unitPriceInKurus)}</small>
                      </td>
                      <td>{money(item.lineTotalInKurus)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {previewReceipt.discountInKurus > 0 && (
                    <tr>
                      <th colSpan={2}>İndirim</th>
                      <td>−{money(previewReceipt.discountInKurus)}</td>
                    </tr>
                  )}
                  <tr>
                    <th colSpan={2}>TOPLAM</th>
                    <td><strong>{money(previewReceipt.totalInKurus)}</strong></td>
                  </tr>
                </tfoot>
              </table>
              {previewReceipt.note && (
                <div className="admin-pos-receipt-note">
                  <span>Not:</span> {previewReceipt.note}
                </div>
              )}
              <div className="admin-pos-receipt-foot">
                <small>Bonj Cake Story · Afiyet olsun</small>
              </div>
            </div>
            <div className="admin-pos-receipt-actions">
              <button type="button" className="admin-pos-primary-btn" onClick={() => window.print()}>
                Yazdır (80mm / PDF)
              </button>
              <button type="button" className="admin-pos-secondary-btn" onClick={closeReceiptPreview}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
