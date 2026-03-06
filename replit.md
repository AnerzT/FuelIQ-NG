# FuelIQ NG

## Overview

FuelIQ NG is a comprehensive Petroleum Market Forecast Platform designed for Nigerian marketers. Its primary purpose is to provide data-driven insights and predictive analytics for petroleum product prices and market conditions. The platform aims to empower marketers with crucial information for strategic decision-making, optimizing procurement, and managing inventory. Key capabilities include real-time market signal monitoring, AI-powered price forecasting, and customizable notification alerts. The business vision is to become the leading intelligence platform in the Nigerian petroleum sector, offering a competitive edge to its users and contributing to a more efficient market.

## User Preferences

I prefer a clear and concise communication style. I appreciate direct answers and actionable insights. When it comes to code, I value clean, maintainable, and well-documented solutions. For workflow, I prefer an iterative approach with frequent updates and opportunities for feedback. Please ensure that any significant architectural changes or core feature implementations are discussed with me before proceeding.

## System Architecture

The FuelIQ NG platform is built with a modern, full-stack architecture.

**Frontend:**
-   **Frameworks:** React, TypeScript
-   **Styling:** TailwindCSS, Shadcn UI for component library
-   **Charting:** Recharts for data visualization
-   **Routing:** Wouter for client-side navigation
-   **State Management:** TanStack React Query for data fetching and caching
-   **UI/UX:** A dark, professional fintech theme with a green accent (HSL 152 60% 40%) is used to provide a consistent and modern user experience. The application is also implemented as a Progressive Web App (PWA) with offline capabilities, custom manifest, and service worker for enhanced accessibility and performance on mobile devices.

**Backend:**
-   **Framework:** Express.js for RESTful API development
-   **Authentication:** JWT (JSON Web Tokens) for secure user authentication
-   **Database Interaction:** Dual ORM setup using Drizzle ORM and Prisma ORM for different data models and flexibility.
-   **Architecture Pattern:** Employs a Controller/Middleware/Services pattern for clear separation of concerns, modularity, and maintainability.
-   **Production Hardening:** Includes middleware for gzip compression, configurable CORS, Helmet for security headers, and rate limiting for API and authentication routes. Centralized error handling is implemented.

**Database:**
-   **Type:** PostgreSQL
-   **ORMs:** Drizzle ORM and Prisma ORM are both utilized for different sets of tables.
    -   **Drizzle ORM:** Manages `users`, `terminals`, `market_signals`, `forecasts`, `price_history`, `depots`, `depot_prices`, `inventory`, `transactions`, `trader_signals`, `hedge_recommendations`, `refinery_updates`, `regulation_updates`, `external_price_feeds`, `fx_rates`, `notification_logs`.
    -   **Prisma ORM:** Manages `prisma_users`, `prisma_terminals`, `prisma_market_signals`, `prisma_forecasts`, `prisma_price_history`. Both ORMs are initialized and seeded on startup.

**Core Features & Functionality:**
-   **User Management:** Includes user registration, login, profile management, and role-based access control (admin/marketer).
-   **Subscription Tiers:** Implements a tiered subscription model (Free, Pro ₦15,000/mo, Elite ₦90,000/mo) with enforced limits on terminals, products, forecasts, data delay, depot spread, inventory, hedge lab, trader signals, and notification services via backend middleware. Pro includes all products, depot comparison, inventory, basic hedge, 10 SMS/week. Elite adds AI chat intelligence, unlimited terminals, advanced hedge lab, API access, WhatsApp alerts, priority signals, exportable analytics.
-   **Multi-Product Support:** Supports 5 petroleum product types: PMS, AGO, JET_A1, ATK, LPG — each with product-specific forecast drivers, base prices, and weight profiles.
-   **Market Signals:** Captures and processes various market signals (vessel activity, truck queue, NNPC supply, FX pressure, policy risk) per product type.
-   **Forecast Engine:**
    -   **Rules-Based Engine:** Product-aware heuristic engine with product-specific weights/base prices.
    -   **AI Scoring Engine (Logistic Probability Model):** 8-feature vector (fxVolatility, vesselCount, refineryOutputIndex, depotSpread, regulationImpact, demandIndex, historicalVolatility, traderSentimentScore) with sigmoid function, product-specific adaptive weights, softmax probabilities, riskFactor computation, expected range from stdDev × riskFactor, and enriched output (depotPrice, refineryInfluenceScore, importParityPrice, demandIndex).
-   **Depot Price Comparison:** Matrix view of depot prices across terminals and products with lowest price highlight, spread calculation, and arbitrage % opportunity.
-   **Inventory Management:** Track tank stock per terminal/product, unrealized P&L, BUY/SELL transactions with weighted-average cost recalculation, restock alerts.
-   **Trader Chat Intelligence:** Free-text market intel from traders with automatic keyword extraction, sentiment scoring, terminal/product detection.
-   **Hedge Strategy Lab (3 Advanced Engines):**
    -   **Inventory Risk Engine:** Computes risk exposure = volume × dropProbability × priceDelta, with 4-level risk classification (low/medium/high/critical).
    -   **Staggered Buy Optimizer:** Calculates optimal split ratio from volatilityIndex/liquidityScore, generates 2-4 purchase tranches with timing recommendations.
    -   **Arbitrage Engine:** Identifies cross-depot arbitrage opportunities where spread > transport cost, showing net profit per litre and profit margin %.
    -   **API:** `GET /api/hedge/analysis?productType=` returns all three engine outputs + overall strategy. `POST /api/hedge/generate` creates AI recommendations.
-   **Price History:** Tracks and displays historical petroleum product prices for different terminals by product type.
-   **Notifications:** Supports SMS and WhatsApp notifications for forecast alerts, price spikes, refinery updates, and morning digests, configurable by the user based on their subscription tier.
-   **Refinery Intel:** Dedicated endpoint (`GET /api/refinery/updates`, `GET /api/refinery/status`) with seeded data for 4 Nigerian refineries (Dangote, Port Harcourt, Warri, Kaduna) showing operational status, production capacity, and output estimates.
-   **Regulation Updates:** Dedicated tab with `GET /api/regulations` and `GET /api/regulations/high-impact` endpoints. High-impact regulations highlighted with severity badges. Seeded with 5 realistic Nigerian regulation entries.
-   **Settings:** Dashboard tab for profile display (name, email, role, subscription tier) and notification preferences (SMS/WhatsApp toggles, phone numbers). Maps to `PATCH /api/notifications/preferences` with correct schema `{ phone, whatsappPhone, notificationPrefs: { smsEnabled, whatsappEnabled } }`.
-   **FX History:** `GET /api/fx/history` with pagination (limit, page) for historical USD/NGN rates.
-   **Forecast History:** `GET /api/forecasts/history` with filters (terminalId, productType, limit, page) for historical forecasts.
-   **Auth Token Refresh:** `POST /api/auth/refresh` — issues new JWT with extended expiry when called with valid Bearer token.
-   **Admin Panel:** Provides administrative functionalities for managing users, subscriptions, terminals, depots, and triggering data synchronization.
-   **Advanced Dashboard:** 9-tab layout: Overview (with refinery status indicator, regulation impact, trader sentiment bar), Products, Depot Spread, Inventory, Hedge Lab, Trader Signals, Refinery Intel, Regulations, Settings.

## External Dependencies

-   **NNPC Price Feed:** Integrates with or simulates an NNPC API for petroleum product price data.
-   **Vessel Tracking:** Utilizes MarineTraffic API (or a simulated alternative) for vessel activity data per terminal.
-   **FX Rate Service:** Connects to exchangerate.host API (or a simulated alternative) for USD/NGN exchange rate information.
-   **SMS Notifications:** Integrates with Twilio or Termii for sending SMS alerts.
-   **WhatsApp Notifications:** Uses Meta Cloud API for WhatsApp messaging.