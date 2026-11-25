import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowUpDown,
  Bell,
  CheckCircle2,
  ExternalLink,
  Fuel,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FUEL_FINDER_PRODUCTS, NIGERIAN_STATES } from "@shared/schema";

type FuelPrice = {
  id: string;
  productType: string;
  priceNaira: number | null;
  availability: string;
  source: string;
  verificationStatus: string;
  observedAt: string;
};

type Station = {
  id: string;
  name: string;
  brand: string;
  state: string;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  latestPrices: FuelPrice[];
};

type Alert = {
  id: string;
  productType: string;
  state: string;
  condition: "at_or_below" | "at_or_above";
  thresholdNaira: number;
  active: boolean;
  createdAt: string;
};

type AlertEvent = {
  id: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};

type FinderMeta = {
  states: string[];
  products: string[];
  brands: string[];
  citiesByState: Record<string, string[]>;
  stationCount: number;
  statesWithStations: string[];
};
type CommunityReport = {
  id: string;
  locationName: string;
  brand: string;
  state: string;
  lga: string;
  city: string;
  latitude: number;
  longitude: number;
  category: "filling_station" | "terminal";
  fuelType: string;
  priceNaira: number;
  unit: string;
  availability: string;
  sourceType: string;
  observedAt: string;
  submittedAt: string;
  validationStatus: string;
  freshnessStatus: string;
  independentReportCount: number;
};
type CommunityAverage = {
  id: string;
  scope: string;
  aggregationKey: string;
  fuelType: string;
  averagePrice: number | string;
  observationCount: number;
  independentReportCount: number;
  freshnessStatus: string;
  sourceType: string;
  reportingPeriod: string;
};
type CommunityLocation = {
  id: string;
  name: string;
  brand: string;
  state: string;
  lga: string;
  city: string;
  latitude: number;
  longitude: number;
  approvalStatus: string;
  kind: "station" | "terminal";
};
type CommunityPriceHistory = {
  id: string;
  submissionId: string;
  priceNaira: number;
  sourceType: string;
  validationStatus: string;
  changedAt: string;
};

const PRODUCT_LABELS: Record<string, string> = {
  PMS: "Petrol (PMS)",
  AGO: "Diesel (AGO)",
  LPG: "Cooking gas (LPG)",
};

const priceUnit = (productType: string) => productType === "LPG" ? "per kg" : "per litre";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

async function requestJson<T>(url: string, method: string, data?: unknown, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (data !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
    credentials: "include",
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Request could not be completed");
  return payload as T;
}

function sourceLabel(price: FuelPrice) {
  if (price.source === "nnpc_api" && price.verificationStatus === "verified") return "Verified NNPC feed";
  if (price.verificationStatus === "verified") return "Admin verified";
  if (price.verificationStatus === "reported") return "Reviewed community report";
  return "Manually entered · unverified";
}

function availabilityLabel(value: string) {
  if (value === "available") return "Available";
  if (value === "limited") return "Limited";
  if (value === "unavailable") return "Unavailable";
  return "Availability unknown";
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time not available"
    : date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function isStale(value: string) {
  const time = new Date(value).getTime();
  return !Number.isFinite(time) || Date.now() - time > 24 * 60 * 60 * 1000;
}

export default function FuelFinderPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [brand, setBrand] = useState("");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<(typeof FUEL_FINDER_PRODUCTS)[number]>("PMS");
  const [selectedStationId, setSelectedStationId] = useState("");
  const [reportStationId, setReportStationId] = useState("");
  const [reportAvailability, setReportAvailability] = useState("available");
  const [reportPrice, setReportPrice] = useState("");
  const [reportComment, setReportComment] = useState("");
  const [alertState, setAlertState] = useState("Lagos");
  const [alertCondition, setAlertCondition] = useState<"at_or_below" | "at_or_above">("at_or_below");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);
  const [communityCategory, setCommunityCategory] = useState<"all" | "filling_station" | "terminal">("all");
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [showCommunityHistory, setShowCommunityHistory] = useState(false);

  const metaQuery = useQuery<FinderMeta>({
    queryKey: ["/api/fuel-finder/meta"],
    queryFn: async () => {
      const response = await fetch("/api/fuel-finder/meta");
      if (!response.ok) throw new Error("Fuel finder filters could not be loaded");
      return response.json();
    },
    staleTime: 60_000,
  });

  const stationsQuery = useQuery<{ stations: Station[] }>({
    queryKey: ["/api/fuel-finder/stations", state, city, brand, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (state) params.set("state", state);
      if (city) params.set("city", city);
      if (brand) params.set("brand", brand);
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/fuel-finder/stations?${params.toString()}`);
      if (!response.ok) throw new Error("Stations could not be loaded");
      return response.json();
    },
    refetchInterval: 60_000,
  });

  const communityQuery = useQuery<{ submissions: CommunityReport[]; averages: CommunityAverage[]; stations: CommunityLocation[] }>({
    queryKey: ["/api/community/discovery", state, city, brand, search, product],
    queryFn: async () => {
      const params = new URLSearchParams({ fuelType: product });
      if (state) params.set("state", state);
      if (city) params.set("city", city);
      if (brand) params.set("brand", brand);
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/community/discovery?${params.toString()}`);
      if (!response.ok) throw new Error("Community price reports could not be loaded");
      const result = await response.json();
      return result.data;
    },
    refetchInterval: 60_000,
  });

  const communityHistoryQuery = useQuery<CommunityPriceHistory[]>({
    queryKey: ["/api/community/submissions/history", selectedCommunityReport?.id],
    queryFn: async () => {
      const response = await fetch(`/api/community/submissions/${selectedCommunityReport?.id}/history`);
      if (!response.ok) throw new Error("Price history could not be loaded");
      const result = await response.json();
      return result.data || [];
    },
    enabled: showCommunityHistory && !!selectedCommunityReport,
  });

  const alertsQuery = useQuery<{ alerts: Alert[]; events: AlertEvent[] }>({
    queryKey: ["/api/fuel-finder/alerts"],
    queryFn: authFetch(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const stations = stationsQuery.data?.stations || [];
  const meta = metaQuery.data;
  const currentPrice = (station: Station) => station.latestPrices.find((item) => item.productType === product);
  const selectedStation = stations.find((station) => station.id === selectedStationId) || stations[0];
  const cityOptions = state ? meta?.citiesByState[state] || [] : [];
  const communityReports = (communityQuery.data?.submissions || []).filter((item) =>
    communityCategory === "all" || item.category === communityCategory,
  );
  const selectedCommunityReport = communityReports.find((item) => item.id === selectedCommunityId) || communityReports[0];
  const communityAverages = (communityQuery.data?.averages || []).filter((average) =>
    average.sourceType === "community"
    && (communityCategory === "all" || average.aggregationKey.toLowerCase().includes(communityCategory)),
  );
  const communityLocations = (communityQuery.data?.stations || []).filter((location) =>
    (!state || location.state === state)
    && (!city || location.city.toLowerCase() === city.toLowerCase())
    && (!brand || location.brand.toLowerCase() === brand.toLowerCase())
    && (!search.trim() || [location.name, location.brand, location.state, location.lga, location.city].some((value) => value.toLowerCase().includes(search.toLowerCase()))),
  );

  const comparison = useMemo(() => {
    const quotes = stations.flatMap((station) => {
      const price = station.latestPrices.find((item) => item.productType === product);
      if (!price || price.priceNaira == null || price.verificationStatus !== "verified") return [];
      return [{ brand: station.brand, price: price.priceNaira }];
    });
    const nnpc = quotes.filter((quote) => /nnpc/i.test(quote.brand));
    const other = quotes.filter((quote) => !/nnpc/i.test(quote.brand));
    const average = (items: typeof quotes) => items.length
      ? items.reduce((sum, item) => sum + item.price, 0) / items.length
      : null;
    return { nnpc: average(nnpc), other: average(other), nnpcCount: nnpc.length, otherCount: other.length };
  }, [product, stations]);

  const reportMutation = useMutation({
    mutationFn: () => requestJson("/api/fuel-finder/reports", "POST", {
      stationId: reportStationId,
      productType: product,
      availability: reportAvailability,
      ...(reportPrice ? { priceNaira: Number(reportPrice) } : {}),
      ...(reportComment.trim() ? { comment: reportComment.trim() } : {}),
    }, token),
    onSuccess: () => {
      setReportStationId("");
      setReportPrice("");
      setReportComment("");
      toast({ title: "Report submitted for administrator review" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const createAlertMutation = useMutation({
    mutationFn: () => requestJson("/api/fuel-finder/alerts", "POST", {
      productType: product,
      state: alertState,
      condition: alertCondition,
      thresholdNaira: Number(alertThreshold),
    }, token),
    onSuccess: () => {
      setAlertThreshold("");
      queryClient.invalidateQueries({ queryKey: ["/api/fuel-finder/alerts"] });
      toast({ title: "Price alert created" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id: string) => requestJson(`/api/fuel-finder/alerts/${id}`, "DELETE", undefined, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/fuel-finder/alerts"] }),
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => requestJson(`/api/fuel-finder/alert-events/${id}/read`, "PATCH", {}, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/fuel-finder/alerts"] }),
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const resetFilters = () => {
    setState("");
    setCity("");
    setBrand("");
    setSearch("");
  };

  return (
    <div className="min-h-screen bg-[#060b18] text-white" data-testid="page-fuel-finder">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#060b18]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <Fuel className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-white">FuelIQ NG</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Button variant="outline" size="sm" onClick={() => setShowAlerts((open) => !open)} className="border-white/10 bg-white/[0.03] text-slate-200">
                <Bell className="mr-2 h-4 w-4" />
                Alerts
                {!!alertsQuery.data?.events.filter((event) => !event.readAt).length && (
                  <span className="ml-2 rounded-full bg-emerald-500 px-1.5 text-xs text-slate-950">
                    {alertsQuery.data.events.filter((event) => !event.readAt).length}
                  </span>
                )}
              </Button>
            ) : (
              <Link href="/login" className="text-sm text-slate-300 hover:text-white">Sign in for alerts</Link>
            )}
            {user?.role === "admin" && (
              <Link href="/admin/panel" className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300">
                Admin
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">Nigeria Fuel Price Finder</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Find stations. Compare reported prices.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Browse published station records and compare only prices with a clear source and timestamp. Manual and community reports are labelled separately from verified feed data.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Directory records</p>
            <p className="mt-1 text-2xl font-bold">{meta?.stationCount ?? "—"}</p>
            <p className="text-xs text-slate-500">{meta?.statesWithStations.length ?? 0} states with published records</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5" aria-label="Station filters">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
            <label className="relative">
              <span className="sr-only">Search stations</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Station, brand, city or address" className="border-white/10 bg-[#0b1220] pl-9 text-white" />
            </label>
            <select value={state} onChange={(event) => { setState(event.target.value); setCity(""); }} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white">
              <option value="">All 36 states + FCT</option>
              {NIGERIAN_STATES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={city} onChange={(event) => setCity(event.target.value)} disabled={!state} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white disabled:opacity-50">
              <option value="">All cities{state ? ` in ${state}` : ""}</option>
              {cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={brand} onChange={(event) => setBrand(event.target.value)} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white">
              <option value="">All brands</option>
              {(meta?.brands || []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Button variant="outline" onClick={resetFilters} className="border-white/10 bg-white/[0.03] text-slate-300">Reset</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {FUEL_FINDER_PRODUCTS.map((item) => (
              <button
                key={item}
                onClick={() => setProduct(item)}
                className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${product === item ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white"}`}
              >
                {PRODUCT_LABELS[item]}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-500">
              {stationsQuery.isFetching ? "Refreshing…" : `${stations.length} station${stations.length === 1 ? "" : "s"} found`}
            </span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <ComparisonCard
            title="Verified NNPC price average"
            value={comparison.nnpc}
            count={comparison.nnpcCount}
            product={`${PRODUCT_LABELS[product]} · ${priceUnit(product)}`}
            color="emerald"
          />
          <ComparisonCard
            title="Other-brand verified average"
            value={comparison.other}
            count={comparison.otherCount}
            product={`${PRODUCT_LABELS[product]} · ${priceUnit(product)}`}
            color="blue"
          />
        </section>
        {(!comparison.nnpcCount || !comparison.otherCount) && (
          <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Comparison uses verified observations only. An average is withheld when there are no qualifying records; no prices are estimated.
          </p>
        )}

        <section className="space-y-4 rounded-2xl border border-sky-400/15 bg-sky-400/[0.025] p-4 sm:p-5" aria-label="Community price reports">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Community price intelligence</p>
              <h2 className="mt-1 text-xl font-semibold">Recent independent observations</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">Community averages are calculated from eligible reports and are not official NNPC prices. Operator updates are labelled separately. Old reports are shown with their freshness status, never as live prices.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Report category" value={communityCategory} onChange={(event) => setCommunityCategory(event.target.value as typeof communityCategory)} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-xs text-white">
                <option value="all">Retail + terminals</option><option value="filling_station">Retail stations</option><option value="terminal">Terminals</option>
              </select>
              <Button asChild size="sm" className="bg-sky-500 text-slate-950 hover:bg-sky-400"><Link href={user ? "/community" : "/register"}>Submit a price</Link></Button>
            </div>
          </div>

          {communityQuery.isError && <ErrorBanner message={(communityQuery.error as Error).message} />}
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-black/10">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
                <div><p className="text-sm font-medium">Community report map</p><p className="text-[11px] text-slate-500">Select an observation to inspect its location</p></div>
                <MapPin className="h-4 w-4 text-sky-300" />
              </div>
              {selectedCommunityReport ? (
                <>
                  <iframe
                    title={`Map location for ${selectedCommunityReport.locationName}`}
                    src={`https://maps.google.com/maps?q=${selectedCommunityReport.latitude},${selectedCommunityReport.longitude}&z=14&output=embed`}
                    className="h-64 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <p className="px-3 py-2 text-xs text-slate-400">{selectedCommunityReport.locationName} · {selectedCommunityReport.city}, {selectedCommunityReport.state}</p>
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-sky-300" onClick={() => setShowCommunityHistory((visible) => !visible)}>
                      {showCommunityHistory ? "Hide price history" : "View price history"}
                    </Button>
                    {showCommunityHistory && (
                      <div className="mt-2 space-y-2">
                        {communityHistoryQuery.isLoading ? <p className="text-xs text-slate-400">Loading history…</p>
                          : communityHistoryQuery.isError ? <p className="text-xs text-red-300">{(communityHistoryQuery.error as Error).message}</p>
                            : communityHistoryQuery.data?.length ? communityHistoryQuery.data.map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                                <span className="text-slate-400">{entry.sourceType === "operator" ? "Operator update" : "Community report"} · {formatTime(entry.changedAt)}</span>
                                <span className="font-medium text-white">{naira.format(Number(entry.priceNaira))}</span>
                              </div>
                            )) : <p className="text-xs text-slate-500">No price changes have been recorded for this report.</p>}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-64 items-center justify-center px-5 text-center text-sm text-slate-500">No eligible community observations match these filters.</div>
              )}
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {communityQuery.isLoading ? <p className="rounded-xl border border-white/[0.06] p-5 text-sm text-slate-400">Loading observations…</p> : communityReports.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No published community reports match these filters. No price is estimated.</p>
              ) : communityReports.map((report) => (
                <button key={report.id} onClick={() => setSelectedCommunityId(report.id)} className={`w-full rounded-xl border p-3 text-left ${selectedCommunityReport?.id === report.id ? "border-sky-400/30 bg-sky-400/[0.06]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="text-xs font-semibold uppercase tracking-wider text-sky-300">{report.brand} · {report.category === "terminal" ? "Terminal" : "Retail station"}</p><p className="mt-1 text-sm font-medium text-white">{report.locationName}</p><p className="text-xs text-slate-400">{report.city}, {report.lga}, {report.state}</p></div>
                    <div className="text-right"><p className="font-semibold">{naira.format(Number(report.priceNaira))}</p><p className="text-[11px] text-slate-500">per {report.unit}</p></div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>{report.sourceType === "operator" ? "Operator update" : "Community report"}</span>
                    <span>{availabilityLabel(report.availability)}</span>
                    <span>{report.independentReportCount} independent report{report.independentReportCount === 1 ? "" : "s"}</span>
                    <span className={report.freshnessStatus === "fresh" ? "text-emerald-300" : report.freshnessStatus === "under_review" ? "text-red-300" : "text-amber-300"}>{report.freshnessStatus}</span>
                    <span>Observed {formatTime(report.observedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Server-calculated community averages</h3>
            {communityAverages.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {communityAverages.slice(0, 12).map((average) => (
                  <div key={average.id} className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                    <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-slate-300">{average.scope} · {average.fuelType}</p><span className="text-[10px] text-slate-500">{average.reportingPeriod}</span></div>
                    <p className="mt-1 break-all text-[11px] text-slate-500">{average.aggregationKey}</p>
                    <p className="mt-2 text-lg font-bold">{naira.format(Number(average.averagePrice))}</p>
                    <p className="text-[11px] text-slate-400">{average.observationCount} observations · {average.independentReportCount} independent reporters · {average.freshnessStatus}</p>
                  </div>
                ))}
              </div>
            ) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">No eligible community averages are available for this fuel and location yet.</p>}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Approved community-registered locations</h3>
            {communityLocations.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {communityLocations.slice(0, 12).map((location) => (
                  <article key={location.id} className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">{location.brand} · {location.kind === "terminal" ? "Terminal" : "Retail station"}</p>
                    <p className="mt-1 text-sm font-medium">{location.name}</p>
                    <p className="text-xs text-slate-400">{location.city}, {location.lga}, {location.state}</p>
                    <p className="mt-2 text-[11px] text-slate-500">Business registration approved; not an official NNPC designation.</p>
                    <a className="mt-2 inline-flex text-xs text-sky-300" href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Open location map <ExternalLink className="ml-1 h-3 w-3" /></a>
                  </article>
                ))}
              </div>
            ) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">No approved community-registered locations match these filters.</p>}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {stationsQuery.isError && <ErrorBanner message={(stationsQuery.error as Error).message} />}
            {stationsQuery.isLoading ? (
              <div className="rounded-2xl border border-white/[0.06] p-6 text-sm text-slate-400">Loading station directory…</div>
            ) : stations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                <MapPin className="mx-auto h-8 w-8 text-slate-600" />
                <h2 className="mt-3 text-lg font-semibold">No published station records yet</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                  The state directory filters are ready, but no verified station directory has been imported. Administrators can add confirmed records or connect an authorised NNPC feed.
                </p>
              </div>
            ) : stations.map((station) => {
              const price = currentPrice(station);
              const selected = station.id === (selectedStation?.id || selectedStationId);
              return (
                <article key={station.id} className={`rounded-2xl border bg-white/[0.025] p-4 sm:p-5 ${selected ? "border-emerald-400/30" : "border-white/[0.06]"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button className="min-w-0 text-left" onClick={() => setSelectedStationId(station.id)}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{station.brand}</p>
                      <h2 className="mt-1 truncate text-base font-semibold text-white">{station.name}</h2>
                      <p className="mt-1 text-sm text-slate-400">{station.city}, {station.state}{station.address ? ` · ${station.address}` : ""}</p>
                    </button>
                    <div className="text-right">
                      {price?.priceNaira != null ? (
                        <p className="text-xl font-bold">{naira.format(price.priceNaira)} <span className="text-xs font-medium text-slate-400">{priceUnit(product)}</span></p>
                      ) : (
                        <p className="text-sm font-medium text-slate-400">No price shared</p>
                      )}
                      <p className="text-xs text-slate-500">{PRODUCT_LABELS[product]}</p>
                    </div>
                  </div>
                  {price ? (
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3 text-xs">
                      <span className={`rounded-full px-2.5 py-1 ${price.availability === "available" ? "bg-emerald-500/10 text-emerald-300" : price.availability === "unavailable" ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"}`}>{availabilityLabel(price.availability)}</span>
                      <span className={price.verificationStatus === "verified" ? "inline-flex items-center gap-1 text-emerald-300" : "text-amber-300"}>
                        {price.verificationStatus === "verified" && <ShieldCheck className="h-3.5 w-3.5" />}
                        {sourceLabel(price)}
                      </span>
                      <span className={isStale(price.observedAt) ? "text-amber-400" : "text-slate-500"}>
                        {isStale(price.observedAt) ? "Stale · " : ""}{formatTime(price.observedAt)}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-slate-500">No {PRODUCT_LABELS[product]} observation has been published for this station.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedStationId(station.id); setReportStationId(reportStationId === station.id ? "" : station.id); }} className="border-white/10 bg-white/[0.03] text-slate-300">
                      Report availability
                    </Button>
                    {station.latitude != null && station.longitude != null && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center rounded-md border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/[0.05]"
                      >
                        Open in Google Maps <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {reportStationId === station.id && (
                    <div className="mt-4 grid gap-3 rounded-xl border border-white/[0.06] bg-black/10 p-3 sm:grid-cols-2">
                      {!user ? (
                        <p className="text-sm text-slate-400 sm:col-span-2">Sign in to submit an availability report. Reports are reviewed before appearing in the directory.</p>
                      ) : (
                        <>
                          <select value={reportAvailability} onChange={(event) => setReportAvailability(event.target.value)} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white">
                            <option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option>
                          </select>
                          <Input type="number" min="1" step="0.01" value={reportPrice} onChange={(event) => setReportPrice(event.target.value)} placeholder={`Optional price per ${priceUnit(product)} in ₦`} className="border-white/10 bg-[#0b1220] text-white" />
                          <Input value={reportComment} onChange={(event) => setReportComment(event.target.value)} maxLength={500} placeholder="Optional note" className="border-white/10 bg-[#0b1220] text-white sm:col-span-2" />
                          <Button disabled={reportMutation.isPending} onClick={() => reportMutation.mutate()} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 sm:col-span-2">
                            Submit for review
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">Station map</h2>
                  <p className="text-xs text-slate-500">Google Maps · station coordinates only</p>
                </div>
                <MapPin className="h-4 w-4 text-emerald-400" />
              </div>
              {selectedStation?.latitude != null && selectedStation.longitude != null ? (
                <iframe
                  title={`Map location for ${selectedStation.name}`}
                  src={`https://maps.google.com/maps?q=${selectedStation.latitude},${selectedStation.longitude}&z=14&output=embed`}
                  className="h-72 w-full border-0 sm:h-96"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-72 flex-col items-center justify-center px-6 text-center sm:h-96">
                  <MapPin className="h-8 w-8 text-slate-600" />
                  <p className="mt-3 text-sm font-medium text-slate-300">No mapped station location</p>
                  <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">A station map appears when an administrator adds coordinates for a published station. We do not guess locations.</p>
                </div>
              )}
              {selectedStation && <p className="px-4 py-3 text-xs text-slate-500">{selectedStation.name} · {selectedStation.city}, {selectedStation.state}</p>}
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Create a price alert</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">One-time in-app notification when an admin or verified feed publishes a matching price.</p>
                </div>
                <Bell className="h-4 w-4 text-emerald-400" />
              </div>
              {user ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <select value={alertState} onChange={(event) => setAlertState(event.target.value)} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white">
                    {NIGERIAN_STATES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={alertCondition} onChange={(event) => setAlertCondition(event.target.value as typeof alertCondition)} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white">
                    <option value="at_or_below">At or below</option><option value="at_or_above">At or above</option>
                  </select>
                  <Input type="number" min="1" step="0.01" value={alertThreshold} onChange={(event) => setAlertThreshold(event.target.value)} placeholder="Threshold in ₦" className="border-white/10 bg-[#0b1220] text-white sm:col-span-2" />
                  <Button disabled={!alertThreshold || createAlertMutation.isPending} onClick={() => createAlertMutation.mutate()} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 sm:col-span-2">
                    Create {PRODUCT_LABELS[product]} alert
                  </Button>
                  <div className="text-xs text-slate-500 sm:col-span-2">
                    {alertsQuery.data?.alerts.filter((alert) => alert.active).length || 0} active alert(s)
                  </div>
                  {alertsQuery.data?.alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-xs sm:col-span-2">
                      <span className="text-slate-300">{PRODUCT_LABELS[alert.productType]} · {alert.state} · {alert.condition === "at_or_below" ? "≤" : "≥"} {naira.format(alert.thresholdNaira)} · {alert.active ? "Active" : "Triggered"}</span>
                      <button aria-label="Delete alert" onClick={() => deleteAlertMutation.mutate(alert.id)} className="text-slate-500 hover:text-red-300"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <Link href="/login" className="mt-4 inline-flex text-sm font-medium text-emerald-300 hover:text-emerald-200">Sign in to save price alerts →</Link>
              )}
            </div>
          </div>
        </section>
      </main>

      {showAlerts && user && (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#080e1b] p-5 shadow-2xl" aria-label="Price notifications">
          <div className="flex items-center justify-between">
            <div><h2 className="text-lg font-semibold">Price notifications</h2><p className="text-xs text-slate-500">In-app alerts from published price updates</p></div>
            <Button variant="ghost" size="icon" onClick={() => setShowAlerts(false)} aria-label="Close notifications"><X className="h-4 w-4" /></Button>
          </div>
          <div className="mt-5 space-y-3">
            {!alertsQuery.data?.events.length ? (
              <p className="rounded-xl border border-white/[0.06] p-4 text-sm text-slate-500">No notifications yet.</p>
            ) : alertsQuery.data.events.map((event) => (
              <div key={event.id} className="rounded-xl border border-white/[0.06] p-4">
                <p className="text-sm text-slate-200">{event.message}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">{formatTime(event.createdAt)}</span>
                  {event.readAt ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <button onClick={() => markReadMutation.mutate(event.id)} className="text-xs text-emerald-300 hover:text-emerald-200">Mark read</button>}
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

function ComparisonCard({ title, value, count, product, color }: { title: string; value: number | null; count: number; product: string; color: "emerald" | "blue" }) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${color === "emerald" ? "border-emerald-500/15 bg-emerald-500/[0.035]" : "border-blue-500/15 bg-blue-500/[0.035]"}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <ArrowUpDown className={`h-4 w-4 ${color === "emerald" ? "text-emerald-400" : "text-blue-400"}`} /> {title}
      </div>
      <p className="mt-3 text-2xl font-bold">{value == null ? "—" : naira.format(value)}</p>
      <p className="mt-1 text-xs text-slate-500">{count ? `Average from ${count} verified ${product} station record${count === 1 ? "" : "s"}` : `No verified ${product} prices available`}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">{message}</div>;
}
