import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "../storage.js";
import { registerSchema, loginSchema } from "../../shared/schema.js";
import { ADMIN_EMAIL } from "../../shared/admin.js";
import { verifyToken, type AuthRequest } from "../middleware/auth.js";
import { ensureString } from "../utils/params.js";
import { customerIdentity, type VerificationChannel } from "../services/customer-identity.service.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || process.env.SESSION_SECRET || "your-refresh-secret";

function isAdminEmail(email: string) {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

function effectiveRole(user: { email: string; role: string }) {
  if (isAdminEmail(user.email)) return "admin";
  return user.role === "admin" ? "marketer" : user.role;
}

function publicUser<T extends { password: string }>(user: T): Omit<T, "password"> {
  const { password, ...safeUser } = user;
  void password;
  return safeUser;
}

function generateTokens(user: any) {
  const role = effectiveRole(user);
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

    const { name, password, phone, whatsappPhone, verificationChannel } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    const existing = await storage.getUserByEmail(email);
    if (existing) {
      res.status(400).json({ success: false, message: "Email already registered" });
      return;
    }
    if (await customerIdentity.findUserByContact(phone)) {
      res.status(400).json({ success: false, message: "Phone number already registered" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await storage.createUser({
      name,
      email,
      password: hashedPassword,
      phone,
      whatsappPhone,
      role: isAdminEmail(email) ? "admin" : "marketer",
    });
    const profile = await customerIdentity.ensureProfile(user.id);
    let verificationSent = false;
    try {
      await customerIdentity.issueCode(
        user.id,
        verificationChannel,
        "registration",
        verificationChannel === "email" ? email : phone,
      );
      verificationSent = true;
    } catch (error) {
      console.error("Could not send registration verification code:", error);
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.status(201).json({
      success: true,
      data: {
        user: { ...publicUser(user), role: effectiveRole(user) },
        accessToken,
        refreshToken,
        profile,
        verificationSent,
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
    const contact = parsed.data.email.trim();

    const user = await storage.getUserByEmail(contact.toLowerCase()) || await customerIdentity.findUserByContact(contact);
    if (!user || user.deletedAt) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const role = effectiveRole(user);
    if (user.role !== role) await storage.updateUser(user.id, { role });
    const profile = await customerIdentity.ensureProfile(user.id);
    await customerIdentity.updateProfile(user.id, { lastLoginAt: new Date() });
    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      success: true,
      data: {
        user: { ...publicUser(user), role, profile: { ...profile, lastLoginAt: new Date() } },
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

    if (!user || user.deletedAt) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const role = effectiveRole(user);
    if (user.role !== role) {
      user.role = role;
      await storage.updateUser(user.id, { role });
    }

    const profile = await customerIdentity.ensureProfile(user.id);
    res.json({ success: true, data: { ...publicUser(user), profile } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function sendVerificationCode(req: AuthRequest, res: Response) {
    try {
      const channel = req.body?.channel as VerificationChannel;
      if (channel !== "email" && channel !== "sms") {
        res.status(400).json({ success: false, message: "Choose email or SMS verification." });
        return;
      }
      const userId = ensureString(req.userId);
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ success: false, message: "Account not found." });
        return;
      }
      const target = channel === "email" ? user.email : user.phone;
      if (!target) {
        res.status(400).json({ success: false, message: `No ${channel === "sms" ? "phone number" : "email"} is configured for this account.` });
        return;
      }
      await customerIdentity.issueCode(userId, channel, "registration", target);
      res.json({ success: true, data: { expiresInSeconds: 600 } });
    } catch (error) {
      console.error("Could not send verification code:", error);
      res.status(503).json({ success: false, message: "Verification delivery is unavailable. Check the server email/SMS configuration." });
    }
  }

export async function verifyCustomerCode(req: AuthRequest, res: Response) {
    try {
      const code = ensureString(req.body?.code);
      const userId = ensureString(req.userId);
      if (!/^\d{6}$/.test(code)) {
        res.status(400).json({ success: false, message: "Enter the six-digit verification code." });
        return;
      }
      const verified = await customerIdentity.verifyCode(userId, "registration", code);
      if (!verified) {
        res.status(400).json({ success: false, message: "The code is invalid, expired or has reached its attempt limit." });
        return;
      }
      const profile = await customerIdentity.getProfile(userId);
      res.json({ success: true, data: { profile } });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Verification failed." });
    }
  }

export async function requestPasswordRecovery(req: Request, res: Response) {
    const contact = ensureString(req.body?.contact);
    const channel = req.body?.channel as VerificationChannel;
    if (!contact || (channel !== "email" && channel !== "sms")) {
      res.status(400).json({ success: false, message: "Contact and a valid verification channel are required." });
      return;
    }
    try {
      const user = await customerIdentity.findUserByContact(contact);
      if (user) {
        const target = channel === "email" ? user.email : user.phone;
        if (target) await customerIdentity.issueCode(user.id, channel, "password_reset", target);
      }
      res.json({ success: true, message: "If the account exists, a recovery code has been sent." });
    } catch (error) {
      console.error("Could not send password recovery code:", error);
      res.status(503).json({ success: false, message: "Recovery delivery is unavailable. Check the server email/SMS configuration." });
    }
  }

export async function resetPassword(req: Request, res: Response) {
    const contact = ensureString(req.body?.contact);
    const code = ensureString(req.body?.code);
    const password = ensureString(req.body?.password);
    if (!contact || !/^\d{6}$/.test(code) || password.length < 8) {
      res.status(400).json({ success: false, message: "Enter your contact, a six-digit code and a password of at least eight characters." });
      return;
    }
    try {
      const user = await customerIdentity.findUserByContact(contact);
      if (!user || !(await customerIdentity.verifyCode(user.id, "password_reset", code))) {
        res.status(400).json({ success: false, message: "The recovery code is invalid or expired." });
        return;
      }
      await storage.updateUser(user.id, { password: await bcrypt.hash(password, 10) });
      res.json({ success: true, message: "Password updated. You can now sign in." });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Password reset failed." });
    }
  }

export async function updateCustomerProfile(req: AuthRequest, res: Response) {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (name.length < 2 || name.length > 100) {
      res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters." });
      return;
    }
    try {
      const user = await storage.updateUser(ensureString(req.userId), { name });
      if (!user) {
        res.status(404).json({ success: false, message: "Account not found." });
        return;
      }
      res.json({ success: true, data: publicUser(user) });
    } catch (error) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Profile update failed." });
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
