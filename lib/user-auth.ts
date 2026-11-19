import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { userSessions, users } from "@/db/schema";

export const USER_COOKIE_NAME = "bonj_user_session";
// 1 full year session duration - remains active until explicit logout
export const USER_SESSION_DURATION_SECONDS = 365 * 24 * 60 * 60;

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type UserIdentity = {
  id: number;
  phone: string;
  fullName: string | null;
  email: string | null;
};

export async function getCurrentUser(): Promise<UserIdentity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      phone: users.phone,
      fullName: users.fullName,
      email: users.email,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(
      and(
        eq(userSessions.tokenHash, digestToken(token)),
        gt(userSessions.expiresAt, new Date()),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function createUserSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + USER_SESSION_DURATION_SECONDS * 1000);
  const db = getDb();

  await db.insert(userSessions).values({
    userId,
    tokenHash: digestToken(token),
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_DURATION_SECONDS,
  });

  return token;
}

export async function destroyUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;

  if (token) {
    const db = getDb();
    await db
      .delete(userSessions)
      .where(eq(userSessions.tokenHash, digestToken(token)));
  }

  cookieStore.set(USER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
