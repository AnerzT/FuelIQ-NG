import { MarketSignal, PriceHistoryEntry, FxRate } from "../../shared/schema.js";

export interface ScoreResult {
  bias: "bullish" | "bearish" | "neutral";
  probability: number;
  expectedRange: { min: number; max: number };
  confidence: number;
  suggestedAction: string;
  riskFactor: "low" | "medium" | "high";
  scoring: {
    technicalScore: number;
    fundamentalScore: number;
    sentimentScore: number;
    totalScore: number;
  };
}

interface ScoreInput {
  signal: MarketSignal;
  priceHistory: PriceHistoryEntry[];
  nnpcFeed: any | null;
  fxRates: FxRate[];
  productType: string;
}

/**
 * Computes an AI-powered forecast score based on multiple data sources
 */
export function computeForecastScore(input: ScoreInput): ScoreResult {
  const { signal, priceHistory, nnpcFeed, fxRates, productType } = input;
  
  // Calculate individual scores
  const technicalScore = calculateTechnicalScore(priceHistory);
  const fundamentalScore = calculateFundamentalScore(signal, nnpcFeed);
  const sentimentScore = calculateSentimentScore(signal, fxRates);
  
  // Weighted total score (0-100)
  const totalScore = Math.round(
    technicalScore * 0.3 + 
    fundamentalScore * 0.4 + 
    sentimentScore * 0.3
  );
  
  // Determine bias based on total score
  let bias: "bullish" | "bearish" | "neutral" = "neutral";
  if (totalScore > 60) bias = "bullish";
  else if (totalScore < 40) bias = "bearish";
  
  // Calculate expected price range
  const latestPrice = priceHistory.length > 0 
    ? priceHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.price 
    : 620;
  
  const basePrice = latestPrice || 620;
  const volatility = calculateVolatility(priceHistory);
  const expectedChange = ((totalScore - 50) / 50) * volatility * 100;
  
  const expectedMin = Math.max(0, Math.round(basePrice + expectedChange - volatility * 40));
  const expectedMax = Math.round(basePrice + expectedChange + volatility * 40);
  
  // Calculate confidence level
  const confidence = calculateConfidenceLevel(priceHistory, signal);
  
  // Determine risk factor
  const riskFactor = determineRiskFactor(volatility, totalScore);
  
  // Generate suggested action
  const suggestedAction = generateSmartAction(
    bias, 
    riskFactor, 
    expectedMin, 
    expectedMax, 
    productType
  );
  
  // Calculate probability (simplified)
  const probability = Math.min(95, Math.max(5, Math.round(50 + (totalScore - 50) * 0.8)));
  
  return {
    bias,
    probability,
    expectedRange: { min: expectedMin, max: expectedMax },
    confidence,
    suggestedAction,
    riskFactor,
    scoring: {
      technicalScore: Math.round(technicalScore),
      fundamentalScore: Math.round(fundamentalScore),
      sentimentScore: Math.round(sentimentScore),
      totalScore
    }
  };
}

function calculateTechnicalScore(history: PriceHistoryEntry[]): number {
  if (history.length < 5) return 50;
  
  const prices = history.map(h => h.price);
  const recentPrices = prices.slice(0, 7);
  const olderPrices = prices.slice(7, 14);
  
  if (recentPrices.length === 0 || olderPrices.length === 0) return 50;
  
  const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
  const olderAvg = olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length;
  
  // Calculate trend
  const trend = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  // Calculate RSI-like indicator
  const gains = [];
  const losses = [];
  
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i-1] - prices[i];
    if (change > 0) gains.push(change);
    else losses.push(Math.abs(change));
  }
  
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  // Combine indicators
  let score = 50;
  score += trend * 2;
  score += (rsi - 50) * 0.5;
  
  return Math.min(95, Math.max(5, score));
}

function calculateFundamentalScore(signal: MarketSignal, nnpcFeed: any | null): number {
  let score = 50;
  
  // Supply analysis
  const supplyImpact: Record<string, number> = {
    "Strong": 20,
    "Moderate": 0,
    "Weak": -15,
    "Critical": -30
  };
  score += supplyImpact[signal.nnpcSupply] || 0;
  
  // Queue analysis (demand indicator)
  const queueImpact: Record<string, number> = {
    "None": -10,
    "Low": 0,
    "Medium": 10,
    "High": 20,
    "Severe": 30
  };
  score += queueImpact[signal.truckQueue] || 0;
  
  // NNPC feed adjustment
  if (nnpcFeed) {
    // Add logic for NNPC feed impact
    score += 5;
  }
  
  return Math.min(95, Math.max(5, score));
}

function calculateSentimentScore(signal: MarketSignal, fxRates: FxRate[]): number {
  let score = 50;
  
  // Vessel activity sentiment
  const vesselImpact: Record<string, number> = {
    "None": -10,
    "Low": 0,
    "Moderate": 5,
    "High": 15,
    "Very High": 20
  };
  score += vesselImpact[signal.vesselActivity] || 0;
  
  // FX pressure impact
  const fxImpact: Record<string, number> = {
    "Low": 10,
    "Medium": -5,
    "High": -20,
    "Severe": -30
  };
  score += fxImpact[signal.fxPressure] || 0;
  
  // Policy risk impact
  const policyImpact: Record<string, number> = {
    "Low": 5,
    "Medium": -5,
    "High": -15,
    "Critical": -25
  };
  score += policyImpact[signal.policyRisk] || 0;
  
  // FX rate trend
  if (fxRates.length > 1) {
    const latestRate = fxRates[0]?.rate || 0;
    const previousRate = fxRates[1]?.rate || 0;
    
    if (latestRate > previousRate) {
      score -= 5; // Weakening naira is bearish
    } else if (latestRate < previousRate) {
      score += 5; // Strengthening naira is bullish
    }
  }
  
  return Math.min(95, Math.max(5, score));
}

function calculateVolatility(history: PriceHistoryEntry[]): number {
  if (history.length < 5) return 0.05;
  
  const prices = history.map(h => h.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  
  return Math.min(0.15, Math.max(0.02, stdDev / mean));
}

function calculateConfidenceLevel(history: PriceHistoryEntry[], signal: MarketSignal): number {
  let confidence = 70;
  
  // Data quantity confidence
  if (history.length > 30) confidence += 15;
  else if (history.length > 20) confidence += 10;
  else if (history.length > 10) confidence += 5;
  else if (history.length < 5) confidence -= 20;
  
  // Signal quality confidence
  const signalFields = [
    signal.vesselActivity,
    signal.truckQueue,
    signal.nnpcSupply,
    signal.fxPressure,
    signal.policyRisk
  ];
  
  const validFields = signalFields.filter(f => f && f !== "None").length;
  confidence += validFields * 3;
  
  return Math.min(98, Math.max(30, confidence));
}

function determineRiskFactor(volatility: number, score: number): "low" | "medium" | "high" {
  const riskFromVolatility = volatility * 10;
  const riskFromScore = Math.abs(score - 50) / 50;
  const totalRisk = riskFromVolatility + riskFromScore;
  
  if (totalRisk < 0.4) return "low";
  if (totalRisk < 0.8) return "medium";
  return "high";
}

function generateSmartAction(
  bias: "bullish" | "bearish" | "neutral",
  risk: "low" | "medium" | "high",
  minPrice: number,
  maxPrice: number,
  productType: string
): string {
  const product = productType || "PMS";
  
  const actions: Record<string, string> = {
    bullish_low: `Load ${product} early. Prices expected to rise moderately to ₦${maxPrice}.`,
    bullish_medium: `Load ${product} before 8am. Anticipate price increases to ₦${maxPrice}.`,
    bullish_high: `URGENT: Load ${product} immediately. Prices expected to surge to ₦${maxPrice}.`,
    bearish_low: `Delay ${product} purchases. Prices may soften to ₦${minPrice}.`,
    bearish_medium: `Wait for better ${product} pricing. Downward trend to ₦${minPrice} expected.`,
    bearish_high: `HOLD all ${product} purchases. Major price drop to ₦${minPrice} expected.`,
    neutral_low: `Normal ${product} loading advised. Range: ₦${minPrice}-₦${maxPrice}.`,
    neutral_medium: `Monitor ${product} closely. Some volatility expected in range ₦${minPrice}-₦${maxPrice}.`,
    neutral_high: `Caution advised for ${product}. Unusual market conditions. Range: ₦${minPrice}-₦${maxPrice}.`
  };
  
  const key = `${bias}_${risk}`;
  return actions[key] || `${product} expected range: ₦${minPrice} - ₦${maxPrice}. Load with caution.`;
}

/**
 * Calculates the risk-reward ratio for a potential trade
 */
export function calculateRiskRewardRatio(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  
  if (risk === 0) return 0;
  return Math.round((reward / risk) * 10) / 10;
}

/**
 * Determines if market conditions are favorable for trading
 */
export function isMarketFavorable(score: ScoreResult): boolean {
  return score.bias !== "bearish" && score.riskFactor !== "high" && score.confidence > 60;
}

/**
 * Compares two forecasts and returns the better option
 */
export function compareForecasts(
  forecast1: ScoreResult,
  forecast2: ScoreResult
): {
  better: "first" | "second" | "equal";
  reason: string;
} {
  const score1 = forecast1.scoring.totalScore;
  const score2 = forecast2.scoring.totalScore;
  const conf1 = forecast1.confidence;
  const conf2 = forecast2.confidence;
  
  if (score1 > score2 && conf1 > conf2) {
    return { better: "first", reason: "Higher confidence and better score" };
  } else if (score2 > score1 && conf2 > conf1) {
    return { better: "second", reason: "Higher confidence and better score" };
  } else if (score1 > score2) {
    return { better: "first", reason: "Better score despite lower confidence" };
  } else if (score2 > score1) {
    return { better: "second", reason: "Better score despite lower confidence" };
  }
  
  return { better: "equal", reason: "Forecasts are comparable" };
}
