import { basename } from "node:path";
import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { businessMessaging } from "../services/business-messaging.service.js";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  businessName: z.string().trim().max(160).optional(),
  businessCategory: z.enum(["station_operator", "terminal_operator", "fuel_marketer", "distributor", "supplier", "transport_logistics", "other"]),
  stationName: z.string().trim().max(160).optional(),
  terminalName: z.string().trim().max(160).optional(),
  state: z.string().trim().max(80).optional(),
  lga: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  products: z.array(z.enum(["PMS", "AGO", "DPK", "LPG"])).max(4).default([]),
  businessContactPublic: z.boolean().default(false),
});
const idParam = z.string().uuid();
type BusinessProfileInput = {
  displayName: string;
  businessName?: string;
  businessCategory: string;
  stationName?: string;
  terminalName?: string;
  state?: string;
  lga?: string;
  city?: string;
  products: string[];
  businessContactPublic: boolean;
};
type BusinessEnquiryInput = {
  productType: "PMS" | "AGO" | "DPK" | "LPG";
  quantity?: number;
  proposedPrice?: number;
  deliveryLocation?: string;
  preferredDeliveryDate?: string;
  requirements?: string;
};
const userId = (req: AuthRequest) => String(req.userId || "");
const param = (req: AuthRequest, key: string) => {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] || "" : value || "";
};

function reportError(res: Response, error: unknown) {
  const candidate = error as { statusCode?: number; message?: string; code?: string };
  if (candidate?.code === "42P01") {
    res.status(503).json({ success: false, message: "Messaging database migrations have not been applied." });
    return;
  }
  const status = Number.isInteger(candidate?.statusCode) ? candidate.statusCode as number : 500;
  if (status >= 500) {
    console.error("Business messaging request failed:", error);
    res.status(status).json({ success: false, message: "Messaging service is temporarily unavailable." });
    return;
  }
  res.status(status).json({ success: false, message: candidate?.message || "Messaging request failed." });
}

function ok(res: Response, data: unknown, status = 200) {
  res.status(status).json({ success: true, data });
}

export async function searchBusinesses(req: AuthRequest, res: Response) {
  try {
    const filters = {
      q: typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : undefined,
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      lga: typeof req.query.lga === "string" ? req.query.lga : undefined,
      city: typeof req.query.city === "string" ? req.query.city : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      product: typeof req.query.product === "string" ? req.query.product : undefined,
      verified: req.query.verified === "true",
    };
    ok(res, await businessMessaging.searchBusinesses(userId(req), filters));
  } catch (error) {
    reportError(res, error);
  }
}

export async function getBusinessProfile(req: AuthRequest, res: Response) {
  try {
    const id = param(req, "userId");
    if (!id) return res.status(400).json({ success: false, message: "Invalid customer." });
    ok(res, await businessMessaging.getPublicBusinessProfile(userId(req), id));
  } catch (error) {
    reportError(res, error);
  }
}

export async function getMyBusinessProfile(req: AuthRequest, res: Response) {
  try {
    ok(res, await businessMessaging.getMyBusinessProfile(userId(req)));
  } catch (error) {
    reportError(res, error);
  }
}

export async function updateBusinessProfile(req: AuthRequest, res: Response) {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid business profile." });
  try {
    ok(res, await businessMessaging.saveBusinessProfile(userId(req), parsed.data as BusinessProfileInput));
  } catch (error) {
    reportError(res, error);
  }
}

export async function listConnections(req: AuthRequest, res: Response) {
  try {
    const [connections, requests] = await Promise.all([
      businessMessaging.listConnections(userId(req)),
      businessMessaging.listConnectionRequests(userId(req)),
    ]);
    ok(res, { connections, requests });
  } catch (error) {
    reportError(res, error);
  }
}

export async function createConnectionRequest(req: AuthRequest, res: Response) {
  const targetId = typeof req.body?.targetUserId === "string" ? req.body.targetUserId : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 500) : undefined;
  if (!targetId || targetId.length > 128) return res.status(400).json({ success: false, message: "A valid customer is required." });
  try {
    ok(res, await businessMessaging.requestConnection(userId(req), targetId, message), 201);
  } catch (error) {
    reportError(res, error);
  }
}

export async function updateConnectionRequest(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "id"));
  const action = req.body?.action;
  if (!id.success || !["accept", "reject", "cancel"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid connection request or action." });
  }
  try {
    ok(res, await businessMessaging.updateConnectionRequest(userId(req), id.data, action));
  } catch (error) {
    reportError(res, error);
  }
}

export async function listConversations(req: AuthRequest, res: Response) {
  try {
    ok(res, await businessMessaging.listConversations(userId(req)));
  } catch (error) {
    reportError(res, error);
  }
}

export async function messagingDashboardSummary(req: AuthRequest, res: Response) {
  try {
    ok(res, await businessMessaging.getDashboardSummary(userId(req)));
  } catch (error) {
    reportError(res, error);
  }
}

export async function createConversation(req: AuthRequest, res: Response) {
  const targetId = typeof req.body?.targetUserId === "string" ? req.body.targetUserId : "";
  if (!targetId || targetId.length > 128) return res.status(400).json({ success: false, message: "A valid connected customer is required." });
  try {
    ok(res, await businessMessaging.createConversation(userId(req), targetId), 201);
  } catch (error) {
    reportError(res, error);
  }
}

export async function listMessages(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "conversationId"));
  if (!id.success) return res.status(400).json({ success: false, message: "Invalid conversation." });
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : undefined;
    ok(res, await businessMessaging.listMessages(userId(req), id.data, q));
  } catch (error) {
    reportError(res, error);
  }
}

export async function sendMessage(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "conversationId"));
  const body = typeof req.body?.body === "string" ? req.body.body : "";
  const replyId = req.body?.replyToMessageId;
  if (!id.success || (replyId !== undefined && !idParam.safeParse(replyId).success)) {
    return res.status(400).json({ success: false, message: "Invalid conversation or reply target." });
  }
  try {
    ok(res, await businessMessaging.sendMessage(userId(req), id.data, body, replyId), 201);
  } catch (error) {
    reportError(res, error);
  }
}

export async function setConversationState(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "conversationId"));
  if (!id.success) return res.status(400).json({ success: false, message: "Invalid conversation." });
  const archived = typeof req.body?.archived === "boolean" ? req.body.archived : undefined;
  let muteUntil: Date | null | undefined;
  if (req.body?.muteUntil === null) muteUntil = null;
  else if (typeof req.body?.muteUntil === "string") {
    muteUntil = new Date(req.body.muteUntil);
    if (Number.isNaN(muteUntil.getTime())) return res.status(400).json({ success: false, message: "Invalid mute expiry." });
  }
  try {
    ok(res, await businessMessaging.setConversationState(userId(req), id.data, { archived, muteUntil }));
  } catch (error) {
    reportError(res, error);
  }
}

export async function markConversationRead(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "conversationId"));
  if (!id.success) return res.status(400).json({ success: false, message: "Invalid conversation." });
  try {
    ok(res, await businessMessaging.markRead(userId(req), id.data));
  } catch (error) {
    reportError(res, error);
  }
}

export async function setTyping(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "conversationId"));
  if (!id.success || typeof req.body?.isTyping !== "boolean") {
    return res.status(400).json({ success: false, message: "Invalid typing status." });
  }
  try {
    ok(res, await businessMessaging.setTyping(userId(req), id.data, req.body.isTyping));
  } catch (error) {
    reportError(res, error);
  }
}

export async function listTyping(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "conversationId"));
  if (!id.success) return res.status(400).json({ success: false, message: "Invalid conversation." });
  try {
    ok(res, await businessMessaging.listTyping(userId(req), id.data));
  } catch (error) {
    reportError(res, error);
  }
}

export async function editMessage(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "messageId"));
  if (!id.success || typeof req.body?.body !== "string") return res.status(400).json({ success: false, message: "Invalid message." });
  try {
    ok(res, await businessMessaging.editMessage(userId(req), id.data, req.body.body));
  } catch (error) {
    reportError(res, error);
  }
}

export async function deleteMessage(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "messageId"));
  if (!id.success) return res.status(400).json({ success: false, message: "Invalid message." });
  try {
    ok(res, await businessMessaging.deleteMessage(userId(req), id.data));
  } catch (error) {
    reportError(res, error);
  }
}

export async function blockCustomer(req: AuthRequest, res: Response) {
  const targetId = typeof req.body?.targetUserId === "string" ? req.body.targetUserId : "";
  if (!targetId || targetId.length > 128) return res.status(400).json({ success: false, message: "A valid customer is required." });
  try {
    ok(res, await businessMessaging.blockUser(userId(req), targetId));
  } catch (error) {
    reportError(res, error);
  }
}

export async function listBlockedCustomers(req: AuthRequest, res: Response) {
  try {
    ok(res, await businessMessaging.listBlockedUsers(userId(req)));
  } catch (error) {
    reportError(res, error);
  }
}

export async function unblockCustomer(req: AuthRequest, res: Response) {
  const targetId = typeof req.body?.targetUserId === "string" ? req.body.targetUserId : "";
  if (!targetId || targetId.length > 128) return res.status(400).json({ success: false, message: "A valid customer is required." });
  try {
    ok(res, await businessMessaging.unblockUser(userId(req), targetId));
  } catch (error) {
    reportError(res, error);
  }
}

export async function reportCustomerOrMessage(req: AuthRequest, res: Response) {
  const reportedUserId = req.body?.reportedUserId;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const messageId = req.body?.messageId;
  const conversationId = req.body?.conversationId;
  if (typeof reportedUserId !== "string" || reportedUserId.length > 128 || reason.length < 3 || reason.length > 1000
    || (messageId !== undefined && !idParam.safeParse(messageId).success)
    || (conversationId !== undefined && !idParam.safeParse(conversationId).success)) {
    return res.status(400).json({ success: false, message: "Provide a valid report reason and target." });
  }
  try {
    ok(res, await businessMessaging.reportMessage(userId(req), { reportedUserId, messageId, conversationId, reason }), 201);
  } catch (error) {
    reportError(res, error);
  }
}

export async function sendBusinessEnquiry(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "conversationId"));
  const parsed = z.object({
    productType: z.enum(["PMS", "AGO", "DPK", "LPG"]),
    quantity: z.number().positive().max(1_000_000_000).optional(),
    proposedPrice: z.number().positive().max(1_000_000_000).optional(),
    deliveryLocation: z.string().trim().max(300).optional(),
    preferredDeliveryDate: z.string().date().optional(),
    requirements: z.string().trim().max(2000).optional(),
  }).safeParse(req.body);
  if (!id.success || !parsed.success) return res.status(400).json({ success: false, message: "Invalid business enquiry." });
  try {
    ok(res, await businessMessaging.sendEnquiry(userId(req), id.data, parsed.data as BusinessEnquiryInput), 201);
  } catch (error) {
    reportError(res, error);
  }
}

export async function listChatNotifications(req: AuthRequest, res: Response) {
  try {
    ok(res, await businessMessaging.listNotifications(userId(req)));
  } catch (error) {
    reportError(res, error);
  }
}

export async function getChatPreferences(req: AuthRequest, res: Response) {
  try {
    ok(res, await businessMessaging.getPreferences(userId(req)));
  } catch (error) {
    reportError(res, error);
  }
}

export async function updateChatPreferences(req: AuthRequest, res: Response) {
  const body: { notificationsEnabled?: boolean; showMessagePreviews?: boolean } = {};
  if (typeof req.body?.notificationsEnabled === "boolean") body.notificationsEnabled = req.body.notificationsEnabled;
  if (typeof req.body?.showMessagePreviews === "boolean") body.showMessagePreviews = req.body.showMessagePreviews;
  if (!Object.keys(body).length) return res.status(400).json({ success: false, message: "Choose a messaging preference to update." });
  try {
    ok(res, await businessMessaging.updatePreferences(userId(req), body));
  } catch (error) {
    reportError(res, error);
  }
}

export async function readChatNotification(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "id"));
  if (!id.success) return res.status(400).json({ success: false, message: "Invalid notification." });
  try {
    ok(res, await businessMessaging.markNotificationRead(userId(req), id.data));
  } catch (error) {
    reportError(res, error);
  }
}

export async function uploadMessageAttachment(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "messageId"));
  if (!id.success || !Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, message: "Upload an attachment as a binary request body." });
  const fileName = basename(String(req.headers["x-file-name"] || "attachment")).replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180);
  const mimeType = String(req.headers["x-file-type"] || "").toLowerCase();
  try {
    ok(res, await businessMessaging.createAttachment(userId(req), id.data, fileName, mimeType, req.body), 201);
  } catch (error) {
    reportError(res, error);
  }
}

export async function getMessageAttachment(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "id"));
  if (!id.success) return res.status(400).json({ success: false, message: "Invalid attachment." });
  try {
    ok(res, await businessMessaging.getAttachmentUrl(userId(req), id.data));
  } catch (error) {
    reportError(res, error);
  }
}

export async function streamMessagingEvents(req: AuthRequest, res: Response) {
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  businessMessaging.subscribe(userId(req), res);
}

export async function adminListMessageReports(req: AuthRequest, res: Response) {
  try {
    ok(res, await businessMessaging.adminListReports(userId(req)));
  } catch (error) {
    reportError(res, error);
  }
}

export async function adminListBusinessProfiles(req: AuthRequest, res: Response) {
  try {
    ok(res, await businessMessaging.adminListBusinesses(userId(req)));
  } catch (error) {
    reportError(res, error);
  }
}

export async function adminReviewBusinessProfile(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "id"));
  const verified = req.body?.verified;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
  if (!id.success || typeof verified !== "boolean" || reason.length < 3) {
    return res.status(400).json({ success: false, message: "A business verification decision and reason are required." });
  }
  try {
    ok(res, await businessMessaging.adminReviewBusiness(userId(req), id.data, verified, reason));
  } catch (error) {
    reportError(res, error);
  }
}

export async function adminSetMessagingSuspension(req: AuthRequest, res: Response) {
  const targetId = param(req, "userId");
  const suspend = req.body?.suspend;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
  const expiryValue = req.body?.expiresAt;
  const expiresAt = typeof expiryValue === "string" ? new Date(expiryValue) : null;
  if (!targetId || targetId.length > 128 || typeof suspend !== "boolean" || reason.length < 3
    || (typeof expiryValue === "string" && (Number.isNaN(expiresAt?.getTime()) || expiresAt!.getTime() <= Date.now()))) {
    return res.status(400).json({ success: false, message: "A valid suspension decision and reason are required." });
  }
  try {
    ok(res, await businessMessaging.adminSetMessagingSuspension(userId(req), targetId, suspend, reason, expiresAt));
  } catch (error) {
    reportError(res, error);
  }
}

export async function adminListMessagingAudit(req: AuthRequest, res: Response) {
  try {
    ok(res, await businessMessaging.adminListAudit(userId(req)));
  } catch (error) {
    reportError(res, error);
  }
}

export async function adminReviewMessageReport(req: AuthRequest, res: Response) {
  const id = idParam.safeParse(param(req, "id"));
  const status = req.body?.status;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
  if (!id.success || !["reviewing", "resolved", "dismissed"].includes(status) || reason.length < 3) {
    return res.status(400).json({ success: false, message: "A valid moderation decision and reason are required." });
  }
  try {
    ok(res, await businessMessaging.adminReviewReport(userId(req), id.data, status, reason));
  } catch (error) {
    reportError(res, error);
  }
}
