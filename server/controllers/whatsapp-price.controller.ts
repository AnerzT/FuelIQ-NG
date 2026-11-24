import type { Response } from "express";
import twilio from "twilio";
import type { AuthRequest } from "../middleware/auth.js";
import { storage } from "../storage.js";

const PRODUCT_TYPES: Record<string, string> = {
  PMS: "PMS",
  PETROL: "PMS",
  GASOLINE: "PMS",
  AGO: "AGO",
  DIESEL: "AGO",
  DPK: "DPK",
  KEROSENE: "DPK",
  LPG: "LPG",
  "JET A1": "JET_A1",
  "JET-A1": "JET_A1",
  JET_A1: "JET_A1",
};

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function ingestWhatsAppPrice(req: AuthRequest, res: Response) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const webhookUrl = process.env.WHATSAPP_PRICE_WEBHOOK_URL;
  const allowedSenders = new Set(
    (process.env.WHATSAPP_PRICE_SENDERS || "")
      .split(",")
      .map(normalizePhone)
      .filter(Boolean),
  );
  if (!authToken || !webhookUrl || allowedSenders.size === 0) {
    return res.status(503).json({
      success: false,
      message: "WhatsApp price ingestion is not configured",
    });
  }

  const signature = req.get("X-Twilio-Signature") || "";
  if (!twilio.validateRequest(authToken, signature, webhookUrl, req.body || {})) {
    return res.status(403).json({ success: false, message: "Invalid WhatsApp webhook signature" });
  }

  const sender = normalizePhone(String(req.body?.From || ""));
  if (!allowedSenders.has(sender)) {
    return res.status(403).json({ success: false, message: "Sender is not authorized to submit prices" });
  }

  const body = typeof req.body?.Body === "string" ? req.body.Body.trim() : "";
  const match = body.match(
    /^PRICE\s+(PMS|PETROL|GASOLINE|AGO|DIESEL|DPK|KEROSENE|LPG|JET[\s_-]?A1)\s+([0-9]{2,6}(?:\.\d{1,2})?)\s+(.+)$/i,
  );
  if (!match) {
    return res.status(400).json({
      success: false,
      message: "Use: PRICE <PMS|AGO|DPK|LPG|JET_A1> <NGN per litre> <terminal>",
    });
  }

  const productType = PRODUCT_TYPES[match[1].toUpperCase().replace(/_/g, " ").replace(/-/g, " ")];
  const price = Number(match[2]);
  const location = match[3].trim().replace(/[,.]+$/, "");
  if (!productType || !Number.isFinite(price) || price < 50 || price > 10_000 || !location) {
    return res.status(400).json({ success: false, message: "Price report contains invalid product, amount, or location" });
  }

  try {
    const observation = await storage.recordPriceObservation({
      location,
      productType,
      price,
      source: "WhatsApp",
      sourceReference: typeof req.body?.MessageSid === "string" ? req.body.MessageSid : undefined,
    });
    return res.status(200).json({
      success: true,
      message: "Price report recorded",
      data: {
        terminalId: observation.terminalId,
        productType: observation.productType,
        price: observation.price,
        updatedAt: observation.date,
        source: observation.source,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price report could not be recorded";
    return res.status(400).json({ success: false, message });
  }
}
