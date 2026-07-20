import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adminUsers } from "../db/schema";
import { hashPassword } from "../lib/admin-auth";

async function main() {
const email = process.env.ADMIN_EMAIL?.trim().toLocaleLowerCase("tr-TR");
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim().slice(0, 120) || "Yönetici";

if (!email || !password || password.length < 8) {
  throw new Error("ADMIN_EMAIL ve en az 8 karakterli ADMIN_PASSWORD gereklidir.");
}

const db = getDb();
const passwordHash = hashPassword(password);

await db
  .insert(adminUsers)
  .values({ name, email, passwordHash, isActive: true })
  .onConflictDoUpdate({
    target: adminUsers.email,
    set: { passwordHash, isActive: true, updatedAt: new Date() },
  });

const [admin] = await db
  .select({ id: adminUsers.id, email: adminUsers.email })
  .from(adminUsers)
  .where(eq(adminUsers.email, email))
  .limit(1);

console.info(`Yönetici hesabı hazır: ${admin.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
