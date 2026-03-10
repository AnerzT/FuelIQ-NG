import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key" || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET or SESSION_SECRET environment variable is required");
}

import type { SubscriptionTier } from "../../shared/schema.js";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  subscriptionTier?: SubscriptionTier;
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userRole || req.userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}

export function attachUserRole(storageInstance: { getUser: (id: string) => Promise<{ role: string; subscriptionTier: string } | undefined> }) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.userId) {
      try {
        const user = await storageInstance.getUser(req.userId);
        if (user) {
          req.userRole = user.role;
          req.subscriptionTier = (user.subscriptionTier || "free") as SubscriptionTier;
        }
      } catch {}
    }
    next();
  };
}
