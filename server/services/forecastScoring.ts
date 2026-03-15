import type { MarketSignal, PriceHistoryEntry, ExternalPriceFeed, FxRate } from "../../shared/schema.js";

export interface ScoringInput {
  signal: MarketSignal;
  priceHistory: PriceHistoryEntry[];
  nnpcFeed?: ExternalPriceFeed | null;
  fxRates?: FxRate[];
  productType?: string;
  depotSpread?: number;
  traderSentiment?: number;
}

export interface ProbabilityDistribution {
  increase: number;
  decrease: number;
  stable: number;
}

export interface ForecastScore {
  bias: "bullish" | "bearish" | "neutral";
  probability: ProbabilityDistribution;
  expectedRange: { min: number; max: number };
  confidence: number;
  suggestedAction: string;
  riskFactor: number;
  scoring: {
    featureVector: FeatureVector;
    weights: FeatureWeights;
    logit: number;
    sigmoidP: number;
    riskFactor: number;
    trendScore: number;
    volatilityScore: number;
    compositeScore: number;
  };
}

export interface FeatureVector {
  fxVolatility: number;
  vesselCount: number;
  refineryOutputIndex: number;
  depotSpread: number;
  regulationImpact: number;
  demandIndex: number;
  historicalVolatility: number;
  traderSentimentScore: number;
}

export interface FeatureWeights {
  fxVolatility: number;
  vesselCount: number;
  refineryOutputIndex: number;
  depotSpread: number;
  regulationImpact: number;
  demandIndex: number;
  historicalVolatility: number;
  traderSentimentScore: number;
}

const SIGNAL_ENCODING: Record<string, Record<string, number>> = {
  vesselActivity: { None: 0.0, Low: 0.33, Moderate: 0.66, High: 1.0 },
  truckQueue:     { Low: 0.2, Medium: 0.5, High: 0.9 },
  nnpcSupply:     { Strong: 0.9, Moderate: 0.5, Weak: 0.15 },
  fxPressure:     { Low: 0.15, Medium: 0.5, High: 0.9 },
  policyRisk:     { Low: 0.1, Medium: 0.5, High: 0.9 },
};

const BASE_WEIGHTS: FeatureWeights = {
  fxVolatility:         0.20,
  vesselCount:         -0.15,
  refineryOutputIndex: -0.12,
  depotSpread:          0.08,
  regulationImpact:     0.15,
  demandIndex:          0.18,
  historicalVolatility: 0.10,
  traderSentimentScore: 0.12,
};

const PRODUCT_WEIGHTS: Record<string, FeatureWeights> = {
  PMS: { ...BASE_WEIGHTS },
  AGO: {
    fxVolatility:         0.28,
    vesselCount:         -0.10,
    refineryOutputIndex: -0.08,
    depotSpread:          0.10,
    regulationImpact:     0.10,
    demandIndex:          0.22,
    historicalVolatility: 0.08,
    traderSentimentScore: 0.14,
  },
  JET_A1: {
    fxVolatility:         0.22,
    vesselCount:         -0.12,
    refineryOutputIndex: -0.10,
    depotSpread:          0.06,
    regulationImpact:     0.12,
    demandIndex:          0.20,
    historicalVolatility: 0.10,
    traderSentimentScore: 0.08,
  },
  ATK: {
    fxVolatility:         0.20,
    vesselCount:         -0.12,
    refineryOutputIndex: -0.10,
    depotSpread:          0.06,
    regulationImpact:     0.14,
    demandIndex:          0.18,
    historicalVolatility: 0.12,
    traderSentimentScore: 0.08,
  },
  LPG: {
    fxVolatility:         0.15,
    vesselCount:         -0.22,
    refineryOutputIndex: -0.10,
    depotSpread:          0.12,
    regulationImpact:     0.08,
    demandIndex:          0.15,
    historicalVolatility: 0.08,
    traderSentimentScore: 0.10,
  },
};

const PRODUCT_BIAS: Record<string, number> = {
  PMS:    0.05,
  AGO:    0.08,
  JET_A1: 0.03,
  ATK:    0.02,
  LPG:   -0.02,
};

const PRODUCT_DEFAULT_RANGES: Record<string, { min: number; max: number; base: number }> = {
  PMS:    { min: 610, max: 625, base: 617 },
  AGO:    { min: 950, max: 980, base: 965 },
  JET_A1: { min: 1050, max: 1100, base: 1075 },
  ATK:    { min: 1000, max: 1060, base: 1030 },
  LPG:    { min: 800, max: 850, base: 825 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeLevel(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim();
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function encodeSignal(key: string, value: string | null | undefined): number {
  if (!value) return 0.5;
  const level = normalizeLevel(value);
  return SIGNAL_ENCODING[key]?.[level] ?? 0.5;
}

function computeHistoricalVolatility(history: PriceHistoryEntry[]): number {
  if (history.length < 3) return 0.5;
  const prices = history.map((p) => p.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (mean === 0) return 0.5;
  const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  return clamp(cv * 12, 0, 1);
}

function computeHistoricalStdDev(history: PriceHistoryEntry[]): number {
  if (history.length < 3) return 15;
  const prices = history.map((p) => p.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length;
  return Math.sqrt(variance);
}

function computePriceTrend(history: PriceHistoryEntry[]): number {
  if (history.length < 2) return 0.5;
  const sorted = [...history].sort(
    (a, b) => new Date((a as any).date ?? a.recordedAt).getTime() - new Date((b as any).date ?? b.recordedAt).getTime()
  );
  const n = sorted.length;
  const prices = sorted.map((p) => p.price);
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgPrice = sumY / n;
  if (avgPrice === 0) return 0.5;
  const normalizedSlope = slope / avgPrice;
  return clamp(0.5 + normalizedSlope * 50, 0, 1);
}

function computeFxVolatility(fxRates: FxRate[]): number {
  if (!fxRates || fxRates.length < 2) return 0.5;
  const rates = fxRates.map((r) => r.rate);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  if (mean === 0) return 0.5;
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
  const cv = Math.sqrt(variance) / mean;
  return clamp(cv * 25, 0, 1);
}

function computeRefineryOutputIndex(signal: MarketSignal, nnpcFeed: ExternalPriceFeed | null | undefined): number {
  const supplyScore = encodeSignal("nnpcSupply", (signal as any).nnpcSupply);
  if (!nnpcFeed) return supplyScore;
  const priceFactor = nnpcFeed.price > 0 ? clamp(nnpcFeed.price / 700, 0, 1) : 0.5;
  return (supplyScore * 0.6 + priceFactor * 0.4);
}

function computeDemandIndex(signal: MarketSignal, priceTrend: number): number {
  const truckDemand = encodeSignal("truckQueue", (signal as any).truckQueue);
  const fxDemand = encodeSignal("fxPressure", (signal as any).fxPressure);
  return (truckDemand * 0.4 + fxDemand * 0.25 + priceTrend * 0.35);
}

function buildFeatureVector(input: ScoringInput): FeatureVector {
  const { signal, priceHistory, nnpcFeed, fxRates } = input;
  const priceTrend = computePriceTrend(priceHistory);

  return {
    fxVolatility: computeFxVolatility(fxRates ?? []),
    vesselCount: encodeSignal("vesselActivity", (signal as any).vesselActivity),
    refineryOutputIndex: computeRefineryOutputIndex(signal, nnpcFeed),
    depotSpread: clamp(input.depotSpread ?? 0.5, 0, 1),
    regulationImpact: encodeSignal("policyRisk", (signal as any).policyRisk),
    demandIndex: computeDemandIndex(signal, priceTrend),
    historicalVolatility: computeHistoricalVolatility(priceHistory),
    traderSentimentScore: clamp((input.traderSentiment ?? 0) + 0.5, 0, 1),
  };
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function computeLogit(features: FeatureVector, weights: FeatureWeights, bias: number): number {
  let z = bias;
  const keys = Object.keys(weights) as (keyof FeatureWeights)[];
  for (const key of keys) {
    z += features[key] * weights[key];
  }
  return z;
}

function computeAdaptiveWeights(features: FeatureVector, productType?: string): FeatureWeights {
  const baseWeights = PRODUCT_WEIGHTS[productType || "PMS"] || BASE_WEIGHTS;
  const weights = { ...baseWeights };

  if (features.historicalVolatility > 0.7) {
    weights.historicalVolatility *= 1.4;
    weights.demandIndex *= 1.2;
    weights.vesselCount *= 0.8;
  }

  if (features.fxVolatility > 0.65) {
    weights.fxVolatility *= 1.5;
    weights.regulationImpact *= 1.2;
  }

  if (features.vesselCount > 0.8 || features.vesselCount < 0.15) {
    weights.vesselCount *= 1.3;
    weights.refineryOutputIndex *= 1.15;
  }

  if (features.traderSentimentScore > 0.75 || features.traderSentimentScore < 0.25) {
    weights.traderSentimentScore *= 1.4;
  }

  if (features.depotSpread > 0.7) {
    weights.depotSpread *= 1.5;
  }

  const totalAbs = Object.values(weights).reduce((a, b) => a + Math.abs(b), 0);
  if (totalAbs > 0) {
    for (const key of Object.keys(weights) as (keyof FeatureWeights)[]) {
      weights[key] = weights[key] / totalAbs;
    }
  }

  return weights;
}

function computeRiskFactor(features: FeatureVector): number {
  return 1
    + (features.fxVolatility * 0.2)
    + (features.regulationImpact * 0.3)
    + ((1 - features.refineryOutputIndex) * 0.4);
}

function computeProbabilities(sigmoidP: number, features: FeatureVector): ProbabilityDistribution {
  const increaseLogit = sigmoidP * 4 - 2 + (features.demandIndex - 0.5) * 1.5;
  const decreaseLogit = (1 - sigmoidP) * 4 - 2 + (features.refineryOutputIndex - 0.5) * 1.0;
  const stableLogit = -Math.abs(sigmoidP - 0.5) * 3 + 0.5 - features.historicalVolatility * 1.2;

  const maxVal = Math.max(increaseLogit, decreaseLogit, stableLogit);
  const exps = [
    Math.exp(increaseLogit - maxVal),
    Math.exp(decreaseLogit - maxVal),
    Math.exp(stableLogit - maxVal),
  ];
  const sum = exps.reduce((a, b) => a + b, 0);
  const [increase, decrease, stable] = exps.map((e) => e / sum);

  return {
    increase: Math.round(increase * 1000) / 10,
    decrease: Math.round(decrease * 1000) / 10,
    stable: Math.round(stable * 1000) / 10,
  };
}

function computeConfidence(features: FeatureVector, probabilities: ProbabilityDistribution): number {
  const maxProb = Math.max(probabilities.increase, probabilities.decrease, probabilities.stable);
  const probCertainty = maxProb / 100;

  const featureValues = Object.values(features);
  let extremeCount = 0;
  for (const val of featureValues) {
    if (val >= 0.78 || val <= 0.22) extremeCount++;
  }
  const signalClarity = extremeCount / featureValues.length;

  const dataRichness = clamp(
    (features.fxVolatility !== 0.5 ? 0.25 : 0) +
    (features.historicalVolatility !== 0.5 ? 0.25 : 0) +
    (features.traderSentimentScore !== 0.5 ? 0.2 : 0) +
    0.3,
    0.3,
    1
  );

  const raw = probCertainty * 0.40 + signalClarity * 0.35 + dataRichness * 0.25;
  return Math.round(clamp(raw * 100, 35, 97));
}

function determineBias(probabilities: ProbabilityDistribution): "bullish" | "bearish" | "neutral" {
  if (probabilities.increase > probabilities.decrease && probabilities.increase > probabilities.stable) {
    return "bullish";
  }
  if (probabilities.decrease > probabilities.increase && probabilities.decrease > probabilities.stable) {
    return "bearish";
  }
  return "neutral";
}

function computeExpectedRange(
  priceHistory: PriceHistoryEntry[],
  riskFactor: number,
  sigmoidP: number,
  productType?: string
): { min: number; max: number } {
  const defaults = PRODUCT_DEFAULT_RANGES[productType || "PMS"] || PRODUCT_DEFAULT_RANGES.PMS;

  if (priceHistory.length === 0) {
    const vol = defaults.base * 0.02;
    return {
      min: Math.round(defaults.base - vol * riskFactor),
      max: Math.round(defaults.base + vol * riskFactor),
    };
  }

  const sorted = [...priceHistory].sort(
    (a, b) => new Date((b as any).date ?? b.recordedAt).getTime() - new Date((a as any).date ?? a.recordedAt).getTime()
  );
  const recent = sorted.slice(0, Math.min(7, sorted.length));
  const prices = recent.map((p) => p.price);
  const currentPrice = prices[0];
  const stdDev = computeHistoricalStdDev(priceHistory);
  const directionShift = (sigmoidP - 0.5) * stdDev * 0.6;

  return {
    min: Math.round(currentPrice + directionShift - stdDev * riskFactor),
    max: Math.round(currentPrice + directionShift + stdDev * riskFactor),
  };
}

function generateAction(
  bias: "bullish" | "bearish" | "neutral",
  probabilities: ProbabilityDistribution,
  features: FeatureVector,
  riskFactor: number,
  productType?: string
): string {
  const actions: string[] = [];
  const maxProb = Math.max(probabilities.increase, probabilities.decrease, probabilities.stable);
  const pt = productType || "PMS";

  const productLabels: Record<string, string> = {
    PMS: "PMS", AGO: "Diesel (AGO)", JET_A1: "Jet A-1", ATK: "ATK", LPG: "LPG",
  };
  const label = productLabels[pt] || "PMS";

  if (bias === "bullish") {
    if (maxProb > 60) {
      actions.push(`${probabilities.increase}% probability of ${label} price increase — secure supply now`);
    } else {
      actions.push(`${label} price increase likely — consider early procurement`);
    }
    if (riskFactor > 1.6) {
      actions.push(`High risk factor (${riskFactor.toFixed(2)}) — elevated market uncertainty`);
    }
    if (pt === "AGO" && features.fxVolatility > 0.65) {
      actions.push("FX-driven diesel cost increase — lock in AGO rates immediately");
    } else if ((pt === "JET_A1" || pt === "ATK") && features.fxVolatility > 0.65) {
      actions.push(`Crude-linked ${label} pricing under FX pressure — act now`);
    } else if (pt === "LPG" && features.vesselCount < 0.2) {
      actions.push("No LPG vessel arrivals — supply constraints imminent");
    } else {
      if (features.demandIndex > 0.7) actions.push("Load before 6am to beat demand congestion");
      if (features.refineryOutputIndex < 0.3) actions.push("Supply tightening — avoid spot buying after 9am");
      if (features.fxVolatility > 0.65) actions.push("FX pressure rising — lock in prices early");
    }
    if (features.vesselCount < 0.2) actions.push(`Low vessel activity — ${label} supply constraints expected`);
  } else if (bias === "bearish") {
    if (maxProb > 60) {
      actions.push(`${probabilities.decrease}% probability of ${label} price drop — delay purchases`);
    } else {
      actions.push(`${label} price drop likely — consider waiting for lower prices`);
    }
    if (features.vesselCount > 0.7) actions.push("Incoming vessels will increase supply");
    if (features.refineryOutputIndex > 0.7) actions.push("Refinery output strong — prices likely to ease");
    actions.push(`Monitor ${label} market for further drops before loading`);
  } else {
    actions.push(`${label} market stable — standard operations advised`);
    if (features.historicalVolatility > 0.6) actions.push(`Elevated ${label} volatility — consider hedging positions`);
    if (features.demandIndex > 0.7) actions.push("Load at off-peak hours to avoid delays");
    else actions.push("Hold current stock and monitor market closely");
  }

  return actions.slice(0, 3).join(". ") + ".";
}

export function computeForecastScore(input: ScoringInput): ForecastScore {
  const pt = input.productType || (input.signal as any).productType || "PMS";

  const features = buildFeatureVector(input);
  const adaptiveWeights = computeAdaptiveWeights(features, pt);
  const bias_b = PRODUCT_BIAS[pt] || 0;

  const logit = computeLogit(features, adaptiveWeights, bias_b);
  const sigmoidP = sigmoid(logit);

  const riskFactor = computeRiskFactor(features);
  const probabilities = computeProbabilities(sigmoidP, features);
  const bias = determineBias(probabilities);
  const confidence = computeConfidence(features, probabilities);
  const expectedRange = computeExpectedRange(input.priceHistory, riskFactor, sigmoidP, pt);
  const suggestedAction = generateAction(bias, probabilities, features, riskFactor, pt);

  const trendScore = computePriceTrend(input.priceHistory);
  const volatilityScore = features.historicalVolatility;
  const compositeScore = logit;

  return {
    bias,
    probability: probabilities,
    expectedRange,
    confidence,
    suggestedAction,
    riskFactor: Math.round(riskFactor * 100) / 100,
    scoring: {
      featureVector: features,
      weights: adaptiveWeights,
      logit,
      sigmoidP: Math.round(sigmoidP * 1000) / 1000,
      riskFactor: Math.round(riskFactor * 100) / 100,
      trendScore,
      volatilityScore,
      compositeScore,
    },
  };
}
