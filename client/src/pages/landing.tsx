import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import heroImage from "@assets/image_1772791938216.png";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen">
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-visible" data-testid="section-hero">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background/80" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary" className="no-default-active-elevate px-3 py-1">
                  <Activity className="w-3 h-3 mr-1" />
                  Real-time Market Intelligence
                </Badge>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]" data-testid="text-hero-title">
                  Petroleum Market{" "}
                  <span className="gradient-text">Forecast Platform</span>{" "}
                  for Nigerian Marketers
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl leading-relaxed" data-testid="text-hero-subtitle">
                  Make informed fuel buying decisions with real-time price forecasts for Lagos and beyond.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => setLocation("/register")} data-testid="button-hero-get-started">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => {
                  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                }} data-testid="button-hero-watch-demo">
                  Watch Demo
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> Free 7-day trial</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> No credit card required</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> Cancel anytime</span>
              </div>
            </div>

            <div className="relative lg:pl-8">
              <div className="relative rounded-lg overflow-visible">
                <img
                  src={heroImage}
                  alt="FuelIQ NG Dashboard Preview"
                  className="w-full rounded-lg border border-border/50"
                  data-testid="img-hero-dashboard"
                />
                <div className="absolute -inset-4 bg-primary/5 rounded-2xl -z-10 blur-xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 lg:py-28" data-testid="section-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="no-default-active-elevate mb-4">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" data-testid="text-features-title">
              Everything you need for smarter fuel decisions
            </h2>
            <p className="text-muted-foreground text-lg">
              Powered by real market data, signals from the ground, and predictive analytics.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: "Price Forecasting",
                desc: "AI-powered price range predictions based on market signals, supply data, and historical trends.",
              },
              {
                icon: TrendingUp,
                title: "Market Signals",
                desc: "Track vessel activity, truck queues, NNPC supply levels, and FX pressure in real-time.",
              },
              {
                icon: Bell,
                title: "Smart Alerts",
                desc: "Get notified when prices hit your target range or when market conditions change dramatically.",
              },
              {
                icon: Shield,
                title: "Risk Analysis",
                desc: "Policy risk assessment and overnight sentiment tracking to protect your margins.",
              },
              {
                icon: Globe,
                title: "Multi-Region Coverage",
                desc: "Forecasts for Lagos, Port Harcourt, Abuja, and other major Nigerian fuel markets.",
              },
              {
                icon: Zap,
                title: "Actionable Insights",
                desc: "Clear buy/sell recommendations with confidence scores and suggested timing.",
              },
            ].map((feature, i) => (
              <Card key={i} className="group" data-testid={`card-feature-${i}`}>
                <CardContent className="p-6 space-y-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-card/50" data-testid="section-dashboard-preview">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="no-default-active-elevate mb-4">Live Preview</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              See the dashboard in action
            </h2>
            <p className="text-muted-foreground text-lg">
              A snapshot of today's market intelligence for PMS on the Apapa Axis.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <Card className="border-border/50" data-testid="card-preview-dashboard">
              <CardContent className="p-6 lg:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                      <Flame className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="font-semibold">FuelIQ NG</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    PMS - Apapa Axis | Thursday, Feb 5, 2026
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Market Signals</h3>
                    <div className="space-y-3">
                      {[
                        { icon: Activity, label: "Vessel Activity", value: "None", color: "text-muted-foreground" },
                        { icon: Truck, label: "Truck Queue", value: "High", color: "text-amber-500" },
                        { icon: Droplets, label: "NNPC Supply", value: "Weak", color: "text-red-400" },
                        { icon: DollarSign, label: "FX Pressure", value: "Medium", color: "text-amber-500" },
                        { icon: AlertTriangle, label: "Policy Risk", value: "Low", color: "text-primary" },
                      ].map((signal, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50">
                          <div className="flex items-center gap-2 text-sm">
                            <signal.icon className="w-4 h-4 text-muted-foreground" />
                            <span>{signal.label}</span>
                          </div>
                          <span className={`text-sm font-medium ${signal.color}`}>{signal.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Price Anchors</h3>
                    <div className="space-y-3">
                      <div className="py-3 px-3 rounded-md bg-muted/50">
                        <div className="text-sm text-muted-foreground mb-1">Yesterday Close</div>
                        <div className="text-lg font-semibold font-mono">&#8358;615 &mdash; &#8358;620</div>
                      </div>
                      <div className="py-3 px-3 rounded-md bg-muted/50">
                        <div className="text-sm text-muted-foreground mb-1">Overnight Sentiment</div>
                        <Badge variant="destructive" className="no-default-active-elevate">Bearish</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-primary">Forecast Output</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Expected Range</div>
                        <div className="text-2xl font-bold font-mono gradient-text">&#8358;620 &mdash; &#8358;635</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Market Bias</div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-medium text-amber-500">Likely Increase</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Confidence</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full">
                            <div className="h-2 bg-primary rounded-full" style={{ width: "78%" }} />
                          </div>
                          <span className="text-sm font-semibold font-mono">78%</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Suggested Action</div>
                        <ul className="space-y-1 text-sm">
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 mt-1 text-primary flex-shrink-0" />
                            <span>Load before 6am</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 mt-1 text-primary flex-shrink-0" />
                            <span>Avoid spot buying after 9am</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 lg:py-28" data-testid="section-how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="no-default-active-elevate mb-4">How It Works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Three steps to smarter buying
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Connect",
                desc: "Sign up and select your region, product type, and preferred fuel axes to track.",
              },
              {
                step: "02",
                title: "Analyze",
                desc: "Our platform ingests market signals, supply data, and pricing trends to generate real-time forecasts.",
              },
              {
                step: "03",
                title: "Act",
                desc: "Receive clear buy/hold recommendations with confidence scores and optimal timing windows.",
              },
            ].map((item, i) => (
              <div key={i} className="text-center space-y-4" data-testid={`card-step-${i}`}>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-lg font-bold font-mono text-primary">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 lg:py-28 bg-card/50" data-testid="section-pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="secondary" className="no-default-active-elevate mb-4">Pricing</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Plans for every marketer
            </h2>
            <p className="text-muted-foreground text-lg">
              Start free. Upgrade when you're ready.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: "Starter",
                price: "Free",
                period: "",
                desc: "Perfect for individual marketers",
                features: ["1 region", "Daily forecasts", "Basic market signals", "Email alerts"],
                cta: "Get Started",
                highlighted: false,
              },
              {
                name: "Professional",
                price: "₦15,000",
                period: "/month",
                desc: "For serious fuel traders",
                features: ["5 regions", "Real-time forecasts", "All market signals", "SMS + Email alerts", "Price history & charts", "Priority support"],
                cta: "Start Free Trial",
                highlighted: true,
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "",
                desc: "For large operations",
                features: ["Unlimited regions", "API access", "Custom integrations", "Dedicated analyst", "Team accounts", "SLA guarantee"],
                cta: "Contact Sales",
                highlighted: false,
              },
            ].map((plan, i) => (
              <Card
                key={i}
                className={plan.highlighted ? "border-primary/50 relative" : ""}
                data-testid={`card-pricing-${i}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="no-default-active-elevate">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.desc}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={() => setLocation("/register")}
                    data-testid={`button-pricing-${i}`}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28" data-testid="section-cta">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Ready to forecast smarter?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join hundreds of Nigerian fuel marketers already using FuelIQ NG to optimize their buying decisions.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={() => setLocation("/register")} data-testid="button-cta-start">
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-border/50" data-testid="footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <Flame className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold">FuelIQ NG</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; 2026 FuelIQ NG. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
