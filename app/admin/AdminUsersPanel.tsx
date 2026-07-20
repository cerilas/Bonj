"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminUser } from "@/lib/admin-users";
import { UiIcon } from "../components/UiIcon";

type UserForm = {
  id?: number;
  name: string;
  email: string;
  phone: string;
  password: string;
  isActive: boolean;
};

export type AdminConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  isActive: true,
};

function userDate(value: string | null) {
  if (!value) return "Henüz giriş yapmadı";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminUsersPanel({
  currentUserId,
  initialUsers,
  onRequestConfirmation,
}: {
  currentUserId: number;
  initialUsers: AdminUser[];
  onRequestConfirmation: (request: AdminConfirmationRequest) => void;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsNotice, setSmsNotice] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    if (response.status === 401) {
      router.refresh();
      return;
    }
    const result = (await response.json()) as { users?: AdminUser[]; error?: string };
    if (!response.ok) {
      setNotice(result.error ?? "Kullanıcılar yüklenemedi.");
      setLoading(false);
      return;
    }
    setUsers(result.users ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!editorOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setEditorOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [editorOpen, saving]);

  const summary = useMemo(() => ({
    active: users.filter((user) => user.isActive).length,
    passive: users.filter((user) => !user.isActive).length,
    total: users.length,
  }), [users]);

  function openNewUser() {
    setForm(emptyForm);
    setError("");
    setSmsNotice("");
    setEditorOpen(true);
  }

  function openUser(user: AdminUser) {
    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      password: "",
      isActive: user.isActive,
    });
    setError("");
    setSmsNotice("");
    setEditorOpen(true);
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const response = await fetch(
      form.id ? `/api/admin/users/${form.id}` : "/api/admin/users",
      {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      },
    );
    const result = (await response.json()) as { error?: string; signedOut?: boolean };
    if (!response.ok) {
      setError(result.error ?? "Kullanıcı kaydedilemedi.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditorOpen(false);
    if (result.signedOut) {
      router.refresh();
      return;
    }
    await loadUsers();
    setNotice(form.id ? "Kullanıcı bilgileri güncellendi." : "Yeni yönetici erişimi oluşturuldu.");
  }

  async function toggleUser(user: AdminUser) {
    setNotice("");
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        isActive: !user.isActive,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(result.error ?? "Kullanıcı durumu değiştirilemedi.");
      return;
    }
    await loadUsers();
    setNotice(user.isActive ? "Kullanıcının panel erişimi kapatıldı." : "Kullanıcının panel erişimi açıldı.");
  }

  async function sendAccessSms() {
    if (!form.id || smsSending) return;
    if (form.password) {
      setError("SMS gönderirken sistem güvenli bir yeni parola üretir. Yeni parola alanını boş bırakın.");
      return;
    }

    setSmsSending(true);
    setError("");
    setSmsNotice("");

    try {
      const saveResponse = await fetch(`/api/admin/users/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          isActive: form.isActive,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const saveResult = (await saveResponse.json().catch(() => null)) as { error?: string } | null;
      if (!saveResponse.ok) {
        setError(saveResult?.error ?? "Kullanıcı bilgileri kaydedilemedi.");
        return;
      }

      const smsResponse = await fetch(`/api/admin/users/${form.id}/access-sms`, {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
      });
      const smsResult = (await smsResponse.json().catch(() => null)) as
        | { error?: string; message?: string; signedOut?: boolean }
        | null;
      if (!smsResponse.ok) {
        setError(smsResult?.error ?? "Giriş bilgileri SMS ile gönderilemedi.");
        return;
      }

      if (smsResult?.signedOut) {
        router.refresh();
        return;
      }
      await loadUsers();
      setSmsNotice(smsResult?.message ?? "Giriş bilgileri SMS ile gönderildi.");
    } catch (requestError) {
      const timedOut = requestError instanceof DOMException
        && (requestError.name === "TimeoutError" || requestError.name === "AbortError");
      setError(timedOut
        ? "SMS servisi zaman aşımına uğradı. Lütfen tekrar deneyin."
        : "SMS servisine ulaşılamadı. Lütfen bağlantıyı kontrol edip tekrar deneyin.");
    } finally {
      setSmsSending(false);
    }
  }

  function removeUser(user: AdminUser) {
    onRequestConfirmation({
      title: `“${user.name}” silinsin mi?`,
      description: `${user.email} hesabı ve bu hesaba ait açık oturumlar kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmLabel: "Kullanıcıyı sil",
      action: async () => {
        const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Kullanıcı silinemedi.");
        await loadUsers();
        setNotice("Kullanıcı erişimi kalıcı olarak silindi.");
      },
    });
  }

  return (
    <section className="admin-main admin-users-main" id="users">
      <header className="admin-topbar">
        <div>
          <span className="admin-eyebrow">ERİŞİM / YÖNETİCİLER</span>
          <h1>Panel<br /><em>ekibi.</em></h1>
        </div>
        <button className="admin-primary-button admin-add-button" type="button" onClick={openNewUser}>
          <span aria-hidden="true"><UiIcon name="plus" /></span> Yeni kullanıcı
        </button>
      </header>

      <div className="admin-stats" aria-label="Kullanıcı özeti">
        <div><span>Aktif kullanıcı</span><strong>{summary.active.toString().padStart(2, "0")}</strong></div>
        <div><span>Pasif kullanıcı</span><strong>{summary.passive.toString().padStart(2, "0")}</strong></div>
        <div><span>Toplam kullanıcı</span><strong>{summary.total.toString().padStart(2, "0")}</strong></div>
      </div>

      <div className="admin-user-security-note">
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" />
            <rect x="5" y="10" width="14" height="10" rx="2.5" />
            <path d="M12 14v2.5" />
          </svg>
        </span>
        <p><strong>Panel erişimi</strong> Aktif kullanıcılar kendi e-posta ve parolalarıyla <b>/admin</b> adresinden giriş yapabilir.</p>
      </div>

      {notice && (
        <div className="admin-category-notice admin-user-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Bildirimi kapat"><UiIcon name="close" /></button>
        </div>
      )}

      <div className={`admin-user-list ${loading ? "is-loading" : ""}`} aria-busy={loading}>
        <div className="admin-user-list-head">
          <span>Kullanıcı</span><span>Panel erişimi</span><span>Son giriş</span><span>Eklenme</span><span>İşlem</span>
        </div>
        {users.map((user) => {
          const isCurrent = user.id === currentUserId;
          return (
            <article className={`admin-user-row ${!user.isActive ? "is-passive" : ""}`} key={user.id}>
              <div className="admin-user-identity">
                <i>{user.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</i>
                <div>
                  <strong>{user.name} {isCurrent && <small>Sen</small>}</strong>
                  <span>{user.email}{user.phone ? ` · ${user.phone}` : ""}</span>
                </div>
              </div>
              <button
                className={`admin-toggle admin-user-toggle ${user.isActive ? "is-on" : ""}`}
                type="button"
                onClick={() => void toggleUser(user)}
                disabled={isCurrent}
                aria-label={`${user.name} kullanıcısını ${user.isActive ? "pasife" : "aktife"} al`}
                aria-pressed={user.isActive}
              ><i /><span>{user.isActive ? "Aktif" : "Pasif"}</span></button>
              <div className="admin-user-date"><strong>{userDate(user.lastLoginAt)}</strong><small>{user.lastLoginAt ? "Son başarılı oturum" : "—"}</small></div>
              <div className="admin-user-date"><strong>{userDate(user.createdAt)}</strong><small>Hesap oluşturma</small></div>
              <div className="admin-user-actions">
                <button type="button" onClick={() => openUser(user)}>Düzenle <span aria-hidden="true"><UiIcon name="arrow-up-right" /></span></button>
                <button className="is-danger" type="button" onClick={() => removeUser(user)} disabled={isCurrent} aria-label={`${user.name} kullanıcısını sil`}><UiIcon name="close" /></button>
              </div>
            </article>
          );
        })}
        {!users.length && !loading && <div className="admin-empty">Henüz yönetici kullanıcısı bulunmuyor.</div>}
      </div>

      {editorOpen && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && !saving && setEditorOpen(false)}
        >
          <form className="admin-editor admin-user-editor" onSubmit={saveUser}>
            <header>
              <div>
                <span className="admin-eyebrow">ERİŞİM KARTI</span>
                <h2>{form.id ? "Kullanıcıyı düzenle" : "Yeni kullanıcı ekle"}</h2>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} disabled={saving} aria-label="Pencereyi kapat"><UiIcon name="close" /></button>
            </header>

            <div className="admin-user-editor-body">
              <div className="admin-user-editor-mark" aria-hidden="true">
                <span>{(form.name || "B").slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                <small>BONJ / ADMIN</small>
              </div>
              <div className="admin-fields">
                <label>Ad soyad *<input required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Örn. Deniz Yılmaz" /></label>
                <label>E-posta adresi *<input required type="email" maxLength={180} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="isim@bonj.com" /></label>
                <label>Telefon numarası<input type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="05xx xxx xx xx" /></label>
                <label>{form.id ? "Yeni parola" : "Parola *"}<input required={!form.id} minLength={8} maxLength={200} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={form.id ? "Değişmeyecekse boş bırakın" : "En az 8 karakter"} /></label>
                {form.id === currentUserId && form.password && <p className="admin-editor-hint">Kendi parolanızı değiştirdiğinizde güvenlik için yeniden giriş yapmanız gerekir.</p>}
                <button
                  className={`admin-user-access-card ${form.isActive ? "is-on" : ""}`}
                  type="button"
                  disabled={form.id === currentUserId}
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  aria-pressed={form.isActive}
                >
                  <span><i /><strong>Panel erişimi</strong><small>{form.isActive ? "Bu kullanıcı giriş yapabilir" : "Bu kullanıcının girişi kapalı"}</small></span>
                  <b>{form.isActive ? "Aktif" : "Pasif"}</b>
                </button>
                {form.id && (
                  <div className="admin-user-sms-card">
                    <span aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="5" width="18" height="14" rx="3" />
                        <path d="m5.5 8 6.5 5 6.5-5" />
                      </svg>
                    </span>
                    <div>
                      <strong>Giriş bilgilerini SMS ile gönder</strong>
                      <small>Site adresi, e-posta ve sistemin ürettiği yeni parola kayıtlı telefona gönderilir.</small>
                    </div>
                    <button type="button" disabled={smsSending || saving || !form.phone || !form.isActive} onClick={() => void sendAccessSms()}>
                      {smsSending ? "Gönderiliyor…" : "SMS gönder"}<i aria-hidden="true"><UiIcon name="arrow-up-right" /></i>
                    </button>
                    {smsNotice && <p role="status">{smsNotice}</p>}
                  </div>
                )}
              </div>
            </div>

            {error && <div className="admin-form-error" role="alert">{error}</div>}
            <footer>
              <button type="button" onClick={() => setEditorOpen(false)} disabled={saving}>Vazgeç</button>
              <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Kullanıcıyı kaydet"}<span><UiIcon name="arrow-up-right" /></span></button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
