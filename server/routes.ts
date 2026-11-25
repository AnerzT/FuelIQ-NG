import type { Express } from "express";
import { raw } from "express";
import rateLimit from "express-rate-limit";
import type { Server } from "http";
import { requireAuth, requireAdmin, requireVerifiedCustomer, attachUserRole, requireTier, requireTerminalAccess, requireForecastQuota, withDataDelay } from "./middleware/tierGuard.js";
import { register, login, getMe, refreshToken, sendVerificationCode, verifyCustomerCode, requestPasswordRecovery, resetPassword, updateCustomerProfile } from "./controllers/auth.controller.js";
import { adminDeleteAccount, adminListAccounts, deleteOwnAccount } from "./controllers/account.controller.js";
import { getTerminals } from "./controllers/terminal.controller.js";
import { getForecast, getMultiProductForecasts, createForecast, generateForecast, scoreForecast, getForecastHistory } from "./controllers/forecast.controller.js";
import { getSignals, createSignal } from "./controllers/signal.controller.js";
import { getPriceHistory } from "./controllers/price-history.controller.js";
import { ingestWhatsAppPrice } from "./controllers/whatsapp-price.controller.js";
import { getMarketIntelligence } from "./controllers/market-intelligence.controller.js";
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
  getNnpcStatus,
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
  getSubscriptionPaymentOptions,
  createSubscriptionCheckout,
  createBankTransferPaymentRequest,
  getUserBankTransferRequests,
  adminGetBankTransferRequests,
  adminReviewBankTransferRequest,
  stripeWebhookHandler,
} from "./controllers/payment.controller.js";
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
import {
  adminCreateFuelFinderPrice,
  adminCreateFuelFinderStation,
  adminGetFuelFinderReports,
  adminGetFuelFinderStations,
  adminGetNnpcFuelFinderStatus,
  adminReviewFuelFinderReport,
  adminSyncNnpcFuelFinder,
  adminUpdateFuelFinderStation,
  createFuelFinderReport,
  createUserFuelFinderAlert,
  deleteUserFuelFinderAlert,
  getFuelFinderMeta,
  getFuelFinderStations,
  getUserFuelFinderAlerts,
  markFuelFinderAlertRead,
} from "./controllers/fuel-finder.controller.js";
import {
  getCommunityMeta,
  getCommunityDashboard,
  listCommunitySubmissions,
  submitCommunityPrice,
  registerCommunityBusiness,
  getMyCommunityLocations,
  updateMyCommunityLocation,
  editCommunitySubmission,
  withdrawCommunitySubmission,
  confirmCommunityPrice,
  disputeCommunityPrice,
  getCommunityNotifications,
  readCommunityNotification,
  updateCommunityPreferences,
  getPublicCommunityPrices,
  getCommunityPriceHistory,
  getStationOwnerDashboard,
  submitOperatorPrice,
  adminListCommunityAccounts,
  adminReviewCommunityAccount,
  adminListCommunityBusinesses,
  adminReviewCommunityBusiness,
  adminListCommunitySubmissions,
  adminReviewCommunitySubmission,
  adminExportCommunitySubmissions,
  adminListCommunityDisputes,
  adminResolveCommunityDispute,
} from "./controllers/community-fuel.controller.js";
import {
  searchBusinesses,
  getBusinessProfile,
  getMyBusinessProfile,
  updateBusinessProfile,
  listConnections,
  createConnectionRequest,
  updateConnectionRequest,
  listConversations,
  messagingDashboardSummary,
  createConversation,
  listMessages,
  sendMessage,
  setConversationState,
  markConversationRead,
  setTyping,
  listTyping,
  editMessage,
  deleteMessage,
  blockCustomer,
  listBlockedCustomers,
  unblockCustomer,
  reportCustomerOrMessage,
  sendBusinessEnquiry,
  listChatNotifications,
  getChatPreferences,
  updateChatPreferences,
  readChatNotification,
  uploadMessageAttachment,
  getMessageAttachment,
  streamMessagingEvents,
  adminListMessageReports,
  adminListBusinessProfiles,
  adminReviewBusinessProfile,
  adminSetMessagingSuspension,
  adminListMessagingAudit,
  adminReviewMessageReport,
} from "./controllers/business-messaging.controller.js";
import {
  adminListMarketplaceReports,
  adminGetMarketplaceListingDocument,
  adminReviewMarketplaceReport,
  createBuyerRequest,
  createMarketplaceEnquiry,
  createMarketplaceListing,
  createSupplierOffer,
  getBusinessPreferences,
  getMarketplaceDashboard,
  getMarketplaceListingDocument,
  listBuyerRequests,
  listMarketplaceCategories,
  listMarketplaceListings,
  listMarketplaceNotifications,
  markMarketplaceNotificationRead,
  reportMarketplaceListing,
  reviewSupplierOffer,
  saveBusinessPreferences,
  updateMarketplaceListing,
  updateBuyerRequest,
  uploadMarketplaceListingDocument,
} from "./controllers/fuel-marketplace.controller.js";
// Seeding imports – temporarily disabled to avoid database errors
// import { seedDatabase, seedAdminUser, seedDepotsAndPrices, migrateLegacyTiers, seedRefineryAndRegulationData } from "./seed.js";
// import { seedPrismaDatabase } from "./prisma-seed.js";
import { storage } from "./storage.js";
import { setupAuthRateLimit } from "./middleware/production.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seeding disabled to prevent database errors during startup
  // await seedDatabase();
  // await seedAdminUser();
  // await seedPrismaDatabase();
  // await seedDepotsAndPrices();
  // await seedRefineryAndRegulationData();
  // await migrateLegacyTiers();

  const withTier = [requireAuth, attachUserRole(storage)];
  const authRateLimit = setupAuthRateLimit();
  const messagingRateLimit = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Messaging rate limit reached. Try again shortly." },
  });
  const marketplaceRateLimit = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Marketplace rate limit reached. Try again shortly." },
  });
  const adminMiddleware = [...withTier, requireAdmin];

  app.post("/api/webhooks/whatsapp/prices", ingestWhatsAppPrice);
  app.post("/api/auth/register", authRateLimit, register);
  app.post("/api/auth/login", authRateLimit, login);
  app.get("/api/auth/me", requireAuth, getMe);
  app.post("/api/auth/refresh", requireAuth, refreshToken);
  app.post("/api/auth/verification/send", requireAuth, authRateLimit, sendVerificationCode);
  app.post("/api/auth/verification/confirm", requireAuth, authRateLimit, verifyCustomerCode);
  app.post("/api/auth/password-recovery", authRateLimit, requestPasswordRecovery);
  app.post("/api/auth/password-recovery/reset", authRateLimit, resetPassword);
  app.patch("/api/auth/profile", requireAuth, updateCustomerProfile);
  app.delete("/api/account", authRateLimit, requireAuth, deleteOwnAccount);
  app.get("/api/admin/accounts", ...adminMiddleware, adminListAccounts);
  app.delete("/api/admin/accounts/:userId", ...adminMiddleware, adminDeleteAccount);

  app.get("/api/community/meta", getCommunityMeta);
  app.get("/api/community/discovery", getPublicCommunityPrices);
  app.get("/api/community/submissions/:id/history", getCommunityPriceHistory);
  app.get("/api/community/dashboard", requireAuth, getCommunityDashboard);
  app.get("/api/community/submissions", requireAuth, listCommunitySubmissions);
  app.post("/api/community/submissions", requireAuth, requireVerifiedCustomer, submitCommunityPrice);
  app.patch("/api/community/submissions/:id", requireAuth, requireVerifiedCustomer, editCommunitySubmission);
  app.delete("/api/community/submissions/:id", requireAuth, requireVerifiedCustomer, withdrawCommunitySubmission);
  app.post("/api/community/submissions/:id/confirm", requireAuth, requireVerifiedCustomer, confirmCommunityPrice);
  app.post("/api/community/submissions/:id/disputes", requireAuth, requireVerifiedCustomer, disputeCommunityPrice);
  app.get("/api/community/locations", requireAuth, getMyCommunityLocations);
  app.post("/api/community/locations/:kind", requireAuth, requireVerifiedCustomer, registerCommunityBusiness);
  app.patch("/api/community/locations/:kind/:id", requireAuth, requireVerifiedCustomer, updateMyCommunityLocation);
  app.get("/api/community/notifications", requireAuth, getCommunityNotifications);
  app.patch("/api/community/notifications/:id/read", requireAuth, readCommunityNotification);
  app.patch("/api/community/notification-preferences", requireAuth, updateCommunityPreferences);
  app.get("/api/operator/dashboard", requireAuth, getStationOwnerDashboard);
  app.post("/api/operator/prices", requireAuth, requireVerifiedCustomer, submitOperatorPrice);

  app.get("/api/messaging/events", requireAuth, requireVerifiedCustomer, streamMessagingEvents);
  app.get("/api/messaging/discovery", requireAuth, requireVerifiedCustomer, searchBusinesses);
  app.get("/api/messaging/business-profile/me", requireAuth, requireVerifiedCustomer, getMyBusinessProfile);
  app.get("/api/messaging/business-profile/:userId", requireAuth, requireVerifiedCustomer, getBusinessProfile);
  app.put("/api/messaging/business-profile", requireAuth, requireVerifiedCustomer, updateBusinessProfile);
  app.get("/api/messaging/connections", requireAuth, requireVerifiedCustomer, listConnections);
  app.post("/api/messaging/connections/requests", requireAuth, requireVerifiedCustomer, messagingRateLimit, createConnectionRequest);
  app.patch("/api/messaging/connections/requests/:id", requireAuth, requireVerifiedCustomer, messagingRateLimit, updateConnectionRequest);
  app.get("/api/messaging/conversations", requireAuth, requireVerifiedCustomer, listConversations);
  app.get("/api/messaging/dashboard", requireAuth, requireVerifiedCustomer, messagingDashboardSummary);
  app.post("/api/messaging/conversations", requireAuth, requireVerifiedCustomer, messagingRateLimit, createConversation);
  app.get("/api/messaging/conversations/:conversationId/messages", requireAuth, requireVerifiedCustomer, listMessages);
  app.post("/api/messaging/conversations/:conversationId/messages", requireAuth, requireVerifiedCustomer, messagingRateLimit, sendMessage);
  app.patch("/api/messaging/conversations/:conversationId/state", requireAuth, requireVerifiedCustomer, setConversationState);
  app.post("/api/messaging/conversations/:conversationId/read", requireAuth, requireVerifiedCustomer, markConversationRead);
  app.post("/api/messaging/conversations/:conversationId/typing", requireAuth, requireVerifiedCustomer, messagingRateLimit, setTyping);
  app.get("/api/messaging/conversations/:conversationId/typing", requireAuth, requireVerifiedCustomer, listTyping);
  app.post("/api/messaging/conversations/:conversationId/enquiries", requireAuth, requireVerifiedCustomer, messagingRateLimit, sendBusinessEnquiry);
  app.patch("/api/messaging/messages/:messageId", requireAuth, requireVerifiedCustomer, editMessage);
  app.delete("/api/messaging/messages/:messageId", requireAuth, requireVerifiedCustomer, deleteMessage);
  app.post("/api/messaging/attachments/:messageId", requireAuth, requireVerifiedCustomer,
    raw({ type: "application/octet-stream", limit: "10mb" }), uploadMessageAttachment);
  app.get("/api/messaging/attachments/:id", requireAuth, requireVerifiedCustomer, getMessageAttachment);
  app.post("/api/messaging/blocks", requireAuth, requireVerifiedCustomer, blockCustomer);
  app.get("/api/messaging/blocks", requireAuth, requireVerifiedCustomer, listBlockedCustomers);
  app.delete("/api/messaging/blocks", requireAuth, requireVerifiedCustomer, unblockCustomer);
  app.post("/api/messaging/reports", requireAuth, requireVerifiedCustomer, messagingRateLimit, reportCustomerOrMessage);
  app.get("/api/messaging/notifications", requireAuth, requireVerifiedCustomer, listChatNotifications);
  app.get("/api/messaging/preferences", requireAuth, requireVerifiedCustomer, getChatPreferences);
  app.patch("/api/messaging/preferences", requireAuth, requireVerifiedCustomer, updateChatPreferences);
  app.patch("/api/messaging/notifications/:id/read", requireAuth, requireVerifiedCustomer, readChatNotification);
  app.get("/api/admin/messaging/reports", ...adminMiddleware, adminListMessageReports);
  app.patch("/api/admin/messaging/reports/:id", ...adminMiddleware, adminReviewMessageReport);
  app.get("/api/admin/messaging/businesses", ...adminMiddleware, adminListBusinessProfiles);
  app.patch("/api/admin/messaging/businesses/:id", ...adminMiddleware, adminReviewBusinessProfile);
  app.post("/api/admin/messaging/customers/:userId/suspension", ...adminMiddleware, adminSetMessagingSuspension);
  app.get("/api/admin/messaging/audit", ...adminMiddleware, adminListMessagingAudit);

  app.get("/api/marketplace/categories", requireAuth, requireVerifiedCustomer, listMarketplaceCategories);
  app.get("/api/marketplace/listings", requireAuth, requireVerifiedCustomer, listMarketplaceListings);
  app.get("/api/marketplace/dashboard", requireAuth, requireVerifiedCustomer, getMarketplaceDashboard);
  app.post("/api/marketplace/listings", requireAuth, requireVerifiedCustomer, marketplaceRateLimit, createMarketplaceListing);
  app.patch("/api/marketplace/listings/:id", requireAuth, requireVerifiedCustomer, marketplaceRateLimit, updateMarketplaceListing);
  app.post("/api/marketplace/listings/:listingId/documents", requireAuth, requireVerifiedCustomer, marketplaceRateLimit,
    raw({ type: "application/octet-stream", limit: "10mb" }), uploadMarketplaceListingDocument);
  app.get("/api/marketplace/documents/:id", requireAuth, requireVerifiedCustomer, getMarketplaceListingDocument);
  app.post("/api/marketplace/listings/:listingId/enquiries", requireAuth, requireVerifiedCustomer, marketplaceRateLimit, createMarketplaceEnquiry);
  app.post("/api/marketplace/listings/:listingId/reports", requireAuth, requireVerifiedCustomer, marketplaceRateLimit, reportMarketplaceListing);
  app.get("/api/marketplace/requests", requireAuth, requireVerifiedCustomer, listBuyerRequests);
  app.post("/api/marketplace/requests", requireAuth, requireVerifiedCustomer, marketplaceRateLimit, createBuyerRequest);
  app.patch("/api/marketplace/requests/:id", requireAuth, requireVerifiedCustomer, marketplaceRateLimit, updateBuyerRequest);
  app.post("/api/marketplace/requests/:requestId/offers", requireAuth, requireVerifiedCustomer, marketplaceRateLimit, createSupplierOffer);
  app.patch("/api/marketplace/offers/:id", requireAuth, requireVerifiedCustomer, marketplaceRateLimit, reviewSupplierOffer);
  app.get("/api/marketplace/preferences", requireAuth, requireVerifiedCustomer, getBusinessPreferences);
  app.put("/api/marketplace/preferences", requireAuth, requireVerifiedCustomer, saveBusinessPreferences);
  app.get("/api/marketplace/notifications", requireAuth, requireVerifiedCustomer, listMarketplaceNotifications);
  app.patch("/api/marketplace/notifications/:id/read", requireAuth, requireVerifiedCustomer, markMarketplaceNotificationRead);
  app.get("/api/admin/marketplace/reports", ...adminMiddleware, adminListMarketplaceReports);
  app.patch("/api/admin/marketplace/reports/:id", ...adminMiddleware, adminReviewMarketplaceReport);
  app.get("/api/admin/marketplace/documents/:id", ...adminMiddleware, adminGetMarketplaceListingDocument);

  app.get("/api/admin/community/accounts", ...adminMiddleware, adminListCommunityAccounts);
  app.patch("/api/admin/community/accounts/:id", ...adminMiddleware, adminReviewCommunityAccount);
  app.get("/api/admin/community/businesses/:kind", ...adminMiddleware, adminListCommunityBusinesses);
  app.patch("/api/admin/community/businesses/:kind/:id", ...adminMiddleware, adminReviewCommunityBusiness);
  app.get("/api/admin/community/submissions/export", ...adminMiddleware, adminExportCommunitySubmissions);
  app.get("/api/admin/community/submissions", ...adminMiddleware, adminListCommunitySubmissions);
  app.patch("/api/admin/community/submissions/:id", ...adminMiddleware, adminReviewCommunitySubmission);
  app.get("/api/admin/community/disputes", ...adminMiddleware, adminListCommunityDisputes);
  app.patch("/api/admin/community/disputes/:id", ...adminMiddleware, adminResolveCommunityDispute);

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

  app.get("/api/admin/terminals", ...adminMiddleware, adminGetTerminals);
  app.patch("/api/admin/terminals/:id", ...adminMiddleware, adminToggleTerminal);
  app.post("/api/admin/forecasts", ...adminMiddleware, adminCreateForecast);
  app.post("/api/admin/signals", ...adminMiddleware, adminUpdateSignal);
  app.get("/api/admin/forecasts", ...adminMiddleware, adminGetForecasts);

  app.get("/api/fx/history", ...withTier, withDataDelay(), getFxHistory);
  app.get("/api/market/overview", ...withTier, withDataDelay(), getMarketOverview);
  app.get("/api/market-intelligence", ...withTier, getMarketIntelligence);
  app.get("/api/market/nnpc", ...withTier, withDataDelay(), getNnpcPrice);
  app.get("/api/market/fx", ...withTier, withDataDelay(), getFxRate);
  app.get("/api/market/vessels", ...withTier, withDataDelay(), getVesselTracking);

  app.get("/api/fuel-finder/meta", getFuelFinderMeta);
  app.get("/api/fuel-finder/stations", getFuelFinderStations);
  app.post("/api/fuel-finder/reports", requireAuth, attachUserRole(storage), createFuelFinderReport);
  app.get("/api/fuel-finder/alerts", requireAuth, attachUserRole(storage), getUserFuelFinderAlerts);
  app.post("/api/fuel-finder/alerts", requireAuth, attachUserRole(storage), createUserFuelFinderAlert);
  app.delete("/api/fuel-finder/alerts/:id", requireAuth, attachUserRole(storage), deleteUserFuelFinderAlert);
  app.patch("/api/fuel-finder/alert-events/:id/read", requireAuth, attachUserRole(storage), markFuelFinderAlertRead);

  app.get("/api/admin/fuel-finder/stations", ...adminMiddleware, adminGetFuelFinderStations);
  app.post("/api/admin/fuel-finder/stations", ...adminMiddleware, adminCreateFuelFinderStation);
  app.patch("/api/admin/fuel-finder/stations/:id", ...adminMiddleware, adminUpdateFuelFinderStation);
  app.post("/api/admin/fuel-finder/stations/:id/prices", ...adminMiddleware, adminCreateFuelFinderPrice);
  app.get("/api/admin/fuel-finder/reports", ...adminMiddleware, adminGetFuelFinderReports);
  app.patch("/api/admin/fuel-finder/reports/:id", ...adminMiddleware, adminReviewFuelFinderReport);
  app.get("/api/admin/fuel-finder/nnpc/status", ...adminMiddleware, adminGetNnpcFuelFinderStatus);
  app.post("/api/admin/fuel-finder/nnpc/sync", ...adminMiddleware, adminSyncNnpcFuelFinder);

  app.post("/api/admin/sync/nnpc", ...adminMiddleware, triggerNnpcSync);
  app.post("/api/admin/sync/nnpc-recalculate", ...adminMiddleware, triggerNnpcSyncAndRecalculate);
  app.get("/api/admin/sync/nnpc/status", ...adminMiddleware, getNnpcStatus);
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
  app.get("/api/subscription/payment-options", requireAuth, getSubscriptionPaymentOptions);
  app.patch("/api/subscription", ...withTier, updateSubscription);
  app.post("/api/subscription/checkout", ...withTier, createSubscriptionCheckout);
  app.get("/api/subscription/payment-requests", requireAuth, getUserBankTransferRequests);
  app.post("/api/subscription/payment-requests", ...withTier, createBankTransferPaymentRequest);
  app.post("/api/payment/webhook", stripeWebhookHandler);

  app.get("/api/admin/subscriptions", ...adminMiddleware, adminGetAllSubscriptions);
  app.patch("/api/admin/subscriptions/:userId", ...adminMiddleware, adminUpdateSubscription);
  app.get("/api/admin/subscription-payment-requests", ...adminMiddleware, adminGetBankTransferRequests);
  app.patch("/api/admin/subscription-payment-requests/:id", ...adminMiddleware, adminReviewBankTransferRequest);

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
  app.get("/api/refinery/status", ...withTier, getRefineryStatus);
  app.get("/api/regulations", ...withTier, requireTier("pro"), getRegulations);
  app.get("/api/regulations/high-impact", ...withTier, requireTier("pro"), getHighImpactRegulations);

  // Debug endpoint – no authentication required
  app.get("/api/debug/terminals", async (req, res) => {
    try {
      const terminals = await storage.getAllTerminals();
      res.json(terminals);
    } catch (err) {
      console.error("Debug terminals error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  return httpServer;
}

export default registerRoutes;
