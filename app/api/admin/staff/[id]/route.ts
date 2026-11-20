import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { staffUsers } from "@/db/schema";
import { getCurrentAdmin, hashPassword } from "@/lib/admin-auth";
import { sendCerilasSms } from "@/lib/cerilas-sms";
import { notificationBaseUrl } from "@/lib/admin-notifications";
import { generateStaffPassword, staffRoleLabel } from "@/lib/staff-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { id } = await context.params;
  const staffId = Number(id);
  if (!Number.isInteger(staffId) || staffId < 1) {
    return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    isActive?: boolean;
    role?: string;
    resetPassword?: boolean;
  };

  const db = getDb();
  const [staff] = await db
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.id, staffId))
    .limit(1);

  if (!staff) {
    return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
  }

  if (body.resetPassword) {
    const rawPassword = generateStaffPassword(9);
    const passwordHash = hashPassword(rawPassword);

    await db
      .update(staffUsers)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(staffUsers.id, staffId));

    const siteUrl = notificationBaseUrl(request);
    const smsMessage = `Merhaba ${staff.fullName}, Bonj Cake Story ${staffRoleLabel(staff.role)} yeni giriş şifreniz: ${rawPassword} · Giriş: ${siteUrl}/garson`;

    let smsSent = false;
    let smsError: string | null = null;
    try {
      await sendCerilasSms({ phone: staff.phone, message: smsMessage });
      smsSent = true;
    } catch (err) {
      smsError = err instanceof Error ? err.message : "SMS gönderilemedi.";
    }

    return NextResponse.json({ ok: true, smsSent, smsError });
  }

  const updates: Partial<typeof staffUsers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof body.isActive === "boolean") {
    updates.isActive = body.isActive;
  }
  if (body.role === "garson" || body.role === "komi") {
    updates.role = body.role;
  }

  await db.update(staffUsers).set(updates).where(eq(staffUsers.id, staffId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { id } = await context.params;
  const staffId = Number(id);
  if (!Number.isInteger(staffId) || staffId < 1) {
    return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
  }

  const db = getDb();
  await db.delete(staffUsers).where(eq(staffUsers.id, staffId));
  return NextResponse.json({ ok: true });
}
