import { NextResponse } from "next/server";
import { requestUserOtp } from "@/lib/user-otp";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const phone = String(body.phone ?? "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Lütfen telefon numaranızı girin." },
        { status: 400 },
      );
    }

    const result = await requestUserOtp(phone);
    return NextResponse.json({
      ok: true,
      message: result.isNewUser
        ? "Yeni üyelik için doğrulama kodu telefonunuza gönderildi."
        : "Giriş doğrulama kodunuz telefonunuza gönderildi.",
      phone: result.phone,
      isNewUser: result.isNewUser,
      existingName: result.existingName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Doğrulama kodu gönderilemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
