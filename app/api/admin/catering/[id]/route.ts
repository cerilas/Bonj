import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cateringRequests } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";

const statuses = new Set(["new", "contacted", "quoted", "confirmed", "completed", "declined"]);

function requestId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const { id } = await context.params;
  const parsedId = requestId(id);
  if (!parsedId) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
  const body = (await request.json()) as { status?: string };
  if (!body.status || !statuses.has(body.status)) return NextResponse.json({ error: "Durum bilgisi geçersiz." }, { status: 400 });
  const db = getDb();
  const updated = await db.update(cateringRequests).set({ status: body.status, updatedAt: new Date() })
    .where(eq(cateringRequests.id, parsedId)).returning({ id: cateringRequests.id });
  if (!updated.length) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const { id } = await context.params;
  const parsedId = requestId(id);
  if (!parsedId) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
  const db = getDb();
  await db.delete(cateringRequests).where(eq(cateringRequests.id, parsedId));
  return NextResponse.json({ ok: true });
}
