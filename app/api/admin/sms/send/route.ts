import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { normalizeSmsPhone, sendCerilasSms } from "@/lib/cerilas-sms";

const recentSends = new Map<string, number[]>();
const oneMinute = 60_000;

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  const body = (await request.json().catch(() => null)) as
    | { phone?: unknown; message?: unknown }
    | null;
  const phone = String(body?.phone ?? "").trim();
  const message = String(body?.message ?? "").trim();
  if (!phone || !message) {
    return NextResponse.json({ error: "Telefon numarası ve mesaj zorunludur." }, { status: 400 });
  }

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeSmsPhone(phone);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Telefon numarası geçersiz." },
      { status: 400 },
    );
  }

  const now = Date.now();
  const throttleKey = `${admin.id}:${normalizedPhone}`;
  const activeSends = (recentSends.get(throttleKey) ?? []).filter((sentAt) => now - sentAt < oneMinute);
  if (activeSends.length >= 5) {
    return NextResponse.json(
      { error: "Bu numaraya tekrar SMS göndermek için bir dakika bekleyin." },
      { status: 429 },
    );
  }

  try {
    await sendCerilasSms({ phone: normalizedPhone, message });
    recentSends.set(throttleKey, [...activeSends, now]);
    return NextResponse.json({ ok: true, message: "SMS gönderildi." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SMS gönderilemedi." },
      { status: 400 },
    );
  }
}
