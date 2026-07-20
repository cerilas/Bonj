import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import { getCurrentAdmin, hashPassword } from "@/lib/admin-auth";
import { getAdminUsers, normalizeAdminPhone } from "@/lib/admin-users";

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR").slice(0, 180);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  return NextResponse.json({ users: await getAdminUsers(), currentUserId: admin.id });
}

export async function POST(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; email?: unknown; phone?: unknown; password?: unknown; isActive?: unknown }
    | null;
  const name = String(body?.name ?? "").trim().slice(0, 120);
  const email = normalizeEmail(body?.email);
  let phone: string | null;
  const password = String(body?.password ?? "");

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
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Parola en az 8 karakter olmalıdır." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [created] = await db
      .insert(adminUsers)
      .values({
        name,
        email,
        phone,
        passwordHash: hashPassword(password),
        isActive: body?.isActive !== false,
        updatedAt: new Date(),
      })
      .returning({ id: adminUsers.id });

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanılıyor." }, { status: 409 });
    }
    return NextResponse.json({ error: "Kullanıcı oluşturulamadı." }, { status: 500 });
  }
}
