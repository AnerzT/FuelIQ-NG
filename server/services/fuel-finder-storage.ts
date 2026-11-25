import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  fuelFinderAlertEvents,
  fuelFinderAlerts,
  fuelFinderPrices,
  fuelFinderReports,
  fuelFinderStations,
  type FuelFinderAlert,
  type FuelFinderAlertEvent,
  type FuelFinderPrice,
  type FuelFinderReport,
  type FuelFinderStation,
} from "../../shared/schema.js";
import { db } from "../db.js";

export type FuelFinderStationListing = FuelFinderStation & {
  latestPrices: FuelFinderPrice[];
};

export type FuelFinderFilters = {
  state?: string;
  city?: string;
  brand?: string;
  query?: string;
};

export type NewFuelFinderStation = Omit<FuelFinderStation, "id" | "createdAt" | "updatedAt">;
export type NewFuelFinderPrice = Omit<FuelFinderPrice, "id" | "createdAt">;
export type NewFuelFinderReport = Omit<FuelFinderReport, "id" | "submittedAt" | "reviewedAt" | "reviewedBy">;
export type NewFuelFinderAlert = Omit<FuelFinderAlert, "id" | "createdAt" | "triggeredAt">;

type LocalState = {
  stations: FuelFinderStation[];
  prices: FuelFinderPrice[];
  reports: FuelFinderReport[];
  alerts: FuelFinderAlert[];
  events: FuelFinderAlertEvent[];
};

const emptyState = (): LocalState => ({
  stations: [],
  prices: [],
  reports: [],
  alerts: [],
  events: [],
});

const stateFile = path.resolve(
  process.env.FUELIQ_DATA_DIR || path.join(process.cwd(), "data"),
  "fuel-finder.json",
);

function restoreDates<T extends object>(rows: T[], fields: string[]): T[] {
  return rows.map((row) => {
    const restored = { ...row } as Record<string, unknown>;
    for (const field of fields) {
      if (typeof restored[field] === "string") restored[field] = new Date(restored[field] as string);
    }
    return restored as T;
  });
}

class FuelFinderStorage {
  private local: LocalState;

  constructor() {
    this.local = this.loadLocal();
  }

  private loadLocal(): LocalState {
    try {
      if (!fs.existsSync(stateFile)) return emptyState();
      const state = JSON.parse(fs.readFileSync(stateFile, "utf8")) as Partial<LocalState>;
      return {
        stations: restoreDates(state.stations || [], ["createdAt", "updatedAt"]),
        prices: restoreDates(state.prices || [], ["observedAt", "createdAt"]),
        reports: restoreDates(state.reports || [], ["submittedAt", "reviewedAt"]),
        alerts: restoreDates(state.alerts || [], ["createdAt", "triggeredAt"]),
        events: restoreDates(state.events || [], ["createdAt", "readAt"]),
      } as LocalState;
    } catch (error) {
      console.error("Failed to load fuel finder data:", error);
      return emptyState();
    }
  }

  private persistLocal() {
    const directory = path.dirname(stateFile);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryFile = `${stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(this.local, null, 2), "utf8");
    fs.renameSync(temporaryFile, stateFile);
  }

  async listStations(filters: FuelFinderFilters = {}, includeInactive = false): Promise<FuelFinderStationListing[]> {
    const stations = db
      ? await db.select().from(fuelFinderStations)
      : this.local.stations;
    const prices = db
      ? await db.select().from(fuelFinderPrices).orderBy(desc(fuelFinderPrices.observedAt))
      : [...this.local.prices].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());

    const latestByStation = new Map<string, Map<string, FuelFinderPrice>>();
    for (const price of prices) {
      let products = latestByStation.get(price.stationId);
      if (!products) {
        products = new Map();
        latestByStation.set(price.stationId, products);
      }
      if (!products.has(price.productType)) products.set(price.productType, price);
    }

    const query = filters.query?.trim().toLowerCase();
    return stations
      .filter((station) => includeInactive || station.active)
      .filter((station) => !filters.state || station.state === filters.state)
      .filter((station) => !filters.city || station.city.toLowerCase() === filters.city.toLowerCase())
      .filter((station) => !filters.brand || station.brand.toLowerCase() === filters.brand.toLowerCase())
      .filter((station) => !query || [station.name, station.brand, station.city, station.state, station.address || ""]
        .some((value) => value.toLowerCase().includes(query)))
      .map((station) => ({
        ...station,
        latestPrices: [...(latestByStation.get(station.id)?.values() || [])],
      }));
  }

  async getStation(id: string): Promise<FuelFinderStation | undefined> {
    if (db) {
      const [station] = await db.select().from(fuelFinderStations).where(eq(fuelFinderStations.id, id)).limit(1);
      return station;
    }
    return this.local.stations.find((station) => station.id === id);
  }

  async createStation(input: NewFuelFinderStation): Promise<FuelFinderStation> {
    if (db) {
      const [station] = await db.insert(fuelFinderStations).values(input).returning();
      return station;
    }
    const now = new Date();
    const station: FuelFinderStation = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.local.stations.push(station);
    this.persistLocal();
    return station;
  }

  async updateStation(id: string, patch: Partial<NewFuelFinderStation>): Promise<FuelFinderStation | undefined> {
    if (db) {
      const assignments: SQL[] = [];
      if (patch.externalId !== undefined) assignments.push(sql`external_id = ${patch.externalId}`);
      if (patch.name !== undefined) assignments.push(sql`name = ${patch.name}`);
      if (patch.brand !== undefined) assignments.push(sql`brand = ${patch.brand}`);
      if (patch.state !== undefined) assignments.push(sql`state = ${patch.state}`);
      if (patch.city !== undefined) assignments.push(sql`city = ${patch.city}`);
      if (patch.address !== undefined) assignments.push(sql`address = ${patch.address}`);
      if (patch.latitude !== undefined) assignments.push(sql`latitude = ${patch.latitude}`);
      if (patch.longitude !== undefined) assignments.push(sql`longitude = ${patch.longitude}`);
      if (patch.phone !== undefined) assignments.push(sql`phone = ${patch.phone}`);
      if (patch.active !== undefined) assignments.push(sql`active = ${patch.active}`);
      if (!assignments.length) return this.getStation(id);
      assignments.push(sql`updated_at = ${new Date()}`);
      await db.execute(sql`
        UPDATE fuel_finder_stations
        SET ${sql.join(assignments, sql`, `)}
        WHERE id = ${id}
      `);
      return this.getStation(id);
    }
    const station = this.local.stations.find((item) => item.id === id);
    if (!station) return undefined;
    Object.assign(station, patch, { updatedAt: new Date() });
    this.persistLocal();
    return station;
  }

  async findStationByExternalId(externalId: string): Promise<FuelFinderStation | undefined> {
    if (db) {
      const [station] = await db.select().from(fuelFinderStations)
        .where(eq(fuelFinderStations.externalId, externalId)).limit(1);
      return station;
    }
    return this.local.stations.find((station) => station.externalId === externalId);
  }

  async recordPrice(input: NewFuelFinderPrice): Promise<FuelFinderPrice> {
    let price: FuelFinderPrice;
    if (db) {
      const [created] = await db.insert(fuelFinderPrices).values(input).returning();
      price = created;
    } else {
      price = { ...input, id: randomUUID(), createdAt: new Date() };
      this.local.prices.push(price);
      this.persistLocal();
    }
    if (price.priceNaira !== null && price.source !== "community_report") {
      await this.triggerMatchingAlerts(price);
    }
    return price;
  }

  private async triggerMatchingAlerts(price: FuelFinderPrice) {
    const station = await this.getStation(price.stationId);
    if (!station || price.priceNaira === null) return;
    const alerts = db
      ? await db.select().from(fuelFinderAlerts).where(and(
        eq(fuelFinderAlerts.active, true),
        eq(fuelFinderAlerts.productType, price.productType),
        eq(fuelFinderAlerts.state, station.state),
      ))
      : this.local.alerts.filter((alert) =>
        alert.active && alert.productType === price.productType && alert.state === station.state,
      );

    for (const alert of alerts) {
      const matches = alert.condition === "at_or_below"
        ? price.priceNaira <= alert.thresholdNaira
        : price.priceNaira >= alert.thresholdNaira;
      if (!matches) continue;
      const message = `${station.brand} ${station.name}: ${price.productType} is ₦${price.priceNaira.toLocaleString("en-NG")} in ${station.state}.`;
      if (db) {
        await db.transaction(async (transaction) => {
          const claimed = await transaction.execute(sql`
            UPDATE fuel_finder_alerts
            SET active = false, triggered_at = ${new Date()}
            WHERE id = ${alert.id} AND active = true
            RETURNING id
          `);
          if (!claimed.length) return;
          await transaction.insert(fuelFinderAlertEvents).values({
            alertId: alert.id,
            stationId: station.id,
            priceId: price.id,
            userId: alert.userId,
            message,
          });
        });
      } else {
        this.local.events.push({
          id: randomUUID(),
          alertId: alert.id,
          stationId: station.id,
          priceId: price.id,
          userId: alert.userId,
          message,
          createdAt: new Date(),
          readAt: null,
        });
        alert.active = false;
        alert.triggeredAt = new Date();
        this.persistLocal();
      }
    }
  }

  async createReport(input: NewFuelFinderReport): Promise<FuelFinderReport> {
    if (db) {
      const [report] = await db.insert(fuelFinderReports).values(input).returning();
      return report;
    }
    const report: FuelFinderReport = {
      ...input,
      id: randomUUID(),
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    };
    this.local.reports.push(report);
    this.persistLocal();
    return report;
  }

  async listReports(status?: string): Promise<FuelFinderReport[]> {
    if (db) {
      const query = db.select().from(fuelFinderReports);
      return status
        ? query.where(eq(fuelFinderReports.status, status)).orderBy(desc(fuelFinderReports.submittedAt))
        : query.orderBy(desc(fuelFinderReports.submittedAt));
    }
    return this.local.reports
      .filter((report) => !status || report.status === status)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  async reviewReport(id: string, status: "approved" | "rejected", reviewedBy: string): Promise<FuelFinderReport | undefined> {
    const report = db
      ? (await db.select().from(fuelFinderReports).where(eq(fuelFinderReports.id, id)).limit(1))[0]
      : this.local.reports.find((item) => item.id === id);
    if (!report || report.status !== "pending") return undefined;

    const reviewedAt = new Date();
    if (db) {
      return db.transaction(async (transaction) => {
        const updated = await transaction.execute(sql`
          UPDATE fuel_finder_reports
          SET status = ${status}, reviewed_at = ${reviewedAt}, reviewed_by = ${reviewedBy}
          WHERE id = ${id} AND status = 'pending'
          RETURNING id
        `);
        if (!updated.length) return undefined;
        if (status === "approved") {
          const reportedPrice: NewFuelFinderPrice = {
            stationId: report.stationId,
            productType: report.productType,
            priceNaira: report.priceNaira,
            availability: report.availability,
            source: "community_report",
            verificationStatus: "reported",
            observedAt: report.submittedAt,
            createdBy: report.userId,
          };
          await transaction.insert(fuelFinderPrices).values(reportedPrice);
        }
        const [row] = await transaction.select().from(fuelFinderReports)
          .where(eq(fuelFinderReports.id, id)).limit(1);
        return row;
      });
    }
    Object.assign(report, { status, reviewedAt, reviewedBy });
    if (status === "approved") {
      this.local.prices.push({
        id: randomUUID(),
        stationId: report.stationId,
        productType: report.productType,
        priceNaira: report.priceNaira,
        availability: report.availability,
        source: "community_report",
        verificationStatus: "reported",
        observedAt: report.submittedAt,
        createdBy: report.userId,
        createdAt: new Date(),
      });
    }
    this.persistLocal();
    return report;
  }

  async createAlert(input: NewFuelFinderAlert): Promise<FuelFinderAlert> {
    if (db) {
      const [alert] = await db.insert(fuelFinderAlerts).values(input).returning();
      return alert;
    }
    const alert: FuelFinderAlert = {
      ...input,
      id: randomUUID(),
      createdAt: new Date(),
      triggeredAt: null,
    };
    this.local.alerts.push(alert);
    this.persistLocal();
    return alert;
  }

  async listUserAlerts(userId: string): Promise<{ alerts: FuelFinderAlert[]; events: FuelFinderAlertEvent[] }> {
    if (db) {
      const [alerts, events] = await Promise.all([
        db.select().from(fuelFinderAlerts).where(eq(fuelFinderAlerts.userId, userId)).orderBy(desc(fuelFinderAlerts.createdAt)),
        db.select().from(fuelFinderAlertEvents).where(eq(fuelFinderAlertEvents.userId, userId)).orderBy(desc(fuelFinderAlertEvents.createdAt)),
      ]);
      return { alerts, events };
    }
    return {
      alerts: this.local.alerts.filter((alert) => alert.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      events: this.local.events.filter((event) => event.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    };
  }

  async deleteUserAlert(id: string, userId: string): Promise<boolean> {
    if (db) {
      const deleted = await db.delete(fuelFinderAlerts)
        .where(and(eq(fuelFinderAlerts.id, id), eq(fuelFinderAlerts.userId, userId)))
        .returning({ id: fuelFinderAlerts.id });
      return deleted.length > 0;
    }
    const initialLength = this.local.alerts.length;
    this.local.alerts = this.local.alerts.filter((alert) => alert.id !== id || alert.userId !== userId);
    if (this.local.alerts.length === initialLength) return false;
    this.local.events = this.local.events.filter((event) => event.alertId !== id);
    this.persistLocal();
    return true;
  }

  async markEventRead(id: string, userId: string): Promise<boolean> {
    if (db) {
      const updated = await db.execute(sql`
        UPDATE fuel_finder_alert_events
        SET read_at = ${new Date()}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id
      `);
      return updated.length > 0;
    }
    const event = this.local.events.find((item) => item.id === id && item.userId === userId);
    if (!event) return false;
    event.readAt = new Date();
    this.persistLocal();
    return true;
  }
}

export const fuelFinderStorage = new FuelFinderStorage();
