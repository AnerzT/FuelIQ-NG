// server/db.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema.js';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let connectionPromise: Promise<ReturnType<typeof drizzle>> | null = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    throw new Error('Database connection failed: DATABASE_URL not set');
  }

  try {
    const client = postgres(databaseUrl, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    
    dbInstance = drizzle(client, { schema });
    console.log('✅ Database connected');
    return dbInstance;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw error;
  }
}

// Initialize db immediately for exports
if (!connectionPromise) {
  connectionPromise = getDb();
}

export const db = await connectionPromise;

export async function testDatabaseConnection() {
  try {
    await db.execute('SELECT 1');
    return 'connected';
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return 'disconnected';
  }
}
