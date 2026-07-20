import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";

const statuses = new Set(["new", "accepted", "preparing", "ready", "completed", "cancelled"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await context.params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }
  const body = (await request.json()) as { status?: string };
  if (!body.status || !statuses.has(body.status)) {
    return NextResponse.json({ error: "Sipariş durumu geçersiz." }, { status: 400 });
  }
  const db = getDb();
  const updated = await db
    .update(orders)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning({ id: orders.id });
  if (!updated.length) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
