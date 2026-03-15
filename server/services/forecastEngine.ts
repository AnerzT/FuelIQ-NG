import type { MarketSignal, PriceHistoryEntry, ProductType } from "../../shared/schema.js";

export interface ForecastResult {
  expectedMin: number;
  expectedMax: number;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  suggestedAction: string;
  depotPrice: number | null;
  refineryInfluenceScore: number | null;
  importParityPrice: number | null;
  demandIndex: number | null;
}

interface SignalLevels {
  vesselActivity: string;
  truckQueue: string;
  nnpcSupply: string;
  fxPressure: string;
  policyRisk: string;
}

interface ProductProfile {
  baseMin: number;
  baseMax: number;
  spread: number;
  weights: Record<string, Record<string, number>>;
  depotPrice: number;
  importParityPrice: number;
  demandIndex: number;
  refineryInfluenceScore: number;
}

const PRODUCT_PROFILES: Record<string, ProductProfile> = {
  PMS: {
    baseMin: 610,
    baseMax: 625,
    spread: 15,
    weights: {
      vesselActivity: { None: 2, Low: 1, Moderate: 0, High: -2 },
      truckQueue:     { Low: -1, Medium: 0, High: 2 },
      nnpcSupply:     { Strong: -2, Moderate: 0, Weak: 2 },
      fxPressure:     { Low: -1, Medium: 1, High: 2 },
      policyRisk:     { Low: 0, Medium: 1, High: 2 },
    },
    depotPrice: 590,
    importParityPrice: 620,
    demandIndex: 0.85,
    refineryInfluenceScore: 0.7,
  },
  AGO: {
    baseMin: 950,
    baseMax: 980,
    spread: 30,
    weights: {
      vesselActivity: { None: 1, Low: 0.5, Moderate: 0, High: -1 },
      truckQueue:     { Low: -0.5, Medium: 0, High: 1.5 },
      nnpcSupply:     { Strong: -1, Moderate: 0, Weak: 1.5 },
      fxPressure:     { Low: -1.5, Medium: 1.5, High: 3 },
      policyRisk:     { Low: 0, Medium: 0.5, High: 1 },
    },
    depotPrice: 920,
    importParityPrice: 960,
    demandIndex: 0.78,
    refineryInfluenceScore: 0.5,
  },
  JET_A1: {
    baseMin: 1050,
    baseMax: 1100,
    spread: 50,
    weights: {
      vesselActivity: { None: 1.5, Low: 0.8, Moderate: 0, High: -1.5 },
      truckQueue:     { Low: -0.5, Medium: 0, High: 1 },
      nnpcSupply:     { Strong: -1.5, Moderate: 0, Weak: 1 },
      fxPressure:     { Low: -1, Medium: 1, High: 2.5 },
      policyRisk:     { Low: 0, Medium: 0.5, High: 1.5 },
    },
    depotPrice: 1020,
    importParityPrice: 1080,
    demandIndex: 0.65,
    refineryInfluenceScore: 0.4,
  },
  ATK: {
    baseMin: 1000,
    baseMax: 1060,
    spread: 60,
    weights: {
      vesselActivity: { None: 1.5, Low: 0.8, Moderate: 0, High: -1.5 },
      truckQueue:     { Low: -0.3, Medium: 0, High: 0.8 },
      nnpcSupply:     { Strong: -1, Moderate: 0, Weak: 1 },
      fxPressure:     { Low: -1, Medium: 1, High: 2 },
      policyRisk:     { Low: 0, Medium: 0.5, High: 1.5 },
    },
    depotPrice: 980,
    importParityPrice: 1040,
    demandIndex: 0.60,
    refineryInfluenceScore: 0.35,
  },
  LPG: {
    baseMin: 800,
    baseMax: 850,
    spread: 50,
    weights: {
      vesselActivity: { None: 2.5, Low: 1.5, Moderate: 0, High: -2 },
      truckQueue:     { Low: -0.5, Medium: 0, High: 1 },
      nnpcSupply:     { Strong: -1.5, Moderate: 0, Weak: 2 },
      fxPressure:     { Low: -0.5, Medium: 0.5, High: 1.5 },
      policyRisk:     { Low: 0, Medium: 0.5, High: 1 },
    },
    depotPrice: 780,
    importParityPrice: 830,
    demandIndex: 0.72,
    refineryInfluenceScore: 0.3,
  },
};

function getProductProfile(productType?: string): ProductProfile {
  const key = (productType || "PMS");
  return PRODUCT_PROFILES[key] || PRODUCT_PROFILES.PMS;
}

function normalizeLevel(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim();
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function computeBullishScore(signals: SignalLevels, productType?: string): number {
  const profile = getProductProfile(productType);
  let score = 0;
  for (const [key, weights] of Object.entries(profile.weights)) {
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

function computeConfidence(signals: SignalLevels, score: number, productType?: string): number {
  const profile = getProductProfile(productType);
  const absScore = Math.abs(score);
  const maxPossible = 10;
  const signalAlignment = Math.min(absScore / maxPossible, 1);

  let alignedCount = 0;
  const entries = Object.entries(profile.weights);
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

function getBasePrice(recentHistory: PriceHistoryEntry[], productType?: string): { baseMin: number; baseMax: number } {
  const profile = getProductProfile(productType);
  if (!recentHistory.length) {
    return { baseMin: profile.baseMin, baseMax: profile.baseMax };
  }

  const sorted = [...recentHistory].sort(
    (a, b) => new Date((b as any).date ?? b.recordedAt).getTime() - new Date((a as any).date ?? a.recordedAt).getTime()
  );

  const recent = sorted.slice(0, Math.min(7, sorted.length));
  const prices = recent.map((p) => p.price);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  const spread = Math.max(max - min, profile.spread);
  return {
    baseMin: Math.round(avg - spread / 2),
    baseMax: Math.round(avg + spread / 2),
  };
}

function generateAction(bias: "bullish" | "bearish" | "neutral", signals: SignalLevels, productType?: string): string {
  const actions: string[] = [];
  const pt = (productType || "PMS");

  const productLabels: Record<string, string> = {
    PMS: "PMS",
    AGO: "Diesel (AGO)",
    JET_A1: "Jet A-1",
    ATK: "ATK",
    LPG: "LPG",
  };
  const label = productLabels[pt] || "PMS";

  if (bias === "bullish") {
    const truckHigh = normalizeLevel(signals.truckQueue) === "High";
    const supplyWeak = normalizeLevel(signals.nnpcSupply) === "Weak";

    if (pt === "PMS") {
      if (truckHigh) actions.push("Load before 6am to beat truck congestion");
      else actions.push("Early morning loading recommended");
      if (supplyWeak) actions.push("Avoid spot buying after 9am — Dangote/import parity shifting upward");
      if (normalizeLevel(signals.fxPressure) === "High") actions.push("FX pressure rising — lock in PMS prices early");
      if (normalizeLevel(signals.policyRisk) === "High") actions.push("Policy risk elevated — hedge against subsidy changes");
    } else if (pt === "AGO") {
      actions.push("Industrial diesel demand rising — secure AGO supply now");
      if (normalizeLevel(signals.fxPressure) === "High") actions.push("FX-driven cost increase expected — lock in diesel rates");
      if (supplyWeak) actions.push("Power sector demand straining supply — pre-purchase recommended");
    } else if (pt === "JET_A1" || pt === "ATK") {
      actions.push(`Airline demand increasing — secure ${label} supply early`);
      if (normalizeLevel(signals.fxPressure) === "High") actions.push("Crude-linked pricing under FX pressure — act now");
      actions.push("Airport traffic indicators suggest tightening supply");
    } else if (pt === "LPG") {
      actions.push("Household LPG demand surging — stock up before price spike");
      if (normalizeLevel(signals.vesselActivity) === "None") actions.push("No vessel arrivals — supply constraints imminent");
      actions.push("Seasonal demand pattern favors early procurement");
    }
    if (!actions.some((a) => a.includes("spot") || a.includes("lock") || a.includes("secure"))) {
      actions.push(`Consider pre-purchasing ${label} at current rates`);
    }
  } else if (bias === "bearish") {
    if (pt === "PMS") {
      actions.push("Good supply levels — delay PMS purchases for lower prices");
      if (normalizeLevel(signals.vesselActivity) === "High") actions.push("Vessel arrivals expected to increase stock");
      if (normalizeLevel(signals.nnpcSupply) === "Strong") actions.push("NNPC supply strong — prices likely to ease");
    } else if (pt === "AGO") {
      actions.push("Diesel supply improving — hold off on bulk purchases");
      if (normalizeLevel(signals.fxPressure) === "Low") actions.push("FX easing supports lower AGO import costs");
    } else if (pt === "JET_A1" || pt === "ATK") {
      actions.push(`${label} supply stabilizing — delay purchases for better rates`);
      actions.push("Crude price softening — expect downstream relief");
    } else if (pt === "LPG") {
      actions.push("LPG vessel arrivals incoming — prices expected to drop");
      actions.push("Off-season demand allows for delayed procurement");
    }
    actions.push(`Monitor ${label} market for further price drops before loading`);
  } else {
    if (pt === "PMS") {
      actions.push("Steady PMS pricing expected — standard loading advised");
    } else if (pt === "AGO") {
      actions.push("Diesel market stable — maintain current procurement schedule");
    } else if (pt === "JET_A1" || pt === "ATK") {
      actions.push(`${label} prices holding steady — no urgent action needed`);
    } else if (pt === "LPG") {
      actions.push("LPG market balanced — standard restocking advised");
    }
    if (normalizeLevel(signals.truckQueue) === "High") actions.push("Load at off-peak hours to avoid delays");
    else actions.push("Hold current stock and monitor market closely");
    actions.push("No urgent action required");
  }

  return actions.slice(0, 3).join(". ") + ".";
}

export function computeForecast(
  signal: MarketSignal,
  recentHistory: PriceHistoryEntry[],
  productType?: string
): ForecastResult {
  const pt = productType || (signal as any).productType || "PMS";
  const profile = getProductProfile(pt);

  const signals: SignalLevels = {
    vesselActivity: (signal as any).vesselActivity || "",
    truckQueue: (signal as any).truckQueue || "",
    nnpcSupply: (signal as any).nnpcSupply || "",
    fxPressure: (signal as any).fxPressure || "",
    policyRisk: (signal as any).policyRisk || "",
  };

  const bullishScore = computeBullishScore(signals, pt);
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

  const confidence = computeConfidence(signals, effectiveScore, pt);
  const { baseMin, baseMax } = getBasePrice(recentHistory, pt);

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

  const suggestedAction = generateAction(bias, signals, pt);
  const demandIndex = profile.demandIndex + (bias === "bullish" ? 0.05 : bias === "bearish" ? -0.05 : 0);

  return {
    expectedMin,
    expectedMax,
    bias,
    confidence,
    suggestedAction,
    depotPrice: profile.depotPrice,
    refineryInfluenceScore: profile.refineryInfluenceScore,
    importParityPrice: profile.importParityPrice,
    demandIndex: Math.round(demandIndex * 100) / 100,
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
