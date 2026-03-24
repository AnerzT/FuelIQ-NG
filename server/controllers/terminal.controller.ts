import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";

export async function getTerminals(req: AuthRequest, res: Response) {
  try {
    const terminals = await storage.getAllTerminals();
    return res.json({ success: true, data: terminals });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
