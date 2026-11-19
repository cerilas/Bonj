import { desc, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/user-auth";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const db = getDb();

  // Find orders matching userId OR customer phone (normalized)
  const userOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      phone: orders.phone,
      fulfillmentType: orders.fulfillmentType,
      tableNumber: orders.tableNumber,
      pickupAt: orders.pickupAt,
      address: orders.address,
      note: orders.note,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalInKurus: orders.totalInKurus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      or(
        eq(orders.userId, current.id),
        eq(orders.phone, current.phone),
      ),
    )
    .orderBy(desc(orders.createdAt));

  if (!userOrders.length) {
    return NextResponse.json({ orders: [] });
  }

  const orderIds = userOrders.map((o) => o.id);
  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  const itemsByOrderId = new Map<number, typeof items>();
  for (const item of items) {
    const list = itemsByOrderId.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrderId.set(item.orderId, list);
  }

  const detailedOrders = userOrders.map((order) => ({
    ...order,
    items: itemsByOrderId.get(order.id) ?? [],
  }));

  return NextResponse.json({ orders: detailedOrders });
}
