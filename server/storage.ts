import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
import {
  users, terminals, marketSignals, forecasts, priceHistory,
  type User, type InsertUser, type Terminal, type MarketSignal, type Forecast, type PriceHistoryEntry,
} from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const db = drizzle(process.env.DATABASE_URL);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: string }): Promise<User>;

  getTerminals(): Promise<Terminal[]>;
  getTerminal(id: string): Promise<Terminal | undefined>;
  getTerminalByCode(code: string): Promise<Terminal | undefined>;

  getLatestSignal(terminalId: string): Promise<MarketSignal | undefined>;
  createSignal(signal: Omit<MarketSignal, "id" | "createdAt">): Promise<MarketSignal>;

  getLatestForecast(terminalId: string): Promise<Forecast | undefined>;
  createForecast(forecast: Omit<Forecast, "id" | "createdAt">): Promise<Forecast>;

  getPriceHistory(terminalId: string, limit?: number): Promise<PriceHistoryEntry[]>;
  createPriceHistory(entry: Omit<PriceHistoryEntry, "id">): Promise<PriceHistoryEntry>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser & { role?: string }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getTerminals(): Promise<Terminal[]> {
    return db.select().from(terminals);
  }

  async getTerminal(id: string): Promise<Terminal | undefined> {
    const [terminal] = await db.select().from(terminals).where(eq(terminals.id, id)).limit(1);
    return terminal;
  }

  async getTerminalByCode(code: string): Promise<Terminal | undefined> {
    const [terminal] = await db.select().from(terminals).where(eq(terminals.code, code)).limit(1);
    return terminal;
  }

  async getLatestSignal(terminalId: string): Promise<MarketSignal | undefined> {
    const [signal] = await db.select().from(marketSignals)
      .where(eq(marketSignals.terminalId, terminalId))
      .orderBy(desc(marketSignals.createdAt))
      .limit(1);
    return signal;
  }

  async createSignal(signal: Omit<MarketSignal, "id" | "createdAt">): Promise<MarketSignal> {
    const [created] = await db.insert(marketSignals).values(signal).returning();
    return created;
  }

  async getLatestForecast(terminalId: string): Promise<Forecast | undefined> {
    const [forecast] = await db.select().from(forecasts)
      .where(eq(forecasts.terminalId, terminalId))
      .orderBy(desc(forecasts.createdAt))
      .limit(1);
    return forecast;
  }

  async createForecast(forecast: Omit<Forecast, "id" | "createdAt">): Promise<Forecast> {
    const [created] = await db.insert(forecasts).values(forecast).returning();
    return created;
  }

  async getPriceHistory(terminalId: string, limit = 30): Promise<PriceHistoryEntry[]> {
    return db.select().from(priceHistory)
      .where(eq(priceHistory.terminalId, terminalId))
      .orderBy(desc(priceHistory.date))
      .limit(limit);
  }

  async createPriceHistory(entry: Omit<PriceHistoryEntry, "id">): Promise<PriceHistoryEntry> {
    const [created] = await db.insert(priceHistory).values(entry).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
