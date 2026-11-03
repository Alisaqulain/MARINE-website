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
