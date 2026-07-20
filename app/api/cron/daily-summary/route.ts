import { timingSafeEqual } from "node:crypto";
import { and, count, gte, lt, sum } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cateringRequests, contactMessages, orders } from "@/db/schema";
import {
  reportNotificationError,
  sendConfiguredAdminNotification,
} from "@/lib/admin-notifications";

export const dynamic = "force-dynamic";

function secureMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

function istanbulDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const key = `${part("year")}-${part("month")}-${part("day")}`;
  const start = new Date(`${key}T00:00:00+03:00`);
  return {
    label: `${part("day")}.${part("month")}.${part("year")}`,
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

function money(valueInKurus: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(valueInKurus / 100);
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET yapılandırılmamış." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!suppliedSecret || !secureMatch(suppliedSecret, cronSecret)) {
    return NextResponse.json({ error: "Yetkisiz cron isteği." }, { status: 401 });
  }

  try {
    const db = getDb();
    const day = istanbulDay();
    const dateRange = (column: typeof orders.createdAt) =>
      and(gte(column, day.start), lt(column, day.end));

    const [[orderSummary], [messageSummary], [cateringSummary]] = await Promise.all([
      db
        .select({ total: count(), revenue: sum(orders.totalInKurus) })
        .from(orders)
        .where(dateRange(orders.createdAt)),
      db
        .select({ total: count() })
        .from(contactMessages)
        .where(and(gte(contactMessages.createdAt, day.start), lt(contactMessages.createdAt, day.end))),
      db
        .select({ total: count() })
        .from(cateringRequests)
        .where(and(gte(cateringRequests.createdAt, day.start), lt(cateringRequests.createdAt, day.end))),
    ]);

    const orderCount = Number(orderSummary?.total ?? 0);
    const revenueInKurus = Number(orderSummary?.revenue ?? 0);
    const messageCount = Number(messageSummary?.total ?? 0);
    const cateringCount = Number(cateringSummary?.total ?? 0);
    const message = `Bonj ${day.label} günlük özet: ${orderCount} sipariş, ${money(revenueInKurus)} TL toplam; ${messageCount} mesaj; ${cateringCount} catering talebi.`;

    const result = await sendConfiguredAdminNotification({
      type: "dailySummary",
      message,
      request,
    });

    return NextResponse.json({
      ok: true,
      date: day.label,
      summary: { orderCount, revenueInKurus, messageCount, cateringCount },
      notification: result,
    });
  } catch (error) {
    reportNotificationError("dailySummary", error);
    return NextResponse.json(
      { error: "Günlük özet oluşturulamadı veya gönderilemedi." },
      { status: 500 },
    );
  }
}
