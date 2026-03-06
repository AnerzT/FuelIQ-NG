import type { MarketSignal, PriceHistoryEntry, ExternalPriceFeed, FxRate, ProductType } from "@shared/schema";

export interface ScoringInput {
  signal: MarketSignal;
  priceHistory: PriceHistoryEntry[];
  nnpcFeed?: ExternalPriceFeed | null;
  fxRates?: FxRate[];
  productType?: string;
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
  scoring: {
    normalizedInputs: NormalizedInputs;
    signalWeights: SignalWeights;
    trendScore: number;
    volatilityScore: number;
    compositeScore: number;
  };
}

interface NormalizedInputs {
  vesselActivity: number;
  truckQueue: number;
  nnpcSupply: number;
  fxPressure: number;
  policyRisk: number;
  priceTrend: number;
  priceVolatility: number;
  fxVolatility: number;
  nnpcPriceChange: number;
}

interface SignalWeights {
  vesselActivity: number;
  truckQueue: number;
  nnpcSupply: number;
  fxPressure: number;
  policyRisk: number;
  priceTrend: number;
  priceVolatility: number;
  fxVolatility: number;
  nnpcPriceChange: number;
}

const SIGNAL_ENCODING: Record<string, Record<string, number>> = {
  vesselActivity: { None: 1.0, Low: 0.66, Moderate: 0.33, High: 0.0 },
  truckQueue:     { Low: 0.0, Medium: 0.5, High: 1.0 },
  nnpcSupply:     { Strong: 0.0, Moderate: 0.5, Weak: 1.0 },
  fxPressure:     { Low: 0.0, Medium: 0.5, High: 1.0 },
  policyRisk:     { Low: 0.0, Medium: 0.5, High: 1.0 },
};

const BASE_WEIGHTS: SignalWeights = {
  vesselActivity: -0.20,
  truckQueue:      0.18,
  nnpcSupply:      0.15,
  fxPressure:      0.14,
  policyRisk:      0.10,
  priceTrend:      0.10,
  priceVolatility: 0.05,
  fxVolatility:    0.05,
  nnpcPriceChange: 0.03,
};

const PRODUCT_WEIGHTS: Record<string, SignalWeights> = {
  PMS: { ...BASE_WEIGHTS },
  AGO: {
    vesselActivity: -0.12,
    truckQueue:      0.10,
    nnpcSupply:      0.10,
    fxPressure:      0.25,
    policyRisk:      0.08,
    priceTrend:      0.12,
    priceVolatility: 0.08,
    fxVolatility:    0.10,
    nnpcPriceChange: 0.05,
  },
  JET_A1: {
    vesselActivity: -0.15,
    truckQueue:      0.08,
    nnpcSupply:      0.10,
    fxPressure:      0.20,
    policyRisk:      0.12,
    priceTrend:      0.15,
    priceVolatility: 0.06,
    fxVolatility:    0.08,
    nnpcPriceChange: 0.06,
  },
  ATK: {
    vesselActivity: -0.15,
    truckQueue:      0.06,
    nnpcSupply:      0.10,
    fxPressure:      0.18,
    policyRisk:      0.12,
    priceTrend:      0.15,
    priceVolatility: 0.08,
    fxVolatility:    0.08,
    nnpcPriceChange: 0.08,
  },
  LPG: {
    vesselActivity: -0.25,
    truckQueue:      0.08,
    nnpcSupply:      0.15,
    fxPressure:      0.10,
    policyRisk:      0.08,
    priceTrend:      0.12,
    priceVolatility: 0.08,
    fxVolatility:    0.06,
    nnpcPriceChange: 0.08,
  },
};

function getProductWeights(productType?: string): SignalWeights {
  return PRODUCT_WEIGHTS[productType || "PMS"] || BASE_WEIGHTS;
}

function normalizeLevel(value: string): string {
  const v = value.trim();
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function encodeSignal(key: string, value: string): number {
  const level = normalizeLevel(value);
  return SIGNAL_ENCODING[key]?.[level] ?? 0.5;
}

function computePriceTrend(history: PriceHistoryEntry[]): number {
  if (history.length < 2) return 0.5;

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
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

function computePriceVolatility(history: PriceHistoryEntry[]): number {
  if (history.length < 3) return 0.5;

  const prices = history.map((p) => p.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (mean === 0) return 0.5;

  const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length;
  const cv = Math.sqrt(variance) / mean;

  return clamp(cv * 10, 0, 1);
}

function computeFxVolatility(fxRates: FxRate[]): number {
  if (!fxRates || fxRates.length < 2) return 0.5;

  const rates = fxRates.map((r) => r.rate);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  if (mean === 0) return 0.5;

  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
  const cv = Math.sqrt(variance) / mean;

  return clamp(cv * 20, 0, 1);
}

function computeNnpcPriceChange(nnpcFeed: ExternalPriceFeed | null | undefined, history: PriceHistoryEntry[]): number {
  if (!nnpcFeed || history.length === 0) return 0.5;

  const avgHistorical = history.slice(0, 7).reduce((a, b) => a + b.price, 0) / Math.min(history.length, 7);
  if (avgHistorical === 0) return 0.5;

  const changePercent = ((nnpcFeed.price - avgHistorical) / avgHistorical) * 100;
  return clamp(0.5 + changePercent * 0.1, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeInputs(input: ScoringInput): NormalizedInputs {
  const { signal, priceHistory, nnpcFeed, fxRates } = input;

  return {
    vesselActivity: encodeSignal("vesselActivity", signal.vesselActivity),
    truckQueue: encodeSignal("truckQueue", signal.truckQueue),
    nnpcSupply: encodeSignal("nnpcSupply", signal.nnpcSupply),
    fxPressure: encodeSignal("fxPressure", signal.fxPressure),
    policyRisk: encodeSignal("policyRisk", signal.policyRisk),
    priceTrend: computePriceTrend(priceHistory),
    priceVolatility: computePriceVolatility(priceHistory),
    fxVolatility: computeFxVolatility(fxRates ?? []),
    nnpcPriceChange: computeNnpcPriceChange(nnpcFeed, priceHistory),
  };
}

function computeCompositeScore(inputs: NormalizedInputs, weights: SignalWeights): number {
  let score = 0;
  const NON_DIRECTIONAL: Set<string> = new Set(["priceVolatility", "fxVolatility"]);

  for (const key of Object.keys(weights) as (keyof SignalWeights)[]) {
    if (NON_DIRECTIONAL.has(key)) continue;
    const centered = inputs[key] - 0.5;
    score += centered * weights[key];
  }
  return score;
}

function computeAdaptiveWeights(inputs: NormalizedInputs, productType?: string): SignalWeights {
  const weights = { ...getProductWeights(productType) };

  if (inputs.priceVolatility > 0.7) {
    weights.priceTrend *= 1.4;
    weights.priceVolatility *= 1.3;
    weights.vesselActivity *= 0.8;
  }

  if (inputs.fxVolatility > 0.6) {
    weights.fxPressure *= 1.5;
    weights.fxVolatility *= 1.3;
    weights.policyRisk *= 1.2;
  }

  if (inputs.vesselActivity > 0.8 || inputs.vesselActivity < 0.2) {
    weights.vesselActivity *= 1.3;
    weights.nnpcSupply *= 1.1;
  }

  if (inputs.nnpcPriceChange > 0.7 || inputs.nnpcPriceChange < 0.3) {
    weights.nnpcPriceChange *= 2.0;
    weights.nnpcSupply *= 0.9;
  }

  const totalAbs = Object.values(weights).reduce((a, b) => a + Math.abs(b), 0);
  if (totalAbs > 0) {
    for (const key of Object.keys(weights) as (keyof SignalWeights)[]) {
      weights[key] = weights[key] / totalAbs;
    }
  }

  return weights;
}

function softmax(values: number[]): number[] {
  const maxVal = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - maxVal));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function computeProbabilities(compositeScore: number, inputs: NormalizedInputs): ProbabilityDistribution {
  const bullishSignal = compositeScore;
  const trendMomentum = (inputs.priceTrend - 0.5) * 2;
  const supplyContrast = inputs.nnpcSupply - (1 - inputs.vesselActivity);

  const increaseLogit = bullishSignal * 3.5 + trendMomentum * 1.5 + supplyContrast * 0.8;
  const decreaseLogit = -bullishSignal * 3.5 - trendMomentum * 1.5 - supplyContrast * 0.8;
  const stableLogit = -Math.abs(bullishSignal) * 1.5 - Math.abs(trendMomentum) * 0.5 + 0.3;

  const [increase, decrease, stable] = softmax([increaseLogit, decreaseLogit, stableLogit]);

  return {
    increase: Math.round(increase * 1000) / 10,
    decrease: Math.round(decrease * 1000) / 10,
    stable: Math.round(stable * 1000) / 10,
  };
}

function computeConfidence(inputs: NormalizedInputs, probabilities: ProbabilityDistribution): number {
  const maxProb = Math.max(probabilities.increase, probabilities.decrease, probabilities.stable);
  const probCertainty = maxProb / 100;

  const signalValues = [
    inputs.vesselActivity,
    inputs.truckQueue,
    inputs.nnpcSupply,
    inputs.fxPressure,
    inputs.policyRisk,
  ];

  let extremeCount = 0;
  for (const val of signalValues) {
    if (val >= 0.8 || val <= 0.2) extremeCount++;
  }
  const signalClarity = extremeCount / signalValues.length;

  const dataRichness = clamp(
    (inputs.priceTrend !== 0.5 ? 0.3 : 0) +
    (inputs.fxVolatility !== 0.5 ? 0.2 : 0) +
    (inputs.nnpcPriceChange !== 0.5 ? 0.2 : 0) +
    0.3,
    0.3,
    1
  );

  const raw = probCertainty * 0.45 + signalClarity * 0.30 + dataRichness * 0.25;
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

const PRODUCT_DEFAULT_RANGES: Record<string, { min: number; max: number }> = {
  PMS:    { min: 610, max: 625 },
  AGO:    { min: 950, max: 980 },
  JET_A1: { min: 1050, max: 1100 },
  ATK:    { min: 1000, max: 1060 },
  LPG:    { min: 800, max: 850 },
};

function computeExpectedRange(
  priceHistory: PriceHistoryEntry[],
  bias: "bullish" | "bearish" | "neutral",
  compositeScore: number,
  inputs: NormalizedInputs,
  productType?: string
): { min: number; max: number } {
  const defaults = PRODUCT_DEFAULT_RANGES[productType || "PMS"] || PRODUCT_DEFAULT_RANGES.PMS;

  if (priceHistory.length === 0) {
    return { min: defaults.min, max: defaults.max };
  }

  const sorted = [...priceHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const recent = sorted.slice(0, Math.min(7, sorted.length));
  const prices = recent.map((p) => p.price);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const baseSpread = Math.max(maxPrice - minPrice, 15);
  const combinedVolatility = Math.max(inputs.priceVolatility, inputs.fxVolatility * 0.5);
  const volatilityMultiplier = 1 + combinedVolatility * 0.8;
  const spread = Math.round(baseSpread * volatilityMultiplier);

  let center = avg;
  const scoreShift = Math.abs(compositeScore) * 40;

  if (bias === "bullish") {
    center += 5 + scoreShift;
  } else if (bias === "bearish") {
    center -= 5 + scoreShift;
  }

  return {
    min: Math.round(center - spread / 2),
    max: Math.round(center + spread / 2),
  };
}

function generateAction(
  bias: "bullish" | "bearish" | "neutral",
  probabilities: ProbabilityDistribution,
  inputs: NormalizedInputs,
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
      actions.push(`${probabilities.increase}% chance of ${label} price increase — secure supply now`);
    } else {
      actions.push(`${label} price increase likely — consider early procurement`);
    }

    if (pt === "AGO" && inputs.fxPressure > 0.7) {
      actions.push("FX-driven diesel cost increase — lock in AGO rates immediately");
    } else if ((pt === "JET_A1" || pt === "ATK") && inputs.fxPressure > 0.7) {
      actions.push(`Crude-linked ${label} pricing under FX pressure — act now`);
    } else if (pt === "LPG" && inputs.vesselActivity < 0.3) {
      actions.push("No LPG vessel arrivals — supply constraints imminent");
    } else {
      if (inputs.truckQueue > 0.7) actions.push("Load before 6am to beat truck congestion");
      if (inputs.nnpcSupply > 0.7) actions.push("Supply tightening — avoid spot buying after 9am");
      if (inputs.fxPressure > 0.7) actions.push("FX pressure rising — lock in prices early");
    }
    if (inputs.vesselActivity < 0.3) actions.push(`Low vessel activity — ${label} supply constraints expected`);
  } else if (bias === "bearish") {
    if (maxProb > 60) {
      actions.push(`${probabilities.decrease}% chance of ${label} price drop — delay purchases`);
    } else {
      actions.push(`${label} price drop likely — consider waiting for lower prices`);
    }

    if (inputs.vesselActivity > 0.7) actions.push("Incoming vessels will increase supply");
    if (inputs.nnpcSupply < 0.3) actions.push("Supply strong — prices likely to ease");
    actions.push(`Monitor ${label} market for further drops before loading`);
  } else {
    actions.push(`${label} market stable — standard operations advised`);
    if (inputs.priceVolatility > 0.6) actions.push(`Elevated ${label} volatility — consider hedging positions`);
    if (inputs.truckQueue > 0.7) actions.push("Load at off-peak hours to avoid delays");
    else actions.push("Hold current stock and monitor market closely");
  }

  return actions.slice(0, 3).join(". ") + ".";
}

export function computeForecastScore(input: ScoringInput): ForecastScore {
  const pt = input.productType || input.signal.productType || "PMS";
  const normalizedInputs = normalizeInputs(input);
  const adaptiveWeights = computeAdaptiveWeights(normalizedInputs, pt);
  const compositeScore = computeCompositeScore(normalizedInputs, adaptiveWeights);

  const trendScore = normalizedInputs.priceTrend;
  const volatilityScore = normalizedInputs.priceVolatility;

  const probabilities = computeProbabilities(compositeScore, normalizedInputs);
  const bias = determineBias(probabilities);
  const confidence = computeConfidence(normalizedInputs, probabilities);
  const expectedRange = computeExpectedRange(
    input.priceHistory,
    bias,
    compositeScore,
    normalizedInputs,
    pt
  );
  const suggestedAction = generateAction(bias, probabilities, normalizedInputs, pt);

  return {
    bias,
    probability: probabilities,
    expectedRange,
    confidence,
    suggestedAction,
    scoring: {
      normalizedInputs,
      signalWeights: adaptiveWeights,
      trendScore,
      volatilityScore,
      compositeScore,
    },
  };
}
