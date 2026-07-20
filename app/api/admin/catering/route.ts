import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdminCateringRequests } from "@/lib/admin-catering";

const statuses = new Set(["new", "contacted", "quoted", "confirmed", "completed", "declined"]);

export async function GET(request: Request) {
  try {
    if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const rawStatus = url.searchParams.get("status") ?? "all";
    return NextResponse.json(await getAdminCateringRequests({
      page: Number.isFinite(page) ? page : 1,
      status: statuses.has(rawStatus) ? rawStatus : "all",
    }));
  } catch (error) {
    console.error("[admin/catering] Talepler yüklenemedi.", error);
    return NextResponse.json(
      { error: "Veritabanı bağlantısı kurulamadı. Birkaç saniye sonra tekrar deneyin." },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }
}
