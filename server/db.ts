import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema.js";

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

export async function getDb(): Promise<PostgresJsDatabase<typeof schema>> {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set");
  }

  const client = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export const db = process.env.DATABASE_URL ? await getDb() : null;

export async function testDatabaseConnection() {
  if (!db) return "not configured";

  try {
    await db.execute(sql`SELECT 1`);
    return "connected";
  } catch {
    return "disconnected";
  }
}
