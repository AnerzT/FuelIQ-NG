import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { FUEL_FINDER_PRODUCTS, NIGERIAN_STATES } from "@shared/schema";

type AdminStation = {
  id: string;
  name: string;
  brand: string;
  state: string;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  active: boolean;
  latestPrices: Array<{
    id: string;
    productType: string;
    priceNaira: number | null;
    availability: string;
    source: string;
    verificationStatus: string;
    observedAt: string;
  }>;
};

type AdminReport = {
  id: string;
  stationId: string;
  userId: string;
  productType: string;
  availability: string;
  priceNaira: number | null;
  comment: string | null;
  status: string;
  submittedAt: string;
};

type ToastFn = (input: { title: string; variant?: "destructive" }) => void;

async function postJson<T>(url: string, method: string, body: unknown, token: string | null): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Request could not be completed");
  return payload as T;
}

export function AdminFuelFinderPanel({ token, fetchFn, toast }: { token: string | null; fetchFn: any; toast: ToastFn }) {
  const [stationName, setStationName] = useState("");
  const [brand, setBrand] = useState("");
  const [state, setState] = useState("Lagos");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [editingStationId, setEditingStationId] = useState("");
  const [activeStationId, setActiveStationId] = useState("");
  const [productType, setProductType] = useState<(typeof FUEL_FINDER_PRODUCTS)[number]>("PMS");
  const [priceNaira, setPriceNaira] = useState("");
  const [availability, setAvailability] = useState("unknown");
  const [verified, setVerified] = useState(false);

  const stationsQuery = useQuery<{ stations: AdminStation[] }>({
    queryKey: ["/api/admin/fuel-finder/stations"],
    queryFn: fetchFn,
    enabled: !!token,
  });
  const reportsQuery = useQuery<{ reports: AdminReport[] }>({
    queryKey: ["/api/admin/fuel-finder/reports"],
    queryFn: fetchFn,
    enabled: !!token,
  });
  const nnpcStatusQuery = useQuery<{ configured: boolean }>({
    queryKey: ["/api/admin/fuel-finder/nnpc/status"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/fuel-finder/stations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fuel-finder/stations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fuel-finder/meta"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/fuel-finder/reports"] });
  };

  const createStationMutation = useMutation({
    mutationFn: () => postJson(editingStationId ? `/api/admin/fuel-finder/stations/${editingStationId}` : "/api/admin/fuel-finder/stations", editingStationId ? "PATCH" : "POST", {
      name: stationName,
      brand,
      state,
      city,
      address: address || null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      active: true,
    }, token),
    onSuccess: () => {
      setEditingStationId("");
      setStationName("");
      setBrand("");
      setCity("");
      setAddress("");
      setLatitude("");
      setLongitude("");
      invalidate();
      toast({ title: editingStationId ? "Station details updated" : "Station added to the directory" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const createPriceMutation = useMutation({
    mutationFn: () => postJson(`/api/admin/fuel-finder/stations/${activeStationId}/prices`, "POST", {
      productType,
      priceNaira: Number(priceNaira),
      availability,
      verified,
    }, token),
    onSuccess: () => {
      setPriceNaira("");
      invalidate();
      toast({ title: verified ? "Verified price observation saved" : "Unverified manual price saved" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const stationMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => postJson(`/api/admin/fuel-finder/stations/${id}`, "PATCH", { active }, token),
    onSuccess: invalidate,
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const reportMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) => postJson(`/api/admin/fuel-finder/reports/${id}`, "PATCH", { status }, token),
    onSuccess: () => {
      invalidate();
      toast({ title: "Availability report reviewed" });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: () => postJson<{ stationsUpdated: number; pricesAdded: number }>("/api/admin/fuel-finder/nnpc/sync", "POST", {}, token),
    onSuccess: (result) => {
      invalidate();
      toast({ title: `NNPC sync complete: ${result.stationsUpdated} stations, ${result.pricesAdded} price records` });
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  const stations = stationsQuery.data?.stations || [];
  const pendingReports = (reportsQuery.data?.reports || []).filter((report) => report.status === "pending");
  const selectedStation = stations.find((station) => station.id === activeStationId);

  const beginEditStation = (station: AdminStation) => {
    setEditingStationId(station.id);
    setStationName(station.name);
    setBrand(station.brand);
    setState(station.state);
    setCity(station.city);
    setAddress(station.address || "");
    setLatitude(station.latitude == null ? "" : String(station.latitude));
    setLongitude(station.longitude == null ? "" : String(station.longitude));
  };

  const cancelEditStation = () => {
    setEditingStationId("");
    setStationName("");
    setBrand("");
    setCity("");
    setAddress("");
    setLatitude("");
    setLongitude("");
  };

  return (
    <div className="space-y-6" data-testid="panel-fuel-finder">
      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-white">{editingStationId ? "Edit station" : "Add confirmed station"}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Only enter stations confirmed by a reliable source. Coordinates are optional but required for map placement.</p>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); createStationMutation.mutate(); }} className="grid gap-3 sm:grid-cols-2">
            <Input required minLength={2} maxLength={200} value={stationName} onChange={(event) => setStationName(event.target.value)} placeholder="Station name" className="border-white/10 bg-[#0b1220] text-white" />
            <Input required maxLength={120} value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Brand" className="border-white/10 bg-[#0b1220] text-white" />
            <select value={state} onChange={(event) => setState(event.target.value)} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white">
              {NIGERIAN_STATES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input required value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" className="border-white/10 bg-[#0b1220] text-white" />
            <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street address (optional)" className="border-white/10 bg-[#0b1220] text-white sm:col-span-2" />
            <Input type="number" step="any" min="-90" max="90" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Latitude (optional)" className="border-white/10 bg-[#0b1220] text-white" />
            <Input type="number" step="any" min="-180" max="180" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Longitude (optional)" className="border-white/10 bg-[#0b1220] text-white" />
            <Button disabled={createStationMutation.isPending || !stationName || !brand || !city || (!!latitude !== !!longitude)} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 sm:col-span-2">
              {editingStationId ? "Save station changes" : "Add station"}
            </Button>
            {editingStationId && <Button type="button" variant="outline" onClick={cancelEditStation} className="border-white/10 bg-white/[0.03] text-slate-300 sm:col-span-2">Cancel edit</Button>}
          </form>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Record a price or availability</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Manual entry is labelled unverified unless you explicitly confirm it. Do not mark an unverified quote as verified.</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs ${nnpcStatusQuery.data?.configured ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}`}>
              {nnpcStatusQuery.data?.configured ? "NNPC feed configured" : "NNPC feed not configured"}
            </span>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); createPriceMutation.mutate(); }} className="grid gap-3 sm:grid-cols-2">
            <select required value={activeStationId} onChange={(event) => setActiveStationId(event.target.value)} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white sm:col-span-2">
              <option value="">Select station</option>
              {stations.filter((station) => station.active).map((station) => <option key={station.id} value={station.id}>{station.name} · {station.city}, {station.state}</option>)}
            </select>
            <select value={productType} onChange={(event) => setProductType(event.target.value as typeof productType)} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white">
              {FUEL_FINDER_PRODUCTS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={availability} onChange={(event) => setAvailability(event.target.value)} className="h-9 rounded-md border border-white/10 bg-[#0b1220] px-3 text-sm text-white">
              <option value="unknown">Availability unknown</option><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option>
            </select>
            <Input required type="number" min="1" max="100000" step="0.01" value={priceNaira} onChange={(event) => setPriceNaira(event.target.value)} placeholder="Price per litre/kg in ₦" className="border-white/10 bg-[#0b1220] text-white sm:col-span-2" />
            <label className="flex items-start gap-2 text-xs leading-5 text-slate-400 sm:col-span-2">
              <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} className="mt-1 accent-emerald-500" />
              I have verified this observation against a reliable source. The UI will label it as admin verified.
            </label>
            <Button disabled={createPriceMutation.isPending || !activeStationId || !priceNaira} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 sm:col-span-2">Save price record</Button>
          </form>
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <Button variant="outline" disabled={!nnpcStatusQuery.data?.configured || syncMutation.isPending} onClick={() => syncMutation.mutate()} className="border-white/10 bg-white/[0.03] text-slate-200">
              <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sync authorised NNPC feed
            </Button>
            <p className="mt-2 text-xs leading-5 text-slate-500">The API key is read only by the server. Configure <code>NNPCL_API_KEY</code> and <code>NNPC_FUEL_FINDER_URL</code> in server secrets.</p>
          </div>
          {selectedStation && <p className="mt-3 text-xs text-slate-500">Selected: {selectedStation.name} · {selectedStation.brand}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="font-semibold text-white">Station directory</h2><p className="mt-1 text-xs text-slate-500">{stations.length} station record(s); no stations are seeded or fabricated.</p></div>
          <a href="/fuel-finder" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200">Public Finder <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
        {stationsQuery.isError ? <p className="text-sm text-red-300">Station records could not be loaded.</p> : stations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Add confirmed station records above or sync a configured authorised feed.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Station</th><th className="pb-3">Location</th><th className="pb-3">Latest prices</th><th className="pb-3">Status</th><th className="pb-3">Action</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {stations.map((station) => (
                  <tr key={station.id}>
                    <td className="py-3"><p className="font-medium text-white">{station.name}</p><p className="text-xs text-slate-500">{station.brand}</p></td>
                    <td className="py-3 text-slate-400">{station.city}, {station.state}{station.latitude != null && <span className="block text-xs text-slate-500">Coordinates saved</span>}</td>
                    <td className="py-3 text-xs text-slate-400">{station.latestPrices.length ? station.latestPrices.map((price) => <span key={price.id} className="mr-2 inline-flex items-center gap-1">{price.productType}: {price.priceNaira == null ? "—" : `₦${price.priceNaira.toLocaleString("en-NG")}`} {price.verificationStatus === "verified" && <ShieldCheck className="h-3 w-3 text-emerald-400" />}</span>) : "No observations"}</td>
                    <td className="py-3"><span className={station.active ? "text-emerald-300" : "text-slate-500"}>{station.active ? "Published" : "Hidden"}</span></td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => beginEditStation(station)} className="text-xs text-emerald-300 hover:text-emerald-200">Edit</button>
                        <button onClick={() => stationMutation.mutate({ id: station.id, active: !station.active })} className="text-xs text-slate-300 hover:text-white">{station.active ? "Hide" : "Publish"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="font-semibold text-white">Availability reports</h2><p className="mt-1 text-xs text-slate-500">Community submissions stay private until reviewed. Approved reports remain labelled as reports.</p></div>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">{pendingReports.length} pending</span>
        </div>
        {reportsQuery.isError ? <p className="text-sm text-red-300">Reports could not be loaded.</p> : pendingReports.length === 0 ? (
          <p className="text-sm text-slate-500">No pending reports.</p>
        ) : (
          <div className="space-y-3">
            {pendingReports.map((report) => {
              const station = stations.find((item) => item.id === report.stationId);
              return (
                <div key={report.id} className="flex flex-col justify-between gap-3 rounded-xl border border-white/[0.06] p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-medium text-white">{station?.name || "Station"} · {report.productType}</p>
                    <p className="mt-1 text-xs text-slate-400">{report.availability}{report.priceNaira != null ? ` · ₦${report.priceNaira.toLocaleString("en-NG")}` : ""} · {station ? `${station.city}, ${station.state}` : "Location unavailable"}</p>
                    {report.comment && <p className="mt-1 text-xs text-slate-500">{report.comment}</p>}
                    <p className="mt-1 text-xs text-slate-600">Submitted {new Date(report.submittedAt).toLocaleString("en-NG")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => reportMutation.mutate({ id: report.id, status: "approved" })} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"><Check className="mr-1 h-4 w-4" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => reportMutation.mutate({ id: report.id, status: "rejected" })} className="border-white/10 bg-white/[0.03] text-slate-300"><X className="mr-1 h-4 w-4" />Reject</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
