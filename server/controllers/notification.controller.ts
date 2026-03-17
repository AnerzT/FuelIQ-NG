import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { sendSms } from "../services/smsService.js";
import { sendWhatsAppMessage } from "../services/whatsappService.js";

export async function getNotificationPrefs(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

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
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { phone, whatsappPhone, notificationPrefs } = req.body;

    const updateData: any = {};
    if (phone !== undefined) updateData.phone = phone;
    if (whatsappPhone !== undefined) updateData.whatsappPhone = whatsappPhone;
    if (notificationPrefs !== undefined) updateData.notificationPrefs = notificationPrefs;

    const updatedUser = await storage.updateUser(userId, updateData);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      message: "Notification preferences updated successfully",
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
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    const logs = await storage.getNotificationLogs(userId, safeLimit);

    return res.json({
      success: true,
      data: logs,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getNotificationStatus(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

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
    // Admin only route - check if user is admin
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
    }

    // Get all subscribed users
    const subscribedUsers = await storage.getSubscribedUsers();
    
    const results = {
      total: subscribedUsers.length,
      sms: 0,
      whatsapp: 0,
      failed: 0,
    };

    // Send morning digest to each subscribed user
    for (const user of subscribedUsers) {
      const prefs = user.notificationPrefs as any || {};
      const message = generateMorningDigestMessage();

      try {
        if (prefs.smsEnabled && user.phone) {
          await sendSms(user.phone, message);
          await storage.createNotificationLog(user.id, "sms", message, "morning_digest");
          results.sms++;
        }

        if (prefs.whatsappEnabled && user.whatsappPhone) {
          await sendWhatsAppMessage(user.whatsappPhone, message);
          await storage.createNotificationLog(user.id, "whatsapp", message, "morning_digest");
          results.whatsapp++;
        }
      } catch (error) {
        console.error(`Failed to send digest to user ${user.id}:`, error);
        results.failed++;
      }
    }

    return res.json({
      success: true,
      message: "Morning digest triggered successfully",
      data: results,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerTestNotification(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

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
      } else {
        results.sms = "disabled or no phone number";
      }
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
      } else {
        results.whatsapp = "disabled or no WhatsApp number";
      }
    }

    return res.json({
      success: true,
      message: "Test notification triggered",
      data: results,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function generateMorningDigestMessage(): string {
  const date = new Date();
  const formattedDate = date.toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `🌅 Good morning! Here's your FuelIQ-NG morning digest for ${formattedDate}:\n\n` +
    `• PMS prices expected to range between ₦620-₦640 today\n` +
    `• Apapa terminal: High truck queue reported\n` +
    `• FX pressure: Medium\n` +
    `• Refinery status: Dangote operational at 85% capacity\n\n` +
    `Log in to your dashboard for detailed forecasts and recommendations.`;
}
