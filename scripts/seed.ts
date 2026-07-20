import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  categories,
  menuItems as menuItemsTable,
  productImages,
} from "../db/schema";
import { seedMenuItems } from "./seed-data";

async function main() {
const db = getDb();

const categoryRows = [
  { slug: "signature", name: "İmza Tatlılar", description: "San Sebastian cheesecake'ler ve Bonj imzalı tatlılar.", sortOrder: 1 },
  { slug: "kahvalti", name: "Bonj Brunch", description: "Zengin dolgularla hazırlanan kruvasanlar ve yeni nesil kahvaltılar.", sortOrder: 2 },
  { slug: "kahve", name: "Yeni Nesil Kahve", description: "Klasiklerden üçüncü dalga reçetelere sıcak ve soğuk kahveler.", sortOrder: 3 },
  { slug: "ferah", name: "Ferah", description: "Ev yapımı limonatalar ve ferahlatan soğuk içecekler.", sortOrder: 4 },
];

for (const category of categoryRows) {
  await db
    .insert(categories)
    .values(category)
    .onConflictDoUpdate({
      target: categories.slug,
      set: { name: category.name, description: category.description, sortOrder: category.sortOrder, updatedAt: new Date() },
    });
}

const savedCategories = await db.select().from(categories);
const categoryIds = new Map(savedCategories.map((item) => [item.slug, item.id]));

for (const [index, item] of seedMenuItems.entries()) {
  const categoryId = categoryIds.get(item.category);
  if (!categoryId) continue;

  await db
    .insert(menuItemsTable)
    .values({
      categoryId,
      slug: item.slug,
      name: item.name,
      description: item.description,
      longDescription: item.longDescription,
      allergenInfo: item.allergenInfo,
      estimatedCalories: item.estimatedCalories,
      imageAlt: item.imageAlt,
      priceInKurus: item.priceInKurus,
      badge: item.badge,
      accent: item.accent,
      sortOrder: index + 1,
      isFeatured: item.isFeatured ?? false,
    })
    .onConflictDoUpdate({
      target: menuItemsTable.slug,
      set: {
        categoryId,
        name: item.name,
        description: item.description,
        longDescription: item.longDescription,
        allergenInfo: item.allergenInfo,
        estimatedCalories: item.estimatedCalories,
        imageAlt: item.imageAlt,
        priceInKurus: item.priceInKurus,
        badge: item.badge,
        accent: item.accent,
        sortOrder: index + 1,
        isFeatured: item.isFeatured ?? false,
        updatedAt: new Date(),
      },
    });
}

const savedItems = await db.select().from(menuItemsTable);
const savedItemIds = new Map(savedItems.map((item) => [item.slug, item.id]));

for (const item of seedMenuItems) {
  const menuItemId = savedItemIds.get(item.slug);
  if (!menuItemId) continue;

  const data = await readFile(path.join(process.cwd(), item.imagePath));
  await db
    .insert(productImages)
    .values({
      menuItemId,
      data,
      mimeType: "image/webp",
      sizeInBytes: data.byteLength,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: productImages.menuItemId,
      set: {
        data,
        mimeType: "image/webp",
        sizeInBytes: data.byteLength,
        updatedAt: new Date(),
      },
    });
}

const count = await db
  .select({ slug: menuItemsTable.slug })
  .from(menuItemsTable)
  .where(eq(menuItemsTable.isActive, true));

console.info(`Bonj menüsü hazır: ${count.length} aktif ürün.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
