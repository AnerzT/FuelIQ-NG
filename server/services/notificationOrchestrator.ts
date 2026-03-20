import { storage } from "../storage.js";
import { sendSms } from "./smsService.js";
import { sendWhatsAppMessage } from "./whatsappService.js";

export async function onForecastCreated(terminalId: string, forecast: any) {
  try {
    // Get all users subscribed to this terminal
    const users = await storage.getAllUsers();
    const subscribers = users.filter(user => {
      const prefs = user.notificationPrefs as any;
      return prefs?.forecastAlerts === true && 
             (user.assignedTerminalId === terminalId || !user.assignedTerminalId);
    });

    const message = `📊 New forecast for terminal ${terminalId}: ${forecast.productType} expected between ₦${forecast.expectedMin}-₦${forecast.expectedMax}. ${forecast.suggestedAction}`;

    for (const user of subscribers) {
      const prefs = user.notificationPrefs as any;
      
      if (prefs?.smsEnabled && user.phone) {
        await sendSms(user.phone, message);
        await storage.createNotificationLog(user.id, "sms", message, "forecast");
      }
      
      if (prefs?.whatsappEnabled && user.whatsappPhone) {
        await sendWhatsAppMessage(user.whatsappPhone, message);
        await storage.createNotificationLog(user.id, "whatsapp", message, "forecast");
      }
    }
  } catch (error) {
    console.error("❌ Error in onForecastCreated:", error);
  }
}

export async function onPriceChange(terminalId: string, productType: string, oldPrice: number, newPrice: number) {
  try {
    const users = await storage.getAllUsers();
    const subscribers = users.filter(user => {
      const prefs = user.notificationPrefs as any;
      return prefs?.priceAlerts === true;
    });

    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    const direction = change > 0 ? "increased" : "decreased";
    const message = `💰 Price alert at ${terminalId} for ${productType}: ${direction} by ${Math.abs(change).toFixed(1)}% to ₦${newPrice}`;

    for (const user of subscribers) {
      const prefs = user.notificationPrefs as any;
      
      if (prefs?.smsEnabled && user.phone) {
        await sendSms(user.phone, message);
        await storage.createNotificationLog(user.id, "sms", message, "price_alert");
      }
      
      if (prefs?.whatsappEnabled && user.whatsappPhone) {
        await sendWhatsAppMessage(user.whatsappPhone, message);
        await storage.createNotificationLog(user.id, "whatsapp", message, "price_alert");
      }
    }
  } catch (error) {
    console.error("❌ Error in onPriceChange:", error);
  }
}

export async function onRefineryUpdate(update: any) {
  try {
    const users = await storage.getAllUsers();
    const subscribers = users.filter(user => {
      const prefs = user.notificationPrefs as any;
      return prefs?.refineryAlerts === true;
    });

    const message = `🏭 Refinery update: ${update.refineryName} is now ${update.operationalStatus}. Production capacity: ${update.productionCapacity}%`;

    for (const user of subscribers) {
      const prefs = user.notificationPrefs as any;
      
      if (prefs?.smsEnabled && user.phone) {
        await sendSms(user.phone, message);
        await storage.createNotificationLog(user.id, "sms", message, "refinery");
      }
      
      if (prefs?.whatsappEnabled && user.whatsappPhone) {
        await sendWhatsAppMessage(user.whatsappPhone, message);
        await storage.createNotificationLog(user.id, "whatsapp", message, "refinery");
      }
    }
  } catch (error) {
    console.error("❌ Error in onRefineryUpdate:", error);
  }
}

export async function sendMorningDigest() {
  try {
    const users = await storage.getAllUsers();
    const subscribers = users.filter(user => {
      const prefs = user.notificationPrefs as any;
      return prefs?.morningDigest === true;
    });

    const date = new Date();
    const formattedDate = date.toLocaleDateString("en-NG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const message = `🌅 Good morning! Here's your FuelIQ-NG morning digest for ${formattedDate}:\n\n` +
      `• PMS prices expected between ₦620-₦640 today\n` +
      `• Apapa terminal: High truck queue\n` +
      `• FX pressure: Medium\n` +
      `• Dangote refinery: 85% operational\n\n` +
      `Log in to your dashboard for details.`;

    for (const user of subscribers) {
      const prefs = user.notificationPrefs as any;
      
      if (prefs?.smsEnabled && user.phone) {
        await sendSms(user.phone, message);
        await storage.createNotificationLog(user.id, "sms", message, "morning_digest");
      }
      
      if (prefs?.whatsappEnabled && user.whatsappPhone) {
        await sendWhatsAppMessage(user.whatsappPhone, message);
        await storage.createNotificationLog(user.id, "whatsapp", message, "morning_digest");
      }
    }

    return {
      success: true,
      sent: subscribers.length,
    };
  } catch (error) {
    console.error("❌ Error in sendMorningDigest:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getNotificationStatus() {
  try {
    return {
      sms: {
        available: true,
        provider: process.env.SMS_PROVIDER || "console",
      },
      whatsapp: {
        available: true,
        provider: process.env.WHATSAPP_PROVIDER || "console",
      },
    };
  } catch (error) {
    console.error("❌ Error getting notification status:", error);
    return {
      sms: { available: false },
      whatsapp: { available: false },
    };
  }
}
