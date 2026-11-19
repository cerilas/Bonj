import { NextResponse } from "next/server";
import { destroyUserSession } from "@/lib/user-auth";

export async function POST() {
  try {
    await destroyUserSession();
    return NextResponse.json({ ok: true, message: "Başarıyla çıkış yapıldı." });
  } catch (error) {
    console.error("[AUTH LOGOUT ERROR]", error);
    return NextResponse.json({ ok: true });
  }
}
