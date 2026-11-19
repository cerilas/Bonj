import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cafeTables, tableSessions } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { id } = await context.params;
  const tableId = Number(id);
  if (!Number.isInteger(tableId) || tableId < 1) {
    return NextResponse.json({ error: "Masa bulunamadı." }, { status: 404 });
  }

  const db = getDb();
  const [openSession] = await db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")))
    .limit(1);

  if (openSession) {
    return NextResponse.json(
      { error: "Açık oturumu olan masa silinemez. Önce hesabı kapatın." },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(cafeTables)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(cafeTables.id, tableId))
    .returning({ id: cafeTables.id });

  if (!updated) {
    return NextResponse.json({ error: "Masa bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
