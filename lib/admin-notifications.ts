import "server-only";

import type { NotificationType } from "@/lib/admin-notification-settings";
import { getAdminNotificationSettings } from "@/lib/admin-notification-settings";
import { sendCerilasSms } from "@/lib/cerilas-sms";

const shortCodes: Record<NotificationType, string> = {
  orders: "s",
  contact: "m",
  catering: "c",
  dailySummary: "g",
};

export function notificationBaseUrl(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || new URL(request.url).protocol.replace(":", "");
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  if (host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    return `${protocol}://${host}`;
  }
  return configuredUrl || (host ? `${protocol}://${host}` : new URL(request.url).origin);
}

export function notificationShortUrl(request: Request, type: NotificationType, itemId?: number) {
  const url = new URL(`/b/${shortCodes[type]}`, notificationBaseUrl(request));
  if (itemId && Number.isInteger(itemId) && itemId > 0) url.searchParams.set("i", String(itemId));
  return url.toString();
}

export async function sendConfiguredAdminNotification({
  type,
  message,
  request,
  itemId,
}: {
  type: NotificationType;
  message: string;
  request: Request;
  itemId?: number;
}) {
  const settings = await getAdminNotificationSettings();
  const phones = settings[type];
  if (!phones.length) return { sent: false as const, reason: "not-configured" as const };

  const smsMessage = `${message} Detay: ${notificationShortUrl(request, type, itemId)}`;
  const results = await Promise.allSettled(
    phones.map((phone) => sendCerilasSms({ phone, message: smsMessage })),
  );
  const sentCount = results.filter((result) => result.status === "fulfilled").length;
  if (!sentCount) {
    const firstFailure = results.find((result) => result.status === "rejected");
    throw firstFailure && firstFailure.status === "rejected"
      ? firstFailure.reason
      : new Error("SMS gönderilemedi.");
  }
  if (sentCount < phones.length) {
    console.error(`[notification:${type}] ${phones.length - sentCount} alıcıya SMS gönderilemedi.`);
  }
  return { sent: true as const, sentCount, totalRecipients: phones.length };
}

export function reportNotificationError(type: NotificationType, error: unknown) {
  const message = error instanceof Error ? error.message : "Bilinmeyen SMS hatası";
  console.error(`[notification:${type}] ${message}`);
}
