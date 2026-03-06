import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Activity,
  Truck,
  Droplets,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  RefreshCw,
  Flame,
  LogOut,
  BarChart3,
  Calendar,
  MapPin,
  Bell,
  Shield,
  Crown,
  Zap,
  Lock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useState, useEffect } from "react";
import type { Terminal, Forecast, MarketSignal, PriceHistoryEntry, SubscriptionTier } from "@shared/schema";
import { TIER_LIMITS } from "@shared/schema";

const signalConfig = [
  { key: "vesselActivity", label: "Vessel Activity", icon: Activity },
  { key: "truckQueue", label: "Truck Queue", icon: Truck },
  { key: "nnpcSupply", label: "NNPC Supply", icon: Droplets },
  { key: "fxPressure", label: "FX Pressure", icon: DollarSign },
  { key: "policyRisk", label: "Policy Risk", icon: AlertTriangle },
];

function getSignalColor(value: string): string {
  const v = value.toLowerCase();
  if (v === "none" || v === "low") return "text-emerald-400";
  if (v === "medium" || v === "moderate") return "text-amber-400";
  if (v === "high" || v === "weak") return "text-red-400";
  if (v === "strong") return "text-emerald-400";
  return "text-slate-500";
}

function getSignalDot(value: string): string {
  const v = value.toLowerCase();
  if (v === "none" || v === "low") return "bg-emerald-400";
  if (v === "medium" || v === "moderate") return "bg-amber-400";
  if (v === "high" || v === "weak") return "bg-red-400";
  if (v === "strong") return "bg-emerald-400";
  return "bg-slate-500";
}

function getBiasDisplay(bias: string) {
  const b = bias.toLowerCase();
  if (b === "bullish") return { icon: TrendingUp, label: "Bullish", sublabel: "Likely Increase", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", gaugeColor: "#34d399" };
  if (b === "bearish") return { icon: TrendingDown, label: "Bearish", sublabel: "Likely Decrease", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", gaugeColor: "#f87171" };
  return { icon: Minus, label: "Neutral", sublabel: "Sideways", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", gaugeColor: "#fbbf24" };
}

function ConfidenceGauge({ value, color }: { value: number; color: string }) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="relative w-36 h-36 mx-auto" data-testid="gauge-confidence">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono text-white" data-testid="text-confidence-value">{animatedValue}%</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Confidence</span>
      </div>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.04] ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4" data-testid="skeleton-card">
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2.5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

function ForecastSkeleton() {
  return (
    <div className="rounded-xl bg-emerald-500/[0.03] border border-emerald-500/[0.08] p-5 space-y-5" data-testid="skeleton-forecast">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-8 w-48" />
      <div className="flex justify-center py-2">
        <Skeleton className="h-36 w-36 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-52" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5" data-testid="skeleton-chart">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="flex items-end gap-1.5 h-64 px-4 pb-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

interface ForecastResponse {
  terminal: Terminal;
  forecast: Forecast;
}

interface SignalResponse {
  terminal: Terminal;
  signal: MarketSignal;
}

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>("");
  const fetchFn = authFetch(token);

  const { data: terminalList, isLoading: terminalsLoading } = useQuery<Terminal[]>({
    queryKey: ["/api/terminals"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  useEffect(() => {
    if (terminalList?.length && !selectedTerminalId) {
      setSelectedTerminalId(terminalList[0].id);
    }
  }, [terminalList, selectedTerminalId]);

  const { data: forecastData, isLoading: forecastLoading, refetch: refetchForecast, isFetching: forecastFetching } = useQuery<ForecastResponse>({
    queryKey: ["/api/forecast", selectedTerminalId],
    queryFn: fetchFn,
    enabled: !!selectedTerminalId && !!token,
  });

  const { data: signalData, isLoading: signalLoading, refetch: refetchSignals } = useQuery<SignalResponse>({
    queryKey: ["/api/signals", selectedTerminalId],
    queryFn: fetchFn,
    enabled: !!selectedTerminalId && !!token,
  });

  const { data: priceHistoryData, isLoading: historyLoading, refetch: refetchHistory } = useQuery<PriceHistoryEntry[]>({
    queryKey: ["/api/terminals", selectedTerminalId, "price-history"],
    queryFn: fetchFn,
    enabled: !!selectedTerminalId && !!token,
  });

  const refreshAll = () => {
    refetchForecast();
    refetchSignals();
    refetchHistory();
  };

  if (!user) {
    setLocation("/login");
    return null;
  }

  const chartData = (priceHistoryData || [])
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((entry) => ({
      date: new Date(entry.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
      price: entry.price,
    }));

  const forecast = forecastData?.forecast;
  const terminal = forecastData?.terminal;
  const signal = signalData?.signal;

  const currentDate = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const selectedTerminal = terminalList?.find((t) => t.id === selectedTerminalId);
  const isDataLoading = forecastLoading || signalLoading;
  const biasDisplay = forecast ? getBiasDisplay(forecast.bias) : null;

  return (
    <div className="min-h-screen bg-[#060b18]" data-testid="page-dashboard">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060b18]/80 backdrop-blur-xl" data-testid="dashboard-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white hidden sm:block">FuelIQ NG</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{currentDate}</span>
              </div>
              <button className="relative p-2 rounded-lg hover:bg-white/[0.04] transition-colors" data-testid="button-notifications">
                <Bell className="w-4 h-4 text-slate-400" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>
              {user.role === "admin" && (
                <button
                  onClick={() => setLocation("/admin")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors"
                  data-testid="button-admin-panel"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              )}
              {(() => {
                const tier = ((user as any).subscriptionTier || "free") as SubscriptionTier;
                const tierStyles: Record<SubscriptionTier, string> = {
                  free: "text-slate-400 bg-slate-500/10 border-slate-500/20",
                  pro: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                  enterprise: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                };
                const tierIcons: Record<SubscriptionTier, typeof Crown> = {
                  free: Zap,
                  pro: Crown,
                  enterprise: Crown,
                };
                const TierIcon = tierIcons[tier];
                return (
                  <button
                    onClick={() => setLocation("/subscription")}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${tierStyles[tier]}`}
                    data-testid="button-subscription-tier"
                  >
                    <TierIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{TIER_LIMITS[tier].label}</span>
                  </button>
                );
              })()}
              <div className="flex items-center gap-2 pl-2 border-l border-white/[0.06]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-bold text-white">
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <span className="text-sm font-medium text-slate-300 hidden sm:block" data-testid="text-username">{user.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-slate-400 hover:text-white hover:bg-white/[0.04]"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white" data-testid="text-dashboard-title">Market Dashboard</h1>
            <p className="text-sm text-slate-500">Real-time petroleum market intelligence</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedTerminalId} onValueChange={setSelectedTerminalId}>
              <SelectTrigger
                className="w-60 bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.05] focus:ring-emerald-500/30"
                data-testid="select-terminal"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  <SelectValue placeholder={terminalsLoading ? "Loading..." : "Select terminal"} />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-[#0c1220] border-white/[0.08]">
                {terminalList?.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-slate-300 focus:bg-white/[0.06] focus:text-white">
                    {t.name} ({t.state})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTerminal && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs font-mono text-emerald-400">
                {selectedTerminal.code}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshAll}
              className={`text-slate-400 hover:text-white hover:bg-white/[0.04] ${forecastFetching ? "animate-spin-slow" : ""}`}
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${forecastFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {isDataLoading ? (
          <div className="grid lg:grid-cols-3 gap-5" data-testid="loading-skeletons">
            <CardSkeleton />
            <CardSkeleton />
            <ForecastSkeleton />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4" data-testid="card-market-signals">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">Market Signals</h3>
                {signal && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Shield className="w-3 h-3" /> Live
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {signal ? signalConfig.map(({ key, label, icon: Icon }) => {
                  const value = (signal as any)[key] || "N/A";
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors" data-testid={`signal-${key}`}>
                      <div className="flex items-center gap-2.5 text-sm">
                        <Icon className="w-4 h-4 text-slate-600" />
                        <span className="text-slate-400 text-sm">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${getSignalDot(value)}`} />
                        <span className={`text-sm font-semibold ${getSignalColor(value)}`}>{value}</span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-sm text-slate-600 py-8 text-center">No signal data available</div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4" data-testid="card-terminal-info">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">Terminal Info</h3>
              {terminal ? (
                <div className="space-y-3">
                  <div className="py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Terminal</div>
                    <div className="text-lg font-semibold text-white" data-testid="text-terminal-name">{terminal.name}</div>
                  </div>
                  <div className="py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">State</div>
                    <div className="text-base font-medium text-slate-300" data-testid="text-terminal-state">{terminal.state}</div>
                  </div>
                  <div className="py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Status</div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        terminal.active
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                      data-testid="badge-terminal-status"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${terminal.active ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                      {terminal.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Market Bias</div>
                    {biasDisplay && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${biasDisplay.bg} ${biasDisplay.color} border ${biasDisplay.border}`}
                        data-testid="badge-market-bias"
                      >
                        <biasDisplay.icon className="w-3 h-3" />
                        {biasDisplay.label}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600 py-8 text-center">No terminal data</div>
              )}
            </div>

            <div className="rounded-xl bg-emerald-500/[0.03] border border-emerald-500/[0.08] p-5 space-y-5" data-testid="card-forecast-output">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs uppercase tracking-wider text-emerald-400">Forecast Output</h3>
                {forecast && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[10px] text-emerald-400 font-medium border border-emerald-500/20">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    Updated
                  </span>
                )}
              </div>
              {forecast ? (
                <div className="space-y-5">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Expected Range</div>
                    <div className="text-2xl font-bold font-mono bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent" data-testid="text-expected-range">
                      &#8358;{forecast.expectedMin?.toLocaleString()} &mdash; &#8358;{forecast.expectedMax?.toLocaleString()}
                    </div>
                  </div>

                  <ConfidenceGauge
                    value={forecast.confidence}
                    color={biasDisplay?.gaugeColor || "#34d399"}
                  />

                  <div className="flex items-center justify-center gap-3">
                    {biasDisplay && (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${biasDisplay.bg} border ${biasDisplay.border}`} data-testid="text-market-bias">
                        <biasDisplay.icon className={`w-4 h-4 ${biasDisplay.color}`} />
                        <div>
                          <div className={`text-sm font-semibold ${biasDisplay.color}`}>{biasDisplay.sublabel}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/[0.06] pt-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2.5">Suggested Action</div>
                    <div className="space-y-2">
                      {forecast.suggestedAction.split(". ").filter(Boolean).map((action, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm" data-testid={`text-action-${i}`}>
                          <div className="mt-0.5 w-4 h-4 rounded bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                            <ChevronRight className="w-3 h-3 text-emerald-500" />
                          </div>
                          <span className="text-slate-300 text-sm">{action.endsWith(".") ? action : `${action}.`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600 py-12 text-center">No forecast available</div>
              )}
            </div>
          </div>
        )}

        <Tabs defaultValue="price-trend" className="space-y-4" data-testid="tabs-charts">
          <TabsList className="bg-white/[0.03] border border-white/[0.06] p-1">
            <TabsTrigger
              value="price-trend"
              className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400"
              data-testid="tab-price-trend"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Price Trend
            </TabsTrigger>
            <TabsTrigger
              value="volume"
              className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400"
              data-testid="tab-volume"
            >
              <Activity className="w-4 h-4 mr-2" />
              Volume
            </TabsTrigger>
          </TabsList>

          <TabsContent value="price-trend">
            {historyLoading ? (
              <ChartSkeleton />
            ) : (
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5" data-testid="card-price-chart">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <h3 className="font-semibold text-white">Price Trend (Last 30 Days)</h3>
                  {selectedTerminal && (
                    <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs font-mono text-emerald-400">
                      {selectedTerminal.name}
                    </span>
                  )}
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.15)" fontSize={11} tickLine={false} axisLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0c1220",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "8px",
                          color: "#e2e8f0",
                          fontSize: "12px",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                        }}
                        formatter={(value: number) => [`₦${value}`, "Price"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#34d399"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                        dot={false}
                        activeDot={{ r: 4, fill: "#34d399", strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-slate-600 text-sm">
                    No price history data available
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="volume">
            {historyLoading ? (
              <ChartSkeleton />
            ) : (
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5" data-testid="card-volume-chart">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <h3 className="font-semibold text-white">Market Volume Indicators</h3>
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.15)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0c1220",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "8px",
                          color: "#e2e8f0",
                          fontSize: "12px",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                        }}
                        formatter={(value: number) => [`₦${value}`, "Price"]}
                      />
                      <Bar dataKey="price" fill="#34d399" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-slate-600 text-sm">
                    No volume data available
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
