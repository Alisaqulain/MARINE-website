# WhatsApp Direct Cloud API: Proposed Change Plan

**Date:** 11 November 2026
**Status:** **PROPOSED ONLY. Nothing here has been implemented or committed.** Each change needs separate written client approval before work starts.
**Based on:** `WHATSAPP_DIRECT_CLOUD_API_AUDIT.md` (findings F1–F10).

## Approach

Add an explicit integration mode, `WHATSAPP_INTEGRATION_MODE=direct | coexistence`.

- **Gate** Embedded Signup and Coexistence off in `direct` mode instead of deleting them.
- Delete those code paths only after direct mode has run in production and the client confirms ES/Coex is no longer wanted (C11).

This keeps every change reversible by changing an environment value. The live-number block (`BLOCKED_LIVE_NUMBER`) **stays in place** in every mode until the client approves a number plan in writing (Audit §3).

### Default mode (decision required)

- `coexistence` default: preserves today's behaviour.
- `direct` default: matches the client's stated direction.

**Recommendation:** default to `coexistence` in code and set `direct` explicitly in the environment. A missing variable then never changes behaviour.

### Proposed new or renamed environment variables (names only)

| Variable | Purpose |
|---|---|
| `WHATSAPP_INTEGRATION_MODE` | `direct` or `coexistence` |
| `WHATSAPP_PRODUCTION_SENDING_APPROVED` | Written approval for live sending in direct mode. Replaces the misuse of `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED` |
| `WHATSAPP_TEST_PHONE_NUMBER_ID` | Phone-number ID of the Meta **test** number. Test-mode sending is allowed only from this ID |
| `WHATSAPP_TEST_RECIPIENTS` | Comma-separated allow-list of tester numbers for test-mode sends |
| `WHATSAPP_ALLOW_OUTSIDE_PRODUCTION` | Explicit opt-in for non-production sends (mirrors the PayPal and ShipGlobal guards) |

Existing, unchanged: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_API_VERSION`, `WHATSAPP_OUTBOUND_ENABLED`, `WHATSAPP_FOLLOWUP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`.

---

## Changes

### C1. Send permission independent of coexistence (fixes F1)

| | |
|---|---|
| **Files** | `lib/whatsapp/coexistence.ts:894-909` (`shouldSendWhatsApp`, `outboundAllowed`), `lib/whatsapp/cloud.ts:130-142` (`sendGate`). Possibly a new `lib/whatsapp/mode.ts` |
| **Existing behaviour** | Sending needs `WHATSAPP_COEXISTENCE_ENABLED` + `WHATSAPP_OUTBOUND_ENABLED`, plus either `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED` or a stored `displayNumber` equal to `WHATSAPP_COEXISTENCE_TEST_NUMBER` |
| **Proposed behaviour** | In `direct` mode, sending is allowed only if `WHATSAPP_OUTBOUND_ENABLED=true` **and** one of: (a) `WHATSAPP_PRODUCTION_SENDING_APPROVED=true`; or (b) test mode, where `WHATSAPP_PHONE_NUMBER_ID === WHATSAPP_TEST_PHONE_NUMBER_ID` and the recipient is in `WHATSAPP_TEST_RECIPIENTS`. All existing rules stay: 24-hour window, consent for templates, suppression, valid number, and never sending to `BLOCKED_LIVE_NUMBER`. `coexistence` mode is unchanged |
| **Impact** | Direct mode can send without the misleading onboarding flag. Test sends are limited to the Meta test number and allow-listed testers. No change in `coexistence` mode |
| **Required tests** | Unit truth table for both modes × all flags (extend `lib/ai/selftest.ts` §Agent 4). Re-run probes P14–P17 with expected new results. Recipient not on the allow-list → refused. Production phone ID with test flags → refused. Live-number recipient → refused in every mode. Existing 102 + 251 checks still pass |

### C2. Callers pass the right context to the send gate (fixes F1)

| | |
|---|---|
| **Files** | `lib/whatsapp/inbound.ts:23-31` (`deliver`), `lib/ai/followups.ts:162-169` |
| **Existing behaviour** | `deliver` passes `businessNumber: state?.displayNumber`, which only Coexistence sets. `followups` passes no `businessNumber`, so test-mode follow-ups are always refused |
| **Proposed behaviour** | Both callers rely on the mode-aware gate from C1. In `direct` mode, `readCoexistenceState()` is not needed to send |
| **Impact** | Direct mode replies and follow-ups follow one set of rules |
| **Required tests** | Unit: `deliver` and `sendFollowUp` decisions with direct env and no `wa_coexistence_state` document. Local HTTP: synthetic inbound → reply **withheld** with the right reason while outbound is off |

### C3. Credentials from environment only in direct mode (fixes F3)

| | |
|---|---|
| **Files** | `lib/whatsapp/cloud.ts:12-25` (`resolveCredentials`) |
| **Existing behaviour** | Env token first. If it is empty, decrypts the stored Embedded Signup token. Phone and WABA IDs also fall back to stored values |
| **Proposed behaviour** | In `direct` mode, use only the environment. A missing token or ID gives `source: "none"` with a clear error. The stored signup token is never used |
| **Impact** | No silent use of a token from an earlier signup. Simpler to reason about |
| **Required tests** | Unit: direct mode + stored ciphertext + empty env → `source: "none"`. Coexistence mode is unchanged |

### C4. Webhook: accept only the configured WABA/number; verify raw bytes; size limit (fixes F2, F7)

| | |
|---|---|
| **Files** | `app/api/meta/whatsapp/webhook/route.ts:46-80`, `lib/whatsapp/coexistence.ts:644-749` (or a new `lib/whatsapp/webhook.ts`), `lib/whatsapp/cloud.ts:175-198` |
| **Existing behaviour** | Every validly signed `whatsapp_business_account` event is processed, whatever its `entry.id` (WABA) or `metadata.phone_number_id`. HMAC is computed over `req.text()`. No body-size limit |
| **Proposed behaviour** | (a) In `direct` mode, ignore entries whose `entry.id` is not `WHATSAPP_BUSINESS_ACCOUNT_ID`, and changes whose `metadata.phone_number_id` is not `WHATSAPP_PHONE_NUMBER_ID`. Count them in the response as `ignoredForeign` and log a fixed label with no IDs. (b) Hash the bytes from `req.arrayBuffer()` and decode afterwards. (c) Reject bodies over a limit (e.g. 1 MB) with 413 before hashing. (d) In `direct` mode, skip `coexistenceUpdates` |
| **Impact** | Events for other numbers on a shared Meta app can no longer create sessions or replies. Signature checking is byte-exact |
| **Required tests** | Unit: P10 must give `ignore`. Foreign WABA ignored. Status for a foreign phone ID ignored. Non-ASCII and BOM bodies verify correctly. Local HTTP: W1–W8 still pass, plus new D1–D6 (Test Plan §T2) |

### C5. Webhook failure semantics and duplicate store (fixes F6)

| | |
|---|---|
| **Files** | `lib/whatsapp/store.ts:9-17, 173-191`, `app/api/meta/whatsapp/webhook/route.ts:59-71`, `lib/whatsapp/coexistence.ts:753-758` |
| **Existing behaviour** | Index-creation errors are swallowed. Non-duplicate DB errors return `duplicate:false`, so processing continues. The route returns 200 even if storage failed, so Meta does not retry. The in-memory set marks a key before processing |
| **Proposed behaviour** | `recordWebhookKey` returns `{ error: true }` on non-11000 errors. The route then returns **500** without adding the key to the memory set, so Meta redelivers. Duplicates (11000) still return 200. Index creation is retried and its failure logged with a fixed label |
| **Impact** | No silent loss of inbound messages during DB outages. Meta's retries are deduplicated once the DB recovers. **Trade-off:** during a long outage, Meta retries and may eventually disable the webhook. The client should choose between this and today's at-most-once behaviour |
| **Required tests** | Unit with a mock store: DB error → 500 and key not marked. 11000 → 200 duplicate. Local HTTP with the test DB stopped → 500. After the DB restarts, a redelivery is processed once (D5) |

### C6. Refuse real sends outside production (fixes F4)

| | |
|---|---|
| **Files** | `lib/whatsapp/cloud.ts:144-154` (`postMessage`) or the C1 gate |
| **Existing behaviour** | No environment check. A dev server with real `WHATSAPP_*` values in `.env.local` could send if the flags are set |
| **Proposed behaviour** | If `NODE_ENV !== "production"`, refuse unless `MARINA_ISOLATED_TEST=1` **and** the phone ID equals `WHATSAPP_TEST_PHONE_NUMBER_ID`, or `WHATSAPP_ALLOW_OUTSIDE_PRODUCTION=true` is set explicitly. Same pattern as the PayPal and ShipGlobal guards |
| **Impact** | A developer machine cannot message customers by mistake |
| **Required tests** | Unit: development + production-looking phone ID → refused before any network call (assert that fetch is not called) |

### C7. Close the Embedded Signup and Coexistence routes in direct mode (fixes F8)

| | |
|---|---|
| **Files** | `app/api/meta/whatsapp/signup/exchange/route.ts`, `signup/approve/route.ts`, `coexistence/route.ts` |
| **Existing behaviour** | Reachable by the main admin. The exchange is guarded by `signupMode` and calls Meta when open |
| **Proposed behaviour** | In `direct` mode, return **410 Gone** ("Embedded Signup is disabled: direct Cloud API mode") before any parsing or Meta call. No change in `coexistence` mode |
| **Impact** | No way to start ES/Coex while direct mode is set, even if the old flags are left on |
| **Required tests** | Local HTTP with an admin session: each route → 410 and `calledMeta` absent or false. Extend `whatsapp-isolation-tests.mjs` (D7) |

### C8. Admin panel, status endpoint and health for direct mode (fixes F8, F9)

| | |
|---|---|
| **Files** | `components/AdminWhatsAppPanel.tsx`, `app/api/meta/whatsapp/status/route.ts`, `lib/whatsapp/coexistence.ts:941-1023` (`publicStatus`), `lib/ai/integrations.ts:348-390, 512-610`, `lib/ai/health.ts:312-341, 469`, `app/test/page.tsx:256-290` |
| **Existing behaviour** | The panel loads the Facebook SDK and offers Embedded Signup, a simulated finish and coexistence steps. Status shows the config ID and Tech Provider blockers. Health marks "Business app coexistence" as **required** for Agent 4 |
| **Proposed behaviour** | In `direct` mode: the panel shows a "Direct Cloud API" card with masked WABA and phone IDs (`maskId`), whether the token and secrets are set, the handshake time, the result of the read-only `pingWhatsAppCloud` (on demand), the outbound and test-mode state, and the live-number block. **The Facebook SDK is not loaded.** The signup and simulate buttons are not rendered. Status returns a `directStatus` shape. In health, the coexistence card is "not applicable" and not required for Agent 4 |
| **Impact** | The admin screen matches the real integration. The Facebook SDK is no longer loaded on the admin page |
| **Required tests** | Unit: `directStatus` never includes a token, secret or full number. Local UI check: no request to `connect.facebook.net` in direct mode. `/test` shows the coexistence card as N/A. Agent 4 health is not degraded by it |

### C9. Remove hard-coded production Meta IDs as fallbacks (fixes F3)

| | |
|---|---|
| **Files** | `lib/whatsapp/coexistence.ts:10-26`, `.env.example:199, 211`, `lib/ai/env-registry.ts:144, 149` |
| **Existing behaviour** | When `META_APP_ID` / `META_CONFIG_ID` are unset (outside isolated mode), the code uses `1588276335845243` / `1760993601871515`. `.env.example` pre-fills them |
| **Proposed behaviour** | No fallback in any mode. Unset means "not configured". `.env.example` values are blank, with a comment |
| **Impact** | A new environment can never point at the production app by default. **Production must set `META_APP_ID` explicitly before deploy** (deploy checklist item) |
| **Required tests** | Unit: `metaAppIds({})` → empty. P18 expected result changes. `check:phase2` `.env.example` check still passes |

### C10. Isolated launcher accepts direct test credentials (fixes F5)

| | |
|---|---|
| **Files** | `.env.isolated-test.example`, `scripts/isolated-env.mjs` (forced switches) |
| **Existing behaviour** | Only `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID` and `WHATSAPP_COEXISTENCE_TEST_NUMBER` are accepted. Direct credentials are rejected as "not an isolated-test variable" |
| **Proposed behaviour** | Add `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEST_PHONE_NUMBER_ID` and `WHATSAPP_TEST_RECIPIENTS` (all blank). Force `WHATSAPP_INTEGRATION_MODE=direct` and keep `WHATSAPP_OUTBOUND_ENABLED=false` **forced**; only a separately approved T5 run may change it. Add a check that `WHATSAPP_PHONE_NUMBER_ID === WHATSAPP_TEST_PHONE_NUMBER_ID`, otherwise refuse to start |
| **Impact** | Test-app credentials can be used in isolation, never mixed with `.env.local` |
| **Required tests** | `node scripts/isolated-env.mjs --check` lists the new names as `isolated-file` (names only). A mismatched phone ID stops the launcher with a PROBLEM line |

### C11. (Later, separate approval) Remove ES/Coex code

| | |
|---|---|
| **Files** | `lib/whatsapp/coexistence-actions.ts`, `app/api/meta/whatsapp/signup/*`, `app/api/meta/whatsapp/coexistence/route.ts`, ES/Coex parts of `coexistence.ts`, `applyCoexistenceUpdates` in `inbound.ts`, `scripts/check-whatsapp-coexistence.ts`, related docs. Move `verifyHandshake`, `verifySignature`, `normaliseWebhook` and `planEvents` to `lib/whatsapp/webhook.ts` |
| **Existing behaviour** | Present and gated |
| **Proposed behaviour** | Deleted after direct mode has run in production for an agreed period |
| **Impact** | Less code to maintain. Coexistence can no longer be re-enabled without a code change |
| **Required tests** | Full unit suites, route check (`check:routes`), build, local webhook suite |

### C12. Data handling for direct mode (decision; no code until approved)

| | |
|---|---|
| **Files / DB** | `wa_coexistence_state`, `wa_contacts`, `ai_sessions.humanTakeoverUntil` |
| **Existing behaviour** | May hold an encrypted signup token (production DB not inspected) |
| **Proposed behaviour** | Proposed one-off admin script, run with approval: in production, clear `tokenCiphertext` / `tokenExpiresAt` from `wa_coexistence_state` and keep `webhookHandshakeAt`. Leave other collections untouched. Agree a retention period for `ai_wa_messages` text |
| **Impact** | No stale credential at rest |
| **Required tests** | Dry-run against the **local test DB** only, printing counts and no values |

### Documentation (with C1–C10)

Update for direct mode:
- `lib/ai/env-registry.ts` "how" texts
- `scripts/gen-env-docs.ts` output
- `docs/phase2/ENVIRONMENT_SETUP.md`, `INTEGRATIONS.md`
- a new `docs/phase2/WHATSAPP_DIRECT_CLOUD_API_SETUP.md` covering:
  - System User token
  - subscribing the app to the WABA (done by the client in Meta, see below)
  - webhook fields: only `messages` is needed
  - templates

Mark `WHATSAPP_COEXISTENCE_SETUP.md` and `META_TEST_APP_REQUIREMENTS.md` as applying to coexistence mode only.

## Steps intentionally left outside the code (client performs in Meta)

| Step | Why not in code |
|---|---|
| Phone-number registration (`POST /{phone-number-id}/register`) and two-step PIN | Changes the number at Meta. The code blocks `/register` everywhere, and this should stay a deliberate manual step in WhatsApp Manager |
| Subscribing the app to the WABA (`POST /{waba}/subscribed_apps`) | One-time setup. Can be done from the App Dashboard or Graph Explorer by the client. The code only *reads* it (`pingWhatsAppCloud`) |
| Webhook callback URL and verify token entry | Done in the App Dashboard |
| Message template creation and approval | WhatsApp Manager |

## Approval checklist

| Item | Approve? |
|---|---|
| Number plan: current business number vs a new dedicated number (Audit §3) | ☐ |
| Default `WHATSAPP_INTEGRATION_MODE` (recommended: `coexistence` in code, `direct` set in env) | ☐ |
| C1–C4, C6, C9, C10: required before any direct-mode test with Meta | ☐ |
| C5 webhook failure semantics (500 + retry vs today's 200 at-most-once) | ☐ |
| C7–C8 UI, route and health changes | ☐ |
| C11 code removal (later) | ☐ |
| C12 production data cleanup (later) | ☐ |
