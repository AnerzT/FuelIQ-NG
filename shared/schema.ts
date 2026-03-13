import { pgTable, text, serial, integer, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  role: text("role").default("user"),
  subscriptionTier: text("subscription_tier").default("free"), // Added
  forecastsUsedToday: integer("forecasts_used_today").default(0), // Added
  smsAlertsUsedThisWeek: integer("sms_alerts_used_this_week").default(0), // Added
  createdAt: timestamp("created_at").defaultNow(),
});

export const forecasts = pgTable("forecasts", {
  id: serial("id").primaryKey(),
  terminalId: text("terminal_id").notNull(), // Added
  productType: text("product_type").notNull(), // Added
  expectedMin: doublePrecision("expected_min").notNull(),
  expectedMax: doublePrecision("expected_max").notNull(),
  depotPrice: doublePrecision("depot_price").default(0), // Added
  refineryInfluenceScore: doublePrecision("refinery_score").default(0), // Added
  importParityPrice: doublePrecision("import_parity").default(0), // Added
  demandIndex: doublePrecision("demand_index").default(0), // Added
  bias: text("bias").notNull(), // 'bullish', 'neutral', 'bearish'
  confidence: doublePrecision("confidence").notNull(),
  suggestedAction: text("suggested_action").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  terminalId: text("terminal_id").notNull(), // Added
  productType: text("product_type").default("PMS"), // Added
  vesselActivity: text("vessel_activity").notNull(),
  truckQueue: text("truck_queue").notNull(),
  nnpcSupply: text("nnpc_supply").notNull(),
  fxPressure: text("fx_pressure").notNull(),
  policyRisk: text("policy_risk").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users);
export const insertForecastSchema = createInsertSchema(forecasts);
export const insertSignalSchema = createInsertSchema(signals);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Forecast = typeof forecasts.$inferSelect;
export type Signal = typeof signals.$inferSelect;
