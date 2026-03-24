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
    return this.depotPrices.filter(p =>
      (!depotId || p.depotId === depotId) &&
      (!productType || p.productType === productType)
    );
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
    return this.inventory.filter(i => i.userId === userId);
  }

  async getInventoryItem(id: string) {
    return this.inventory.find(i => i.id === id);
  }

  async createInventory(data: Partial<Inventory>) {
    const item: Inventory = { id: randomUUID(), ...data } as Inventory;
    this.inventory.push(item);
    return item;
  }

  async updateInventory(id: string, data: Partial<Inventory>) {
    const item = await this.getInventoryItem(id);
    if (!item) return null;
    Object.assign(item, data);
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
    return [];
  }

  async getRegulationUpdates(limit: number) {
    return [];
  }

  async getHighImpactRegulations() {
    return [];
  }

  async getHedgeRecommendations(userId: string) {
    return [];
  }

  async createHedgeRecommendation(data: any) {
    return data;
  }

  async getPriceHistory(terminalId: string, days: number, productType: string) {
    return [];
  }
}

/* =========================
   EXPORT INSTANCE
========================= */

export const storage = new Storage();
