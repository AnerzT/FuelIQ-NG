import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { syncNnpcPriceFeed, syncAndRecalculateForecasts, getLatestNnpcPrice } from "../services/nnpcService";
import { trackAllTerminals, updateSignalsFromVesselData } from "../services/vesselTracking";
import { syncFxRate, getFxVolatility, updateFxPressureSignals } from "../services/fxService";
import { storage } from "../storage";

export async function getNnpcPrice(_req: AuthRequest, res: Response) {
  try {
    const feeds = await storage.getExternalPriceFeeds(undefined, 10);
    const nnpcFeeds = feeds.filter((f) => f.sourceName === "NNPC");
    const latest = nnpcFeeds[0] ?? null;

    return res.json({
      success: true,
      data: { latest, history: nnpcFeeds },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerNnpcSync(_req: AuthRequest, res: Response) {
  try {
    const result = await syncNnpcPriceFeed();
    return res.json({
      success: true,
      message: `NNPC price synced: ₦${result.price} (${result.source})`,
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerNnpcSyncAndRecalculate(_req: AuthRequest, res: Response) {
  try {
    const result = await syncAndRecalculateForecasts();
    return res.json({
      success: true,
      message: `NNPC price synced, ${result.forecastsUpdated} forecasts recalculated`,
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getVesselTracking(_req: AuthRequest, res: Response) {
  try {
    const results = await trackAllTerminals();
    return res.json({
      success: true,
      data: results,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerVesselSignalUpdate(_req: AuthRequest, res: Response) {
  try {
    const updated = await updateSignalsFromVesselData();
    return res.json({
      success: true,
      message: `Vessel data processed, ${updated} terminal signals updated`,
      data: { terminalsUpdated: updated },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getFxRate(_req: AuthRequest, res: Response) {
  try {
    const latest = await storage.getLatestFxRate();
    const volatility = await getFxVolatility();
    const history = await storage.getFxRates(30);

    return res.json({
      success: true,
      data: { latest, volatility, history },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerFxSync(_req: AuthRequest, res: Response) {
  try {
    const result = await syncFxRate();
    return res.json({
      success: true,
      message: `FX rate synced: USD/NGN ₦${result.rate} (${result.source})`,
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerFxSignalUpdate(_req: AuthRequest, res: Response) {
  try {
    const syncResult = await syncFxRate();
    const updated = await updateFxPressureSignals();
    return res.json({
      success: true,
      message: `FX synced at ₦${syncResult.rate}, ${updated} terminal signals updated`,
      data: { fxSync: syncResult, terminalsUpdated: updated },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getMarketOverview(_req: AuthRequest, res: Response) {
  try {
    const [nnpcFeeds, fxRate, fxVolatility, vesselData] = await Promise.all([
      storage.getExternalPriceFeedBySource("NNPC", 1),
      storage.getLatestFxRate(),
      getFxVolatility(),
      trackAllTerminals(),
    ]);

    return res.json({
      success: true,
      data: {
        nnpcPrice: nnpcFeeds[0]?.price ?? null,
        fxRate: fxRate?.rate ?? null,
        fxVolatility,
        vesselSummary: vesselData.map((v) => ({
          terminal: v.terminalCode,
          vessels: v.vesselCount,
          activity: v.activityLevel,
          pressure: v.supplyPressure,
        })),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
