import { and, desc, eq, gt, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { userOtps, users } from "@/db/schema";
import { isCerilasSmsConfigured, normalizeSmsPhone, sendCerilasSms } from "@/lib/cerilas-sms";
import { createUserSession } from "@/lib/user-auth";

export const OTP_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown between requests

export async function requestUserOtp(rawPhone: string) {
  const normalizedPhone = normalizeSmsPhone(rawPhone);
  const db = getDb();

  // Check cooldown
  const oneMinuteAgo = new Date(Date.now() - OTP_COOLDOWN_MS);
  const [recentOtp] = await db
    .select()
    .from(userOtps)
    .where(
      and(
        eq(userOtps.phone, normalizedPhone),
        gte(userOtps.createdAt, oneMinuteAgo),
      ),
    )
    .orderBy(desc(userOtps.createdAt))
    .limit(1);

  if (recentOtp) {
    const secondsRemaining = Math.ceil(
      (recentOtp.createdAt.getTime() + OTP_COOLDOWN_MS - Date.now()) / 1000,
    );
    throw new Error(
      `Lütfen yeni bir doğrulama kodu istemeden önce ${Math.max(1, secondsRemaining)} saniye bekleyin.`,
    );
  }

  // Generate 6-digit secure code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_VALIDITY_MS);

  await db.insert(userOtps).values({
    phone: normalizedPhone,
    code,
    attempts: 0,
    expiresAt,
    isUsed: false,
  });

  // Check if user already exists in DB
  const [existingUser] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
    })
    .from(users)
    .where(eq(users.phone, normalizedPhone))
    .limit(1);

  const isNewUser = !existingUser;

  // Always log OTP for development and audit verification
  console.log(`\n========================================`);
  console.log(`[BONJ OTP SİSTEMİ]`);
  console.log(`Telefon: 0${normalizedPhone}`);
  console.log(`Durum: ${isNewUser ? "Yeni Müşteri Kaydı" : `Mevcut Müşteri (${existingUser.fullName || "İsimsiz"})`}`);
  console.log(`Doğrulama Kodu: ${code}`);
  console.log(`Geçerlilik: 5 dakika`);
  console.log(`========================================\n`);

  let smsSent = false;
  if (isCerilasSmsConfigured()) {
    try {
      await sendCerilasSms({
        phone: normalizedPhone,
        message: `Bonj Cake Story giriş doğrulama kodunuz: ${code}. Güvenliğiniz için bu kodu kimseyle paylaşmayınız.`,
      });
      smsSent = true;
    } catch (err) {
      console.error("[BONJ OTP] SMS servisi üzerinden gönderilemedi:", err);
      const msg = err instanceof Error ? err.message : "SMS iletimi başarısız.";
      throw new Error(`SMS gönderilemedi: ${msg}`);
    }
  }

  return {
    ok: true,
    phone: normalizedPhone,
    isNewUser,
    existingName: existingUser?.fullName ?? null,
    smsSent,
  };
}

export async function verifyUserOtp(
  rawPhone: string,
  inputCode: string,
  metadata?: { fullName?: string; email?: string },
) {
  const normalizedPhone = normalizeSmsPhone(rawPhone);
  const cleanCode = inputCode.trim();

  if (!cleanCode || cleanCode.length !== 6) {
    throw new Error("Lütfen 6 haneli doğrulama kodunu eksiksiz girin.");
  }

  const db = getDb();
  const [activeOtp] = await db
    .select()
    .from(userOtps)
    .where(
      and(
        eq(userOtps.phone, normalizedPhone),
        eq(userOtps.isUsed, false),
        gt(userOtps.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(userOtps.createdAt))
    .limit(1);

  if (!activeOtp) {
    throw new Error("Doğrulama kodunun süresi dolmuş veya geçersiz. Lütfen yeni bir kod isteyin.");
  }

  if (activeOtp.attempts >= 5) {
    throw new Error("Çok fazla hatalı deneme yaptınız. Lütfen yeni bir kod isteyin.");
  }

  if (activeOtp.code !== cleanCode) {
    await db
      .update(userOtps)
      .set({ attempts: activeOtp.attempts + 1 })
      .where(eq(userOtps.id, activeOtp.id));

    const remainingAttempts = 5 - (activeOtp.attempts + 1);
    throw new Error(
      remainingAttempts > 0
        ? `Girdiğiniz kod hatalı. Kalan deneme hakkı: ${remainingAttempts}`
        : "Hatalı kod girdiniz. Deneme hakkınız bitti, lütfen yeni kod isteyin.",
    );
  }

  // Mark OTP as used
  await db
    .update(userOtps)
    .set({ isUsed: true })
    .where(eq(userOtps.id, activeOtp.id));

  // Find or create user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.phone, normalizedPhone))
    .limit(1);

  let userId = existingUser?.id;

  if (!existingUser) {
    const [newUser] = await db
      .insert(users)
      .values({
        phone: normalizedPhone,
        fullName: metadata?.fullName?.trim() || null,
        email: metadata?.email?.trim().toLowerCase() || null,
        isActive: true,
      })
      .returning({ id: users.id });
    userId = newUser.id;
  } else if (metadata?.fullName || metadata?.email) {
    // Optionally update user name or email if previously empty
    const updates: { fullName?: string; email?: string } = {};
    if (!existingUser.fullName && metadata.fullName?.trim()) {
      updates.fullName = metadata.fullName.trim();
    }
    if (!existingUser.email && metadata.email?.trim()) {
      updates.email = metadata.email.trim().toLowerCase();
    }
    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, existingUser.id));
    }
  }

  // Create persistent session (1 year)
  await createUserSession(userId);

  const [currentUser] = await db
    .select({
      id: users.id,
      phone: users.phone,
      fullName: users.fullName,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return { ok: true, user: currentUser };
}
