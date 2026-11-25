import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "../db.js";
import { customerVerifications, profiles, users } from "../../shared/schema.js";
import { storage } from "../storage.js";
import { deliverVerificationCode } from "./verification-delivery.js";

export type VerificationChannel = "email" | "sms";
export type VerificationPurpose = "registration" | "password_reset" | "contact_change";
export type AccountStatus = "pending_approval" | "approved" | "rejected" | "suspended";

export type CustomerProfile = {
  id: string;
  userId: string;
  customerId: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  accountStatus: AccountStatus;
  notificationPreferences: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

type LocalVerification = {
  id: string;
  userId: string;
  channel: VerificationChannel;
  purpose: VerificationPurpose;
  target: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
};

type LocalIdentityState = {
  profiles: CustomerProfile[];
  verifications: LocalVerification[];
};

const stateFile = path.resolve(process.env.FUELIQ_DATA_DIR || path.join(process.cwd(), "data"), "customer-identity.json");
const otpSecret = process.env.OTP_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;

function hashCode(userId: string, purpose: VerificationPurpose, code: string) {
  if (!otpSecret) throw new Error("OTP_SECRET or JWT_SECRET must be configured for account verification.");
  return createHmac("sha256", otpSecret).update(`${userId}:${purpose}:${code}`).digest("hex");
}

function equalHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function restoreDate(value: unknown): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

class CustomerIdentityService {
  private local: LocalIdentityState = this.loadLocal();

  private loadLocal(): LocalIdentityState {
    try {
      if (!fs.existsSync(stateFile)) return { profiles: [], verifications: [] };
      const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8")) as Partial<LocalIdentityState>;
      return {
        profiles: (parsed.profiles || []).map((profile) => ({
          ...profile,
          createdAt: restoreDate(profile.createdAt) || new Date(),
          updatedAt: restoreDate(profile.updatedAt) || new Date(),
          lastLoginAt: restoreDate(profile.lastLoginAt),
        })),
        verifications: (parsed.verifications || []).map((verification) => ({
          ...verification,
          expiresAt: restoreDate(verification.expiresAt) || new Date(0),
          createdAt: restoreDate(verification.createdAt) || new Date(),
          consumedAt: restoreDate(verification.consumedAt),
        })),
      };
    } catch (error) {
      console.error("Could not load customer identity state:", error);
      return { profiles: [], verifications: [] };
    }
  }

  private persistLocal() {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const temporaryFile = `${stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(this.local, null, 2), "utf8");
    fs.renameSync(temporaryFile, stateFile);
  }

  async syncUserToDatabase(userId: string) {
    if (!db) return;
    const user = await storage.getUser(userId);
    if (!user || user.deletedAt) throw new Error("Customer account was not found.");
    await db.execute(sql`
      INSERT INTO users (id, name, email, password, phone, whatsapp_phone, role, subscription_tier)
      VALUES (
        ${user.id}, ${user.name}, ${user.email}, ${user.password}, ${user.phone || null},
        ${user.whatsappPhone || null}, ${user.role}, ${user.subscriptionTier || "free"}
      )
      ON CONFLICT DO NOTHING
    `);
    const [persisted] = await db.select({ id: users.id }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!persisted) {
      throw new Error("The existing account could not be linked to the Supabase customer record.");
    }
  }

  async getProfile(userId: string): Promise<CustomerProfile | undefined> {
    if (db) {
      await this.syncUserToDatabase(userId);
      return db.transaction(async (tx) => {
        await tx.execute(sqlSetIdentity(userId));
        const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
        return profile as CustomerProfile | undefined;
      });
    }
    return this.local.profiles.find((profile) => profile.userId === userId);
  }

  async ensureProfile(userId: string): Promise<CustomerProfile> {
    if (db) {
      await this.syncUserToDatabase(userId);
      return db.transaction(async (tx) => {
        await tx.execute(sqlSetIdentity(userId));
        const customerId = `FQ-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
        await tx.execute(sql`
          INSERT INTO profiles (user_id, customer_id)
          VALUES (${userId}, ${customerId})
          ON CONFLICT (user_id) DO NOTHING
        `);
        await tx.execute(sqlSetIdentity(userId, "service_role"));
        await tx.execute(sql`INSERT INTO customer_trust_scores (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`);
        const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
        if (!profile) throw new Error("Customer profile could not be created.");
        return profile as CustomerProfile;
      });
    }

    const existing = this.local.profiles.find((profile) => profile.userId === userId);
    if (existing) return existing;
    const now = new Date();
    const profile: CustomerProfile = {
      id: randomUUID(),
      userId,
      customerId: `FQ-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
      emailVerified: false,
      phoneVerified: false,
      accountStatus: "pending_approval",
      notificationPreferences: { inApp: true, email: false, sms: false },
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    this.local.profiles.push(profile);
    this.persistLocal();
    return profile;
  }

  async anonymizeAccount(userId: string, anonymizedEmail: string, anonymizedPassword: string) {
    const now = new Date();
    if (db) {
      await db.transaction(async (tx) => {
        await tx.execute(sqlSetIdentity(userId, "service_role"));
        await tx.execute(sql`
          UPDATE users SET name = 'Deleted account', email = ${anonymizedEmail},
            password = ${anonymizedPassword}, phone = NULL, whatsapp_phone = NULL,
            notification_prefs = NULL, subscription_tier = 'free',
            subscription_start_date = NULL, subscription_end_date = NULL,
            assigned_terminal_id = NULL
          WHERE id = ${userId}
        `);
        await tx.execute(sql`DELETE FROM customer_verifications WHERE user_id = ${userId}`);
        await tx.execute(sql`
          UPDATE profiles SET email_verified = false, phone_verified = false,
            account_status = 'suspended', notification_preferences = '{}'::jsonb, updated_at = ${now}
          WHERE user_id = ${userId}
        `);
        await tx.execute(sql`
          UPDATE business_profiles SET display_name = 'Deleted customer', business_name = NULL,
            business_category = 'other', station_name = NULL, terminal_name = NULL,
            state = NULL, lga = NULL, city = NULL, products = '{}',
            customer_verified = false, business_verified = false,
            business_contact_public = false, official_nnpc_authorisation = false, updated_at = ${now}
          WHERE user_id = ${userId}
        `);
        await tx.execute(sql`
          UPDATE stations SET operator_name = 'Deleted customer', contact_phone = 'Removed',
            business_email = ${anonymizedEmail}, business_registration_details = NULL,
            approval_status = 'suspended', updated_at = ${now}
          WHERE owner_user_id = ${userId}
        `);
        await tx.execute(sql`
          UPDATE registered_terminals SET operator_name = 'Deleted customer', contact_phone = 'Removed',
            business_email = ${anonymizedEmail}, business_registration_details = NULL,
            approval_status = 'suspended', updated_at = ${now}
          WHERE owner_user_id = ${userId}
        `);
        await tx.execute(sql`
          UPDATE terminals SET owner_user_id = NULL, operator_name = NULL, contact_phone = NULL,
            business_email = NULL, business_registration_details = NULL,
            approval_status = 'suspended', active = false
          WHERE owner_user_id = ${userId}
        `);
        await tx.execute(sql`UPDATE marketplace_listings SET status = 'archived', updated_at = ${now}
          WHERE owner_user_id = ${userId} AND status NOT IN ('archived', 'rejected')`);
        await tx.execute(sql`UPDATE buyer_requests SET status = 'closed', updated_at = ${now}
          WHERE buyer_user_id = ${userId} AND status IN ('open', 'paused')`);
        await tx.execute(sql`UPDATE supplier_offers SET status = 'withdrawn', updated_at = ${now}
          WHERE supplier_user_id = ${userId} AND status = 'pending'`);
      });
      return;
    }

    this.local.profiles = this.local.profiles.map((profile) => profile.userId === userId
      ? {
          ...profile,
          emailVerified: false,
          phoneVerified: false,
          accountStatus: "suspended",
          notificationPreferences: {},
          updatedAt: now,
        }
      : profile);
    this.local.verifications = this.local.verifications.filter((verification) => verification.userId !== userId);
    this.persistLocal();
  }

  async issueCode(userId: string, channel: VerificationChannel, purpose: VerificationPurpose, target: string) {
    const code = String(randomInt(100_000, 1_000_000));
    const now = new Date();
    const record = {
      userId,
      channel,
      purpose,
      target,
      codeHash: hashCode(userId, purpose, code),
      expiresAt: new Date(now.getTime() + 10 * 60_000),
      attempts: 0,
      consumedAt: null,
      createdAt: now,
    };
    if (db) {
      await this.syncUserToDatabase(userId);
      await db.transaction(async (tx) => {
        await tx.execute(sqlSetIdentity(userId, "service_role"));
        await tx.execute(sql`
          INSERT INTO customer_verifications
            (user_id, channel, purpose, target, code_hash, expires_at, attempts, consumed_at, created_at)
          VALUES (${userId}, ${channel}, ${purpose}, ${target}, ${record.codeHash}, ${record.expiresAt}, 0, NULL, ${now})
        `);
      });
    } else {
      this.local.verifications.push({ ...record, id: randomUUID() });
      this.persistLocal();
    }
    await deliverVerificationCode(channel, target, code, purpose);
    return { expiresAt: record.expiresAt };
  }

  async verifyCode(userId: string, purpose: VerificationPurpose, code: string) {
    if (!/^\d{6}$/.test(code)) return false;
    if (db) {
      await this.syncUserToDatabase(userId);
      return db.transaction(async (tx) => {
        await tx.execute(sqlSetIdentity(userId, "service_role"));
        const [record] = await tx.select().from(customerVerifications)
          .where(and(
            eq(customerVerifications.userId, userId),
            eq(customerVerifications.purpose, purpose),
            isNull(customerVerifications.consumedAt),
          ))
          .orderBy(desc(customerVerifications.createdAt))
          .limit(1);
        if (!record || record.expiresAt.getTime() < Date.now() || record.attempts >= 5) return false;
        if (!equalHash(record.codeHash, hashCode(userId, purpose, code))) {
          await tx.execute(sql`UPDATE customer_verifications SET attempts = attempts + 1 WHERE id = ${record.id}`);
          return false;
        }
        await tx.execute(sql`UPDATE customer_verifications SET consumed_at = now() WHERE id = ${record.id}`);
        if (purpose === "registration") {
          await tx.execute(sqlSetIdentity(userId, "service_role"));
          if (record.channel === "email") {
            await tx.execute(sql`UPDATE profiles SET email_verified = true, updated_at = now() WHERE user_id = ${userId}`);
          } else {
            await tx.execute(sql`UPDATE profiles SET phone_verified = true, updated_at = now() WHERE user_id = ${userId}`);
          }
        }
        return true;
      });
    }

    const record = [...this.local.verifications]
      .reverse()
      .find((item) => item.userId === userId && item.purpose === purpose && !item.consumedAt);
    if (!record || record.expiresAt.getTime() < Date.now() || record.attempts >= 5) return false;
    if (!equalHash(record.codeHash, hashCode(userId, purpose, code))) {
      record.attempts += 1;
      this.persistLocal();
      return false;
    }
    record.consumedAt = new Date();
    if (purpose === "registration") {
      const profile = this.local.profiles.find((item) => item.userId === userId);
      if (profile) {
        if (record.channel === "email") profile.emailVerified = true;
        if (record.channel === "sms") profile.phoneVerified = true;
        profile.updatedAt = new Date();
      }
    }
    this.persistLocal();
    return true;
  }

  async updateProfile(userId: string, patch: Partial<Pick<CustomerProfile, "accountStatus" | "notificationPreferences" | "lastLoginAt">>) {
    if (db) {
      await this.syncUserToDatabase(userId);
      return db.transaction(async (tx) => {
        await tx.execute(sqlSetIdentity(userId));
        const assignments: SQL[] = [];
        if (patch.accountStatus !== undefined) assignments.push(sql`account_status = ${patch.accountStatus}`);
        if (patch.notificationPreferences !== undefined) {
          assignments.push(sql`notification_preferences = ${JSON.stringify(patch.notificationPreferences)}::jsonb`);
        }
        if (patch.lastLoginAt !== undefined) assignments.push(sql`last_login_at = ${patch.lastLoginAt}`);
        assignments.push(sql`updated_at = now()`);
        await tx.execute(sql`
          UPDATE profiles SET ${sql.join(assignments, sql`, `)} WHERE user_id = ${userId}
        `);
        const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
        return profile as CustomerProfile | undefined;
      });
    }
    const profile = this.local.profiles.find((item) => item.userId === userId);
    if (!profile) return undefined;
    Object.assign(profile, patch, { updatedAt: new Date() });
    this.persistLocal();
    return profile;
  }

  async findUserByContact(contact: string) {
    const normalized = contact.trim().toLowerCase();
    const digits = contact.replace(/\D/g, "");
    const users = await storage.getAllUsers();
    return users.find((user) =>
      user.email.trim().toLowerCase() === normalized || user.phone?.replace(/\D/g, "") === digits,
    );
  }

  async approveAccount(userId: string, status: Exclude<AccountStatus, "pending_approval">, adminId: string) {
    if (db) {
      await this.syncUserToDatabase(userId);
      return db.transaction(async (tx) => {
        await tx.execute(sqlSetIdentity(adminId, "admin"));
        await tx.execute(sql`
          UPDATE profiles SET account_status = ${status}, updated_at = now() WHERE user_id = ${userId}
        `);
        const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
        return profile as CustomerProfile | undefined;
      });
    }
    const profile = this.local.profiles.find((item) => item.userId === userId);
    if (!profile) return undefined;
    profile.accountStatus = status;
    profile.updatedAt = new Date();
    this.persistLocal();
    return profile;
  }

  async listProfiles() {
    if (db) {
      return db.transaction(async (tx) => {
        await tx.execute(sqlSetIdentity("", "admin"));
        return tx.select({
          profile: profiles,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            phone: users.phone,
            role: users.role,
            createdAt: users.createdAt,
          },
        }).from(profiles).innerJoin(users, eq(profiles.userId, users.id));
      });
    }
    return Promise.all(this.local.profiles.map(async (profile) => {
      const user = await storage.getUser(profile.userId);
      return {
        profile,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        } : null,
      };
    }));
  }
}

function sqlSetIdentity(userId: string, role = "authenticated") {
  return sql`SELECT set_config('request.jwt.claim.sub', ${userId}, true),
    set_config('request.jwt.claim.role', ${role}, true)`;
}

export const customerIdentity = new CustomerIdentityService();
