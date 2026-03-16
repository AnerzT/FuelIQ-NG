import type { Response } from "express";
import { storage } from "../storage.js";
import { insertForecastSchema } from "../../shared/schema.js";
import type { AuthRequest } from "../middleware/auth.js";
import { computeForecast } from "../services/forecastEngine.js";
import { computeForecastScore } from "../services/forecastScoring.js";
import { onForecastCreated } from "../services/notificationOrchestrator.js";
import type { z } from "zod";

type ForecastInput = z.infer<typeof insertForecastSchema>;

export async function createForecast(req: AuthRequest, res: Response) {
  try {
    const parsed = insertForecastSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid input",
      });
    }

    const data = parsed.data as ForecastInput;
    const terminalId = String(data.terminalId);
    const productType = data.productType || "PMS";

    const terminal = await storage.getTerminal(terminalId);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const forecastData = {
      terminalId,
      productType,
      expectedMin: data.expectedMin,
      expectedMax: data.expectedMax,
      bias: data.bias,
      confidence: data.confidence,
      suggestedAction: data.suggestedAction,
      depotPrice: data.depotPrice || 0,
      refineryInfluenceScore: data.refineryInfluenceScore || 0,
      importParityPrice: data.importParityPrice || 0,
      demandIndex: data.demandIndex || 0,
    };

    const forecast = await storage.createForecast(forecastData);

    return res.status(201).json({
      success: true,
      message: "Forecast created successfully",
      data: forecast,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ... rest of your forecast controller functions
