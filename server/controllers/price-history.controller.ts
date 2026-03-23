import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString, ensureNumber } from "../utils/params.js";

export async function getPriceHistory(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.params.terminalId);
    const days = ensureNumber(req.query.days, 30);
    const productType = ensureString(req.query.productType, "PMS");

    const history = await storage.getPriceHistory(terminalId, days, productType);
    return res.json({ success: true, data: history });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
