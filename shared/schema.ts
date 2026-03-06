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

export type SubscriptionTier = "free" | "pro" | "enterprise";

export const TIER_LIMITS = {
  free: {
    label: "Free",
    price: 0,
    priceLabel: "₦0",
    period: "/month",
    maxTerminals: 1,
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
  },
  pro: {
    label: "Pro",
    price: 15000,
    priceLabel: "₦15,000",
    period: "/month",
    maxTerminals: Infinity,
    forecastsPerDay: Infinity,
    dataDelay: 0,
    aiProbability: true,
    smsAlertsPerWeek: 5,
    whatsappDigest: true,
    refineryUpdates: true,
    regulationAlerts: true,
    apiAccess: false,
    forecastExport: false,
    customSensitivity: false,
    dedicatedSupport: false,
    earlySignals: false,
  },
  enterprise: {
    label: "Enterprise",
    price: 90000,
    priceLabel: "₦90,000",
    period: "/month",
    maxTerminals: Infinity,
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
  expectedMin: real("expected_min").notNull(),
  expectedMax: real("expected_max").notNull(),
  bias: text("bias").notNull().default("neutral"),
  confidence: integer("confidence").notNull(),
  suggestedAction: text("suggested_action").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  terminalId: varchar("terminal_id").notNull().references(() => terminals.id),
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

export const updateSubscriptionSchema = z.object({
  tier: z.enum(["free", "pro", "enterprise"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  assignedTerminalId: z.string().optional(),
});

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
