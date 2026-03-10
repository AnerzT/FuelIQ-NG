import { storage } from "../storage.js";

const FX_API_KEY = process.env.FX_API_KEY || "";
const FX_API_URL = process.env.FX_API_URL || "https://api.exchangerate.host/latest";

interface FxApiResponse {
  success: boolean;
  rates: Record<string, number>;
  base: string;
}

async function fetchLiveFxRate(): Promise<number | null> {
  if (!FX_API_KEY) {
    return null;
  }

  try {
    const url = FX_API_KEY
      ? `${FX_API_URL}?base=USD&symbols=NGN&access_key=${FX_API_KEY}`
      : `${FX_API_URL}?base=USD&symbols=NGN`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[FX] API responded with ${response.status}`);
      return null;
    }

    const data = (await response.json()) as FxApiResponse;
    const ngnRate = data.rates?.NGN;

    if (typeof ngnRate !== "number" || ngnRate <= 0) {
      console.error("[FX] Invalid rate in API response");
      return null;
    }

    return ngnRate;
  } catch (err: any) {
    console.error(`[FX] Fetch failed: ${err.message}`);
    return null;
  }
}

function simulateFxRate(): number {
  const baseRate = 1550;
  const variance = Math.round((Math.random() - 0.5) * 100);
  return baseRate + variance;
}

export interface FxVolatility {
  currentRate: number;
  previousRate: number | null;
  changePercent: number;
  volatilityLevel: "Low" | "Medium" | "High";
  trend: "strengthening" | "weakening" | "stable";
}

function classifyVolatility(changePercent: number): "Low" | "Medium" | "High" {
  const abs = Math.abs(changePercent);
  if (abs < 1) return "Low";
  if (abs < 3) return "Medium";
  return "High";
}

function classifyTrend(changePercent: number): "strengthening" | "weakening" | "stable" {
  if (changePercent > 0.5) return "weakening";
  if (changePercent < -0.5) return "strengthening";
  return "stable";
}

export async function syncFxRate(): Promise<{
  rate: number;
  source: "api" | "simulated";
  volatility: FxVolatility;
}> {
  let rate = await fetchLiveFxRate();
  const source: "api" | "simulated" = rate !== null ? "api" : "simulated";

  if (rate === null) {
    rate = simulateFxRate();
  }

  const stored = await storage.createFxRate({
    rate,
    source: source === "api" ? "exchangerate.host" : "simulated",
  });

  const recentRates = await storage.getFxRates(2);
  const previousRate = recentRates.length > 1 ? recentRates[1].rate : null;

  const changePercent = previousRate
    ? ((rate - previousRate) / previousRate) * 100
    : 0;

  const volatility: FxVolatility = {
    currentRate: rate,
    previousRate,
    changePercent: Math.round(changePercent * 100) / 100,
    volatilityLevel: classifyVolatility(changePercent),
    trend: classifyTrend(changePercent),
  };

  console.log(
    `[FX] USD/NGN: ₦${rate} (${source}), change: ${volatility.changePercent}%, volatility: ${volatility.volatilityLevel}, trend: ${volatility.trend}`
  );

  return { rate, source, volatility };
}

export async function getFxVolatility(): Promise<FxVolatility> {
  const recentRates = await storage.getFxRates(10);

  if (recentRates.length === 0) {
    return {
      currentRate: 0,
      previousRate: null,
      changePercent: 0,
      volatilityLevel: "Low",
      trend: "stable",
    };
  }

  const current = recentRates[0].rate;
  const previous = recentRates.length > 1 ? recentRates[1].rate : null;

  const changePercent = previous
    ? ((current - previous) / previous) * 100
    : 0;

  if (recentRates.length >= 5) {
    const rates = recentRates.slice(0, 5).map((r) => r.rate);
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100;

    return {
      currentRate: current,
      previousRate: previous,
      changePercent: Math.round(changePercent * 100) / 100,
      volatilityLevel: cv > 2 ? "High" : cv > 0.5 ? "Medium" : "Low",
      trend: classifyTrend(changePercent),
    };
  }

  return {
    currentRate: current,
    previousRate: previous,
    changePercent: Math.round(changePercent * 100) / 100,
    volatilityLevel: classifyVolatility(changePercent),
    trend: classifyTrend(changePercent),
  };
}

export async function updateFxPressureSignals(): Promise<number> {
  const volatility = await getFxVolatility();
  const fxPressure = volatility.volatilityLevel;

  const terminals = await storage.getTerminals();
  const activeTerminals = terminals.filter((t) => t.active);
  let updated = 0;

  for (const terminal of activeTerminals) {
    try {
      const existing = await storage.getLatestSignal(terminal.id);
      if (!existing) continue;

      await storage.createSignal({
        terminalId: terminal.id,
        vesselActivity: existing.vesselActivity,
        truckQueue: existing.truckQueue,
        nnpcSupply: existing.nnpcSupply,
        fxPressure,
        policyRisk: existing.policyRisk,
      });

      updated++;
    } catch (err: any) {
      console.error(`[FX] Signal update failed for ${terminal.name}: ${err.message}`);
    }
  }

  console.log(`[FX] Updated fxPressure to "${fxPressure}" for ${updated} terminals`);
  return updated;
}
