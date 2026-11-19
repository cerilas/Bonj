"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StaffIdentity } from "@/lib/staff-auth";
import { AdminTablesPanel, posPaymentLabel, type PosPrintReceiptData } from "../admin/AdminTablesPanel";
import { BrandLogo } from "../components/BrandLogo";
import { UiIcon } from "../components/UiIcon";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function money(kurus: number) {
  return `${(kurus / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

export function GarsonExperience({ initialStaff }: { initialStaff: StaffIdentity | null }) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffIdentity | null>(initialStaff);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [printReceipt, setPrintReceipt] = useState<PosPrintReceiptData | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = (await res.json()) as { error?: string; staff?: StaffIdentity };
      if (!res.ok || !data.staff) {
        throw new Error(data.error || "Giriş yapılamadı.");
      }
      setStaff(data.staff);
      setPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/staff/logout", { method: "POST" });
    setStaff(null);
    router.refresh();
  }

  if (!staff) {
    return (
      <main className="garson-login-page">
        <div className="garson-login-card">
          <Link href="/" className="garson-login-brand">
            <BrandLogo className="garson-login-logo" alt="Bonj Cake Story" />
          </Link>
          <span className="admin-eyebrow">SALON EKİBİ GİRİŞİ</span>
          <h1>Garson &amp; Komi Girişi</h1>
          <p>Telefon numaranız ve SMS ile gönderilen şifrenizle giriş yapın.</p>

          <form onSubmit={handleLogin} className="garson-login-form">
            <label>
              <span>Telefon Numarası</span>
              <input
                type="tel"
                inputMode="tel"
                placeholder="05XX XXX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
            <label>
              <span>Şifre</span>
              <input
                type="password"
                placeholder="SMS ile gelen şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className="admin-pos-error" role="alert">{error}</p>}
            <button type="submit" className="admin-pos-primary-btn" disabled={loading}>
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-dashboard garson-dashboard">
      <header className="garson-topbar">
        <div className="garson-topbar-left">
          <BrandLogo className="garson-topbar-logo" alt="Bonj Cake Story" />
          <div>
            <strong>{staff.fullName}</strong>
            <span className={`admin-staff-role is-${staff.role}`}>
              {staff.role === "komi" ? "Komi" : "Garson"}
            </span>
          </div>
        </div>
        <button type="button" className="garson-logout-btn" onClick={() => void handleLogout()}>
          Çıkış <UiIcon name="logout" />
        </button>
      </header>

      <section className="admin-main garson-main">
        <AdminTablesPanel staffMode onPrintReceiptChange={setPrintReceipt} />
      </section>

      {printReceipt && (
        <section className="admin-order-print">
          <header>
            <div><BrandLogo className="admin-print-logo" /></div>
            <p>MASA ADİSYON FİŞİ</p>
          </header>
          <div className="admin-order-print-code">
            <span>{printReceipt.tableZone}</span>
            <strong>{printReceipt.tableName}</strong>
            <time>{formatDateTime(printReceipt.closedAt ?? printReceipt.openedAt)}</time>
          </div>
          <dl>
            <div><dt>Kişi</dt><dd>{printReceipt.guestCount}</dd></div>
            {printReceipt.customerName && (
              <div><dt>Müşteri</dt><dd>{printReceipt.customerName}</dd></div>
            )}
            <div><dt>Ödeme</dt><dd>{posPaymentLabel(printReceipt.paymentMethod)}</dd></div>
          </dl>
          <table>
            <thead>
              <tr>
                <th>Adet</th>
                <th>Ürün</th>
                <th>Tutar</th>
              </tr>
            </thead>
            <tbody>
              {printReceipt.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.quantity}×</td>
                  <td>
                    {item.productName}
                    <small>{money(item.unitPriceInKurus)} / adet</small>
                  </td>
                  <td>{money(item.lineTotalInKurus)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {printReceipt.discountInKurus > 0 && (
                <tr>
                  <th colSpan={2}>İndirim</th>
                  <td>−{money(printReceipt.discountInKurus)}</td>
                </tr>
              )}
              <tr>
                <th colSpan={2}>Toplam</th>
                <td><strong>{money(printReceipt.totalInKurus)}</strong></td>
              </tr>
            </tfoot>
          </table>
          {printReceipt.note && (
            <div className="admin-order-print-note">
              <span>Not</span>
              <p>{printReceipt.note}</p>
            </div>
          )}
          <footer>
            <small>Bonj Cake Story</small>
            <small>Afiyet olsun</small>
          </footer>
        </section>
      )}
    </main>
  );
}
