import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Report = {
  id: string;
  reporterUserId: string;
  reportedUserId: string;
  messageId?: string;
  conversationId?: string;
  reason: string;
  status: string;
  createdAt: string;
};
type Business = {
  id: string;
  userId: string;
  displayName: string;
  businessName?: string;
  businessCategory: string;
  businessVerified: boolean;
  customerVerified: boolean;
  stationName?: string;
  terminalName?: string;
  state?: string;
};
type AuditEntry = {
  id: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  createdAt: string;
};

async function request<T>(url: string, method: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Admin messaging request failed.");
  return result.data as T;
}

function formatted(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminMessagingPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const reports = useQuery<Report[]>({
    queryKey: ["admin-messaging-reports"],
    enabled: !!token && user?.role === "admin",
    queryFn: () => request("/api/admin/messaging/reports", "GET", token!),
  });
  const businesses = useQuery<Business[]>({
    queryKey: ["admin-messaging-businesses"],
    enabled: !!token && user?.role === "admin",
    queryFn: () => request("/api/admin/messaging/businesses", "GET", token!),
  });
  const audit = useQuery<AuditEntry[]>({
    queryKey: ["admin-messaging-audit"],
    enabled: !!token && user?.role === "admin",
    queryFn: () => request("/api/admin/messaging/audit", "GET", token!),
  });
  const mutation = useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body: unknown }) => request(url, method, token!, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-messaging-reports"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-messaging-businesses"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-messaging-audit"] });
      toast({ title: "Moderation action recorded" });
    },
    onError: (error) => toast({ title: "Action failed", description: (error as Error).message, variant: "destructive" }),
  });

  if (!token || user?.role !== "admin") {
    return <><Navbar /><main className="mx-auto max-w-3xl px-5 pt-28 text-center text-slate-200">Administrator access is required.</main></>;
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-24 text-slate-100">
        <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Restricted console</p><h1 className="mt-1 text-2xl font-bold">Messaging moderation</h1><p className="mt-2 text-sm text-slate-400">Moderation access never exposes private conversation contents. Every action requires a reason and is audited.</p></header>
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <h2 className="mb-3 font-semibold">Reported messages and customers</h2>
          {reports.isLoading ? <p className="text-sm text-slate-400">Loading reports…</p> : reports.isError ? <p className="text-sm text-red-300">{(reports.error as Error).message}</p>
            : reports.data?.length ? <div className="space-y-2">{reports.data.map((report) => <article key={report.id} className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium">{report.reason}</p><p className="mt-1 text-xs text-slate-400">Reported customer: {report.reportedUserId} · Reporter: {report.reporterUserId} · {formatted(report.createdAt)}</p><p className="text-xs text-slate-500">Case {report.id} · {report.status}{report.messageId ? " · message reference recorded (content hidden)" : ""}</p></div>
                <div className="flex gap-2">{(["reviewing", "resolved", "dismissed"] as const).map((status) => <Button key={status} size="sm" variant="outline" disabled={mutation.isPending || report.status === status} onClick={() => {
                  const reason = window.prompt(`Reason for marking this report ${status}:`);
                  if (reason?.trim()) mutation.mutate({ url: `/api/admin/messaging/reports/${report.id}`, method: "PATCH", body: { status, reason } });
                }}>{status}</Button>)}</div>
              </div>
              <div className="mt-3"><Button size="sm" variant="destructive" disabled={mutation.isPending} onClick={() => {
                const reason = window.prompt("Reason for suspending this customer's messaging access:");
                if (reason?.trim()) mutation.mutate({ url: `/api/admin/messaging/customers/${report.reportedUserId}/suspension`, method: "POST", body: { suspend: true, reason } });
              }}>Suspend messaging</Button><Button className="ml-2" size="sm" variant="outline" disabled={mutation.isPending} onClick={() => {
                const reason = window.prompt("Reason for lifting this customer's messaging suspension:");
                if (reason?.trim()) mutation.mutate({ url: `/api/admin/messaging/customers/${report.reportedUserId}/suspension`, method: "POST", body: { suspend: false, reason } });
              }}>Lift suspension</Button></div>
            </article>)}</div> : <p className="text-sm text-slate-500">No reports have been filed.</p>}
        </section>
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <h2 className="mb-3 font-semibold">Public business profile review</h2>
          <p className="mb-3 text-xs text-slate-400">Verification confirms the registered business profile only; it does not confer official NNPC authorisation.</p>
          {businesses.isError && <p className="text-sm text-red-300">{(businesses.error as Error).message}</p>}
          <div className="space-y-2">{businesses.data?.map((business) => <article key={business.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 p-3">
            <div><p className="font-medium">{business.businessName || business.displayName}</p><p className="text-xs text-slate-400">{business.businessCategory} · {[business.stationName, business.terminalName, business.state].filter(Boolean).join(" · ") || "Location not listed"}</p><p className="text-xs text-slate-500">Verified customer: {business.customerVerified ? "yes" : "no"} · Business: {business.businessVerified ? "verified" : "unverified"}</p></div>
            <Button size="sm" variant={business.businessVerified ? "outline" : "default"} disabled={mutation.isPending || !business.customerVerified} onClick={() => {
              const reason = window.prompt(`${business.businessVerified ? "Reason for revoking" : "Verification basis for"} ${business.businessName || business.displayName}:`);
              if (reason?.trim()) mutation.mutate({ url: `/api/admin/messaging/businesses/${business.id}`, method: "PATCH", body: { verified: !business.businessVerified, reason } });
            }}>{business.businessVerified ? "Revoke verification" : "Verify business"}</Button>
          </article>)}</div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <h2 className="mb-3 font-semibold">Moderation audit history</h2>
          {audit.isLoading ? <p className="text-sm text-slate-400">Loading audit history…</p> : audit.data?.length ? <div className="max-h-80 space-y-2 overflow-auto">{audit.data.map((entry) => <article key={entry.id} className="rounded-lg bg-black/20 p-2 text-xs"><div className="flex flex-wrap justify-between gap-2"><span>{entry.action.replaceAll("_", " ")} · {entry.entityType}</span><span className="text-slate-500">{formatted(entry.createdAt)}</span></div>{entry.reason && <p className="mt-1 text-slate-400">{entry.reason}</p>}</article>)}</div> : <p className="text-sm text-slate-500">No moderation actions yet.</p>}
        </section>
      </main>
    </>
  );
}
