import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { userAddresses } from "@/db/schema";
import { getCurrentUser } from "@/lib/user-auth";

export const GAZIANTEP_DISTRICTS = [
  "Şahinbey",
  "Şehitkamil",
  "Nizip",
  "İslahiye",
  "Oğuzeli",
  "Nurdağı",
  "Araban",
  "Yavuzeli",
  "Karkamış",
] as const;

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const db = getDb();
  const addresses = await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.userId, current.id))
    .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));

  return NextResponse.json({ addresses });
}

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body.title ?? "").trim().slice(0, 60);
    const fullName = String(body.fullName ?? "").trim().slice(0, 120);
    const phone = String(body.phone ?? "").trim().slice(0, 32);
    const city = String(body.city ?? "").trim();
    const district = String(body.district ?? "").trim();
    const street = String(body.street ?? "").trim().slice(0, 150);
    const addressLine = String(body.addressLine ?? "").trim().slice(0, 1000);
    const lat = body.lat ? String(body.lat).trim() : null;
    const lng = body.lng ? String(body.lng).trim() : null;
    const isDefault = Boolean(body.isDefault);

    if (!title) throw new Error("Lütfen bir adres başlığı girin (Örn: Evim, İş Yeri).");
    if (!fullName) throw new Error("Lütfen ad ve soyad girin.");
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      throw new Error("Lütfen geçerli bir telefon numarası girin.");
    }

    // Strict Gaziantep City Check
    if (city.toLowerCase() !== "gaziantep") {
      throw new Error("Bonj teslimat hizmeti şu an yalnızca Gaziantep şehrinde verilmektedir.");
    }

    const matchedDistrict = GAZIANTEP_DISTRICTS.find(
      (d) => d.toLowerCase() === district.toLowerCase(),
    );
    if (!matchedDistrict) {
      throw new Error(
        `Lütfen geçerli bir Gaziantep ilçesi seçin (${GAZIANTEP_DISTRICTS.join(", ")}).`,
      );
    }

    if (!street) throw new Error("Lütfen sokak veya cadde adını girin.");
    if (!addressLine) throw new Error("Lütfen bina no, daire veya açık adres tarifini girin.");

    const db = getDb();

    // If marked default, unset default on previous addresses
    if (isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, current.id));
    }

    const [created] = await db
      .insert(userAddresses)
      .values({
        userId: current.id,
        title,
        fullName,
        phone,
        city: "Gaziantep",
        district: matchedDistrict,
        street,
        addressLine,
        lat,
        lng,
        isDefault,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      message: "Adresiniz başarıyla kaydedildi.",
      address: created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adres kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
