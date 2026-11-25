import {
  pgTable, text, integer, timestamp, boolean, doublePrecision, jsonb, uuid, date,
  numeric, index, uniqueIndex,
} from "drizzle-orm/pg-core";
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
  lastLoginAt: timestamp("last_login_at"),
});

// ─── TERMINALS ───────────────────────────────────────────────────────────────
export const terminals = pgTable("terminals", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  state: text("state").notNull(),
  active: boolean("active").notNull().default(true),
  lga: text("lga"),
  city: text("city"),
  physicalAddress: text("physical_address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  ownerUserId: text("owner_user_id"),
  operatorName: text("operator_name"),
  contactPhone: text("contact_phone"),
  businessEmail: text("business_email"),
  productsSold: jsonb("products_sold"),
  businessRegistrationDetails: text("business_registration_details"),
  approvalStatus: text("approval_status").notNull().default("not_applicable"),
  registrationSubmittedAt: timestamp("registration_submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
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

// ─── FUEL FINDER ────────────────────────────────────────────────────────────
export const fuelFinderStations = pgTable("fuel_finder_stations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: text("external_id").unique(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  state: text("state").notNull(),
  city: text("city").notNull(),
  address: text("address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const fuelFinderPrices = pgTable("fuel_finder_prices", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  stationId: text("station_id").notNull().references(() => fuelFinderStations.id, { onDelete: "cascade" }),
  productType: text("product_type").notNull(),
  priceNaira: doublePrecision("price_naira"),
  availability: text("availability").notNull().default("unknown"),
  source: text("source").notNull(),
  verificationStatus: text("verification_status").notNull().default("manual"),
  observedAt: timestamp("observed_at").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fuelFinderReports = pgTable("fuel_finder_reports", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  stationId: text("station_id").notNull().references(() => fuelFinderStations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  productType: text("product_type").notNull(),
  availability: text("availability").notNull(),
  priceNaira: doublePrecision("price_naira"),
  comment: text("comment"),
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),
});

export const fuelFinderAlerts = pgTable("fuel_finder_alerts", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  productType: text("product_type").notNull(),
  state: text("state").notNull(),
  condition: text("condition").notNull(),
  thresholdNaira: doublePrecision("threshold_naira").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  triggeredAt: timestamp("triggered_at"),
});

export const fuelFinderAlertEvents = pgTable("fuel_finder_alert_events", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  alertId: text("alert_id").notNull().references(() => fuelFinderAlerts.id, { onDelete: "cascade" }),
  stationId: text("station_id").notNull().references(() => fuelFinderStations.id, { onDelete: "cascade" }),
  priceId: text("price_id").notNull().references(() => fuelFinderPrices.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
});

// ─── VERIFIED COMMUNITY FUEL REPORTING ──────────────────────────────────────
export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  customerId: text("customer_id").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  accountStatus: text("account_status").notNull().default("pending_approval"),
  notificationPreferences: jsonb("notification_preferences").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const customerVerifications = pgTable("customer_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  purpose: text("purpose").notNull(),
  target: text("target").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userPurposeIdx: index("customer_verifications_user_purpose_idx").on(table.userId, table.purpose, table.createdAt),
}));

export const stations = pgTable("stations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  businessCategory: text("business_category").notNull().default("retail_filling_station"),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  operatorName: text("operator_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  businessEmail: text("business_email").notNull(),
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  city: text("city").notNull(),
  physicalAddress: text("physical_address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  productsSold: jsonb("products_sold").notNull(),
  operatingStatus: text("operating_status").notNull().default("unknown"),
  businessRegistrationDetails: text("business_registration_details"),
  approvalStatus: text("approval_status").notNull().default("pending"),
  officialNnpc: boolean("official_nnpc").notNull().default(false),
  officialSource: text("official_source"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  ownerIdx: index("stations_owner_user_idx").on(table.ownerUserId, table.approvalStatus),
  locationIdx: index("stations_location_idx").on(table.state, table.lga, table.city),
}));

export const registeredTerminals = pgTable("registered_terminals", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  businessCategory: text("business_category").notNull().default("petroleum_depot"),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  operatorName: text("operator_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  businessEmail: text("business_email").notNull(),
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  city: text("city").notNull(),
  physicalAddress: text("physical_address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  productsSold: jsonb("products_sold").notNull(),
  operatingStatus: text("operating_status").notNull().default("unknown"),
  businessRegistrationDetails: text("business_registration_details"),
  approvalStatus: text("approval_status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  ownerIdx: index("registered_terminals_owner_user_idx").on(table.ownerUserId, table.approvalStatus),
  locationIdx: index("registered_terminals_location_idx").on(table.state, table.lga, table.city),
}));

export const stationOperators = pgTable("station_operators", {
  id: uuid("id").defaultRandom().primaryKey(),
  stationId: uuid("station_id").notNull().references(() => stations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  operatorRole: text("operator_role").notNull().default("manager"),
  approvalStatus: text("approval_status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
}, (table) => ({
  stationUserUnique: uniqueIndex("station_operators_station_user_unique").on(table.stationId, table.userId),
  userIdx: index("station_operators_user_idx").on(table.userId, table.approvalStatus),
}));

export const fuelTypes = pgTable("fuel_types", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
  unit: text("unit").notNull(),
  active: boolean("active").notNull().default(true),
});

export const priceSubmissions = pgTable("price_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerUserId: text("customer_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  stationId: uuid("station_id").references(() => stations.id, { onDelete: "set null" }),
  terminalId: uuid("terminal_id").references(() => registeredTerminals.id, { onDelete: "set null" }),
  locationKey: text("location_key").notNull(),
  locationName: text("location_name").notNull(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  fuelType: text("fuel_type").notNull().references(() => fuelTypes.code),
  priceNaira: numeric("price_naira", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  city: text("city").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  observedAt: timestamp("observed_at").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  lastConfirmedAt: timestamp("last_confirmed_at"),
  availability: text("availability").notNull(),
  comments: text("comments"),
  sourceType: text("source_type").notNull().default("community"),
  validationStatus: text("validation_status").notNull().default("eligible"),
  moderationStatus: text("moderation_status").notNull().default("published"),
  validationReasons: jsonb("validation_reasons").notNull().default([]),
  reportingPeriod: date("reporting_period").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  customerPeriodIdx: index("price_submissions_customer_period_idx").on(table.customerUserId, table.reportingPeriod),
  locationFuelPeriodIdx: index("price_submissions_location_fuel_period_idx").on(table.locationKey, table.fuelType, table.reportingPeriod),
  stationFuelObservedIdx: index("price_submissions_station_fuel_observed_idx").on(table.stationId, table.fuelType, table.observedAt),
  terminalFuelObservedIdx: index("price_submissions_terminal_fuel_observed_idx").on(table.terminalId, table.fuelType, table.observedAt),
}));

export const communityConfirmations = pgTable("community_confirmations", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => priceSubmissions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  confirmation: text("confirmation").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  submissionUserUnique: uniqueIndex("community_confirmations_submission_user_unique").on(table.submissionId, table.userId),
}));

export const customerTrustScores = pgTable("customer_trust_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").notNull().default(50),
  acceptedReports: integer("accepted_reports").notNull().default(0),
  confirmedReports: integer("confirmed_reports").notNull().default(0),
  disputedReports: integer("disputed_reports").notNull().default(0),
  adminDecisions: integer("admin_decisions").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const priceDisputes = pgTable("price_disputes", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => priceSubmissions.id, { onDelete: "cascade" }),
  reporterUserId: text("reporter_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("open"),
  resolution: text("resolution"),
  resolvedBy: text("resolved_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  submissionStatusIdx: index("price_disputes_submission_status_idx").on(table.submissionId, table.status),
}));

export const locationPriceAverages = pgTable("location_price_averages", {
  id: uuid("id").defaultRandom().primaryKey(),
  scope: text("scope").notNull(),
  aggregationKey: text("aggregation_key").notNull(),
  fuelType: text("fuel_type").notNull().references(() => fuelTypes.code),
  sourceType: text("source_type").notNull().default("community"),
  reportingPeriod: date("reporting_period").notNull(),
  averagePrice: numeric("average_price", { precision: 12, scale: 2 }).notNull(),
  observationCount: integer("observation_count").notNull(),
  independentReportCount: integer("independent_report_count").notNull(),
  freshnessStatus: text("freshness_status").notNull(),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
}, (table) => ({
  scopeKeyPeriodUnique: uniqueIndex("location_price_averages_scope_key_period_unique")
    .on(table.scope, table.aggregationKey, table.fuelType, table.sourceType, table.reportingPeriod),
  scopePeriodIdx: index("location_price_averages_scope_period_idx").on(table.scope, table.reportingPeriod, table.fuelType),
}));

export const communityPriceHistory = pgTable("community_price_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  submissionId: uuid("submission_id").notNull().references(() => priceSubmissions.id, { onDelete: "restrict" }),
  priceNaira: numeric("price_naira", { precision: 12, scale: 2 }).notNull(),
  sourceType: text("source_type").notNull(),
  validationStatus: text("validation_status").notNull(),
  changedBy: text("changed_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
}, (table) => ({
  submissionChangedIdx: index("community_price_history_submission_changed_idx").on(table.submissionId, table.changedAt),
}));

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  payload: jsonb("payload").notNull().default({}),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userCreatedIdx: index("notifications_user_created_idx").on(table.userId, table.createdAt),
}));

export const customerActivityLogs = pgTable("customer_activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userCreatedIdx: index("customer_activity_logs_user_created_idx").on(table.userId, table.createdAt),
}));

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: text("admin_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  entityCreatedIdx: index("admin_audit_logs_entity_created_idx").on(table.entityType, table.entityId, table.createdAt),
}));

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
export const insertFuelFinderStationSchema = createInsertSchema(fuelFinderStations);
export const insertFuelFinderPriceSchema = createInsertSchema(fuelFinderPrices);
export const insertFuelFinderReportSchema = createInsertSchema(fuelFinderReports);
export const insertFuelFinderAlertSchema = createInsertSchema(fuelFinderAlerts);
export const insertFuelFinderAlertEventSchema = createInsertSchema(fuelFinderAlertEvents);

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(7).max(25),
  whatsappPhone: z.string().optional(),
  verificationChannel: z.enum(["email", "sms"]).default("email"),
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
  free: { label: "Free", forecasts: 3, forecastsPerDay: 3, smsAlerts: 0, smsAlertsPerWeek: 0, dataDelay: 60, depotSpread: false, inventoryAccess: false, hedgeLab: false, traderSignals: false, refineryUpdates: false, regulationAlerts: false },
  basic: { label: "Basic", forecasts: 10, forecastsPerDay: 10, smsAlerts: 5, smsAlertsPerWeek: 5, dataDelay: 30, depotSpread: false, inventoryAccess: false, hedgeLab: false, traderSignals: false, refineryUpdates: false, regulationAlerts: false },
  pro: { label: "Pro", forecasts: 50, forecastsPerDay: 50, smsAlerts: 20, smsAlertsPerWeek: 20, dataDelay: 0, depotSpread: true, inventoryAccess: true, hedgeLab: false, traderSignals: false, refineryUpdates: true, regulationAlerts: true },
  elite: { label: "Elite", forecasts: 100, forecastsPerDay: 100, smsAlerts: 50, smsAlertsPerWeek: 50, dataDelay: 0, depotSpread: true, inventoryAccess: true, hedgeLab: true, traderSignals: true, refineryUpdates: true, regulationAlerts: true },
  enterprise: { label: "Enterprise", forecasts: 999, forecastsPerDay: 999, smsAlerts: 99, smsAlertsPerWeek: 99, dataDelay: 0, depotSpread: true, inventoryAccess: true, hedgeLab: true, traderSignals: true, refineryUpdates: true, regulationAlerts: true },
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

export const FUEL_FINDER_PRODUCTS = PRODUCT_TYPES;
export type FuelFinderProduct = ProductType;

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
] as const;

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
export type FuelFinderStation = typeof fuelFinderStations.$inferSelect;
export type InsertFuelFinderStation = z.infer<typeof insertFuelFinderStationSchema>;
export type FuelFinderPrice = typeof fuelFinderPrices.$inferSelect;
export type InsertFuelFinderPrice = z.infer<typeof insertFuelFinderPriceSchema>;
export type FuelFinderReport = typeof fuelFinderReports.$inferSelect;
export type FuelFinderAlert = typeof fuelFinderAlerts.$inferSelect;
export type FuelFinderAlertEvent = typeof fuelFinderAlertEvents.$inferSelect;
