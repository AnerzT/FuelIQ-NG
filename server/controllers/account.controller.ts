import { randomUUID } from "node:crypto";
import type { Response } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { customerIdentity } from "../services/customer-identity.service.js";
import { ensureString } from "../utils/params.js";

const DELETION_EMAIL_DOMAIN = "deleted.invalid";

function respondError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Account deletion failed.";
  if (message.includes("last active administrator")) {
    return res.status(409).json({ success: false, message });
  }
  console.error("Account deletion failed:", error);
  return res.status(500).json({ success: false, message: "Account deletion could not be completed. Contact support if the issue persists." });
}

export async function deleteOwnAccount(req: AuthRequest, res: Response) {
  const userId = ensureString(req.userId);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });
  if (!password) return res.status(400).json({ success: false, message: "Enter your current password to confirm account deletion." });

  try {
    const user = await storage.getUser(userId);
    if (!user || user.deletedAt) return res.status(404).json({ success: false, message: "Account not found." });
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }
    storage.assertAccountCanBeDeleted(userId);
    const anonymizedPassword = await bcrypt.hash(randomUUID(), 10);
    const anonymizedEmail = `deleted+${userId}@${DELETION_EMAIL_DOMAIN}`;
    await customerIdentity.anonymizeAccount(userId, anonymizedEmail, anonymizedPassword);
    const deleted = await storage.deleteAccount(userId, userId, "self_service", anonymizedPassword);
    if (!deleted) return res.status(404).json({ success: false, message: "Account not found." });
    return res.status(204).end();
  } catch (error) {
    return respondError(res, error);
  }
}

export async function adminListAccounts(_req: AuthRequest, res: Response) {
  try {
    return res.json({ success: true, data: await storage.getAccountDirectory() });
  } catch (error) {
    return respondError(res, error);
  }
}

export async function adminDeleteAccount(req: AuthRequest, res: Response) {
  const actorUserId = ensureString(req.userId);
  const targetUserId = ensureString(req.params.userId);
  const confirmedEmail = typeof req.body?.confirmEmail === "string" ? req.body.confirmEmail.trim().toLowerCase() : "";
  if (!actorUserId || !targetUserId) return res.status(400).json({ success: false, message: "Account ID is required." });

  try {
    const target = await storage.getUser(targetUserId);
    if (!target || target.deletedAt) return res.status(404).json({ success: false, message: "Active account not found." });
    if (!confirmedEmail || confirmedEmail !== target.email.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Enter the account email exactly to confirm deletion." });
    }
    storage.assertAccountCanBeDeleted(targetUserId);
    const anonymizedPassword = await bcrypt.hash(randomUUID(), 10);
    const anonymizedEmail = `deleted+${targetUserId}@${DELETION_EMAIL_DOMAIN}`;
    await customerIdentity.anonymizeAccount(targetUserId, anonymizedEmail, anonymizedPassword);
    const deleted = await storage.deleteAccount(targetUserId, actorUserId, "admin", anonymizedPassword);
    if (!deleted) return res.status(404).json({ success: false, message: "Active account not found." });
    return res.json({ success: true, message: "Account deleted and personal account details anonymized." });
  } catch (error) {
    return respondError(res, error);
  }
}
