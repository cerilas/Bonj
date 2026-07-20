import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  categories,
  menuItems as menuItemsTable,
  productImages,
} from "@/db/schema";
import {
  menuItems as fallbackMenuItems,
  type MenuCategory,
  type MenuItem,
} from "@/lib/menu";

const allowedCategories = new Set<MenuCategory>([
  "signature",
  "kahvalti",
  "kahve",
  "ferah",
]);

function categoryFromDatabase(value: string): MenuCategory {
  return allowedCategories.has(value as MenuCategory)
    ? (value as MenuCategory)
    : "signature";
}

export async function getPublicMenuItems(): Promise<MenuItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: menuItemsTable.id,
      slug: menuItemsTable.slug,
      name: menuItemsTable.name,
      description: menuItemsTable.description,
      longDescription: menuItemsTable.longDescription,
      allergenInfo: menuItemsTable.allergenInfo,
      estimatedCalories: menuItemsTable.estimatedCalories,
      imageAlt: menuItemsTable.imageAlt,
      category: categories.slug,
      categoryName: categories.name,
      badge: menuItemsTable.badge,
      accent: menuItemsTable.accent,
      priceInKurus: menuItemsTable.priceInKurus,
      imageId: productImages.id,
      imageUpdatedAt: productImages.updatedAt,
    })
    .from(menuItemsTable)
    .innerJoin(categories, eq(menuItemsTable.categoryId, categories.id))
    .leftJoin(productImages, eq(productImages.menuItemId, menuItemsTable.id))
    .where(
      and(
        eq(menuItemsTable.isActive, true),
        eq(categories.isActive, true),
      ),
    )
    .orderBy(asc(categories.sortOrder), asc(menuItemsTable.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    longDescription: row.longDescription,
    allergenInfo: row.allergenInfo,
    estimatedCalories: row.estimatedCalories,
    imageAlt: row.imageAlt,
    imageUrl: row.imageId
      ? `/api/menu/images/${row.id}?v=${row.imageUpdatedAt?.getTime() ?? 0}`
      : null,
    priceInKurus: row.priceInKurus,
    category: categoryFromDatabase(row.category),
    categoryName: row.categoryName,
    badge: row.badge ?? undefined,
    accent: (["berry", "cream", "coffee", "citrus", "avocado"].includes(
      row.accent,
    )
      ? row.accent
      : "cream") as MenuItem["accent"],
  }));
}

export async function getPublicMenuWithFallback() {
  try {
    const items = await getPublicMenuItems();
    return items.length ? items : fallbackMenuItems;
  } catch {
    console.warn("Menu database is unavailable; using the curated fallback.");
    return fallbackMenuItems;
  }
}
