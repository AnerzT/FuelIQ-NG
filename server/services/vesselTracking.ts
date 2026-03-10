import { storage } from "../storage.js";

const VESSEL_API_KEY = process.env.VESSEL_API_KEY || "";
const VESSEL_API_URL = process.env.VESSEL_API_URL || "https://services.marinetraffic.com/api/exportvessels/v:8";

interface VesselData {
  mmsi: string;
  shipName: string;
  shipType: number;
  eta: string;
  destination: string;
  lat: number;
  lon: number;
}

interface TerminalCoords {
  code: string;
  lat: number;
  lon: number;
  radius: number;
}

const TERMINAL_COORDINATES: Record<string, TerminalCoords> = {
  APT: { code: "APT", lat: 6.4400, lon: 3.3900, radius: 20 },
  CLB: { code: "CLB", lat: 4.9500, lon: 8.3200, radius: 15 },
  PHC: { code: "PHC", lat: 4.7800, lon: 7.0100, radius: 15 },
  WRI: { code: "WRI", lat: 5.5100, lon: 5.7600, radius: 15 },
  ONN: { code: "ONN", lat: 4.7200, lon: 7.1500, radius: 10 },
  BNY: { code: "BNY", lat: 4.4300, lon: 7.1600, radius: 10 },
  ATC: { code: "ATC", lat: 6.4100, lon: 3.3700, radius: 10 },
  IJG: { code: "IJG", lat: 6.4900, lon: 3.3100, radius: 10 },
};

const TANKER_SHIP_TYPES = [80, 81, 82, 83, 84, 85, 86, 87, 88, 89];

async function fetchVesselsNearTerminal(coords: TerminalCoords): Promise<VesselData[]> {
  if (!VESSEL_API_KEY) {
    return [];
  }

  try {
    const url = `${VESSEL_API_URL}/${VESSEL_API_KEY}/MINLAT:${coords.lat - 0.5}/MAXLAT:${coords.lat + 0.5}/MINLON:${coords.lon - 0.5}/MAXLON:${coords.lon + 0.5}/SHIPTYPE:7/protocol:jsono`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[Vessel] API returned ${response.status} for ${coords.code}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error(`[Vessel] Fetch failed for ${coords.code}: ${err.message}`);
    return [];
  }
}

function estimateDischargeHours(vesselCount: number): number {
  if (vesselCount === 0) return 0;
  if (vesselCount <= 2) return 48;
  if (vesselCount <= 5) return 72;
  return 96 + (vesselCount - 5) * 12;
}

function vesselCountToActivityLevel(count: number): "None" | "Low" | "Moderate" | "High" {
  if (count === 0) return "None";
  if (count <= 2) return "Low";
  if (count <= 5) return "Moderate";
  return "High";
}

function vesselCountToSupplyPressure(count: number): "weak" | "moderate" | "strong" {
  if (count <= 1) return "weak";
  if (count <= 4) return "moderate";
  return "strong";
}

function simulateVesselCount(terminalCode: string): number {
  const baseTraffic: Record<string, number> = {
    APT: 5, ATC: 3, IJG: 2, PHC: 4, WRI: 3, CLB: 2, ONN: 3, BNY: 2,
  };
  const base = baseTraffic[terminalCode] ?? 2;
  const variance = Math.floor(Math.random() * 4) - 1;
  return Math.max(0, base + variance);
}

export interface VesselTrackingResult {
  terminalCode: string;
  terminalId: string;
  vesselCount: number;
  activityLevel: "None" | "Low" | "Moderate" | "High";
  supplyPressure: "weak" | "moderate" | "strong";
  estimatedDischargeHours: number;
  source: "api" | "simulated";
}

export async function trackVesselsForTerminal(
  terminalCode: string,
  terminalId: string
): Promise<VesselTrackingResult> {
  const coords = TERMINAL_COORDINATES[terminalCode];
  let vesselCount: number;
  let source: "api" | "simulated";

  if (coords && VESSEL_API_KEY) {
    const vessels = await fetchVesselsNearTerminal(coords);
    if (vessels.length > 0) {
      const tankers = vessels.filter((v) => TANKER_SHIP_TYPES.includes(v.shipType));
      vesselCount = tankers.length;
      source = "api";
    } else {
      vesselCount = simulateVesselCount(terminalCode);
      source = "simulated";
      console.warn(`[Vessel] API returned no data for ${terminalCode}, using simulated fallback`);
    }
  } else {
    vesselCount = simulateVesselCount(terminalCode);
    source = "simulated";
  }

  const activityLevel = vesselCountToActivityLevel(vesselCount);
  const supplyPressure = vesselCountToSupplyPressure(vesselCount);
  const estimatedDischargeHours = estimateDischargeHours(vesselCount);

  console.log(
    `[Vessel] ${terminalCode}: ${vesselCount} tankers, activity=${activityLevel}, pressure=${supplyPressure}, ETA=${estimatedDischargeHours}h (${source})`
  );

  return {
    terminalCode,
    terminalId,
    vesselCount,
    activityLevel,
    supplyPressure,
    estimatedDischargeHours,
    source,
  };
}

export async function trackAllTerminals(): Promise<VesselTrackingResult[]> {
  const terminals = await storage.getTerminals();
  const activeTerminals = terminals.filter((t) => t.active);
  const results: VesselTrackingResult[] = [];

  for (const terminal of activeTerminals) {
    const result = await trackVesselsForTerminal(terminal.code, terminal.id);
    results.push(result);
  }

  return results;
}

export async function updateSignalsFromVesselData(): Promise<number> {
  const trackingResults = await trackAllTerminals();
  let updated = 0;

  for (const result of trackingResults) {
    try {
      const existingSignal = await storage.getLatestSignal(result.terminalId);

      await storage.createSignal({
        terminalId: result.terminalId,
        vesselActivity: result.activityLevel,
        truckQueue: existingSignal?.truckQueue ?? "Medium",
        nnpcSupply: result.supplyPressure === "strong" ? "Strong" : result.supplyPressure === "moderate" ? "Moderate" : "Weak",
        fxPressure: existingSignal?.fxPressure ?? "Medium",
        policyRisk: existingSignal?.policyRisk ?? "Low",
      });

      updated++;
    } catch (err: any) {
      console.error(`[Vessel] Signal update failed for ${result.terminalCode}: ${err.message}`);
    }
  }

  console.log(`[Vessel] Updated signals for ${updated} terminals`);
  return updated;
}
