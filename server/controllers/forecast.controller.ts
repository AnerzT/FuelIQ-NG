import type { Response } from "express";
import { storage } from "../storage.js";
import { insertForecastSchema } from "../../shared/schema.js";
import type { AuthRequest } from "../middleware/auth.js";
import { computeForecast } from "../services/forecastEngine.js";
import { computeForecastScore } from "../services/forecastScoring.js";
import { onForecastCreated } from "../services/notificationOrchestrator.js";

export async function getMultiProductForecasts(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.params;

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const products = ["PMS", "AGO", "JET_A1", "ATK", "LPG"];
    const forecasts = await Promise.all(
      products.map(async (pt) => {
        const forecast = await storage.getLatestForecast(terminalId, pt);
        return forecast;
      })
    );

    return res.json({
      success: true,
      data: forecasts.filter(Boolean),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getForecast(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.params;
    const productType = typeof req.query.productType === "string" ? req.query.productType : undefined;

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const forecast = await storage.getLatestForecast(terminalId, productType);
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

    const { terminalId, productType } = parsed.data as any;

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const forecastData = {
      ...parsed.data,
      terminalId: String(terminalId),
      productType: productType || "PMS",
    };

    const forecast = await storage.createForecast(forecastData as any);

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
    const productType = typeof req.query.productType === "string" ? req.query.productType : "PMS";

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signal = await storage.getLatestSignal(terminalId, productType);
    if (!signal) {
      return res.status(400).json({ success: false, message: "No market signals available to generate forecast" });
    }

    const history = await storage.getPriceHistory(terminalId, 30, productType);
    const result = computeForecast(signal, history, productType);

    const forecast = await storage.createForecast({
      terminalId: String(terminalId),
      productType,
      depotPrice: 0,
      refineryInfluenceScore: 0,
      importParityPrice: 0,
      demandIndex: 0,
      ...result,
    } as any);

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

export async function getForecastHistory(req: AuthRequest, res: Response) {
  try {
    const terminalId = typeof req.query.terminalId === "string" ? req.query.terminalId : undefined;
    const productType = typeof req.query.productType === "string" ? req.query.productType : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const safePage = Math.max(page, 1);

    let allForecasts;
    if (terminalId) {
      allForecasts = await storage.getForecasts(terminalId, safeLimit * safePage);
    } else {
      allForecasts = await storage.getAllForecasts(safeLimit * safePage);
    }

    if (productType) {
      allForecasts = allForecasts.filter((f) => f.productType === productType);
    }

    const startIdx = (safePage - 1) * safeLimit;
    const paginatedForecasts = allForecasts.slice(startIdx, startIdx + safeLimit);

    return res.json({
      success: true,
      data: {
        forecasts: paginatedForecasts,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: allForecasts.length,
          hasMore: startIdx + safeLimit < allForecasts.length,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function scoreForecast(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.params;
    const productType = typeof req.query.productType === "string" ? req.query.productType : "PMS";

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signal = await storage.getLatestSignal(terminalId, productType);
    if (!signal) {
      return res.status(400).json({ success: false, message: "No market signals available for scoring" });
    }

    const [history, nnpcFeeds, fxRates] = await Promise.all([
      storage.getPriceHistory(terminalId, 30, productType),
      storage.getExternalPriceFeedBySource("NNPC", 1),
      storage.getFxRates(10),
    ]);

    const score = computeForecastScore({
      signal,
      priceHistory: history,
      nnpcFeed: nnpcFeeds[0] ?? null,
      fxRates,
      productType,
    });

    const forecast = await storage.createForecast({
      terminalId: String(terminalId),
      productType,
      expectedMin: score.expectedRange.min,
      expectedMax: score.expectedRange.max,
      bias: score.bias,
      confidence: score.confidence,
      suggestedAction: score.suggestedAction,
      depotPrice: 0,
      refineryInfluenceScore: 0,
      importParityPrice: 0,
      demandIndex: 0,
    } as any);

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
          riskFactor: score.riskFactor,
          scoring: score.scoring,
        },
        signalSnapshot: signal,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
