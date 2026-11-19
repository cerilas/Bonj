import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cafeTables, menuItems, tableSessionItems, tableSessions } from "@/db/schema";
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
    menuItemId?: number;
    productName?: string;
    unitPriceInKurus?: number;
    quantity?: number;
    note?: string;
  };

  const quantity = Math.max(1, Math.min(99, Number(body.quantity ?? 1) || 1));
  const note = String(body.note ?? "").trim().slice(0, 180) || null;

  const db = getDb();

  const [table] = await db
    .select({ id: cafeTables.id })
    .from(cafeTables)
    .where(and(eq(cafeTables.id, tableId), eq(cafeTables.isActive, true)))
    .limit(1);

  if (!table) {
    return NextResponse.json({ error: "Masa bulunamadı." }, { status: 404 });
  }

  let resolvedName = String(body.productName ?? "").trim().slice(0, 120);
  let resolvedPrice = Math.max(0, Math.round(Number(body.unitPriceInKurus ?? 0) || 0));
  let resolvedMenuItemId: number | null = null;

  if (body.menuItemId) {
    const [menuItem] = await db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        priceInKurus: menuItems.priceInKurus,
      })
      .from(menuItems)
      .where(eq(menuItems.id, Number(body.menuItemId)))
      .limit(1);

    if (!menuItem) {
      return NextResponse.json({ error: "Menü ürünü bulunamadı." }, { status: 404 });
    }
    resolvedMenuItemId = menuItem.id;
    resolvedName = menuItem.name;
    resolvedPrice = menuItem.priceInKurus ?? 0;
  } else if (!resolvedName) {
    return NextResponse.json({ error: "Ürün adı veya menü ürünü zorunludur." }, { status: 400 });
  }

  // Ensure open session exists (auto-open on first item add)
  let [session] = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")))
    .limit(1);

  if (!session) {
    const [createdSession] = await db
      .insert(tableSessions)
      .values({
        tableId,
        status: "open",
        guestCount: 2,
        openedAt: new Date(),
      })
      .returning();
    session = createdSession;
  }

  // Merge quantity if identical menuItemId & no note & pos source
  if (resolvedMenuItemId && !note) {
    const [existingItem] = await db
      .select()
      .from(tableSessionItems)
      .where(
        and(
          eq(tableSessionItems.sessionId, session.id),
          eq(tableSessionItems.menuItemId, resolvedMenuItemId),
          eq(tableSessionItems.source, "pos"),
          isNull(tableSessionItems.note),
        ),
      )
      .limit(1);

    if (existingItem) {
      const [updated] = await db
        .update(tableSessionItems)
        .set({
          quantity: existingItem.quantity + quantity,
          updatedAt: new Date(),
        })
        .where(eq(tableSessionItems.id, existingItem.id))
        .returning();

      await logTableActivity({
        tableId,
        sessionId: session.id,
        operator,
        action: "add_item",
        summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} ${quantity}× ${resolvedName} ekledi.`,
      });

      return NextResponse.json({ ok: true, item: updated, sessionId: session.id });
    }
  }

  const [inserted] = await db
    .insert(tableSessionItems)
    .values({
      sessionId: session.id,
      menuItemId: resolvedMenuItemId,
      productName: resolvedName,
      unitPriceInKurus: resolvedPrice,
      quantity,
      note,
      source: "pos",
    })
    .returning();

  await logTableActivity({
    tableId,
    sessionId: session.id,
    operator,
    action: "add_item",
    summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} ${quantity}× ${resolvedName} ekledi.`,
  });

  return NextResponse.json({ ok: true, item: inserted, sessionId: session.id }, { status: 201 });
}
