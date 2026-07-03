import { db } from "./db.js";
import {
  users,
  terminals,
  fxRates,
  refineryUpdates,
  regulationUpdates,
  marketSignals,
  forecasts,
  priceHistory,
  depots,
  depotPrices,
} from "../shared/schema.js";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

/* ──────────────────────────────────────────────
   TERMINALS
────────────────────────────────────────────── */

const TERMINAL_SEEDS = [
  { name: "Apapa", state: "Lagos", code: "APA" },
  { name: "Calabar", state: "Cross River", code: "CAL" },
  { name: "Port Harcourt", state: "Rivers", code: "PHC" },
  { name: "Warri", state: "Delta", code: "WAR" },
  { name: "Onne", state: "Rivers", code: "ONN" },
  { name: "Bonny", state: "Rivers", code: "BON" },
  { name: "Atlas Cove", state: "Lagos", code: "ATC" },
  { name: "Ijegun", state: "Lagos", code: "IJG" },
];

/* ──────────────────────────────────────────────
   MARKET SIGNAL PRESETS
────────────────────────────────────────────── */

const SIGNAL_PRESETS: Record<string, any> = {
  APA: { vesselActivity: "None", truckQueue: "High", nnpcSupply: "Weak", fxPressure: "Medium", policyRisk: "Low" },
  CAL: { vesselActivity: "Low", truckQueue: "Low", nnpcSupply: "Moderate", fxPressure: "Low", policyRisk: "Low" },
  PHC: { vesselActivity: "Moderate", truckQueue: "High", nnpcSupply: "Weak", fxPressure: "High", policyRisk: "Medium" },
  WAR: { vesselActivity: "Low", truckQueue: "Medium", nnpcSupply: "Moderate", fxPressure: "Medium", policyRisk: "Low" },
  ONN: { vesselActivity: "High", truckQueue: "Low", nnpcSupply: "Strong", fxPressure: "Low", policyRisk: "Low" },
  BON: { vesselActivity: "High", truckQueue: "Low", nnpcSupply: "Moderate", fxPressure: "Medium", policyRisk: "Low" },
  ATC: { vesselActivity: "Moderate", truckQueue: "High", nnpcSupply: "Weak", fxPressure: "Medium", policyRisk: "Medium" },
  IJG: { vesselActivity: "None", truckQueue: "High", nnpcSupply: "Weak", fxPressure: "High", policyRisk: "Low" },
};

/* ──────────────────────────────────────────────
   FORECAST PRESETS
────────────────────────────────────────────── */

const FORECAST_PRESETS: Record<string, any> = {
  APA: { expectedMin: 620, expectedMax: 635, bias: "bullish", confidence: 78, suggestedAction: "Load before 6am" },
  CAL: { expectedMin: 640, expectedMax: 660, bias: "neutral", confidence: 65, suggestedAction: "Hold stock" },
  PHC: { expectedMin: 615, expectedMax: 630, bias: "bullish", confidence: 72, suggestedAction: "Buy early" },
  WAR: { expectedMin: 625, expectedMax: 645, bias: "neutral", confidence: 60, suggestedAction: "Steady pricing" },
  ONN: { expectedMin: 600, expectedMax: 615, bias: "bearish", confidence: 80, suggestedAction: "Delay purchases" },
  BON: { expectedMin: 610, expectedMax: 625, bias: "neutral", confidence: 70, suggestedAction: "Off-peak loading" },
  ATC: { expectedMin: 618, expectedMax: 632, bias: "bullish", confidence: 74, suggestedAction: "Pre-load" },
  IJG: { expectedMin: 625, expectedMax: 640, bias: "bullish", confidence: 76, suggestedAction: "Load early" },
};

/* ──────────────────────────────────────────────
   DEPOTS
────────────────────────────────────────────── */

const DEPOT_SEEDS: Record<string, { name: string; owner: string }[]> = {
  APA: [
    { name: "MRS Apapa Depot", owner: "MRS Oil" },
    { name: "Conoil Apapa Depot", owner: "Conoil" },
  ],
  PHC: [
    { name: "Indorama PH Depot", owner: "Indorama" },
    { name: "MRS PH Depot", owner: "MRS Oil" },
  ],
  WAR: [
    { name: "PPMC Warri Depot", owner: "NNPC" },
    { name: "Rainoil Warri Depot", owner: "Rainoil" },
  ],
};

const PRODUCT_BASE_PRICES: Record<string, number> = {
  PMS: 620,
  AGO: 950,
  JET_A1: 880,
  LPG: 1100,
};

/* ──────────────────────────────────────────────
   MAIN SEED FUNCTION
────────────────────────────────────────────── */

export async function seedDatabase() {
  console.log("Seeding FuelIQ database...");

  await seedAdminUser();
  await seedTerminalsSignalsForecasts();
  await seedFxRate();
  await seedRefineryAndRegulationData();
  await seedDepotsAndPrices();

  console.log("FuelIQ database seeded successfully.");
}

/* ──────────────────────────────────────────────
   ADMIN USER
────────────────────────────────────────────── */

async function seedAdminUser() {
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@fueliq.ng"));

  if (existingAdmin.length > 0) return;

  const hashedPassword = await bcrypt.hash("admin123", 10);

  await db.insert(users).values({
    username: "admin",
    name: "Admin",
    email: "admin@fueliq.ng",
    password: hashedPassword,
    role: "admin",
    subscriptionTier: "enterprise",
  } as any);

  console.log("Admin user created");
}

/* ──────────────────────────────────────────────
   TERMINALS + SIGNALS + FORECASTS + PRICE HISTORY
────────────────────────────────────────────── */

async function seedTerminalsSignalsForecasts() {
  const existing = await db.select().from(terminals);
  if (existing.length > 0) return;

  for (const t of TERMINAL_SEEDS) {
    const [terminal] = await db.insert(terminals).values({
      name: t.name,
      state: t.state,
      code: t.code,
      location: t.state,
      active: true,
    } as any).returning();

    await db.insert(marketSignals).values({
      terminalId: String(terminal.id),
      ...SIGNAL_PRESETS[t.code],
    } as any);

    const forecast = FORECAST_PRESETS[t.code];

    await db.insert(forecasts).values({
      terminalId: String(terminal.id),
      productType: "PMS",
      ...forecast,
    } as any);

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      await db.insert(priceHistory).values({
        terminalId: String(terminal.id),
        productType: "PMS",
        price: forecast.expectedMin + Math.floor(Math.random() * 20),
        date,
      } as any);
    }
  }

  console.log("Terminals and forecasts seeded");
}

/* ──────────────────────────────────────────────
   FX RATE
────────────────────────────────────────────── */

async function seedFxRate() {
  await db.insert(fxRates).values({
    rate: 1500,
    source: "CBN",
  });

  console.log("FX rate seeded");
}

/* ──────────────────────────────────────────────
   REFINERY + REGULATION
────────────────────────────────────────────── */

async function seedRefineryAndRegulationData() {
  await db.insert(refineryUpdates).values([
    {
      refineryName: "Dangote Refinery",
      productionCapacity: 650000,
      operationalStatus: "Active",
      pmsOutputEstimate: 450000,
      dieselOutputEstimate: 120000,
      jetOutputEstimate: 60000,
    },
  ] as any);

  await db.insert(regulationUpdates).values([
    {
      title: "NNPC Price Adjustment",
      summary: "Pump price adjusted due to FX pressure",
      impactLevel: "medium",
      effectiveDate: new Date(),
      source: "Government",
    },
  ] as any);

  console.log("Refinery and regulation seeded");
}

/* ──────────────────────────────────────────────
   DEPOTS
────────────────────────────────────────────── */

async function seedDepotsAndPrices() {
  const allTerminals = await db.select().from(terminals);
  const terminalMap = new Map(allTerminals.map((t) => [t.code, t.id]));

  for (const [code, depotList] of Object.entries(DEPOT_SEEDS)) {
    const terminalId = terminalMap.get(code);
    if (!terminalId) continue;

    for (const d of depotList) {
      const [depot] = await db.insert(depots).values({
        name: d.name,
        owner: d.owner,
        terminalId: String(terminalId),
        location: "Nigeria",
      } as any).returning();

      for (const [productType, basePrice] of Object.entries(PRODUCT_BASE_PRICES)) {
        await db.insert(depotPrices).values({
          depotId: String(depot.id),
          productType,
          price: basePrice + Math.floor(Math.random() * 30),
          recordedAt: new Date(),
        } as any);
      }
    }
  }

  console.log("Depots seeded");
}

/* ──────────────────────────────────────────────
   RUN SEED
────────────────────────────────────────────── */

seedDatabase();
