import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { staffUsers } from "@/db/schema";
import { getCurrentAdmin, hashPassword } from "@/lib/admin-auth";
import { normalizeSmsPhone, sendCerilasSms } from "@/lib/cerilas-sms";
import { notificationBaseUrl } from "@/lib/admin-notifications";
import { generateStaffPassword, staffRoleLabel } from "@/lib/staff-auth";

export async function GET() {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: staffUsers.id,
      fullName: staffUsers.fullName,
      phone: staffUsers.phone,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
      lastLoginAt: staffUsers.lastLoginAt,
      createdAt: staffUsers.createdAt,
    })
    .from(staffUsers)
    .orderBy(desc(staffUsers.createdAt));

  return NextResponse.json({ staff: rows });
}

export async function POST(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    fullName?: string;
    phone?: string;
    role?: string;
  };

  const fullName = String(body.fullName ?? "").trim().slice(0, 120);
  const role = body.role === "komi" ? "komi" : "garson";

  if (!fullName) {
    return NextResponse.json({ error: "İsim soyisim zorunludur." }, { status: 400 });
  }

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeSmsPhone(String(body.phone ?? ""));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Geçerli bir telefon numarası girin." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: staffUsers.id })
    .from(staffUsers)
    .where(eq(staffUsers.phone, normalizedPhone))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Bu telefon numarası ile kayıtlı bir personel zaten var." },
      { status: 400 },
    );
  }

  const rawPassword = generateStaffPassword(9);
  const passwordHash = hashPassword(rawPassword);

  const [created] = await db
    .insert(staffUsers)
    .values({
      fullName,
      phone: normalizedPhone,
      role,
      passwordHash,
      isActive: true,
    })
    .returning({
      id: staffUsers.id,
      fullName: staffUsers.fullName,
      phone: staffUsers.phone,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
      lastLoginAt: staffUsers.lastLoginAt,
      createdAt: staffUsers.createdAt,
    });

  const siteUrl = notificationBaseUrl(request);
  const smsMessage = `Merhaba ${fullName}, Bonj Cake Story ${staffRoleLabel(role)} paneli giriş şifreniz: ${rawPassword} · Giriş: ${siteUrl}/garson`;

  let smsSent = false;
  let smsError: string | null = null;
  try {
    await sendCerilasSms({ phone: normalizedPhone, message: smsMessage });
    smsSent = true;
  } catch (err) {
    smsError = err instanceof Error ? err.message : "SMS gönderilemedi.";
  }

  return NextResponse.json(
    {
      ok: true,
      staff: created,
      smsSent,
      smsError,
    },
    { status: 201 },
  );
}
