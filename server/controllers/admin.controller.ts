import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString, ensureNumber } from "../utils/params.js";

export async function adminGetTerminals(req: AuthRequest, res: Response) {
  try {
    const terminals = await storage.getAllTerminals();
    return res.json({ success: true, data: terminals });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminToggleTerminal(req: AuthRequest, res: Response) {
  try {
    const id = ensureString(req.params.id);
    const terminal = await storage.getTerminal(id);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }
    const updated = await storage.updateTerminal(id, { active: !terminal.active });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminCreateForecast(req: AuthRequest, res: Response) {
  try {
    const forecastData = req.body;
    const forecast = await storage.createForecast(forecastData);
    return res.status(201).json({ success: true, data: forecast });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminUpdateSignal(req: AuthRequest, res: Response) {
  try {
    const signalData = req.body;
    const signal = await storage.createSignal(signalData);
    return res.status(201).json({ success: true, data: signal });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminGetForecasts(req: AuthRequest, res: Response) {
  try {
    const limit = ensureNumber(req.query.limit, 100);
    const forecasts = await storage.getAllForecasts(limit);
    return res.json({ success: true, data: forecasts });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
