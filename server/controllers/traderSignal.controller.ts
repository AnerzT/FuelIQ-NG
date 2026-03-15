import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { PRODUCT_TYPES } from "../../shared/schema.js";

const BULLISH_KEYWORDS = ["buy", "load", "scarcity", "shortage", "rising", "increase", "hike", "surge", "tight", "limited"];
const BEARISH_KEYWORDS = ["sell", "drop", "excess", "surplus", "falling", "decrease", "glut", "oversupply", "dump", "cheap"];
const NEUTRAL_KEYWORDS = ["stable", "steady", "hold", "unchanged", "flat", "normal", "moderate"];

function analyzeSentiment(message: string): { sentimentScore: number; impactScore: number; keywords: string[] } {
  const lower = message.toLowerCase();
  const detectedKeywords: string[] = [];
  let score = 0;

  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 1;
      detectedKeywords.push(kw);
    }
  }
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw)) {
      score -= 1;
      detectedKeywords.push(kw);
    }
  }
  for (const kw of NEUTRAL_KEYWORDS) {
    if (lower.includes(kw)) {
      detectedKeywords.push(kw);
    }
  }

  const maxMagnitude = Math.max(BULLISH_KEYWORDS.length, BEARISH_KEYWORDS.length);
  const sentimentScore = maxMagnitude > 0 ? Math.max(-1, Math.min(1, score / 3)) : 0;
  const impactScore = Math.min(1, detectedKeywords.length / 5);

  return {
    sentimentScore: Math.round(sentimentScore * 100) / 100,
    impactScore: Math.round(impactScore * 100) / 100,
    keywords: detectedKeywords,
  };
}

function detectProduct(message: string): string | null {
  const lower = message.toLowerCase();
  for (const pt of PRODUCT_TYPES) {
    if (lower.includes(pt.toLowerCase())) return pt;
  }
  if (lower.includes("petrol") || lower.includes("gasoline") || lower.includes("fuel")) return "PMS";
  if (lower.includes("diesel")) return "AGO";
  if (lower.includes("kerosene") || lower.includes("jet fuel") || lower.includes("aviation")) return "JET_A1";
  if (lower.includes("cooking gas") || lower.includes("lpg") || lower.includes("propane")) return "LPG";
  return null;
}

async function detectTerminal(message: string): Promise<{ terminalId: string | null; terminalName: string | null }> {
  const allTerminals = await storage.getTerminals();
  const lower = message.toLowerCase();
  for (const t of allTerminals) {
    const tCode = (t as any).code ?? "";
    if (lower.includes(t.name.toLowerCase()) || lower.includes(tCode.toLowerCase())) {
      return { terminalId: String(t.id), terminalName: t.name };
    }
  }
  return { terminalId: null, terminalName: null };
}

export async function getTraderSignals(req: AuthRequest, res: Response) {
  try {
    const { terminalId, limit } = req.query;
    const signals = await storage.getTraderSignals(
      terminalId as string | undefined,
      limit ? parseInt(limit as string) : undefined
    );

    let avgSentiment = 0;
    let avgImpact = 0;
    if (signals.length > 0) {
      avgSentiment = signals.reduce((sum, s) => sum + ((s as any).sentimentScore || 0), 0) / signals.length;
      avgImpact = signals.reduce((sum, s) => sum + ((s as any).impactScore || 0), 0) / signals.length;
    }

    return res.json({
      success: true,
      data: {
        signals,
        sentiment: {
          average: Math.round(avgSentiment * 100) / 100,
          label: avgSentiment > 0.2 ? "Bullish" : avgSentiment < -0.2 ? "Bearish" : "Neutral",
          avgImpact: Math.round(avgImpact * 100) / 100,
          count: signals.length,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function submitTraderSignal(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { message, terminalId, productType } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "message is required" });
    }

    const { sentimentScore, impactScore, keywords } = analyzeSentiment(message);
    const detectedProduct = detectProduct(message);
    const { terminalId: detectedTerminalId, terminalName: detectedTerminalName } = await detectTerminal(message);

    const resolvedTerminalId = terminalId || detectedTerminalId || "1";

    const signal = await storage.createTraderSignal({
      userId: Number(userId),
      message,
      sentimentScore,
      impactScore,
      terminalId: String(resolvedTerminalId),
      productType: productType || detectedProduct || "PMS",
      detectedTerminal: detectedTerminalName,
      detectedProduct: detectedProduct,
      keywords,
      action: sentimentScore > 0.2 ? "BUY" : sentimentScore < -0.2 ? "SELL" : "HOLD",
      confidence: Math.round(impactScore * 100),
      notes: null,
    } as any);

    return res.status(201).json({
      success: true,
      data: {
        signal,
        analysis: {
          sentimentScore,
          impactScore,
          keywords,
          detectedProduct,
          detectedTerminal: detectedTerminalName,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
