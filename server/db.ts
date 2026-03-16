import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema.js';

let db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (db) return db;

  const url = process.env.DATABASE_URL;
  
  if (!url) {
    throw new Error('DATABASE_URL not set');
  }

  const client = postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',  // ← ADD THIS for Supabase
  });

  db = drizzle(client, { schema });
  return db;
}

export async function testDatabaseConnection() {
  try {
    const db = await getDb();
     await db.execute('SELECT 1' as any);
    console.log('✅ Database connected');
    return 'connected';
  } catch (error) {
    console.error('❌ Database test failed:', error);
    throw error;  // ← throw instead of silently returning
  }
}
