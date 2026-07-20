import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import { createAdminSession, verifyPassword } from "@/lib/admin-auth";

const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  const key = clientKey(request);
  const now = Date.now();
  const attempt = attempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) {
    return NextResponse.json(
      { error: "Çok fazla deneme. Lütfen 15 dakika sonra tekrar deneyin." },
      { status: 429 },
    );
  }
  if (attempt && attempt.resetAt <= now) attempts.delete(key);

  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  const email = body?.email?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const password = body?.password ?? "";

  if (!email || password.length < 8 || password.length > 200) {
    return NextResponse.json(
      { error: "E-posta veya parola hatalı." },
      { status: 401 },
    );
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    const current = attempts.get(key);
    attempts.set(key, {
      count: (current?.count ?? 0) + 1,
      resetAt: current?.resetAt ?? now + 15 * 60 * 1000,
    });
    return NextResponse.json(
      { error: "E-posta veya parola hatalı." },
      { status: 401 },
    );
  }

  attempts.delete(key);
  await createAdminSession(user.id);
  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, user.id));

  return NextResponse.json({ ok: true });
}
