"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "../components/BrandLogo";
import { UiIcon } from "../components/UiIcon";

export function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error ?? "Giriş yapılamadı.");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-art" aria-hidden="true">
        <span className="login-orbit login-orbit-one" />
        <span className="login-orbit login-orbit-two" />
        <div className="login-monogram"><BrandLogo className="admin-login-logo bonj-brand-logo--light" alt="" priority /></div>
        <p>CAKE STORY / GAZİANTEP</p>
      </section>
      <section className="admin-login-panel">
        <Link className="admin-back-link" href="/"><UiIcon name="arrow-left" /> Siteye dön</Link>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <span className="admin-eyebrow"><BrandLogo className="admin-eyebrow-logo" alt="" /> <b>/ YÖNETİM</b></span>
          <h1>Menü<br /><em>kontrolü.</em></h1>
          <p>Ürünleri, fiyatları ve QR menüyü tek yerden yönet.</p>

          <label>
            E-posta
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Parola
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          {error && <div className="admin-form-error" role="alert">{error}</div>}
          <button className="admin-primary-button" type="submit" disabled={loading}>
            {loading ? "Kontrol ediliyor…" : "Panele gir"}
            <span aria-hidden="true"><UiIcon name="arrow-up-right" /></span>
          </button>
        </form>
      </section>
    </main>
  );
}
