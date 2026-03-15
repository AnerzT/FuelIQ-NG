import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";
import { TIER_LIMITS, type SubscriptionTier } from "../../shared/schema.js";
import { storage } from "../storage.js";

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, basic: 1, pro: 2, elite: 3, enterprise: 4 };

function getTier(req: AuthRequest): SubscriptionTier {
  return req.subscriptionTier || "free";
}

function getLimits(tier: SubscriptionTier) {
  return TIER_LIMITS[tier];
}

export function requireTier(minTier: SubscriptionTier) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userTier = getTier(req);
    if (TIER_RANK[userTier] < TIER_RANK[minTier]) {
      return res.status(403).json({
        success: false,
        message: `This feature requires a ${TIER_LIMITS[minTier].label} subscription or higher`,
        requiredTier: minTier,
        currentTier: userTier,
      });
    }
    next();
  };
}

export function requireTerminalAccess() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const tier = getTier(req);
    if (tier !== "free") return next();

    const terminalId = req.params.terminalId || req.params.id || req.body?.terminalId;
    if (!terminalId) return next();

    const user = await storage.getUser(req.userId!);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    if (user.assignedTerminalId && user.assignedTerminalId !== terminalId) {
      return res.status(403).json({
        success: false,
        message: "Free tier is limited to 1 terminal. Upgrade to Pro for all terminals.",
        requiredTier: "pro",
        currentTier: "free",
        assignedTerminalId: user.assignedTerminalId,
      });
    }

    if (!user.assignedTerminalId) {
      await storage.updateUserSubscription(req.userId!, { assignedTerminalId: terminalId });
    }

    next();
  };
}

export function requireForecastQuota() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const tier = getTier(req);
    const limits = getLimits(tier);
    if (limits.forecastsPerDay === Infinity) return next();

    const user = await storage.getUser(req.userId!);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    const now = new Date();
    const resetDate = user.forecastDayResetDate ? new Date(user.forecastDayResetDate) : null;
    const needsReset = !resetDate || now.toDateString() !== resetDate.toDateString();

    if (needsReset) {
      await storage.resetForecastCount(req.userId!);
      return next();
    }

    if (user.forecastsUsedToday >= limits.forecastsPerDay) {
      return res.status(429).json({
        success: false,
        message: `Free tier is limited to ${limits.forecastsPerDay} forecast per day. Upgrade to Pro for unlimited.`,
        requiredTier: "pro",
        currentTier: tier,
      });
    }

    next();
  };
}

export function requireSmsQuota() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const tier = getTier(req);
    const limits = getLimits(tier);
    if (limits.smsAlertsPerWeek === Infinity) return next();
    if (limits.smsAlertsPerWeek === 0) {
      return res.status(403).json({
        success: false,
        message: "SMS alerts require a Pro subscription or higher",
        requiredTier: "pro",
        currentTier: tier,
      });
    }

    const user = await storage.getUser(req.userId!);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    const now = new Date();
    const resetDate = user.smsWeekResetDate ? new Date(user.smsWeekResetDate) : null;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const needsReset = !resetDate || now.getTime() - resetDate.getTime() > weekMs;

    if (needsReset) {
      await storage.resetSmsCount(req.userId!);
      return next();
    }

    if (user.smsAlertsUsedThisWeek >= limits.smsAlertsPerWeek) {
      return res.status(429).json({
        success: false,
        message: `Pro tier is limited to ${limits.smsAlertsPerWeek} SMS alerts per week. Upgrade to Elite for unlimited.`,
        requiredTier: "elite",
        currentTier: tier,
      });
    }

    next();
  };
}

export function withDataDelay() {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const tier = getTier(req);
    const limits = getLimits(tier);
    if (limits.dataDelay > 0) {
      (req as any).dataDelayHours = limits.dataDelay;
    }
    next();
  };
}
