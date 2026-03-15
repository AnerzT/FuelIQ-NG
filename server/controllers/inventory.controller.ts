import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";

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
        const itemAverageCost = (item as any).averageCost ?? 0;
        const itemVolumeLitres = (item as any).volumeLitres ?? (item as any).quantityLitres ?? 0;
        const currentPrice = forecast
          ? (forecast.expectedMin + forecast.expectedMax) / 2
          : itemAverageCost;
        const unrealizedPnL = (currentPrice - itemAverageCost) * itemVolumeLitres;
        const pnlPercent = itemAverageCost > 0
          ? ((currentPrice - itemAverageCost) / itemAverageCost) * 100
          : 0;

        const restockThreshold = 5000;
        const needsRestock = itemVolumeLitres < restockThreshold;

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
    const terminal = await storage.getTerminal(String(terminalId));
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }
    const item = await storage.createInventory({
      userId: String(userId),
      terminalId: String(terminalId),
      productType,
      volumeLitres: Number(volumeLitres) || 0,
      averageCost: Number(averageCost) || 0,
    } as any);
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

    const inventoryItem = await storage.getInventoryItem(String(inventoryId));
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }
    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const itemVolumeLitres = (inventoryItem as any).volumeLitres ?? (inventoryItem as any).quantityLitres ?? 0;
    const itemAverageCost = (inventoryItem as any).averageCost ?? 0;

    if (type === "SELL" && Number(volume) > itemVolumeLitres) {
      return res.status(400).json({ success: false, message: "Insufficient volume for sale" });
    }

    const transaction = await storage.createTransaction({
      userId: Number(userId),
      inventoryId: String(inventoryId),
      type,
      amount: Number(price) * Number(volume),
      currency: "NGN",
      status: "completed",
      reference: `${type}-${Date.now()}`,
      date: new Date(),
    } as any);

    let newVolume: number;
    let newAvgCost: number;

    if (type === "BUY") {
      const totalCost = itemAverageCost * itemVolumeLitres + Number(price) * Number(volume);
      newVolume = itemVolumeLitres + Number(volume);
      newAvgCost = newVolume > 0 ? totalCost / newVolume : 0;
    } else {
      newVolume = itemVolumeLitres - Number(volume);
      newAvgCost = itemAverageCost;
    }

    await storage.updateInventory(String(inventoryId), {
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

    const inventoryItem = await storage.getInventoryItem(String(inventoryId));
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: "Inventory item not found" });
    }
    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const txns = await storage.getTransactions(String(inventoryId));
    return res.json({ success: true, data: txns });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
