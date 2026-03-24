import type { Request, Response } from "express";
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
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const inventory = await storage.getInventory(userId);

    const inventoryWithPnL = await Promise.all(
      inventory.map(async (item) => {
        const transactions = await storage.getTransactions(item.id);

        const totalBought = transactions
          .filter(t => t.type === "buy")
          .reduce((sum, t) => sum + t.volume * t.price, 0);

        const totalSold = transactions
          .filter(t => t.type === "sell")
          .reduce((sum, t) => sum + t.volume * t.price, 0);

        const volumeBought = transactions
          .filter(t => t.type === "buy")
          .reduce((sum, t) => sum + t.volume, 0);

        const volumeSold = transactions
          .filter(t => t.type === "sell")
          .reduce((sum, t) => sum + t.volume, 0);

        const currentVolume = volumeBought - volumeSold;
        const averageCost = volumeBought > 0 ? totalBought / volumeBought : 0;

        const realizedPnL = totalSold - (volumeSold * averageCost);

        return {
          ...item,
          currentVolume,
          averageCost,
          currentValue: currentVolume * averageCost,
          realizedPnL,
          unrealizedPnL: 0,
          totalPnL: realizedPnL,
        };
      })
    );

    return res.json({ success: true, data: inventoryWithPnL });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createInventory(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { terminalId, productType, volumeLitres, averageCost } = req.body;

    const terminal = await storage.getTerminal(ensureString(terminalId));
    if (!terminal) return res.status(404).json({ success: false, message: "Terminal not found" });

    const inventory = await storage.createInventory({
      userId,
      terminalId: ensureString(terminalId),
      productType: ensureString(productType, "PMS"),
      volumeLitres: ensureNumber(volumeLitres, 0),
      averageCost: ensureNumber(averageCost, 0),
    });

    return res.status(201).json({ success: true, data: inventory });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createTransaction(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { inventoryId, type, volume, price } = req.body;

    const inventoryItem = await storage.getInventoryItem(ensureString(inventoryId));
    if (!inventoryItem) return res.status(404).json({ success: false, message: "Inventory not found" });

    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const transaction = await storage.createTransaction({
      inventoryId: ensureString(inventoryId),
      type,
      volume: ensureNumber(volume),
      price: ensureNumber(price),
    });

    if (type === "buy") {
      const newVolume = inventoryItem.volumeLitres + ensureNumber(volume);

      const newAvgCost =
        ((inventoryItem.averageCost * inventoryItem.volumeLitres) +
          (ensureNumber(price) * ensureNumber(volume))) / newVolume;

      await storage.updateInventory(inventoryId, {
        volumeLitres: newVolume,
        averageCost: newAvgCost,
      });
    }

    if (type === "sell") {
      const newVolume = inventoryItem.volumeLitres - ensureNumber(volume);

      await storage.updateInventory(inventoryId, {
        volumeLitres: newVolume,
      });
    }

    return res.status(201).json({ success: true, data: transaction });

  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTransactions(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const inventoryId = ensureString(req.params.inventoryId);

    const inventoryItem = await storage.getInventoryItem(inventoryId);
    if (!inventoryItem) return res.status(404).json({ success: false, message: "Inventory not found" });

    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const transactions = await storage.getTransactions(inventoryId);

    return res.json({ success: true, data: transactions });

  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
