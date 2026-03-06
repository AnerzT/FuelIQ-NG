import { storage } from "../storage";
import * as smsService from "./smsService";
import * as whatsappService from "./whatsappService";
import type { Forecast } from "@shared/schema";

export interface NotificationResult {
  alertType: string;
  smsSent: number;
  whatsappSent: number;
}

export async function onForecastCreated(
  terminalId: string,
  newForecast: Forecast
): Promise<NotificationResult | null> {
  const forecasts = await storage.getForecasts(terminalId, 2);
  if (forecasts.length < 2) return null;

  const previousForecast = forecasts[1];
  if (previousForecast.bias === newForecast.bias) return null;

  const terminal = await storage.getTerminal(terminalId);
  const terminalName = terminal?.name || "Unknown Terminal";

  const probability = { increase: 0, decrease: 0, stable: 0 };
  if (newForecast.bias === "bullish") {
    probability.increase = 70;
    probability.decrease = 10;
    probability.stable = 20;
  } else if (newForecast.bias === "bearish") {
    probability.increase = 10;
    probability.decrease = 70;
    probability.stable = 20;
  } else {
    probability.increase = 25;
    probability.decrease = 25;
    probability.stable = 50;
  }

  const expectedRange = { min: newForecast.expectedMin, max: newForecast.expectedMax };

  console.log(`[Notify] Forecast bias changed for ${terminalName}: ${previousForecast.bias} → ${newForecast.bias}`);

  const [smsSent, whatsappSent] = await Promise.all([
    smsService.sendForecastAlert(terminalName, newForecast.bias, probability, expectedRange),
    whatsappService.sendForecastAlert(terminalName, newForecast.bias, probability, expectedRange),
  ]);

  return { alertType: "forecast_bias_change", smsSent, whatsappSent };
}

export async function onPriceChange(
  terminalId: string,
  currentPrice: number,
  previousPrice: number
): Promise<NotificationResult | null> {
  const change = currentPrice - previousPrice;
  if (Math.abs(change) < 10) return null;

  const terminal = await storage.getTerminal(terminalId);
  const terminalName = terminal?.name || "Unknown Terminal";

  console.log(`[Notify] Price change for ${terminalName}: ₦${previousPrice} → ₦${currentPrice} (Δ₦${change})`);

  const [smsSent, whatsappSent] = await Promise.all([
    smsService.sendPriceAlert(terminalName, change, currentPrice),
    whatsappService.sendPriceAlert(terminalName, change, currentPrice),
  ]);

  return { alertType: "price_change", smsSent, whatsappSent };
}

export async function onRefineryOutputDrop(
  refineryName: string,
  status: string,
  previousOutput: number,
  currentOutput: number
): Promise<NotificationResult | null> {
  const dropPercent = ((previousOutput - currentOutput) / previousOutput) * 100;
  if (dropPercent < 10) return null;

  const outputChange = `Output dropped ${Math.round(dropPercent)}% (${previousOutput} → ${currentOutput} bpd)`;

  console.log(`[Notify] Refinery output drop: ${refineryName} - ${outputChange}`);

  const [smsSent, whatsappSent] = await Promise.all([
    smsService.sendRefineryAlert(refineryName, status, outputChange),
    whatsappService.sendRefineryAlert(refineryName, status, outputChange),
  ]);

  return { alertType: "refinery_output_drop", smsSent, whatsappSent };
}

export async function sendMorningDigest(): Promise<NotificationResult> {
  const terminals = await storage.getTerminals();
  const activeTerminals = terminals.filter((t) => t.active);

  const summaries: { terminal: string; bias: string; range: string; confidence: number }[] = [];

  for (const terminal of activeTerminals) {
    const forecast = await storage.getLatestForecast(terminal.id);
    if (!forecast) continue;

    summaries.push({
      terminal: terminal.name,
      bias: forecast.bias,
      range: `₦${forecast.expectedMin}-₦${forecast.expectedMax}`,
      confidence: forecast.confidence,
    });
  }

  if (summaries.length === 0) {
    return { alertType: "morning_digest", smsSent: 0, whatsappSent: 0 };
  }

  const whatsappSent = await whatsappService.sendMorningDigest(summaries);

  const smsMessage = `[FuelIQ] Morning Digest: ${summaries.length} terminals. ` +
    summaries.slice(0, 3).map((s) => `${s.terminal}: ${s.bias}`).join(", ") +
    `. Open app for details.`;

  const smsUsers = await storage.getSubscribedUsers("sms", "morningDigest");
  let smsSent = 0;
  for (const user of smsUsers) {
    if (!user.phone) continue;
    const result = await smsService.sendSms(user.phone, smsMessage);
    await storage.createNotificationLog({
      userId: user.id,
      channel: "sms",
      alertType: "morningDigest",
      message: smsMessage,
      status: result.success ? "sent" : "failed",
      externalId: result.messageId || null,
    });
    if (result.success) smsSent++;
  }

  console.log(`[Notify] Morning digest sent: ${smsSent} SMS, ${whatsappSent} WhatsApp`);
  return { alertType: "morning_digest", smsSent, whatsappSent };
}

export function getNotificationStatus(): {
  sms: { configured: boolean; provider: string };
  whatsapp: { configured: boolean };
} {
  return {
    sms: smsService.getProviderInfo(),
    whatsapp: { configured: whatsappService.isWhatsAppConfigured() },
  };
}
