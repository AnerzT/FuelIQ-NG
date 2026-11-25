import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  tier: string;
  createdAt?: string;
  deletedAt: string | null;
};

async function deleteAccount(token: string, accountId: string, confirmEmail: string) {
  const response = await fetch(`/api/admin/accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirmEmail }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || "Account deletion failed.");
  return result;
}

export default function AdminUsersPage() {
  const { user, token, logout, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState("");

  const accountsQuery = useQuery<Account[]>({
    queryKey: ["/api/admin/accounts"],
    queryFn: authFetch(token),
    enabled: !!token && user?.role === "admin",
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(token!, selected!.id, confirmEmail),
    onSuccess: async (result) => {
      if (selected?.id === user?.id) {
        logout();
        setLocation("/login");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({ title: result.message || "Account deleted" });
      setSelected(null);
      setConfirmEmail("");
      setError("");
    },
    onError: (cause) => setError((cause as Error).message),
  });

  const accounts = accountsQuery.data || [];
  const activeAdminCount = accounts.filter((account) => account.role === "admin" && !account.deletedAt).length;
  const visibleAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) => !term || `${account.name} ${account.email} ${account.role}`.toLowerCase().includes(term));
  }, [accounts, search]);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) setLocation("/login");
  }, [isLoading, setLocation, user]);

  if (isLoading) return <main className="min-h-screen bg-[#060b18]" />;
  if (!user || user.role !== "admin") return null;

  return (
    <main className="min-h-screen bg-[#060b18] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Administrator</p>
            <h1 className="mt-1 text-2xl font-bold">Customer accounts</h1>
            <p className="mt-1 text-sm text-slate-400">Review registered accounts and permanently close accounts when requested or required.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin"><Button variant="outline" className="border-white/10">Admin dashboard</Button></Link>
            <Button variant="ghost" onClick={logout}>Sign out</Button>
          </div>
        </header>

        <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">{accounts.filter((account) => !account.deletedAt).length} active · {accounts.filter((account) => account.deletedAt).length} deleted</p>
            <Input aria-label="Search accounts" className="max-w-sm" placeholder="Search name, email or role" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {accountsQuery.isLoading && <p className="py-8 text-center text-sm text-slate-400">Loading accounts…</p>}
          {accountsQuery.isError && <p role="alert" className="text-sm text-red-300">{(accountsQuery.error as Error).message}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
                <tr><th className="p-3">Account</th><th className="p-3">Role</th><th className="p-3">Subscription</th><th className="p-3">Created</th><th className="p-3">Status</th><th className="p-3">Action</th></tr>
              </thead>
              <tbody>
                {visibleAccounts.map((account) => (
                  <tr key={account.id} className="border-b border-white/[0.06]">
                    <td className="p-3"><p className="font-medium">{account.name}</p><p className="text-xs text-slate-500">{account.email}</p></td>
                    <td className="p-3 capitalize">{account.role}</td>
                    <td className="p-3 uppercase">{account.tier}</td>
                    <td className="p-3 text-slate-400">{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="p-3">{account.deletedAt ? <span className="text-slate-500">Deleted</span> : <span className="text-emerald-300">Active</span>}</td>
                    <td className="p-3">
                      {!account.deletedAt && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={account.role === "admin" && activeAdminCount <= 1}
                          onClick={() => { setSelected(account); setConfirmEmail(""); setError(""); }}
                        >
                          Delete account
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!accountsQuery.isLoading && !visibleAccounts.length && <tr><td className="p-8 text-center text-slate-500" colSpan={6}>No accounts found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-account-heading" className="w-full max-w-lg space-y-4 rounded-2xl border border-red-400/20 bg-slate-950 p-6 shadow-2xl">
            <div>
              <h2 id="delete-account-heading" className="text-lg font-semibold text-red-200">Delete this account?</h2>
              <p className="mt-2 text-sm text-slate-400">Access will be disabled, direct account details anonymized, and registered business assets suspended. This cannot be undone.</p>
              <p className="mt-3 break-all rounded-lg bg-white/[0.04] p-3 text-sm text-white">{selected.email}</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-slate-500">Enter the account email to confirm</span>
              <Input autoFocus value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} />
            </label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="border-white/10" onClick={() => setSelected(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending || confirmEmail.trim().toLowerCase() !== selected.email.toLowerCase()}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? "Deleting…" : "Confirm deletion"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
