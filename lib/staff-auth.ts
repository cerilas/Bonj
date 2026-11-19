import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { staffSessions, staffUsers, tableActivityLogs } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";

const STAFF_COOKIE_NAME = "bonj_staff_session";
const STAFF_SESSION_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateStaffPassword(length = 9): string {
  const len = Math.max(8, Math.min(10, length));
  let result = "";
  for (let i = 0; i < len; i += 1) {
    result += PASSWORD_ALPHABET[randomInt(0, PASSWORD_ALPHABET.length)];
  }
  return result;
}

export type StaffIdentity = {
  id: number;
  fullName: string;
  phone: string;
  role: "garson" | "komi";
};

export type TableOperator = {
  actorType: "admin" | "staff";
  actorId: number;
  actorName: string;
  actorRole: "admin" | "garson" | "komi";
};

export function staffRoleLabel(role: string): string {
  if (role === "garson") return "Garson";
  if (role === "komi") return "Komi";
  if (role === "admin") return "Yönetici";
  return role;
}

export async function getCurrentStaff(): Promise<StaffIdentity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({
      id: staffUsers.id,
      fullName: staffUsers.fullName,
      phone: staffUsers.phone,
      role: staffUsers.role,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffSessions.staffId, staffUsers.id))
    .where(
      and(
        eq(staffSessions.tokenHash, digestToken(token)),
        gt(staffSessions.expiresAt, new Date()),
        eq(staffUsers.isActive, true),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    role: row.role === "komi" ? "komi" : "garson",
  };
}

export async function createStaffSession(staffId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + STAFF_SESSION_SECONDS * 1000);
  const db = getDb();

  await db.insert(staffSessions).values({
    staffId,
    tokenHash: digestToken(token),
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_SESSION_SECONDS,
  });
}

export async function destroyStaffSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
  if (token) {
    const db = getDb();
    await db
      .delete(staffSessions)
      .where(eq(staffSessions.tokenHash, digestToken(token)));
  }
  cookieStore.delete(STAFF_COOKIE_NAME);
}

export async function getTableOperator(): Promise<TableOperator | null> {
  const admin = await getCurrentAdmin();
  if (admin) {
    return {
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      actorRole: "admin",
    };
  }
  const staff = await getCurrentStaff();
  if (staff) {
    return {
      actorType: "staff",
      actorId: staff.id,
      actorName: staff.fullName,
      actorRole: staff.role,
    };
  }
  return null;
}

export async function logTableActivity({
  tableId,
  sessionId = null,
  operator,
  action,
  summary,
}: {
  tableId: number;
  sessionId?: number | null;
  operator: TableOperator;
  action: "open" | "add_item" | "update_item" | "remove_item" | "move" | "close" | "update_meta";
  summary: string;
}) {
  const db = getDb();
  await db.insert(tableActivityLogs).values({
    tableId,
    sessionId,
    actorType: operator.actorType,
    actorId: operator.actorId,
    actorName: operator.actorName,
    actorRole: operator.actorRole,
    action,
    summary,
  });
}
