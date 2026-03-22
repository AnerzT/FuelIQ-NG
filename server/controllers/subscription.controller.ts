import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { TIER_LIMITS, type SubscriptionTier } from "../../shared/schema.js";
import { ensureString, ensureNumber } from "../utils/params.js";

// ... existing code, but replace direct req.params accesses with ensureString
export async function adminUpdateSubscription(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.params.userId);
    const { subscriptionTier, assignedTerminalId } = req.body;
    const updateData: any = {};
    if (subscriptionTier) updateData.subscriptionTier = subscriptionTier;
    if (assignedTerminalId) updateData.assignedTerminalId = assignedTerminalId;
    const updated = await storage.updateUser(userId, updateData);
    // ...
  }
}
