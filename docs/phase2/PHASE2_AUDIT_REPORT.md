# Phase 2 audit report

Date: 3 November 2026 · Environment checked: local development (`.env.local`, Atlas database) · Live status: **/test** (admin login).

## 1. Was Phase 2 complete before this audit?

**No.** The four agents' core paths existed and were wired into the app (every AI, WhatsApp and Google module is imported by a route or page — no dead modules were found), but these required pieces were missing or incomplete:

| Area | Gap found |
| --- | --- |
| Shared | No way to switch an agent off; no Gemini usage/error monitoring; environment configuration scattered, with no validation |
| Agent 3 Growth | Add-to-cart, checkout and quote steps not tracked → no checkout/CRO funnel; no internal-linking recommendations; recommendations not labelled real data vs estimate vs AI |
| `/test` | Only connected/partial/failed/not-configured; no Database, Cron, Email or Merchant cards; no last-success / last-error history; no per-agent health; no overall readiness; open without login in development |
| Environment | 15 variables read by the code were missing from `.env.example`; `MERCHANT_CENTER_ID` documented but unused; `.env.example` contained a real-looking sample admin password |
| Docs | Audit report, integration test report and coexistence setup docs missing; environment doc out of date |

## 2–3. What was implemented or fixed in this audit

- **Environment registry** (`lib/ai/env-registry.ts`): all 98 variables with provider, where to get each, required/optional, agent, scope, secret flag and a format validator. `/test`, `.env.example`, `ENVIRONMENT_SETUP.md` (`npm run docs:env`) and a consistency test all read from it.
- **Agent switches**: `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp` turns individual agents off (chat route returns 503, WhatsApp keeps messages without AI replies, voice tools offer a callback, growth drafts/insights pause).
- **Gemini usage monitoring** (`lib/ai/usage.ts`): every generation logged per agent/operation (ok, duration, sanitised error) in `ai_usage`; 24-hour summary per agent on `/test`.
- **Growth journey & CRO**: `POST /api/ai/event` (add to cart, begin checkout — random session id only), funnel visit → cart → checkout → paid plus chats, calls and quotes; checkout-abandonment, low-conversion products, internal-link suggestions; every recommendation labelled **real data / estimate / AI** (Admin → Marina AI → Growth).
- **`/test` rebuilt as a health dashboard** (`lib/ai/health.ts`): overview, 11 integration cards with 6 statuses, 4 agent health sections, coexistence section, environment checklist, run history in `ai_health_runs`. Admin-only in every environment.
- Fixes: GA4/Search Console now ask for the recommended `GOOGLE_SERVICE_ACCOUNT_JSON`; stale "search-data provider" note; `.env.example` no longer ships a sample admin password.

## 4. Status of the four agents (measured in this environment)

| Agent | Code complete | Live dependencies verified | /test status | Blocking |
| --- | --- | --- | --- | --- |
| 1 Chat & Sales | 96 % | 75 % | **Degraded** (catalogue-only replies) | `GEMINI_API_KEY`, `CRON_SECRET` |
| 2 Voice & Call | 96 % | 67 % | **Not operational** | Vapi + Exotel accounts, `GEMINI_API_KEY` |
| 3 Growth & Revenue | 95 % | 50 % | **Degraded** | `GEMINI_API_KEY`, Google service account, GA4/GSC IDs, `CRON_SECRET` |
| 4 WhatsApp Sales & Support | 95 % | 56 % | **Not operational** | WhatsApp Cloud API token/IDs, valid `META_APP_SECRET`, Meta approvals |
| **Phase 2 overall** | **≈ 95 %** | **62 %** (agent readiness) · **2 / 11** integrations up | **0 / 4 operational** | provider accounts and credentials |

*Code complete* = share of the specified requirements implemented and covered by automated tests (remaining: Merchant Center API upload not built — feed only; bag-only abandonment without any contact cannot be recovered; Exotel vSIP endpoints taken from Exotel's own connector repo because the official reference page returned 404). *Live dependencies verified* = the agent's dependency score on `/test` (critical + required checks passing right now).

## 5. Which external APIs are genuinely connected?

| Integration | Status on /test | Evidence |
| --- | --- | --- |
| MongoDB | **Operational** | ping + scratch write/read/delete |
| SMTP (owner alerts) | **Connected** | SMTP login; no owner email delivered yet |
| Gemini, Vapi, Exotel, GA4, Search Console, Cron | Not configured | credentials missing |
| WhatsApp Cloud API, Coexistence | Partially configured | `META_APP_SECRET` present but not in Meta's 32-hex format; token / IDs missing |
| Google Shopping feed | Partially configured | 328 items, 0 errors at `/feeds/google.xml`; Merchant Center fetch not verifiable from the site |
| PayPal, ShipGlobal (store) | shown separately | existing checks unchanged |

No integration is shown as connected because a variable exists; only a successful provider response counts, and "Operational" additionally needs real production activity.

## 6–9. Credentials, approvals and where to get them

See **ENVIRONMENT_SETUP.md** (every variable, provider, portal, steps, agent, scope). Snapshot of this `.env.local`: **30 of 98 set**.

Missing and needed: `GEMINI_API_KEY`, `CRON_SECRET`, `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET`, `VAPI_PHONE_NUMBER_ID`, `VAPI_SIP_CREDENTIAL_ID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_ACCOUNT_SID`, `EXOTEL_PHONE_NUMBER`, `EXOTEL_TRUNK_SID`, `EXOTEL_WEBHOOK_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_WEBHOOK_VERIFY_TOKEN` (if not yet set), `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`, `SEARCH_CONSOLE_SITE_URL` (optional: `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `WHATSAPP_FOLLOWUP_TEMPLATE`, `WHATSAPP_COEXISTENCE_TEST_NUMBER`).

Invalid now: **`ADMIN_PASSWORD` is still the sample value** that was published in `.env.example` — change it; **`META_APP_SECRET`** is not 32 hex characters (copy it again from App settings → Basic).

Accounts / approvals / paid plans: Exotel (**KYC**, ExoPhone, **vSIP enablement**), Vapi (pay-as-you-go; calls billed), Gemini (billing for production quotas), Meta (business verification, permanent System User token, approved templates, **Tech Provider / Solution Partner** for coexistence), Google Cloud project with APIs enabled + GA4/GSC access grants.

## 10. WhatsApp coexistence

Code complete and tested with mocks and simulated signed webhooks (featureType sent, waba-only finish handled, server-side code exchange, encrypted token, test-number gating, one-time 24-hour syncs, history / contacts / echoes handled, never register/deregister). **Not active**: no real onboarding has happened; `/test` shows *Partially configured / not connected*. Steps and approvals: **WHATSAPP_COEXISTENCE_SETUP.md**.

## 11. Before production deployment

1. Change `ADMIN_PASSWORD`; set a long `AUTH_SECRET`, `CRON_SECRET`.
2. Add Gemini; schedule the two cron jobs.
3. Google service account + GA4/GSC access.
4. Meta: token, IDs, valid app secret, public HTTPS webhook with the 5 fields subscribed; coexistence test-number run, then written approval.
5. Exotel KYC + vSIP trunk → Vapi SIP credential/number/assistant → "Sync Vapi assistant".
6. Deploy, restart, open `/test` and work through each card's *Next action* until the agents show Operational.

## 12. Tests

See **INTEGRATION_TEST_REPORT.md**. Summary: type check ✅, production build ✅, logic tests 145/145 ✅, coexistence tests 98/98 ✅, HTTP route/security checks 19/19 ✅ (against the running dev server), real health check run ✅. Lint: **not configured** in this project (no ESLint config/dependency) — not run. No test sent a WhatsApp message, placed a call or charged a payment.
