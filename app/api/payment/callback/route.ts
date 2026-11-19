import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getHalkodeToken, getHalkodeApiUrl, getHalkodeMerchantKey } from "@/lib/halkode";

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

    const failedUrl = new URL("/sepet", request.url);
    failedUrl.searchParams.set("status", "failed");
    if (reason) {
      failedUrl.searchParams.set("reason", reason);
    }

    if (!orderId) {
      return NextResponse.redirect(failedUrl);
    }

    const isPaid = await verifyPayment(orderId);

    const db = getDb();
    if (isPaid) {
      await db
        .update(orders)
        .set({ paymentStatus: "paid", status: "new" }) // Mark as new for fulfillment
        .where(eq(orders.orderNumber, orderId));
      return NextResponse.redirect(new URL(`/sepet?status=success&orderNumber=${orderId}`, request.url));
    } else {
      await db
        .update(orders)
        .set({ paymentStatus: "failed" })
        .where(eq(orders.orderNumber, orderId));
      return NextResponse.redirect(failedUrl);
    }
  } catch (error) {
    console.error("Callback handler error:", error);
    return NextResponse.redirect(new URL("/sepet?status=failed", request.url));
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}
