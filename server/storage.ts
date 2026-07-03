import { randomUUID } from "crypto";

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
};

type Inventory = {
  id: string;
  userId: string;
  terminalId: string;
  productType: string;
  volumeLitres: number;
  averageCost: number;
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
  traderSignals: TraderSignal[] = []; // Fix TS2552: was traderSignal (lowercase), must be TraderSignal
  priceHistory: PriceHistoryEntry[] = [];
  refineryUpdates: RefineryUpdate[] = [];
  regulationUpdates: RegulationUpdate[] = [];

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
    const user: User = { id: randomUUID(), role: "marketer", ...data } as User;
    this.users.push(user);
    return user;
  }

  async getUser(id: string) {
    return this.users.find(u => u.id === id);
  }

  async getUserByEmail(email: string) {
    return this.users.find(u => u.email === email);
  }

  async getAllUsers() {
    return this.users;
  }

  async updateUser(id: string, data: Partial<User>) {
    const user = await this.getUser(id);
    if (!user) return null;
    Object.assign(user, data);
    return user;
  }

  async getSubscribedUsers() {
    return this.users.filter(u => u.subscriptionTier !== "free");
  }

  async incrementForecastCount(userId: string) {
    const user = await this.getUser(userId);
    if (!user) return null;
    user.forecastsUsedToday = (user.forecastsUsedToday ?? 0) + 1;
    return user;
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
    const filtered = this.depotPrices.filter(p =>
      (!depotId || p.depotId === depotId) &&
      (!productType || p.productType === productType)
    );

    const enriched = filtered.map(p => {
      const depot = this.depots.find(d => d.id === p.depotId);
      const terminal = depot ? this.terminals.find(t => t.id === depot.terminalId) : undefined;
      return {
        ...p,
        depotName: depot?.name || null,
        terminalId: depot?.terminalId || null,
        terminalName: terminal?.name || null,
      } as any;
    });

    if (enriched.length > 0) return enriched;

    // Fallback sample prices when storage is empty
    const now = new Date();
    const basePrice = productType === "AGO" ? 950 : productType === "JET_A1" ? 880 : productType === "LPG" ? 1100 : 620;
    const sourceTerminals = this.terminals.length > 0 ? this.terminals : [{ id: "SAMPLE_T1", name: "Sample Terminal" }];

    const fallback = sourceTerminals.slice(0, 6).map((t, i) => ({
      id: randomUUID(),
      depotId: `fallback-${i}`,
      depotName: `${t.name || "Depot"} ${i + 1}`,
      terminalId: t.id,
      terminalName: t.name,
      productType: productType || "PMS",
      price: basePrice + Math.floor(Math.random() * 30),
      updatedAt: new Date(now.getTime() - i * 1000 * 60),
    }));

    return fallback;
  }

  async createDepotPrice(data: Partial<DepotPrice>) {
    const price: DepotPrice = {
      id: randomUUID(),
      updatedAt: new Date(),
      ...data,
    } as DepotPrice;
    this.depotPrices.unshift(price);
    return price;
  }

  async updateDepotPrice(id: string, price: number) {
    const p = this.depotPrices.find(p => p.id === id);
    if (!p) return null;
    p.price = price;
    p.updatedAt = new Date();
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
        lastUpdated: (i as any).lastUpdated || i.createdAt || new Date(),
      } as any;
    });
  }

  async getInventoryItem(id: string) {
    return this.inventory.find(i => i.id === id);
  }

  async createInventory(data: Partial<Inventory>) {
    const now = new Date();
    const item: Inventory = { id: randomUUID(), createdAt: now, ...data } as Inventory;
    const terminal = this.terminals.find(t => t.id === item.terminalId);
    const enriched: any = {
      ...item,
      terminalName: terminal?.name || null,
      lastUpdated: now,
    };
    this.inventory.push(enriched as Inventory);
    return enriched;
  }

  async updateInventory(id: string, data: Partial<Inventory>) {
    const item = await this.getInventoryItem(id);
    if (!item) return null;
    Object.assign(item, data);
    (item as any).lastUpdated = new Date();
    const terminal = this.terminals.find(t => t.id === item.terminalId);
    (item as any).terminalName = terminal?.name || (item as any).terminalName || null;
    return item;
  }

  async createTransaction(data: Partial<Transaction>) {
    const tx: Transaction = { id: randomUUID(), ...data } as Transaction;
    this.transactions.push(tx);
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

    if (allHistory.length > 0) {
      return allHistory.slice(-days);
    }

    const basePrice = productType === "AGO" ? 950 : productType === "JET_A1" ? 880 : productType === "LPG" ? 1100 : 620;
    const today = new Date();
    return Array.from({ length: days }).map((_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1 - index));
      const variance = Math.round((Math.sin(index / 3) * 8 + Math.random() * 10) * 10) / 10;
      return {
        id: randomUUID(),
        terminalId,
        productType,
        date,
        price: Math.max(300, basePrice + variance),
      };
    });
  }
}

/* =========================
   EXPORT INSTANCE
========================= */

export const storage = new Storage();
