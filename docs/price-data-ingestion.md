# Automated price data

FuelIQ updates its price list from the configured NNPCL API and signed, allow-listed Twilio WhatsApp reports. The dashboard refreshes the price history every 60 seconds and plots the latest observation per Nigeria calendar day, with the observation time and source status. Seeded or legacy records without a verified source are identified as sample or unverified history, not current live quotes.

## NNPCL API

Configure these variables in the server environment:

```env
NNPCL_API_KEY=...
NNPCL_API_URL=https://api.nnpcgroup.com/v1
NNPC_SYNC_INTERVAL=300000
```

The server requests `${NNPCL_API_URL}/prices`. Sync starts automatically when `NNPCL_API_KEY` is configured; the default interval is five minutes and `AUTO_SYNC_NNPC=false` disables scheduled sync. Set `AUTO_SYNC_NNPC=true` to explicitly enable scheduled sync when using the mock feed. The interval must be at least 60 seconds. The dashboard reads new terminal quotes every 60 seconds, and the admin dashboard reports whether live auto-sync is configured and enabled.

Automatic live updates require a valid server-side `NNPCL_API_KEY` and an endpoint that returns current location-specific NGN quotes. Without those credentials the system will not create or substitute prices; configure the key in the server's environment and restart the API.

The feed must return `status: "success"` and `data.products`, with each entry containing a supported product name, an NGN price, a recognized location, and an optional effective date:

```json
{
  "status": "success",
  "data": {
    "products": [
      {
        "name": "PMS",
        "price": 720,
        "currency": "NGN",
        "effectiveDate": "2026-11-24T15:00:00.000Z",
        "location": "Apapa"
      }
    ]
  }
}
```

Only valid NGN quotes for configured terminals are recorded. Unknown locations and unsupported products are not assigned to a different location.

## WhatsApp reports (Twilio)

Set these server variables:

```env
TWILIO_AUTH_TOKEN=...
WHATSAPP_PRICE_WEBHOOK_URL=https://your-domain.example/api/webhooks/whatsapp/prices
WHATSAPP_PRICE_SENDERS=+2348012345678,+2348098765432
```

Configure the Twilio WhatsApp incoming-message webhook to the exact public URL in `WHATSAPP_PRICE_WEBHOOK_URL` using `POST`. The endpoint verifies Twilio's `X-Twilio-Signature`, accepts reports only from `WHATSAPP_PRICE_SENDERS`, and ignores duplicate Twilio message IDs.

Authorized reporters submit one quote per message in this format:

```text
PRICE PMS 720 Apapa
```

Supported products are `PMS`, `AGO`, `DPK`, `LPG`, and `JET_A1`; common names such as `PETROL`, `DIESEL`, and `KEROSENE` are accepted. Prices must be NGN per litre and locations must match a configured terminal name or code. Reports are recorded immediately, with source `WhatsApp`. Do not expose the webhook publicly without setting the Twilio auth token, callback URL, and sender allow-list.

Use real API credentials only in the server's secret environment, never in the client or committed files. `USE_MOCK_NNPC=true` is for development/testing and quotes are labeled `mock`.
