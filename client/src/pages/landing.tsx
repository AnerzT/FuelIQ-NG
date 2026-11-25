import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Shield,
  Zap,
  Globe,
  Bell,
  ArrowRight,
  Check,
  Flame,
  Activity,
  Truck,
  Droplets,
  DollarSign,
  ChevronRight,
  MapPin,
  ShieldCheck,
  Clock3,
  Database,
  Sparkles,
} from "lucide-react";

function useLandingMotion() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    document.documentElement.classList.add("landing-motion-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });
    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("landing-motion-ready");
    };
  }, []);
}

function MockDashboard() {
  return (
    <div className="w-full rounded-2xl bg-[#0c1220]/95 border border-white/[0.08] shadow-2xl overflow-hidden" data-testid="mock-dashboard">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-1 rounded-md bg-white/[0.04] text-[10px] text-slate-500 font-mono">fueliq.ng/market-overview</div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-500">
          <ShieldCheck className="h-3 w-3 text-emerald-400" /> source-aware
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="block text-xs font-bold text-white">FuelIQ NG</span>
              <span className="block text-[9px] text-slate-500">Market context at a glance</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[9px] text-slate-400">Select a terminal & product</span>
            <ChevronRight className="w-2.5 h-2.5 text-slate-500 rotate-90" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Signal context</div>
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="space-y-2">
              {[
                { icon: Truck, label: "Supply & logistics" },
                { icon: Droplets, label: "Terminal context" },
                { icon: DollarSign, label: "FX & policy signals" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-lg bg-white/[0.025] px-2.5 py-2">
                  <item.icon className="h-3.5 w-3.5 text-slate-500" />
                  <span className="min-w-0 flex-1 text-[9px] text-slate-400">{item.label}</span>
                  <span className="text-[8px] font-medium text-emerald-300">When available</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Price provenance</div>
              <Database className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <div className="space-y-2">
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-2 text-[9px] text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Verified prices
                </div>
                <p className="mt-1 text-xs font-semibold text-white">Source shown with every quote</p>
              </div>
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-2 text-[9px] text-slate-400">
                  <Clock3 className="h-3.5 w-3.5 text-sky-400" /> Freshness
                </div>
                <p className="mt-1 text-xs font-semibold text-white">Timestamp stays in view</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-emerald-500/[0.12] bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] p-3 sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between">
              <div className="text-[9px] uppercase tracking-wider text-emerald-300 font-semibold">Decision support</div>
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Clarity before a buying decision.</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-400">Forecasts are shown with context and confidence—not as guaranteed outcomes.</p>
            <svg className="mt-3 h-14 w-full text-emerald-400" viewBox="0 0 260 48" fill="none" role="img" aria-label="Illustrative signal graphic, not live price data">
              <path d="M1 38C23 38 25 27 44 29C63 31 64 13 83 17C102 21 104 31 123 26C142 21 145 6 164 12C183 18 184 35 204 29C224 23 232 11 259 7" stroke="currentColor" strokeOpacity=".2" strokeWidth="9" strokeLinecap="round" />
              <path className="landing-chart-line" d="M1 38C23 38 25 27 44 29C63 31 64 13 83 17C102 21 104 31 123 26C142 21 145 6 164 12C183 18 184 35 204 29C224 23 232 11 259 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-[8px] text-slate-500">Illustrative graphic · not a price chart</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  useLandingMotion();

  return (
    <div className="landing-page min-h-screen overflow-hidden bg-[#060b18]">
      <section className="relative min-h-screen flex items-center overflow-hidden" data-testid="section-hero">
        <div
          className="hero-backdrop absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/refinery-hero.svg')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060b18]/95 via-[#060b18]/75 to-[#060b18]/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060b18] via-[#060b18]/25 to-[#060b18]/60" />
        <div className="absolute inset-0">
          <div className="landing-orb landing-orb-one absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-emerald-500/[0.07] rounded-full blur-[120px]" />
          <div className="landing-orb landing-orb-two absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-blue-500/[0.04] rounded-full blur-[140px]" />
          <div className="landing-orb landing-orb-three absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-emerald-400/[0.03] rounded-full blur-[100px]" />
        </div>
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }} />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 lg:pt-32 lg:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8" data-reveal="hero-copy">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400 text-xs font-medium">
                  <span className="landing-status-dot w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Fuel intelligence, built for Nigeria
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-bold tracking-tight leading-[1.08] text-white" data-testid="text-hero-title">
                  Make your next fuel move{" "}
                  <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">with clarity.</span>
                </h1>
                <p className="text-base sm:text-lg text-slate-400 max-w-lg leading-relaxed" data-testid="text-hero-subtitle">
                  Explore market signals, find fuel stations, and see the source and freshness of every reported price.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  onClick={() => setLocation("/register")}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 border-0 px-7 h-12 text-sm font-semibold"
                  data-testid="button-hero-get-started"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setLocation("/fuel-finder")}
                  className="border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 bg-transparent h-12 px-7 text-sm font-semibold"
                  data-testid="button-hero-fuel-finder"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Find fuel nearby
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Source-labelled information</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Verified updates clearly marked</span>
              </div>
            </div>

            <div className="relative landing-float lg:pl-4" data-reveal="hero-preview">
              <div className="absolute -inset-8 bg-emerald-500/[0.04] rounded-3xl blur-2xl" />
              <div className="relative" style={{ perspective: "1200px" }}>
                <div style={{ transform: "rotateY(-6deg) rotateX(2deg)" }} className="relative">
                  <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-emerald-500/20 via-white/5 to-transparent" />
                  <MockDashboard />
                </div>
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-4 bg-emerald-500/[0.06] blur-xl rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative py-24 lg:py-32" data-testid="section-features">
        <div className="absolute inset-0 bg-gradient-to-b from-[#060b18] via-[#080e1e] to-[#060b18]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400 text-xs font-medium mb-6">
              Features
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-white" data-testid="text-features-title">
              Everything you need for smarter fuel decisions
            </h2>
            <p className="text-slate-400 text-lg">
              Market context and fuel-station information with clear provenance and freshness.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BarChart3, title: "Price Forecasting", desc: "Explore data-informed price outlooks with the supporting market context and confidence clearly presented." },
              { icon: TrendingUp, title: "Market Signals", desc: "Review available supply, logistics, FX, and policy context without implying unavailable data is live." },
              { icon: Bell, title: "Smart Alerts", desc: "Set up alerts for forecast changes and fuel-price updates as supported sources provide them." },
              { icon: Shield, title: "Risk Analysis", desc: "Understand relevant market and policy factors alongside their source and update time." },
              { icon: Globe, title: "Multi-Region Coverage", desc: "Follow supported Nigerian terminals and markets, with coverage expanding as reliable data is available." },
              { icon: Zap, title: "Actionable Insights", desc: "Use clear decision support as one input to your buying process—not as a guaranteed outcome." },
              { icon: Globe, title: "Oil & Gas Market Intelligence", desc: "Follow Brent, WTI, gas/LNG benchmarks, and dated Nigeria sector data with official source links. Paid plans add benchmark history, alerts, and import-cost tools." },
              { icon: MapPin, title: "Fuel Price Finder", desc: "Search stations by state, city, and brand. Verified, manual, and estimated prices are distinctly labelled." },
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.04] hover:border-emerald-500/20"
                data-testid={`card-feature-${i}`}
                data-reveal="feature"
                style={{ transitionDelay: `${Math.min(i * 45, 270)}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/15 transition-colors">
                  <feature.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 lg:py-32" data-testid="section-dashboard-preview">
        <div className="absolute inset-0 bg-[#080e1e]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16" data-reveal="preview-heading">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400 text-xs font-medium mb-6">
              Product preview
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-white">
              Clarity, not made-up numbers.
            </h2>
            <p className="text-slate-400 text-lg">
              Source status, freshness, and market context stay visible. A price appears only when there is data to support it.
            </p>
          </div>

          <div className="max-w-5xl mx-auto" data-reveal="preview-card">
            <div className="relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 lg:p-8 backdrop-blur-sm" data-testid="card-preview-dashboard">
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-emerald-500/[0.08] via-transparent to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="block font-semibold text-white">FuelIQ NG</span>
                      <span className="block text-xs text-slate-500">Market overview</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    Sample interface · no live quote data
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-5">
                  <div className="space-y-4" data-reveal="preview-column">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">Market context</h3>
                    <div className="space-y-2">
                      {[
                        { icon: Activity, label: "Supply & logistics" },
                        { icon: Truck, label: "Terminal context" },
                        { icon: DollarSign, label: "FX & policy factors" },
                      ].map((signal, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <div className="flex items-center gap-2 text-sm">
                            <signal.icon className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-slate-400 text-xs">{signal.label}</span>
                          </div>
                          <span className="text-[10px] font-medium text-slate-500">When available</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4" data-reveal="preview-column">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">Price provenance</h3>
                    <div className="space-y-3">
                      <div className="py-4 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" /> Verified source
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white">Shown with each quote</p>
                        <p className="mt-1 text-xs text-slate-500">Manual and estimated entries are labelled separately.</p>
                      </div>
                      <div className="py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock3 className="h-4 w-4 text-sky-400" /> Update timestamp
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Displayed when an update is available.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/[0.10]" data-reveal="preview-column">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-emerald-400">Decision support</h3>
                    <div>
                      <div className="text-sm font-semibold text-white">Forecasts need reliable data</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">Where coverage is unavailable, the dashboard says so instead of inventing a live price or trend.</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                      <div className="mb-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Signal illustration</span><span>Not a live chart</span>
                      </div>
                      <svg className="h-16 w-full text-emerald-400" viewBox="0 0 280 60" fill="none" role="img" aria-label="Illustrative market signal, not live price data">
                        <path d="M2 47C25 47 28 35 48 38C69 41 73 18 94 24C115 30 119 42 140 34C161 26 164 12 185 19C206 26 209 44 230 36C251 28 258 16 278 9" stroke="currentColor" strokeOpacity=".2" strokeWidth="10" strokeLinecap="round" />
                        <path className="landing-chart-line" d="M2 47C25 47 28 35 48 38C69 41 73 18 94 24C115 30 119 42 140 34C161 26 164 12 185 19C206 26 209 44 230 36C251 28 258 16 278 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative py-24 lg:py-32" data-testid="section-how-it-works">
        <div className="absolute inset-0 bg-gradient-to-b from-[#080e1e] via-[#060b18] to-[#080e1e]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400 text-xs font-medium mb-6">
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-white">
              Three steps to smarter buying
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Connect", desc: "Sign up and select your region, product type, and preferred fuel axes to track." },
              { step: "02", title: "Understand", desc: "Review available market signals, station prices, source labels, and update timestamps in one place." },
              { step: "03", title: "Act", desc: "Use forecasts and alerts when supporting data is available, alongside your own judgement." },
            ].map((item, i) => (
              <div key={i} className="text-center space-y-4" data-testid={`card-step-${i}`} data-reveal="step">
                <div className="landing-step-number w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <span className="text-lg font-bold font-mono text-emerald-400">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative py-24 lg:py-32" data-testid="section-pricing">
        <div className="absolute inset-0 bg-[#080e1e]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400 text-xs font-medium mb-6">
              Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-white">
              Plans for every marketer
            </h2>
            <p className="text-slate-400 text-lg">
              Clear monthly plans, with limits shown up front.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              {
                name: "Free", price: "₦0", period: "forever", desc: "Explore the essentials",
                features: ["3 forecasts per day", "60-minute data delay", "Core market signals", "No SMS alerts"],
                cta: "Get Started", highlighted: false,
              },
              {
                name: "Pro", price: "₦15,000", period: "/month", desc: "For growing fuel businesses",
                features: ["50 forecasts per day", "No forecast data delay", "20 SMS alerts per week", "Depot comparison & inventory", "Refinery and regulation updates"],
                cta: "Choose Pro", highlighted: true,
              },
              {
                name: "Elite", price: "₦50,000", period: "/month", desc: "For high-volume market operators",
                features: ["100 forecasts per day", "No forecast data delay", "50 SMS alerts per week", "Advanced hedge lab", "Trader signals and Pro features"],
                cta: "Choose Elite", highlighted: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-xl p-6 border transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlighted
                    ? "bg-emerald-500/[0.04] border-emerald-500/20 shadow-lg shadow-emerald-500/[0.05]"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.10]"
                }`}
                data-testid={`card-pricing-${i}`}
                data-reveal="pricing-card"
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{plan.desc}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                      <span className="text-sm text-slate-500">{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-slate-400">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${
                      plan.highlighted
                        ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 border-0"
                        : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08]"
                    }`}
                    onClick={() => setLocation("/register")}
                    data-testid={`button-pricing-${i}`}
                  >
                    {plan.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-24 lg:py-32" data-testid="section-cta">
        <div className="absolute inset-0 bg-gradient-to-b from-[#080e1e] to-[#060b18]" />
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/[0.05] rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-6" data-reveal="cta">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Make your next decision with more context.
            </h2>
            <p className="text-lg text-slate-400">
              Explore the market dashboard or find fuel stations across Nigeria.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button
                size="lg"
                onClick={() => setLocation("/register")}
                className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 border-0 px-8 h-12"
                data-testid="button-cta-start"
              >
                Get started free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/fuel-finder")}
                className="border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 bg-transparent px-8 h-12"
                data-testid="button-cta-fuel-finder"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Find a station
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative py-10 border-t border-white/[0.05]" data-testid="footer">
        <div className="absolute inset-0 bg-[#050a16]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">FuelIQ NG</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="text-sm text-slate-600 hover:text-slate-400 transition-colors" data-testid="link-privacy-footer">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-slate-600 hover:text-slate-400 transition-colors" data-testid="link-terms-footer">
                Terms &amp; Conditions
              </Link>
              <Link href="/fuel-finder" className="text-sm text-slate-600 hover:text-slate-400 transition-colors" data-testid="link-fuel-finder-footer">
                Fuel Finder
              </Link>
              <p className="text-sm text-slate-600">
                &copy; 2026 FuelIQ NG. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
