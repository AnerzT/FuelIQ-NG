import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Activity,
  Truck,
  Droplets,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  RefreshCw,
  Flame,
  LogOut,
  BarChart3,
  Calendar,
  MapPin,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useState } from "react";
import type { Forecast, MarketSignal, PriceAnchor, PriceHistoryEntry } from "@shared/schema";

const signalIcons: Record<string, any> = {
  vesselActivity: Activity,
  truckQueue: Truck,
  nnpcSupply: Droplets,
  fxPressure: DollarSign,
  policyRisk: AlertTriangle,
};

const signalLabels: Record<string, string> = {
  vesselActivity: "Vessel Activity",
  truckQueue: "Truck Queue",
  nnpcSupply: "NNPC Supply",
  fxPressure: "FX Pressure",
  policyRisk: "Policy Risk",
};

function getSignalColor(value: string): string {
  const v = value.toLowerCase();
  if (v === "none" || v === "low") return "text-primary";
  if (v === "medium" || v === "moderate") return "text-amber-500";
  if (v === "high" || v === "weak" || v === "bearish") return "text-red-400";
  if (v === "strong" || v === "bullish") return "text-primary";
  return "text-muted-foreground";
}

function getBiasIcon(bias: string) {
  const b = bias.toLowerCase();
  if (b.includes("increase") || b.includes("bullish")) return TrendingUp;
  if (b.includes("decrease") || b.includes("bearish")) return TrendingDown;
  return Activity;
}

function getBiasColor(bias: string) {
  const b = bias.toLowerCase();
  if (b.includes("increase") || b.includes("bullish")) return "text-amber-500";
  if (b.includes("decrease") || b.includes("bearish")) return "text-primary";
  return "text-muted-foreground";
}

interface ForecastData {
  forecast: Forecast;
  signals: MarketSignal;
  anchors: PriceAnchor;
}

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedRegion, setSelectedRegion] = useState("apapa");
  const [selectedProduct, setSelectedProduct] = useState("PMS");

  const { data: forecastData, isLoading: forecastLoading, refetch: refetchForecast } = useQuery<ForecastData>({
    queryKey: ["/api/forecasts/latest"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: priceHistory, isLoading: historyLoading } = useQuery<PriceHistoryEntry[]>({
    queryKey: ["/api/price-history"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  if (!user) {
    setLocation("/login");
    return null;
  }

  const chartData = priceHistory?.map((entry) => ({
    date: new Date(entry.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
    price: entry.price,
  })) || [];

  const forecast = forecastData?.forecast;
  const signals = forecastData?.signals;
  const anchors = forecastData?.anchors;

  const currentDate = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background" data-testid="page-dashboard">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl" data-testid="dashboard-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <Flame className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight hidden sm:block">FuelIQ NG</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{currentDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {user.fullName?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <span className="text-sm font-medium hidden sm:block" data-testid="text-username">{user.fullName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-32" data-testid="select-product">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PMS">PMS</SelectItem>
                <SelectItem value="AGO">AGO (Diesel)</SelectItem>
                <SelectItem value="DPK">DPK (Kerosene)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-44" data-testid="select-region">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apapa">Apapa Axis</SelectItem>
                <SelectItem value="lagos-mainland">Lagos Mainland</SelectItem>
                <SelectItem value="ph">Port Harcourt</SelectItem>
                <SelectItem value="abuja">Abuja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={() => refetchForecast()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {forecastLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <Card data-testid="card-market-signals">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Market Signals</h3>
                <div className="space-y-2">
                  {signals && Object.entries(signalLabels).map(([key, label]) => {
                    const Icon = signalIcons[key];
                    const value = (signals as any)[key] || "N/A";
                    return (
                      <div key={key} className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-md bg-muted/50" data-testid={`signal-${key}`}>
                        <div className="flex items-center gap-2 text-sm">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span>{label}</span>
                        </div>
                        <span className={`text-sm font-medium ${getSignalColor(value)}`}>{value}</span>
                      </div>
                    );
                  })}
                  {!signals && (
                    <div className="text-sm text-muted-foreground py-4 text-center">No signal data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-price-anchors">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Price Anchors</h3>
                {anchors ? (
                  <div className="space-y-3">
                    <div className="py-3 px-3 rounded-md bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Yesterday Close</div>
                      <div className="text-xl font-semibold font-mono" data-testid="text-yesterday-close">
                        &#8358;{anchors.yesterdayCloseLow?.toLocaleString()} &mdash; &#8358;{anchors.yesterdayCloseHigh?.toLocaleString()}
                      </div>
                    </div>
                    <div className="py-3 px-3 rounded-md bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Overnight Sentiment</div>
                      <Badge
                        variant={anchors.overnightSentiment?.toLowerCase() === "bearish" ? "destructive" : "default"}
                        className="no-default-active-elevate"
                        data-testid="badge-sentiment"
                      >
                        {anchors.overnightSentiment}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-4 text-center">No anchor data available</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/[0.02]" data-testid="card-forecast-output">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-primary">Forecast Output</h3>
                {forecast ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Expected Range</div>
                      <div className="text-2xl font-bold font-mono gradient-text" data-testid="text-expected-range">
                        &#8358;{forecast.expectedLow?.toLocaleString()} &mdash; &#8358;{forecast.expectedHigh?.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Market Bias</div>
                      <div className="flex items-center gap-2" data-testid="text-market-bias">
                        {(() => {
                          const BiasIcon = getBiasIcon(forecast.marketBias);
                          return <BiasIcon className={`w-4 h-4 ${getBiasColor(forecast.marketBias)}`} />;
                        })()}
                        <span className={`text-sm font-medium ${getBiasColor(forecast.marketBias)}`}>
                          {forecast.marketBias}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Confidence</div>
                      <div className="flex items-center gap-2" data-testid="text-confidence">
                        <div className="flex-1 h-2 bg-muted rounded-full">
                          <div
                            className="h-2 bg-primary rounded-full transition-all duration-700"
                            style={{ width: `${forecast.confidence}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold font-mono">{forecast.confidence}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Suggested Action</div>
                      <ul className="space-y-1.5">
                        {forecast.suggestedActions?.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm" data-testid={`text-action-${i}`}>
                            <ChevronRight className="w-3 h-3 mt-1 text-primary flex-shrink-0" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-4 text-center">No forecast available</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="price-trend" className="space-y-4" data-testid="tabs-charts">
          <TabsList>
            <TabsTrigger value="price-trend" data-testid="tab-price-trend">
              <BarChart3 className="w-4 h-4 mr-2" />
              Price Trend
            </TabsTrigger>
            <TabsTrigger value="volume" data-testid="tab-volume">
              <Activity className="w-4 h-4 mr-2" />
              Volume
            </TabsTrigger>
          </TabsList>

          <TabsContent value="price-trend">
            <Card data-testid="card-price-chart">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <h3 className="font-semibold">Price Trend (Last 30 Days)</h3>
                  <Badge variant="secondary" className="no-default-active-elevate font-mono">
                    {selectedProduct}
                  </Badge>
                </div>
                {historyLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(152 60% 42%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(152 60% 42%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 10% 16%)" />
                      <XAxis dataKey="date" stroke="hsl(220 10% 40%)" fontSize={12} tickLine={false} />
                      <YAxis stroke="hsl(220 10% 40%)" fontSize={12} tickLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(220 15% 10%)",
                          border: "1px solid hsl(220 10% 16%)",
                          borderRadius: "6px",
                          color: "hsl(210 20% 93%)",
                          fontSize: "13px",
                        }}
                        formatter={(value: number) => [`₦${value}`, "Price"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="hsl(152 60% 42%)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                    No price history data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="volume">
            <Card data-testid="card-volume-chart">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <h3 className="font-semibold">Market Volume Indicators</h3>
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 10% 16%)" />
                      <XAxis dataKey="date" stroke="hsl(220 10% 40%)" fontSize={12} tickLine={false} />
                      <YAxis stroke="hsl(220 10% 40%)" fontSize={12} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(220 15% 10%)",
                          border: "1px solid hsl(220 10% 16%)",
                          borderRadius: "6px",
                          color: "hsl(210 20% 93%)",
                          fontSize: "13px",
                        }}
                        formatter={(value: number) => [`₦${value}`, "Price"]}
                      />
                      <Bar dataKey="price" fill="hsl(152 60% 42%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                    No volume data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
