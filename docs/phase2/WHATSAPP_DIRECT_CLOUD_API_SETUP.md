# WhatsApp Direct Cloud API: setup (business-owned WABA)

**Applies when `WHATSAPP_INTEGRATION_MODE=direct`.** Without it, the site keeps the earlier Embedded Signup / Coexistence behaviour (`WHATSAPP_COEXISTENCE_SETUP.md`).
**Status (11 Nov 2026):** code changes C1–C10 are implemented and verified only by offline tests. Nothing has been tested against Meta. See `reports/phase2/WHATSAPP_DIRECT_CLOUD_API_IMPLEMENTATION_REPORT.md`.

## What direct mode does

- **Credentials:** read from the server environment only. A token stored earlier by Embedded Signup is never used.
- **Webhook:** accepts only `messages` changes for the configured WABA ID **and** phone-number ID. Everything else is acknowledged and dropped before processing.
- **Embedded Signup and Coexistence:** the routes answer **410** and the admin panel does not load the Facebook SDK.
- **Sending** needs `WHATSAPP_OUTBOUND_ENABLED=true` and either:
  - `WHATSAPP_PRODUCTION_SENDING_APPROVED=true` (written approval), **or**
  - the approved test number and test WABA, sending only to `WHATSAPP_TEST_RECIPIENTS`.
- **Never sends from a non-production server.** The single exception is the isolated test launcher with the exact test IDs.
- The live business number is never a recipient.

## Server environment (names only; values are set by the client on the server)

| Variable | Notes |
|---|---|
| `WHATSAPP_INTEGRATION_MODE` | `direct` |
| `WHATSAPP_ACCESS_TOKEN` | System User token with `whatsapp_business_messaging` + `whatsapp_business_management`, scoped to the WABA |
| `WHATSAPP_PHONE_NUMBER_ID` | Numeric phone-number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Numeric WABA ID |
| `META_APP_ID` | Must be set explicitly. There is no built-in default |
| `META_APP_SECRET` (or `META_WEBHOOK_APP_SECRET`) | Verifies `X-Hub-Signature-256` |
| `META_WEBHOOK_VERIFY_TOKEN` | Random string, also entered in the App Dashboard |
| `META_GRAPH_API_VERSION` | Optional (default `v26.0`) |
| `WHATSAPP_OUTBOUND_ENABLED` | `false` until sending is approved |
| `WHATSAPP_PRODUCTION_SENDING_APPROVED` | `true` only after written approval |
| `WHATSAPP_FOLLOWUP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE` | Optional, approved template only |

The coexistence variables (`META_CONFIG_ID`, `WHATSAPP_COEXISTENCE_*`, `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED`) are not used in direct mode.

## Steps done by the client in Meta (not by this site)

1. Register the phone number and set the two-step PIN in WhatsApp Manager. The site never calls `/register`.
2. Subscribe the app to the WABA (App Dashboard, or `POST /{waba}/subscribed_apps`). The site only reads it.
3. Webhook: callback `https://<site>/api/meta/whatsapp/webhook`, the verify token, and the field `messages`.
4. Create message templates in WhatsApp Manager.

**Number plan:** a decision is still open (Audit §3). The current Business-app number stays blocked in code.

## Delivery, recovery and fingerprint protection (Phase 2 D/E/F)

- **One attempt per message.** `POST /messages` is sent with `retries: 0`; no layer (HTTP wrapper, cron, webhook redelivery) resends. Outcomes: `sent`, `failed` (any 4xx, or a proven pre-transmission network error), `unknown` (timeout, reset, 5xx, missing message id). Neither `failed` nor `unknown` is resent automatically.
- **Two clocks.** The reply window uses the customer's inbound Meta timestamp (`inboundAt`). Recovery expiry is 24 hours after the record first became stale, unknown or failed (`firstProblemAt`). Pending replies become stale after 10 minutes (15-minute sweep in `/api/ai/jobs`).
- **Manual recovery only.** Admin → Marina AI → WhatsApp → Reply recovery: masked list, "Show message" (main admin), "Mark resolved", and "Resend once" (main admin, duplicate-risk acknowledgement, audited). A crashed resend leaves `resend_claimed`, which only an admin can reconcile.
- **Fingerprints.** `config/whatsapp-production-fingerprints.json` holds SHA-256 of `"<kind>:<id>"` for production identifiers and, separately, protected recipient numbers. Outside production, any Meta-related run is refused while the required lists are empty or the file is missing or invalid; matching identifiers are refused. Gemini-only runs need only a valid file. Production is unaffected. Fingerprints are an accidental-misconfiguration guard, not a secret.


## Webhook behaviour

| Situation | Response |
|---|---|
| Body > 1 MB | 413 (before any signature work) |
| Missing or wrong signature | 401. Secret not configured: 503 |
| Not JSON | 400 |
| Direct mode with WABA / phone-number ID not configured | 503 |
| Foreign or missing WABA ID or phone-number ID, or a non-`messages` field | Dropped. 200 with `ignoredForeign` / `ignoredOther` counts |
| Processed, or already processed (duplicate) | 200 |
| Database processing failed | 500 with a fixed message. The event is marked `failed` and Meta redelivers |
| Same event still being processed by another request | 500 ("in progress"). Meta redelivers later |

## Isolated testing

1. Put the separate Meta **test** app values in `.env.isolated-test.local`.
2. The test values must satisfy both:
   - `WHATSAPP_PHONE_NUMBER_ID` = `WHATSAPP_TEST_PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID` = `WHATSAPP_TEST_BUSINESS_ACCOUNT_ID`
3. `node scripts/isolated-env.mjs -- …` refuses to start on a mismatch, a known production ID, or an unexpected name.
4. The launcher forces `direct` mode and outbound off.
5. Offline checks: `node scripts/isolated-env.mjs -- npm run check:whatsapp-direct`.
