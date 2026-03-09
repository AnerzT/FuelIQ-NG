import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  users, terminals, marketSignals, forecasts, priceHistory,
  refineryUpdates, regulationUpdates, externalPriceFeeds, fxRates, notificationLogs,
  depots, depotPrices, inventory, transactions, traderSignals, hedgeRecommendations,
  type User, type InsertUser, type Terminal, type MarketSignal, type Forecast, type PriceHistoryEntry,
  type RefineryUpdate, type RegulationUpdate, type ExternalPriceFeed, type FxRate, type NotificationLog,
  type InsertRefineryUpdate, type InsertRegulationUpdate, type InsertExternalPriceFeed, type InsertFxRate,
  type NotificationPrefs,
  type Depot, type DepotPrice, type Inventory, type Transaction, type TraderSignal, type HedgeRecommendation,
} from "../shared/schema.js";

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

  getLatestSignal(terminalId: string, productType?: string): Promise<MarketSignal | undefined>;
  createSignal(signal: Omit<MarketSignal, "id" | "createdAt">): Promise<MarketSignal>;

  getLatestForecast(terminalId: string, productType?: string): Promise<Forecast | undefined>;
  createForecast(forecast: Omit<Forecast, "id" | "createdAt">): Promise<Forecast>;

  getPriceHistory(terminalId: string, limit?: number, productType?: string): Promise<PriceHistoryEntry[]>;
  createPriceHistory(entry: Omit<PriceHistoryEntry, "id">): Promise<PriceHistoryEntry>;

  updateTerminal(id: string, data: Partial<Pick<Terminal, "active" | "name" | "state">>): Promise<Terminal | undefined>;
  getAllForecasts(limit?: number): Promise<(Forecast & { terminalName?: string })[]>;
  getForecasts(terminalId: string, limit?: number): Promise<(Forecast & { terminalName?: string })[]>;

  getRefineryUpdates(limit?: number): Promise<RefineryUpdate[]>;
  createRefineryUpdate(data: InsertRefineryUpdate): Promise<RefineryUpdate>;

  getRegulationUpdates(limit?: number): Promise<RegulationUpdate[]>;
  createRegulationUpdate(data: InsertRegulationUpdate): Promise<RegulationUpdate>;

  getExternalPriceFeeds(terminalId?: string, limit?: number): Promise<ExternalPriceFeed[]>;
  getExternalPriceFeedBySource(sourceName: string, limit?: number): Promise<ExternalPriceFeed[]>;
  createExternalPriceFeed(data: InsertExternalPriceFeed): Promise<ExternalPriceFeed>;

  getFxRates(limit?: number): Promise<FxRate[]>;
  getLatestFxRate(): Promise<FxRate | undefined>;
  createFxRate(data: InsertFxRate): Promise<FxRate>;

  updateUserNotificationPrefs(userId: string, data: { phone?: string; whatsappPhone?: string; notificationPrefs?: Partial<NotificationPrefs> }): Promise<User | undefined>;
  getSubscribedUsers(channel: "sms" | "whatsapp", alertType: keyof NotificationPrefs): Promise<User[]>;
  createNotificationLog(data: Omit<NotificationLog, "id" | "createdAt">): Promise<NotificationLog>;
  getNotificationLogs(userId: string, limit?: number): Promise<NotificationLog[]>;

  updateUserSubscription(userId: string, data: { tier?: string; startDate?: Date; endDate?: Date; assignedTerminalId?: string }): Promise<User | undefined>;
  incrementForecastCount(userId: string): Promise<void>;
  resetForecastCount(userId: string): Promise<void>;
  incrementSmsCount(userId: string): Promise<void>;
  resetSmsCount(userId: string): Promise<void>;
  getAllUsers(): Promise<User[]>;

  getDepots(terminalId?: string): Promise<(Depot & { terminalName?: string })[]>;
  getDepot(id: string): Promise<Depot | undefined>;
  createDepot(data: Omit<Depot, "id">): Promise<Depot>;

  getDepotPrices(depotId?: string, productType?: string): Promise<(DepotPrice & { depotName?: string; terminalName?: string; terminalId?: string })[]>;
  createDepotPrice(data: Omit<DepotPrice, "id">): Promise<DepotPrice>;
  updateDepotPrice(id: string, price: number): Promise<DepotPrice | undefined>;

  getInventory(userId: string, terminalId?: string, productType?: string): Promise<(Inventory & { terminalName?: string })[]>;
  getInventoryItem(id: string): Promise<Inventory | undefined>;
  createInventory(data: Omit<Inventory, "id" | "lastUpdated">): Promise<Inventory>;
  updateInventory(id: string, data: Partial<Pick<Inventory, "volumeLitres" | "averageCost">>): Promise<Inventory | undefined>;

  getTransactions(inventoryId: string, limit?: number): Promise<Transaction[]>;
  createTransaction(data: Omit<Transaction, "id">): Promise<Transaction>;

  getTraderSignals(terminalId?: string, limit?: number): Promise<(TraderSignal & { userName?: string })[]>;
  createTraderSignal(data: Omit<TraderSignal, "id" | "createdAt">): Promise<TraderSignal>;

  getHedgeRecommendations(userId: string, productType?: string, limit?: number): Promise<HedgeRecommendation[]>;
  createHedgeRecommendation(data: Omit<HedgeRecommendation, "id" | "createdAt">): Promise<HedgeRecommendation>;
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

  async getLatestSignal(terminalId: string, productType?: string): Promise<MarketSignal | undefined> {
    const conditions = [eq(marketSignals.terminalId, terminalId)];
    if (productType) conditions.push(eq(marketSignals.productType, productType));
    const [signal] = await db.select().from(marketSignals)
      .where(and(...conditions))
      .orderBy(desc(marketSignals.createdAt))
      .limit(1);
    return signal;
  }

  async createSignal(signal: Omit<MarketSignal, "id" | "createdAt">): Promise<MarketSignal> {
    const [created] = await db.insert(marketSignals).values(signal).returning();
    return created;
  }

  async getLatestForecast(terminalId: string, productType?: string): Promise<Forecast | undefined> {
    const conditions = [eq(forecasts.terminalId, terminalId)];
    if (productType) conditions.push(eq(forecasts.productType, productType));
    const [forecast] = await db.select().from(forecasts)
      .where(and(...conditions))
      .orderBy(desc(forecasts.createdAt))
      .limit(1);
    return forecast;
  }

  async createForecast(forecast: Omit<Forecast, "id" | "createdAt">): Promise<Forecast> {
    const [created] = await db.insert(forecasts).values(forecast).returning();
    return created;
  }

  async getPriceHistory(terminalId: string, limit = 30, productType?: string): Promise<PriceHistoryEntry[]> {
    const conditions = [eq(priceHistory.terminalId, terminalId)];
    if (productType) conditions.push(eq(priceHistory.productType, productType));
    return db.select().from(priceHistory)
      .where(and(...conditions))
      .orderBy(desc(priceHistory.date))
      .limit(limit);
  }

  async createPriceHistory(entry: Omit<PriceHistoryEntry, "id">): Promise<PriceHistoryEntry> {
    const [created] = await db.insert(priceHistory).values(entry).returning();
    return created;
  }

  async updateTerminal(id: string, data: Partial<Pick<Terminal, "active" | "name" | "state">>): Promise<Terminal | undefined> {
    const [updated] = await db.update(terminals).set(data).where(eq(terminals.id, id)).returning();
    return updated;
  }

  async getAllForecasts(limit = 50): Promise<(Forecast & { terminalName?: string })[]> {
    const rows = await db
      .select({
        id: forecasts.id,
        terminalId: forecasts.terminalId,
        productType: forecasts.productType,
        expectedMin: forecasts.expectedMin,
        expectedMax: forecasts.expectedMax,
        bias: forecasts.bias,
        confidence: forecasts.confidence,
        suggestedAction: forecasts.suggestedAction,
        depotPrice: forecasts.depotPrice,
        refineryInfluenceScore: forecasts.refineryInfluenceScore,
        importParityPrice: forecasts.importParityPrice,
        demandIndex: forecasts.demandIndex,
        createdAt: forecasts.createdAt,
        terminalName: terminals.name,
      })
      .from(forecasts)
      .leftJoin(terminals, eq(forecasts.terminalId, terminals.id))
      .orderBy(desc(forecasts.createdAt))
      .limit(limit);
    return rows;
  }

  async getForecasts(terminalId: string, limit = 20): Promise<(Forecast & { terminalName?: string })[]> {
    const rows = await db
      .select({
        id: forecasts.id,
        terminalId: forecasts.terminalId,
        productType: forecasts.productType,
        expectedMin: forecasts.expectedMin,
        expectedMax: forecasts.expectedMax,
        bias: forecasts.bias,
        confidence: forecasts.confidence,
        suggestedAction: forecasts.suggestedAction,
        depotPrice: forecasts.depotPrice,
        refineryInfluenceScore: forecasts.refineryInfluenceScore,
        importParityPrice: forecasts.importParityPrice,
        demandIndex: forecasts.demandIndex,
        createdAt: forecasts.createdAt,
        terminalName: terminals.name,
      })
      .from(forecasts)
      .leftJoin(terminals, eq(forecasts.terminalId, terminals.id))
      .where(eq(forecasts.terminalId, terminalId))
      .orderBy(desc(forecasts.createdAt))
      .limit(limit);
    return rows;
  }

  async getRefineryUpdates(limit = 20): Promise<RefineryUpdate[]> {
    return db.select().from(refineryUpdates).orderBy(desc(refineryUpdates.createdAt)).limit(limit);
  }

  async createRefineryUpdate(data: InsertRefineryUpdate): Promise<RefineryUpdate> {
    const [created] = await db.insert(refineryUpdates).values(data).returning();
    return created;
  }

  async getRegulationUpdates(limit = 20): Promise<RegulationUpdate[]> {
    return db.select().from(regulationUpdates).orderBy(desc(regulationUpdates.createdAt)).limit(limit);
  }

  async createRegulationUpdate(data: InsertRegulationUpdate): Promise<RegulationUpdate> {
    const [created] = await db.insert(regulationUpdates).values(data).returning();
    return created;
  }

  async getExternalPriceFeeds(terminalId?: string, limit = 20): Promise<ExternalPriceFeed[]> {
    const query = db.select().from(externalPriceFeeds);
    if (terminalId) {
      return query.where(eq(externalPriceFeeds.terminalId, terminalId)).orderBy(desc(externalPriceFeeds.createdAt)).limit(limit);
    }
    return query.orderBy(desc(externalPriceFeeds.createdAt)).limit(limit);
  }

  async getExternalPriceFeedBySource(sourceName: string, limit = 1): Promise<ExternalPriceFeed[]> {
    return db.select().from(externalPriceFeeds)
      .where(eq(externalPriceFeeds.sourceName, sourceName))
      .orderBy(desc(externalPriceFeeds.createdAt))
      .limit(limit);
  }

  async createExternalPriceFeed(data: InsertExternalPriceFeed): Promise<ExternalPriceFeed> {
    const [created] = await db.insert(externalPriceFeeds).values(data).returning();
    return created;
  }

  async getFxRates(limit = 30): Promise<FxRate[]> {
    return db.select().from(fxRates).orderBy(desc(fxRates.createdAt)).limit(limit);
  }

  async getLatestFxRate(): Promise<FxRate | undefined> {
    const [rate] = await db.select().from(fxRates).orderBy(desc(fxRates.createdAt)).limit(1);
    return rate;
  }

  async createFxRate(data: InsertFxRate): Promise<FxRate> {
    const [created] = await db.insert(fxRates).values(data).returning();
    return created;
  }

  async updateUserNotificationPrefs(
    userId: string,
    data: { phone?: string; whatsappPhone?: string; notificationPrefs?: Partial<NotificationPrefs> }
  ): Promise<User | undefined> {
    const existing = await this.getUser(userId);
    if (!existing) return undefined;

    const updateData: Record<string, any> = {};
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.whatsappPhone !== undefined) updateData.whatsappPhone = data.whatsappPhone;
    if (data.notificationPrefs) {
      const current = (existing.notificationPrefs as NotificationPrefs) || {
        smsEnabled: false, whatsappEnabled: false,
        forecastAlerts: true, priceAlerts: true, refineryAlerts: true, morningDigest: false,
      };
      updateData.notificationPrefs = { ...current, ...data.notificationPrefs };
    }

    if (Object.keys(updateData).length === 0) return existing;

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    return updated;
  }

  async getSubscribedUsers(channel: "sms" | "whatsapp", alertType: keyof NotificationPrefs): Promise<User[]> {
    const allUsers = await db.select().from(users);
    return allUsers.filter((user) => {
      const prefs = (user.notificationPrefs as NotificationPrefs) || null;
      if (!prefs) return false;

      if (channel === "sms") {
        return prefs.smsEnabled && prefs[alertType] && !!user.phone;
      }
      return prefs.whatsappEnabled && prefs[alertType] && !!user.whatsappPhone;
    });
  }

  async createNotificationLog(data: Omit<NotificationLog, "id" | "createdAt">): Promise<NotificationLog> {
    const [created] = await db.insert(notificationLogs).values(data).returning();
    return created;
  }

  async getNotificationLogs(userId: string, limit = 50): Promise<NotificationLog[]> {
    return db.select().from(notificationLogs)
      .where(eq(notificationLogs.userId, userId))
      .orderBy(desc(notificationLogs.createdAt))
      .limit(limit);
  }

  async updateUserSubscription(
    userId: string,
    data: { tier?: string; startDate?: Date; endDate?: Date; assignedTerminalId?: string }
  ): Promise<User | undefined> {
    const updateData: Record<string, any> = {};
    if (data.tier !== undefined) updateData.subscriptionTier = data.tier;
    if (data.startDate !== undefined) updateData.subscriptionStartDate = data.startDate;
    if (data.endDate !== undefined) updateData.subscriptionEndDate = data.endDate;
    if (data.assignedTerminalId !== undefined) updateData.assignedTerminalId = data.assignedTerminalId;
    if (Object.keys(updateData).length === 0) return this.getUser(userId);
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    return updated;
  }

  async incrementForecastCount(userId: string): Promise<void> {
    await db.update(users).set({
      forecastsUsedToday: sql`${users.forecastsUsedToday} + 1`,
      forecastDayResetDate: new Date(),
    }).where(eq(users.id, userId));
  }

  async resetForecastCount(userId: string): Promise<void> {
    await db.update(users).set({
      forecastsUsedToday: 0,
      forecastDayResetDate: new Date(),
    }).where(eq(users.id, userId));
  }

  async incrementSmsCount(userId: string): Promise<void> {
    await db.update(users).set({
      smsAlertsUsedThisWeek: sql`${users.smsAlertsUsedThisWeek} + 1`,
      smsWeekResetDate: sql`COALESCE(${users.smsWeekResetDate}, NOW())`,
    }).where(eq(users.id, userId));
  }

  async resetSmsCount(userId: string): Promise<void> {
    await db.update(users).set({
      smsAlertsUsedThisWeek: 0,
      smsWeekResetDate: new Date(),
    }).where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getDepots(terminalId?: string): Promise<(Depot & { terminalName?: string })[]> {
    const baseQuery = db.select({
      id: depots.id,
      name: depots.name,
      terminalId: depots.terminalId,
      owner: depots.owner,
      active: depots.active,
      terminalName: terminals.name,
    }).from(depots).leftJoin(terminals, eq(depots.terminalId, terminals.id));

    if (terminalId) {
      return baseQuery.where(eq(depots.terminalId, terminalId));
    }
    return baseQuery;
  }

  async getDepot(id: string): Promise<Depot | undefined> {
    const [depot] = await db.select().from(depots).where(eq(depots.id, id)).limit(1);
    return depot;
  }

  async createDepot(data: Omit<Depot, "id">): Promise<Depot> {
    const [created] = await db.insert(depots).values(data).returning();
    return created;
  }

  async getDepotPrices(depotId?: string, productType?: string): Promise<(DepotPrice & { depotName?: string; terminalName?: string; terminalId?: string })[]> {
    const conditions: any[] = [];
    if (depotId) conditions.push(eq(depotPrices.depotId, depotId));
    if (productType) conditions.push(eq(depotPrices.productType, productType));

    const rows = await db.select({
      id: depotPrices.id,
      depotId: depotPrices.depotId,
      productType: depotPrices.productType,
      price: depotPrices.price,
      updatedAt: depotPrices.updatedAt,
      depotName: depots.name,
      terminalName: terminals.name,
      terminalId: depots.terminalId,
    })
    .from(depotPrices)
    .leftJoin(depots, eq(depotPrices.depotId, depots.id))
    .leftJoin(terminals, eq(depots.terminalId, terminals.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(depotPrices.price);

    return rows;
  }

  async createDepotPrice(data: Omit<DepotPrice, "id">): Promise<DepotPrice> {
    const [created] = await db.insert(depotPrices).values(data).returning();
    return created;
  }

  async updateDepotPrice(id: string, price: number): Promise<DepotPrice | undefined> {
    const [updated] = await db.update(depotPrices).set({ price, updatedAt: new Date() }).where(eq(depotPrices.id, id)).returning();
    return updated;
  }

  async getInventory(userId: string, terminalId?: string, productType?: string): Promise<(Inventory & { terminalName?: string })[]> {
    const conditions: any[] = [eq(inventory.userId, userId)];
    if (terminalId) conditions.push(eq(inventory.terminalId, terminalId));
    if (productType) conditions.push(eq(inventory.productType, productType));

    return db.select({
      id: inventory.id,
      userId: inventory.userId,
      terminalId: inventory.terminalId,
      productType: inventory.productType,
      volumeLitres: inventory.volumeLitres,
      averageCost: inventory.averageCost,
      lastUpdated: inventory.lastUpdated,
      terminalName: terminals.name,
    })
    .from(inventory)
    .leftJoin(terminals, eq(inventory.terminalId, terminals.id))
    .where(and(...conditions));
  }

  async getInventoryItem(id: string): Promise<Inventory | undefined> {
    const [item] = await db.select().from(inventory).where(eq(inventory.id, id)).limit(1);
    return item;
  }

  async createInventory(data: Omit<Inventory, "id" | "lastUpdated">): Promise<Inventory> {
    const [created] = await db.insert(inventory).values(data).returning();
    return created;
  }

  async updateInventory(id: string, data: Partial<Pick<Inventory, "volumeLitres" | "averageCost">>): Promise<Inventory | undefined> {
    const [updated] = await db.update(inventory).set({ ...data, lastUpdated: new Date() }).where(eq(inventory.id, id)).returning();
    return updated;
  }

  async getTransactions(inventoryId: string, limit = 50): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(eq(transactions.inventoryId, inventoryId))
      .orderBy(desc(transactions.date))
      .limit(limit);
  }

  async createTransaction(data: Omit<Transaction, "id">): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(data).returning();
    return created;
  }

  async getTraderSignals(terminalId?: string, limit = 50): Promise<(TraderSignal & { userName?: string })[]> {
    const conditions: any[] = [];
    if (terminalId) conditions.push(eq(traderSignals.terminalId, terminalId));

    return db.select({
      id: traderSignals.id,
      userId: traderSignals.userId,
      message: traderSignals.message,
      sentimentScore: traderSignals.sentimentScore,
      impactScore: traderSignals.impactScore,
      terminalId: traderSignals.terminalId,
      productType: traderSignals.productType,
      detectedTerminal: traderSignals.detectedTerminal,
      detectedProduct: traderSignals.detectedProduct,
      keywords: traderSignals.keywords,
      createdAt: traderSignals.createdAt,
      userName: users.name,
    })
    .from(traderSignals)
    .leftJoin(users, eq(traderSignals.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(traderSignals.createdAt))
    .limit(limit);
  }

  async createTraderSignal(data: Omit<TraderSignal, "id" | "createdAt">): Promise<TraderSignal> {
    const [created] = await db.insert(traderSignals).values(data).returning();
    return created;
  }

  async getHedgeRecommendations(userId: string, productType?: string, limit = 20): Promise<HedgeRecommendation[]> {
    const conditions: any[] = [eq(hedgeRecommendations.userId, userId)];
    if (productType) conditions.push(eq(hedgeRecommendations.productType, productType));

    return db.select().from(hedgeRecommendations)
      .where(and(...conditions))
      .orderBy(desc(hedgeRecommendations.createdAt))
      .limit(limit);
  }

  async createHedgeRecommendation(data: Omit<HedgeRecommendation, "id" | "createdAt">): Promise<HedgeRecommendation> {
    const [created] = await db.insert(hedgeRecommendations).values(data).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
