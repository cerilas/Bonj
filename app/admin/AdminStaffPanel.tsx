"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UiIcon } from "../components/UiIcon";

type StaffRow = {
  id: number;
  fullName: string;
  phone: string;
  role: "garson" | "komi" | string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

function formatDate(iso: string | null) {
  if (!iso) return "Henüz giriş yapmadı";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AdminStaffPanel() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"garson" | "komi">("garson");

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff", { cache: "no-store" });
      if (!res.ok) throw new Error("Personel listesi yüklenemedi.");
      const data = (await res.json()) as { staff: StaffRow[] };
      setStaff(data.staff ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Personel listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !fullName.trim() || !phone.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          role,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        smsSent?: boolean;
        smsError?: string | null;
      };
      if (!res.ok) throw new Error(data.error || "Personel eklenemedi.");
      setFullName("");
      setPhone("");
      setNotice(
        data.smsSent
          ? "Personel eklendi ve 9 haneli giriş şifresi SMS olarak gönderildi."
          : `Personel eklendi ancak SMS gönderilemedi: ${data.smsError || "Bilinmeyen hata"}`,
      );
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Personel eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(row: StaffRow) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/staff/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) throw new Error("Durum güncellenemedi.");
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Durum güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(row: StaffRow) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/admin/staff/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });
      const data = (await res.json()) as {
        error?: string;
        smsSent?: boolean;
        smsError?: string | null;
      };
      if (!res.ok) throw new Error(data.error || "Şifre sıfırlanamadı.");
      setNotice(
        data.smsSent
          ? `${row.fullName} için yeni şifre oluşturuldu ve SMS gönderildi.`
          : `Şifre sıfırlandı ancak SMS gönderilemedi: ${data.smsError || "Hata"}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şifre sıfırlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row: StaffRow) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/staff/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Personel silinemedi.");
      setNotice(`${row.fullName} silindi.`);
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Personel silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-main" id="staff">
      <header className="admin-topbar">
        <div>
          <span className="admin-eyebrow">SALON EKİBİ / GARSON &amp; KOMİ</span>
          <h1>Garson &amp;<br /><em>komi ekibi.</em></h1>
        </div>
        <Link className="admin-primary-button admin-add-button" href="/garson" target="_blank">
          Garson Giriş Ekranı <span aria-hidden="true"><UiIcon name="arrow-up-right" /></span>
        </Link>
      </header>

      <div className="admin-staff-wrap">
        <form className="admin-staff-form" onSubmit={handleCreate}>
          <div>
            <h3>Yeni Garson / Komi Ekle</h3>
            <p>Kayıt edildiğinde telefon numarasına otomatik 9 haneli giriş şifresi SMS ile gönderilir.</p>
          </div>
          <div className="admin-staff-fields">
            <input
              type="text"
              placeholder="Ad Soyad (Örn: Ahmet Yılmaz)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <input
              type="tel"
              placeholder="Telefon (Örn: 05XX XXX XX XX)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value === "komi" ? "komi" : "garson")}
            >
              <option value="garson">Garson</option>
              <option value="komi">Komi</option>
            </select>
            <button type="submit" className="admin-pos-primary-btn" disabled={busy}>
              {busy ? "Gönderiliyor…" : "Ekle & Şifre SMS Gönder"}
            </button>
          </div>
        </form>

        {error && <p className="admin-pos-error" role="alert">{error}</p>}
        {notice && <p className="admin-pos-notice" role="status">{notice}</p>}

        <div className="admin-staff-list">
          {loading ? (
            <p className="admin-pos-empty">Personel listesi yükleniyor…</p>
          ) : staff.length === 0 ? (
            <p className="admin-pos-empty">Henüz kayıtlı garson veya komi yok.</p>
          ) : (
            staff.map((row) => (
              <div key={row.id} className={`admin-staff-card ${!row.isActive ? "is-inactive" : ""}`}>
                <div className="admin-staff-card-info">
                  <div className="admin-staff-card-title">
                    <strong>{row.fullName}</strong>
                    <span className={`admin-staff-role is-${row.role}`}>
                      {row.role === "komi" ? "Komi" : "Garson"}
                    </span>
                    {!row.isActive && <span className="admin-staff-passive">Pasif</span>}
                  </div>
                  <small>Tel: +{row.phone} · Son giriş: {formatDate(row.lastLoginAt)}</small>
                </div>
                <div className="admin-staff-card-actions">
                  <button
                    type="button"
                    onClick={() => void handleResetPassword(row)}
                    disabled={busy}
                  >
                    Yeni Şifre SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(row)}
                    disabled={busy}
                  >
                    {row.isActive ? "Pasife Al" : "Aktifleştir"}
                  </button>
                  <button
                    type="button"
                    className="admin-pos-delete-table-btn"
                    onClick={() => void handleDelete(row)}
                    disabled={busy}
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
