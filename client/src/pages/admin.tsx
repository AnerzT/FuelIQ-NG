import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Flame,
  LogOut,
  Shield,
  ToggleLeft,
  ToggleRight,
  Plus,
  Activity,
  History,
  MapPin,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  RefreshCw,
  Truck,
  Droplets,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Crown,
  Users,
} from "lucide-react";
import type { Terminal, Forecast, MarketSignal, SubscriptionTier } from "@shared/schema";
import { TIER_LIMITS } from "@shared/schema";

type AdminTab = "terminals" | "forecast" | "signals" | "history" | "subscriptions";

function getBiasIcon(bias: string) {
  const b = bias?.toLowerCase();
  if (b === "bullish") return { Icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (b === "bearish") return { Icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10" };
  return { Icon: Minus, color: "text-amber-400", bg: "bg-amber-500/10" };
}

export default function Admin() {
  const { user, token, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>("terminals");
  const fetchFn = authFetch(token);

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (user.role !== "admin") {
    setLocation("/dashboard");
    return null;
  }

  const tabs: { key: AdminTab; label: string; icon: typeof Shield }[] = [
    { key: "terminals", label: "Terminals", icon: MapPin },
    { key: "forecast", label: "Add Forecast", icon: Plus },
    { key: "signals", label: "Update Signals", icon: Activity },
    { key: "history", label: "Forecast History", icon: History },
    { key: "subscriptions", label: "Subscriptions", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#060b18]" data-testid="page-admin">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060b18]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white hidden sm:block">FuelIQ NG</span>
              <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">ADMIN</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/dashboard")}
                className="text-slate-400 hover:text-white hover:bg-white/[0.04]"
                data-testid="button-back-dashboard"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="flex items-center gap-2 pl-2 border-l border-white/[0.06]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white">
                  {user.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
                <span className="text-sm font-medium text-slate-300 hidden sm:block" data-testid="text-admin-name">{user.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="text-slate-400 hover:text-white hover:bg-white/[0.04]" data-testid="button-admin-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white" data-testid="text-admin-title">Admin Panel</h1>
          </div>
          <p className="text-sm text-slate-500">Manage terminals, forecasts, and market signals</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "terminals" && <TerminalsPanel token={token} fetchFn={fetchFn} toast={toast} />}
        {activeTab === "forecast" && <ForecastPanel token={token} fetchFn={fetchFn} toast={toast} />}
        {activeTab === "signals" && <SignalsPanel token={token} fetchFn={fetchFn} toast={toast} />}
        {activeTab === "history" && <HistoryPanel token={token} fetchFn={fetchFn} />}
        {activeTab === "subscriptions" && <SubscriptionsPanel token={token} fetchFn={fetchFn} toast={toast} />}
      </main>
    </div>
  );
}

function TerminalsPanel({ token, fetchFn, toast }: { token: string | null; fetchFn: any; toast: any }) {
  const { data: terminals, isLoading } = useQuery<Terminal[]>({
    queryKey: ["/api/admin/terminals"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/admin/terminals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed to update terminal");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/terminals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/terminals"] });
      toast({ title: data.message || "Terminal updated" });
    },
    onError: () => {
      toast({ title: "Failed to update terminal", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="panel-terminals">
      <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold px-1">
        {terminals?.length || 0} terminals
      </div>
      {terminals?.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
          data-testid={`terminal-row-${t.code}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${t.active ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <div>
              <div className="text-sm font-semibold text-white">{t.name}</div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{t.state}</span>
                <span className="font-mono text-emerald-400/60">{t.code}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              t.active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            }`} data-testid={`badge-status-${t.code}`}>
              {t.active ? "Active" : "Inactive"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleMutation.mutate({ id: t.id, active: !t.active })}
              disabled={toggleMutation.isPending}
              className="text-slate-400 hover:text-white hover:bg-white/[0.06]"
              data-testid={`button-toggle-${t.code}`}
            >
              {t.active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-red-400" />}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ForecastPanel({ token, fetchFn, toast }: { token: string | null; fetchFn: any; toast: any }) {
  const { data: terminals } = useQuery<Terminal[]>({
    queryKey: ["/api/admin/terminals"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const [terminalId, setTerminalId] = useState("");
  const [expectedMin, setExpectedMin] = useState("");
  const [expectedMax, setExpectedMax] = useState("");
  const [bias, setBias] = useState("neutral");
  const [confidence, setConfidence] = useState("70");
  const [suggestedAction, setSuggestedAction] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/forecasts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create forecast");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/forecasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forecast"] });
      toast({ title: "Forecast created successfully" });
      setExpectedMin("");
      setExpectedMax("");
      setBias("neutral");
      setConfidence("70");
      setSuggestedAction("");
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalId || !expectedMin || !expectedMax || !suggestedAction) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      terminalId,
      expectedMin: parseFloat(expectedMin),
      expectedMax: parseFloat(expectedMax),
      bias,
      confidence: parseInt(confidence),
      suggestedAction,
    });
  };

  return (
    <div className="max-w-xl" data-testid="panel-forecast">
      <form onSubmit={handleSubmit} className="space-y-5 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Add Manual Forecast</h3>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Terminal</Label>
          <Select value={terminalId} onValueChange={setTerminalId}>
            <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid="select-forecast-terminal">
              <SelectValue placeholder="Select terminal" />
            </SelectTrigger>
            <SelectContent className="bg-[#0c1220] border-white/[0.08]">
              {terminals?.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-slate-300 focus:bg-white/[0.06] focus:text-white">
                  {t.name} ({t.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Expected Min (₦)</Label>
            <Input
              type="number"
              value={expectedMin}
              onChange={(e) => setExpectedMin(e.target.value)}
              placeholder="600"
              className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600"
              data-testid="input-expected-min"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Expected Max (₦)</Label>
            <Input
              type="number"
              value={expectedMax}
              onChange={(e) => setExpectedMax(e.target.value)}
              placeholder="650"
              className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600"
              data-testid="input-expected-max"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Bias</Label>
            <Select value={bias} onValueChange={setBias}>
              <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid="select-bias">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0c1220] border-white/[0.08]">
                <SelectItem value="bullish" className="text-emerald-400 focus:bg-white/[0.06]">Bullish</SelectItem>
                <SelectItem value="bearish" className="text-red-400 focus:bg-white/[0.06]">Bearish</SelectItem>
                <SelectItem value="neutral" className="text-amber-400 focus:bg-white/[0.06]">Neutral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Confidence (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="bg-white/[0.03] border-white/[0.08] text-white"
              data-testid="input-confidence"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Suggested Action</Label>
          <Input
            value={suggestedAction}
            onChange={(e) => setSuggestedAction(e.target.value)}
            placeholder="Load before 6am. Avoid spot buying."
            className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600"
            data-testid="input-suggested-action"
          />
        </div>

        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-white border-0"
          data-testid="button-create-forecast"
        >
          {createMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Create Forecast
        </Button>
      </form>
    </div>
  );
}

function SignalsPanel({ token, fetchFn, toast }: { token: string | null; fetchFn: any; toast: any }) {
  const { data: terminals } = useQuery<Terminal[]>({
    queryKey: ["/api/admin/terminals"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const [terminalId, setTerminalId] = useState("");
  const [vesselActivity, setVesselActivity] = useState("None");
  const [truckQueue, setTruckQueue] = useState("Low");
  const [nnpcSupply, setNnpcSupply] = useState("Moderate");
  const [fxPressure, setFxPressure] = useState("Low");
  const [policyRisk, setPolicyRisk] = useState("Low");

  const signalQuery = useQuery<{ terminal: Terminal; signal: MarketSignal }>({
    queryKey: ["/api/signals", terminalId],
    queryFn: fetchFn,
    enabled: !!terminalId && !!token,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/signals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update signal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
      toast({ title: "Market signal updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalId) {
      toast({ title: "Please select a terminal", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      terminalId,
      vesselActivity,
      truckQueue,
      nnpcSupply,
      fxPressure,
      policyRisk,
    });
  };

  const currentSignal = signalQuery.data?.signal;

  const signalOptions = {
    vesselActivity: ["None", "Low", "Moderate", "High"],
    truckQueue: ["Low", "Medium", "High"],
    nnpcSupply: ["Weak", "Moderate", "Strong"],
    fxPressure: ["Low", "Medium", "High"],
    policyRisk: ["Low", "Medium", "High"],
  };

  const signalFields = [
    { key: "vesselActivity", label: "Vessel Activity", icon: Activity, value: vesselActivity, setter: setVesselActivity, options: signalOptions.vesselActivity },
    { key: "truckQueue", label: "Truck Queue", icon: Truck, value: truckQueue, setter: setTruckQueue, options: signalOptions.truckQueue },
    { key: "nnpcSupply", label: "NNPC Supply", icon: Droplets, value: nnpcSupply, setter: setNnpcSupply, options: signalOptions.nnpcSupply },
    { key: "fxPressure", label: "FX Pressure", icon: DollarSign, value: fxPressure, setter: setFxPressure, options: signalOptions.fxPressure },
    { key: "policyRisk", label: "Policy Risk", icon: AlertTriangle, value: policyRisk, setter: setPolicyRisk, options: signalOptions.policyRisk },
  ];

  return (
    <div className="max-w-xl" data-testid="panel-signals">
      <form onSubmit={handleSubmit} className="space-y-5 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Update Market Signals</h3>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Terminal</Label>
          <Select value={terminalId} onValueChange={setTerminalId}>
            <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid="select-signal-terminal">
              <SelectValue placeholder="Select terminal" />
            </SelectTrigger>
            <SelectContent className="bg-[#0c1220] border-white/[0.08]">
              {terminals?.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-slate-300 focus:bg-white/[0.06] focus:text-white">
                  {t.name} ({t.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentSignal && (
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Current Signals</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-slate-400">Vessel: <span className="text-white font-medium">{currentSignal.vesselActivity}</span></span>
              <span className="text-slate-400">Truck: <span className="text-white font-medium">{currentSignal.truckQueue}</span></span>
              <span className="text-slate-400">NNPC: <span className="text-white font-medium">{currentSignal.nnpcSupply}</span></span>
              <span className="text-slate-400">FX: <span className="text-white font-medium">{currentSignal.fxPressure}</span></span>
              <span className="text-slate-400">Policy: <span className="text-white font-medium">{currentSignal.policyRisk}</span></span>
            </div>
          </div>
        )}

        {signalFields.map(({ key, label, icon: Icon, value, setter, options }) => (
          <div key={key} className="space-y-2">
            <Label className="text-xs text-slate-400 flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Label>
            <Select value={value} onValueChange={setter}>
              <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid={`select-${key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0c1220] border-white/[0.08]">
                {options.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-slate-300 focus:bg-white/[0.06] focus:text-white">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-white border-0"
          data-testid="button-update-signals"
        >
          {createMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Activity className="w-4 h-4 mr-2" />
          )}
          Update Signals
        </Button>
      </form>
    </div>
  );
}

function HistoryPanel({ token, fetchFn }: { token: string | null; fetchFn: any }) {
  const { data: terminals } = useQuery<Terminal[]>({
    queryKey: ["/api/admin/terminals"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const [filterTerminalId, setFilterTerminalId] = useState("");

  const effectiveFilter = filterTerminalId && filterTerminalId !== "all" ? filterTerminalId : "";
  const queryKey = effectiveFilter
    ? ["/api/admin/forecasts?terminalId=" + effectiveFilter]
    : ["/api/admin/forecasts"];

  const { data: forecastList, isLoading } = useQuery<(Forecast & { terminalName?: string })[]>({
    queryKey,
    queryFn: fetchFn,
    enabled: !!token,
  });

  return (
    <div className="space-y-4" data-testid="panel-history">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterTerminalId} onValueChange={setFilterTerminalId}>
          <SelectTrigger className="w-60 bg-white/[0.03] border-white/[0.08] text-slate-300" data-testid="select-history-terminal">
            <SelectValue placeholder="All terminals" />
          </SelectTrigger>
          <SelectContent className="bg-[#0c1220] border-white/[0.08]">
            <SelectItem value="all" className="text-slate-300 focus:bg-white/[0.06] focus:text-white">All Terminals</SelectItem>
            {terminals?.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-slate-300 focus:bg-white/[0.06] focus:text-white">
                {t.name} ({t.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterTerminalId && filterTerminalId !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterTerminalId("")}
            className="text-slate-400 hover:text-white"
            data-testid="button-clear-filter"
          >
            Clear filter
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : !forecastList?.length ? (
        <div className="text-center py-16">
          <History className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No forecast history found</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold px-1">
            {forecastList.length} forecasts
          </div>
          {forecastList.map((f) => {
            const { Icon, color, bg } = getBiasIcon(f.bias);
            return (
              <div
                key={f.id}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                data-testid={`forecast-row-${f.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white" data-testid={`text-forecast-terminal-${f.id}`}>
                        {(f as any).terminalName || "Unknown Terminal"}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${color}`}>
                        <Icon className="w-3 h-3" />
                        {f.bias}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {f.createdAt ? new Date(f.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "N/A"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-bold text-emerald-400">
                      ₦{f.expectedMin?.toLocaleString()} — ₦{f.expectedMax?.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      Confidence: <span className="text-white font-medium">{f.confidence}%</span>
                    </div>
                  </div>
                </div>
                {f.suggestedAction && (
                  <div className="mt-2 text-xs text-slate-400 border-t border-white/[0.04] pt-2">
                    {f.suggestedAction}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SubUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tier: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  smsAlertsUsedThisWeek: number;
  forecastsUsedToday: number;
  assignedTerminalId: string | null;
}

function SubscriptionsPanel({ token, fetchFn, toast }: { token: string | null; fetchFn: any; toast: any }) {
  const { data: subs, isLoading } = useQuery<SubUser[]>({
    queryKey: ["/api/admin/subscriptions"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      const res = await fetch(`/api/admin/subscriptions/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error("Failed to update subscription");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({ title: data.message || "Subscription updated" });
    },
    onError: () => {
      toast({ title: "Failed to update subscription", variant: "destructive" });
    },
  });

  const tierBadge = (tier: string) => {
    const styles: Record<string, string> = {
      free: "bg-slate-500/10 text-slate-400 border-slate-500/20",
      pro: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      elite: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    };
    return styles[tier] || styles.free;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
        ))}
      </div>
    );
  }

  const stats = {
    total: subs?.length || 0,
    free: subs?.filter((s) => s.tier === "free").length || 0,
    pro: subs?.filter((s) => s.tier === "pro").length || 0,
    elite: subs?.filter((s) => s.tier === "elite").length || 0,
  };

  return (
    <div className="space-y-4" data-testid="panel-subscriptions">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: stats.total, color: "text-white" },
          { label: "Free", value: stats.free, color: "text-slate-400" },
          { label: "Pro", value: stats.pro, color: "text-blue-400" },
          { label: "Elite", value: stats.elite, color: "text-purple-400" },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`} data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold px-1">
        {subs?.length || 0} users
      </div>

      {subs?.map((sub) => (
        <div
          key={sub.id}
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
          data-testid={`sub-row-${sub.id}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {sub.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{sub.name}</div>
              <div className="text-xs text-slate-500 truncate">{sub.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden md:flex flex-col items-end text-xs text-slate-500">
              <span>SMS: {sub.smsAlertsUsedThisWeek}/wk</span>
              <span>Forecasts: {sub.forecastsUsedToday}/day</span>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${tierBadge(sub.tier)}`} data-testid={`badge-tier-${sub.id}`}>
              {(TIER_LIMITS[sub.tier as SubscriptionTier] || TIER_LIMITS.free).label}
            </span>
            <Select
              value={sub.tier}
              onValueChange={(tier) => updateMutation.mutate({ userId: sub.id, tier })}
            >
              <SelectTrigger className="w-32 bg-white/[0.03] border-white/[0.08] text-slate-300 text-xs" data-testid={`select-tier-${sub.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0c1220] border-white/[0.08]">
                <SelectItem value="free" className="text-slate-300 focus:bg-white/[0.06] focus:text-white">Free</SelectItem>
                <SelectItem value="pro" className="text-blue-400 focus:bg-white/[0.06]">Pro</SelectItem>
                <SelectItem value="elite" className="text-purple-400 focus:bg-white/[0.06]">Elite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}
