import { max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdminCategories } from "@/lib/admin-data";

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  return NextResponse.json({ categories: await getAdminCategories() });
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
    const name = String(body.name ?? "").trim().slice(0, 80);
    if (!name) throw new Error("Kategori adı zorunludur.");

    const requestedOrder = Number(body.sortOrder);
    if (
      body.sortOrder !== undefined &&
      body.sortOrder !== "" &&
      (!Number.isInteger(requestedOrder) || requestedOrder < 0 || requestedOrder > 10_000)
    ) {
      throw new Error("Sıralama bilgisi geçersiz.");
    }

    const db = getDb();
    const [position] = await db
      .select({ value: max(categories.sortOrder) })
      .from(categories);
    const sortOrder =
      body.sortOrder === undefined || body.sortOrder === ""
        ? (position?.value ?? 0) + 1
        : requestedOrder;

    const [created] = await db
      .insert(categories)
      .values({
        name,
        slug: slugify(name) || `kategori-${Date.now()}`,
        description: String(body.description ?? "").trim().slice(0, 2000) || null,
        imageAlt: String(body.imageAlt ?? "").trim().slice(0, 180) || null,
        sortOrder,
        isActive: body.isActive !== false,
        updatedAt: new Date(),
      })
      .returning({ id: categories.id });

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kategori kaydedilemedi.";
    const status = message.toLowerCase().includes("unique") ? 409 : 400;
    return NextResponse.json(
      { error: status === 409 ? "Bu isimde bir kategori zaten var." : message },
      { status },
    );
  }
}
