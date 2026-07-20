import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, categoryImages, menuItems, productImages } from "@/db/schema";

export type AdminProduct = {
  id: number;
  categoryId: number;
  categoryName: string;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  allergenInfo: string;
  estimatedCalories: number | null;
  imageAlt: string;
  priceInKurus: number | null;
  badge: string;
  accent: string;
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
  imageUrl: string | null;
  updatedAt: string;
};

export type AdminCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageAlt: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  imageUrl: string | null;
  updatedAt: string;
};

export type AdminProductPage = {
  products: AdminProduct[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    active: number;
    passive: number;
  };
};

export async function getAdminProducts({
  page = 1,
  pageSize = 10,
  query = "",
  status = "all",
}: {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: "all" | "active" | "passive";
} = {}): Promise<AdminProductPage> {
  const db = getDb();
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const normalizedQuery = query.trim().slice(0, 120);
  const filters = [];
  if (normalizedQuery) {
    filters.push(
      or(
        ilike(menuItems.name, `%${normalizedQuery}%`),
        ilike(categories.name, `%${normalizedQuery}%`),
      ),
    );
  }
  if (status === "active") filters.push(eq(menuItems.isActive, true));
  if (status === "passive") filters.push(eq(menuItems.isActive, false));
  const whereClause = filters.length ? and(...filters) : undefined;

  const [[filteredCount], [summaryRow]] = await Promise.all([
    db
      .select({ value: count(menuItems.id) })
      .from(menuItems)
      .innerJoin(categories, eq(menuItems.categoryId, categories.id))
      .where(whereClause),
    db
      .select({
        total: count(menuItems.id),
        active: sql<number>`count(*) filter (where ${menuItems.isActive} = true)`,
      })
      .from(menuItems),
  ]);
  const total = Number(filteredCount?.value ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.floor(page)));

  const rows = await db
    .select({
      id: menuItems.id,
      categoryId: menuItems.categoryId,
      categoryName: categories.name,
      slug: menuItems.slug,
      name: menuItems.name,
      description: menuItems.description,
      longDescription: menuItems.longDescription,
      allergenInfo: menuItems.allergenInfo,
      estimatedCalories: menuItems.estimatedCalories,
      imageAlt: menuItems.imageAlt,
      priceInKurus: menuItems.priceInKurus,
      badge: menuItems.badge,
      accent: menuItems.accent,
      sortOrder: menuItems.sortOrder,
      isFeatured: menuItems.isFeatured,
      isActive: menuItems.isActive,
      imageId: productImages.id,
      imageUpdatedAt: productImages.updatedAt,
      updatedAt: menuItems.updatedAt,
    })
    .from(menuItems)
    .innerJoin(categories, eq(menuItems.categoryId, categories.id))
    .leftJoin(productImages, eq(productImages.menuItemId, menuItems.id))
    .where(whereClause)
    .orderBy(asc(categories.sortOrder), asc(menuItems.sortOrder), desc(menuItems.id))
    .limit(safePageSize)
    .offset((safePage - 1) * safePageSize);

  const products = rows.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    slug: row.slug,
    name: row.name,
    shortDescription: row.description,
    longDescription: row.longDescription ?? "",
    allergenInfo: row.allergenInfo ?? "",
    estimatedCalories: row.estimatedCalories,
    imageAlt: row.imageAlt ?? "",
    priceInKurus: row.priceInKurus,
    badge: row.badge ?? "",
    accent: row.accent,
    sortOrder: row.sortOrder,
    isFeatured: row.isFeatured,
    isActive: row.isActive,
    imageUrl: row.imageId
      ? `/api/menu/images/${row.id}?v=${row.imageUpdatedAt?.getTime() ?? 0}`
      : null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  const summaryTotal = Number(summaryRow?.total ?? 0);
  const summaryActive = Number(summaryRow?.active ?? 0);
  return {
    products,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages,
    },
    summary: {
      total: summaryTotal,
      active: summaryActive,
      passive: summaryTotal - summaryActive,
    },
  };
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const db = getDb();
  const [rows, productCounts] = await Promise.all([
    db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageAlt: categories.imageAlt,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      imageId: categoryImages.id,
      imageUpdatedAt: categoryImages.updatedAt,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .leftJoin(categoryImages, eq(categoryImages.categoryId, categories.id))
    .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select({ categoryId: menuItems.categoryId, value: count(menuItems.id) })
      .from(menuItems)
      .groupBy(menuItems.categoryId),
  ]);
  const countsByCategory = new Map(
    productCounts.map((item) => [item.categoryId, Number(item.value)]),
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    imageAlt: row.imageAlt ?? "",
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    productCount: countsByCategory.get(row.id) ?? 0,
    imageUrl: row.imageId
      ? `/api/menu/category-images/${row.id}?v=${row.imageUpdatedAt?.getTime() ?? 0}`
      : null,
    updatedAt: row.updatedAt.toISOString(),
  }));
}
