import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdminMessages } from "@/lib/admin-messages";

export async function GET(request: Request) {
  try {
    if (!(await getCurrentAdmin())) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus === "new" || rawStatus === "read" || rawStatus === "resolved"
      ? rawStatus
      : "all";
    return NextResponse.json(
      await getAdminMessages({ page: Number.isFinite(page) ? page : 1, status }),
    );
  } catch (error) {
    console.error("[admin/messages] Mesajlar yüklenemedi.", error);
    return NextResponse.json(
      { error: "Veritabanı bağlantısı kurulamadı. Birkaç saniye sonra tekrar deneyin." },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }
}
