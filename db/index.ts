import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  bonjSql?: ReturnType<typeof postgres>;
};

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql =
    globalForDb.bonjSql ??
    postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.bonjSql = sql;
  }

  return drizzle(sql, { schema });
}
