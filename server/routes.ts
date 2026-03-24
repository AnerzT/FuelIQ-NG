import type { Express } from "express";
import type { Server } from "http";
import { requireAuth, requireAdmin, attachUserRole, requireTier, requireTerminalAccess, requireForecastQuota, withDataDelay } from "./middleware/tierGuard.js";
import { register, login, getMe, refreshToken } from "./controllers/auth.controller.js";
import { getTerminals } from "./controllers/terminal.controller.js";
import { getForecast, getMultiProductForecasts, createForecast, generateForecast, scoreForecast, getForecastHistory } from "./controllers/forecast.controller.js";
import { getSignals, createSignal } from "./controllers/signal.controller.js";
import { getPriceHistory } from "./controllers/price-history.controller.js";
import {
  adminGetTerminals,
  adminToggleTerminal,
  adminCreateForecast,
  adminUpdateSignal,
  adminGetForecasts,
} from "./controllers/admin.controller.js";
import {
  getNnpcPrice,
  triggerNnpcSync,
  triggerNnpcSyncAndRecalculate,
  getVesselTracking,
  triggerVesselSignalUpdate,
  getFxRate,
  triggerFxSync,
  triggerFxSignalUpdate,
  getMarketOverview,
  getFxHistory,
} from "./controllers/integrations.controller.js";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  getNotificationLogs,
  getNotificationStatus,
  triggerMorningDigest,
  triggerTestNotification,
} from "./controllers/notification.controller.js";
import {
  getSubscriptionInfo,
  getTierInfo,
  updateSubscription,
  adminGetAllSubscriptions,
  adminUpdateSubscription,
} from "./controllers/subscription.controller.js";
import {
  getDepots,
  getDepot,
  createDepot,
  getDepotPrices,
  createDepotPrice,
  updateDepotPrice,
} from "./controllers/depot.controller.js";
import {
  getInventory,
  getInventoryWithPnL,
  createInventory,
  createTransaction,
  getTransactions,
} from "./controllers/inventory.controller.js";
import {
  getTraderSignals,
  submitTraderSignal,
} from "./controllers/traderSignal.controller.js";
import {
  getHedgeRecommendations,
  generateHedgeRecommendations,
  getAdvancedAnalysis,
} from "./controllers/hedge.controller.js";
import { getRefineryUpdates, getRefineryStatus } from "./controllers/refinery.controller.js";
import { getRegulations, getHighImpactRegulations } from "./controllers/regulation.controller.js";
import { seedDatabase, seedAdminUser, seedDepotsAndPrices, migrateLegacyTiers, seedRefineryAndRegulationData } from "./seed.js";
import { seedPrismaDatabase } from "./prisma-seed.js";
import { storage } from "./storage.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await seedDatabase();
  await seedAdminUser();
  await seedPrismaDatabase();
  await seedDepotsAndPrices();
  await seedRefineryAndRegulationData();
  await migrateLegacyTiers();

  const withTier = [requireAuth, attachUserRole(storage)];

  app.post("/api/auth/register", register);
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", requireAuth, getMe);
  app.post("/api/auth/refresh", requireAuth, refreshToken);

  app.get("/api/terminals", requireAuth, getTerminals);

  app.get("/api/forecast/multi/:terminalId", ...withTier, getMultiProductForecasts);
  app.get("/api/forecast/:terminalId", ...withTier, requireTerminalAccess(), withDataDelay(), getForecast as any);
  app.post("/api/forecast", ...withTier, requireForecastQuota(), createForecast);
  app.post("/api/forecast/generate/:terminalId", ...withTier, requireTerminalAccess(), requireForecastQuota(), generateForecast as any);
  app.post("/api/forecast/score/:terminalId", ...withTier, requireTier("pro"), requireTerminalAccess(), requireForecastQuota(), scoreForecast as any);
  app.get("/api/forecasts/history", ...withTier, getForecastHistory);

  app.get("/api/signals/:terminalId", ...withTier, requireTerminalAccess(), getSignals);
  app.post("/api/signals", requireAuth, createSignal);

  app.get("/api/terminals/:id/price-history", ...withTier, withDataDelay(), getPriceHistory);

  const adminMiddleware = [...withTier, requireAdmin];
  app.get("/api/admin/terminals", ...adminMiddleware, adminGetTerminals);
  app.patch("/api/admin/terminals/:id", ...adminMiddleware, adminToggleTerminal);
  app.post("/api/admin/forecasts", ...adminMiddleware, adminCreateForecast);
  app.post("/api/admin/signals", ...adminMiddleware, adminUpdateSignal);
  app.get("/api/admin/forecasts", ...adminMiddleware, adminGetForecasts);

  app.get("/api/fx/history", ...withTier, withDataDelay(), getFxHistory);
  app.get("/api/market/overview", ...withTier, withDataDelay(), getMarketOverview);
  app.get("/api/market/nnpc", ...withTier, withDataDelay(), getNnpcPrice);
  app.get("/api/market/fx", ...withTier, withDataDelay(), getFxRate);
  app.get("/api/market/vessels", ...withTier, withDataDelay(), getVesselTracking);

  app.post("/api/admin/sync/nnpc", ...adminMiddleware, triggerNnpcSync);
  app.post("/api/admin/sync/nnpc-recalculate", ...adminMiddleware, triggerNnpcSyncAndRecalculate);
  app.post("/api/admin/sync/vessels", ...adminMiddleware, triggerVesselSignalUpdate);
  app.post("/api/admin/sync/fx", ...adminMiddleware, triggerFxSync);
  app.post("/api/admin/sync/fx-signals", ...adminMiddleware, triggerFxSignalUpdate);

  app.get("/api/notifications/preferences", requireAuth, getNotificationPrefs);
  app.patch("/api/notifications/preferences", requireAuth, updateNotificationPrefs);
  app.get("/api/notifications/logs", requireAuth, getNotificationLogs);
  app.get("/api/notifications/status", requireAuth, getNotificationStatus);
  app.post("/api/notifications/test", requireAuth, triggerTestNotification);

  app.post("/api/admin/notifications/morning-digest", ...adminMiddleware, triggerMorningDigest);

  app.get("/api/subscription", ...withTier, getSubscriptionInfo);
  app.get("/api/subscription/tiers", getTierInfo);
  app.patch("/api/subscription", ...withTier, updateSubscription);

  app.get("/api/admin/subscriptions", ...adminMiddleware, adminGetAllSubscriptions);
  app.patch("/api/admin/subscriptions/:userId", ...adminMiddleware, adminUpdateSubscription);

  app.get("/api/depots", ...withTier, requireTier("pro"), getDepots);
  app.get("/api/depots/:id", ...withTier, requireTier("pro"), getDepot);
  app.post("/api/depots", ...adminMiddleware, createDepot);
  app.get("/api/depot-prices", ...withTier, requireTier("pro"), getDepotPrices);
  app.post("/api/depot-prices", ...adminMiddleware, createDepotPrice);
  app.patch("/api/depot-prices/:id", ...adminMiddleware, updateDepotPrice);

  app.get("/api/inventory", ...withTier, requireTier("pro"), getInventory);
  app.get("/api/inventory/pnl", ...withTier, requireTier("pro"), getInventoryWithPnL);
  app.post("/api/inventory", ...withTier, requireTier("pro"), createInventory);
  app.post("/api/inventory/transactions", ...withTier, requireTier("pro"), createTransaction);
  app.get("/api/inventory/:inventoryId/transactions", ...withTier, requireTier("pro"), getTransactions);

  app.get("/api/trader-signals", ...withTier, requireTier("elite"), getTraderSignals);
  app.post("/api/trader-signals", ...withTier, requireTier("elite"), submitTraderSignal);

  app.get("/api/hedge", ...withTier, requireTier("pro"), getHedgeRecommendations);
  app.post("/api/hedge/generate", ...withTier, requireTier("pro"), generateHedgeRecommendations);
  app.get("/api/hedge/analysis", ...withTier, requireTier("pro"), getAdvancedAnalysis);

  app.get("/api/refinery/updates", ...withTier, requireTier("pro"), getRefineryUpdates);
  app.get("/api/refinery/status", ...withTier, requireTier("pro"), getRefineryStatus);
  app.get("/api/regulations", ...withTier, requireTier("pro"), getRegulations);
  app.get("/api/regulations/high-impact", ...withTier, requireTier("pro"), getHighImpactRegulations);

  return httpServer;
}

export default registerRoutes;
