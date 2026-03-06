import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
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
  AlertTriangle,
  ChevronRight,
  Play,
} from "lucide-react";

function MockDashboard() {
  return (
    <div className="w-full rounded-xl bg-[#0c1220] border border-white/[0.06] shadow-2xl overflow-hidden" data-testid="mock-dashboard">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-slate-500 font-mono">fueliq.ng/dashboard</div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center">
              <Flame className="w-3 h-3 text-white" />
            </div>
            <span className="text-[10px] font-bold text-white">FuelIQ NG</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[9px] text-slate-400">PMS - Apapa Axis</span>
            <ChevronRight className="w-2.5 h-2.5 text-slate-500 rotate-90" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2.5">
            <div className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Market Signals</div>
            <div className="space-y-1.5">
              {[
                { icon: Activity, label: "Vessel", value: "None", color: "text-slate-500" },
                { icon: Truck, label: "Truck Queue", value: "High", color: "text-amber-400" },
                { icon: Droplets, label: "NNPC Supply", value: "Weak", color: "text-red-400" },
                { icon: DollarSign, label: "FX Pressure", value: "Medium", color: "text-amber-400" },
                { icon: AlertTriangle, label: "Policy Risk", value: "Low", color: "text-emerald-400" },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-1.5 rounded bg-white/[0.02]">
                  <div className="flex items-center gap-1">
                    <s.icon className="w-2.5 h-2.5 text-slate-600" />
                    <span className="text-[8px] text-slate-400">{s.label}</span>
                  </div>
                  <span className={`text-[8px] font-semibold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2.5">
            <div className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Price Anchors</div>
            <div className="space-y-2">
              <div className="py-1.5 px-1.5 rounded bg-white/[0.02]">
                <div className="text-[7px] text-slate-500 mb-0.5">Yesterday Close</div>
                <div className="text-[11px] font-bold font-mono text-white">&#8358;615 &mdash; &#8358;620</div>
              </div>
              <div className="py-1.5 px-1.5 rounded bg-white/[0.02]">
                <div className="text-[7px] text-slate-500 mb-0.5">Overnight Sentiment</div>
                <div className="inline-block px-1.5 py-0.5 rounded text-[7px] font-semibold bg-red-500/20 text-red-400">Bearish</div>
              </div>
              <div className="py-1.5 px-1.5 rounded bg-white/[0.02]">
                <div className="text-[7px] text-slate-500 mb-0.5">Depot Loading</div>
                <div className="text-[11px] font-bold font-mono text-white">&#8358;610</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/[0.12] p-2.5">
            <div className="text-[8px] uppercase tracking-wider text-emerald-400 font-semibold mb-2">Forecast Output</div>
            <div className="space-y-2">
              <div>
                <div className="text-[7px] text-slate-500 mb-0.5">Expected Range</div>
                <div className="text-[13px] font-bold font-mono bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">&#8358;620 &mdash; &#8358;635</div>
              </div>
              <div>
                <div className="text-[7px] text-slate-500 mb-0.5">Market Bias</div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-[8px] font-medium text-amber-400">Likely Increase</span>
                </div>
              </div>
              <div>
                <div className="text-[7px] text-slate-500 mb-0.5">Confidence</div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 bg-white/[0.06] rounded-full">
                    <div className="h-1 bg-emerald-500 rounded-full" style={{ width: "78%" }} />
                  </div>
                  <span className="text-[8px] font-bold font-mono text-emerald-400">78%</span>
                </div>
              </div>
              <div>
                <div className="text-[7px] text-slate-500 mb-1">Suggested Action</div>
                <div className="space-y-0.5">
                  <div className="flex items-start gap-1">
                    <ChevronRight className="w-2 h-2 mt-0.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-[8px] text-slate-300">Load before 6am</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <ChevronRight className="w-2 h-2 mt-0.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-[8px] text-slate-300">Avoid spot buying after 9am</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#060b18]">
      <section className="relative min-h-screen flex items-center overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0 bg-gradient-to-br from-[#060b18] via-[#0a1628] to-[#071020]" />
        <div className="absolute inset-0">
          <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-emerald-500/[0.07] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-blue-500/[0.04] rounded-full blur-[140px]" />
          <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-emerald-400/[0.03] rounded-full blur-[100px]" />
        </div>
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }} />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 lg:pt-32 lg:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Real-time Market Intelligence
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-bold tracking-tight leading-[1.08] text-white" data-testid="text-hero-title">
                  Petroleum Market{" "}
                  <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">Forecast Platform</span>
                </h1>
                <p className="text-base sm:text-lg text-slate-400 max-w-lg leading-relaxed" data-testid="text-hero-subtitle">
                  Make informed fuel buying decisions with real-time price forecasts for Lagos and beyond.
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
                  onClick={() => {
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 bg-transparent h-12 px-7 text-sm font-semibold"
                  data-testid="button-hero-watch-demo"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Watch Demo
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Free 7-day trial</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> No credit card</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Cancel anytime</span>
              </div>
            </div>

            <div className="relative lg:pl-4">
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
              Powered by real market data, signals from the ground, and predictive analytics.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BarChart3, title: "Price Forecasting", desc: "AI-powered price range predictions based on market signals, supply data, and historical trends." },
              { icon: TrendingUp, title: "Market Signals", desc: "Track vessel activity, truck queues, NNPC supply levels, and FX pressure in real-time." },
              { icon: Bell, title: "Smart Alerts", desc: "Get notified when prices hit your target range or when market conditions change dramatically." },
              { icon: Shield, title: "Risk Analysis", desc: "Policy risk assessment and overnight sentiment tracking to protect your margins." },
              { icon: Globe, title: "Multi-Region Coverage", desc: "Forecasts for Lagos, Port Harcourt, Abuja, and other major Nigerian fuel markets." },
              { icon: Zap, title: "Actionable Insights", desc: "Clear buy/sell recommendations with confidence scores and suggested timing." },
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 hover:bg-white/[0.04] hover:border-emerald-500/20 transition-all duration-300"
                data-testid={`card-feature-${i}`}
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
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400 text-xs font-medium mb-6">
              Live Preview
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-white">
              See the dashboard in action
            </h2>
            <p className="text-slate-400 text-lg">
              A snapshot of today's market intelligence for PMS on the Apapa Axis.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 lg:p-8 backdrop-blur-sm" data-testid="card-preview-dashboard">
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-emerald-500/[0.08] via-transparent to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-semibold text-white">FuelIQ NG</span>
                  </div>
                  <div className="text-sm text-slate-500">
                    PMS - Apapa Axis | Thursday, Feb 5, 2026
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-5">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">Market Signals</h3>
                    <div className="space-y-2">
                      {[
                        { icon: Activity, label: "Vessel Activity", value: "None", color: "text-slate-500" },
                        { icon: Truck, label: "Truck Queue", value: "High", color: "text-amber-400" },
                        { icon: Droplets, label: "NNPC Supply", value: "Weak", color: "text-red-400" },
                        { icon: DollarSign, label: "FX Pressure", value: "Medium", color: "text-amber-400" },
                        { icon: AlertTriangle, label: "Policy Risk", value: "Low", color: "text-emerald-400" },
                      ].map((signal, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <div className="flex items-center gap-2 text-sm">
                            <signal.icon className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-slate-400 text-xs">{signal.label}</span>
                          </div>
                          <span className={`text-xs font-semibold ${signal.color}`}>{signal.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">Price Anchors</h3>
                    <div className="space-y-3">
                      <div className="py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="text-[10px] text-slate-500 mb-1">Yesterday Close</div>
                        <div className="text-lg font-bold font-mono text-white">&#8358;615 &mdash; &#8358;620</div>
                      </div>
                      <div className="py-3 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="text-[10px] text-slate-500 mb-1">Overnight Sentiment</div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/20">Bearish</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/[0.10]">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-emerald-400">Forecast Output</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">Expected Range</div>
                        <div className="text-2xl font-bold font-mono bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">&#8358;620 &mdash; &#8358;635</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">Market Bias</div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-amber-400" />
                          <span className="text-sm font-medium text-amber-400">Likely Increase</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">Confidence</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full">
                            <div className="h-1.5 bg-emerald-500 rounded-full transition-all" style={{ width: "78%" }} />
                          </div>
                          <span className="text-xs font-bold font-mono text-emerald-400">78%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 mb-2">Suggested Action</div>
                        <ul className="space-y-1.5">
                          <li className="flex items-start gap-2 text-sm">
                            <ChevronRight className="w-3 h-3 mt-0.5 text-emerald-500 flex-shrink-0" />
                            <span className="text-slate-300 text-xs">Load before 6am</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm">
                            <ChevronRight className="w-3 h-3 mt-0.5 text-emerald-500 flex-shrink-0" />
                            <span className="text-slate-300 text-xs">Avoid spot buying after 9am</span>
                          </li>
                        </ul>
                      </div>
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
              { step: "02", title: "Analyze", desc: "Our platform ingests market signals, supply data, and pricing trends to generate real-time forecasts." },
              { step: "03", title: "Act", desc: "Receive clear buy/hold recommendations with confidence scores and optimal timing windows." },
            ].map((item, i) => (
              <div key={i} className="text-center space-y-4" data-testid={`card-step-${i}`}>
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
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
              Start free. Upgrade when you're ready.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              {
                name: "Starter", price: "Free", period: "", desc: "Perfect for individual marketers",
                features: ["1 region", "Daily forecasts", "Basic market signals", "Email alerts"],
                cta: "Get Started", highlighted: false,
              },
              {
                name: "Professional", price: "\u20A615,000", period: "/month", desc: "For serious fuel traders",
                features: ["5 regions", "Real-time forecasts", "All market signals", "SMS + Email alerts", "Price history & charts", "Priority support"],
                cta: "Start Free Trial", highlighted: true,
              },
              {
                name: "Enterprise", price: "Custom", period: "", desc: "For large operations",
                features: ["Unlimited regions", "API access", "Custom integrations", "Dedicated analyst", "Team accounts", "SLA guarantee"],
                cta: "Contact Sales", highlighted: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-xl p-6 border transition-all ${
                  plan.highlighted
                    ? "bg-emerald-500/[0.04] border-emerald-500/20 shadow-lg shadow-emerald-500/[0.05]"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.10]"
                }`}
                data-testid={`card-pricing-${i}`}
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
                    {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
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

      <section className="relative py-24 lg:py-32" data-testid="section-cta">
        <div className="absolute inset-0 bg-gradient-to-b from-[#080e1e] to-[#060b18]" />
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/[0.05] rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Ready to forecast smarter?
            </h2>
            <p className="text-lg text-slate-400">
              Join hundreds of Nigerian fuel marketers already using FuelIQ NG to optimize their buying decisions.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button
                size="lg"
                onClick={() => setLocation("/register")}
                className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 border-0 px-8 h-12"
                data-testid="button-cta-start"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
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
            <p className="text-sm text-slate-600">
              &copy; 2026 FuelIQ NG. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
