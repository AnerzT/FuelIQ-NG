import { db } from "./storage.js";
import { users, terminals, marketSignals, forecasts, priceHistory, depots, depotPrices, refineryUpdates, regulationUpdates } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

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

const SIGNAL_PRESETS: Record<string, { vesselActivity: string; truckQueue: string; nnpcSupply: string; fxPressure: string; policyRisk: string }> = {
  APA: { vesselActivity: "None", truckQueue: "High", nnpcSupply: "Weak", fxPressure: "Medium", policyRisk: "Low" },
  CAL: { vesselActivity: "Low", truckQueue: "Low", nnpcSupply: "Moderate", fxPressure: "Low", policyRisk: "Low" },
  PHC: { vesselActivity: "Moderate", truckQueue: "High", nnpcSupply: "Weak", fxPressure: "High", policyRisk: "Medium" },
  WAR: { vesselActivity: "Low", truckQueue: "Medium", nnpcSupply: "Moderate", fxPressure: "Medium", policyRisk: "Low" },
  ONN: { vesselActivity: "High", truckQueue: "Low", nnpcSupply: "Strong", fxPressure: "Low", policyRisk: "Low" },
  BON: { vesselActivity: "High", truckQueue: "Low", nnpcSupply: "Moderate", fxPressure: "Medium", policyRisk: "Low" },
  ATC: { vesselActivity: "Moderate", truckQueue: "High", nnpcSupply: "Weak", fxPressure: "Medium", policyRisk: "Medium" },
  IJG: { vesselActivity: "None", truckQueue: "High", nnpcSupply: "Weak", fxPressure: "High", policyRisk: "Low" },
};

const FORECAST_PRESETS: Record<string, { expectedMin: number; expectedMax: number; bias: string; confidence: number; suggestedAction: string }> = {
  APA: { expectedMin: 620, expectedMax: 635, bias: "bullish", confidence: 78, suggestedAction: "Load before 6am. Avoid spot buying after 9am." },
  CAL: { expectedMin: 640, expectedMax: 660, bias: "neutral", confidence: 65, suggestedAction: "Hold current stock. Monitor vessel arrivals." },
  PHC: { expectedMin: 615, expectedMax: 630, bias: "bullish", confidence: 72, suggestedAction: "Buy early. Prices likely to climb by midday." },
  WAR: { expectedMin: 625, expectedMax: 645, bias: "neutral", confidence: 60, suggestedAction: "Steady pricing expected. Standard loading advised." },
  ONN: { expectedMin: 600, expectedMax: 615, bias: "bearish", confidence: 80, suggestedAction: "Good supply. Delay purchases for lower prices." },
  BON: { expectedMin: 610, expectedMax: 625, bias: "neutral", confidence: 70, suggestedAction: "Moderate activity. Load at off-peak hours." },
  ATC: { expectedMin: 618, expectedMax: 632, bias: "bullish", confidence: 74, suggestedAction: "Pre-load recommended. Supply tightening expected." },
  IJG: { expectedMin: 625, expectedMax: 640, bias: "bullish", confidence: 76, suggestedAction: "Load before 7am. FX pressure increasing." },
};

export async function seedDatabase() {
  const existing = await db.select().from(terminals);
  if (existing.length > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  console.log("Seeding database...");

  for (const t of TERMINAL_SEEDS) {
    const [terminal] = await db.insert(terminals).values({ name: t.name, state: t.state, code: t.code, active: true }).returning();

    const signalPreset = SIGNAL_PRESETS[t.code];
    if (signalPreset) {
      await db.insert(marketSignals).values({ terminalId: terminal.id, ...signalPreset });
    }

    const forecastPreset = FORECAST_PRESETS[t.code];
    if (forecastPreset) {
      await db.insert(forecasts).values({ terminalId: terminal.id, ...forecastPreset });
    }

    const basePrice = forecastPreset?.expectedMin || 620;
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const variation = (Math.random() - 0.5) * 30;
      const price = Math.round(basePrice + variation);
      await db.insert(priceHistory).values({ terminalId: terminal.id, date, price });
    }
  }

  console.log("Database seeded successfully with 8 terminals.");

  const existingAdmin = await db.select().from(users).where(eq(users.email, "admin@fueliq.ng"));
  if (existingAdmin.length === 0) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      name: "Admin",
      email: "admin@fueliq.ng",
      password: hashedPassword,
      role: "admin",
    });
    console.log("Admin user seeded.");
  }

  await seedDepotsAndPrices();
}

const DEPOT_SEEDS: Record<string, { name: string; owner: string }[]> = {
  APA: [
    { name: "MRS Apapa Depot", owner: "MRS Oil" },
    { name: "Conoil Apapa Depot", owner: "Conoil" },
    { name: "Forte Oil Apapa", owner: "Ardova (Forte Oil)" },
  ],
  PHC: [
    { name: "Indorama PH Depot", owner: "Indorama" },
    { name: "MRS PH Depot", owner: "MRS Oil" },
  ],
  WAR: [
    { name: "PPMC Warri Depot", owner: "NNPC/PPMC" },
    { name: "Rainoil Warri Depot", owner: "Rainoil" },
  ],
  ATC: [
    { name: "Atlas Cove Jetty Depot", owner: "NNPC/PPMC" },
  ],
  IJG: [
    { name: "Techno Oil Ijegun", owner: "Techno Oil" },
    { name: "Masters Energy Ijegun", owner: "Masters Energy" },
  ],
  ONN: [
    { name: "Brawal Oil Onne", owner: "Brawal Oil" },
  ],
};

const PRODUCT_BASE_PRICES: Record<string, number> = {
  PMS: 620,
  AGO: 950,
  JET_A1: 880,
  ATK: 870,
  LPG: 1100,
};

async function seedDepotsAndPrices() {
  const existingDepots = await db.select().from(depots);
  if (existingDepots.length > 0) {
    console.log("Depots already seeded, skipping.");
    return;
  }

  console.log("Seeding depots and depot prices...");
  const allTerminals = await db.select().from(terminals);
  const terminalMap = new Map(allTerminals.map((t) => [t.code, t.id]));

  for (const [code, depotList] of Object.entries(DEPOT_SEEDS)) {
    const terminalId = terminalMap.get(code);
    if (!terminalId) continue;

    for (const d of depotList) {
      const [depot] = await db.insert(depots).values({
        name: d.name,
        terminalId,
        owner: d.owner,
        active: true,
      }).returning();

      for (const [productType, basePrice] of Object.entries(PRODUCT_BASE_PRICES)) {
        const variation = (Math.random() - 0.5) * 40;
        const price = Math.round(basePrice + variation);
        await db.insert(depotPrices).values({
          depotId: depot.id,
          productType,
          price,
          updatedAt: new Date(),
        });
      }
    }
  }

  console.log("Depots and depot prices seeded successfully.");
}

export { seedDepotsAndPrices };

export async function migrateLegacyTiers() {
  const legacyUsers = await db.select().from(users).where(eq(users.subscriptionTier, "enterprise" as any));
  if (legacyUsers.length > 0) {
    for (const u of legacyUsers) {
      await db.update(users).set({ subscriptionTier: "elite" }).where(eq(users.id, u.id));
    }
    console.log(`Migrated ${legacyUsers.length} users from 'enterprise' to 'elite' tier.`);
  }
}

export async function seedRefineryAndRegulationData() {
  const existingRefinery = await db.select().from(refineryUpdates);
  if (existingRefinery.length > 0) {
    console.log("Refinery & regulation data already seeded, skipping.");
    return;
  }

  const refineryData = [
    { refineryName: "Dangote Refinery", productionCapacity: 85, operationalStatus: "operational", pmsOutputEstimate: 320, dieselOutputEstimate: 180, jetOutputEstimate: 45, updateSource: "NNPC" },
    { refineryName: "Port Harcourt Refinery", productionCapacity: 40, operationalStatus: "maintenance", pmsOutputEstimate: 60, dieselOutputEstimate: 35, jetOutputEstimate: 10, updateSource: "NNPC" },
    { refineryName: "Warri Refinery", productionCapacity: 55, operationalStatus: "operational", pmsOutputEstimate: 80, dieselOutputEstimate: 45, jetOutputEstimate: 15, updateSource: "NNPC" },
    { refineryName: "Kaduna Refinery", productionCapacity: 0, operationalStatus: "shutdown", pmsOutputEstimate: 0, dieselOutputEstimate: 0, jetOutputEstimate: 0, updateSource: "NNPC" },
  ];

  for (const r of refineryData) {
    await db.insert(refineryUpdates).values(r);
  }

  const regulationData = [
    { title: "PPPRA Price Cap Adjustment", summary: "The PPPRA has announced a revised price band for PMS, increasing the cap to ₦650/L effective March 15. This reflects rising crude oil costs and FX pressures.", impactLevel: "high", effectiveDate: new Date("2026-03-15"), source: "PPPRA Gazette" },
    { title: "New Depot Licensing Requirements", summary: "NMDPRA introduces stricter licensing requirements for independent depot operators, including environmental compliance and storage capacity thresholds.", impactLevel: "medium", effectiveDate: new Date("2026-04-01"), source: "NMDPRA" },
    { title: "VAT Exemption on JET A1 Extended", summary: "Federal government extends VAT exemption on aviation fuel (JET A1) through Q2 2026 to support the aviation sector recovery.", impactLevel: "low", effectiveDate: new Date("2026-01-01"), source: "FIRS" },
    { title: "FX Window for Petroleum Imports", summary: "CBN establishes a dedicated FX window for petroleum product imports to stabilize pump prices. Eligible importers can access USD at official rates.", impactLevel: "high", effectiveDate: new Date("2026-03-10"), source: "CBN Circular" },
    { title: "LPG Price Deregulation Phase 2", summary: "Second phase of LPG market deregulation allows independent marketers to set prices based on market forces. Expected to increase competition.", impactLevel: "medium", effectiveDate: new Date("2026-03-20"), source: "NMDPRA" },
  ];

  for (const r of regulationData) {
    await db.insert(regulationUpdates).values(r);
  }

  console.log("Refinery updates and regulation data seeded successfully.");
}

export async function seedAdminUser() {
  const existingAdmin = await db.select().from(users).where(eq(users.email, "admin@fueliq.ng"));
  if (existingAdmin.length === 0) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      name: "Admin",
      email: "admin@fueliq.ng",
      password: hashedPassword,
      role: "admin",
    });
    console.log("Admin user seeded.");
  }
}
