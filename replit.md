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
- **RefineryUpdate**: id, refineryName, productionCapacity, operationalStatus, pmsOutputEstimate, dieselOutputEstimate, jetOutputEstimate, updateSource, createdAt
- **RegulationUpdate**: id, title, summary, impactLevel (low|medium|high), effectiveDate, source, createdAt
- **ExternalPriceFeed**: id, sourceName (NNPC|Dangote|Depot), price, terminalId (FK, optional), createdAt
- **FxRate**: id, rate, source, createdAt
- **NotificationLog**: id, userId (FK), channel (sms|whatsapp), alertType, message, status (pending|sent|failed), externalId, createdAt

### User Model Extensions
- `phone`: optional phone number for SMS alerts
- `whatsappPhone`: optional WhatsApp number
- `notificationPrefs`: JSONB with `smsEnabled`, `whatsappEnabled`, `forecastAlerts`, `priceAlerts`, `refineryAlerts`, `morningDigest`

## Seeded Terminals

Apapa (Lagos), Calabar (Cross River), Port Harcourt (Rivers), Warri (Delta), Onne (Rivers), Bonny (Rivers), Atlas Cove (Lagos), Ijegun (Lagos)

## Production Hardening

- **Compression**: gzip via `compression` middleware (threshold 1KB, level 6)
- **CORS**: Configurable origins via `CORS_ORIGINS` env var (comma-separated), credentials enabled
- **Helmet**: Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.)
- **Rate Limiting**: API routes 100 req/15min (prod), auth routes 20 req/15min (prod)
- **Error Handling**: Centralized `apiErrorHandler` middleware; stack traces hidden in production
- **Health Check**: `GET /api/health` returns status and timestamp
- **Static Caching**: 1-year immutable cache for assets; no-cache for HTML/SW/manifest
- **Build**: esbuild bundles server to `dist/index.cjs`; Vite builds client to `dist/public`
- **Environment**: `JWT_SECRET` or `SESSION_SECRET` required (fails fast if missing); `DATABASE_URL` required

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` or `SESSION_SECRET` | Secret for JWT token signing |
| `PORT` | Server port (default: 5000) |
| `NODE_ENV` | `development` or `production` |
| `CORS_ORIGINS` | Comma-separated allowed origins (optional, defaults to allow all) |

### Middleware Stack (`server/middleware/production.ts`)

- `setupHelmet()` - Security headers
- `setupCompression()` - Response compression
- `setupCors()` - CORS configuration
- `setupApiRateLimit()` - General API rate limiting
- `setupAuthRateLimit()` - Auth endpoint rate limiting
- `apiErrorHandler()` - Centralized error handler
- `notFoundHandler()` - API 404 handler

## Backend Architecture (Controller/Middleware/Services Pattern)

- `server/middleware/auth.ts` - JWT auth middleware (`requireAuth`), token helpers
- `server/middleware/production.ts` - Production middleware (compression, CORS, rate limiting, security)
- `server/controllers/auth.controller.ts` - Register, login, getMe handlers
- `server/controllers/terminal.controller.ts` - GET terminals handler
- `server/controllers/forecast.controller.ts` - GET/POST/generate forecast handlers
- `server/controllers/signal.controller.ts` - GET/POST signal handlers
- `server/controllers/price-history.controller.ts` - GET price history handler
- `server/controllers/integrations.controller.ts` - External API integration endpoints

### External API Integration Services

- `server/services/nnpcService.ts` - NNPC PMS price feed (live API or simulated fallback), stores in ExternalPriceFeed, triggers forecast recalculation
- `server/services/vesselTracking.ts` - Vessel tracking per terminal (MarineTraffic API or simulated), converts vessel counts to activity/supply pressure signals
- `server/services/fxService.ts` - USD/NGN FX rate (exchangerate.host API or simulated), detects volatility, feeds fxPressure into signals
- `server/services/smsService.ts` - SMS notifications via Twilio or Termii (auto-detects provider, simulated fallback)
- `server/services/whatsappService.ts` - WhatsApp notifications via Meta Cloud API (simulated fallback)
- `server/services/notificationOrchestrator.ts` - Orchestrates alerts: forecast bias changes, price spikes >₦10, refinery output drops, morning digests

### Notification API Endpoints (authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/preferences` | Get user's phone/WhatsApp/notification prefs |
| PATCH | `/api/notifications/preferences` | Update phone, WhatsApp number, alert toggles |
| GET | `/api/notifications/logs` | User's notification history |
| GET | `/api/notifications/status` | SMS/WhatsApp provider configuration status |
| POST | `/api/notifications/test` | Send test notification (body: `{channel:"sms"|"whatsapp"|"all"}`) |
| POST | `/api/admin/notifications/morning-digest` | Trigger morning digest broadcast (admin) |

### Optional Notification Environment Variables

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio sender phone number |
| `TERMII_API_KEY` | Termii API key (alternative to Twilio) |
| `TERMII_SENDER_ID` | Termii sender ID (default: FuelIQ) |
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API token |
| `WHATSAPP_PHONE_ID` | WhatsApp Business phone number ID |

### Market Data API Endpoints (authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market/overview` | Combined market overview (NNPC price, FX rate, vessel summary) |
| GET | `/api/market/nnpc` | Latest NNPC price feed history |
| GET | `/api/market/fx` | FX rate with volatility analysis |
| GET | `/api/market/vessels` | Live vessel tracking for all terminals |

### Admin Sync Endpoints (admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/sync/nnpc` | Sync NNPC price feed |
| POST | `/api/admin/sync/nnpc-recalculate` | Sync NNPC + recalculate all forecasts |
| POST | `/api/admin/sync/vessels` | Sync vessel data + update terminal signals |
| POST | `/api/admin/sync/fx` | Sync FX rate |
| POST | `/api/admin/sync/fx-signals` | Sync FX + update fxPressure signals |

### Optional Environment Variables for Live APIs

| Variable | Description |
|----------|-------------|
| `NNPC_API_URL` | NNPC price feed API URL (falls back to simulation) |
| `VESSEL_API_KEY` | MarineTraffic API key (falls back to simulation) |
| `VESSEL_API_URL` | Custom vessel tracking API URL |
| `FX_API_KEY` | exchangerate.host API key (falls back to simulation) |
| `FX_API_URL` | Custom FX rate API URL |

## Forecast Engine

### Rules-Based Engine (`server/services/forecastEngine.ts`)
Legacy heuristic engine for backward compatibility:
- **Bullish pattern**: TruckQueue=High + VesselActivity=None + NNPCSupply=Weak → bias=bullish
- **Bearish pattern**: VesselActivity=High + NNPCSupply=Strong → bias=bearish
- Exports: `computeForecast()`, `matchesBullishPattern()`, `matchesBearishPattern()`

### AI Scoring Engine (`server/services/forecastScoring.ts`)
Probabilistic forecast scoring system — primary engine used by `/api/forecast/score/:terminalId` and NNPC recalculation:
- **9 normalized inputs**: 5 market signals (0-1 encoded) + priceTrend (linear regression) + priceVolatility (CV) + fxVolatility (CV) + nnpcPriceChange
- **Adaptive weights**: Base weights auto-adjust based on market conditions (e.g., fxPressure weight increases 1.5x during high FX volatility)
- **Softmax probabilities**: Produces { increase, decrease, stable } percentages
- **Confidence**: Weighted blend of probability certainty (45%), signal clarity (30%), data richness (25%) → range 35-97%
- **Expected range**: Price history baseline ± bias-adjusted shift with volatility multiplier
- Returns: `{ bias, probability, expectedRange, confidence, suggestedAction, scoring }`
- Endpoint: `POST /api/forecast/score/:terminalId`

## Key Files

- `shared/schema.ts` - Drizzle schema + Zod validation
- `prisma/schema.prisma` - Prisma schema definition
- `server/seed.ts` - Drizzle terminal seeding
- `server/prisma-seed.ts` - Prisma terminal seeding
- `client/src/lib/auth.tsx` - Auth context provider
- `client/src/lib/api.ts` - Auth-aware fetch helper for TanStack Query
- `client/src/pages/landing.tsx` - Public landing page
- `client/src/pages/dashboard.tsx` - Main dashboard (authenticated)
- `client/src/pages/admin.tsx` - Admin panel (admin role required)
- `client/src/pages/login.tsx` / `register.tsx` - Auth pages
- `server/controllers/admin.controller.ts` - Admin API handlers

## API Endpoints

All protected routes require JWT Bearer token in Authorization header.

- `POST /api/auth/register` - Register new user (public)
- `POST /api/auth/login` - Login (public)
- `GET /api/auth/me` - Get current user (protected)
- `GET /api/terminals` - List all terminals (protected)
- `GET /api/forecast/:terminalId` - Get forecast for terminal (protected)
- `POST /api/forecast` - Create forecast manually (protected)
- `POST /api/forecast/generate/:terminalId` - Generate forecast from signals via engine (protected)
- `GET /api/signals/:terminalId` - Get signals for terminal (protected)
- `POST /api/signals` - Create market signal (protected)
- `GET /api/terminals/:id/price-history` - Get price history (protected)

### Admin Endpoints (require admin role)

Admin routes use `requireAuth → attachUserRole → requireAdmin` middleware chain.

- `GET /api/admin/terminals` - List all terminals (admin)
- `PATCH /api/admin/terminals/:id` - Toggle terminal active/inactive (admin)
- `POST /api/admin/forecasts` - Create manual forecast (admin)
- `POST /api/admin/signals` - Update market signals (admin)
- `GET /api/admin/forecasts` - Get forecast history, optional `?terminalId=` filter (admin)

Admin user: `admin@fueliq.ng` (seeded on startup)

## API Response Format

All responses follow: `{ success: boolean, message?: string, data?: any }`

## Installed Packages

@prisma/client, prisma, jsonwebtoken, bcryptjs, recharts, axios, date-fns, next-pwa, clsx, lucide-react, compression, cors, express-rate-limit, helmet (plus existing deps)

## PWA Support

Full Progressive Web App implementation:
- **Manifest**: `client/public/manifest.json` — app name "FuelIQ NG", theme `#0f172a`, standalone display
- **Service Worker**: `client/public/sw.js` — network-first for navigation with offline fallback, runtime caching for static assets
- **Offline Page**: `client/public/offline.html` — branded dark-themed offline fallback
- **Icons**: 72, 96, 128, 144, 152, 192, 384, 512px + maskable 512px + apple-touch-icon (180px)
- **iOS Meta Tags**: apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style (black-translucent), apple-touch-icon
- **Android**: Full manifest with maskable icon, theme-color meta tag
- Registered inline in `client/index.html` on page load

## Theme

Dark professional fintech theme with green accent (HSL 152 60% 40%). PWA enabled.
