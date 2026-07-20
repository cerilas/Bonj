import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdminAnalytics, type AnalyticsPeriod } from "@/lib/admin-analytics";

const periods = new Set<AnalyticsPeriod>(["today", "3d", "7d", "30d", "90d"]);

export async function GET(request: Request) {
  try {
    if (!(await getCurrentAdmin())) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
    const requestedPeriod = new URL(request.url).searchParams.get("period") as AnalyticsPeriod;
    const period = periods.has(requestedPeriod) ? requestedPeriod : "30d";
    return NextResponse.json(await getAdminAnalytics(period));
  } catch (error) {
    console.error("[admin/analytics] İstatistikler yüklenemedi:", error);
    return NextResponse.json(
      { error: "İstatistikler şu anda yüklenemiyor. Lütfen tekrar deneyin." },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }
}
