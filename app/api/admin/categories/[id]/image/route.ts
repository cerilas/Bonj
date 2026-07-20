import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { categoryImages } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileSize = 5 * 1024 * 1024;

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await context.params;
  const categoryId = parseId(id);
  if (!categoryId) {
    return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });
  }

  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File) || !allowedTypes.has(image.type)) {
    return NextResponse.json(
      { error: "JPG, PNG veya WebP formatında bir görsel seçin." },
      { status: 400 },
    );
  }
  if (image.size > maxFileSize) {
    return NextResponse.json({ error: "Görsel en fazla 5 MB olabilir." }, { status: 400 });
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const db = getDb();
  await db
    .insert(categoryImages)
    .values({
      categoryId,
      data: imageBuffer,
      mimeType: image.type,
      sizeInBytes: image.size,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: categoryImages.categoryId,
      set: {
        data: imageBuffer,
        mimeType: image.type,
        sizeInBytes: image.size,
        updatedAt: new Date(),
      },
    });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await context.params;
  const categoryId = parseId(id);
  if (!categoryId) {
    return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });
  }
  const db = getDb();
  await db.delete(categoryImages).where(eq(categoryImages.categoryId, categoryId));
  return NextResponse.json({ ok: true });
}
