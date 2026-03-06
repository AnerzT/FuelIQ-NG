import type { Response } from "express";
import { storage } from "../storage";
import type { AuthRequest } from "../middleware/auth";
import { PRODUCT_TYPES } from "@shared/schema";

interface HedgeStrategy {
  strategyType: string;
  reasoning: string;
  riskLevel: string;
  expectedMarginImpact: number;
}

function generateStrategies(
  bias: string,
  confidence: number,
  avgCost: number,
  currentPrice: number,
  volume: number,
  productType: string
): HedgeStrategy[] {
  const strategies: HedgeStrategy[] = [];
  const priceDelta = currentPrice - avgCost;
  const priceDeltaPercent = avgCost > 0 ? (priceDelta / avgCost) * 100 : 0;

  if (bias === "bullish" && confidence >= 60) {
    strategies.push({
      strategyType: "Forward Buying",
      reasoning: `Market signals indicate ${productType} prices are likely to rise (${confidence}% confidence). Lock in current prices by purchasing additional volume now to protect against future price increases.`,
      riskLevel: confidence >= 75 ? "low" : "medium",
      expectedMarginImpact: Math.round(priceDeltaPercent * 0.7 * 100) / 100,
    });
  }

  if (bias === "bearish" || (bias === "neutral" && confidence < 60)) {
    strategies.push({
      strategyType: "Staggered Purchase",
      reasoning: `${productType} prices show ${bias} tendency. Spread purchases over multiple days to average out price volatility and reduce downside risk.`,
      riskLevel: "low",
      expectedMarginImpact: Math.round(Math.abs(priceDeltaPercent) * 0.3 * 100) / 100,
    });
  }

  if (volume > 0 && priceDelta > 0) {
    strategies.push({
      strategyType: "Margin Protection",
      reasoning: `Current ${productType} market price (₦${currentPrice.toFixed(0)}) is above your average cost (₦${avgCost.toFixed(0)}). Consider selling a portion of your ${volume.toLocaleString()}L inventory to lock in ₦${priceDelta.toFixed(0)}/L profit.`,
      riskLevel: "low",
      expectedMarginImpact: Math.round(priceDeltaPercent * 100) / 100,
    });
  }

  if (volume > 0 && priceDelta < 0) {
    strategies.push({
      strategyType: "Cost Averaging",
      reasoning: `${productType} current price (₦${currentPrice.toFixed(0)}) is below your average cost (₦${avgCost.toFixed(0)}). Buying additional volume now can reduce your overall average cost per litre.`,
      riskLevel: "medium",
      expectedMarginImpact: Math.round(priceDeltaPercent * 0.5 * 100) / 100,
    });
  }

  if (bias === "neutral" && confidence >= 60) {
    strategies.push({
      strategyType: "Hold Position",
      reasoning: `${productType} market is stable with neutral bias and ${confidence}% confidence. Maintain current inventory levels and monitor for signal changes before committing to new purchases.`,
      riskLevel: "low",
      expectedMarginImpact: 0,
    });
  }

  if (strategies.length === 0) {
    strategies.push({
      strategyType: "Monitor & Wait",
      reasoning: `Insufficient signal clarity for ${productType}. Continue monitoring market conditions before taking action. Set price alerts for key thresholds.`,
      riskLevel: "low",
      expectedMarginImpact: 0,
    });
  }

  return strategies;
}

export async function getHedgeRecommendations(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { productType } = req.query;
    const recommendations = await storage.getHedgeRecommendations(
      userId,
      productType as string | undefined
    );
    return res.json({ success: true, data: recommendations });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function generateHedgeRecommendations(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { productType, terminalId } = req.body;

    const productsToAnalyze = productType ? [productType] : [...PRODUCT_TYPES];
    const allRecommendations: any[] = [];

    for (const pt of productsToAnalyze) {
      const inventoryItems = await storage.getInventory(userId, terminalId, pt);
      const totalVolume = inventoryItems.reduce((sum, i) => sum + i.volumeLitres, 0);
      const weightedAvgCost = totalVolume > 0
        ? inventoryItems.reduce((sum, i) => sum + i.averageCost * i.volumeLitres, 0) / totalVolume
        : 0;

      let forecast = null;
      if (terminalId) {
        forecast = await storage.getLatestForecast(terminalId, pt);
      } else if (inventoryItems.length > 0) {
        forecast = await storage.getLatestForecast(inventoryItems[0].terminalId, pt);
      }

      const currentPrice = forecast
        ? (forecast.expectedMin + forecast.expectedMax) / 2
        : weightedAvgCost;

      const bias = forecast?.bias || "neutral";
      const confidence = forecast?.confidence || 50;

      const strategies = generateStrategies(bias, confidence, weightedAvgCost, currentPrice, totalVolume, pt);

      for (const strategy of strategies) {
        const rec = await storage.createHedgeRecommendation({
          userId,
          productType: pt,
          strategyType: strategy.strategyType,
          reasoning: strategy.reasoning,
          riskLevel: strategy.riskLevel,
          expectedMarginImpact: strategy.expectedMarginImpact,
        });
        allRecommendations.push(rec);
      }
    }

    return res.status(201).json({
      success: true,
      data: allRecommendations,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
