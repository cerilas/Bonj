import { and, asc, desc, eq, gte, inArray, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  cafeTables,
  orderItems,
  orders,
  tableActivityLogs,
  tableSessionItems,
  tableSessions,
} from "@/db/schema";

export type AdminTableSessionItem = {
  id: number;
  sessionId: number;
  menuItemId: number | null;
  productName: string;
  unitPriceInKurus: number;
  quantity: number;
  lineTotalInKurus: number;
  note: string | null;
  source: string;
  orderId: number | null;
  createdAt: string;
};

export type AdminTableSession = {
  id: number;
  tableId: number;
  status: string;
  guestCount: number;
  customerName: string | null;
  note: string | null;
  paymentMethod: string | null;
  paidCashInKurus: number;
  paidCardInKurus: number;
  discountInKurus: number;
  openedAt: string;
  closedAt: string | null;
  items: AdminTableSessionItem[];
  subtotalInKurus: number;
};

export type AdminTableOnlineOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  status: string;
  paymentStatus: string;
  totalInKurus: number;
  createdAt: string;
  items: Array<{
    id: number;
    productName: string;
    quantity: number;
    unitPriceInKurus: number;
    lineTotalInKurus: number;
  }>;
};

export type AdminTableActivityLog = {
  id: number;
  actorName: string;
  actorRole: string;
  action: string;
  summary: string;
  createdAt: string;
};

export type AdminCafeTable = {
  id: number;
  code: string;
  name: string;
  zone: string;
  capacity: number;
  sortOrder: number;
  activeSession: AdminTableSession | null;
  onlineOrders: AdminTableOnlineOrder[];
  recentLogs: AdminTableActivityLog[];
};

export type AdminClosedTableSession = AdminTableSession & {
  tableCode: string;
  tableName: string;
  tableZone: string;
};

export type AdminTablesSnapshot = {
  tables: AdminCafeTable[];
  recentClosed: AdminClosedTableSession[];
  summary: {
    totalTables: number;
    openTables: number;
    openTotalInKurus: number;
    todayCashInKurus: number;
    todayCardInKurus: number;
    todayClosedCount: number;
  };
};

const defaultTablesSeed = [
  { code: "1", name: "Masa 1", zone: "Salon", capacity: 2, sortOrder: 1 },
  { code: "2", name: "Masa 2", zone: "Salon", capacity: 2, sortOrder: 2 },
  { code: "3", name: "Masa 3", zone: "Salon", capacity: 4, sortOrder: 3 },
  { code: "4", name: "Masa 4", zone: "Salon", capacity: 4, sortOrder: 4 },
  { code: "5", name: "Masa 5", zone: "Salon", capacity: 4, sortOrder: 5 },
  { code: "6", name: "Masa 6", zone: "Salon", capacity: 6, sortOrder: 6 },
  { code: "7", name: "Masa 7", zone: "Salon", capacity: 4, sortOrder: 7 },
  { code: "8", name: "Masa 8", zone: "Salon", capacity: 4, sortOrder: 8 },
  { code: "B1", name: "Bahçe 1", zone: "Bahçe", capacity: 4, sortOrder: 9 },
  { code: "B2", name: "Bahçe 2", zone: "Bahçe", capacity: 4, sortOrder: 10 },
  { code: "B3", name: "Bahçe 3", zone: "Bahçe", capacity: 6, sortOrder: 11 },
  { code: "B4", name: "Bahçe 4", zone: "Bahçe", capacity: 2, sortOrder: 12 },
];

export async function ensureDefaultCafeTables() {
  const db = getDb();
  const existing = await db
    .select({ id: cafeTables.id })
    .from(cafeTables)
    .limit(1);

  if (existing.length > 0) return;

  await db
    .insert(cafeTables)
    .values(defaultTablesSeed)
    .onConflictDoNothing({ target: cafeTables.code });
}

function normalizeTableMatch(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^masa\s*/i, "")
    .replace(/\s+/g, "");
}

export async function getAdminTablesSnapshot(): Promise<AdminTablesSnapshot> {
  const db = getDb();
  await ensureDefaultCafeTables();

  const tableRows = await db
    .select()
    .from(cafeTables)
    .where(eq(cafeTables.isActive, true))
    .orderBy(asc(cafeTables.sortOrder), asc(cafeTables.id));

  const openSessionRows = await db
    .select()
    .from(tableSessions)
    .where(eq(tableSessions.status, "open"))
    .orderBy(desc(tableSessions.openedAt));

  const closedSessionRows = await db
    .select()
    .from(tableSessions)
    .where(eq(tableSessions.status, "closed"))
    .orderBy(desc(tableSessions.closedAt))
    .limit(20);

  const allSessionIds = [
    ...openSessionRows.map((s) => s.id),
    ...closedSessionRows.map((s) => s.id),
  ];

  const sessionItemRows = allSessionIds.length
    ? await db
        .select()
        .from(tableSessionItems)
        .where(inArray(tableSessionItems.sessionId, allSessionIds))
        .orderBy(asc(tableSessionItems.createdAt), asc(tableSessionItems.id))
    : [];

  const itemsBySession = new Map<number, AdminTableSessionItem[]>();
  for (const row of sessionItemRows) {
    const list = itemsBySession.get(row.sessionId) ?? [];
    list.push({
      id: row.id,
      sessionId: row.sessionId,
      menuItemId: row.menuItemId,
      productName: row.productName,
      unitPriceInKurus: row.unitPriceInKurus,
      quantity: row.quantity,
      lineTotalInKurus: row.unitPriceInKurus * row.quantity,
      note: row.note,
      source: row.source,
      orderId: row.orderId,
      createdAt: row.createdAt.toISOString(),
    });
    itemsBySession.set(row.sessionId, list);
  }

  function mapSession(row: typeof tableSessions.$inferSelect): AdminTableSession {
    const items = itemsBySession.get(row.id) ?? [];
    const subtotalInKurus = items.reduce((sum, item) => sum + item.lineTotalInKurus, 0);
    return {
      id: row.id,
      tableId: row.tableId,
      status: row.status,
      guestCount: row.guestCount,
      customerName: row.customerName,
      note: row.note,
      paymentMethod: row.paymentMethod,
      paidCashInKurus: row.paidCashInKurus,
      paidCardInKurus: row.paidCardInKurus,
      discountInKurus: row.discountInKurus,
      openedAt: row.openedAt.toISOString(),
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      items,
      subtotalInKurus,
    };
  }

  const openSessionByTableId = new Map<number, AdminTableSession>();
  for (const row of openSessionRows) {
    if (!openSessionByTableId.has(row.tableId)) {
      openSessionByTableId.set(row.tableId, mapSession(row));
    }
  }

  // Active QR / online orders with fulfillmentType = 'table'
  const activeTableOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.fulfillmentType, "table"),
        notInArray(orders.status, ["completed", "cancelled", "refunded"]),
      ),
    )
    .orderBy(asc(orders.createdAt));

  const activeOrderIds = activeTableOrders.map((o) => o.id);
  const activeOrderItemRows = activeOrderIds.length
    ? await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, activeOrderIds))
        .orderBy(asc(orderItems.id))
    : [];

  const orderItemsByOrderId = new Map<number, AdminTableOnlineOrder["items"]>();
  for (const row of activeOrderItemRows) {
    const list = orderItemsByOrderId.get(row.orderId) ?? [];
    list.push({
      id: row.id,
      productName: row.productName,
      quantity: row.quantity,
      unitPriceInKurus: row.unitPriceInKurus,
      lineTotalInKurus: row.lineTotalInKurus,
    });
    orderItemsByOrderId.set(row.orderId, list);
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLogRows = await db
    .select()
    .from(tableActivityLogs)
    .where(gte(tableActivityLogs.createdAt, oneDayAgo))
    .orderBy(desc(tableActivityLogs.createdAt))
    .limit(200);

  const logsByTableId = new Map<number, AdminTableActivityLog[]>();
  for (const row of recentLogRows) {
    const list = logsByTableId.get(row.tableId) ?? [];
    if (list.length < 6) {
      list.push({
        id: row.id,
        actorName: row.actorName,
        actorRole: row.actorRole,
        action: row.action,
        summary: row.summary,
        createdAt: row.createdAt.toISOString(),
      });
      logsByTableId.set(row.tableId, list);
    }
  }

  const tables: AdminCafeTable[] = tableRows.map((table) => {
    const codeNorm = normalizeTableMatch(table.code);
    const nameNorm = normalizeTableMatch(table.name);
    const matchingOrders: AdminTableOnlineOrder[] = activeTableOrders
      .filter((order) => {
        const orderNorm = normalizeTableMatch(order.tableNumber);
        return orderNorm !== "" && (orderNorm === codeNorm || orderNorm === nameNorm);
      })
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: order.phone,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalInKurus: order.totalInKurus,
        createdAt: order.createdAt.toISOString(),
        items: orderItemsByOrderId.get(order.id) ?? [],
      }));

    return {
      id: table.id,
      code: table.code,
      name: table.name,
      zone: table.zone,
      capacity: table.capacity,
      sortOrder: table.sortOrder,
      activeSession: openSessionByTableId.get(table.id) ?? null,
      onlineOrders: matchingOrders,
      recentLogs: logsByTableId.get(table.id) ?? [],
    };
  });

  const tableById = new Map(tableRows.map((t) => [t.id, t]));
  const recentClosed: AdminClosedTableSession[] = closedSessionRows.map((row) => {
    const t = tableById.get(row.tableId);
    return {
      ...mapSession(row),
      tableCode: t?.code ?? String(row.tableId),
      tableName: t?.name ?? `Masa #${row.tableId}`,
      tableZone: t?.zone ?? "Salon",
    };
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let todayCashInKurus = 0;
  let todayCardInKurus = 0;
  let todayClosedCount = 0;
  for (const s of closedSessionRows) {
    if (s.closedAt && s.closedAt >= todayStart) {
      todayCashInKurus += s.paidCashInKurus;
      todayCardInKurus += s.paidCardInKurus;
      todayClosedCount += 1;
    }
  }

  const openTables = tables.filter((t) => t.activeSession !== null || t.onlineOrders.length > 0).length;
  const openTotalInKurus = tables.reduce((sum, t) => {
    const posTotal = t.activeSession?.subtotalInKurus ?? 0;
    const qrTotal = t.onlineOrders.reduce((s, o) => s + o.totalInKurus, 0);
    return sum + posTotal + qrTotal;
  }, 0);

  return {
    tables,
    recentClosed: recentClosed.slice(0, 10),
    summary: {
      totalTables: tables.length,
      openTables,
      openTotalInKurus,
      todayCashInKurus,
      todayCardInKurus,
      todayClosedCount,
    },
  };
}
