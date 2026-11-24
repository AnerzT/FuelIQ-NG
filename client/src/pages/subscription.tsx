import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import {
  Check,
  X,
  Crown,
  Zap,
  ArrowLeft,
  Flame,
  ChevronRight,
} from "lucide-react";
import { TIER_LIMITS, TIER_PRICES, type SubscriptionTier } from "@shared/schema";

const tierOrder: SubscriptionTier[] = ["free", "basic", "pro", "elite", "enterprise"];

interface PaymentOptions {
  stripeAvailable: boolean;
  bankTransferAvailable: boolean;
  bankTransfer: { bankName: string; accountNumber: string; accountName: string } | null;
}

interface PaymentRequest {
  id: string;
  subscriptionTier: string;
  amount: number;
  transactionReference: string;
  status: "pending_verification" | "approved" | "rejected";
  createdAt: string;
}

const tierColors: Record<SubscriptionTier, { badge: string; border: string; bg: string; glow: string }> = {
  free: {
    badge: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    border: "border-white/[0.06] hover:border-white/[0.10]",
    bg: "bg-white/[0.02]",
    glow: "",
  },
  basic: {
    badge: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    border: "border-sky-500/20 shadow-lg shadow-sky-500/[0.05]",
    bg: "bg-sky-500/[0.04]",
    glow: "shadow-lg shadow-sky-500/[0.08]",
  },
  pro: {
    badge: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    border: "border-blue-500/20 shadow-lg shadow-blue-500/[0.05]",
    bg: "bg-blue-500/[0.04]",
    glow: "shadow-lg shadow-blue-500/[0.08]",
  },
  elite: {
    badge: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    border: "border-purple-500/20 shadow-lg shadow-purple-500/[0.05]",
    bg: "bg-purple-500/[0.04]",
    glow: "shadow-lg shadow-purple-500/[0.08]",
  },
  enterprise: {
    badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    border: "border-amber-500/20 shadow-lg shadow-amber-500/[0.05]",
    bg: "bg-amber-500/[0.04]",
    glow: "shadow-lg shadow-amber-500/[0.08]",
  },
};

const featureLabels: { key: string; label: string }[] = [
  { key: "maxTerminals", label: "Terminal access" },
  { key: "maxProducts", label: "Product types" },
  { key: "forecastsPerDay", label: "Forecasts per day" },
  { key: "dataDelay", label: "Data freshness" },
  { key: "aiProbability", label: "AI probability engine" },
  { key: "depotSpread", label: "Depot spread view" },
  { key: "inventoryAccess", label: "Inventory management" },
  { key: "hedgeLab", label: "Hedge strategy lab" },
  { key: "traderSignals", label: "Trader chat intel" },
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
  if (key === "maxTerminals") return value === Infinity ? { text: "Unlimited", available: true } : { text: `${value} terminal${value > 1 ? "s" : ""}`, available: true };
  if (key === "maxProducts") return value === Infinity ? { text: "All (PMS, AGO, JET, ATK, LPG)", available: true } : { text: `${value} product (PMS only)`, available: true };
  if (key === "forecastsPerDay") return value === Infinity ? { text: "Unlimited", available: true } : { text: `${value} per day`, available: true };
  if (key === "dataDelay") return value === 0 ? { text: "Real-time", available: true } : value <= 6 ? { text: `${value}h delay`, available: true } : { text: `${value}h delayed`, available: false };
  if (key === "smsAlertsPerWeek") {
    if (value === 0) return { text: "None", available: false };
    if (value === Infinity) return { text: "Unlimited", available: true };
    return { text: `${value} per week`, available: true };
  }
  return { text: String(value), available: !!value };
}

export default function SubscriptionPage() {
  const { user, token, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [transactionReference, setTransactionReference] = useState("");
  const fetchFn = authFetch(token);

  const { data: subData } = useQuery({
    queryKey: ["/api/subscription"],
    queryFn: fetchFn,
    enabled: !!token,
  });
  const { data: paymentOptions, isLoading: paymentOptionsLoading } = useQuery<PaymentOptions>({
    queryKey: ["/api/subscription/payment-options"],
    queryFn: fetchFn,
    enabled: !!token,
  });
  const { data: paymentRequests } = useQuery<PaymentRequest[]>({
    queryKey: ["/api/subscription/payment-requests"],
    queryFn: fetchFn,
    enabled: !!token && Boolean(paymentOptions?.bankTransferAvailable),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout_success") === "1") {
      toast({ title: "Payment received", description: "Your plan will update after payment verification." });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      void refreshUser();
      params.delete("checkout_success");
      params.delete("tier");
      const remainingParams = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${remainingParams ? `?${remainingParams}` : ""}`);
    } else if (params.get("checkout_cancel") === "1") {
      toast({ title: "Checkout cancelled" });
      params.delete("checkout_cancel");
      const remainingParams = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${remainingParams ? `?${remainingParams}` : ""}`);
    }
  }, [refreshUser, toast]);

  const bankTransferMutation = useMutation({
    mutationFn: async ({ tier, reference }: { tier: SubscriptionTier; reference: string }) => {
      const response = await fetch("/api/subscription/payment-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ subscriptionTier: tier, transactionReference: reference }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to submit payment");
      return result;
    },
    onSuccess: async () => {
      setSelectedTier(null);
      setTransactionReference("");
      await queryClient.invalidateQueries({ queryKey: ["/api/subscription/payment-requests"] });
      toast({
        title: "Payment submitted",
        description: "Your subscription will activate after an admin verifies the bank transfer.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Payment submission failed", description: error.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (tier: SubscriptionTier) => {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ subscriptionTier: tier }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create checkout session");
      }
      const json = await res.json();
      return json.url as string;
    },
    onSuccess: (url: string) => {
      window.location.href = url;
    },
    onError: (err: Error) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async (tier: SubscriptionTier) => {
      const res = await fetch("/api/subscription", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ subscriptionTier: tier }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update subscription");
      }
      const json = await res.json();
      return json.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      await refreshUser();
      toast({ title: "Subscription updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Subscription update failed", description: err.message, variant: "destructive" });
    },
  });

  const currentTier = ((user as any)?.subscriptionTier || "free") as SubscriptionTier;

  useEffect(() => {
    const latestApproved = paymentRequests?.find(request => request.status === "approved");
    if (latestApproved && user && latestApproved.subscriptionTier !== user.subscriptionTier) {
      void refreshUser();
    }
  }, [paymentRequests, refreshUser, user]);

  if (!user) {
    setLocation("/login");
    return null;
  }

  const currentPrice = TIER_PRICES[currentTier];

  const handleSubscriptionAction = (tier: SubscriptionTier) => {
    const currentIndex = tierOrder.indexOf(currentTier);
    const targetIndex = tierOrder.indexOf(tier);

    if (tier === "free" || targetIndex < currentIndex) {
      setSelectedTier(null);
      updateSubscriptionMutation.mutate(tier);
      return;
    }

    if (tier === "enterprise") {
      toast({ title: "Enterprise pricing is custom", description: "Contact FuelIQ to arrange an Enterprise subscription." });
      return;
    }
    if (paymentOptions?.stripeAvailable) {
      checkoutMutation.mutate(tier);
      return;
    }
    if (paymentOptions?.bankTransferAvailable) {
      setSelectedTier(tier);
      return;
    }
    toast({
      title: "Payment unavailable",
      description: paymentOptionsLoading ? "Payment options are still loading." : "No verified payment method is configured.",
      variant: "destructive",
    });
  };

  const usage = subData?.usage;

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
                <span className="text-2xl font-bold text-white">{currentPrice.priceLabel}</span>
                <span className="text-sm text-slate-500">{currentPrice.period}</span>
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
                        <span className="text-3xl font-bold text-white">{TIER_PRICES[tier].priceLabel}</span>
                        <span className="text-sm text-slate-500">{TIER_PRICES[tier].period}</span>
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
                    ) : (
                      <Button
                        className={`w-full ${isUpgrade ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 border-0" : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08]"}`}
                        onClick={() => handleSubscriptionAction(tier)}
                        disabled={
                          tier === "enterprise" ||
                          updateSubscriptionMutation.isPending ||
                          checkoutMutation.isPending ||
                          bankTransferMutation.isPending ||
                          (isUpgrade && (
                            paymentOptionsLoading ||
                            (!paymentOptions?.stripeAvailable && !paymentOptions?.bankTransferAvailable)
                          ))
                        }
                        data-testid={`button-tier-${tier}`}
                      >
                        <ChevronRight className="w-4 h-4 mr-1" />
                        {tier === "enterprise"
                          ? "Custom pricing"
                          : isUpgrade && paymentOptions?.stripeAvailable
                            ? `Continue to ${limits.label} checkout`
                            : isUpgrade && paymentOptions?.bankTransferAvailable
                              ? `Pay for ${limits.label} by transfer`
                              : isUpgrade
                                ? `Payment unavailable`
                                : `Switch to ${limits.label}`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedTier && paymentOptions?.bankTransfer && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 space-y-5" data-testid="card-bank-transfer">
            <div>
              <h3 className="text-lg font-semibold text-white">Bank transfer for {TIER_LIMITS[selectedTier].label}</h3>
              <p className="mt-1 text-sm text-slate-400">
                Transfer {TIER_PRICES[selectedTier].priceLabel} to the account below. Your plan activates only after the payment is verified.
              </p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-3 text-sm">
              <div><dt className="text-slate-500">Bank</dt><dd className="mt-1 font-medium text-white">{paymentOptions.bankTransfer.bankName}</dd></div>
              <div><dt className="text-slate-500">Account name</dt><dd className="mt-1 font-medium text-white">{paymentOptions.bankTransfer.accountName}</dd></div>
              <div><dt className="text-slate-500">Account number</dt><dd className="mt-1 font-medium text-white">{paymentOptions.bankTransfer.accountNumber}</dd></div>
            </dl>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                bankTransferMutation.mutate({ tier: selectedTier, reference: transactionReference.trim() });
              }}
            >
              <label htmlFor="transfer-reference" className="block text-sm font-medium text-slate-300">
                Bank transaction reference
              </label>
              <Input
                id="transfer-reference"
                value={transactionReference}
                onChange={(event) => setTransactionReference(event.target.value)}
                placeholder="Enter the reference shown on your transfer receipt"
                minLength={4}
                maxLength={100}
                required
                className="bg-white/[0.03] border-white/[0.08] text-white"
                data-testid="input-transfer-reference"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={bankTransferMutation.isPending || transactionReference.trim().length < 4}>
                  {bankTransferMutation.isPending ? "Submitting…" : "Submit for verification"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelectedTier(null)}>
                  Cancel
                </Button>
              </div>
            </form>
            <p className="text-xs text-slate-500">
              Transfers are checked manually. Do not submit a request until you have completed the transfer.
            </p>
          </div>
        )}

        {paymentRequests?.length ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-3" data-testid="card-payment-status">
            <h3 className="text-lg font-semibold text-white">Payment request status</h3>
            {paymentRequests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-300">
                  {TIER_LIMITS[request.subscriptionTier as SubscriptionTier]?.label || request.subscriptionTier} · Ref {request.transactionReference}
                </span>
                <span className={
                  request.status === "approved" ? "text-emerald-400" :
                    request.status === "rejected" ? "text-red-400" : "text-amber-400"
                }>
                  {request.status === "pending_verification" ? "Pending verification" :
                    request.status === "approved" ? "Approved" : "Rejected"}
                </span>
              </div>
            ))}
          </div>
        ) : null}

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
