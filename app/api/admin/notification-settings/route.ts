import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  getAdminNotificationSettings,
  notificationTypes,
  saveAdminNotificationSettings,
  type AdminNotificationSettings,
  type NotificationType,
} from "@/lib/admin-notification-settings";
import { sendCerilasSms } from "@/lib/cerilas-sms";
import { notificationShortUrl } from "@/lib/admin-notifications";

const testSmsContent: Record<NotificationType, { message: string }> = {
  orders: {
    message: "Bonj test: Yeni sipariş bildirimi hazır.",
  },
  contact: {
    message: "Bonj test: Yeni iletişim formu bildirimi hazır.",
  },
  catering: {
    message: "Bonj test: Yeni catering talebi bildirimi hazır.",
  },
  dailySummary: {
    message: "Bonj test: Günlük özet bildirimi hazır.",
  },
};

const recentTests = new Map<string, number>();

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const local = digits.startsWith("90") ? `0${digits.slice(2)}` : digits;
  const normalized = local.length === 10 && local.startsWith("5") ? `0${local}` : local;

  if (!/^05\d{9}$/.test(normalized)) {
    throw new Error("Telefon numarası 05xx xxx xx xx biçiminde olmalıdır.");
  }
  return normalized;
}

export async function GET() {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  return NextResponse.json({ settings: await getAdminNotificationSettings() });
}

export async function PUT(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const source = body.settings;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error("Bildirim ayarları geçersiz.");
    }

    const values = source as Record<string, unknown>;
    const settings = Object.fromEntries(notificationTypes.map((type) => {
      const rawPhones = Array.isArray(values[type]) ? values[type] : [values[type]];
      if (rawPhones.length > 10) {
        throw new Error("Bir bildirim türüne en fazla 10 numara ekleyebilirsiniz.");
      }
      const phones = [...new Set(rawPhones.map(normalizePhone).filter(Boolean))];
      return [type, phones];
    })) as AdminNotificationSettings;

    await saveAdminNotificationSettings(settings);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bildirim ayarları kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = String(body.type ?? "") as NotificationType;
    if (!notificationTypes.includes(type)) {
      throw new Error("Bildirim türü geçersiz.");
    }

    const phone = normalizePhone(body.phone);
    if (!phone) throw new Error("Test SMS’i için telefon numarası yazın.");

    const throttleKey = `${admin.id}:${type}:${phone}`;
    const lastSentAt = recentTests.get(throttleKey) ?? 0;
    if (Date.now() - lastSentAt < 10_000) {
      return NextResponse.json(
        { error: "Aynı test bildirimini tekrar göndermek için birkaç saniye bekleyin." },
        { status: 429 },
      );
    }

    const content = testSmsContent[type];
    const shortUrl = notificationShortUrl(request, type);
    await sendCerilasSms({
      phone,
      message: `${content.message} Görüntüle: ${shortUrl}`,
    });
    recentTests.set(throttleKey, Date.now());

    return NextResponse.json({ ok: true, message: "Test SMS’i gönderildi." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test SMS’i gönderilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
