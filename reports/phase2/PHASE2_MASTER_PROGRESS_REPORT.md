# Marina Muse Phase 2: master progress report (isolated development and testing)

**10 November 2026, 16:45 UTC.** Scope: the client-approved isolated development and testing only.

**Not done:**
- **No fresh credentials had been supplied** at the time of this report, so every live third-party test is blocked.
- No production configuration, database, webhook or data was touched.
- Nothing was deployed or published.
- No message, call or e-mail was sent; no Gemini, Vapi, Google or Meta API request was made.
- CareerPath AI was not touched.

**Agent reports:**
- `CHAT_SALES_AGENT_REPORT.md`
- `VOICE_CALL_AGENT_REPORT.md`
- `GROWTH_REVENUE_AGENT_REPORT.md`
- `WHATSAPP_AGENT_REPORT.md`

**Evidence:** `reports/evidence/phase2/`, plus `reports/evidence/text-tests/runs/` (see `evidence/phase2/EVIDENCE_NOTES.md` for superseded runs).

## 1. Overall status

| Agent | Development | Isolated tests possible without new credentials | Live third-party tests | Production ready |
|---|---|---|---|---|
| 1 Chat & Sales | Complete | **PASS:** 22/22 scenarios validated (dry run); no-key fallback safe; mocked checks pass | **BLOCKED: 0/22 run** (no Gemini test key) | No |
| 2 Voice & Call | Complete | **PASS 13/13:** authentication, signature, processing with records stored, error handling | **BLOCKED:** Vapi-side checks (no fresh key). Live calls: not authorized | No |
| 3 Growth & Revenue | Complete | **PASS:** cron 9/9; feed 10/11 (1 known content item) | **BLOCKED:** GA4 and Search Console (service account not created) | No |
| 4 WhatsApp | Complete, plus an **isolation fix** | **PASS:** webhook 8/8, admin-session isolation 5/5, unit 102/102 | **BLOCKED:** Embedded Signup and sync (no test-app credentials, no public test endpoint) | No |

**Not all four agents are complete.** Development is complete and every isolated test that can run without new credentials passes. None of the required **live** isolated tests has run yet, because no fresh credentials have been supplied.

## 2. Phase 1: safety and environment isolation (completed)

| Item | Result | Evidence |
|---|---|---|
| Finding: development `.env.local` still holds exposed live credentials (website Gemini key, Vapi key and webhook secret, SMTP, …) | Any normal `next dev` would load them, so tests must not run on it | names-only check, `scripts/isolated-env.mjs` header |
| Finding: the 22-scenario harness read `.env.local` directly | Fixed. It now reads only the isolated environment | `text-tests/vapi-lib.mjs` |
| **Isolated launcher** `scripts/isolated-env.mjs` | Blanks 75+ integration variables before Next.js loads (Next never overrides a defined variable; checked in `@next/env`). Fresh session secrets. Integration credentials come only from `.env.isolated-test.local`. Safety switches forced off | `--check` output |
| Proof on a running server | 21 variables set (inherited, generated, forced), **81 empty** (every exposed integration value). Generated-secret fingerprints match the launcher session. Database `127.0.0.1:27018` only | `phase2/isolation-proof-20261110T1628Z.log` |
| Credential files git-ignored | `.env*.local`, `.env.isolated-test*` (example tracked) | `.gitignore`, `git check-ignore` |
| **Test database 13/13** (previously NOT VERIFIED today) | **PASS** | `phase2/dev-db-verify-isolated-20261110T1631Z.log` |
| **Running app 8/8** (previously NOT VERIFIED today) | **PASS:** only connection is `127.0.0.1:27018` | `phase2/runtime-isolation-isolated-20261110T1631Z.log` |
| Route refusals on the isolated server | **19/19** | `phase2/check-routes-isolated-20261110T1630Z.log` |
| Docker and CareerPath | Docker was started at 16:18 UTC outside this session. One container exists (`marina-dev-mongo`). **CareerPath has no containers or processes** | read-only `docker inspect` |

## 3. Code changes (development only, not deployed)

| File | Change | Tested |
|---|---|---|
| `scripts/isolated-env.mjs` (new) | Isolated test launcher | isolation proof |
| `.env.isolated-test.example` (new), `.gitignore` | Fresh-credential template; ignore rules | `git check-ignore` |
| `reports/evidence/text-tests/vapi-lib.mjs` | Harness uses the isolated environment, not `.env.local` | dry runs, gate refusal |
| `lib/whatsapp/coexistence.ts`, `coexistence-actions.ts`, `app/api/meta/whatsapp/signup/exchange/route.ts` | `metaAppIds()`: no fallback to the client's Meta app in isolated mode; exchange and subscriptions check refuse without an app id | 4 new unit checks; admin-session 5/5 |
| `scripts/check-whatsapp-coexistence.ts` | +4 regression checks | 102/102 |
| `lib/ai/env-registry.ts`, `scripts/gen-env-docs.ts`, `.env.example`, `docs/phase2/ENVIRONMENT_SETUP.md` | `MARINA_ISOLATED_TEST` registered (development-only, commented out in `.env.example`) | 251/251 |
| Sanitized production template and audit | Regenerated (one DEV-ONLY line); still 0 values | `security/env-template-secret-check-postgen2-20261110.log` |

**Regression at 16:42 UTC:**

| Check | Result |
|---|---|
| `tsc` | exit 0 |
| `check:phase2` | **251/251** |
| `check:whatsapp` | **102/102** |
| `npm run build` | exit 0, 74/74 pages |

Evidence: `phase2/*-20261110T1642Z.log`.

## 4. Test totals (isolated, 10 November)

| Suite | Pass | Fail | Blocked or skipped |
|---|---|---|---|
| Webhooks, final (voice 13, WhatsApp 8, cron 4) | 25 | 0 | — |
| WhatsApp admin-session isolation | 5 | 0 | — |
| Cron and scheduler | 9 | 0 | 1 skipped (Gemini) |
| Feed structure | 10 | 1 (known content: 3 pre-order dates) | — |
| Test database / running app | 13 / 8 | 0 | — |
| Route refusals | 19 | 0 | — |
| Unit and mocked: `check:phase2` / `check:whatsapp` | 251 / 102 | 0 | — |
| **22 Gemini scenarios** | **0** | **0** | **22 blocked** |
| GA4 and Search Console read-only | 0 | 0 | blocked |
| Vapi API with a fresh key | 0 | 0 | blocked |
| Meta test-app flows | 0 | 0 | blocked |

**Earlier failed runs, all explained** in `evidence/phase2/EVIDENCE_NOTES.md`: webhook 23/25 (two test bugs) and cron 1 fail (synthetic lead). The fixes were made in the tests and test data, not by weakening assertions.

## 5. What is needed from the client (verified against the code; nothing else is requested)

| # | Agent | Item | Where it goes |
|---|---|---|---|
| 1 | Chat | `GEMINI_TEST_API_KEY`: new key from the separate "Marina Muse Gemini Testing" AI Studio project, no billing. Plus `GEMINI_TEST_PROJECT_CONFIRMED=marina-muse-gemini-testing` | `.env.isolated-test.local` |
| 2 | Voice | Fresh `VAPI_API_KEY` (and optionally a test `VAPI_ASSISTANT_ID`) for **read-only** configuration checks | same |
| 3 | Growth | Create the read-only service account per the Growth report, section 3 (APIs: Analytics Data, Search Console; **no** IAM roles). **Send me its email first**; I'll confirm it before you grant GA4 **Viewer** and Search Console **Restricted**. Then `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`, `SEARCH_CONSOLE_SITE_URL` | same |
| 4 | WhatsApp | Isolated Meta **test app**: `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID` (Login-for-Business configuration with `whatsapp_business_management` and `whatsapp_business_messaging`), and the approved `WHATSAPP_COEXISTENCE_TEST_NUMBER` | same |
| 5 | WhatsApp, Voice | **Decision:** approve a temporary public HTTPS test endpoint (for example a tunnel to the isolated server) so Meta and Vapi can deliver real webhooks. Without it, only locally simulated deliveries are possible | written approval |

## 6. Completion (verifiable work only)

| Agent | Development | Isolated tests runnable now | Required live isolated tests |
|---|---|---|---|
| Chat & Sales | 100% | 100% | **0%** (0/22) |
| Voice & Call | 100% | 100% (13/13) | **0%** (Vapi-side, blocked) |
| Growth & Revenue | 100% | 100% (cron and feed; 1 content item open) | **0%** (GA4 and GSC, blocked) |
| WhatsApp | 100% | 100% (8/8, 5/5, 102/102) | **0%** (test-app flows, blocked) |

**Production readiness: none of the four agents.** Production activation needs separate written approval, plus rotation of the exposed production credentials (security report).

## 7. Remaining risks

1. Live behaviour of all four integrations is unproven until fresh credentials arrive.
2. Exposed production credentials are not rotated yet (client).
3. Public-endpoint testing for Meta and Vapi needs an approval decision.
4. Free-tier Gemini limits could interrupt the 22-scenario run. That would be recorded, never bypassed.
5. The test database is shared with nothing else, but the dev container's root password is readable through Docker (security report, section 12).

---

## Update: 10 November 2026, 17:15 UTC (approved isolated-testing execution)

**Scope.** Executed in the client's order: read-only audit first, then steps 1–7.

**Checked at 17:05 UTC.** No fresh credentials had been supplied (`.env.isolated-test.local` absent).

**Not done:**
- No production access, credential rotation, deployment, outbound message, call or billing change.
- CareerPath AI and the other project's container (`lms`) were not touched.

| Step | Status | Evidence |
|---|---|---|
| 1. Docker security | **Verified: BLOCKER CONFIRMED, NOT REMEDIATED.** The root password stored in Docker's configuration is **still usable** (root on the local test database). Remediation prepared; running it was refused by this session's permission check. **Additional finding:** the E: drive grants Authenticated Users / Users access to project secret files. Session-secrets file restricted to the owner; the launcher now restricts the credentials file automatically | `DOCKER_SECURITY_EVIDENCE.md`; `evidence/phase2/docker-root-*` |
| 2. Vapi permissions | **Established from Vapi docs: a private key cannot be restricted** (full organization access). Key **not requested**. Scope, limits and revocation plan documented, plus a no-key alternative (dashboard export) | `VAPI_PERMISSION_ASSESSMENT.md` |
| 3. Google service account | **Stopped: no authorized Google Cloud access** (no gcloud, no credentials). Not created; no email to report. Exact access options documented | `GOOGLE_SERVICE_ACCOUNT_STATUS.md` |
| 4. Meta test app | **Requirements document completed** (verified against the code) | `META_TEST_APP_REQUIREMENTS.md` |
| 5. HTTPS endpoint | **Not started:** blocked by step 1 (stop condition). Isolation design (route-allowlist proxy) documented. Nothing to clean up | `HTTPS_ENDPOINT_STATUS.md` |
| 6. Gemini | **Blocked: no key supplied.** Launcher and harness confirmed to use only `GEMINI_TEST_API_KEY` from `.env.isolated-test.local` after project confirmation; production key blank. Billing is the client's setting in the testing project; not verifiable from here | `CHAT_SALES_AGENT_REPORT.md` |
| 7. Growth feed | **Done:** three products identified (MM-WHL-036 Captain's Helm 36", MM-DEC-030 Vintage Diving Helmet, MM-CUS-001 Custom Engraved Compass). Nothing invented or changed; waiting for the client | `GROWTH_FEED_DATE_CONFIRMATION_REQUEST.md` |

**Changes in this update** (development only):
- `scripts/isolated-env.mjs`: owner-only file access for the session and credentials files, reported by `--check`.
- New evidence scripts: `docker-root-verify.sh` (read-only) and `docker-root-remediation.sh` (prepared, not run).

### Decisions needed from the client, in order

1. **Docker:** run `bash reports/evidence/phase2/docker-root-remediation.sh`, or authorize the agent to run it. **This unblocks the HTTPS step.**
2. **Vapi:** choose dashboard export (recommended), a private key in a test-only organization, or skip.
3. **Google:** create the service account and send its email, or grant scoped project access.
4. **Meta:** create the test app per the requirements document; confirm Tech Provider status.
5. **Gemini:** fresh `GEMINI_TEST_API_KEY` + `GEMINI_TEST_PROJECT_CONFIRMED`.
6. **Feed:** lead times or dates for the three products.

**Completion is unchanged from section 6 above.** Development 100%; isolated tests runnable without credentials 100%; required live isolated tests **0%** for all four agents.
