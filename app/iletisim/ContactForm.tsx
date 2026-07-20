"use client";

import { useState } from "react";

const topics = [
  { value: "collaboration", index: "01", title: "İş birliği", note: "Birlikte üretelim" },
  { value: "question", index: "02", title: "Bir soru", note: "Aklına takılan" },
  { value: "suggestion", index: "03", title: "Bir öneri", note: "Daha iyisi için" },
  { value: "complaint", index: "04", title: "Bir şikâyet", note: "Seni dinliyoruz" },
] as const;

type Topic = (typeof topics)[number]["value"];

export function ContactForm() {
  const [topic, setTopic] = useState<Topic>("question");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        fullName: form.get("fullName"),
        email: form.get("email"),
        phone: form.get("phone"),
        company: form.get("company"),
        message: form.get("message"),
        consent: form.get("consent") === "on",
        website: form.get("website"),
      }),
    });
    const result = (await response.json()) as { error?: string; reference?: string };
    setSending(false);
    if (!response.ok) {
      setError(result.error ?? "Mesajınız gönderilemedi.");
      return;
    }
    setReference(result.reference ?? "BONJ-ALINDI");
  }

  if (reference) {
    return (
      <section className="contact-success" aria-live="polite">
        <span className="contact-success-mark" aria-hidden="true">✓</span>
        <span className="contact-form-kicker">MESAJIN BİZDE</span>
        <h2>İyi ki<br /><em>yazdın.</em></h2>
        <p>Mesajını aldık. Ekibimiz konusuna göre inceleyip en kısa sürede sana dönecek.</p>
        <small>Takip kodun / <strong>{reference}</strong></small>
        <button type="button" onClick={() => setReference("")}>Yeni bir mesaj yaz <span>↗</span></button>
      </section>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="contact-form-heading">
        <span className="contact-form-kicker">KONU SEÇ / BİZE ANLAT</span>
        <span>Ortalama yanıt: 48 saat</span>
      </div>

      <fieldset className="contact-topic-picker">
        <legend>Mesaj konusu</legend>
        <div>
          {topics.map((item) => (
            <button
              className={topic === item.value ? "is-selected" : ""}
              type="button"
              key={item.value}
              onClick={() => setTopic(item.value)}
              aria-pressed={topic === item.value}
            >
              <small>{item.index}</small>
              <strong>{item.title}</strong>
              <span>{item.note}</span>
              <i aria-hidden="true">✓</i>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="contact-field-grid">
        <label>Adın soyadın *<input name="fullName" autoComplete="name" required maxLength={120} placeholder="Nasıl hitap edelim?" /></label>
        <label>E-posta adresin *<input name="email" type="email" inputMode="email" autoComplete="email" required maxLength={180} placeholder="ornek@email.com" /></label>
        <label>Telefon<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={32} placeholder="Opsiyonel" /></label>
        <label>Marka / şirket<input name="company" autoComplete="organization" maxLength={120} placeholder="İş birlikleri için" /></label>
      </div>

      <label className="contact-message-field">Mesajın *<textarea name="message" required minLength={20} maxLength={5000} rows={6} placeholder="Biraz detay verirsen seni daha iyi anlayabiliriz…" /></label>
      <label className="contact-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>

      <div className="contact-form-footer">
        <label className="contact-consent">
          <input name="consent" type="checkbox" required />
          <span>Bilgilerimin bu mesaja yanıt vermek amacıyla işlenmesini kabul ediyorum.</span>
        </label>
        <button className="contact-submit" type="submit" disabled={sending}>
          {sending ? "Gönderiliyor…" : "Mesajı gönder"}<span aria-hidden="true">↗</span>
        </button>
      </div>
      {error && <p className="contact-error" role="alert">{error}</p>}
    </form>
  );
}
