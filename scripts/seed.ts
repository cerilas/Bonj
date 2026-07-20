import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  categories,
  categoryImages,
  menuItems as menuItemsTable,
  productImages,
} from "../db/schema";
import { seedMenuItems } from "./seed-data";

async function main() {
const db = getDb();

const categoryRows = [
  { slug: "signature", name: "Cheesecake & İmza", description: "San Sebastian yorumları ve Bonj imzalı cheesecake seçkisi.", imageAlt: "Bonj cheesecake ve imza tatlı seçkisi", imagePath: "public/images/menu/san-sebastian.webp", sortOrder: 1 },
  { slug: "tatli", name: "Tatlı & Fırın", description: "Günlük fırından cookie, brownie ve modern pastane tatlıları.", imageAlt: "Brownie, cookie ve modern fırın tatlıları", imagePath: "public/images/menu/bonj-firin-tatlilari.webp", sortOrder: 2 },
  { slug: "kahvalti", name: "Brunch & Kruvasan", description: "Zengin dolgulu kruvasanlar, sıcak tabaklar ve yeni nesil kahvaltılar.", imageAlt: "Bonj brunch ve zengin kahvaltı tabağı", imagePath: "public/images/menu/bonj-kahvalti-tabagi.webp", sortOrder: 3 },
  { slug: "bowl", name: "Bowl & Hafif", description: "Meyveli, proteinli ve dengeli kahvaltı kâseleri.", imageAlt: "Meyve, granola ve açaí içeren kahvaltı bowl", imagePath: "public/images/menu/acai-bowl.webp", sortOrder: 4 },
  { slug: "kahve", name: "Sıcak Kahveler", description: "Espresso klasiklerinden üçüncü dalga demlemelere sıcak kahveler.", imageAlt: "Latte artlı sıcak kahve seçkisi", imagePath: "public/images/menu/flat-white.webp", sortOrder: 5 },
  { slug: "soguk-kahve", name: "Soğuk Kahveler", description: "Cold brew, iced latte ve yeni nesil buzlu kahve reçeteleri.", imageAlt: "Buzlu ve katmanlı soğuk kahve seçkisi", imagePath: "public/images/menu/iced-latte.webp", sortOrder: 6 },
  { slug: "ferah", name: "Limonata & Soğuk İçecekler", description: "Ev yapımı limonatalar, cold tea ve gazlı imza içecekler.", imageAlt: "Meyveli ev yapımı limonata ve soğuk içecekler", imagePath: "public/images/menu/cilekli-limonata.webp", sortOrder: 7 },
];

for (const category of categoryRows) {
  await db
    .insert(categories)
    .values({
      slug: category.slug,
      name: category.name,
      description: category.description,
      imageAlt: category.imageAlt,
      sortOrder: category.sortOrder,
    })
    .onConflictDoUpdate({
      target: categories.slug,
      set: { name: category.name, description: category.description, imageAlt: category.imageAlt, sortOrder: category.sortOrder, updatedAt: new Date() },
    });
}

const savedCategories = await db.select().from(categories);
const categoryIds = new Map(savedCategories.map((item) => [item.slug, item.id]));

for (const category of categoryRows) {
  const categoryId = categoryIds.get(category.slug);
  if (!categoryId) continue;

  const data = await readFile(path.join(process.cwd(), category.imagePath));
  await db
    .insert(categoryImages)
    .values({
      categoryId,
      data,
      mimeType: "image/webp",
      sizeInBytes: data.byteLength,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: categoryImages.categoryId });
}

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
