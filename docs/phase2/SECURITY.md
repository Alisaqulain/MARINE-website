# Security

- `/test` requires an admin/staff session in production (redirects to `/admin/login`), is `noindex`, and never prints secret values — only "set / missing" per variable. Provider error text is passed through `redactSecrets`.
- Admin AI routes use `requireAdminSession`. Vapi assistant sync and billable callbacks need the main admin (`team`); content actions need product-edit rights. All admin actions are written to `ai_audit`.
- Webhooks: WhatsApp — HMAC-SHA256 `x-hub-signature-256` + verify token (timing-safe); Vapi — `x-vapi-secret` or `Authorization: Bearer` equal to `VAPI_WEBHOOK_SECRET` (timing-safe); Exotel — `?token=EXOTEL_WEBHOOK_TOKEN` (Exotel callbacks are unsigned); generic voice — HMAC `x-marina-voice-signature`; cron — `Authorization: Bearer CRON_SECRET`.
- Duplicate webhook deliveries are ignored (WhatsApp event keys, Vapi call ids, Exotel CallSids).
- Rate limits (in-memory per IP/actor): chat 20/min, attribution 30/min, consent 10/min, voice webhook 300/min, admin AI actions 20/min.
- Customer text is data: instruction-override phrases are stripped; Gemini replies are checked against catalogue facts before sending.
- Consent: follow-ups only with recorded opt-in; STOP / unsubscribe link suppress immediately; outbound calls need consent + owner approval + `VAPI_OUTBOUND_ENABLED`.
- Privacy: the GA4 browser tag loads only after cookie consent with ad storage denied; server-side purchase events use a hashed pseudonymous client id and no email/name.
- Timeouts on every provider call (8–45 s) with one retry on 408/429/5xx.

Known gaps: rate limits are per process (use a shared store if you run several instances); `.env.example` still contains a sample `ADMIN_PASSWORD` value — make sure production uses a different one.
