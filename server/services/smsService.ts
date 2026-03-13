import { storage } from "../storage.js";
import type { NotificationPrefs } from "../shared/schema";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

const TERMII_API_KEY = process.env.TERMII_API_KEY || "";
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || "FuelIQ";

type SmsProvider = "twilio" | "termii" | "none";

function getActiveProvider(): SmsProvider {
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) return "twilio";
  if (TERMII_API_KEY) return "termii";
  return "none";
}

async function sendViaTwilio(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const body = new URLSearchParams({
      To: to,
      From: TWILIO_PHONE_NUMBER,
      Body: message,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json() as any;

    if (response.ok) {
      return { success: true, messageId: data.sid };
    }
    return { success: false, error: data.message || `Twilio error ${response.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendViaTermii(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: TERMII_SENDER_ID,
        sms: message,
        type: "plain",
        channel: "generic",
        api_key: TERMII_API_KEY,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json() as any;

    if (response.ok && data.message_id) {
      return { success: true, messageId: data.message_id };
    }
    return { success: false, error: data.message || `Termii error ${response.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendSms(
  to: string,
  message: string
): Promise<{ success: boolean; provider: SmsProvider; messageId?: string; error?: string }> {
  const provider = getActiveProvider();

  if (provider === "none") {
    console.log(`[SMS] No provider configured. Would send to ${to}: ${message.substring(0, 50)}...`);
    return { success: true, provider: "none", messageId: "simulated" };
  }

  let result: { success: boolean; messageId?: string; error?: string };

  if (provider === "twilio") {
    result = await sendViaTwilio(to, message);
  } else {
    result = await sendViaTermii(to, message);
  }

  if (result.success) {
    console.log(`[SMS] Sent via ${provider} to ${to}: ${message.substring(0, 50)}...`);
  } else {
    console.error(`[SMS] Failed via ${provider} to ${to}: ${result.error}`);
  }

  return { ...result, provider };
}

export async function sendForecastAlert(
  terminalName: string,
  bias: string,
  probability: { increase: number; decrease: number; stable: number },
  expectedRange: { min: number; max: number }
): Promise<number> {
  const message = `[FuelIQ] ${terminalName} forecast: ${bias.toUpperCase()}\n` +
    `Price range: ₦${expectedRange.min}-₦${expectedRange.max}\n` +
    `Increase: ${probability.increase}% | Drop: ${probability.decrease}% | Stable: ${probability.stable}%`;

  return broadcastSms("forecastAlerts", message);
}

export async function sendPriceAlert(
  terminalName: string,
  priceChange: number,
  currentPrice: number
): Promise<number> {
  const direction = priceChange > 0 ? "UP" : "DOWN";
  const message = `[FuelIQ] PRICE ALERT: ${terminalName}\n` +
    `Price ${direction} ₦${Math.abs(priceChange)}\n` +
    `Current: ₦${currentPrice}/litre`;

  return broadcastSms("priceAlerts", message);
}

export async function sendRefineryAlert(
  refineryName: string,
  status: string,
  outputChange: string
): Promise<number> {
  const message = `[FuelIQ] REFINERY UPDATE: ${refineryName}\n` +
    `Status: ${status}\n` +
    `Output: ${outputChange}`;

  return broadcastSms("refineryAlerts", message);
}

async function broadcastSms(alertType: keyof NotificationPrefs, message: string): Promise<number> {
  const allUsers = await storage.getSubscribedUsers("sms", alertType);
  let sent = 0;

  for (const user of allUsers) {
    if (!user.phone) continue;

    const result = await sendSms(user.phone, message);
    await storage.createNotificationLog({
      userId: user.id,
      channel: "sms",
      alertType,
      message,
      status: result.success ? "sent" : "failed",
      externalId: result.messageId || null,
    });

    if (result.success) sent++;
  }

  console.log(`[SMS] Broadcast "${alertType}": ${sent}/${allUsers.length} sent`);
  return sent;
}

export function isSmsConfigured(): boolean {
  return getActiveProvider() !== "none";
}

export function getProviderInfo(): { provider: SmsProvider; configured: boolean } {
  const provider = getActiveProvider();
  return { provider, configured: provider !== "none" };
}
