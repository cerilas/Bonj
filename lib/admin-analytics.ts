import "server-only";

import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export type AnalyticsPeriod = "today" | "3d" | "7d" | "30d" | "90d" | "180d" | "365d";

export type OrderChannelKey = "pos_table" | "qr_table" | "delivery" | "pickup";

export type OrderChannelBreakdown = {
  channel: OrderChannelKey;
  label: string;
  orders: number;
  revenueInKurus: number;
};

export type TopProductStat = {
  productName: string;
  quantity: number;
  revenueInKurus: number;
  posQuantity: number;
  onlineQuantity: number;
};

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
    onlineOrders: number;
    onlineRevenueInKurus: number;
    posTableOrders: number;
    posTableRevenueInKurus: number;
    messages: number;
    cateringRequests: number;
    visitToOrderRate: number;
  };
  orderChannels: OrderChannelBreakdown[];
  topProducts: TopProductStat[];
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
    posTableOrders: number;
    qrTableOrders: number;
    deliveryOrders: number;
    pickupOrders: number;
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
  if (period === "180d") return 180;
  if (period === "365d") return 365;
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

  const onlineChannelsResult = await db.execute(sql`
      select
        fulfillment_type as channel,
        count(*)::int as orders,
        coalesce(sum(total_in_kurus), 0)::bigint as revenue_in_kurus
      from orders
      where created_at >= ${fromIso}::timestamptz
        and status not in ('cancelled', 'refunded')
      group by 1
    `);

  const posTableSummaryResult = await db.execute(sql`
      select
        count(*)::int as orders,
        coalesce(sum(paid_cash_in_kurus + paid_card_in_kurus), 0)::bigint as revenue_in_kurus
      from table_sessions
      where opened_at >= ${fromIso}::timestamptz
        and status = 'closed'
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
        coalesce(sum(total_in_kurus), 0)::bigint as revenue_in_kurus,
        count(*) filter (where fulfillment_type = 'table')::int as qr_table_orders,
        count(*) filter (where fulfillment_type = 'delivery')::int as delivery_orders,
        count(*) filter (where fulfillment_type = 'pickup')::int as pickup_orders
      from orders
      where created_at >= ${fromIso}::timestamptz
        and status not in ('cancelled', 'refunded')
      group by 1
      order by 1
    `);

  const posTimelineResult = await db.execute(sql`
      select
        to_char((opened_at at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD') as day,
        count(*)::int as orders,
        coalesce(sum(paid_cash_in_kurus + paid_card_in_kurus), 0)::bigint as revenue_in_kurus
      from table_sessions
      where opened_at >= ${fromIso}::timestamptz
        and status = 'closed'
      group by 1
      order by 1
    `);

  const topProductsResult = await db.execute(sql`
      with combined as (
        select
          oi.product_name as product_name,
          oi.quantity as quantity,
          oi.line_total_in_kurus as revenue_in_kurus,
          0 as pos_quantity,
          oi.quantity as online_quantity
        from order_items oi
        inner join orders o on o.id = oi.order_id
        where o.created_at >= ${fromIso}::timestamptz
          and o.status not in ('cancelled', 'refunded')
        union all
        select
          tsi.product_name as product_name,
          tsi.quantity as quantity,
          (tsi.unit_price_in_kurus * tsi.quantity) as revenue_in_kurus,
          tsi.quantity as pos_quantity,
          0 as online_quantity
        from table_session_items tsi
        inner join table_sessions ts on ts.id = tsi.session_id
        where ts.opened_at >= ${fromIso}::timestamptz
      )
      select
        product_name,
        coalesce(sum(quantity), 0)::int as quantity,
        coalesce(sum(revenue_in_kurus), 0)::bigint as revenue_in_kurus,
        coalesce(sum(pos_quantity), 0)::int as pos_quantity,
        coalesce(sum(online_quantity), 0)::int as online_quantity
      from combined
      group by product_name
      order by quantity desc, revenue_in_kurus desc
      limit 25
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
  const messagesRow = rowsFrom<Row>(messagesResult)[0] ?? {};
  const cateringRow = rowsFrom<Row>(cateringResult)[0] ?? {};
  const posRow = rowsFrom<Row>(posTableSummaryResult)[0] ?? {};

  const channelMap = new Map<string, { orders: number; revenueInKurus: number }>();
  for (const row of rowsFrom<Row>(onlineChannelsResult)) {
    channelMap.set(String(row.channel ?? ""), {
      orders: numberValue(row.orders),
      revenueInKurus: numberValue(row.revenue_in_kurus),
    });
  }

  const posTableOrders = numberValue(posRow.orders);
  const posTableRevenueInKurus = numberValue(posRow.revenue_in_kurus);
  const qrStats = channelMap.get("table") ?? { orders: 0, revenueInKurus: 0 };
  const deliveryStats = channelMap.get("delivery") ?? { orders: 0, revenueInKurus: 0 };
  const pickupStats = channelMap.get("pickup") ?? { orders: 0, revenueInKurus: 0 };

  const onlineOrders = qrStats.orders + deliveryStats.orders + pickupStats.orders;
  const onlineRevenueInKurus =
    qrStats.revenueInKurus + deliveryStats.revenueInKurus + pickupStats.revenueInKurus;

  const totalOrders = onlineOrders + posTableOrders;
  const totalRevenueInKurus = onlineRevenueInKurus + posTableRevenueInKurus;
  const visits = numberValue(overviewRow.visits);

  const orderChannels: OrderChannelBreakdown[] = [
    {
      channel: "pos_table",
      label: "Masa Siparişleri (Kasa)",
      orders: posTableOrders,
      revenueInKurus: posTableRevenueInKurus,
    },
    {
      channel: "qr_table",
      label: "Masaya QR Siparişler",
      orders: qrStats.orders,
      revenueInKurus: qrStats.revenueInKurus,
    },
    {
      channel: "delivery",
      label: "Eve Paket Siparişler",
      orders: deliveryStats.orders,
      revenueInKurus: deliveryStats.revenueInKurus,
    },
    {
      channel: "pickup",
      label: "Gel Al Siparişler",
      orders: pickupStats.orders,
      revenueInKurus: pickupStats.revenueInKurus,
    },
  ];

  const timelineRows = rowsFrom<Row>(timelineResult);
  const timelineByDay = new Map(timelineRows.map((row) => [String(row.day), row]));
  const orderRows = rowsFrom<Row>(orderTimelineResult);
  const ordersByDay = new Map(orderRows.map((row) => [String(row.day), row]));
  const posRows = rowsFrom<Row>(posTimelineResult);
  const posByDay = new Map(posRows.map((row) => [String(row.day), row]));

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
      orders: totalOrders,
      revenueInKurus: totalRevenueInKurus,
      averageOrderInKurus: totalOrders ? Math.round(totalRevenueInKurus / totalOrders) : 0,
      onlineOrders,
      onlineRevenueInKurus,
      posTableOrders,
      posTableRevenueInKurus,
      messages: numberValue(messagesRow.total),
      cateringRequests: numberValue(cateringRow.total),
      visitToOrderRate: visits ? Math.round((onlineOrders / visits) * 10_000) / 100 : 0,
    },
    orderChannels,
    topProducts: rowsFrom<Row>(topProductsResult).map((row) => ({
      productName: String(row.product_name),
      quantity: numberValue(row.quantity),
      revenueInKurus: numberValue(row.revenue_in_kurus),
      posQuantity: numberValue(row.pos_quantity),
      onlineQuantity: numberValue(row.online_quantity),
    })),
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
      const oRow = ordersByDay.get(date) ?? {};
      const pRow = posByDay.get(date) ?? {};
      const qrTableOrders = numberValue(oRow.qr_table_orders);
      const deliveryOrders = numberValue(oRow.delivery_orders);
      const pickupOrders = numberValue(oRow.pickup_orders);
      const posOrders = numberValue(pRow.orders);
      return {
        date,
        orders: numberValue(oRow.orders) + posOrders,
        revenueInKurus: numberValue(oRow.revenue_in_kurus) + numberValue(pRow.revenue_in_kurus),
        posTableOrders: posOrders,
        qrTableOrders,
        deliveryOrders,
        pickupOrders,
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
