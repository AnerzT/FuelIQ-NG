import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Anchor,
  Bell,
  Calculator,
  ExternalLink,
  Flame,
  Fuel,
  LockKeyhole,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SubscriptionTier } from "@shared/schema";

interface Observation {
  date: string;
  value: number;
}

interface Benchmark {
  key: "brent" | "wti" | "henryHub" | "asiaLng";
  seriesId: string;
  name: string;
  unit: string;
  value: number;
  observedAt: string;
  sourceUrl: string;
  history?: Observation[];
}

interface MarketIntelligenceResponse {
  fetchedAt: string;
  stale: boolean;
  warning?: string;
  hasPremiumAccess: boolean;
  benchmarks: Benchmark[];
  bonnyLight: { available: boolean; message: string };
  nigeria: {
    source: string;
    updatedAt: string;
    sourceUrl: string;
    indicators: Array<{ label: string; value: number; unit: string; period: string }>;
  };
  industrySources: Array<{ name: string; description: string; url: string }>;
}

interface BenchmarkAlert {
  id: string;
  benchmarkKey: Benchmark["key"];
  direction: "above" | "below";
  threshold: number;
  triggered: boolean;
}

const benchmarkColors: Record<Benchmark["key"], string> = {
  brent: "#34d399",
  wti: "#60a5fa",
  henryHub: "#fbbf24",
  asiaLng: "#c084fc",
};

function formatValue(value: number, unit: string) {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
}

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mergeHistory(benchmarks: Benchmark[], keys: Benchmark["key"][]) {
  const rows = new Map<string, Record<string, string | number>>();
  for (const benchmark of benchmarks) {
    if (!keys.includes(benchmark.key)) continue;
    for (const observation of benchmark.history || []) {
      const row = rows.get(observation.date) || { date: observation.date };
      row[benchmark.key] = observation.value;
      rows.set(observation.date, row);
    }
  }
  return Array.from(rows.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function readAlerts(storageKey: string): BenchmarkAlert[] {
  try {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) as BenchmarkAlert[] : [];
  } catch {
    return [];
  }
}

export function MarketIntelligence({
  token,
  tier,
  userId,
}: {
  token: string | null;
  tier: SubscriptionTier;
  userId: string;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isPaid = tier !== "free";
  const fetchFn = authFetch(token);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<MarketIntelligenceResponse>({
    queryKey: ["/api/market-intelligence"],
    queryFn: fetchFn,
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  const alertStorageKey = `fueliq.market-intelligence.alerts.${userId}`;
  const [alerts, setAlerts] = useState<BenchmarkAlert[]>(() => readAlerts(alertStorageKey));
  const [alertBenchmark, setAlertBenchmark] = useState<Benchmark["key"]>("brent");
  const [alertDirection, setAlertDirection] = useState<"above" | "below">("above");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [fobUsdPerBarrel, setFobUsdPerBarrel] = useState("");
  const [freightUsdPerBarrel, setFreightUsdPerBarrel] = useState("");
  const [insuranceUsdPerBarrel, setInsuranceUsdPerBarrel] = useState("");
  const [fxNgnPerUsd, setFxNgnPerUsd] = useState("");
  const [localCostsNgnPerLitre, setLocalCostsNgnPerLitre] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(alertStorageKey, JSON.stringify(alerts));
    } catch {
      toast({ title: "Unable to save alerts", description: "Browser storage is unavailable on this device." });
    }
  }, [alertStorageKey, alerts, toast]);

  useEffect(() => {
    if (!isPaid || !data?.benchmarks) return;
    let updated = false;
    const triggered: BenchmarkAlert[] = [];
    const nextAlerts = alerts.map(alert => {
      const benchmark = data.benchmarks.find(item => item.key === alert.benchmarkKey);
      if (!benchmark) return alert;
      const reached = alert.direction === "above"
        ? benchmark.value >= alert.threshold
        : benchmark.value <= alert.threshold;
      if (reached && !alert.triggered) {
        updated = true;
        triggered.push(alert);
        return { ...alert, triggered: true };
      }
      if (!reached && alert.triggered) {
        updated = true;
        return { ...alert, triggered: false };
      }
      return alert;
    });
    if (updated) setAlerts(nextAlerts);
    for (const alert of triggered) {
      const benchmark = data.benchmarks.find(item => item.key === alert.benchmarkKey);
      toast({
        title: `${benchmark?.name || "Market"} alert`,
        description: `${formatValue(benchmark?.value || 0, benchmark?.unit || "")} is ${alert.direction} your ${alert.threshold} threshold.`,
      });
    }
  }, [alerts, data, isPaid, toast]);

  const benchmarks = data?.benchmarks || [];
  const crudeHistory = useMemo(() => mergeHistory(benchmarks, ["brent", "wti"]), [benchmarks]);
  const gasHistory = useMemo(() => mergeHistory(benchmarks, ["henryHub", "asiaLng"]), [benchmarks]);
  const benchmarkMap = new Map(benchmarks.map(item => [item.key, item]));
  const brent = benchmarkMap.get("brent");
  const wti = benchmarkMap.get("wti");
  const landedInputs = [
    fobUsdPerBarrel,
    freightUsdPerBarrel,
    insuranceUsdPerBarrel,
    fxNgnPerUsd,
    localCostsNgnPerLitre,
  ].map(value => value.trim() === "" ? NaN : Number(value));
  const landedCost = landedInputs.every(Number.isFinite) && landedInputs[0] >= 0 &&
    landedInputs[1] >= 0 && landedInputs[2] >= 0 && landedInputs[3] > 0 && landedInputs[4] >= 0
    ? ((landedInputs[0] + landedInputs[1] + landedInputs[2]) / 159) * landedInputs[3] + landedInputs[4]
    : null;
  const addAlert = () => {
    const threshold = Number(alertThreshold);
    if (!Number.isFinite(threshold) || threshold <= 0) return;
    setAlerts(current => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        benchmarkKey: alertBenchmark,
        direction: alertDirection,
        threshold,
        triggered: false,
      },
    ]);
    setAlertThreshold("");
  };

  return (
    <div className="space-y-6" data-testid="panel-market-intelligence">
      <section className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.02] to-white/[0.01] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <Activity className="w-4 h-4" /> Global and Nigerian energy markets
            </div>
            <h2 className="text-2xl font-bold text-white">Oil &amp; Gas Market Intelligence</h2>
            <p className="max-w-3xl text-sm text-slate-400">
              Track crude and gas benchmarks, Nigeria’s latest published sector fundamentals, and official industry updates in one place.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="border-white/[0.10] text-slate-300"
            data-testid="button-refresh-market-intelligence"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {data && (
          <p className="mt-4 text-xs text-slate-500">
            {data.benchmarks.length === 0 ? "Benchmark feed unavailable" : data.stale ? "Showing cached benchmark data" : "Latest available benchmark observations"} · checked {new Date(data.fetchedAt).toLocaleString()}
            {data.warning ? ` · ${data.warning}` : ""}
          </p>
        )}
      </section>

      {isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 text-sm text-red-300" role="alert">
          Market benchmarks could not be loaded: {error instanceof Error ? error.message : "The public data feed is unavailable"}.
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">International price benchmarks</h3>
            <p className="text-xs text-slate-500">Daily EIA spot data distributed by FRED; usually published one business day after observation.</p>
          </div>
          <a href="https://fred.stlouisfed.org/" target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300">
            Data source <ExternalLink className="inline w-3 h-3 ml-1" />
          </a>
        </div>
        {!isLoading && data && benchmarks.length === 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-200" role="status">
            Public benchmark prices are temporarily unavailable. No current price has been substituted; Nigeria context and official-source links remain available below.
          </div>
        )}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-xl bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {benchmarks.map(benchmark => (
              <a
                key={benchmark.key}
                href={benchmark.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/20 transition-colors"
                data-testid={`card-benchmark-${benchmark.key}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-300">{benchmark.name}</span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: benchmarkColors[benchmark.key] }} />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-white">{formatValue(benchmark.value, benchmark.unit)}</div>
                <div className="mt-1 text-[11px] text-slate-500">Observed {formatDate(benchmark.observedAt)}</div>
              </a>
            ))}
            <div className="rounded-xl border border-dashed border-amber-500/20 bg-amber-500/[0.03] p-4" data-testid="card-benchmark-bonny-light">
              <div className="flex items-center gap-2 text-sm text-amber-300"><Anchor className="w-4 h-4" />Bonny Light</div>
              <p className="mt-3 text-sm text-slate-400">{data?.bonnyLight.message || "No verified public quote feed is configured."}</p>
            </div>
          </div>
        )}
        {brent && wti && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-sm">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Brent–WTI spread:</span>
            <span className="font-semibold text-white">${(brent.value - wti.value).toFixed(2)}/bbl</span>
            <span className="text-xs text-slate-500">using each benchmark’s latest published observation</span>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Nigeria sector snapshot</h3>
          </div>
          <p className="text-xs text-slate-500">
            EIA country analysis · published data are historical, not real-time · page updated {formatDate(data?.nigeria.updatedAt || "2025-11-18")}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(data?.nigeria.indicators || []).map(indicator => (
              <div key={indicator.label} className="rounded-lg border border-white/[0.05] bg-black/10 p-3">
                <div className="text-xs text-slate-500">{indicator.label}</div>
                <div className="mt-1 text-xl font-bold text-white">{indicator.value.toLocaleString()} <span className="text-sm font-normal text-slate-400">{indicator.unit}</span></div>
                <div className="text-[11px] text-slate-500">Data year: {indicator.period}</div>
              </div>
            ))}
          </div>
          <a href={data?.nigeria.sourceUrl || "https://www.eia.gov/international/analysis/country/NGA"} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-emerald-400 hover:text-emerald-300">
            Read EIA Nigeria analysis <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Industry news &amp; policy sources</h3>
          </div>
          <p className="text-xs text-slate-500">Follow primary sources for new releases; headlines are linked to publishers rather than copied.</p>
          <div className="space-y-2">
            {(data?.industrySources || []).map(source => (
              <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.05] p-3 hover:bg-white/[0.03]">
                <span>
                  <span className="block text-sm font-medium text-slate-200">{source.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{source.description}</span>
                </span>
                <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {isPaid ? (
        <>
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4" data-testid="section-benchmark-history">
            <div>
              <h3 className="text-lg font-semibold text-white">Benchmark history</h3>
              <p className="text-xs text-slate-500">Up to 60 recent observations per source; source frequencies differ.</p>
            </div>
            {crudeHistory.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={crudeHistory}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={formatDate} minTickGap={30} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={48} />
                    <ChartTooltip labelFormatter={formatDate} contentStyle={{ background: "#0c1220", border: "1px solid rgba(255,255,255,.1)" }} />
                    <Legend />
                    <Line name="Brent" type="monotone" dataKey="brent" stroke={benchmarkColors.brent} dot={false} connectNulls />
                    <Line name="WTI" type="monotone" dataKey="wti" stroke={benchmarkColors.wti} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {gasHistory.length > 0 && (
              <div className="h-64">
                <div className="mb-2 text-xs text-slate-500">Natural gas and LNG indicators (USD/MMBtu)</div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gasHistory}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={formatDate} minTickGap={30} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={48} />
                    <ChartTooltip labelFormatter={formatDate} contentStyle={{ background: "#0c1220", border: "1px solid rgba(255,255,255,.1)" }} />
                    <Legend />
                    <Line name="Henry Hub" type="monotone" dataKey="henryHub" stroke={benchmarkColors.henryHub} dot={false} connectNulls />
                    <Line name="Asia LNG" type="monotone" dataKey="asiaLng" stroke={benchmarkColors.asiaLng} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4" data-testid="section-market-alerts">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-white">Benchmark alerts</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">In-app alerts on this device while Market Intelligence is open; not SMS or email.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_0.8fr_1fr_auto]">
                <select value={alertBenchmark} onChange={event => setAlertBenchmark(event.target.value as Benchmark["key"])} className="h-9 rounded-md border border-white/[0.08] bg-[#0c1220] px-3 text-sm text-slate-200">
                  {benchmarks.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
                </select>
                <select value={alertDirection} onChange={event => setAlertDirection(event.target.value as "above" | "below")} className="h-9 rounded-md border border-white/[0.08] bg-[#0c1220] px-3 text-sm text-slate-200">
                  <option value="above">At or above</option>
                  <option value="below">At or below</option>
                </select>
                <Input type="number" min="0.01" step="0.01" value={alertThreshold} onChange={event => setAlertThreshold(event.target.value)} placeholder="Threshold" className="bg-white/[0.03] border-white/[0.08] text-white" />
                <Button onClick={addAlert} disabled={!alertThreshold || benchmarks.length === 0}>Add alert</Button>
              </div>
              <div className="space-y-2">
                {alerts.map(alert => {
                  const benchmark = benchmarkMap.get(alert.benchmarkKey);
                  return (
                    <div key={alert.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
                      <span className="text-slate-300">{benchmark?.name} {alert.direction} {formatValue(alert.threshold, benchmark?.unit || "")}</span>
                      <span className="flex items-center gap-3">
                        <span className={alert.triggered ? "text-amber-400" : "text-emerald-400"}>{alert.triggered ? "Triggered" : "Watching"}</span>
                        <button onClick={() => setAlerts(current => current.filter(item => item.id !== alert.id))} className="text-slate-500 hover:text-white" aria-label="Remove alert">Remove</button>
                      </span>
                    </div>
                  );
                })}
                {alerts.length === 0 && <p className="text-xs text-slate-500">No alerts set.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4" data-testid="section-import-parity">
              <div>
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Indicative landed-cost worksheet</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">Enter your own product pricing and cost assumptions; no local costs are assumed.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-400">Product FOB (USD/bbl)<Input type="number" min="0" step="0.01" value={fobUsdPerBarrel} onChange={event => setFobUsdPerBarrel(event.target.value)} className="mt-1 bg-white/[0.03] border-white/[0.08] text-white" /></label>
                <label className="text-xs text-slate-400">Freight (USD/bbl)<Input type="number" min="0" step="0.01" value={freightUsdPerBarrel} onChange={event => setFreightUsdPerBarrel(event.target.value)} className="mt-1 bg-white/[0.03] border-white/[0.08] text-white" /></label>
                <label className="text-xs text-slate-400">Insurance (USD/bbl)<Input type="number" min="0" step="0.01" value={insuranceUsdPerBarrel} onChange={event => setInsuranceUsdPerBarrel(event.target.value)} className="mt-1 bg-white/[0.03] border-white/[0.08] text-white" /></label>
                <label className="text-xs text-slate-400">FX (NGN/USD)<Input type="number" min="0.01" step="0.01" value={fxNgnPerUsd} onChange={event => setFxNgnPerUsd(event.target.value)} className="mt-1 bg-white/[0.03] border-white/[0.08] text-white" /></label>
                <label className="col-span-2 text-xs text-slate-400">Local levies and handling (NGN/litre)<Input type="number" min="0" step="0.01" value={localCostsNgnPerLitre} onChange={event => setLocalCostsNgnPerLitre(event.target.value)} className="mt-1 bg-white/[0.03] border-white/[0.08] text-white" /></label>
              </div>
              <div className="rounded-lg border border-white/[0.05] bg-black/10 p-3">
                <div className="text-xs text-slate-500">Estimated landed cost (159 litres per barrel)</div>
                <div className="mt-1 text-2xl font-bold text-white">{landedCost === null ? "Enter all inputs" : `₦${landedCost.toLocaleString("en-NG", { maximumFractionDigits: 2 })}/L`}</div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                For screening only, not a quoted import-parity price or refining margin. No verified regional refined-product feed is configured, so refinery margins are not reported. Does not model product density, quality differentials, taxes not entered, financing, demurrage, losses, or distribution costs.
              </p>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6" data-testid="card-market-intelligence-upgrade">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-1 h-5 w-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-white">Unlock market history, alerts, and landed-cost analysis</h3>
                <p className="mt-1 text-sm text-slate-400">Paid plans include 60-observation benchmark charts, on-device price alerts, and an editable landed-cost worksheet.</p>
              </div>
            </div>
            <Button onClick={() => setLocation("/subscription")}>Explore plans</Button>
          </div>
        </section>
      )}

      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Flame className="h-3.5 w-3.5" />
        Data is attributed to its publisher. Benchmark series are not intraday prices; report dates are shown for each observation.
      </div>
    </div>
  );
}
