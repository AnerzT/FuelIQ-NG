import type { Response } from "express";
import { storage } from "../storage";
import type { AuthRequest } from "../middleware/auth";

export async function getInventory(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const terminalId = req.query.terminalId as string | undefined;
    const productType = req.query.productType as string | undefined;
    const items = await storage.getInventory(userId, terminalId, productType);
    return res.json({ success: true, data: items });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getInventoryWithPnL(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const terminalId = req.query.terminalId as string | undefined;
    const productType = req.query.productType as string | undefined;
    const items = await storage.getInventory(userId, terminalId, productType);

    const enriched = await Promise.all(
      items.map(async (item) => {
        const forecast = await storage.getLatestForecast(item.terminalId, item.productType);
        const currentPrice = forecast
          ? (forecast.expectedMin + forecast.expectedMax) / 2
          : item.averageCost;
        const unrealizedPnL = (currentPrice - item.averageCost) * item.volumeLitres;
        const pnlPercent = item.averageCost > 0
          ? ((currentPrice - item.averageCost) / item.averageCost) * 100
          : 0;

        const restockThreshold = 5000;
        const needsRestock = item.volumeLitres < restockThreshold;

        return {
          ...item,
          currentPrice: Math.round(currentPrice * 100) / 100,
          unrealizedPnL: Math.round(unrealizedPnL * 100) / 100,
          pnlPercent: Math.round(pnlPercent * 100) / 100,
          needsRestock,
          restockThreshold,
        };
      })
    );

    const restockAlerts = enriched.filter((i) => i.needsRestock);

    return res.json({
      success: true,
      data: {
        inventory: enriched,
        restockAlerts,
        totalUnrealizedPnL: Math.round(enriched.reduce((sum, i) => sum + i.unrealizedPnL, 0) * 100) / 100,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createInventory(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { terminalId, productType, volumeLitres, averageCost } = req.body;
    if (!terminalId || !productType) {
      return res.status(400).json({ success: false, message: "terminalId and productType are required" });
    }
    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }
    const item = await storage.createInventory({
      userId,
      terminalId,
      productType,
      volumeLitres: volumeLitres || 0,
      averageCost: averageCost || 0,
    });
    return res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createTransaction(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { inventoryId, type, volume, price } = req.body;
    if (!inventoryId || !type || !volume || !price) {
      return res.status(400).json({ success: false, message: "inventoryId, type, volume, and price are required" });
    }
    if (!["BUY", "SELL"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be BUY or SELL" });
    }

    const inventoryItem = await storage.getInventoryItem(inventoryId);
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }
    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (type === "SELL" && volume > inventoryItem.volumeLitres) {
      return res.status(400).json({ success: false, message: "Insufficient volume for sale" });
    }

    const transaction = await storage.createTransaction({
      inventoryId,
      type,
      volume,
      price,
      date: new Date(),
    });

    let newVolume: number;
    let newAvgCost: number;

    if (type === "BUY") {
      const totalCost = inventoryItem.averageCost * inventoryItem.volumeLitres + price * volume;
      newVolume = inventoryItem.volumeLitres + volume;
      newAvgCost = newVolume > 0 ? totalCost / newVolume : 0;
    } else {
      newVolume = inventoryItem.volumeLitres - volume;
      newAvgCost = inventoryItem.averageCost;
    }

    await storage.updateInventory(inventoryId, {
      volumeLitres: Math.round(newVolume * 100) / 100,
      averageCost: Math.round(newAvgCost * 100) / 100,
    });

    return res.status(201).json({ success: true, data: transaction });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTransactions(req: AuthRequest, res: Response) {
  try {
    const inventoryId = req.params.inventoryId as string;
    const userId = req.userId!;

    const inventoryItem = await storage.getInventoryItem(inventoryId);
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }
    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const txns = await storage.getTransactions(inventoryId);
    return res.json({ success: true, data: txns });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
