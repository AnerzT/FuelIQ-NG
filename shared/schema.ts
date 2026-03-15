import { pgTable, text, serial, integer, timestamp, boolean, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── USERS ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  name: text("name"),
  phone: text("phone"),
  whatsappPhone: text("whatsapp_phone"),
  notificationPrefs: jsonb("notification_prefs"),
  role: text("role").default("user"),
  subscriptionTier: text("subscription_tier").default("free"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  assignedTerminalId: text("assigned_terminal_id"),
  forecastsUsedToday: integer("forecasts_used_today").default(0),
  forecastDayResetDate: timestamp("forecast_day_reset_date"),
  smsAlertsUsedThisWeek: integer("sms_alerts_used_this_week").default(0),
  smsWeekResetDate: timestamp("sms_week_reset_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── TERMINALS ───────────────────────────────────────────────────────────────
export const terminals = pgTable("terminals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").unique(),
  state: text("state"),
  location: text("location").notNull(),
  region: text("region"),
  capacity: doublePrecision("capacity"),
  active: boolean("active").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── FORECASTS ───────────────────────────────────────────────────────────────
export const forecasts = pgTable("forecasts", {
  id: serial("id").primaryKey(),
  terminalId: text("terminal_id").notNull(),
  productType: text("product_type").notNull(),
  expectedMin: doublePrecision("expected_min").notNull(),
  expectedMax: doublePrecision("expected_max").notNull(),
  depotPrice: doublePrecision("depot_price").default(0),
  refineryInfluenceScore: doublePrecision("refinery_score").default(0),
  importParityPrice: doublePrecision("import_parity").default(0),
  demandIndex: doublePrecision("demand_index").default(0),
  bias: text("bias").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  suggestedAction: text("suggested_action").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── MARKET SIGNALS ──────────────────────────────────────────────────────────
export const marketSignals = pgTable("market_signals", {
  id: serial("id").primaryKey(),
  terminalId: text("terminal_id").notNull(),
  productType: text("product_type").default("PMS"),
  signalType: text("signal_type"),
  value: doublePrecision("value"),
  description: text("description"),
  vesselActivity: text("vessel_activity"),
  truckQueue: text("truck_queue"),
  nnpcSupply: text("nnpc_supply"),
  fxPressure: text("fx_pressure"),
  policyRisk: text("policy_risk"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── PRICE HISTORY ───────────────────────────────────────────────────────────
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  terminalId: text("terminal_id").notNull(),
  productType: text("product_type").notNull(),
  price: doublePrecision("price").notNull(),
  source: text("source"),
  date: timestamp("date").defaultNow(),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// ─── DEPOTS ──────────────────────────────────────────────────────────────────
export const depots = pgTable("depots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  region: text("region"),
  terminalId: text("terminal_id"),
  owner: text("owner"),
  active: boolean("active").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── DEPOT PRICES ─────────────────────────────────────────────────────────────
export const depotPrices = pgTable("depot_prices", {
  id: serial("id").primaryKey(),
  depotId: text("depot_id").notNull(),
  productType: text("product_type").notNull(),
  price: doublePrecision("price").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// ─── REFINERY UPDATES ─────────────────────────────────────────────────────────
export const refineryUpdates = pgTable("refinery_updates", {
  id: serial("id").primaryKey(),
  refineryName: text("refinery_name").notNull(),
  status: text("status").notNull(),
  operationalStatus: text("operational_status"),
  outputLevel: doublePrecision("output_level"),
  productionCapacity: doublePrecision("production_capacity"),
  pmsOutputEstimate: doublePrecision("pms_output_estimate"),
  dieselOutputEstimate: doublePrecision("diesel_output_estimate"),
  jetOutputEstimate: doublePrecision("jet_output_estimate"),
  notes: text("notes"),
  reportedAt: timestamp("reported_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── REGULATION UPDATES ───────────────────────────────────────────────────────
export const regulationUpdates = pgTable("regulation_updates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  impactLevel: text("impact_level"),
  effectiveDate: timestamp("effective_date"),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── EXTERNAL PRICE FEEDS ─────────────────────────────────────────────────────
export const externalPriceFeeds = pgTable("external_price_feeds", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  sourceName: text("source_name"),
  terminalId: text("terminal_id"),
  productType: text("product_type").notNull(),
  price: doublePrecision("price").notNull(),
  currency: text("currency").default("NGN"),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── FX RATES ─────────────────────────────────────────────────────────────────
export const fxRates = pgTable("fx_rates", {
  id: serial("id").primaryKey(),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: doublePrecision("rate").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── NOTIFICATION LOGS ────────────────────────────────────────────────────────
export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  channel: text("channel").notNull(),
  message: text("message").notNull(),
  alertType: text("alert_type"),
  status: text("status").default("sent"),
  sentAt: timestamp("sent_at").defaultNow(),
});

// ─── INVENTORY ────────────────────────────────────────────────────────────────
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  terminalId: text("terminal_id").notNull(),
  productType: text("product_type").notNull(),
  volumeLitres: doublePrecision("volume_litres").notNull(),
  averageCost: doublePrecision("average_cost"),
  quantityLitres: doublePrecision("quantity_litres"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  inventoryId: text("inventory_id"),
  type: text("type").notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: text("currency").default("NGN"),
  status: text("status").default("pending"),
  reference: text("reference"),
  date: timestamp("date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── TRADER SIGNALS ───────────────────────────────────────────────────────────
export const traderSignals = pgTable("trader_signals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  terminalId: text("terminal_id").notNull(),
  productType: text("product_type").notNull(),
  action: text("action"),
  message: text("message"),
  sentimentScore: doublePrecision("sentiment_score"),
  impactScore: doublePrecision("impact_score"),
  detectedTerminal: text("detected_terminal"),
  detectedProduct: text("detected_product"),
  keywords: jsonb("keywords"),
  confidence: doublePrecision("confidence"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── HEDGE RECOMMENDATIONS ────────────────────────────────────────────────────
export const hedgeRecommendations = pgTable("hedge_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productType: text("product_type").notNull(),
  strategy: text("strategy").notNull(),
  rationale: text("rationale"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── INSERT SCHEMAS ───────────────────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});
export const insertForecastSchema = createInsertSchema(forecasts);
export const insertSignalSchema = createInsertSchema(marketSignals);
export const insertMarketSignalSchema = createInsertSchema(marketSignals);
export const insertRefineryUpdateSchema = createInsertSchema(refineryUpdates);
export const insertRegulationUpdateSchema = createInsertSchema(regulationUpdates);
export const insertExternalPriceFeedSchema = createInsertSchema(externalPriceFeeds);
export const insertFxRateSchema = createInsertSchema(fxRates);

export const loginSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().optional(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(6),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

export const updateNotificationPrefsSchema = z.object({
  phone: z.string().optional(),
  whatsappPhone: z.string().optional(),
  notificationPrefs: z.record(z.any()).optional(),
});

export const updateSubscriptionSchema = z.object({
  subscriptionTier: z.enum(["free", "basic", "pro", "elite", "enterprise"]).optional(),
  tier: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  assignedTerminalId: z.string().optional(),
});

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export type SubscriptionTier = "free" | "basic" | "pro" | "elite" | "enterprise";

export const TIER_LIMITS = {
  free:       { label: "Free",       forecasts: 3,   forecastsPerDay: 3,   smsAlerts: 0,  smsAlertsPerWeek: 0,  dataDelay: 60 },
  basic:      { label: "Basic",      forecasts: 10,  forecastsPerDay: 10,  smsAlerts: 5,  smsAlertsPerWeek: 5,  dataDelay: 30 },
  pro:        { label: "Pro",        forecasts: 50,  forecastsPerDay: 50,  smsAlerts: 20, smsAlertsPerWeek: 20, dataDelay: 0  },
  elite:      { label: "Elite",      forecasts: 100, forecastsPerDay: 100, smsAlerts: 50, smsAlertsPerWeek: 50, dataDelay: 0  },
  enterprise: { label: "Enterprise", forecasts: 999, forecastsPerDay: 999, smsAlerts: 99, smsAlertsPerWeek: 99, dataDelay: 0  },
} satisfies Record<SubscriptionTier, { label: string; forecasts: number; forecastsPerDay: number; smsAlerts: number; smsAlertsPerWeek: number; dataDelay: number }>;

export const PRODUCT_TYPES = ["PMS", "AGO", "DPK", "LPG"] as const;
export type ProductType = typeof PRODUCT_TYPES[number];

export type NotificationPrefs = {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  forecastAlerts: boolean;
  priceAlerts: boolean;
  refineryAlerts: boolean;
  morningDigest: boolean;
  [key: string]: boolean;
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Forecast = typeof forecasts.$inferSelect;
export type InsertForecast = z.infer<typeof insertForecastSchema>;
export type Signal = typeof marketSignals.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Terminal = typeof terminals.$inferSelect;
export type MarketSignal = typeof marketSignals.$inferSelect;
export type PriceHistoryEntry = typeof priceHistory.$inferSelect;
export type RefineryUpdate = typeof refineryUpdates.$inferSelect;
export type InsertRefineryUpdate = z.infer<typeof insertRefineryUpdateSchema>;
export type RegulationUpdate = typeof regulationUpdates.$inferSelect;
export type InsertRegulationUpdate = z.infer<typeof insertRegulationUpdateSchema>;
export type ExternalPriceFeed = typeof externalPriceFeeds.$inferSelect;
export type InsertExternalPriceFeed = z.infer<typeof insertExternalPriceFeedSchema>;
export type FxRate = typeof fxRates.$inferSelect;
export type InsertFxRate = z.infer<typeof insertFxRateSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type Depot = typeof depots.$inferSelect;
export type DepotPrice = typeof depotPrices.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type TraderSignal = typeof traderSignals.$inferSelect;
export type HedgeRecommendation = typeof hedgeRecommendations.$inferSelect;
