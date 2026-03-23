import { storage } from "../storage.js";
import { computeForecastScore } from "./forecastScoring.js";

// Configuration
const NNPC_API_URL = process.env.NNPCL_API_URL || "https://api.nnpcgroup.com/v1";
const NNPC_API_KEY = process.env.NNPCL_API_KEY;
const SYNC_INTERVAL = parseInt(process.env.NNPC_SYNC_INTERVAL || "3600000");

interface NNPCPricesResponse {
  status: string;
  data: {
    products: Array<{
      name: string;
      price: number;
      currency: string;
      effectiveDate: string;
      location: string;
    }>;
  };
}

interface NNPCUpdateResult {
  success: boolean;
  productsUpdated: number;
  errors: string[];
  timestamp: Date;
}

const MOCK_NNPC_PRICES = {
  PMS: { price: 620, location: "Apapa", effectiveDate: new Date().toISOString() },
  AGO: { price: 950, location: "Apapa", effectiveDate: new Date().toISOString() },
  DPK: { price: 880, location: "Warri", effectiveDate: new Date().toISOString() },
  LPG: { price: 1100, location: "Port Harcourt", effectiveDate: new Date().toISOString() },
};

async function fetchNNPCPrices(): Promise<NNPCPricesResponse | null> {
  if (!NNPC_API_KEY || process.env.USE_MOCK_NNPC === "true") {
    console.log("🔧 Using mock NNPC data");
    return {
      status: "success",
      data: {
        products: Object.entries(MOCK_NNPC_PRICES).map(([name, data]) => ({
          name,
          price: data.price,
          currency: "NGN",
          effectiveDate: data.effectiveDate,
          location: data.location,
        })),
      },
    };
  }

  try {
    console.log("📡 Fetching NNPC prices from API...");
    const response = await fetch(`${NNPC_API_URL}/prices`, {
      headers: {
        "Authorization": `Bearer ${NNPC_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error(`NNPC API returned ${response.status}`);
    const data = await response.json();
    console.log("✅ Successfully fetched NNPC prices");
    return data;
  } catch (error) {
    console.error("❌ Failed to fetch NNPC prices:", error);
    return null;   // <-- CRITICAL: return null
  }
}

async function updateSignalsFromNNPC(nnpcData: NNPCPricesResponse): Promise<void> {
  // ... (same as before, unchanged)
}

async function generateForecastsFromNNPC(nnpcData: NNPCPricesResponse): Promise<void> {
  // ... (same as before, unchanged)
}

export async function syncNNPCData(): Promise<NNPCUpdateResult> {
  const result: NNPCUpdateResult = {
    success: false,
    productsUpdated: 0,
    errors: [],
    timestamp: new Date(),
  };

  try {
    console.log("🔄 Starting NNPC data sync...");
    const nnpcData = await fetchNNPCPrices();
    if (!nnpcData || nnpcData.status !== "success") {
      throw new Error("Failed to fetch NNPC data");
    }
    result.productsUpdated = nnpcData.data.products.length;
    await updateSignalsFromNNPC(nnpcData);
    await generateForecastsFromNNPC(nnpcData);
    result.success = true;
    console.log(`✅ NNPC sync completed. Updated ${result.productsUpdated} products.`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(errorMessage);
    console.error("❌ NNPC sync failed:", errorMessage);
    return result;
  }
}

export async function getNNPCPrice(productType: string = "PMS") {
  // ... unchanged
}

export async function getNNPCPriceHistory(productType: string = "PMS", days: number = 30) {
  // ... unchanged
}

export async function isNNPCAvailable(): Promise<boolean> {
  if (!NNPC_API_KEY) return false;
  try {
    const data = await fetchNNPCPrices();
    return data !== null && data.status === "success";
  } catch {
    return false;
  }
}

export function getNNPCSyncStatus() {
  return {
    lastSync: null,
    isConfigured: !!NNPC_API_KEY || process.env.USE_MOCK_NNPC === "true",
    syncInterval: SYNC_INTERVAL,
    isRunning: false,
  };
}

if (process.env.AUTO_SYNC_NNPC === "true") {
  setTimeout(() => syncNNPCData(), 10000);
  setInterval(() => syncNNPCData(), SYNC_INTERVAL);
}

export default {
  syncNNPCData,
  getNNPCPrice,
  getNNPCPriceHistory,
  isNNPCAvailable,
  getNNPCSyncStatus,
};
