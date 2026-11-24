import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { ADMIN_EMAIL } from "../shared/admin.js";

/* =========================
   TYPES
========================= */

type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  whatsappPhone?: string;
  role: string;
  subscriptionTier?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  assignedTerminalId?: string;
  notificationPrefs?: any;
  forecastsUsedToday?: number;
  smsAlertsUsedThisWeek?: number;
};

type Terminal = {
  id: string;
  name: string;
  code: string;
  state: string;
  active: boolean;
};

type Depot = {
  id: string;
  name: string;
  terminalId: string;
  owner: string;
  active: boolean;
};

type DepotPrice = {
  id: string;
  depotId: string;
  productType: string;
  price: number;
  updatedAt: Date;
  source?: string;
};

type DepotPriceListing = {
  id: string;
  depotId: string;
  depotName: string;
  terminalId: string;
  terminalName: string;
  productType: string;
  price: number;
  updatedAt: Date;
  source: string;
};

type Forecast = {
  id: string;
  terminalId: string;
  productType: string;
  expectedMin: number;
  expectedMax: number;
  bias: string;
  confidence: number;
  suggestedAction: string;
  createdAt: Date;
  depotPrice?: number;
  refineryInfluenceScore?: number;
  importParityPrice?: number;
  demandIndex?: number;
};

type Signal = {
  id: string;
  terminalId: string;
  productType: string;
  vesselActivity?: string;
  truckQueue?: string;
  nnpcSupply?: string;
  fxPressure?: string;
  policyRisk?: string;
  createdAt: Date;
};

type RefineryUpdate = {
  id: string;
  refineryName: string;
  productionCapacity: number;
  operationalStatus: string;
  pmsOutputEstimate: number;
  dieselOutputEstimate: number;
  jetOutputEstimate: number;
  createdAt: Date;
};

type RegulationUpdate = {
  id: string;
  title: string;
  summary: string;
  impactLevel: string;
  effectiveDate: Date;
  source: string;
  createdAt: Date;
};

type PriceHistoryEntry = {
  id: string;
  terminalId: string;
  productType: string;
  date: Date;
  price: number;
  source?: string;
  sourceReference?: string;
};

type Inventory = {
  id: string;
  userId: string;
  terminalId: string;
  productType: string;
  volumeLitres: number;
  averageCost: number;
  createdAt?: Date;
  lastUpdated?: Date;
};

type Transaction = {
  id: string;
  inventoryId: string;
  type: "buy" | "sell";
  volume: number;
  price: number;
};

type FxRate = {
  id: string;
  rate: number;
  source: string;
  createdAt: Date;
};

type NotificationLog = {
  id: string;
  userId: string;
  channel: string;
  message: string;
  type: string;
  createdAt: Date;
};

type SubscriptionPaymentRequest = {
  id: string;
  userId: string;
  subscriptionTier: "basic" | "pro" | "elite";
  amount: number;
  transactionReference: string;
  status: "pending_verification" | "approved" | "rejected";
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
};

/* ================= TRADER SIGNALS ================= */

type TraderSignal = {
  id: string;
  userId: string;
  userName?: string;
  message: string;
  sentimentScore: number;
  impactScore: number;
  terminalId: string;
  productType: string;
  detectedTerminal?: string;
  detectedProduct?: string;
  keywords?: string[];
  createdAt: Date;
};

/* =========================
   STORAGE CLASS
========================= */

class Storage {
  users: User[] = [];
  terminals: Terminal[] = [];
  depots: Depot[] = [];
  depotPrices: DepotPrice[] = [];
  forecasts: Forecast[] = [];
  signals: Signal[] = [];
  inventory: Inventory[] = [];
  transactions: Transaction[] = [];
  fxRates: FxRate[] = [];
  notifications: NotificationLog[] = [];
  subscriptionPaymentRequests: SubscriptionPaymentRequest[] = [];
  traderSignals: TraderSignal[] = []; // Fix TS2552: was traderSignal (lowercase), must be TraderSignal
  priceHistory: PriceHistoryEntry[] = [];
  refineryUpdates: RefineryUpdate[] = [];
  regulationUpdates: RegulationUpdate[] = [];

  private readonly usersFile = path.resolve(
    process.env.FUELIQ_DATA_DIR || path.join(process.cwd(), "data"),
    "users.json",
  );
  private readonly stateFile = path.resolve(
    process.env.FUELIQ_DATA_DIR || path.join(process.cwd(), "data"),
    "storage.json",
  );

  constructor() {
    this.users = this.loadUsers();
    let adminsUpdated = false;
    for (const user of this.users) {
      const shouldBeAdmin = user.email.trim().toLowerCase() === ADMIN_EMAIL;
      const role = shouldBeAdmin ? "admin" : user.role === "admin" ? "marketer" : user.role;
      if (user.role !== role) {
        user.role = role;
        adminsUpdated = true;
      }
    }
    if (adminsUpdated) this.persistUsers();
    this.seedLocalData();
    this.loadState();
  }

  private loadState() {
    try {
      if (!fs.existsSync(this.stateFile)) return;
      const state = JSON.parse(fs.readFileSync(this.stateFile, "utf8"));
      const dateFields: Record<string, string[]> = {
        depotPrices: ["updatedAt"],
        forecasts: ["createdAt"],
        signals: ["createdAt"],
        inventory: ["createdAt", "lastUpdated"],
        priceHistory: ["date"],
        refineryUpdates: ["createdAt"],
        regulationUpdates: ["effectiveDate", "createdAt"],
        subscriptionPaymentRequests: ["createdAt", "reviewedAt"],
      };
      for (const key of [
        "terminals",
        "depots",
        "depotPrices",
        "forecasts",
        "signals",
        "inventory",
        "transactions",
        "fxRates",
        "notifications",
        "subscriptionPaymentRequests",
        "traderSignals",
        "priceHistory",
        "refineryUpdates",
        "regulationUpdates",
      ]) {
        if (Array.isArray(state[key]) && state[key].length > 0) {
          const fields = dateFields[key] || [];
          (this as any)[key] = state[key].map((item: Record<string, unknown>) => {
            const restored = { ...item };
            for (const field of fields) {
              if (typeof restored[field] === "string") {
                restored[field] = new Date(restored[field] as string);
              }
            }
            return restored;
          });
        }
      }
    } catch (error) {
      console.error("Failed to load persisted application data:", error);
    }
  }

  private persistState() {
    const directory = path.dirname(this.stateFile);
    fs.mkdirSync(directory, { recursive: true });
    const state = {
      terminals: this.terminals,
      depots: this.depots,
      depotPrices: this.depotPrices,
      forecasts: this.forecasts,
      signals: this.signals,
      inventory: this.inventory,
      transactions: this.transactions,
      fxRates: this.fxRates,
      notifications: this.notifications,
      subscriptionPaymentRequests: this.subscriptionPaymentRequests,
      traderSignals: this.traderSignals,
      priceHistory: this.priceHistory,
      refineryUpdates: this.refineryUpdates,
      regulationUpdates: this.regulationUpdates,
    };
    const temporaryFile = `${this.stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(temporaryFile, this.stateFile);
  }

  private seedLocalData() {
    const terminalSeeds = [
      ["Apapa", "Lagos", "APA"],
      ["Calabar", "Cross River", "CAL"],
      ["Port Harcourt", "Rivers", "PHC"],
      ["Warri", "Delta", "WAR"],
      ["Onne", "Rivers", "ONN"],
      ["Bonny", "Rivers", "BON"],
      ["Atlas Cove", "Lagos", "ATC"],
      ["Ijegun", "Lagos", "IJG"],
    ] as const;

    for (const [name, state, code] of terminalSeeds) {
      const id = `terminal-${code.toLowerCase()}`;
      this.terminals.push({ id, name, state, code, active: true });

      const signalValues: Record<string, string> = {
        APA: "High|Weak|Medium|Low",
        CAL: "Low|Moderate|Low|Low",
        PHC: "High|Weak|High|Medium",
        WAR: "Medium|Moderate|Medium|Low",
        ONN: "Low|Strong|Low|Low",
        BON: "Low|Moderate|Medium|Low",
        ATC: "High|Weak|Medium|Medium",
        IJG: "High|Weak|High|Low",
      };
      const [truckQueue, nnpcSupply, fxPressure, policyRisk] =
        (signalValues[code] || "Medium|Moderate|Medium|Low").split("|");
      this.signals.push({
        id: `signal-${code.toLowerCase()}`,
        terminalId: id,
        productType: "PMS",
        vesselActivity: "Moderate",
        truckQueue,
        nnpcSupply,
        fxPressure,
        policyRisk,
        createdAt: new Date(),
      });

      const ranges: Record<string, [number, number, string, number, string]> = {
        APA: [620, 635, "bullish", 78, "Load before 6am"],
        CAL: [640, 660, "neutral", 65, "Hold stock"],
        PHC: [615, 630, "bullish", 72, "Buy early"],
        WAR: [625, 645, "neutral", 60, "Steady pricing"],
        ONN: [600, 615, "bearish", 80, "Delay purchases"],
        BON: [610, 625, "neutral", 70, "Off-peak loading"],
        ATC: [618, 632, "bullish", 74, "Pre-load"],
        IJG: [625, 640, "bullish", 76, "Load early"],
      };
      const [expectedMin, expectedMax, bias, confidence, suggestedAction] = ranges[code];
      this.forecasts.push({
        id: `forecast-${code.toLowerCase()}`,
        terminalId: id,
        productType: "PMS",
        expectedMin,
        expectedMax,
        bias,
        confidence,
        suggestedAction,
        createdAt: new Date(),
      });

      for (let daysAgo = 30; daysAgo >= 0; daysAgo -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        this.priceHistory.push({
          id: randomUUID(),
          terminalId: id,
          productType: "PMS",
          date,
          price: expectedMin + ((daysAgo * 7 + code.length) % 20),
          source: "sample",
        });
      }
    }

    this.refineryUpdates.push(
      {
        id: "refinery-dangote",
        refineryName: "Dangote Refinery",
        productionCapacity: 650000,
        operationalStatus: "operational",
        pmsOutputEstimate: 180000,
        dieselOutputEstimate: 120000,
        jetOutputEstimate: 50000,
        createdAt: new Date(),
      },
      {
        id: "refinery-port-harcourt",
        refineryName: "Port Harcourt Refinery",
        productionCapacity: 60000,
        operationalStatus: "maintenance",
        pmsOutputEstimate: 12000,
        dieselOutputEstimate: 9000,
        jetOutputEstimate: 3000,
        createdAt: new Date(),
      },
    );
    this.regulationUpdates.push({
      id: "regulation-fuel-pricing",
      title: "Fuel pricing review",
      summary: "Market participants should monitor supply and foreign exchange conditions.",
      impactLevel: "medium",
      effectiveDate: new Date(),
      source: "FuelIQ market desk",
      createdAt: new Date(),
    });
  }

  private loadUsers(): User[] {
    try {
      if (!fs.existsSync(this.usersFile)) return [];
      const parsed = JSON.parse(fs.readFileSync(this.usersFile, "utf8"));
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (error) {
      console.error("Failed to load persisted users:", error);
      return [];
    }
  }

  private persistUsers() {
    const directory = path.dirname(this.usersFile);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryFile = `${this.usersFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(this.users, null, 2), "utf8");
    fs.renameSync(temporaryFile, this.usersFile);
  }

  /* ================= TRADER SIGNALS ================= */

  async createTraderSignal(data: Partial<TraderSignal>) {
    const signal: TraderSignal = {
      id: randomUUID(),
      createdAt: new Date(),
      sentimentScore: 0,
      impactScore: 0,
      terminalId: "",
      productType: "PMS",
      ...data,
      userName: data.userName || "Anonymous",
    } as TraderSignal;

    this.traderSignals.unshift(signal);
    this.persistState();
    return signal;
  }

  async getTraderSignals(limit: number) {
    if (this.traderSignals.length > 0) {
      return this.traderSignals.slice(0, limit);
    }

    const now = new Date();
    const fallback: TraderSignal[] = [
      {
        id: randomUUID(),
        userId: "system",
        userName: "Market AI",
        message: "Warri terminal queue is heavy and supplies are tightening, expect bullish pressure on PMS.",
        sentimentScore: 0.65,
        impactScore: 0.55,
        terminalId: "",
        productType: "PMS",
        detectedTerminal: "Warri",
        detectedProduct: "PMS",
        keywords: ["queue", "tightening", "bullish"],
        createdAt: new Date(now.getTime() - 1000 * 60 * 35),
      },
      {
        id: randomUUID(),
        userId: "system",
        userName: "Market AI",
        message: "Port Harcourt refinery maintenance is causing lower diesel output and bearish pressure on AGO.",
        sentimentScore: -0.6,
        impactScore: 0.45,
        terminalId: "",
        productType: "AGO",
        detectedTerminal: "Port Harcourt",
        detectedProduct: "AGO",
        keywords: ["maintenance", "lower output", "bearish"],
        createdAt: new Date(now.getTime() - 1000 * 60 * 90),
      },
    ];

    return fallback.slice(0, limit);
  }

  async getTraderSignalsByTerminal(terminalId: string, limit: number) {
    return this.traderSignals
      .filter(s => s.terminalId === terminalId)
      .slice(0, limit);
  }

  /* ================= USERS ================= */

  async createUser(data: Partial<User>) {
    const user: User = {
      id: randomUUID(),
      role: "marketer",
      subscriptionTier: "free",
      forecastsUsedToday: 0,
      smsAlertsUsedThisWeek: 0,
      ...data,
    } as User;
    this.users.push(user);
    this.persistUsers();
    return user;
  }

  async getUser(id: string) {
    return this.users.find(u => u.id === id);
  }

  async getUserByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    return this.users.find(u => u.email.trim().toLowerCase() === normalizedEmail);
  }

  async getAllUsers() {
    return this.users;
  }

  async updateUser(id: string, data: Partial<User>) {
    const user = await this.getUser(id);
    if (!user) return null;
    Object.assign(user, data);
    this.persistUsers();
    return user;
  }

  async getSubscribedUsers() {
    return this.users.filter(u => u.subscriptionTier !== "free");
  }

  async incrementForecastCount(userId: string) {
    const user = await this.getUser(userId);
    if (!user) return null;
    user.forecastsUsedToday = (user.forecastsUsedToday ?? 0) + 1;
    this.persistUsers();
    return user;
  }

  async createSubscriptionPaymentRequest(data: {
    userId: string;
    subscriptionTier: "basic" | "pro" | "elite";
    amount: number;
    transactionReference: string;
  }) {
    const normalizedReference = data.transactionReference.trim().toUpperCase();
    if (
      this.subscriptionPaymentRequests.some(
        request => request.transactionReference.toUpperCase() === normalizedReference,
      )
    ) return null;

    const request: SubscriptionPaymentRequest = {
      id: randomUUID(),
      ...data,
      transactionReference: normalizedReference,
      status: "pending_verification",
      createdAt: new Date(),
    };
    this.subscriptionPaymentRequests.unshift(request);
    this.persistState();
    return request;
  }

  async getSubscriptionPaymentRequests(userId?: string) {
    return this.subscriptionPaymentRequests
      .filter(request => !userId || request.userId === userId)
      .map(request => {
        const user = this.users.find(item => item.id === request.userId);
        return {
          ...request,
          userName: user?.name || "Unknown user",
          email: user?.email || "",
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async reviewSubscriptionPaymentRequest(
    requestId: string,
    decision: "approved" | "rejected",
    reviewedBy: string,
  ) {
    const request = this.subscriptionPaymentRequests.find(item => item.id === requestId);
    if (!request || request.status !== "pending_verification") return null;

    if (decision === "approved") {
      const user = this.users.find(item => item.id === request.userId);
      if (!user) return null;
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      Object.assign(user, {
        subscriptionTier: request.subscriptionTier,
        subscriptionStartDate: startsAt,
        subscriptionEndDate: endsAt,
      });
      this.persistUsers();
    }

    request.status = decision;
    request.reviewedAt = new Date();
    request.reviewedBy = reviewedBy;
    this.persistState();
    const user = this.users.find(item => item.id === request.userId);
    return {
      ...request,
      userName: user?.name || "Unknown user",
      email: user?.email || "",
    };
  }

  /* ================= TERMINALS ================= */

  async getAllTerminals() {
    return this.terminals;
  }

  async getTerminal(id: string) {
    return this.terminals.find(t => t.id === id);
  }

  async updateTerminal(id: string, data: Partial<Terminal>) {
    const t = await this.getTerminal(id);
    if (!t) return null;
    Object.assign(t, data);
    this.persistState();
    return t;
  }

  /* ================= DEPOTS ================= */

  async getDepots(terminalId?: string) {
    return terminalId
      ? this.depots.filter(d => d.terminalId === terminalId)
      : this.depots;
  }

  async getDepot(id: string) {
    return this.depots.find(d => d.id === id);
  }

  async createDepot(data: Partial<Depot>) {
    const depot: Depot = { id: randomUUID(), ...data } as Depot;
    this.depots.push(depot);
    return depot;
  }

  /* ================= DEPOT PRICES ================= */

  async getDepotPrices(depotId?: string, productType?: string) {
    const requestedDepot = depotId ? this.depots.find(depot => depot.id === depotId) : undefined;
    if (depotId && !requestedDepot) return [];

    const histories = this.priceHistory
      .filter(entry =>
        (!productType || entry.productType === productType) &&
        (!requestedDepot || entry.terminalId === requestedDepot.terminalId)
      )
      .sort((a, b) => {
        const sourcePriority = (entry: PriceHistoryEntry) =>
          entry.source && entry.source !== "sample" ? 1 : 0;
        return sourcePriority(b) - sourcePriority(a) || b.date.getTime() - a.date.getTime();
      });
    const latestByLocationProduct = new Map<string, PriceHistoryEntry>();
    for (const entry of histories) {
      const key = `${entry.terminalId}:${entry.productType}`;
      if (!latestByLocationProduct.has(key)) latestByLocationProduct.set(key, entry);
    }

    const results: DepotPriceListing[] = [];
    const representedDepotPrices = new Set<string>();
    for (const entry of latestByLocationProduct.values()) {
      const terminal = this.terminals.find(item => item.id === entry.terminalId);
      if (!terminal) continue;
      const depot = this.depots.find(item => item.terminalId === terminal.id);
      if (depotId && depot?.id !== depotId) continue;

      const storedPrice = depot
        ? this.depotPrices
            .filter(price => price.depotId === depot.id && price.productType === entry.productType)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
        : undefined;
      if (storedPrice) representedDepotPrices.add(storedPrice.id);
      const useStoredPrice = !!storedPrice &&
        (entry.source === "sample" || !entry.source || storedPrice.updatedAt > entry.date);
      results.push({
        id: useStoredPrice ? storedPrice!.id : entry.id,
        depotId: depot?.id || terminal.id,
        depotName: depot?.name || terminal.name,
        terminalId: terminal.id,
        terminalName: terminal.name,
        productType: entry.productType,
        price: useStoredPrice ? storedPrice!.price : entry.price,
        updatedAt: useStoredPrice ? storedPrice!.updatedAt : entry.date,
        source: useStoredPrice ? storedPrice!.source || "admin" : entry.source || "sample",
      });
    }

    for (const price of this.depotPrices) {
      if (
        representedDepotPrices.has(price.id) ||
        (depotId && price.depotId !== depotId) ||
        (productType && price.productType !== productType)
      ) continue;
      const depot = this.depots.find(item => item.id === price.depotId);
      if (!depot) continue;
      const terminal = this.terminals.find(item => item.id === depot.terminalId);
      results.push({
        ...price,
        depotName: depot.name,
        terminalId: depot.terminalId,
        terminalName: terminal?.name || null,
        source: price.source || "admin",
      });
    }

    return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async createDepotPrice(data: Partial<DepotPrice>) {
    const price: DepotPrice = {
      id: randomUUID(),
      updatedAt: new Date(),
      ...data,
    } as DepotPrice;
    this.depotPrices.unshift(price);
    this.persistState();
    return price;
  }

  async updateDepotPrice(id: string, price: number) {
    const p = this.depotPrices.find(p => p.id === id);
    if (!p) return null;
    p.price = price;
    p.updatedAt = new Date();
    this.persistState();
    return p;
  }

  /* ================= FORECAST ================= */

  async createForecast(data: Partial<Forecast>) {
    const forecast: Forecast = {
      id: randomUUID(),
      createdAt: new Date(),
      ...data,
    } as Forecast;
    this.forecasts.unshift(forecast);
    this.persistState();
    return forecast;
  }

  async getLatestForecast(terminalId: string, productType: string) {
    return this.forecasts.find(
      f => f.terminalId === terminalId && f.productType === productType
    );
  }

  async getForecasts(terminalId: string, limit: number) {
    return this.forecasts
      .filter(f => f.terminalId === terminalId)
      .slice(0, limit);
  }

  async getAllForecasts(limit: number) {
    return this.forecasts.slice(0, limit);
  }

  /* ================= SIGNAL ================= */

  async createSignal(data: Partial<Signal>) {
    const signal: Signal = {
      id: randomUUID(),
      createdAt: new Date(),
      ...data,
    } as Signal;
    this.signals.unshift(signal);
    this.persistState();
    return signal;
  }

  async getLatestSignal(terminalId: string, productType?: string) {
    return this.signals.find(
      s =>
        s.terminalId === terminalId &&
        (!productType || s.productType === productType)
    );
  }

  async getSignalHistory(terminalId: string, limit: number) {
    return this.signals
      .filter(s => s.terminalId === terminalId)
      .slice(0, limit);
  }

  /* ================= INVENTORY ================= */

  async getInventory(userId: string) {
    const items = this.inventory.filter(i => i.userId === userId);
    return items.map(i => {
      const terminal = this.terminals.find(t => t.id === i.terminalId);
      return {
        ...i,
        terminalName: (terminal && terminal.name) || (i as any).terminalName || null,
        lastUpdated: i.lastUpdated || i.createdAt || new Date(),
      } as any;
    });
  }

  async getInventoryItem(id: string) {
    return this.inventory.find(i => i.id === id);
  }

  async createInventory(data: Partial<Inventory>) {
    const now = new Date();
    const item: Inventory = { id: randomUUID(), lastUpdated: now, ...data } as Inventory;
    const terminal = this.terminals.find(t => t.id === item.terminalId);
    const enriched: any = {
      ...item,
      terminalName: terminal?.name || null,
      lastUpdated: item.lastUpdated || now,
    };
    this.inventory.push(enriched as Inventory);
    this.persistState();
    return enriched;
  }

  async updateInventory(id: string, data: Partial<Inventory>) {
    const item = await this.getInventoryItem(id);
    if (!item) return null;
    Object.assign(item, data);
    (item as any).lastUpdated = new Date();
    const terminal = this.terminals.find(t => t.id === item.terminalId);
    (item as any).terminalName = terminal?.name || (item as any).terminalName || null;
    this.persistState();
    return item;
  }

  async createTransaction(data: Partial<Transaction>) {
    const tx: Transaction = { id: randomUUID(), ...data } as Transaction;
    this.transactions.push(tx);
    this.persistState();
    return tx;
  }

  async getTransactions(inventoryId: string) {
    return this.transactions.filter(t => t.inventoryId === inventoryId);
  }

  /* ================= FX ================= */

  async createFxRate(data: Partial<FxRate>) {
    const rate: FxRate = {
      id: randomUUID(),
      createdAt: new Date(),
      ...data,
    } as FxRate;
    this.fxRates.unshift(rate);
    return rate;
  }

  async getFxRates(limit: number) {
    return this.fxRates.slice(0, limit);
  }

  async getLatestFxRate() {
    return this.fxRates[0];
  }

  /* ================= NOTIFICATIONS ================= */

  async createNotificationLog(userId: string, channel: string, message: string, type: string) {
    const log: NotificationLog = {
      id: randomUUID(),
      userId,
      channel,
      message,
      type,
      createdAt: new Date(),
    };
    this.notifications.unshift(log);
    return log;
  }

  async getNotificationLogs(userId: string, limit: number) {
    return this.notifications
      .filter(n => n.userId === userId)
      .slice(0, limit);
  }

  /* ================= PLACEHOLDERS ================= */

  async getRefineryUpdates(limit: number) {
    if (this.refineryUpdates.length > 0) {
      return this.refineryUpdates.slice(0, limit);
    }

    const fallbackUpdates: RefineryUpdate[] = [
      {
        id: randomUUID(),
        refineryName: "Dangote Refinery",
        productionCapacity: 650000,
        operationalStatus: "operational",
        pmsOutputEstimate: 450000,
        dieselOutputEstimate: 120000,
        jetOutputEstimate: 60000,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        refineryName: "Port Harcourt Refinery",
        productionCapacity: 420000,
        operationalStatus: "maintenance",
        pmsOutputEstimate: 0,
        dieselOutputEstimate: 0,
        jetOutputEstimate: 0,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      },
      {
        id: randomUUID(),
        refineryName: "Warri Refinery",
        productionCapacity: 500000,
        operationalStatus: "operational",
        pmsOutputEstimate: 380000,
        dieselOutputEstimate: 110000,
        jetOutputEstimate: 45000,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
      },
    ];

    return fallbackUpdates.slice(0, limit);
  }

  async getRegulationUpdates(limit: number) {
    if (this.regulationUpdates.length > 0) {
      return this.regulationUpdates.slice(0, limit);
    }

    const now = new Date();
    const fallback: RegulationUpdate[] = [
      {
        id: randomUUID(),
        title: "NNPC Price Adjustment",
        summary: "Pump price was adjusted due to FX pressure and supply constraints.",
        impactLevel: "medium",
        effectiveDate: new Date(now.getTime() + 1000 * 60 * 60 * 24),
        source: "Government",
        createdAt: new Date(now.getTime() - 1000 * 60 * 35),
      },
      {
        id: randomUUID(),
        title: "Fuel Import Quota Review",
        summary: "Regulators are reviewing import quotas that may shift wholesale margins.",
        impactLevel: "high",
        effectiveDate: new Date(now.getTime() + 1000 * 60 * 60 * 72),
        source: "Ministry of Petroleum",
        createdAt: new Date(now.getTime() - 1000 * 60 * 80),
      },
      {
        id: randomUUID(),
        title: "Safety Compliance Update",
        summary: "New refinery safety rules are being introduced to reduce downtime risk.",
        impactLevel: "low",
        effectiveDate: new Date(now.getTime() + 1000 * 60 * 60 * 48),
        source: "Nigerian Safety Board",
        createdAt: new Date(now.getTime() - 1000 * 60 * 180),
      },
    ];

    return fallback.slice(0, limit);
  }

  async getHighImpactRegulations() {
    const regulations = this.regulationUpdates.length > 0
      ? this.regulationUpdates
      : await this.getRegulationUpdates(20);

    return regulations.filter((reg) => reg.impactLevel === "high").slice(0, 5);
  }

  async getHedgeRecommendations(userId: string) {
    return [];
  }

  async createHedgeRecommendation(data: any) {
    return data;
  }

  async getPriceHistory(terminalId: string, days: number, productType: string) {
    const allHistory = this.priceHistory
      .filter((entry) => entry.terminalId === terminalId && entry.productType === productType)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return allHistory.slice(-days);
  }

  async recordPriceObservation(data: {
    location: string;
    productType: string;
    price: number;
    source: string;
    observedAt?: Date;
    sourceReference?: string;
    deduplicateUnchangedPrice?: boolean;
  }) {
    const normalizedLocation = data.location.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const terminal = this.terminals.find(item => {
      const names = [item.name, item.code].map(value =>
        value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
      );
      return names.some(name => normalizedLocation === name || normalizedLocation.includes(name));
    });
    if (!terminal) throw new Error(`Unknown price location: ${data.location}`);
    if (!Number.isFinite(data.price) || data.price <= 0) throw new Error("Price must be a positive number");

    if (data.sourceReference) {
      const duplicate = this.priceHistory.find(entry => entry.sourceReference === data.sourceReference);
      if (duplicate) return { ...duplicate, created: false, priceChanged: false };
    }

    const previousQuote = this.priceHistory
      .filter(item =>
        item.terminalId === terminal.id &&
        item.productType === data.productType &&
        item.source === data.source
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    if (data.deduplicateUnchangedPrice && previousQuote?.price === data.price) {
      return { ...previousQuote, created: false, priceChanged: false };
    }

    const observedAt = data.observedAt && Number.isFinite(data.observedAt.getTime())
      ? data.observedAt
      : new Date();
    const existingQuote = this.priceHistory.find(item =>
      item.terminalId === terminal.id &&
      item.productType === data.productType &&
      item.source === data.source &&
      item.price === data.price &&
      item.date.getTime() === observedAt.getTime() &&
      (!data.sourceReference || item.sourceReference === data.sourceReference)
    );
    if (existingQuote) return { ...existingQuote, created: false, priceChanged: false };

    const entry: PriceHistoryEntry = {
      id: randomUUID(),
      terminalId: terminal.id,
      productType: data.productType,
      date: observedAt,
      price: data.price,
      source: data.source,
      sourceReference: data.sourceReference,
    };
    this.priceHistory.push(entry);
    if (this.priceHistory.length > 10_000) {
      this.priceHistory.sort((a, b) => a.date.getTime() - b.date.getTime());
      this.priceHistory.splice(0, this.priceHistory.length - 10_000);
    }
    this.persistState();
    return {
      ...entry,
      created: true,
      priceChanged: !previousQuote || previousQuote.price !== entry.price,
    };
  }
}

/* =========================
   EXPORT INSTANCE
========================= */

export const storage = new Storage();
