import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString, ensureNumber, ensureBoolean } from "../utils/params.js";

export async function getDepots(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.query.terminalId);
    const depots = await storage.getDepots(terminalId);
    return res.json({ success: true, data: depots });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepot(req: AuthRequest, res: Response) {
  try {
    const id = ensureString(req.params.id);
    const depot = await storage.getDepot(id);
    if (!depot) return res.status(404).json({ success: false, message: "Depot not found" });
    return res.json({ success: true, data: depot });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createDepot(req: AuthRequest, res: Response) {
  try {
    const { name, terminalId, owner, active } = req.body;
    const terminal = await storage.getTerminal(ensureString(terminalId));
    if (!terminal) return res.status(404).json({ success: false, message: "Terminal not found" });
    const depot = await storage.createDepot({
      name: ensureString(name),
      terminalId: ensureString(terminalId),
      owner: ensureString(owner),
      active: ensureBoolean(active, true),
    });
    return res.status(201).json({ success: true, data: depot });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepotPrices(req: AuthRequest, res: Response) {
  try {
    const depotId = ensureString(req.query.depotId);
    const productType = ensureString(req.query.productType);
    const prices = await storage.getDepotPrices(depotId, productType);
    return res.json({ success: true, data: prices });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createDepotPrice(req: AuthRequest, res: Response) {
  try {
    const { depotId, productType, price } = req.body;
    const depot = await storage.getDepot(ensureString(depotId));
    if (!depot) return res.status(404).json({ success: false, message: "Depot not found" });
    const depotPrice = await storage.createDepotPrice({
      depotId: ensureString(depotId),
      productType: ensureString(productType, "PMS"),
      price: ensureNumber(price, 0),
    });
    return res.status(201).json({ success: true, data: depotPrice });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateDepotPrice(req: AuthRequest, res: Response) {
  try {
    const id = ensureString(req.params.id);
    const price = ensureNumber(req.body.price);
    const updated = await storage.updateDepotPrice(id, price);
    if (!updated) return res.status(404).json({ success: false, message: "Depot price not found" });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepotPriceHistory(req: AuthRequest, res: Response) {
  try {
    const depotId = ensureString(req.params.depotId);
    const days = ensureNumber(req.query.days, 30);
    const depot = await storage.getDepot(depotId);
    if (!depot) return res.status(404).json({ success: false, message: "Depot not found" });
    const prices = await storage.getDepotPrices(depotId);
    const sorted = prices.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, days);
    return res.json({ success: true, data: sorted });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepotPriceByProduct(req: AuthRequest, res: Response) {
  try {
    const depotId = ensureString(req.params.depotId);
    const productType = ensureString(req.params.productType);
    const depot = await storage.getDepot(depotId);
    if (!depot) return res.status(404).json({ success: false, message: "Depot not found" });
    const prices = await storage.getDepotPrices(depotId, productType);
    const latest = prices[0];
    if (!latest) return res.status(404).json({ success: false, message: `No price for ${productType}` });
    return res.json({ success: true, data: latest });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
