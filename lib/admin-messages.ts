import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contactMessages } from "@/db/schema";

export type AdminContactMessage = {
  id: number;
  topic: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  status: string;
  createdAt: string;
};

export type AdminMessagePage = {
  messages: AdminContactMessage[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { total: number; new: number; resolved: number };
};

export async function getAdminMessage(id: number): Promise<AdminContactMessage | null> {
  const db = getDb();
  const [row] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
  if (!row) return null;

  return {
    id: row.id,
    topic: row.topic,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone ?? "",
    company: row.company ?? "",
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getAdminMessages({
  page = 1,
  pageSize = 10,
  status = "all",
}: {
  page?: number;
  pageSize?: number;
  status?: "all" | "new" | "read" | "resolved";
} = {}): Promise<AdminMessagePage> {
  const db = getDb();
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const whereClause = status === "all" ? undefined : eq(contactMessages.status, status);
  const [[filtered], [summary]] = await Promise.all([
    db.select({ value: count(contactMessages.id) }).from(contactMessages).where(whereClause),
    db.select({
      total: count(contactMessages.id),
      newCount: sql<number>`count(*) filter (where ${contactMessages.status} = 'new')`,
      resolved: sql<number>`count(*) filter (where ${contactMessages.status} = 'resolved')`,
    }).from(contactMessages),
  ]);
  const total = Number(filtered?.value ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.floor(page)));
  const rows = await db
    .select()
    .from(contactMessages)
    .where(whereClause)
    .orderBy(desc(contactMessages.createdAt))
    .limit(safePageSize)
    .offset((safePage - 1) * safePageSize);

  return {
    messages: rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone ?? "",
      company: row.company ?? "",
      message: row.message,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: { page: safePage, pageSize: safePageSize, total, totalPages },
    summary: {
      total: Number(summary?.total ?? 0),
      new: Number(summary?.newCount ?? 0),
      resolved: Number(summary?.resolved ?? 0),
    },
  };
}
