import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cafeTables, menuItems, tableKitchenTickets, tableSessionItems, tableSessions } from "@/db/schema";
import { ensureKitchenSchemaReady, type AdminKitchenTicketItem } from "@/lib/admin-tables";
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
    itemIds?: number[];
    note?: string;
    customOrderText?: string;
  };

  const ticketNote = String(body.note ?? "").trim().slice(0, 300) || null;
  const customOrderText = String(body.customOrderText ?? "").trim().slice(0, 200) || null;
  const filterItemIds = Array.isArray(body.itemIds)
    ? body.itemIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
    : null;

  await ensureKitchenSchemaReady();
  const db = getDb();

  const [table] = await db
    .select()
    .from(cafeTables)
    .where(and(eq(cafeTables.id, tableId), eq(cafeTables.isActive, true)))
    .limit(1);

  if (!table) {
    return NextResponse.json({ error: "Masa bulunamadı." }, { status: 404 });
  }

  const result = await db.transaction(async (tx) => {
    let [session] = await tx
      .select()
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")))
      .limit(1);

    if (!session) {
      if (!customOrderText && !ticketNote) {
        return { error: "Bu masada açık oturum bulunmuyor." as const, status: 400 as const };
      }
      const [createdSession] = await tx
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

    const sessionItems = await tx
      .select({
        id: tableSessionItems.id,
        productName: tableSessionItems.productName,
        quantity: tableSessionItems.quantity,
        kitchenSentQuantity: tableSessionItems.kitchenSentQuantity,
        note: tableSessionItems.note,
        prepStation: menuItems.prepStation,
      })
      .from(tableSessionItems)
      .leftJoin(menuItems, eq(tableSessionItems.menuItemId, menuItems.id))
      .where(
        filterItemIds && filterItemIds.length > 0
          ? and(
              eq(tableSessionItems.sessionId, session.id),
              inArray(tableSessionItems.id, filterItemIds),
            )
          : eq(tableSessionItems.sessionId, session.id),
      )
      .orderBy(asc(tableSessionItems.createdAt), asc(tableSessionItems.id));

    const unsentRows = sessionItems.filter(
      (row) =>
        (row.prepStation ?? "kitchen") !== "counter" &&
        row.quantity > Math.max(0, row.kitchenSentQuantity ?? 0),
    );

    const deltaItems: AdminKitchenTicketItem[] = unsentRows.map((row) => ({
      productName: row.productName,
      quantity: row.quantity - Math.max(0, row.kitchenSentQuantity ?? 0),
      note: row.note ?? null,
    }));

    if (customOrderText) {
      deltaItems.push({
        productName: `ÖZEL: ${customOrderText}`,
        quantity: 1,
        note: ticketNote,
      });
    }

    if (deltaItems.length === 0 && !ticketNote) {
      return { nothingPending: true as const, session };
    }

    if (deltaItems.length === 0 && ticketNote) {
      deltaItems.push({
        productName: "Mutfak Özel Notu",
        quantity: 1,
        note: ticketNote,
      });
    }

    const existingTickets = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tableKitchenTickets)
      .where(eq(tableKitchenTickets.sessionId, session.id));

    const nextTicketNumber = (existingTickets[0]?.count ?? 0) + 1;

    for (const row of unsentRows) {
      await tx
        .update(tableSessionItems)
        .set({
          kitchenSentQuantity: row.quantity,
          updatedAt: new Date(),
        })
        .where(eq(tableSessionItems.id, row.id));
    }

    const [ticket] = await tx
      .insert(tableKitchenTickets)
      .values({
        tableId,
        sessionId: session.id,
        ticketNumber: nextTicketNumber,
        actorName: operator.actorName,
        note: ticketNote,
        itemsJson: JSON.stringify(deltaItems),
      })
      .returning();

    const itemsPreview = deltaItems
      .map((i) => `${i.quantity}× ${i.productName}${i.note ? ` (${i.note})` : ""}`)
      .join(", ");

    await logTableActivity({
      tableId,
      sessionId: session.id,
      operator,
      action: "kitchen_send",
      summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} Mutfak Fişi #${nextTicketNumber} gönderdi: ${itemsPreview}`,
    });

    return {
      nothingPending: false as const,
      session,
      ticket: {
        id: ticket.id,
        tableId: ticket.tableId,
        sessionId: ticket.sessionId,
        ticketNumber: ticket.ticketNumber,
        actorName: ticket.actorName,
        note: ticket.note ?? null,
        items: deltaItems,
        createdAt: ticket.createdAt.toISOString(),
      },
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.nothingPending) {
    return NextResponse.json({
      ok: true,
      nothingPending: true,
      ticket: null,
    });
  }

  return NextResponse.json({
    ok: true,
    nothingPending: false,
    ticket: result.ticket,
    table: {
      id: table.id,
      name: table.name,
      zone: table.zone,
    },
    session: {
      id: result.session.id,
      openedAt: result.session.openedAt.toISOString(),
      guestCount: result.session.guestCount,
      customerName: result.session.customerName,
      note: result.session.note,
    },
  });
}
