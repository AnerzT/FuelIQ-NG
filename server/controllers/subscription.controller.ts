import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { storage } from "../storage.js";
import { TIER_LIMITS, updateSubscriptionSchema, type SubscriptionTier } from "../../shared/schema.js";

export async function getSubscriptionInfo(req: AuthRequest, res: Response) {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const tier = (user.subscriptionTier || "free") as SubscriptionTier;
    const limits = TIER_LIMITS[tier];

    return res.json({
      success: true,
      data: {
        tier,
        limits,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        usage: {
          forecastsUsedToday: user.forecastsUsedToday,
          forecastDayResetDate: user.forecastDayResetDate,
          smsAlertsUsedThisWeek: user.smsAlertsUsedThisWeek,
          smsWeekResetDate: user.smsWeekResetDate,
        },
        assignedTerminalId: user.assignedTerminalId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTierInfo(_req: AuthRequest, res: Response) {
  return res.json({
    success: true,
    data: TIER_LIMITS,
  });
}

export async function updateSubscription(req: AuthRequest, res: Response) {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can change subscription tiers. Contact support to upgrade.",
      });
    }

    const parsed = updateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid input" });
    }

    const targetUserId = req.body.userId || req.userId!;

    const updated = await storage.updateUserSubscription(targetUserId, {
      tier: parsed.data.tier,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : new Date(),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      assignedTerminalId: parsed.data.assignedTerminalId,
    });

    if (!updated) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      message: `Subscription updated to ${parsed.data.tier}`,
      data: {
        tier: updated.subscriptionTier,
        subscriptionStartDate: updated.subscriptionStartDate,
        subscriptionEndDate: updated.subscriptionEndDate,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminGetAllSubscriptions(req: AuthRequest, res: Response) {
  try {
    const allUsers = await storage.getAllUsers();
    const subscriptions = allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      tier: u.subscriptionTier,
      subscriptionStartDate: u.subscriptionStartDate,
      subscriptionEndDate: u.subscriptionEndDate,
      smsAlertsUsedThisWeek: u.smsAlertsUsedThisWeek,
      forecastsUsedToday: u.forecastsUsedToday,
      assignedTerminalId: u.assignedTerminalId,
    }));

    return res.json({ success: true, data: subscriptions });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminUpdateSubscription(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.params;
    const parsed = updateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid input" });
    }

    const updated = await storage.updateUserSubscription(userId, {
      tier: parsed.data.tier,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : new Date(),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      assignedTerminalId: parsed.data.assignedTerminalId,
    });

    if (!updated) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      message: `User subscription updated to ${parsed.data.tier}`,
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        tier: updated.subscriptionTier,
        subscriptionStartDate: updated.subscriptionStartDate,
        subscriptionEndDate: updated.subscriptionEndDate,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
