import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString, ensureNumber } from "../utils/params.js";

export async function getTraderSignals(req: AuthRequest, res: Response) {
  try {
    const limit = ensureNumber(req.query.limit, 50);
    const signals = await storage.getTraderSignals(limit);
    return res.json({ success: true, data: signals });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function submitTraderSignal(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    const body = req.body;
    const signal = await storage.createTraderSignal({
      userId,
      message: ensureString(body.message),
      sentimentScore: ensureNumber(body.sentimentScore),
      impactScore: ensureNumber(body.impactScore),
      terminalId: ensureString(body.terminalId),
      productType: ensureString(body.productType, "PMS"),
      detectedTerminal: ensureString(body.detectedTerminal),
      detectedProduct: ensureString(body.detectedProduct),
      keywords: body.keywords,
    });
    return res.status(201).json({ success: true, data: signal });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTraderSignalsByTerminal(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.params.terminalId);
    const limit = ensureNumber(req.query.limit, 20);
    const signals = await storage.getTraderSignalsByTerminal(terminalId, limit);
    return res.json({ success: true, data: signals });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
