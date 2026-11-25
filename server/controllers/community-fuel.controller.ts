import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { COMMUNITY_FUEL_TYPES, NIGERIAN_STATES } from "../../shared/nigeria.js";
import {
  communityFuel,
  type BusinessRegistrationInput,
  type LocationKind,
  type PriceSubmissionInput,
} from "../services/community-fuel.service.js";

const coordinate = z.number().finite();
const priceSubmissionSchema = z.object({
  stationId: z.string().uuid().optional(),
  terminalId: z.string().uuid().optional(),
  locationName: z.string().trim().min(2).max(160),
  brand: z.string().trim().min(1).max(100),
  category: z.enum(["filling_station", "terminal"]),
  fuelType: z.enum(COMMUNITY_FUEL_TYPES),
  priceNaira: z.number().finite().positive().max(1_000_000),
  unit: z.enum(["litre", "kg"]),
  state: z.enum(NIGERIAN_STATES),
  lga: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  latitude: coordinate.min(4).max(14.5),
  longitude: coordinate.min(2).max(15.5),
  observedAt: z.coerce.date(),
  availability: z.enum(["available", "limited", "unavailable"]),
  comments: z.string().trim().max(500).optional(),
}).refine((value) => !(value.stationId && value.terminalId), {
  message: "Choose either a station or a terminal, not both.",
});

const businessSchema = z.object({
  name: z.string().trim().min(2).max(160),
  brand: z.string().trim().min(1).max(100),
  businessCategory: z.enum(["retail_filling_station", "petroleum_depot", "terminal", "other"]),
  operatorName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(7).max(25),
  businessEmail: z.string().trim().email().max(254),
  state: z.enum(NIGERIAN_STATES),
  lga: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  physicalAddress: z.string().trim().min(5).max(300),
  latitude: coordinate.min(4).max(14.5),
  longitude: coordinate.min(2).max(15.5),
  productsSold: z.array(z.enum(COMMUNITY_FUEL_TYPES)).min(1).max(4),
  operatingStatus: z.enum(["operating", "temporarily_closed", "closed", "unknown"]),
  businessRegistrationDetails: z.string().trim().max(160).optional(),
});
const businessPatchSchema = businessSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Include at least one editable business field.",
});
const submissionEditSchema = z.object({
  priceNaira: z.number().finite().positive().max(1_000_000),
  availability: z.enum(["available", "limited", "unavailable"]),
  comments: z.string().trim().max(500).optional(),
});

function userId(req: AuthRequest) {
  return req.userId || "";
}

function routeParam(req: AuthRequest, key: string) {
  const value = req.params[key];
  return typeof value === "string" ? value : "";
}

function sendError(res: Response, error: unknown) {
  const typed = error as { statusCode?: number; code?: string; message?: string };
  const status = typed.statusCode && typed.statusCode >= 400 && typed.statusCode < 600 ? typed.statusCode : 500;
  if (status >= 500) console.error("Community fuel request failed:", error);
  res.status(status).json({
    success: false,
    ...(typed.code ? { code: typed.code } : {}),
    message: status === 500 ? "Community fuel service is unavailable." : typed.message || "Invalid request.",
  });
}

function invalid(res: Response, issues: z.ZodIssue[]) {
  res.status(400).json({ success: false, message: issues[0]?.message || "Invalid request." });
}

export async function getCommunityMeta(_req: AuthRequest, res: Response) {
  res.json({
    success: true,
    data: {
      states: NIGERIAN_STATES,
      fuelTypes: COMMUNITY_FUEL_TYPES,
      categories: ["filling_station", "terminal"],
      accountApprovalRequired: true,
    },
  });
}

export async function getCommunityDashboard(req: AuthRequest, res: Response) {
  try {
    const period = req.query.period === "weekly" || req.query.period === "monthly" ? req.query.period : "daily";
    res.json({ success: true, data: await communityFuel.getCustomerDashboard(userId(req), period) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function listCommunitySubmissions(req: AuthRequest, res: Response) {
  try {
    res.json({ success: true, data: await communityFuel.listMySubmissions(userId(req)) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function submitCommunityPrice(req: AuthRequest, res: Response) {
  const parsed = priceSubmissionSchema.safeParse(req.body);
  if (parsed.success === false) return invalid(res, parsed.error.issues);
  const input = parsed.data as PriceSubmissionInput;
  if (input.observedAt.getTime() > Date.now() + 5 * 60_000) {
    res.status(400).json({ success: false, message: "Observation time cannot be in the future." });
    return;
  }
  try {
    const data = await communityFuel.submitPrice(userId(req), input);
    res.status(201).json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
}

export async function registerCommunityBusiness(req: AuthRequest, res: Response) {
  const kind = routeParam(req, "kind") as LocationKind;
  if (kind !== "station" && kind !== "terminal") {
    res.status(400).json({ success: false, message: "Business kind must be station or terminal." });
    return;
  }
  const parsed = businessSchema.safeParse(req.body);
  if (parsed.success === false) return invalid(res, parsed.error.issues);
  try {
    const input = parsed.data as BusinessRegistrationInput;
    const data = await communityFuel.registerBusiness(userId(req), kind, input);
    res.status(201).json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getMyCommunityLocations(req: AuthRequest, res: Response) {
  try {
    res.json({ success: true, data: await communityFuel.listMyLocations(userId(req)) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function updateMyCommunityLocation(req: AuthRequest, res: Response) {
  const kind = routeParam(req, "kind") as LocationKind;
  if (kind !== "station" && kind !== "terminal") {
    res.status(400).json({ success: false, message: "Business kind must be station or terminal." });
    return;
  }
  const parsed = businessPatchSchema.safeParse(req.body);
  if (parsed.success === false) return invalid(res, parsed.error.issues);
  try {
    const data = await communityFuel.updateOwnedBusiness(
      userId(req), kind, routeParam(req, "id"), parsed.data as Partial<BusinessRegistrationInput>,
    );
    res.status(data ? 200 : 404).json({ success: Boolean(data), data, message: data ? undefined : "Owned location not found." });
  } catch (error) {
    sendError(res, error);
  }
}

export async function editCommunitySubmission(req: AuthRequest, res: Response) {
  const parsed = submissionEditSchema.safeParse(req.body);
  if (parsed.success === false) return invalid(res, parsed.error.issues);
  try {
    const data = await communityFuel.updateOwnSubmission(
      userId(req),
      routeParam(req, "id"),
      parsed.data as { priceNaira: number; availability: "available" | "limited" | "unavailable"; comments?: string },
    );
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
}

export async function withdrawCommunitySubmission(req: AuthRequest, res: Response) {
  try {
    res.json({ success: true, data: await communityFuel.deleteOwnSubmission(userId(req), routeParam(req, "id")) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function confirmCommunityPrice(req: AuthRequest, res: Response) {
  const confirmation = req.body?.confirmation;
  if (confirmation !== "accurate" && confirmation !== "inaccurate") {
    res.status(400).json({ success: false, message: "Confirmation must be accurate or inaccurate." });
    return;
  }
  try {
    res.json({ success: true, data: await communityFuel.confirmPrice(userId(req), routeParam(req, "id"), confirmation) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function disputeCommunityPrice(req: AuthRequest, res: Response) {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const details = typeof req.body?.details === "string" ? req.body.details.trim() : undefined;
  if (reason.length < 3 || reason.length > 120 || (details && details.length > 1000)) {
    res.status(400).json({ success: false, message: "Provide a dispute reason (3–120 characters) and optional details (up to 1,000 characters)." });
    return;
  }
  try {
    res.status(201).json({ success: true, data: await communityFuel.createDispute(userId(req), routeParam(req, "id"), reason, details) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getCommunityNotifications(req: AuthRequest, res: Response) {
  try {
    res.json({ success: true, data: await communityFuel.getNotifications(userId(req)) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function readCommunityNotification(req: AuthRequest, res: Response) {
  try {
    const updated = await communityFuel.markNotificationRead(userId(req), routeParam(req, "id"));
    res.status(updated ? 200 : 404).json({ success: updated, message: updated ? undefined : "Notification not found." });
  } catch (error) {
    sendError(res, error);
  }
}

export async function updateCommunityPreferences(req: AuthRequest, res: Response) {
  const preferences = req.body?.preferences;
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    res.status(400).json({ success: false, message: "Notification preferences must be an object." });
    return;
  }
  try {
    res.json({ success: true, data: await communityFuel.setNotificationPreferences(userId(req), preferences) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getPublicCommunityPrices(req: AuthRequest, res: Response) {
  try {
    const filters = {
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      lga: typeof req.query.lga === "string" ? req.query.lga : undefined,
      city: typeof req.query.city === "string" ? req.query.city : undefined,
      brand: typeof req.query.brand === "string" ? req.query.brand : undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      fuelType: typeof req.query.fuelType === "string" ? req.query.fuelType : undefined,
    };
    res.json({ success: true, data: await communityFuel.getPublicDiscovery(filters) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getCommunityPriceHistory(req: AuthRequest, res: Response) {
  try {
    const history = await communityFuel.getPublicPriceHistory(routeParam(req, "id"));
    res.status(history ? 200 : 404).json({ success: Boolean(history), data: history, message: history ? undefined : "Published price history not found." });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getStationOwnerDashboard(req: AuthRequest, res: Response) {
  try {
    res.json({ success: true, data: await communityFuel.getStationOwnerDashboard(userId(req)) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function submitOperatorPrice(req: AuthRequest, res: Response) {
  const parsed = priceSubmissionSchema.safeParse(req.body);
  if (parsed.success === false) return invalid(res, parsed.error.issues);
  const input = parsed.data as PriceSubmissionInput;
  try {
    const locations = await communityFuel.listMyLocations(userId(req));
    const owned = input.stationId
      ? locations.stations.find((location) => location.id === input.stationId)
      : input.terminalId
        ? locations.terminals.find((location) => location.id === input.terminalId)
        : undefined;
    if (!owned || owned.approvalStatus !== "approved") {
      res.status(403).json({ success: false, message: "Operator updates require an approved location owned by your account." });
      return;
    }
    if (input.observedAt.getTime() > Date.now() + 5 * 60_000) {
      res.status(400).json({ success: false, message: "Observation time cannot be in the future." });
      return;
    }
    const data = await communityFuel.submitPrice(userId(req), input, "operator");
    res.status(201).json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminListCommunityAccounts(_req: AuthRequest, res: Response) {
  try {
    res.json({ success: true, data: await communityFuel.adminListAccounts() });
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminReviewCommunityAccount(req: AuthRequest, res: Response) {
  const status = req.body?.status;
  if (status !== "approved" && status !== "rejected" && status !== "suspended") {
    res.status(400).json({ success: false, message: "Account status must be approved, rejected or suspended." });
    return;
  }
  try {
    const data = await communityFuel.adminReviewAccount(routeParam(req, "id"), status, userId(req));
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminListCommunityBusinesses(req: AuthRequest, res: Response) {
  const kind = routeParam(req, "kind") as LocationKind;
  if (kind !== "station" && kind !== "terminal") {
    res.status(400).json({ success: false, message: "Business kind must be station or terminal." });
    return;
  }
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ success: true, data: await communityFuel.adminListBusinesses(kind, status) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminReviewCommunityBusiness(req: AuthRequest, res: Response) {
  const kind = routeParam(req, "kind") as LocationKind;
  const status = req.body?.status;
  if ((kind !== "station" && kind !== "terminal") || (status !== "approved" && status !== "rejected" && status !== "suspended")) {
    res.status(400).json({ success: false, message: "Provide a valid business kind and review status." });
    return;
  }
  try {
    const data = await communityFuel.adminReviewBusiness(kind, routeParam(req, "id"), status, userId(req));
    res.status(data ? 200 : 404).json({ success: Boolean(data), data, message: data ? undefined : "Pending registration not found." });
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminListCommunitySubmissions(req: AuthRequest, res: Response) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ success: true, data: await communityFuel.adminListSubmissions(status) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminReviewCommunitySubmission(req: AuthRequest, res: Response) {
  const status = req.body?.status;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;
  if (status !== "eligible" && status !== "rejected") {
    res.status(400).json({ success: false, message: "Review status must be eligible or rejected." });
    return;
  }
  try {
    const data = await communityFuel.adminReviewSubmission(routeParam(req, "id"), status, userId(req), reason);
    res.status(data ? 200 : 404).json({ success: Boolean(data), data, message: data ? undefined : "Price report not found." });
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminExportCommunitySubmissions(_req: AuthRequest, res: Response) {
  try {
    const csv = await communityFuel.exportSubmissionsCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="fuel-price-reports.csv"');
    res.send(csv);
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminListCommunityDisputes(_req: AuthRequest, res: Response) {
  try {
    res.json({ success: true, data: await communityFuel.adminListDisputes() });
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminResolveCommunityDispute(req: AuthRequest, res: Response) {
  const status = req.body?.status;
  const resolution = typeof req.body?.resolution === "string" ? req.body.resolution.trim() : "";
  if ((status !== "resolved" && status !== "dismissed") || resolution.length < 3 || resolution.length > 1000) {
    res.status(400).json({ success: false, message: "Provide a resolution status and explanation (3–1,000 characters)." });
    return;
  }
  try {
    const data = await communityFuel.adminResolveDispute(routeParam(req, "id"), status, resolution, userId(req));
    res.status(data ? 200 : 404).json({ success: Boolean(data), data, message: data ? undefined : "Open dispute not found." });
  } catch (error) {
    sendError(res, error);
  }
}
