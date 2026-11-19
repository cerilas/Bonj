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
  const sourceTableId = Number(id);
  const body = (await request.json().catch(() => ({}))) as { targetTableId?: number };
  const targetTableId = Number(body.targetTableId);

  if (
    !Number.isInteger(sourceTableId) ||
    sourceTableId < 1 ||
    !Number.isInteger(targetTableId) ||
    targetTableId < 1 ||
    sourceTableId === targetTableId
  ) {
    return NextResponse.json({ error: "Geçerli bir hedef masa seçin." }, { status: 400 });
  }

  const db = getDb();

  const [targetTable] = await db
    .select({ id: cafeTables.id, name: cafeTables.name })
    .from(cafeTables)
    .where(and(eq(cafeTables.id, targetTableId), eq(cafeTables.isActive, true)))
    .limit(1);

  if (!targetTable) {
    return NextResponse.json({ error: "Hedef masa bulunamadı." }, { status: 404 });
  }

  const [sourceSession] = await db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, sourceTableId), eq(tableSessions.status, "open")))
    .limit(1);

  if (!sourceSession) {
    return NextResponse.json({ error: "Taşınacak açık oturum bulunamadı." }, { status: 404 });
  }

  const [targetOpenSession] = await db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, targetTableId), eq(tableSessions.status, "open")))
    .limit(1);

  if (targetOpenSession) {
    return NextResponse.json(
      { error: `${targetTable.name} masasında zaten açık oturum var.` },
      { status: 400 },
    );
  }

  await db
    .update(tableSessions)
    .set({ tableId: targetTableId, updatedAt: new Date() })
    .where(eq(tableSessions.id, sourceSession.id));

  await logTableActivity({
    tableId: targetTableId,
    sessionId: sourceSession.id,
    operator,
    action: "move",
    summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} masayı ${targetTable.name} masasına taşıdı.`,
  });

  return NextResponse.json({ ok: true });
}
