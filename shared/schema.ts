import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export interface NotificationPrefs {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  forecastAlerts: boolean;
  priceAlerts: boolean;
  refineryAlerts: boolean;
  morningDigest: boolean;
}

export type SubscriptionTier = "free" | "pro" | "elite";

export const PRODUCT_TYPES = ["PMS", "AGO", "JET_A1", "ATK", "LPG"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const TIER_LIMITS = {
  free: {
    label: "Free",
    price: 0,
    priceLabel: "₦0",
    period: "/month",
    maxTerminals: 1,
    maxProducts: 1,
    forecastsPerDay: 1,
    dataDelay: 24,
    aiProbability: false,
    smsAlertsPerWeek: 0,
    whatsappDigest: false,
    refineryUpdates: false,
    regulationAlerts: false,
    apiAccess: false,
    forecastExport: false,
    customSensitivity: false,
    dedicatedSupport: false,
    earlySignals: false,
    inventoryAccess: false,
    hedgeLab: false,
    depotSpread: false,
    traderSignals: false,
  },
  pro: {
    label: "Pro",
    price: 15000,
    priceLabel: "₦15,000",
    period: "/month",
    maxTerminals: 3,
    maxProducts: Infinity,
    forecastsPerDay: 10,
    dataDelay: 6,
    aiProbability: true,
    smsAlertsPerWeek: 10,
    whatsappDigest: false,
    refineryUpdates: true,
    regulationAlerts: true,
    apiAccess: false,
    forecastExport: false,
    customSensitivity: false,
    dedicatedSupport: false,
    earlySignals: false,
    inventoryAccess: true,
    hedgeLab: true,
    depotSpread: true,
    traderSignals: false,
  },
  elite: {
    label: "Elite",
    price: 90000,
    priceLabel: "₦90,000",
    period: "/month",
    maxTerminals: Infinity,
    maxProducts: Infinity,
    forecastsPerDay: Infinity,
    dataDelay: 0,
    aiProbability: true,
    smsAlertsPerWeek: Infinity,
    whatsappDigest: true,
    refineryUpdates: true,
    regulationAlerts: true,
    apiAccess: true,
    forecastExport: true,
    customSensitivity: true,
    dedicatedSupport: true,
    earlySignals: true,
    inventoryAccess: true,
    hedgeLab: true,
    depotSpread: true,
    traderSignals: true,
  },
} as const;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("marketer"),
  phone: text("phone"),
  whatsappPhone: text("whatsapp_phone"),
  notificationPrefs: jsonb("notification_prefs").$type<NotificationPrefs>().default({
    smsEnabled: false,
    whatsappEnabled: false,
    forecastAlerts: true,
    priceAlerts: true,
    refineryAlerts: true,
    morningDigest: false,
  }),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  smsAlertsUsedThisWeek: integer("sms_alerts_used_this_week").notNull().default(0),
  smsWeekResetDate: timestamp("sms_week_reset_date"),
  forecastsUsedToday: integer("forecasts_used_today").notNull().default(0),
  forecastDayResetDate: timestamp("forecast_day_reset_date"),
  assignedTerminalId: varchar("assigned_terminal_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const terminals = pgTable("terminals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  state: text("state").notNull(),
  code: text("code").notNull().unique(),
  active: boolean("active").notNull().default(true),
});

export const marketSignals = pgTable("market_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  terminalId: varchar("terminal_id").notNull().references(() => terminals.id),
  productType: text("product_type").notNull().default("PMS"),
  vesselActivity: text("vessel_activity").notNull(),
  truckQueue: text("truck_queue").notNull(),
  nnpcSupply: text("nnpc_supply").notNull(),
  fxPressure: text("fx_pressure").notNull(),
  policyRisk: text("policy_risk").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forecasts = pgTable("forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  terminalId: varchar("terminal_id").notNull().references(() => terminals.id),
  productType: text("product_type").notNull().default("PMS"),
  expectedMin: real("expected_min").notNull(),
  expectedMax: real("expected_max").notNull(),
  bias: text("bias").notNull().default("neutral"),
  confidence: integer("confidence").notNull(),
  suggestedAction: text("suggested_action").notNull(),
  depotPrice: real("depot_price"),
  refineryInfluenceScore: real("refinery_influence_score"),
  importParityPrice: real("import_parity_price"),
  demandIndex: real("demand_index"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  terminalId: varchar("terminal_id").notNull().references(() => terminals.id),
  productType: text("product_type").notNull().default("PMS"),
  date: timestamp("date").notNull(),
  price: real("price").notNull(),
});

export const refineryUpdates = pgTable("refinery_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  refineryName: text("refinery_name").notNull(),
  productionCapacity: real("production_capacity").notNull(),
  operationalStatus: text("operational_status").notNull(),
  pmsOutputEstimate: real("pms_output_estimate").notNull(),
  dieselOutputEstimate: real("diesel_output_estimate").notNull(),
  jetOutputEstimate: real("jet_output_estimate").notNull(),
  updateSource: text("update_source").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const regulationUpdates = pgTable("regulation_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  impactLevel: text("impact_level").notNull().default("low"),
  effectiveDate: timestamp("effective_date").notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const externalPriceFeeds = pgTable("external_price_feeds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceName: text("source_name").notNull(),
  productType: text("product_type").notNull().default("PMS"),
  price: real("price").notNull(),
  terminalId: varchar("terminal_id").references(() => terminals.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fxRates = pgTable("fx_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rate: real("rate").notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  channel: text("channel").notNull(),
  alertType: text("alert_type").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  externalId: text("external_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const depots = pgTable("depots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  terminalId: varchar("terminal_id").notNull().references(() => terminals.id),
  owner: text("owner").notNull(),
  active: boolean("active").notNull().default(true),
});

export const depotPrices = pgTable("depot_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  depotId: varchar("depot_id").notNull().references(() => depots.id),
  productType: text("product_type").notNull().default("PMS"),
  price: real("price").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  terminalId: varchar("terminal_id").notNull().references(() => terminals.id),
  productType: text("product_type").notNull().default("PMS"),
  volumeLitres: real("volume_litres").notNull().default(0),
  averageCost: real("average_cost").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inventoryId: varchar("inventory_id").notNull().references(() => inventory.id),
  type: text("type").notNull(),
  volume: real("volume").notNull(),
  price: real("price").notNull(),
  date: timestamp("date").defaultNow(),
});

export const traderSignals = pgTable("trader_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  sentimentScore: real("sentiment_score"),
  impactScore: real("impact_score"),
  terminalId: varchar("terminal_id").references(() => terminals.id),
  productType: text("product_type").default("PMS"),
  detectedTerminal: text("detected_terminal"),
  detectedProduct: text("detected_product"),
  keywords: text("keywords").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hedgeRecommendations = pgTable("hedge_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productType: text("product_type").notNull().default("PMS"),
  strategyType: text("strategy_type").notNull(),
  reasoning: text("reasoning").notNull(),
  riskLevel: text("risk_level").notNull().default("medium"),
  expectedMarginImpact: real("expected_margin_impact"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationPrefsSchema = z.object({
  smsEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  forecastAlerts: z.boolean(),
  priceAlerts: z.boolean(),
  refineryAlerts: z.boolean(),
  morningDigest: z.boolean(),
});

export const updateNotificationPrefsSchema = z.object({
  phone: z.string().optional(),
  whatsappPhone: z.string().optional(),
  notificationPrefs: notificationPrefsSchema.partial().optional(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  email: true,
  password: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = insertUserSchema.extend({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

export const insertTerminalSchema = createInsertSchema(terminals).omit({ id: true });
export const insertMarketSignalSchema = createInsertSchema(marketSignals).omit({ id: true });
export const insertForecastSchema = createInsertSchema(forecasts).omit({ id: true });
export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({ id: true });
export const insertRefineryUpdateSchema = createInsertSchema(refineryUpdates).omit({ id: true, createdAt: true });
export const insertRegulationUpdateSchema = createInsertSchema(regulationUpdates).omit({ id: true, createdAt: true }).extend({
  impactLevel: z.enum(["low", "medium", "high"]),
});
export const insertExternalPriceFeedSchema = createInsertSchema(externalPriceFeeds).omit({ id: true, createdAt: true }).extend({
  sourceName: z.enum(["NNPC", "Dangote", "Depot"]),
});
export const insertFxRateSchema = createInsertSchema(fxRates).omit({ id: true, createdAt: true });
export const insertDepotSchema = createInsertSchema(depots).omit({ id: true });
export const insertDepotPriceSchema = createInsertSchema(depotPrices).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export const insertTraderSignalSchema = createInsertSchema(traderSignals).omit({ id: true, createdAt: true });
export const insertHedgeRecommendationSchema = createInsertSchema(hedgeRecommendations).omit({ id: true, createdAt: true });

export const updateSubscriptionSchema = z.object({
  tier: z.enum(["free", "pro", "elite"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  assignedTerminalId: z.string().optional(),
});

export const productTypeSchema = z.enum(["PMS", "AGO", "JET_A1", "ATK", "LPG"]);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertRefineryUpdate = z.infer<typeof insertRefineryUpdateSchema>;
export type InsertRegulationUpdate = z.infer<typeof insertRegulationUpdateSchema>;
export type InsertExternalPriceFeed = z.infer<typeof insertExternalPriceFeedSchema>;
export type InsertFxRate = z.infer<typeof insertFxRateSchema>;

export type User = typeof users.$inferSelect;
export type Terminal = typeof terminals.$inferSelect;
export type MarketSignal = typeof marketSignals.$inferSelect;
export type Forecast = typeof forecasts.$inferSelect;
export type PriceHistoryEntry = typeof priceHistory.$inferSelect;
export type RefineryUpdate = typeof refineryUpdates.$inferSelect;
export type RegulationUpdate = typeof regulationUpdates.$inferSelect;
export type ExternalPriceFeed = typeof externalPriceFeeds.$inferSelect;
export type FxRate = typeof fxRates.$inferSelect;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type Depot = typeof depots.$inferSelect;
export type DepotPrice = typeof depotPrices.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type TraderSignal = typeof traderSignals.$inferSelect;
export type HedgeRecommendation = typeof hedgeRecommendations.$inferSelect;
