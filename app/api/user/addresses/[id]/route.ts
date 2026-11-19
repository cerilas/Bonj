import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { userAddresses } from "@/db/schema";
import { getCurrentUser } from "@/lib/user-auth";
import { GAZIANTEP_DISTRICTS } from "../route";

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const { id } = await props.params;
  const addressId = parseInt(id, 10);
  if (!addressId || Number.isNaN(addressId)) {
    return NextResponse.json({ error: "Geçersiz adres ID." }, { status: 400 });
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

    if (!title) throw new Error("Lütfen bir adres başlığı girin.");
    if (!fullName) throw new Error("Lütfen ad ve soyad girin.");
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      throw new Error("Lütfen geçerli bir telefon numarası girin.");
    }

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

    // Verify ownership
    const [existing] = await db
      .select()
      .from(userAddresses)
      .where(
        and(
          eq(userAddresses.id, addressId),
          eq(userAddresses.userId, current.id),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Adres bulunamadı." }, { status: 404 });
    }

    if (isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, current.id));
    }

    const [updated] = await db
      .update(userAddresses)
      .set({
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
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userAddresses.id, addressId),
          eq(userAddresses.userId, current.id),
        ),
      )
      .returning();

    return NextResponse.json({
      ok: true,
      message: "Adres güncellendi.",
      address: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adres güncellenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const { id } = await props.params;
  const addressId = parseInt(id, 10);
  if (!addressId || Number.isNaN(addressId)) {
    return NextResponse.json({ error: "Geçersiz adres ID." }, { status: 400 });
  }

  const db = getDb();
  const deleted = await db
    .delete(userAddresses)
    .where(
      and(
        eq(userAddresses.id, addressId),
        eq(userAddresses.userId, current.id),
      ),
    )
    .returning({ id: userAddresses.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Adres bulunamadı veya silinemedi." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, message: "Adres silindi." });
}
