import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";
import { buildAdminAccessSms } from "@/lib/admin-access-sms";
import { getCurrentAdmin, hashPassword } from "@/lib/admin-auth";
import { notificationBaseUrl } from "@/lib/admin-notifications";
import { getAdminUser } from "@/lib/admin-users";
import { sendCerilasSms } from "@/lib/cerilas-sms";

const recentAccessMessages = new Map<string, number>();
const passwordAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function temporaryPassword() {
  let suffix = "";
  for (let index = 0; index < 8; index += 1) {
    suffix += passwordAlphabet[randomInt(0, passwordAlphabet.length)];
  }
  return `Bnj!${suffix}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentAdmin = await getCurrentAdmin();
  if (!currentAdmin) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  const user = await getAdminUser(userId);
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  if (!user.isActive) {
    return NextResponse.json({ error: "SMS göndermeden önce kullanıcı erişimini aktifleştirin." }, { status: 409 });
  }
  if (!user.phone) {
    return NextResponse.json({ error: "SMS göndermek için kullanıcıya telefon numarası ekleyin." }, { status: 400 });
  }

  const throttleKey = `${currentAdmin.id}:${userId}`;
  const lastSentAt = recentAccessMessages.get(throttleKey) ?? 0;
  if (Date.now() - lastSentAt < 30_000) {
    return NextResponse.json(
      { error: "Yeni giriş SMS’i göndermek için 30 saniye bekleyin." },
      { status: 429 },
    );
  }

  const password = temporaryPassword();
  const passwordHash = hashPassword(password);
  const db = getDb();
  await db
    .update(adminUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(adminUsers.id, userId));

  const loginUrl = new URL("/b/a", notificationBaseUrl(request)).toString();
  try {
    await sendCerilasSms({
      phone: user.phone,
      message: buildAdminAccessSms({ loginUrl, email: user.email, password }),
    });
  } catch (error) {
    console.error(
      "[admin/users/access-sms] SMS gönderilemedi:",
      error instanceof Error ? error.message : "Bilinmeyen hata",
    );
    await db
      .update(adminUsers)
      .set({ passwordHash: user.passwordHash, updatedAt: new Date() })
      .where(and(eq(adminUsers.id, userId), eq(adminUsers.passwordHash, passwordHash)));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Giriş bilgileri SMS ile gönderilemedi." },
      { status: 400 },
    );
  }

  await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
  recentAccessMessages.set(throttleKey, Date.now());

  return NextResponse.json({
    ok: true,
    signedOut: userId === currentAdmin.id,
    message: `Giriş bilgileri ${user.phone} numarasına gönderildi.`,
  });
}
