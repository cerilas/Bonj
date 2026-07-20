import { and, count, eq, gte } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { cateringRequests } from "@/db/schema";
import {
  reportNotificationError,
  sendConfiguredAdminNotification,
} from "@/lib/admin-notifications";

const eventTypes = new Set([
  "bridal-room", "engagement", "henna", "wedding", "birthday", "baby",
  "corporate-meeting", "launch", "workshop", "public-event", "private-event", "other",
]);
const venueSettings = new Set(["indoor", "outdoor", "mixed", "unsure"]);
const serviceStyles = new Set(["delivery", "buffet", "served", "coffee-bar", "unsure"]);
const menuOptions = new Set(["brunch", "savory", "dessert-table", "cheesecake", "cake", "coffee", "cold-drinks", "boxed"]);
const contactOptions = new Set(["phone", "whatsapp", "email"]);
const budgetOptions = new Set(["unsure", "under-500", "500-750", "750-1000", "over-1000"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\s-]{10,32}$/;
const eventLabels: Record<string, string> = {
  "bridal-room": "Gelin Odası",
  engagement: "Söz / Nişan",
  henna: "Kına Gecesi",
  wedding: "Düğün",
  birthday: "Doğum Günü",
  baby: "Baby Shower",
  "corporate-meeting": "Kurumsal Toplantı",
  launch: "Lansman / Açılış",
  workshop: "Workshop / Seminer",
  "public-event": "Festival / Etkinlik",
  "private-event": "Özel Davet",
  other: "Diğer",
};

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (clean(body.website, 200)) {
      return NextResponse.json({ ok: true, reference: "BONJ-CAT-ALINDI" });
    }

    const eventType = clean(body.eventType, 48);
    const fullName = clean(body.fullName, 120);
    const phone = clean(body.phone, 32);
    const email = clean(body.email, 180).toLocaleLowerCase("tr-TR");
    const company = clean(body.company, 120);
    const eventDate = clean(body.eventDate, 10);
    const eventTime = clean(body.eventTime, 5);
    const guestCount = Number(body.guestCount);
    const venueName = clean(body.venueName, 180);
    const venueAddress = clean(body.venueAddress, 1000);
    const venueSetting = clean(body.venueSetting, 24);
    const serviceStyle = clean(body.serviceStyle, 32);
    const dietaryNeeds = clean(body.dietaryNeeds, 2000);
    const budgetRange = clean(body.budgetRange, 32);
    const preferredContact = clean(body.preferredContact, 24);
    const notes = clean(body.notes, 5000);
    const rawMenuInterests = Array.isArray(body.menuInterests) ? body.menuInterests : [];
    const menuInterests = rawMenuInterests.map((item) => clean(item, 32)).filter((item) => menuOptions.has(item));

    if (!eventTypes.has(eventType)) throw new Error("Organizasyon türünü seçin.");
    if (fullName.length < 2) throw new Error("Adınızı ve soyadınızı yazın.");
    if (!phonePattern.test(phone)) throw new Error("Geçerli bir telefon numarası yazın.");
    if (email && !emailPattern.test(email)) throw new Error("Geçerli bir e-posta adresi yazın.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^\d{2}:\d{2}$/.test(eventTime)) {
      throw new Error("Organizasyon tarihini ve saatini seçin.");
    }
    const eventAt = new Date(`${eventDate}T${eventTime}:00+03:00`);
    if (Number.isNaN(eventAt.getTime()) || eventAt.getTime() < Date.now() - 60 * 60 * 1000) {
      throw new Error("Organizasyon tarihi geçmişte olamaz.");
    }
    if (!Number.isInteger(guestCount) || guestCount < 5 || guestCount > 5000) {
      throw new Error("Kişi sayısı 5 ile 5000 arasında olmalı.");
    }
    if (venueAddress.length < 5) throw new Error("Organizasyon konumunu yazın.");
    if (!venueSettings.has(venueSetting)) throw new Error("Mekân tipini seçin.");
    if (!serviceStyles.has(serviceStyle)) throw new Error("Servis biçimini seçin.");
    if (!menuInterests.length) throw new Error("En az bir menü ilgisi seçin.");
    if (budgetRange && !budgetOptions.has(budgetRange)) throw new Error("Bütçe aralığı geçersiz.");
    if (!contactOptions.has(preferredContact)) throw new Error("Tercih ettiğiniz iletişim kanalını seçin.");
    if (body.consent !== true) throw new Error("İletişim iznini onaylamalısınız.");

    const db = getDb();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [recent] = await db
      .select({ value: count(cateringRequests.id) })
      .from(cateringRequests)
      .where(and(eq(cateringRequests.phone, phone), gte(cateringRequests.createdAt, tenMinutesAgo)));
    if (Number(recent?.value ?? 0) >= 3) {
      return NextResponse.json({ error: "Çok kısa sürede çok sayıda talep gönderdiniz. Lütfen biraz bekleyin." }, { status: 429 });
    }

    const requestNumber = `BONJ-CAT-${Date.now().toString(36).toUpperCase()}`;
    const [saved] = await db.insert(cateringRequests).values({
      requestNumber,
      eventType,
      fullName,
      phone,
      email: email || null,
      company: company || null,
      eventAt,
      guestCount,
      venueName: venueName || null,
      venueAddress,
      venueSetting,
      serviceStyle,
      menuInterests: JSON.stringify(menuInterests),
      dietaryNeeds: dietaryNeeds || null,
      budgetRange: budgetRange || null,
      preferredContact,
      notes: notes || null,
      consent: true,
    }).returning({ id: cateringRequests.id, requestNumber: cateringRequests.requestNumber });

    const eventLabel = eventLabels[eventType] ?? "Organizasyon";
    const eventDateLabel = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(eventAt);
    after(async () => {
      try {
        await sendConfiguredAdminNotification({
          type: "catering",
          request,
          itemId: saved.id,
          message: `BONJ | Yeni catering ${saved.requestNumber}. ${eventLabel}, ${guestCount} kişi, ${eventDateLabel}. ${fullName}.`,
        });
      } catch (error) {
        reportNotificationError("catering", error);
      }
    });

    return NextResponse.json({ ok: true, reference: saved.requestNumber }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Talebiniz gönderilemedi." },
      { status: 400 },
    );
  }
}
