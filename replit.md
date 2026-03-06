# FuelIQ NG

Petroleum Market Forecast Platform for Nigerian Marketers.

## Architecture

- **Frontend**: React + TypeScript + TailwindCSS + Shadcn UI + Recharts
- **Backend**: Express.js with JWT auth
- **Database**: PostgreSQL with Drizzle ORM + Prisma ORM (dual setup)
- **Routing**: Wouter (client-side)
- **State**: TanStack React Query

## Dual ORM Setup

- **Drizzle ORM**: Tables `users`, `terminals`, `market_signals`, `forecasts`, `price_history` — used by app routes
- **Prisma ORM**: Tables `prisma_users`, `prisma_terminals`, `prisma_market_signals`, `prisma_forecasts`, `prisma_price_history` — separate Prisma-managed tables
- Both ORMs are initialized and seeded on startup

## Prisma Schema

Located at `prisma/schema.prisma`. Models: User, Terminal, MarketSignal, Forecast, PriceHistory.
Generated client at `generated/prisma/`. Config at `prisma.config.ts`.

## Data Models

- **User**: id, name, email, password (hashed), role (admin|marketer), createdAt
- **Terminal**: id, name, state, code (unique), active
- **MarketSignal**: id, terminalId (FK), vesselActivity, truckQueue, nnpcSupply, fxPressure, policyRisk, createdAt
- **Forecast**: id, terminalId (FK), expectedMin, expectedMax, bias (bullish|bearish|neutral), confidence, suggestedAction, createdAt
- **PriceHistory**: id, terminalId (FK), date, price

## Seeded Terminals

Apapa (Lagos), Calabar (Cross River), Port Harcourt (Rivers), Warri (Delta), Onne (Rivers), Bonny (Rivers), Atlas Cove (Lagos), Ijegun (Lagos)

## Backend Architecture (Controller/Middleware Pattern)

- `server/middleware/auth.ts` - JWT auth middleware (`requireAuth`), token helpers
- `server/controllers/auth.controller.ts` - Register, login, getMe handlers
- `server/controllers/terminal.controller.ts` - GET terminals handler
- `server/controllers/forecast.controller.ts` - GET/POST forecast handlers
- `server/controllers/signal.controller.ts` - GET/POST signal handlers
- `server/controllers/price-history.controller.ts` - GET price history handler
- `server/routes.ts` - Route registration (thin, imports controllers + middleware)
- `server/storage.ts` - Database storage layer (Drizzle/PostgreSQL)

## Key Files

- `shared/schema.ts` - Drizzle schema + Zod validation
- `prisma/schema.prisma` - Prisma schema definition
- `server/seed.ts` - Drizzle terminal seeding
- `server/prisma-seed.ts` - Prisma terminal seeding
- `client/src/lib/auth.tsx` - Auth context provider
- `client/src/lib/api.ts` - Auth-aware fetch helper for TanStack Query
- `client/src/pages/landing.tsx` - Public landing page
- `client/src/pages/dashboard.tsx` - Main dashboard (authenticated)
- `client/src/pages/login.tsx` / `register.tsx` - Auth pages

## API Endpoints

All protected routes require JWT Bearer token in Authorization header.

- `POST /api/auth/register` - Register new user (public)
- `POST /api/auth/login` - Login (public)
- `GET /api/auth/me` - Get current user (protected)
- `GET /api/terminals` - List all terminals (protected)
- `GET /api/forecast/:terminalId` - Get forecast for terminal (protected)
- `POST /api/forecast` - Create forecast (protected)
- `GET /api/signals/:terminalId` - Get signals for terminal (protected)
- `POST /api/signals` - Create market signal (protected)
- `GET /api/terminals/:id/price-history` - Get price history (protected)

## API Response Format

All responses follow: `{ success: boolean, message?: string, data?: any }`

## Installed Packages

@prisma/client, prisma, jsonwebtoken, bcryptjs, recharts, axios, date-fns, next-pwa, clsx, lucide-react (plus existing deps)

## Theme

Dark professional fintech theme with green accent (HSL 152 60% 40%). PWA enabled.
