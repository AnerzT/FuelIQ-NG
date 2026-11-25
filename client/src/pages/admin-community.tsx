import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, Check, ChevronLeft, Fuel, Shield, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

type Account = {
  profile: {
    userId: string; customerId: string; emailVerified: boolean; phoneVerified: boolean;
    accountStatus: string; createdAt: string; lastLoginAt: string | null;
  };
  user: { id: string; name: string; email: string; phone: string | null; role: string } | null;
};
type Business = {
  id: string; name: string; brand: string; state: string; city: string; ownerUserId: string;
  approvalStatus: string; contactPhone: string; businessEmail: string; submittedAt: string;
  latitude: number; longitude: number; kind?: string;
};
type Submission = {
  id: string; customerUserId: string; locationName: string; brand: string; fuelType: string;
  category: string; priceNaira: number; unit: string; state: string; city: string;
  validationStatus: string; validationReasons: string[]; sourceType: string; observedAt: string;
};
type Dispute = { id: string; submissionId: string; reporterUserId: string; reason: string; details: string | null; createdAt: string; status: string };

async function request<T>(url: string, token: string | null, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Admin request failed.");
  return result.data as T;
}

export default function AdminCommunity() {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"accounts" | "businesses" | "reports" | "disputes" | "analytics">("accounts");
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const accounts = useQuery<Account[]>({ queryKey: ["/api/admin/community/accounts"], queryFn: () => request("/api/admin/community/accounts", token), enabled: !!token });
  const stations = useQuery<Business[]>({ queryKey: ["/api/admin/community/businesses/station"], queryFn: () => request("/api/admin/community/businesses/station", token), enabled: !!token });
  const terminals = useQuery<Business[]>({ queryKey: ["/api/admin/community/businesses/terminal"], queryFn: () => request("/api/admin/community/businesses/terminal", token), enabled: !!token });
  const submissions = useQuery<Submission[]>({ queryKey: ["/api/admin/community/submissions"], queryFn: () => request("/api/admin/community/submissions", token), enabled: !!token });
  const disputes = useQuery<Dispute[]>({ queryKey: ["/api/admin/community/disputes"], queryFn: () => request("/api/admin/community/disputes", token), enabled: !!token });
  const refresh = async () => Promise.all([
    "/api/admin/community/accounts",
    "/api/admin/community/businesses/station",
    "/api/admin/community/businesses/terminal",
    "/api/admin/community/submissions",
    "/api/admin/community/disputes",
  ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  const mutation = useMutation({
    mutationFn: ({ url, body }: { url: string; body: Record<string, string> }) => request(url, token, "PATCH", body),
    onSuccess: refresh,
  });

  if (isLoading) return <div className="min-h-screen bg-[#060b18]" />;
  if (!user || user.role !== "admin") {
    setLocation("/login");
    return null;
  }
  const waitingAccounts = accounts.data?.filter((item) => item.profile.accountStatus === "pending_approval").length || 0;
  const pendingBusinesses = [...(stations.data || []), ...(terminals.data || [])].filter((item) => item.approvalStatus === "pending").length;
  const flaggedReports = submissions.data?.filter((item) => item.validationStatus === "under_review").length || 0;
  const openDisputes = disputes.data?.filter((item) => item.status === "open").length || 0;
  const allBusinesses = [...(stations.data || []), ...(terminals.data || [])];
  const publishedReports = submissions.data?.filter((item) => item.validationStatus === "eligible").length || 0;
  const fuelReportCount = (fuel: string) => submissions.data?.filter((item) => item.fuelType === fuel && item.validationStatus === "eligible").length || 0;

  const exportCsv = async () => {
    const response = await fetch("/api/admin/community/submissions/export", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("CSV export failed.");
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "fuel-price-reports.csv";
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <main className="min-h-screen bg-[#060b18] px-4 py-8 text-white sm:px-6 lg:px-8" data-testid="page-admin-community">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Shield className="h-7 w-7 text-amber-300" /><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Administrator</p><h1 className="text-2xl font-bold">Community control panel</h1></div></div>
          <div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin"><ChevronLeft className="mr-2 h-4 w-4" />Admin home</Link></Button><Button onClick={() => void exportCsv()} variant="outline"><ArrowDownToLine className="mr-2 h-4 w-4" />Export CSV</Button></div>
        </header>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Accounts awaiting approval", waitingAccounts, "text-amber-300"],
            ["Businesses pending review", pendingBusinesses, "text-sky-300"],
            ["Reports under review", flaggedReports, "text-orange-300"],
            ["Open disputes", openDisputes, "text-red-300"],
          ].map(([label, count, color]) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-xs text-slate-400">{label}</p><p className={`mt-2 text-3xl font-bold ${color}`}>{count}</p></div>)}
        </section>
        <nav className="flex flex-wrap gap-2">{([
          ["accounts", "Customer accounts"], ["businesses", "Station & terminal approvals"],
          ["reports", "Price review"], ["disputes", "Disputes"], ["analytics", "Analytics"],
        ] as const).map(([key, title]) => <button key={key} onClick={() => setTab(key)} className={`rounded-full border px-4 py-2 text-sm ${tab === key ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-white/10 text-slate-400"}`}>{title}</button>)}</nav>

        {tab === "accounts" && (
          <section className="space-y-3">
            {(accounts.data || []).map((item) => <article key={item.profile.userId} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="font-semibold">{item.user?.name || "Account"} <span className="text-xs text-slate-500">{item.profile.customerId}</span></p><p className="mt-1 text-sm text-slate-300">{item.user?.email} · {item.user?.phone || "No phone"}</p><p className="mt-1 text-xs text-slate-500">Email {item.profile.emailVerified ? "verified" : "unverified"} · phone {item.profile.phoneVerified ? "verified" : "unverified"} · registered {new Date(item.profile.createdAt).toLocaleString("en-NG")} · last login {item.profile.lastLoginAt ? new Date(item.profile.lastLoginAt).toLocaleString("en-NG") : "—"}</p></div>
                <div className="flex items-center gap-2"><span className="rounded-full bg-white/5 px-3 py-1 text-xs">{item.profile.accountStatus.replace("_", " ")}</span>{item.profile.accountStatus === "pending_approval" && <><Button size="sm" onClick={() => mutation.mutate({ url: `/api/admin/community/accounts/${item.profile.userId}`, body: { status: "approved" } })}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="outline" onClick={() => mutation.mutate({ url: `/api/admin/community/accounts/${item.profile.userId}`, body: { status: "rejected" } })}><X className="mr-1 h-3.5 w-3.5" />Reject</Button></>}{item.profile.accountStatus === "approved" && <Button size="sm" variant="outline" onClick={() => mutation.mutate({ url: `/api/admin/community/accounts/${item.profile.userId}`, body: { status: "suspended" } })}>Suspend</Button>}{item.profile.accountStatus === "suspended" && <Button size="sm" onClick={() => mutation.mutate({ url: `/api/admin/community/accounts/${item.profile.userId}`, body: { status: "approved" } })}>Restore</Button>}</div>
              </div>
            </article>)}
            {accounts.isLoading && <p className="text-sm text-slate-400">Loading accounts…</p>}
          </section>
        )}

        {tab === "businesses" && (
          <section className="space-y-3">
            {allBusinesses.map((item) => {
              const kind = item.kind || (terminals.data?.some((candidate) => candidate.id === item.id) ? "terminal" : "station");
              return <article key={item.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold">{item.name} <span className="text-xs text-slate-400">· {kind}</span></p><p className="mt-1 text-sm text-slate-300">{item.brand} · {item.city}, {item.state}</p><p className="mt-1 text-xs text-slate-500">Contact: {item.contactPhone} · {item.businessEmail} · submitted {new Date(item.submittedAt).toLocaleString("en-NG")}</p><a className="mt-1 inline-block text-xs text-sky-300" href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">Review coordinates</a></div><div className="flex items-center gap-2"><span className="rounded-full bg-white/5 px-3 py-1 text-xs">{item.approvalStatus}</span>{item.approvalStatus === "pending" && <><Button size="sm" onClick={() => mutation.mutate({ url: `/api/admin/community/businesses/${kind}/${item.id}`, body: { status: "approved" } })}><Check className="mr-1 h-3.5 w-3.5" />Approve badge</Button><Button size="sm" variant="outline" onClick={() => mutation.mutate({ url: `/api/admin/community/businesses/${kind}/${item.id}`, body: { status: "rejected" } })}>Reject</Button></>}</div></div></article>;
            })}
            {!allBusinesses.length && <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No registered businesses submitted for review.</p>}
          </section>
        )}

        {tab === "reports" && (
          <section className="space-y-3">
            {(submissions.data || []).map((item) => <article key={item.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold">{item.locationName} <span className="text-xs text-slate-400">· {item.brand}</span></p><p className="mt-1 text-sm text-slate-300">{item.fuelType} · ₦{Number(item.priceNaira).toLocaleString("en-NG")} / {item.unit} · {item.city}, {item.state}</p><p className="mt-1 text-xs text-slate-500">{item.sourceType} · observed {new Date(item.observedAt).toLocaleString("en-NG")} · reporter {item.customerUserId}</p>{item.validationReasons?.length > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-amber-300"><TriangleAlert className="h-3 w-3" />{item.validationReasons.join(" · ")}</p>}</div><div className="flex items-center gap-2"><span className="rounded-full bg-white/5 px-3 py-1 text-xs">{item.validationStatus}</span>{(item.validationStatus === "under_review" || item.validationStatus === "eligible") && <><Button size="sm" onClick={() => mutation.mutate({ url: `/api/admin/community/submissions/${item.id}`, body: { status: "eligible", reason: "Approved by administrator" } })}>Publish</Button><Button size="sm" variant="outline" onClick={() => mutation.mutate({ url: `/api/admin/community/submissions/${item.id}`, body: { status: "rejected", reason: "Rejected by administrator" } })}>Reject</Button></>}</div></div>
            </article>)}
            {!submissions.data?.length && <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No price submissions found.</p>}
          </section>
        )}

        {tab === "disputes" && (
          <section className="space-y-3">
            {(disputes.data || []).map((item) => <article key={item.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="font-semibold">{item.reason} <span className="text-xs text-slate-500">· {item.status}</span></p><p className="mt-1 text-sm text-slate-300">{item.details || "No additional details."}</p><p className="mt-1 text-xs text-slate-500">Report {item.submissionId} · reporter {item.reporterUserId} · {new Date(item.createdAt).toLocaleString("en-NG")}</p>{item.status === "open" && <div className="mt-3 flex flex-wrap gap-2"><input className="min-w-[220px] flex-1 rounded-md border border-white/10 bg-[#0b1220] px-3 py-2 text-sm" placeholder="Resolution explanation" value={resolution[item.id] || ""} onChange={(event) => setResolution({ ...resolution, [item.id]: event.target.value })} /><Button disabled={(resolution[item.id] || "").trim().length < 3} onClick={() => mutation.mutate({ url: `/api/admin/community/disputes/${item.id}`, body: { status: "resolved", resolution: resolution[item.id] } })}>Resolve</Button><Button variant="outline" disabled={(resolution[item.id] || "").trim().length < 3} onClick={() => mutation.mutate({ url: `/api/admin/community/disputes/${item.id}`, body: { status: "dismissed", resolution: resolution[item.id] } })}>Dismiss</Button></div>}</article>)}
            {!disputes.data?.length && <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No disputes reported.</p>}
          </section>
        )}

        {tab === "analytics" && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><Fuel className="h-5 w-5 text-emerald-300" /><p className="mt-4 text-sm text-slate-400">Eligible published reports</p><p className="mt-1 text-3xl font-bold">{publishedReports}</p></div>
            {["PMS", "AGO", "DPK", "LPG"].map((fuel) => <div key={fuel} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{fuel} reports</p><p className="mt-3 text-3xl font-bold">{fuelReportCount(fuel)}</p><p className="mt-1 text-xs text-slate-500">Published eligible observations</p></div>)}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Approved locations</p><p className="mt-3 text-3xl font-bold">{allBusinesses.filter((item) => item.approvalStatus === "approved").length}</p><p className="mt-1 text-xs text-slate-500">Customer-registered; not automatically NNPC official</p></div>
          </section>
        )}
      </div>
    </main>
  );
}
