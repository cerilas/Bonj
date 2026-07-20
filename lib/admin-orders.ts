import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";

export type AdminOrderItem = {
  id: number;
  menuItemId: number | null;
  productName: string;
  unitPriceInKurus: number;
  quantity: number;
  lineTotalInKurus: number;
};

export type AdminOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  fulfillmentType: string;
  tableNumber: string;
  pickupAt: string | null;
  note: string;
  status: string;
  totalInKurus: number;
  createdAt: string;
  items: AdminOrderItem[];
};

export type AdminOrderPage = {
  orders: AdminOrder[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { total: number; new: number; active: number };
};

export async function getAdminOrder(id: number): Promise<AdminOrder | null> {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.id);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phone: order.phone,
    fulfillmentType: order.fulfillmentType,
    tableNumber: order.tableNumber ?? "",
    pickupAt: order.pickupAt?.toISOString() ?? null,
    note: order.note ?? "",
    status: order.status,
    totalInKurus: order.totalInKurus,
    createdAt: order.createdAt.toISOString(),
    items: items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      productName: item.productName,
      unitPriceInKurus: item.unitPriceInKurus,
      quantity: item.quantity,
      lineTotalInKurus: item.lineTotalInKurus,
    })),
  };
}

export async function getAdminOrders({
  page = 1,
  pageSize = 10,
  status = "all",
}: {
  page?: number;
  pageSize?: number;
  status?: string;
} = {}): Promise<AdminOrderPage> {
  const db = getDb();
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const whereClause = status === "all" ? undefined : eq(orders.status, status);
  const [[filtered], [summary]] = await Promise.all([
    db.select({ value: count(orders.id) }).from(orders).where(whereClause),
    db.select({
      total: count(orders.id),
      newCount: sql<number>`count(*) filter (where ${orders.status} = 'new')`,
      activeCount: sql<number>`count(*) filter (where ${orders.status} in ('accepted', 'preparing', 'ready'))`,
    }).from(orders),
  ]);
  const total = Number(filtered?.value ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.floor(page)));
  const orderRows = await db
    .select()
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(safePageSize)
    .offset((safePage - 1) * safePageSize);
  const ids = orderRows.map((order) => order.id);
  const itemRows = ids.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)).orderBy(orderItems.id)
    : [];
  const itemsByOrder = new Map<number, AdminOrderItem[]>();
  itemRows.forEach((item) => {
    const current = itemsByOrder.get(item.orderId) ?? [];
    current.push({
      id: item.id,
      menuItemId: item.menuItemId,
      productName: item.productName,
      unitPriceInKurus: item.unitPriceInKurus,
      quantity: item.quantity,
      lineTotalInKurus: item.lineTotalInKurus,
    });
    itemsByOrder.set(item.orderId, current);
  });

  return {
    orders: orderRows.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      phone: order.phone,
      fulfillmentType: order.fulfillmentType,
      tableNumber: order.tableNumber ?? "",
      pickupAt: order.pickupAt?.toISOString() ?? null,
      note: order.note ?? "",
      status: order.status,
      totalInKurus: order.totalInKurus,
      createdAt: order.createdAt.toISOString(),
      items: itemsByOrder.get(order.id) ?? [],
    })),
    pagination: { page: safePage, pageSize: safePageSize, total, totalPages },
    summary: {
      total: Number(summary?.total ?? 0),
      new: Number(summary?.newCount ?? 0),
      active: Number(summary?.activeCount ?? 0),
    },
  };
}
