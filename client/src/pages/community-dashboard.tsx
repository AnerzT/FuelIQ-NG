import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Bell, CheckCircle2, Clock3, Fuel, LocateFixed, MapPin, Pencil, ShieldCheck, Store, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { COMMUNITY_FUEL_TYPES, NIGERIAN_STATES } from "@shared/nigeria";

type Profile = {
  customerId: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  accountStatus: string;
  lastLoginAt: string | null;
  createdAt: string;
  notificationPreferences: Record<string, boolean>;
};
type Submission = {
  id: string;
  locationName: string;
  brand: string;
  category: "filling_station" | "terminal";
  fuelType: string;
  priceNaira: number;
  unit: string;
  state: string;
  city: string;
  availability: string;
  validationStatus: string;
  moderationStatus: string;
  validationReasons: string[];
  sourceType: string;
  observedAt: string;
  submittedAt: string;
  comments?: string;
};
type Location = {
  id: string;
  name: string;
  brand: string;
  state: string;
  lga: string;
  city: string;
  latitude: number;
  longitude: number;
  approvalStatus: string;
  productsSold: string[];
};
type DashboardData = {
  profile: Profile;
  stats: Record<string, number>;
  activities: Array<{ id: string; action: string; entityType: string; createdAt: string }>;
  submissions: Submission[];
  notifications: Array<{ id: string; title: string; message: string; createdAt: string; readAt: string | null }>;
  activityAnalytics: Array<{ day: string; submissions: number; pms: number | string | null; ago: number | string | null; dpk: number | string | null; lpg: number | string | null }>;
  period: "daily" | "weekly" | "monthly";
};
type LocationsData = { stations: Location[]; terminals: Location[] };

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
const emptyBusiness = {
  name: "", brand: "", businessCategory: "retail_filling_station", operatorName: "", contactPhone: "",
  businessEmail: "", state: "", lga: "", city: "", physicalAddress: "", latitude: "", longitude: "",
  productsSold: ["PMS"], operatingStatus: "operating", businessRegistrationDetails: "",
};

async function api<T>(url: string, token: string | null, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Request could not be completed.");
  return payload.data as T;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-sm"><span className="text-slate-300">{label}</span>{children}</label>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Activity }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between"><span className="text-xs text-slate-400">{label}</span><Icon className="h-4 w-4 text-emerald-400" /></div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function CommunityDashboard() {
  const { user, token, refreshUser } = useAuth();
  const { toast } = useToast();
  const [section, setSection] = useState<"overview" | "report" | "business" | "history" | "notifications" | "operator">("overview");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [trendFuel, setTrendFuel] = useState("PMS");
  const [locationKind, setLocationKind] = useState<"station" | "terminal">("station");
  const [gpsError, setGpsError] = useState("");
  const [report, setReport] = useState({
    locationName: "", brand: "", category: "filling_station" as "filling_station" | "terminal", fuelType: "PMS",
    priceNaira: "", unit: "litre", state: "", lga: "", city: "", latitude: "", longitude: "",
    observedAt: new Date().toISOString().slice(0, 16), availability: "available", comments: "",
  });
  const [business, setBusiness] = useState(emptyBusiness);
  const [operatorPrice, setOperatorPrice] = useState({ locationId: "", fuelType: "PMS", priceNaira: "", availability: "available" });
  const [editing, setEditing] = useState<Submission | null>(null);
  const [displayName, setDisplayName] = useState(user?.name || "");

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ["/api/community/dashboard", period],
    queryFn: () => api(`/api/community/dashboard?period=${period}`, token),
    enabled: !!token,
    refetchInterval: 60_000,
  });
  const locationsQuery = useQuery<LocationsData>({
    queryKey: ["/api/community/locations"],
    queryFn: () => api("/api/community/locations", token),
    enabled: !!token,
  });
  const data = dashboardQuery.data;
  const locations = locationsQuery.data || { stations: [], terminals: [] };
  const approvedLocations = [...locations.stations, ...locations.terminals].filter((location) => location.approvalStatus === "approved");

  const activityChart = useMemo(() => {
    const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
    return (data?.activityAnalytics || []).slice(-days).map((item) => ({ date: item.day.slice(5), reports: item.submissions }));
  }, [data?.activityAnalytics, period]);
  const priceChart = useMemo(() => (data?.activityAnalytics || []).slice(-30).map((item) => ({
    date: new Date(`${item.day}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
    price: item[trendFuel.toLowerCase() as "pms" | "ago" | "dpk" | "lpg"] == null
      ? null : Number(item[trendFuel.toLowerCase() as "pms" | "ago" | "dpk" | "lpg"]),
  })), [data?.activityAnalytics, trendFuel]);

  const submitMutation = useMutation({
    mutationFn: () => api<Submission>("/api/community/submissions", token, "POST", {
      ...report,
      priceNaira: Number(report.priceNaira),
      latitude: Number(report.latitude),
      longitude: Number(report.longitude),
      observedAt: new Date(report.observedAt).toISOString(),
      unit: report.fuelType === "LPG" ? "kg" : "litre",
      ...(report.category === "terminal" ? { terminalId: undefined } : {}),
    }),
    onSuccess: async () => {
      toast({ title: "Community price submitted", description: "The report is timestamped and will be included in averages when eligible." });
      setReport((value) => ({ ...value, priceNaira: "", comments: "" }));
      await queryClient.invalidateQueries({ queryKey: ["/api/community/dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/community/discovery"] });
    },
    onError: (error: Error) => toast({ title: "Submission failed", description: error.message, variant: "destructive" }),
  });
  const businessMutation = useMutation({
    mutationFn: () => api<Location>(`/api/community/locations/${locationKind}`, token, "POST", {
      ...business,
      latitude: Number(business.latitude),
      longitude: Number(business.longitude),
      productsSold: business.productsSold,
      businessCategory: locationKind === "terminal" ? "terminal" : business.businessCategory,
    }),
    onSuccess: async () => {
      toast({ title: "Business registration submitted", description: "The location will not receive a verified badge until approved by an administrator." });
      setBusiness({ ...emptyBusiness });
      await queryClient.invalidateQueries({ queryKey: ["/api/community/locations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/community/dashboard"] });
    },
    onError: (error: Error) => toast({ title: "Registration failed", description: error.message, variant: "destructive" }),
  });
  const operatorMutation = useMutation({
    mutationFn: () => {
      const location = approvedLocations.find((item) => item.id === operatorPrice.locationId);
      if (!location) throw new Error("Select an approved location you own.");
      const category = locations.terminals.some((item) => item.id === location.id) ? "terminal" : "filling_station";
      return api("/api/operator/prices", token, "POST", {
        locationName: location.name, brand: location.brand, category, fuelType: operatorPrice.fuelType,
        priceNaira: Number(operatorPrice.priceNaira), unit: operatorPrice.fuelType === "LPG" ? "kg" : "litre",
        state: location.state, lga: location.lga, city: location.city, latitude: Number(location.latitude),
        longitude: Number(location.longitude), observedAt: new Date().toISOString(), availability: operatorPrice.availability,
        ...(category === "terminal" ? { terminalId: location.id } : { stationId: location.id }),
      });
    },
    onSuccess: async () => {
      toast({ title: "Operator price update published", description: "It is labelled as an operator update, separate from community observations." });
      setOperatorPrice((value) => ({ ...value, priceNaira: "" }));
      await queryClient.invalidateQueries({ queryKey: ["/api/operator/dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/community/dashboard"] });
    },
    onError: (error: Error) => toast({ title: "Price update failed", description: error.message, variant: "destructive" }),
  });
  const editMutation = useMutation({
    mutationFn: (value: Submission) => api(`/api/community/submissions/${value.id}`, token, "PATCH", {
      priceNaira: Number(value.priceNaira), availability: value.availability, comments: value.comments,
    }),
    onSuccess: async () => {
      setEditing(null);
      toast({ title: "Report updated" });
      await queryClient.invalidateQueries({ queryKey: ["/api/community/dashboard"] });
    },
    onError: (error: Error) => toast({ title: "Could not edit report", description: error.message, variant: "destructive" }),
  });
  const withdrawMutation = useMutation({
    mutationFn: (id: string) => api(`/api/community/submissions/${id}`, token, "DELETE"),
    onSuccess: async () => {
      toast({ title: "Report withdrawn" });
      await queryClient.invalidateQueries({ queryKey: ["/api/community/dashboard"] });
    },
    onError: (error: Error) => toast({ title: "Could not withdraw report", description: error.message, variant: "destructive" }),
  });
  const notificationMutation = useMutation({
    mutationFn: (id: string) => api(`/api/community/notifications/${id}/read`, token, "PATCH", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/community/dashboard"] }),
  });

  const getCurrentLocation = (target: "report" | "business") => {
    if (!navigator.geolocation) {
      setGpsError("GPS location is unavailable in this browser. You can enter coordinates manually.");
      return;
    }
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (target === "report") setReport((value) => ({ ...value, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
        else setBusiness((value) => ({ ...value, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
      },
      () => setGpsError("Location access was denied or unavailable. You can enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api("/api/auth/profile", token, "PATCH", { name: displayName });
      await refreshUser();
      toast({ title: "Profile updated" });
    } catch (error) {
      toast({ title: "Profile update failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    }
  };
  const savePreferences = async (key: string, enabled: boolean) => {
    try {
      await api("/api/community/notification-preferences", token, "PATCH", {
        preferences: { ...(data?.profile.notificationPreferences || {}), [key]: enabled },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/community/dashboard"] });
    } catch (error) {
      toast({ title: "Preference update failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    }
  };

  if (dashboardQuery.isLoading) return <div className="min-h-screen bg-[#060b18] p-10 text-slate-400">Loading customer dashboard…</div>;
  if (dashboardQuery.isError) return <div className="min-h-screen bg-[#060b18] p-10 text-red-300">{(dashboardQuery.error as Error).message}</div>;
  const verified = Boolean(data?.profile.emailVerified || data?.profile.phoneVerified);
  const approved = data?.profile.accountStatus === "approved";

  return (
    <main className="min-h-screen bg-[#060b18] px-4 py-8 text-white sm:px-6 lg:px-8" data-testid="page-community-dashboard">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Fuel className="h-7 w-7 text-emerald-400" />
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Customer workspace</p><h1 className="text-2xl font-bold">Community price intelligence</h1></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/fuel-finder"><MapPin className="mr-2 h-4 w-4" />Find fuel</Link></Button>
            <Button variant="outline" onClick={() => setSection("operator")}><Store className="mr-2 h-4 w-4" />Operator tools</Button>
            {user?.role === "admin" && <Button asChild><Link href="/admin/community">Community admin</Link></Button>}
          </div>
        </header>

        <section className={`rounded-2xl border p-4 ${approved && verified ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-amber-400/20 bg-amber-500/[0.06]"}`}>
          <div className="flex items-start gap-3">
            {approved && verified ? <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-400" /> : <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-300" />}
            <div className="flex-1">
              <p className="font-semibold">{approved && verified ? "Verified and approved" : "Community reporting is locked"}</p>
              <p className="mt-1 text-sm text-slate-300">
                Contact verification: {verified ? "complete" : "required"} · administrator approval: {data?.profile.accountStatus.replace("_", " ")}.
              </p>
            </div>
            {!verified && <Button asChild size="sm"><Link href="/verify-account">Verify contact</Link></Button>}
          </div>
        </section>

        <nav className="flex flex-wrap gap-2">
          {([
            ["overview", "Overview"], ["report", "Submit price"], ["business", "Register location"],
            ["history", "My reports"], ["notifications", "Notifications"], ["operator", "Operator"],
          ] as const).map(([key, title]) => (
            <button key={key} onClick={() => setSection(key)} className={`rounded-full border px-4 py-2 text-sm ${section === key ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.02] text-slate-400"}`}>{title}</button>
          ))}
        </nav>

        {section === "overview" && (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Price submissions" value={data?.stats.totalSubmissions ?? 0} icon={Activity} />
              <Stat label="Submitted today" value={data?.stats.todaySubmissions ?? 0} icon={Clock3} />
              <Stat label="Registered stations" value={data?.stats.stationsRegistered ?? 0} icon={Store} />
              <Stat label="Registered terminals" value={data?.stats.terminalsRegistered ?? 0} icon={Fuel} />
              <Stat label="Community confirmations" value={data?.stats.confirmationsReceived ?? 0} icon={CheckCircle2} />
              <Stat label="Trust score" value={`${data?.stats.trustScore ?? 50}/100`} icon={ShieldCheck} />
              <Stat label="Acceptance rate" value={`${data?.stats.acceptanceRate ?? 0}%`} icon={CheckCircle2} />
              <Stat label="Under review" value={data?.stats.reviewSubmissions ?? 0} icon={TriangleAlert} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Reporting activity</h2><select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="rounded-md border border-white/10 bg-[#0b1220] p-2 text-xs"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={activityChart}><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="date" stroke="#64748b" fontSize={11} /><YAxis allowDecimals={false} stroke="#64748b" fontSize={11} /><Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #ffffff20" }} /><Bar dataKey="reports" fill="#34d399" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">Your reported price trend</h2><select value={trendFuel} onChange={(event) => setTrendFuel(event.target.value)} className="rounded-md border border-white/10 bg-[#0b1220] p-2 text-xs"><option value="PMS">PMS · per litre</option><option value="AGO">AGO · per litre</option><option value="DPK">DPK · per litre</option><option value="LPG">LPG · per kg</option></select></div>
                {priceChart.some((item) => item.price !== null) ? <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={priceChart}><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="date" stroke="#64748b" fontSize={11} /><YAxis stroke="#64748b" fontSize={11} /><Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #ffffff20" }} formatter={(value: number) => money.format(value)} /><Line dataKey="price" name={`${trendFuel} reported price`} stroke="#60a5fa" dot={false} connectNulls /></LineChart></ResponsiveContainer></div> : <p className="py-16 text-center text-sm text-slate-500">No {trendFuel} price observations in the last 30 days.</p>}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <form onSubmit={saveProfile} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <h2 className="mb-3 font-semibold">Customer profile</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name"><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={100} required /></Field>
                  <Field label="Customer ID"><Input value={data?.profile.customerId || ""} readOnly /></Field>
                  <Field label="Email verification"><Input value={data?.profile.emailVerified ? "Verified" : "Not verified"} readOnly /></Field>
                  <Field label="Phone verification"><Input value={data?.profile.phoneVerified ? "Verified" : "Not verified"} readOnly /></Field>
                </div>
                <Button className="mt-4" type="submit">Save profile</Button>
                <p className="mt-3 text-xs text-slate-500">Registered {data?.profile.createdAt ? new Date(data.profile.createdAt).toLocaleDateString("en-NG") : "—"} · Last login {data?.profile.lastLoginAt ? new Date(data.profile.lastLoginAt).toLocaleString("en-NG") : "—"}</p>
              </form>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 lg:w-72">
                <h2 className="mb-3 font-semibold">Notification preferences</h2>
                {["inApp", "priceAlerts", "submissionUpdates", "staleReports"].map((key) => (
                  <label key={key} className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 text-sm text-slate-300">
                    <span>{key === "inApp" ? "In-app notifications" : key.replace(/([A-Z])/g, " $1")}</span>
                    <input type="checkbox" checked={data?.profile.notificationPreferences?.[key] !== false} onChange={(event) => void savePreferences(key, event.target.checked)} />
                  </label>
                ))}
              </div>
            </section>
          </div>
        )}

        {section === "report" && (
          <form onSubmit={(event) => { event.preventDefault(); submitMutation.mutate(); }} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="mb-4"><h2 className="text-lg font-semibold">Submit a community fuel price</h2><p className="text-sm text-slate-400">No photo, receipt or invoice is required. Reports remain clearly labelled as community observations.</p></div>
            {!approved || !verified ? <p className="mb-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">Contact verification and administrator approval are required before public submissions.</p> : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Location category"><select className="h-10 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={report.category} onChange={(event) => setReport({ ...report, category: event.target.value as typeof report.category })}><option value="filling_station">Filling station</option><option value="terminal">Terminal</option></select></Field>
              <Field label="Station or terminal name"><Input required value={report.locationName} onChange={(event) => setReport({ ...report, locationName: event.target.value })} /></Field>
              <Field label="Brand / operator"><Input required value={report.brand} onChange={(event) => setReport({ ...report, brand: event.target.value })} /></Field>
              <Field label="Fuel type"><select className="h-10 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={report.fuelType} onChange={(event) => setReport({ ...report, fuelType: event.target.value, unit: event.target.value === "LPG" ? "kg" : "litre" })}>{COMMUNITY_FUEL_TYPES.map((fuel) => <option key={fuel} value={fuel}>{fuel}</option>)}</select></Field>
              <Field label={`Price (₦ per ${report.fuelType === "LPG" ? "kg" : "litre"})`}><Input type="number" min="0.01" step="0.01" required value={report.priceNaira} onChange={(event) => setReport({ ...report, priceNaira: event.target.value })} /></Field>
              <Field label="Availability"><select className="h-10 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={report.availability} onChange={(event) => setReport({ ...report, availability: event.target.value })}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></Field>
              <Field label="State"><select className="h-10 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" required value={report.state} onChange={(event) => setReport({ ...report, state: event.target.value })}><option value="">Select state</option>{NIGERIAN_STATES.map((state) => <option key={state}>{state}</option>)}</select></Field>
              <Field label="LGA"><Input required value={report.lga} onChange={(event) => setReport({ ...report, lga: event.target.value })} /></Field>
              <Field label="City or town"><Input required value={report.city} onChange={(event) => setReport({ ...report, city: event.target.value })} /></Field>
              <Field label="Latitude"><Input type="number" step="any" min="4" max="14.5" required value={report.latitude} onChange={(event) => setReport({ ...report, latitude: event.target.value })} /></Field>
              <Field label="Longitude"><Input type="number" step="any" min="2" max="15.5" required value={report.longitude} onChange={(event) => setReport({ ...report, longitude: event.target.value })} /></Field>
              <Field label="Observation time"><Input type="datetime-local" required value={report.observedAt} onChange={(event) => setReport({ ...report, observedAt: event.target.value })} /></Field>
              <Field label="Optional comments"><textarea maxLength={500} value={report.comments} onChange={(event) => setReport({ ...report, comments: event.target.value })} className="min-h-10 rounded-md border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-white sm:col-span-2" /></Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={() => getCurrentLocation("report")}><LocateFixed className="mr-2 h-4 w-4" />Use my location</Button>
              <Button type="submit" disabled={!approved || !verified || submitMutation.isPending}>{submitMutation.isPending ? "Submitting…" : "Submit price report"}</Button>
              {gpsError && <p className="text-xs text-amber-300">{gpsError}</p>}
            </div>
          </form>
        )}

        {section === "business" && (
          <form onSubmit={(event) => { event.preventDefault(); businessMutation.mutate(); }} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div className="mb-4"><h2 className="text-lg font-semibold">Register a station or terminal</h2><p className="text-sm text-slate-400">Registration is reviewed by an administrator; customer submissions are not automatically official NNPC records.</p></div>
            {!approved || !verified ? <p className="mb-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">Contact verification and administrator approval are required.</p> : null}
            <div className="mb-4 flex gap-2">
              {(["station", "terminal"] as const).map((kind) => <button type="button" key={kind} onClick={() => setLocationKind(kind)} className={`rounded-full border px-4 py-2 text-sm ${locationKind === kind ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-slate-400"}`}>{kind === "station" ? "Retail station" : "Petroleum terminal"}</button>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {([
                ["Business name", "name"], ["Registered brand / operator", "brand"], ["Owner / operator name", "operatorName"],
                ["Contact phone", "contactPhone"], ["Business email", "businessEmail"], ["LGA", "lga"],
                ["City / town", "city"], ["Full physical address", "physicalAddress"], ["Latitude", "latitude"], ["Longitude", "longitude"],
                ["Business registration details (optional)", "businessRegistrationDetails"],
              ] as const).map(([label, key]) => <Field key={key} label={label}><Input required={!key.includes("businessRegistrationDetails")} value={business[key]} onChange={(event) => setBusiness({ ...business, [key]: event.target.value })} /></Field>)}
              <Field label="State"><select required className="h-10 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={business.state} onChange={(event) => setBusiness({ ...business, state: event.target.value })}><option value="">Select state</option>{NIGERIAN_STATES.map((state) => <option key={state}>{state}</option>)}</select></Field>
              <Field label="Business category"><select disabled={locationKind === "terminal"} className="h-10 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={business.businessCategory} onChange={(event) => setBusiness({ ...business, businessCategory: event.target.value })}><option value="retail_filling_station">Retail filling station</option><option value="petroleum_depot">Petroleum depot</option><option value="other">Other</option></select></Field>
              <Field label="Operating status"><select className="h-10 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={business.operatingStatus} onChange={(event) => setBusiness({ ...business, operatingStatus: event.target.value })}><option value="operating">Operating</option><option value="temporarily_closed">Temporarily closed</option><option value="closed">Closed</option><option value="unknown">Unknown</option></select></Field>
              <Field label="Products sold"><div className="flex flex-wrap gap-x-3 gap-y-2 pt-2">{COMMUNITY_FUEL_TYPES.map((fuel) => <label key={fuel} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={business.productsSold.includes(fuel)} onChange={(event) => setBusiness({ ...business, productsSold: event.target.checked ? [...business.productsSold, fuel] : business.productsSold.filter((item) => item !== fuel) })} />{fuel}</label>)}</div></Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={() => getCurrentLocation("business")}><LocateFixed className="mr-2 h-4 w-4" />Use my location</Button><Button disabled={!approved || !verified || !business.productsSold.length || businessMutation.isPending}>{businessMutation.isPending ? "Submitting…" : "Submit for approval"}</Button>{gpsError && <p className="text-xs text-amber-300">{gpsError}</p>}</div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[...locations.stations.map((location) => ({ ...location, kind: "Station" })), ...locations.terminals.map((location) => ({ ...location, kind: "Terminal" }))].map((location) => <div key={location.id} className="rounded-xl border border-white/[0.07] p-3"><p className="font-medium">{location.name} <span className="text-xs text-slate-500">· {location.kind}</span></p><p className="text-xs text-slate-400">{location.city}, {location.state}</p><p className={`mt-2 text-xs ${location.approvalStatus === "approved" ? "text-emerald-300" : "text-amber-300"}`}>{location.approvalStatus === "approved" ? "Administrator verified" : `Approval ${location.approvalStatus}`}</p></div>)}
            </div>
          </form>
        )}

        {section === "operator" && (
          <div className="space-y-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
            <div><h2 className="text-lg font-semibold">Station owner dashboard</h2><p className="text-sm text-slate-400">Operator-entered updates are labelled separately and do not replace independent reports or area averages.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              {[...locations.stations, ...locations.terminals].map((location) => <div key={location.id} className="rounded-xl border border-white/[0.07] p-4"><p className="font-semibold">{location.name}</p><p className="text-xs text-slate-400">{location.city}, {location.state}</p><p className="mt-2 text-xs text-emerald-300">{location.approvalStatus === "approved" ? "Approved location" : `Approval ${location.approvalStatus}`}</p><a className="mt-2 inline-flex text-xs text-sky-300" href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Map location</a></div>)}
            </div>
            <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); operatorMutation.mutate(); }}>
              <Field label="Approved location"><select required className="h-10 w-full rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={operatorPrice.locationId} onChange={(event) => setOperatorPrice({ ...operatorPrice, locationId: event.target.value })}><option value="">Select your location</option>{approvedLocations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.city}</option>)}</select></Field>
              <Field label="Fuel type"><select className="h-10 w-full rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={operatorPrice.fuelType} onChange={(event) => setOperatorPrice({ ...operatorPrice, fuelType: event.target.value })}>{COMMUNITY_FUEL_TYPES.map((fuel) => <option key={fuel}>{fuel}</option>)}</select></Field>
              <Field label="Current price (₦)"><Input type="number" min="0.01" step="0.01" required value={operatorPrice.priceNaira} onChange={(event) => setOperatorPrice({ ...operatorPrice, priceNaira: event.target.value })} /></Field>
              <Field label="Availability"><select className="h-10 w-full rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={operatorPrice.availability} onChange={(event) => setOperatorPrice({ ...operatorPrice, availability: event.target.value })}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></Field>
              <Button className="md:col-span-4" disabled={!approvedLocations.length || operatorMutation.isPending}>{operatorMutation.isPending ? "Publishing…" : "Publish operator price"}</Button>
            </form>
            {(data?.submissions || []).filter((item) => item.sourceType === "operator").map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-white/[0.06] pt-3 text-sm"><span>{item.locationName} · {item.fuelType}</span><span>{money.format(Number(item.priceNaira))} · {item.availability} · Operator update</span></div>)}
          </div>
        )}

        {section === "history" && (
          <section className="space-y-3">
            {(data?.submissions || []).map((submission) => (
              <article key={submission.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                {editing?.id === submission.id ? (
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Input type="number" min="0.01" step="0.01" value={editing.priceNaira} onChange={(event) => setEditing({ ...editing, priceNaira: Number(event.target.value) })} />
                    <select className="rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm" value={editing.availability} onChange={(event) => setEditing({ ...editing, availability: event.target.value })}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select>
                    <Input maxLength={500} value={editing.comments || ""} onChange={(event) => setEditing({ ...editing, comments: event.target.value })} placeholder="Optional comment" />
                    <div className="flex gap-2"><Button onClick={() => editMutation.mutate(editing)} disabled={editMutation.isPending}>Save</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="font-semibold">{submission.locationName} <span className="text-xs text-slate-400">· {submission.brand}</span></p><p className="mt-1 text-sm text-slate-300">{submission.fuelType} · {money.format(Number(submission.priceNaira))} / {submission.unit} · {submission.city}, {submission.state}</p><p className="mt-1 text-xs text-slate-500">{submission.sourceType === "operator" ? "Operator update" : "Community report"} · observed {new Date(submission.observedAt).toLocaleString("en-NG")} · submitted {new Date(submission.submittedAt).toLocaleString("en-NG")}</p></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs ${submission.validationStatus === "eligible" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{submission.validationStatus === "under_review" ? "Under review" : submission.validationStatus}</span>
                    </div>
                    {submission.validationReasons?.length > 0 && <p className="mt-2 text-xs text-amber-300">{submission.validationReasons.join(" · ")}</p>}
                    {submission.sourceType === "community" && submission.validationStatus === "eligible" && submission.moderationStatus === "published" && Date.now() - new Date(submission.submittedAt).getTime() <= 86_400_000 && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(submission)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="outline" disabled={withdrawMutation.isPending} onClick={() => withdrawMutation.mutate(submission.id)}><Trash2 className="mr-2 h-3.5 w-3.5" />Withdraw</Button><span className="self-center text-xs text-slate-500">Available for 24 hours; changes are audited.</span></div>}
                  </>
                )}
              </article>
            ))}
            {!data?.submissions.length && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No price reports submitted yet.</div>}
          </section>
        )}

        {section === "notifications" && (
          <section className="space-y-3">
            {(data?.notifications || []).map((notification) => <article key={notification.id} className={`rounded-xl border p-4 ${notification.readAt ? "border-white/[0.06] bg-white/[0.02]" : "border-emerald-400/20 bg-emerald-400/[0.04]"}`}><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><Bell className="mt-0.5 h-4 w-4 text-emerald-300" /><div><p className="font-medium">{notification.title}</p><p className="mt-1 text-sm text-slate-400">{notification.message}</p><p className="mt-2 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString("en-NG")}</p></div></div>{!notification.readAt && <Button size="sm" variant="outline" onClick={() => notificationMutation.mutate(notification.id)}>Mark read</Button>}</div></article>)}
            {!data?.notifications.length && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No notifications yet.</div>}
          </section>
        )}
      </div>
    </main>
  );
}
