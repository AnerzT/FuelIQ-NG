import { db } from "./storage";
import { users, terminals, marketSignals, forecasts, priceHistory } from "@shared/schema";
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
