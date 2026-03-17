import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";

export async function getTraderSignals(req: AuthRequest, res: Response) {
  try {
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    // Fixed: Now passing only one argument (limit)
    const signals = await storage.getTraderSignals(safeLimit);
    
    return res.json({
      success: true,
      data: signals,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function submitTraderSignal(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { 
      message, 
      sentimentScore, 
      impactScore, 
      terminalId, 
      productType,
      detectedTerminal,
      detectedProduct,
      keywords 
    } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: "Message is required" 
      });
    }
    
    // Validate terminal if provided
    if (terminalId) {
      const terminal = await storage.getTerminal(terminalId);
      if (!terminal) {
        return res.status(404).json({ success: false, message: "Terminal not found" });
      }
    }
    
    const signal = await storage.createTraderSignal({
      userId,
      message,
      sentimentScore: sentimentScore ? Number(sentimentScore) : null,
      impactScore: impactScore ? Number(impactScore) : null,
      terminalId: terminalId || null,
      productType: productType || "PMS",
      detectedTerminal: detectedTerminal || null,
      detectedProduct: detectedProduct || null,
      keywords: keywords || null,
    });
    
    return res.status(201).json({
      success: true,
      message: "Trader signal submitted successfully",
      data: signal,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTraderSignalsByTerminal(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.params;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    
    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }
    
    // Fixed: Now using the correct method with proper arguments
    const signals = await storage.getTraderSignalsByTerminal(terminalId, safeLimit);
    
    return res.json({
      success: true,
      data: signals,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTraderSignalById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    
    // Since we don't have a direct getTraderSignalById method,
    // we'll get all signals and filter (inefficient but works for now)
    const allSignals = await storage.getTraderSignals(100);
    const signal = allSignals.find(s => s.id === id);
    
    if (!signal) {
      return res.status(404).json({ success: false, message: "Trader signal not found" });
    }
    
    return res.json({
      success: true,
      data: signal,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTraderSignalsByUser(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    
    // Get all signals and filter by userId
    const allSignals = await storage.getTraderSignals(safeLimit * 2); // Get more to account for filtering
    const userSignals = allSignals.filter(s => s.userId === userId).slice(0, safeLimit);
    
    return res.json({
      success: true,
      data: userSignals,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getRecentTraderSignals(req: AuthRequest, res: Response) {
  try {
    const hours = typeof req.query.hours === "string" ? parseInt(req.query.hours, 10) : 24;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    
    const signals = await storage.getTraderSignals(safeLimit * 2);
    
    // Filter by recent time
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);
    
    const recentSignals = signals
      .filter(s => new Date(s.createdAt) >= cutoffTime)
      .slice(0, safeLimit);
    
    return res.json({
      success: true,
      data: recentSignals,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getHighImpactTraderSignals(req: AuthRequest, res: Response) {
  try {
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    
    const signals = await storage.getTraderSignals(safeLimit * 3);
    
    // Filter by high impact (impactScore > 70 or sentimentScore > 80)
    const highImpactSignals = signals
      .filter(s => (s.impactScore && s.impactScore > 70) || (s.sentimentScore && s.sentimentScore > 80))
      .slice(0, safeLimit);
    
    return res.json({
      success: true,
      data: highImpactSignals,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTraderSignalsByProduct(req: AuthRequest, res: Response) {
  try {
    const { productType } = req.params;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    
    const signals = await storage.getTraderSignals(safeLimit * 2);
    
    // Filter by product type
    const productSignals = signals
      .filter(s => s.productType === productType)
      .slice(0, safeLimit);
    
    return res.json({
      success: true,
      data: productSignals,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
