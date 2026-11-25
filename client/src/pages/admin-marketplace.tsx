import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Check, ChevronLeft, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

type Report = {
  id: string; listingId: string; reporterUserId: string; reason: string; status: string;
  resolution?: string; createdAt: string; listingTitle: string; ownerUserId: string;
};

async function request<T>(url: string, token: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Marketplace moderation request failed.");
  return result.data as T;
}

export default function AdminMarketplacePage() {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const reports = useQuery<Report[]>({
    queryKey: ["admin-marketplace-reports"],
    enabled: !!token && user?.role === "admin",
    queryFn: () => request("/api/admin/marketplace/reports", token!),
  });
  const review = useMutation({
    mutationFn: ({ reportId, action }: { reportId: string; action: "dismiss" | "remove_listing" | "restore_listing" }) => {
      const resolution = resolutions[reportId]?.trim() || (action === "dismiss" ? "Reviewed and dismissed." : action === "remove_listing" ? "Listing removed after review." : "Listing restored after review.");
      return request(`/api/admin/marketplace/reports/${reportId}`, token!, "PATCH", { action, resolution });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-marketplace-reports"] }),
  });

  if (isLoading) return <div className="min-h-screen bg-[#060b18]" />;
  if (!user || user.role !== "admin") {
    setLocation("/login");
    return null;
  }
  return <>
    <Navbar />
    <main className="min-h-screen bg-[#060b18] px-4 pb-10 pt-24 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Shield className="h-7 w-7 text-amber-300" /><div><p className="text-xs uppercase tracking-[0.2em] text-amber-300">Administrator</p><h1 className="text-2xl font-bold">Marketplace moderation</h1></div></div>
          <Button variant="outline" className="border-white/10" onClick={() => setLocation("/admin")}><ChevronLeft className="mr-2 h-4 w-4" />Admin home</Button>
        </header>
        <p className="text-sm text-slate-400">Review reported listings and record a reason for every moderation action. This panel does not expose private business conversations.</p>
        {reports.isError && <p role="alert" className="rounded-lg border border-red-300/20 p-3 text-sm text-red-200">{(reports.error as Error).message}</p>}
        <section className="space-y-3">
          {(reports.data || []).map((report) => <article key={report.id} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-amber-200">{report.status} · reported {new Date(report.createdAt).toLocaleString("en-NG")}</p><h2 className="mt-1 font-semibold">{report.listingTitle}</h2><p className="mt-2 text-sm text-slate-300">{report.reason}</p><p className="mt-1 text-xs text-slate-500">Listing {report.listingId} · owner {report.ownerUserId} · reporter {report.reporterUserId}</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{report.status}</span></div>
            <textarea maxLength={1000} className="min-h-16 w-full rounded-md border border-white/10 bg-slate-950/60 p-3 text-sm" placeholder="Moderation resolution / audit note" value={resolutions[report.id] || ""} onChange={(e) => setResolutions({ ...resolutions, [report.id]: e.target.value })} />
            <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => review.mutate({ reportId: report.id, action: "remove_listing" })} disabled={review.isPending}>Remove listing</Button><Button size="sm" variant="outline" onClick={() => review.mutate({ reportId: report.id, action: "restore_listing" })} disabled={review.isPending}><Check className="mr-1 h-3.5 w-3.5" />Restore listing</Button><Button size="sm" variant="ghost" onClick={() => review.mutate({ reportId: report.id, action: "dismiss" })} disabled={review.isPending}><X className="mr-1 h-3.5 w-3.5" />Dismiss report</Button></div>
          </article>)}
          {!reports.isLoading && !reports.data?.length && <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">No listing reports to review.</div>}
        </section>
      </div>
    </main>
  </>;
}
