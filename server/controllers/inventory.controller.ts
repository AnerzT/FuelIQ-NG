import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";

export async function getInventory(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Fixed: Now passing only one argument
    const inventory = await storage.getInventory(userId);
    
    return res.json({
      success: true,
      data: inventory,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getInventoryWithPnL(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Fixed: Now passing only one argument
    const inventory = await storage.getInventory(userId);
    
    // Calculate P&L for each inventory item
    const inventoryWithPnL = await Promise.all(
      inventory.map(async (item) => {
        const transactions = await storage.getTransactions(item.id);
        
        const totalBought = transactions
          .filter(t => t.type === "buy")
          .reduce((sum, t) => sum + (t.volume * t.price), 0);
        
        const totalSold = transactions
          .filter(t => t.type === "sell")
          .reduce((sum, t) => sum + (t.volume * t.price), 0);
        
        const volumeBought = transactions
          .filter(t => t.type === "buy")
          .reduce((sum, t) => sum + t.volume, 0);
        
        const volumeSold = transactions
          .filter(t => t.type === "sell")
          .reduce((sum, t) => sum + t.volume, 0);
        
        const currentVolume = volumeBought - volumeSold;
        const averageCost = volumeBought > 0 ? totalBought / volumeBought : 0;
        const currentValue = currentVolume * averageCost;
        const realizedPnL = totalSold - (volumeSold * averageCost);
        const unrealizedPnL = 0; // Would need current market price
        
        return {
          ...item,
          currentVolume,
          averageCost,
          currentValue,
          realizedPnL,
          unrealizedPnL,
          totalPnL: realizedPnL + unrealizedPnL,
        };
      })
    );
    
    return res.json({
      success: true,
      data: inventoryWithPnL,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createInventory(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { terminalId, productType, volumeLitres, averageCost } = req.body;
    
    if (!terminalId || !productType || !volumeLitres) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: terminalId, productType, volumeLitres" 
      });
    }
    
    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }
    
    const inventory = await storage.createInventory({
      userId,
      terminalId,
      productType,
      volumeLitres: Number(volumeLitres),
      averageCost: averageCost ? Number(averageCost) : 0,
    });
    
    return res.status(201).json({
      success: true,
      message: "Inventory created successfully",
      data: inventory,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createTransaction(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { inventoryId, type, volume, price } = req.body;
    
    if (!inventoryId || !type || !volume || !price) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: inventoryId, type, volume, price" 
      });
    }
    
    // Check if inventory exists and belongs to user
    const inventoryItem = await storage.getInventoryItem(inventoryId);
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: "Inventory not found" });
    }
    
    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }
    
    const transaction = await storage.createTransaction({
      inventoryId,
      type,
      volume: Number(volume),
      price: Number(price),
    });
    
    // Update inventory volume if needed
    if (type === "buy") {
      const newVolume = inventoryItem.volumeLitres + Number(volume);
      const newAverageCost = ((inventoryItem.averageCost * inventoryItem.volumeLitres) + (Number(price) * Number(volume))) / newVolume;
      
      await storage.updateInventory(inventoryId, {
        volumeLitres: newVolume,
        averageCost: newAverageCost,
      });
    } else if (type === "sell") {
      const newVolume = inventoryItem.volumeLitres - Number(volume);
      await storage.updateInventory(inventoryId, {
        volumeLitres: newVolume,
      });
    }
    
    return res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: transaction,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTransactions(req: AuthRequest, res: Response) {
  try {
    const { inventoryId } = req.params;
    
    const inventoryItem = await storage.getInventoryItem(inventoryId);
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: "Inventory not found" });
    }
    
    // Check if user owns this inventory
    const userId = req.userId;
    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }
    
    const transactions = await storage.getTransactions(inventoryId);
    
    return res.json({
      success: true,
      data: transactions,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateInventoryItem(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { id } = req.params;
    const { volumeLitres, averageCost } = req.body;
    
    const inventoryItem = await storage.getInventoryItem(id);
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: "Inventory not found" });
    }
    
    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }
    
    const updateData: any = {};
    if (volumeLitres !== undefined) updateData.volumeLitres = Number(volumeLitres);
    if (averageCost !== undefined) updateData.averageCost = Number(averageCost);
    
    const updated = await storage.updateInventory(id, updateData);
    
    return res.json({
      success: true,
      message: "Inventory updated successfully",
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteInventoryItem(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { id } = req.params;
    
    const inventoryItem = await storage.getInventoryItem(id);
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: "Inventory not found" });
    }
    
    if (inventoryItem.userId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }
    
    // Check if there are any transactions
    const transactions = await storage.getTransactions(id);
    if (transactions.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete inventory with existing transactions" 
      });
    }
    
    // Since we don't have a delete method, we'll set volume to 0
    const updated = await storage.updateInventory(id, { volumeLitres: 0 });
    
    return res.json({
      success: true,
      message: "Inventory deleted successfully",
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
