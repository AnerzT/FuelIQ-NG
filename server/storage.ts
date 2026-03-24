import { db } from "./db.js";
import { and, desc, eq, gte } from "drizzle-orm";

import {
  users,
  terminals,
  forecasts,
  marketSignals,
  priceHistory,
  depots,
  depotPrices,
  refineryUpdates,
  regulationUpdates,
  fxRates,
  inventory,
  transactions,
  traderSignals,
  hedgeRecommendations,
  type User,
  type InsertUser,
  type Terminal,
  type Forecast,
  type MarketSignal,
  type PriceHistoryEntry,
  type Depot,
  type DepotPrice,
  type RefineryUpdate,
  type RegulationUpdate,
  type FxRate,
  type Inventory,
  type Transaction,
  type TraderSignal,
  type HedgeRecommendation,
} from "../shared/schema.js";

export class DatabaseStorage {
  // ---------------- USERS ----------------
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user as any).returning();
    return newUser;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data as any).where(eq(users.id, id)).returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // ---------------- TERMINALS ----------------
  async getAllTerminals(): Promise<Terminal[]> {
    return await db.select().from(terminals);
  }

  async getTerminal(id: string): Promise<Terminal | undefined> {
    const [terminal] = await db.select().from(terminals).where(eq(terminals.id, id));
    return terminal;
  }

  // ---------------- FORECASTS ----------------
  async createForecast(data: any): Promise<Forecast> {
    const [forecast] = await db.insert(forecasts).values(data).returning();
    return forecast;
  }

  async getLatestForecast(terminalId: string): Promise<Forecast | undefined> {
    const [forecast] = await db
      .select()
      .from(forecasts)
      .where(eq(forecasts.terminalId, terminalId))
      .orderBy(desc(forecasts.createdAt))
      .limit(1);

    return forecast;
  }

  // ---------------- SIGNALS ----------------
  async createSignal(data: any): Promise<MarketSignal> {
    const [signal] = await db.insert(marketSignals).values(data).returning();
    return signal;
  }

  async getLatestSignal(terminalId: string): Promise<MarketSignal | undefined> {
    const [signal] = await db
      .select()
      .from(marketSignals)
      .where(eq(marketSignals.terminalId, terminalId))
      .orderBy(desc(marketSignals.createdAt))
      .limit(1);

    return signal;
  }

  // ---------------- PRICE HISTORY ----------------
  async getPriceHistory(terminalId: string, days = 30): Promise<PriceHistoryEntry[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return await db
      .select()
      .from(priceHistory)
      .where(and(eq(priceHistory.terminalId, terminalId), gte(priceHistory.date, cutoff)))
      .orderBy(priceHistory.date);
  }

  // ---------------- DEPOTS ----------------
  async getDepots(): Promise<Depot[]> {
    return await db.select().from(depots);
  }

  async getDepot(id: string): Promise<Depot | undefined> {
    const [depot] = await db.select().from(depots).where(eq(depots.id, id));
    return depot;
  }

  async createDepot(data: any): Promise<Depot> {
    const [depot] = await db.insert(depots).values(data).returning();
    return depot;
  }

  // ✅ FIXED (main TS2740 issue)
  async getDepotPrices(depotId?: string, productType?: string): Promise<DepotPrice[]> {
    const conditions = [];

    if (depotId) conditions.push(eq(depotPrices.depotId, depotId));
    if (productType) conditions.push(eq(depotPrices.productType, productType));

    return await db
      .select()
      .from(depotPrices)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(depotPrices.updatedAt));
  }

  async createDepotPrice(data: any): Promise<DepotPrice> {
    const [price] = await db.insert(depotPrices).values(data).returning();
    return price;
  }

  async updateDepotPrice(id: string, price: number): Promise<DepotPrice | undefined> {
    const [updated] = await db
      .update(depotPrices)
      .set({ price, updatedAt: new Date() } as any)
      .where(eq(depotPrices.id, id))
      .returning();

    return updated;
  }

  // ---------------- FX ----------------
  async getFxRates(limit = 10): Promise<FxRate[]> {
    return await db.select().from(fxRates).orderBy(desc(fxRates.createdAt)).limit(limit);
  }

  async createFxRate(data: any): Promise<FxRate> {
    const [rate] = await db.insert(fxRates).values(data).returning();
    return rate;
  }

  // ---------------- INVENTORY ----------------
  async getInventory(userId: string): Promise<Inventory[]> {
    return await db.select().from(inventory).where(eq(inventory.userId, userId));
  }

  async createInventory(data: any): Promise<Inventory> {
    const [inv] = await db.insert(inventory).values(data).returning();
    return inv;
  }

  async createTransaction(data: any): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(data).returning();
    return tx;
  }

  async getTransactions(inventoryId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.inventoryId, inventoryId))
      .orderBy(desc(transactions.date));
  }

  // ---------------- TRADER SIGNALS ----------------
  async getTraderSignals(limit = 50): Promise<TraderSignal[]> {
    return await db.select().from(traderSignals).orderBy(desc(traderSignals.createdAt)).limit(limit);
  }

  async createTraderSignal(data: any): Promise<TraderSignal> {
    const [signal] = await db.insert(traderSignals).values(data).returning();
    return signal;
  }

  // ---------------- HEDGE ----------------
  async getHedgeRecommendations(userId: string): Promise<HedgeRecommendation[]> {
    return await db
      .select()
      .from(hedgeRecommendations)
      .where(eq(hedgeRecommendations.userId, userId))
      .orderBy(desc(hedgeRecommendations.createdAt));
  }

  async createHedgeRecommendation(data: any): Promise<HedgeRecommendation> {
    const [rec] = await db.insert(hedgeRecommendations).values(data).returning();
    return rec;
  }
}

export const storage = new DatabaseStorage();
