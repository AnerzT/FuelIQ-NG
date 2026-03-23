import { storage } from "../storage.js";
import { computeForecastScore } from "./forecastScoring.js";

// Configuration
const NNPC_API_URL = process.env.NNPCL_API_URL || "https://api.nnpcgroup.com/v1";
const NNPC_API_KEY = process.env.NNPCL_API_KEY;
const SYNC_INTERVAL = parseInt(process.env.NNPC_SYNC_INTERVAL || "3600000"); // Default: 1 hour

// Types
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

// Mock NNPC data for development
const MOCK_NNPC_PRICES = {
  PMS: { price: 620, location: "Apapa", effectiveDate: new Date().toISOString() },
  AGO: { price: 950, location: "Apapa", effectiveDate: new Date().toISOString() },
  DPK: { price: 880, location: "Warri", effectiveDate: new Date().toISOString() },
  LPG: { price: 1100, location: "Port Harcourt", effectiveDate: new Date().toISOString() },
};

/**
 * Fetch current prices from NNPC API
 * Returns null if fetch fails or no API key configured.
 */
async function fetchNNPCPrices(): Promise<NNPCPricesResponse | null> {
  // Check if we should use mock data
  if (!NNPC_API_KEY || process.env.USE_MOCK_NNPC === "true") {
    console.log("🔧 Using mock NNPC data (no API key configured or mock enabled)");
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

    if (!response.ok) {
      throw new Error(`NNPC API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ Successfully fetched NNPC prices");
    return data;
  } catch (error) {
    console.error("❌ Failed to fetch NNPC prices:", error);
    return null;   // <-- CRITICAL: return null, not {}
  }
}

/**
 * Update market signals based on NNPC data
 */
async function updateSignalsFromNNPC(nnpcData: NNPCPricesResponse): Promise<void> {
  try {
    const terminals = await storage.getAllTerminals();
    
    for (const terminal of terminals) {
      // Get current signal or create a new one
      const currentSignal = await storage.getLatestSignal(terminal.id);
      
      // Determine NNPC supply status based on price trends
      let nnpcSupply = "Moderate";
      const terminalPrices = nnpcData.data.products.filter(p => 
        p.location.toLowerCase().includes(terminal.name.toLowerCase()) ||
        terminal.name.toLowerCase().includes(p.location.toLowerCase())
      );
      
      if (terminalPrices.length > 0) {
        // If prices are higher than average, supply might be tight
        const avgPrice = terminalPrices.reduce((sum, p) => sum + p.price, 0) / terminalPrices.length;
        if (avgPrice > 650) nnpcSupply = "Weak";
        else if (avgPrice < 600) nnpcSupply = "Strong";
      }
      
      // Create or update signal
      await storage.createSignal({
        terminalId: terminal.id,
        productType: "PMS",
        vesselActivity: currentSignal?.vesselActivity || "None",
        truckQueue: currentSignal?.truckQueue || "Low",
        nnpcSupply: nnpcSupply,
        fxPressure: currentSignal?.fxPressure || "Medium",
        policyRisk: currentSignal?.policyRisk || "Low",
      });
      
      console.log(`✅ Updated signal for terminal ${terminal.name} with NNPC data`);
    }
  } catch (error) {
    console.error("❌ Failed to update signals from NNPC:", error);
    throw error;
  }
}

/**
 * Generate forecasts based on NNPC data
 */
async function generateForecastsFromNNPC(nnpcData: NNPCPricesResponse): Promise<void> {
  try {
    const terminals = await storage.getAllTerminals();
    
    for (const terminal of terminals) {
      const signal = await storage.getLatestSignal(terminal.id);
      if (!signal) continue;
      
      const priceHistory = await storage.getPriceHistory(terminal.id, 30);
      const fxRates = await storage.getFxRates(10);
      
      // Create NNPC feed object from the data
      const nnpcFeed = {
        source: "NNPC",
        products: nnpcData.data.products,
        fetchedAt: new Date(),
      };
      
      const score = computeForecastScore({
        signal,
        priceHistory,
        nnpcFeed,
        fxRates,
        productType: "PMS",
      });
      
      await storage.createForecast({
        terminalId: terminal.id,
        productType: "PMS",
        expectedMin: score.expectedRange.min,
        expectedMax: score.expectedRange.max,
        bias: score.bias,
        confidence: score.confidence,
        suggestedAction: score.suggestedAction,
        depotPrice: 0,
        refineryInfluenceScore: 0,
        importParityPrice: 0,
        demandIndex: 0,
      });
      
      console.log(`✅ Generated forecast for terminal ${terminal.name} using NNPC data`);
    }
  } catch (error) {
    console.error("❌ Failed to generate forecasts from NNPC:", error);
    throw error;
  }
}

/**
 * Main function to sync NNPC data and update system
 */
export async function syncNNPCData(): Promise<NNPCUpdateResult> {
  const result: NNPCUpdateResult = {
    success: false,
    productsUpdated: 0,
    errors: [],
    timestamp: new Date(),
  };

  try {
    console.log("🔄 Starting NNPC data sync...");
    
    // Fetch NNPC data
    const nnpcData = await fetchNNPCPrices();
    if (!nnpcData || nnpcData.status !== "success") {
      throw new Error("Failed to fetch NNPC data");
    }
    
    result.productsUpdated = nnpcData.data.products.length;
    
    // Update market signals
    await updateSignalsFromNNPC(nnpcData);
    
    // Generate forecasts
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

/**
 * Get latest NNPC price for a specific product
 */
export async function getNNPCPrice(productType: string = "PMS"): Promise<{
  price: number;
  location: string;
  effectiveDate: Date;
} | null> {
  try {
    // Try to fetch fresh data
    const nnpcData = await fetchNNPCPrices();
    
    if (nnpcData?.data.products) {
      const product = nnpcData.data.products.find(p => 
        p.name.toUpperCase() === productType.toUpperCase()
      );
      
      if (product) {
        return {
          price: product.price,
          location: product.location,
          effectiveDate: new Date(product.effectiveDate),
        };
      }
    }
    
    // Fallback to mock data
    const mockData = MOCK_NNPC_PRICES[productType as keyof typeof MOCK_NNPC_PRICES];
    if (mockData) {
      return {
        price: mockData.price,
        location: mockData.location,
        effectiveDate: new Date(mockData.effectiveDate),
      };
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Failed to get NNPC price for ${productType}:`, error);
    return null;
  }
}

/**
 * Get NNPC price history (mock implementation)
 */
export async function getNNPCPriceHistory(
  productType: string = "PMS",
  days: number = 30
): Promise<Array<{ date: Date; price: number; location: string }>> {
  const history = [];
  const basePrice = MOCK_NNPC_PRICES[productType as keyof typeof MOCK_NNPC_PRICES]?.price || 620;
  const location = MOCK_NNPC_PRICES[productType as keyof typeof MOCK_NNPC_PRICES]?.location || "Apapa";
  
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Add some random variation to make it look realistic
    const variation = (Math.random() - 0.5) * 20;
    const price = Math.round(basePrice + variation);
    
    history.push({
      date,
      price,
      location,
    });
  }
  
  return history;
}

/**
 * Check if NNPC data is available
 */
export async function isNNPCAvailable(): Promise<boolean> {
  if (!NNPC_API_KEY) {
    return false;
  }
  
  try {
    const data = await fetchNNPCPrices();
    return data !== null && data.status === "success";
  } catch {
    return false;
  }
}

/**
 * Get NNPC sync status
 */
export function getNNPCSyncStatus(): {
  lastSync: Date | null;
  isConfigured: boolean;
  syncInterval: number;
  isRunning: boolean;
} {
  return {
    lastSync: null, // Would need to track this in storage
    isConfigured: !!NNPC_API_KEY || process.env.USE_MOCK_NNPC === "true",
    syncInterval: SYNC_INTERVAL,
    isRunning: false,
  };
}

// Auto-sync if enabled
if (process.env.AUTO_SYNC_NNPC === "true") {
  console.log("🔄 Auto-sync enabled for NNPC data");
  
  // Initial sync after 10 seconds
  setTimeout(async () => {
    console.log("🔄 Running initial NNPC sync...");
    await syncNNPCData();
  }, 10000);
  
  // Regular interval sync
  setInterval(async () => {
    console.log("🔄 Running scheduled NNPC sync...");
    await syncNNPCData();
  }, SYNC_INTERVAL);
}

export default {
  syncNNPCData,
  getNNPCPrice,
  getNNPCPriceHistory,
  isNNPCAvailable,
  getNNPCSyncStatus,
};
