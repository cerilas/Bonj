import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { processHalkodeRefund } from "@/lib/halkode";
import { sendCerilasSms } from "@/lib/cerilas-sms";

export async function POST(
  _request: Request,
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

  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  if (order.paymentStatus === "refunded") {
    return NextResponse.json(
      { error: "Bu siparişin ödemesi daha önce iade edilmiştir." },
      { status: 400 },
    );
  }

  if (order.paymentStatus !== "paid") {
    return NextResponse.json(
      {
        error: `Yalnızca sanal POS ile ödenmiş siparişler için iade yapılabilir (Mevcut durum: ${order.paymentStatus}).`,
      },
      { status: 400 },
    );
  }

  try {
    const refundResult = await processHalkodeRefund({
      invoiceId: order.orderNumber,
      amountInTl: order.totalInKurus / 100,
    });

    if (!refundResult.ok) {
      return NextResponse.json(
        { error: refundResult.statusDescription || "İade işlemi başarısız oldu." },
        { status: 400 },
      );
    }

    const refundTag = `[İADE: ${refundResult.refNo || "Onaylandı"}]`;
    const updatedNote = order.note ? `${order.note} | ${refundTag}` : refundTag;

    await db
      .update(orders)
      .set({
        status: "refunded",
        paymentStatus: "refunded",
        note: updatedNote,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    console.log(`[Admin Order Refund] Order ${order.orderNumber} (ID: ${order.id}) marked as refunded. Ref: ${refundResult.refNo}`);

    // Müşteriye Bilgilendirme SMS'i
    const amountInTl = (order.totalInKurus / 100).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const smsMessage = `Sayın ${order.customerName}, Bonj Cake Story üzerinden verdiğiniz ${order.orderNumber} numaralı siparişinize ait ${amountInTl} TL tutarındaki ödemeniz kartınıza iade edilmiştir. Tutarın hesabınıza yansıması bankanıza bağlı olarak 1-3 iş günü sürebilir. Bizi tercih ettiğiniz için teşekkür ederiz.`;

    let customerSmsSent = false;
    try {
      if (order.phone) {
        await sendCerilasSms({
          phone: order.phone,
          message: smsMessage,
        });
        customerSmsSent = true;
        console.log(`[Order Refund SMS] Successfully sent to ${order.phone}`);
      }
    } catch (smsError) {
      console.error(`[Order Refund SMS Failed] Could not send SMS to ${order.phone}:`, smsError);
    }

    return NextResponse.json({
      ok: true,
      message: "İade işlemi başarıyla gerçekleştirildi.",
      refNo: refundResult.refNo,
      customerSmsSent,
      smsMessage,
    });
  } catch (error) {
    console.error(`[Admin Order Refund Error] Order ID: ${orderId}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "İade işlemi sırasında bir hata oluştu." },
      { status: 500 },
    );
  }
}
