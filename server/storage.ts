import { db } from "./db.js";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  users,
  terminals,
  forecasts,
  marketSignals,
  priceHistory,
  depots,
  depotPrices,
  refineryUpdates,
  regulationUpdates,
  fxRates,
  inventory,
  transactions,
  traderSignals,
  hedgeRecommendations,
  type User,
  type InsertUser,
  type Terminal,
  type Forecast,
  type MarketSignal,
  type PriceHistoryEntry,
  type Depot,
  type DepotPrice,
  type RefineryUpdate,
  type RegulationUpdate,
  type FxRate,
  type Inventory,
  type Transaction,
  type TraderSignal,
  type HedgeRecommendation,
} from "../shared/schema.js";

export interface IStorage {
  // ... (same as before, omitted for brevity)
}

export class DatabaseStorage implements IStorage {
  // ... all methods as before, but ensure getDepotPrices is as follows:

  async getDepotPrices(depotId?: string, productType?: string): Promise<DepotPrice[]> {
    let query = db.select().from(depotPrices);
    if (depotId) query = query.where(eq(depotPrices.depotId, depotId));
    if (productType) query = query.where(eq(depotPrices.productType, productType));
    const result = await query.orderBy(desc(depotPrices.updatedAt));
    return result as any; // <-- critical cast
  }

  // ... rest of methods unchanged
}

export const storage = new DatabaseStorage();
