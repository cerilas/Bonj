import { after, NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getHalkodeToken, getHalkodeApiUrl, getHalkodeMerchantKey } from "@/lib/halkode";
import {
  notificationBaseUrl,
  reportNotificationError,
  sendConfiguredAdminNotification,
} from "@/lib/admin-notifications";

type VerifyResult = {
  paid: boolean;
  detail?: string;
  transactionId?: string;
};

function formatTurkishPaymentError(raw?: string | null, code?: string | null): string {
  const text = (raw ?? "").trim();
  const lower = text.toLowerCase();

  if (!text || lower === "failed" || lower === "fail" || lower === "error") {
    return code
      ? `Banka veya 3D Secure onayı alınamadı (Kod: ${code}). Kart bilgilerinizi, limitinizi ve internet alışverişi yetkinizi kontrol edin.`
      : "Banka veya 3D Secure onayı alınamadı. Kart bilgilerinizi, limitinizi ve internet alışverişi yetkinizi kontrol edin.";
  }
  if (lower.includes("cancel")) {
    return "Ödeme işlemi iptal edildi.";
  }
  if (lower.includes("insufficient") || lower.includes("not sufficient") || lower.includes("limit")) {
    return "Kart bakiyeniz veya limitiniz yetersiz.";
  }
  if (lower.includes("expired") || lower.includes("expiry")) {
    return "Kartınızın son kullanma tarihi geçersiz veya süresi dolmuş.";
  }
  if (lower.includes("cvv") || lower.includes("cvc") || lower.includes("security code")) {
    return "Güvenlik kodu (CVV) hatalı.";
  }
  if (lower.includes("invalid card") || lower.includes("card number")) {
    return "Kart numarası geçersiz.";
  }
  if (lower.includes("3d") || lower.includes("authentication") || lower.includes("otp")) {
    return "3D Secure SMS doğrulaması tamamlanamadı.";
  }
  if (lower.includes("do not honor") || lower.includes("declined") || lower.includes("not permitted")) {
    return "İşlem bankanız tarafından reddedildi (internet alışverişi kapalı veya banka onayı yok).";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Banka yanıt süresi doldu. Lütfen tekrar deneyin.";
  }
  return code ? `${text} (Kod: ${code})` : text;
}

async function verifyPayment(orderId: string): Promise<VerifyResult> {
  try {
    const token = await getHalkodeToken();
    const merchantKey = getHalkodeMerchantKey();
    const apiUrl = getHalkodeApiUrl();

    const response = await fetch(`${apiUrl}/checkstatus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        invoice_id: orderId,
        merchant_key: merchantKey,
      }),
    });

    const result = (await response.json()) as Record<string, unknown>;
    console.info("[HalkÖde CheckStatus]", orderId, JSON.stringify(result));

    const statusCode = Number(result.status_code);
    const txStatus = String(result.transaction_status ?? "").toLowerCase();
    const paid =
      statusCode === 100 &&
      (txStatus === "completed" || txStatus === "approved" || txStatus === "success");

    const detail =
      (result.original_bank_error_description as string) ||
      (result.error_description as string) ||
      (result.status_description as string) ||
      undefined;

    const transactionId =
      (result.order_no as string) ||
      (result.transaction_id as string) ||
      undefined;

    return { paid, detail, transactionId };
  } catch (error) {
    console.error("Payment verification failed:", error);
    return { paid: false };
  }
}

async function handleCallback(request: NextRequest) {
  try {
    let orderId: string | null = null;
    let reason: string | null = null;
    const rawPayload: Record<string, unknown> = {};

    if (request.method === "POST") {
      const isJson = request.headers.get("content-type")?.includes("application/json");
      if (isJson) {
        const body = (await request.json()) as Record<string, unknown>;
        Object.assign(rawPayload, body);
        orderId = String(body.invoice_id || body.orderId || body.order_id || "") || null;
        reason =
          (body.original_bank_error_description as string) ||
          (body.error_description as string) ||
          (body.error as string) ||
          (body.status_description as string) ||
          null;
      } else {
        const formData = await request.formData();
        for (const [k, v] of formData.entries()) {
          if (typeof v === "string") rawPayload[k] = v;
        }
        orderId =
          (formData.get("invoice_id") as string) ||
          (formData.get("orderId") as string) ||
          (formData.get("order_id") as string) ||
          null;
        reason =
          (formData.get("original_bank_error_description") as string) ||
          (formData.get("error_description") as string) ||
          (formData.get("error") as string) ||
          (formData.get("status_description") as string) ||
          null;
      }
    } else {
      for (const [k, v] of request.nextUrl.searchParams.entries()) {
        rawPayload[k] = v;
      }
      orderId =
        request.nextUrl.searchParams.get("invoice_id") ||
        request.nextUrl.searchParams.get("orderId") ||
        request.nextUrl.searchParams.get("order_id");
      reason =
        request.nextUrl.searchParams.get("original_bank_error_description") ||
        request.nextUrl.searchParams.get("error_description") ||
        request.nextUrl.searchParams.get("error") ||
        request.nextUrl.searchParams.get("status_description");
    }

    console.info("[HalkÖde Callback]", request.method, JSON.stringify(rawPayload));

    const baseUrl = notificationBaseUrl(request);
    const failedUrl = new URL("/sepet", baseUrl);
    failedUrl.searchParams.set("status", "failed");

    if (!orderId) {
      if (reason) failedUrl.searchParams.set("reason", reason);
      return NextResponse.redirect(failedUrl, { status: 303 });
    }

    const verification = await verifyPayment(orderId);
    const isPaid = verification.paid;
    const rawErrorCode =
      (rawPayload.error_code as string) ||
      (rawPayload.md_status as string) ||
      (rawPayload.status_code && String(rawPayload.status_code) !== "100"
        ? String(rawPayload.status_code)
        : null);
    const rawDetail =
      verification.detail && verification.detail !== "Failed"
        ? verification.detail
        : reason;
    failedUrl.searchParams.set("reason", formatTurkishPaymentError(rawDetail, rawErrorCode));

    const db = getDb();
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderId))
      .limit(1);

    if (isPaid) {
      if (order) {
        const wasAwaiting = order.status === "awaiting_payment";
        await db
          .update(orders)
          .set({
            paymentStatus: "paid",
            status: "new",
            transactionId: verification.transactionId ?? order.transactionId,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        if (wasAwaiting) {
          const fulfillment =
            order.fulfillmentType === "table"
              ? `Masa ${order.tableNumber ?? ""}`
              : order.fulfillmentType === "delivery"
                ? `Teslimat (${(order.address ?? "").slice(0, 30)})`
                : "Gel-al";
          const amountText = new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
            maximumFractionDigits: 0,
          }).format(order.totalInKurus / 100);

          after(async () => {
            try {
              await sendConfiguredAdminNotification({
                type: "orders",
                request,
                itemId: order.id,
                message: `BONJ | Yeni sipariş ${order.orderNumber}. ${order.customerName}, ${fulfillment}, ${amountText}.`,
              });
            } catch (err) {
              reportNotificationError("orders", err);
            }
          });
        }
      }
      return NextResponse.redirect(
        new URL(`/sepet?status=success&orderNumber=${encodeURIComponent(orderId)}`, baseUrl),
        { status: 303 },
      );
    } else {
      if (order) {
        if (
          order.status === "awaiting_payment" ||
          order.fulfillmentType === "delivery" ||
          order.fulfillmentType === "pickup"
        ) {
          await db.delete(orders).where(eq(orders.id, order.id));
        } else {
          await db
            .update(orders)
            .set({ paymentStatus: "failed", updatedAt: new Date() })
            .where(eq(orders.id, order.id));
        }
      }
      return NextResponse.redirect(failedUrl, { status: 303 });
    }
  } catch (error) {
    console.error("Callback handler error:", error);
    return NextResponse.redirect(new URL("/sepet?status=failed", notificationBaseUrl(request)), {
      status: 303,
    });
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}
