import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { contactMessages } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";

function messageId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await context.params;
  const parsedId = messageId(id);
  if (!parsedId) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });
  const body = (await request.json()) as { status?: string };
  if (!body.status || !["new", "read", "resolved"].includes(body.status)) {
    return NextResponse.json({ error: "Durum bilgisi geçersiz." }, { status: 400 });
  }
  const db = getDb();
  const updated = await db
    .update(contactMessages)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(contactMessages.id, parsedId))
    .returning({ id: contactMessages.id });
  if (!updated.length) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });
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
  const parsedId = messageId(id);
  if (!parsedId) return NextResponse.json({ error: "Mesaj bulunamadı." }, { status: 404 });
  const db = getDb();
  await db.delete(contactMessages).where(eq(contactMessages.id, parsedId));
  return NextResponse.json({ ok: true });
}
