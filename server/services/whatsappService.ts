import { storage } from "../storage";
import type { NotificationPrefs } from "@shared/schema";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

interface WhatsAppMessageResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.log(`[WhatsApp] Not configured. Would send to ${to}: ${message.substring(0, 50)}...`);
    return { success: true, messageId: "simulated" };
  }

  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/[^0-9]/g, ""),
        type: "text",
        text: { preview_url: false, body: message },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = (await response.json()) as any;

    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }

    const errorMsg = data.error?.message || `WhatsApp API error ${response.status}`;
    return { success: false, error: errorMsg };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  parameters: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.log(`[WhatsApp] Not configured. Would send template "${templateName}" to ${to}`);
    return { success: true, messageId: "simulated" };
  }

  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^0-9]/g, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: parameters.map((p) => ({ type: "text", text: p })),
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = (await response.json()) as any;

    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return { success: false, error: data.error?.message || `WhatsApp error ${response.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendForecastAlert(
  terminalName: string,
  bias: string,
  probability: { increase: number; decrease: number; stable: number },
  expectedRange: { min: number; max: number }
): Promise<number> {
  const message =
    `📊 *FuelIQ Forecast Alert*\n\n` +
    `*Terminal:* ${terminalName}\n` +
    `*Bias:* ${bias.toUpperCase()}\n` +
    `*Expected Range:* ₦${expectedRange.min} - ₦${expectedRange.max}\n\n` +
    `📈 Increase: ${probability.increase}%\n` +
    `📉 Drop: ${probability.decrease}%\n` +
    `➡️ Stable: ${probability.stable}%`;

  return broadcastWhatsApp("forecastAlerts", message);
}

export async function sendPriceAlert(
  terminalName: string,
  priceChange: number,
  currentPrice: number
): Promise<number> {
  const emoji = priceChange > 0 ? "🔴" : "🟢";
  const direction = priceChange > 0 ? "INCREASED" : "DECREASED";
  const message =
    `${emoji} *FuelIQ Price Alert*\n\n` +
    `*Terminal:* ${terminalName}\n` +
    `Price has ${direction} by *₦${Math.abs(priceChange)}*\n` +
    `*Current Price:* ₦${currentPrice}/litre`;

  return broadcastWhatsApp("priceAlerts", message);
}

export async function sendRefineryAlert(
  refineryName: string,
  status: string,
  outputChange: string
): Promise<number> {
  const message =
    `🏭 *FuelIQ Refinery Update*\n\n` +
    `*Refinery:* ${refineryName}\n` +
    `*Status:* ${status}\n` +
    `*Output:* ${outputChange}`;

  return broadcastWhatsApp("refineryAlerts", message);
}

export async function sendMorningDigest(
  summaries: { terminal: string; bias: string; range: string; confidence: number }[]
): Promise<number> {
  const date = new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" });
  let message =
    `☀️ *FuelIQ Morning Digest*\n` +
    `📅 ${date}\n\n`;

  for (const s of summaries.slice(0, 8)) {
    const biasEmoji = s.bias === "bullish" ? "📈" : s.bias === "bearish" ? "📉" : "➡️";
    message += `${biasEmoji} *${s.terminal}*: ${s.bias} (${s.confidence}%)\n   Range: ${s.range}\n\n`;
  }

  message += `_Powered by FuelIQ NG_`;

  return broadcastWhatsApp("morningDigest", message);
}

async function broadcastWhatsApp(alertType: keyof NotificationPrefs, message: string): Promise<number> {
  const users = await storage.getSubscribedUsers("whatsapp", alertType);
  let sent = 0;

  for (const user of users) {
    if (!user.whatsappPhone) continue;

    const result = await sendWhatsAppMessage(user.whatsappPhone, message);
    await storage.createNotificationLog({
      userId: user.id,
      channel: "whatsapp",
      alertType,
      message,
      status: result.success ? "sent" : "failed",
      externalId: result.messageId || null,
    });

    if (result.success) sent++;
  }

  console.log(`[WhatsApp] Broadcast "${alertType}": ${sent}/${users.length} sent`);
  return sent;
}

export function isWhatsAppConfigured(): boolean {
  return !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID);
}
