# Integration test report

Run on 3 November 2026 against local development (`.env.local`, real Atlas database). Mocked tests and real connectivity tests are reported separately — **no external API is claimed operational from a mocked test.**

## A. Static checks

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | ✅ no errors |
| Production build | `npm run build` (run in an isolated copy so the running dev server's `.next` was not touched) | ✅ compiled; only the existing `jose` Edge-runtime warning from next-auth |
| Lint | — | ⚠ not configured (no ESLint config or dependency in the project) |

## B. Automated logic tests (mocked / pure — no network)

`npm run check:phase2` — **145 passed, 0 failed**

| Area | Covers |
| --- | --- |
| Agent 1 chat | catalogue answers, no invented warranty/price, prompt injection, contact capture, B2C/wholesale/B2B/bulk/OEM segments, lead score bands, owner alert rules, approval gateway (72 h expiry, changed terms) |
| Shared Gemini | grounding guard rejects invented prices / delivery times / discounts; every agent gets the no-invention rule |
| Agent 2 voice | Vapi message parsing, missed-call detection, tool-call arguments, Bearer / legacy secret auth, Gemini assistant config & drift, E.164, Exotel callbacks & token, call-insight validation |
| Agent 3 growth | attribution, funnel, AOV, product attribution, daily report sections, GA4/GSC report sections, JWT signing, keyword opportunities, purchase events, **journey funnel, internal links, low-conversion products, labelled recommendations** |
| Agent 4 WhatsApp | sender/profile parsing, duplicate deliveries, status receipts, STOP/START, send gate (approval flags, 24-hour window, consent, opt-out, live number), template payload, webhook signature & verify token |
| `/test` rules | 6 integration statuses, activity never upgrades a failure, agent Operational / Degraded / Not operational / Disabled, agent switches |
| Environment | registry complete for Phase 2, format validators, values never returned, **code ↔ registry ↔ .env.example ↔ ENVIRONMENT_SETUP.md consistency** |

`npm run check:whatsapp` — **98 passed, 0 failed** (coexistence: featureType launch, waba-only finish, test/live number gating, Graph allow-list without register/deregister/messages/DELETE, one-time 24-hour syncs, history/contacts/echo parsing incl. declined history, outbound rules, modes, no token/full number in status).

## C. HTTP route & security checks (real server, no writes)

`BASE_URL=http://127.0.0.1:3000 npm run check:routes` against the running dev server — **19 passed, 0 failed**: `/test` redirects anonymous users; chat, event and consent validation; forged unsubscribe token; Vapi unsigned / wrong secret; Exotel bad token; WhatsApp wrong verify token and forged signature; cron missing / wrong bearer; daily report anonymous; admin-only APIs (`/api/admin/ai`, actions, WhatsApp status, coexistence steps, signup exchange).

Earlier write-path end-to-end runs (previous sessions, all test records deleted afterwards and the WhatsApp state restored exactly): signed history / contact-sync / echo webhooks stored once, human takeover holds the AI reply, duplicate inbound not answered twice, read receipts applied (13/13); Vapi tool call answered from the catalogue, missed end-of-call stored once, Exotel missed call queued (25/25).

## D. Real connectivity (this environment)

| Integration | Result | Meaning |
| --- | --- | --- |
| MongoDB | ✅ Operational | ping + scratch write/read/delete (deleted) |
| SMTP | ✅ Connected | login accepted; nothing sent |
| Gemini | — Not configured | no key |
| Vapi | — Not configured | no key |
| Exotel | — Not configured | no credentials |
| WhatsApp Cloud API | ⚠ Partial | app secret format invalid; token/IDs missing |
| Coexistence | ⚠ Partial | not onboarded; Meta subscriptions not readable without a valid app secret |
| GA4 / Search Console | — Not configured | no service account |
| Cron | — Not configured | no `CRON_SECRET`; no job run recorded |
| Shopping feed | ⚠ Partial | 328 items, 0 errors; Merchant Center not verifiable |

Agents: Chat **Degraded**, Voice **Not operational**, Growth **Degraded**, WhatsApp **Not operational** — 0/4 operational. All route probes and per-agent logic tests pass.

## Not tested (needs real credentials or approval)

Real Gemini generation; Vapi assistant/number/SIP checks and an actual call through Exotel; WhatsApp sending, delivery receipts and template follow-ups; GA4 / Search Console data; coexistence onboarding with the test number; cron runs from a real scheduler.

*(Sections A–D above are the 3 November run, kept as history. Section E is the current Agent 3 audit.)*

## E. Agent 3 · Growth & Revenue audit (9 November 2026)

Run at 07:30–07:45 UTC against local development.

**Constraints:**
- `.env.local` points at the **production** database, so only read-only queries were made.
- No Gemini request (test isolation is unresolved).
- No email sent, no cron job run, no production change, no checkout.
- Environment loaded with Next.js's own loader (`@next/env`), as the app does.

**Evidence:** `reports/evidence/growth/`.

| # | Check | Status | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | GA4 Data API (auth, property, reports) | **PASS** | service account authenticates; 7- and 28-day reports return data | `google-audit-20261109T0739Z.log` |
| 1a | GA4 tracking of the live website | **FAIL** | 28 days: 8 sessions, 2 users, all "Direct" (mostly `/test`, i.e. local development), against 3,732 page views in the site's own analytics. The live site's layout bundle contains the GA4 loader but **no measurement ID**. The production build was made without `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, so the tag never loads, even after cookie consent. Fix: set the variable on the production build and redeploy (needs approval) | same log |
| 1b | Server-side purchase events (Measurement Protocol) | **PASS** (validation only) | sample purchase event valid on Google's debug endpoint; nothing recorded | same log |
| 1c | Revenue attribution | **PASS** (logic) / **BLOCKED** (live) | revenue counts only `paid` orders, verified in code and self-tests. All 29 orders in the database are `pending`, so there is no real revenue to attribute yet; GA4 shows 0 purchases, consistent with that | same log; self-tests §17 |
| 2 | Search Console queries and ranking data | **PASS** | `siteFullUser` access to `sc-domain:marinamuseinternational.com`. 28 days: 0 clicks, 1 impression (1 query, position 41). The integration works; the site has almost no search visibility yet | `google-audit-20261109T0739Z.log` |
| 3 | Daily report generation and formatting | **PASS** after fix | full mock, mock + live GA4/Search Console, and empty-day reports all render every section with no `undefined`/`NaN`. Fixed: amounts now show cents when needed (`$412.50`, was `$412.5`) and "1 order" is singular. The live report also asks Gemini for a narrative; not exercised (isolation) | `daily-report-mock-*.txt` (before/after fix) |
| 3a | Daily report scheduling | **BLOCKED** | no scheduler has ever called the job (`ai_jobs` is empty), which is why `/test` shows cron "Partial". A production scheduler must call `GET/POST /api/ai/report/daily` daily at 08:00 with `Authorization: Bearer $CRON_SECRET`; needs deployment approval | `lib/ai/cron.ts`, health card |
| 4 | Cron authentication and authorization | **PASS** | constant-time comparison of a SHA-256 of the bearer token; a missing secret or placeholder secret refuses everything. Without the bearer, only a signed-in admin may preview (`?dry=1`) and nothing is sent. Routes: missing/wrong bearer → 401, anonymous daily report → 401 | `check-routes-20261109T0735Z.log`; self-tests |
| 5 | Report generation with mock/isolated data | **PASS** | no database, no Gemini, no email | `daily-report-mock-*.txt` |
| 6 | SMTP | **PASS** (login) / **BLOCKED** (delivery) | `mail.marinamuseinternational.com:587` (STARTTLS) accepts the login; nothing sent. **No test email was sent:** the report always goes to the client's admin mailbox (the hard-coded admin address plus `ADMIN_EMAILS`; `OWNER_ALERT_EMAILS` is unset). Delivery testing needs an authorized test recipient set as `OWNER_ALERT_EMAILS` locally | `smtp-verify-20261109T0736Z.log` |
| 7 | Google Shopping feed (live) | **FAIL** (Merchant Center rules) | well-formed, 340 items, all required fields, prices and availability match the live catalogue 340/340. But: 109 ids over 50 characters, 1 duplicate id, 17 titles over 150 characters, no identifier attribute, 3 preorders without a date, **212 stock photos** (Pexels/Unsplash), 45 thin descriptions | `feed-validation-20261109T0737Z.log` |
| 7a | Google Shopping feed (fixed code, local) | **PASS** for the code faults | ids ≤ 50 and unique (340/340), titles ≤ 150, `identifier_exists=no` on all; prices and availability still match 340/340. Photos, preorder dates and descriptions need client decisions | `feed-validation-local-fixed-20261109T0738Z.log` |
| 8 | Merchant Center scheduled fetch | **Documented** / **BLOCKED** | setup steps and pre-conditions in `MERCHANT_CENTER_SCHEDULED_FETCH.md`; needs the client's Merchant Center account | — |
| 9 | Automated tests | **PASS** | `npm run check:phase2`: 244 passed, 0 failed (includes 6 new feed checks and 1 new report-format check); `npx tsc --noEmit`: no errors; route checks 19/19. The production build was not re-run (it would overwrite the running dev servers' `.next`) | `check-phase2-20261109T*.log`, `tsc-*.log` |

**Code changed, local only, not deployed:**
- `lib/ai/feed.ts`: ids, titles, `identifier_exists`, id-length validation.
- `lib/ai/growth.ts`: uses unique ids.
- `lib/ai/alerts.ts`: money format, plurals.
- `lib/ai/selftest.ts`: new checks.

### Risks reported separately (not changed, need authorization)

1. **PayPal is in LIVE mode in development.** `.env.local` has `PAYPAL_MODE=live` with live client ID, secret and webhook ID. Any checkout on a local or development server would create **real PayPal transactions**, and because the same file points at the production database, it would also write **real orders**. Recommendation: use PayPal sandbox credentials and `PAYPAL_MODE=sandbox` in every non-production environment. No checkout was run.
2. **`ADMIN_PASSWORD` is the published sample value.** The project's own environment check reports "ADMIN_PASSWORD is still the sample value from .env.example". This password gates admin sign-in (`auth.ts`). Whether the production server uses the same value is **unknown** and was not tested. If it does, anyone who knows the sample can sign in as admin. Recommendation: set a strong unique password on production first, then locally. Not changed.
