"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminAnalyticsData, AnalyticsPeriod } from "@/lib/admin-analytics";
import { UiIcon } from "../components/UiIcon";

const periodLabels: Record<AnalyticsPeriod, string> = {
  today: "Bugün",
  "3d": "3 Gün",
  "7d": "Haftalık",
  "30d": "Aylık",
  "90d": "3 Aylık",
  "180d": "6 Aylık",
  "365d": "Yıllık",
};

function number(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function duration(value: number) {
  if (value < 60) return `${value} sn`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return seconds ? `${minutes} dk ${seconds} sn` : `${minutes} dk`;
}

function shortDate(value: string) {
  if (value.length === 7) {
    return new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit" }).format(
      new Date(`${value}-15T12:00:00`),
    );
  }
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function bucketTraffic(rows: AdminAnalyticsData["timeline"]) {
  if (rows.length <= 35) {
    return rows.map((r) => ({ ...r, label: shortDate(r.date) }));
  }
  if (rows.length > 190) {
    const byMonth = new Map<string, { date: string; visits: number; uniqueVisitors: number; pageViews: number }>();
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      const cur = byMonth.get(m) ?? { date: m, visits: 0, uniqueVisitors: 0, pageViews: 0 };
      cur.visits += r.visits;
      cur.uniqueVisitors += r.uniqueVisitors;
      cur.pageViews += r.pageViews;
      byMonth.set(m, cur);
    }
    return Array.from(byMonth.values()).map((r) => ({ ...r, label: shortDate(r.date) }));
  }
  const chunkSize = 7;
  const out: Array<{ date: string; label: string; visits: number; uniqueVisitors: number; pageViews: number }> = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    out.push({
      date: slice[0].date,
      label: shortDate(slice[0].date),
      visits: slice.reduce((s, r) => s + r.visits, 0),
      uniqueVisitors: slice.reduce((s, r) => s + r.uniqueVisitors, 0),
      pageViews: slice.reduce((s, r) => s + r.pageViews, 0),
    });
  }
  return out;
}

function bucketOrders(rows: AdminAnalyticsData["orderTimeline"]) {
  if (rows.length <= 35) {
    return rows.map((r) => ({ ...r, label: shortDate(r.date) }));
  }
  if (rows.length > 190) {
    const byMonth = new Map<
      string,
      AdminAnalyticsData["orderTimeline"][number]
    >();
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      const cur = byMonth.get(m) ?? {
        date: m,
        orders: 0,
        revenueInKurus: 0,
        posTableOrders: 0,
        qrTableOrders: 0,
        deliveryOrders: 0,
        pickupOrders: 0,
      };
      cur.orders += r.orders;
      cur.revenueInKurus += r.revenueInKurus;
      cur.posTableOrders += r.posTableOrders;
      cur.qrTableOrders += r.qrTableOrders;
      cur.deliveryOrders += r.deliveryOrders;
      cur.pickupOrders += r.pickupOrders;
      byMonth.set(m, cur);
    }
    return Array.from(byMonth.values()).map((r) => ({ ...r, label: shortDate(r.date) }));
  }
  const chunkSize = 7;
  const out: Array<AdminAnalyticsData["orderTimeline"][number] & { label: string }> = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    out.push({
      date: slice[0].date,
      label: shortDate(slice[0].date),
      orders: slice.reduce((s, r) => s + r.orders, 0),
      revenueInKurus: slice.reduce((s, r) => s + r.revenueInKurus, 0),
      posTableOrders: slice.reduce((s, r) => s + r.posTableOrders, 0),
      qrTableOrders: slice.reduce((s, r) => s + r.qrTableOrders, 0),
      deliveryOrders: slice.reduce((s, r) => s + r.deliveryOrders, 0),
      pickupOrders: slice.reduce((s, r) => s + r.pickupOrders, 0),
    });
  }
  return out;
}

function countryLabel(code: string) {
  if (!code || code === "—") return "Bilinmiyor";
  try {
    return new Intl.DisplayNames(["tr"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function deviceLabel(value: string) {
  return { mobile: "Mobil", desktop: "Masaüstü", tablet: "Tablet", unknown: "Bilinmiyor" }[value] ?? value;
}

function chartPoints(values: number[], width: number, height: number, padLeft: number, padRight: number, padY: number) {
  const max = Math.max(1, ...values);
  const innerW = width - padLeft - padRight;
  const innerH = height - padY * 2;
  return values.map((value, index) => {
    const x = padLeft + (index / Math.max(1, values.length - 1)) * innerW;
    const y = height - padY - (value / max) * innerH;
    return { x, y, value };
  });
}

function TrafficChart({ rows }: { rows: AdminAnalyticsData["timeline"] }) {
  const bucketed = useMemo(() => bucketTraffic(rows), [rows]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const width = 820;
  const height = 240;
  const padLeft = 42;
  const padRight = 18;
  const padY = 26;

  const maxVisits = Math.max(1, ...bucketed.map((r) => r.visits));
  const visits = chartPoints(bucketed.map((row) => row.visits), width, height, padLeft, padRight, padY);
  const unique = chartPoints(bucketed.map((row) => row.uniqueVisitors), width, height, padLeft, padRight, padY);
  const line = (points: typeof visits) => points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = visits.length
    ? `M ${visits[0].x} ${height - padY} L ${visits.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${visits.at(-1)?.x} ${height - padY} Z`
    : "";

  const labelStep = Math.max(1, Math.ceil(bucketed.length / 6));
  const labelIndexes = bucketed
    .map((_, idx) => idx)
    .filter((idx) => idx === 0 || idx === bucketed.length - 1 || idx % labelStep === 0);

  const activeRow = activeIdx !== null ? bucketed[activeIdx] : bucketed.at(-1);

  return (
    <div className="admin-analytics-chart-wrap">
      {activeRow && (
        <div className="admin-chart-readout">
          <strong>{activeRow.label}</strong>
          <span>{number(activeRow.visits)} ziyaret · {number(activeRow.uniqueVisitors)} tekil · {number(activeRow.pageViews)} görüntüleme</span>
        </div>
      )}
      <svg className="admin-analytics-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Zamana göre ziyaret ve tekil ziyaret grafiği">
        <defs>
          <linearGradient id="trafficArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a91940" stopOpacity=".22" />
            <stop offset="1" stopColor="#a91940" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = height - padY - ratio * (height - padY * 2);
          const val = Math.round(maxVisits * ratio);
          return (
            <g key={ratio}>
              <line x1={padLeft} x2={width - padRight} y1={y} y2={y} className="chart-grid" />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" className="chart-y-label">{val}</text>
            </g>
          );
        })}
        {area && <path d={area} fill="url(#trafficArea)" />}
        <polyline points={line(visits)} className="chart-line chart-line-primary" />
        <polyline points={line(unique)} className="chart-line chart-line-secondary" />
        {visits.map((point, index) => (
          <circle
            key={`${bucketed[index]?.date}-${index}`}
            cx={point.x}
            cy={point.y}
            r={activeIdx === index ? 5.5 : 3.5}
            className="chart-point"
            onMouseEnter={() => setActiveIdx(index)}
            onClick={() => setActiveIdx(index)}
          >
            <title>{bucketed[index]?.label} · {point.value} ziyaret</title>
          </circle>
        ))}
        {labelIndexes.map((index) => (
          <text
            key={index}
            x={visits[index]?.x ?? padLeft}
            y={height - 4}
            textAnchor={index === 0 ? "start" : index === bucketed.length - 1 ? "end" : "middle"}
          >
            {bucketed[index]?.label ?? ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

function OrderChart({ rows }: { rows: AdminAnalyticsData["orderTimeline"] }) {
  const bucketed = useMemo(() => bucketOrders(rows), [rows]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const max = Math.max(1, ...bucketed.map((row) => row.revenueInKurus));
  const labelStep = Math.max(1, Math.ceil(bucketed.length / 6));
  const visibleLabels = bucketed.filter(
    (_, index) => index === 0 || index === bucketed.length - 1 || index % labelStep === 0,
  );
  const activeRow = activeIdx !== null ? bucketed[activeIdx] : bucketed.at(-1);

  return (
    <div className="admin-order-chart" role="img" aria-label="Zamana göre sipariş cirosu grafiği">
      {activeRow && (
        <div className="admin-chart-readout">
          <strong>{activeRow.label}</strong>
          <span>
            {activeRow.orders} sipariş · {money(activeRow.revenueInKurus)} (Kasa: {activeRow.posTableOrders} · QR: {activeRow.qrTableOrders} · Paket: {activeRow.deliveryOrders} · Gel Al: {activeRow.pickupOrders})
          </span>
        </div>
      )}
      <div className="admin-order-chart-area">
        <div className="admin-order-chart-yaxis">
          <span>{money(max)}</span>
          <span>{money(Math.round(max / 2))}</span>
          <span>0 ₺</span>
        </div>
        <div className="admin-order-chart-main">
          <div className="admin-order-chart-bars">
            {bucketed.map((row, idx) => (
              <button
                type="button"
                key={`${row.date}-${idx}`}
                className={activeIdx === idx ? "is-active" : ""}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => setActiveIdx(idx)}
                title={`${row.label} · ${row.orders} sipariş · ${money(row.revenueInKurus)}`}
                style={{ "--bar": `${Math.max(row.revenueInKurus ? 6 : 0, (row.revenueInKurus / max) * 100)}%` } as React.CSSProperties}
              >
                <i />
              </button>
            ))}
          </div>
          <div className="admin-order-chart-labels">
            {visibleLabels.map((row) => <small key={row.date}>{row.label}</small>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsKpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <article className={`admin-analytics-kpi ${tone ? `tone-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function AdminAnalyticsPanel() {
  const router = useRouter();
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestAnalytics = useCallback(async (
    nextPeriod: AnalyticsPeriod,
    signal?: AbortSignal,
  ): Promise<AdminAnalyticsData | null> => {
    let response = await fetch(`/api/admin/analytics?period=${nextPeriod}`, { cache: "no-store", signal });
    if (response.status === 503 && !signal?.aborted) {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      response = await fetch(`/api/admin/analytics?period=${nextPeriod}`, { cache: "no-store", signal });
    }
    if (response.status === 401) {
      router.refresh();
      return null;
    }
    const result = (await response.json().catch(() => null)) as AdminAnalyticsData | { error?: string } | null;
    if (!response.ok || !result || !("overview" in result)) {
      throw new Error(result && "error" in result && result.error ? result.error : "İstatistikler yüklenemedi.");
    }
    return result as AdminAnalyticsData;
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    void requestAnalytics("30d", controller.signal)
      .then((result) => result && setData(result))
      .catch((requestError) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "İstatistikler yüklenemedi.");
        }
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [requestAnalytics]);

  useEffect(() => {
    const refreshInBackground = () => {
      if (document.visibilityState !== "visible") return;
      void requestAnalytics(period)
        .then((result) => result && setData(result))
        .catch(() => undefined);
    };
    const refreshTimer = window.setInterval(refreshInBackground, 30_000);
    window.addEventListener("focus", refreshInBackground);
    document.addEventListener("visibilitychange", refreshInBackground);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshInBackground);
      document.removeEventListener("visibilitychange", refreshInBackground);
    };
  }, [period, requestAnalytics]);

  async function changePeriod(nextPeriod: AnalyticsPeriod) {
    if (nextPeriod === period && data) return;
    setPeriod(nextPeriod);
    setLoading(true);
    setError("");
    try {
      const result = await requestAnalytics(nextPeriod);
      if (result) setData(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "İstatistikler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  const totalDeviceVisits = useMemo(() => data?.devices.reduce((total, item) => total + item.visits, 0) ?? 0, [data]);
  const totalSourceVisits = useMemo(() => data?.sources.reduce((total, item) => total + item.visits, 0) ?? 0, [data]);
  const [productQuery, setProductQuery] = useState("");
  const filteredTopProducts = useMemo(() => {
    const list = data?.topProducts ?? [];
    const q = productQuery.trim().toLowerCase();
    return q ? list.filter((p) => p.productName.toLowerCase().includes(q)) : list;
  }, [data?.topProducts, productQuery]);
  const maxProductQty = useMemo(
    () => Math.max(1, ...(data?.topProducts ?? []).map((p) => p.quantity)),
    [data?.topProducts],
  );

  return (
    <section className="admin-main admin-analytics-main" id="analytics">
      <header className="admin-topbar admin-analytics-topbar">
        <div>
          <span className="admin-eyebrow">VERİ / CANLI GÖRÜNÜM</span>
          <h1>Bonj<br /><em>rakamlarla.</em></h1>
        </div>
        <div className="admin-analytics-period" role="group" aria-label="İstatistik dönemi">
          {(Object.keys(periodLabels) as AnalyticsPeriod[]).map((item) => (
            <button type="button" className={period === item ? "is-current" : ""} key={item} onClick={() => void changePeriod(item)}>{periodLabels[item]}</button>
          ))}
        </div>
      </header>

      {error && (
        <div className="admin-load-error" role="alert">
          <span><strong>İstatistikler yenilenemedi.</strong>{error}</span>
          <button type="button" onClick={() => void changePeriod(period)}>Tekrar dene <i aria-hidden="true"><UiIcon name="refresh" /></i></button>
        </div>
      )}

      <div className={`admin-analytics-content ${loading ? "is-loading" : ""}`} aria-busy={loading}>
        {!data && loading ? (
          <div className="admin-analytics-skeleton"><i /><i /><i /><i /></div>
        ) : data && (
          <>
            <div className="admin-analytics-kpis">
              <AnalyticsKpi label="Ziyaret" value={number(data.overview.visits)} detail={`${periodLabels[period]} içindeki oturumlar`} tone="berry" />
              <AnalyticsKpi label="Tekil ziyaretçi" value={number(data.overview.uniqueVisitors)} detail="Anonim cihaz bazında" />
              <AnalyticsKpi label="Ort. oturum" value={duration(data.overview.averageSessionSeconds)} detail={`Hemen çıkma %${data.overview.bounceRate}`} />
              <AnalyticsKpi label="Sayfa görüntüleme" value={number(data.overview.pageViews)} detail={`Mobil trafik %${data.overview.mobileShare}`} />
            </div>

            <article className="admin-analytics-panel admin-traffic-panel">
              <header>
                <div><span>ZAMANA GÖRE TRAFİK</span><h2>Ziyaret hareketi</h2></div>
                <div className="admin-chart-legend"><i className="is-primary" /> Ziyaret <i className="is-secondary" /> Tekil</div>
              </header>
              <TrafficChart rows={data.timeline} />
            </article>

            <div className="admin-analytics-commerce-kpis">
              <AnalyticsKpi label="Toplam sipariş cirosu" value={money(data.commerce.revenueInKurus)} detail={`${data.commerce.orders} sipariş · Ort. ${money(data.commerce.averageOrderInKurus)}`} tone="dark" />
              <AnalyticsKpi label="Online sipariş oranı" value={`%${data.commerce.visitToOrderRate}`} detail={`${data.commerce.onlineOrders} online · ${data.commerce.posTableOrders} masa kasa`} />
              <AnalyticsKpi label="Form mesajı" value={number(data.commerce.messages)} detail="İletişim formundan gelen" />
              <AnalyticsKpi label="Catering talebi" value={number(data.commerce.cateringRequests)} detail="Organizasyon ön görüşmesi" tone="berry" />
            </div>

            <article className="admin-analytics-panel">
              <header>
                <div><span>SİPARİŞ KANALLARI</span><h2>Masa, QR, Eve Paket &amp; Gel Al dağılımı</h2></div>
                <strong>{number(data.commerce.orders)}<small>toplam sipariş</small></strong>
              </header>
              <div className="admin-analytics-channels-grid">
                {data.orderChannels.map((ch) => {
                  const pct = data.commerce.orders ? Math.round((ch.orders / data.commerce.orders) * 100) : 0;
                  return (
                    <div key={ch.channel} className="admin-analytics-channel-card">
                      <span>{ch.label}</span>
                      <strong>{number(ch.orders)} <small>sipariş (%{pct})</small></strong>
                      <b>{money(ch.revenueInKurus)}</b>
                      <i><em style={{ width: `${pct}%` }} /></i>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="admin-analytics-panel admin-revenue-panel">
              <header>
                <div><span>ZAMANA GÖRE SİPARİŞ</span><h2>Ciro ve sipariş adedi</h2></div>
                <strong>{money(data.commerce.revenueInKurus)}<small>{data.commerce.orders} sipariş</small></strong>
              </header>
              <OrderChart rows={data.orderTimeline} />
            </article>

            <article className="admin-analytics-panel">
              <header className="admin-top-products-head">
                <div><span>ÜRÜN PERFORMANSI</span><h2>En çok sipariş edilen ürünler</h2></div>
                <input
                  type="search"
                  className="admin-top-products-search"
                  placeholder="Ürün ara…"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                />
              </header>
              <div className="admin-analytics-table admin-top-products-table">
                <div className="admin-analytics-table-head">
                  <span>Ürün</span>
                  <span>Toplam Adet</span>
                  <span>Masa / Online</span>
                  <span>Ciro</span>
                </div>
                {filteredTopProducts.map((item, idx) => (
                  <div key={item.productName}>
                    <strong>
                      <em className="admin-product-rank">{idx + 1}.</em> {item.productName}
                      <i className="admin-product-bar"><b style={{ width: `${(item.quantity / maxProductQty) * 100}%` }} /></i>
                    </strong>
                    <span><strong>{number(item.quantity)}</strong> adet</span>
                    <span>{number(item.posQuantity)} / {number(item.onlineQuantity)}</span>
                    <span><strong>{money(item.revenueInKurus)}</strong></span>
                  </div>
                ))}
                {!filteredTopProducts.length && <p>Bu dönemde ürün siparişi bulunamadı.</p>}
              </div>
            </article>

            <div className="admin-analytics-grid-two">
              <article className="admin-analytics-panel">
                <header><div><span>SADIK MÜŞTERİLER</span><h2>En çok sipariş veren Top 5 müşteri</h2></div></header>
                <div className="admin-analytics-table admin-top-customers-table">
                  <div className="admin-analytics-table-head">
                    <span>Müşteri</span>
                    <span>Sipariş</span>
                    <span>Toplam Harcama</span>
                  </div>
                  {(data.topCustomers ?? []).map((cust, idx) => (
                    <div key={`${cust.phone}-${idx}`}>
                      <strong>
                        <em className="admin-product-rank">{idx + 1}.</em> {cust.customerName}
                        <small>{cust.phone}</small>
                      </strong>
                      <span><strong>{number(cust.orderCount)}</strong> adet</span>
                      <span><strong>{money(cust.totalSpentInKurus)}</strong></span>
                    </div>
                  ))}
                  {!(data.topCustomers ?? []).length && <p>Bu dönemde kayıtlı müşteri siparişi bulunamadı.</p>}
                </div>
              </article>

              <article className="admin-analytics-panel">
                <header><div><span>TAHSİLAT DAĞILIMI</span><h2>Ödeme yöntemleri</h2></div></header>
                <div className="admin-analytics-bars">
                  {(data.paymentBreakdown ?? []).map((pm) => {
                    const maxPay = Math.max(1, ...(data.paymentBreakdown ?? []).map((x) => x.revenueInKurus));
                    const pct = data.commerce.revenueInKurus
                      ? Math.round((pm.revenueInKurus / data.commerce.revenueInKurus) * 100)
                      : 0;
                    return (
                      <div key={pm.method}>
                        <span>
                          <strong>{pm.label}</strong>
                          <small>{pm.count} işlem · {money(pm.revenueInKurus)} (%{pct})</small>
                        </span>
                        <i><b style={{ width: `${maxPay ? (pm.revenueInKurus / maxPay) * 100 : 0}%` }} /></i>
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>

            <article className="admin-analytics-panel">
              <header>
                <div><span>SAATLİK YOĞUNLUK</span><h2>Günün en yoğun sipariş saatleri (08:00 – 23:00)</h2></div>
              </header>
              <div className="admin-peak-hours">
                {(data.peakHours ?? []).map((slot) => {
                  const maxH = Math.max(1, ...(data.peakHours ?? []).map((h) => h.orders));
                  const pct = slot.orders ? Math.max(10, Math.round((slot.orders / maxH) * 100)) : 0;
                  return (
                    <div key={slot.hour} className="admin-peak-hour-col" title={`${String(slot.hour).padStart(2, "0")}:00 · ${slot.orders} sipariş`}>
                      <span className="admin-peak-count">{slot.orders || ""}</span>
                      <div className="admin-peak-bar-track">
                        <i style={{ height: `${pct}%` }} />
                      </div>
                      <small>{String(slot.hour).padStart(2, "0")}</small>
                    </div>
                  );
                })}
              </div>
            </article>

            <div className="admin-analytics-grid-two">
              <article className="admin-analytics-panel">
                <header><div><span>İÇERİK PERFORMANSI</span><h2>En çok ziyaret edilen sayfalar</h2></div></header>
                <div className="admin-analytics-table admin-pages-table">
                  <div className="admin-analytics-table-head"><span>Sayfa</span><span>Görüntüleme</span><span>Tekil</span><span>Ort. süre</span></div>
                  {data.pages.map((page) => (
                    <div key={page.path}><strong>{page.path}</strong><span>{number(page.views)}</span><span>{number(page.uniqueVisitors)}</span><span>{duration(page.averageSeconds)}</span></div>
                  ))}
                  {!data.pages.length && <p>Takip verisi biriktikçe sayfalar burada görünecek.</p>}
                </div>
              </article>

              <article className="admin-analytics-panel">
                <header><div><span>COĞRAFİ DAĞILIM</span><h2>Ülke, bölge ve şehir</h2></div></header>
                <div className="admin-analytics-table admin-location-table">
                  <div className="admin-analytics-table-head"><span>Konum</span><span>Ziyaret</span><span>Tekil</span></div>
                  {data.locations.map((location, index) => (
                    <div key={`${location.country}-${location.region}-${location.city}-${index}`}>
                      <strong>{location.city === "Bilinmiyor" ? countryLabel(location.country) : location.city}<small>{location.region} · {countryLabel(location.country)}</small></strong>
                      <span>{number(location.visits)}</span><span>{number(location.uniqueVisitors)}</span>
                    </div>
                  ))}
                  {!data.locations.length && <p>Konum başlıkları geldikçe dağılım burada görünecek.</p>}
                </div>
              </article>
            </div>

            <div className="admin-analytics-grid-two admin-analytics-breakdowns">
              <article className="admin-analytics-panel">
                <header><div><span>CİHAZ DAĞILIMI</span><h2>Ziyaret cihazları</h2></div></header>
                <div className="admin-analytics-bars">
                  {data.devices.map((item) => <div key={item.device}><span><strong>{deviceLabel(item.device)}</strong><small>{item.visits} ziyaret</small></span><i><b style={{ width: `${totalDeviceVisits ? (item.visits / totalDeviceVisits) * 100 : 0}%` }} /></i></div>)}
                  {!data.devices.length && <p>Henüz cihaz verisi yok.</p>}
                </div>
              </article>
              <article className="admin-analytics-panel">
                <header><div><span>TRAFİK KAYNAĞI</span><h2>Ziyaret nereden geliyor?</h2></div></header>
                <div className="admin-analytics-bars">
                  {data.sources.map((item) => <div key={item.source}><span><strong>{item.source}</strong><small>{item.visits} ziyaret</small></span><i><b style={{ width: `${totalSourceVisits ? (item.visits / totalSourceVisits) * 100 : 0}%` }} /></i></div>)}
                  {!data.sources.length && <p>Henüz kaynak verisi yok.</p>}
                </div>
              </article>
            </div>

            <p className="admin-analytics-privacy">Ham IP adresi saklanmaz. Tekil ziyaretçi ölçümü anonim tarayıcı kimliğiyle yapılır; admin trafiği ve bilinen botlar rapora dahil edilmez.</p>
          </>
        )}
      </div>
    </section>
  );
}
