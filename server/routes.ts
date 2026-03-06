import type { Express } from "express";
import { type Server } from "http";
import { requireAuth, requireAdmin, attachUserRole } from "./middleware/auth";
import { register, login, getMe } from "./controllers/auth.controller";
import { getTerminals } from "./controllers/terminal.controller";
import { getForecast, createForecast, generateForecast } from "./controllers/forecast.controller";
import { getSignals, createSignal } from "./controllers/signal.controller";
import { getPriceHistory } from "./controllers/price-history.controller";
import {
  adminGetTerminals,
  adminToggleTerminal,
  adminCreateForecast,
  adminUpdateSignal,
  adminGetForecasts,
} from "./controllers/admin.controller";
import { seedDatabase, seedAdminUser } from "./seed";
import { seedPrismaDatabase } from "./prisma-seed";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await seedDatabase();
  await seedAdminUser();
  await seedPrismaDatabase();

  app.post("/api/auth/register", register);
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", requireAuth, getMe);

  app.get("/api/terminals", requireAuth, getTerminals);

  app.get("/api/forecast/:terminalId", requireAuth, getForecast);
  app.post("/api/forecast", requireAuth, createForecast);
  app.post("/api/forecast/generate/:terminalId", requireAuth, generateForecast);

  app.get("/api/signals/:terminalId", requireAuth, getSignals);
  app.post("/api/signals", requireAuth, createSignal);

  app.get("/api/terminals/:id/price-history", requireAuth, getPriceHistory);

  const adminMiddleware = [requireAuth, attachUserRole(storage), requireAdmin];
  app.get("/api/admin/terminals", ...adminMiddleware, adminGetTerminals);
  app.patch("/api/admin/terminals/:id", ...adminMiddleware, adminToggleTerminal);
  app.post("/api/admin/forecasts", ...adminMiddleware, adminCreateForecast);
  app.post("/api/admin/signals", ...adminMiddleware, adminUpdateSignal);
  app.get("/api/admin/forecasts", ...adminMiddleware, adminGetForecasts);

  return httpServer;
}
