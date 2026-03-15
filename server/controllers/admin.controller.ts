import type { Response } from "express";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";

export async function adminGetTerminals(req: AuthRequest, res: Response) {
  try {
    const terminalList = await storage.getTerminals();
    return res.json({ success: true, data: terminalList });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminToggleTerminal(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const terminal = await storage.getTerminal(id);
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const active = req.body.active !== undefined ? Boolean(req.body.active) : !terminal.active;
    const updated = await storage.updateTerminal(id, { active });

    return res.json({
      success: true,
      message: `Terminal ${updated?.active ? "activated" : "deactivated"} successfully`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminCreateForecast(req: AuthRequest, res: Response) {
  try {
    const { terminalId, productType, expectedMin, expectedMax, bias, confidence, suggestedAction } = req.body;

    if (!terminalId) {
      return res.status(400).json({ success: false, message: "terminalId is required" });
    }

    const terminal = await storage.getTerminal(String(terminalId));
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const forecast = await storage.createForecast({
      terminalId: String(terminalId),
      productType: productType || "PMS",
      expectedMin: Number(expectedMin),
      expectedMax: Number(expectedMax),
      bias: bias || "neutral",
      confidence: Number(confidence) || 70,
      suggestedAction: suggestedAction || "",
      depotPrice: 0,
      refineryInfluenceScore: 0,
      importParityPrice: 0,
      demandIndex: 0,
    } as any);

    return res.status(201).json({
      success: true,
      message: "Forecast created successfully",
      data: forecast,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminUpdateSignal(req: AuthRequest, res: Response) {
  try {
    const { terminalId, productType, vesselActivity, truckQueue, nnpcSupply, fxPressure, policyRisk, signalType, value, description } = req.body;

    if (!terminalId) {
      return res.status(400).json({ success: false, message: "terminalId is required" });
    }

    const terminal = await storage.getTerminal(String(terminalId));
    if (!terminal) {
      return res.status(404).json({ success: false, message: "Terminal not found" });
    }

    const signal = await storage.createSignal({
      terminalId: String(terminalId),
      productType: productType || "PMS",
      vesselActivity: vesselActivity || null,
      truckQueue: truckQueue || null,
      nnpcSupply: nnpcSupply || null,
      fxPressure: fxPressure || null,
      policyRisk: policyRisk || null,
      signalType: signalType || null,
      value: value ? Number(value) : null,
      description: description || null,
    } as any);

    return res.status(201).json({
      success: true,
      message: "Market signal updated successfully",
      data: signal,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminGetForecasts(req: AuthRequest, res: Response) {
  try {
    const { terminalId } = req.query;
    const limit = parseInt(req.query.limit as string) || 50;

    let data;
    if (terminalId && typeof terminalId === "string") {
      data = await storage.getForecasts(terminalId, limit);
    } else {
      data = await storage.getAllForecasts(limit);
    }

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
