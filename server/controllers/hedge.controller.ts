import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { PRODUCT_TYPES } from "../../shared/schema.js";
import { computeAdvancedHedge, computeArbitrage } from "../services/hedgeEngine.js";

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
    const advancedAnalysis: Record<string, any> = {};

    for (const pt of productsToAnalyze) {
      const inventoryItems = await storage.getInventory(userId, terminalId, pt);
      const totalVolume = inventoryItems.reduce((sum, i) => sum + (Number((i as any).volumeLitres ?? (i as any).quantityLitres ?? 0)), 0);
      const weightedAvgCost = totalVolume > 0
        ? inventoryItems.reduce((sum, i) => sum + Number((i as any).averageCost ?? 0) * Number((i as any).volumeLitres ?? (i as any).quantityLitres ?? 0), 0) / totalVolume
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

      const history = terminalId
        ? await storage.getPriceHistory(terminalId, 30, pt)
        : (inventoryItems.length > 0 ? await storage.getPriceHistory(inventoryItems[0].terminalId, 30, pt) : []);

      const prices = history.map((h) => h.price);
      const mean = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : currentPrice;
      const variance = prices.length > 2 ? prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length : 0;
      const stdDev = Math.sqrt(variance);
      const historicalVolatility = mean > 0 ? Math.min(stdDev / mean, 1) : 0.5;

      const depotPricesData = await storage.getDepotPrices(undefined, pt);
      const depotPrices = depotPricesData.map((d) => ({
        depotName: d.depotName || "Unknown",
        price: d.price,
      }));

      const dropProbability = bias === "bearish" ? 60 : bias === "neutral" ? 35 : 15;
      const demandIndex = bias === "bullish" ? 0.75 : bias === "bearish" ? 0.35 : 0.55;

      const advanced = computeAdvancedHedge({
        inventoryVolume: totalVolume,
        averageCost: weightedAvgCost,
        currentPrice,
        forecastBias: bias,
        forecastConfidence: Number(confidence),
        dropProbability,
        historicalVolatility,
        demandIndex,
        fxVolatility: 0.5,
        productType: pt,
        depotPrices,
      });

      advancedAnalysis[pt] = advanced;

      if (advanced.inventoryRisk.riskLevel !== "low" && totalVolume > 0) {
        const rec = await storage.createHedgeRecommendation({
          userId: Number(userId),
          productType: pt,
          strategy: "Inventory Risk Alert",
          rationale: advanced.inventoryRisk.reasoning,
        } as any);
        allRecommendations.push(rec);
      }

      if (bias === "bullish" && Number(confidence) >= 60) {
        const rec = await storage.createHedgeRecommendation({
          userId: Number(userId),
          productType: pt,
          strategy: "Forward Buying",
          rationale: `${pt} prices likely to rise (${confidence}% confidence). ${advanced.staggeredBuy.reasoning}`,
        } as any);
        allRecommendations.push(rec);
      }

      const rec2 = await storage.createHedgeRecommendation({
        userId: Number(userId),
        productType: pt,
        strategy: "Staggered Purchase",
        rationale: advanced.staggeredBuy.reasoning,
      } as any);
      allRecommendations.push(rec2);

      if (advanced.arbitrage?.hasOpportunity) {
        const rec3 = await storage.createHedgeRecommendation({
          userId: Number(userId),
          productType: pt,
          strategy: "Depot Arbitrage",
          rationale: advanced.arbitrage.reasoning,
        } as any);
        allRecommendations.push(rec3);
      }

      if (totalVolume > 0 && currentPrice > weightedAvgCost) {
        const rec4 = await storage.createHedgeRecommendation({
          userId: Number(userId),
          productType: pt,
          strategy: "Margin Protection",
          rationale: `Current ${pt} price (₦${currentPrice.toFixed(0)}) is above avg cost (₦${weightedAvgCost.toFixed(0)}). Consider selling a portion of ${totalVolume.toLocaleString()}L to lock in ₦${(currentPrice - weightedAvgCost).toFixed(0)}/L profit.`,
        } as any);
        allRecommendations.push(rec4);
      }
    }

    return res.status(201).json({
      success: true,
      data: allRecommendations,
      analysis: advancedAnalysis,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAdvancedAnalysis(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const productType = (req.query.productType as string) || "PMS";
    const terminalId = req.query.terminalId as string | undefined;

    const inventoryItems = await storage.getInventory(userId, terminalId, productType);
    const totalVolume = inventoryItems.reduce((sum, i) => sum + Number((i as any).volumeLitres ?? (i as any).quantityLitres ?? 0), 0);
    const weightedAvgCost = totalVolume > 0
      ? inventoryItems.reduce((sum, i) => sum + Number((i as any).averageCost ?? 0) * Number((i as any).volumeLitres ?? (i as any).quantityLitres ?? 0), 0) / totalVolume
      : 0;

    let forecast = null;
    if (terminalId) {
      forecast = await storage.getLatestForecast(terminalId, productType);
    } else if (inventoryItems.length > 0) {
      forecast = await storage.getLatestForecast(inventoryItems[0].terminalId, productType);
    }

    const currentPrice = forecast
      ? (forecast.expectedMin + forecast.expectedMax) / 2
      : weightedAvgCost || 620;

    const bias = forecast?.bias || "neutral";
    const confidence = forecast?.confidence || 50;

    const tId = terminalId || (inventoryItems.length > 0 ? inventoryItems[0].terminalId : undefined);
    const history = tId ? await storage.getPriceHistory(tId, 30, productType) : [];
    const prices = history.map((h) => h.price);
    const mean = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : currentPrice;
    const variance = prices.length > 2 ? prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length : 0;
    const historicalVolatility = mean > 0 ? Math.min(Math.sqrt(variance) / mean, 1) : 0.5;

    const depotPricesData = await storage.getDepotPrices(undefined, productType);
    const depotPrices = depotPricesData.map((d) => ({
      depotName: d.depotName || "Unknown",
      price: d.price,
    }));

    const dropProbability = bias === "bearish" ? 60 : bias === "neutral" ? 35 : 15;
    const demandIndex = bias === "bullish" ? 0.75 : bias === "bearish" ? 0.35 : 0.55;

    const analysis = computeAdvancedHedge({
      inventoryVolume: totalVolume,
      averageCost: weightedAvgCost,
      currentPrice,
      forecastBias: bias,
      forecastConfidence: Number(confidence),
      dropProbability,
      historicalVolatility,
      demandIndex,
      fxVolatility: 0.5,
      productType,
      depotPrices,
    });

    return res.json({
      success: true,
      data: analysis,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
