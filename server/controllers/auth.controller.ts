import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage.js";
import { loginSchema, registerSchema } from "../../shared/schema.js";
import { generateToken, type AuthRequest } from "../middleware/auth.js";

const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number }>();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

function checkLockout(key: string): { locked: boolean; remainingMs: number } {
  const entry = loginAttempts.get(key);
  if (!entry) return { locked: false, remainingMs: 0 };
  if (entry.lockedUntil > Date.now()) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  if (Date.now() - entry.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.delete(key);
    return { locked: false, remainingMs: 0 };
  }
  return { locked: false, remainingMs: 0 };
}

function recordFailedAttempt(key: string): void {
  const entry = loginAttempts.get(key) || { count: 0, lastAttempt: 0, lockedUntil: 0 };
  entry.count += 1;
  entry.lastAttempt = Date.now();
  if (entry.count >= LOCKOUT_THRESHOLD) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  loginAttempts.set(key, entry);
}

function clearAttempts(key: string): void {
  loginAttempts.delete(key);
}

function safeUserData(user: any) {
  return {
    id: user.id,
    name: user.name ?? user.username,
    email: user.email,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    createdAt: user.createdAt,
  };
}

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
    }

    const { name, email, password, username } = parsed.data as any;
    const resolvedEmail = email?.toLowerCase().trim();
    const resolvedUsername = username ?? resolvedEmail ?? name;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (resolvedEmail) {
      const existing = await storage.getUserByEmail(resolvedEmail);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Email already registered",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await storage.createUser({
      username: resolvedUsername,
      email: resolvedEmail,
      password: hashedPassword,
      role: "marketer",
    } as any);

    const token = generateToken(String(user.id));

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: { user: safeUserData(user), token },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, username, password } = req.body;
    const resolvedEmail = (email || username || "").toLowerCase().trim();

    const lockoutKey = resolvedEmail;
    const lockout = checkLockout(lockoutKey);
    if (lockout.locked) {
      const minutes = Math.ceil(lockout.remainingMs / 60000);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked. Try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
      });
    }

    const user = await storage.getUserByEmail(resolvedEmail);
    if (!user) {
      recordFailedAttempt(lockoutKey);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      recordFailedAttempt(lockoutKey);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    clearAttempts(lockoutKey);
    const token = generateToken(String(user.id));

    return res.json({
      success: true,
      message: "Login successful",
      data: { user: safeUserData(user), token },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function refreshToken(req: AuthRequest, res: Response) {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const token = generateToken(String(user.id));

    return res.json({
      success: true,
      message: "Token refreshed successfully",
      data: { user: safeUserData(user), token },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      data: { user: safeUserData(user) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
