import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

type Tx = Parameters<Parameters<NonNullable<typeof db>["transaction"]>[0]>[0];
type MessagingRole = "authenticated" | "admin";
type Listener = (event: string, data: Record<string, unknown>) => void;

const listeners = new Map<string, Set<Listener>>();
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function failure(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function asRows<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "rows" in value) {
    const rows = (value as { rows?: unknown }).rows;
    return Array.isArray(rows) ? rows as T[] : [];
  }
  return [];
}

function emit(userId: string, event: string, data: Record<string, unknown>) {
  for (const listener of listeners.get(userId) || []) listener(event, data);
}

function emitConversation(conversationId: string, event: string, data: Record<string, unknown>, participants: string[]) {
  for (const participant of participants) emit(participant, event, { ...data, conversationId });
}

export class BusinessMessagingService {
  private async context<T>(userId: string, role: MessagingRole, callback: (tx: Tx) => Promise<T>): Promise<T> {
    const database = db;
    if (!database) throw failure("Business messaging requires the configured PostgreSQL database.", 503);
    return database.transaction(async (tx) => {
      const claims = JSON.stringify({ sub: userId, role });
      await tx.execute(sql`
        SELECT set_config('request.jwt.claim.sub', ${userId}, true),
          set_config('request.jwt.claim.role', ${role}, true),
          set_config('request.jwt.claims', ${claims}, true)
      `);
      if (role === "authenticated") {
        const suspension = asRows(await tx.execute(sql`
          SELECT 1 FROM messaging_suspensions
          WHERE user_id = ${userId} AND (expires_at IS NULL OR expires_at > now()) LIMIT 1
        `));
        if (suspension.length) throw failure("Messaging access is suspended. Contact platform support for review.", 403);
      }
      return callback(tx);
    });
  }

  subscribe(userId: string, response: Response) {
    const listener: Listener = (event, data) => {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const current = listeners.get(userId) || new Set<Listener>();
    current.add(listener);
    listeners.set(userId, current);
    response.write("retry: 3000\n\n");
    const heartbeat = setInterval(() => response.write(": keep-alive\n\n"), 25_000);
    response.on("close", () => {
      clearInterval(heartbeat);
      current.delete(listener);
      if (!current.size) listeners.delete(userId);
    });
  }

  async searchBusinesses(userId: string, filters: {
    q?: string; state?: string; lga?: string; city?: string; category?: string; product?: string; verified?: boolean;
  }) {
    return this.context(userId, "authenticated", async (tx) => asRows(await tx.execute(sql`
      SELECT bp.id, bp.user_id AS "userId", bp.display_name AS "displayName",
        bp.business_name AS "businessName", bp.business_category AS "businessCategory",
        bp.station_name AS "stationName", bp.terminal_name AS "terminalName",
        bp.state, bp.lga, bp.city, bp.products, bp.business_verified AS "businessVerified",
        bp.business_contact_public AS "businessContactPublic",
        bp.customer_verified AS "customerVerified"
      FROM business_profiles bp
      WHERE bp.customer_verified = true
        AND (${filters.q || null}::text IS NULL OR concat_ws(' ', bp.display_name, bp.business_name,
          bp.station_name, bp.terminal_name, bp.business_category, bp.state, bp.lga, bp.city)
          ILIKE ${filters.q ? `%${filters.q.trim().replace(/[%_]/g, "\\$&")}%` : "%"})
        AND (${filters.state || null}::text IS NULL OR lower(bp.state) = lower(${filters.state || ""}))
        AND (${filters.lga || null}::text IS NULL OR lower(bp.lga) = lower(${filters.lga || ""}))
        AND (${filters.city || null}::text IS NULL OR lower(bp.city) = lower(${filters.city || ""}))
        AND (${filters.category || null}::text IS NULL OR bp.business_category = ${filters.category || ""})
        AND (${filters.product || null}::text IS NULL OR ${filters.product || ""} = ANY(bp.products))
        AND (${filters.verified === true ? true : false} = false OR bp.business_verified = true)
        AND bp.user_id <> ${userId}
      ORDER BY bp.business_verified DESC, bp.business_name NULLS LAST, bp.display_name
      LIMIT 100
    `)));
  }

  async getMyBusinessProfile(userId: string) {
    return this.context(userId, "authenticated", async (tx) => {
      const rows = asRows(await tx.execute(sql`SELECT * FROM business_profiles WHERE user_id = ${userId} LIMIT 1`));
      return rows[0] || null;
    });
  }

  async getPublicBusinessProfile(viewerId: string, targetId: string) {
    return this.context(viewerId, "authenticated", async (tx) => {
      const [profile] = asRows(await tx.execute(sql`
        SELECT bp.id, bp.user_id AS "userId", bp.display_name AS "displayName",
          bp.business_name AS "businessName", bp.business_category AS "businessCategory",
          bp.station_name AS "stationName", bp.terminal_name AS "terminalName",
          bp.state, bp.lga, bp.city, bp.products, bp.business_verified AS "businessVerified",
          bp.business_contact_public AS "businessContactPublic",
          bp.customer_verified AS "customerVerified"
        FROM business_profiles bp WHERE bp.user_id = ${targetId} AND bp.customer_verified = true
      `));
      if (!profile) throw failure("Public business profile not found.", 404);
      return profile;
    });
  }

  async saveBusinessProfile(userId: string, input: {
    displayName: string; businessName?: string; businessCategory: string; stationName?: string;
    terminalName?: string; state?: string; lga?: string; city?: string; products: string[];
    businessContactPublic: boolean;
  }) {
    return this.context(userId, "authenticated", async (tx) => {
      const result = await tx.execute(sql`
        INSERT INTO business_profiles
          (user_id, display_name, business_name, business_category, station_name, terminal_name,
            state, lga, city, products, business_contact_public)
        VALUES (${userId}, ${input.displayName}, ${input.businessName || null}, ${input.businessCategory},
          ${input.stationName || null}, ${input.terminalName || null}, ${input.state || null},
          ${input.lga || null}, ${input.city || null}, ${input.products}, ${input.businessContactPublic})
        ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name,
          business_name = EXCLUDED.business_name, business_category = EXCLUDED.business_category,
          station_name = EXCLUDED.station_name, terminal_name = EXCLUDED.terminal_name,
          state = EXCLUDED.state, lga = EXCLUDED.lga, city = EXCLUDED.city, products = EXCLUDED.products,
          business_contact_public = EXCLUDED.business_contact_public, updated_at = now()
        RETURNING id, user_id AS "userId", display_name AS "displayName",
          business_name AS "businessName", business_category AS "businessCategory",
          station_name AS "stationName", terminal_name AS "terminalName",
          state, lga, city, products, business_verified AS "businessVerified",
          business_contact_public AS "businessContactPublic"
      `);
      return asRows(result)[0];
    });
  }

  async listConnections(userId: string) {
    return this.context(userId, "authenticated", async (tx) => asRows(await tx.execute(sql`
      SELECT bp.id, bp.user_id AS "userId", bp.display_name AS "displayName",
        bp.business_name AS "businessName", bp.business_category AS "businessCategory",
        bp.station_name AS "stationName", bp.terminal_name AS "terminalName",
        bp.state, bp.lga, bp.city, bp.products, bp.business_verified AS "businessVerified",
        bc.created_at AS "connectedAt"
      FROM business_connections bc
      JOIN business_profiles bp ON bp.user_id = CASE WHEN bc.user_low = ${userId} THEN bc.user_high ELSE bc.user_low END
      WHERE ${userId} IN (bc.user_low, bc.user_high)
      ORDER BY bc.created_at DESC
    `)));
  }

  async listConnectionRequests(userId: string) {
    return this.context(userId, "authenticated", async (tx) => asRows(await tx.execute(sql`
      SELECT cr.id, cr.sender_user_id AS "senderUserId", cr.recipient_user_id AS "recipientUserId",
        cr.message, cr.status, cr.created_at AS "createdAt",
        (cr.recipient_user_id = ${userId}) AS "isIncoming",
        bp.display_name AS "senderDisplayName", bp.business_name AS "senderBusinessName",
        bp.business_category AS "senderBusinessCategory"
      FROM connection_requests cr
      JOIN business_profiles bp ON bp.user_id = CASE
        WHEN cr.sender_user_id = ${userId} THEN cr.recipient_user_id ELSE cr.sender_user_id END
      WHERE ${userId} IN (cr.sender_user_id, cr.recipient_user_id) AND cr.status = 'pending'
      ORDER BY cr.created_at DESC LIMIT 100
    `)));
  }

  async requestConnection(userId: string, targetId: string, message?: string) {
    if (userId === targetId) throw failure("You cannot connect with your own account.");
    const created = await this.context(userId, "authenticated", async (tx) => {
      const blocked = asRows<{ blocked: boolean }>(await tx.execute(sql`
        SELECT public.messaging_contact_is_blocked(${targetId}) AS blocked
      `));
      if (blocked[0]?.blocked) throw failure("A connection cannot be requested for this account.", 403);
      const sender = asRows(await tx.execute(sql`
        SELECT 1 FROM business_profiles WHERE user_id = ${userId} AND customer_verified LIMIT 1
      `));
      if (!sender.length) throw failure("Create your verified public business profile before requesting connections.", 403);
      const target = asRows(await tx.execute(sql`
        SELECT 1 FROM business_profiles bp
        WHERE bp.user_id = ${targetId} AND bp.customer_verified LIMIT 1
      `));
      if (!target.length) throw failure("A verified, discoverable business profile is required.", 404);
      const duplicate = asRows(await tx.execute(sql`
        SELECT 1 FROM connection_requests
        WHERE status = 'pending'
          AND LEAST(sender_user_id, recipient_user_id) = LEAST(${userId}, ${targetId})
          AND GREATEST(sender_user_id, recipient_user_id) = GREATEST(${userId}, ${targetId})
        LIMIT 1
      `));
      if (duplicate.length) throw failure("A connection request is already pending.", 409);
      const already = asRows(await tx.execute(sql`
        SELECT 1 FROM business_connections WHERE user_low = LEAST(${userId}, ${targetId})
          AND user_high = GREATEST(${userId}, ${targetId}) LIMIT 1
      `));
      if (already.length) throw failure("You are already connected to this business.", 409);
      const [row] = asRows<{ id: string }>(await tx.execute(sql`
        INSERT INTO connection_requests (sender_user_id, recipient_user_id, message)
        VALUES (${userId}, ${targetId}, ${message || null}) RETURNING id
      `));
      await tx.execute(sql`
        INSERT INTO chat_notifications (user_id, notification_type, connection_request_id)
        SELECT ${targetId}, 'connection_request', ${row.id}
        WHERE coalesce((SELECT notifications_enabled FROM chat_preferences WHERE user_id = ${targetId}), true)
      `);
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, entity_id)
        VALUES (${userId}, 'connection_request_sent', 'connection_request', ${row.id})
      `);
      return row;
    });
    emit(targetId, "connection_request", { requestId: created.id });
    return created;
  }

  async updateConnectionRequest(userId: string, requestId: string, action: "accept" | "reject" | "cancel") {
    const result = await this.context(userId, "authenticated", async (tx) => {
      const [request] = asRows<{ id: string; sender_user_id: string; recipient_user_id: string }>(await tx.execute(sql`
        SELECT id, sender_user_id, recipient_user_id FROM connection_requests WHERE id = ${requestId} AND status = 'pending' FOR UPDATE
      `));
      if (!request) throw failure("Connection request not found.", 404);
      if (action === "cancel" ? request.sender_user_id !== userId : request.recipient_user_id !== userId) {
        throw failure("You cannot update this connection request.", 403);
      }
      if (action === "accept") {
        const blocked = asRows<{ blocked: boolean }>(await tx.execute(sql`
          SELECT public.messaging_contact_is_blocked(${request.sender_user_id}) AS blocked
        `));
        if (blocked[0]?.blocked) throw failure("This connection cannot be accepted because one account has blocked the other.", 403);
      }
      const status = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "cancelled";
      await tx.execute(sql`UPDATE connection_requests SET status = ${status}, updated_at = now() WHERE id = ${requestId}`);
      if (action === "accept") {
        await tx.execute(sql`
          INSERT INTO business_connections (user_low, user_high)
          VALUES (LEAST(${request.sender_user_id}, ${request.recipient_user_id}),
            GREATEST(${request.sender_user_id}, ${request.recipient_user_id}))
          ON CONFLICT (user_low, user_high) DO NOTHING
        `);
        const [conversation] = asRows<{ id: string }>(await tx.execute(sql`
          INSERT INTO conversations (conversation_key, created_by)
          VALUES (${[request.sender_user_id, request.recipient_user_id].sort().join(":")}, ${userId})
          ON CONFLICT (conversation_key) DO NOTHING
          RETURNING id
        `));
        const existingConversation = conversation || asRows<{ id: string }>(await tx.execute(sql`
          SELECT id FROM conversations WHERE conversation_key = ${[request.sender_user_id, request.recipient_user_id].sort().join(":")}
        `))[0];
        for (const participantId of [request.sender_user_id, request.recipient_user_id]) {
          await tx.execute(sql`
            INSERT INTO conversation_participants (conversation_id, user_id)
            VALUES (${existingConversation.id}, ${participantId}) ON CONFLICT DO NOTHING
          `);
        }
        await tx.execute(sql`
          INSERT INTO chat_notifications (user_id, notification_type, conversation_id, connection_request_id)
          SELECT ${request.sender_user_id}, 'connection_accepted', ${existingConversation.id}, ${requestId}
          WHERE coalesce((SELECT notifications_enabled FROM chat_preferences WHERE user_id = ${request.sender_user_id}), true)
        `);
      }
      await tx.execute(sql`
        INSERT INTO chat_notifications (user_id, notification_type, connection_request_id)
        SELECT ${request.sender_user_id}, 'connection_request_updated', ${requestId}
        WHERE coalesce((SELECT notifications_enabled FROM chat_preferences WHERE user_id = ${request.sender_user_id}), true)
      `);
      return { senderId: request.sender_user_id, recipientId: request.recipient_user_id, status };
    });
    emit(result.senderId, "connection_request_updated", { requestId, status: result.status });
    return result;
  }

  async listConversations(userId: string) {
    return this.context(userId, "authenticated", async (tx) => asRows(await tx.execute(sql`
      SELECT c.id, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
        other.user_id AS "otherUserId", bp.display_name AS "displayName",
        bp.business_name AS "businessName", bp.business_category AS "businessCategory",
        bp.business_verified AS "businessVerified", bp.state, bp.city, bp.products, last.body AS "lastMessage",
        last.created_at AS "lastMessageAt",
        (SELECT count(*)::int FROM messages unread
          WHERE unread.conversation_id = c.id AND unread.sender_user_id <> ${userId}
            AND unread.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM message_read_receipts rr
              WHERE rr.message_id = unread.id AND rr.user_id = ${userId} AND rr.read_at IS NOT NULL)
        ) AS "unreadCount",
        mine.archived_at AS "archivedAt", mine.muted_until AS "mutedUntil"
      FROM conversation_participants mine
      JOIN conversations c ON c.id = mine.conversation_id
      JOIN conversation_participants other ON other.conversation_id = c.id AND other.user_id <> ${userId}
      JOIN business_profiles bp ON bp.user_id = other.user_id
      LEFT JOIN chat_preferences pref ON pref.user_id = ${userId}
      LEFT JOIN LATERAL (
        SELECT CASE WHEN coalesce(pref.show_message_previews, false) THEN body ELSE NULL END AS body, created_at
        FROM messages m WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC LIMIT 1
      ) last ON true
      WHERE mine.user_id = ${userId}
      ORDER BY coalesce(last.created_at, c.created_at) DESC
    `)));
  }

  async getDashboardSummary(userId: string) {
    return this.context(userId, "authenticated", async (tx) => {
      const [summary] = asRows(await tx.execute(sql`
        SELECT
          (SELECT count(*)::int FROM conversation_participants WHERE user_id = ${userId}) AS "totalConversations",
          (SELECT count(*)::int FROM messages m
            JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ${userId}
            WHERE m.sender_user_id <> ${userId} AND m.deleted_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM message_read_receipts rr WHERE rr.message_id = m.id AND rr.user_id = ${userId} AND rr.read_at IS NOT NULL)
          ) AS "unreadMessages",
          (SELECT count(*)::int FROM business_connections WHERE ${userId} IN (user_low, user_high)) AS "acceptedConnections",
          (SELECT count(*)::int FROM connection_requests WHERE recipient_user_id = ${userId} AND status = 'pending') AS "pendingRequests",
          (SELECT count(*)::int FROM business_enquiries e JOIN messages m ON m.id = e.message_id WHERE m.sender_user_id = ${userId}) AS "enquiriesSent",
          (SELECT count(*)::int FROM business_enquiries e JOIN messages m ON m.id = e.message_id
            JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
            WHERE cp.user_id = ${userId} AND m.sender_user_id <> ${userId}
          ) AS "enquiriesReceived"
      `));
      return summary || { totalConversations: 0, unreadMessages: 0, acceptedConnections: 0, pendingRequests: 0, enquiriesSent: 0, enquiriesReceived: 0 };
    });
  }

  async createConversation(userId: string, targetId: string) {
    if (userId === targetId) throw failure("You cannot message your own account.");
    return this.context(userId, "authenticated", async (tx) => {
      const blocks = asRows<{ blocked: boolean }>(await tx.execute(sql`
        SELECT public.messaging_contact_is_blocked(${targetId}) AS blocked
      `));
      if (blocks[0]?.blocked) throw failure("Messaging is unavailable for this account.", 403);
      const connected = asRows(await tx.execute(sql`
        SELECT 1 WHERE EXISTS (
          SELECT 1 FROM business_connections WHERE user_low = LEAST(${userId}, ${targetId})
            AND user_high = GREATEST(${userId}, ${targetId})
        ) OR EXISTS (
          SELECT 1 FROM marketplace_enquiries WHERE
            (sender_user_id = ${userId} AND recipient_user_id = ${targetId})
            OR (sender_user_id = ${targetId} AND recipient_user_id = ${userId})
        ) OR EXISTS (
          SELECT 1 FROM supplier_offers o JOIN buyer_requests r ON r.id = o.request_id
          WHERE (o.supplier_user_id = ${userId} AND r.buyer_user_id = ${targetId})
            OR (o.supplier_user_id = ${targetId} AND r.buyer_user_id = ${userId})
        ) LIMIT 1
      `));
      if (!connected.length) throw failure("You must have an accepted business connection or marketplace enquiry before starting a chat.", 403);
      const key = [userId, targetId].sort().join(":");
      const [conversation] = asRows<{ id: string }>(await tx.execute(sql`
        INSERT INTO conversations (conversation_key, created_by) VALUES (${key}, ${userId})
        ON CONFLICT (conversation_key) DO NOTHING
        RETURNING id
      `));
      const current = conversation || asRows<{ id: string }>(await tx.execute(sql`
        SELECT id FROM conversations WHERE conversation_key = ${key}
      `))[0];
      for (const participantId of [userId, targetId]) {
        await tx.execute(sql`
          INSERT INTO conversation_participants (conversation_id, user_id)
          VALUES (${current.id}, ${participantId}) ON CONFLICT DO NOTHING
        `);
      }
      return { id: current.id };
    });
  }

  async conversationParticipants(userId: string, conversationId: string, tx: Tx) {
    const participants = asRows<{ user_id: string }>(await tx.execute(sql`
      SELECT user_id FROM conversation_participants WHERE conversation_id = ${conversationId}
    `)).map((row) => row.user_id);
    if (!participants.includes(userId)) throw failure("Conversation not found.", 404);
    return participants;
  }

  async listMessages(userId: string, conversationId: string, q?: string) {
    const messages = await this.context(userId, "authenticated", async (tx) => {
      const participants = await this.conversationParticipants(userId, conversationId, tx);
      const rows = asRows(await tx.execute(sql`
        SELECT m.id, m.sender_user_id AS "senderUserId", m.reply_to_message_id AS "replyToMessageId",
          m.message_type AS "messageType", m.body, m.edited_at AS "editedAt",
          m.deleted_at AS "deletedAt", m.created_at AS "createdAt",
          COALESCE(json_agg(json_build_object('id', a.id, 'fileName', a.file_name,
            'mimeType', a.mime_type, 'sizeBytes', a.size_bytes)) FILTER (WHERE a.id IS NOT NULL), '[]') AS attachments,
          EXISTS (SELECT 1 FROM message_read_receipts rr WHERE rr.message_id = m.id AND rr.user_id <> ${userId}
            AND rr.delivered_at IS NOT NULL) AS delivered,
          EXISTS (SELECT 1 FROM message_read_receipts rr WHERE rr.message_id = m.id AND rr.user_id <> ${userId}
            AND rr.read_at IS NOT NULL) AS read
        FROM messages m LEFT JOIN message_attachments a ON a.message_id = m.id
        WHERE m.conversation_id = ${conversationId}
          AND (${q || null}::text IS NULL OR m.body ILIKE ${q ? `%${q.trim().replace(/[%_]/g, "\\$&")}%` : "%"})
        GROUP BY m.id ORDER BY m.created_at DESC LIMIT 200
      `));
      await tx.execute(sql`
        INSERT INTO message_read_receipts (message_id, user_id, delivered_at)
        SELECT id, ${userId}, now() FROM messages
        WHERE conversation_id = ${conversationId} AND sender_user_id <> ${userId}
        ON CONFLICT (message_id, user_id) DO UPDATE SET delivered_at = now()
      `);
      return { messages: rows.reverse(), participants };
    });
    return messages;
  }

  async sendMessage(userId: string, conversationId: string, body: string, replyToMessageId?: string) {
    const content = body.trim();
    if (!content || content.length > 5000) throw failure("Message must contain 1–5,000 characters.");
    const result = await this.context(userId, "authenticated", async (tx) => {
      const participants = await this.conversationParticipants(userId, conversationId, tx);
      const other = participants.find((id) => id !== userId);
      if (!other) throw failure("One-to-one conversations only.", 400);
      const blocked = asRows<{ blocked: boolean }>(await tx.execute(sql`
        SELECT public.messaging_contact_is_blocked(${other}) AS blocked
      `));
      if (blocked[0]?.blocked) throw failure("Messaging is unavailable for this account.", 403);
      const recent = asRows<{ count: number }>(await tx.execute(sql`
        SELECT count(*)::int AS count FROM messages WHERE sender_user_id = ${userId}
          AND created_at > now() - interval '1 minute'
      `))[0]?.count || 0;
      if (recent >= 20) throw failure("Message rate limit reached. Try again shortly.", 429);
      if (replyToMessageId) {
        const reply = asRows(await tx.execute(sql`
          SELECT 1 FROM messages WHERE id = ${replyToMessageId} AND conversation_id = ${conversationId} LIMIT 1
        `));
        if (!reply.length) throw failure("The reply target is not in this conversation.");
      }
      const [message] = asRows<Record<string, unknown>>(await tx.execute(sql`
        INSERT INTO messages (conversation_id, sender_user_id, reply_to_message_id, body)
        VALUES (${conversationId}, ${userId}, ${replyToMessageId || null}, ${content})
        RETURNING id, conversation_id AS "conversationId", sender_user_id AS "senderUserId",
          reply_to_message_id AS "replyToMessageId", body, created_at AS "createdAt"
      `));
      await tx.execute(sql`UPDATE conversations SET updated_at = now() WHERE id = ${conversationId}`);
      await tx.execute(sql`
        INSERT INTO chat_notifications (user_id, notification_type, conversation_id, message_id, show_preview)
        SELECT ${other}, 'message', ${conversationId}, ${message.id}, false
        WHERE coalesce((SELECT notifications_enabled FROM chat_preferences WHERE user_id = ${other}), true)
          AND NOT EXISTS (SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = ${conversationId} AND cp.user_id = ${other}
              AND cp.muted_until > now())
      `);
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, entity_id)
        VALUES (${userId}, 'message_sent', 'message', ${message.id})
      `);
      return { message, participants };
    });
    emitConversation(conversationId, "message", { messageId: result.message.id }, result.participants);
    return result.message;
  }

  async setConversationState(userId: string, conversationId: string, update: { archived?: boolean; muteUntil?: Date | null }) {
    return this.context(userId, "authenticated", async (tx) => {
      await this.conversationParticipants(userId, conversationId, tx);
      await tx.execute(sql`
        UPDATE conversation_participants SET
          archived_at = CASE WHEN ${update.archived === undefined} THEN archived_at WHEN ${update.archived} THEN now() ELSE NULL END,
          muted_until = CASE WHEN ${update.muteUntil === undefined} THEN muted_until ELSE ${update.muteUntil || null} END
        WHERE conversation_id = ${conversationId} AND user_id = ${userId}
      `);
      return { success: true };
    });
  }

  async markRead(userId: string, conversationId: string) {
    return this.context(userId, "authenticated", async (tx) => {
      const participants = await this.conversationParticipants(userId, conversationId, tx);
      await tx.execute(sql`
        INSERT INTO message_read_receipts (message_id, user_id, delivered_at, read_at)
        SELECT id, ${userId}, now(), now() FROM messages
        WHERE conversation_id = ${conversationId} AND sender_user_id <> ${userId}
        ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = now()
      `);
      await tx.execute(sql`UPDATE conversation_participants SET last_read_at = now() WHERE conversation_id = ${conversationId} AND user_id = ${userId}`);
      return participants;
    }).then((participants) => {
      emitConversation(conversationId, "read", { userId }, participants);
      return { success: true };
    });
  }

  async setTyping(userId: string, conversationId: string, isTyping: boolean) {
    const participants = await this.context(userId, "authenticated", async (tx) => {
      const current = await this.conversationParticipants(userId, conversationId, tx);
      if (isTyping) {
        await tx.execute(sql`
          INSERT INTO typing_status (conversation_id, user_id, updated_at) VALUES (${conversationId}, ${userId}, now())
          ON CONFLICT (conversation_id, user_id) DO UPDATE SET updated_at = now()
        `);
      } else {
        await tx.execute(sql`DELETE FROM typing_status WHERE conversation_id = ${conversationId} AND user_id = ${userId}`);
      }
      return current;
    });
    emitConversation(conversationId, "typing", { userId, isTyping }, participants.filter((id) => id !== userId));
    return { success: true };
  }

  async listTyping(userId: string, conversationId: string) {
    return this.context(userId, "authenticated", async (tx) => {
      await this.conversationParticipants(userId, conversationId, tx);
      return asRows(await tx.execute(sql`
        SELECT user_id AS "userId" FROM typing_status
        WHERE conversation_id = ${conversationId} AND user_id <> ${userId}
          AND updated_at > now() - interval '10 seconds'
      `));
    });
  }

  async editMessage(userId: string, messageId: string, body: string) {
    const content = body.trim();
    if (!content || content.length > 5000) throw failure("Message must contain 1–5,000 characters.");
    const updated = await this.context(userId, "authenticated", async (tx) => {
      const [message] = asRows<Record<string, unknown>>(await tx.execute(sql`
        UPDATE messages SET body = ${content}, edited_at = now()
        WHERE id = ${messageId} AND sender_user_id = ${userId} AND deleted_at IS NULL
          AND created_at > now() - interval '15 minutes'
        RETURNING id, conversation_id AS "conversationId", body, edited_at AS "editedAt"
      `));
      if (!message) throw failure("Only your recent messages can be edited.", 403);
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, entity_id)
        VALUES (${userId}, 'message_edited', 'message', ${messageId})
      `);
      const participants = await this.conversationParticipants(userId, String(message.conversationId), tx);
      return { message, participants };
    });
    emitConversation(String(updated.message.conversationId), "message", { messageId }, updated.participants);
    return updated.message;
  }

  async deleteMessage(userId: string, messageId: string) {
    const deleted = await this.context(userId, "authenticated", async (tx) => {
      const [message] = asRows<{ conversation_id: string }>(await tx.execute(sql`
        UPDATE messages SET body = '[Message deleted]', deleted_at = now(), edited_at = now()
        WHERE id = ${messageId} AND sender_user_id = ${userId} AND deleted_at IS NULL
          AND created_at > now() - interval '24 hours'
        RETURNING conversation_id
      `));
      if (!message) throw failure("Only your messages from the last 24 hours can be deleted.", 403);
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, entity_id)
        VALUES (${userId}, 'message_deleted', 'message', ${messageId})
      `);
      return { conversationId: message.conversation_id, participants: await this.conversationParticipants(userId, message.conversation_id, tx) };
    });
    emitConversation(deleted.conversationId, "message", { messageId }, deleted.participants);
    return { conversationId: deleted.conversationId };
  }

  async blockUser(userId: string, targetId: string) {
    if (userId === targetId) throw failure("You cannot block your own account.");
    await this.context(userId, "authenticated", async (tx) => {
      await tx.execute(sql`INSERT INTO blocked_users (blocker_user_id, blocked_user_id) VALUES (${userId}, ${targetId}) ON CONFLICT DO NOTHING`);
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, metadata)
        VALUES (${userId}, 'customer_blocked', 'customer', jsonb_build_object('blockedUserId', ${targetId}))
      `);
    });
    emit(targetId, "blocked", { byUserId: userId });
    return { success: true };
  }

  async listBlockedUsers(userId: string) {
    return this.context(userId, "authenticated", async (tx) => asRows(await tx.execute(sql`
      SELECT b.blocked_user_id AS "userId", bp.display_name AS "displayName",
        bp.business_name AS "businessName", b.created_at AS "createdAt"
      FROM blocked_users b LEFT JOIN business_profiles bp ON bp.user_id = b.blocked_user_id
      WHERE b.blocker_user_id = ${userId} ORDER BY b.created_at DESC
    `)));
  }

  async unblockUser(userId: string, targetId: string) {
    return this.context(userId, "authenticated", async (tx) => {
      await tx.execute(sql`DELETE FROM blocked_users WHERE blocker_user_id = ${userId} AND blocked_user_id = ${targetId}`);
      return { success: true };
    });
  }

  async reportMessage(userId: string, input: { reportedUserId: string; messageId?: string; conversationId?: string; reason: string }) {
    return this.context(userId, "authenticated", async (tx) => {
      if (input.conversationId) await this.conversationParticipants(userId, input.conversationId, tx);
      if (input.messageId) {
        const matches = asRows(await tx.execute(sql`
          SELECT 1 FROM messages WHERE id = ${input.messageId}
            AND sender_user_id = ${input.reportedUserId}
            AND (${input.conversationId || null}::uuid IS NULL OR conversation_id = ${input.conversationId || null})
          LIMIT 1
        `));
        if (!matches.length) throw failure("The reported message does not match the reported customer.", 403);
      }
      const [report] = asRows<{ id: string }>(await tx.execute(sql`
        INSERT INTO message_reports (reporter_user_id, reported_user_id, message_id, conversation_id, reason)
        VALUES (${userId}, ${input.reportedUserId}, ${input.messageId || null}, ${input.conversationId || null}, ${input.reason})
        RETURNING id
      `));
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, entity_id)
        VALUES (${userId}, 'message_reported', 'message_report', ${report.id})
      `);
      return report;
    });
  }

  async sendEnquiry(userId: string, conversationId: string, input: {
    productType: "PMS" | "AGO" | "DPK" | "LPG"; quantity?: number; proposedPrice?: number;
    deliveryLocation?: string; preferredDeliveryDate?: string; requirements?: string;
  }) {
    const text = [
      `Business enquiry · ${input.productType}`,
      input.quantity ? `Quantity: ${input.quantity}` : "",
      input.proposedPrice ? `Proposed price: ₦${input.proposedPrice}` : "",
      input.deliveryLocation ? `Delivery/collection: ${input.deliveryLocation}` : "",
      input.preferredDeliveryDate ? `Preferred date: ${input.preferredDeliveryDate}` : "",
      input.requirements ? `Requirements: ${input.requirements}` : "",
    ].filter(Boolean).join("\n");
    const sent = await this.context(userId, "authenticated", async (tx) => {
      const participants = await this.conversationParticipants(userId, conversationId, tx);
      const other = participants.find((id) => id !== userId);
      if (!other) throw failure("One-to-one conversations only.", 400);
      const blocked = asRows<{ blocked: boolean }>(await tx.execute(sql`
        SELECT public.messaging_contact_is_blocked(${other}) AS blocked
      `));
      if (blocked[0]?.blocked) throw failure("Messaging is unavailable for this account.", 403);
      const recent = asRows<{ count: number }>(await tx.execute(sql`
        SELECT count(*)::int AS count FROM messages WHERE sender_user_id = ${userId}
          AND created_at > now() - interval '1 minute'
      `))[0]?.count || 0;
      if (recent >= 20) throw failure("Message rate limit reached. Try again shortly.", 429);
      const [message] = asRows<Record<string, unknown>>(await tx.execute(sql`
        INSERT INTO messages (conversation_id, sender_user_id, message_type, body)
        VALUES (${conversationId}, ${userId}, 'enquiry', ${text})
        RETURNING id, conversation_id AS "conversationId", sender_user_id AS "senderUserId",
          message_type AS "messageType", body, created_at AS "createdAt"
      `));
      await tx.execute(sql`
        INSERT INTO business_enquiries (message_id, product_type, quantity, proposed_price, delivery_location, preferred_delivery_date, requirements)
        VALUES (${message.id}, ${input.productType}, ${input.quantity ?? null}, ${input.proposedPrice ?? null},
          ${input.deliveryLocation || null}, ${input.preferredDeliveryDate || null}, ${input.requirements || null})
      `);
      await tx.execute(sql`UPDATE conversations SET updated_at = now() WHERE id = ${conversationId}`);
      await tx.execute(sql`
        INSERT INTO chat_notifications (user_id, notification_type, conversation_id, message_id, show_preview)
        SELECT ${other}, 'business_enquiry', ${conversationId}, ${message.id}, false
        WHERE coalesce((SELECT notifications_enabled FROM chat_preferences WHERE user_id = ${other}), true)
          AND NOT EXISTS (SELECT 1 FROM conversation_participants cp
            WHERE cp.conversation_id = ${conversationId} AND cp.user_id = ${other}
              AND cp.muted_until > now())
      `);
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, entity_id)
        VALUES (${userId}, 'business_enquiry_sent', 'message', ${message.id})
      `);
      return { message, participants };
    });
    emitConversation(conversationId, "message", { messageId: sent.message.id }, sent.participants);
    return sent.message;
  }

  async listNotifications(userId: string) {
    return this.context(userId, "authenticated", async (tx) => asRows(await tx.execute(sql`
      SELECT id, notification_type AS "type", conversation_id AS "conversationId",
        connection_request_id AS "connectionRequestId", message_id AS "messageId",
        show_preview AS "showPreview", read_at AS "readAt", created_at AS "createdAt"
      FROM chat_notifications WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 100
    `)));
  }

  async getPreferences(userId: string) {
    return this.context(userId, "authenticated", async (tx) => {
      const [preferences] = asRows(await tx.execute(sql`
        SELECT notifications_enabled AS "notificationsEnabled",
          show_message_previews AS "showMessagePreviews"
        FROM chat_preferences WHERE user_id = ${userId}
      `));
      return preferences || { notificationsEnabled: true, showMessagePreviews: false };
    });
  }

  async updatePreferences(userId: string, preferences: { notificationsEnabled?: boolean; showMessagePreviews?: boolean }) {
    return this.context(userId, "authenticated", async (tx) => {
      const [current] = asRows<{ notifications_enabled: boolean; show_message_previews: boolean }>(await tx.execute(sql`
        SELECT notifications_enabled, show_message_previews FROM chat_preferences WHERE user_id = ${userId}
      `));
      const notificationsEnabled = preferences.notificationsEnabled ?? current?.notifications_enabled ?? true;
      const showMessagePreviews = preferences.showMessagePreviews ?? current?.show_message_previews ?? false;
      await tx.execute(sql`
        INSERT INTO chat_preferences (user_id, notifications_enabled, show_message_previews)
        VALUES (${userId}, ${notificationsEnabled}, ${showMessagePreviews})
        ON CONFLICT (user_id) DO UPDATE SET notifications_enabled = EXCLUDED.notifications_enabled,
          show_message_previews = EXCLUDED.show_message_previews, updated_at = now()
      `);
      return { notificationsEnabled, showMessagePreviews };
    });
  }

  async markNotificationRead(userId: string, notificationId: string) {
    return this.context(userId, "authenticated", async (tx) => {
      await tx.execute(sql`UPDATE chat_notifications SET read_at = now() WHERE id = ${notificationId} AND user_id = ${userId}`);
      return { success: true };
    });
  }

  async adminListReports(adminId: string) {
    return this.context(adminId, "admin", async (tx) => asRows(await tx.execute(sql`
      SELECT id, reporter_user_id AS "reporterUserId", reported_user_id AS "reportedUserId",
        message_id AS "messageId", conversation_id AS "conversationId", reason, status,
        created_at AS "createdAt"
      FROM message_reports ORDER BY created_at DESC LIMIT 500
    `)));
  }

  async adminListBusinesses(adminId: string) {
    return this.context(adminId, "admin", async (tx) => asRows(await tx.execute(sql`
      SELECT bp.id, bp.user_id AS "userId", bp.display_name AS "displayName",
        bp.business_name AS "businessName", bp.business_category AS "businessCategory",
        bp.station_name AS "stationName", bp.terminal_name AS "terminalName",
        bp.state, bp.lga, bp.city, bp.products, bp.business_verified AS "businessVerified",
        (p.email_verified OR p.phone_verified) AS "customerVerified"
      FROM business_profiles bp JOIN profiles p ON p.user_id = bp.user_id
      ORDER BY bp.business_verified, bp.updated_at DESC LIMIT 500
    `)));
  }

  async adminReviewBusiness(adminId: string, profileId: string, verified: boolean, reason: string) {
    return this.context(adminId, "admin", async (tx) => {
      const [profile] = asRows<{ user_id: string; business_verified: boolean }>(await tx.execute(sql`
        SELECT user_id, business_verified FROM business_profiles WHERE id = ${profileId} FOR UPDATE
      `));
      if (!profile) throw failure("Business profile not found.", 404);
      await tx.execute(sql`
        UPDATE business_profiles SET business_verified = ${verified}, updated_at = now() WHERE id = ${profileId}
      `);
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, entity_id, reason, metadata)
        VALUES (${adminId}, ${verified ? "business_verified" : "business_verification_revoked"},
          'business_profile', ${profileId}, ${reason},
          jsonb_build_object('userId', ${profile.user_id}, 'before', ${profile.business_verified}, 'after', ${verified}))
      `);
      return { id: profileId, businessVerified: verified };
    });
  }

  async adminSetMessagingSuspension(adminId: string, targetUserId: string, suspend: boolean, reason: string, expiresAt?: Date | null) {
    const result = await this.context(adminId, "admin", async (tx) => {
      if (suspend) {
        await tx.execute(sql`
          INSERT INTO messaging_suspensions (user_id, suspended_by, reason, expires_at)
          VALUES (${targetUserId}, ${adminId}, ${reason}, ${expiresAt || null})
          ON CONFLICT (user_id) DO UPDATE SET suspended_by = EXCLUDED.suspended_by,
            reason = EXCLUDED.reason, expires_at = EXCLUDED.expires_at, created_at = now()
        `);
      } else {
        await tx.execute(sql`DELETE FROM messaging_suspensions WHERE user_id = ${targetUserId}`);
      }
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, reason, metadata)
        VALUES (${adminId}, ${suspend ? "messaging_suspended" : "messaging_unsuspended"}, 'customer',
          ${reason}, jsonb_build_object('userId', ${targetUserId}, 'expiresAt', ${expiresAt?.toISOString() || null}))
      `);
      return { userId: targetUserId, suspended: suspend, expiresAt: expiresAt || null };
    });
    emit(targetUserId, suspend ? "suspended" : "unsuspended", { reason });
    return result;
  }

  async adminListAudit(adminId: string) {
    return this.context(adminId, "admin", async (tx) => asRows(await tx.execute(sql`
      SELECT id, actor_user_id AS "actorUserId", action, entity_type AS "entityType",
        entity_id AS "entityId", reason, metadata, created_at AS "createdAt"
      FROM message_audit_logs ORDER BY created_at DESC LIMIT 500
    `)));
  }

  async adminReviewReport(adminId: string, reportId: string, status: "reviewing" | "resolved" | "dismissed", reason: string) {
    return this.context(adminId, "admin", async (tx) => {
      const [report] = asRows<{ id: string }>(await tx.execute(sql`
        UPDATE message_reports SET status = ${status} WHERE id = ${reportId} RETURNING id
      `));
      if (!report) throw failure("Report not found.", 404);
      await tx.execute(sql`
        INSERT INTO message_audit_logs (actor_user_id, action, entity_type, entity_id, reason)
        VALUES (${adminId}, ${`report_${status}`}, 'message_report', ${reportId}, ${reason})
      `);
      return report;
    });
  }

  async createAttachment(userId: string, messageId: string, fileName: string, mimeType: string, bytes: Buffer) {
    if (!allowedMime.has(mimeType)) throw failure("Only JPEG, PNG, WebP and PDF attachments are allowed.");
    if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) throw failure("Attachment size must be between 1 byte and 10 MB.");
    if (!this.matchesMime(bytes, mimeType)) throw failure("The attachment content does not match its file type.");
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = "messaging-private";
    if (!supabaseUrl || !serviceKey) throw failure("Private messaging storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", 503);
    await this.context(userId, "authenticated", async (tx) => {
      const ownsMessage = asRows(await tx.execute(sql`
        SELECT 1 FROM messages m WHERE m.id = ${messageId} AND m.sender_user_id = ${userId}
          AND public.messaging_is_participant(m.conversation_id) LIMIT 1
      `));
      if (!ownsMessage.length) throw failure("Attachment must belong to your message in a conversation you participate in.", 403);
    });
    const path = `${randomUUID()}/${randomUUID()}`;
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": mimeType, "x-upsert": "false" },
      body: bytes,
    });
    if (!response.ok) throw failure("Private attachment upload failed.", 502);
    try {
      return await this.context(userId, "authenticated", async (tx) => {
        const [attachment] = asRows(await tx.execute(sql`
          INSERT INTO message_attachments (message_id, uploader_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes)
          SELECT m.id, ${userId}, ${bucket}, ${path}, ${fileName.slice(0, 180)}, ${mimeType}, ${bytes.length}
          FROM messages m WHERE m.id = ${messageId} AND m.sender_user_id = ${userId}
            AND public.messaging_is_participant(m.conversation_id)
          RETURNING id, message_id AS "messageId", file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes"
        `));
        if (!attachment) throw failure("Attachment must belong to your message in a conversation you participate in.", 403);
        return attachment;
      });
    } catch (error) {
      await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      }).catch(() => undefined);
      throw error;
    }
  }

  async getAttachmentUrl(userId: string, attachmentId: string) {
    const attachment = await this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows<{ storage_bucket: string; storage_path: string }>(await tx.execute(sql`
        SELECT a.storage_bucket, a.storage_path FROM message_attachments a
        JOIN messages m ON m.id = a.message_id
        WHERE a.id = ${attachmentId} AND public.messaging_is_participant(m.conversation_id)
      `));
      if (!row) throw failure("Attachment not found.", 404);
      return row;
    });
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw failure("Private messaging storage is not configured.", 503);
    const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(attachment.storage_bucket)}/${attachment.storage_path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 300 }),
    });
    if (!signed.ok) throw failure("Could not create a secure attachment link.", 502);
    const result = await signed.json() as { signedURL?: string };
    return { url: result.signedURL?.startsWith("http") ? result.signedURL : `${supabaseUrl}/storage/v1${result.signedURL}` };
  }

  private matchesMime(bytes: Buffer, mimeType: string) {
    if (mimeType === "image/jpeg") return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
    if (mimeType === "image/png") return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (mimeType === "image/webp") return bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (mimeType === "application/pdf") return bytes.length > 5 && bytes.toString("ascii", 0, 5) === "%PDF-";
    return false;
  }
}

export const businessMessaging = new BusinessMessagingService();
