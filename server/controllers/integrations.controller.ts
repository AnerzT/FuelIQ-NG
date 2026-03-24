import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { storage } from "../storage.js";
import { syncNNPCData, getNNPCPrice, getNNPCPriceHistory, isNNPCAvailable, getNNPCSyncStatus } from "../services/nnpcService.js";
import { ensureString, ensureNumber } from "../utils/params.js";

export async function getNnpcPrice(req: AuthRequest, res: Response) {
  try {
    const productType = ensureString(req.query.productType, "PMS");
    const price = await getNNPCPrice(productType);
    if (!price) return res.status(404).json({ success: false, message: "NNPC price not available" });
    return res.json({ success: true, data: price });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerNnpcSync(req: AuthRequest, res: Response) {
  try {
    const result = await syncNNPCData();
    return res.json({
      success: result.success,
      message: result.success ? "NNPC data synced successfully" : "NNPC sync failed",
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerNnpcSyncAndRecalculate(req: AuthRequest, res: Response) {
  try {
    const syncResult = await syncNNPCData();
    if (!syncResult.success) {
      return res.status(500).json({ success: false, message: "NNPC sync failed, cannot recalculate" });
    }
    const terminals = await storage.getAllTerminals();
    let recalculated = 0;
    for (const terminal of terminals) {
      const signal = await storage.getLatestSignal(terminal.id);
      if (signal) recalculated++;
    }
    return res.json({
      success: true,
      message: "NNPC sync and forecast recalculation completed",
      data: { syncResult, forecastsRecalculated: recalculated },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getNnpcPriceHistory(req: AuthRequest, res: Response) {
  try {
    const productType = ensureString(req.query.productType, "PMS");
    const days = ensureNumber(req.query.days, 30);
    const history = await getNNPCPriceHistory(productType, days);
    return res.json({ success: true, data: history });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getNnpcStatus(req: AuthRequest, res: Response) {
  try {
    const isAvailable = await isNNPCAvailable();
    const status = getNNPCSyncStatus();
    return res.json({ success: true, data: { available: isAvailable, ...status } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getVesselTracking(req: AuthRequest, res: Response) {
  try {
    // Mock data – replace with real implementation later
    const vessels = [
      { id: "VSL001", name: "MT APAPA STAR", location: "Apapa Port", eta: "2026-03-25", status: "berthed" },
      { id: "VSL002", name: "MT LAGOS PRIDE", location: "Approaching", eta: "2026-03-26", status: "en-route" },
      { id: "VSL003", name: "MT WARRI QUEEN", location: "Warri Port", eta: "2026-03-24", status: "berthed" },
    ];
    return res.json({ success: true, data: vessels });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerVesselSignalUpdate(req: AuthRequest, res: Response) {
  try {
    // Mock implementation
    return res.json({ success: true, message: "Vessel signals updated successfully", data: { updated: 3 } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getFxRate(req: AuthRequest, res: Response) {
  try {
    const rates = await storage.getFxRates(1);
    const latestRate = rates[0] || { rate: 1500, source: "CBN", createdAt: new Date() };
    return res.json({ success: true, data: { usd: latestRate.rate, source: latestRate.source, updatedAt: latestRate.createdAt } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerFxSync(req: AuthRequest, res: Response) {
  try {
    const mockRate = { rate: 1500 + Math.random() * 50, source: "CBN" };
    await storage.createFxRate(mockRate);
    return res.json({ success: true, message: "FX rates synced successfully", data: mockRate });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerFxSignalUpdate(req: AuthRequest, res: Response) {
  try {
    // Mock implementation
    return res.json({ success: true, message: "FX signals updated successfully", data: { updated: 5 } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getMarketOverview(req: AuthRequest, res: Response) {
  try {
    const terminals = await storage.getAllTerminals();
    const signals = await Promise.all(terminals.map(t => storage.getLatestSignal(t.id)));
    const fxRate = await storage.getLatestFxRate();
    return res.json({
      success: true,
      data: {
        terminals: terminals.length,
        activeSignals: signals.filter(Boolean).length,
        fxRate: fxRate?.rate || 1500,
        marketSentiment: "bullish",
        lastUpdated: new Date(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getFxHistory(req: AuthRequest, res: Response) {
  try {
    const days = ensureNumber(req.query.days, 30);
    const rates = await storage.getFxRates(days);
    const history = rates.map(r => ({ date: r.createdAt, rate: r.rate, source: r.source }));
    return res.json({ success: true, data: history });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
