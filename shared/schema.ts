import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("marketer"),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Terminal = typeof terminals.$inferSelect;
export type MarketSignal = typeof marketSignals.$inferSelect;
export type Forecast = typeof forecasts.$inferSelect;
export type PriceHistoryEntry = typeof priceHistory.$inferSelect;
