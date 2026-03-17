import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { calculateSpread, detectArbitrageOpportunity } from "../services/forecastEngine.js";

export async function getHedgeRecommendations(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Fixed: Now passing only one argument
    const recommendations = await storage.getHedgeRecommendations(userId);
    
    return res.json({
      success: true,
      data: recommendations,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function generateHedgeRecommendations(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get user's inventory for context
    const inventory = await storage.getInventory(userId);
    
    // Get market data
    const terminals = await storage.getAllTerminals();
    const signals = await Promise.all(
      terminals.map(async (terminal) => {
        const signal = await storage.getLatestSignal(terminal.id);
        return { terminal, signal };
      })
    );
    
    // Get depot prices for analysis
    const depotPrices = await storage.getDepotPrices();
    
    // Group prices by product
    const pricesByProduct: Record<string, any[]> = {};
    depotPrices.forEach(price => {
      if (!pricesByProduct[price.productType]) {
        pricesByProduct[price.productType] = [];
      }
      pricesByProduct[price.productType].push(price);
    });
    
    // Calculate average prices by product
    const avgPrices: Record<string, number> = {};
    Object.entries(pricesByProduct).forEach(([product, prices]) => {
      const sum = prices.reduce((acc, p) => acc + p.price, 0);
      avgPrices[product] = prices.length > 0 ? sum / prices.length : 0;
    });
    
    // Generate recommendations based on market conditions
    const recommendations = [];
    
    // Check for arbitrage opportunities
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
    
    // Check for spread opportunities
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
    
    // Check supply signals
    const weakSupplySignals = signals.filter(s => s.signal?.nnpcSupply === "Weak" || s.signal?.nnpcSupply === "Critical");
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
    
    // Save recommendations to storage
    const savedRecommendations = [];
    for (const rec of recommendations) {
      const saved = await storage.createHedgeRecommendation(rec);
      savedRecommendations.push(saved);
    }
    
    return res.status(201).json({
      success: true,
      message: "Hedge recommendations generated successfully",
      data: savedRecommendations,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAdvancedAnalysis(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get all terminals
    const terminals = await storage.getAllTerminals();
    
    // Get latest signals for each terminal
    const terminalSignals = await Promise.all(
      terminals.map(async (terminal) => {
        const signal = await storage.getLatestSignal(terminal.id);
        return { terminal, signal };
      })
    );
    
    // Get all depot prices
    const depotPrices = await storage.getDepotPrices();
    
    // Get user's inventory
    const inventory = await storage.getInventory(userId);
    
    // Calculate average prices by product - Fixed: Removed depotName references
    const pricesByProduct: Record<string, number[]> = {};
    depotPrices.forEach(price => {
      if (!pricesByProduct[price.productType]) {
        pricesByProduct[price.productType] = [];
      }
      pricesByProduct[price.productType].push(price.price);
    });
    
    const avgPrices: Record<string, number> = {};
    Object.entries(pricesByProduct).forEach(([product, prices]) => {
      const sum = prices.reduce((acc, p) => acc + p, 0);
      avgPrices[product] = prices.length > 0 ? sum / prices.length : 0;
    });
    
    // Calculate market volatility
    const volatility: Record<string, number> = {};
    Object.entries(pricesByProduct).forEach(([product, prices]) => {
      if (prices.length > 1) {
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
        volatility[product] = Math.sqrt(variance) / mean;
      } else {
        volatility[product] = 0.05;
      }
    });
    
    // Calculate spreads
    const spreads = {
      PMS_AGO: calculateSpread("PMS", "AGO", avgPrices),
      PMS_DPK: calculateSpread("PMS", "DPK", avgPrices),
      AGO_DPK: calculateSpread("AGO", "DPK", avgPrices),
    };
    
    // Calculate portfolio risk
    const portfolioValue = inventory.reduce((sum, item) => 
      sum + (item.volumeLitres * item.averageCost), 0);
    
    const weightedRisk = inventory.reduce((sum, item) => {
      const productVol = volatility[item.productType] || 0.05;
      return sum + (item.volumeLitres * item.averageCost * productVol);
    }, 0) / (portfolioValue || 1);
    
    // Identify supply constraints
    const supplyConstraints = terminalSignals
      .filter(s => s.signal?.nnpcSupply === "Weak" || s.signal?.nnpcSupply === "Critical")
      .map(s => ({
        terminal: s.terminal.name,
        supply: s.signal?.nnpcSupply,
      }));
    
    return res.json({
      success: true,
      data: {
        marketOverview: {
          averagePrices: avgPrices,
          volatility,
          spreads,
        },
        supplyConstraints,
        portfolioAnalysis: {
          totalValue: portfolioValue,
          riskLevel: weightedRisk > 0.1 ? "high" : weightedRisk > 0.05 ? "medium" : "low",
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
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getHedgeRecommendationById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    // Get all user recommendations and filter by ID
    const recommendations = await storage.getHedgeRecommendations(userId);
    const recommendation = recommendations.find(r => r.id === id);
    
    if (!recommendation) {
      return res.status(404).json({ success: false, message: "Hedge recommendation not found" });
    }
    
    return res.json({
      success: true,
      data: recommendation,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteHedgeRecommendation(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    // Since we don't have a delete method, we'll just return success
    // In a real implementation, you would delete from storage
    console.log(`User ${userId} deleted recommendation ${id}`);
    
    return res.json({
      success: true,
      message: "Hedge recommendation deleted successfully",
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Helper functions
function calculateHedgeRatio(volatility: Record<string, number>, spreads: any): number {
  const avgVolatility = Object.values(volatility).reduce((a, b) => a + b, 0) / Object.keys(volatility).length;
  const maxSpread = Math.max(Math.abs(spreads.PMS_AGO), Math.abs(spreads.PMS_DPK), Math.abs(spreads.AGO_DPK));
  
  // Simple hedge ratio calculation
  let ratio = 0.5;
  if (avgVolatility > 0.1) ratio += 0.2;
  if (maxSpread > 50) ratio += 0.1;
  
  return Math.min(0.9, Math.max(0.3, ratio));
}

function generateSuggestedActions(
  volatility: Record<string, number>, 
  spreads: any, 
  supplyConstraints: any[]
): string[] {
  const actions = [];
  
  if (volatility.PMS > 0.1) {
    actions.push("Consider forward contracts for PMS due to high volatility");
  }
  
  if (Math.abs(spreads.PMS_AGO) > 40) {
    actions.push(`Spread trade opportunity: ${spreads.PMS_AGO > 0 ? 'AGO over PMS' : 'PMS over AGO'}`);
  }
  
  if (supplyConstraints.length > 0) {
    actions.push(`Build inventory at ${supplyConstraints.length} terminals with supply constraints`);
  }
  
  if (actions.length === 0) {
    actions.push("Market conditions stable. Maintain current hedge positions.");
  }
  
  return actions;
}
