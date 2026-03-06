# FuelIQ NG

Petroleum Market Forecast Platform for Nigerian Marketers.

## Architecture

- **Frontend**: React + TypeScript + TailwindCSS + Shadcn UI + Recharts
- **Backend**: Express.js with JWT auth
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: Wouter (client-side)
- **State**: TanStack React Query

## Data Models

- **User**: id, name, email, password (hashed), role (admin|marketer), createdAt
- **Terminal**: id, name, state, code (unique), active
- **MarketSignal**: id, terminalId (FK), vesselActivity, truckQueue, nnpcSupply, fxPressure, policyRisk, createdAt
- **Forecast**: id, terminalId (FK), expectedMin, expectedMax, bias (bullish|bearish|neutral), confidence, suggestedAction, createdAt
- **PriceHistory**: id, terminalId (FK), date, price

## Seeded Terminals

Apapa (Lagos), Calabar (Cross River), Port Harcourt (Rivers), Warri (Delta), Onne (Rivers), Bonny (Rivers), Atlas Cove (Lagos), Ijegun (Lagos)

## Key Files

- `shared/schema.ts` - Drizzle schema + Zod validation
- `server/storage.ts` - Database storage layer (PostgreSQL)
- `server/routes.ts` - API endpoints + JWT auth
- `server/seed.ts` - Terminal + forecast + signal seeding
- `client/src/lib/auth.tsx` - Auth context provider
- `client/src/pages/landing.tsx` - Public landing page
- `client/src/pages/dashboard.tsx` - Main dashboard (authenticated)
- `client/src/pages/login.tsx` / `register.tsx` - Auth pages

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (requires JWT)
- `GET /api/terminals` - List all terminals
- `GET /api/terminals/:id/forecast` - Get forecast + signals for terminal
- `GET /api/terminals/:id/price-history` - Get price history for terminal
- `GET /api/forecasts/latest` - Get latest forecast (default terminal)

## Theme

Dark professional fintech theme with green accent (HSL 152 60% 40%). PWA enabled.
