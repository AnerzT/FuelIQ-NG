import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  company: text("company"),
  role: text("role").default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forecasts = pgTable("forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull().defaultNow(),
  product: text("product").notNull(),
  region: text("region").notNull(),
  expectedLow: real("expected_low").notNull(),
  expectedHigh: real("expected_high").notNull(),
  marketBias: text("market_bias").notNull(),
  confidence: integer("confidence").notNull(),
  suggestedActions: text("suggested_actions").array().notNull(),
  published: boolean("published").default(false),
});

export const marketSignals = pgTable("market_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  forecastId: varchar("forecast_id").references(() => forecasts.id),
  vesselActivity: text("vessel_activity").notNull(),
  truckQueue: text("truck_queue").notNull(),
  nnpcSupply: text("nnpc_supply").notNull(),
  fxPressure: text("fx_pressure").notNull(),
  policyRisk: text("policy_risk").notNull(),
});

export const priceAnchors = pgTable("price_anchors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  forecastId: varchar("forecast_id").references(() => forecasts.id),
  yesterdayCloseLow: real("yesterday_close_low").notNull(),
  yesterdayCloseHigh: real("yesterday_close_high").notNull(),
  overnightSentiment: text("overnight_sentiment").notNull(),
});

export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  product: text("product").notNull(),
  region: text("region").notNull(),
  price: real("price").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  fullName: true,
  company: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = insertUserSchema.extend({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
});

export const insertForecastSchema = createInsertSchema(forecasts).omit({ id: true });
export const insertMarketSignalSchema = createInsertSchema(marketSignals).omit({ id: true });
export const insertPriceAnchorSchema = createInsertSchema(priceAnchors).omit({ id: true });
export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Forecast = typeof forecasts.$inferSelect;
export type MarketSignal = typeof marketSignals.$inferSelect;
export type PriceAnchor = typeof priceAnchors.$inferSelect;
export type PriceHistoryEntry = typeof priceHistory.$inferSelect;
