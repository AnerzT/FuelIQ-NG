# Subscription payments

The subscription page uses Stripe Checkout when both `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` are configured. Configure the Stripe webhook endpoint
as `/api/payment/webhook`; the server activates a plan only after a signed,
paid checkout event. Set `APP_URL` to the public application URL for production
checkout redirects.

Bank transfer is only shown when verified Stripe Checkout is not configured.
For local development, the ignored `data/subscription-bank.json` file can hold
the recipient bank details. For deployed environments, configure
`SUBSCRIPTION_BANK_NAME`, `SUBSCRIPTION_ACCOUNT_NUMBER`, and
`SUBSCRIPTION_ACCOUNT_NAME` instead. Requests remain pending until an
administrator verifies the transfer and approves them in the Admin Dashboard's
Payments tab. Submitting a transaction reference alone never activates a plan.

The self-service checkout supports Basic, Pro, and Elite. Enterprise pricing is
custom. Direct subscription updates can downgrade a plan but cannot grant a
paid-tier upgrade.
