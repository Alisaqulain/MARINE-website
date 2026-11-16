# Security

- `/test` requires an admin/staff session in production (redirects to `/admin/login`), is `noindex`, and never prints secret values — only "set / missing" per variable. Provider error text is passed through `redactSecrets`.
- Admin AI routes use `requireAdminSession`. Vapi assistant sync and billable callbacks need the main admin (`team`); content actions need product-edit rights. All admin actions are written to `ai_audit`.
- Webhooks: WhatsApp — HMAC-SHA256 `x-hub-signature-256` + verify token (timing-safe); Vapi — `x-vapi-secret` or `Authorization: Bearer` equal to `VAPI_WEBHOOK_SECRET` (timing-safe); Exotel — `?token=EXOTEL_WEBHOOK_TOKEN` (Exotel callbacks are unsigned); generic voice — HMAC `x-marina-voice-signature`; cron — `Authorization: Bearer CRON_SECRET`.
- Duplicate webhook deliveries are ignored (WhatsApp event keys, Vapi call ids, Exotel CallSids).
- Rate limits (in-memory per IP/actor): chat 20/min, attribution 30/min, consent 10/min, voice webhook 300/min, admin AI actions 20/min.
- Customer text is data: instruction-override phrases are stripped; Gemini replies are checked against catalogue facts before sending.
- Consent: follow-ups only with recorded opt-in; STOP / unsubscribe link suppress immediately; outbound calls need consent + owner approval + `VAPI_OUTBOUND_ENABLED`.
- Privacy: the GA4 browser tag loads only after cookie consent with ad storage denied; server-side purchase events use a hashed pseudonymous client id and no email/name.
- Timeouts on every provider call (8–45 s) with one retry on 408/429/5xx, EXCEPT WhatsApp `POST /messages`, Vapi writes and Meta onboarding POSTs, which are never retried (a retry could send twice). WhatsApp outcomes are `sent`, `failed` (definitive rejection or proven pre-transmission failure) or `unknown`; none is resent automatically (Phase 2 D).

Known gaps: rate limits are per process (use a shared store if you run several instances); `.env.example` still contains a sample `ADMIN_PASSWORD` value — make sure production uses a different one.

## Agent switch (fail-closed)

- Every agent is **off unless explicitly enabled**: `AI_AGENTS_ENABLED` lists the agents allowed to run (`chat`, `voice`, `growth`, `whatsapp`). Missing or empty means all four are off.
- Any malformed value in `AI_AGENTS_ENABLED`, `AI_AGENTS_DISABLED` or `AI_AGENTS_PRODUCTION_APPROVED` (typo, `all`, `*`, `true`) switches every agent off.
- `AI_AGENTS_DISABLED` is a kill switch that always wins.
- In production an agent additionally needs `AI_AGENTS_PRODUCTION_APPROVED` (separate written-approval key), so a development value copied to the server cannot activate it.
- Guarded paths: chat route; WhatsApp AI replies and STOP/START confirmations; voice tool calls, Gemini call analysis and missed-call emails; owner lead alerts; follow-up cron (email = chat, WhatsApp template = whatsapp, callbacks = voice); daily report cron, its Google reads and email; admin Vapi sync, outbound callback, WhatsApp resend and content drafts.
- Not agent actions and therefore not gated: consent and opt-out recording, inbound message storage, webhook verification, the recovery sweep (status labels only), storefront and checkout.
