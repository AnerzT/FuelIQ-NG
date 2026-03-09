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
    const parsed = insertMarketSignalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
    }

    const terminal = await storage.getTerminal(parsed.data.terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signal = await storage.createSignal(parsed.data);

    return res.status(201).json({
      success: true,
      message: "Market signal created successfully",
      data: signal,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
