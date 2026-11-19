import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cafeTables, tableSessions } from "@/db/schema";
import { getTableOperator, logTableActivity, staffRoleLabel } from "@/lib/staff-auth";

export async function POST(
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
    customerName?: string;
    note?: string;
  };

  const db = getDb();
  const [table] = await db
    .select({ id: cafeTables.id })
    .from(cafeTables)
    .where(and(eq(cafeTables.id, tableId), eq(cafeTables.isActive, true)))
    .limit(1);

  if (!table) {
    return NextResponse.json({ error: "Masa bulunamadı." }, { status: 404 });
  }

  const [existingOpen] = await db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")))
    .limit(1);

  if (existingOpen) {
    return NextResponse.json(
      { error: "Bu masada zaten açık bir oturum var." },
      { status: 400 },
    );
  }

  const guestCount = Math.max(1, Math.min(30, Number(body.guestCount ?? 2) || 2));
  const customerName = String(body.customerName ?? "").trim().slice(0, 120) || null;
  const note = String(body.note ?? "").trim().slice(0, 500) || null;

  const [session] = await db
    .insert(tableSessions)
    .values({
      tableId,
      status: "open",
      guestCount,
      customerName,
      note,
      openedAt: new Date(),
    })
    .returning();

  await logTableActivity({
    tableId,
    sessionId: session.id,
    operator,
    action: "open",
    summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} masayı açtı (${guestCount} kişi).`,
  });

  return NextResponse.json({ ok: true, session }, { status: 201 });
}
