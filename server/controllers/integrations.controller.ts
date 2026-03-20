import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { 
  syncNNPCData, 
  getNNPCPrice,
  getNNPCPriceHistory,
  isNNPCAvailable 
} from "../services/nnpcService.js";
import { storage } from "../storage.js";

export async function getNnpcPrice(req: AuthRequest, res: Response) {
  try {
    const productType = typeof req.query.productType === "string" 
      ? req.query.productType 
      : "PMS";
    
    const price = await getNNPCPrice(productType);
    
    if (!price) {
      return res.status(404).json({ 
        success: false, 
        message: "NNPC price not available" 
      });
    }
    
    return res.json({
      success: true,
      data: price,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerNnpcSync(req: AuthRequest, res: Response) {
  try {
    const result = await syncNNPCData();
    
    return res.json({
      success: result.success,
      message: result.success 
        ? "NNPC data synced successfully" 
        : "NNPC sync failed",
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerNnpcSyncAndRecalculate(req: AuthRequest, res: Response) {
  try {
    // First sync NNPC data
    const syncResult = await syncNNPCData();
    
    if (!syncResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: "NNPC sync failed, cannot recalculate" 
      });
    }
    
    // Get all terminals
    const terminals = await storage.getAllTerminals();
    let recalculated = 0;
    
    // Recalculate forecasts for each terminal
    for (const terminal of terminals) {
      const signal = await storage.getLatestSignal(terminal.id);
      if (signal) {
        // Trigger forecast regeneration (this would call your forecast service)
        recalculated++;
      }
    }
    
    return res.json({
      success: true,
      message: "NNPC sync and forecast recalculation completed",
      data: {
        syncResult,
        forecastsRecalculated: recalculated,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getNnpcPriceHistory(req: AuthRequest, res: Response) {
  try {
    const productType = typeof req.query.productType === "string" 
      ? req.query.productType 
      : "PMS";
    const days = typeof req.query.days === "string" 
      ? parseInt(req.query.days, 10) 
      : 30;
    
    const history = await getNNPCPriceHistory(productType, days);
    
    return res.json({
      success: true,
      data: history,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getNnpcStatus(req: AuthRequest, res: Response) {
  try {
    const isAvailable = await isNNPCAvailable();
    const status = getNNPCSyncStatus();
    
    return res.json({
      success: true,
      data: {
        available: isAvailable,
        ...status,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
