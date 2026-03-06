import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
import {
  users, terminals, marketSignals, forecasts, priceHistory,
  refineryUpdates, regulationUpdates, externalPriceFeeds, fxRates, notificationLogs,
  type User, type InsertUser, type Terminal, type MarketSignal, type Forecast, type PriceHistoryEntry,
  type RefineryUpdate, type RegulationUpdate, type ExternalPriceFeed, type FxRate, type NotificationLog,
  type InsertRefineryUpdate, type InsertRegulationUpdate, type InsertExternalPriceFeed, type InsertFxRate,
  type NotificationPrefs,
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

  async updateTerminal(id: string, data: Partial<Pick<Terminal, "active" | "name" | "state">>): Promise<Terminal | undefined> {
    const [updated] = await db.update(terminals).set(data).where(eq(terminals.id, id)).returning();
    return updated;
  }

  async getAllForecasts(limit = 50): Promise<(Forecast & { terminalName?: string })[]> {
    const rows = await db
      .select({
        id: forecasts.id,
        terminalId: forecasts.terminalId,
        expectedMin: forecasts.expectedMin,
        expectedMax: forecasts.expectedMax,
        bias: forecasts.bias,
        confidence: forecasts.confidence,
        suggestedAction: forecasts.suggestedAction,
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
        expectedMin: forecasts.expectedMin,
        expectedMax: forecasts.expectedMax,
        bias: forecasts.bias,
        confidence: forecasts.confidence,
        suggestedAction: forecasts.suggestedAction,
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
}

export const storage = new DatabaseStorage();
