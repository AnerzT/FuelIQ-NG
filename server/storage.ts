import { db } from "./db.js";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
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

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  incrementForecastCount(userId: string): Promise<void>;
  resetForecastCount(userId: string): Promise<void>;
  resetSmsCount(userId: string): Promise<void>;
  updateUserNotificationPrefs(userId: string, prefs: any): Promise<User | undefined>;
  updateUserSubscription(userId: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getSubscribedUsers(): Promise<User[]>;
  createNotificationLog(userId: string, channel: string, message: string, alertType?: string): Promise<any>;
  getNotificationLogs(userId: string, limit?: number): Promise<any[]>;
  
  // Terminals
  getTerminal(id: string): Promise<Terminal | undefined>;
  getTerminalByCode(code: string): Promise<Terminal | undefined>;
  getAllTerminals(): Promise<Terminal[]>;
  getTerminals(): Promise<Terminal[]>;
  updateTerminal(id: string, data: Partial<Terminal>): Promise<Terminal | undefined>;
  
  // Forecasts
  getLatestForecast(terminalId: string, productType?: string): Promise<Forecast | undefined>;
  getForecasts(terminalId: string, limit?: number): Promise<Forecast[]>;
  getAllForecasts(limit?: number): Promise<Forecast[]>;
  createForecast(forecast: any): Promise<Forecast>;
  
  // Market Signals
  getLatestSignal(terminalId: string, productType?: string): Promise<MarketSignal | undefined>;
  createSignal(signal: any): Promise<MarketSignal>;
  getSignalHistory(terminalId: string, limit?: number): Promise<MarketSignal[]>;
  
  // Price History
  getPriceHistory(terminalId: string, days?: number, productType?: string): Promise<PriceHistoryEntry[]>;
  
  // Depots
  getDepots(terminalId?: string): Promise<Depot[]>;
  getDepot(id: string): Promise<Depot | undefined>;
  createDepot(depot: any): Promise<Depot>;
  
  // Depot Prices
  getDepotPrices(depotId?: string, productType?: string): Promise<DepotPrice[]>;
  createDepotPrice(price: any): Promise<DepotPrice>;
  updateDepotPrice(id: string, price: number): Promise<DepotPrice | undefined>;
  
  // Refinery Updates
  getRefineryUpdates(limit?: number): Promise<RefineryUpdate[]>;
  
  // Regulation Updates
  getRegulationUpdates(limit?: number): Promise<RegulationUpdate[]>;
  getHighImpactRegulations(): Promise<RegulationUpdate[]>;
  
  // FX Rates
  getFxRates(limit?: number): Promise<FxRate[]>;
  getLatestFxRate(): Promise<FxRate | undefined>;
  createFxRate(rate: any): Promise<FxRate>;
  
  // Inventory
  getInventory(userId: string): Promise<Inventory[]>;
  getInventoryItem(id: string): Promise<Inventory | undefined>;
  createInventory(inventory: any): Promise<Inventory>;
  updateInventory(id: string, data: Partial<Inventory>): Promise<Inventory | undefined>;
  
  // Transactions
  getTransactions(inventoryId: string): Promise<Transaction[]>;
  createTransaction(transaction: any): Promise<Transaction>;
  
  // Trader Signals
  getTraderSignals(limit?: number): Promise<TraderSignal[]>;
  createTraderSignal(signal: any): Promise<TraderSignal>;
  getTraderSignalsByTerminal(terminalId: string, limit?: number): Promise<TraderSignal[]>;
  
  // Hedge Recommendations
  getHedgeRecommendations(userId: string): Promise<HedgeRecommendation[]>;
  createHedgeRecommendation(recommendation: any): Promise<HedgeRecommendation>;
}

export class DatabaseStorage implements IStorage {
  // ===== USERS =====
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data as any).where(eq(users.id, id)).returning();
    return updated;
  }

  async incrementForecastCount(userId: string): Promise<void> {
    await db.update(users)
      .set({ forecastsUsedToday: sql`${users.forecastsUsedToday} + 1` } as any)
      .where(eq(users.id, userId));
  }

  async resetForecastCount(userId: string): Promise<void> {
    await db.update(users)
      .set({ forecastsUsedToday: 0, forecastDayResetDate: new Date() } as any)
      .where(eq(users.id, userId));
  }

  async resetSmsCount(userId: string): Promise<void> {
    await db.update(users)
      .set({ smsAlertsUsedThisWeek: 0, smsWeekResetDate: new Date() } as any)
      .where(eq(users.id, userId));
  }

  async updateUserNotificationPrefs(userId: string, prefs: any): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ notificationPrefs: prefs } as any)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserSubscription(userId: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set(data as any)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getSubscribedUsers(): Promise<User[]> {
    const allUsers = await this.getAllUsers();
    return allUsers.filter(user => {
      const prefs = user.notificationPrefs as any;
      return prefs?.smsEnabled === true || prefs?.whatsappEnabled === true;
    });
  }

  async createNotificationLog(userId: string, channel: string, message: string, alertType: string = "general"): Promise<any> {
    console.log(`📝 Notification log: ${userId} - ${channel} - ${alertType}`);
    return { id: "mock-" + Date.now(), userId, channel, message, alertType, createdAt: new Date() };
  }

  async getNotificationLogs(userId: string, limit: number = 50): Promise<any[]> {
    return [];
  }

  // ===== TERMINALS =====
  async getTerminal(id: string): Promise<Terminal | undefined> {
    const [terminal] = await db.select().from(terminals).where(eq(terminals.id, id));
    return terminal;
  }

  async getTerminalByCode(code: string): Promise<Terminal | undefined> {
    const [terminal] = await db.select().from(terminals).where(eq(terminals.code, code));
    return terminal;
  }

  async getAllTerminals(): Promise<Terminal[]> {
    return await db.select().from(terminals);
  }

  async getTerminals(): Promise<Terminal[]> {
    return this.getAllTerminals();
  }

  async updateTerminal(id: string, data: Partial<Terminal>): Promise<Terminal | undefined> {
    const [updated] = await db.update(terminals).set(data).where(eq(terminals.id, id)).returning();
    return updated;
  }

  // ===== FORECASTS =====
  async getLatestForecast(terminalId: string, productType: string = "PMS"): Promise<Forecast | undefined> {
    const [forecast] = await db.select()
      .from(forecasts)
      .where(and(
        eq(forecasts.terminalId, terminalId),
        eq(forecasts.productType, productType)
      ))
      .orderBy(desc(forecasts.createdAt))
      .limit(1);
    return forecast;
  }

  async getForecasts(terminalId: string, limit: number = 50): Promise<Forecast[]> {
    return await db.select()
      .from(forecasts)
      .where(eq(forecasts.terminalId, terminalId))
      .orderBy(desc(forecasts.createdAt))
      .limit(limit);
  }

  async getAllForecasts(limit: number = 100): Promise<Forecast[]> {
    return await db.select()
      .from(forecasts)
      .orderBy(desc(forecasts.createdAt))
      .limit(limit);
  }

  async createForecast(forecast: any): Promise<Forecast> {
    const [newForecast] = await db.insert(forecasts).values(forecast).returning();
    return newForecast;
  }

  // ===== MARKET SIGNALS =====
  async getLatestSignal(terminalId: string, productType: string = "PMS"): Promise<MarketSignal | undefined> {
    const [signal] = await db.select()
      .from(marketSignals)
      .where(and(
        eq(marketSignals.terminalId, terminalId),
        eq(marketSignals.productType, productType)
      ))
      .orderBy(desc(marketSignals.createdAt))
      .limit(1);
    return signal;
  }

  async createSignal(signal: any): Promise<MarketSignal> {
    const [newSignal] = await db.insert(marketSignals).values(signal).returning();
    return newSignal;
  }

  async getSignalHistory(terminalId: string, limit: number = 20): Promise<MarketSignal[]> {
    return await db.select()
      .from(marketSignals)
      .where(eq(marketSignals.terminalId, terminalId))
      .orderBy(desc(marketSignals.createdAt))
      .limit(limit);
  }

  // ===== PRICE HISTORY =====
  async getPriceHistory(terminalId: string, days: number = 30, productType: string = "PMS"): Promise<PriceHistoryEntry[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return await db.select()
      .from(priceHistory)
      .where(and(
        eq(priceHistory.terminalId, terminalId),
        eq(priceHistory.productType, productType),
        gte(priceHistory.date, cutoffDate)
      ))
      .orderBy(priceHistory.date);
  }

  // ===== DEPOTS =====
  async getDepots(terminalId?: string): Promise<Depot[]> {
    if (terminalId) {
      return await db.select().from(depots).where(eq(depots.terminalId, terminalId));
    }
    return await db.select().from(depots);
  }

  async getDepot(id: string): Promise<Depot | undefined> {
    const [depot] = await db.select().from(depots).where(eq(depots.id, id));
    return depot;
  }

  async createDepot(depot: any): Promise<Depot> {
    const [newDepot] = await db.insert(depots).values(depot).returning();
    return newDepot;
  }

  // ===== DEPOT PRICES =====
  async getDepotPrices(depotId?: string, productType?: string): Promise<DepotPrice[]> {
    let query = db.select().from(depotPrices);
    if (depotId) query = query.where(eq(depotPrices.depotId, depotId));
    if (productType) query = query.where(eq(depotPrices.productType, productType));
    return await query.orderBy(desc(depotPrices.updatedAt));
  }

  async createDepotPrice(price: any): Promise<DepotPrice> {
    const [newPrice] = await db.insert(depotPrices).values(price).returning();
    return newPrice;
  }

  async updateDepotPrice(id: string, price: number): Promise<DepotPrice | undefined> {
    const [updated] = await db.update(depotPrices)
      .set({ price, updatedAt: new Date() } as any)
      .where(eq(depotPrices.id, id))
      .returning();
    return updated;
  }

  // ===== REFINERY UPDATES =====
  async getRefineryUpdates(limit: number = 20): Promise<RefineryUpdate[]> {
    return await db.select().from(refineryUpdates).orderBy(desc(refineryUpdates.createdAt)).limit(limit);
  }

  // ===== REGULATION UPDATES =====
  async getRegulationUpdates(limit: number = 20): Promise<RegulationUpdate[]> {
    return await db.select().from(regulationUpdates).orderBy(desc(regulationUpdates.createdAt)).limit(limit);
  }

  async getHighImpactRegulations(): Promise<RegulationUpdate[]> {
    return await db.select().from(regulationUpdates).where(eq(regulationUpdates.impactLevel, "high")).orderBy(desc(regulationUpdates.createdAt));
  }

  // ===== FX RATES =====
  async getFxRates(limit: number = 10): Promise<FxRate[]> {
    return await db.select().from(fxRates).orderBy(desc(fxRates.createdAt)).limit(limit);
  }

  async getLatestFxRate(): Promise<FxRate | undefined> {
    const [rate] = await db.select().from(fxRates).orderBy(desc(fxRates.createdAt)).limit(1);
    return rate;
  }

  async createFxRate(rate: any): Promise<FxRate> {
    const [newRate] = await db.insert(fxRates).values(rate).returning();
    return newRate;
  }

  // ===== INVENTORY =====
  async getInventory(userId: string): Promise<Inventory[]> {
    return await db.select().from(inventory).where(eq(inventory.userId, userId));
  }

  async getInventoryItem(id: string): Promise<Inventory | undefined> {
    const [item] = await db.select().from(inventory).where(eq(inventory.id, id));
    return item;
  }

  async createInventory(inv: any): Promise<Inventory> {
    const [newInv] = await db.insert(inventory).values(inv).returning();
    return newInv;
  }

  async updateInventory(id: string, data: Partial<Inventory>): Promise<Inventory | undefined> {
    const [updated] = await db.update(inventory)
      .set({ ...data, lastUpdated: new Date() } as any)
      .where(eq(inventory.id, id))
      .returning();
    return updated;
  }

  // ===== TRANSACTIONS =====
  async getTransactions(inventoryId: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.inventoryId, inventoryId)).orderBy(desc(transactions.date));
  }

  async createTransaction(transaction: any): Promise<Transaction> {
    const [newTx] = await db.insert(transactions).values(transaction).returning();
    return newTx;
  }

  // ===== TRADER SIGNALS =====
  async getTraderSignals(limit: number = 50): Promise<TraderSignal[]> {
    return await db.select().from(traderSignals).orderBy(desc(traderSignals.createdAt)).limit(limit);
  }

  async createTraderSignal(signal: any): Promise<TraderSignal> {
    const [newSignal] = await db.insert(traderSignals).values(signal).returning();
    return newSignal;
  }

  async getTraderSignalsByTerminal(terminalId: string, limit: number = 20): Promise<TraderSignal[]> {
    return await db.select().from(traderSignals).where(eq(traderSignals.terminalId, terminalId)).orderBy(desc(traderSignals.createdAt)).limit(limit);
  }

  // ===== HEDGE RECOMMENDATIONS =====
  async getHedgeRecommendations(userId: string): Promise<HedgeRecommendation[]> {
    return await db.select().from(hedgeRecommendations).where(eq(hedgeRecommendations.userId, userId)).orderBy(desc(hedgeRecommendations.createdAt));
  }

  async createHedgeRecommendation(recommendation: any): Promise<HedgeRecommendation> {
    const [newRec] = await db.insert(hedgeRecommendations).values(recommendation).returning();
    return newRec;
  }
}

export const storage = new DatabaseStorage();
