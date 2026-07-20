import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { cateringRequests } from "@/db/schema";

export type AdminCateringRequest = {
  id: number;
  requestNumber: string;
  eventType: string;
  fullName: string;
  phone: string;
  email: string;
  company: string;
  eventAt: string;
  guestCount: number;
  venueName: string;
  venueAddress: string;
  venueSetting: string;
  serviceStyle: string;
  menuInterests: string[];
  dietaryNeeds: string;
  budgetRange: string;
  preferredContact: string;
  notes: string;
  status: string;
  createdAt: string;
};

export type AdminCateringPage = {
  requests: AdminCateringRequest[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { total: number; new: number; active: number };
};

function parseMenuInterests(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function adminCateringRequest(row: typeof cateringRequests.$inferSelect): AdminCateringRequest {
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    eventType: row.eventType,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email ?? "",
    company: row.company ?? "",
    eventAt: row.eventAt.toISOString(),
    guestCount: row.guestCount,
    venueName: row.venueName ?? "",
    venueAddress: row.venueAddress,
    venueSetting: row.venueSetting,
    serviceStyle: row.serviceStyle,
    menuInterests: parseMenuInterests(row.menuInterests),
    dietaryNeeds: row.dietaryNeeds ?? "",
    budgetRange: row.budgetRange ?? "",
    preferredContact: row.preferredContact,
    notes: row.notes ?? "",
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getAdminCateringRequest(id: number): Promise<AdminCateringRequest | null> {
  const db = getDb();
  const [row] = await db.select().from(cateringRequests).where(eq(cateringRequests.id, id)).limit(1);
  return row ? adminCateringRequest(row) : null;
}

export async function getAdminCateringRequests({
  page = 1,
  pageSize = 10,
  status = "all",
}: {
  page?: number;
  pageSize?: number;
  status?: string;
} = {}): Promise<AdminCateringPage> {
  const db = getDb();
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const whereClause = status === "all" ? undefined : eq(cateringRequests.status, status);
  const [[filtered], [summary]] = await Promise.all([
    db.select({ value: count(cateringRequests.id) }).from(cateringRequests).where(whereClause),
    db.select({
      total: count(cateringRequests.id),
      newCount: sql<number>`count(*) filter (where ${cateringRequests.status} = 'new')`,
      activeCount: sql<number>`count(*) filter (where ${cateringRequests.status} in ('contacted', 'quoted', 'confirmed'))`,
    }).from(cateringRequests),
  ]);
  const total = Number(filtered?.value ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.floor(page)));
  const rows = await db.select().from(cateringRequests).where(whereClause)
    .orderBy(desc(cateringRequests.createdAt)).limit(safePageSize).offset((safePage - 1) * safePageSize);

  return {
    requests: rows.map(adminCateringRequest),
    pagination: { page: safePage, pageSize: safePageSize, total, totalPages },
    summary: {
      total: Number(summary?.total ?? 0),
      new: Number(summary?.newCount ?? 0),
      active: Number(summary?.activeCount ?? 0),
    },
  };
}
