import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

type Tx = Parameters<Parameters<NonNullable<typeof db>["transaction"]>[0]>[0];
type Role = "authenticated" | "admin";
type ListingFilters = {
  q?: string; product?: string; category?: string; state?: string; lga?: string; city?: string;
  minPrice?: number; maxPrice?: number; minQuantity?: number; delivery?: boolean;
  verified?: boolean; sort?: "relevant" | "price_asc" | "quantity_desc" | "recent" | "verified";
};

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

export class FuelMarketplaceService {
  private isAllowedDocument(bytes: Buffer, mimeType: string) {
    if (mimeType === "image/jpeg") return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
    if (mimeType === "image/png") return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (mimeType === "image/webp") return bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (mimeType === "application/pdf") return bytes.length > 5 && bytes.toString("ascii", 0, 5) === "%PDF-";
    return false;
  }

  private async context<T>(userId: string, role: Role, callback: (tx: Tx) => Promise<T>): Promise<T> {
    const database = db;
    if (!database) throw failure("Fuel marketplace requires the configured PostgreSQL database.", 503);
    return database.transaction(async (tx) => {
      const claims = JSON.stringify({ sub: userId, role });
      await tx.execute(sql`
        SELECT set_config('request.jwt.claim.sub', ${userId}, true),
          set_config('request.jwt.claim.role', ${role}, true),
          set_config('request.jwt.claims', ${claims}, true)
      `);
      return callback(tx);
    });
  }

  private async refreshMatches(tx: Tx, userId: string) {
    await tx.execute(sql`DELETE FROM business_matches
      WHERE buyer_user_id = ${userId} OR supplier_user_id = ${userId}`);
    await tx.execute(sql`
      INSERT INTO business_matches (buyer_user_id, supplier_user_id, request_id, listing_id, score, reasons)
      SELECT ranked.buyer_user_id, ranked.supplier_user_id, ranked.request_id,
        ranked.listing_id, ranked.score, ranked.reasons
      FROM (
        SELECT r.buyer_user_id, l.owner_user_id AS supplier_user_id, r.id AS request_id,
          l.id AS listing_id,
          LEAST(100, 25
            + CASE WHEN lower(COALESCE(l.city, '')) <> '' AND lower(l.city) = lower(COALESCE(r.city, '')) THEN 30 ELSE 0 END
            + CASE WHEN lower(COALESCE(l.lga, '')) <> '' AND lower(l.lga) = lower(COALESCE(r.lga, '')) THEN 25 ELSE 0 END
            + CASE WHEN lower(COALESCE(l.state, '')) = lower(r.state) THEN 20 ELSE 0 END
            + CASE WHEN l.delivery_available THEN 15 ELSE 0 END
            + CASE WHEN COALESCE(l.quantity, 0) >= r.quantity THEN 15 ELSE 0 END
            + CASE WHEN r.target_price_max IS NULL OR l.price IS NULL OR l.price <= r.target_price_max THEN 10 ELSE 0 END
            + CASE WHEN bp.business_verified THEN 10 ELSE 0 END)::numeric(6, 2) AS score,
          array_remove(ARRAY[
            CASE WHEN lower(COALESCE(l.city, '')) <> '' AND lower(l.city) = lower(COALESCE(r.city, '')) THEN 'Same city' END,
            CASE WHEN lower(COALESCE(l.lga, '')) <> '' AND lower(l.lga) = lower(COALESCE(r.lga, '')) THEN 'Same LGA' END,
            CASE WHEN lower(COALESCE(l.state, '')) = lower(r.state) THEN 'Same state' END,
            CASE WHEN l.delivery_available THEN 'Delivery available' END,
            CASE WHEN COALESCE(l.quantity, 0) >= r.quantity THEN 'Quantity meets request' END,
            CASE WHEN r.target_price_max IS NULL OR l.price IS NULL OR l.price <= r.target_price_max THEN 'Within target price' END,
            CASE WHEN bp.business_verified THEN 'Business verified' END
          ], NULL) AS reasons
        FROM buyer_requests r
        JOIN LATERAL (
          SELECT ml.* FROM marketplace_listings ml
          WHERE ml.status = 'active' AND ml.expires_at > now() AND ml.availability <> 'unavailable'
            AND ml.product_type = r.product_type AND ml.owner_user_id <> r.buyer_user_id
            AND COALESCE(ml.quantity, 0) >= r.quantity
            AND (ml.minimum_order IS NULL OR ml.minimum_order <= r.quantity)
            AND (lower(COALESCE(ml.state, '')) = lower(r.state) OR ml.delivery_available)
            AND (NOT r.delivery_required OR ml.delivery_available)
            AND (r.target_price_min IS NULL OR ml.price IS NULL OR ml.price >= r.target_price_min)
            AND (r.target_price_max IS NULL OR ml.price IS NULL OR ml.price <= r.target_price_max)
          ORDER BY (ml.price IS NULL), ml.price ASC NULLS LAST, ml.created_at DESC
          LIMIT 1
        ) l ON true
        LEFT JOIN business_profiles bp ON bp.user_id = l.owner_user_id
        WHERE r.status = 'open' AND r.expires_at > now()
          AND (r.buyer_user_id = ${userId} OR l.owner_user_id = ${userId})
      ) ranked
      ON CONFLICT (request_id, supplier_user_id) WHERE request_id IS NOT NULL
      DO UPDATE SET listing_id = EXCLUDED.listing_id, score = EXCLUDED.score,
        reasons = EXCLUDED.reasons, updated_at = now()
    `);
  }

  private async notifyPotentialBuyers(listingId: string) {
    await this.context("marketplace-system", "admin", async (tx) => {
      await tx.execute(sql`
        INSERT INTO marketplace_notifications (user_id, notification_type, listing_id)
        SELECT p.user_id, 'matching_listing', l.id
        FROM marketplace_listings l JOIN business_preferences p ON p.user_id <> l.owner_user_id
        WHERE l.id = ${listingId} AND l.status = 'active' AND l.availability <> 'unavailable'
          AND l.expires_at > now()
          AND l.product_type = ANY(p.products_need)
          AND p.marketplace_notifications_enabled
          AND (cardinality(p.preferred_states) = 0 OR l.state = ANY(p.preferred_states))
          AND (p.min_quantity IS NULL OR COALESCE(l.quantity, 0) >= p.min_quantity)
          AND (p.max_price IS NULL OR l.price IS NULL OR l.price <= p.max_price)
          AND (p.min_price IS NULL OR l.price IS NULL OR l.price >= p.min_price)
          AND (p.max_quantity IS NULL OR l.quantity IS NULL OR l.quantity <= p.max_quantity)
          AND (NOT p.delivery_required OR l.delivery_available)
          AND NOT EXISTS (SELECT 1 FROM marketplace_notifications n
            WHERE n.user_id = p.user_id AND n.listing_id = l.id AND n.notification_type = 'matching_listing')
      `);
      await tx.execute(sql`
        INSERT INTO marketplace_notifications (user_id, notification_type, request_id)
        SELECT r.buyer_user_id, 'matching_request', r.id
        FROM buyer_requests r
        WHERE r.status = 'open' AND r.expires_at > now()
          AND COALESCE((SELECT p.marketplace_notifications_enabled FROM business_preferences p
            WHERE p.user_id = r.buyer_user_id), true)
          AND EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = ${listingId}
            AND l.owner_user_id <> r.buyer_user_id AND l.status = 'active' AND l.expires_at > now()
            AND l.product_type = r.product_type AND COALESCE(l.quantity, 0) >= r.quantity
            AND (l.minimum_order IS NULL OR l.minimum_order <= r.quantity)
            AND (lower(COALESCE(l.state, '')) = lower(r.state) OR l.delivery_available)
            AND (NOT r.delivery_required OR l.delivery_available)
            AND (r.target_price_min IS NULL OR l.price IS NULL OR l.price >= r.target_price_min)
            AND (r.target_price_max IS NULL OR l.price IS NULL OR l.price <= r.target_price_max))
          AND NOT EXISTS (SELECT 1 FROM marketplace_notifications n WHERE n.user_id = r.buyer_user_id
            AND n.request_id = r.id AND n.notification_type = 'matching_request')
      `);
    });
  }

  private async notifyPotentialSuppliers(requestId: string) {
    await this.context("marketplace-system", "admin", async (tx) => {
      await tx.execute(sql`
        INSERT INTO marketplace_notifications (user_id, notification_type, request_id)
        SELECT l.owner_user_id, 'matching_request', r.id
        FROM buyer_requests r JOIN marketplace_listings l ON l.owner_user_id <> r.buyer_user_id
        LEFT JOIN business_preferences p ON p.user_id = l.owner_user_id
        WHERE r.id = ${requestId} AND r.status = 'open' AND r.expires_at > now()
          AND l.status = 'active' AND l.availability <> 'unavailable' AND l.expires_at > now()
          AND l.product_type = r.product_type AND COALESCE(l.quantity, 0) >= r.quantity
          AND (l.minimum_order IS NULL OR l.minimum_order <= r.quantity)
          AND (lower(COALESCE(l.state, '')) = lower(r.state) OR l.delivery_available)
          AND (NOT r.delivery_required OR l.delivery_available)
          AND (r.target_price_min IS NULL OR l.price IS NULL OR l.price >= r.target_price_min)
          AND (r.target_price_max IS NULL OR l.price IS NULL OR l.price <= r.target_price_max)
          AND COALESCE(p.marketplace_notifications_enabled, true)
          AND NOT EXISTS (SELECT 1 FROM marketplace_notifications n WHERE n.user_id = l.owner_user_id
            AND n.request_id = r.id AND n.notification_type = 'matching_request')
      `);
    });
  }

  private async refreshMatchesForUser(userId: string) {
    await this.context("marketplace-system", "admin", (tx) => this.refreshMatches(tx, userId));
  }

  async listCategories(userId: string) {
    return this.context(userId, "authenticated", async (tx) => asRows(await tx.execute(sql`
      SELECT id, name, description FROM marketplace_categories WHERE active = true ORDER BY name
    `)));
  }

  async listListings(userId: string, filters: ListingFilters) {
    return this.context(userId, "authenticated", async (tx) => {
      const orderBy = filters.sort === "price_asc" ? sql`l.price ASC NULLS LAST, l.created_at DESC`
        : filters.sort === "quantity_desc" ? sql`l.quantity DESC NULLS LAST, l.created_at DESC`
        : filters.sort === "verified" ? sql`bp.business_verified DESC, l.created_at DESC`
        : filters.sort === "recent" ? sql`l.created_at DESC`
        : sql`bp.business_verified DESC, l.created_at DESC`;
      return asRows(await tx.execute(sql`
        SELECT l.id, l.owner_user_id AS "ownerUserId", l.title, l.description,
          l.category_id AS "categoryId", c.name AS "categoryName", l.listing_type AS "listingType",
          l.product_type AS "productType", l.quantity, l.unit, l.price, l.minimum_order AS "minimumOrder",
          l.state, l.lga, l.city, l.delivery_available AS "deliveryAvailable",
          l.collection_available AS "collectionAvailable", l.availability, l.status,
          l.expires_at AS "expiresAt", l.created_at AS "createdAt",
          COALESCE(bp.display_name, 'Verified customer') AS "displayName",
          bp.business_name AS "businessName",
          COALESCE(bp.business_verified, false) AS "businessVerified",
          COALESCE(bp.customer_verified, true) AS "customerVerified"
        FROM marketplace_listings l
        JOIN marketplace_categories c ON c.id = l.category_id
        LEFT JOIN business_profiles bp ON bp.user_id = l.owner_user_id
        WHERE l.status = 'active' AND l.expires_at > now() AND l.availability <> 'unavailable'
          AND l.owner_user_id <> ${userId}
          AND (${filters.q || null}::text IS NULL OR concat_ws(' ', l.title, l.description, bp.business_name,
            l.city, l.lga, l.state, c.name) ILIKE ${filters.q ? `%${filters.q.trim().replace(/[%_]/g, "\\$&")}%` : "%"})
          AND (${filters.product || null}::text IS NULL OR l.product_type = ${filters.product || ""})
          AND (${filters.category || null}::text IS NULL OR l.category_id = ${filters.category || ""})
          AND (${filters.state || null}::text IS NULL OR lower(l.state) = lower(${filters.state || ""}))
          AND (${filters.lga || null}::text IS NULL OR lower(l.lga) = lower(${filters.lga || ""}))
          AND (${filters.city || null}::text IS NULL OR lower(l.city) = lower(${filters.city || ""}))
          AND (${filters.minPrice ?? null}::numeric IS NULL OR l.price >= ${filters.minPrice ?? 0})
          AND (${filters.maxPrice ?? null}::numeric IS NULL OR l.price <= ${filters.maxPrice ?? 0})
          AND (${filters.minQuantity ?? null}::numeric IS NULL OR l.quantity >= ${filters.minQuantity ?? 0})
          AND (${filters.delivery === true ? true : false} = false OR l.delivery_available = true)
          AND (${filters.verified === true ? true : false} = false OR bp.business_verified = true)
        ORDER BY ${orderBy}
        LIMIT 100
      `));
    });
  }

  async getDashboard(userId: string) {
    await this.refreshMatchesForUser(userId);
    return this.context(userId, "authenticated", async (tx) => {
      const [summary] = asRows(await tx.execute(sql`
        SELECT
          (SELECT count(*)::int FROM marketplace_listings WHERE owner_user_id = ${userId} AND status = 'active' AND expires_at > now()) AS "activeListings",
          (SELECT count(*)::int FROM buyer_requests WHERE buyer_user_id = ${userId} AND status = 'open' AND expires_at > now()) AS "openRequests",
          (SELECT count(*)::int FROM supplier_offers WHERE supplier_user_id = ${userId} AND status = 'pending') AS "offersSent",
          (SELECT count(*)::int FROM supplier_offers o JOIN buyer_requests r ON r.id = o.request_id WHERE r.buyer_user_id = ${userId} AND o.status = 'pending') AS "offersReceived",
          (SELECT count(*)::int FROM marketplace_enquiries WHERE recipient_user_id = ${userId} AND status = 'open') AS "newEnquiries",
          (SELECT count(*)::int FROM marketplace_transactions WHERE buyer_user_id = ${userId} OR supplier_user_id = ${userId}) AS "acceptedOffers",
          (SELECT count(*)::int FROM marketplace_listings WHERE owner_user_id = ${userId} AND status = 'active' AND expires_at <= now() + interval '7 days') AS "expiringListings",
          (SELECT count(*)::int FROM business_matches WHERE buyer_user_id = ${userId} OR supplier_user_id = ${userId}) AS "recommendedMatches"
      `));
      const listings = await tx.execute(sql`SELECT l.id, l.title, l.product_type AS "productType",
          l.status, l.expires_at AS "expiresAt", l.created_at AS "createdAt",
          COALESCE((SELECT json_agg(json_build_object('id', d.id, 'fileName', d.file_name))
            FROM marketplace_listing_documents d WHERE d.listing_id = l.id), '[]'::json) AS documents
          FROM marketplace_listings l WHERE l.owner_user_id = ${userId}
          ORDER BY l.created_at DESC LIMIT 10`);
      const requests = await tx.execute(sql`SELECT id, title, product_type AS "productType", quantity, state, status, expires_at AS "expiresAt"
          FROM buyer_requests WHERE buyer_user_id = ${userId} ORDER BY created_at DESC LIMIT 10`);
      const offers = await tx.execute(sql`SELECT o.id, o.request_id AS "requestId", o.quantity, o.price, o.status, o.expires_at AS "expiresAt",
          r.title AS "requestTitle", r.buyer_user_id AS "buyerUserId", o.supplier_user_id AS "supplierUserId",
          CASE WHEN r.buyer_user_id = ${userId} THEN 'received' ELSE 'sent' END AS direction
          FROM supplier_offers o JOIN buyer_requests r ON r.id = o.request_id
          WHERE r.buyer_user_id = ${userId} OR o.supplier_user_id = ${userId}
          ORDER BY o.created_at DESC LIMIT 20`);
      const matches = await tx.execute(sql`SELECT m.id, m.request_id AS "requestId", m.listing_id AS "listingId",
          m.score, m.reasons, r.title AS "requestTitle", r.product_type AS "productType", r.quantity,
          r.state, l.title AS "listingTitle", l.price, l.quantity AS "listingQuantity",
          l.owner_user_id AS "supplierUserId", r.buyer_user_id AS "buyerUserId",
          COALESCE(bp.business_name, bp.display_name, 'Verified customer') AS "businessName",
          COALESCE(bp.business_verified, false) AS "businessVerified"
          FROM business_matches m JOIN buyer_requests r ON r.id = m.request_id
          LEFT JOIN marketplace_listings l ON l.id = m.listing_id
          LEFT JOIN business_profiles bp ON bp.user_id = CASE WHEN m.buyer_user_id = ${userId}
            THEN m.supplier_user_id ELSE m.buyer_user_id END
          WHERE m.buyer_user_id = ${userId} OR m.supplier_user_id = ${userId}
          ORDER BY m.score DESC, m.updated_at DESC LIMIT 20`);
      const enquiries = await tx.execute(sql`SELECT e.id, e.listing_id AS "listingId", e.request_id AS "requestId",
          e.sender_user_id AS "senderUserId", e.recipient_user_id AS "recipientUserId",
          e.message, e.status, e.created_at AS "createdAt", l.title AS "listingTitle",
          r.title AS "requestTitle"
          FROM marketplace_enquiries e LEFT JOIN marketplace_listings l ON l.id = e.listing_id
          LEFT JOIN buyer_requests r ON r.id = e.request_id
          WHERE e.sender_user_id = ${userId} OR e.recipient_user_id = ${userId}
          ORDER BY e.created_at DESC LIMIT 20`);
      const notifications = await tx.execute(sql`SELECT id, notification_type AS type, listing_id AS "listingId",
          request_id AS "requestId", offer_id AS "offerId", enquiry_id AS "enquiryId", read_at AS "readAt",
          created_at AS "createdAt" FROM marketplace_notifications WHERE user_id = ${userId}
          ORDER BY created_at DESC LIMIT 30`);
      return {
        summary: summary || {}, listings: asRows(listings), requests: asRows(requests),
        offers: asRows(offers), matches: asRows(matches), enquiries: asRows(enquiries),
        notifications: asRows(notifications),
      };
    });
  }

  async createListing(userId: string, input: {
    title: string; description: string; categoryId: string; listingType: "supply" | "service";
    productType?: string; quantity?: number; unit: string; price?: number; minimumOrder?: number;
    state?: string; lga?: string; city?: string; deliveryAvailable: boolean;
    collectionAvailable: boolean; expiresAt: string;
  }) {
    const row = await this.context(userId, "authenticated", async (tx) => {
      const [created] = asRows<{ id: string }>(await tx.execute(sql`
        INSERT INTO marketplace_listings (owner_user_id, title, description, category_id, listing_type,
          product_type, quantity, unit, price, minimum_order, state, lga, city, delivery_available,
          collection_available, expires_at)
        VALUES (${userId}, ${input.title}, ${input.description}, ${input.categoryId}, ${input.listingType},
          ${input.productType || null}, ${input.quantity ?? null}, ${input.unit}, ${input.price ?? null},
          ${input.minimumOrder ?? null}, ${input.state || null}, ${input.lga || null}, ${input.city || null},
          ${input.deliveryAvailable}, ${input.collectionAvailable}, ${input.expiresAt})
        RETURNING id, title, status, expires_at AS "expiresAt", created_at AS "createdAt"
      `));
      if (!created) throw failure("Listing could not be created.", 500);
      await tx.execute(sql`INSERT INTO customer_activity_logs (user_id, action, entity_type, entity_id)
        VALUES (${userId}, 'marketplace_listing_created', 'marketplace_listing', ${created.id})`);
      return created;
    });
    await this.notifyPotentialBuyers(row.id);
    await this.refreshMatchesForUser(userId);
    return row;
  }

  async uploadListingDocument(userId: string, listingId: string, bytes: Buffer, fileName: string, mimeType: string) {
    if (!bytes.length || bytes.length > 10 * 1024 * 1024 || !this.isAllowedDocument(bytes, mimeType)) {
      throw failure("Upload a valid JPEG, PNG, WebP or PDF up to 10 MB.", 400);
    }
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = "messaging-private";
    if (!supabaseUrl || !serviceKey) throw failure("Private document storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", 503);
    await this.context(userId, "authenticated", async (tx) => {
      const owner = asRows(await tx.execute(sql`SELECT 1 FROM marketplace_listings
        WHERE id = ${listingId} AND owner_user_id = ${userId} LIMIT 1`));
      if (!owner.length) throw failure("Only the listing owner can upload business documents.", 403);
    });
    const storagePath = `marketplace/${listingId}/${randomUUID()}`;
    const upload = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": mimeType, "x-upsert": "false" },
      body: bytes,
    });
    if (!upload.ok) throw failure("Private document upload failed.", 502);
    try {
      return await this.context(userId, "authenticated", async (tx) => {
        const [document] = asRows<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>(await tx.execute(sql`
          INSERT INTO marketplace_listing_documents
            (listing_id, uploader_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes)
          SELECT id, ${userId}, ${bucket}, ${storagePath}, ${fileName.slice(0, 180)}, ${mimeType}, ${bytes.length}
          FROM marketplace_listings WHERE id = ${listingId} AND owner_user_id = ${userId}
          RETURNING id, file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes"
        `));
        if (!document) throw failure("Listing was not found or document access is denied.", 403);
        return document;
      });
    } catch (error) {
      await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      }).catch(() => undefined);
      throw error;
    }
  }

  async getListingDocumentUrl(userId: string, documentId: string, isAdmin = false) {
    const role: Role = isAdmin ? "admin" : "authenticated";
    const document = await this.context(userId, role, async (tx) => {
      const [row] = asRows<{ storage_bucket: string; storage_path: string }>(await tx.execute(sql`
        SELECT d.storage_bucket, d.storage_path FROM marketplace_listing_documents d
        JOIN marketplace_listings l ON l.id = d.listing_id
        WHERE d.id = ${documentId} AND (l.owner_user_id = ${userId} OR ${isAdmin})
      `));
      if (!row) throw failure("Document not found or access denied.", 404);
      return row;
    });
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw failure("Private document storage is not configured.", 503);
    const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(document.storage_bucket)}/${document.storage_path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 300 }),
    });
    if (!response.ok) throw failure("Could not create a secure document link.", 502);
    const signed = await response.json() as { signedURL?: string };
    return { url: signed.signedURL?.startsWith("http") ? signed.signedURL : `${supabaseUrl}/storage/v1${signed.signedURL}` };
  }

  async updateListing(userId: string, listingId: string, input: {
    title?: string; description?: string; categoryId?: string; listingType?: "supply" | "service";
    productType?: string | null; quantity?: number | null; unit?: string; price?: number | null;
    minimumOrder?: number | null; state?: string | null; lga?: string | null; city?: string | null;
    deliveryAvailable?: boolean; collectionAvailable?: boolean; availability?: "available" | "limited" | "unavailable";
    status?: "active" | "paused" | "sold" | "archived"; expiresAt?: string;
  }) {
    const row = await this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows<{ id: string; status: string }>(await tx.execute(sql`
        UPDATE marketplace_listings SET
          title = COALESCE(${input.title ?? null}, title),
          description = COALESCE(${input.description ?? null}, description),
          category_id = COALESCE(${input.categoryId ?? null}, category_id),
          listing_type = COALESCE(${input.listingType ?? null}, listing_type),
          product_type = CASE WHEN ${input.productType === null ? true : false} THEN NULL
            ELSE COALESCE(${input.productType ?? null}, product_type) END,
          quantity = CASE WHEN ${input.quantity === null ? true : false} THEN NULL
            ELSE COALESCE(${input.quantity ?? null}, quantity) END,
          unit = COALESCE(${input.unit ?? null}, unit),
          price = CASE WHEN ${input.price === null ? true : false} THEN NULL
            ELSE COALESCE(${input.price ?? null}, price) END,
          minimum_order = CASE WHEN ${input.minimumOrder === null ? true : false} THEN NULL
            ELSE COALESCE(${input.minimumOrder ?? null}, minimum_order) END,
          state = COALESCE(${input.state ?? null}, state), lga = COALESCE(${input.lga ?? null}, lga),
          city = COALESCE(${input.city ?? null}, city),
          delivery_available = COALESCE(${input.deliveryAvailable ?? null}, delivery_available),
          collection_available = COALESCE(${input.collectionAvailable ?? null}, collection_available),
          availability = COALESCE(${input.availability ?? null}, availability),
          status = COALESCE(${input.status ?? null}, status),
          expires_at = COALESCE(${input.expiresAt ?? null}, expires_at), updated_at = now()
        WHERE id = ${listingId} AND owner_user_id = ${userId}
          AND (${input.status !== "active" ? true : false} OR expires_at > now())
        RETURNING id, status, expires_at AS "expiresAt"
      `));
      if (!row) throw failure("Listing not found or cannot be renewed.", 404);
      return row;
    });
    if (row.status === "active") await this.notifyPotentialBuyers(listingId);
    await this.refreshMatchesForUser(userId);
    return row;
  }

  async createBuyerRequest(userId: string, input: {
    title: string; productType: string; quantity: number; targetPriceMin?: number;
    targetPriceMax?: number; state: string; lga?: string; city?: string;
    deliveryRequired: boolean; requiredDeliveryDate?: string; requirements?: string; expiresAt: string;
  }) {
    const row = await this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows<{ id: string }>(await tx.execute(sql`
        INSERT INTO buyer_requests (buyer_user_id, title, product_type, quantity, target_price_min,
          target_price_max, state, lga, city, delivery_required, required_delivery_date, requirements, expires_at)
        VALUES (${userId}, ${input.title}, ${input.productType}, ${input.quantity},
          ${input.targetPriceMin ?? null}, ${input.targetPriceMax ?? null}, ${input.state},
          ${input.lga || null}, ${input.city || null}, ${input.deliveryRequired},
          ${input.requiredDeliveryDate || null}, ${input.requirements || null}, ${input.expiresAt})
        RETURNING id, title, status, expires_at AS "expiresAt", created_at AS "createdAt"
      `));
      await tx.execute(sql`INSERT INTO customer_activity_logs (user_id, action, entity_type, entity_id)
        VALUES (${userId}, 'marketplace_request_created', 'buyer_request', ${row.id})`);
      return row;
    });
    await this.notifyPotentialSuppliers(row.id);
    await this.refreshMatchesForUser(userId);
    return row;
  }

  async listBuyerRequests(userId: string) {
    await this.refreshMatchesForUser(userId);
    return this.context(userId, "authenticated", async (tx) => {
      return asRows(await tx.execute(sql`
        SELECT r.id, r.buyer_user_id AS "buyerUserId", r.title, r.product_type AS "productType",
          r.quantity, r.target_price_min AS "targetPriceMin", r.target_price_max AS "targetPriceMax",
          r.state, r.lga, r.city, r.delivery_required AS "deliveryRequired",
          r.required_delivery_date AS "requiredDeliveryDate", r.requirements, r.status,
          r.expires_at AS "expiresAt", r.created_at AS "createdAt",
          COALESCE(bp.display_name, 'Verified customer') AS "displayName", bp.business_name AS "businessName",
          COALESCE(bp.business_verified, false) AS "businessVerified"
        FROM buyer_requests r LEFT JOIN business_profiles bp ON bp.user_id = r.buyer_user_id
        WHERE (r.buyer_user_id = ${userId} OR EXISTS (
          SELECT 1 FROM business_matches m WHERE m.request_id = r.id AND m.supplier_user_id = ${userId}
        )) AND r.status = 'open' AND r.expires_at > now()
        ORDER BY r.created_at DESC LIMIT 100
      `));
    });
  }

  async updateBuyerRequest(userId: string, requestId: string, status: "open" | "paused" | "closed", expiresAt?: string) {
    const row = await this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows<{ id: string; status: string }>(await tx.execute(sql`
        UPDATE buyer_requests SET status = ${status}, expires_at = COALESCE(${expiresAt ?? null}, expires_at),
          updated_at = now()
        WHERE id = ${requestId} AND buyer_user_id = ${userId}
          AND (${status !== "open" ? true : false} OR COALESCE(${expiresAt ?? null}::timestamptz, expires_at) > now())
          AND status IN ('open', 'paused', 'expired')
        RETURNING id, status
      `));
      if (!row) throw failure("Procurement request not found or cannot be reopened.", 404);
      return row;
    });
    if (row.status === "open") {
      await this.notifyPotentialSuppliers(requestId);
      await this.refreshMatchesForUser(userId);
    }
    return row;
  }

  async savePreferences(userId: string, input: {
    roles: string[]; productsSupply: string[]; productsNeed: string[]; preferredStates: string[];
    minQuantity?: number; maxQuantity?: number; minPrice?: number; maxPrice?: number;
    deliveryRequired: boolean; marketplaceNotificationsEnabled: boolean;
  }) {
    const row = await this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows(await tx.execute(sql`
        INSERT INTO business_preferences (user_id, roles, products_supply, products_need, preferred_states,
          min_quantity, max_quantity, min_price, max_price, delivery_required, marketplace_notifications_enabled)
        VALUES (${userId}, ${input.roles}, ${input.productsSupply}, ${input.productsNeed}, ${input.preferredStates},
          ${input.minQuantity ?? null}, ${input.maxQuantity ?? null}, ${input.minPrice ?? null},
          ${input.maxPrice ?? null}, ${input.deliveryRequired}, ${input.marketplaceNotificationsEnabled})
        ON CONFLICT (user_id) DO UPDATE SET roles = EXCLUDED.roles, products_supply = EXCLUDED.products_supply,
          products_need = EXCLUDED.products_need, preferred_states = EXCLUDED.preferred_states,
          min_quantity = EXCLUDED.min_quantity, max_quantity = EXCLUDED.max_quantity,
          min_price = EXCLUDED.min_price, max_price = EXCLUDED.max_price,
          delivery_required = EXCLUDED.delivery_required,
          marketplace_notifications_enabled = EXCLUDED.marketplace_notifications_enabled, updated_at = now()
        RETURNING user_id AS "userId", roles, products_supply AS "productsSupply",
          products_need AS "productsNeed", preferred_states AS "preferredStates",
          min_quantity AS "minQuantity", max_quantity AS "maxQuantity",
          min_price AS "minPrice", max_price AS "maxPrice", delivery_required AS "deliveryRequired",
          marketplace_notifications_enabled AS "marketplaceNotificationsEnabled"
      `));
      return row;
    });
    await this.refreshMatchesForUser(userId);
    return row;
  }

  async getPreferences(userId: string) {
    return this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows(await tx.execute(sql`SELECT user_id AS "userId", roles,
        products_supply AS "productsSupply", products_need AS "productsNeed",
        preferred_states AS "preferredStates", min_quantity AS "minQuantity",
        max_quantity AS "maxQuantity", min_price AS "minPrice", max_price AS "maxPrice",
        delivery_required AS "deliveryRequired", marketplace_notifications_enabled AS "marketplaceNotificationsEnabled"
        FROM business_preferences WHERE user_id = ${userId}`));
      return row || { roles: [], productsSupply: [], productsNeed: [], preferredStates: [], deliveryRequired: false, marketplaceNotificationsEnabled: true };
    });
  }

  async createOffer(userId: string, requestId: string, input: {
    listingId?: string; productType: string; quantity: number; price: number;
    deliveryTerms: string; location: string; expiresAt: string; conditions?: string;
  }) {
    await this.refreshMatchesForUser(userId);
    return this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows<{ id: string }>(await tx.execute(sql`
        INSERT INTO supplier_offers (request_id, listing_id, supplier_user_id, offered_product,
          quantity, price, delivery_terms, location, expires_at, conditions)
        SELECT r.id, ${input.listingId || null}, ${userId}, ${input.productType}, ${input.quantity},
          ${input.price}, ${input.deliveryTerms}, ${input.location}, ${input.expiresAt}, ${input.conditions || null}
        FROM buyer_requests r JOIN business_matches m ON m.request_id = r.id
          AND m.supplier_user_id = ${userId} AND m.buyer_user_id = r.buyer_user_id
        WHERE r.id = ${requestId} AND r.status = 'open' AND r.expires_at > now()
          AND ${input.quantity} >= r.quantity AND ${input.productType} = r.product_type
          AND EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.id = COALESCE(${input.listingId || null}::uuid, m.listing_id)
            AND l.owner_user_id = ${userId} AND l.status = 'active' AND l.expires_at > now()
            AND l.product_type = ${input.productType} AND COALESCE(l.quantity, 0) >= ${input.quantity}
            AND (l.minimum_order IS NULL OR l.minimum_order <= r.quantity)
            AND (lower(COALESCE(l.state, '')) = lower(r.state) OR l.delivery_available)
            AND (NOT r.delivery_required OR l.delivery_available)
            AND (r.target_price_min IS NULL OR ${input.price} >= r.target_price_min)
            AND (r.target_price_max IS NULL OR ${input.price} <= r.target_price_max))
        RETURNING id, request_id AS "requestId", status, created_at AS "createdAt"
      `));
      if (!row) throw failure("This request is not open or does not match your available supply.", 404);
      await tx.execute(sql`INSERT INTO marketplace_notifications (user_id, notification_type, request_id, offer_id)
        SELECT r.buyer_user_id, 'offer_received', ${requestId}, ${row.id}
        FROM buyer_requests r WHERE r.id = ${requestId}
          AND COALESCE((SELECT p.marketplace_notifications_enabled FROM business_preferences p
            WHERE p.user_id = r.buyer_user_id), true)`);
      return row;
    });
  }

  async reviewOffer(userId: string, offerId: string, action: "accept" | "decline") {
    return this.context(userId, "authenticated", async (tx) => {
      const [offer] = asRows<{ id: string; request_id: string; supplier_user_id: string; status: string }>(await tx.execute(sql`
        UPDATE supplier_offers o SET status = ${action === "accept" ? "accepted" : "declined"}, updated_at = now()
        FROM buyer_requests r WHERE o.id = ${offerId} AND r.id = o.request_id AND r.buyer_user_id = ${userId}
          AND o.status = 'pending' AND o.expires_at > now() AND r.status = 'open'
        RETURNING o.id, o.request_id, o.supplier_user_id, o.status
      `));
      if (!offer) throw failure("Offer not found or no longer pending.", 404);
      if (action === "accept") {
        await tx.execute(sql`UPDATE supplier_offers SET status = 'declined', updated_at = now()
          WHERE request_id = ${offer.request_id} AND id <> ${offer.id} AND status = 'pending'`);
        await tx.execute(sql`UPDATE buyer_requests SET status = 'filled', updated_at = now()
          WHERE id = ${offer.request_id}`);
        await tx.execute(sql`INSERT INTO marketplace_transactions (offer_id, buyer_user_id, supplier_user_id)
          VALUES (${offer.id}, ${userId}, ${offer.supplier_user_id}) ON CONFLICT (offer_id) DO NOTHING`);
      }
      await tx.execute(sql`INSERT INTO marketplace_notifications (user_id, notification_type, request_id, offer_id)
        SELECT ${offer.supplier_user_id}, ${action === "accept" ? "offer_accepted" : "offer_declined"},
          ${offer.request_id}, ${offer.id}
        WHERE COALESCE((SELECT p.marketplace_notifications_enabled FROM business_preferences p
          WHERE p.user_id = ${offer.supplier_user_id}), true)`);
      return offer;
    });
  }

  async createEnquiry(userId: string, listingId: string, message: string) {
    return this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows<{ id: string; recipientUserId: string }>(await tx.execute(sql`
        INSERT INTO marketplace_enquiries (listing_id, sender_user_id, recipient_user_id, message)
        SELECT l.id, ${userId}, l.owner_user_id, ${message}
        FROM marketplace_listings l
        WHERE l.id = ${listingId} AND l.owner_user_id <> ${userId}
          AND l.status = 'active' AND l.expires_at > now()
          AND NOT public.messaging_contact_is_blocked(l.owner_user_id)
        RETURNING id, listing_id AS "listingId", recipient_user_id AS "recipientUserId",
          created_at AS "createdAt"
      `));
      if (!row) throw failure("Listing not found, unavailable, or contact is blocked.", 404);
      await tx.execute(sql`INSERT INTO marketplace_notifications (user_id, notification_type, listing_id, enquiry_id)
        SELECT ${row.recipientUserId}, 'enquiry_received', ${listingId}, ${row.id}
        WHERE COALESCE((SELECT p.marketplace_notifications_enabled FROM business_preferences p
          WHERE p.user_id = ${row.recipientUserId}), true)`);
      await tx.execute(sql`INSERT INTO customer_activity_logs (user_id, action, entity_type, entity_id)
        VALUES (${userId}, 'marketplace_enquiry_sent', 'marketplace_enquiry', ${row.id})`);
      return row;
    });
  }

  async reportListing(userId: string, listingId: string, reason: string) {
    return this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows(await tx.execute(sql`
        INSERT INTO listing_reports (listing_id, reporter_user_id, reason)
        VALUES (${listingId}, ${userId}, ${reason})
        ON CONFLICT (listing_id, reporter_user_id) DO NOTHING
        RETURNING id, status, created_at AS "createdAt"
      `));
      if (row) return row;
      const [existing] = asRows(await tx.execute(sql`
        SELECT id, status, created_at AS "createdAt" FROM listing_reports
        WHERE listing_id = ${listingId} AND reporter_user_id = ${userId}
      `));
      if (!existing) throw failure("Listing report could not be saved.", 500);
      return existing;
    });
  }

  async listNotifications(userId: string) {
    return this.context(userId, "authenticated", async (tx) => asRows(await tx.execute(sql`
      SELECT id, notification_type AS type, listing_id AS "listingId", request_id AS "requestId",
        offer_id AS "offerId", enquiry_id AS "enquiryId", read_at AS "readAt", created_at AS "createdAt"
      FROM marketplace_notifications WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 100
    `)));
  }

  async markNotificationRead(userId: string, notificationId: string) {
    return this.context(userId, "authenticated", async (tx) => {
      const [row] = asRows(await tx.execute(sql`
        UPDATE marketplace_notifications SET read_at = COALESCE(read_at, now())
        WHERE id = ${notificationId} AND user_id = ${userId} RETURNING id
      `));
      if (!row) throw failure("Notification not found.", 404);
      return row;
    });
  }

  async adminListReports(userId: string) {
    return this.context(userId, "admin", async (tx) => asRows(await tx.execute(sql`
      SELECT r.id, r.listing_id AS "listingId", r.reporter_user_id AS "reporterUserId",
        r.reason, r.status, r.resolution, r.created_at AS "createdAt",
        l.title AS "listingTitle", l.owner_user_id AS "ownerUserId"
      FROM listing_reports r JOIN marketplace_listings l ON l.id = r.listing_id
      ORDER BY CASE WHEN r.status IN ('open', 'reviewing') THEN 0 ELSE 1 END, r.created_at DESC
      LIMIT 500
    `)));
  }

  async adminReviewReport(userId: string, reportId: string, action: "dismiss" | "remove_listing" | "restore_listing", resolution: string) {
    return this.context(userId, "admin", async (tx) => {
      const [report] = asRows<{ listing_id: string; status: string }>(await tx.execute(sql`
        SELECT listing_id, status FROM listing_reports WHERE id = ${reportId} FOR UPDATE
      `));
      if (!report) throw failure("Report not found.", 404);
      const [listing] = asRows<{ id: string; status: string }>(await tx.execute(sql`
        SELECT id, status FROM marketplace_listings WHERE id = ${report.listing_id} FOR UPDATE
      `));
      if (!listing) throw failure("Listing no longer exists.", 404);
      if (action === "remove_listing") {
        await tx.execute(sql`UPDATE marketplace_listings SET status = 'rejected', updated_at = now()
          WHERE id = ${report.listing_id}`);
      } else if (action === "restore_listing") {
        await tx.execute(sql`UPDATE marketplace_listings SET status = 'active', updated_at = now()
          WHERE id = ${report.listing_id} AND expires_at > now()`);
      }
      await tx.execute(sql`UPDATE listing_reports SET status = ${action === "dismiss" ? "dismissed" : "resolved"},
        reviewed_by = ${userId}, resolution = ${resolution}, reviewed_at = now() WHERE id = ${reportId}`);
      await tx.execute(sql`INSERT INTO admin_audit_logs (admin_user_id, action, entity_type, entity_id, before_state, after_state)
        VALUES (${userId}, ${action}, 'marketplace_listing', ${report.listing_id},
          ${JSON.stringify({ status: listing.status, reportStatus: report.status })}::jsonb,
          ${JSON.stringify({ action, resolution })}::jsonb)`);
      return { id: reportId, action };
    });
  }

  async expireListings() {
    return this.context("marketplace-system", "admin", async (tx) => {
      await tx.execute(sql`
        INSERT INTO marketplace_notifications (user_id, notification_type, listing_id)
        SELECT l.owner_user_id, 'listing_expiring', l.id FROM marketplace_listings l
        WHERE l.status = 'active' AND l.expires_at > now() AND l.expires_at <= now() + interval '7 days'
          AND COALESCE((SELECT p.marketplace_notifications_enabled FROM business_preferences p
            WHERE p.user_id = l.owner_user_id), true)
          AND NOT EXISTS (SELECT 1 FROM marketplace_notifications n WHERE n.user_id = l.owner_user_id
            AND n.listing_id = l.id AND n.notification_type = 'listing_expiring')
      `);
      const listings = asRows<{ id: string; owner_user_id: string }>(await tx.execute(sql`
        UPDATE marketplace_listings SET status = 'archived', updated_at = now()
        WHERE status = 'active' AND expires_at <= now()
        RETURNING id, owner_user_id
      `));
      await tx.execute(sql`UPDATE buyer_requests SET status = 'expired', updated_at = now()
        WHERE status = 'open' AND expires_at <= now()`);
      await tx.execute(sql`UPDATE supplier_offers SET status = 'expired', updated_at = now()
        WHERE status = 'pending' AND expires_at <= now()`);
      for (const listing of listings) {
        await tx.execute(sql`INSERT INTO marketplace_notifications (user_id, notification_type, listing_id)
          SELECT ${listing.owner_user_id}, 'listing_expired', ${listing.id}
          WHERE COALESCE((SELECT p.marketplace_notifications_enabled FROM business_preferences p
            WHERE p.user_id = ${listing.owner_user_id}), true)`);
      }
      return listings.length;
    });
  }
}

export const fuelMarketplace = new FuelMarketplaceService();

let expiryTimer: ReturnType<typeof setInterval> | undefined;
export function startMarketplaceJobs() {
  if (expiryTimer) return;
  const expire = () => {
    void fuelMarketplace.expireListings().catch((error) => console.error("Marketplace expiry job failed:", error));
  };
  expire();
  expiryTimer = setInterval(expire, 15 * 60 * 1000);
  expiryTimer.unref?.();
}
