const FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const CACHE_DURATION_MS = 60 * 60 * 1000;

const SERIES = [
  {
    id: "DCOILBRENTEU",
    key: "brent",
    name: "Brent crude",
    unit: "USD/bbl",
    sourceUrl: "https://fred.stlouisfed.org/series/DCOILBRENTEU",
  },
  {
    id: "DCOILWTICO",
    key: "wti",
    name: "WTI crude",
    unit: "USD/bbl",
    sourceUrl: "https://fred.stlouisfed.org/series/DCOILWTICO",
  },
  {
    id: "DHHNGSP",
    key: "henryHub",
    name: "Henry Hub natural gas",
    unit: "USD/MMBtu",
    sourceUrl: "https://fred.stlouisfed.org/series/DHHNGSP",
  },
  {
    id: "PNGASJPUSDM",
    key: "asiaLng",
    name: "Asia LNG",
    unit: "USD/MMBtu",
    sourceUrl: "https://fred.stlouisfed.org/series/PNGASJPUSDM",
  },
] as const;

export interface MarketObservation {
  date: string;
  value: number;
}

export interface MarketBenchmark {
  key: typeof SERIES[number]["key"];
  seriesId: string;
  name: string;
  unit: string;
  value: number;
  observedAt: string;
  sourceUrl: string;
  history: MarketObservation[];
}

export interface MarketBenchmarksSnapshot {
  fetchedAt: string;
  stale: boolean;
  warning?: string;
  benchmarks: MarketBenchmark[];
}

let cachedSnapshot: MarketBenchmarksSnapshot | null = null;
let cachedAt = 0;

function getRecentStartDate(now: Date) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - 120);
  return date.toISOString().slice(0, 10);
}

function parseFredCsv(csv: string, fetchedAt: string): MarketBenchmarksSnapshot {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("FRED returned no benchmark observations");

  const headings = lines[0].split(",");
  const dateColumn = headings.indexOf("observation_date");
  if (dateColumn < 0) throw new Error("FRED response is missing observation dates");

  const observations = new Map<string, MarketObservation[]>(
    SERIES.map(series => [series.id, []]),
  );
  for (const line of lines.slice(1)) {
    const values = line.split(",");
    const date = values[dateColumn];
    if (!date || !Number.isFinite(Date.parse(date))) continue;
    for (const series of SERIES) {
      const column = headings.indexOf(series.id);
      const rawValue = column < 0 ? "" : values[column]?.trim();
      if (!rawValue || rawValue === ".") continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;
      observations.get(series.id)?.push({ date, value });
    }
  }

  const benchmarks = SERIES.flatMap(series => {
    const history = observations.get(series.id) || [];
    const latest = history[history.length - 1];
    if (!latest) return [];
    return [{
      key: series.key,
      seriesId: series.id,
      name: series.name,
      unit: series.unit,
      value: latest.value,
      observedAt: latest.date,
      sourceUrl: series.sourceUrl,
      history,
    }];
  });
  if (benchmarks.length === 0) throw new Error("FRED returned no usable benchmark prices");
  return { fetchedAt, stale: false, benchmarks };
}

export async function getMarketBenchmarks(): Promise<MarketBenchmarksSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now - cachedAt < CACHE_DURATION_MS) return cachedSnapshot;

  const requestedAt = new Date(now);
  const params = new URLSearchParams({
    id: SERIES.map(series => series.id).join(","),
    cosd: getRecentStartDate(requestedAt),
    coed: requestedAt.toISOString().slice(0, 10),
  });

  try {
    const response = await fetch(`${FRED_CSV_URL}?${params}`, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`FRED returned HTTP ${response.status}`);
    const snapshot = parseFredCsv(await response.text(), requestedAt.toISOString());
    cachedSnapshot = snapshot;
    cachedAt = now;
    return snapshot;
  } catch (error) {
    if (cachedSnapshot) {
      return {
        ...cachedSnapshot,
        stale: true,
        warning: error instanceof Error ? error.message : "The benchmark feed is temporarily unavailable",
      };
    }
    throw error;
  }
}
