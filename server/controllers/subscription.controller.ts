import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { TIER_LIMITS, TIER_PRICES, type SubscriptionTier } from "../../shared/schema.js";
import { ensureString } from "../utils/params.js";

export async function getSubscriptionInfo(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const tier = user.subscriptionTier as SubscriptionTier;
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const priceInfo = TIER_PRICES[tier] || TIER_PRICES.free;

    return res.json({
      success: true,
      data: {
        tier: user.subscriptionTier,
        startDate: user.subscriptionStartDate,
        endDate: user.subscriptionEndDate,
        limits,
        priceInfo,
        usage: {
          forecastsUsedToday: user.forecastsUsedToday || 0,
          smsAlertsUsedThisWeek: user.smsAlertsUsedThisWeek || 0,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTierInfo(req: AuthRequest, res: Response) {
  try {
    const tierInfo = Object.fromEntries(
      Object.entries(TIER_LIMITS).map(([key, value]) => [key, { ...value, priceInfo: TIER_PRICES[key as SubscriptionTier] }])
    );
    return res.json({
      success: true,
      data: tierInfo,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateSubscription(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { subscriptionTier, assignedTerminalId } = req.body;

    const updateData: any = {};
    if (subscriptionTier) updateData.subscriptionTier = subscriptionTier;
    if (assignedTerminalId) updateData.assignedTerminalId = assignedTerminalId;

    const updatedUser = await storage.updateUser(userId, updateData);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      message: "Subscription updated successfully",
      data: {
        tier: updatedUser.subscriptionTier,
        assignedTerminalId: updatedUser.assignedTerminalId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminGetAllSubscriptions(req: AuthRequest, res: Response) {
  try {
    const users = await storage.getAllUsers();
    
    const subscriptions = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      tier: user.subscriptionTier,
      startDate: user.subscriptionStartDate,
      endDate: user.subscriptionEndDate,
      assignedTerminalId: user.assignedTerminalId,
      usage: {
        forecastsUsedToday: user.forecastsUsedToday || 0,
        smsAlertsUsedThisWeek: user.smsAlertsUsedThisWeek || 0,
      },
    }));

    return res.json({
      success: true,
      data: subscriptions,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminUpdateSubscription(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.params.userId);
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const { subscriptionTier, assignedTerminalId } = req.body;

    const updateData: any = {};
    if (subscriptionTier) updateData.subscriptionTier = subscriptionTier;
    if (assignedTerminalId) updateData.assignedTerminalId = assignedTerminalId;

    const updatedUser = await storage.updateUser(userId, updateData);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      message: "User subscription updated successfully",
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        tier: updatedUser.subscriptionTier,
        assignedTerminalId: updatedUser.assignedTerminalId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
