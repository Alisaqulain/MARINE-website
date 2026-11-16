# Marina Muse International — Phase 2 Remaining Implementation Plan (G2–G5)

**Date:** 15 November 2026 · **Sources:** `PHASE2_FINAL_CONSOLIDATED_DECISION_AND_EXECUTION_PLAN_v1.1.md` (accepted, incl. §5.3) and `PHASE2_FINAL_READINESS_AUDIT.md` (14 Nov). · **Status: STRICT HOLD — NOT AUTHORIZED.** Each task may start only after its gate sentence (v1.1 §10) is received. Function names below are those present at commit `8fe2163`; new ones are marked *(new)*.
**Status update 15 Nov 2026:** G1 partially complete (backup and verification done; `devroot` remediation blocked; 8/8 runtime check moved to G2, task T2.5 below). Task tables are unchanged from the 15 Nov task breakdown; the G1 table is now historical.

**Added G2 task T2.5 [TEST]:** start the isolated server (`node scripts/isolated-env.mjs -- next dev -p 3939`) and run `reports/evidence/phase2/isolation-proof.ps1` → 8/8, only `127.0.0.1:27018`; stop the server afterwards. Effort 0.3 d.

**G4 provider notes:** Vapi verification uses a dashboard export only (no key, no calls, no publishing); "fresh development-only Vapi configuration" means a separate test assistant created by the client, compared offline. WhatsApp: GET operations only, never `/messages`. No paid service activation in any gate.

Task types: **[CODE]** implementation · **[TEST]** offline or local testing · **[PROV]** provider integration with test credentials · **[PROD]** production action.

---

## Priority order
1. **P1 — WhatsApp duplicate-send prevention (D, T3.1–T3.3).** Removes the only live automatic duplicate path (`cloud.ts:171` `retries: 1`; `followups.ts:211,220` three-attempt re-queue).
2. **P2 — Production agent disablement (T3.4).** Code defaults to all agents on when `AI_AGENTS_DISABLED` is empty (`lib/ai/agents.ts:18-21`).
3. F fingerprints (blocks Meta-related testing until hashes exist), then E recovery, then commerce, then docs.

---

## G1 — Local environment preparation (needs: G1 sentence)

| ID | Type | Task | Files / scripts | Acceptance | Effort |
|---|---|---|---|---|---|
| T1.1 | [TEST] | Start Docker Desktop; confirm `marina-dev-mongo` (image `mongo:*`, `127.0.0.1:27018`); before evidence | `docker ps`, `docker inspect` | Identity recorded; no other container touched | 0.1 d |
| T1.2 | [TEST] | Rotate `devroot` inside MongoDB | `reports/evidence/phase2/docker-root-remediation.sh` | Script exits 0; no value printed | 0.1 d |
| T1.3 | [TEST] | Verify | `docker-root-verify.sh`, `npm run dev:db -- verify`, `isolation-proof.ps1` | `NOT USABLE`; 13/13; 8/8; same container id | 0.2 d |

Security checks: no container recreation; no network; logs contain no credential. **Total 0.5 d.**

---

## G2 — Baseline and local verification (needs: G2 sentence; T2.3–T2.4 need G1)

| ID | Type | Task | Files / scripts | Acceptance | Effort |
|---|---|---|---|---|---|
| T2.1 | [TEST] | Baseline on `8fe2163` | `npx tsc --noEmit`, `npm run check:phase2`, `check:whatsapp`, `check:whatsapp-direct`, `npm run build` | All exit 0; counts ≥ 251/102/114; logs dated after commit | 0.3 d |
| T2.2 | [TEST] | `npm audit` (npm registry only) | — | Report saved; high/critical items listed | 0.1 d |
| T2.3 | [TEST] | Read-only index/duplicate inspection | new read-only script under `reports/evidence/phase2/` | Counts and `_id`s only for `wa_inbound_wamid_once`, `wa_reply_once` conflicts; no writes | 0.3 d |
| T2.4 | [TEST] | Existing HTTP suites; update WA1 for direct mode | `webhook-tests.mjs`, `whatsapp-isolation-tests.mjs`, `scripts/check-routes.mjs` | Pass; synthetic fixtures removed | 0.3 d |

Output feeds **decision C** (index policy). **Total 1 d.**

---

## G3 — Code implementation and offline tests (needs: G3 sentence; worktree `phase2-def`; local commits only)

### P1 — D: zero automatic retries
| ID | Type | Task | Files / functions | Acceptance | Effort |
|---|---|---|---|---|---|
| T3.1 | [CODE] | Classifier | `lib/ai/http.ts`: `deliveryStateFromHttp()` *(new)*; pre-transmission error-code set | Truth table per v1.1 §3.2; `reached:false` alone → `unknown` | 0.2 d |
| T3.2 | [CODE] | Single attempt | `lib/whatsapp/cloud.ts` `postMessage()`: `retries: 0`, `retryTimeouts: false`, returns `{ok, delivery, wamid?, error?}`; 2xx without id → `unknown` | One fetch per call | 0.2 d |
| T3.3 | [CODE] | Callers | `lib/whatsapp/inbound.ts` `deliver()` writes `unknown`/`failed` + `firstProblemAt`; `lib/ai/followups.ts` `send()` returns `unknown`; `runFollowUps()` retry only when `row.channel === "email"`; WhatsApp rows terminal; `FollowUp.status` adds `unknown` | WhatsApp never re-selected | 0.3 d |
| T3.T1 | [TEST] | D1–D12 | `scripts/check-whatsapp-direct.ts` (fetch spy) | All pass; 114 existing unchanged | 0.3 d |

### P2 — Production agent disablement
| T3.4 | [CODE] | Set `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp` in `MARINA_MUSE_PRODUCTION_ENV_TEMPLATE_SANITIZED.env` and document in `.env.example` comment and `docs/phase2/ENVIRONMENT_SETUP.md` (`npm run docs:env`). No change to `agentEnabled()` semantics | Template carries the value; `check:phase2` env checks pass | 0.1 d |

### F — Fingerprints
| ID | Type | Task | Files / functions | Acceptance | Effort |
|---|---|---|---|---|---|
| T3.5 | [CODE] | Library | `lib/whatsapp/fingerprints.ts` *(new)*: `canonicalize()`, `fingerprint()`, `loadFingerprintConfig()`, `matches()` | v1.1 §5.1–5.2 rules | 0.3 d |
| T3.6 | [CODE] | Config file | `config/whatsapp-production-fingerprints.json` *(new)*; client hashes if supplied, else empty lists | Structurally valid | 0.05 d |
| T3.7 | [CODE] | Launcher | `scripts/isolated-env.mjs` (validation section alongside the existing deny-list): fail closed on missing/invalid; refuse Meta-related runs with empty required lists; §5.3 Gemini-only exception; recipient list separate; names-only errors | v1.1 §5.3 table | 0.3 d |
| T3.8 | [CODE] | Runtime | `lib/whatsapp/mode.ts` `directConfig()`, `sendEnvironmentDecision()`, `testRecipients()`; WhatsApp card in `lib/ai/health.ts` (`toCard` path) shows config status | Non-production refuses before fetch; production unaffected | 0.2 d |
| T3.T2 | [TEST] | F1–F14 with synthetic vectors | `scripts/check-whatsapp-direct.ts` | All pass | 0.2 d |

### E — Recovery lifecycle
| ID | Type | Task | Files / functions | Acceptance | Effort |
|---|---|---|---|---|---|
| T3.9 | [CODE] | Reservation fields and transitions | `lib/whatsapp/event-claims.ts` `reserveReply()` stores `inboundAt`, `sendToken`; `TRANSITIONS`, `classifyReservation()` *(new)*; `deliver()` `finish()` guarded by `{status:"pending", sendToken}`; `draftInbound()` passes the Meta timestamp | v1.1 §4.1–4.3 | 0.5 d |
| T3.10 | [CODE] | Evidence + index | `lib/whatsapp/store.ts`: `ai_wa_delivery_events` (unique `{inReplyTo, token}`), `{status:1, at:1}` index in `ensureMessageIndexes()` | Insert-only | 0.3 d |
| T3.11 | [CODE] | Recovery module | `lib/whatsapp/recovery.ts` *(new)*: `sweepReservations()`, `listRecoverable()`, `expandMessage()`, `markResolved()`, `claimResend()`, `completeResend()`, `reconcileResend()` | Atomic claims; token fencing; no auto release | 1 d |
| T3.12 | [CODE] | Cron lease + sweep | `lib/ai/cron.ts` lease helper *(new)*; `app/api/ai/jobs/route.ts` `POST` | No overlap; sweep writes labels only | 0.3 d |
| T3.13 | [CODE] | Admin API | `app/api/admin/ai/route.ts` `GET` adds `whatsappRecovery`; `app/api/admin/ai/actions/route.ts` `POST`: `wa_expand_message`, `wa_mark_resolved`, `wa_resend`, `wa_reconcile_resend` (main admin, `originMatches`, `rateLimit`, acknowledgement, `ai_audit`) | 401/403/400/409 paths | 0.5 d |
| T3.14 | [CODE] | Admin UI + health | `components/AdminWhatsAppPanel.tsx` recovery section, warning, checkbox; `lib/ai/health.ts` + `app/test/page.tsx` show `messageIndexState`, counts | Masked, no text by default | 0.5 d |
| T3.T3 | [TEST] | E1–E20 | `scripts/check-whatsapp-direct.ts` (`SimCollection`) | All pass | 0.5 d |

### Commerce (items 1–3; Razorpay untouched; no Sandbox)
| ID | Type | Task | Files / functions | Acceptance | Effort |
|---|---|---|---|---|---|
| T3.15 | [CODE] | PayPal single finalisation | `lib/orders.ts` `markPaidOnce()` *(new, conditional `{id, status:"pending"}`)*; `app/api/paypal/capture/route.ts` `POST`, `app/api/paypal/webhook/route.ts` `POST` call it; only winner runs `fulfillPaidOrder()` + `sendOrderConfirmation()` | One fulfilment, one email | 0.4 d |
| T3.16 | [CODE] | Authenticated lookup | `app/api/orders/route.ts` `GET` requires `auth()` customer session, email = session email; `app/api/orders/track/route.ts` reads DB; `lib/orders.ts` `getOrdersByEmail()`, `trackOrderByEmail()` → DB-backed async; update callers `app/account/orders/page.tsx`, `app/track-order/page.tsx` | Anonymous 401; mismatch 404; survives restart | 0.5 d |
| T3.17 | [CODE] | SMTP confirmation | `lib/orders.ts` `sendOrderConfirmation()` uses `lib/mail.ts` `sendCustomerMail()`; remove `console.info` body log; `emailSent` only on success | No body in logs | 0.3 d |
| T3.T4 | [TEST] | Commerce checks | new checks in `scripts/check-phase2.ts` (simulated collection, mocked transport) + `check:routes` cases | All pass | 0.3 d |

### Config and documentation
| T3.18 | [CODE] | Registry clean-up (`SMTP_FROM`, `CONTACT_EMAILS` notes; `RESEND_API_KEY` marked obsolete for confirmations); docs drift; `DATABASE_MIGRATIONS.md`; eight `reports/phase2/PHASE2_*.md` | Docs consistent | 0.7 d |
| T3.T5 | [TEST] | Full offline regression: tsc, all suites, build, secret scan of diff | Counts not reduced | 0.2 d |

**G3 total ≈ 8 d** (P1 1 d, P2 0.1 d, F 1 d, E 3.6 d, commerce 1.5 d, docs/regression 0.9 d).

---

## G4 — Isolated verification (needs: G4 sentence, G1, G3, credentials)

| ID | Type | Task | Credentials | Acceptance | Effort |
|---|---|---|---|---|---|
| T4.1 | [TEST] | Local HTTP + real-Mongo: claims, indexes, lease, restart, concurrency, D/E routes | none (local) | All pass; `messageIndexState.ok` true | 1 d |
| T4.2 | [PROV] | 22 Gemini scenarios (≤ 56 requests, stop on 429) | `GEMINI_TEST_API_KEY`, project confirmation | 22/22 executed, ledger | 0.5 d + quota waits |
| T4.3 | [PROV] | GA4 `runReport`, GSC `searchAnalytics.query` | service account JSON, `GA4_PROPERTY_ID`, `SEARCH_CONSOLE_SITE_URL` | Read-only results | 0.3 d |
| T4.4 | [PROV] | Meta test-app GETs (phone number, WABA, subscribed apps, templates) | test app id/secret, test WABA, test phone-number ID, test token; populated fingerprint lists | All succeed; 0 sends | 0.3 d |
| T4.5 | [TEST] | Vapi export comparison (offline) | export file | Drift list empty or itemised | 0.2 d |

Security: production credentials never loaded; `WHATSAPP_OUTBOUND_ENABLED=false` forced; fingerprints validated. **Total 2–3 d.**

## G4-B — Temporary HTTPS endpoint (needs: G4-B sentence, G4 credentials)

| T4B.1 | [PROV] | Allow-list proxy (two webhook routes); signed Meta test-app and Vapi delivery; teardown | host, window | Other routes 404; signatures verified; teardown record | 0.5–1 d |

## G5 — Production (needs: G5 sentence; each side effect separate)

| ID | Type | Task | Acceptance | Effort |
|---|---|---|---|---|
| T5.1 | [PROD] | Client rotates production secret set; developer validates template (112 names), `META_APP_ID`, `WHATSAPP_INTEGRATION_MODE=direct`, `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp` | Rotation record without values | 1 d |
| T5.2 | [PROD] | Backup, deploy named commit, smoke tests, rollback test | Agents disabled; WhatsApp switches false; `VAPI_OUTBOUND_ENABLED=false` | 0.5–1 d |
| T5.3+ | [PROD] | Each separately approved: scheduler start; each agent activation (chat first); any single message/email | One sentence per action | per action |

---

## Dependencies and credentials summary

| Needed for | Item |
|---|---|
| G3 (optional but preferred) | Production fingerprint hashes |
| G4 | Gemini test key; Google service account + grants; Meta test app, WABA, number, token; Vapi export; three feed dates; controlled email recipient (only for a G5-style one-time send) |
| G4-B | Endpoint host and window |
| G5 | Rotation schedule; commit hash; environment; window |
| After G2 | Decision C |

## Effort summary
G1 0.5 d · G2 1 d · G3 8 d · G4 2–3 d · G4-B 0.5–1 d · G5 1.5–2 d → **13.5–15.5 engineering days**; realistic calendar 2–4 weeks.

**Implementation remains NOT AUTHORIZED.**
