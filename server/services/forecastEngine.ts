import type { MarketSignal, PriceHistoryEntry } from "@shared/schema";

export interface ForecastResult {
  expectedMin: number;
  expectedMax: number;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  suggestedAction: string;
}

interface SignalLevels {
  vesselActivity: string;
  truckQueue: string;
  nnpcSupply: string;
  fxPressure: string;
  policyRisk: string;
}

const BULLISH_WEIGHT: Record<string, Record<string, number>> = {
  vesselActivity: { None: 2, Low: 1, Moderate: 0, High: -2 },
  truckQueue:     { Low: -1, Medium: 0, High: 2 },
  nnpcSupply:     { Strong: -2, Moderate: 0, Weak: 2 },
  fxPressure:     { Low: -1, Medium: 1, High: 2 },
  policyRisk:     { Low: 0, Medium: 1, High: 2 },
};

const DEFAULT_BASE_MIN = 610;
const DEFAULT_BASE_MAX = 625;
const DEFAULT_SPREAD = 15;

function normalizeLevel(value: string): string {
  const v = value.trim();
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function computeBullishScore(signals: SignalLevels): number {
  let score = 0;
  for (const [key, weights] of Object.entries(BULLISH_WEIGHT)) {
    const raw = (signals as any)[key] as string;
    if (!raw) continue;
    const level = normalizeLevel(raw);
    score += weights[level] ?? 0;
  }
  return score;
}

function determineBias(score: number): "bullish" | "bearish" | "neutral" {
  if (score >= 3) return "bullish";
  if (score <= -2) return "bearish";
  return "neutral";
}

function computeConfidence(signals: SignalLevels, score: number): number {
  const absScore = Math.abs(score);
  const maxPossible = 10;
  const signalAlignment = Math.min(absScore / maxPossible, 1);

  let alignedCount = 0;
  const entries = Object.entries(BULLISH_WEIGHT);
  for (const [key, weights] of entries) {
    const raw = (signals as any)[key] as string;
    if (!raw) continue;
    const level = normalizeLevel(raw);
    const w = weights[level] ?? 0;
    if ((score > 0 && w > 0) || (score < 0 && w < 0) || (score === 0 && w === 0)) {
      alignedCount++;
    }
  }
  const alignmentRatio = alignedCount / entries.length;

  const base = 45;
  const fromAlignment = alignmentRatio * 30;
  const fromStrength = signalAlignment * 25;

  return Math.round(Math.min(Math.max(base + fromAlignment + fromStrength, 40), 95));
}

function getBasePrice(recentHistory: PriceHistoryEntry[]): { baseMin: number; baseMax: number } {
  if (!recentHistory.length) {
    return { baseMin: DEFAULT_BASE_MIN, baseMax: DEFAULT_BASE_MAX };
  }

  const sorted = [...recentHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const recent = sorted.slice(0, Math.min(7, sorted.length));
  const prices = recent.map((p) => p.price);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  const spread = Math.max(max - min, DEFAULT_SPREAD);
  return {
    baseMin: Math.round(avg - spread / 2),
    baseMax: Math.round(avg + spread / 2),
  };
}

function generateAction(bias: "bullish" | "bearish" | "neutral", signals: SignalLevels): string {
  const actions: string[] = [];

  if (bias === "bullish") {
    const truckHigh = normalizeLevel(signals.truckQueue) === "High";
    const supplyWeak = normalizeLevel(signals.nnpcSupply) === "Weak";

    if (truckHigh) actions.push("Load before 6am to beat truck congestion");
    else actions.push("Early morning loading recommended");

    if (supplyWeak) actions.push("Avoid spot buying after 9am");
    if (normalizeLevel(signals.fxPressure) === "High") actions.push("FX pressure rising — lock in prices early");
    if (!actions.some((a) => a.includes("spot"))) actions.push("Consider pre-purchasing at current rates");
  } else if (bias === "bearish") {
    actions.push("Good supply levels — delay purchases for lower prices");
    if (normalizeLevel(signals.vesselActivity) === "High") actions.push("Vessel arrivals expected to increase stock");
    if (normalizeLevel(signals.nnpcSupply) === "Strong") actions.push("NNPC supply strong — prices likely to ease");
    actions.push("Monitor for further price drops before loading");
  } else {
    actions.push("Steady pricing expected — standard loading advised");
    if (normalizeLevel(signals.truckQueue) === "High") actions.push("Load at off-peak hours to avoid delays");
    else actions.push("Hold current stock and monitor market closely");
    actions.push("No urgent action required");
  }

  return actions.slice(0, 3).join(". ") + ".";
}

export function computeForecast(
  signal: MarketSignal,
  recentHistory: PriceHistoryEntry[]
): ForecastResult {
  const signals: SignalLevels = {
    vesselActivity: signal.vesselActivity,
    truckQueue: signal.truckQueue,
    nnpcSupply: signal.nnpcSupply,
    fxPressure: signal.fxPressure,
    policyRisk: signal.policyRisk,
  };

  const bullishScore = computeBullishScore(signals);
  const isBullishPattern = matchesBullishPattern(signals);
  const isBearishPattern = matchesBearishPattern(signals);

  let bias: "bullish" | "bearish" | "neutral";
  if (isBullishPattern) {
    bias = "bullish";
  } else if (isBearishPattern) {
    bias = "bearish";
  } else {
    bias = determineBias(bullishScore);
  }

  const effectiveScore = isBullishPattern
    ? Math.max(bullishScore, 5)
    : isBearishPattern
      ? Math.min(bullishScore, -4)
      : bullishScore;

  const confidence = computeConfidence(signals, effectiveScore);
  const { baseMin, baseMax } = getBasePrice(recentHistory);

  let expectedMin = baseMin;
  let expectedMax = baseMax;

  if (bias === "bullish") {
    const shift = 10 + Math.round((Math.abs(effectiveScore) / 10) * 10);
    expectedMin += shift;
    expectedMax += shift;
  } else if (bias === "bearish") {
    const shift = 10 + Math.round((Math.abs(effectiveScore) / 10) * 10);
    expectedMin -= shift;
    expectedMax -= shift;
  }

  const suggestedAction = generateAction(bias, signals);

  return {
    expectedMin,
    expectedMax,
    bias,
    confidence,
    suggestedAction,
  };
}

export function matchesBullishPattern(signals: SignalLevels): boolean {
  return (
    normalizeLevel(signals.truckQueue) === "High" &&
    normalizeLevel(signals.vesselActivity) === "None" &&
    normalizeLevel(signals.nnpcSupply) === "Weak"
  );
}

export function matchesBearishPattern(signals: SignalLevels): boolean {
  return (
    normalizeLevel(signals.vesselActivity) === "High" &&
    normalizeLevel(signals.nnpcSupply) === "Strong"
  );
}
