import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { sendSms } from "../services/smsService.js";
import { sendWhatsAppMessage } from "../services/whatsappService.js";
import { ensureString, ensureNumber } from "../utils/params.js";

export async function getNotificationPrefs(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      data: {
        phone: user.phone,
        whatsappPhone: user.whatsappPhone,
        notificationPrefs: user.notificationPrefs || {
          smsEnabled: false,
          whatsappEnabled: false,
          forecastAlerts: true,
          priceAlerts: true,
          refineryAlerts: true,
          morningDigest: false,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateNotificationPrefs(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { phone, whatsappPhone, notificationPrefs } = req.body;
    const updateData: any = {};
    if (phone !== undefined) updateData.phone = phone;
    if (whatsappPhone !== undefined) updateData.whatsappPhone = whatsappPhone;
    if (notificationPrefs !== undefined) updateData.notificationPrefs = notificationPrefs;

    const updatedUser = await storage.updateUser(userId, updateData);
    if (!updatedUser) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      message: "Notification preferences updated",
      data: {
        phone: updatedUser.phone,
        whatsappPhone: updatedUser.whatsappPhone,
        notificationPrefs: updatedUser.notificationPrefs,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getNotificationLogs(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const limit = ensureNumber(req.query.limit, 50);
    const logs = await storage.getNotificationLogs(userId, limit);
    return res.json({ success: true, data: logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getNotificationStatus(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const prefs = user.notificationPrefs as any || {};
    return res.json({
      success: true,
      data: {
        smsEnabled: prefs.smsEnabled || false,
        whatsappEnabled: prefs.whatsappEnabled || false,
        forecastAlerts: prefs.forecastAlerts || false,
        priceAlerts: prefs.priceAlerts || false,
        refineryAlerts: prefs.refineryAlerts || false,
        morningDigest: prefs.morningDigest || false,
        phone: user.phone,
        whatsappPhone: user.whatsappPhone,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerMorningDigest(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") return res.status(403).json({ success: false, message: "Admin access required" });

    const subscribedUsers = await storage.getSubscribedUsers();
    const results = { total: subscribedUsers.length, sms: 0, whatsapp: 0, failed: 0 };
    const message = generateMorningDigestMessage();

    for (const u of subscribedUsers) {
      const prefs = u.notificationPrefs as any || {};
      try {
        if (prefs.smsEnabled && u.phone) {
          await sendSms(u.phone, message);
          await storage.createNotificationLog(u.id, "sms", message, "morning_digest");
          results.sms++;
        }
        if (prefs.whatsappEnabled && u.whatsappPhone) {
          await sendWhatsAppMessage(u.whatsappPhone, message);
          await storage.createNotificationLog(u.id, "whatsapp", message, "morning_digest");
          results.whatsapp++;
        }
      } catch (error) {
        results.failed++;
        console.error(`Failed to send digest to user ${u.id}:`, error);
      }
    }

    return res.json({ success: true, message: "Morning digest triggered", data: results });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerTestNotification(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { channel } = req.body;
    const prefs = user.notificationPrefs as any || {};
    const message = "This is a test notification from FuelIQ-NG.";
    const results: any = {};

    if (channel === "sms" || !channel) {
      if (prefs.smsEnabled && user.phone) {
        try {
          await sendSms(user.phone, message);
          await storage.createNotificationLog(user.id, "sms", message, "test");
          results.sms = "sent";
        } catch (error) {
          results.sms = "failed";
          console.error("SMS test failed:", error);
        }
      } else results.sms = "disabled or no phone number";
    }

    if (channel === "whatsapp" || !channel) {
      if (prefs.whatsappEnabled && user.whatsappPhone) {
        try {
          await sendWhatsAppMessage(user.whatsappPhone, message);
          await storage.createNotificationLog(user.id, "whatsapp", message, "test");
          results.whatsapp = "sent";
        } catch (error) {
          results.whatsapp = "failed";
          console.error("WhatsApp test failed:", error);
        }
      } else results.whatsapp = "disabled or no WhatsApp number";
    }

    return res.json({ success: true, message: "Test notification triggered", data: results });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function generateMorningDigestMessage(): string {
  const date = new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return `🌅 Good morning! Here's your FuelIQ-NG morning digest for ${date}:\n\n• PMS prices expected between ₦620-₦640 today\n• Apapa terminal: High truck queue\n• FX pressure: Medium\n• Dangote refinery: 85% operational\n\nLog in to your dashboard for details.`;
}
