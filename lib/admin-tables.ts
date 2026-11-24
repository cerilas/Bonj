import { and, asc, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  cafeTables,
  orderItems,
  orders,
  tableActivityLogs,
  tableKitchenTickets,
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
  kitchenSentQuantity: number;
  lineTotalInKurus: number;
  note: string | null;
  source: string;
  orderId: number | null;
  createdAt: string;
};

export type AdminKitchenTicketItem = {
  productName: string;
  quantity: number;
  note: string | null;
};

export type AdminTableKitchenTicket = {
  id: number;
  tableId: number;
  sessionId: number;
  ticketNumber: number;
  actorName: string;
  note: string | null;
  items: AdminKitchenTicketItem[];
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
  kitchenTickets: AdminTableKitchenTicket[];
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

const INDOOR_LEGACY_CAPACITIES: Record<number, number> = {
  1: 2,
  2: 2,
  3: 4,
  4: 4,
  5: 4,
  6: 6,
  7: 4,
  8: 4,
};

const BAHCE_LEGACY_CAPACITIES: Record<number, number> = {
  1: 4,
  2: 4,
  3: 6,
  4: 2,
};

const defaultTablesSeed = [
  { code: "KASA", name: "Ayakta / Kasa", zone: "Kasa", capacity: 1, sortOrder: 0 },
  ...Array.from({ length: 20 }, (_, idx) => {
    const n = idx + 1;
    return {
      code: String(n),
      name: `Masa ${n}`,
      zone: "Salon",
      capacity: INDOOR_LEGACY_CAPACITIES[n] ?? 4,
      sortOrder: n,
    };
  }),
  ...Array.from({ length: 40 }, (_, idx) => {
    const n = idx + 1;
    return {
      code: `B${n}`,
      name: `Bahçe ${n}`,
      zone: "Bahçe",
      capacity: BAHCE_LEGACY_CAPACITIES[n] ?? 4,
      sortOrder: 20 + n,
    };
  }),
];

let defaultTablesEnsured = false;
let ensureTablesInFlight: Promise<void> | null = null;
let kitchenSchemaEnsured = false;
let kitchenSchemaInFlight: Promise<void> | null = null;

export async function ensureKitchenSchemaReady() {
  if (kitchenSchemaEnsured) return;
  if (kitchenSchemaInFlight) return kitchenSchemaInFlight;

  kitchenSchemaInFlight = (async () => {
    const db = getDb();
    await db.execute(sql`
      alter table table_session_items
      add column if not exists kitchen_sent_quantity integer not null default 0
    `);
    await db.execute(sql`
      create table if not exists table_kitchen_tickets (
        id serial primary key,
        table_id integer not null references cafe_tables(id) on delete cascade,
        session_id integer not null references table_sessions(id) on delete cascade,
        ticket_number integer not null default 1,
        actor_name varchar(120) not null default 'Kasa',
        note text,
        items_json text not null,
        created_at timestamptz not null default now()
      )
    `);
    await db.execute(sql`
      create index if not exists table_kitchen_tickets_session_idx
      on table_kitchen_tickets (session_id, id)
    `);
    await db.execute(sql`
      create index if not exists table_kitchen_tickets_table_idx
      on table_kitchen_tickets (table_id, created_at)
    `);
    kitchenSchemaEnsured = true;
  })();

  try {
    await kitchenSchemaInFlight;
  } finally {
    kitchenSchemaInFlight = null;
  }
}

export async function ensureDefaultCafeTables() {
  if (defaultTablesEnsured) return;
  if (ensureTablesInFlight) return ensureTablesInFlight;

  ensureTablesInFlight = (async () => {
    const db = getDb();
    const existingRows = await db
      .select({
        id: cafeTables.id,
        code: cafeTables.code,
        zone: cafeTables.zone,
        sortOrder: cafeTables.sortOrder,
      })
      .from(cafeTables);

    const byCode = new Map(existingRows.map((row) => [row.code, row]));
    const missing = defaultTablesSeed.filter((seed) => !byCode.has(seed.code));

    if (missing.length > 0) {
      await db
        .insert(cafeTables)
        .values(missing)
        .onConflictDoNothing({ target: cafeTables.code });
    }

    // Realign seeded Salon zone (e.g. migrate any "Indoor" rows to "Salon") and Bahçe sort order
    const toSalonCodes: string[] = [];
    const misalignedRows: Array<{ id: number; sortOrder: number }> = [];

    for (const seed of defaultTablesSeed) {
      const current = byCode.get(seed.code);
      if (!current) continue;
      if (seed.zone === "Salon" && current.zone !== "Salon") {
        toSalonCodes.push(seed.code);
      }
      if (current.sortOrder !== seed.sortOrder && current.sortOrder <= 12) {
        misalignedRows.push({ id: current.id, sortOrder: seed.sortOrder });
      }
    }

    if (toSalonCodes.length > 0) {
      await db
        .update(cafeTables)
        .set({ zone: "Salon", updatedAt: new Date() })
        .where(inArray(cafeTables.code, toSalonCodes));
    }

    for (const row of misalignedRows) {
      await db
        .update(cafeTables)
        .set({ sortOrder: row.sortOrder, updatedAt: new Date() })
        .where(eq(cafeTables.id, row.id));
    }

    defaultTablesEnsured = true;
  })();

  try {
    await ensureTablesInFlight;
  } finally {
    ensureTablesInFlight = null;
  }
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
  await Promise.all([ensureDefaultCafeTables(), ensureKitchenSchemaReady()]);

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

  const kitchenTicketRows = allSessionIds.length
    ? await db
        .select()
        .from(tableKitchenTickets)
        .where(inArray(tableKitchenTickets.sessionId, allSessionIds))
        .orderBy(desc(tableKitchenTickets.id))
    : [];

  const ticketsBySession = new Map<number, AdminTableKitchenTicket[]>();
  for (const row of kitchenTicketRows) {
    let parsedItems: AdminKitchenTicketItem[] = [];
    try {
      const raw = JSON.parse(row.itemsJson) as unknown;
      if (Array.isArray(raw)) {
        parsedItems = raw.map((it) => {
          const item = (it ?? {}) as Record<string, unknown>;
          return {
            productName: String(item.productName ?? ""),
            quantity: Math.max(1, Number(item.quantity ?? 1) || 1),
            note: item.note ? String(item.note) : null,
          };
        });
      }
    } catch {
      parsedItems = [];
    }
    const list = ticketsBySession.get(row.sessionId) ?? [];
    list.push({
      id: row.id,
      tableId: row.tableId,
      sessionId: row.sessionId,
      ticketNumber: row.ticketNumber,
      actorName: row.actorName,
      note: row.note ?? null,
      items: parsedItems,
      createdAt: row.createdAt.toISOString(),
    });
    ticketsBySession.set(row.sessionId, list);
  }

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
      kitchenSentQuantity: Math.min(row.quantity, Math.max(0, row.kitchenSentQuantity ?? 0)),
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
    const kitchenTickets = ticketsBySession.get(row.id) ?? [];
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
      kitchenTickets,
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
        notInArray(orders.status, ["completed", "cancelled", "refunded", "awaiting_payment"]),
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

  const diningTables = tables.filter((t) => t.code !== "KASA");
  const openTables = diningTables.filter((t) => t.activeSession !== null || t.onlineOrders.length > 0).length;
  const openTotalInKurus = tables.reduce((sum, t) => {
    const posTotal = t.activeSession?.subtotalInKurus ?? 0;
    const qrTotal = t.onlineOrders.reduce((s, o) => s + o.totalInKurus, 0);
    return sum + posTotal + qrTotal;
  }, 0);

  return {
    tables,
    recentClosed: recentClosed.slice(0, 10),
    summary: {
      totalTables: diningTables.length,
      openTables,
      openTotalInKurus,
      todayCashInKurus,
      todayCardInKurus,
      todayClosedCount,
    },
  };
}
