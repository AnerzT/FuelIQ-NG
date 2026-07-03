import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString, ensureNumber, ensureFloat } from "../utils/params.js";

function extractKeywords(message: string) {
  return message
    .toLowerCase()
    .match(/\b(terminal|queue|maintenance|output|bullish|bearish|price|supply|demand|refinery|FX|naira|diesel|PMS|AGO|JET)\b/g)
    ?.map((word) => word.toUpperCase()) || [];
}

function inferSentiment(message: string) {
  const text = message.toLowerCase();
  let score = 0;

  const positive = ["bullish", "tightening", "strong", "up", "higher", "good", "rise", "increasing", "strengthening", "reduced"].filter((term) => text.includes(term)).length;
  const negative = ["bearish", "maintenance", "weak", "down", "lower", "bad", "fall", "decreasing", "weakening", "shortage"].filter((term) => text.includes(term)).length;

  score += positive * 0.25;
  score -= negative * 0.25;

  if (text.includes("queue") && text.includes("heavy")) score -= 0.1;
  if (text.includes("tightening") || text.includes("shortage")) score += 0.15;
  if (text.includes("maintenance")) score -= 0.2;
  if (text.includes("expected bullish") || text.includes("bullish pressure")) score += 0.2;
  if (text.includes("bearish pressure")) score -= 0.2;

  return Math.max(-1, Math.min(1, score));
}

function inferImpact(message: string, sentiment: number) {
  const magnitude = Math.min(1, Math.max(0, Math.abs(sentiment) + (message.length > 100 ? 0.1 : 0)));
  if (message.includes("urgent") || message.includes("critical") || message.includes("severe")) {
    return Math.min(1, magnitude + 0.2);
  }
  return magnitude;
}

export async function getTraderSignals(req: AuthRequest, res: Response) {
  try {
    const limit = ensureNumber(req.query.limit, 50);
    const signals = await storage.getTraderSignals(limit);
    return res.json({ success: true, data: signals });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function submitTraderSignal(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await storage.getUser(userId);
    const body = req.body;
    const message = ensureString(body.message).trim();
    if (!message) return res.status(400).json({ success: false, message: "Message is required" });

    const sentimentScore = body.sentimentScore !== undefined
      ? ensureFloat(body.sentimentScore)
      : inferSentiment(message);
    const impactScore = body.impactScore !== undefined
      ? ensureFloat(body.impactScore)
      : inferImpact(message, sentimentScore);

    const signal = await storage.createTraderSignal({
      userId,
      userName: user?.name || user?.email || "Anonymous",
      message,
      sentimentScore,
      impactScore,
      terminalId: ensureString(body.terminalId),
      productType: ensureString(body.productType, "PMS"),
      detectedTerminal: ensureString(body.detectedTerminal),
      detectedProduct: ensureString(body.detectedProduct),
      keywords: body.keywords || extractKeywords(message),
    });
    return res.status(201).json({ success: true, data: signal });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTraderSignalsByTerminal(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.params.terminalId);
    const limit = ensureNumber(req.query.limit, 20);
    const signals = await storage.getTraderSignalsByTerminal(terminalId, limit);
    return res.json({ success: true, data: signals });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
