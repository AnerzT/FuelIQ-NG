import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { calculateSpread, detectArbitrageOpportunity } from "../services/forecastEngine.js";
import { ensureString } from "../utils/params.js";

export async function getHedgeRecommendations(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const recommendations = await storage.getHedgeRecommendations(userId);
    res.json({ success: true, data: recommendations });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function generateHedgeRecommendations(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const inventory = await storage.getInventory(userId);
    const terminals = await storage.getAllTerminals();

    const signals = await Promise.all(
      terminals.map(async terminal => ({
        terminal,
        signal: await storage.getLatestSignal(terminal.id),
      }))
    );

    const depotPrices = await storage.getDepotPrices();

    const pricesByProduct: Record<string, number[]> = {};
    depotPrices.forEach(price => {
      if (!pricesByProduct[price.productType]) {
        pricesByProduct[price.productType] = [];
      }
      pricesByProduct[price.productType].push(price.price);
    });

    const avgPrices: Record<string, number> = {};
    Object.entries(pricesByProduct).forEach(([product, prices]) => {
      const sum = prices.reduce((a, b) => a + b, 0);
      avgPrices[product] = prices.length > 0 ? sum / prices.length : 0;
    });

    const recommendations: any[] = [];

    const arbitrage = detectArbitrageOpportunity("", avgPrices);
    if (arbitrage?.exists) {
      recommendations.push({
        userId,
        productType: "PMS",
        strategyType: "arbitrage",
        reasoning: `Arbitrage opportunity detected with spread of ₦${arbitrage.spread}. ${arbitrage.recommendation}`,
        riskLevel: "medium",
        expectedMarginImpact: arbitrage.spread * 0.7,
      });
    }

    const pmsAgoSpread = calculateSpread("PMS", "AGO", avgPrices);
    if (Math.abs(pmsAgoSpread) > 30) {
      const direction = pmsAgoSpread > 0 ? "AGO over PMS" : "PMS over AGO";

      recommendations.push({
        userId,
        productType: "AGO",
        strategyType: "spread",
        reasoning: `${direction} spread is favorable at ₦${Math.abs(pmsAgoSpread)}. Consider adjusting positions.`,
        riskLevel: "low",
        expectedMarginImpact: Math.abs(pmsAgoSpread) * 0.5,
      });
    }

    const weakSupplySignals = signals.filter(
      s => s.signal?.nnpcSupply === "Weak" || s.signal?.nnpcSupply === "Critical"
    );

    if (weakSupplySignals.length > 0) {
      recommendations.push({
        userId,
        productType: "PMS",
        strategyType: "supply_hedge",
        reasoning: `Weak supply detected at ${weakSupplySignals.length} terminals. Consider building inventory.`,
        riskLevel: "high",
        expectedMarginImpact: 25,
      });
    }

    const savedRecommendations = [];

    for (const rec of recommendations) {
      const saved = await storage.createHedgeRecommendation(rec);
      savedRecommendations.push(saved);
    }

    res.status(201).json({
      success: true,
      message: "Hedge recommendations generated",
      data: savedRecommendations,
    });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAdvancedAnalysis(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const terminals = await storage.getAllTerminals();

    const terminalSignals = await Promise.all(
      terminals.map(async terminal => ({
        terminal,
        signal: await storage.getLatestSignal(terminal.id),
      }))
    );

    const depotPrices = await storage.getDepotPrices();
    const inventory = await storage.getInventory(userId);

    const pricesByProduct: Record<string, number[]> = {};
    depotPrices.forEach(price => {
      if (!pricesByProduct[price.productType]) {
        pricesByProduct[price.productType] = [];
      }
      pricesByProduct[price.productType].push(price.price);
    });

    const avgPrices: Record<string, number> = {};
    const volatility: Record<string, number> = {};

    Object.entries(pricesByProduct).forEach(([product, prices]) => {
      const sum = prices.reduce((a, b) => a + b, 0);
      const mean = prices.length > 0 ? sum / prices.length : 0;

      avgPrices[product] = mean;

      if (prices.length > 1) {
        const variance =
          prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
        volatility[product] = mean ? Math.sqrt(variance) / mean : 0;
      } else {
        volatility[product] = 0.05;
      }
    });

    const spreads = {
      PMS_AGO: calculateSpread("PMS", "AGO", avgPrices),
      PMS_DPK: calculateSpread("PMS", "DPK", avgPrices),
      AGO_DPK: calculateSpread("AGO", "DPK", avgPrices),
    };

    const portfolioValue = inventory.reduce(
      (sum, item) => sum + item.volumeLitres * item.averageCost,
      0
    );

    const weightedRisk =
      inventory.reduce((sum, item) => {
        const productVol = volatility[item.productType] || 0.05;
        return sum + item.volumeLitres * item.averageCost * productVol;
      }, 0) / (portfolioValue || 1);

    const supplyConstraints = terminalSignals
      .filter(s => s.signal?.nnpcSupply === "Weak" || s.signal?.nnpcSupply === "Critical")
      .map(s => ({
        terminal: s.terminal.name,
        supply: s.signal?.nnpcSupply,
      }));

    res.json({
      success: true,
      data: {
        marketOverview: { averagePrices: avgPrices, volatility, spreads },
        supplyConstraints,
        portfolioAnalysis: {
          totalValue: portfolioValue,
          riskLevel:
            weightedRisk > 0.1 ? "high" :
            weightedRisk > 0.05 ? "medium" : "low",
          weightedRisk,
          itemCount: inventory.length,
        },
        recommendations: {
          hedgeRatio: calculateHedgeRatio(volatility, spreads),
          suggestedActions: generateSuggestedActions(volatility, spreads, supplyConstraints),
        },
      },
    });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

function calculateHedgeRatio(volatility: Record<string, number>, spreads: any): number {
  const avgVol =
    Object.values(volatility).reduce((a, b) => a + b, 0) /
    Object.keys(volatility).length;

  const maxSpread = Math.max(
    Math.abs(spreads.PMS_AGO),
    Math.abs(spreads.PMS_DPK),
    Math.abs(spreads.AGO_DPK)
  );

  let ratio = 0.5;

  if (avgVol > 0.1) ratio += 0.2;
  if (maxSpread > 50) ratio += 0.1;

  return Math.min(0.9, Math.max(0.3, ratio));
}

function generateSuggestedActions(
  volatility: Record<string, number>,
  spreads: any,
  constraints: any[]
): string[] {
  const actions: string[] = [];

  if (volatility.PMS > 0.1) {
    actions.push("Consider forward contracts for PMS due to high volatility");
  }

  if (Math.abs(spreads.PMS_AGO) > 40) {
    actions.push(
      `Spread trade opportunity: ${
        spreads.PMS_AGO > 0 ? "AGO over PMS" : "PMS over AGO"
      }`
    );
  }

  if (constraints.length > 0) {
    actions.push(
      `Build inventory at ${constraints.length} terminals with supply constraints`
    );
  }

  if (actions.length === 0) {
    actions.push("Market conditions stable. Maintain current hedge positions.");
  }

  return actions;
}
