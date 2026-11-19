import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/user-auth";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      phone: users.phone,
      fullName: users.fullName,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, current.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PUT(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (fullName.length > 120) {
      return NextResponse.json(
        { error: "Ad Soyad en fazla 120 karakter olabilir." },
        { status: 400 },
      );
    }
    if (email && (!email.includes("@") || !email.includes(".") || email.length > 180)) {
      return NextResponse.json(
        { error: "Lütfen geçerli bir e-posta adresi girin." },
        { status: 400 },
      );
    }

    const db = getDb();
    const [updated] = await db
      .update(users)
      .set({
        fullName: fullName || null,
        email: email || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, current.id))
      .returning({
        id: users.id,
        phone: users.phone,
        fullName: users.fullName,
        email: users.email,
      });

    return NextResponse.json({
      ok: true,
      message: "Profil bilgileriniz başarıyla güncellendi.",
      user: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profil güncellenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
