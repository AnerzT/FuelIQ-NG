import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema.js';

// Database connection with error handling
let db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (db) return db;
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    throw new Error('Database connection failed: DATABASE_URL not set');
  }

  try {
    const client = postgres(process.env.DATABASE_URL, {
      max: 1, // Connection pool size for serverless
      idle_timeout: 20,
      connect_timeout: 10,
    });
    
    db = drizzle(client, { schema });
    console.log('✅ Database connected');
    return db;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw error;
  }
}

export async function testDatabaseConnection() {
  try {
    const db = await getDb();
    // Simple test query
    await db.execute('SELECT 1');
    return 'connected';
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return 'disconnected';
  }
}
