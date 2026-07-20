"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminAnalyticsData, AnalyticsPeriod } from "@/lib/admin-analytics";
import { UiIcon } from "../components/UiIcon";

const periodLabels: Record<AnalyticsPeriod, string> = {
  today: "Bugün",
  "3d": "3 gün",
  "7d": "7 gün",
  "30d": "30 gün",
  "90d": "90 gün",
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
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
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

function chartPoints(values: number[], width: number, height: number, padding: number) {
  const max = Math.max(1, ...values);
  return values.map((value, index) => {
    const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / max) * (height - padding * 2);
    return { x, y, value };
  });
}

function TrafficChart({ rows }: { rows: AdminAnalyticsData["timeline"] }) {
  const width = 820;
  const height = 250;
  const padding = 24;
  const visits = chartPoints(rows.map((row) => row.visits), width, height, padding);
  const unique = chartPoints(rows.map((row) => row.uniqueVisitors), width, height, padding);
  const line = (points: typeof visits) => points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = visits.length
    ? `M ${visits[0].x} ${height - padding} L ${visits.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${visits.at(-1)?.x} ${height - padding} Z`
    : "";
  const labelIndexes = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].filter((index) => index >= 0);

  return (
    <div className="admin-analytics-chart-wrap">
      <svg className="admin-analytics-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Zamana göre ziyaret ve tekil ziyaret grafiği">
        <defs>
          <linearGradient id="trafficArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a91940" stopOpacity=".2" />
            <stop offset="1" stopColor="#a91940" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.2, 0.4, 0.6, 0.8].map((ratio) => <line key={ratio} x1={padding} x2={width - padding} y1={height * ratio} y2={height * ratio} className="chart-grid" />)}
        {area && <path d={area} fill="url(#trafficArea)" />}
        <polyline points={line(visits)} className="chart-line chart-line-primary" />
        <polyline points={line(unique)} className="chart-line chart-line-secondary" />
        {visits.map((point, index) => <circle key={rows[index]?.date} cx={point.x} cy={point.y} r="3" className="chart-point"><title>{shortDate(rows[index].date)} · {point.value} ziyaret</title></circle>)}
        {labelIndexes.map((index) => <text key={index} x={visits[index]?.x ?? padding} y={height - 2} textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"}>{rows[index] ? shortDate(rows[index].date) : ""}</text>)}
      </svg>
    </div>
  );
}

function OrderChart({ rows }: { rows: AdminAnalyticsData["orderTimeline"] }) {
  const max = Math.max(1, ...rows.map((row) => row.revenueInKurus));
  const visibleLabels = rows.length <= 7 ? rows : rows.filter((_, index) => index % Math.ceil(rows.length / 7) === 0 || index === rows.length - 1);
  return (
    <div className="admin-order-chart" role="img" aria-label="Zamana göre sipariş cirosu grafiği">
      <div className="admin-order-chart-bars">
        {rows.map((row) => (
          <span key={row.date} title={`${shortDate(row.date)} · ${row.orders} sipariş · ${money(row.revenueInKurus)}`} style={{ "--bar": `${Math.max(row.revenueInKurus ? 4 : 0, (row.revenueInKurus / max) * 100)}%` } as React.CSSProperties}>
            <i />
          </span>
        ))}
      </div>
      <div className="admin-order-chart-labels">
        {visibleLabels.map((row) => <small key={row.date}>{shortDate(row.date)}</small>)}
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
              <AnalyticsKpi label="Sipariş cirosu" value={money(data.commerce.revenueInKurus)} detail={`${data.commerce.orders} sipariş · Ort. ${money(data.commerce.averageOrderInKurus)}`} tone="dark" />
              <AnalyticsKpi label="Sipariş oranı" value={`%${data.commerce.visitToOrderRate}`} detail="Ziyaret / sipariş karşılaştırması" />
              <AnalyticsKpi label="Form mesajı" value={number(data.commerce.messages)} detail="İletişim formundan gelen" />
              <AnalyticsKpi label="Catering talebi" value={number(data.commerce.cateringRequests)} detail="Organizasyon ön görüşmesi" tone="berry" />
            </div>

            <article className="admin-analytics-panel admin-revenue-panel">
              <header>
                <div><span>ZAMANA GÖRE SİPARİŞ</span><h2>Ciro ve sipariş adedi</h2></div>
                <strong>{money(data.commerce.revenueInKurus)}<small>{data.commerce.orders} sipariş</small></strong>
              </header>
              <OrderChart rows={data.orderTimeline} />
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
