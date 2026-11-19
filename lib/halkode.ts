import crypto from "crypto";

export function getHalkodeApiUrl(): string {
  if (process.env.HALKODE_API_URL) {
    return process.env.HALKODE_API_URL;
  }
  if (process.env.HALKODE_ENVIRONMENT === "staging") {
    return "https://staging.halkode.com.tr/ccpayment/api";
  }
  return "https://app.halkode.com.tr/ccpayment/api";
}

export function getHalkodeMerchantKey(): string {
  const key = process.env.HALKODE_MERCHANT_KEY || "";
  return key.replace(/\\(\$)/g, "$1").trim();
}

type TokenResponse = {
  status_code: number;
  status_description: string;
  data?: {
    token: string;
    is_3d: number;
    expires_at: string;
  };
};

const globalForHalkode = globalThis as unknown as {
  halkodeToken?: string;
  halkodeTokenExpiresAt?: number;
};

export async function getHalkodeToken(): Promise<string> {
  const now = Date.now();
  if (
    globalForHalkode.halkodeToken &&
    globalForHalkode.halkodeTokenExpiresAt &&
    globalForHalkode.halkodeTokenExpiresAt > now + 60000 // 1 minute buffer
  ) {
    return globalForHalkode.halkodeToken;
  }

  const appId = process.env.HALKODE_APP_ID;
  const appSecret = process.env.HALKODE_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("HalkÖde app_id or app_secret is missing in environment variables.");
  }

  const apiUrl = getHalkodeApiUrl();
  const response = await fetch(`${apiUrl}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  const result = (await response.json()) as TokenResponse;

  if (result.status_code !== 100 || !result.data) {
    throw new Error(`Failed to get HalkÖde token: ${result.status_description}`);
  }

  globalForHalkode.halkodeToken = result.data.token;
  // Parse expiration string like "2026-03-10 13:42:54" into a timestamp
  globalForHalkode.halkodeTokenExpiresAt = new Date(result.data.expires_at.replace(" ", "T")).getTime();

  return result.data.token;
}

export function generateHalkodeHash(
  total: number,
  installmentsNumber: number,
  currencyCode: string,
  invoiceId: string,
): string {
  const merchantKey = getHalkodeMerchantKey();
  const appSecret = process.env.HALKODE_APP_SECRET;

  if (!merchantKey || !appSecret) {
    throw new Error("HalkÖde merchant_key or app_secret is missing.");
  }

  // Use exact same string representation that will be sent in JSON payload
  const formattedTotal = total.toString();

  const data = `${formattedTotal}|${installmentsNumber}|${currencyCode}|${merchantKey}|${invoiceId}`;

  const randomIvStr = Math.random().toString();
  const iv = crypto.createHash("sha1").update(randomIvStr).digest("hex").substring(0, 16);

  const password = crypto.createHash("sha1").update(appSecret).digest("hex");

  const randomSaltStr = Math.random().toString();
  const salt = crypto.createHash("sha1").update(randomSaltStr).digest("hex").substring(0, 4);

  const saltWithPassword = crypto.createHash("sha256").update(password + salt).digest("hex");

  const key = Buffer.from(saltWithPassword, "utf8").subarray(0, 32);
  const ivBuffer = Buffer.from(iv, "utf8");

  const cipher = crypto.createCipheriv("aes-256-cbc", key, ivBuffer);
  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");

  let bundle = `${iv}:${salt}:${encrypted}`;
  bundle = bundle.replace(/\//g, "__");
  return bundle;
}

export function getHalkode3dPayUrl(): string {
  return `${getHalkodeApiUrl()}/paySmart3D`;
}

export function generateHalkodeRefundHash(
  amount: number,
  invoiceId: string,
): string {
  const merchantKey = getHalkodeMerchantKey();
  const appSecret = process.env.HALKODE_APP_SECRET;

  if (!merchantKey || !appSecret) {
    throw new Error("HalkÖde merchant_key or app_secret is missing.");
  }

  // HalkÖde format: amount|invoice_id|merchant_key
  const data = `${amount}|${invoiceId}|${merchantKey}`;

  const randomIvStr = Math.random().toString();
  const iv = crypto.createHash("sha1").update(randomIvStr).digest("hex").substring(0, 16);

  const password = crypto.createHash("sha1").update(appSecret).digest("hex");

  const randomSaltStr = Math.random().toString();
  const salt = crypto.createHash("sha1").update(randomSaltStr).digest("hex").substring(0, 4);

  const saltWithPassword = crypto.createHash("sha256").update(password + salt).digest("hex");

  const key = Buffer.from(saltWithPassword, "utf8").subarray(0, 32);
  const ivBuffer = Buffer.from(iv, "utf8");

  const cipher = crypto.createCipheriv("aes-256-cbc", key, ivBuffer);
  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");

  let bundle = `${iv}:${salt}:${encrypted}`;
  bundle = bundle.replace(/\//g, "__");
  return bundle;
}

export type HalkodeRefundResult = {
  ok: boolean;
  statusCode: number;
  statusDescription: string;
  refNo?: string;
};

export async function processHalkodeRefund({
  invoiceId,
  amountInTl,
}: {
  invoiceId: string;
  amountInTl: number;
}): Promise<HalkodeRefundResult> {
  // Live API Infrastructure
  const token = await getHalkodeToken();
  const hashKey = generateHalkodeRefundHash(amountInTl, invoiceId);
  const appId = process.env.HALKODE_APP_ID;
  const appSecret = process.env.HALKODE_APP_SECRET;
  const merchantKey = getHalkodeMerchantKey();
  const apiUrl = getHalkodeApiUrl();

  const response = await fetch(`${apiUrl}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      invoice_id: invoiceId,
      amount: amountInTl,
      app_id: appId,
      app_secret: appSecret,
      merchant_key: merchantKey,
      hash_key: hashKey,
    }),
  });

  const data = (await response.json()) as {
    status_code: number | string;
    status_description?: string;
    ref_no?: string;
    ref_number?: string;
    order_no?: string;
  };

  const statusCode = Number(data.status_code);
  const ok = statusCode === 100;
  return {
    ok,
    statusCode,
    statusDescription: data.status_description || (ok ? "İade başarılı" : "İade işlemi başarısız oldu"),
    refNo: data.ref_no || data.ref_number || data.order_no,
  };
}
