import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { storage } from "../storage.js";
import { getMarketBenchmarks } from "../services/market-intelligence.service.js";
import { ensureString } from "../utils/params.js";

const nigeriaSnapshot = {
  source: "U.S. Energy Information Administration (EIA)",
  updatedAt: "2025-11-18",
  sourceUrl: "https://www.eia.gov/international/analysis/country/NGA",
  indicators: [
    { label: "Crude oil and condensate production", value: 1.5, unit: "million b/d", period: "2024" },
    { label: "Proved crude oil reserves", value: 37.5, unit: "billion barrels", period: "2024" },
    { label: "Proved natural gas reserves", value: 211.1, unit: "Tcf", period: "2024" },
    { label: "Natural gas flared", value: 229, unit: "Bcf", period: "2024" },
  ],
};

const industrySources = [
  {
    name: "NNPC Newsroom",
    description: "Company statements, operational notices, and sector announcements.",
    url: "https://www.nnpcgroup.com/insights",
  },
  {
    name: "OPEC Monthly Oil Market Report",
    description: "Global supply, demand, production, and market commentary.",
    url: "https://www.opec.org/monthly-oil-market-report.html",
  },
  {
    name: "NUPRC",
    description: "Upstream regulation, licensing, and Nigerian industry publications.",
    url: "https://www.nuprc.gov.ng/",
  },
  {
    name: "EIA Nigeria Analysis",
    description: "Country-level production, reserves, exports, refining, and gas analysis.",
    url: nigeriaSnapshot.sourceUrl,
  },
];

export async function getMarketIntelligence(req: AuthRequest, res: Response) {
  try {
    const userId = ensureString(req.userId);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let snapshot: Awaited<ReturnType<typeof getMarketBenchmarks>>;
    try {
      snapshot = await getMarketBenchmarks();
    } catch (error) {
      snapshot = {
        fetchedAt: new Date().toISOString(),
        stale: true,
        warning: error instanceof Error ? error.message : "The benchmark feed is temporarily unavailable",
        benchmarks: [],
      };
    }
    const hasPremiumAccess = user.subscriptionTier !== "free";
    return res.json({
      success: true,
      data: {
        ...snapshot,
        hasPremiumAccess,
        benchmarks: snapshot.benchmarks.map(({ history, ...benchmark }) => ({
          ...benchmark,
          history: hasPremiumAccess ? history.slice(-60) : undefined,
        })),
        nigeria: nigeriaSnapshot,
        industrySources,
        bonnyLight: {
          available: false,
          message: "No verified public Bonny Light price series is configured. A licensed or authorized feed is required.",
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market intelligence feed is unavailable";
    return res.status(503).json({ success: false, message });
  }
}
