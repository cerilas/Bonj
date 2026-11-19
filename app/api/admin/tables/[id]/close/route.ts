import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { orders, tableSessionItems, tableSessions } from "@/db/schema";
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
    paymentMethod?: "cash" | "card" | "split" | "free";
    paidCashInKurus?: number;
    paidCardInKurus?: number;
    discountInKurus?: number;
    note?: string;
    onlineOrderIds?: number[];
  };

  const paymentMethod = body.paymentMethod ?? "cash";
  if (!["cash", "card", "split", "free"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Geçersiz tahsilat yöntemi." }, { status: 400 });
  }

  const db = getDb();
  const [session] = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "Bu masada açık oturum yok." }, { status: 404 });
  }

  const items = await db
    .select()
    .from(tableSessionItems)
    .where(eq(tableSessionItems.sessionId, session.id));

  const subtotalInKurus = items.reduce((sum, i) => sum + i.unitPriceInKurus * i.quantity, 0);
  const discountInKurus = Math.max(0, Math.min(subtotalInKurus, Math.round(Number(body.discountInKurus ?? 0) || 0)));
  const payableInKurus = Math.max(0, subtotalInKurus - discountInKurus);

  let paidCashInKurus = 0;
  let paidCardInKurus = 0;

  if (paymentMethod === "cash") {
    paidCashInKurus = payableInKurus;
  } else if (paymentMethod === "card") {
    paidCardInKurus = payableInKurus;
  } else if (paymentMethod === "split") {
    paidCashInKurus = Math.max(0, Math.round(Number(body.paidCashInKurus ?? 0) || 0));
    paidCardInKurus = Math.max(0, Math.round(Number(body.paidCardInKurus ?? 0) || 0));
    if (paidCashInKurus + paidCardInKurus < payableInKurus) {
      return NextResponse.json(
        { error: "Nakit + Kart toplamı ödenecek tutardan az olamaz." },
        { status: 400 },
      );
    }
  }

  const note = body.note !== undefined
    ? String(body.note).trim().slice(0, 500) || null
    : session.note;

  await db
    .update(tableSessions)
    .set({
      status: "closed",
      paymentMethod,
      paidCashInKurus,
      paidCardInKurus,
      discountInKurus,
      note,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tableSessions.id, session.id));

  // Optionally mark linked QR table orders as completed when closing the table
  if (Array.isArray(body.onlineOrderIds) && body.onlineOrderIds.length > 0) {
    const cleanIds = body.onlineOrderIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (cleanIds.length > 0) {
      await db
        .update(orders)
        .set({ status: "completed", updatedAt: new Date() })
        .where(inArray(orders.id, cleanIds));
    }
  }

  const methodLabel =
    paymentMethod === "cash"
      ? "Nakit"
      : paymentMethod === "card"
        ? "Kredi Kartı"
        : paymentMethod === "split"
          ? "Parçalı"
          : "İkram";
  const amountText = `${(payableInKurus / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;

  await logTableActivity({
    tableId,
    sessionId: session.id,
    operator,
    action: "close",
    summary: `${staffRoleLabel(operator.actorRole)} ${operator.actorName} masayı kapattı (${methodLabel} · ${amountText}).`,
  });

  return NextResponse.json({ ok: true });
}
