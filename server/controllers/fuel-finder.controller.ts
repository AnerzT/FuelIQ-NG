import { z } from "zod";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import {
  FUEL_FINDER_PRODUCTS,
  NIGERIAN_STATES,
  type FuelFinderProduct,
} from "../../shared/schema.js";
import {
  fuelFinderStorage,
  type FuelFinderFilters,
  type NewFuelFinderPrice,
  type NewFuelFinderStation,
} from "../services/fuel-finder-storage.js";
import { fetchAuthorizedNnpcStations, nnpcFuelFinderStatus } from "../services/nnpc-fuel-finder-adapter.js";

const productSchema = z.enum(FUEL_FINDER_PRODUCTS);
const availabilitySchema = z.enum(["available", "limited", "unavailable", "unknown"]);
const stateSchema = z.enum(NIGERIAN_STATES);
const coordinate = z.number().finite();

const stationBaseSchema = z.object({
  name: z.string().trim().min(2).max(200),
  brand: z.string().trim().min(1).max(120),
  state: stateSchema,
  city: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).nullable().optional(),
  latitude: coordinate.min(-90).max(90).nullable().optional(),
  longitude: coordinate.min(-180).max(180).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  active: z.boolean().default(true),
});

const stationSchema = stationBaseSchema.refine((station) => (station.latitude == null) === (station.longitude == null), {
  message: "Coordinates must include both latitude and longitude",
});

const stationPatchSchema = stationBaseSchema.partial().refine(
  (patch) => Object.keys(patch).length > 0,
  { message: "At least one station field is required" },
).refine(
  (patch) => (patch.latitude === undefined && patch.longitude === undefined)
    || (patch.latitude === null && patch.longitude === null)
    || (patch.latitude != null && patch.longitude != null),
  { message: "Coordinates must be updated together" },
);

const manualPriceSchema = z.object({
  productType: productSchema,
  priceNaira: z.number().finite().positive().max(100_000),
  availability: availabilitySchema.default("unknown"),
  verified: z.boolean().default(false),
  observedAt: z.string().datetime().optional(),
});

const reportSchema = z.object({
  stationId: z.string().uuid(),
  productType: productSchema,
  availability: z.enum(["available", "limited", "unavailable"]),
  priceNaira: z.number().finite().positive().max(100_000).optional(),
  comment: z.string().trim().max(500).optional(),
});

const alertSchema = z.object({
  productType: productSchema,
  state: stateSchema,
  condition: z.enum(["at_or_below", "at_or_above"]),
  thresholdNaira: z.number().finite().positive().max(100_000),
});

type StationInput = {
  name: string;
  brand: string;
  state: (typeof NIGERIAN_STATES)[number];
  city: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  active: boolean;
};
type ReportInput = {
  stationId: string;
  productType: FuelFinderProduct;
  availability: "available" | "limited" | "unavailable";
  priceNaira?: number;
  comment?: string;
};
type AlertInput = {
  productType: FuelFinderProduct;
  state: (typeof NIGERIAN_STATES)[number];
  condition: "at_or_below" | "at_or_above";
  thresholdNaira: number;
};
type ManualPriceInput = {
  productType: FuelFinderProduct;
  priceNaira: number;
  availability: "available" | "limited" | "unavailable" | "unknown";
  verified: boolean;
  observedAt?: string;
};

function getUserId(req: AuthRequest): string | undefined {
  return (req as AuthRequest & { user?: { id?: string } }).user?.id;
}

function getParamId(req: AuthRequest): string {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function validationError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join("; ");
}

function parseRequest<T>(schema: z.ZodTypeAny, body: unknown, res: Response): T | null {
  try {
    return schema.parse(body) as T;
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    res.status(400).json({ success: false, message: validationError(error) });
    return null;
  }
}

export async function getFuelFinderMeta(_req: AuthRequest, res: Response) {
  try {
    const stations = await fuelFinderStorage.listStations();
    const citiesByState: Record<string, string[]> = {};
    for (const station of stations) {
      (citiesByState[station.state] ||= []).push(station.city);
    }
    for (const state of Object.keys(citiesByState)) {
      citiesByState[state] = [...new Set(citiesByState[state])].sort((a, b) => a.localeCompare(b));
    }
    return res.json({
      states: NIGERIAN_STATES,
      products: FUEL_FINDER_PRODUCTS,
      brands: [...new Set(stations.map((station) => station.brand))].sort((a, b) => a.localeCompare(b)),
      citiesByState,
      stationCount: stations.length,
      statesWithStations: Object.keys(citiesByState),
    });
  } catch (error) {
    console.error("Fuel finder metadata failed:", error);
    return res.status(500).json({ success: false, message: "Fuel finder data could not be loaded" });
  }
}

export async function getFuelFinderStations(req: AuthRequest, res: Response) {
  const state = typeof req.query.state === "string" && req.query.state ? req.query.state : undefined;
  const city = typeof req.query.city === "string" && req.query.city ? req.query.city : undefined;
  const brand = typeof req.query.brand === "string" && req.query.brand ? req.query.brand : undefined;
  const query = typeof req.query.q === "string" ? req.query.q.slice(0, 120) : undefined;
  if (state && !NIGERIAN_STATES.includes(state as (typeof NIGERIAN_STATES)[number])) {
    return res.status(400).json({ success: false, message: "Unknown Nigerian state" });
  }
  const filters: FuelFinderFilters = { state, city, brand, query };
  try {
    const stations = await fuelFinderStorage.listStations(filters);
    return res.json({ stations });
  } catch (error) {
    console.error("Fuel finder station search failed:", error);
    return res.status(500).json({ success: false, message: "Stations could not be loaded" });
  }
}

export async function createFuelFinderReport(req: AuthRequest, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
  const input = parseRequest<ReportInput>(reportSchema, req.body, res);
  if (!input) return;
  try {
    const station = await fuelFinderStorage.getStation(input.stationId);
    if (!station?.active) return res.status(404).json({ success: false, message: "Active station not found" });
    const report = await fuelFinderStorage.createReport({
      ...input,
      priceNaira: input.priceNaira ?? null,
      comment: input.comment || null,
      userId,
      status: "pending",
    });
    return res.status(201).json({ report });
  } catch (error) {
    console.error("Fuel finder report submission failed:", error);
    return res.status(500).json({ success: false, message: "Report could not be submitted" });
  }
}

export async function getUserFuelFinderAlerts(req: AuthRequest, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
  try {
    return res.json(await fuelFinderStorage.listUserAlerts(userId));
  } catch (error) {
    console.error("Fuel finder alerts failed:", error);
    return res.status(500).json({ success: false, message: "Alerts could not be loaded" });
  }
}

export async function createUserFuelFinderAlert(req: AuthRequest, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
  const input = parseRequest<AlertInput>(alertSchema, req.body, res);
  if (!input) return;
  try {
    const alert = await fuelFinderStorage.createAlert({
      ...input,
      userId,
      active: true,
    });
    return res.status(201).json({ alert });
  } catch (error) {
    console.error("Fuel finder alert creation failed:", error);
    return res.status(500).json({ success: false, message: "Price alert could not be created" });
  }
}

export async function deleteUserFuelFinderAlert(req: AuthRequest, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
  try {
    const deleted = await fuelFinderStorage.deleteUserAlert(getParamId(req), userId);
    return deleted
      ? res.status(204).end()
      : res.status(404).json({ success: false, message: "Alert not found" });
  } catch (error) {
    console.error("Fuel finder alert deletion failed:", error);
    return res.status(500).json({ success: false, message: "Alert could not be deleted" });
  }
}

export async function markFuelFinderAlertRead(req: AuthRequest, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
  try {
    const updated = await fuelFinderStorage.markEventRead(getParamId(req), userId);
    return updated
      ? res.status(204).end()
      : res.status(404).json({ success: false, message: "Notification not found" });
  } catch (error) {
    console.error("Fuel finder notification update failed:", error);
    return res.status(500).json({ success: false, message: "Notification could not be updated" });
  }
}

export async function adminGetFuelFinderStations(_req: AuthRequest, res: Response) {
  try {
    return res.json({ stations: await fuelFinderStorage.listStations({}, true) });
  } catch (error) {
    console.error("Admin fuel finder station list failed:", error);
    return res.status(500).json({ success: false, message: "Stations could not be loaded" });
  }
}

export async function adminCreateFuelFinderStation(req: AuthRequest, res: Response) {
  const input = parseRequest<StationInput>(stationSchema, req.body, res);
  if (!input) return;
  try {
    const station = await fuelFinderStorage.createStation({
      ...input,
      externalId: null,
      address: input.address || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      phone: input.phone || null,
    });
    return res.status(201).json({ station });
  } catch (error) {
    console.error("Admin fuel finder station creation failed:", error);
    return res.status(500).json({ success: false, message: "Station could not be created" });
  }
}

export async function adminUpdateFuelFinderStation(req: AuthRequest, res: Response) {
  const input = parseRequest<Partial<StationInput>>(stationPatchSchema, req.body, res);
  if (!input) return;
  try {
    const patch: Partial<NewFuelFinderStation> = {
      ...input,
      ...(input.address !== undefined ? { address: input.address || null } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude ?? null } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude ?? null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
    };
    const station = await fuelFinderStorage.updateStation(getParamId(req), patch);
    return station
      ? res.json({ station })
      : res.status(404).json({ success: false, message: "Station not found" });
  } catch (error) {
    console.error("Admin fuel finder station update failed:", error);
    return res.status(500).json({ success: false, message: "Station could not be updated" });
  }
}

export async function adminCreateFuelFinderPrice(req: AuthRequest, res: Response) {
  const input = parseRequest<ManualPriceInput>(manualPriceSchema, req.body, res);
  if (!input) return;
  const observedAt = input.observedAt ? new Date(input.observedAt) : new Date();
  if (observedAt.getTime() > Date.now() + 5 * 60_000) {
    return res.status(400).json({ success: false, message: "Observation time cannot be in the future" });
  }
  try {
    const station = await fuelFinderStorage.getStation(getParamId(req));
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });
    const userId = getUserId(req);
    const price = await fuelFinderStorage.recordPrice({
      stationId: station.id,
      productType: input.productType as FuelFinderProduct,
      priceNaira: input.priceNaira,
      availability: input.availability,
      source: "admin_manual",
      verificationStatus: input.verified ? "verified" : "manual",
      observedAt,
      createdBy: userId || null,
    } satisfies NewFuelFinderPrice);
    return res.status(201).json({ price });
  } catch (error) {
    console.error("Admin fuel finder price update failed:", error);
    return res.status(500).json({ success: false, message: "Price observation could not be saved" });
  }
}

export async function adminGetFuelFinderReports(req: AuthRequest, res: Response) {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  if (status && !["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid report status" });
  }
  try {
    return res.json({ reports: await fuelFinderStorage.listReports(status) });
  } catch (error) {
    console.error("Admin fuel finder report list failed:", error);
    return res.status(500).json({ success: false, message: "Reports could not be loaded" });
  }
}

export async function adminReviewFuelFinderReport(req: AuthRequest, res: Response) {
  const reviewSchema = z.object({ status: z.enum(["approved", "rejected"]) });
  const input = parseRequest<{ status: "approved" | "rejected" }>(reviewSchema, req.body, res);
  if (!input) return;
  try {
    const report = await fuelFinderStorage.reviewReport(getParamId(req), input.status, getUserId(req) || "admin");
    return report
      ? res.json({ report })
      : res.status(404).json({ success: false, message: "Pending report not found" });
  } catch (error) {
    console.error("Admin fuel finder report review failed:", error);
    return res.status(500).json({ success: false, message: "Report could not be reviewed" });
  }
}

export async function adminGetNnpcFuelFinderStatus(_req: AuthRequest, res: Response) {
  return res.json(nnpcFuelFinderStatus());
}

export async function adminSyncNnpcFuelFinder(_req: AuthRequest, res: Response) {
  try {
    const providerStations = await fetchAuthorizedNnpcStations();
    let stationsUpdated = 0;
    let pricesAdded = 0;
    for (const providerStation of providerStations) {
      const { id: externalId, prices, ...details } = providerStation;
      const existing = await fuelFinderStorage.findStationByExternalId(externalId);
      const station = existing
        ? await fuelFinderStorage.updateStation(existing.id, {
          ...details,
          externalId,
          ...(details.address !== undefined ? { address: details.address || null } : {}),
          ...(details.latitude !== undefined ? { latitude: details.latitude } : {}),
          ...(details.longitude !== undefined ? { longitude: details.longitude } : {}),
          ...(details.phone !== undefined ? { phone: details.phone || null } : {}),
        })
        : await fuelFinderStorage.createStation({
          ...details,
          externalId,
          address: details.address || null,
          latitude: details.latitude ?? null,
          longitude: details.longitude ?? null,
          phone: details.phone || null,
          active: true,
        });
      if (!station) throw new Error("A station returned by the authorized feed could not be saved.");
      stationsUpdated += 1;
      for (const item of prices) {
        await fuelFinderStorage.recordPrice({
          stationId: station.id,
          productType: item.product,
          priceNaira: item.priceNaira ?? null,
          availability: item.availability,
          source: "nnpc_api",
          verificationStatus: "verified",
          observedAt: new Date(item.observedAt),
          createdBy: null,
        });
        pricesAdded += 1;
      }
    }
    return res.json({ success: true, stationsUpdated, pricesAdded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "NNPC station feed sync failed";
    const status = message.includes("not configured") ? 503 : 502;
    if (status === 502) console.error("NNPC fuel finder sync failed:", error);
    return res.status(status).json({ success: false, message });
  }
}
