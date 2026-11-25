# Nigeria Fuel Price Finder

The Finder reads from the `fuel_finder_*` PostgreSQL tables when `DATABASE_URL` is configured. The PostgreSQL URL can point to a Supabase Postgres database and must remain a server secret. Without a database URL, the same API uses the app's local `data/fuel-finder.json` persistence.

## Database setup

Apply `migrations/0001_fuel_finder.sql` to the Supabase database before enabling `DATABASE_URL` for the application. This migration creates the station directory, price observations, submitted availability reports, one-time price alerts, and in-app notification events. Do not expose a Supabase service-role key or database URL through any `VITE_*` setting.

The directory starts empty. Add only confirmed stations in Admin → Fuel Finder or import them from an authorised provider; the application does not seed example stations or prices.

## Authorised NNPC feed

Configure these values in the server's secret environment:

- `NNPCL_API_KEY`: bearer credential for the authorised provider.
- `NNPC_FUEL_FINDER_URL`: HTTPS endpoint returning the response format below.

Use Admin → Fuel Finder → **Sync authorised NNPC feed** to request an import. Credentials are sent only by the server, and the admin status endpoint reports only whether the integration is configured.

```json
{
  "stations": [
    {
      "id": "provider-station-id",
      "name": "Station name",
      "brand": "NNPC",
      "state": "Lagos",
      "city": "Ikeja",
      "address": "Provider-supplied address"
    }
  ]
}
```

This illustrates station fields only. An optional `prices` array contains entries with `product` (`PMS`, `AGO`, or `LPG`), `priceNaira` (a positive provider-supplied number; per litre for PMS/AGO and per kg for LPG), `availability`, and `observedAt` (an ISO timestamp supplied by the feed). The server validates state, product, amount, availability, timestamp, and coordinates before persisting a price as verified. The endpoint contract is an integration adapter format, not a claim that NNPC has published or enabled this API; confirm the authorised provider's endpoint and payload before configuring it.

## Price and report labels

- **Verified NNPC feed**: validated observation imported from the configured authorised feed.
- **Admin verified**: a manual record explicitly confirmed by an administrator.
- **Manually entered · unverified**: entered by an administrator without source verification.
- **Reviewed community report**: availability report approved by an administrator; it remains a report, not a verified live price.

The public comparison uses verified price observations only. Stale observations remain visible with their source timestamp and a stale label. Price alerts create one-time in-app notifications for administrator-entered or verified feed prices; community reports do not trigger price alerts.
