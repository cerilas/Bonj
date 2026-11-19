"use client";

import { useEffect, useRef, useState } from "react";
import { AuthUser, notifyAuthChange } from "@/lib/use-user";
import { BrandLogo } from "./BrandLogo";
import { UiIcon } from "./UiIcon";

export type AuthModalProps = {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (user: AuthUser) => void;
  inline?: boolean;
  title?: string;
  subtitle?: string;
};

export function AuthModal({
  isOpen = true,
  onClose,
  onSuccess,
  inline = false,
  title = "Giriş Yap / Üye Ol",
  subtitle = "Şifresiz, tek kullanımlık SMS kodu ile anında giriş yapın.",
}: AuthModalProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [isNewUser, setIsNewUser] = useState(false);
  const [existingName, setExistingName] = useState<string | null>(null);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && step === "phone") {
      setTimeout(() => phoneInputRef.current?.focus(), 150);
    } else if (isOpen && step === "otp") {
      setTimeout(() => codeInputRef.current?.focus(), 150);
    }
  }, [isOpen, step]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "otp" && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  if (!isOpen && !inline) return null;

  function normalizeNationalDigits(value: string) {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("90") && digits.length > 10) {
      digits = digits.slice(2);
    }
    if (digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    return digits.slice(0, 10);
  }

  function formatPhoneDisplay(value: string) {
    const raw = normalizeNationalDigits(value);
    if (!raw) return "";
    if (raw.length <= 3) return raw;
    if (raw.length <= 6) return `${raw.slice(0, 3)} ${raw.slice(3)}`;
    if (raw.length <= 8) return `${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}`;
    return `${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6, 8)} ${raw.slice(8, 10)}`;
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = normalizeNationalDigits(e.target.value);
    setPhone(val);
    setError("");
  }

  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Lütfen geçerli bir telefon numarası girin (Örn: 05XX XXX XX XX).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "SMS kodu gönderilemedi.");
        return;
      }

      setStep("otp");
      setCountdown(60);
      setCode("");
      setIsNewUser(Boolean(data.isNewUser));
      setExistingName(data.existingName || null);
    } catch {
      setError("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError("");
    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setError("Lütfen 6 haneli doğrulama kodunu girin.");
      return;
    }

    if (isNewUser && !fullName.trim()) {
      setError("Lütfen adınızı ve soyadınızı girin.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code: cleanCode,
          fullName: isNewUser ? fullName.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Doğrulama kodu geçersiz.");
        return;
      }

      notifyAuthChange();
      if (onSuccess) {
        onSuccess(data.user);
      } else if (onClose) {
        onClose();
      }
    } catch {
      setError("Giriş yapılırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  const modalContent = (
    <div className={`bonj-auth-card ${inline ? "is-inline" : ""}`}>
      {!inline && (
        <button
          type="button"
          className="bonj-auth-close"
          onClick={onClose}
          aria-label="Kapat"
        >
          <UiIcon name="close" />
        </button>
      )}

      <div className="bonj-auth-header">
        {!inline ? (
          <BrandLogo className="bonj-auth-logo" alt="Bonj Cake Story" />
        ) : (
          <div className="bonj-auth-icon-badge">
            <UiIcon name="shield" />
          </div>
        )}
        <span className="bonj-auth-kicker">MÜŞTERİ HESABI</span>
        <h2 className="bonj-auth-title">{title}</h2>
        <p className="bonj-auth-subtitle">
          {step === "otp"
            ? isNewUser
              ? "Yeni üyelik oluşturuluyor. Lütfen adınızı ve telefonunuza gelen kodu girin."
              : `Tekrar hoş geldiniz${existingName ? `, ${existingName}` : ""}! Lütfen SMS ile gelen kodu girin.`
            : subtitle}
        </p>
      </div>

      {error && <div className="bonj-auth-error">{error}</div>}

      {step === "phone" ? (
        <form onSubmit={handleSendOtp} className="bonj-auth-form">
          <label className="bonj-auth-label">
            <span>Cep Telefonu Numaranız</span>
            <div className="bonj-auth-phone-input-wrap">
              <span className="bonj-auth-prefix">+90</span>
              <input
                ref={phoneInputRef}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="5XX XXX XX XX"
                value={formatPhoneDisplay(phone)}
                onChange={handlePhoneChange}
                disabled={loading}
                required
              />
            </div>
            <small className="bonj-auth-hint">
              Sisteme şifresiz giriş yapacaksınız. Giriş kodunuz SMS olarak iletilecektir.
            </small>
          </label>

          <button
            type="submit"
            className="bonj-auth-submit-btn"
            disabled={loading || phone.replace(/\D/g, "").length < 10}
          >
            {loading ? "Kod Gönderiliyor..." : "Doğrulama Kodu Gönder"} <UiIcon name="arrow-right" />
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="bonj-auth-form">
          <div className="bonj-auth-otp-info">
            <span className="bonj-auth-sent-badge">
              <strong>+90 {formatPhoneDisplay(phone)}</strong>
              {isNewUser ? " (Yeni Kayıt)" : existingName ? ` (${existingName})` : ""} numarasına SMS gönderildi.
            </span>
            <button
              type="button"
              className="bonj-auth-change-phone-btn"
              onClick={() => {
                setStep("phone");
                setError("");
                setIsNewUser(false);
                setExistingName(null);
              }}
            >
              Numarayı Değiştir
            </button>
          </div>

          <label className="bonj-auth-label">
            <span>6 Haneli SMS Doğrulama Kodu *</span>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(val);
                setError("");
              }}
              disabled={loading}
              className="bonj-auth-code-input"
              required
            />
          </label>

          {isNewUser && (
            <label className="bonj-auth-label">
              <span>Adınız Soyadınız *</span>
              <input
                type="text"
                autoComplete="name"
                placeholder="Örn: Deniz Yılmaz"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                required
              />
              <small className="bonj-auth-hint">
                Profilinizi oluşturabilmemiz için lütfen adınızı ve soyadınızı belirtin.
              </small>
            </label>
          )}

          <button
            type="submit"
            className="bonj-auth-submit-btn"
            disabled={
              loading ||
              code.trim().length !== 6 ||
              (isNewUser && !fullName.trim())
            }
          >
            {loading
              ? "Giriş Yapılıyor..."
              : isNewUser
              ? "Kaydı Tamamla ve Giriş Yap"
              : "Giriş Yap"} <UiIcon name="check" />
          </button>

          <div className="bonj-auth-resend-row">
            {countdown > 0 ? (
              <span className="bonj-auth-timer">
                Tekrar kod iste: <strong>{countdown} sn</strong>
              </span>
            ) : (
              <button
                type="button"
                className="bonj-auth-resend-btn"
                onClick={() => handleSendOtp()}
                disabled={loading}
              >
                Kodu Tekrar Gönder
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );

  if (inline) {
    return modalContent;
  }

  return (
    <div
      className="bonj-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      {modalContent}
    </div>
  );
}
