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
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">FuelIQ NG</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <a href="#features" className="px-3 py-2 text-sm text-muted-foreground transition-colors hover-elevate rounded-md" data-testid="link-features">Features</a>
            <a href="#how-it-works" className="px-3 py-2 text-sm text-muted-foreground transition-colors hover-elevate rounded-md" data-testid="link-how-it-works">How It Works</a>
            <a href="#pricing" className="px-3 py-2 text-sm text-muted-foreground transition-colors hover-elevate rounded-md" data-testid="link-pricing">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")} data-testid="button-dashboard">
                  Dashboard
                </Button>
                <Button variant="outline" size="sm" onClick={logout} data-testid="button-logout">
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/login")} data-testid="button-login">
                  Login
                </Button>
                <Button size="sm" onClick={() => setLocation("/register")} data-testid="button-get-started">
                  Get Started
                </Button>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-2">
            <a href="#features" className="block px-3 py-2 text-sm text-muted-foreground rounded-md hover-elevate" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#how-it-works" className="block px-3 py-2 text-sm text-muted-foreground rounded-md hover-elevate" onClick={() => setMobileOpen(false)}>How It Works</a>
            <a href="#pricing" className="block px-3 py-2 text-sm text-muted-foreground rounded-md hover-elevate" onClick={() => setMobileOpen(false)}>Pricing</a>
            <div className="pt-2 flex flex-col gap-2">
              {user ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => { setLocation("/dashboard"); setMobileOpen(false); }}>Dashboard</Button>
                  <Button variant="outline" size="sm" onClick={() => { logout(); setMobileOpen(false); }}>Logout</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => { setLocation("/login"); setMobileOpen(false); }}>Login</Button>
                  <Button size="sm" onClick={() => { setLocation("/register"); setMobileOpen(false); }}>Get Started</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
