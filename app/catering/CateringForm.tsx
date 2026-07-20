"use client";

import { useMemo, useState } from "react";
import { TouchDateTimePicker } from "../components/TouchDateTimePicker";
import { UiIcon } from "../components/UiIcon";

const eventTypes = [
  ["bridal-room", "Gelin Odası"], ["engagement", "Söz / Nişan"], ["henna", "Kına Gecesi"],
  ["wedding", "Düğün"], ["birthday", "Doğum Günü"], ["baby", "Baby Shower"],
  ["corporate-meeting", "Kurumsal Toplantı"], ["launch", "Lansman / Açılış"],
  ["workshop", "Workshop / Seminer"], ["public-event", "Festival / Etkinlik"],
  ["private-event", "Özel Davet"], ["other", "Diğer"],
] as const;

const serviceStyles = [
  ["delivery", "Teslimat", "Hazır ve paketli teslim"],
  ["buffet", "Kurulumlu büfe", "Sunum ve masa kurulumu"],
  ["served", "Yerinde servis", "Servis ekibiyle birlikte"],
  ["coffee-bar", "Mobil kahve barı", "Barista ve ekipman"],
  ["unsure", "Birlikte karar verelim", "Ön görüşmede netleştirelim"],
] as const;

const menuOptions = [
  ["brunch", "Brunch / kahvaltı"], ["savory", "Tuzlu atıştırmalıklar"],
  ["dessert-table", "Tatlı masası"], ["cheesecake", "San Sebastian & cheesecake"],
  ["cake", "Özel gün pastası"], ["coffee", "Yeni nesil kahve"],
  ["cold-drinks", "Soğuk içecekler"], ["boxed", "Kişiye özel ikram kutusu"],
] as const;

const venueSettings = [
  ["indoor", "Kapalı alan"], ["outdoor", "Açık alan"], ["mixed", "Karma alan"], ["unsure", "Henüz belli değil"],
] as const;

const budgets = [
  ["unsure", "Henüz net değil"], ["under-500", "Kişi başı 500 ₺ altı"],
  ["500-750", "Kişi başı 500–750 ₺"], ["750-1000", "Kişi başı 750–1.000 ₺"],
  ["over-1000", "Kişi başı 1.000 ₺ üzeri"],
] as const;

type FormState = {
  eventType: string; eventDate: string; eventTime: string; guestCount: string;
  venueName: string; venueAddress: string; venueSetting: string; serviceStyle: string;
  menuInterests: string[]; dietaryNeeds: string; budgetRange: string; fullName: string;
  phone: string; email: string; company: string; preferredContact: string; notes: string; consent: boolean;
};

const initialForm: FormState = {
  eventType: "", eventDate: "", eventTime: "", guestCount: "", venueName: "", venueAddress: "",
  venueSetting: "", serviceStyle: "", menuInterests: [], dietaryNeeds: "", budgetRange: "unsure",
  fullName: "", phone: "", email: "", company: "", preferredContact: "phone", notes: "", consent: false,
};

export function CateringForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const minDate = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    [],
  );
  const minTime = useMemo(
    () => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()),
    [],
  );

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function toggleMenu(value: string) {
    patch("menuInterests", form.menuInterests.includes(value)
      ? form.menuInterests.filter((item) => item !== value)
      : [...form.menuInterests, value]);
  }

  function validate(targetStep: number) {
    if (targetStep === 1) {
      if (!form.eventType) return "Organizasyon türünü seçin.";
      if (!form.eventDate || !form.eventTime) return "Tarih ve başlangıç saatini seçin.";
      if (!form.guestCount || Number(form.guestCount) < 5) return "En az 5 kişilik tahmini katılımcı sayısını yazın.";
      if (form.venueAddress.trim().length < 5) return "Organizasyonun yapılacağı konumu yazın.";
      if (!form.venueSetting) return "Mekân tipini seçin.";
    }
    if (targetStep === 2) {
      if (!form.serviceStyle) return "Servis biçimini seçin.";
      if (!form.menuInterests.length) return "En az bir menü ilgisi seçin.";
    }
    if (targetStep === 3) {
      if (form.fullName.trim().length < 2) return "Adınızı ve soyadınızı yazın.";
      if (!/^[0-9+()\s-]{10,32}$/.test(form.phone.trim())) return "Geçerli bir telefon numarası yazın.";
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Geçerli bir e-posta adresi yazın.";
      if (!form.consent) return "İletişim iznini onaylayın.";
    }
    return "";
  }

  function next() {
    const validationError = validate(step);
    if (validationError) return setError(validationError);
    setStep((current) => Math.min(3, current + 1));
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = [1, 2, 3].map(validate).find(Boolean);
    if (validationError) return setError(validationError);
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/catering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, guestCount: Number(form.guestCount), website: "" }),
      });
      const result = (await response.json()) as { error?: string; reference?: string };
      if (!response.ok) throw new Error(result.error ?? "Talebiniz gönderilemedi.");
      setReference(result.reference ?? "BONJ-CAT-ALINDI");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Talebiniz gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  if (reference) {
    return (
      <section className="catering-success" aria-live="polite">
        <span className="catering-success-mark"><UiIcon name="check" /></span>
        <span className="catering-form-kicker">TALEBİN BİZDE</span>
        <h2>Şimdi sıra<br /><em>bizde.</em></h2>
        <p>Detayları aldık. Ekibimiz ön değerlendirmeyi yapıp tercih ettiğin kanaldan sana ulaşacak.</p>
        <small>Talep kodun <strong>{reference}</strong></small>
        <button type="button" onClick={() => { setReference(""); setForm(initialForm); setStep(1); }}>Yeni talep oluştur <span><UiIcon name="arrow-up-right" /></span></button>
      </section>
    );
  }

  return (
    <form className="catering-form" data-step={step} onSubmit={submit} noValidate>
      <header className="catering-form-header">
        <div><span className="catering-form-kicker">CATERING TALEBİ</span><strong>{String(step).padStart(2, "0")} / 03</strong></div>
        <div className="catering-progress" aria-label={`3 adımın ${step}. adımı`}><i /><i /><i /></div>
      </header>

      {step === 1 && <section className="catering-step" aria-labelledby="catering-step-one">
        <div className="catering-step-title"><span>01</span><div><h2 id="catering-step-one">Organizasyonu tanıyalım.</h2><p>Tarih, kişi sayısı ve mekân bilgileri kapasite planını belirler.</p></div></div>
        <fieldset className="catering-choice-field">
          <legend>Organizasyon türü *</legend>
          <div className="catering-event-grid">
            {eventTypes.map(([value, label]) => <button className={form.eventType === value ? "is-selected" : ""} type="button" key={value} onClick={() => patch("eventType", value)} aria-pressed={form.eventType === value}>{label}<i><UiIcon name="check" /></i></button>)}
          </div>
        </fieldset>
        <div className="catering-schedule-picker">
          <span>Organizasyon tarihi ve başlangıç saati *</span>
          <TouchDateTimePicker
            date={form.eventDate}
            time={form.eventTime}
            minDate={minDate}
            minTime={form.eventDate === minDate ? minTime : undefined}
            helperText="Yakın günlerden birine dokun veya ileri tarih için takvimi aç."
            onDateChange={(value) => {
              setForm((current) => ({
                ...current,
                eventDate: value,
                eventTime: value === minDate && current.eventTime && current.eventTime < minTime
                  ? minTime
                  : current.eventTime,
              }));
              setError("");
            }}
            onTimeChange={(value) => patch("eventTime", value)}
          />
        </div>
        <div className="catering-field-grid">
          <label>Tahmini kişi sayısı *<input type="number" min="5" max="5000" inputMode="numeric" value={form.guestCount} onChange={(e) => patch("guestCount", e.target.value)} placeholder="Örn. 80" /></label>
          <span className="catering-capacity-note">Kesin sayı henüz belli değilse yaklaşık katılımcı sayısını yazabilirsin.</span>
        </div>
        <div className="catering-field-grid">
          <label>Mekân adı<input value={form.venueName} maxLength={180} onChange={(e) => patch("venueName", e.target.value)} placeholder="Varsa salon / şirket adı" /></label>
          <label>İlçe, semt veya açık adres *<input value={form.venueAddress} maxLength={1000} onChange={(e) => patch("venueAddress", e.target.value)} placeholder="Örn. Şehitkamil, Gaziantep" /></label>
        </div>
        <fieldset className="catering-choice-field compact"><legend>Mekân tipi *</legend><div className="catering-inline-choices">{venueSettings.map(([value, label]) => <button className={form.venueSetting === value ? "is-selected" : ""} type="button" key={value} onClick={() => patch("venueSetting", value)}>{label}</button>)}</div></fieldset>
      </section>}

      {step === 2 && <section className="catering-step" aria-labelledby="catering-step-two">
        <div className="catering-step-title"><span>02</span><div><h2 id="catering-step-two">Servisi şekillendirelim.</h2><p>Birden fazla menü başlığı seçebilirsin.</p></div></div>
        <fieldset className="catering-choice-field"><legend>Servis biçimi *</legend><div className="catering-service-options">{serviceStyles.map(([value, label, note]) => <button className={form.serviceStyle === value ? "is-selected" : ""} type="button" key={value} onClick={() => patch("serviceStyle", value)}><strong>{label}</strong><span>{note}</span><i><UiIcon name="check" /></i></button>)}</div></fieldset>
        <fieldset className="catering-choice-field"><legend>Menüde neler olsun? *</legend><div className="catering-menu-options">{menuOptions.map(([value, label]) => <button className={form.menuInterests.includes(value) ? "is-selected" : ""} type="button" key={value} onClick={() => toggleMenu(value)} aria-pressed={form.menuInterests.includes(value)}><i><UiIcon name={form.menuInterests.includes(value) ? "check" : "plus"} /></i>{label}</button>)}</div></fieldset>
        <div className="catering-field-grid">
          <label>Beslenme ve alerjen ihtiyaçları<textarea rows={3} maxLength={2000} value={form.dietaryNeeds} onChange={(e) => patch("dietaryNeeds", e.target.value)} placeholder="Vegan, vejetaryen, glutensiz, kuruyemiş alerjisi…" /></label>
          <fieldset className="catering-budget"><legend>Yaklaşık kişi başı bütçe</legend>{budgets.map(([value, label]) => <label key={value}><input type="radio" name="budget" checked={form.budgetRange === value} onChange={() => patch("budgetRange", value)} /><span>{label}</span></label>)}</fieldset>
        </div>
      </section>}

      {step === 3 && <section className="catering-step" aria-labelledby="catering-step-three">
        <div className="catering-step-title"><span>03</span><div><h2 id="catering-step-three">Sana nasıl ulaşalım?</h2><p>Teklif öncesi kısa bir görüşme için iletişim bilgilerin yeterli.</p></div></div>
        <div className="catering-field-grid">
          <label>Ad soyad *<input autoComplete="name" maxLength={120} value={form.fullName} onChange={(e) => patch("fullName", e.target.value)} placeholder="Nasıl hitap edelim?" /></label>
          <label>Telefon *<input type="tel" inputMode="tel" autoComplete="tel" maxLength={32} value={form.phone} onChange={(e) => patch("phone", e.target.value)} placeholder="05__ ___ __ __" /></label>
          <label>E-posta<input type="email" inputMode="email" autoComplete="email" maxLength={180} value={form.email} onChange={(e) => patch("email", e.target.value)} placeholder="ornek@email.com" /></label>
          <label>Şirket / marka<input autoComplete="organization" maxLength={120} value={form.company} onChange={(e) => patch("company", e.target.value)} placeholder="Kurumsal talepler için" /></label>
        </div>
        <fieldset className="catering-choice-field compact"><legend>Tercih ettiğin iletişim kanalı *</legend><div className="catering-inline-choices">{[["phone", "Telefon"], ["whatsapp", "WhatsApp"], ["email", "E-posta"]].map(([value, label]) => <button className={form.preferredContact === value ? "is-selected" : ""} type="button" key={value} onClick={() => patch("preferredContact", value)}>{label}</button>)}</div></fieldset>
        <label className="catering-notes">Eklemek istediğin detay<textarea rows={4} maxLength={5000} value={form.notes} onChange={(e) => patch("notes", e.target.value)} placeholder="Tema, renk paleti, özel sunum isteği, kurulum saati veya aklındaki diğer detaylar…" /></label>
        <label className="catering-consent"><input type="checkbox" checked={form.consent} onChange={(e) => patch("consent", e.target.checked)} /><span>Bilgilerimin catering talebime dönüş yapılması amacıyla işlenmesini kabul ediyorum.</span></label>
      </section>}

      {error && <p className="catering-error" role="alert">{error}</p>}
      <footer className="catering-form-footer">
        <button className="catering-back" type="button" onClick={() => { setStep((current) => Math.max(1, current - 1)); setError(""); }} disabled={step === 1}><UiIcon name="arrow-left" /> Geri</button>
        {step < 3
          ? <button className="catering-next" type="button" onClick={next}>Devam et <span><UiIcon name="arrow-up-right" /></span></button>
          : <button className="catering-next" type="submit" disabled={sending}>{sending ? "Gönderiliyor…" : "Talebi gönder"}<span><UiIcon name="arrow-up-right" /></span></button>}
      </footer>
    </form>
  );
}
