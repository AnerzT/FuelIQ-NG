import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { authFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shield, MapPin, BarChart3, Activity, Users, ChevronRight, LogOut } from "lucide-react";
import type { Terminal, Forecast } from "@shared/schema";

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

export default function AdminHome() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const fetchFn = authFetch(token);

  const { data: terminals } = useQuery<Terminal[]>({
    queryKey: ["/api/admin/terminals"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const { data: forecasts } = useQuery<Forecast[]>({
    queryKey: ["/api/admin/forecasts"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  const { data: subs } = useQuery<SubUser[]>({
    queryKey: ["/api/admin/subscriptions"],
    queryFn: fetchFn,
    enabled: !!token,
  });

  if (authLoading) {
    return <div className="min-h-screen bg-[#060b18]" data-testid="auth-loading" />;
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (user.role !== "admin") {
    setLocation("/dashboard");
    return null;
  }

  const totalTerminals = terminals?.length ?? 0;
  const activeTerminals = terminals?.filter((t) => t.active).length ?? 0;
  const inactiveTerminals = totalTerminals - activeTerminals;
  const totalForecasts = forecasts?.length ?? 0;
  const weeklyForecasts = forecasts?.filter((f) => {
    const createdAt = f.createdAt ? new Date(f.createdAt) : null;
    return createdAt ? createdAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : false;
  }).length ?? 0;
  const totalUsers = subs?.length ?? 0;
  const freeUsers = subs?.filter((s) => s.tier === "free").length ?? 0;
  const proUsers = subs?.filter((s) => s.tier === "pro").length ?? 0;
  const eliteUsers = subs?.filter((s) => s.tier === "elite").length ?? 0;

  const quickLinks = [
    { label: "Manage Terminals", target: "/admin/panel", description: "See terminal status and toggle availability." },
    { label: "Create Forecast", target: "/admin/panel", description: "Add a new market forecast." },
    { label: "Update Signals", target: "/admin/panel", description: "Refresh vessel, FX, and policy signals." },
    { label: "Subscriptions", target: "/admin/panel", description: "Review active users and subscription tiers." },
  ];

  return (
    <div className="min-h-screen bg-[#060b18]" data-testid="page-admin-home">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#060b18]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-400">Admin Home</p>
                <h1 className="text-2xl font-bold text-white">FuelIQ NG Admin Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-200 hover:border-slate-500"
                onClick={() => setLocation("/admin/panel")}
                data-testid="button-enter-admin-panel"
              >
                Enter Admin Panel
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-slate-400 hover:text-white hover:bg-white/[0.04]"
                data-testid="button-admin-home-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">Terminals</p>
            <p className="mt-4 text-4xl font-bold text-white">{totalTerminals}</p>
            <p className="mt-2 text-sm text-slate-400">{activeTerminals} active · {inactiveTerminals} inactive</p>
          </div>
          <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">Forecasts</p>
            <p className="mt-4 text-4xl font-bold text-white">{totalForecasts}</p>
            <p className="mt-2 text-sm text-slate-400">{weeklyForecasts} in the last 7 days</p>
          </div>
          <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">Users</p>
            <p className="mt-4 text-4xl font-bold text-white">{totalUsers}</p>
            <p className="mt-2 text-sm text-slate-400">Active subscriptions across FuelIQ NG</p>
          </div>
          <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500">Subscription tiers</p>
            <div className="mt-4 space-y-2 text-sm text-slate-400">
              <div>Free: {freeUsers}</div>
              <div>Pro: {proUsers}</div>
              <div>Elite: {eliteUsers}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-semibold text-white">Quick Actions</p>
                <p className="text-sm text-slate-500">Jump directly into the most important admin workflows.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {quickLinks.map((link) => (
                <Button
                  key={link.label}
                  variant="secondary"
                  size="lg"
                  className="justify-between"
                  onClick={() => setLocation(link.target)}
                  data-testid={`quick-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span>{link.label}</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.02] border border-white/[0.06] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-800 p-3">
                <MapPin className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">FuelIQ NG Admin Home</p>
                <p className="text-sm text-slate-500">Monitor system health and move quickly into management tools.</p>
              </div>
            </div>
            <div className="mt-6 space-y-4 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Active admin controls on a single landing page.
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                Forecast trends and subscription status alongside terminal health.
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-500" />
                Access contracts, signals, and user management in one click.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
