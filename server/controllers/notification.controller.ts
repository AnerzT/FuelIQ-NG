import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { updateNotificationPrefsSchema } from "@shared/schema";
import * as orchestrator from "../services/notificationOrchestrator";

export async function getNotificationPrefs(req: AuthRequest, res: Response) {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      data: {
        phone: user.phone,
        whatsappPhone: user.whatsappPhone,
        notificationPrefs: user.notificationPrefs,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateNotificationPrefs(req: AuthRequest, res: Response) {
  try {
    const parsed = updateNotificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
    }

    const updated = await storage.updateUserNotificationPrefs(req.userId!, parsed.data);
    if (!updated) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      message: "Notification preferences updated",
      data: {
        phone: updated.phone,
        whatsappPhone: updated.whatsappPhone,
        notificationPrefs: updated.notificationPrefs,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getNotificationLogs(req: AuthRequest, res: Response) {
  try {
    const logs = await storage.getNotificationLogs(req.userId!);
    return res.json({ success: true, data: logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getNotificationStatus(_req: AuthRequest, res: Response) {
  try {
    const status = orchestrator.getNotificationStatus();
    return res.json({ success: true, data: status });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerMorningDigest(_req: AuthRequest, res: Response) {
  try {
    const result = await orchestrator.sendMorningDigest();
    return res.json({
      success: true,
      message: `Morning digest sent: ${result.smsSent} SMS, ${result.whatsappSent} WhatsApp`,
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerTestNotification(req: AuthRequest, res: Response) {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { channel } = req.body;
    const results: { sms?: any; whatsapp?: any } = {};

    if (channel === "sms" || channel === "all") {
      if (user.phone) {
        const { sendSms } = await import("../services/smsService");
        const smsResult = await sendSms(user.phone, "[FuelIQ] Test notification — your SMS alerts are working!");
        results.sms = smsResult;

        await storage.createNotificationLog({
          userId: user.id,
          channel: "sms",
          alertType: "test",
          message: "Test SMS notification",
          status: smsResult.success ? "sent" : "failed",
          externalId: smsResult.messageId || null,
        });
      } else {
        results.sms = { success: false, error: "No phone number configured" };
      }
    }

    if (channel === "whatsapp" || channel === "all") {
      if (user.whatsappPhone) {
        const whatsappService = await import("../services/whatsappService");
        const waResult = await whatsappService.sendForecastAlert(
          "Test Terminal", "neutral",
          { increase: 33, decrease: 33, stable: 34 },
          { min: 610, max: 625 }
        );
        results.whatsapp = { success: true, sent: waResult };
      } else {
        results.whatsapp = { success: false, error: "No WhatsApp number configured" };
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
