export interface InventoryRiskResult {
  riskExposure: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  unrealizedPnL: number;
  dropProbability: number;
  reasoning: string;
}

export interface StaggeredBuyResult {
  splits: { percentage: number; label: string; timing: string }[];
  volatilityIndex: number;
  liquidityScore: number;
  reasoning: string;
}

export interface ArbitrageResult {
  hasOpportunity: boolean;
  spread: number;
  transportCost: number;
  netProfit: number;
  profitMarginPercent: number;
  lowestDepot: { name: string; price: number };
  highestDepot: { name: string; price: number };
  reasoning: string;
}

export interface AdvancedHedgeOutput {
  inventoryRisk: InventoryRiskResult;
  staggeredBuy: StaggeredBuyResult;
  arbitrage: ArbitrageResult | null;
  overallStrategy: string;
  overallRiskLevel: "low" | "medium" | "high";
}

export function computeInventoryRisk(params: {
  inventoryVolume: number;
  averageCost: number;
  forecastDropProbability: number;
  expectedPrice: number;
  productType: string;
}): InventoryRiskResult {
  const { inventoryVolume, averageCost, forecastDropProbability, expectedPrice, productType } = params;

  const priceDelta = averageCost - expectedPrice;
  const riskExposure = inventoryVolume * (forecastDropProbability / 100) * Math.max(priceDelta, 0);
  const unrealizedPnL = inventoryVolume * (expectedPrice - averageCost);

  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  if (riskExposure > 500000) riskLevel = "critical";
  else if (riskExposure > 200000) riskLevel = "high";
  else if (riskExposure > 50000) riskLevel = "medium";

  let reasoning = "";
  if (riskLevel === "critical") {
    reasoning = `Critical exposure of ₦${Math.round(riskExposure).toLocaleString()} on ${productType}. With ${forecastDropProbability.toFixed(1)}% drop probability and ${inventoryVolume.toLocaleString()}L in stock at ₦${averageCost.toFixed(0)}/L avg cost, immediate hedging action recommended.`;
  } else if (riskLevel === "high") {
    reasoning = `High risk exposure of ₦${Math.round(riskExposure).toLocaleString()} on ${productType}. Consider reducing position or implementing staggered selling strategy.`;
  } else if (riskLevel === "medium") {
    reasoning = `Moderate exposure of ₦${Math.round(riskExposure).toLocaleString()} on ${productType}. Monitor market signals closely and prepare contingency plans.`;
  } else {
    reasoning = `Low risk on ${productType} inventory. Current position is well-protected against expected price movements.`;
  }

  return {
    riskExposure: Math.round(riskExposure),
    riskLevel,
    unrealizedPnL: Math.round(unrealizedPnL),
    dropProbability: forecastDropProbability,
    reasoning,
  };
}

export function computeStaggeredBuy(params: {
  historicalVolatility: number;
  demandIndex: number;
  fxVolatility: number;
  currentPrice: number;
  productType: string;
}): StaggeredBuyResult {
  const { historicalVolatility, demandIndex, fxVolatility, currentPrice, productType } = params;

  const volatilityIndex = (historicalVolatility * 0.5 + fxVolatility * 0.3 + (1 - demandIndex) * 0.2);
  const liquidityScore = demandIndex * 0.6 + (1 - historicalVolatility) * 0.4;

  const splitRatio = liquidityScore > 0 ? volatilityIndex / liquidityScore : 1;

  let splits: { percentage: number; label: string; timing: string }[];

  if (splitRatio > 1.5) {
    splits = [
      { percentage: 25, label: "Immediate Buy", timing: "Today" },
      { percentage: 25, label: "Second Tranche", timing: "2-3 days" },
      { percentage: 25, label: "Third Tranche", timing: "5-7 days" },
      { percentage: 25, label: "Final Tranche", timing: "10-14 days" },
    ];
  } else if (splitRatio > 0.8) {
    splits = [
      { percentage: 40, label: "Immediate Buy", timing: "Today" },
      { percentage: 30, label: "Second Tranche", timing: "3-5 days" },
      { percentage: 30, label: "Final Tranche", timing: "7-10 days" },
    ];
  } else {
    splits = [
      { percentage: 60, label: "Immediate Buy", timing: "Today" },
      { percentage: 25, label: "Second Tranche", timing: "3-5 days" },
      { percentage: 15, label: "Reserve", timing: "7-10 days" },
    ];
  }

  const reasoning = `Based on ${productType} volatility index of ${(volatilityIndex * 100).toFixed(1)}% and liquidity score of ${(liquidityScore * 100).toFixed(1)}%, a ${splits.length}-tranche buying strategy is recommended at ₦${currentPrice.toFixed(0)}/L. ${volatilityIndex > 0.6 ? "High volatility warrants more distributed purchases to reduce timing risk." : "Moderate conditions allow front-loading with smaller reserves."}`;

  return {
    splits,
    volatilityIndex: Math.round(volatilityIndex * 100) / 100,
    liquidityScore: Math.round(liquidityScore * 100) / 100,
    reasoning,
  };
}

export function computeArbitrage(params: {
  depotPrices: { depotName: string; price: number }[];
  productType: string;
  transportCostPerLitre?: number;
}): ArbitrageResult | null {
  const { depotPrices, productType, transportCostPerLitre } = params;

  if (depotPrices.length < 2) return null;

  const sorted = [...depotPrices].sort((a, b) => a.price - b.price);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  const spread = highest.price - lowest.price;

  const defaultTransportCosts: Record<string, number> = {
    PMS: 8, AGO: 10, JET_A1: 12, ATK: 12, LPG: 15,
  };
  const transportCost = transportCostPerLitre ?? defaultTransportCosts[productType] ?? 10;

  const netProfit = spread - transportCost;
  const profitMarginPercent = lowest.price > 0 ? (netProfit / lowest.price) * 100 : 0;
  const hasOpportunity = netProfit > 0 && profitMarginPercent > 0.3;

  const reasoning = hasOpportunity
    ? `Arbitrage opportunity detected on ${productType}: buy from ${lowest.depotName} at ₦${lowest.price.toFixed(0)}/L, sell at ${highest.depotName} at ₦${highest.price.toFixed(0)}/L. Spread of ₦${spread.toFixed(0)}/L minus ₦${transportCost.toFixed(0)}/L transport = ₦${netProfit.toFixed(0)}/L net profit (${profitMarginPercent.toFixed(2)}% margin).`
    : `No profitable arbitrage on ${productType}. Spread of ₦${spread.toFixed(0)}/L does not cover ₦${transportCost.toFixed(0)}/L estimated transport cost.`;

  return {
    hasOpportunity,
    spread: Math.round(spread * 100) / 100,
    transportCost,
    netProfit: Math.round(netProfit * 100) / 100,
    profitMarginPercent: Math.round(profitMarginPercent * 100) / 100,
    lowestDepot: { name: lowest.depotName, price: lowest.price },
    highestDepot: { name: highest.depotName, price: highest.price },
    reasoning,
  };
}

export function computeAdvancedHedge(params: {
  inventoryVolume: number;
  averageCost: number;
  currentPrice: number;
  forecastBias: string;
  forecastConfidence: number;
  dropProbability: number;
  historicalVolatility: number;
  demandIndex: number;
  fxVolatility: number;
  productType: string;
  depotPrices?: { depotName: string; price: number }[];
}): AdvancedHedgeOutput {
  const inventoryRisk = computeInventoryRisk({
    inventoryVolume: params.inventoryVolume,
    averageCost: params.averageCost,
    forecastDropProbability: params.dropProbability,
    expectedPrice: params.currentPrice,
    productType: params.productType,
  });

  const staggeredBuy = computeStaggeredBuy({
    historicalVolatility: params.historicalVolatility,
    demandIndex: params.demandIndex,
    fxVolatility: params.fxVolatility,
    currentPrice: params.currentPrice,
    productType: params.productType,
  });

  const arbitrage = params.depotPrices
    ? computeArbitrage({
        depotPrices: params.depotPrices,
        productType: params.productType,
      })
    : null;

  let overallRiskLevel: "low" | "medium" | "high" = "low";
  if (inventoryRisk.riskLevel === "critical" || inventoryRisk.riskLevel === "high") {
    overallRiskLevel = "high";
  } else if (inventoryRisk.riskLevel === "medium" || staggeredBuy.volatilityIndex > 0.6) {
    overallRiskLevel = "medium";
  }

  let overallStrategy = "";
  if (params.forecastBias === "bullish" && params.forecastConfidence >= 65) {
    overallStrategy = `Strong bullish signal on ${params.productType} (${params.forecastConfidence}% confidence). Recommended: front-load purchases using the staggered buy plan and hold existing inventory for margin gains.`;
  } else if (params.forecastBias === "bearish") {
    overallStrategy = `Bearish outlook on ${params.productType}. Recommended: reduce inventory exposure, defer new purchases, and monitor arbitrage opportunities between depots.`;
  } else {
    overallStrategy = `Neutral ${params.productType} outlook. Recommended: maintain current positions, follow the staggered buy schedule for new procurement, and watch for arbitrage windows.`;
  }

  if (arbitrage?.hasOpportunity) {
    overallStrategy += ` Arbitrage opportunity available: ₦${arbitrage.netProfit.toFixed(0)}/L profit between ${arbitrage.lowestDepot.name} and ${arbitrage.highestDepot.name}.`;
  }

  return {
    inventoryRisk,
    staggeredBuy,
    arbitrage,
    overallStrategy,
    overallRiskLevel,
  };
}
