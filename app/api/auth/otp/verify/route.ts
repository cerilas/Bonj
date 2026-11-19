import { NextResponse } from "next/server";
import { verifyUserOtp } from "@/lib/user-otp";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const phone = String(body.phone ?? "").trim();
    const code = String(body.code ?? "").trim();
    const fullName = body.fullName ? String(body.fullName).trim() : undefined;
    const email = body.email ? String(body.email).trim() : undefined;

    if (!phone) {
      return NextResponse.json(
        { error: "Lütfen telefon numaranızı girin." },
        { status: 400 },
      );
    }
    if (!code) {
      return NextResponse.json(
        { error: "Lütfen 6 haneli doğrulama kodunu girin." },
        { status: 400 },
      );
    }

    const result = await verifyUserOtp(phone, code, { fullName, email });
    return NextResponse.json({
      ok: true,
      message: "Giriş başarılı.",
      user: result.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Doğrulama işlemi başarısız oldu.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
