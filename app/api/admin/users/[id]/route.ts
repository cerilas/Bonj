import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";
import { getCurrentAdmin, hashPassword } from "@/lib/admin-auth";
import { getAdminUser, normalizeAdminPhone } from "@/lib/admin-users";

function userIdFrom(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR").slice(0, 180);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function hasAnotherActiveAdmin(excludedId: number) {
  const db = getDb();
  const [result] = await db
    .select({ value: count(adminUsers.id) })
    .from(adminUsers)
    .where(eq(adminUsers.isActive, true));
  const activeCount = Number(result?.value ?? 0);
  const target = await getAdminUser(excludedId);
  return !target?.isActive || activeCount > 1;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentAdmin = await getCurrentAdmin();
  if (!currentAdmin) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  const { id } = await context.params;
  const userId = userIdFrom(id);
  if (!userId) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  const existing = await getAdminUser(userId);
  if (!existing) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; email?: unknown; phone?: unknown; password?: unknown; isActive?: unknown }
    | null;
  const name = String(body?.name ?? "").trim().slice(0, 120);
  const email = normalizeEmail(body?.email);
  let phone: string | null;
  const password = String(body?.password ?? "");
  const isActive = body?.isActive !== false;

  try {
    phone = normalizeAdminPhone(body?.phone);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Telefon numarası geçersiz." }, { status: 400 });
  }

  if (name.length < 2) {
    return NextResponse.json({ error: "Ad soyad en az 2 karakter olmalıdır." }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  }
  if (password && (password.length < 8 || password.length > 200)) {
    return NextResponse.json({ error: "Yeni parola en az 8 karakter olmalıdır." }, { status: 400 });
  }
  if (userId === currentAdmin.id && !isActive) {
    return NextResponse.json({ error: "Kendi hesabınızı pasife alamazsınız." }, { status: 409 });
  }
  if (existing.isActive && !isActive && !(await hasAnotherActiveAdmin(userId))) {
    return NextResponse.json({ error: "Son aktif yönetici pasife alınamaz." }, { status: 409 });
  }

  try {
    const db = getDb();
    const changes: {
      name: string;
      email: string;
      phone: string | null;
      isActive: boolean;
      updatedAt: Date;
      passwordHash?: string;
    } = {
      name,
      email,
      phone,
      isActive,
      updatedAt: new Date(),
    };
    if (password) changes.passwordHash = hashPassword(password);

    await db.update(adminUsers).set(changes).where(eq(adminUsers.id, userId));

    if (password || !isActive) {
      await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
    }

    return NextResponse.json({ ok: true, signedOut: password && userId === currentAdmin.id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanılıyor." }, { status: 409 });
    }
    return NextResponse.json({ error: "Kullanıcı güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const currentAdmin = await getCurrentAdmin();
  if (!currentAdmin) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { id } = await context.params;
  const userId = userIdFrom(id);
  if (!userId) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  if (userId === currentAdmin.id) {
    return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz." }, { status: 409 });
  }

  const existing = await getAdminUser(userId);
  if (!existing) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  if (existing.isActive && !(await hasAnotherActiveAdmin(userId))) {
    return NextResponse.json({ error: "Son aktif yönetici silinemez." }, { status: 409 });
  }

  const db = getDb();
  await db.delete(adminUsers).where(eq(adminUsers.id, userId));
  return NextResponse.json({ ok: true });
}
