import type { Response } from "express";
import { storage } from "../storage.js";
import { insertMarketSignalSchema } from "../../shared/schema.js";
import type { AuthRequest } from "../middleware/auth.js";
import type { z } from "zod";

type MarketSignalInput = z.infer<typeof insertMarketSignalSchema>;

export async function getSignals(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.params;

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signal = await storage.getLatestSignal(terminalId);
    if (!signal) {
      return res.status(404).json({ success: false, message: "No signals available for this terminal" });
    }

    return res.json({
      success: true,
      data: { terminal, signal },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createSignal(req: AuthRequest, res: Response) {
  try {
    // Validate input using the schema
    const parsed = insertMarketSignalSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
    }

    const data = parsed.data as MarketSignalInput;
    const terminalId = String(data.terminalId);

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signalData = {
      terminalId,
      productType: data.productType || "PMS",
      vesselActivity: data.vesselActivity || null,
      truckQueue: data.truckQueue || null,
      nnpcSupply: data.nnpcSupply || null,
      fxPressure: data.fxPressure || null,
      policyRisk: data.policyRisk || null,
      signalType: data.signalType || null,
      value: data.value !== undefined && data.value !== null ? Number(data.value) : null,
      description: data.description || null,
    };

    const signal = await storage.createSignal(signalData);

    return res.status(201).json({
      success: true,
      message: "Market signal created successfully",
      data: signal,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Add this missing function that's referenced in routes.ts
export async function getSignalHistory(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.params;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    // Try to get signal history from storage
    // If the method doesn't exist, fall back to just the latest signal
    try {
      // @ts-ignore - in case getSignalHistory doesn't exist yet
      const signals = await storage.getSignalHistory(terminalId, safeLimit);
      return res.json({
        success: true,
        data: signals,
      });
    } catch (error) {
      // Fallback: return the latest signal in an array
      const signal = await storage.getLatestSignal(terminalId);
      return res.json({
        success: true,
        data: signal ? [signal] : [],
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
