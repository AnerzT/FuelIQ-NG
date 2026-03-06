import type { Response } from "express";
import { storage } from "../storage";
import type { AuthRequest } from "../middleware/auth";

export async function getPriceHistory(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const terminal = await storage.getTerminal(id);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const limit = parseInt(req.query.limit as string) || 30;
    const history = await storage.getPriceHistory(id, limit);

    return res.json({
      success: true,
      data: history,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
