# WhatsApp Direct Cloud API: C1–C10 Implementation Report

**Date:** 11 November 2026 (07:00–07:20 UTC)
**Scope:** Change Plan items C1–C10, as approved, with the preflight clarifications 4a–4e. **C11 and C12 were not implemented.**
**Nothing was committed, pushed or deployed. No agent was activated.**

## Summary

C1–C10 are implemented and pass every permitted check: the type check, 102/102 existing WhatsApp checks, 251/251 Phase 2 checks and 114/114 new direct-mode checks.

All verification is **offline**:
- **Unit tests** run without network or database.
- **C5 failure, retry and concurrency tests** run against a *simulated* collection. They are **not MongoDB integration tests**.
- **Real MongoDB checks are BLOCKED:** behaviour on a real database, real index creation and inspection of existing data.
- **All local HTTP tests are BLOCKED** because the Docker security remediation is still **NOT REMEDIATED** (§D).

**Nothing has been tested against Meta. The direct integration is not verified end to end.**

**Reversibility:**
- The default mode is unchanged. Unless `WHATSAPP_INTEGRATION_MODE=direct` is set, the site behaves as before, except for three changes that apply in every mode: C5, C6 and C9 (see §F).
- Every file was copied before modification to `reports/evidence/phase2/pre-c1-c10-snapshot-20261111T0700Z/`:
  - 26 files, with `.orig` appended to each name; contents are unchanged and verified with `sha256sum -c`.
  - No `.env.local`, credential or secret file is included. The only env files copied are the two committed templates, `.env.example` and `.env.isolated-test.example`.
- A full unified diff is at `reports/evidence/phase2/c1-c10-changes-20261111T0714Z.diff`.

---

## A. Implementation mapping

| Change | Requirement (Change Plan + approvals) | Files modified | Implementation | Verification |
|---|---|---|---|---|
| **C1** | Direct-mode sending independent of coexistence: `WHATSAPP_OUTBOUND_ENABLED` plus either written production approval or test mode (exact test IDs and an allow-listed recipient). Existing rules kept. Coexistence mode unchanged | **new** `lib/whatsapp/mode.ts`; `lib/whatsapp/coexistence.ts`; `lib/whatsapp/cloud.ts` | See C1 notes below | **Pass**: 18 checks (C1.1–C1.8, truth table T1–T10) |
| **C2** | Callers use the mode-aware gate; no Coexistence state needed in direct mode | `lib/whatsapp/inbound.ts`, `lib/ai/followups.ts` | Both skip `readCoexistenceState()` in direct mode and pass no `businessNumber`. Coexistence callers are unchanged | **Pass**: 3 checks (C2.1 = old P15 now allowed in test mode; C2.2–C2.3 source) |
| **C3** | Environment-only credentials in direct mode; never the stored Embedded Signup token | `lib/whatsapp/cloud.ts` (`resolveCredentials`) | See C3 notes below | **Pass**: 4 checks (C3.1–C3.4) |
| **C4** | Accept only the configured WABA ID **and** phone-number ID; reject missing or mismatched IDs; signature over raw bytes; size limit; skip Coexistence updates in direct mode | `lib/whatsapp/mode.ts` (`filterDirectWebhook`, `MAX_WEBHOOK_BYTES`), `app/api/meta/whatsapp/webhook/route.ts`, `lib/whatsapp/coexistence.ts` (`verifySignature` accepts bytes) | See C4 notes below | **Pass**: 16 checks (C4.1 = old P10 now ignored; C4.2–C4.16) |
| **C5** | HTTP 500 and Meta retry on database failure; database-backed idempotency; done only after all database work; safe retry of failed or stale events; no duplicate inbound records under concurrency; no internals in responses | **new** `lib/whatsapp/event-claims.ts`, **new** `lib/whatsapp/webhook-process.ts`; `lib/whatsapp/store.ts`; `app/api/meta/whatsapp/webhook/route.ts`; `lib/whatsapp/inbound.ts` | Detail in §C | **Pass (simulated)**: 23 checks (C5.1–C5.23). Real MongoDB: **BLOCKED** |
| **C6** | Non-production refuses real sends, fail-closed, before any network request; verify `postMessage` is the only send path (4a) | `lib/whatsapp/mode.ts` (`sendEnvironmentDecision`), `lib/whatsapp/cloud.ts` (`postMessage`) | See C6 notes below | **Pass**: 15 checks (C6.1–C6.14, C6.13a); fetch spy proves 0 requests on refusal |
| **C7** | Embedded Signup and Coexistence routes closed in direct mode; legacy code kept | `app/api/meta/whatsapp/signup/exchange/route.ts`, `signup/approve/route.ts`, `coexistence/route.ts`; `lib/whatsapp/mode.ts` | See C7 notes below | **Pass**: 5 checks (pure function + source ordering). HTTP-level: **BLOCKED** |
| **C8** | Admin panel, status endpoint and health for direct mode; no Facebook SDK; masked IDs only | `app/api/meta/whatsapp/status/route.ts`, `components/AdminWhatsAppPanel.tsx`, `lib/whatsapp/mode.ts` (`directStatus`), `lib/ai/integrations.ts`, `lib/ai/health.ts`, `app/test/page.tsx` | See C8 notes below | **Pass**: 7 checks (no secrets in status, masking, panel ordering, hook order, health, status route). Browser rendering: **not verified** (HTTP blocked) |
| **C9** | Remove hard-coded production app and config ID fallbacks; no replacement fallback | `lib/whatsapp/coexistence.ts`, `.env.example`, `scripts/gen-env-docs.ts`, `lib/ai/env-registry.ts`, `docs/phase2/ENVIRONMENT_SETUP.md` (regenerated), `scripts/check-whatsapp-coexistence.ts` (approved 4b) | See C9 notes below | **Pass**: 6 checks (C9.1–C9.6), plus the updated existing check (102 total kept) |
| **C10** | Launcher accepts only approved test credentials; exact test phone-number ID **and** test WABA ID matching (4c); refuses production IDs and unexpected names; loads nothing from other env files | `.env.isolated-test.example`, `scripts/isolated-env.mjs`, `lib/ai/env-registry.ts` | See C10 notes below | **Pass**: 17 checks, fake IDs only (C10.1–C10.17). Real test-app credentials: **not supplied, so BLOCKED** |

### Implementation notes

**C1 (send permission)**
- `integrationMode()` returns `direct` only for `WHATSAPP_INTEGRATION_MODE=direct`; anything else, including unset, means coexistence.
- `directOutboundDecision()` applies the new rule.
- `sendGate()` uses it in direct mode, then applies the unchanged rules: number format, live number, suppression, 24-hour window and consent.
- `outboundAllowed()` and `shouldSendWhatsApp()` return the direct flag-level answer in direct mode.
- New variables: `WHATSAPP_INTEGRATION_MODE`, `WHATSAPP_PRODUCTION_SENDING_APPROVED`, `WHATSAPP_TEST_PHONE_NUMBER_ID`, `WHATSAPP_TEST_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEST_RECIPIENTS`.

**C3 (credentials)**
- In direct mode `resolveCredentials()` reads only `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_BUSINESS_ACCOUNT_ID`. Stored ciphertext and stored IDs are ignored.
- If any of the three is missing, no token is returned (`source: "none"`), so nothing can be read from Graph or sent.
- Coexistence mode is unchanged.

**C4 (webhook filtering)**
- **Route order:** a 413 check (`content-length` header, then the actual byte length, limit 1,000,000) → HMAC over `req.arrayBuffer()` bytes → JSON parse → in direct mode `filterDirectWebhook()` → processing.
- **Filter:** keeps only `messages` changes where `entry.id` equals `WHATSAPP_BUSINESS_ACCOUNT_ID` **and** `value.metadata.phone_number_id` equals `WHATSAPP_PHONE_NUMBER_ID`. Other changes are dropped before any parsing, status update or storage, and the response returns them as `ignoredForeign` / `ignoredOther` counts with 200.
- **Fail closed:** if the IDs are not configured in direct mode, the route answers 503.
- Coexistence updates are skipped in direct mode.

**C6 (non-production send guard)**
- `postMessage()` first calls `sendEnvironmentDecision()`. Outside `NODE_ENV=production` it refuses unless the isolated launcher (`MARINA_ISOLATED_TEST=1`) is running in direct mode with exactly matching test phone-number and WABA IDs.
- **Stricter than the plan draft:** the plan's `WHATSAPP_ALLOW_OUTSIDE_PRODUCTION` override was **not** created, per the mandatory requirement.
- The live number is also refused inside `postMessage`.
- **Bypass audit (C6.12–C6.14):** the only Graph `/messages` URL is built in `cloud.ts`; `postMessage` is defined once, and its callers are `inbound.ts` and `followups.ts`; the coexistence Graph helper refuses `/messages`.

**C7 (routes)**
- `directModeRouteBlock()` is the first statement in each of the three `POST` handlers, before authentication, parsing or any Meta call.
- In direct mode it returns **410** with `{ok:false, calledMeta:false, error}`.
- The legacy code is untouched behind it, and coexistence mode is unchanged.

**C8 (status and admin)**
- `/status` returns `directStatus()` in direct mode: masked IDs (`1234…5678`), set/missing flags, outbound state and handshake time. It never includes a token, secret or full ID.
- The panel renders a direct-mode card. The Facebook SDK `<Script>` and the signup, simulate and step controls are not rendered.
- `checkCoexistence()` returns `not_applicable` *before* any Meta lookup.
- In health, the coexistence card shows "not applicable", and coexistence becomes an `info` check, not required, for Agent 4.

**C9 (production ID fallbacks)**
- `metaAppIds()` returns environment values only in every environment.
- The constants are kept only as a deny-list (`KNOWN_PRODUCTION_*` in `mode.ts`, re-exported as `SUPPLIED_*` for the existing tests).
- `.env.example` now has `META_APP_ID=` and `META_CONFIG_ID=` blank, and the generator defaults are removed.
- `publicStatus` blockers no longer embed the config ID.

**C10 (isolated launcher)**
- The template lists the six direct test names, all blank.
- `validateWhatsAppTestCreds()` refuses:
  - an incomplete set
  - non-numeric IDs
  - a phone-number ID that is not exactly the test phone-number ID
  - a WABA ID that is not exactly the test WABA ID
  - the known production app and config IDs
  - the live number in any ID or in the recipients
- Credential problems (including unexpected names and database URIs) are **fatal**: `--check` exits 1, and run mode exits **2 before spawning anything**.
- Forced values: `WHATSAPP_INTEGRATION_MODE=direct`, `WHATSAPP_OUTBOUND_ENABLED=false`, `WHATSAPP_PRODUCTION_SENDING_APPROVED=false`.
- New variables are registered, so ambient values (e.g. from `.env.local` through Next.js) are blanked. This is proven by C10.12.
- The launcher never opens `.env.local` (C10.17).

**Supporting changes:**
- `package.json`: new `check:whatsapp-direct` script.
- `docs/phase2/WHATSAPP_DIRECT_CLOUD_API_SETUP.md`: new.
- `docs/phase2/WHATSAPP_COEXISTENCE_SETUP.md`: a scope note was added.
- `lib/ai/selftest.ts`: one test-isolation change (§B).
- Unchanged: `lib/whatsapp/coexistence-actions.ts` and `reports/phase2/META_TEST_APP_REQUIREMENTS.md`. Earlier evidence files were not modified.

---

## B. Test results

All commands ran via `node scripts/isolated-env.mjs -- …`, except `tsc`. Conditions:
- 78 integration variables blanked (75 before; the 3 new non-forced variables are now blanked too).
- No credentials file present ("fresh credentials supplied: none").
- Outbound and onboarding forced off; `NODE_ENV=development`; `MARINA_ISOLATED_TEST=1`.

Logs are in `reports/evidence/phase2/`.

### Final run (07:14 UTC)

| Suite | Command | Result | Exit | Log |
|---|---|---|---|---|
| Type check | `npx tsc --noEmit -p .` | no errors | 0 | `final-tsc-20261111T0714Z.log` |
| Existing WhatsApp checks | `npm run check:whatsapp` | **102 passed, 0 failed** | 0 | `final-check-whatsapp-20261111T0714Z.log` |
| Existing Phase 2 checks | `npm run check:phase2` | **251 passed, 0 failed** (Agent 4: 13/13) | 0 | `final-check-phase2-20261111T0714Z.log` |
| **New** direct-mode and security checks | `npm run check:whatsapp-direct` | **114 passed, 0 failed** | 0 | `final-check-whatsapp-direct-20261111T0714Z.log` |
| Launcher self-check | `node scripts/isolated-env.mjs --check` | no problems; credentials file absent; session file owner-only | 0 | `final-isolated-env-check-20261111T0714Z.log` |

### New suite by area

| Area | Checks |
|---|---|
| C1 | 18 |
| C2 | 3 |
| C3 | 4 |
| C4 | 16 |
| C5 (simulated) | 23 |
| C6 | 15 |
| C7 | 5 |
| C8 | 7 |
| C9 | 6 |
| C10 | 17 |
| **Total** | **114** |

### Intermediate runs (kept unchanged, listed in order)

| Time | Run | Result | Explanation |
|---|---|---|---|
| 07:08 | `tsc-post-c1-c10-20261111T0708Z.log` | exit 2 | TypeScript compiled my snapshot copies under `reports/` (tsconfig includes `**/*.ts`). Fixed by appending `.orig` to the snapshot files; contents verified unchanged |
| 07:09 | `tsc-post-c1-c10-20261111T0709Z.log` | exit 0 | — |
| 07:09 | `check-whatsapp-post-c1-c10-20261111T0709Z.log` | 102/102, exit 0 | Includes the approved 4b expectation change (see below) |
| 07:09 | `check-phase2-post-c1-c10-20261111T0709Z.log` | **250 passed, 1 failed**, exit 1 | See the explanation below |
| 07:10 | `check-phase2-post-c1-c10-modepinned-20261111T0710Z.log` | 251/251, exit 0 | — |
| 07:13 | `check-whatsapp-direct-20261111T0713Z.log` | **112 passed, 1 failed**, exit 1 | See the explanation below |
| 07:13 | `check-whatsapp-direct-rerun-20261111T0713Z.log` | 114/114, exit 0 | — |

**The 250/1 Phase 2 failure: "Reply allowed inside the 24-hour window".**
- The C10 launcher forces `WHATSAPP_INTEGRATION_MODE=direct` into the process environment.
- That self-test turns on only the three *coexistence* flags and expects sending to be allowed. Under direct mode the new C1 rule correctly refuses.
- The coexistence rule under test was unchanged; the test depended on the ambient mode.
- **Test change, disclosed for review:** in `lib/ai/selftest.ts` the Agent 4 block, which already saves, forces and restores its own WhatsApp flags, now also pins `WHATSAPP_INTEGRATION_MODE=coexistence` and restores it afterwards.
- No assertion was changed and the count stays 251. Direct-mode send rules are tested in the new suite.

**The 112/1 direct-suite failure: C6.13.**
- This was a defect in my new test: its pattern `postMessage(creds` also matched the function's own definition in `cloud.ts`.
- The pattern now matches call sites (`await postMessage(creds`), and C6.13a was added to assert a single definition.
- The application code was not changed for this.

**Approved 4b change to the existing suite:**
- `scripts/check-whatsapp-coexistence.ts:54-55` changed from "normal mode: unchanged fallback to the supplied ids" to "no fallback to the hard-coded production ids (C9)".
- Total stays 102.

### Offline vs integration

| Kind | What it covers | Status |
|---|---|---|
| Offline unit (pure functions) | C1–C4, C6, C7, C8 (`directStatus`), C9, C10 | Run, pass |
| Offline source-structure checks | Route ordering (C4, C7), panel ordering and hook order (C8), bypass audit (C6), no `.env.local` in the launcher | Run, pass. These check code structure, not runtime HTTP behaviour |
| Offline **simulated** database (C5) | In-memory collection that mimics unique and partial-unique indexes, atomic `findOneAndUpdate`, find-then-insert upsert gaps, and an outage switch | Run, pass. **Not MongoDB** |
| Network | `globalThis.fetch` replaced by a spy for the whole suite | 2 spy calls, both intentional (C6.9 isolated exact-test-ID path; C6.10 production path); **0 real requests** |
| Local HTTP (routes, webhook end to end, admin session) | `webhook-tests.mjs`, `whatsapp-isolation-tests.mjs`, `check:routes`, D1–D10 from the test plan | **BLOCKED** (§D) |
| MongoDB-backed | Real claims, real index creation, existing-data inspection, restart against a real database | **BLOCKED** (§D) |
| Meta (test app) | T3/T4 | **BLOCKED**: no test-app credentials; not authorized |

---

## C. C5 evidence: retry, failure and duplicate protection

### Design (from the code)

- **Event identity and idempotency key:** the key from `normaliseWebhook`. For an inbound message this is `msg:<wamid>`; the Coexistence fields have their own keys.
- **Persistence:** `wa_webhook_events`, one document per key. Fields: `status` (`processing`, `done` or `failed`), `claimToken`, `claimedAt`, `attempts`, `doneAt` / `failedAt`, and `lastError` (a fixed label only).
- **Pre-C5 documents:** these have no status. The old code had fully handled them, so they count as `done`.
- **Concurrency protection:**
  - The **existing unique index `{key:1}`** makes `insertOne` the atomic first claim. If that index cannot be confirmed, claiming throws, so the webhook returns 500 instead of processing without protection.
  - A re-claim is one atomic `findOneAndUpdate`, allowed only when `status:"failed"`, or when `status:"processing"` and `claimedAt` is older than the **120 s lease**.
  - Completion is fenced by `claimToken`.
  - No transactions are used; the local test database is a standalone server.
- **Side-effect idempotency:** two **new partial unique indexes** on `ai_wa_messages`:
  - `wa_inbound_wamid_once {wamid, direction}` where `direction="in"`
  - `wa_reply_once {inReplyTo}`
  - Writes use upserts, and error 11000 means "already recorded".
  - The reply is **reserved before any send**. A retry that finds the reservation sends nothing, which gives at-most-once sending.
  - Coexistence history and echo writes, and their `ai_messages` lines, were made upserts keyed by wamid.
- **Order:** claim → all database work (inbound record, AI draft and reply, Coexistence updates, statuses) → mark `done` → only then add the key to the in-memory cache. The old seen-before-processing in-memory set was removed from the route.
- **HTTP responses:**
  - 200: processed or duplicate.
  - 500 `{ok:false, error:"Webhook processing failed; it will be retried."}`: any database or processing error. The event is marked `failed`, best-effort.
  - 500 "in progress": another request still holds a fresh claim.
  - No error text, stack trace, driver name or identifiers appear in responses (C5.5). Logs use fixed labels only.

### Scenario results

| Scenario | Evidence (all simulated, `final-check-whatsapp-direct-20261111T0714Z.log`) | Verified on real MongoDB? |
|---|---|---|
| Duplicate webhook retry | C5.2 (same process), C5.21 (twice in one delivery), C5.18 (pre-C5 document) | **No (BLOCKED)** |
| Database failure | C5.4 (database down: 500, nothing written or sent), C5.7 (failure after the inbound record: event `failed`, not done), C5.9 (failure after the send) | **No (BLOCKED)** |
| HTTP 500 behaviour | C5.4, C5.5 (fixed body, no internals), C5.10 (in progress), C5.19 (status-write failure) | **No (BLOCKED)**. HTTP-level 500 not exercised |
| Database recovery | C5.6 (redelivery after recovery processed exactly once), C5.8 (failed event re-claimed, inbound not duplicated, reply sent once) | **No (BLOCKED)** |
| Application restart | C5.3 (empty memory cache: the database claim answers duplicate), C5.11 (claim abandoned by a crash: re-claimed after the lease, reply **not** re-sent) | **No (BLOCKED)**. No real process restart was performed |
| Concurrent retries | C5.12–C5.14 (3 simultaneous deliveries: 1 processes, 1 inbound, 1 send), C5.15 / C5.17 (concurrent upserts and reservations with indexes: one wins), C5.20 (fenced completion) | **No (BLOCKED)**. JavaScript interleaving only, not real parallel server operations |
| Persistent idempotency | C5.3, C5.11 (state lives in the collection, not in memory) | **No (BLOCKED)** |
| Why the index matters | C5.16: the same race **without** the partial unique index produces **2** inbound records. The upsert alone is not enough, as the client noted | Simulated |

**Not claimed:** complete database duplicate protection has **not** been verified. It depends on the two new partial unique indexes being created successfully on the real database, and that is unverified.

### Simultaneous deliveries and partial failures

- **Simultaneous copies:** one wins the claim; the others answer 500 "in progress" (or 200 duplicate if the winner already finished), and Meta redelivers.
- **Failure before anything is stored:** 500; the event is `failed`; the redelivery processes it normally.
- **Failure after the inbound record, before the reply is reserved:** 500, `failed`. The redelivery finds the inbound record (no duplicate), runs the AI again and sends once.
- **Failure after the reply is reserved or sent:** 500. The redelivery finds the reservation and sends **nothing** (at-most-once). A reservation can stay `pending` if the final status write failed (see limitations).
- **Process crash mid-way:** the claim stays `processing`. Redeliveries within 120 s get 500 "in progress"; after that, the event is re-claimed and processed (C5.11).

### Remaining C5 limitations

1. **The new indexes are unverified.** Existing indexes and data could not be inspected (database access blocked). If existing `ai_wa_messages` data already holds duplicate inbound wamids or duplicate `inReplyTo` values, index creation fails:
   - The failure is logged with a fixed label and recorded in `messageIndexState`.
   - Protection then rests on the event claim plus upserts, which is weaker under concurrency (C5.16).
   - **Index creation in production is a schema change that happens on first use after deployment.** It needs a database check first, and is not done here.
2. **Lease takeover.** If a claim holder runs longer than 120 s, a redelivery can re-claim while it still runs. Inbound and reply duplicates are still blocked by the indexes, but the AI may be called twice and `ai_messages` (chat transcript) lines may repeat. The same can happen on a retry after a failure between the AI call and the reply reservation.
3. **At-most-once replies.** A reply whose reservation was written but whose send never happened (crash in between) is not retried automatically. It stays `pending` for staff to see.
4. **Meta's retry window is finite.** A long outage answered with 500 can exhaust Meta's redelivery attempts or trigger webhook alerts. This trade-off was approved in C5.
5. **Body size.** A chunked body without `content-length` is read fully before the 413 check.

---

## D. Docker and HTTP status

| Item | Status | Evidence |
|---|---|---|
| Docker remediation | **NOT REMEDIATED** | `reports/phase2/DOCKER_SECURITY_EVIDENCE.md` ("Status: BLOCKER, NOT REMEDIATED"); remediation script prepared but never run |
| Old root password invalidated? | **No.** Last evidence shows it is still USABLE | `docker-root-credential-check-current-20261110T1709Z.log` ("stored root credential: USABLE <-- remediation NOT effective"); no later evidence |
| Approved container identity | `marina-dev-mongo` (from 10 Nov evidence). **Not re-confirmed**: the Docker engine is not running | `docker-status-readonly-20261111T0714Z.log` |
| Database checks (`dev:db verify` 13/13) | **Not run** (BLOCKED) | Test database port 127.0.0.1:27018 refused |
| Application checks (runtime isolation 8/8) | **Not run** (BLOCKED) | — |
| Local HTTP testing permitted? | **No** | Preconditions not met |
| Actions taken | **None.** Docker was not started; no container, setting or credential was touched | Read-only port probe and `docker ps` only |

---

## E. Security and authorization confirmation

| Question | Answer | Basis |
|---|---|---|
| Production credentials accessed? | **No** | `.env.local` and other secret files were not opened. The launcher ran with all integration values blanked and no credentials file present |
| Production database accessed? | **No** | No database connection was made at all (test database down; C5 simulated) |
| Real Meta Graph API requests made? | **No** | `fetch` was replaced by a spy in the new suite (2 intercepted calls, 0 real). Existing suites use mocked fetch. No other Graph code was run |
| Public HTTPS endpoint exposed? | **No** | No server was started, and no tunnel or proxy was used |
| Outbound WhatsApp messages sent? | **No** | The only "sends" are the two spy interceptions and simulated sends in memory |
| Marina Muse's real WhatsApp number touched? | **No** | It appears only as the blocked constant and in refusal tests |
| C11 or C12 implemented? | **No** | Legacy Embedded Signup and Coexistence code is intact (`coexistence-actions.ts` unchanged). No data cleanup |
| Commits, pushes, merges or deployments? | **No** | Working tree changes only |
| Secrets in snapshots or evidence? | **No** | Snapshot holds source files and the two committed env templates only. The token-like strings in the diff and tests are fake (`EAAfakeTokenForOfflineTestsOnly000`, `EAAstoredSignupTokenFake000`, `EAAambientShouldBeBlanked0000`) |

---

## F. Outstanding issues, limitations and required authorizations

### Blocked or unverified

1. **All local HTTP tests:**
   - existing `webhook-tests.mjs` W1–W8 and `whatsapp-isolation-tests.mjs` WA1–WA4
   - `check:routes`
   - test-plan D1–D10 (route 410s, 413, foreign-ID drop, 500/retry over HTTP)
   - the C8 admin panel in a browser

   These need the Docker remediation to be verified (rotated root password NOT USABLE, `dev:db verify` 13/13, runtime 8/8).
2. **All MongoDB-backed C5 verification:** real claims, the effect of the unique index under real concurrency, real restart, and **inspection of existing indexes and data before the new partial unique indexes are created**.
3. **Real test-app credentials:** test WABA and phone-number ID matching against real values was not run; it was tested with fake IDs only.
4. **Production identifier rejection is partial:** the launcher refuses the known production app and config IDs and the live number. **Production WABA and phone-number IDs are unknown** (production env files are not read), so their rejection relies on the exact test-ID matching and is **not fully verified**.
5. **Meta stages T3–T5** (read-only Graph, real webhook delivery, any sending): not authorized.

### Behaviour changes to review

6. **These apply in every mode, including coexistence:**
   - **C6:** WhatsApp sends from any non-production server are now refused. Previously coexistence test-number replies could be sent from a development server.
   - **C9:** `META_APP_ID` and `META_CONFIG_ID` have no default, so **production must set them explicitly before the next deploy**, or Embedded Signup and the app-subscription check show "not configured".
   - **C5:** webhook database failures now return 500 instead of 200.
7. **New indexes at runtime:** creating `wa_inbound_wamid_once` and `wa_reply_once` on `ai_wa_messages` happens automatically on first webhook use after deployment. Needs a database check and approval before any deployment.
8. **Agent behaviour on retries:** draft errors now propagate. A persistent non-database bug in AI drafting would make Meta redeliver until it gives up.
9. **Mode defaults to coexistence:** an unknown `WHATSAPP_INTEGRATION_MODE` value is treated as coexistence (the registry flags invalid values on `/test`).
10. **Isolated launcher:** it now forces direct mode. The 10 Nov HTTP isolation test WA1 asserts coexistence-mode status fields (`appId`), so it will need updating when HTTP testing is allowed.

### Test changes made (for review)

11. `scripts/check-whatsapp-coexistence.ts`: fallback expectation changed (approved 4b).
12. `lib/ai/selftest.ts`: mode pinned in the Agent 4 block. Disclosed in §B; this was not pre-approved and needs review.
13. `scripts/check-whatsapp-direct.ts`: C6.13 pattern fixed after its first run (a defect in the new test).

### Future authorizations needed

- Docker remediation run and verification
- Database inspection, then the decision on the new indexes
- Local HTTP testing (D1–D10 and the existing suites)
- Meta test-app credentials and T3/T4
- Any sending (T5)
- The number-plan decision
- Production configuration (`META_APP_ID`, mode, flags) and deployment
- C11 and C12 (separately)

**Work stopped here, pending the client's written review.**
