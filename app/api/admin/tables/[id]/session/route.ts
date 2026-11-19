import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { tableSessions } from "@/db/schema";
import { getTableOperator, logTableActivity, staffRoleLabel } from "@/lib/staff-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const operator = await getTableOperator();
  if (!operator) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { id } = await context.params;
  const tableId = Number(id);
  if (!Number.isInteger(tableId) || tableId < 1) {
    return NextResponse.json({ error: "Masa bulunamadı." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    guestCount?: number;
    customerName?: string | null;
    note?: string | null;
  };

  const db = getDb();
  const [session] = await db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "Açık oturum bulunamadı." }, { status: 404 });
  }

  const updates: Partial<typeof tableSessions.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.guestCount !== undefined) {
    updates.guestCount = Math.max(1, Math.min(30, Math.round(Number(body.guestCount) || 1)));
  }
  if (body.customerName !== undefined) {
    updates.customerName = body.customerName ? String(body.customerName).trim().slice(0, 120) || null : null;
  }
  if (body.note !== undefined) {
    updates.note = body.note ? String(body.note).trim().slice(0, 500) || null : null;
  }

  await db.update(tableSessions).set(updates).where(eq(tableSessions.id, session.id));

  await logTableActivity({
    tableId,
    sessionId: session.id,
    operator,
    action: "update_meta",
    summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} masa bilgisini güncelledi.`,
  });

  return NextResponse.json({ ok: true });
}
