import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureNumber } from "../utils/params.js";

export async function getRefineryUpdates(req: AuthRequest, res: Response) {
  try {
    const limit = ensureNumber(req.query.limit, 20);

    const updates = await storage.getRefineryUpdates(limit);

    return res.json({
      success: true,
      data: updates,
    });

  } catch (err: any) {
    console.error("getRefineryUpdates error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch refinery updates",
    });
  }
}

export async function getRefineryStatus(req: AuthRequest, res: Response) {
  try {
    const updates = await storage.getRefineryUpdates(5);

    return res.json({
      success: true,
      data: updates,
    });

  } catch (err: any) {
    console.error("getRefineryStatus error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch refinery status",
    });
  }
}
