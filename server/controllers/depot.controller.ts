import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";

export async function getDepots(req: AuthRequest, res: Response) {
  try {
    const terminalId = req.query.terminalId as string | undefined;
    const depots = await storage.getDepots(terminalId);
    return res.json({ success: true, data: depots });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepot(req: AuthRequest, res: Response) {
  try {
    const depot = await storage.getDepot(req.params.id as string);
    if (!depot) {
      return res.status(404).json({ success: false, message: "Depot not found" });
    }
    return res.json({ success: true, data: depot });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createDepot(req: AuthRequest, res: Response) {
  try {
    const { name, terminalId, owner, active } = req.body;
    if (!name || !terminalId || !owner) {
      return res.status(400).json({ success: false, message: "name, terminalId, and owner are required" });
    }
    const terminal = await storage.getTerminal(String(terminalId));
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }
    const depot = await storage.createDepot({
      name,
      location: "Nigeria",
      terminalId: String(terminalId),
      owner,
      active: active ?? true,
      isActive: active ?? true,
    } as any);
    return res.status(201).json({ success: true, data: depot });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepotPrices(req: AuthRequest, res: Response) {
  try {
    const depotId = req.query.depotId as string | undefined;
    const productType = req.query.productType as string | undefined;
    const terminalId = req.query.terminalId as string | undefined;
    let prices = await storage.getDepotPrices(depotId, productType);
    if (terminalId) {
      prices = prices.filter((p) => p.terminalId === terminalId);
    }

    const lowestByProduct: Record<string, { price: number; depotName: string }> = {};
    const highestByProduct: Record<string, { price: number; depotName: string }> = {};
    for (const p of prices) {
      const pt = p.productType;
      if (!lowestByProduct[pt] || p.price < lowestByProduct[pt].price) {
        lowestByProduct[pt] = { price: p.price, depotName: p.depotName || "" };
      }
      if (!highestByProduct[pt] || p.price > highestByProduct[pt].price) {
        highestByProduct[pt] = { price: p.price, depotName: p.depotName || "" };
      }
    }

    const spreads: Record<string, { spread: number; arbitragePercent: number }> = {};
    for (const pt of Object.keys(lowestByProduct)) {
      if (highestByProduct[pt]) {
        const spread = highestByProduct[pt].price - lowestByProduct[pt].price;
        const arbitragePercent = lowestByProduct[pt].price > 0
          ? (spread / lowestByProduct[pt].price) * 100
          : 0;
        spreads[pt] = {
          spread: Math.round(spread * 100) / 100,
          arbitragePercent: Math.round(arbitragePercent * 100) / 100,
        };
      }
    }

    return res.json({
      success: true,
      data: {
        prices,
        lowestByProduct,
        highestByProduct,
        spreads,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createDepotPrice(req: AuthRequest, res: Response) {
  try {
    const { depotId, productType, price } = req.body;
    if (!depotId || !productType || price === undefined) {
      return res.status(400).json({ success: false, message: "depotId, productType, and price are required" });
    }
    const depot = await storage.getDepot(String(depotId));
    if (!depot) {
      return res.status(404).json({ success: false, message: "Depot not found" });
    }
    const depotPrice = await storage.createDepotPrice({
      depotId: String(depotId),
      productType,
      price: Number(price),
      updatedAt: new Date(),
      recordedAt: new Date(),
    } as any);
    return res.status(201).json({ success: true, data: depotPrice });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateDepotPrice(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { price } = req.body;
    if (price === undefined) {
      return res.status(400).json({ success: false, message: "price is required" });
    }
    const updated = await storage.updateDepotPrice(String(id), Number(price));
    if (!updated) {
      return res.status(404).json({ success: false, message: "Depot price not found" });
    }
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
