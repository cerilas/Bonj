import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { staffUsers } from "@/db/schema";
import { verifyPassword } from "@/lib/admin-auth";
import { normalizeSmsPhone } from "@/lib/cerilas-sms";
import { createStaffSession } from "@/lib/staff-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      phone?: string;
      password?: string;
    };

    const password = String(body.password ?? "").trim();
    if (!password) {
      return NextResponse.json({ error: "Şifre zorunludur." }, { status: 400 });
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeSmsPhone(String(body.phone ?? ""));
    } catch {
      return NextResponse.json({ error: "Geçerli bir telefon numarası girin." }, { status: 400 });
    }

    const db = getDb();
    const [staff] = await db
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.phone, normalizedPhone))
      .limit(1);

    if (!staff || !staff.isActive || !verifyPassword(password, staff.passwordHash)) {
      return NextResponse.json(
        { error: "Telefon numarası veya şifre hatalı." },
        { status: 401 },
      );
    }

    await createStaffSession(staff.id);
    await db
      .update(staffUsers)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(staffUsers.id, staff.id));

    return NextResponse.json({
      ok: true,
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        phone: staff.phone,
        role: staff.role,
      },
    });
  } catch (error) {
    console.error("[staff/login] Giriş başarısız:", error);
    return NextResponse.json({ error: "Giriş yapılamadı." }, { status: 500 });
  }
}
