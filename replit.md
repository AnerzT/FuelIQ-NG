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
    -   **Drizzle ORM:** Manages `users`, `terminals`, `market_signals`, `forecasts`, `price_history`.
    -   **Prisma ORM:** Manages `prisma_users`, `prisma_terminals`, `prisma_market_signals`, `prisma_forecasts`, `prisma_price_history`. Both ORMs are initialized and seeded on startup.

**Core Features & Functionality:**
-   **User Management:** Includes user registration, login, profile management, and role-based access control (admin/marketer).
-   **Subscription Tiers:** Implements a tiered subscription model (Free, Pro, Enterprise) with enforced limits on terminals, forecasts, data delay, and notification services via backend middleware.
-   **Market Signals:** Captures and processes various market signals (vessel activity, truck queue, NNPC supply, FX pressure, policy risk).
-   **Forecast Engine:**
    -   **Rules-Based Engine:** A legacy heuristic engine for backward compatibility, identifying bullish/bearish patterns.
    -   **AI Scoring Engine:** The primary forecasting engine, using 9 normalized inputs (market signals, price trends, volatility, NNPC price changes) with adaptive weights to produce softmax probabilities for price increase, decrease, or stability. It also calculates confidence levels and suggested actions.
-   **Price History:** Tracks and displays historical petroleum product prices for different terminals.
-   **Notifications:** Supports SMS and WhatsApp notifications for forecast alerts, price spikes, refinery updates, and morning digests, configurable by the user based on their subscription tier.
-   **Admin Panel:** Provides administrative functionalities for managing users, subscriptions, terminals, and triggering data synchronization.

## External Dependencies

-   **NNPC Price Feed:** Integrates with or simulates an NNPC API for petroleum product price data.
-   **Vessel Tracking:** Utilizes MarineTraffic API (or a simulated alternative) for vessel activity data per terminal.
-   **FX Rate Service:** Connects to exchangerate.host API (or a simulated alternative) for USD/NGN exchange rate information.
-   **SMS Notifications:** Integrates with Twilio or Termii for sending SMS alerts.
-   **WhatsApp Notifications:** Uses Meta Cloud API for WhatsApp messaging.