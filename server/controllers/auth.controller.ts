import type { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "../storage.js";
import { registerSchema, loginSchema } from "../../shared/schema.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString } from "../utils/params.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";

function generateTokens(user: any) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
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
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
    }

    const { name, email, password, phone, whatsappPhone } = parsed.data;

    const existing = await storage.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already registered" });
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

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken,
        refreshToken,
      },
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
    }

    const { email, password } = parsed.data;
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    return res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken,
        refreshToken,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        whatsappPhone: user.whatsappPhone,
        subscriptionTier: user.subscriptionTier,
        assignedTerminalId: user.assignedTerminalId,
      },
    });
  } catch (err: any) {
    console.error("GetMe error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function refreshToken(req: AuthRequest, res: Response) {
  try {
    const refreshToken = ensureString(req.body.refreshToken);
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token required" });
    }

    let payload: any;
    try {
      payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }

    const user = await storage.getUser(payload.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    return res.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (err: any) {
    console.error("Refresh error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
