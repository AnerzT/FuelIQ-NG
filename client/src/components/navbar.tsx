import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Flame, Menu, X } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-20">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">FuelIQ NG</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors" data-testid="link-features">Features</a>
            <a href="#how-it-works" className="text-sm text-slate-300 hover:text-white transition-colors" data-testid="link-how-it-works">How It Works</a>
            <a href="#pricing" className="text-sm text-slate-300 hover:text-white transition-colors" data-testid="link-pricing">Pricing</a>
            {user ? (
              <button
                onClick={() => setLocation("/dashboard")}
                className="text-sm text-slate-300 hover:text-white transition-colors"
                data-testid="button-dashboard-nav"
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => setLocation("/login")}
                className="text-sm text-slate-300 hover:text-white transition-colors"
                data-testid="button-login"
              >
                Login
              </button>
            )}
          </div>

          <div className="hidden md:block">
            {user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 bg-transparent"
                data-testid="button-logout"
              >
                Logout
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setLocation("/register")}
                className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 border-0 px-5"
                data-testid="button-get-started"
              >
                Get Started
              </Button>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-white/10"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-white/5">
          <div className="px-4 py-4 space-y-1">
            <a href="#features" className="block px-3 py-2.5 text-sm text-slate-300 rounded-lg hover:bg-white/5" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#how-it-works" className="block px-3 py-2.5 text-sm text-slate-300 rounded-lg hover:bg-white/5" onClick={() => setMobileOpen(false)}>How It Works</a>
            <a href="#pricing" className="block px-3 py-2.5 text-sm text-slate-300 rounded-lg hover:bg-white/5" onClick={() => setMobileOpen(false)}>Pricing</a>
            <div className="pt-3 flex flex-col gap-2">
              {user ? (
                <>
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-white border-0 w-full" onClick={() => { setLocation("/dashboard"); setMobileOpen(false); }}>Dashboard</Button>
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 bg-transparent w-full" onClick={() => { logout(); setMobileOpen(false); }}>Logout</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-white/5 w-full" onClick={() => { setLocation("/login"); setMobileOpen(false); }}>Login</Button>
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-white border-0 w-full" onClick={() => { setLocation("/register"); setMobileOpen(false); }}>Get Started</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
