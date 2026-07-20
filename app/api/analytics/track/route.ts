import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { analyticsPageViews, analyticsSessions, analyticsVisitors } from "@/db/schema";

type AnalyticsEvent = {
  event?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
  viewId?: unknown;
  path?: unknown;
  title?: unknown;
  referrer?: unknown;
  pageDurationSeconds?: unknown;
  sessionDurationSeconds?: unknown;
};

const identifierPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function headerText(request: Request, names: string[], maxLength: number) {
  for (const name of names) {
    const raw = request.headers.get(name)?.trim();
    if (!raw) continue;
    try {
      return decodeURIComponent(raw).slice(0, maxLength);
    } catch {
      return raw.slice(0, maxLength);
    }
  }
  return null;
}

function requestLocation(request: Request) {
  const country = headerText(request, ["cf-ipcountry", "x-vercel-ip-country", "x-country-code"], 8)?.toUpperCase() ?? null;
  const region = headerText(request, ["x-vercel-ip-country-region", "x-region", "x-region-name"], 120);
  const city = headerText(request, ["x-vercel-ip-city", "x-city"], 120);
  return { country, region, city };
}

function clientInfo(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const isBot = /bot|crawler|spider|slurp|preview|facebookexternalhit|headless/i.test(userAgent);
  const deviceType = /ipad|tablet/i.test(userAgent)
    ? "tablet"
    : /mobile|android|iphone|ipod/i.test(userAgent)
      ? "mobile"
      : userAgent
        ? "desktop"
        : "unknown";
  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /opr\//i.test(userAgent)
      ? "Opera"
      : /chrome|crios/i.test(userAgent)
        ? "Chrome"
        : /safari/i.test(userAgent)
          ? "Safari"
          : /firefox|fxios/i.test(userAgent)
            ? "Firefox"
            : null;
  return { isBot, deviceType, browser };
}

function cleanPath(value: unknown) {
  const path = String(value ?? "").trim().slice(0, 500);
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api") || path.startsWith("/_next")) return null;
  return path;
}

function cleanDuration(value: unknown) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return 0;
  return Math.min(14_400, Math.max(0, Math.floor(duration)));
}

function localRequest(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
}

export async function POST(request: Request) {
  if (localRequest(request) && process.env.ANALYTICS_TRACK_LOCAL === "false") {
    return new Response(null, { status: 204 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) return NextResponse.json({ error: "İstek çok büyük." }, { status: 413 });

  const body = (await request.json().catch(() => null)) as AnalyticsEvent | null;
  const event = String(body?.event ?? "");
  const visitorKey = String(body?.visitorId ?? "");
  const sessionKey = String(body?.sessionId ?? "");
  const viewKey = String(body?.viewId ?? "");
  const path = cleanPath(body?.path);
  if (!["pageview", "heartbeat", "leave"].includes(event)
    || !identifierPattern.test(visitorKey)
    || !identifierPattern.test(sessionKey)
    || !identifierPattern.test(viewKey)
    || !path) {
    return NextResponse.json({ error: "Analytics verisi geçersiz." }, { status: 400 });
  }

  const { isBot, deviceType, browser } = clientInfo(request);
  if (isBot) return new Response(null, { status: 204 });

  try {
    const db = getDb();
    const now = new Date();
    if (event === "pageview") {
      const location = requestLocation(request);
      let referrerHost: string | null = null;
      try {
        const referrer = String(body?.referrer ?? "").slice(0, 500);
        referrerHost = referrer ? new URL(referrer).hostname.slice(0, 180) : null;
      } catch {
        referrerHost = null;
      }

      await db.transaction(async (tx) => {
        await tx.insert(analyticsVisitors).values({
          visitorKey,
          ...location,
          deviceType,
          browser,
          firstSeenAt: now,
          lastSeenAt: now,
        }).onConflictDoUpdate({
          target: analyticsVisitors.visitorKey,
          set: {
            country: location.country,
            region: location.region,
            city: location.city,
            deviceType,
            browser,
            lastSeenAt: now,
          },
        });

        const createdSession = await tx.insert(analyticsSessions).values({
          sessionKey,
          visitorKey,
          entryPath: path,
          exitPath: path,
          referrerHost,
          ...location,
          deviceType,
          browser,
          pageViewCount: 1,
          startedAt: now,
          lastActivityAt: now,
        }).onConflictDoNothing().returning({ id: analyticsSessions.id });

        const createdView = await tx.insert(analyticsPageViews).values({
          viewKey,
          sessionKey,
          visitorKey,
          path,
          title: String(body?.title ?? "").trim().slice(0, 300) || null,
          viewedAt: now,
        }).onConflictDoNothing().returning({ id: analyticsPageViews.id });

        if (!createdSession.length && createdView.length) {
          await tx.update(analyticsSessions).set({
            exitPath: path,
            pageViewCount: sql`${analyticsSessions.pageViewCount} + 1`,
            lastActivityAt: now,
            endedAt: null,
          }).where(and(
            eq(analyticsSessions.sessionKey, sessionKey),
            eq(analyticsSessions.visitorKey, visitorKey),
          ));
        }
      });
      return new Response(null, { status: 204 });
    }

    const pageDuration = cleanDuration(body?.pageDurationSeconds);
    const sessionDuration = cleanDuration(body?.sessionDurationSeconds);
    await Promise.all([
      db.update(analyticsVisitors)
        .set({ lastSeenAt: now })
        .where(eq(analyticsVisitors.visitorKey, visitorKey)),
      db.update(analyticsSessions).set({
        exitPath: path,
        durationSeconds: sql`greatest(${analyticsSessions.durationSeconds}, ${sessionDuration})`,
        lastActivityAt: now,
        endedAt: event === "leave" ? now : null,
      }).where(and(
        eq(analyticsSessions.sessionKey, sessionKey),
        eq(analyticsSessions.visitorKey, visitorKey),
      )),
      db.update(analyticsPageViews).set({
        durationSeconds: sql`greatest(${analyticsPageViews.durationSeconds}, ${pageDuration})`,
        leftAt: event === "leave" ? now : null,
      }).where(and(
        eq(analyticsPageViews.viewKey, viewKey),
        eq(analyticsPageViews.sessionKey, sessionKey),
      )),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[analytics/track] Kayıt başarısız:", error instanceof Error ? error.message : "Bilinmeyen hata");
    return NextResponse.json({ error: "Analytics kaydedilemedi." }, { status: 503 });
  }
}
