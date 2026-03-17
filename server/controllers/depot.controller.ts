import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";

export async function getDepots(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.query;
    
    const depots = await storage.getDepots(terminalId as string | undefined);
    
    return res.json({
      success: true,
      data: depots,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepot(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    
    const depot = await storage.getDepot(id);
    if (!depot) {
      return res.status(404).json({ success: false, message: "Depot not found" });
    }
    
    return res.json({
      success: true,
      data: depot,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createDepot(req: AuthRequest, res: Response) {
  try {
    const { name, terminalId, owner, active } = req.body;
    
    if (!name || !terminalId || !owner) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: name, terminalId, owner" 
      });
    }
    
    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }
    
    const depot = await storage.createDepot({
      name,
      terminalId,
      owner,
      active: active !== undefined ? active : true,
    });
    
    return res.status(201).json({
      success: true,
      message: "Depot created successfully",
      data: depot,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepotPrices(req: AuthRequest, res: Response) {
  try {
    const { depotId, productType } = req.query;
    
    const prices = await storage.getDepotPrices(
      depotId as string | undefined,
      productType as string | undefined
    );
    
    return res.json({
      success: true,
      data: prices,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createDepotPrice(req: AuthRequest, res: Response) {
  try {
    const { depotId, productType, price } = req.body;
    
    if (!depotId || !productType || !price) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: depotId, productType, price" 
      });
    }
    
    const depot = await storage.getDepot(depotId);
    if (!depot) {
      return res.status(404).json({ success: false, message: "Depot not found" });
    }
    
    const depotPrice = await storage.createDepotPrice({
      depotId,
      productType,
      price,
      updatedAt: new Date(),
    });
    
    return res.status(201).json({
      success: true,
      message: "Depot price created successfully",
      data: depotPrice,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateDepotPrice(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { price } = req.body;
    
    if (!price) {
      return res.status(400).json({ 
        success: false, 
        message: "Price is required" 
      });
    }
    
    const updatedPrice = await storage.updateDepotPrice(id, price);
    if (!updatedPrice) {
      return res.status(404).json({ success: false, message: "Depot price not found" });
    }
    
    return res.json({
      success: true,
      message: "Depot price updated successfully",
      data: updatedPrice,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepotPriceHistory(req: AuthRequest, res: Response) {
  try {
    const { depotId } = req.params;
    const { days = 30 } = req.query;
    
    const depot = await storage.getDepot(depotId);
    if (!depot) {
      return res.status(404).json({ success: false, message: "Depot not found" });
    }
    
    const prices = await storage.getDepotPrices(depotId);
    
    // Sort by date and limit to requested days
    const sortedPrices = prices
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, Number(days));
    
    return res.json({
      success: true,
      data: sortedPrices,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDepotPriceByProduct(req: AuthRequest, res: Response) {
  try {
    const { depotId, productType } = req.params;
    
    const depot = await storage.getDepot(depotId);
    if (!depot) {
      return res.status(404).json({ success: false, message: "Depot not found" });
    }
    
    const prices = await storage.getDepotPrices(depotId, productType);
    const latestPrice = prices.length > 0 ? prices[0] : null;
    
    if (!latestPrice) {
      return res.status(404).json({ 
        success: false, 
        message: `No price found for product ${productType} at this depot` 
      });
    }
    
    return res.json({
      success: true,
      data: latestPrice,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
