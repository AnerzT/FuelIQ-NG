import { basename } from "node:path";
import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { fuelMarketplace } from "../services/fuel-marketplace.service.js";

const products = z.enum(["PMS", "AGO", "DPK", "LPG"]);
const id = z.string().uuid();
const date = z.string().datetime({ offset: true });
const listingSchema = z.object({
  title: z.string().trim().min(5).max(180),
  description: z.string().trim().min(10).max(5000),
  categoryId: z.string().trim().min(1).max(60),
  listingType: z.enum(["supply", "service"]).default("supply"),
  productType: products.optional(),
  quantity: z.number().positive().max(1_000_000_000).optional(),
  unit: z.string().trim().min(1).max(40).default("litres"),
  price: z.number().positive().max(1_000_000_000).optional(),
  minimumOrder: z.number().positive().max(1_000_000_000).optional(),
  state: z.string().trim().max(80).optional(),
  lga: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  deliveryAvailable: z.boolean().default(false),
  collectionAvailable: z.boolean().default(false),
  expiresAt: date,
});
const listingUpdateSchema = listingSchema.partial().extend({
  productType: products.nullable().optional(),
  quantity: z.number().positive().max(1_000_000_000).nullable().optional(),
  price: z.number().positive().max(1_000_000_000).nullable().optional(),
  minimumOrder: z.number().positive().max(1_000_000_000).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
  lga: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  availability: z.enum(["available", "limited", "unavailable"]).optional(),
  status: z.enum(["active", "paused", "sold", "archived"]).optional(),
});
const requestSchema = z.object({
  title: z.string().trim().min(5).max(180),
  productType: products,
  quantity: z.number().positive().max(1_000_000_000),
  targetPriceMin: z.number().positive().max(1_000_000_000).optional(),
  targetPriceMax: z.number().positive().max(1_000_000_000).optional(),
  state: z.string().trim().min(1).max(80),
  lga: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  deliveryRequired: z.boolean().default(false),
  requiredDeliveryDate: z.string().date().optional(),
  requirements: z.string().trim().max(3000).optional(),
  expiresAt: date,
});
const preferencesSchema = z.object({
  roles: z.array(z.enum(["supplier", "bulk_buyer", "retail_station_owner", "terminal_operator", "fuel_distributor", "transporter", "business_partner", "other"])).max(8).default([]),
  productsSupply: z.array(products).max(4).default([]),
  productsNeed: z.array(products).max(4).default([]),
  preferredStates: z.array(z.string().trim().min(1).max(80)).max(37).default([]),
  minQuantity: z.number().nonnegative().optional(),
  maxQuantity: z.number().nonnegative().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  deliveryRequired: z.boolean().default(false),
  marketplaceNotificationsEnabled: z.boolean().default(true),
});
const offerSchema = z.object({
  listingId: id.optional(),
  productType: products,
  quantity: z.number().positive().max(1_000_000_000),
  price: z.number().positive().max(1_000_000_000),
  deliveryTerms: z.string().trim().min(2).max(1000),
  location: z.string().trim().max(300),
  expiresAt: date,
  conditions: z.string().trim().max(2000).optional(),
});
type ListingInput = {
  title: string; description: string; categoryId: string; listingType: "supply" | "service";
  productType?: "PMS" | "AGO" | "DPK" | "LPG"; quantity?: number; unit: string; price?: number;
  minimumOrder?: number; state?: string; lga?: string; city?: string;
  deliveryAvailable: boolean; collectionAvailable: boolean; expiresAt: string;
};
type RequestInput = {
  title: string; productType: "PMS" | "AGO" | "DPK" | "LPG"; quantity: number;
  targetPriceMin?: number; targetPriceMax?: number; state: string; lga?: string; city?: string;
  deliveryRequired: boolean; requiredDeliveryDate?: string; requirements?: string; expiresAt: string;
};
type PreferencesInput = {
  roles: string[]; productsSupply: string[]; productsNeed: string[]; preferredStates: string[];
  minQuantity?: number; maxQuantity?: number; minPrice?: number; maxPrice?: number;
  deliveryRequired: boolean; marketplaceNotificationsEnabled: boolean;
};
type OfferInput = {
  listingId?: string; productType: "PMS" | "AGO" | "DPK" | "LPG"; quantity: number; price: number;
  deliveryTerms: string; location: string; expiresAt: string; conditions?: string;
};
const idParam = (req: AuthRequest, key: string) => {
  const value = req.params[key];
  return id.safeParse(Array.isArray(value) ? value[0] : value);
};
const userId = (req: AuthRequest) => String(req.userId || "");

function errorResponse(res: Response, error: unknown) {
  const candidate = error as { statusCode?: number; message?: string; code?: string };
  if (candidate?.code === "42P01") {
    return res.status(503).json({ success: false, message: "Marketplace database migration 0005 has not been applied." });
  }
  const status = Number.isInteger(candidate?.statusCode) ? candidate.statusCode as number : 500;
  if (status >= 500) {
    console.error("Fuel marketplace request failed:", error);
    return res.status(status).json({ success: false, message: "Marketplace service is temporarily unavailable." });
  }
  return res.status(status).json({ success: false, message: candidate?.message || "Marketplace request failed." });
}

function send(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

function validExpiry(value: string) {
  const timestamp = new Date(value).getTime();
  return timestamp > Date.now() && timestamp <= Date.now() + 90 * 24 * 60 * 60 * 1000;
}

export async function listMarketplaceCategories(req: AuthRequest, res: Response) {
  try { return send(res, await fuelMarketplace.listCategories(userId(req))); }
  catch (error) { return errorResponse(res, error); }
}

export async function listMarketplaceListings(req: AuthRequest, res: Response) {
  const numeric = (key: string) => {
    const raw = req.query[key];
    if (typeof raw !== "string" || raw.trim() === "") return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };
  try {
    return send(res, await fuelMarketplace.listListings(userId(req), {
      q: typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : undefined,
      product: typeof req.query.product === "string" ? products.safeParse(req.query.product).data : undefined,
      category: typeof req.query.category === "string" ? req.query.category.slice(0, 60) : undefined,
      state: typeof req.query.state === "string" ? req.query.state.slice(0, 80) : undefined,
      lga: typeof req.query.lga === "string" ? req.query.lga.slice(0, 100) : undefined,
      city: typeof req.query.city === "string" ? req.query.city.slice(0, 100) : undefined,
      minPrice: numeric("minPrice"), maxPrice: numeric("maxPrice"), minQuantity: numeric("minQuantity"),
      delivery: req.query.delivery === "true", verified: req.query.verified === "true",
      sort: ["price_asc", "quantity_desc", "recent", "verified", "relevant"].includes(String(req.query.sort))
        ? req.query.sort as "price_asc" | "quantity_desc" | "recent" | "verified" | "relevant" : "relevant",
    }));
  } catch (error) { return errorResponse(res, error); }
}

export async function getMarketplaceDashboard(req: AuthRequest, res: Response) {
  try { return send(res, await fuelMarketplace.getDashboard(userId(req))); }
  catch (error) { return errorResponse(res, error); }
}

export async function createMarketplaceListing(req: AuthRequest, res: Response) {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid listing." });
  if (!validExpiry(parsed.data.expiresAt)) return res.status(400).json({ success: false, message: "Listings can expire between now and 90 days from now." });
  try { return send(res, await fuelMarketplace.createListing(userId(req), parsed.data as ListingInput), 201); }
  catch (error) { return errorResponse(res, error); }
}

export async function uploadMarketplaceListingDocument(req: AuthRequest, res: Response) {
  const listingId = idParam(req, "listingId");
  const bytes = Buffer.isBuffer(req.body) ? req.body : null;
  const fileName = typeof req.headers["x-file-name"] === "string" ? basename(req.headers["x-file-name"]) : "";
  const mimeType = typeof req.headers["x-file-type"] === "string" ? req.headers["x-file-type"] : "";
  if (!listingId.success || !bytes || !fileName || fileName.length > 180) {
    return res.status(400).json({ success: false, message: "Invalid listing document upload." });
  }
  try { return send(res, await fuelMarketplace.uploadListingDocument(userId(req), listingId.data, bytes, fileName, mimeType), 201); }
  catch (error) { return errorResponse(res, error); }
}

export async function getMarketplaceListingDocument(req: AuthRequest, res: Response) {
  const documentId = idParam(req, "id");
  if (!documentId.success) return res.status(400).json({ success: false, message: "Invalid listing document." });
  try { return send(res, await fuelMarketplace.getListingDocumentUrl(userId(req), documentId.data)); }
  catch (error) { return errorResponse(res, error); }
}

export async function adminGetMarketplaceListingDocument(req: AuthRequest, res: Response) {
  const documentId = idParam(req, "id");
  if (!documentId.success) return res.status(400).json({ success: false, message: "Invalid listing document." });
  try { return send(res, await fuelMarketplace.getListingDocumentUrl(userId(req), documentId.data, true)); }
  catch (error) { return errorResponse(res, error); }
}

export async function updateMarketplaceListing(req: AuthRequest, res: Response) {
  const listingId = idParam(req, "id");
  const parsed = listingUpdateSchema.safeParse(req.body);
  if (!listingId.success || !parsed.success) return res.status(400).json({ success: false, message: "Invalid listing update." });
  if (parsed.data.expiresAt && !validExpiry(parsed.data.expiresAt)) return res.status(400).json({ success: false, message: "Renewal expiry must be within the next 90 days." });
  try { return send(res, await fuelMarketplace.updateListing(userId(req), listingId.data, parsed.data)); }
  catch (error) { return errorResponse(res, error); }
}

export async function createBuyerRequest(req: AuthRequest, res: Response) {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid procurement request." });
  if (!validExpiry(parsed.data.expiresAt)) return res.status(400).json({ success: false, message: "Requests can expire between now and 90 days from now." });
  try { return send(res, await fuelMarketplace.createBuyerRequest(userId(req), parsed.data as RequestInput), 201); }
  catch (error) { return errorResponse(res, error); }
}

export async function listBuyerRequests(req: AuthRequest, res: Response) {
  try { return send(res, await fuelMarketplace.listBuyerRequests(userId(req))); }
  catch (error) { return errorResponse(res, error); }
}

export async function updateBuyerRequest(req: AuthRequest, res: Response) {
  const requestId = idParam(req, "id");
  const status = req.body?.status;
  const expiresAt = req.body?.expiresAt;
  if (!requestId.success || !["open", "paused", "closed"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid procurement request update." });
  }
  if (expiresAt !== undefined && (typeof expiresAt !== "string" || !validExpiry(expiresAt))) {
    return res.status(400).json({ success: false, message: "Renewal expiry must be within the next 90 days." });
  }
  try { return send(res, await fuelMarketplace.updateBuyerRequest(userId(req), requestId.data, status, expiresAt)); }
  catch (error) { return errorResponse(res, error); }
}

export async function saveBusinessPreferences(req: AuthRequest, res: Response) {
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid business preferences." });
  try { return send(res, await fuelMarketplace.savePreferences(userId(req), parsed.data as PreferencesInput)); }
  catch (error) { return errorResponse(res, error); }
}

export async function getBusinessPreferences(req: AuthRequest, res: Response) {
  try { return send(res, await fuelMarketplace.getPreferences(userId(req))); }
  catch (error) { return errorResponse(res, error); }
}

export async function createSupplierOffer(req: AuthRequest, res: Response) {
  const requestId = idParam(req, "requestId");
  const parsed = offerSchema.safeParse(req.body);
  if (!requestId.success || !parsed.success) return res.status(400).json({ success: false, message: "Invalid supplier offer." });
  if (!validExpiry(parsed.data.expiresAt)) return res.status(400).json({ success: false, message: "Offer expiry must be within the next 90 days." });
  try { return send(res, await fuelMarketplace.createOffer(userId(req), requestId.data, parsed.data as OfferInput), 201); }
  catch (error) { return errorResponse(res, error); }
}

export async function reviewSupplierOffer(req: AuthRequest, res: Response) {
  const offerId = idParam(req, "id");
  const action = req.body?.action;
  if (!offerId.success || !["accept", "decline"].includes(action)) return res.status(400).json({ success: false, message: "Choose accept or decline for a valid offer." });
  try { return send(res, await fuelMarketplace.reviewOffer(userId(req), offerId.data, action)); }
  catch (error) { return errorResponse(res, error); }
}

export async function createMarketplaceEnquiry(req: AuthRequest, res: Response) {
  const listingId = idParam(req, "listingId");
  const message = z.string().trim().min(2).max(3000).safeParse(req.body?.message);
  if (!listingId.success || !message.success) return res.status(400).json({ success: false, message: "Enter a valid enquiry." });
  try { return send(res, await fuelMarketplace.createEnquiry(userId(req), listingId.data, message.data), 201); }
  catch (error) { return errorResponse(res, error); }
}

export async function reportMarketplaceListing(req: AuthRequest, res: Response) {
  const listingId = idParam(req, "listingId");
  const reason = z.string().trim().min(3).max(1000).safeParse(req.body?.reason);
  if (!listingId.success || !reason.success) return res.status(400).json({ success: false, message: "Enter a report reason." });
  try { return send(res, await fuelMarketplace.reportListing(userId(req), listingId.data, reason.data), 201); }
  catch (error) { return errorResponse(res, error); }
}

export async function listMarketplaceNotifications(req: AuthRequest, res: Response) {
  try { return send(res, await fuelMarketplace.listNotifications(userId(req))); }
  catch (error) { return errorResponse(res, error); }
}

export async function markMarketplaceNotificationRead(req: AuthRequest, res: Response) {
  const notificationId = idParam(req, "id");
  if (!notificationId.success) return res.status(400).json({ success: false, message: "Invalid notification." });
  try { return send(res, await fuelMarketplace.markNotificationRead(userId(req), notificationId.data)); }
  catch (error) { return errorResponse(res, error); }
}

export async function adminListMarketplaceReports(req: AuthRequest, res: Response) {
  try { return send(res, await fuelMarketplace.adminListReports(userId(req))); }
  catch (error) { return errorResponse(res, error); }
}

export async function adminReviewMarketplaceReport(req: AuthRequest, res: Response) {
  const reportId = idParam(req, "id");
  const action = req.body?.action;
  const resolution = z.string().trim().min(3).max(1000).safeParse(req.body?.resolution);
  if (!reportId.success || !["dismiss", "remove_listing", "restore_listing"].includes(action) || !resolution.success) {
    return res.status(400).json({ success: false, message: "Invalid report review." });
  }
  try { return send(res, await fuelMarketplace.adminReviewReport(userId(req), reportId.data, action, resolution.data)); }
  catch (error) { return errorResponse(res, error); }
}
