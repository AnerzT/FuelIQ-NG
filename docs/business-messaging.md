# Business messaging

The messaging feature reuses FuelIQ customer authentication and verification. It does not expose customer email addresses, phone numbers, or verification documents in discovery or chat. Business profile verification is separate from customer verification and never implies official NNPC authorisation.

## Database and storage setup

Apply migrations `0003_business_messaging.sql` and `0004_messaging_storage.sql` after `0002_community_fuel.sql` to the configured PostgreSQL/Supabase database. The migrations create the messaging tables, participant-based RLS, audit and moderation records, and—when Supabase Storage is available—a private `messaging-private` bucket restricted to the service role.

Configure these server-side environment variables for attachments:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — secret; never expose it to the browser

Attachment access is mediated by the API, which checks conversation participation and issues a five-minute signed URL. Only JPEG, PNG, WebP, and PDF files up to 10 MB are accepted. If storage configuration is missing, attachment requests return an explicit service-unavailable error; text messaging does not depend on storage.

## Real-time delivery

Messages and typing events are streamed to authenticated clients over Server-Sent Events. This provides live delivery on a single API process. For horizontally scaled deployments, use a shared event broker or Supabase Realtime bridge so events reach clients connected to other API instances; the in-process event bus is not a cross-instance broker.

## Privacy and moderation

Database policies restrict conversations, messages, receipts, and attachments to participants. Administrators can review report metadata, verify public business profiles, and suspend messaging access with a recorded reason; there is no default administrative path to read private message contents. Official NNPC authorisation is never set by customer registration or business-profile verification.
