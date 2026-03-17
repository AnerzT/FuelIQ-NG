import { MarketSignal, PriceHistoryEntry } from "../../shared/schema.js";

export interface ForecastResult {
  expectedMin: number;
  expectedMax: number;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  suggestedAction: string;
  probability: number;
  riskFactor: "low" | "medium" | "high";
}

/**
 * Computes a price forecast based on market signals and historical data
 */
export function computeForecast(
  signal: MarketSignal,
  history: PriceHistoryEntry[],
  productType: string = "PMS"
): ForecastResult {
  // Base price from history or default
  const latestPrice = history.length > 0 
    ? history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.price 
    : 620;
  
  const basePrice = latestPrice || 620;
  
  // Calculate signal impacts
  const vesselImpact = getVesselActivityImpact(signal.vesselActivity);
  const truckImpact = getTruckQueueImpact(signal.truckQueue);
  const supplyImpact = getSupplyImpact(signal.nnpcSupply);
  const fxImpact = getFxImpact(signal.fxPressure);
  const policyImpact = getPolicyImpact(signal.policyRisk);
  
  // Combined impact score (-1 to 1)
  const totalImpact = (vesselImpact + truckImpact + supplyImpact + fxImpact + policyImpact) / 5;
  
  // Calculate expected price range
  const volatility = calculateVolatility(history);
  const expectedChange = totalImpact * volatility * 100;
  
  const expectedMin = Math.round(basePrice + expectedChange - volatility * 50);
  const expectedMax = Math.round(basePrice + expectedChange + volatility * 50);
  
  // Determine bias
  let bias: "bullish" | "bearish" | "neutral" = "neutral";
  if (totalImpact > 0.2) bias = "bullish";
  else if (totalImpact < -0.2) bias = "bearish";
  
  // Calculate confidence (0-100)
  const confidence = calculateConfidence(signal, history);
  
  // Determine risk factor
  const riskFactor = getRiskFactor(volatility, totalImpact);
  
  // Generate suggested action
  const suggestedAction = generateSuggestedAction(bias, riskFactor, expectedMin, expectedMax);
  
  // Calculate probability (simplified)
  const probability = 50 + (totalImpact * 30);
  
  return {
    expectedMin,
    expectedMax,
    bias,
    confidence,
    suggestedAction,
    probability: Math.min(95, Math.max(5, Math.round(probability))),
    riskFactor
  };
}

function getVesselActivityImpact(activity: string): number {
  const impacts: Record<string, number> = {
    "None": 0,
    "Low": -0.1,
    "Moderate": 0.1,
    "High": 0.3,
    "Very High": 0.5
  };
  return impacts[activity] || 0;
}

function getTruckQueueImpact(queue: string): number {
  const impacts: Record<string, number> = {
    "None": 0,
    "Low": 0.1,
    "Medium": 0.3,
    "High": 0.5,
    "Severe": 0.7
  };
  return impacts[queue] || 0;
}

function getSupplyImpact(supply: string): number {
  const impacts: Record<string, number> = {
    "Strong": -0.3,
    "Moderate": 0,
    "Weak": 0.3,
    "Critical": 0.6
  };
  return impacts[supply] || 0;
}

function getFxImpact(pressure: string): number {
  const impacts: Record<string, number> = {
    "Low": -0.1,
    "Medium": 0.2,
    "High": 0.4,
    "Severe": 0.6
  };
  return impacts[pressure] || 0;
}

function getPolicyImpact(risk: string): number {
  const impacts: Record<string, number> = {
    "Low": -0.1,
    "Medium": 0.1,
    "High": 0.3,
    "Critical": 0.5
  };
  return impacts[risk] || 0;
}

function calculateVolatility(history: PriceHistoryEntry[]): number {
  if (history.length < 2) return 0.05;
  
  const prices = history.map(h => h.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  
  // Normalize volatility (0.02 to 0.15)
  return Math.min(0.15, Math.max(0.02, stdDev / mean));
}

function calculateConfidence(signal: MarketSignal, history: PriceHistoryEntry[]): number {
  let confidence = 70; // Base confidence
  
  // Adjust based on data quality
  if (history.length > 20) confidence += 10;
  else if (history.length < 5) confidence -= 20;
  
  // Adjust based on signal completeness
  const signalFields = [
    signal.vesselActivity,
    signal.truckQueue,
    signal.nnpcSupply,
    signal.fxPressure,
    signal.policyRisk
  ];
  
  const validFields = signalFields.filter(f => f && f !== "None").length;
  confidence += validFields * 5;
  
  return Math.min(95, Math.max(40, confidence));
}

function getRiskFactor(volatility: number, impact: number): "low" | "medium" | "high" {
  const riskScore = volatility * 10 + Math.abs(impact) * 5;
  
  if (riskScore < 0.5) return "low";
  if (riskScore < 1.0) return "medium";
  return "high";
}

function generateSuggestedAction(
  bias: "bullish" | "bearish" | "neutral",
  riskFactor: "low" | "medium" | "high",
  minPrice: number,
  maxPrice: number
): string {
  const actions: Record<string, string> = {
    bullish_low: "Consider loading early. Prices expected to rise moderately.",
    bullish_medium: "Load before 8am. Anticipate price increases by midday.",
    bullish_high: "URGENT: Load immediately. Significant price surge expected.",
    bearish_low: "Delay purchases if possible. Prices may soften.",
    bearish_medium: "Wait for better pricing. Downward trend likely.",
    bearish_high: "HOLD all purchases. Major price drop expected.",
    neutral_low: "Normal loading advised. Stable prices expected.",
    neutral_medium: "Monitor closely. Some volatility expected.",
    neutral_high: "Caution advised. Unusual market conditions."
  };
  
  const key = `${bias}_${riskFactor}`;
  return actions[key] || `Expected range: ₦${minPrice} - ₦${maxPrice}. Load with caution.`;
}

/**
 * Generates a multi-product forecast for a terminal
 */
export function generateMultiProductForecast(
  terminalId: string,
  signals: Record<string, MarketSignal>,
  history: Record<string, PriceHistoryEntry[]>
): Record<string, ForecastResult> {
  const products = ["PMS", "AGO", "JET_A1", "ATK", "LPG"];
  const results: Record<string, ForecastResult> = {};
  
  for (const product of products) {
    const signal = signals[product];
    const productHistory = history[product] || [];
    
    if (signal) {
      results[product] = computeForecast(signal, productHistory, product);
    }
  }
  
  return results;
}

/**
 * Calculates the spread between two products
 */
export function calculateSpread(product1: string, product2: string, prices: Record<string, number>): number {
  const price1 = prices[product1] || 0;
  const price2 = prices[product2] || 0;
  return Math.round((price1 - price2) * 100) / 100;
}

/**
 * Determines if arbitrage opportunity exists
 */
export function detectArbitrageOpportunity(
  terminalId: string,
  prices: Record<string, number>,
  threshold: number = 50
): { exists: boolean; spread: number; recommendation: string } | null {
  const pmsPrice = prices["PMS"] || 0;
  const agoPrice = prices["AGO"] || 0;
  
  if (!pmsPrice || !agoPrice) return null;
  
  const spread = agoPrice - pmsPrice;
  
  if (spread > threshold) {
    return {
      exists: true,
      spread,
      recommendation: "Consider AGO over PMS. Spread is favorable."
    };
  }
  
  return {
    exists: false,
    spread,
    recommendation: "No significant arbitrage opportunity detected."
  };
}
