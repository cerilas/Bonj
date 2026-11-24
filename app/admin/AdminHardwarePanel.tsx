"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PosHardwareSettingsDTO,
  SavedMonitorSnapshot,
  SavedPrinterSnapshot,
} from "@/lib/pos-hardware";
import {
  applyLocalBridgeScreens,
  fetchLocalBridgeHardware,
  LOCAL_POS_BRIDGE_URL,
  saveLocalBridgeConfig,
  sendLocalBridgeTestPrint,
  type LocalBridgeHardwareState,
} from "@/lib/pos-hardware-client";
import { UiIcon } from "../components/UiIcon";

export function AdminHardwarePanel({
  initialSettings,
}: {
  initialSettings: PosHardwareSettingsDTO;
}) {
  const [settings, setSettings] = useState<PosHardwareSettingsDTO>(initialSettings);
  const [bridge, setBridge] = useState<LocalBridgeHardwareState | null>(null);
  const [scanning, setScanning] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingScreens, setApplyingScreens] = useState(false);
  const [printingTarget, setPrintingTarget] = useState<"cashier" | "kitchen" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Form drafts
  const [cashierScreenIndex, setCashierScreenIndex] = useState(initialSettings.cashierScreenIndex);
  const [customerScreenIndex, setCustomerScreenIndex] = useState(initialSettings.customerScreenIndex);
  const [cashierPrinterName, setCashierPrinterName] = useState(initialSettings.cashierPrinterName);
  const [kitchenPrinterName, setKitchenPrinterName] = useState(initialSettings.kitchenPrinterName);
  const [paperWidthMm, setPaperWidthMm] = useState<58 | 80>(initialSettings.paperWidthMm);
  const [autoPrintCashierOnClose, setAutoPrintCashierOnClose] = useState(
    initialSettings.autoPrintCashierOnClose,
  );
  const [autoPrintKitchenOnOrder, setAutoPrintKitchenOnOrder] = useState(
    initialSettings.autoPrintKitchenOnOrder,
  );

  function flashNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice((curr) => (curr === msg ? "" : curr)), 4500);
  }

  const refreshAll = useCallback(async () => {
    setScanning(true);
    setError("");
    try {
      const [cloudRes, localHardware] = await Promise.all([
        fetch("/api/admin/hardware", { cache: "no-store" }).then((r) =>
          r.ok ? (r.json() as Promise<{ settings?: PosHardwareSettingsDTO }>) : null,
        ),
        fetchLocalBridgeHardware(),
      ]);

      const cloud = cloudRes?.settings;
      if (cloud) {
        setSettings(cloud);
      }
      setBridge(localHardware);

      if (localHardware) {
        // Prefer cloud settings if already configured, otherwise hydrate from local Windows config
        const effectiveCashierScreen = cloud ? cloud.cashierScreenIndex : localHardware.config.cashierScreenIndex;
        const effectiveCustomerScreen = cloud ? cloud.customerScreenIndex : localHardware.config.customerScreenIndex;
        const effectiveCashierPrinter =
          cloud?.cashierPrinterName || localHardware.config.cashierPrinterName || "";
        const effectiveKitchenPrinter =
          cloud?.kitchenPrinterName || localHardware.config.kitchenPrinterName || "";
        const effectivePaper = cloud?.paperWidthMm || localHardware.config.paperWidthMm || 80;

        setCashierScreenIndex(effectiveCashierScreen);
        setCustomerScreenIndex(effectiveCustomerScreen);
        setCashierPrinterName(effectiveCashierPrinter);
        setKitchenPrinterName(effectiveKitchenPrinter);
        setPaperWidthMm(effectivePaper === 58 ? 58 : 80);

        // Save snapshot of live Windows monitors & printers into DB so remote devices can inspect status
        void fetch("/api/admin/hardware", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lastKnownMonitors: localHardware.monitors,
            lastKnownPrinters: localHardware.printers,
            agentSynced: true,
          }),
        })
          .then((r) => (r.ok ? (r.json() as Promise<{ settings?: PosHardwareSettingsDTO }>) : null))
          .then((data) => {
            if (data?.settings) setSettings(data.settings);
          })
          .catch(() => {});
      } else if (cloud) {
        setCashierScreenIndex(cloud.cashierScreenIndex);
        setCustomerScreenIndex(cloud.customerScreenIndex);
        setCashierPrinterName(cloud.cashierPrinterName);
        setKitchenPrinterName(cloud.kitchenPrinterName);
        setPaperWidthMm(cloud.paperWidthMm);
        setAutoPrintCashierOnClose(cloud.autoPrintCashierOnClose);
        setAutoPrintKitchenOnOrder(cloud.autoPrintKitchenOnOrder);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Donanım bilgileri yüklenemedi.");
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      void refreshAll();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [refreshAll]);

  const monitors: SavedMonitorSnapshot[] = useMemo(() => {
    if (bridge?.monitors?.length) return bridge.monitors;
    if (settings.lastKnownMonitors.length) return settings.lastKnownMonitors;
    return [
      {
        index: 0,
        deviceName: "\\\\.\\DISPLAY1",
        primary: true,
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        label: "Ekran 1 (Varsayılan Ana Ekran)",
      },
      {
        index: 1,
        deviceName: "\\\\.\\DISPLAY2",
        primary: false,
        width: 1920,
        height: 1080,
        x: 1920,
        y: 0,
        label: "Ekran 2 (Varsayılan İkinci Ekran)",
      },
    ];
  }, [bridge, settings.lastKnownMonitors]);

  const printers: SavedPrinterSnapshot[] = useMemo(() => {
    if (bridge?.printers?.length) return bridge.printers;
    return settings.lastKnownPrinters;
  }, [bridge, settings.lastKnownPrinters]);

  const cashierPrinterInfo = useMemo(
    () => printers.find((p) => p.name === cashierPrinterName) ?? null,
    [printers, cashierPrinterName],
  );
  const kitchenPrinterInfo = useMemo(
    () => printers.find((p) => p.name === kitchenPrinterName) ?? null,
    [printers, kitchenPrinterName],
  );

  async function handleSave(applyScreensAfter = false) {
    setSaving(true);
    if (applyScreensAfter) setApplyingScreens(true);
    setError("");
    try {
      const res = await fetch("/api/admin/hardware", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashierScreenIndex,
          customerScreenIndex,
          cashierPrinterName: cashierPrinterName.trim() || null,
          kitchenPrinterName: kitchenPrinterName.trim() || null,
          paperWidthMm,
          autoPrintCashierOnClose,
          autoPrintKitchenOnOrder,
          ...(bridge
            ? {
                lastKnownMonitors: bridge.monitors,
                lastKnownPrinters: bridge.printers,
                agentSynced: true,
              }
            : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; settings?: PosHardwareSettingsDTO };
      if (!res.ok || !data.settings) {
        throw new Error(data.error || "Ayarlar kaydedilemedi.");
      }
      setSettings(data.settings);
      window.dispatchEvent(new CustomEvent("bonj-hardware-updated", { detail: data.settings }));

      const syncedLocal = await saveLocalBridgeConfig({
        cashierScreenIndex,
        customerScreenIndex,
        cashierPrinterName: cashierPrinterName.trim(),
        kitchenPrinterName: kitchenPrinterName.trim(),
        paperWidthMm,
      });

      if (applyScreensAfter) {
        if (!syncedLocal) {
          throw new Error(
            "Ayarlar veritabanına kaydedildi ancak bu cihazda Windows Kasa Ajanı bağlı değil.",
          );
        }
        const applied = await applyLocalBridgeScreens();
        if (!applied.ok) {
          throw new Error(applied.error || "Ekranlar taşınamadı.");
        }
        flashNotice("Ekranlar seçilen monitörlere uygulandı ve ayarlar kaydedildi.");
      } else if (syncedLocal) {
        flashNotice("Donanım ayarları hem buluta hem Windows kasa bilgisayarına kaydedildi.");
      } else {
        flashNotice("Ayarlar bulut veritabanına kaydedildi (Windows Kasa Ajanı bu cihazda kapalı).");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ayarlar kaydedilemedi.");
    } finally {
      setSaving(false);
      setApplyingScreens(false);
    }
  }

  async function handleTestPrint(target: "cashier" | "kitchen") {
    const chosenName = target === "cashier" ? cashierPrinterName : kitchenPrinterName;
    if (!chosenName) {
      setError(
        target === "cashier"
          ? "Önce Kasa Yanı Termal Yazıcı seçin."
          : "Önce Mutfak Yazıcısı seçin.",
      );
      return;
    }
    setPrintingTarget(target);
    setError("");
    try {
      const result = await sendLocalBridgeTestPrint({
        target,
        printerName: chosenName,
        paperWidthMm,
      });
      if (!result.ok) {
        throw new Error(result.error || "Test fişi yazdırılamadı.");
      }
      flashNotice(
        `${target === "cashier" ? "Kasa" : "Mutfak"} test fişi "${chosenName}" yazıcısına gönderildi.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test yazdırma başarısız.");
    } finally {
      setPrintingTarget(null);
    }
  }

  return (
    <section className="admin-main" id="hardware">
      <header className="admin-topbar">
        <div>
          <span className="admin-eyebrow">KASA BİLGİSAYARI · EKRAN &amp; YAZICI</span>
          <h1>Donanım &amp;<br /><em>yazıcı yönetimi.</em></h1>
        </div>
        <button
          type="button"
          className="admin-primary-button admin-add-button"
          onClick={() => void refreshAll()}
          disabled={scanning}
        >
          {scanning ? "Taranıyor…" : "Donanımı Tara / Yenile"}
        </button>
      </header>

      {error && <p className="admin-pos-error" role="alert">{error}</p>}
      {notice && <p className="admin-pos-notice" role="status">{notice}</p>}

      <div className="admin-hw-status-grid">
        <div className={`admin-hw-status-card ${bridge ? "is-ok" : "is-warn"}`}>
          <div className="admin-hw-status-top">
            <span>Windows Kasa Ajanı</span>
            <strong className="admin-hw-pill">{bridge ? "Bağlı" : "Bağlı Değil"}</strong>
          </div>
          <p>
            {bridge
              ? `Yerel köprü aktif (${bridge.hostname ?? "Kasa PC"}) · ${LOCAL_POS_BRIDGE_URL}`
              : "Kasa bilgisayarında tek tıkla kurulum dosyasını indirip çalıştırın."}
          </p>
          <div className="admin-hw-dl-row">
            <a
              href="/downloads/BonjPOS-TekTiklaKur.bat"
              download="BonjPOS-TekTiklaKur.bat"
              className="admin-hw-mini-btn"
            >
              Tek Tıkla Kur (.bat) <UiIcon name="arrow-down" />
            </a>
            <a
              href="/downloads/BonjPOS-Windows.zip"
              download="BonjPOS-Windows.zip"
              className="admin-hw-mini-btn"
            >
              ZIP Paketi <UiIcon name="arrow-down" />
            </a>
          </div>
        </div>

        <div
          className={`admin-hw-status-card ${
            !cashierPrinterName
              ? "is-neutral"
              : cashierPrinterInfo?.isOnline
                ? "is-ok"
                : "is-warn"
          }`}
        >
          <div className="admin-hw-status-top">
            <span>Kasa Yanı Termal Yazıcı</span>
            <strong className="admin-hw-pill">
              {!cashierPrinterName
                ? "Seçilmedi"
                : cashierPrinterInfo
                  ? cashierPrinterInfo.isOnline
                    ? "Bağlı / Hazır"
                    : cashierPrinterInfo.statusText
                  : "Kayıtlı"}
            </strong>
          </div>
          <p>
            {cashierPrinterName
              ? `${cashierPrinterName}${cashierPrinterInfo?.portName ? ` · ${cashierPrinterInfo.portName}` : ""}`
              : "Aşağıdan kasa adisyon yazıcısını seçin."}
          </p>
          <button
            type="button"
            className="admin-hw-mini-btn"
            onClick={() => void handleTestPrint("cashier")}
            disabled={!bridge || !cashierPrinterName || printingTarget !== null}
          >
            {printingTarget === "cashier" ? "Yazdırılıyor…" : "Kasa Test Fişi Yazdır"}
          </button>
        </div>

        <div
          className={`admin-hw-status-card ${
            !kitchenPrinterName
              ? "is-neutral"
              : kitchenPrinterInfo?.isOnline
                ? "is-ok"
                : "is-warn"
          }`}
        >
          <div className="admin-hw-status-top">
            <span>Mutfak Yazıcısı</span>
            <strong className="admin-hw-pill">
              {!kitchenPrinterName
                ? "Seçilmedi"
                : kitchenPrinterInfo
                  ? kitchenPrinterInfo.isOnline
                    ? "Bağlı / Hazır"
                    : kitchenPrinterInfo.statusText
                  : "Kayıtlı"}
            </strong>
          </div>
          <p>
            {kitchenPrinterName
              ? `${kitchenPrinterName}${kitchenPrinterInfo?.portName ? ` · ${kitchenPrinterInfo.portName}` : ""}`
              : "Aşağıdan mutfak sipariş yazıcısını seçin."}
          </p>
          <button
            type="button"
            className="admin-hw-mini-btn"
            onClick={() => void handleTestPrint("kitchen")}
            disabled={!bridge || !kitchenPrinterName || printingTarget !== null}
          >
            {printingTarget === "kitchen" ? "Yazdırılıyor…" : "Mutfak Test Fişi Yazdır"}
          </button>
        </div>
      </div>

      <div className="admin-hw-sections">
        <section className="admin-hw-panel">
          <div className="admin-hw-panel-head">
            <div>
              <h2>Çift Ekran Yerleşimi</h2>
              <p>
                Bilgisayar açıldığında hangi monitörde Admin POS, hangi monitörde Müşteri Ekranı
                açılacağını seçin.
              </p>
            </div>
            <button
              type="button"
              className="admin-pos-secondary-btn"
              onClick={() => {
                setCashierScreenIndex(customerScreenIndex);
                setCustomerScreenIndex(cashierScreenIndex);
              }}
            >
              Ekranları Ters Çevir
            </button>
          </div>

          <div className="admin-hw-monitor-list">
            {monitors.map((m) => {
              const isCashier = m.index === cashierScreenIndex;
              const isCustomer = m.index === customerScreenIndex;
              return (
                <div
                  key={`${m.index}-${m.deviceName}`}
                  className={`admin-hw-monitor-card ${isCashier ? "is-cashier" : ""} ${isCustomer ? "is-customer" : ""}`}
                >
                  <div className="admin-hw-monitor-head">
                    <strong>Ekran {m.index + 1}</strong>
                    {m.primary && <small>Windows Ana Ekranı</small>}
                  </div>
                  <div className="admin-hw-monitor-meta">
                    <span>{m.width} × {m.height}</span>
                    <span>Konum: {m.x}, {m.y}</span>
                  </div>
                  <div className="admin-hw-monitor-roles">
                    {isCashier && <em className="is-cashier">Kasa / Admin</em>}
                    {isCustomer && <em className="is-customer">Müşteri Ekranı</em>}
                    {!isCashier && !isCustomer && <em className="is-idle">Atanmadı</em>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="admin-hw-form-row">
            <label>
              <span>Kasa / Admin Ekranı</span>
              <select
                value={cashierScreenIndex}
                onChange={(e) => setCashierScreenIndex(Number(e.target.value))}
              >
                {monitors.map((m) => (
                  <option key={m.index} value={m.index}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Müşteri Ekranı (2. Ekran)</span>
              <select
                value={customerScreenIndex}
                onChange={(e) => setCustomerScreenIndex(Number(e.target.value))}
              >
                {monitors.map((m) => (
                  <option key={m.index} value={m.index}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-hw-actions">
            <button
              type="button"
              className="admin-pos-primary-btn"
              onClick={() => void handleSave(true)}
              disabled={saving || applyingScreens || !bridge}
            >
              {applyingScreens ? "Ekranlar Uygulanıyor…" : "Kaydet ve Ekranları Şimdi Taşı"}
            </button>
          </div>
        </section>

        <section className="admin-hw-panel">
          <div className="admin-hw-panel-head">
            <div>
              <h2>Termal Yazıcı Atamaları</h2>
              <p>
                Kasa yanı adisyon yazıcısını ve mutfak sipariş yazıcısını seçin. Windows ajanı bağlı
                olduğunda yazdırma penceresi açmadan doğrudan fiş çıkarır.
              </p>
            </div>
          </div>

          <div className="admin-hw-form-row">
            <label>
              <span>Kasa Yanı Termal Yazıcı</span>
              <select
                value={cashierPrinterName}
                onChange={(e) => setCashierPrinterName(e.target.value)}
              >
                <option value="">— Seçili değil (Tarayıcı Yazdırma) —</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.isOnline ? "●" : "○"} {p.name} ({p.statusText})
                  </option>
                ))}
                {cashierPrinterName && !printers.some((p) => p.name === cashierPrinterName) && (
                  <option value={cashierPrinterName}>{cashierPrinterName} (Kayıtlı)</option>
                )}
              </select>
            </label>

            <label>
              <span>Mutfak Yazıcısı</span>
              <select
                value={kitchenPrinterName}
                onChange={(e) => setKitchenPrinterName(e.target.value)}
              >
                <option value="">— Seçili değil —</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.isOnline ? "●" : "○"} {p.name} ({p.statusText})
                  </option>
                ))}
                {kitchenPrinterName && !printers.some((p) => p.name === kitchenPrinterName) && (
                  <option value={kitchenPrinterName}>{kitchenPrinterName} (Kayıtlı)</option>
                )}
              </select>
            </label>
          </div>

          <div className="admin-hw-form-row">
            <label>
              <span>Termal Kağıt Genişliği</span>
              <select
                value={paperWidthMm}
                onChange={(e) => setPaperWidthMm(Number(e.target.value) === 58 ? 58 : 80)}
              >
                <option value={80}>80mm (Standart Kasa / Mutfak Rulosu)</option>
                <option value={58}>58mm (Dar Rulo)</option>
              </select>
            </label>

            <div className="admin-hw-toggles">
              <label className="admin-hw-check">
                <input
                  type="checkbox"
                  checked={autoPrintCashierOnClose}
                  onChange={(e) => setAutoPrintCashierOnClose(e.target.checked)}
                />
                <span>&quot;Kapat &amp; Fiş Yazdır&quot; işleminde kasa yazıcısından direkt bas</span>
              </label>
              <label className="admin-hw-check">
                <input
                  type="checkbox"
                  checked={autoPrintKitchenOnOrder}
                  onChange={(e) => setAutoPrintKitchenOnOrder(e.target.checked)}
                />
                <span>Masaya ürün eklendiğinde mutfak yazıcısına otomatik fiş gönder</span>
              </label>
            </div>
          </div>

          <div className="admin-hw-actions">
            <button
              type="button"
              className="admin-pos-primary-btn"
              onClick={() => void handleSave(false)}
              disabled={saving}
            >
              {saving ? "Kaydediliyor…" : "Donanım Ayarlarını Kaydet"}
            </button>
          </div>

          <div className="admin-hw-printers-table-wrap">
            <h3>Algılanan Windows Yazıcıları ({printers.length})</h3>
            {printers.length === 0 ? (
              <p className="admin-pos-empty">
                Henüz yazıcı algılanmadı. Kasa bilgisayarında &quot;Donanımı Tara / Yenile&quot;
                butonuna basın.
              </p>
            ) : (
              <div className="admin-hw-printer-list">
                {printers.map((p) => (
                  <div key={p.name} className={`admin-hw-printer-row ${p.isOnline ? "is-online" : "is-offline"}`}>
                    <div className="admin-hw-printer-info">
                      <div className="admin-hw-printer-title">
                        <strong>{p.name}</strong>
                        {p.isThermalLikely && <span className="admin-hw-tag">Termal</span>}
                        {p.isDefault && <span className="admin-hw-tag is-muted">Varsayılan</span>}
                      </div>
                      <small>
                        Port: {p.portName || "—"} · Sürücü: {p.driverName || "—"}
                      </small>
                    </div>
                    <div className="admin-hw-printer-right">
                      <span className={`admin-hw-online-badge ${p.isOnline ? "is-ok" : "is-bad"}`}>
                        <i aria-hidden="true" />
                        {p.statusText}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCashierPrinterName(p.name)}
                        className={cashierPrinterName === p.name ? "is-selected" : ""}
                      >
                        Kasa Yap
                      </button>
                      <button
                        type="button"
                        onClick={() => setKitchenPrinterName(p.name)}
                        className={kitchenPrinterName === p.name ? "is-selected" : ""}
                      >
                        Mutfak Yap
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {settings.lastAgentSyncAt && (
        <p className="admin-hw-sync-foot">
          <UiIcon name="check" /> Son Windows kasa bilgisayarı senkronizasyonu:{" "}
          {new Intl.DateTimeFormat("tr-TR", {
            dateStyle: "short",
            timeStyle: "medium",
          }).format(new Date(settings.lastAgentSyncAt))}
        </p>
      )}
    </section>
  );
}
