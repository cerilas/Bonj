import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { productImages } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const menuItemId = Number(id);
  if (!Number.isInteger(menuItemId)) {
    return new Response("Not found", { status: 404 });
  }

  const db = getDb();
  const [image] = await db
    .select({
      data: productImages.data,
      mimeType: productImages.mimeType,
      updatedAt: productImages.updatedAt,
    })
    .from(productImages)
    .where(eq(productImages.menuItemId, menuItemId))
    .limit(1);

  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Last-Modified": image.updatedAt.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
