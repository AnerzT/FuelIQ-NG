import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Package,
  Warehouse,
  LineChart,
  MessageSquare,
  Factory,
  Fuel,
  ArrowUpDown,
  Plus,
  Send,
  Target,
  ShieldCheck,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ScrollText,
  Settings,
  User,
  Phone,
  Mail,
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
import type {
  Terminal, Forecast, MarketSignal, PriceHistoryEntry, SubscriptionTier,
  Depot, DepotPrice, Inventory, Transaction, TraderSignal, HedgeRecommendation,
  RefineryUpdate, RegulationUpdate,
} from "@shared/schema";
import { TIER_LIMITS, PRODUCT_TYPES } from "@shared/schema";

const signalConfig = [
  { key: "vesselActivity", label: "Vessel Activity", icon: Activity },
  { key: "truckQueue", label: "Truck Queue", icon: Truck },
  { key: "nnpcSupply", label: "NNPC Supply", icon: Droplets },
  { key: "fxPressure", label: "FX Pressure", icon: DollarSign },
  { key: "policyRisk", label: "Policy Risk", icon: AlertTriangle },
];

const PRODUCT_LABELS: Record<string, string> = {
  PMS: "PMS (Petrol)",
  AGO: "AGO (Diesel)",
  JET_A1: "JET A1",
  ATK: "ATK",
  LPG: "LPG (Gas)",
};

const PRODUCT_COLORS: Record<string, string> = {
  PMS: "#34d399",
  AGO: "#60a5fa",
  JET_A1: "#f472b6",
  ATK: "#a78bfa",
  LPG: "#fbbf24",
};

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
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5" data-testid="skeleton-chart">
      <Skeleton className="h-5 w-44 mb-6" />
      <div className="flex items-end gap-1.5 h-64 px-4 pb-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${30 + Math.random() * 60}%` }} />
        ))}
      </div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "#0c1220",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontSize: "12px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
};

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
  const [selectedProduct, setSelectedProduct] = useState<string>("PMS");
  const [activeTab, setActiveTab] = useState("overview");
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

  const { data: depotPricesData } = useQuery<any>({
    queryKey: ["/api/depot-prices"],
    queryFn: fetchFn,
    enabled: !!token && (activeTab === "depot-spread" || activeTab === "overview"),
  });

  const { data: inventoryData, refetch: refetchInventory } = useQuery<any>({
    queryKey: ["/api/inventory"],
    queryFn: fetchFn,
    enabled: !!token && activeTab === "inventory",
  });

  const { data: traderSignalsData, refetch: refetchTraderSignals } = useQuery<any>({
    queryKey: ["/api/trader-signals"],
    queryFn: fetchFn,
    enabled: !!token && (activeTab === "trader-signals" || activeTab === "overview"),
  });

  const { data: hedgeData } = useQuery<any>({
    queryKey: [`/api/hedge?productType=${selectedProduct}`],
    queryFn: fetchFn,
    enabled: !!token && activeTab === "hedge-lab",
  });

  const { data: refineryUpdatesData } = useQuery<any>({
    queryKey: ["/api/refinery/updates"],
    queryFn: fetchFn,
    enabled: !!token && (activeTab === "refinery-intel" || activeTab === "overview"),
  });

  const { data: regulationData } = useQuery<any>({
    queryKey: ["/api/regulations"],
    queryFn: fetchFn,
    enabled: !!token && (activeTab === "regulation-updates" || activeTab === "overview"),
  });

  const { data: refineryStatusData } = useQuery<any>({
    queryKey: ["/api/refinery/status"],
    queryFn: fetchFn,
    enabled: !!token && activeTab === "overview",
  });

  const { data: notifPrefsData, refetch: refetchNotifPrefs } = useQuery<any>({
    queryKey: ["/api/notifications/preferences"],
    queryFn: fetchFn,
    enabled: !!token && activeTab === "settings",
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
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((entry: any) => ({
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
  const userTier = ((user as any).subscriptionTier || "free") as SubscriptionTier;
  const tierConfig = TIER_LIMITS[userTier];

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
                const tierStyles: Record<SubscriptionTier, string> = {
                  free: "text-slate-400 bg-slate-500/10 border-slate-500/20",
                  pro: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                  elite: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                };
                const tierIcons: Record<SubscriptionTier, typeof Crown> = {
                  free: Zap,
                  pro: Crown,
                  elite: Crown,
                };
                const TierIcon = tierIcons[userTier];
                return (
                  <button
                    onClick={() => setLocation("/subscription")}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${tierStyles[userTier]}`}
                    data-testid="button-subscription-tier"
                  >
                    <TierIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tierConfig.label}</span>
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4" data-testid="tabs-dashboard">
          <TabsList className="bg-white/[0.03] border border-white/[0.06] p-1 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400 text-xs" data-testid="tab-overview">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />Overview
            </TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400 text-xs" data-testid="tab-products">
              <Fuel className="w-3.5 h-3.5 mr-1.5" />Products
            </TabsTrigger>
            <TabsTrigger value="depot-spread" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400 text-xs" data-testid="tab-depot-spread">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />Depot Spread
            </TabsTrigger>
            <TabsTrigger value="inventory" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400 text-xs" data-testid="tab-inventory">
              <Package className="w-3.5 h-3.5 mr-1.5" />Inventory
            </TabsTrigger>
            <TabsTrigger value="hedge-lab" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400 text-xs" data-testid="tab-hedge-lab">
              <Target className="w-3.5 h-3.5 mr-1.5" />Hedge Lab
            </TabsTrigger>
            <TabsTrigger value="trader-signals" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400 text-xs" data-testid="tab-trader-signals">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />Trader Signals
            </TabsTrigger>
            <TabsTrigger value="refinery-intel" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400 text-xs" data-testid="tab-refinery-intel">
              <Factory className="w-3.5 h-3.5 mr-1.5" />Refinery Intel
            </TabsTrigger>
            <TabsTrigger value="regulation-updates" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400 text-xs" data-testid="tab-regulation-updates">
              <ScrollText className="w-3.5 h-3.5 mr-1.5" />Regulations
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-slate-400 text-xs" data-testid="tab-settings">
              <Settings className="w-3.5 h-3.5 mr-1.5" />Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              isDataLoading={isDataLoading}
              signal={signal}
              terminal={terminal}
              forecast={forecast}
              biasDisplay={biasDisplay}
              historyLoading={historyLoading}
              chartData={chartData}
              selectedTerminal={selectedTerminal}
              refineryStatusData={refineryStatusData}
              regulationData={regulationData}
              refineryUpdatesData={refineryUpdatesData}
              traderSignalsData={traderSignalsData}
              token={token}
              fetchFn={fetchFn}
            />
          </TabsContent>

          <TabsContent value="products">
            <ProductsTab token={token} fetchFn={fetchFn} selectedTerminalId={selectedTerminalId} terminalList={terminalList || []} />
          </TabsContent>

          <TabsContent value="depot-spread">
            {tierConfig.depotSpread ? (
              <DepotSpreadTab data={depotPricesData} />
            ) : (
              <LockedFeature feature="Depot Spread" tier="pro" />
            )}
          </TabsContent>

          <TabsContent value="inventory">
            {tierConfig.inventoryAccess ? (
              <InventoryTab token={token} fetchFn={fetchFn} data={inventoryData} refetch={refetchInventory} terminalList={terminalList || []} />
            ) : (
              <LockedFeature feature="Inventory Management" tier="pro" />
            )}
          </TabsContent>

          <TabsContent value="hedge-lab">
            {tierConfig.hedgeLab ? (
              <HedgeLabTab token={token} fetchFn={fetchFn} data={hedgeData} selectedProduct={selectedProduct} setSelectedProduct={setSelectedProduct} />
            ) : (
              <LockedFeature feature="Hedge Lab" tier="pro" />
            )}
          </TabsContent>

          <TabsContent value="trader-signals">
            {tierConfig.traderSignals ? (
              <TraderSignalsTab token={token} fetchFn={fetchFn} data={traderSignalsData} refetch={refetchTraderSignals} />
            ) : (
              <LockedFeature feature="Trader Signals" tier="elite" />
            )}
          </TabsContent>

          <TabsContent value="refinery-intel">
            {tierConfig.refineryUpdates ? (
              <RefineryIntelTab token={token} fetchFn={fetchFn} data={refineryUpdatesData} />
            ) : (
              <LockedFeature feature="Refinery Intel" tier="pro" />
            )}
          </TabsContent>

          <TabsContent value="regulation-updates">
            {tierConfig.regulationAlerts ? (
              <RegulationUpdatesTab token={token} fetchFn={fetchFn} data={regulationData} />
            ) : (
              <LockedFeature feature="Regulation Updates" tier="pro" />
            )}
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab user={user} token={token} fetchFn={fetchFn} notifPrefs={notifPrefsData} refetchNotifPrefs={refetchNotifPrefs} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function LockedFeature({ feature, tier }: { feature: string; tier: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-12 text-center" data-testid="locked-feature">
      <Lock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">{feature} — Locked</h3>
      <p className="text-sm text-slate-500 mb-6">Upgrade to {tier.toUpperCase()} or higher to unlock this feature.</p>
      <Button
        onClick={() => setLocation("/subscription")}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
        data-testid="button-upgrade"
      >
        <Crown className="w-4 h-4 mr-2" />
        View Plans
      </Button>
    </div>
  );
}

function OverviewTab({ isDataLoading, signal, terminal, forecast, biasDisplay, historyLoading, chartData, selectedTerminal, refineryStatusData, regulationData, refineryUpdatesData, traderSignalsData, token, fetchFn }: any) {
  if (isDataLoading) {
    return (
      <div className="space-y-5">
        <div className="grid lg:grid-cols-3 gap-5" data-testid="loading-skeletons">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
                    terminal.active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
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
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${biasDisplay.bg} ${biasDisplay.color} border ${biasDisplay.border}`} data-testid="badge-market-bias">
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
              <ConfidenceGauge value={forecast.confidence} color={biasDisplay?.gaugeColor || "#34d399"} />
              <div className="flex items-center justify-center gap-3">
                {biasDisplay && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${biasDisplay.bg} border ${biasDisplay.border}`} data-testid="text-market-bias">
                    <biasDisplay.icon className={`w-4 h-4 ${biasDisplay.color}`} />
                    <div className={`text-sm font-semibold ${biasDisplay.color}`}>{biasDisplay.sublabel}</div>
                  </div>
                )}
              </div>
              <div className="border-t border-white/[0.06] pt-4">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2.5">Suggested Action</div>
                <div className="space-y-2">
                  {forecast.suggestedAction.split(". ").filter(Boolean).map((action: string, i: number) => (
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

      {historyLoading ? <ChartSkeleton /> : (
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
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`₦${value}`, "Price"]} />
                <Area type="monotone" dataKey="price" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" dot={false} activeDot={{ r: 4, fill: "#34d399", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-600 text-sm">No price history data available</div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-3" data-testid="card-refinery-status">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Factory className="w-3.5 h-3.5" /> Refinery Status
          </h3>
          {(() => {
            const statuses = Array.isArray(refineryStatusData) ? refineryStatusData : (refineryStatusData?.data || []);
            if (statuses.length > 0) {
              return statuses.slice(0, 4).map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]" data-testid={`status-refinery-${i}`}>
                  <span className="text-sm text-slate-300 truncate mr-2">{r.refineryName}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                    r.operationalStatus === "operational" ? "text-emerald-400 bg-emerald-500/10" :
                    r.operationalStatus === "maintenance" ? "text-amber-400 bg-amber-500/10" :
                    "text-red-400 bg-red-500/10"
                  }`}>{r.operationalStatus}</span>
                </div>
              ));
            }
            return <div className="text-sm text-slate-600 py-4 text-center">No refinery data</div>;
          })()}
        </div>

        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-3" data-testid="card-regulation-impact">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <ScrollText className="w-3.5 h-3.5" /> Latest Regulation Impact
          </h3>
          {(() => {
            const regs = Array.isArray(regulationData) ? regulationData : (regulationData?.data || []);
            const highImpact = regs.filter((r: any) => r.impactLevel === "high");
            const toShow = highImpact.length > 0 ? highImpact.slice(0, 3) : regs.slice(0, 3);
            if (toShow.length > 0) {
              return toShow.map((reg: any, i: number) => (
                <div key={i} className="py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-1" data-testid={`overview-reg-${i}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white truncate mr-2">{reg.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      reg.impactLevel === "high" ? "text-red-400 bg-red-500/10" :
                      reg.impactLevel === "medium" ? "text-amber-400 bg-amber-500/10" :
                      "text-emerald-400 bg-emerald-500/10"
                    }`}>{reg.impactLevel}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{reg.summary}</p>
                </div>
              ));
            }
            return <div className="text-sm text-slate-600 py-4 text-center">No regulation alerts</div>;
          })()}
        </div>

        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-3" data-testid="card-trader-sentiment">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" /> Trader Sentiment
          </h3>
          {(() => {
            const signals = Array.isArray(traderSignalsData) ? traderSignalsData : (traderSignalsData?.signals || []);
            if (signals.length > 0) {
              const bullish = signals.filter((s: any) => (s.sentimentScore ?? 0) > 0.3).length;
              const bearish = signals.filter((s: any) => (s.sentimentScore ?? 0) < -0.3).length;
              const neutral = signals.length - bullish - bearish;
              const total = signals.length;
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 rounded-full bg-white/[0.04] overflow-hidden flex">
                      {bullish > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(bullish / total) * 100}%` }} />}
                      {neutral > 0 && <div className="h-full bg-amber-500" style={{ width: `${(neutral / total) * 100}%` }} />}
                      {bearish > 0 && <div className="h-full bg-red-500" style={{ width: `${(bearish / total) * 100}%` }} />}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="py-2 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20" data-testid="sentiment-bullish">
                      <div className="text-lg font-bold text-emerald-400">{bullish}</div>
                      <div className="text-[10px] text-emerald-400/70 uppercase">Bullish</div>
                    </div>
                    <div className="py-2 px-2 rounded-lg bg-amber-500/10 border border-amber-500/20" data-testid="sentiment-neutral">
                      <div className="text-lg font-bold text-amber-400">{neutral}</div>
                      <div className="text-[10px] text-amber-400/70 uppercase">Neutral</div>
                    </div>
                    <div className="py-2 px-2 rounded-lg bg-red-500/10 border border-red-500/20" data-testid="sentiment-bearish">
                      <div className="text-lg font-bold text-red-400">{bearish}</div>
                      <div className="text-[10px] text-red-400/70 uppercase">Bearish</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 text-center">{total} signal{total !== 1 ? "s" : ""} analyzed</div>
                </div>
              );
            }
            return <div className="text-sm text-slate-600 py-4 text-center">No trader signals yet</div>;
          })()}
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ token, fetchFn, selectedTerminalId, terminalList }: { token: string | null; fetchFn: any; selectedTerminalId: string; terminalList: Terminal[] }) {
  const [productFilter, setProductFilter] = useState<string>("ALL");

  const { data: multiForecasts, isLoading } = useQuery<any>({
    queryKey: ["/api/forecast/multi", selectedTerminalId],
    queryFn: fetchFn,
    enabled: !!token && !!selectedTerminalId,
  });

  const products = productFilter === "ALL" ? PRODUCT_TYPES : [productFilter];
  const forecastList = Array.isArray(multiForecasts) ? multiForecasts : (multiForecasts?.data || multiForecasts || []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white" data-testid="text-products-title">Multi-Product Forecasts</h3>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-48 bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid="select-product-filter">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent className="bg-[#0c1220] border-white/[0.08]">
            <SelectItem value="ALL" className="text-slate-300">All Products</SelectItem>
            {PRODUCT_TYPES.map((p) => (
              <SelectItem key={p} value={p} className="text-slate-300">{PRODUCT_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : forecastList.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forecastList.filter((f: any) => productFilter === "ALL" || f.productType === productFilter).map((f: any) => {
            const bias = getBiasDisplay(f.bias || "neutral");
            const color = PRODUCT_COLORS[f.productType] || "#34d399";
            return (
              <div key={f.id || f.productType} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-3 hover:border-white/[0.12] transition-colors" data-testid={`card-product-${f.productType}`}>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                    {f.productType}
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${bias.color}`}>
                    <bias.icon className="w-3 h-3" />{bias.label}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  ₦{f.expectedMin?.toLocaleString()} — ₦{f.expectedMax?.toLocaleString()}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Confidence: {f.confidence}%</span>
                  {f.demandIndex && <span>Demand: {(f.demandIndex * 100).toFixed(0)}%</span>}
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${f.confidence}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(products as readonly string[]).map((p) => (
            <div key={p} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-3" data-testid={`card-product-${p}`}>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ color: PRODUCT_COLORS[p], backgroundColor: `${PRODUCT_COLORS[p]}15` }}>
                  {p}
                </span>
                <span className="text-xs text-slate-600">{PRODUCT_LABELS[p]}</span>
              </div>
              <div className="text-sm text-slate-500 py-4 text-center">No forecast data yet</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DepotSpreadTab({ data }: { data: any }) {
  const [filterProduct, setFilterProduct] = useState("PMS");
  const prices = data?.prices || (Array.isArray(data) ? data : []);
  const filtered = prices.filter((p: any) => p.productType === filterProduct);

  const lowest = filtered.length > 0 ? Math.min(...filtered.map((p: any) => p.price)) : 0;
  const highest = filtered.length > 0 ? Math.max(...filtered.map((p: any) => p.price)) : 0;
  const spread = highest - lowest;

  const grouped: Record<string, any[]> = {};
  filtered.forEach((p: any) => {
    const key = p.depotName || p.depotId;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white" data-testid="text-depot-spread-title">Depot Price Comparison</h3>
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-40 bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid="select-depot-product">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0c1220] border-white/[0.08]">
            {PRODUCT_TYPES.map((p) => (
              <SelectItem key={p} value={p} className="text-slate-300">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4" data-testid="stat-lowest-price">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Lowest Price</div>
          <div className="text-xl font-bold font-mono text-emerald-400">₦{lowest.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4" data-testid="stat-highest-price">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Highest Price</div>
          <div className="text-xl font-bold font-mono text-red-400">₦{highest.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4" data-testid="stat-spread">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Spread (Arbitrage)</div>
          <div className="text-xl font-bold font-mono text-amber-400">₦{spread.toLocaleString()}</div>
          {lowest > 0 && <div className="text-xs text-slate-500 mt-1">{((spread / lowest) * 100).toFixed(1)}% opportunity</div>}
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden" data-testid="table-depot-prices">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Depot</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Terminal</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Price</th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">vs Lowest</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((p: any, i: number) => {
              const isLowest = p.price === lowest;
              const diff = p.price - lowest;
              return (
                <tr key={p.id || i} className={`border-b border-white/[0.04] hover:bg-white/[0.02] ${isLowest ? "bg-emerald-500/[0.03]" : ""}`} data-testid={`row-depot-${i}`}>
                  <td className="px-5 py-3 text-sm text-white font-medium">{p.depotName || "—"}</td>
                  <td className="px-5 py-3 text-sm text-slate-400">{p.terminalName || "—"}</td>
                  <td className={`px-5 py-3 text-sm font-mono text-right font-semibold ${isLowest ? "text-emerald-400" : "text-white"}`}>
                    ₦{p.price?.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-sm text-right">
                    {isLowest ? (
                      <span className="text-emerald-400 text-xs font-semibold">LOWEST</span>
                    ) : (
                      <span className="text-red-400 text-xs">+₦{diff.toLocaleString()}</span>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-600">No depot prices available</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryTab({ token, fetchFn, data, refetch, terminalList }: { token: string | null; fetchFn: any; data: any; refetch: () => void; terminalList: Terminal[] }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const inventoryItems = Array.isArray(data) ? data : (data?.items || []);

  const totalVolume = inventoryItems.reduce((sum: number, item: any) => sum + (item.volumeLitres || 0), 0);
  const totalValue = inventoryItems.reduce((sum: number, item: any) => sum + (item.volumeLitres || 0) * (item.averageCost || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white" data-testid="text-inventory-title">Inventory Tracker</h3>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setShowAddForm(!showAddForm)}
          data-testid="button-add-inventory"
        >
          <Plus className="w-4 h-4 mr-1" />Add Stock
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4" data-testid="stat-total-volume">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Total Volume</div>
          <div className="text-xl font-bold font-mono text-white">{totalVolume.toLocaleString()} L</div>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4" data-testid="stat-total-value">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Total Value</div>
          <div className="text-xl font-bold font-mono text-emerald-400">₦{totalValue.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4" data-testid="stat-positions">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Positions</div>
          <div className="text-xl font-bold font-mono text-white">{inventoryItems.length}</div>
        </div>
      </div>

      {showAddForm && (
        <AddInventoryForm token={token} terminalList={terminalList} onSuccess={() => { setShowAddForm(false); refetch(); }} />
      )}

      <div className="space-y-3">
        {inventoryItems.length > 0 ? inventoryItems.map((item: any, i: number) => (
          <div key={item.id || i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid={`card-inventory-${i}`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold text-emerald-400 bg-emerald-500/10">{item.productType}</span>
                <span className="text-sm text-white font-medium">{item.terminalName || "Unknown"}</span>
              </div>
              <div className="text-xs text-slate-500">
                Volume: {item.volumeLitres?.toLocaleString()} L &middot; Avg Cost: ₦{item.averageCost?.toLocaleString()}/L
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold font-mono text-white">₦{(item.volumeLitres * item.averageCost).toLocaleString()}</div>
              <div className="text-xs text-slate-500">Last updated: {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : "—"}</div>
            </div>
          </div>
        )) : (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-8 text-center text-sm text-slate-600" data-testid="empty-inventory">
            No inventory positions yet. Add your first stock entry above.
          </div>
        )}
      </div>
    </div>
  );
}

function AddInventoryForm({ token, terminalList, onSuccess }: { token: string | null; terminalList: Terminal[]; onSuccess: () => void }) {
  const [terminalId, setTerminalId] = useState(terminalList[0]?.id || "");
  const [productType, setProductType] = useState("PMS");
  const [volume, setVolume] = useState("");
  const [cost, setCost] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/inventory", {
        terminalId,
        productType,
        volumeLitres: parseFloat(volume),
        averageCost: parseFloat(cost),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      onSuccess();
    },
  });

  return (
    <div className="rounded-xl bg-white/[0.02] border border-emerald-500/20 p-5 space-y-4" data-testid="form-add-inventory">
      <h4 className="text-sm font-semibold text-white">Add Inventory Position</h4>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Terminal</label>
          <Select value={terminalId} onValueChange={setTerminalId}>
            <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid="select-inv-terminal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0c1220] border-white/[0.08]">
              {terminalList.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-slate-300">{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Product</label>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid="select-inv-product">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0c1220] border-white/[0.08]">
              {PRODUCT_TYPES.map((p) => (
                <SelectItem key={p} value={p} className="text-slate-300">{PRODUCT_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Volume (Litres)</label>
          <input
            type="number"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            placeholder="e.g. 50000"
            data-testid="input-inv-volume"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Average Cost (₦/L)</label>
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            placeholder="e.g. 620"
            data-testid="input-inv-cost"
          />
        </div>
      </div>
      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !volume || !cost}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
        data-testid="button-save-inventory"
      >
        {mutation.isPending ? "Saving..." : "Save Position"}
      </Button>
    </div>
  );
}

function HedgeLabTab({ token, fetchFn, data, selectedProduct, setSelectedProduct }: { token: string | null; fetchFn: any; data: any; selectedProduct: string; setSelectedProduct: (v: string) => void }) {
  const recommendations = Array.isArray(data) ? data : (data?.recommendations || []);

  const { data: analysisData, refetch: refetchAnalysis } = useQuery<any>({
    queryKey: [`/api/hedge/analysis?productType=${selectedProduct}`],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const analysis = analysisData || null;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/hedge/generate`, { productType: selectedProduct });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/hedge?productType=${selectedProduct}`] });
      refetchAnalysis();
    },
  });

  const riskColors: Record<string, string> = {
    low: "text-emerald-400",
    medium: "text-amber-400",
    high: "text-red-400",
    critical: "text-red-500",
  };
  const riskBg: Record<string, string> = {
    low: "bg-emerald-500/10 border-emerald-500/20",
    medium: "bg-amber-500/10 border-amber-500/20",
    high: "bg-red-500/10 border-red-500/20",
    critical: "bg-red-500/15 border-red-500/30",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white" data-testid="text-hedge-title">Hedge Strategy Lab</h3>
        <div className="flex items-center gap-3">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-40 bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid="select-hedge-product">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0c1220] border-white/[0.08]">
              {PRODUCT_TYPES.map((p) => (
                <SelectItem key={p} value={p} className="text-slate-300">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-hedge"
          >
            <Zap className="w-4 h-4 mr-1" />{generateMutation.isPending ? "Analyzing..." : "Generate"}
          </Button>
        </div>
      </div>

      {analysis && (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4" data-testid="card-overall-strategy">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className={`w-5 h-5 ${riskColors[analysis.overallRiskLevel] || "text-slate-400"}`} />
            <span className="text-sm font-semibold text-white">Overall Strategy</span>
            <span className={`ml-auto text-xs font-semibold uppercase ${riskColors[analysis.overallRiskLevel] || "text-slate-400"}`}>
              {analysis.overallRiskLevel} risk
            </span>
          </div>
          <p className="text-sm text-slate-400">{analysis.overallStrategy}</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className={`rounded-xl border p-5 space-y-3 ${analysis?.inventoryRisk ? riskBg[analysis.inventoryRisk.riskLevel] || "bg-white/[0.02] border-white/[0.06]" : "bg-red-500/10 border-red-500/20"}`} data-testid="card-engine-inventory-risk">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h4 className="text-sm font-semibold text-red-400">Inventory Risk Engine</h4>
          </div>
          {analysis?.inventoryRisk ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Risk Exposure</span>
                <span className="text-white font-mono">₦{(analysis.inventoryRisk.riskExposure || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Unrealized P&L</span>
                <span className={`font-mono ${(analysis.inventoryRisk.unrealizedPnL || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(analysis.inventoryRisk.unrealizedPnL || 0) >= 0 ? "+" : ""}₦{(analysis.inventoryRisk.unrealizedPnL || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Drop Probability</span>
                <span className="text-white font-mono">{analysis.inventoryRisk.dropProbability}%</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">{analysis.inventoryRisk.reasoning}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Exposure = volume × drop_probability × (avg_cost − expected_price)</p>
          )}
        </div>

        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-5 space-y-3" data-testid="card-engine-staggered-buy">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h4 className="text-sm font-semibold text-blue-400">Staggered Buy Optimizer</h4>
          </div>
          {analysis?.staggeredBuy ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Volatility Index</span>
                <span className="text-white font-mono">{(analysis.staggeredBuy.volatilityIndex * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Liquidity Score</span>
                <span className="text-white font-mono">{(analysis.staggeredBuy.liquidityScore * 100).toFixed(1)}%</span>
              </div>
              <div className="space-y-1.5 mt-2">
                {analysis.staggeredBuy.splits?.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-10 text-right text-xs font-bold text-blue-300">{s.percentage}%</div>
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${s.percentage}%` }} />
                    </div>
                    <div className="text-xs text-slate-500 w-20">{s.timing}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Optimal split = volatility_index / liquidity_score</p>
          )}
        </div>

        <div className={`rounded-xl border p-5 space-y-3 ${analysis?.arbitrage?.hasOpportunity ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`} data-testid="card-engine-arbitrage">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-400">Arbitrage Engine</h4>
          </div>
          {analysis?.arbitrage ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Spread</span>
                <span className="text-white font-mono">₦{analysis.arbitrage.spread}/L</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Transport Cost</span>
                <span className="text-white font-mono">₦{analysis.arbitrage.transportCost}/L</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Net Profit</span>
                <span className={`font-mono ${analysis.arbitrage.netProfit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  ₦{analysis.arbitrage.netProfit}/L
                </span>
              </div>
              {analysis.arbitrage.hasOpportunity && (
                <div className="mt-2 px-2 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-emerald-400 font-semibold">Opportunity: {analysis.arbitrage.profitMarginPercent}% margin</p>
                  <p className="text-xs text-slate-500">{analysis.arbitrage.lowestDepot?.name} → {analysis.arbitrage.highestDepot?.name}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Arbitrage when spread {">"} transport_cost</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">AI Recommendations</h4>
        {recommendations.length > 0 ? recommendations.map((rec: any, i: number) => (
          <div key={rec.id || i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-2" data-testid={`card-hedge-${i}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white capitalize">{rec.strategyType?.replace(/_/g, " ")}</span>
              <span className={`text-xs font-semibold ${riskColors[rec.riskLevel] || "text-slate-400"}`}>
                Risk: {rec.riskLevel?.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-slate-400">{rec.reasoning}</p>
            {rec.expectedMarginImpact !== undefined && rec.expectedMarginImpact !== null && (
              <div className="text-xs text-slate-500">Expected margin impact: {rec.expectedMarginImpact > 0 ? "+" : ""}{rec.expectedMarginImpact.toFixed(1)}%</div>
            )}
          </div>
        )) : (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-8 text-center text-sm text-slate-600" data-testid="empty-hedge">
            No recommendations yet. Click "Generate" to analyze current market conditions.
          </div>
        )}
      </div>
    </div>
  );
}

function TraderSignalsTab({ token, fetchFn, data, refetch }: { token: string | null; fetchFn: any; data: any; refetch: () => void }) {
  const [message, setMessage] = useState("");
  const signals = Array.isArray(data) ? data : (data?.signals || []);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trader-signals", { message });
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/trader-signals"] });
      refetch();
    },
  });

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-white" data-testid="text-trader-signals-title">Trader Chat Intelligence</h3>

      <div className="rounded-xl bg-white/[0.02] border border-emerald-500/20 p-5 space-y-3" data-testid="form-trader-signal">
        <h4 className="text-sm font-semibold text-white">Share Market Intel</h4>
        <p className="text-xs text-slate-500">Report what you see at depots, queues, or pricing changes. Our AI will analyze sentiment and impact.</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='e.g. "Warri queue heavy o" or "Dangote reducing output"'
            className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30 placeholder-slate-600"
            data-testid="input-trader-message"
            onKeyDown={(e) => e.key === "Enter" && message.trim() && submitMutation.mutate()}
          />
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !message.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid="button-submit-signal"
          >
            <Send className="w-4 h-4 mr-1" />{submitMutation.isPending ? "..." : "Send"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {signals.length > 0 ? signals.map((sig: any, i: number) => {
          const sentiment = sig.sentimentScore ?? 0;
          const sentimentLabel = sentiment > 0.3 ? "Bullish" : sentiment < -0.3 ? "Bearish" : "Neutral";
          const sentimentColor = sentiment > 0.3 ? "text-emerald-400" : sentiment < -0.3 ? "text-red-400" : "text-amber-400";
          return (
            <div key={sig.id || i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-2" data-testid={`card-signal-${i}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{sig.userName || "Anonymous"}</span>
                <span className="text-xs text-slate-600">{sig.createdAt ? new Date(sig.createdAt).toLocaleString() : ""}</span>
              </div>
              <p className="text-sm text-white">{sig.message}</p>
              <div className="flex items-center gap-4 text-xs">
                <span className={sentimentColor}>Sentiment: {sentimentLabel} ({(sentiment * 100).toFixed(0)}%)</span>
                {sig.impactScore != null && <span className="text-slate-500">Impact: {(sig.impactScore * 100).toFixed(0)}%</span>}
                {sig.detectedTerminal && <span className="text-slate-500">Terminal: {sig.detectedTerminal}</span>}
                {sig.keywords?.length > 0 && (
                  <div className="flex gap-1">
                    {sig.keywords.map((k: string, j: number) => (
                      <span key={j} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400">{k}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-8 text-center text-sm text-slate-600" data-testid="empty-signals">
            No trader signals yet. Be the first to share market intelligence.
          </div>
        )}
      </div>
    </div>
  );
}

function RefineryIntelTab({ token, fetchFn, data }: { token: string | null; fetchFn: any; data: any }) {
  const refineryUpdates = Array.isArray(data) ? data : (data?.data || data?.refineryUpdates || []);

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-white" data-testid="text-refinery-title">Refinery Intel</h3>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Factory className="w-4 h-4" /> Refinery Updates
        </h4>
        {refineryUpdates.length > 0 ? refineryUpdates.map((update: any, i: number) => (
          <div key={update.id || i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-2" data-testid={`card-refinery-${i}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{update.refineryName}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                update.operationalStatus === "operational" ? "text-emerald-400 bg-emerald-500/10" :
                update.operationalStatus === "maintenance" ? "text-amber-400 bg-amber-500/10" :
                "text-red-400 bg-red-500/10"
              }`}>{update.operationalStatus}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
              <div>PMS: {update.pmsOutputEstimate}k bpd</div>
              <div>AGO: {update.dieselOutputEstimate}k bpd</div>
              <div>JET: {update.jetOutputEstimate}k bpd</div>
            </div>
            <div className="text-xs text-slate-600">Capacity: {update.productionCapacity}% &middot; Source: {update.updateSource}</div>
          </div>
        )) : (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-8 text-center text-sm text-slate-600" data-testid="empty-refinery">
            No refinery updates available
          </div>
        )}
      </div>
    </div>
  );
}

function RegulationUpdatesTab({ token, fetchFn, data }: { token: string | null; fetchFn: any; data: any }) {
  const regulations = Array.isArray(data) ? data : (data?.data || []);

  const { data: highImpactData } = useQuery<any>({
    queryKey: ["/api/regulations/high-impact"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const highImpactRegs = Array.isArray(highImpactData) ? highImpactData : (highImpactData?.data || []);
  const highImpactIds = new Set(highImpactRegs.map((r: any) => r.id));

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-white" data-testid="text-regulation-title">Regulation Updates</h3>

      {highImpactRegs.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> High Impact Regulations
          </h4>
          {highImpactRegs.map((reg: any, i: number) => (
            <div key={reg.id || i} className="rounded-xl bg-red-500/[0.05] border border-red-500/20 p-4 space-y-2" data-testid={`card-high-regulation-${i}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{reg.title}</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold text-red-400 bg-red-500/10">HIGH IMPACT</span>
              </div>
              <p className="text-sm text-slate-400">{reg.summary}</p>
              {reg.affectedProducts && reg.affectedProducts.length > 0 && (
                <div className="flex gap-1.5">
                  {reg.affectedProducts.map((p: string, j: number) => (
                    <span key={j} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.04] text-slate-300">{p}</span>
                  ))}
                </div>
              )}
              <div className="text-xs text-slate-600">
                Effective: {reg.effectiveDate ? new Date(reg.effectiveDate).toLocaleDateString() : "—"} &middot; Source: {reg.source}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <ScrollText className="w-4 h-4" /> All Regulations
        </h4>
        {regulations.length > 0 ? regulations.filter((r: any) => !highImpactIds.has(r.id)).map((reg: any, i: number) => (
          <div key={reg.id || i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-2" data-testid={`card-regulation-${i}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{reg.title}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                reg.impactLevel === "high" ? "text-red-400 bg-red-500/10" :
                reg.impactLevel === "medium" ? "text-amber-400 bg-amber-500/10" :
                "text-emerald-400 bg-emerald-500/10"
              }`}>{reg.impactLevel}</span>
            </div>
            <p className="text-sm text-slate-400">{reg.summary}</p>
            {reg.affectedProducts && reg.affectedProducts.length > 0 && (
              <div className="flex gap-1.5">
                {reg.affectedProducts.map((p: string, j: number) => (
                  <span key={j} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.04] text-slate-300">{p}</span>
                ))}
              </div>
            )}
            <div className="text-xs text-slate-600">
              Effective: {reg.effectiveDate ? new Date(reg.effectiveDate).toLocaleDateString() : "—"} &middot; Source: {reg.source}
            </div>
          </div>
        )) : (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-8 text-center text-sm text-slate-600" data-testid="empty-regulations">
            No regulation updates available
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ user, token, fetchFn, notifPrefs, refetchNotifPrefs }: { user: any; token: string | null; fetchFn: any; notifPrefs: any; refetchNotifPrefs: () => void }) {
  const prefs = notifPrefs || {};
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");

  useEffect(() => {
    if (prefs) {
      setSmsEnabled(!!prefs.notificationPrefs?.smsEnabled);
      setWhatsappEnabled(!!prefs.notificationPrefs?.whatsappEnabled);
      setPhoneNumber(prefs.phone || "");
      setWhatsappPhone(prefs.whatsappPhone || "");
    }
  }, [prefs]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/notifications/preferences", {
        phone: phoneNumber,
        whatsappPhone,
        notificationPrefs: {
          smsEnabled,
          whatsappEnabled,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      refetchNotifPrefs();
    },
  });

  const tierLabels: Record<string, { label: string; color: string }> = {
    free: { label: "Free", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
    pro: { label: "Pro", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    elite: { label: "Elite", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  };

  const tierInfo = tierLabels[user?.subscriptionTier] || tierLabels.free;

  return (
    <div className="space-y-6 max-w-2xl">
      <h3 className="text-lg font-semibold text-white" data-testid="text-settings-title">Settings</h3>

      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-4" data-testid="card-settings-profile">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <User className="w-4 h-4" /> Profile
        </h4>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 uppercase tracking-wider">Name</label>
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white" data-testid="text-settings-name">
              {user?.name || "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 uppercase tracking-wider">Email</label>
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white flex items-center gap-2" data-testid="text-settings-email">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              {user?.email || "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 uppercase tracking-wider">Role</label>
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white capitalize" data-testid="text-settings-role">
              {user?.role || "marketer"}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 uppercase tracking-wider">Subscription</label>
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${tierInfo.color}`} data-testid="badge-settings-tier">
                <Crown className="w-3 h-3" />
                {tierInfo.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-4" data-testid="card-settings-notifications">
        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notification Preferences
        </h4>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 uppercase tracking-wider">Phone Number</label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+234..."
                className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30 placeholder-slate-600"
                data-testid="input-settings-phone"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 uppercase tracking-wider">WhatsApp Number</label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" />
              <input
                type="tel"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="+234..."
                className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30 placeholder-slate-600"
                data-testid="input-settings-whatsapp"
              />
            </div>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div>
              <div className="text-sm text-white">SMS Alerts</div>
              <div className="text-xs text-slate-500">Receive price alerts and forecasts via SMS</div>
            </div>
            <button
              onClick={() => setSmsEnabled(!smsEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${smsEnabled ? "bg-emerald-500" : "bg-white/[0.1]"}`}
              data-testid="toggle-sms"
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${smsEnabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div>
              <div className="text-sm text-white">WhatsApp Alerts</div>
              <div className="text-xs text-slate-500">Receive alerts on WhatsApp (Elite tier)</div>
            </div>
            <button
              onClick={() => setWhatsappEnabled(!whatsappEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${whatsappEnabled ? "bg-emerald-500" : "bg-white/[0.1]"}`}
              data-testid="toggle-whatsapp"
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${whatsappEnabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
            data-testid="button-save-settings"
          >
            {updateMutation.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
}
