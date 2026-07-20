import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { categories, menuItems } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";

function categoryIdFrom(value: string) {
  const categoryId = Number(value);
  return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
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
  const categoryId = categoryIdFrom(id);
  if (!categoryId) {
    return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim().slice(0, 80);
    const sortOrder = Number(body.sortOrder);
    if (!name) throw new Error("Kategori adı zorunludur.");
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000) {
      throw new Error("Sıralama bilgisi geçersiz.");
    }

    const db = getDb();
    const updated = await db
      .update(categories)
      .set({
        name,
        description: String(body.description ?? "").trim().slice(0, 2000) || null,
        imageAlt: String(body.imageAlt ?? "").trim().slice(0, 180) || null,
        sortOrder,
        isActive: body.isActive !== false,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, categoryId))
      .returning({ id: categories.id });

    if (!updated.length) {
      return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kategori güncellenemedi." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { id } = await context.params;
  const categoryId = categoryIdFrom(id);
  if (!categoryId) {
    return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });
  }

  const db = getDb();
  const [usage] = await db
    .select({ value: count(menuItems.id) })
    .from(menuItems)
    .where(eq(menuItems.categoryId, categoryId));
  const productCount = Number(usage?.value ?? 0);
  if (productCount > 0) {
    return NextResponse.json(
      {
        error: `Bu kategoride ${productCount} ürün var. Silmeden önce ürünleri başka bir kategoriye taşıyın.`,
      },
      { status: 409 },
    );
  }

  const deleted = await db
    .delete(categories)
    .where(eq(categories.id, categoryId))
    .returning({ id: categories.id });
  if (!deleted.length) {
    return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
