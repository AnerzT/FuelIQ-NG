import { storage } from "../storage.js";
import { computeForecastScore } from "./forecastScoring.js";

const NNPC_API_URL = process.env.NNPC_API_URL || "";

interface NnpcPriceResponse {
  product: string;
  price: number;
  unit: string;
  date: string;
}

async function fetchNnpcPrice(): Promise<number | null> {
  if (!NNPC_API_URL) {
    return null;
  }

  try {
    const response = await fetch(NNPC_API_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[NNPC] API responded with ${response.status}`);
      return null;
    }

    const data = (await response.json()) as NnpcPriceResponse;
    return data.price ?? null;
  } catch (err: any) {
    console.error(`[NNPC] Fetch failed: ${err.message}`);
    return null;
  }
}

function simulateNnpcPrice(): number {
  const basePrice = 617;
  const variance = Math.round((Math.random() - 0.5) * 20);
  return basePrice + variance;
}

export async function syncNnpcPriceFeed(): Promise<{
  price: number;
  source: "api" | "simulated";
  terminalId?: string;
}> {
  let price = await fetchNnpcPrice();
  const source: "api" | "simulated" = price !== null ? "api" : "simulated";

  if (price === null) {
    price = simulateNnpcPrice();
  }

  const feed = await storage.createExternalPriceFeed({
    source: "NNPC",
    sourceName: "NNPC",
    productType: "PMS",
    price,
    terminalId: null,
    currency: "NGN",
  } as any);

  console.log(`[NNPC] Synced PMS price: ₦${price}/litre (${source})`);
  return { price, source, terminalId: (feed as any).terminalId ?? undefined };
}

function classifyNnpcSupply(currentPrice: number, previousPrice: number | null): "Strong" | "Moderate" | "Weak" {
  if (!previousPrice) return "Moderate";
  const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
  if (changePercent < -1) return "Strong";
  if (changePercent > 2) return "Weak";
  return "Moderate";
}

export async function syncAndRecalculateForecasts(): Promise<{
  priceSync: { price: number; source: string };
  forecastsUpdated: number;
}> {
  const priceSync = await syncNnpcPriceFeed();

  const previousFeeds = await storage.getExternalPriceFeedBySource("NNPC", 2);
  const previousPrice = previousFeeds.length > 1 ? previousFeeds[1].price : null;
  const nnpcSupplyLevel = classifyNnpcSupply(priceSync.price, previousPrice);

  const terminals = await storage.getTerminals();
  const activeTerminals = terminals.filter((t) => t.active);
  let forecastsUpdated = 0;

  for (const terminal of activeTerminals) {
    try {
      const terminalId = String(terminal.id);
      const existingSignal = await storage.getLatestSignal(terminalId);
      if (!existingSignal) continue;

      const updatedSignal = await storage.createSignal({
        terminalId,
        productType: (existingSignal as any).productType || "PMS",
        vesselActivity: (existingSignal as any).vesselActivity || null,
        truckQueue: (existingSignal as any).truckQueue || null,
        nnpcSupply: nnpcSupplyLevel,
        fxPressure: (existingSignal as any).fxPressure || null,
        policyRisk: (existingSignal as any).policyRisk || null,
        signalType: null,
        value: null,
        description: null,
      } as any);

      const [history, nnpcFeeds, fxRatesData] = await Promise.all([
        storage.getPriceHistory(terminalId, 30),
        storage.getExternalPriceFeedBySource("NNPC", 1),
        storage.getFxRates(10),
      ]);

      const result = computeForecastScore({
        signal: updatedSignal,
        priceHistory: history,
        nnpcFeed: nnpcFeeds[0] ?? null,
        fxRates: fxRatesData,
      });

      await storage.createForecast({
        terminalId,
        productType: "PMS",
        expectedMin: result.expectedRange.min,
        expectedMax: result.expectedRange.max,
        bias: result.bias,
        confidence: result.confidence,
        suggestedAction: result.suggestedAction,
        depotPrice: 0,
        refineryInfluenceScore: 0,
        importParityPrice: 0,
        demandIndex: 0,
      } as any);

      forecastsUpdated++;
    } catch (err: any) {
      console.error(`[NNPC] Forecast recalc failed for ${terminal.name}: ${err.message}`);
    }
  }

  console.log(`[NNPC] Recalculated ${forecastsUpdated} forecasts (nnpcSupply=${nnpcSupplyLevel}) after price sync`);
  return { priceSync, forecastsUpdated };
}

export async function getLatestNnpcPrice(): Promise<number | null> {
  const feeds = await storage.getExternalPriceFeedBySource("NNPC", 1);
  return feeds[0]?.price ?? null;
}
