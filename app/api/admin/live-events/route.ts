import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cafeTables, menuItems, orderItems, orders, tableActivityLogs, tableSessions } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { ensureKitchenSchemaReady } from "@/lib/admin-tables";

export const dynamic = "force-dynamic";

export type LiveOrderItem = {
  productName: string;
  quantity: number;
  unitPriceInKurus: number;
  lineTotalInKurus: number;
  note?: string | null;
  prepStation?: "kitchen" | "counter";
};

export type AdminLiveEvent =
  | {
      kind: "order";
      id: number;
      orderId: number;
      orderNumber: string;
      customerName: string;
      fulfillmentType: "delivery" | "pickup" | "table" | string;
      tableNumber: string | null;
      note: string | null;
      pickupAt: string | null;
      totalInKurus: number;
      createdAt: string;
      items: LiveOrderItem[];
    }
  | {
      kind: "staff_table";
      id: number;
      tableId: number;
      tableName: string;
      tableZone: string;
      actorName: string;
      actorRole: string;
      action: string;
      summary: string;
      note: string | null;
      createdAt: string;
      items: LiveOrderItem[];
    };

function parseStaffAddedItem(summary: string): LiveOrderItem[] {
  const noteMatch = summary.match(/\[Not:\s*(.+?)\]\s*$/i);
  const itemNote = noteMatch ? noteMatch[1].trim() : null;
  const cleanSummary = noteMatch ? summary.slice(0, noteMatch.index).trim() : summary;
  const match = cleanSummary.match(/(\d+)\s*[×x]\s+(.+?)\s+ekledi\.?$/i);
  if (!match) return [];
  const quantity = Math.max(1, Number(match[1]) || 1);
  const productName = match[2].trim();
  if (!productName) return [];
  return [
    {
      productName,
      quantity,
      unitPriceInKurus: 0,
      lineTotalInKurus: 0,
      note: itemNote,
    },
  ];
}

export async function GET(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const sinceParam = new URL(request.url).searchParams.get("since");
  const parsedSince = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 10_000);
  const baseSince = Number.isNaN(parsedSince.getTime())
    ? new Date(Date.now() - 10_000)
    : parsedSince;
  // 5-second overlap prevents missing orders across concurrent DB transactions or clock skew
  const since = new Date(baseSince.getTime() - 5000);

  await ensureKitchenSchemaReady();
  const db = getDb();

  const newOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      fulfillmentType: orders.fulfillmentType,
      tableNumber: orders.tableNumber,
      note: orders.note,
      pickupAt: orders.pickupAt,
      totalInKurus: orders.totalInKurus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.status, "new"), gt(orders.updatedAt, since)))
    .orderBy(asc(orders.updatedAt))
    .limit(20);

  const newOrderIds = newOrders.map((o) => o.id);
  const newOrderItemRows = newOrderIds.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          productName: orderItems.productName,
          quantity: orderItems.quantity,
          unitPriceInKurus: orderItems.unitPriceInKurus,
          lineTotalInKurus: orderItems.lineTotalInKurus,
          prepStation: menuItems.prepStation,
        })
        .from(orderItems)
        .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(inArray(orderItems.orderId, newOrderIds))
        .orderBy(asc(orderItems.id))
    : [];

  const itemsByOrderId = new Map<number, LiveOrderItem[]>();
  for (const item of newOrderItemRows) {
    const list = itemsByOrderId.get(item.orderId) ?? [];
    list.push({
      productName: item.productName,
      quantity: item.quantity,
      unitPriceInKurus: item.unitPriceInKurus,
      lineTotalInKurus: item.lineTotalInKurus,
      prepStation: item.prepStation === "counter" ? "counter" : "kitchen",
    });
    itemsByOrderId.set(item.orderId, list);
  }

  const staffTableLogs = await db
    .select({
      id: tableActivityLogs.id,
      tableId: tableActivityLogs.tableId,
      tableName: cafeTables.name,
      tableZone: cafeTables.zone,
      sessionNote: tableSessions.note,
      actorName: tableActivityLogs.actorName,
      actorRole: tableActivityLogs.actorRole,
      action: tableActivityLogs.action,
      summary: tableActivityLogs.summary,
      createdAt: tableActivityLogs.createdAt,
    })
    .from(tableActivityLogs)
    .innerJoin(cafeTables, eq(tableActivityLogs.tableId, cafeTables.id))
    .leftJoin(tableSessions, eq(tableActivityLogs.sessionId, tableSessions.id))
    .where(
      and(
        gt(tableActivityLogs.createdAt, since),
        eq(tableActivityLogs.actorType, "staff"),
        inArray(tableActivityLogs.action, ["open", "add_item"]),
      ),
    )
    .orderBy(asc(tableActivityLogs.createdAt))
    .limit(25);

  const events: AdminLiveEvent[] = [
    ...newOrders.map((o) => ({
      kind: "order" as const,
      id: o.id,
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      fulfillmentType: o.fulfillmentType,
      tableNumber: o.tableNumber,
      note: o.note ?? null,
      pickupAt: o.pickupAt ? o.pickupAt.toISOString() : null,
      totalInKurus: o.totalInKurus,
      createdAt: o.createdAt.toISOString(),
      items: itemsByOrderId.get(o.id) ?? [],
    })),
    ...staffTableLogs.map((l) => ({
      kind: "staff_table" as const,
      id: l.id,
      tableId: l.tableId,
      tableName: l.tableName,
      tableZone: l.tableZone,
      actorName: l.actorName,
      actorRole: l.actorRole,
      action: l.action,
      summary: l.summary,
      note: l.sessionNote ?? null,
      createdAt: l.createdAt.toISOString(),
      items: l.action === "add_item" ? parseStaffAddedItem(l.summary) : [],
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    events,
  });
}
