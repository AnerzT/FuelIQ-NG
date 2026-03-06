import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { loginSchema, registerSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { seedDatabase } from "./seed";
import { seedPrismaDatabase } from "./prisma-seed";

const JWT_SECRET = process.env.SESSION_SECRET || "fueliq-ng-secret-key";

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as any).userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await seedDatabase();
  await seedPrismaDatabase();

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      }
      const { name, email, password } = parsed.data;

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ name, email, password: hashedPassword, role: "marketer" });
      const token = generateToken(user.id);

      return res.json({ user: { ...user, password: undefined }, token });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      }
      const { email, password } = parsed.data;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = generateToken(user.id);
      return res.json({ user: { ...user, password: undefined }, token });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ user: { ...user, password: undefined } });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/terminals", async (_req: Request, res: Response) => {
    try {
      const terminalList = await storage.getTerminals();
      return res.json(terminalList);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/terminals/:id/forecast", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const terminal = await storage.getTerminal(id);
      if (!terminal) return res.status(404).json({ message: "Terminal not found" });

      const forecast = await storage.getLatestForecast(id);
      const signals = await storage.getLatestSignal(id);

      return res.json({ terminal, forecast, signals });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/terminals/:id/price-history", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const history = await storage.getPriceHistory(id, 30);
      return res.json(history);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/forecasts/latest", async (_req: Request, res: Response) => {
    try {
      const terminalList = await storage.getTerminals();
      if (terminalList.length === 0) return res.json(null);

      const firstTerminal = terminalList[0];
      const forecast = await storage.getLatestForecast(firstTerminal.id);
      const signals = await storage.getLatestSignal(firstTerminal.id);

      return res.json({ terminal: firstTerminal, forecast, signals });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
