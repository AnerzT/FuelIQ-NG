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
    const { terminalId, productType, vesselActivity, truckQueue, nnpcSupply, fxPressure, policyRisk, signalType, value, description } = req.body;

    if (!terminalId) {
      return res.status(400).json({ success: false, message: "terminalId is required" });
    }

    const terminal = await storage.getTerminal(String(terminalId));
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signal = await storage.createSignal({
      terminalId: String(terminalId),
      productType: productType || "PMS",
      vesselActivity: vesselActivity || null,
      truckQueue: truckQueue || null,
      nnpcSupply: nnpcSupply || null,
      fxPressure: fxPressure || null,
      policyRisk: policyRisk || null,
      signalType: signalType || null,
      value: value ? Number(value) : null,
      description: description || null,
    } as any);

    return res.status(201).json({
      success: true,
      message: "Market signal created successfully",
      data: signal,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
