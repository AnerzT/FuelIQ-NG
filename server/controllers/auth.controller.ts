import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "../storage.js";
import { registerSchema, loginSchema } from "../../shared/schema.js";
import { verifyToken, type AuthRequest } from "../middleware/auth.js";
import { ensureString } from "../utils/params.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || process.env.SESSION_SECRET || "your-refresh-secret";

function isConfiguredAdmin(email: string) {
  const configuredAdmins = (process.env.ADMIN_EMAILS || "umar_anasty@ymail.com")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return configuredAdmins.includes(email.trim().toLowerCase());
}

function generateTokens(user: any) {
  const role = isConfiguredAdmin(user.email) ? "admin" : user.role;
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: "30d" }
  );

  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
      return;
    }

    const { name, password, phone, whatsappPhone } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    const existing = await storage.getUserByEmail(email);
    if (existing) {
      res.status(400).json({ success: false, message: "Email already registered" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await storage.createUser({
      name,
      email,
      password: hashedPassword,
      phone,
      whatsappPhone,
      role: "marketer",
    });

    const { accessToken, refreshToken } = generateTokens(user);

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken,
        refreshToken,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
      return;
    }

    const { password } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    const user = await storage.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken,
        refreshToken,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let userId = ensureString(req.userId);

    if (!userId && token) {
      try {
        userId = verifyToken(token).userId;
      } catch {
        userId = "";
      }
    }

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await storage.getUser(userId);

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (isConfiguredAdmin(user.email) && user.role !== "admin") {
      user.role = "admin";
      await storage.updateUser(user.id, { role: "admin" });
    }

    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function refreshToken(req: AuthRequest, res: Response) {
  try {
    const token = ensureString(req.body.refreshToken);

    if (!token) {
      res.status(400).json({ success: false, message: "Refresh token required" });
      return;
    }

    let payload: any;

    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch {
      res.status(401).json({ success: false, message: "Invalid refresh token" });
      return;
    }

    const user = await storage.getUser(payload.id);

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const tokens = generateTokens(user);
    res.json({ success: true, data: tokens });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
