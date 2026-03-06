import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Check,
  X,
  Crown,
  Zap,
  ArrowLeft,
  Flame,
  ChevronRight,
} from "lucide-react";
import { TIER_LIMITS, type SubscriptionTier } from "@shared/schema";

const tierOrder: SubscriptionTier[] = ["free", "pro", "enterprise"];

const tierColors: Record<SubscriptionTier, { badge: string; border: string; bg: string; glow: string }> = {
  free: {
    badge: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    border: "border-white/[0.06] hover:border-white/[0.10]",
    bg: "bg-white/[0.02]",
    glow: "",
  },
  pro: {
    badge: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    border: "border-blue-500/20 shadow-lg shadow-blue-500/[0.05]",
    bg: "bg-blue-500/[0.04]",
    glow: "shadow-lg shadow-blue-500/[0.08]",
  },
  enterprise: {
    badge: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    border: "border-purple-500/20",
    bg: "bg-purple-500/[0.04]",
    glow: "",
  },
};

const featureLabels: { key: string; label: string }[] = [
  { key: "maxTerminals", label: "Terminal access" },
  { key: "forecastsPerDay", label: "Forecasts per day" },
  { key: "dataDelay", label: "Data freshness" },
  { key: "aiProbability", label: "AI probability engine" },
  { key: "smsAlertsPerWeek", label: "SMS alerts" },
  { key: "whatsappDigest", label: "WhatsApp digest" },
  { key: "refineryUpdates", label: "Refinery updates" },
  { key: "regulationAlerts", label: "Regulation alerts" },
  { key: "earlySignals", label: "Early signal detection" },
  { key: "apiAccess", label: "API access" },
  { key: "forecastExport", label: "Forecast export (Excel)" },
  { key: "customSensitivity", label: "Custom forecast sensitivity" },
  { key: "dedicatedSupport", label: "Dedicated support" },
];

function formatFeatureValue(key: string, value: any): { text: string; available: boolean } {
  if (typeof value === "boolean") return { text: value ? "Yes" : "No", available: value };
  if (key === "maxTerminals") return value === Infinity ? { text: "Unlimited", available: true } : { text: `${value} terminal`, available: true };
  if (key === "forecastsPerDay") return value === Infinity ? { text: "Unlimited", available: true } : { text: `${value} per day`, available: true };
  if (key === "dataDelay") return value === 0 ? { text: "Real-time", available: true } : { text: `${value}h delayed`, available: false };
  if (key === "smsAlertsPerWeek") {
    if (value === 0) return { text: "None", available: false };
    if (value === Infinity) return { text: "Unlimited", available: true };
    return { text: `${value} per week`, available: true };
  }
  return { text: String(value), available: !!value };
}

export default function SubscriptionPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/login");
    return null;
  }

  const currentTier = ((user as any).subscriptionTier || "free") as SubscriptionTier;
  const fetchFn = authFetch(token);

  const { data: subData } = useQuery({
    queryKey: ["/api/subscription"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const usage = subData?.data?.usage;

  return (
    <div className="min-h-screen bg-[#060b18]" data-testid="page-subscription">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060b18]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation("/dashboard")}
                className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">Subscription</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6" data-testid="card-current-plan">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <p className="text-sm text-slate-500">Current Plan</p>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${tierColors[currentTier].badge}`}>
                  {currentTier === "free" ? <Zap className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />}
                  {TIER_LIMITS[currentTier].label}
                </span>
                <span className="text-2xl font-bold text-white">{TIER_LIMITS[currentTier].priceLabel}</span>
                <span className="text-sm text-slate-500">{TIER_LIMITS[currentTier].period}</span>
              </div>
            </div>
            {usage && (
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Forecasts Today</p>
                  <p className="text-lg font-semibold text-white" data-testid="text-forecasts-used">
                    {usage.forecastsUsedToday}
                    <span className="text-slate-500 text-sm">
                      /{TIER_LIMITS[currentTier].forecastsPerDay === Infinity ? "∞" : TIER_LIMITS[currentTier].forecastsPerDay}
                    </span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">SMS This Week</p>
                  <p className="text-lg font-semibold text-white" data-testid="text-sms-used">
                    {usage.smsAlertsUsedThisWeek}
                    <span className="text-slate-500 text-sm">
                      /{TIER_LIMITS[currentTier].smsAlertsPerWeek === Infinity ? "∞" : TIER_LIMITS[currentTier].smsAlertsPerWeek === 0 ? "0" : TIER_LIMITS[currentTier].smsAlertsPerWeek}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-6">Compare Plans</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {tierOrder.map((tier) => {
              const limits = TIER_LIMITS[tier];
              const isCurrent = tier === currentTier;
              const isUpgrade = tierOrder.indexOf(tier) > tierOrder.indexOf(currentTier);
              const colors = tierColors[tier];

              return (
                <div
                  key={tier}
                  className={`relative rounded-xl p-6 border transition-all ${colors.bg} ${colors.border} ${colors.glow} ${isCurrent ? "ring-1 ring-emerald-500/30" : ""}`}
                  data-testid={`card-tier-${tier}`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                        Current Plan
                      </span>
                    </div>
                  )}
                  {tier === "pro" && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-blue-500 text-white shadow-lg shadow-blue-500/30">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{limits.label}</h3>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-3xl font-bold text-white">{limits.priceLabel}</span>
                        <span className="text-sm text-slate-500">{limits.period}</span>
                      </div>
                    </div>

                    <ul className="space-y-2.5">
                      {featureLabels.map(({ key, label }) => {
                        const val = (limits as any)[key];
                        const { text, available } = formatFeatureValue(key, val);
                        return (
                          <li key={key} className="flex items-center gap-2.5 text-sm">
                            {available ? (
                              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-slate-600 flex-shrink-0" />
                            )}
                            <span className={available ? "text-slate-300" : "text-slate-600"}>
                              {label}: {text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {isCurrent ? (
                      <Button
                        className="w-full bg-white/[0.04] text-slate-400 border border-white/[0.08] cursor-default"
                        disabled
                        data-testid={`button-tier-${tier}`}
                      >
                        Current Plan
                      </Button>
                    ) : isUpgrade ? (
                      <Button
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 border-0"
                        data-testid={`button-tier-${tier}`}
                      >
                        <ChevronRight className="w-4 h-4 mr-1" />
                        Upgrade to {limits.label}
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08]"
                        data-testid={`button-tier-${tier}`}
                      >
                        Downgrade
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6" data-testid="card-tier-comparison">
          <h3 className="text-lg font-semibold text-white mb-4">Feature Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-2 text-slate-500 font-medium">Feature</th>
                  {tierOrder.map((tier) => (
                    <th key={tier} className="text-center py-3 px-2 text-slate-300 font-semibold">
                      {TIER_LIMITS[tier].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureLabels.map(({ key, label }) => (
                  <tr key={key} className="border-b border-white/[0.04]">
                    <td className="py-2.5 px-2 text-slate-400">{label}</td>
                    {tierOrder.map((tier) => {
                      const val = (TIER_LIMITS[tier] as any)[key];
                      const { text, available } = formatFeatureValue(key, val);
                      return (
                        <td key={tier} className="text-center py-2.5 px-2">
                          {typeof val === "boolean" ? (
                            available ? (
                              <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-slate-600 mx-auto" />
                            )
                          ) : (
                            <span className={available ? "text-slate-300" : "text-slate-600"}>
                              {text}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
