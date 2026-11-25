import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../db.js";
import {
  communityConfirmations,
  communityPriceHistory,
  customerActivityLogs,
  customerTrustScores,
  locationPriceAverages,
  notifications,
  priceDisputes,
  priceSubmissions,
  profiles,
  registeredTerminals,
  stations,
} from "../../shared/schema.js";
import { customerIdentity, type CustomerProfile } from "./customer-identity.service.js";

type DatabaseTransaction = Parameters<Parameters<NonNullable<typeof db>["transaction"]>[0]>[0];

export type FuelCategory = "filling_station" | "terminal";
export type ValidationStatus = "eligible" | "under_review" | "duplicate" | "rejected";
export type FreshnessStatus = "fresh" | "recent" | "stale" | "unconfirmed" | "under_review";
export type LocationKind = "station" | "terminal";

export type PriceSubmissionInput = {
  stationId?: string;
  terminalId?: string;
  locationName: string;
  brand: string;
  category: FuelCategory;
  fuelType: "PMS" | "AGO" | "DPK" | "LPG";
  priceNaira: number;
  unit: "litre" | "kg";
  state: string;
  lga: string;
  city: string;
  latitude: number;
  longitude: number;
  observedAt: Date;
  availability: "available" | "limited" | "unavailable";
  comments?: string;
};

export type BusinessRegistrationInput = {
  name: string;
  brand: string;
  businessCategory: "retail_filling_station" | "petroleum_depot" | "terminal" | "other";
  operatorName: string;
  contactPhone: string;
  businessEmail: string;
  state: string;
  lga: string;
  city: string;
  physicalAddress: string;
  latitude: number;
  longitude: number;
  productsSold: string[];
  operatingStatus: "operating" | "temporarily_closed" | "closed" | "unknown";
  businessRegistrationDetails?: string;
};

type Submission = PriceSubmissionInput & {
  id: string;
  customerUserId: string;
  locationKey: string;
  sourceType: "community" | "operator" | "admin" | "nnpc_authorized";
  validationStatus: ValidationStatus;
  moderationStatus: "published" | "under_review" | "rejected" | "deleted";
  validationReasons: string[];
  reportingPeriod: string;
  submittedAt: Date;
  lastConfirmedAt: Date | null;
};

type RegisteredLocation = BusinessRegistrationInput & {
  id: string;
  ownerUserId: string;
  approvalStatus: "pending" | "approved" | "rejected" | "suspended";
  submittedAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  kind: LocationKind;
};

type Average = {
  id: string;
  scope: string;
  aggregationKey: string;
  fuelType: string;
  sourceType: "community";
  reportingPeriod: string;
  averagePrice: number;
  observationCount: number;
  independentReportCount: number;
  freshnessStatus: FreshnessStatus;
  calculatedAt: Date;
};

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
};

type Activity = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
};

type PriceHistory = {
  id: string;
  submissionId: string;
  priceNaira: number;
  sourceType: string;
  validationStatus: string;
  changedBy: string;
  changedAt: Date;
};

type Confirmation = {
  id: string;
  submissionId: string;
  userId: string;
  confirmation: "accurate" | "inaccurate";
  createdAt: Date;
};

type Dispute = {
  id: string;
  submissionId: string;
  reporterUserId: string;
  reason: string;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

type LocalState = {
  stations: RegisteredLocation[];
  terminals: RegisteredLocation[];
  submissions: Submission[];
  averages: Average[];
  confirmations: Confirmation[];
  disputes: Dispute[];
  priceHistory: PriceHistory[];
  notifications: Notification[];
  activities: Activity[];
  scores: Record<string, number>;
  audit: Array<Record<string, unknown>>;
};

const stateFile = path.resolve(process.env.FUELIQ_DATA_DIR || path.join(process.cwd(), "data"), "community-fuel.json");
const emptyState = (): LocalState => ({
  stations: [],
  terminals: [],
  submissions: [],
  averages: [],
  confirmations: [],
  disputes: [],
  priceHistory: [],
  notifications: [],
  activities: [],
  scores: {},
  audit: [],
});

function restoredDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date) return value;
  if (value == null) return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function nigeriaDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function locationKey(input: Pick<PriceSubmissionInput, "locationName" | "brand" | "state" | "lga" | "city" | "category">, placeId?: string) {
  if (placeId) return `${input.category}:${placeId}`;
  const normalized = [
    input.category, input.state, input.lga, input.city, input.brand, input.locationName,
  ].map((part) => part.trim().toLocaleLowerCase("en-NG")).join("|");
  return `location:${createHash("sha256").update(normalized).digest("hex")}`;
}

function distanceMeters(latA: number, lonA: number, latB: number, lonB: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const earthRadius = 6_371_000;
  const latDelta = radians(latB - latA);
  const lonDelta = radians(lonB - lonA);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(lonDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function freshness(submission: Submission, independentReports: number): FreshnessStatus {
  if (submission.validationStatus === "under_review" || submission.moderationStatus === "under_review") return "under_review";
  if (independentReports < 2) return "unconfirmed";
  const age = Date.now() - (submission.lastConfirmedAt || submission.submittedAt).getTime();
  if (age <= 24 * 60 * 60_000) return "fresh";
  if (age <= 72 * 60 * 60_000) return "recent";
  return "stale";
}

function makeNotification(userId: string, type: string, title: string, message: string, payload: Record<string, unknown> = {}): Notification {
  return { id: randomUUID(), userId, type, title, message, payload, readAt: null, createdAt: new Date() };
}

function serializeRows(value: LocalState) {
  return JSON.stringify(value, null, 2);
}

function asRows<T>(result: unknown): T[] {
  return Array.from(result as Iterable<T>);
}

function toCamel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamel);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase()),
    toCamel(item),
  ]));
}

function fromDb<T>(result: unknown): T[] {
  return asRows<Record<string, unknown>>(result).map((row) => toCamel(row) as T);
}

class CommunityFuelService {
  private local = this.loadLocal();

  private loadLocal(): LocalState {
    try {
      if (!fs.existsSync(stateFile)) return emptyState();
      const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8")) as Partial<LocalState>;
      const state = { ...emptyState(), ...parsed } as LocalState;
      state.submissions = (state.submissions || []).map((item) => ({
        ...item,
        observedAt: restoredDate(item.observedAt),
        submittedAt: restoredDate(item.submittedAt),
        lastConfirmedAt: item.lastConfirmedAt ? restoredDate(item.lastConfirmedAt) : null,
      }));
      state.averages = (state.averages || []).map((item) => ({ ...item, calculatedAt: restoredDate(item.calculatedAt) }));
      state.notifications = (state.notifications || []).map((item) => ({
        ...item,
        createdAt: restoredDate(item.createdAt),
        readAt: item.readAt ? restoredDate(item.readAt) : null,
      }));
      state.activities = (state.activities || []).map((item) => ({ ...item, createdAt: restoredDate(item.createdAt) }));
      state.disputes = (state.disputes || []).map((item) => ({
        ...item,
        createdAt: restoredDate(item.createdAt),
        resolvedAt: item.resolvedAt ? restoredDate(item.resolvedAt) : null,
      }));
      state.priceHistory = (state.priceHistory || []).map((item) => ({
        ...item,
        changedAt: restoredDate(item.changedAt),
      }));
      return state;
    } catch (error) {
      console.error("Could not load community fuel data:", error);
      return emptyState();
    }
  }

  private persistLocal() {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const temporaryFile = `${stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, serializeRows(this.local), "utf8");
    fs.renameSync(temporaryFile, stateFile);
  }

  private async context<T>(userId: string, role: "authenticated" | "admin" | "service_role", run: (tx: DatabaseTransaction) => Promise<T>) {
    if (!db) throw new Error("PostgreSQL is not configured.");
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('request.jwt.claim.sub', ${userId}, true),
        set_config('request.jwt.claim.role', ${role}, true)`);
      return run(tx);
    });
  }

  private async requireApprovedCustomer(userId: string): Promise<CustomerProfile> {
    const profile = await customerIdentity.getProfile(userId);
    if (!profile || (!profile.emailVerified && !profile.phoneVerified) || profile.accountStatus !== "approved") {
      throw Object.assign(new Error("Verify your email or phone and wait for administrator approval before using community reporting."), {
        statusCode: 403,
        code: "CUSTOMER_NOT_APPROVED",
      });
    }
    return profile;
  }

  private logActivity(userId: string, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
    const activity: Activity = { id: randomUUID(), userId, action, entityType, entityId, details, createdAt: new Date() };
    this.local.activities.unshift(activity);
    return activity;
  }

  private notify(userId: string, type: string, title: string, message: string, payload: Record<string, unknown> = {}) {
    const notification = makeNotification(userId, type, title, message, payload);
    this.local.notifications.unshift(notification);
    return notification;
  }

  private updateScore(userId: string, delta: number) {
    this.local.scores[userId] = Math.min(100, Math.max(0, (this.local.scores[userId] ?? 50) + delta));
  }

  private recordLocalPriceHistory(submission: Submission, changedBy: string) {
    this.local.priceHistory.unshift({
      id: randomUUID(),
      submissionId: submission.id,
      priceNaira: submission.priceNaira,
      sourceType: submission.sourceType,
      validationStatus: submission.validationStatus,
      changedBy,
      changedAt: new Date(),
    });
  }

  private recalculateLocal(fuelType: string, reportingPeriod: string) {
    const eligible = this.local.submissions.filter((item) =>
      item.fuelType === fuelType
      && item.reportingPeriod === reportingPeriod
      && item.sourceType === "community"
      && item.validationStatus === "eligible"
      && item.moderationStatus === "published",
    );
    const grouped = new Map<string, { rows: Submission[]; scope: string; key: string }>();
    const add = (scope: string, key: string, row: Submission) => {
      const groupKey = `${scope}|${key}`;
      const group = grouped.get(groupKey) || { rows: [], scope, key };
      group.rows.push(row);
      grouped.set(groupKey, group);
    };

    for (const row of eligible) {
      const locationScope = row.category === "terminal" ? "terminal" : "station";
      const locationId = row.category === "terminal" ? row.terminalId : row.stationId;
      add(locationScope, locationId ? `${locationScope}:${locationId}` : `location:${row.locationKey}`, row);
      add("city", `city:${row.category}|${row.state.toLowerCase()}|${row.lga.toLowerCase()}|${row.city.toLowerCase()}`, row);
      add("lga", `lga:${row.category}|${row.state.toLowerCase()}|${row.lga.toLowerCase()}`, row);
      add("state", `state:${row.category}|${row.state.toLowerCase()}`, row);
      add("national", `national:${row.category}`, row);
      add("brand", `brand:${row.category}|${row.brand.toLowerCase()}`, row);
    }

    this.local.averages = this.local.averages.filter((item) =>
      item.fuelType !== fuelType || item.reportingPeriod !== reportingPeriod,
    );
    for (const group of grouped.values()) {
      const count = new Set(group.rows.map((row) => row.customerUserId)).size;
      const latest = group.rows.reduce((current, row) =>
        (row.lastConfirmedAt || row.submittedAt) > current ? (row.lastConfirmedAt || row.submittedAt) : current,
        new Date(0),
      );
      const age = Date.now() - latest.getTime();
      const status: FreshnessStatus = count < 2 ? "unconfirmed" : age <= 24 * 60 * 60_000
        ? "fresh" : age <= 72 * 60 * 60_000 ? "recent" : "stale";
      const average = group.rows.reduce((sum, row) => sum + row.priceNaira, 0) / group.rows.length;
      this.local.averages.push({
        id: randomUUID(),
        scope: group.scope,
        aggregationKey: group.key,
        fuelType,
        sourceType: "community",
        reportingPeriod,
        averagePrice: Math.round(average * 100) / 100,
        observationCount: group.rows.length,
        independentReportCount: count,
        freshnessStatus: status,
        calculatedAt: new Date(),
      });
    }
  }

  async registerBusiness(userId: string, kind: LocationKind, input: BusinessRegistrationInput) {
    await this.requireApprovedCustomer(userId);
    const now = new Date();
    const record: RegisteredLocation = {
      ...input,
      id: randomUUID(),
      ownerUserId: userId,
      approvalStatus: "pending",
      submittedAt: now,
      approvedAt: null,
      approvedBy: null,
      kind,
    };
    if (db) {
      return this.context(userId, "service_role", async (tx) => {
        const tableName = kind === "station" ? "stations" : "registered_terminals";
        const [row] = fromDb<RegisteredLocation>(await tx.execute(sql.raw(`
          INSERT INTO ${tableName}
            (id, name, brand, business_category, owner_user_id, operator_name, contact_phone, business_email,
             state, lga, city, physical_address, latitude, longitude, products_sold, operating_status,
             business_registration_details, approval_status)
          VALUES
            (${sqlValue(record.id)}, ${sqlValue(input.name)}, ${sqlValue(input.brand)}, ${sqlValue(input.businessCategory)},
             ${sqlValue(userId)}, ${sqlValue(input.operatorName)}, ${sqlValue(input.contactPhone)}, ${sqlValue(input.businessEmail)},
             ${sqlValue(input.state)}, ${sqlValue(input.lga)}, ${sqlValue(input.city)}, ${sqlValue(input.physicalAddress)},
             ${input.latitude}, ${input.longitude}, ${sqlValue(JSON.stringify(input.productsSold))}::jsonb,
             ${sqlValue(input.operatingStatus)}, ${sqlValue(input.businessRegistrationDetails || null)}, 'pending')
          RETURNING *
        `)));
        await this.writeActivity(tx, userId, "business_registration_submitted", kind, record.id);
        await this.writeNotification(tx, userId, "business_registration", "Business submitted for review", `${input.name} is awaiting administrator approval.`, { kind, id: record.id });
        return row ? { ...row, kind } : undefined;
      });
    }
    (kind === "station" ? this.local.stations : this.local.terminals).unshift(record);
    this.logActivity(userId, "business_registration_submitted", kind, record.id, { name: record.name });
    this.notify(userId, "business_registration", "Business submitted for review", `${record.name} is awaiting administrator approval.`, { kind, id: record.id });
    this.persistLocal();
    return record;
  }

  async submitPrice(userId: string, input: PriceSubmissionInput, sourceType: Submission["sourceType"] = "community") {
    await this.requireApprovedCustomer(userId);
    const submittedAt = new Date();
    const reportingPeriod = nigeriaDate(input.observedAt);
    const placeId = input.stationId || input.terminalId;
    const key = locationKey(input, placeId);
    const reasons: string[] = [];

    if (Math.abs(submittedAt.getTime() - input.observedAt.getTime()) > 7 * 24 * 60 * 60_000) {
      reasons.push("Observation time is more than seven days from submission.");
    }

    if (db) {
      return this.context(userId, "service_role", async (tx) => {
        const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
        if (!profile || (!profile.emailVerified && !profile.phoneVerified) || profile.accountStatus !== "approved") {
          throw Object.assign(new Error("Account verification and administrator approval are required."), { statusCode: 403 });
        }
        let registered: RegisteredLocation | undefined;
        if (input.stationId) {
          const [row] = fromDb<RegisteredLocation>(await tx.execute(sql`
            SELECT * FROM stations WHERE id = ${input.stationId} AND approval_status = 'approved'
          `));
          registered = row;
        } else if (input.terminalId) {
          const [row] = fromDb<RegisteredLocation>(await tx.execute(sql`
            SELECT * FROM registered_terminals WHERE id = ${input.terminalId} AND approval_status = 'approved'
          `));
          registered = row;
        }
        if ((input.stationId || input.terminalId) && !registered) {
          throw Object.assign(new Error("The selected business location is not approved for public reports."), { statusCode: 400 });
        }
        if (registered && distanceMeters(input.latitude, input.longitude, registered.latitude, registered.longitude) > 2_000) {
          reasons.push("GPS is more than 2 km from the registered location.");
        }

        const [existingOperatorUpdate] = sourceType === "operator"
          ? fromDb<Submission>(await tx.execute(sql`
            SELECT * FROM price_submissions WHERE customer_user_id = ${userId} AND location_key = ${key}
              AND fuel_type = ${input.fuelType} AND reporting_period = ${reportingPeriod}
              AND source_type = 'operator' FOR UPDATE
          `))
          : [];
        const [duplicate] = fromDb<{ id: string }>(await tx.execute(sql`
          SELECT id FROM price_submissions
          WHERE customer_user_id = ${userId} AND location_key = ${key}
            AND fuel_type = ${input.fuelType} AND reporting_period = ${reportingPeriod}
            AND source_type = ${sourceType}
          LIMIT 1
        `));
        if (duplicate && sourceType !== "operator") throw Object.assign(new Error("You have already submitted this product and location for the reporting day."), { statusCode: 409, code: "DUPLICATE_REPORT" });

        const recent = fromDb<{ priceNaira: string }>(await tx.execute(sql`
          SELECT price_naira FROM price_submissions
          WHERE fuel_type = ${input.fuelType} AND state = ${input.state} AND lower(lga) = lower(${input.lga})
            AND validation_status = 'eligible' AND moderation_status = 'published'
            AND source_type = 'community' AND submitted_at >= now() - interval '7 days'
        `)).map((row) => Number(row.priceNaira));
        const typical = median(recent);
        if (typical !== null && (input.priceNaira < typical * 0.5 || input.priceNaira > typical * 1.5)) {
          reasons.push("Price differs from recent local community reports by more than 50%.");
        }
        const dailyCount = fromDb<{ count: string }>(await tx.execute(sql`
          SELECT count(*)::text AS count FROM price_submissions
          WHERE customer_user_id = ${userId} AND submitted_at >= now() - interval '1 day'
        `));
        if (Number(dailyCount[0]?.count || 0) >= 20) reasons.push("High submission frequency requires review.");

        const status: ValidationStatus = reasons.length ? "under_review" : "eligible";
        if (existingOperatorUpdate) {
          await tx.execute(sql`
            INSERT INTO community_price_history (submission_id, price_naira, source_type, validation_status, changed_by)
            VALUES (${existingOperatorUpdate.id}, ${existingOperatorUpdate.priceNaira}, ${existingOperatorUpdate.sourceType}, ${existingOperatorUpdate.validationStatus}, ${userId})
          `);
          const [updated] = fromDb<Submission>(await tx.execute(sql`
            UPDATE price_submissions SET price_naira = ${input.priceNaira}, observed_at = ${input.observedAt},
              submitted_at = now(), last_confirmed_at = NULL, availability = ${input.availability},
              comments = ${input.comments || null}, validation_status = ${status},
              moderation_status = ${reasons.length ? "under_review" : "published"},
              validation_reasons = ${JSON.stringify(reasons)}::jsonb, updated_at = now()
            WHERE id = ${existingOperatorUpdate.id} RETURNING *
          `));
          await tx.execute(sql`
            INSERT INTO community_price_history (submission_id, price_naira, source_type, validation_status, changed_by)
            VALUES (${updated.id}, ${updated.priceNaira}, ${updated.sourceType}, ${updated.validationStatus}, ${userId})
          `);
          await this.writeActivity(tx, userId, "operator_price_updated", "price_submission", updated.id, { previousPrice: existingOperatorUpdate.priceNaira, newPrice: updated.priceNaira });
          await this.writeNotification(tx, userId, "operator_price_update", "Operator price updated", `${input.locationName} · ${input.fuelType} was updated.`, { submissionId: updated.id, status });
          return updated;
        }
        const [created] = fromDb<Submission>(await tx.execute(sql`
          INSERT INTO price_submissions
            (customer_user_id, station_id, terminal_id, location_key, location_name, brand, category, fuel_type,
             price_naira, unit, state, lga, city, latitude, longitude, observed_at, last_confirmed_at,
             availability, comments, source_type, validation_status, moderation_status, validation_reasons, reporting_period)
          VALUES
            (${userId}, ${input.stationId || null}, ${input.terminalId || null}, ${key}, ${input.locationName}, ${input.brand},
             ${input.category}, ${input.fuelType}, ${input.priceNaira}, ${input.unit}, ${input.state}, ${input.lga}, ${input.city},
             ${input.latitude}, ${input.longitude}, ${input.observedAt}, NULL, ${input.availability}, ${input.comments || null},
             ${sourceType}, ${status}, ${reasons.length ? "under_review" : "published"}, ${JSON.stringify(reasons)}::jsonb, ${reportingPeriod})
          RETURNING *
        `));
        await tx.execute(sql`
          INSERT INTO community_price_history (submission_id, price_naira, source_type, validation_status, changed_by)
          VALUES (${created.id}, ${input.priceNaira}, ${sourceType}, ${status}, ${userId})
        `);
        await this.writeActivity(tx, userId, "price_submitted", "price_submission", created.id, { fuelType: input.fuelType, status });
        await this.writeNotification(tx, userId, "price_submission", "Price report received",
          reasons.length ? "Your report was received and flagged for review." : "Your report was published as a community observation.",
          { submissionId: created.id, status });
        if (!reasons.length && sourceType === "community") {
          await tx.execute(sql`
            INSERT INTO customer_trust_scores (user_id, accepted_reports, updated_at)
            VALUES (${userId}, 1, now())
            ON CONFLICT (user_id) DO UPDATE SET accepted_reports = customer_trust_scores.accepted_reports + 1, updated_at = now()
          `);
        }
        return created;
      });
    }

    const duplicate = this.local.submissions.some((item) =>
      item.customerUserId === userId && item.locationKey === key
      && item.fuelType === input.fuelType && item.reportingPeriod === reportingPeriod && item.sourceType === sourceType,
    );
    const operatorExisting = sourceType === "operator" ? this.local.submissions.find((item) =>
      item.customerUserId === userId && item.locationKey === key && item.fuelType === input.fuelType
      && item.reportingPeriod === reportingPeriod && item.sourceType === "operator",
    ) : undefined;
    if (duplicate && sourceType !== "operator") throw Object.assign(new Error("You have already submitted this product and location for the reporting day."), { statusCode: 409, code: "DUPLICATE_REPORT" });
    const registered = input.stationId
      ? this.local.stations.find((item) => item.id === input.stationId && item.approvalStatus === "approved")
      : input.terminalId
        ? this.local.terminals.find((item) => item.id === input.terminalId && item.approvalStatus === "approved")
        : undefined;
    if ((input.stationId || input.terminalId) && !registered) {
      throw Object.assign(new Error("The selected business location is not approved for public reports."), { statusCode: 400 });
    }
    if (registered && distanceMeters(input.latitude, input.longitude, registered.latitude, registered.longitude) > 2_000) {
      reasons.push("GPS is more than 2 km from the registered location.");
    }
    const recent = this.local.submissions.filter((item) =>
      item.fuelType === input.fuelType && item.state === input.state && item.lga.toLowerCase() === input.lga.toLowerCase()
      && item.validationStatus === "eligible" && item.moderationStatus === "published"
      && item.sourceType === "community" && submittedAt.getTime() - item.submittedAt.getTime() <= 7 * 24 * 60 * 60_000,
    ).map((item) => item.priceNaira);
    const typical = median(recent);
    if (typical !== null && (input.priceNaira < typical * 0.5 || input.priceNaira > typical * 1.5)) {
      reasons.push("Price differs from recent local community reports by more than 50%.");
    }
    if (this.local.submissions.filter((item) => item.customerUserId === userId && submittedAt.getTime() - item.submittedAt.getTime() < 24 * 60 * 60_000).length >= 20) {
      reasons.push("High submission frequency requires review.");
    }

    const status: ValidationStatus = reasons.length ? "under_review" : "eligible";
    if (operatorExisting) {
      this.recordLocalPriceHistory(operatorExisting, userId);
      operatorExisting.priceNaira = input.priceNaira;
      operatorExisting.observedAt = input.observedAt;
      operatorExisting.submittedAt = submittedAt;
      operatorExisting.lastConfirmedAt = null;
      operatorExisting.availability = input.availability;
      operatorExisting.comments = input.comments;
      operatorExisting.validationStatus = status;
      operatorExisting.moderationStatus = reasons.length ? "under_review" : "published";
      operatorExisting.validationReasons = reasons;
      this.recordLocalPriceHistory(operatorExisting, userId);
      this.logActivity(userId, "operator_price_updated", "price_submission", operatorExisting.id, { newPrice: input.priceNaira });
      this.notify(userId, "operator_price_update", "Operator price updated", `${input.locationName} · ${input.fuelType} was updated.`, { submissionId: operatorExisting.id, status });
      this.persistLocal();
      return operatorExisting;
    }
    const submission: Submission = {
      ...input,
      id: randomUUID(),
      customerUserId: userId,
      locationKey: key,
      sourceType,
      validationStatus: status,
      moderationStatus: reasons.length ? "under_review" : "published",
      validationReasons: reasons,
      reportingPeriod,
      submittedAt,
      lastConfirmedAt: null,
    };
    this.local.submissions.unshift(submission);
    this.recordLocalPriceHistory(submission, userId);
    this.local.activities.unshift({
      id: randomUUID(), userId, action: "price_submitted", entityType: "price_submission", entityId: submission.id,
      details: { fuelType: submission.fuelType, status }, createdAt: submittedAt,
    });
    this.notify(userId, "price_submission", "Price report received",
      reasons.length ? "Your report was received and flagged for review." : "Your report was published as a community observation.",
      { submissionId: submission.id, status });
    if (!reasons.length && sourceType === "community") this.updateScore(userId, 1);
    this.recalculateLocal(input.fuelType, reportingPeriod);
    this.persistLocal();
    return submission;
  }

  private async writeActivity(tx: DatabaseTransaction, userId: string, action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
    await tx.execute(sql`
      INSERT INTO customer_activity_logs (user_id, action, entity_type, entity_id, details)
      VALUES (${userId}, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(details)}::jsonb)
    `);
  }

  private async writeNotification(tx: DatabaseTransaction, userId: string, type: string, title: string, message: string, payload: Record<string, unknown> = {}) {
    await tx.execute(sql`
      INSERT INTO notifications (user_id, type, title, message, payload)
      VALUES (${userId}, ${type}, ${title}, ${message}, ${JSON.stringify(payload)}::jsonb)
    `);
  }

  async listMyLocations(userId: string) {
    if (db) {
      return this.context(userId, "authenticated", async (tx) => ({
        stations: fromDb<RegisteredLocation>(await tx.execute(sql`SELECT * FROM stations WHERE owner_user_id = ${userId} ORDER BY created_at DESC`)),
        terminals: fromDb<RegisteredLocation>(await tx.execute(sql`SELECT * FROM registered_terminals WHERE owner_user_id = ${userId} ORDER BY created_at DESC`)),
      }));
    }
    return {
      stations: this.local.stations.filter((item) => item.ownerUserId === userId),
      terminals: this.local.terminals.filter((item) => item.ownerUserId === userId),
    };
  }

  async updateOwnedBusiness(userId: string, kind: LocationKind, id: string, patch: Partial<BusinessRegistrationInput>) {
    const allowed = [
      "name", "brand", "businessCategory", "operatorName", "contactPhone", "businessEmail",
      "state", "lga", "city", "physicalAddress", "latitude", "longitude", "productsSold",
      "operatingStatus", "businessRegistrationDetails",
    ] as const;
    const entries = allowed.flatMap((key) => patch[key] === undefined ? [] : [[key, patch[key]] as const]);
    if (!entries.length) throw Object.assign(new Error("At least one editable business field is required."), { statusCode: 400 });
    if (db) {
      return this.context(userId, "service_role", async (tx) => {
        const table = kind === "station" ? "stations" : "registered_terminals";
        const assignments = entries.map(([key, value]) => {
          const column = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
          return sql`${sql.raw(column)} = ${Array.isArray(value) ? JSON.stringify(value) : value}${Array.isArray(value) ? sql`::jsonb` : sql``}`;
        });
        const [record] = fromDb<RegisteredLocation>(await tx.execute(sql`
          UPDATE ${sql.raw(table)} SET ${sql.join([...assignments, sql`updated_at = now()`], sql`, `)}
          WHERE id = ${id} AND owner_user_id = ${userId} RETURNING *
        `));
        if (!record) return undefined;
        await this.writeActivity(tx, userId, "business_profile_updated", kind, id, { fields: entries.map(([key]) => key) });
        return { ...record, kind };
      });
    }
    const record = (kind === "station" ? this.local.stations : this.local.terminals)
      .find((item) => item.id === id && item.ownerUserId === userId);
    if (!record) return undefined;
    Object.assign(record, Object.fromEntries(entries), { updatedAt: new Date() });
    this.logActivity(userId, "business_profile_updated", kind, id, { fields: entries.map(([key]) => key) });
    this.persistLocal();
    return record;
  }

  async listMySubmissions(userId: string) {
    if (db) {
      return this.context(userId, "authenticated", async (tx) =>
        fromDb<Submission>(await tx.execute(sql`SELECT * FROM price_submissions WHERE customer_user_id = ${userId} ORDER BY submitted_at DESC LIMIT 200`)),
      );
    }
    return this.local.submissions.filter((item) => item.customerUserId === userId)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  async getPublicPriceHistory(id: string) {
    if (db) {
      return this.context("", "service_role", async (tx) => {
        const [submission] = fromDb<Submission>(await tx.execute(sql`
          SELECT * FROM price_submissions WHERE id = ${id}
            AND validation_status = 'eligible' AND moderation_status = 'published'
        `));
        if (!submission) return undefined;
        return fromDb<PriceHistory>(await tx.execute(sql`
          SELECT id, submission_id, price_naira, source_type, validation_status, changed_by, changed_at
          FROM community_price_history WHERE submission_id = ${id} ORDER BY changed_at DESC LIMIT 100
        `)).map(({ id: historyId, submissionId, priceNaira, sourceType, validationStatus, changedAt }) => ({
          id: historyId, submissionId, priceNaira: Number(priceNaira), sourceType, validationStatus, changedAt,
        }));
      });
    }
    const submission = this.local.submissions.find((item) => item.id === id
      && item.validationStatus === "eligible" && item.moderationStatus === "published");
    if (!submission) return undefined;
    return this.local.priceHistory.filter((item) => item.submissionId === id)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
      .slice(0, 100)
      .map(({ id: historyId, submissionId, priceNaira, sourceType, validationStatus, changedAt }) => ({
        id: historyId, submissionId, priceNaira, sourceType, validationStatus, changedAt,
      }));
  }

  async updateOwnSubmission(userId: string, id: string, patch: { priceNaira: number; availability: PriceSubmissionInput["availability"]; comments?: string }) {
    if (!Number.isFinite(patch.priceNaira) || patch.priceNaira <= 0 || patch.priceNaira > 1_000_000) {
      throw Object.assign(new Error("Price must be greater than zero and at most ₦1,000,000."), { statusCode: 400 });
    }
    if (db) {
      return this.context(userId, "service_role", async (tx) => {
        const [before] = fromDb<Submission>(await tx.execute(sql`
          SELECT * FROM price_submissions WHERE id = ${id} AND customer_user_id = ${userId} FOR UPDATE
        `));
        if (!before || before.sourceType !== "community" || before.validationStatus !== "eligible" || before.moderationStatus !== "published"
          || Date.now() - before.submittedAt.getTime() > 24 * 60 * 60_000) {
          throw Object.assign(new Error("Only your published community reports from the last 24 hours can be edited."), { statusCode: 403 });
        }
        const disputes = await tx.execute(sql`SELECT id FROM price_disputes WHERE submission_id = ${id} AND status = 'open' LIMIT 1`);
        if (asRows(disputes).length) throw Object.assign(new Error("A disputed report cannot be edited until administrator review."), { statusCode: 409 });
        const typicalRows = fromDb<{ priceNaira: string }>(await tx.execute(sql`
          SELECT price_naira FROM price_submissions WHERE state = ${before.state} AND lower(lga) = lower(${before.lga})
            AND fuel_type = ${before.fuelType} AND source_type = 'community' AND validation_status = 'eligible'
            AND moderation_status = 'published' AND id <> ${id}
            AND submitted_at >= now() - interval '7 days'
        `));
        const typical = median(typicalRows.map((row) => Number(row.priceNaira)));
        const reasons = typical !== null && (patch.priceNaira < typical * 0.5 || patch.priceNaira > typical * 1.5)
          ? ["Edited price differs from recent local community reports by more than 50%."] : [];
        await tx.execute(sql`
          INSERT INTO community_price_history (submission_id, price_naira, source_type, validation_status, changed_by)
          VALUES (${id}, ${before.priceNaira}, ${before.sourceType}, ${before.validationStatus}, ${userId})
        `);
        const [after] = fromDb<Submission>(await tx.execute(sql`
          UPDATE price_submissions SET price_naira = ${patch.priceNaira}, availability = ${patch.availability},
            comments = CASE WHEN ${patch.comments === undefined} THEN comments ELSE NULLIF(${patch.comments || ""}, '') END,
            validation_status = ${reasons.length ? "under_review" : "eligible"},
            moderation_status = ${reasons.length ? "under_review" : "published"}, validation_reasons = ${JSON.stringify(reasons)}::jsonb,
            updated_at = now()
          WHERE id = ${id} RETURNING *
        `));
        await tx.execute(sql`
          INSERT INTO community_price_history (submission_id, price_naira, source_type, validation_status, changed_by)
          VALUES (${id}, ${patch.priceNaira}, ${before.sourceType}, ${after.validationStatus}, ${userId})
        `);
        await this.writeActivity(tx, userId, "price_report_edited", "price_submission", id, { previousPrice: before.priceNaira, newPrice: patch.priceNaira });
        await this.writeNotification(tx, userId, "price_submission_edited", "Price report updated", reasons.length ? "Your edited report is under review." : "Your community report was updated.", { submissionId: id });
        return after;
      });
    }
    const item = this.local.submissions.find((submission) => submission.id === id && submission.customerUserId === userId);
    if (!item || item.sourceType !== "community" || item.validationStatus !== "eligible" || item.moderationStatus !== "published"
      || Date.now() - item.submittedAt.getTime() > 24 * 60 * 60_000) {
      throw Object.assign(new Error("Only your published community reports from the last 24 hours can be edited."), { statusCode: 403 });
    }
    if (this.local.disputes.some((dispute) => dispute.submissionId === id && dispute.status === "open")) {
      throw Object.assign(new Error("A disputed report cannot be edited until administrator review."), { statusCode: 409 });
    }
    const typical = median(this.local.submissions.filter((row) =>
      row.id !== id && row.state === item.state && row.lga.toLowerCase() === item.lga.toLowerCase()
      && row.fuelType === item.fuelType && row.sourceType === "community" && row.validationStatus === "eligible"
      && row.moderationStatus === "published" && Date.now() - row.submittedAt.getTime() <= 7 * 24 * 60 * 60_000,
    ).map((row) => row.priceNaira));
    this.recordLocalPriceHistory(item, userId);
    item.priceNaira = patch.priceNaira;
    item.availability = patch.availability;
    if (patch.comments !== undefined) item.comments = patch.comments || undefined;
    if (typical !== null && (patch.priceNaira < typical * 0.5 || patch.priceNaira > typical * 1.5)) {
      item.validationStatus = "under_review";
      item.moderationStatus = "under_review";
      item.validationReasons.push("Edited price differs from recent local community reports by more than 50%.");
    }
    this.local.activities.unshift({
      id: randomUUID(), userId, action: "price_report_edited", entityType: "price_submission", entityId: id,
      details: { newPrice: patch.priceNaira }, createdAt: new Date(),
    });
    this.notify(userId, "price_submission_edited", "Price report updated", "Your community report was updated.", { submissionId: id });
    this.recalculateLocal(item.fuelType, item.reportingPeriod);
    this.persistLocal();
    return item;
  }

  async deleteOwnSubmission(userId: string, id: string) {
    if (db) {
      return this.context(userId, "service_role", async (tx) => {
        const [before] = fromDb<Submission>(await tx.execute(sql`
          SELECT * FROM price_submissions WHERE id = ${id} AND customer_user_id = ${userId} FOR UPDATE
        `));
        if (!before || before.sourceType !== "community" || before.validationStatus !== "eligible" || before.moderationStatus !== "published"
          || Date.now() - before.submittedAt.getTime() > 24 * 60 * 60_000) {
          throw Object.assign(new Error("Only your published community reports from the last 24 hours can be withdrawn."), { statusCode: 403 });
        }
        const [after] = fromDb<Submission>(await tx.execute(sql`
          UPDATE price_submissions SET validation_status = 'rejected', moderation_status = 'deleted',
            validation_reasons = validation_reasons || '["Withdrawn by customer"]'::jsonb, updated_at = now()
          WHERE id = ${id} RETURNING *
        `));
        await tx.execute(sql`
          INSERT INTO community_price_history (submission_id, price_naira, source_type, validation_status, changed_by)
          VALUES (${id}, ${before.priceNaira}, ${before.sourceType}, 'rejected', ${userId})
        `);
        await this.writeActivity(tx, userId, "price_report_withdrawn", "price_submission", id);
        return { id, withdrawn: true, submission: after };
      });
    }
    const item = this.local.submissions.find((submission) => submission.id === id && submission.customerUserId === userId);
    if (!item || item.sourceType !== "community" || item.validationStatus !== "eligible" || item.moderationStatus !== "published"
      || Date.now() - item.submittedAt.getTime() > 24 * 60 * 60_000) {
      throw Object.assign(new Error("Only your published community reports from the last 24 hours can be withdrawn."), { statusCode: 403 });
    }
    item.validationStatus = "rejected";
    item.moderationStatus = "deleted";
    item.validationReasons.push("Withdrawn by customer");
    this.logActivity(userId, "price_report_withdrawn", "price_submission", id);
    this.recalculateLocal(item.fuelType, item.reportingPeriod);
    this.persistLocal();
    return { id, withdrawn: true };
  }

  async getCustomerDashboard(userId: string, period: "daily" | "weekly" | "monthly" = "daily") {
    const profile = await customerIdentity.getProfile(userId);
    const cutoff = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
    if (db) {
      return this.context(userId, "authenticated", async (tx) => {
        const [stats] = fromDb<Record<string, number>>(await tx.execute(sql`
          SELECT
            count(*)::int AS total_submissions,
            count(*) FILTER (WHERE submitted_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos')::int AS today_submissions,
            count(*) FILTER (WHERE validation_status = 'eligible')::int AS accepted_submissions,
            count(*) FILTER (WHERE validation_status = 'under_review')::int AS review_submissions
          FROM price_submissions WHERE customer_user_id = ${userId}
        `));
        const [locations] = fromDb<Record<string, number>>(await tx.execute(sql`
          SELECT
            (SELECT count(*)::int FROM stations WHERE owner_user_id = ${userId}) AS stations_registered,
            (SELECT count(*)::int FROM registered_terminals WHERE owner_user_id = ${userId}) AS terminals_registered,
            (SELECT count(*)::int FROM community_confirmations c JOIN price_submissions s ON s.id = c.submission_id
              WHERE s.customer_user_id = ${userId} AND c.confirmation = 'accurate') AS confirmations_received
        `));
        const [trust] = fromDb<Record<string, number>>(await tx.execute(sql`
          SELECT score FROM customer_trust_scores WHERE user_id = ${userId}
        `));
        const activities = fromDb<Activity>(await tx.execute(sql`
          SELECT * FROM customer_activity_logs WHERE user_id = ${userId}
            AND created_at >= now() - (${cutoff} || ' days')::interval
          ORDER BY created_at DESC LIMIT 50
        `));
        const submissions = fromDb<Submission>(await tx.execute(sql`
          SELECT * FROM price_submissions WHERE customer_user_id = ${userId}
          ORDER BY submitted_at DESC LIMIT 200
        `));
        const userNotifications = fromDb<Notification>(await tx.execute(sql`
          SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50
        `));
        const activityAnalytics = fromDb<Record<string, string | number | null>>(await tx.execute(sql`
          SELECT to_char((submitted_at AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS day,
            count(*)::int AS submissions,
            ROUND(AVG(price_naira) FILTER (WHERE fuel_type = 'PMS'), 2) AS pms,
            ROUND(AVG(price_naira) FILTER (WHERE fuel_type = 'AGO'), 2) AS ago,
            ROUND(AVG(price_naira) FILTER (WHERE fuel_type = 'DPK'), 2) AS dpk,
            ROUND(AVG(price_naira) FILTER (WHERE fuel_type = 'LPG'), 2) AS lpg
          FROM price_submissions WHERE customer_user_id = ${userId}
            AND submitted_at >= now() - interval '30 days'
          GROUP BY (submitted_at AT TIME ZONE 'Africa/Lagos')::date ORDER BY day
        `));
        const acceptanceRate = stats.totalSubmissions ? Math.round(stats.acceptedSubmissions / stats.totalSubmissions * 100) : 0;
        return {
          profile,
          stats: { ...stats, ...locations, trustScore: trust?.score ?? 50, acceptanceRate },
          activities,
          submissions,
          notifications: userNotifications,
          activityAnalytics,
          period,
        };
      });
    }
    const reports = this.local.submissions.filter((item) => item.customerUserId === userId);
    const today = nigeriaDate(new Date());
    const todaySubmissions = reports.filter((item) => item.reportingPeriod === today).length;
    const acceptedSubmissions = reports.filter((item) => item.validationStatus === "eligible").length;
    const stationCount = this.local.stations.filter((item) => item.ownerUserId === userId).length;
    const terminalCount = this.local.terminals.filter((item) => item.ownerUserId === userId).length;
    const acceptedReports = reports.length ? Math.round(acceptedSubmissions / reports.length * 100) : 0;
    const cutoffAt = Date.now() - cutoff * 24 * 60 * 60_000;
    const analyticsByDay = new Map<string, { day: string; submissions: number; pms: number | null; ago: number | null; dpk: number | null; lpg: number | null; sums: Record<string, number[]> }>();
    for (const item of reports.filter((report) => report.submittedAt.getTime() >= Date.now() - 30 * 24 * 60 * 60_000)) {
      const day = nigeriaDate(item.submittedAt);
      const row = analyticsByDay.get(day) || { day, submissions: 0, pms: null, ago: null, dpk: null, lpg: null, sums: { PMS: [], AGO: [], DPK: [], LPG: [] } };
      row.submissions += 1;
      row.sums[item.fuelType]?.push(item.priceNaira);
      analyticsByDay.set(day, row);
    }
    const activityAnalytics = [...analyticsByDay.values()].sort((a, b) => a.day.localeCompare(b.day)).map((row) => ({
      day: row.day,
      submissions: row.submissions,
      pms: row.sums.PMS.length ? row.sums.PMS.reduce((sum, value) => sum + value, 0) / row.sums.PMS.length : null,
      ago: row.sums.AGO.length ? row.sums.AGO.reduce((sum, value) => sum + value, 0) / row.sums.AGO.length : null,
      dpk: row.sums.DPK.length ? row.sums.DPK.reduce((sum, value) => sum + value, 0) / row.sums.DPK.length : null,
      lpg: row.sums.LPG.length ? row.sums.LPG.reduce((sum, value) => sum + value, 0) / row.sums.LPG.length : null,
    }));
    return {
      profile,
      stats: {
        totalSubmissions: reports.length,
        todaySubmissions,
        acceptedSubmissions,
        reviewSubmissions: reports.filter((item) => item.validationStatus === "under_review").length,
        stationsRegistered: stationCount,
        terminalsRegistered: terminalCount,
        confirmationsReceived: this.local.confirmations.filter((confirmation) =>
          confirmation.confirmation === "accurate" && reports.some((report) => report.id === confirmation.submissionId),
        ).length,
        trustScore: this.local.scores[userId] ?? 50,
        acceptanceRate: acceptedReports,
      },
      activities: this.local.activities.filter((item) => item.userId === userId && item.createdAt.getTime() >= cutoffAt).slice(0, 50),
      submissions: reports.slice().sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()).slice(0, 200),
      notifications: this.local.notifications.filter((item) => item.userId === userId).slice(0, 50),
      activityAnalytics,
      period,
    };
  }

  async getPublicDiscovery(filters: { state?: string; lga?: string; city?: string; brand?: string; q?: string; fuelType?: string }) {
    if (db) {
      const conditions: SQL[] = [
        sql`s.validation_status = 'eligible'`,
        sql`s.moderation_status = 'published'`,
      ];
      if (filters.state) conditions.push(sql`s.state = ${filters.state}`);
      if (filters.lga) conditions.push(sql`lower(s.lga) = lower(${filters.lga})`);
      if (filters.city) conditions.push(sql`lower(s.city) = lower(${filters.city})`);
      if (filters.brand) conditions.push(sql`lower(s.brand) = lower(${filters.brand})`);
      if (filters.fuelType) conditions.push(sql`s.fuel_type = ${filters.fuelType}`);
      if (filters.q) {
        const search = `%${filters.q.toLowerCase()}%`;
        conditions.push(sql`(
          lower(s.location_name) LIKE ${search} OR lower(s.brand) LIKE ${search}
          OR lower(s.city) LIKE ${search} OR lower(s.lga) LIKE ${search}
        )`);
      }
      conditions.push(sql`s.submitted_at >= now() - interval '30 days'`);
      const reportRows = fromDb<Submission & { independentReportCount: number; freshnessStatus: FreshnessStatus }>(
        await db.execute(sql`
          SELECT s.*,
            (SELECT count(DISTINCT peer.customer_user_id)::int FROM price_submissions peer
              WHERE peer.location_key = s.location_key AND peer.fuel_type = s.fuel_type
                AND peer.reporting_period = s.reporting_period AND peer.source_type = s.source_type
                AND peer.validation_status = 'eligible' AND peer.moderation_status = 'published'
            ) AS independent_report_count
          FROM price_submissions s
          WHERE ${sql.join(conditions, sql` AND `)}
          ORDER BY s.observed_at DESC LIMIT 500
        `),
      ).map((row) => ({
        ...row,
        freshnessStatus: freshness(row, row.independentReportCount),
      }));
      const avgRows = await db.select().from(locationPriceAverages)
        .where(filters.fuelType ? eq(locationPriceAverages.fuelType, filters.fuelType) : undefined)
        .orderBy(desc(locationPriceAverages.reportingPeriod))
        .limit(500);
      const stationRows = await db.select().from(stations)
        .where(eq(stations.approvalStatus, "approved")).limit(500);
      const terminalRows = await db.select().from(registeredTerminals)
        .where(eq(registeredTerminals.approvalStatus, "approved")).limit(500);
      const filteredAverages = avgRows.filter((average) => {
        const key = average.aggregationKey.toLowerCase();
        return (!filters.state || key.includes(filters.state.toLowerCase()))
          && (!filters.lga || key.includes(filters.lga.toLowerCase()))
          && (!filters.city || key.includes(filters.city.toLowerCase()))
          && (!filters.brand || (average.scope === "brand" && key.includes(filters.brand.toLowerCase())));
      });
      return {
        submissions: reportRows,
        averages: filteredAverages,
        stations: [
          ...stationRows.map((location) => ({ ...location, kind: "station" as const })),
          ...terminalRows.map((location) => ({ ...location, kind: "terminal" as const })),
        ],
      };
    }
    const matches = (item: Submission) => item.validationStatus === "eligible"
      && item.moderationStatus === "published"
      && (!filters.state || item.state === filters.state)
      && (!filters.lga || item.lga.toLowerCase() === filters.lga.toLowerCase())
      && (!filters.city || item.city.toLowerCase() === filters.city.toLowerCase())
      && (!filters.brand || item.brand.toLowerCase() === filters.brand.toLowerCase())
      && (!filters.fuelType || item.fuelType === filters.fuelType)
      && (!filters.q || [item.locationName, item.brand, item.state, item.lga, item.city].some((value) => value.toLowerCase().includes(filters.q!.toLowerCase())));
    const reports = this.local.submissions.filter(matches)
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime()).slice(0, 500);
    return {
      submissions: reports.map((row) => {
        const independentReportCount = new Set(this.local.submissions.filter((peer) =>
          peer.locationKey === row.locationKey && peer.fuelType === row.fuelType
          && peer.reportingPeriod === row.reportingPeriod && peer.sourceType === row.sourceType
          && peer.validationStatus === "eligible" && peer.moderationStatus === "published",
        ).map((peer) => peer.customerUserId)).size;
        return { ...row, independentReportCount, freshnessStatus: freshness(row, independentReportCount) };
      }),
      averages: this.local.averages.filter((item) => {
        const key = item.aggregationKey.toLowerCase();
        return (!filters.fuelType || item.fuelType === filters.fuelType)
          && (!filters.state || key.includes(filters.state.toLowerCase()))
          && (!filters.lga || key.includes(filters.lga.toLowerCase()))
          && (!filters.city || key.includes(filters.city.toLowerCase()))
          && (!filters.brand || (item.scope === "brand" && key.includes(filters.brand.toLowerCase())));
      }),
      stations: [
        ...this.local.stations.filter((item) => item.approvalStatus === "approved").map((item) => ({ ...item, kind: "station" as const })),
        ...this.local.terminals.filter((item) => item.approvalStatus === "approved").map((item) => ({ ...item, kind: "terminal" as const })),
      ],
    };
  }

  async confirmPrice(userId: string, submissionId: string, confirmation: "accurate" | "inaccurate") {
    await this.requireApprovedCustomer(userId);
    if (db) {
      return this.context(userId, "service_role", async (tx) => {
        const [submission] = fromDb<Submission>(await tx.execute(sql`SELECT * FROM price_submissions WHERE id = ${submissionId}`));
        if (!submission || submission.customerUserId === userId || submission.validationStatus !== "eligible") {
          throw Object.assign(new Error("This report cannot be confirmed by this account."), { statusCode: 400 });
        }
        await tx.execute(sql`
          INSERT INTO community_confirmations (submission_id, user_id, confirmation)
          VALUES (${submissionId}, ${userId}, ${confirmation})
          ON CONFLICT (submission_id, user_id) DO UPDATE SET confirmation = EXCLUDED.confirmation, created_at = now()
        `);
        if (confirmation === "accurate") {
          await tx.execute(sql`UPDATE price_submissions SET last_confirmed_at = now() WHERE id = ${submissionId}`);
          await tx.execute(sql`UPDATE customer_trust_scores SET confirmed_reports = confirmed_reports + 1, score = LEAST(100, score + 1), updated_at = now() WHERE user_id = ${submission.customerUserId}`);
          await this.writeNotification(tx, submission.customerUserId, "price_confirmation", "Report confirmed", "Another customer confirmed your price report.", { submissionId });
        } else {
          await this.writeNotification(tx, submission.customerUserId, "price_dispute", "Report disputed", "A customer reported that your price observation may be inaccurate.", { submissionId });
          await tx.execute(sql`UPDATE price_submissions SET validation_status = 'under_review', moderation_status = 'under_review', validation_reasons = validation_reasons || '["Community dispute"]'::jsonb WHERE id = ${submissionId}`);
        }
        await this.writeActivity(tx, userId, "price_confirmed", "price_submission", submissionId, { confirmation });
        return { accepted: true };
      });
    }
    const submission = this.local.submissions.find((item) => item.id === submissionId);
    if (!submission || submission.customerUserId === userId || submission.validationStatus !== "eligible") {
      throw Object.assign(new Error("This report cannot be confirmed by this account."), { statusCode: 400 });
    }
    const existing = this.local.confirmations.find((item) => item.submissionId === submissionId && item.userId === userId);
    if (existing) existing.confirmation = confirmation;
    else this.local.confirmations.push({ id: randomUUID(), submissionId, userId, confirmation, createdAt: new Date() });
    if (confirmation === "accurate") {
      submission.lastConfirmedAt = new Date();
      this.updateScore(submission.customerUserId, 1);
      this.notify(submission.customerUserId, "price_confirmation", "Report confirmed", "Another customer confirmed your price report.", { submissionId });
    } else {
      submission.validationStatus = "under_review";
      submission.moderationStatus = "under_review";
      submission.validationReasons.push("Community dispute");
      this.notify(submission.customerUserId, "price_dispute", "Report disputed", "A customer reported that your price observation may be inaccurate.", { submissionId });
      this.recalculateLocal(submission.fuelType, submission.reportingPeriod);
    }
    this.logActivity(userId, "price_confirmed", "price_submission", submissionId, { confirmation });
    this.persistLocal();
    return { accepted: true };
  }

  async createDispute(userId: string, submissionId: string, reason: string, details?: string) {
    await this.requireApprovedCustomer(userId);
    if (db) {
      return this.context(userId, "service_role", async (tx) => {
        const [submission] = fromDb<Submission>(await tx.execute(sql`SELECT * FROM price_submissions WHERE id = ${submissionId}`));
        if (!submission || submission.customerUserId === userId) {
          throw Object.assign(new Error("You cannot dispute your own or unavailable report."), { statusCode: 404 });
        }
        const [dispute] = fromDb<Dispute>(await tx.execute(sql`
          INSERT INTO price_disputes (submission_id, reporter_user_id, reason, details)
          VALUES (${submissionId}, ${userId}, ${reason}, ${details || null})
          RETURNING *
        `));
        await tx.execute(sql`UPDATE price_submissions SET validation_status = 'under_review', moderation_status = 'under_review', validation_reasons = validation_reasons || '["Open community dispute"]'::jsonb WHERE id = ${submissionId}`);
        await this.writeNotification(tx, submission.customerUserId, "price_dispute", "Report disputed", "A customer disputed one of your price observations.", { submissionId, disputeId: dispute.id });
        await this.writeActivity(tx, userId, "price_disputed", "price_submission", submissionId, { disputeId: dispute.id });
        return dispute;
      });
    }
    const submission = this.local.submissions.find((item) => item.id === submissionId);
    if (!submission || submission.customerUserId === userId) {
      throw Object.assign(new Error("You cannot dispute your own or unavailable report."), { statusCode: 404 });
    }
    const dispute: Dispute = {
      id: randomUUID(), submissionId, reporterUserId: userId, reason, details: details || null,
      status: "open", resolution: null, resolvedBy: null, createdAt: new Date(), resolvedAt: null,
    };
    this.local.disputes.unshift(dispute);
    submission.validationStatus = "under_review";
    submission.moderationStatus = "under_review";
    submission.validationReasons.push("Open community dispute");
    this.recalculateLocal(submission.fuelType, submission.reportingPeriod);
    this.notify(submission.customerUserId, "price_dispute", "Report disputed", "A customer disputed one of your price observations.", { submissionId, disputeId: dispute.id });
    this.logActivity(userId, "price_disputed", "price_submission", submissionId, { disputeId: dispute.id });
    this.persistLocal();
    return dispute;
  }

  async getNotifications(userId: string) {
    if (db) {
      return this.context(userId, "authenticated", async (tx) => fromDb<Notification>(
        await tx.execute(sql`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100`),
      ));
    }
    return this.local.notifications.filter((item) => item.userId === userId).slice(0, 100);
  }

  async setNotificationPreferences(userId: string, preferences: Record<string, boolean>) {
    const allowed = ["inApp", "email", "sms", "priceAlerts", "submissionUpdates", "staleReports"];
    const safePreferences = Object.fromEntries(Object.entries(preferences).filter(([key, value]) => allowed.includes(key) && typeof value === "boolean"));
    return customerIdentity.updateProfile(userId, { notificationPreferences: safePreferences });
  }

  async adminListAccounts() {
    return customerIdentity.listProfiles();
  }

  async adminReviewAccount(userId: string, status: "approved" | "rejected" | "suspended", adminId: string) {
    if (db) {
      return this.context(adminId, "admin", async (tx) => {
        const [before] = fromDb<CustomerProfile>(await tx.execute(sql`
          SELECT * FROM profiles WHERE user_id = ${userId} FOR UPDATE
        `));
        if (!before) return undefined;
        const [after] = fromDb<CustomerProfile>(await tx.execute(sql`
          UPDATE profiles SET account_status = ${status}, updated_at = now()
          WHERE user_id = ${userId} RETURNING *
        `));
        await this.writeNotification(tx, userId, "account_review", `Account ${status}`, `Your FuelIQ customer account was ${status} by an administrator.`, { status });
        await this.writeAudit(tx, adminId, `account_${status}`, "profile", userId, { before: before.accountStatus, after: status });
        return after;
      });
    }
    const profile = await customerIdentity.approveAccount(userId, status, adminId);
    if (!profile) return undefined;
    this.notify(userId, "account_review", `Account ${status}`, `Your FuelIQ customer account was ${status} by an administrator.`, { status });
    this.local.audit.unshift({ adminId, action: `account_${status}`, entityId: userId, afterState: status, createdAt: new Date() });
    this.persistLocal();
    return profile;
  }

  async adminListBusinesses(kind: LocationKind, status?: string) {
    if (db) {
      return this.context("", "admin", async (tx) => {
        const table = kind === "station" ? "stations" : "registered_terminals";
        return fromDb<RegisteredLocation>(await tx.execute(sql.raw(`SELECT * FROM ${table} ${status ? `WHERE approval_status = ${sqlValue(status)}` : ""} ORDER BY submitted_at DESC LIMIT 500`)));
      });
    }
    return (kind === "station" ? this.local.stations : this.local.terminals)
      .filter((item) => !status || item.approvalStatus === status)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  async adminReviewBusiness(kind: LocationKind, id: string, status: "approved" | "rejected" | "suspended", adminId: string) {
    if (db) {
      return this.context(adminId, "admin", async (tx) => {
        const table = kind === "station" ? "stations" : "registered_terminals";
        const [row] = fromDb<RegisteredLocation>(await tx.execute(sql`
          UPDATE ${sql.raw(table)} SET approval_status = ${status}, approved_at = ${status === "approved" ? new Date() : null},
            approved_by = ${adminId}, updated_at = now()
          WHERE id = ${id} AND approval_status = 'pending'
          RETURNING *
        `));
        if (!row) return undefined;
        await this.writeNotification(tx, row.ownerUserId, "business_approval", `Business ${status}`, `${row.name} was ${status} by an administrator.`, { kind, id });
        await this.writeAudit(tx, adminId, `${kind}_${status}`, kind, id, { approvalStatus: row.approvalStatus });
        return row;
      });
    }
    const record = (kind === "station" ? this.local.stations : this.local.terminals).find((item) => item.id === id);
    if (!record || record.approvalStatus !== "pending") return undefined;
    record.approvalStatus = status;
    record.approvedAt = status === "approved" ? new Date() : null;
    record.approvedBy = adminId;
    this.notify(record.ownerUserId, "business_approval", `Business ${status}`, `${record.name} was ${status} by an administrator.`, { kind, id });
    this.local.audit.unshift({ adminId, action: `${kind}_${status}`, entityId: id, beforeState: "pending", afterState: status, createdAt: new Date() });
    this.persistLocal();
    return record;
  }

  async adminReviewSubmission(id: string, status: "eligible" | "rejected", adminId: string, reason?: string) {
    if (db) {
      return this.context(adminId, "admin", async (tx) => {
        const [before] = fromDb<Submission>(await tx.execute(sql`SELECT * FROM price_submissions WHERE id = ${id} FOR UPDATE`));
        if (!before) return undefined;
        const moderation = status === "eligible" ? "published" : "rejected";
        const [after] = fromDb<Submission>(await tx.execute(sql`
          UPDATE price_submissions SET validation_status = ${status}, moderation_status = ${moderation},
            validation_reasons = CASE WHEN ${reason || null} IS NULL THEN validation_reasons ELSE validation_reasons || ${JSON.stringify([reason])}::jsonb END,
            updated_at = now()
          WHERE id = ${id} RETURNING *
        `));
        await tx.execute(sql`
          INSERT INTO community_price_history (submission_id, price_naira, source_type, validation_status, changed_by)
          VALUES (${id}, ${after.priceNaira}, ${after.sourceType}, ${after.validationStatus}, ${adminId})
        `);
        await tx.execute(sql`
          INSERT INTO customer_trust_scores (user_id, admin_decisions, score, updated_at)
          VALUES (${after.customerUserId}, 1, ${status === "eligible" ? 1 : -5}, now())
          ON CONFLICT (user_id) DO UPDATE SET admin_decisions = customer_trust_scores.admin_decisions + 1,
            score = LEAST(100, GREATEST(0, customer_trust_scores.score + ${status === "eligible" ? 1 : -5})), updated_at = now()
        `);
        await this.writeNotification(tx, after.customerUserId, "submission_review", `Report ${status}`, reason || `Your price report was ${status} after review.`, { submissionId: id });
        await this.writeAudit(tx, adminId, `submission_${status}`, "price_submission", id, { before: before.validationStatus, after: status, reason });
        return after;
      });
    }
    const item = this.local.submissions.find((submission) => submission.id === id);
    if (!item) return undefined;
    const previous = item.validationStatus;
    this.recordLocalPriceHistory(item, adminId);
    item.validationStatus = status;
    item.moderationStatus = status === "eligible" ? "published" : "rejected";
    if (reason) item.validationReasons.push(reason);
    this.local.audit.unshift({ adminId, action: `submission_${status}`, entityId: id, beforeState: previous, afterState: status, reason, createdAt: new Date() });
    this.updateScore(item.customerUserId, status === "eligible" ? 1 : -5);
    this.recordLocalPriceHistory(item, adminId);
    this.notify(item.customerUserId, "submission_review", `Report ${status}`, reason || `Your price report was ${status} after review.`, { submissionId: id });
    this.recalculateLocal(item.fuelType, item.reportingPeriod);
    this.persistLocal();
    return item;
  }

  async adminListSubmissions(status?: string) {
    if (db) {
      return this.context("", "admin", async (tx) => fromDb<Submission>(await tx.execute(sql`
        SELECT * FROM price_submissions
        ${status ? sql`WHERE validation_status = ${status}` : sql``}
        ORDER BY submitted_at DESC LIMIT 1000
      `)));
    }
    return this.local.submissions.filter((item) => !status || item.validationStatus === status)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()).slice(0, 1000);
  }

  async adminListDisputes() {
    if (db) {
      return this.context("", "admin", async (tx) => fromDb<Dispute>(await tx.execute(sql`
        SELECT * FROM price_disputes ORDER BY created_at DESC LIMIT 1000
      `)));
    }
    return [...this.local.disputes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async adminResolveDispute(id: string, status: "resolved" | "dismissed", resolution: string, adminId: string) {
    if (db) {
      return this.context(adminId, "admin", async (tx) => {
        const [dispute] = fromDb<Dispute>(await tx.execute(sql`
          UPDATE price_disputes SET status = ${status}, resolution = ${resolution},
            resolved_by = ${adminId}, resolved_at = now()
          WHERE id = ${id} AND status = 'open' RETURNING *
        `));
        if (!dispute) return undefined;
        const [submission] = fromDb<Submission>(await tx.execute(sql`
          SELECT * FROM price_submissions WHERE id = ${dispute.submissionId}
        `));
        await this.writeAudit(tx, adminId, `dispute_${status}`, "price_dispute", id, { resolution });
        await this.writeNotification(tx, dispute.reporterUserId, "dispute_resolution", "Dispute reviewed", resolution, { disputeId: id, status });
        if (submission) {
          await this.writeNotification(tx, submission.customerUserId, "dispute_resolution", "Price dispute reviewed", resolution, { disputeId: id, status });
        }
        return dispute;
      });
    }
    const dispute = this.local.disputes.find((item) => item.id === id && item.status === "open");
    if (!dispute) return undefined;
    dispute.status = status;
    dispute.resolution = resolution;
    dispute.resolvedBy = adminId;
    dispute.resolvedAt = new Date();
    const submission = this.local.submissions.find((item) => item.id === dispute.submissionId);
    this.notify(dispute.reporterUserId, "dispute_resolution", "Dispute reviewed", resolution, { disputeId: id, status });
    if (submission) this.notify(submission.customerUserId, "dispute_resolution", "Price dispute reviewed", resolution, { disputeId: id, status });
    this.local.audit.unshift({ adminId, action: `dispute_${status}`, entityId: id, resolution, createdAt: new Date() });
    this.persistLocal();
    return dispute;
  }

  async exportSubmissionsCsv() {
    const rows = await this.adminListSubmissions();
    const columns = ["id", "locationName", "brand", "category", "fuelType", "priceNaira", "unit", "state", "lga", "city", "latitude", "longitude", "observedAt", "submittedAt", "availability", "sourceType", "validationStatus", "moderationStatus"];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return [columns.join(","), ...rows.map((row) => columns.map((column) => escape((row as unknown as Record<string, unknown>)[column])).join(","))].join("\r\n");
  }

  private async writeAudit(tx: DatabaseTransaction, adminId: string, action: string, entityType: string, entityId: string, afterState: Record<string, unknown>) {
    await tx.execute(sql`
      INSERT INTO admin_audit_logs (admin_user_id, action, entity_type, entity_id, after_state)
      VALUES (${adminId}, ${action}, ${entityType}, ${entityId}, ${JSON.stringify(afterState)}::jsonb)
    `);
  }

  async markNotificationRead(userId: string, id: string) {
    if (db) {
      return this.context(userId, "authenticated", async (tx) => {
        const result = await tx.execute(sql`
          UPDATE notifications SET read_at = now() WHERE id = ${id} AND user_id = ${userId} RETURNING id
        `);
        return asRows(result).length > 0;
      });
    }
    const item = this.local.notifications.find((notification) => notification.id === id && notification.userId === userId);
    if (!item) return false;
    item.readAt = new Date();
    this.persistLocal();
    return true;
  }

  async refreshStaleAverages() {
    if (db) {
      await this.context("", "service_role", async (tx) => {
        await tx.execute(sql`
          UPDATE location_price_averages
          SET freshness_status = 'stale'
          WHERE freshness_status IN ('fresh', 'recent')
            AND reporting_period < (now() AT TIME ZONE 'Africa/Lagos')::date - 2
        `);
        const staleReports = fromDb<Submission>(await tx.execute(sql`
          SELECT s.* FROM price_submissions s
          WHERE s.source_type = 'community' AND s.validation_status = 'eligible'
            AND s.moderation_status = 'published'
            AND COALESCE(s.last_confirmed_at, s.submitted_at) < now() - interval '72 hours'
            AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.user_id = s.customer_user_id AND n.type = 'stale_report'
                AND n.payload->>'submissionId' = s.id::text
            )
        `));
        for (const submission of staleReports) {
          await this.writeNotification(tx, submission.customerUserId, "stale_report", "Price report is stale",
            `${submission.locationName} · ${submission.fuelType} is older than 72 hours and is no longer presented as fresh.`,
            { submissionId: submission.id });
        }
      });
      return;
    }
    let notified = false;
    for (const submission of this.local.submissions) {
      if (submission.sourceType !== "community" || submission.validationStatus !== "eligible" || submission.moderationStatus !== "published"
        || Date.now() - (submission.lastConfirmedAt || submission.submittedAt).getTime() <= 72 * 60 * 60_000
        || this.local.notifications.some((item) => item.userId === submission.customerUserId
          && item.type === "stale_report" && item.payload.submissionId === submission.id)) continue;
      this.notify(submission.customerUserId, "stale_report", "Price report is stale",
        `${submission.locationName} · ${submission.fuelType} is older than 72 hours and is no longer presented as fresh.`,
        { submissionId: submission.id });
      notified = true;
    }
    const changed = this.local.averages.some((item) => {
      if (item.freshnessStatus !== "fresh" && item.freshnessStatus !== "recent") return false;
      const periodEnd = new Date(`${item.reportingPeriod}T23:59:59+01:00`).getTime();
      if (Date.now() - periodEnd <= 72 * 60 * 60_000) return false;
      item.freshnessStatus = "stale";
      return true;
    });
    if (changed || notified) this.persistLocal();
  }

  async getStationOwnerDashboard(userId: string) {
    const locations = await this.listMyLocations(userId);
    const ids = new Set([...locations.stations, ...locations.terminals].map((location) => location.id));
    const locationReports = db
      ? await this.context(userId, "authenticated", async (tx) => fromDb<Submission>(await tx.execute(sql`
        SELECT * FROM price_submissions
        WHERE station_id IN (SELECT id FROM stations WHERE owner_user_id = ${userId})
           OR terminal_id IN (SELECT id FROM registered_terminals WHERE owner_user_id = ${userId})
        ORDER BY submitted_at DESC LIMIT 500
      `)))
      : this.local.submissions.filter((item) =>
        (item.stationId && ids.has(item.stationId)) || (item.terminalId && ids.has(item.terminalId)),
      );
    const publicData = await this.getPublicDiscovery({});
    const averages = (publicData.averages as Average[]).filter((average) => {
      const prefix = average.scope === "station" ? "station:" : average.scope === "terminal" ? "terminal:" : "";
      return prefix && [...ids].some((id) => average.aggregationKey === `${prefix}${id}`);
    });
    const disputeCount = db
      ? await this.context(userId, "authenticated", async (tx) => {
        const [row] = fromDb<{ count: number }>(await tx.execute(sql`
          SELECT count(*)::int AS count FROM price_disputes d
          JOIN price_submissions s ON s.id = d.submission_id
          WHERE d.status = 'open' AND (
            s.station_id IN (SELECT id FROM stations WHERE owner_user_id = ${userId})
            OR s.terminal_id IN (SELECT id FROM registered_terminals WHERE owner_user_id = ${userId})
          )
        `));
        return row?.count ?? 0;
      })
      : this.local.disputes.filter((dispute) =>
        dispute.status === "open" && locationReports.some((submission) => submission.id === dispute.submissionId),
      ).length;
    return {
      locations,
      reports: locationReports,
      averages,
      disputeCount,
    };
  }
}

function sqlValue(value: string | null) {
  if (value === null) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

export const communityFuel = new CommunityFuelService();

let communityJobTimer: NodeJS.Timeout | undefined;

export function startCommunityFuelJobs() {
  if (communityJobTimer) return;
  const run = () => {
    void communityFuel.refreshStaleAverages().catch((error) => {
      console.error("Community price freshness job failed:", error);
    });
  };
  run();
  communityJobTimer = setInterval(run, 60 * 60 * 1000);
  communityJobTimer.unref();
}
