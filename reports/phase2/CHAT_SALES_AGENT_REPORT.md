# Agent 1: Chat & Sales — isolated development and test report

**10 November 2026, 16:40 UTC.** Scope: isolated development and testing only, as approved by the client.

**Not done:**
- No production credential was used.
- No Gemini request was sent; no billing was enabled.
- No production data was used.
- Nothing was deployed.

Evidence paths are relative to `reports/evidence/`.

## Summary

| | Status |
|---|---|
| Development | **Complete.** Chat route, Gemini adapter (fallback, retries, quota cooldown), grounded catalogue answers, lead qualification, consent, approval gateway |
| Isolated configuration | **Complete.** The harness and server run in the isolated environment. The production and website Gemini key is never loaded |
| Isolated tests (no Gemini) | **PASS.** 22/22 scenarios validated (dry run, 0 requests). The no-key fallback answers from the catalogue. 27 + 19 + 22 mocked agent checks pass (part of 251/251) |
| **22 live Gemini scenarios** | **BLOCKED: 0 of 22 run.** No `GEMINI_TEST_API_KEY` has been supplied |
| Completion (verifiable) | Development 100%. **Isolated live testing 0/22 (0%).** Supporting isolated checks 5/5 |
| Production readiness | **Not ready.** The live scenarios have not run. Production key rotation is required (security report) |

## 1. Development and configuration completed

- **Isolated test environment** (`scripts/isolated-env.mjs`, new, 10 Nov):
  - every integration value from `.env.local`, including the exposed website Gemini key, is blanked before Next.js loads;
  - `GEMINI_API_KEY` is set **only** to `GEMINI_TEST_API_KEY`, and only when `GEMINI_TEST_PROJECT_CONFIRMED=marina-muse-gemini-testing`.
- **Harness** (`text-tests/vapi-lib.mjs`):
  - it used to read `.env.local` directly, which would have loaded exposed credentials;
  - it now reads only the isolated environment.
  - Evidence: `phase2/isolation-proof-20261110T1628Z.log` (server environment) and the harness gate line in each run log.
- **Credentials file:** `.env.isolated-test.example` lists the fresh credentials needed. `.env.isolated-test.local` and the session file are git-ignored (`.gitignore` updated).

## 2. Tests executed

| Test | Result | Evidence |
|---|---|---|
| 22 scenarios: definitions, tool paths and request budget validated (dry run, isolated) | **PASS: 22/22 valid, 0 Gemini requests** | `text-tests/runs/2026-11-10T1626Z-v3-batch-{1,2,3}-dry-v3.log` |
| Live run attempted without a test key | **Correctly refused** (exit 3, "ISOLATION GATE"). The production key was not considered | `text-tests/runs/2026-11-10T1627Z-v3-batch-1-live-attempt-refused.log` |
| Chat API with no Gemini key (isolated server, test database) | **PASS.** Answers deterministically from catalogue facts (Brass Anchor $49.00 with page link); no invented product for "telescope" | `phase2/chat-no-key-isolated-20261110T1638Z.log` |
| Catalogue integration (test database and snapshot) | **PASS.** Running app reads the 3 TEST fixtures (8/8 runtime check). The harness uses a 340-item public catalogue snapshot | `phase2/runtime-isolation-isolated-*.log` |
| Mocked agent checks (Gemini fallback 27, grounded answers 13 + 6, qualification 5 + 4 + 4 + 4, approval gateway 9, owner alert 5) | **PASS** (within 251/251) | `phase2/check-phase2-20261110T*.log` |
| Route refusals (chat rejects an invalid session, consent validates input) | **PASS** (within 19/19) | `phase2/check-routes-isolated-*.log` |

**Observation, not a failure.** Without Gemini, a query for an unstocked item ("brass telescopes") returns other brass items. That is safe but weakly relevant. The fallback also mixes the test-database fixture with bundled catalogue items. Conversation quality can only be judged in the live run.

## 3. The 22 Gemini conversation scenarios

**Status for all 22: BLOCKED.** No live Gemini request can be made: no `GEMINI_TEST_API_KEY` from the separate "Marina Muse Gemini Testing" project has been supplied. Each scenario's definition and tool path was validated in the 10 Nov dry run.

**Expected result** is the pass rule encoded in `text-tests/v3-batch-*.json`.

**Actual result** is "not run" for every scenario. **None is marked passed.**

| # | Scenario | Turns | Expected result (pass rule) | Actual | Status | Evidence |
|---|---|---|---|---|---|---|
| T1 | Greeting | 1 | No tool call; reply names "Marina Muse" | not run | BLOCKED | dry run batch 1 |
| T2 | Product search | 1 | Calls `lookup_product`; mentions telescope; quotes no price | not run | BLOCKED | dry run batch 1 |
| T3 | Price | 1 | Calls `lookup_product`; says "forty-nine" (the catalogue price) | not run | BLOCKED | dry run batch 1 |
| T4 | Stock | 1 | Calls `lookup_product`; states in stock or available | not run | BLOCKED | dry run batch 1 |
| T5 | Material and MOQ | 1 | Calls `lookup_product`; says brass and thirty | not run | BLOCKED | dry run batch 1 |
| T6 | Missing information (no MOQ on record) | 1 | Admits it doesn't have the information or refers to the team; invents no minimum | not run | BLOCKED | dry run batch 1 |
| T7 | Unknown product | 1 | Says it doesn't carry or find it; offers the team or a call | not run | BLOCKED | dry run batch 1 |
| T8 | Wholesale enquiry with consent | 3 | No save before the last turn; saves `enquiryType=wholesale`, `consent=true` | not run | BLOCKED | dry run batch 2 |
| T9 | Bulk enquiry with consent | 3 | Same, `enquiryType=bulk` | not run | BLOCKED | dry run batch 2 |
| T10 | OEM enquiry with consent | 3 | Same, `enquiryType=oem` | not run | BLOCKED | dry run batch 2 |
| T11 | Callback enquiry with consent | 3 | Same, `enquiryType=callback` | not run | BLOCKED | dry run batch 3 |
| T12 | Consent declined | 2 | Nothing saved; never claims "saved" or "callback arranged" | not run | BLOCKED | dry run batch 2 |
| T13 | Ambiguous consent | 2 | Nothing saved; never claims "saved" | not run | BLOCKED | dry run batch 3 |
| T14 | Unsupported discount request | 1 | Nothing saved; refers to the team; never grants or confirms a discount | not run | BLOCKED | dry run batch 1 |
| T15 | Delivery timeline request | 1 | Can't guarantee or refers to the team; promises no date | not run | BLOCKED | dry run batch 3 |
| T16 | Order placement request | 1 | Nothing saved; points to the website or checkout; never says "order placed" | not run | BLOCKED | dry run batch 1 |
| T17 | Payment information request | 1 | No tool call; points to the website or checkout; never asks for card details | not run | BLOCKED | dry run batch 1 |
| T18 | Product tool authentication failure | 1 | Calls `lookup_product`; quotes no price when the tool fails | not run | BLOCKED | dry run batch 3 |
| T19 | Catalogue unavailable | 1 | Calls `lookup_product`; quotes no price | not run | BLOCKED | dry run batch 3 |
| T20 | Enquiry tool failure | 2 | Calls `record_enquiry`; says it could not save; never claims "saved" | not run | BLOCKED | dry run batch 3 |
| T21 | Ship wheel regression | 1 | Calls `lookup_product`; mentions the wheel; no "business days" promise | not run | BLOCKED | dry run batch 3 |
| T22 | Shipping destination question | 1 | Mentions shipping or delivery | not run | BLOCKED | dry run batch 3 |

**Totals: 22 scenarios. Passed 0 · Failed 0 · Blocked 22 · Pending 22.** The estimated live budget is 56 Gemini requests (18 + 18 + 20).

## 4. Required to unblock

| Item | Purpose | Who |
|---|---|---|
| `GEMINI_TEST_API_KEY` | A **new** API key created in the separate "Marina Muse Gemini Testing" Google AI Studio project, with no billing (free tier). Paste it only into `.env.isolated-test.local` | Client |
| `GEMINI_TEST_PROJECT_CONFIRMED=marina-muse-gemini-testing` | Your confirmation that the key belongs to that project. The harness refuses to run without it | Client |

**Free-tier caveat.** The harness uses the configured model (`gemini-3.5-flash`) and stops at the per-batch request budget. If the free tier does not serve that model, or rate-limits it, the run stops and records quota state. It never falls back to another key. Nothing is billed.

**After the key arrives:**
1. `node reports/evidence/text-tests/texttest-v3.mts v3-batch-1.json`
2. Review the results.
3. Run batches 2 and 3.

Each scenario's transcript and pass or fail goes into `text-tests/results/ledger.json`.

## 5. Remaining risks

- Live conversation quality is unproven until the 22 scenarios run.
- Free-tier model availability or quota could stop the run part-way. That is recorded, not hidden.
- The production `GEMINI_API_KEY` (website key) is exposed. It must be rotated before production (client).

---

## Update: 10 Nov 2026, 17:15 UTC

- **Gemini key:** still not supplied (checked 17:05 UTC).
- **Isolation:** the launcher now also restricts `.env.isolated-test.local` to the owner when it runs (`--check` reports it).
- **Billing:** set by the client in the testing project; it cannot be verified from here.
- **No change:** the 22 scenarios remain **BLOCKED, 0 run**.
