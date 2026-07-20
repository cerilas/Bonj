import { NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }
  await destroyAdminSession();
  return NextResponse.json({ ok: true });
}
