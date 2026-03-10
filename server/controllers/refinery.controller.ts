import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { storage } from "../storage.js";

export async function getRefineryUpdates(req: AuthRequest, res: Response) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const updates = await storage.getRefineryUpdates(limit);
    return res.json({ success: true, data: updates });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getRefineryStatus(_req: AuthRequest, res: Response) {
  try {
    const updates = await storage.getRefineryUpdates(100);

    const latestByRefinery = new Map<string, typeof updates[0]>();
    for (const update of updates) {
      if (!latestByRefinery.has(update.refineryName)) {
        latestByRefinery.set(update.refineryName, update);
      }
    }

    const statusSummary = Array.from(latestByRefinery.values()).map((u) => ({
      refineryName: u.refineryName,
      operationalStatus: u.operationalStatus,
      productionCapacity: u.productionCapacity,
      pmsOutput: u.pmsOutputEstimate,
      dieselOutput: u.dieselOutputEstimate,
      jetOutput: u.jetOutputEstimate,
      lastUpdated: u.createdAt,
    }));

    return res.json({ success: true, data: statusSummary });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
