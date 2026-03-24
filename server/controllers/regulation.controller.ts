import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureNumber } from "../utils/params.js";

export async function getRegulations(req: AuthRequest, res: Response) {
  try {
    const limit = ensureNumber(req.query.limit, 20);
    const regulations = await storage.getRegulationUpdates(limit);
    return res.json({ success: true, data: regulations });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getHighImpactRegulations(req: AuthRequest, res: Response) {
  try {
    const regulations = await storage.getHighImpactRegulations();
    return res.json({ success: true, data: regulations });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
