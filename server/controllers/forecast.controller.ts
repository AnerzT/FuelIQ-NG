import type { Response } from "express";
import { storage } from "../storage";
import { insertForecastSchema } from "@shared/schema";
import type { AuthRequest } from "../middleware/auth";
import { computeForecast } from "../services/forecastEngine";
import { computeForecastScore } from "../services/forecastScoring";
import { onForecastCreated } from "../services/notificationOrchestrator";

export async function getForecast(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.params;

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const forecast = await storage.getLatestForecast(terminalId);
    if (!forecast) {
      return res.status(404).json({ success: false, message: "No forecast available for this terminal" });
    }

    return res.json({
      success: true,
      data: { terminal, forecast },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createForecast(req: AuthRequest, res: Response) {
  try {
    const parsed = insertForecastSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
    }

    const terminal = await storage.getTerminal(parsed.data.terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const forecast = await storage.createForecast(parsed.data);

    return res.status(201).json({
      success: true,
      message: "Forecast created successfully",
      data: forecast,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function generateForecast(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.params;

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signal = await storage.getLatestSignal(terminalId);
    if (!signal) {
      return res.status(400).json({ success: false, message: "No market signals available to generate forecast" });
    }

    const history = await storage.getPriceHistory(terminalId, 30);
    const result = computeForecast(signal, history);

    const forecast = await storage.createForecast({
      terminalId,
      ...result,
    });

    storage.incrementForecastCount(req.userId!).catch(() => {});

    onForecastCreated(terminalId, forecast).catch((err) =>
      console.error(`[Notify] Error in forecast notification: ${err.message}`)
    );

    return res.status(201).json({
      success: true,
      message: "Forecast generated from market signals",
      data: { terminal, forecast, signalSnapshot: signal },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function scoreForecast(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.params;

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signal = await storage.getLatestSignal(terminalId);
    if (!signal) {
      return res.status(400).json({ success: false, message: "No market signals available for scoring" });
    }

    const [history, nnpcFeeds, fxRates] = await Promise.all([
      storage.getPriceHistory(terminalId, 30),
      storage.getExternalPriceFeedBySource("NNPC", 1),
      storage.getFxRates(10),
    ]);

    const score = computeForecastScore({
      signal,
      priceHistory: history,
      nnpcFeed: nnpcFeeds[0] ?? null,
      fxRates,
    });

    const forecast = await storage.createForecast({
      terminalId,
      expectedMin: score.expectedRange.min,
      expectedMax: score.expectedRange.max,
      bias: score.bias,
      confidence: score.confidence,
      suggestedAction: score.suggestedAction,
    });

    onForecastCreated(terminalId, forecast).catch((err) =>
      console.error(`[Notify] Error in score notification: ${err.message}`)
    );

    return res.status(201).json({
      success: true,
      message: "AI forecast score generated",
      data: {
        terminal,
        forecast,
        score: {
          bias: score.bias,
          probability: score.probability,
          expectedRange: score.expectedRange,
          confidence: score.confidence,
          suggestedAction: score.suggestedAction,
          scoring: score.scoring,
        },
        signalSnapshot: signal,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
