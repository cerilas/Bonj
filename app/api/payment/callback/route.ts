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

async function verifyPayment(orderId: string): Promise<boolean> {
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

    const result = await response.json();
    return result.status_code === 100 && result.transaction_status === "Completed";
  } catch (error) {
    console.error("Payment verification failed:", error);
    return false;
  }
}

async function handleCallback(request: NextRequest) {
  try {
    let orderId: string | null = null;
    let reason: string | null = null;

    if (request.method === "POST") {
      const isJson = request.headers.get("content-type")?.includes("application/json");
      if (isJson) {
        const body = await request.json();
        orderId = body.invoice_id || body.orderId;
        reason = body.status_description || body.error || body.original_bank_error_description;
      } else {
        const formData = await request.formData();
        orderId = (formData.get("invoice_id") as string) || (formData.get("orderId") as string);
        reason =
          (formData.get("status_description") as string) ||
          (formData.get("error") as string) ||
          (formData.get("original_bank_error_description") as string);
      }
    } else {
      orderId = request.nextUrl.searchParams.get("invoice_id") || request.nextUrl.searchParams.get("orderId");
      reason =
        request.nextUrl.searchParams.get("status_description") ||
        request.nextUrl.searchParams.get("error") ||
        request.nextUrl.searchParams.get("original_bank_error_description");
    }

    const baseUrl = notificationBaseUrl(request);
    const failedUrl = new URL("/sepet", baseUrl);
    failedUrl.searchParams.set("status", "failed");
    if (reason) {
      failedUrl.searchParams.set("reason", reason);
    }

    if (!orderId) {
      return NextResponse.redirect(failedUrl, { status: 303 });
    }

    const isPaid = await verifyPayment(orderId);

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
          .set({ paymentStatus: "paid", status: "new", updatedAt: new Date() })
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
