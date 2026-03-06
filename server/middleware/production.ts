import type { Request, Response, NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const isProduction = process.env.NODE_ENV === "production";

export function setupCompression() {
  return compression({
    level: 6,
    threshold: 1024,
    filter: (req: Request, res: Response) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  });
}

export function setupCors() {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : undefined;

  return cors({
    origin: isProduction
      ? allowedOrigins || false
      : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  });
}

export function setupHelmet() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });
}

export function setupApiRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later" },
    skip: (req: Request) => !req.path.startsWith("/api") || req.path.startsWith("/api/auth"),
  });
}

export function setupAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 20 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many authentication attempts, please try again later" },
  });
}

export function apiErrorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const message = isProduction && status === 500
    ? "Internal Server Error"
    : err.message || "Internal Server Error";

  if (status >= 500) {
    console.error(`[ERROR] ${err.stack || err.message || err}`);
  }

  return res.status(status).json({
    success: false,
    message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ success: false, message: "Endpoint not found" });
  }
  next();
}
