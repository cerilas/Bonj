import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adminUsers } from "@/db/schema";

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export async function getAdminUsers(): Promise<AdminUser[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: adminUsers.id,
      name: adminUsers.name,
      email: adminUsers.email,
      phone: adminUsers.phone,
      isActive: adminUsers.isActive,
      lastLoginAt: adminUsers.lastLoginAt,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .orderBy(asc(adminUsers.name), asc(adminUsers.email));

  return rows.map((row) => ({
    ...row,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export function normalizeAdminPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("5")) digits = `0${digits}`;
  if (!/^05\d{9}$/.test(digits)) {
    throw new Error("Telefon numarası 05xx xxx xx xx biçiminde olmalıdır.");
  }
  return digits;
}

export async function getAdminUser(id: number) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  return user ?? null;
}
