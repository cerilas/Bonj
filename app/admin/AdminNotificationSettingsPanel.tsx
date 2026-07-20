"use client";

import { useState } from "react";
import type {
  AdminNotificationSettings,
  NotificationType,
} from "@/lib/admin-notification-settings";
import { UiIcon } from "../components/UiIcon";

const settingCards: Array<{
  type: NotificationType;
  index: string;
  title: string;
  description: string;
}> = [
  {
    type: "orders",
    index: "01",
    title: "Sipariş bildirimleri",
    description: "Yeni masa veya gel-al siparişi oluşturulduğunda kullanılacak numara.",
  },
  {
    type: "contact",
    index: "02",
    title: "İletişim formu bildirimleri",
    description: "İş birliği, soru, öneri veya şikâyet mesajlarında kullanılacak numara.",
  },
  {
    type: "catering",
    index: "03",
    title: "Catering talepleri",
    description: "Yeni organizasyon ve catering talebi geldiğinde kullanılacak numara.",
  },
  {
    type: "dailySummary",
    index: "04",
    title: "Günlük özet bildirimleri",
    description: "Gün içindeki sipariş ve talep özetlerinin gönderileceği numara.",
  },
];

function phoneDisplay(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("90")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)];
  return groups.filter(Boolean).join(" ");
}

export function AdminNotificationSettingsPanel({
  initialSettings,
  cronEndpointUrl,
}: {
  initialSettings: AdminNotificationSettings;
  cronEndpointUrl: string;
}) {
  const [settings, setSettings] = useState<AdminNotificationSettings>(() =>
    Object.fromEntries(
      Object.entries(initialSettings).map(([key, phones]) => [key, phones.map(phoneDisplay)]),
    ) as AdminNotificationSettings,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [cronCopied, setCronCopied] = useState(false);
  const [drafts, setDrafts] = useState<Record<NotificationType, string>>({
    orders: "",
    contact: "",
    catering: "",
    dailySummary: "",
  });
  const [inputErrors, setInputErrors] = useState<Partial<Record<NotificationType, string>>>({});
  const [testStates, setTestStates] = useState<Record<string, {
    status: "sending" | "sent" | "error";
    message: string;
  }>>({});

  function updateDraft(type: NotificationType, value: string) {
    setMessage("");
    setDrafts((current) => ({ ...current, [type]: phoneDisplay(value) }));
    setInputErrors((current) => ({ ...current, [type]: "" }));
  }

  function addPhone(type: NotificationType) {
    const phone = phoneDisplay(drafts[type]);
    if (phone.replace(/\D/g, "").length !== 10) {
      setInputErrors((current) => ({ ...current, [type]: "Geçerli bir cep telefonu numarası yazın." }));
      return;
    }
    if (settings[type].includes(phone)) {
      setInputErrors((current) => ({ ...current, [type]: "Bu numara zaten listede." }));
      return;
    }
    if (settings[type].length >= 10) {
      setInputErrors((current) => ({ ...current, [type]: "En fazla 10 alıcı ekleyebilirsiniz." }));
      return;
    }
    setSettings((current) => ({ ...current, [type]: [...current[type], phone] }));
    setDrafts((current) => ({ ...current, [type]: "" }));
    setInputErrors((current) => ({ ...current, [type]: "" }));
    setMessage("");
  }

  function removePhone(type: NotificationType, phone: string) {
    setSettings((current) => ({
      ...current,
      [type]: current[type].filter((item) => item !== phone),
    }));
    setTestStates((current) => {
      const next = { ...current };
      delete next[`${type}:${phone}`];
      return next;
    });
    setMessage("");
  }

  async function sendTest(type: NotificationType, phone: string) {
    const key = `${type}:${phone}`;

    setTestStates((current) => ({
      ...current,
      [key]: { status: "sending", message: "Gönderiliyor…" },
    }));

    try {
      const response = await fetch("/api/admin/notification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, phone }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      setTestStates((current) => ({
        ...current,
        [key]: response.ok
          ? { status: "sent", message: result.message ?? "Test SMS’i gönderildi." }
          : { status: "error", message: result.error ?? "Test SMS’i gönderilemedi." },
      }));
    } catch {
      setTestStates((current) => ({
        ...current,
        [key]: { status: "error", message: "SMS servisine ulaşılamadı." },
      }));
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/admin/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const result = (await response.json()) as {
        settings?: AdminNotificationSettings;
        error?: string;
      };

      if (!response.ok) {
        setIsError(true);
        setMessage(result.error ?? "Bildirim ayarları kaydedilemedi.");
        return;
      }

      if (result.settings) {
        setSettings(
          Object.fromEntries(
            Object.entries(result.settings).map(([key, values]) => [
              key,
              values.map(phoneDisplay),
            ]),
          ) as AdminNotificationSettings,
        );
      }
      setMessage("Bildirim numaraları veritabanına kaydedildi.");
    } catch {
      setIsError(true);
      setMessage("Sunucuya ulaşılamadı. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  const configuredCount = Object.values(settings).reduce((total, phones) => total + phones.length, 0);

  async function copyCronUrl() {
    try {
      await navigator.clipboard.writeText(cronEndpointUrl);
      setCronCopied(true);
      window.setTimeout(() => setCronCopied(false), 1800);
    } catch {
      setMessage("Cron URL’si kopyalanamadı; adresi seçerek kopyalayabilirsin.");
      setIsError(true);
    }
  }

  return (
    <section className="admin-main admin-notification-settings" id="notification-settings">
      <header className="admin-topbar">
        <div>
          <span className="admin-eyebrow">SİSTEM / BİLDİRİM MERKEZİ</span>
          <h1>Haberdar<br /><em>kal.</em></h1>
        </div>
        <div className="admin-notification-summary" aria-label="Bildirim ayarları özeti">
          <span>Tanımlı alıcı</span>
          <strong>{configuredCount.toString().padStart(2, "0")}<small>SMS</small></strong>
        </div>
      </header>

      <form onSubmit={save}>
        <div className="admin-notification-intro">
          <div>
            <span>SMS ALICILARI</span>
            <h2>Hangi bildirim kime ulaşsın?</h2>
          </div>
          <p>Her bildirim türüne birden fazla alıcı ekleyebilirsin. Listesi boş bırakılan bildirim türü için SMS gönderilmez.</p>
        </div>

        <div className="admin-notification-grid">
          {settingCards.map((card) => {
            return (
            <article className="admin-notification-card" key={card.type}>
              <span className="admin-notification-card-index">{card.index}</span>
              <span className="admin-notification-card-copy">
                <strong>{card.title}</strong>
                <small>{card.description}</small>
              </span>
              {card.type === "dailySummary" && (
                <div className="admin-cron-config">
                  <div className="admin-cron-config-heading">
                    <span>CRON-JOB.ORG AYARI</span>
                    <i>Her gün · 23:55 · Europe/Istanbul</i>
                  </div>
                  <div className="admin-cron-url">
                    <small>İSTEK URL’Sİ</small>
                    <code>{cronEndpointUrl}</code>
                    <button type="button" onClick={() => void copyCronUrl()}>{cronCopied ? <><UiIcon name="check" /> Kopyalandı</> : "Kopyala"}</button>
                  </div>
                  <div className="admin-cron-meta">
                    <span><small>İSTEK TÜRÜ</small><strong>POST</strong></span>
                    <span><small>GEREKLİ HEADER</small><code>Authorization: Bearer CRON_SECRET</code></span>
                  </div>
                  <p>Railway değişkenlerine uzun ve rastgele bir <strong>CRON_SECRET</strong> ekle; cron-job.org’daki Authorization header’ında aynı değeri <strong>Bearer </strong> ön ekiyle kullan.</p>
                </div>
              )}
              <div className="admin-notification-recipients">
                {settings[card.type].map((phone) => {
                  const testState = testStates[`${card.type}:${phone}`];
                  return (
                    <div className={`admin-notification-recipient ${testState?.status ? `is-${testState.status}` : ""}`} key={phone}>
                      <strong><i>+90</i> {phone}</strong>
                      <button type="button" onClick={() => void sendTest(card.type, phone)} disabled={testState?.status === "sending"}>
                        {testState?.status === "sending" ? "Gönderiliyor" : "Test et"}
                      </button>
                      <button type="button" onClick={() => removePhone(card.type, phone)} aria-label={`${phone} numarasını kaldır`}><UiIcon name="close" /></button>
                      {testState?.message && <small role="status" aria-live="polite">{testState.message}</small>}
                    </div>
                  );
                })}
                {!settings[card.type].length && <p>Henüz alıcı eklenmedi.</p>}
              </div>
              <div className="admin-notification-add">
                <span className="admin-notification-phone">
                  <i aria-hidden="true">+90</i>
                  <input
                    type="tel"
                    name={`${card.type}-new`}
                    value={drafts[card.type]}
                    onChange={(event) => updateDraft(card.type, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addPhone(card.type);
                      }
                    }}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="5xx xxx xx xx"
                    maxLength={13}
                    aria-label={`${card.title} için yeni telefon numarası`}
                  />
                </span>
                <button type="button" onClick={() => addPhone(card.type)}>Numara ekle <i aria-hidden="true"><UiIcon name="plus" /></i></button>
                {inputErrors[card.type] && <small role="alert">{inputErrors[card.type]}</small>}
              </div>
            </article>
          );})}
        </div>

        <div className="admin-notification-actions">
          <div className={`admin-notification-notice ${isError ? "is-error" : ""}`} role="status" aria-live="polite">
            {message || "Numaralar Türkiye formatında 05xx xxx xx xx olarak kaydedilir."}
          </div>
          <button className="admin-primary-button" type="submit" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Ayarları kaydet"}<span aria-hidden="true"><UiIcon name="arrow-up-right" /></span>
          </button>
        </div>
      </form>
    </section>
  );
}
