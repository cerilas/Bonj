import { max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { menuItems } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdminProducts } from "@/lib/admin-data";

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalizeProduct(body: Record<string, unknown>) {
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
  if (
    priceInKurus !== null &&
    (!Number.isInteger(priceInKurus) || priceInKurus < 0 || priceInKurus > 10_000_000)
  ) {
    throw new Error("Fiyat bilgisi geçersiz.");
  }
  if (
    estimatedCalories !== null &&
    (!Number.isInteger(estimatedCalories) || estimatedCalories < 0 || estimatedCalories > 10_000)
  ) {
    throw new Error("Kalori bilgisi geçersiz.");
  }

  return {
    categoryId,
    slug: slugify(String(body.slug ?? "").trim() || name),
    name,
    description,
    longDescription: String(body.longDescription ?? "").trim().slice(0, 5000) || null,
    allergenInfo: String(body.allergenInfo ?? "").trim().slice(0, 1000) || null,
    estimatedCalories,
    imageAlt: String(body.imageAlt ?? "").trim().slice(0, 180) || null,
    priceInKurus,
    badge: String(body.badge ?? "").trim().slice(0, 40) || null,
    accent: ["berry", "cream", "coffee", "citrus", "avocado"].includes(
      String(body.accent),
    )
      ? String(body.accent)
      : "cream",
    isFeatured: Boolean(body.isFeatured),
    isActive: body.isActive !== false,
  };
}

export async function GET(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
  const query = url.searchParams.get("query") ?? "";
  const rawStatus = url.searchParams.get("status");
  const status = rawStatus === "active" || rawStatus === "passive" ? rawStatus : "all";
  return NextResponse.json(
    await getAdminProducts({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 10,
      query,
      status,
    }),
  );
}

export async function POST(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const values = normalizeProduct(body);
    const db = getDb();
    const [position] = await db
      .select({ value: max(menuItems.sortOrder) })
      .from(menuItems);

    const [created] = await db
      .insert(menuItems)
      .values({ ...values, sortOrder: (position?.value ?? 0) + 1 })
      .returning({ id: menuItems.id });

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ürün kaydedilemedi.";
    const status = message.includes("unique") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
