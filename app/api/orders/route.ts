import { randomBytes } from "node:crypto";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { categories, menuItems, orderItems, orders } from "@/db/schema";
import {
  reportNotificationError,
  sendConfiguredAdminNotification,
} from "@/lib/admin-notifications";

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
    const customerName = clean(body.customerName, 120);
    const phone = clean(body.phone, 32);
    const phoneDigits = phone.replace(/\D/g, "");
    const fulfillmentType = clean(body.fulfillmentType, 24);
    const tableNumber = clean(body.tableNumber, 20);
    const note = clean(body.note, 1000);
    const requestedItems = Array.isArray(body.items) ? body.items as RequestedItem[] : [];

    if (customerName.length < 2) throw new Error("Adınızı ve soyadınızı yazın.");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new Error("Geçerli bir telefon numarası yazın.");
    }
    if (fulfillmentType !== "table" && fulfillmentType !== "pickup") {
      throw new Error("Sipariş biçimini seçin.");
    }
    if (fulfillmentType === "table" && !tableNumber) {
      throw new Error("Masa numaranızı yazın.");
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
    if (Number(recent?.value ?? 0) >= 5) {
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
    const orderNumber = createOrderNumber();
    const savedOrder = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({
          orderNumber,
          customerName,
          phone: phoneDigits,
          fulfillmentType,
          tableNumber: fulfillmentType === "table" ? tableNumber : null,
          pickupAt,
          note: note || null,
          totalInKurus,
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
      : `Gel-al ${pickupTime(pickupAt as Date)}`;
    const itemCount = [...quantityById.values()].reduce((total, quantity) => total + quantity, 0);
    after(async () => {
      try {
        await sendConfiguredAdminNotification({
          type: "orders",
          request,
          itemId: savedOrder.id,
          message: `BONJ | Yeni sipariş ${savedOrder.orderNumber}. ${customerName}, ${fulfillment}, ${itemCount} ürün, ${money(totalInKurus)}.`,
        });
      } catch (error) {
        reportNotificationError("orders", error);
      }
    });

    return NextResponse.json(
      { ok: true, orderNumber: savedOrder.orderNumber, totalInKurus },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sipariş oluşturulamadı." },
      { status: 400 },
    );
  }
}
