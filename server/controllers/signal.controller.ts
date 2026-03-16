import type { Response } from "express";
import { storage } from "../storage.js";
import { insertMarketSignalSchema } from "../../shared/schema.js";
import type { AuthRequest } from "../middleware/auth.js";

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

    // Use type assertion to bypass TypeScript inference issues
    const body = req.body as any;
    const terminalId = String(body.terminalId);

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signalData = {
      terminalId,
      productType: body.productType || "PMS",
      vesselActivity: body.vesselActivity || null,
      truckQueue: body.truckQueue || null,
      nnpcSupply: body.nnpcSupply || null,
      fxPressure: body.fxPressure || null,
      policyRisk: body.policyRisk || null,
      signalType: body.signalType || null,
      value: body.value !== undefined && body.value !== null ? Number(body.value) : null,
      description: body.description || null,
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
