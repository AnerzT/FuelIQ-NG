import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString, ensureNumber } from "../utils/params.js";

export async function getInventory(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const inventory = await storage.getInventory(userId);
    return res.json({ success: true, data: inventory });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getInventoryWithPnL(req: AuthRequest, res: Response) {
  // similar
}

export async function createInventory(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    const { terminalId, productType, volumeLitres, averageCost } = req.body;
    const terminal = await storage.getTerminal(ensureString(terminalId));
    if (!terminal) return res.status(404).json({ success: false, message: "Terminal not found" });
    const inv = await storage.createInventory({
      userId,
      terminalId: ensureString(terminalId),
      productType: ensureString(productType, "PMS"),
      volumeLitres: ensureNumber(volumeLitres, 0),
      averageCost: ensureNumber(averageCost, 0),
    });
    return res.status(201).json({ success: true, data: inv });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ... and so on for all functions.
