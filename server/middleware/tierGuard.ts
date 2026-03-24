import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";
import { TIER_LIMITS, type SubscriptionTier } from "../../shared/schema.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).userId = decoded.id;
    (req as any).userRole = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
}

export function attachUserRole(storage: any) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      if (userId) {
        const user = await storage.getUser(userId);
        (req as any).user = user;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
    return;
  }
  next();
}

export function requireTier(requiredTier: SubscriptionTier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const userTier = user.subscriptionTier as SubscriptionTier;
      const tierLevels: Record<SubscriptionTier, number> = {
        free: 0,
        basic: 1,
        pro: 2,
        elite: 3,
        enterprise: 4,
      };
      if (tierLevels[userTier] < tierLevels[requiredTier]) {
        res.status(403).json({ success: false, message: "Upgrade required" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireTerminalAccess() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const terminalId = req.params.terminalId;
      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      // Allow if user is admin or has no assigned terminal, or matches assigned terminal
      if (user.role === "admin" || !user.assignedTerminalId || user.assignedTerminalId === terminalId) {
        next();
      } else {
        res.status(403).json({ success: false, message: "Forbidden: Access to this terminal denied" });
      }
    } catch (error) {
      next(error);
    }
  };
}

export function requireForecastQuota() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const tier = user.subscriptionTier as SubscriptionTier;
      const dailyLimit = TIER_LIMITS[tier]?.forecastsPerDay || 3;
      const usedToday = user.forecastsUsedToday || 0;
      if (usedToday >= dailyLimit) {
        res.status(429).json({ success: false, message: "Daily forecast limit reached" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function withDataDelay() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const tier = user?.subscriptionTier as SubscriptionTier || "free";
      const delay = TIER_LIMITS[tier]?.dataDelay || 60;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
