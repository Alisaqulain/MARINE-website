# Marina Muse International: Phase 2 Implementation Task Breakdown (Corrected)

**Prepared:** 16 November 2026, for Ahmad's review.

**Sources:**
- task IDs and estimates: `reports/phase2/PHASE2_REMAINING_IMPLEMENTATION_PLAN.md`, consistent with the accepted v1.1 plan (estimates unchanged);
- "Execution record": existing logs only.

**Execution record:** where work was already done on 15 Nov on relayed go-ahead, this column states it. Doing the work is **not** authorization or acceptance.

**Types:** CODE / TEST / DOC / PROVIDER / PRODUCTION.

---

## G1: Previously authorized and reported completed (no new authorization requested)

| ID | Type | Files / functions | Expected behaviour | Acceptance | Est. | Execution record |
|---|---|---|---|---|---|---|
| T1.1 | TEST | `docker ps`, `docker inspect` | Confirm `marina-dev-mongo` (`mongo:7.0`, `127.0.0.1:27018`) | Identity recorded; no other container touched | 0.1 d | Identity logged 09:32Z and 10:23Z; Run 1 pre-flight narrative only |
| T1.2 | TEST | `reports/evidence/phase2/docker-root-remediation.sh` | Replace the `devroot` password in-container; value discarded | Exit 0; no value printed | 0.1 d | `g1/remediation-…1023Z.log`, exit 0 |
| T1.3 | TEST | `docker-root-verify.sh`; `npm run dev:db -- verify`; ~~`isolation-proof.ps1`~~ (moved to G2) | Verify | NOT USABLE; 13/13; same container id | 0.2 d | All three met (10:23Z logs) |
| — | TEST | `mongodump` backup (added during G1) | Backup before remediation | Manifest verifies | — | Manifest 37/37 logged; creation output narrative only |

**Evidence gaps:** see `G1_COMPLETION_EVIDENCE_REGISTER.md` §4.

## G2: Awaiting Ahmad's separate written decision

| ID | Type | Files / commands | Expected | Acceptance | Depends on | Est. | Execution record (15 Nov, no written authorization) |
|---|---|---|---|---|---|---|---|
| T2.1a | TEST | `npx tsc --noEmit` | Type-check | 0 errors | G1 | 0.3 d (T2.1 total) | `g2/tsc-…1240Z.log`: 0 errors |
| T2.1b | TEST | `npm run check:phase2` | Phase 2 checks | All pass, ≥ 251 | — | (in T2.1) | 251/251 |
| T2.1c | TEST | `check:whatsapp`, `check:whatsapp-direct` | WhatsApp checks | All pass, ≥ 102 / 114 | — | (in T2.1) | 102/102; 114/114 |
| T2.1d | TEST | `npm run build` | Production build | Exit 0 | — | (in T2.1) | Standard build OK; **launcher build failed** |
| T2.2 | TEST | `npm audit` | Dependency audit | Report saved | — | 0.1 d | 8 findings (1 critical, 6 high, 1 moderate) |
| T2.3 | TEST | Read-only index and duplicate inspection | Conflict counts only, no writes | Counts listed | G1 | 0.3 d | `g2/index-inspection-…1240Z.log`: 0 conflicts |
| T2.4 | TEST | `webhook-tests.mjs`, `whatsapp-isolation-tests.mjs`, `check-routes.mjs`, runtime isolation 8/8 | HTTP verification on the local test DB | Pass; fixtures removed | G1 | 0.3 d | routes 19/19; WA 5/5; runtime 8/8 (`final/…1456Z`) |

**G2 total:** 1 d.

**Decision needed:**
- accept the 15 Nov runs, or authorize a fresh re-run on a named tree;
- whether the launcher build failure blocks G2 acceptance.

## G3: Awaiting Ahmad's separate written decision

**Code status:** present as **uncommitted** working-tree changes. Not committed, not deployed.

### D: Zero automatic WhatsApp retries

| ID | Type | Files / functions | Expected | Acceptance | Est. | Record |
|---|---|---|---|---|---|---|
| T3.1 | CODE | `lib/ai/http.ts` `deliveryStateFromHttp()` | Classify sent / failed / unknown | v1.1 §3.2 truth table | 0.2 d | Implemented |
| T3.2 | CODE | `lib/whatsapp/cloud.ts` `postMessage()` | Single attempt; 2xx without id → `unknown` | One fetch per call | 0.2 d | Implemented |
| T3.3 | CODE | `lib/whatsapp/inbound.ts` `deliver()`; `lib/ai/followups.ts` `send()`, `runFollowUps()` | WhatsApp rows terminal; retry only for email | Never re-selected | 0.3 d | Implemented |
| T3.T1 | TEST | `scripts/check-whatsapp-direct.ts` D1–D12 | — | All pass | 0.3 d | Passed (178 → 182 total) |

### Production agent disablement

| ID | Type | Files | Expected | Acceptance | Est. | Record |
|---|---|---|---|---|---|---|
| T3.4 | CODE/DOC | `MARINA_MUSE_PRODUCTION_ENV_TEMPLATE_SANITIZED.env`, `.env.example`, `docs/phase2/ENVIRONMENT_SETUP.md` | Template disables all four | `check:phase2` env checks pass | 0.1 d | Implemented |
| T3.4b | CODE | `lib/ai/agents.ts` fail-closed switch (`AI_AGENTS_ENABLED`, `AI_AGENTS_PRODUCTION_APPROVED`) | Off unless explicitly enabled | Guard-coverage checks | **not in v1.1 estimate**, added scope | Implemented; 274/274 |

### F: Production fingerprints and fail-closed launcher

| ID | Type | Files / functions | Expected | Acceptance | Est. | Record |
|---|---|---|---|---|---|---|
| T3.5 | CODE | `lib/whatsapp/fingerprints.ts` | `canonicalize`, `fingerprint`, `loadFingerprintConfig`, `matches` | v1.1 §5.1–5.2 | 0.3 d | Implemented |
| T3.6 | CODE | `config/whatsapp-production-fingerprints.json` | Valid structure | Valid | 0.05 d | Implemented, **empty lists** (no client hashes) |
| T3.7 | CODE | `scripts/isolated-env.mjs` | Fail closed on missing or invalid config | v1.1 §5.3 | 0.3 d | Implemented |
| T3.8 | CODE | `lib/whatsapp/mode.ts`, `lib/ai/health.ts` | Refuse before fetch outside production | — | 0.2 d | Implemented |
| T3.T2 | TEST | F1–F14 | — | All pass | 0.2 d | Passed |

### E: Recovery lifecycle, reconciliation, admin controls, cron lease

| ID | Type | Files / functions | Expected | Acceptance | Est. | Record |
|---|---|---|---|---|---|---|
| T3.9 | CODE | `lib/whatsapp/event-claims.ts` `reserveReply()`, transitions | Token-fenced reservations | v1.1 §4.1–4.3 | 0.5 d | Implemented |
| T3.10 | CODE | `lib/whatsapp/store.ts` evidence collection and indexes | Insert-only evidence | — | 0.3 d | Implemented |
| T3.11 | CODE | `lib/whatsapp/recovery.ts` | Sweep, list, resolve, claim/complete/reconcile resend | Atomic; no auto release | 1 d | Implemented |
| T3.12 | CODE | Cron lease (`lib/ai/job-lease.ts`; plan named `lib/ai/cron.ts`), `app/api/ai/jobs/route.ts` | No overlap | — | 0.3 d | Implemented (filename differs from plan) |
| T3.13 | CODE | `app/api/admin/ai/route.ts`, `app/api/admin/ai/actions/route.ts` | Admin recovery actions | 401/403/400/409 | 0.5 d | Implemented |
| T3.14 | CODE | `components/AdminWhatsAppRecovery.tsx` (plan named `AdminWhatsAppPanel.tsx`), `lib/ai/health.ts` | Masked UI, warning, acknowledgement | — | 0.5 d | Implemented; browser review screenshots in `final/` |
| T3.T3 | TEST | E1–E20 plus local HTTP E-H tests | — | All pass | 0.5 d | Passed; local HTTP 19/19 |

### Commerce

| ID | Type | Files / functions | Expected | Acceptance | Est. | Record |
|---|---|---|---|---|---|---|
| T3.15 | CODE | `lib/orders.ts` `markPaidOnce()`; PayPal capture and webhook routes | Only the winner fulfils and emails | One fulfilment, one email | 0.4 d | Implemented |
| T3.16 | CODE | `app/api/orders/route.ts`, `app/api/orders/track/route.ts`, `getOrdersByEmail()`, `trackOrderByEmail()`, account and track pages | Session-authenticated, DB-backed | Anonymous 401; mismatch 404 | 0.5 d | Implemented |
| T3.17 | CODE | `sendOrderConfirmation()` via `sendCustomerMail()` | No body logging; `emailSent` only on success | No body in logs | 0.3 d | Implemented; real SMTP NOT VERIFIED |
| T3.T4 | TEST | `scripts/check-phase2.ts`, `check:routes` | — | All pass | 0.3 d | Passed |

### Regression and documentation

| ID | Type | Scope | Est. | Record |
|---|---|---|---|---|
| T3.18 | DOC | Registry clean-up, `DATABASE_MIGRATIONS.md`, phase 2 docs | 0.7 d | Done (uncommitted) |
| T3.T5 | TEST | Full offline regression, secret scan of diff | 0.2 d | Done 15 Nov (scan: 3 false positives) |

**G3 total:** 8 d (v1.1), plus unestimated T3.4b.

**Decision needed:**
- authorize and accept, or require a review or re-run;
- approve a commit separately.

**Outside G3, separate approval:** launcher build fix; `newOrderId()` collision; dependency major upgrades; made-to-order fulfilment.

## G4: Separate authorization (isolated provider verification, fresh test credentials)

| ID | Type | Scope | Needs | Est. |
|---|---|---|---|---|
| T4.1 | TEST | Local HTTP and real Mongo: claims, indexes, lease, restart, concurrency | none | 1 d. Largely run 15 Nov (19/19) without authorization; acceptance pending |
| T4.2 | PROVIDER | 22 Gemini scenarios (≤ 56 requests) | `GEMINI_TEST_API_KEY` | 0.5 d |
| T4.3 | PROVIDER | GA4 / GSC read-only | Service account, property, site | 0.3 d |
| T4.4 | PROVIDER | Meta test-app GETs, 0 sends | Test app, WABA, number, token, fingerprints | 0.3 d |
| T4.5 | TEST | Vapi export comparison | Export file | 0.2 d |

**G4 total:** 2–3 d. **BLOCKED** on credentials.

## G4-B: Separate authorization

| ID | Type | Scope | Needs | Est. |
|---|---|---|---|---|
| T4B.1 | PROVIDER | Temporary allow-listed HTTPS endpoint (two webhook routes); signed Meta test-app and Vapi callbacks; teardown record | Host, window, G4 credentials | 0.5–1 d |

## G5: Separate authorization, each side effect separately

| ID | Type | Scope | Est. |
|---|---|---|---|
| T5.1 | PRODUCTION | Client rotates production secrets; template validation | 1 d |
| T5.2 | PRODUCTION | Backup, deploy named commit, smoke and rollback tests; agents disabled | 0.5–1 d |
| T5.3+ | PRODUCTION | Scheduler start; each agent activation; any single message or email: one approval each | per action |

**G5 total:** 1.5–2 d.

## Effort summary and discrepancies

- **v1.1 total:** 13.5–15.5 engineering days, unchanged.
- **Discrepancies disclosed:**
  1. T3.4b (fail-closed switch) was added after v1.1 and is unestimated.
  2. T3.12 and T3.14 filenames differ from the plan.
  3. Runtime 8/8 moved from G1 (T1.3) to G2 (T2.4) by Ahmad's decision.
  4. An earlier report's "about 75 % complete" is superseded; see the audit §15.

**No task is authorized by this document.**
