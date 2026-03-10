import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { storage } from "../storage.js";

export async function getRegulations(req: AuthRequest, res: Response) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const regulations = await storage.getRegulationUpdates(limit);
    return res.json({ success: true, data: regulations });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getHighImpactRegulations(_req: AuthRequest, res: Response) {
  try {
    const all = await storage.getRegulationUpdates(100);
    const highImpact = all.filter((r) => r.impactLevel === "high");
    return res.json({ success: true, data: highImpact });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
