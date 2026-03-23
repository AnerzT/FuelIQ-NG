import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString, ensureNumber } from "../utils/params.js";

export async function getSignals(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.params.terminalId);
    const signal = await storage.getLatestSignal(terminalId);
    if (!signal) return res.status(404).json({ success: false, message: "No signals available" });
    return res.json({ success: true, data: signal });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createSignal(req: AuthRequest, res: Response) {
  try {
    const body = req.body;
    const terminalId = ensureString(body.terminalId);
    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) return res.status(404).json({ success: false, message: "Terminal not found" });

    const signal = await storage.createSignal({
      terminalId,
      productType: ensureString(body.productType, "PMS"),
      vesselActivity: ensureString(body.vesselActivity),
      truckQueue: ensureString(body.truckQueue),
      nnpcSupply: ensureString(body.nnpcSupply),
      fxPressure: ensureString(body.fxPressure),
      policyRisk: ensureString(body.policyRisk),
    });
    return res.status(201).json({ success: true, data: signal });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSignalHistory(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.params.terminalId);
    const limit = ensureNumber(req.query.limit, 20);
    const signals = await storage.getSignalHistory(terminalId, limit);
    return res.json({ success: true, data: signals });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
