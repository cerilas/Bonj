import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { tableSessionItems, tableSessions } from "@/db/schema";
import { getTableOperator, logTableActivity, staffRoleLabel } from "@/lib/staff-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const operator = await getTableOperator();
  if (!operator) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { itemId } = await context.params;
  const id = Number(itemId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    quantity?: number;
    note?: string;
  };

  const db = getDb();
  const [existing] = await db
    .select({
      id: tableSessionItems.id,
      sessionId: tableSessionItems.sessionId,
      productName: tableSessionItems.productName,
      kitchenSentQuantity: tableSessionItems.kitchenSentQuantity,
      tableId: tableSessions.tableId,
    })
    .from(tableSessionItems)
    .innerJoin(tableSessions, eq(tableSessionItems.sessionId, tableSessions.id))
    .where(eq(tableSessionItems.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }

  if (body.quantity !== undefined) {
    const qty = Math.round(Number(body.quantity));
    if (qty <= 0) {
      await db.delete(tableSessionItems).where(eq(tableSessionItems.id, id));
      await logTableActivity({
        tableId: existing.tableId,
        sessionId: existing.sessionId,
        operator,
        action: "remove_item",
        summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} ${existing.productName} ürününü sildi.`,
      });
      return NextResponse.json({ ok: true, deleted: true });
    }
    const clampedQty = Math.min(99, qty);
    const nextSentQty = Math.min(clampedQty, Math.max(0, existing.kitchenSentQuantity ?? 0));
    await db
      .update(tableSessionItems)
      .set({
        quantity: clampedQty,
        kitchenSentQuantity: nextSentQty,
        updatedAt: new Date(),
      })
      .where(eq(tableSessionItems.id, id));
    await logTableActivity({
      tableId: existing.tableId,
      sessionId: existing.sessionId,
      operator,
      action: "update_item",
      summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} ${existing.productName} adedini ${clampedQty} yaptı.`,
    });
  }

  if (body.note !== undefined) {
    await db
      .update(tableSessionItems)
      .set({ note: String(body.note).trim().slice(0, 180) || null, updatedAt: new Date() })
      .where(eq(tableSessionItems.id, id));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const operator = await getTableOperator();
  if (!operator) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { itemId } = await context.params;
  const id = Number(itemId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }

  const db = getDb();
  const [existing] = await db
    .select({
      id: tableSessionItems.id,
      sessionId: tableSessionItems.sessionId,
      productName: tableSessionItems.productName,
      kitchenSentQuantity: tableSessionItems.kitchenSentQuantity,
      tableId: tableSessions.tableId,
    })
    .from(tableSessionItems)
    .innerJoin(tableSessions, eq(tableSessionItems.sessionId, tableSessions.id))
    .where(eq(tableSessionItems.id, id))
    .limit(1);

  if (existing) {
    await db.delete(tableSessionItems).where(eq(tableSessionItems.id, id));
    await logTableActivity({
      tableId: existing.tableId,
      sessionId: existing.sessionId,
      operator,
      action: "remove_item",
      summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} ${existing.productName} ürününü sildi.`,
    });
  }

  return NextResponse.json({ ok: true });
}
