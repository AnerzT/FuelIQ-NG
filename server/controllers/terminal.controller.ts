import type { Response } from "express";
import { storage } from "../storage";
import type { AuthRequest } from "../middleware/auth";

export async function getTerminals(req: AuthRequest, res: Response) {
  try {
    const terminalList = await storage.getTerminals();

    return res.json({
      success: true,
      data: terminalList,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
