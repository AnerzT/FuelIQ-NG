import { pgTable, text, integer, timestamp, boolean, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── USERS ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("marketer"),
  phone: text("phone"),
  whatsappPhone: text("whatsapp_phone"),
  notificationPrefs: jsonb("notification_prefs"),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  smsAlertsUsedThisWeek: integer("sms_alerts_used_this_week").notNull().default(0),
  smsWeekResetDate: timestamp("sms_week_reset_date"),
  forecastsUsedToday: integer("forecasts_used_today").notNull().default(0),
  forecastDayResetDate: timestamp("forecast_day_reset_date"),
  assignedTerminalId: text("assigned_terminal_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── TERMINALS ───────────────────────────────────────────────────────────────
export const terminals = pgTable("terminals", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  state: text("state").notNull(),
  active: boolean("active").notNull().default(true),
});

// ─── FORECASTS ───────────────────────────────────────────────────────────────
export const forecasts = pgTable("forecasts", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  terminalId: text("terminal_id").notNull().references(() => terminals.id),
  productType: text("product_type").notNull().default("PMS"),
  expectedMin: doublePrecision("expected_min").notNull(),
  expectedMax: doublePrecision("expected_max").notNull(),
  bias: text("bias").notNull().default("neutral"),
  confidence: integer("confidence").notNull(),
  suggestedAction: text("suggested_action").notNull(),
  depotPrice: doublePrecision("depot_price"),
  refineryInfluenceScore: doublePrecision("refinery_influence_score"),
  importParityPrice: doublePrecision("import_parity_price"),
  demandIndex: doublePrecision("demand_index"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── MARKET SIGNALS ──────────────────────────────────────────────────────────
export const marketSignals = pgTable("market_signals", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  terminalId: text("terminal_id").notNull().references(() => terminals.id),
  productType: text("product_type").notNull().default("PMS"),
  vesselActivity: text("vessel_activity").notNull(),
  truckQueue: text("truck_queue").notNull(),
  nnpcSupply: text("nnpc_supply").notNull(),
  fxPressure: text("fx_pressure").notNull(),
  policyRisk: text("policy_risk").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── PRICE HISTORY ───────────────────────────────────────────────────────────
export const priceHistory = pgTable("price_history", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  terminalId: text("terminal_id").notNull().references(() => terminals.id),
  productType: text("product_type").notNull().default("PMS"),
  date: timestamp("date").notNull(),
  price: doublePrecision("price").notNull(),
});

// ─── DEPOTS ──────────────────────────────────────────────────────────────────
export const depots = pgTable("depots", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  terminalId: text("terminal_id").notNull().references(() => terminals.id),
  owner: text("owner").notNull(),
  active: boolean("active").notNull().default(true),
});

// ─── DEPOT PRICES ─────────────────────────────────────────────────────────────
export const depotPrices = pgTable("depot_prices", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  depotId: text("depot_id").notNull().references(() => depots.id),
  productType: text("product_type").notNull().default("PMS"),
  price: doublePrecision("price").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── REFINERY UPDATES ─────────────────────────────────────────────────────────
export const refineryUpdates = pgTable("refinery_updates", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  refineryName: text("refinery_name").notNull(),
  productionCapacity: doublePrecision("production_capacity").notNull(),
  operationalStatus: text("operational_status").notNull(),
  pmsOutputEstimate: doublePrecision("pms_output_estimate").notNull(),
  dieselOutputEstimate: doublePrecision("diesel_output_estimate").notNull(),
  jetOutputEstimate: doublePrecision("jet_output_estimate").notNull(),
  updateSource: text("update_source").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── REGULATION UPDATES ───────────────────────────────────────────────────────
export const regulationUpdates = pgTable("regulation_updates", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  impactLevel: text("impact_level").notNull().default("low"),
  effectiveDate: timestamp("effective_date").notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── FX RATES ─────────────────────────────────────────────────────────────────
export const fxRates = pgTable("fx_rates", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  rate: doublePrecision("rate").notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── INVENTORY ────────────────────────────────────────────────────────────────
export const inventory = pgTable("inventory", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  terminalId: text("terminal_id").notNull().references(() => terminals.id),
  productType: text("product_type").notNull().default("PMS"),
  volumeLitres: doublePrecision("volume_litres").notNull().default(0),
  averageCost: doublePrecision("average_cost").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  inventoryId: text("inventory_id").notNull().references(() => inventory.id),
  type: text("type").notNull(),
  volume: doublePrecision("volume").notNull(),
  price: doublePrecision("price").notNull(),
  date: timestamp("date").defaultNow(),
});

// ─── TRADER SIGNALS ───────────────────────────────────────────────────────────
export const traderSignals = pgTable("trader_signals", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  sentimentScore: doublePrecision("sentiment_score"),
  impactScore: doublePrecision("impact_score"),
  terminalId: text("terminal_id").references(() => terminals.id),
  productType: text("product_type").default("PMS"),
  detectedTerminal: text("detected_terminal"),
  detectedProduct: text("detected_product"),
  keywords: jsonb("keywords"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── HEDGE RECOMMENDATIONS ────────────────────────────────────────────────────
export const hedgeRecommendations = pgTable("hedge_recommendations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  productType: text("product_type").notNull().default("PMS"),
  strategyType: text("strategy_type").notNull(),
  reasoning: text("reasoning").notNull(),
  riskLevel: text("risk_level").notNull().default("medium"),
  expectedMarginImpact: doublePrecision("expected_margin_impact"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- INSERT SCHEMAS ---
export const insertUserSchema = createInsertSchema(users);
export const insertTerminalSchema = createInsertSchema(terminals);
export const insertForecastSchema = createInsertSchema(forecasts);
export const insertMarketSignalSchema = createInsertSchema(marketSignals);
export const insertPriceHistorySchema = createInsertSchema(priceHistory);
export const insertDepotSchema = createInsertSchema(depots);
export const insertDepotPriceSchema = createInsertSchema(depotPrices);
export const insertRefineryUpdateSchema = createInsertSchema(refineryUpdates);
export const insertRegulationUpdateSchema = createInsertSchema(regulationUpdates);
export const insertFxRateSchema = createInsertSchema(fxRates);
export const insertInventorySchema = createInsertSchema(inventory);
export const insertTransactionSchema = createInsertSchema(transactions);
export const insertTraderSignalSchema = createInsertSchema(traderSignals);
export const insertHedgeRecommendationSchema = createInsertSchema(hedgeRecommendations);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  whatsappPhone: z.string().optional(),
});

export const updateNotificationPrefsSchema = z.object({
  phone: z.string().optional(),
  whatsappPhone: z.string().optional(),
  notificationPrefs: z.record(z.any()).optional(),
});

export const updateSubscriptionSchema = z.object({
  subscriptionTier: z.enum(["free", "basic", "pro", "elite", "enterprise"]).optional(),
  assignedTerminalId: z.string().optional(),
});

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export type SubscriptionTier = "free" | "basic" | "pro" | "elite" | "enterprise";

export const TIER_LIMITS = {
  free: {
    label: "Free",
    forecasts: 3,
    forecastsPerDay: 3,
    smsAlerts: 0,
    smsAlertsPerWeek: 0,
    dataDelay: 60,
    depotSpread: false,
    inventoryAccess: false,
    hedgeLab: false,
    traderSignals: false,
    refineryUpdates: false,
    regulationAlerts: false,
  },
  basic: {
    label: "Basic",
    forecasts: 10,
    forecastsPerDay: 10,
    smsAlerts: 5,
    smsAlertsPerWeek: 5,
    dataDelay: 30,
    depotSpread: false,
    inventoryAccess: false,
    hedgeLab: false,
    traderSignals: false,
    refineryUpdates: false,
    regulationAlerts: false,
  },
  pro: {
    label: "Pro",
    forecasts: 50,
    forecastsPerDay: 50,
    smsAlerts: 20,
    smsAlertsPerWeek: 20,
    dataDelay: 0,
    depotSpread: true,
    inventoryAccess: true,
    hedgeLab: false,
    traderSignals: false,
    refineryUpdates: true,
    regulationAlerts: true,
  },
  elite: {
    label: "Elite",
    forecasts: 100,
    forecastsPerDay: 100,
    smsAlerts: 50,
    smsAlertsPerWeek: 50,
    dataDelay: 0,
    depotSpread: true,
    inventoryAccess: true,
    hedgeLab: true,
    traderSignals: true,
    refineryUpdates: true,
    regulationAlerts: true,
  },
  enterprise: {
    label: "Enterprise",
    forecasts: 999,
    forecastsPerDay: 999,
    smsAlerts: 99,
    smsAlertsPerWeek: 99,
    dataDelay: 0,
    depotSpread: true,
    inventoryAccess: true,
    hedgeLab: true,
    traderSignals: true,
    refineryUpdates: true,
    regulationAlerts: true,
  },
} as const;

export const TIER_PRICES = {
  free: { priceLabel: "Free", period: "forever" },
  basic: { priceLabel: "₦5,000", period: "month" },
  pro: { priceLabel: "₦15,000", period: "month" },
  elite: { priceLabel: "₦50,000", period: "month" },
  enterprise: { priceLabel: "Custom", period: "year" },
} as const;

export const PRODUCT_TYPES = ["PMS", "AGO", "DPK", "LPG"] as const;
export type ProductType = typeof PRODUCT_TYPES[number];

export type NotificationPrefs = {
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  forecastAlerts?: boolean;
  priceAlerts?: boolean;
  refineryAlerts?: boolean;
  morningDigest?: boolean;
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Terminal = typeof terminals.$inferSelect;
export type InsertTerminal = z.infer<typeof insertTerminalSchema>;
export type Forecast = typeof forecasts.$inferSelect;
export type InsertForecast = z.infer<typeof insertForecastSchema>;
export type MarketSignal = typeof marketSignals.$inferSelect;
export type InsertMarketSignal = z.infer<typeof insertMarketSignalSchema>;
export type PriceHistoryEntry = typeof priceHistory.$inferSelect;
export type InsertPriceHistoryEntry = z.infer<typeof insertPriceHistorySchema>;
export type Depot = typeof depots.$inferSelect;
export type InsertDepot = z.infer<typeof insertDepotSchema>;
export type DepotPrice = typeof depotPrices.$inferSelect;
export type InsertDepotPrice = z.infer<typeof insertDepotPriceSchema>;
export type RefineryUpdate = typeof refineryUpdates.$inferSelect;
export type InsertRefineryUpdate = z.infer<typeof insertRefineryUpdateSchema>;
export type RegulationUpdate = typeof regulationUpdates.$inferSelect;
export type InsertRegulationUpdate = z.infer<typeof insertRegulationUpdateSchema>;
export type FxRate = typeof fxRates.$inferSelect;
export type InsertFxRate = z.infer<typeof insertFxRateSchema>;
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type TraderSignal = typeof traderSignals.$inferSelect;
export type InsertTraderSignal = z.infer<typeof insertTraderSignalSchema>;
export type HedgeRecommendation = typeof hedgeRecommendations.$inferSelect;
export type InsertHedgeRecommendation = z.infer<typeof insertHedgeRecommendationSchema>;
