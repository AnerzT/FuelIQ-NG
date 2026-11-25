import { z } from "zod";
import {
  FUEL_FINDER_PRODUCTS,
  NIGERIAN_STATES,
  type FuelFinderProduct,
} from "../../shared/schema.js";

const availabilitySchema = z.enum(["available", "limited", "unavailable", "unknown"]);

const providerPriceSchema = z.object({
  product: z.enum(FUEL_FINDER_PRODUCTS),
  priceNaira: z.number().positive().max(100_000).nullable().optional(),
  availability: availabilitySchema.default("unknown"),
  observedAt: z.string().datetime(),
});

const providerStationSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(2).max(200),
  brand: z.string().min(1).max(120),
  state: z.enum(NIGERIAN_STATES),
  city: z.string().min(1).max(120),
  address: z.string().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  prices: z.array(providerPriceSchema).default([]),
}).refine((station) => (station.latitude == null) === (station.longitude == null), {
  message: "Coordinates must include both latitude and longitude",
});

const providerResponseSchema = z.object({
  stations: z.array(providerStationSchema),
});

export type AuthorizedNnpcStation = {
  id: string;
  name: string;
  brand: string;
  state: (typeof NIGERIAN_STATES)[number];
  city: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  prices: Array<{
    product: FuelFinderProduct;
    priceNaira?: number | null;
    availability: "available" | "limited" | "unavailable" | "unknown";
    observedAt: string;
  }>;
};

export function nnpcFuelFinderStatus() {
  return {
    configured: Boolean(process.env.NNPCL_API_KEY && process.env.NNPC_FUEL_FINDER_URL),
  };
}

export async function fetchAuthorizedNnpcStations(): Promise<AuthorizedNnpcStation[]> {
  const apiKey = process.env.NNPCL_API_KEY;
  const endpoint = process.env.NNPC_FUEL_FINDER_URL;
  if (!apiKey || !endpoint) {
    throw new Error("NNPC station feed is not configured. Set NNPCL_API_KEY and NNPC_FUEL_FINDER_URL on the server.");
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("NNPC_FUEL_FINDER_URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("NNPC_FUEL_FINDER_URL must use HTTPS.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`NNPC station feed returned HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    const parsed = providerResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("NNPC station feed response does not match the documented station schema.");
    const futureObservation = parsed.data.stations.some((station) => station.prices.some(
      (price) => new Date(price.observedAt).getTime() > Date.now() + 5 * 60_000,
    ));
    if (futureObservation) throw new Error("NNPC station feed contains a future-dated price observation.");
    return parsed.data.stations as AuthorizedNnpcStation[];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("NNPC station feed request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
