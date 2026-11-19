import { randomBytes } from "node:crypto";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { categories, menuItems, orderItems, orders, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/user-auth";
import {
  reportNotificationError,
  sendConfiguredAdminNotification,
} from "@/lib/admin-notifications";
import {
  getHalkodeToken,
  generateHalkodeHash,
  getHalkode3dPayUrl,
  getHalkodeMerchantKey,
} from "@/lib/halkode";

type RequestedItem = { menuItemId?: unknown; quantity?: unknown };

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function createOrderNumber() {
  const day = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replaceAll(".", "");
  return `BONJ-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function pickupTime(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const isTestOrder = Boolean(body.isTestOrder);
    const customerName = clean(body.customerName, 120);
    const phone = clean(body.phone, 32);
    const phoneDigits = phone.replace(/\D/g, "");
    const fulfillmentType = clean(body.fulfillmentType, 24);
    const tableNumber = clean(body.tableNumber, 20);
    const address = clean(body.address, 500);
    const note = clean(body.note, 1000);
    const requestedItems = Array.isArray(body.items) ? body.items as RequestedItem[] : [];
    const payment = body.payment as Record<string, string> | undefined;

    if (customerName.length < 2) throw new Error("Adınızı ve soyadınızı yazın.");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new Error("Geçerli bir telefon numarası yazın.");
    }
    if (fulfillmentType !== "table" && fulfillmentType !== "pickup" && fulfillmentType !== "delivery") {
      throw new Error("Sipariş biçimini seçin.");
    }
    if (fulfillmentType === "table" && !tableNumber) {
      throw new Error("Masa numaranızı yazın.");
    }
    if (fulfillmentType === "delivery" && address.length < 5) {
      throw new Error("Geçerli bir adres yazın.");
    }
    if (!isTestOrder && (!payment || !payment.ccNo || !payment.ccHolderName || !payment.ccExpiryMonth || !payment.ccExpiryYear || !payment.ccCvv)) {
      throw new Error("Lütfen kredi kartı bilgilerinizi eksiksiz girin.");
    }

    let pickupAt: Date | null = null;
    if (fulfillmentType === "pickup") {
      pickupAt = new Date(String(body.pickupAt ?? ""));
      if (Number.isNaN(pickupAt.getTime())) throw new Error("Geliş zamanını seçin.");
      const earliest = Date.now() + 10 * 60 * 1000;
      const latest = Date.now() + 30 * 24 * 60 * 60 * 1000;
      if (pickupAt.getTime() < earliest || pickupAt.getTime() > latest) {
        throw new Error("Geliş zamanı en erken 10 dakika sonrası ve en geç 30 gün içinde olabilir.");
      }
    }

    if (!requestedItems.length || requestedItems.length > 30) {
      throw new Error("Sepetiniz boş veya ürün sayısı geçersiz.");
    }
    const quantityById = new Map<number, number>();
    for (const item of requestedItems) {
      const menuItemId = Number(item.menuItemId);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(menuItemId) || menuItemId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        throw new Error("Sepette geçersiz bir ürün var.");
      }
      quantityById.set(menuItemId, (quantityById.get(menuItemId) ?? 0) + quantity);
    }
    if ([...quantityById.values()].some((quantity) => quantity > 20)) {
      throw new Error("Bir üründen en fazla 20 adet ekleyebilirsiniz.");
    }

    const db = getDb();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [recent] = await db
      .select({ value: count(orders.id) })
      .from(orders)
      .where(and(eq(orders.phone, phoneDigits), gte(orders.createdAt, tenMinutesAgo)));
    if (Number(recent?.value ?? 0) >= 5 && !isTestOrder) {
      return NextResponse.json(
        { error: "Çok kısa sürede çok sayıda sipariş oluşturdunuz. Lütfen biraz bekleyin." },
        { status: 429 },
      );
    }

    const productIds = [...quantityById.keys()];
    const products = await db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        priceInKurus: menuItems.priceInKurus,
      })
      .from(menuItems)
      .innerJoin(categories, eq(menuItems.categoryId, categories.id))
      .where(
        and(
          inArray(menuItems.id, productIds),
          eq(menuItems.isActive, true),
          eq(categories.isActive, true),
        ),
      );
    if (products.length !== productIds.length || products.some((product) => product.priceInKurus == null)) {
      throw new Error("Sepetinizde artık satışta olmayan bir ürün var. Menüyü yenileyip tekrar deneyin.");
    }

    const totalInKurus = products.reduce(
      (total, product) => total + (product.priceInKurus ?? 0) * (quantityById.get(product.id) ?? 0),
      0,
    );
    const currentUser = await getCurrentUser();
    let orderUserId = currentUser?.id ?? null;
    if (!orderUserId) {
      const [matchedUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, phoneDigits))
        .limit(1);
      if (matchedUser) orderUserId = matchedUser.id;
    }
    const rawAddressId = Number(body.addressId);
    const orderAddressId = fulfillmentType === "delivery" && Number.isInteger(rawAddressId) && rawAddressId > 0
      ? rawAddressId
      : null;

    const orderNumber = createOrderNumber();
    const savedOrder = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId: orderUserId,
          addressId: orderAddressId,
          customerName,
          phone: phoneDigits,
          fulfillmentType,
          tableNumber: fulfillmentType === "table" ? tableNumber : null,
          pickupAt,
          address: fulfillmentType === "delivery" ? address : null,
          note: note || (isTestOrder ? "TEST SİPARİŞİ" : null),
          totalInKurus,
          status: "new",
          paymentStatus: isTestOrder ? "paid" : "pending",
          transactionId: isTestOrder ? "TEST-SIMULATION" : null,
        })
        .returning({ id: orders.id, orderNumber: orders.orderNumber });
      await tx.insert(orderItems).values(
        products.map((product) => {
          const quantity = quantityById.get(product.id) ?? 0;
          const unitPrice = product.priceInKurus ?? 0;
          return {
            orderId: created.id,
            menuItemId: product.id,
            productName: product.name,
            unitPriceInKurus: unitPrice,
            quantity,
            lineTotalInKurus: unitPrice * quantity,
          };
        }),
      );
      return created;
    });

    const fulfillment = fulfillmentType === "table"
      ? `Masa ${tableNumber}`
      : fulfillmentType === "delivery"
      ? `Teslimat (${address.slice(0, 30)})`
      : `Gel-al ${pickupAt ? pickupTime(pickupAt) : ""}`;
    const itemCount = [...quantityById.values()].reduce((total, quantity) => total + quantity, 0);
    after(async () => {
      try {
        await sendConfiguredAdminNotification({
          type: "orders",
          request,
          itemId: savedOrder.id,
          message: `BONJ | ${isTestOrder ? "[TEST] " : ""}Yeni sipariş ${savedOrder.orderNumber}. ${customerName}, ${fulfillment}, ${itemCount} ürün, ${money(totalInKurus)}.`,
        });
      } catch (error) {
        reportNotificationError("orders", error);
      }
    });

    if (isTestOrder) {
      return NextResponse.json(
        { ok: true, orderNumber: savedOrder.orderNumber, totalInKurus, isTestOrder: true },
        { status: 201 },
      );
    }

    if (!payment) {
      throw new Error("Lütfen kredi kartı bilgilerinizi eksiksiz girin.");
    }

    const protocol = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (host ? `${protocol}://${host}` : "http://localhost:3000");

    const returnUrl = `${siteUrl}/api/payment/callback`;
    const cancelUrl = `${siteUrl}/api/payment/callback`;

    // Process payment via HalkÖde
    const token = await getHalkodeToken();
    const hashKey = generateHalkodeHash(
      totalInKurus / 100, // API expects double like 22.00
      1, // Single installment for now
      "TRY",
      savedOrder.orderNumber,
    );

    const paymentResponse = await fetch(getHalkode3dPayUrl(), {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cc_holder_name: payment.ccHolderName,
        cc_no: (payment.ccNo || "").replace(/\s+/g, ""),
        expiry_month: (payment.ccExpiryMonth || "").padStart(2, "0"),
        expiry_year: (payment.ccExpiryYear || "").length === 2 ? `20${payment.ccExpiryYear}` : (payment.ccExpiryYear || ""),
        cvv: payment.ccCvv,
        currency_code: "TRY",
        installments_number: 1,
        invoice_id: savedOrder.orderNumber,
        invoice_description: `Bonj Siparişi: ${savedOrder.orderNumber}`,
        total: totalInKurus / 100,
        merchant_key: getHalkodeMerchantKey(),
        items: [
          {
            name: "Bonj Siparişi",
            price: totalInKurus / 100,
            quantity: 1,
            description: `Müşteri: ${customerName}`,
          },
        ],
        name: customerName.split(" ")[0],
        surname: customerName.split(" ").slice(1).join(" ") || "Bilinmiyor",
        hash_key: hashKey,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        payment_completed_by: "app",
        transaction_type: "Auth",
      }),
    });

    const location = paymentResponse.headers.get("location");
    if (location) {
      const redirectUrl = new URL(location, siteUrl);
      const statusCode = redirectUrl.searchParams.get("status_code") || redirectUrl.searchParams.get("error_code");
      const statusDesc = redirectUrl.searchParams.get("status_description") || redirectUrl.searchParams.get("error");

      if (statusCode && statusCode !== "100") {
        await db.update(orders).set({ paymentStatus: "failed" }).where(eq(orders.id, savedOrder.id));
        throw new Error(`Ödeme hatası: ${statusDesc || "İşlem banka tarafından reddedildi."}`);
      }

      return NextResponse.json(
        { ok: true, orderNumber: savedOrder.orderNumber, totalInKurus, redirectUrl: location },
        { status: 201 },
      );
    }

    const paymentHtml = await paymentResponse.text();

    if (paymentHtml.trim().startsWith("{")) {
      try {
        const json = JSON.parse(paymentHtml);
        if (json.status_code && json.status_code !== 100) {
          throw new Error(`Ödeme hatası: ${json.status_description || "İşlem reddedildi"}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Ödeme hatası")) {
          throw e;
        }
        // ignore parse error
      }
    }

    if (!paymentResponse.ok) {
      console.error("HalkÖde response:", paymentHtml);
      throw new Error("Ödeme sistemiyle iletişim kurulamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.");
    }

    // HalkÖde wraps the form with action=".../redirect-to-bank" and relies on window.onload to change action to bank_url.
    // Replace action with bank_url directly to avoid Laravel CSRF token expiration errors when client-side script execution is bypassed.
    let sanitizedPaymentHtml = paymentHtml;
    const bankUrlMatch = paymentHtml.match(/name=['"]?bank_url['"]?\s+value=['"]?([^'"\s>]+)['"]?/i);
    if (bankUrlMatch && bankUrlMatch[1]) {
      sanitizedPaymentHtml = paymentHtml.replace(
        /action=['"][^'"]*redirect-to-bank['"]/i,
        `action="${bankUrlMatch[1]}"`
      );
    }

    return NextResponse.json(
      { ok: true, orderNumber: savedOrder.orderNumber, totalInKurus, paymentHtml: sanitizedPaymentHtml },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sipariş oluşturulamadı." },
      { status: 400 },
    );
  }
}
