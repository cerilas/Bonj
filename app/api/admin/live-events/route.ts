import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cafeTables, orders, tableActivityLogs } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export type AdminLiveEvent =
  | {
      kind: "order";
      id: number;
      orderId: number;
      orderNumber: string;
      customerName: string;
      fulfillmentType: "delivery" | "pickup" | "table" | string;
      tableNumber: string | null;
      totalInKurus: number;
      createdAt: string;
    }
  | {
      kind: "staff_table";
      id: number;
      tableId: number;
      tableName: string;
      actorName: string;
      actorRole: string;
      action: string;
      summary: string;
      createdAt: string;
    };

export async function GET(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const sinceParam = new URL(request.url).searchParams.get("since");
  const parsedSince = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 10_000);
  const since = Number.isNaN(parsedSince.getTime())
    ? new Date(Date.now() - 10_000)
    : parsedSince;

  const db = getDb();

  const newOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      fulfillmentType: orders.fulfillmentType,
      tableNumber: orders.tableNumber,
      totalInKurus: orders.totalInKurus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(gt(orders.createdAt, since))
    .orderBy(asc(orders.createdAt))
    .limit(20);

  const staffTableLogs = await db
    .select({
      id: tableActivityLogs.id,
      tableId: tableActivityLogs.tableId,
      tableName: cafeTables.name,
      actorName: tableActivityLogs.actorName,
      actorRole: tableActivityLogs.actorRole,
      action: tableActivityLogs.action,
      summary: tableActivityLogs.summary,
      createdAt: tableActivityLogs.createdAt,
    })
    .from(tableActivityLogs)
    .innerJoin(cafeTables, eq(tableActivityLogs.tableId, cafeTables.id))
    .where(
      and(
        gt(tableActivityLogs.createdAt, since),
        eq(tableActivityLogs.actorType, "staff"),
        inArray(tableActivityLogs.action, ["open", "add_item"]),
      ),
    )
    .orderBy(asc(tableActivityLogs.createdAt))
    .limit(20);

  const events: AdminLiveEvent[] = [
    ...newOrders.map((o) => ({
      kind: "order" as const,
      id: o.id,
      orderId: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      fulfillmentType: o.fulfillmentType,
      tableNumber: o.tableNumber,
      totalInKurus: o.totalInKurus,
      createdAt: o.createdAt.toISOString(),
    })),
    ...staffTableLogs.map((l) => ({
      kind: "staff_table" as const,
      id: l.id,
      tableId: l.tableId,
      tableName: l.tableName,
      actorName: l.actorName,
      actorRole: l.actorRole,
      action: l.action,
      summary: l.summary,
      createdAt: l.createdAt.toISOString(),
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    events,
  });
}
