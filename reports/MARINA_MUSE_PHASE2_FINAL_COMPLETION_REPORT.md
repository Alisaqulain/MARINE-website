# Marina Muse International: Phase 2 consolidated report

> **Security update, 10 November 2026.** Full detail: `MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md`.
>
> **What the disk-wide verification found.** The production MongoDB URI and password survive in copies of the pre-isolation development `.env.local` outside the project, and they were sent to third-party AI services:
> - another project's `.env.local` (`jobcareerpao`);
> - 21 VS Code/Cursor local-history snapshots;
> - Cursor agent data;
> - a ChatGPT cache entry.
>
> **What it means.** **Every secret that file held must be treated as exposed and rotated before any production deployment.** Development itself is still isolated: fresh check on 10 Nov, 0 production references, 0 production connections.
>
> **Status of this report.** Sections 1, 9 and 11–14 below are updated. Production deployment is **not** authorized.

**Updated 9 November 2026, 13:10 UTC (18:40 IST), after the client-authorized execution sprint.** Development and isolated testing only:
- Nothing was deployed, published, activated, purchased or sent, and no call was made.
- No customer was contacted, and no customer record was created.
- The production database was not accessed during the sprint.
- Riley is unchanged, and no production configuration was changed.

## 1. Executive summary

**Development security isolation is complete:**
- Development now runs on a separate local test database. The code refuses any remote database outside production.
- The sample admin password is replaced.
- PayPal LIVE credentials are removed.
- Real-world side effects from development are blocked: shipments, GA4 revenue and owner email.

All of this is verified on a running local server.

The other priorities are waiting on inputs only the client or you can provide:
- **Chat & Sales (22 scenarios) — Blocked.** `GEMINI_TEST_API_KEY` is still not in `.env.local`, so no conversation test was run.
- **Voice & Call (rotation) — Pending client action.** The replacement webhook secret hasn't been provided.
- **WhatsApp — Blocked.** The Meta App Secret hasn't been provided, and the eligibility answers are pending.

| Agent | Development completion | Change | Production ready |
|---|---|---|---|
| 1 Chat & Sales | **75%** (7.5/10) | +5 | No |
| 2 Voice & Call | **80%** (8/10) | — | No |
| 3 Growth & Revenue | **79%** (9.5/12) | +8 | No |
| 4 WhatsApp Sales & Support | **45%** (4.5/10) | — | No |
| **Overall** | **69.8%** (mean of the four) | +3.3 | **0 of 4** |

**Method.** Each required capability scores:
- **1**: verified in development with real evidence;
- **0.5**: implemented but verified only by code review, mocked tests or partly;
- **0**: blocked, failing or untested.

An agent's percentage is its score divided by its number of capabilities. Production deployment is excluded and tracked separately as readiness (0 of 4).

## 2. Sprint task status

### Priority 1: development environment security isolation

| Task | Status | What changed | Test and result | Evidence | Remaining dependency |
|---|---|---|---|---|---|
| Admin password | **Completed** | 28-character generated password in `.env.local` only, never printed | Local sign-in with the new password PASS; published sample refused PASS | `evidence/security/runtime-isolation-20261109.log` | The production password is unknown and needs separate approval |
| PayPal sandbox-only | **Completed** (checkout disabled) | Live client ID, secret and webhook ID removed; `PAYPAL_MODE=sandbox`; live mode refused outside production in code | Checkout → HTTP 503 "not configured", 0 orders created | same | **Pending client:** sandbox credentials, if local checkout is needed |
| Disconnect from production database | **Completed** | `MONGODB_URI` → local test database; production string removed from development configuration (backed up outside the repo) | Configuration scan: 0 Atlas strings | `dev-config-scan-20261109.log` | **You:** stop two dev servers started before the sprint (they keep old production connections) |
| Separate test database | **Completed** | MongoDB 7 in Docker on 127.0.0.1:27018; app user limited to `marina_muse_dev`; marker + 3 TEST products | `dev-db verify` 13/13 PASS | `dev-db-verify-20261109.log` | Docker Desktop must be running |
| No fallback to production | **Completed** | Remote-host guard in `lib/mongodb.ts`; connector bug fixed; `test-mongo.mjs` fallback restricted; ShipGlobal, GA4 and owner-mail side effects blocked outside production | All paths inspected; 7 guard self-tests PASS | `MARINA_MUSE_SECURITY_ISOLATION_EVIDENCE.md` | — |
| Dev reads/writes only the test database | **Completed** | — | Running app: reads TEST products, writes probe, connections only to 127.0.0.1:27018. 8/8 PASS | `runtime-isolation-20261109.log` | — |

### Priority 2: Chat & Sales

| Task | Status | Detail |
|---|---|---|
| Dedicated Google Cloud test project | **Pending client action** | Project `marina-muse-gemini-testing` (29103202520) is stated by the client. It can't be checked here without the key |
| `GEMINI_TEST_API_KEY` belongs to that project | **Blocked** | The key is not in `.env.local` (checked 9 Nov 12:40 UTC) |
| Isolated database and catalogue snapshot | **Completed** | The harness runs offline from the 340-item public catalogue snapshot, and the development database is now isolated too |
| Harness never uses `GEMINI_API_KEY` | **Completed** | Code inspection and gate: "key none, project unconfirmed" → live run refused; dry run made 0 requests (`text-tests/runs/2026-11-09T1254Z-v3-batch-1-dry-v3.log`) |
| 22 scenarios | **Blocked** | 0 run, 0 transcripts. `results/ledger.json` is empty. No Gemini test request was made |

### Priority 3: Voice & Call

| Task | Status | Detail |
|---|---|---|
| Webhook secret rotation | **Pending client action** | `VAPI_WEBHOOK_SECRET_NEXT` not provided. Nothing was generated, deleted or changed. The tool and guide are ready |
| Phone number and SIP variables unset | **Completed** | Placeholder text cleared; both empty |
| Marina unconnected, Riley preserved | **Completed** | No Vapi call or change in this sprint. The last integrity check (9 Nov, earlier) showed Riley unchanged |

### Priority 4: Growth & Revenue

| Task | Status | What changed | Test and result | Evidence |
|---|---|---|---|---|
| GA4 live tracking | **Blocked (production)** | — | Earlier finding stands: the production build has no measurement ID, so there is no live page tracking. Not re-probed (no production checks) | `evidence/growth/google-audit-*.log` |
| Development analytics configuration | **Completed** | Development skips the browser tag (opt-in, debug mode) and sends purchases only to the GA4 debug endpoint | Code + type check; nothing is recorded in the live property from development | `lib/google/analytics.ts`, `components/GoogleAnalytics.tsx` |
| Daily report generation | **Completed** | — | Report built from the test database (dry run): PASS | `dev-cron-check-20261109.log` |
| Daily report scheduling (development) | **Completed** | New `npm run dev:scheduler` (localhost only, production cadence) | One-shot run: follow-ups HTTP 200; report send refused without a test recipient; both runs recorded | `dev-scheduler-once-20261109.log` |
| Cron authentication | **Completed** | — | No token → 401, wrong token → 401, correct token → runs (both jobs): 9/9 PASS | `dev-cron-check-20261109*.log` |
| Shopping feed (local data) | **Configured, 1 content failure** | — | 230 items: ids ≤ 50, unique, titles ≤ 150, identifiers, required fields PASS. 3 pre-order items (`MM-WHL-036`, `MM-CUS-001`, `MM-DEC-030`) have no `availability_date` FAIL (client lead time needed) | `dev-feed-check-20261109.log` |
| Production measurement ID, scheduler, Merchant Center | **Pending client approval** | Documented only | — | Readiness checklist G2, G5, G6 |

### Priority 5: WhatsApp

| Task | Status | Detail |
|---|---|---|
| Meta eligibility checklist | **Pending client action** | Updated with verified versus assumed items. Nothing can be verified from Meta without the App Secret |
| Meta App Secret | **Pending client action** | Still placeholder text (fingerprint unchanged since 8 Nov) |
| Isolated Embedded Signup / Coexistence test | **Blocked** | Not started. No test resources were created, so there is nothing to clean up (record in the eligibility checklist) |
| No customer messages, no automatic replies, live number untouched | **Completed** | `WHATSAPP_OUTBOUND_ENABLED` unset; no Meta calls made |

## 3. Architecture

| Agent | Entry points | Core modules | Data (MongoDB collections) | External services |
|---|---|---|---|---|
| Shared | `/test`, `/api/admin/ai`, `/api/ai/jobs` (cron), `/api/ai/consent`, `/api/ai/event` | `gemini.ts`, `http.ts`, `agents.ts`, `answer.ts`, `crm.ts`, `followups.ts`, `health.ts`, `env-registry.ts` | `ai_sessions`, `ai_messages`, `ai_leads`, `ai_consent`, `ai_audit`, `ai_jobs`, `ai_health_runs` | Gemini API, SMTP |
| 1 Chat & Sales | `/api/ai/chat`, chat widget | `crm.ts`, `scoring.ts`, `permissions.ts` | sessions, messages, leads, approvals | Gemini, SMTP |
| 2 Voice & Call | `/api/ai/voice/webhook` | `vapi.ts`, `voice.ts`, `calls.ts`, `exotel.ts` | `ai_calls`, leads, consent | Vapi (Marina Muse Assistant, unconnected), Exotel (inactive) |
| 3 Growth & Revenue | `/api/ai/report/daily`, `/feeds/google.xml`, `/api/ai/attribution` | `growth.ts`, `growth-agent.ts`, `daily-report.ts`, `alerts.ts`, `feed.ts`, `google/*` | orders (read), page views, attribution | GA4, Search Console, Gemini, SMTP |
| 4 WhatsApp | `/api/meta/whatsapp/*` | `whatsapp/cloud.ts` (send gate), `coexistence.ts`, `inbound.ts`, `store.ts` | `wa_contacts`, `wa_webhook_events`, `ai_wa_messages` | Meta Graph API (not connected) |

**Development environment (new):** local MongoDB test database (`npm run dev:db`), a development scheduler (`npm run dev:scheduler`), and guards that keep development away from the production database, live payments, real shipments, live analytics and owner email.

## 4. Implementation status

### Agent 1: Chat & Sales (7.5 / 10 = 75%)

| Capability | Score | Evidence / reason |
|---|---|---|
| Gemini integration and fallback | 0.5 | mocked (27 checks); live generation not run (test key missing) |
| Catalogue lookup | 1 | snapshot vs real webhook 12/12 |
| Recommendations and accurate information | 0.5 | grounding guard + catalogue answers (19 checks); no live conversation |
| Enquiry and lead qualification | 0.5 | pure/mocked (22 checks) |
| Conversation history and sessions | 0.5 | code review + checks. The database is now isolated, but a live run needs the test key |
| Consent and validation | 1 | real route; 0 records written |
| SMTP owner notifications | 0.5 | SMTP login verified; delivery blocked (no test recipient). Development can no longer email the owner list |
| Follow-up scheduling and cron auth | **1** (was 0.5) | the job ran end to end on the test database through cron auth and the development scheduler; production scheduler pending approval |
| Errors, rate limits, retries, quota cooldown | 1 | mocked + routes |
| Safe behaviour without integrations | 1 | send gates, placeholder detection, catalogue fallback |

### Agent 2: Voice & Call (8 / 10 = 80%)

Unchanged:
- Assistant v4 (Emma), model, both tools, consent, webhook validation and authentication, safe phone/SIP absence, error handling: all **1**.
- 22 scenarios: **0** (blocked).
- Secret rotation: **0** (pending client).

### Agent 3: Growth & Revenue (9.5 / 12 = 79%)

| Capability | Score | Evidence / reason |
|---|---|---|
| GA4 Data API | 1 | live read-only (earlier 9 Nov) |
| GA4 tracking of the live site | 0 | FAIL: production build lacks the measurement ID |
| Search Console | 1 | live |
| Revenue attribution | 0.5 | logic verified; no paid orders exist |
| Daily report generation | 1 | built from the isolated test database |
| Report formatting and validation | 1 | self-tests |
| Cron authentication | 1 | 401 / 401 / 200 on both jobs, local server |
| Cron scheduling | **1** (was 0) | development scheduler fired both jobs, runs recorded; production scheduler pending approval |
| SMTP owner report | 0.5 | login only; delivery blocked (no test recipient) |
| Shopping feed validation | 1 | local feed passes all structural rules; 3 pre-order dates are a content decision |
| Merchant Center readiness | 0.5 | guide; account and content decisions pending |
| Retries, errors and health reporting | 1 | mocked + health cards |

### Agent 4: WhatsApp Sales & Support (4.5 / 10 = 45%)

Unchanged:
- Embedded Signup and code exchange: **0** (blocked on the App Secret and eligibility).
- Health reporting without credentials: **1**.
- The other eight capabilities: **0.5** (mocked).

## 5. Integration status (real, this environment)

| Integration | Status | Evidence |
|---|---|---|
| MongoDB (development) | **Local test database** `marina_muse_dev` on 127.0.0.1:27018 | security evidence |
| MongoDB (production) | Not accessed during the sprint | — |
| PayPal (development) | Credentials removed; sandbox mode; checkout disabled (503) | runtime check |
| ShipGlobal | Live credentials kept; booking refused outside production | code |
| SMTP | Login OK earlier; owner mail refused in development without a test recipient | cron check |
| Gemini (production key, development) | Used by 2 daily-report builds during testing (see section 9, item 7) | `ai_usage` in the test database |
| Gemini (test project) | Not configured | key absent |
| Vapi | No call or change in the sprint; Marina v4, unconnected | earlier integrity log |
| GA4 / Search Console | API OK earlier; live site not tracking | `growth/` |
| WhatsApp / Meta | Not configured | eligibility checklist |

## 6. Test results and evidence

Evidence: `reports/evidence/security/` (this sprint), `growth/`, `final/` (earlier 9 Nov), `text-tests/`.

| Suite | Kind | Total | PASS | FAIL | BLOCKED | NOT TESTED | Evidence |
|---|---|---|---|---|---|---|---|
| `npm run check:phase2` | unit / mocked / pure | 251 | 251 | 0 | 0 | 0 | `security/check-phase2-20261109-final.log` |
| `npm run check:whatsapp` | unit / mocked | 98 | 98 | 0 | 0 | 0 | `security/check-whatsapp-20261109-final.log` |
| `check:routes` against the isolated local server | refusal-only API checks | 19 | 19 | 0 | 0 | 0 | `security/check-routes-20261109-final.log` |
| `tsc --noEmit` | type check | 1 | 1 | 0 | 0 | 0 | `security/tsc-20261109-final.log` |
| Test-database isolation | real, local database | 13 | 13 | 0 | 0 | 0 | `security/dev-db-verify-20261109.log` |
| Runtime isolation | real, local server | 8 | 8 | 0 | 0 | 0 | `security/runtime-isolation-20261109.log` |
| Configuration and secret scans | static | 2 | 2 | 0 | 0 | 0 | `security/dev-config-scan-*`, `secret-scan-*` |
| Cron auth and jobs | real, local server + test database | 10 | 10 | 0 | 0 | 0 | `growth/dev-cron-check-20261109*.log` |
| Development scheduler (once) | real, local | 1 | 1 | 0 | 0 | 0 | `growth/dev-scheduler-once-20261109.log` |
| Shopping feed (local data) | real, local | 12 | 11 | 1 | 0 | 0 | `growth/dev-feed-check-20261109.log` |
| Conversation scenarios T1–T22 | live Gemini | 22 | 0 | 0 | 22 | 0 | gate refused; 0 requests |
| Webhook rotation | live | 1 | 0 | 0 | 1 | 0 | replacement not provided |
| Embedded Signup / code exchange | live | 2 | 0 | 0 | 2 | 0 | App Secret not provided |
| `npm run build` | production build | 1 | 0 | 0 | 0 | 1 | Not re-run after the sprint's changes, because a build would disrupt the running dev servers. It passed earlier on 9 Nov |

**Per agent** (earlier 9 Nov results plus this sprint):

| Agent | Total | PASS | FAIL | BLOCKED | NOT TESTED |
|---|---|---|---|---|---|
| 1 Chat | 49 | 47 | 0 | 1 | 1 |
| 2 Voice | 94 | 71 | 0 | 23 | 0 |
| 3 Growth | 71 | 67 | 3 | 1 | 0 |
| 4 WhatsApp | 119 | 116 | 0 | 2 | 1 |
| Shared / platform and security | 137 | 135 | 0 | 0 | 2 |

The three Growth failures are: GA4 live tracking, the earlier live-feed audit (fixed in code, not deployed), and the 3 pre-order dates.

Simulated (mocked or pure) tests are labelled as such and are never reported as provider verification.

## 7. Changes made (local only, not deployed)

**Sprint (9 Nov, 12:40–13:10 UTC):**
- `.env.local`: test database, new admin password, PayPal live removed / sandbox mode, Vapi placeholders cleared.
- Database:
  - `lib/env-mongo-uri.ts` and `lib/mongodb.ts`: development remote-host guard;
  - `lib/atlas-connect.ts`: fix so standard URIs work on Windows with Node 24;
  - `scripts/test-mongo.mjs`: production-host fallback restricted.
- Side-effect guards:
  - `lib/paypal.ts`: prepared patch applied;
  - `lib/shipglobal.ts`;
  - `lib/google/analytics.ts` and `components/GoogleAnalytics.tsx`;
  - `lib/mail.ts` and `lib/ai/daily-report.ts`.
- Tooling: `scripts/dev-db.mjs`, `scripts/dev-scheduler.mjs`, `package.json` scripts `dev:db` and `dev:scheduler`.
- Registry and docs: 4 new optional development variables; `.env.example` and `ENVIRONMENT_SETUP.md` regenerated (106).
- Tests: 7 guard self-tests; evidence scripts under `reports/evidence/security/` and `growth/`.

**Earlier on 9 Nov:**
- the harness snapshot mode and isolation gate;
- Gemini test variables;
- feed and report fixes;
- unused imports removed;
- the rotation tool (prepared).

## 8. Environment-variable readiness

`MARINA_MUSE_ENVIRONMENT_VARIABLE_CHECKLIST.md`: **45 READY, 2 MISSING, 1 PLACEHOLDER, 8 BLOCKED, 39 OPTIONAL, 11 NOT REQUIRED** (106). No values are shown.

## 9. Security findings

| # | Issue | Status |
|---|---|---|
| 1 | Sample `ADMIN_PASSWORD` | **Fixed in development.** Production value unknown; changing it needs approval |
| 2 | PayPal LIVE in development | **Fixed:** removed; sandbox mode; live refused outside production in code |
| 3 | Development used the production database | **Fixed** in configuration and code. The two old dev servers (PIDs 3548, 18668) have exited. Fresh check 10 Nov: 0 production references, 0 production connections |
| 11 | **Production credentials exposed outside the project (10 Nov)** | **Open, critical.** Full production URI and password found in 24 files outside the project, and sent to Cursor's AI service and (very likely) ChatGPT. The files: `jobcareerpao\.env.local`, 21 editor-history snapshots, Cursor state and transcript. Every other secret of the pre-isolation `.env.local` was in the same copies. **Rotation required (client).** Security report, section 8 |
| 12 | `check:mongo` printed the database user name | **Fixed** (10 Nov): prints a fingerprint, and refuses remote hosts on a development machine |
| 13 | No security headers | **Partly fixed** (10 Nov, local): `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `frame-ancestors`, no `X-Powered-By`. HSTS and a script CSP are deployment items |
| 14 | Local test-database root password readable through Docker | Open, low (local test data only). Security report, section 12 |
| 4 | Production voice webhook 401 | Unchanged (production; needs approval) |
| 5 | Placeholder credentials | Vapi placeholders cleared; `META_APP_SECRET` still a placeholder (client) |
| 6 | Production WhatsApp webhook 503 on verify | Unchanged (production; needs approval) |
| 7 | **Development uses the website's Gemini key** | **New, open.** Any AI use in development spends the live site's shared free-tier quota. During this sprint, the two daily-report builds in the cron test (one dry run, and one send attempt made before the guard-order fix) made Gemini requests with this key: 2 logged operations, each trying more than one model, so about 4–6 requests in total. The refused-send path no longer calls Gemini, and the AI preview in the cron check is now opt-in. **Recommendation:** use the test key in development once it is confirmed. `GEMINI_API_KEY` was kept unchanged as instructed |
| 8 | Live ShipGlobal credentials in development | **Mitigated:** booking refused outside production |
| 9 | Development analytics would reach the live GA4 property | **Fixed:** debug endpoint only; tag off unless opted in |
| 10 | Development owner mail fell back to the client's admin address | **Fixed:** needs an explicit test recipient |

Rotating the production database user's password is recommended if the earlier development `.env.local` was ever shared. That is the client's decision.

## 10. Outstanding client dependencies

1. `GEMINI_TEST_API_KEY` saved in `.env.local`, plus confirmation that it belongs to `marina-muse-gemini-testing`.
2. Replacement Vapi webhook secret (`VAPI_WEBHOOK_SECRET_NEXT`), provided securely.
3. Meta App Secret, provided securely; Meta eligibility answers (checklist items 1–6 and 10).
4. Your personal WhatsApp test number, for isolated testing only.
5. An authorized SMTP test recipient (`OWNER_ALERT_EMAILS`).
6. PayPal sandbox credentials, only if local checkout is needed.
7. Production admin password change (approval).
8. Feed content decisions:
   - lead time for the 3 pre-order items;
   - photos;
   - descriptions.
9. Emma and v4 approval; Merchant Center account; Exotel only if in scope.
10. Production deployment approval: environment variables, code, scheduler.

## 11. Remaining blockers to production readiness

0. **Rotation of the production MongoDB password and every other secret** that was in the pre-isolation development `.env.local` (security report, sections 8 and 14). Then clean up the exposed copies. Client decision; not authorized yet.
1. 22 conversation scenarios not run (dependency 1).
2. Production webhooks: voice 401, WhatsApp 503.
3. GA4 not tracking the live site (production rebuild).
4. Production scheduler for follow-ups and the daily report.
5. Meta App Secret, eligibility, test number.
6. Feed fixes not deployed; 3 pre-order dates.
7. No controlled SMTP delivery test.
8. Production admin password.

## 12. Production-readiness assessment

**Not ready for production for any of the four agents.** The development environment is isolated (re-verified 10 Nov).

Production also cannot be considered safe until the exposed credentials are rotated.

The build is ready (local `npm run build` passed 10 Nov). Configuration readiness is tracked in `MARINA_MUSE_PRODUCTION_DEPLOYMENT_CHECKLIST.md` and `MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env` (names and placeholders only). Request production approval only when the deployment gate in `MARINA_MUSE_PRODUCTION_READINESS_CHECKLIST.md` is met.

## 13. Exact next actions

1. **You:** stop the two old dev servers (ports 3000 and 3918), then start a fresh one with `npm run dev`. Docker Desktop must be running.
2. **You:** add `GEMINI_TEST_API_KEY` and `GEMINI_TEST_PROJECT_CONFIRMED=marina-muse-gemini-testing` to `.env.local` after checking the key's project in AI Studio.
3. **Then**, in `reports/evidence/text-tests/`:
   - `DRY_RUN=1 node texttest-v3.mts v3-batch-1.json` (0 requests; the gate must show the key and project);
   - then `node texttest-v3.mts v3-batch-1.json`;
   - review, then run batches 2 and 3.
4. **Client:** secrets (rotation, App Secret), Meta answers, SMTP test recipient, approvals.

## 14. Deliverables

All in `reports/`:

| File | Purpose |
|---|---|
| `MARINA_MUSE_PHASE2_FINAL_COMPLETION_REPORT.md` / `.pdf` | this consolidated report |
| `MARINA_MUSE_SECURITY_ISOLATION_EVIDENCE.md` | Priority 1 evidence (updated 10 Nov) |
| `MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md` | Consolidated security verification (10 Nov) |
| `MARINA_MUSE_PRODUCTION_DEPLOYMENT_CHECKLIST.md` | Deployment checklist: verified versus unverified (10 Nov) |
| `MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env` | Production variable names with placeholders only (10 Nov) |
| `MARINA_MUSE_CAREERPATH_SEPARATION_PROPOSAL.md` | Proposal only (10 Nov) |
| `MARINA_MUSE_ENVIRONMENT_VARIABLE_CHECKLIST.md` | 106-variable inventory |
| `MARINA_MUSE_META_ELIGIBILITY_CHECKLIST.md` | Meta prerequisites + WhatsApp test and cleanup record |
| `MARINA_MUSE_WEBHOOK_SECRET_ROTATION_GUIDE.md` | rotation procedure + status record |
| `MARINA_MUSE_PRODUCTION_READINESS_CHECKLIST.md` | deployment gate |

Evidence:
- `evidence/security/`;
- `evidence/growth/` (cron, scheduler, feed);
- `evidence/text-tests/` (Gemini harness: no transcripts yet, blocked).

---

## 15. Backend and testing completion audit (10 November 2026)

**Scope.** Local and read-only, with no production access, no production credentials and no Gemini requests. Evidence files are in `reports/evidence/security/` unless stated otherwise.

**Classifications:**
- **VERIFIED**: exercised with a passing evidence log.
- **PARTIALLY VERIFIED**: logic or refusal paths verified; the happy path needs credentials or live services.
- **BLOCKED**: cannot run without a client input.
- **NOT TESTED**: implemented, but no automated or recorded test exists.

### 15.1 Codebase inventory

| Item | Count | Status |
|---|---|---|
| API route handlers (`app/api/**/route.ts`) | 72 | All compile and type-check. `next build` exit 0, `tsc` exit 0 (10:13 UTC) |
| Pages | 36 (74 outputs at build) | Build: 74/74 pages generated |
| Library modules (`lib/**/*.ts`) | 90 | — |
| Route handlers exercised by an automated HTTP check | **17 of 72 (24%)**, mostly refusal paths | 15.2 |
| Route handlers with no automated test | **55 of 72** | **NOT TESTED** |

### 15.2 Backend APIs and database operations

| Area | Routes | Classification | Evidence |
|---|---|---|---|
| AI agent routes (`/api/ai/*`, `/api/admin/ai*`, `/api/meta/whatsapp/*`) | 14 | **PARTIALLY VERIFIED**. Authentication refusals 19/19; agent logic in 349 unit and mocked checks; live AI paths blocked | `headers-and-routes-20261110T0727Z.log`, `check-phase2-20261110T1013Z.log`, `check-whatsapp-20261110T1013Z.log` |
| `/api/health` | 1 | **VERIFIED**: 503 with the database down (today), 200 with it up (9 Nov) | headers-and-routes log; `runtime-isolation-20261109-recheck2.log` |
| Catalogue read, page views, PayPal order refusal, admin sign-in (NextAuth) | 4 | **VERIFIED** 9 Nov against the real local test database (8/8). Not re-run today | `runtime-isolation-20261109-recheck2.log` |
| Orders, cart, Razorpay, returns, quotes, wholesale, contact, account, favourites, product reviews, upload, media, categories, testimonials, geo | 22 | **NOT TESTED** | — |
| Admin back-office (21 of 23 admin routes) | 21 | **NOT TESTED** (only `/api/admin/ai` and `/api/admin/ai/actions` are checked) | — |
| PayPal capture and webhook; Razorpay payments | 4 | **BLOCKED**: no sandbox credentials; checkout returns 503 in development by design | `runtime-isolation-20261109.log` |
| Database isolation | — | **VERIFIED** 9 Nov (13/13, 8/8). Today environment and network re-verified; database checks **NOT VERIFIED** today (Docker stopped) | security report, section 11 |
| Indexes and migrations | — | No migration framework; runtime index creation only in `lib/whatsapp/store.ts` (code-reviewed) | — |

### 15.3 Authentication, authorization, security controls

| Control | Classification | Evidence |
|---|---|---|
| Admin, cron, webhook and `/test` refusals | **VERIFIED**: 19/19 (07:27 UTC) | headers-and-routes log |
| Cron bearer (constant-time comparison; placeholders refused) | **VERIFIED**: 401/401/200 (9 Nov); refusals today | `growth/dev-cron-check-20261109*.log` |
| Admin sign-in with the new password; sample password refused | **VERIFIED** 9 Nov | runtime-isolation log |
| Customer and wholesale sign-up, OTP password reset, Google sign-in | **NOT TESTED** | — |
| Role middleware (wholesale/admin redirects) | **PARTIALLY VERIFIED**: `/test` redirect only; the rest code-reviewed | — |
| Development guards (remote database, PayPal live, ShipGlobal, GA4, owner mail) | **VERIFIED**: unit checks within 251/251; database guard 13/13 (9 Nov); `check:mongo` guard 3/3 (today) | `check-mongo-guard-test-20261110.log` |
| Security headers | **VERIFIED** locally (added today). HSTS and script CSP **NOT TESTED** (deployment items) | headers-and-routes log |
| Secrets hygiene | **FAILED**: production credentials exposed outside the project | `MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md` section 8 |

### 15.4 The four agents

Scores are from section 4. They are unchanged today because no live testing was permitted.

| Agent | Score | VERIFIED | PARTIALLY VERIFIED | BLOCKED |
|---|---|---|---|---|
| 1 Chat & Sales | 75% | Catalogue lookup (12/12), consent route, follow-up job and cron auth, error handling, safe degradation | Gemini generation and fallback (mocked, 27), grounded answers (19), lead qualification (22), sessions, SMTP (login only) | **22 conversation scenarios: 0 run** (test key absent; Gemini testing paused) |
| 2 Voice & Calls | 80% | Assistant v4 configuration, tools, consent, webhook auth refusals, safe phone/SIP absence | — | Webhook secret rotation (client), scenarios, live calls, Exotel (KYC) |
| 3 Growth & Revenue | 79% | GA4 Data API and Search Console (live read-only, 9 Nov), daily report build, cron auth and scheduling (development), feed structure | Attribution (no paid orders), SMTP delivery, Merchant Center | Live-site GA4 tag (needs a production rebuild) |
| 4 WhatsApp | 45% | Health reporting without credentials; webhook signature and verify refusals | 8 capabilities, mocked only (98/98) | Embedded Signup and code exchange (Meta App Secret, eligibility) |

### 15.5 Implemented features versus operational integrations

| Integration | Code | Operational in development | Production |
|---|---|---|---|
| MongoDB | Implemented and guarded | Local test database (Docker stopped today) | **BLOCKED**: rotation required |
| Gemini | Implemented (fallback, quota, grounding) | Mocked only; live testing paused | BLOCKED (scenarios) |
| PayPal / Razorpay | Implemented | Disabled (no sandbox credentials) | BLOCKED (new live credentials) |
| SMTP | Implemented | Login verified 9 Nov; delivery not tested | BLOCKED (test recipient, rotation) |
| Vapi | Implemented; assistant configured, unconnected | Webhook refusals verified | BLOCKED (secret rotation) |
| Exotel | Implemented | Inactive | BLOCKED (KYC, vSIP) |
| WhatsApp / Meta | Implemented and gated (outbound off) | Mocked | BLOCKED (App Secret, eligibility) |
| GA4 / Search Console | Implemented | APIs worked 9 Nov; `GOOGLE_SERVICE_ACCOUNT_JSON` fails validation today | BLOCKED (rebuild, valid service account) |
| ShipGlobal | Implemented; booking refused outside production | Not exercised | NOT TESTED |

### 15.6 Test, build and static-check results

| Check | Kind | Count | Result | Timestamp (UTC) | Evidence |
|---|---|---|---|---|---|
| `npm run check:phase2` | unit / mocked / pure | 251 | **251 pass, 0 fail, 0 skip** | 2026-11-10 10:13 | `check-phase2-20261110T1013Z.log` |
| `npm run check:whatsapp` | unit / mocked | 98 | **98 pass, 0 fail** | 2026-11-10 10:13 | `check-whatsapp-20261110T1013Z.log` |
| `npm run check:routes` (local server) | HTTP, refusal-only | 19 | **19 pass, 0 fail** | 2026-11-10 07:27 (before the unused-import clean-up, which changed no route logic) | `headers-and-routes-20261110T0727Z.log` |
| `tsc --noEmit` | type check | — | exit 0 | 2026-11-10 10:13 | `tsc-20261110T1013Z.log` |
| Lint | — | — | **No ESLint installed: NOT TESTED.** Substitute `tsc --noUnusedLocals --noUnusedParameters`: 7 warnings, 6 fixed, **1 remaining** (`lib/mongodb.ts` `uriPromise`, deliberately left) | 2026-11-10 10:13 | `lint-substitute-unused-20261110T*.log` |
| `npm run build` | production build (local only) | 74 pages | exit 0, CSS verified | 2026-11-10 10:13 | `build-20261110T1013Z.log` |
| `check:mongo` development guard | script | 3 | 3 pass | 2026-11-10 06:48 | `check-mongo-guard-test-20261110.log` |
| `dev-db verify` | integration, real local database | 13 | 13 pass, **not re-run today** | 2026-11-09 17:22 | `dev-db-verify-20261109-recheck2.log` |
| Runtime isolation | integration, real server and database | 8 | 8 pass, **not re-run today** | 2026-11-09 17:22 | `runtime-isolation-20261109-recheck2.log` |
| End-to-end browser tests | E2E | 0 | **NOT TESTED**: no E2E framework exists in the project | — | — |
| 22 conversation scenarios | live AI | 22 | **BLOCKED: 0 run** | — | `text-tests/results/ledger.json` (empty) |

**Totals today.**
- 349 unit and mocked checks: all pass.
- 19 HTTP refusal checks: all pass.
- 0 failed, 0 skipped.
- 22 scenarios blocked.
- 21 real-database integration checks (13 + 8) not re-run today.

### 15.7 Answers

**Is the backend complete?**
- **Implemented:** yes. All 72 route handlers compile, type-check and build.
- **Verified: no.**
  - Only 17 of the 72 route handlers have any automated HTTP check, mostly refusal paths.
  - The e-commerce core (orders, cart, returns, quotes, wholesale, account) and 21 of 23 admin routes have no automated tests.
  - Payment capture is blocked.

**Are all tests complete?**
- **No.**
- Everything that exists passes.
- Not done:
  - the 22 scenarios are blocked;
  - there are no E2E tests and no linter;
  - 55 route handlers are untested;
  - the real-database checks were not re-run today.

**Is the application ready for production deployment?**
- **No.** In order of severity:
  1. Production credentials are exposed and must be rotated first (security report, section 8).
  2. The functional blockers in section 11 remain.
  3. Deployment checklist items are unverified (`MARINA_MUSE_PRODUCTION_DEPLOYMENT_CHECKLIST.md`).
- Production deployment is also not authorized.
