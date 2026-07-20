import "server-only";

type JsonRecord = Record<string, unknown>;

export type SendSmsInput = {
  message: string;
  phone: string;
};

export type SendSmsResult = {
  ok: true;
  providerResponse: unknown;
};

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

function smsConfig() {
  const baseUrl = process.env.CERILAS_SMS_BASE_URL?.trim().replace(/\/+$/, "");
  const email = process.env.CERILAS_SMS_EMAIL?.trim();
  const password = process.env.CERILAS_SMS_PASSWORD;

  if (!baseUrl || !email || !password) {
    throw new Error("SMS servisi henüz yapılandırılmadı.");
  }

  return { baseUrl, email, password };
}

function tokenFromResponse(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const response = value as JsonRecord;
  const direct = response.token ?? response.accessToken ?? response.access_token ?? response.jwt;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return tokenFromResponse(response.data);
}

function tokenExpiry(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return Date.now() + 50 * 60 * 1000;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as { exp?: number };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : Date.now() + 50 * 60 * 1000;
  } catch {
    return Date.now() + 50 * 60 * 1000;
  }
}

async function responseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json().catch(() => null);
  return response.text().catch(() => "");
}

async function requestToken(signal?: AbortSignal) {
  const { baseUrl, email, password } = smsConfig();
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(12_000),
  });
  const body = await responseBody(response);
  if (!response.ok) {
    throw new Error(`SMS servisi oturumu açılamadı (${response.status}).`);
  }
  const token = tokenFromResponse(body);
  if (!token) throw new Error("SMS servisi geçerli bir JWT token döndürmedi.");
  cachedToken = { value: token, expiresAt: tokenExpiry(token) };
  return token;
}

async function getToken(forceRefresh = false, signal?: AbortSignal) {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  if (!forceRefresh && tokenRequest) return tokenRequest;
  cachedToken = null;
  tokenRequest = requestToken(signal).finally(() => {
    tokenRequest = null;
  });
  return tokenRequest;
}

export function normalizeSmsPhone(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (!/^5\d{9}$/.test(digits)) {
    throw new Error("SMS numarası 5XXXXXXXXX biçiminde geçerli bir Türkiye mobil numarası olmalı.");
  }
  return digits;
}

async function sendWithToken(message: string, phone: string, token: string, signal?: AbortSignal) {
  const { baseUrl } = smsConfig();
  return fetch(`${baseUrl}/api/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ msg: message, no: phone }),
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(12_000),
  });
}

export async function sendCerilasSms({ message, phone }: SendSmsInput): Promise<SendSmsResult> {
  const cleanMessage = message.trim();
  if (!cleanMessage || cleanMessage.length > 1000) {
    throw new Error("SMS metni 1 ile 1000 karakter arasında olmalı.");
  }
  const normalizedPhone = normalizeSmsPhone(phone);

  const operationSignal = AbortSignal.timeout(20_000);
  try {
    let response = await sendWithToken(
      cleanMessage,
      normalizedPhone,
      await getToken(false, operationSignal),
      operationSignal,
    );
    if (response.status === 401 || response.status === 403) {
      response = await sendWithToken(
        cleanMessage,
        normalizedPhone,
        await getToken(true, operationSignal),
        operationSignal,
      );
    }
    const body = await responseBody(response);
    if (!response.ok) {
      throw new Error(`SMS gönderilemedi (${response.status}).`);
    }
    return { ok: true, providerResponse: body };
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("SMS servisi zaman aşımına uğradı. Lütfen tekrar deneyin.");
    }
    throw error;
  }
}

export function isCerilasSmsConfigured() {
  return Boolean(
    process.env.CERILAS_SMS_BASE_URL?.trim()
      && process.env.CERILAS_SMS_EMAIL?.trim()
      && process.env.CERILAS_SMS_PASSWORD,
  );
}
