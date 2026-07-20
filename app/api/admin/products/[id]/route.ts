import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { menuItems } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";

const accents = ["berry", "cream", "coffee", "citrus", "avocado"];

function optionalText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength) || null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) {
    return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim().slice(0, 120);
    const description = String(body.shortDescription ?? "").trim().slice(0, 500);
    const categoryId = Number(body.categoryId);
    const priceInKurus =
      body.priceInKurus === null || body.priceInKurus === ""
        ? null
        : Number(body.priceInKurus);
    const estimatedCalories =
      body.estimatedCalories === null || body.estimatedCalories === ""
        ? null
        : Number(body.estimatedCalories);

    if (!name || !description || !Number.isInteger(categoryId)) {
      throw new Error("Ürün adı, kısa açıklama ve kategori zorunludur.");
    }
    if (priceInKurus !== null && (!Number.isInteger(priceInKurus) || priceInKurus < 0)) {
      throw new Error("Fiyat bilgisi geçersiz.");
    }
    if (
      estimatedCalories !== null &&
      (!Number.isInteger(estimatedCalories) || estimatedCalories < 0 || estimatedCalories > 10_000)
    ) {
      throw new Error("Kalori bilgisi geçersiz.");
    }

    const db = getDb();
    await db
      .update(menuItems)
      .set({
        categoryId,
        name,
        description,
        longDescription: optionalText(body.longDescription, 5000),
        allergenInfo: optionalText(body.allergenInfo, 1000),
        estimatedCalories,
        imageAlt: optionalText(body.imageAlt, 180),
        priceInKurus,
        badge: optionalText(body.badge, 40),
        accent: accents.includes(String(body.accent)) ? String(body.accent) : "cream",
        isFeatured: Boolean(body.isFeatured),
        isActive: body.isActive !== false,
        updatedAt: new Date(),
      })
      .where(eq(menuItems.id, productId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ürün güncellenemedi." },
      { status: 400 },
    );
  }
}
