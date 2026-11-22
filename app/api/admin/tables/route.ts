import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { cafeTables } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdminTablesSnapshot } from "@/lib/admin-tables";
import { getTableOperator } from "@/lib/staff-auth";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    if (!(await getTableOperator())) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
    const snapshot = await getAdminTablesSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[admin/tables] Masalar yüklenemedi.", error);
    return NextResponse.json(
      { error: "Masalar yüklenemedi." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await getCurrentAdmin())) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      code?: string;
      name?: string;
      zone?: string;
      capacity?: number;
    };

    const name = String(body.name ?? "").trim().slice(0, 60);
    const code = String(body.code ?? "").trim().slice(0, 20) || name.replace(/\s+/g, "");
    const zone = String(body.zone ?? "Salon").trim().slice(0, 40) || "Salon";
    const capacity = Math.max(1, Math.min(30, Number(body.capacity ?? 4) || 4));

    if (!name || !code) {
      return NextResponse.json(
        { error: "Masa adı ve kodu zorunludur." },
        { status: 400 },
      );
    }

    const db = getDb();
    const existing = await db
      .select({ sortOrder: cafeTables.sortOrder })
      .from(cafeTables)
      .orderBy(asc(cafeTables.sortOrder));
    const maxSort = existing.length ? Math.max(...existing.map((e) => e.sortOrder)) : 0;

    const [created] = await db
      .insert(cafeTables)
      .values({
        code,
        name,
        zone,
        capacity,
        sortOrder: maxSort + 1,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ ok: true, table: created }, { status: 201 });
  } catch (error) {
    console.error("[admin/tables] Masa oluşturulamadı.", error);
    return NextResponse.json(
      { error: "Masa oluşturulamadı (masa kodu zaten kayıtlı olabilir)." },
      { status: 400 },
    );
  }
}
