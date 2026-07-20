import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export type AnalyticsPeriod = "today" | "3d" | "7d" | "30d" | "90d";

export type AdminAnalyticsData = {
  period: AnalyticsPeriod;
  generatedAt: string;
  overview: {
    visits: number;
    uniqueVisitors: number;
    pageViews: number;
    averageSessionSeconds: number;
    bounceRate: number;
    mobileShare: number;
  };
  commerce: {
    orders: number;
    revenueInKurus: number;
    averageOrderInKurus: number;
    messages: number;
    cateringRequests: number;
    visitToOrderRate: number;
  };
  timeline: Array<{
    date: string;
    visits: number;
    uniqueVisitors: number;
    pageViews: number;
  }>;
  orderTimeline: Array<{
    date: string;
    orders: number;
    revenueInKurus: number;
  }>;
  locations: Array<{
    country: string;
    region: string;
    city: string;
    visits: number;
    uniqueVisitors: number;
  }>;
  pages: Array<{
    path: string;
    views: number;
    uniqueVisitors: number;
    averageSeconds: number;
  }>;
  devices: Array<{ device: string; visits: number }>;
  sources: Array<{ source: string; visits: number }>;
};

type Row = Record<string, unknown>;

function rowsFrom<T extends Row>(result: unknown) {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[];
  }
  return [];
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function daysFor(period: AnalyticsPeriod) {
  if (period === "today") return 1;
  if (period === "3d") return 3;
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  return 30;
}

export async function getAdminAnalytics(period: AnalyticsPeriod): Promise<AdminAnalyticsData> {
  const db = getDb();
  const dayCount = daysFor(period);
  const from = new Date(`${dayKey(new Date())}T00:00:00+03:00`);
  from.setUTCDate(from.getUTCDate() - dayCount + 1);
  const fromIso = from.toISOString();

  // Railway's public PostgreSQL proxy is sensitive to bursts of parallel
  // connections. Keep these reporting queries sequential so a dashboard
  // refresh cannot exhaust the small application pool.
  const overviewResult = await db.execute(sql`
      select
        count(*)::int as visits,
        count(distinct visitor_key)::int as unique_visitors,
        coalesce(sum(page_view_count), 0)::int as page_views,
        coalesce(round(avg(nullif(duration_seconds, 0))), 0)::int as average_session_seconds,
        coalesce(round(100.0 * count(*) filter (where page_view_count = 1) / nullif(count(*), 0), 1), 0) as bounce_rate,
        coalesce(round(100.0 * count(*) filter (where device_type = 'mobile') / nullif(count(*), 0), 1), 0) as mobile_share
      from analytics_sessions
      where started_at >= ${fromIso}::timestamptz
    `);
  const commerceResult = await db.execute(sql`
      select
        count(*)::int as orders,
        coalesce(sum(total_in_kurus), 0)::bigint as revenue_in_kurus,
        coalesce(round(avg(total_in_kurus)), 0)::int as average_order_in_kurus
      from orders
      where created_at >= ${fromIso}::timestamptz
    `);
  const messagesResult = await db.execute(
    sql`select count(*)::int as total from contact_messages where created_at >= ${fromIso}::timestamptz`,
  );
  const cateringResult = await db.execute(
    sql`select count(*)::int as total from catering_requests where created_at >= ${fromIso}::timestamptz`,
  );
  const timelineResult = await db.execute(sql`
      select
        to_char((started_at at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD') as day,
        count(*)::int as visits,
        count(distinct visitor_key)::int as unique_visitors,
        coalesce(sum(page_view_count), 0)::int as page_views
      from analytics_sessions
      where started_at >= ${fromIso}::timestamptz
      group by 1
      order by 1
    `);
  const orderTimelineResult = await db.execute(sql`
      select
        to_char((created_at at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD') as day,
        count(*)::int as orders,
        coalesce(sum(total_in_kurus), 0)::bigint as revenue_in_kurus
      from orders
      where created_at >= ${fromIso}::timestamptz
      group by 1
      order by 1
    `);
  const locationsResult = await db.execute(sql`
      select
        coalesce(country, '—') as country,
        coalesce(region, 'Bilinmiyor') as region,
        coalesce(city, 'Bilinmiyor') as city,
        count(*)::int as visits,
        count(distinct visitor_key)::int as unique_visitors
      from analytics_sessions
      where started_at >= ${fromIso}::timestamptz
      group by 1, 2, 3
      order by visits desc
      limit 20
    `);
  const pagesResult = await db.execute(sql`
      select
        path,
        count(*)::int as views,
        count(distinct visitor_key)::int as unique_visitors,
        coalesce(round(avg(nullif(duration_seconds, 0))), 0)::int as average_seconds
      from analytics_page_views
      where viewed_at >= ${fromIso}::timestamptz
      group by path
      order by views desc
      limit 20
    `);
  const devicesResult = await db.execute(sql`
      select coalesce(device_type, 'unknown') as device, count(*)::int as visits
      from analytics_sessions
      where started_at >= ${fromIso}::timestamptz
      group by 1
      order by visits desc
    `);
  const sourcesResult = await db.execute(sql`
      select coalesce(nullif(referrer_host, ''), 'Doğrudan') as source, count(*)::int as visits
      from analytics_sessions
      where started_at >= ${fromIso}::timestamptz
      group by 1
      order by visits desc
      limit 12
    `);

  const overviewRow = rowsFrom<Row>(overviewResult)[0] ?? {};
  const commerceRow = rowsFrom<Row>(commerceResult)[0] ?? {};
  const messagesRow = rowsFrom<Row>(messagesResult)[0] ?? {};
  const cateringRow = rowsFrom<Row>(cateringResult)[0] ?? {};
  const visits = numberValue(overviewRow.visits);
  const orders = numberValue(commerceRow.orders);

  const timelineRows = rowsFrom<Row>(timelineResult);
  const timelineByDay = new Map(timelineRows.map((row) => [String(row.day), row]));
  const orderRows = rowsFrom<Row>(orderTimelineResult);
  const ordersByDay = new Map(orderRows.map((row) => [String(row.day), row]));
  const dayKeys = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(from);
    date.setDate(from.getDate() + index);
    return dayKey(date);
  });

  return {
    period,
    generatedAt: new Date().toISOString(),
    overview: {
      visits,
      uniqueVisitors: numberValue(overviewRow.unique_visitors),
      pageViews: numberValue(overviewRow.page_views),
      averageSessionSeconds: numberValue(overviewRow.average_session_seconds),
      bounceRate: numberValue(overviewRow.bounce_rate),
      mobileShare: numberValue(overviewRow.mobile_share),
    },
    commerce: {
      orders,
      revenueInKurus: numberValue(commerceRow.revenue_in_kurus),
      averageOrderInKurus: numberValue(commerceRow.average_order_in_kurus),
      messages: numberValue(messagesRow.total),
      cateringRequests: numberValue(cateringRow.total),
      visitToOrderRate: visits ? Math.round((orders / visits) * 10_000) / 100 : 0,
    },
    timeline: dayKeys.map((date) => {
      const row = timelineByDay.get(date) ?? {};
      return {
        date,
        visits: numberValue(row.visits),
        uniqueVisitors: numberValue(row.unique_visitors),
        pageViews: numberValue(row.page_views),
      };
    }),
    orderTimeline: dayKeys.map((date) => {
      const row = ordersByDay.get(date) ?? {};
      return {
        date,
        orders: numberValue(row.orders),
        revenueInKurus: numberValue(row.revenue_in_kurus),
      };
    }),
    locations: rowsFrom<Row>(locationsResult).map((row) => ({
      country: String(row.country),
      region: String(row.region),
      city: String(row.city),
      visits: numberValue(row.visits),
      uniqueVisitors: numberValue(row.unique_visitors),
    })),
    pages: rowsFrom<Row>(pagesResult).map((row) => ({
      path: String(row.path),
      views: numberValue(row.views),
      uniqueVisitors: numberValue(row.unique_visitors),
      averageSeconds: numberValue(row.average_seconds),
    })),
    devices: rowsFrom<Row>(devicesResult).map((row) => ({
      device: String(row.device),
      visits: numberValue(row.visits),
    })),
    sources: rowsFrom<Row>(sourcesResult).map((row) => ({
      source: String(row.source),
      visits: numberValue(row.visits),
    })),
  };
}
