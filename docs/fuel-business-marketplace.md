# Fuel Business Marketplace

The marketplace uses the application's existing customer authentication. Marketplace reads and writes require an approved customer whose email or phone has been verified.

## Database and storage setup

Apply migrations `0001_fuel_finder.sql` through `0005_fuel_business_marketplace.sql` in order. Apply `0004_messaging_storage.sql` to create the private `messaging-private` bucket used for optional listing documents. The messaging migration (`0003`) must be applied before marketplace migration `0005`, because marketplace conversations reuse its participant and blocking policies.

For private document uploads and signed downloads, configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the API server only. Never expose the service-role key to the browser. Listing documents accept JPEG, PNG, WebP or PDF up to 10 MB and are only accessible to the listing owner or an administrator through short-lived signed URLs.

## Marketplace behavior

Customers can publish fuel and service listings, create procurement requests, save business-interest preferences, send offers to matched requests, make listing enquiries, and negotiate through existing private messaging. Match recommendations are calculated server-side from product, quantity, target price, state/delivery compatibility and business verification. The response includes the reasons contributing to each match. Customers can turn marketplace matching, offer, enquiry, and listing-expiry notifications on or off from Business Preferences.

Offers and accepted offers record business intent only. FuelIQ does not process payments, provide escrow, confirm supply, or independently guarantee a listed price or business. A verified-business badge is separate from customer verification and does not imply NNPC authorization.

Listing and request expiration is enforced in API queries and refreshed by a 15-minute server job on the long-running Node server. Deployments without a persistent Node process should schedule the marketplace expiry job in their platform scheduler; expired rows remain unavailable even if the status-refresh job is not running.
