import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdminOrders } from "@/lib/admin-orders";

const statuses = new Set(["new", "accepted", "preparing", "ready", "completed", "cancelled"]);

export async function GET(request: Request) {
  try {
    if (!(await getCurrentAdmin())) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const rawStatus = url.searchParams.get("status") ?? "all";
    const status = statuses.has(rawStatus) ? rawStatus : "all";
    return NextResponse.json(
      await getAdminOrders({ page: Number.isFinite(page) ? page : 1, status }),
    );
  } catch (error) {
    console.error("[admin/orders] Siparişler yüklenemedi.", error);
    return NextResponse.json(
      { error: "Veritabanı bağlantısı kurulamadı. Birkaç saniye sonra tekrar deneyin." },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }
}
