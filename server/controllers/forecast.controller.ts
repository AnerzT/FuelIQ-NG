import type { Response } from "express";
import { storage } from "../storage";
import { insertForecastSchema } from "@shared/schema";
import type { AuthRequest } from "../middleware/auth";
import { computeForecast } from "../services/forecastEngine";

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

    return res.status(201).json({
      success: true,
      message: "Forecast generated from market signals",
      data: { terminal, forecast, signalSnapshot: signal },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
