# Market intelligence data

The authenticated `GET /api/market-intelligence` endpoint combines public benchmark observations with dated Nigeria sector indicators and links to primary industry sources.

## Benchmark feeds

| Display | FRED series | Unit | Frequency |
| --- | --- | --- | --- |
| Brent crude | `DCOILBRENTEU` | USD/barrel | Business day |
| WTI crude | `DCOILWTICO` | USD/barrel | Business day |
| Henry Hub natural gas | `DHHNGSP` | USD/MMBtu | Business day |
| Asia LNG | `PNGASJPUSDM` | USD/MMBtu | Monthly |

FRED distributes these EIA-sourced series. They are delayed published observations, not live futures quotes. Each value includes its observation date and source-series link. The server caches successful responses for one hour and marks a cached response stale if a later refresh fails. If the feed is unavailable before any successful fetch, the endpoint returns no benchmark values and an explicit warning; the dated Nigeria snapshot and official-source links remain available.

The API returns full benchmark history only to non-free subscribers (up to 60 observations per series). Free accounts receive current summaries. There is no verified public Bonny Light series configured, so the UI explicitly reports that quote as unavailable rather than estimating it.

## Nigeria indicators and official sources

The Nigeria production, crude reserves, gas reserves, and flaring figures are the 2024 values shown in EIA's Nigeria analysis, which was updated November 18, 2025. They are historical context, not a 2026 production feed. NNPC, OPEC, NUPRC, and EIA links lead to publisher pages; the dashboard does not scrape or present unverified headlines as live news.

## Paid tools

Benchmark alerts are in-app notifications stored in the user's browser on that device. They are evaluated when the Market Intelligence page is active and the benchmark query refreshes; they do not send SMS, WhatsApp, email, or background push notifications.

The landed-cost worksheet uses user-entered product FOB, freight, insurance, foreign-exchange, and local-cost assumptions:

`((FOB + freight + insurance) / 159 litres per barrel) × NGN per USD + local NGN per litre`

It is a screening estimate, not a quoted import-parity price or refining margin. No verified regional refined-product benchmark feed is configured, so the app does not report refinery margins. Product density, quality differentials, taxes not entered, financing, demurrage, losses, and distribution costs are not modeled.
