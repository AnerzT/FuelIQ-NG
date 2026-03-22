import type { Response } from "express";
import { storage } from "../storage.js";
import { insertForecastSchema } from "../../shared/schema.js";
import type { AuthRequest } from "../middleware/auth.js";
import { computeForecast } from "../services/forecastEngine.js";
import { computeForecastScore } from "../services/forecastScoring.js";
import { onForecastCreated } from "../services/notificationOrchestrator.js";
import { ensureString, ensureNumber, parsePagination } from "../utils/params.js";

export async function getMultiProductForecasts(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.params.terminalId);
    if (!terminalId) {
      return res.status(400).json({ success: false, message: "Terminal ID is required" });
    }

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
    console.error("Error in getMultiProductForecasts:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getForecast(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.params.terminalId);
    if (!terminalId) {
      return res.status(400).json({ success: false, message: "Terminal ID is required" });
    }

    const productType = ensureString(req.query.productType, "PMS");

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
    console.error("Error in getForecast:", err);
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

    const body = req.body as any;
    const terminalId = ensureString(body.terminalId);
    const productType = ensureString(body.productType, "PMS");

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const forecastData = {
      terminalId,
      productType,
      expectedMin: body.expectedMin,
      expectedMax: body.expectedMax,
      bias: body.bias,
      confidence: body.confidence,
      suggestedAction: body.suggestedAction,
      depotPrice: body.depotPrice || 0,
      refineryInfluenceScore: body.refineryInfluenceScore || 0,
      importParityPrice: body.importParityPrice || 0,
      demandIndex: body.demandIndex || 0,
    };

    const forecast = await storage.createForecast(forecastData);

    return res.status(201).json({
      success: true,
      message: "Forecast created successfully",
      data: forecast,
    });
  } catch (err: any) {
    console.error("Error in createForecast:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function generateForecast(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.params.terminalId);
    if (!terminalId) {
      return res.status(400).json({ success: false, message: "Terminal ID is required" });
    }

    const productType = ensureString(req.query.productType, "PMS");

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

    const forecastData = {
      terminalId,
      productType,
      depotPrice: 0,
      refineryInfluenceScore: 0,
      importParityPrice: 0,
      demandIndex: 0,
      expectedMin: result.expectedMin,
      expectedMax: result.expectedMax,
      bias: result.bias,
      confidence: result.confidence,
      suggestedAction: result.suggestedAction,
    };

    const forecast = await storage.createForecast(forecastData);

    if (req.userId) {
      storage.incrementForecastCount?.(req.userId).catch(() => {});
    }
    
    onForecastCreated(terminalId, forecast).catch((err) =>
      console.error(`[Notify] Error in forecast notification: ${err.message}`)
    );

    return res.status(201).json({
      success: true,
      message: "Forecast generated from market signals",
      data: { terminal, forecast, signalSnapshot: signal },
    });
  } catch (err: any) {
    console.error("Error in generateForecast:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getForecastHistory(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.query.terminalId);
    const productType = ensureString(req.query.productType);
    const { page, limit, offset } = parsePagination(req.query, 50, 200);

    let allForecasts;
    if (terminalId) {
      const terminal = await storage.getTerminal(terminalId);
      if (!terminal) {
        return res.status(404).json({ success: false, message: "Terminal not found" });
      }
      allForecasts = await storage.getForecasts(terminalId, limit * page);
    } else {
      allForecasts = await storage.getAllForecasts(limit * page);
    }

    if (productType) {
      allForecasts = allForecasts.filter((f) => f.productType === productType);
    }

    const paginatedForecasts = allForecasts.slice(offset, offset + limit);

    return res.json({
      success: true,
      data: {
        forecasts: paginatedForecasts,
        pagination: {
          page,
          limit,
          total: allForecasts.length,
          hasMore: offset + limit < allForecasts.length,
        },
      },
    });
  } catch (err: any) {
    console.error("Error in getForecastHistory:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function scoreForecast(req: AuthRequest, res: Response) {
  try {
    const terminalId = ensureString(req.params.terminalId);
    if (!terminalId) {
      return res.status(400).json({ success: false, message: "Terminal ID is required" });
    }

    const productType = ensureString(req.query.productType, "PMS");

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signal = await storage.getLatestSignal(terminalId, productType);
    if (!signal) {
      return res.status(400).json({ success: false, message: "No market signals available for scoring" });
    }

    const [history, fxRates] = await Promise.all([
      storage.getPriceHistory(terminalId, 30, productType),
      storage.getFxRates(10),
    ]);

    const nnpcFeed = null;

    const score = computeForecastScore({
      signal,
      priceHistory: history,
      nnpcFeed,
      fxRates,
      productType,
    });

    const forecastData = {
      terminalId,
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
    };

    const forecast = await storage.createForecast(forecastData);

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
    console.error("Error in scoreForecast:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
