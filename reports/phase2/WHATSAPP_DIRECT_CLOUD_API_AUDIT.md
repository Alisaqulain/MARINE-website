# WhatsApp Direct Cloud API: Read-Only Audit

**Date:** 11 November 2026
**Scope:** Read-only audit of the existing WhatsApp implementation, done to plan a direct (business-owned WABA) Cloud API integration in place of Embedded Signup / Coexistence.
**Companion reports:**
- `WHATSAPP_DIRECT_CLOUD_API_CHANGE_PLAN.md`: proposed changes, **not implemented**
- `WHATSAPP_ISOLATED_TEST_PLAN.md`
- `WHATSAPP_ISOLATED_TEST_RESULTS.md`: what was actually executed, kept separate from this audit

## What this audit was and was not

| Done | Not done |
|---|---|
| Read every WhatsApp/Meta source file, route, admin component, store, env registry entry, isolated-env launcher and test script listed in §1 | No code was changed or committed |
| Mapped env-variable *names* and where they are read | `.env.local` and other secret files were **not opened**. No secret value was read or printed |
| Reviewed existing test evidence from 10 Nov 2026 | No production credentials used. No Graph API call made |
| Ran offline unit suites and an in-process probe with synthetic values (see Results report) | No Embedded Signup, Coexistence or Tech Provider action started |
| | No WhatsApp message sent (test or otherwise). No public endpoint exposed. Nothing deployed |

Findings below come from code inspection. Where a finding was also confirmed by executing code, the probe ID (`P1`–`P19`) from the Results report is given. **Nothing in this audit means the direct integration is complete or working against Meta.**

---

## 1. Inventory of Embedded Signup and Coexistence dependencies

### 1.1 Backend library

| File | Element | Role | ES / Coex specific? |
|---|---|---|---|
| `lib/whatsapp/coexistence.ts:5` | `BLOCKED_LIVE_NUMBER = "917457099540"` | Refuses any Graph call or send that targets the live business number | Safety guard. Needed in direct mode too until the number plan is approved |
| `lib/whatsapp/coexistence.ts:10-11` | `SUPPLIED_APP_ID`, `SUPPLIED_CONFIG_ID` | Hard-coded production app and Embedded Signup config IDs | **ES**. App ID is still used by the direct path (webhook subscriptions check) |
| `lib/whatsapp/coexistence.ts:19-26` | `metaAppIds()` | Falls back to the hard-coded production IDs unless `MARINA_ISOLATED_TEST=1` (probe P18/P19) | **ES** |
| `lib/whatsapp/coexistence.ts:28` | `BLOCKED_GRAPH_PATHS` | Blocks `/register`, `/deregister`, `/smb_app_data`, `/messages`, `/subscribed_apps` for the signup exchange | ES guard |
| `lib/whatsapp/coexistence.ts:118-124` | `readFlags()` | `WHATSAPP_COEXISTENCE_ENABLED`, `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED`, `WHATSAPP_OUTBOUND_ENABLED` | **Coex**. Also gates *all* sending (see §2.3) |
| `lib/whatsapp/coexistence.ts:132-145` | `COEXISTENCE_FEATURE_TYPE`, `embeddedSignupLaunch()` | FB.login options (`featureType: whatsapp_business_app_onboarding`) | **ES + Coex** |
| `lib/whatsapp/coexistence.ts:148-187` | `normalizePhone`, `testNumber`, `signupMode`, `numberDecision` | Test number and production approval rules for onboarding | **Coex** |
| `lib/whatsapp/coexistence.ts:212-228` | `encryptToken` / `decryptToken` | AES-256-GCM with key from `AUTH_SECRET` (scrypt) for the signup-issued token | **ES** |
| `lib/whatsapp/coexistence.ts:230-251` | `graphCallAllowed`, `productionSignupAllowed` | Allows only `/oauth/access_token` | **ES** |
| `lib/whatsapp/coexistence.ts:253-409` | `acceptSignupPost`, `rememberAuthorizationCode` | Validates `WA_EMBEDDED_SIGNUP` session events; blocks code replay | **ES** |
| `lib/whatsapp/coexistence.ts:420-448` | `coexistenceCallAllowed` | Allow-list for post-signup Graph calls | **Coex** |
| `lib/whatsapp/coexistence.ts:450-515` | `onboardingSteps`, `accountStateFor`, `tokenExpiryLabel` | 24-hour sync window, onboarding step state | **Coex** |
| `lib/whatsapp/coexistence.ts:517-563` | `exchangeAuthorizationCode` | Code-for-token exchange | **ES** |
| `lib/whatsapp/coexistence.ts:573-603` | `verifyHandshake`, `verifySignature` | Webhook GET/POST security | **Generic.** Needed by direct mode |
| `lib/whatsapp/coexistence.ts:644-789` | `normaliseWebhook`, `planEvents`, `webhookSummary` | Webhook parsing and duplicate planning; handles `messages` plus Coex fields | Mostly **generic**. `history` / `smb_*` branches are Coex |
| `lib/whatsapp/coexistence.ts:814-889` | `coexistenceUpdates` | History, contact sync and echo extraction | **Coex** |
| `lib/whatsapp/coexistence.ts:892-909` | `HUMAN_TAKEOVER_HOURS`, `shouldSendWhatsApp`, `outboundAllowed` | Send permission | **Coex-coupled** (see §2.3) |
| `lib/whatsapp/coexistence.ts:911-1023` | `coexistenceMode`, `coexistenceVerified`, `publicStatus` | Admin status, checklist and blockers (hard-coded config ID and Tech Provider text at `:961-962`) | **ES + Coex** |
| `lib/whatsapp/coexistence-actions.ts` (whole file) | `verifyOnboardedNumber`, `subscribeApp`, `requestSync`, `appWebhookFields` | Post-signup Graph actions using the stored token. `appWebhookFields` reads app subscriptions with the app token | **Coex**. `appWebhookFields` is generic |
| `lib/whatsapp/cloud.ts:12-25` | `resolveCredentials` | `WHATSAPP_*` env first, then the decrypted signup token | Generic, with an ES fallback |
| `lib/whatsapp/cloud.ts:42-125` | `pingWhatsAppCloud` | Read-only health: phone, WABA, subscribed_apps, templates | **Generic** |
| `lib/whatsapp/cloud.ts:130-142` | `sendGate` | All send rules; calls `outboundAllowed` | Generic rules, but the first rule is Coex-coupled |
| `lib/whatsapp/cloud.ts:144-203` | `postMessage`, payload builders, `statusUpdatesFromWebhook`, `isOptOut` | Sending and parsing | **Generic** |
| `lib/whatsapp/inbound.ts:11-48` | `deliver` | Human-takeover check, then `sendGate` with `businessNumber: state?.displayNumber` | Coex-coupled (`displayNumber` is only set by the Coex verify step) |
| `lib/whatsapp/inbound.ts:54-89` | `draftInbound` | Opt-out/opt-in, AI draft, delivery | **Generic** |
| `lib/whatsapp/inbound.ts:95-175` | `applyCoexistenceUpdates` | Stores history, contacts and echoes; sets human takeover | **Coex** |
| `lib/whatsapp/inbound.ts:178-196` | `applyStatusUpdates` | Delivery receipts | **Generic** |
| `lib/whatsapp/store.ts` | `wa_coexistence_state` doc `id:"current"` and `wa_webhook_events` | State plus duplicate keys | State doc is **ES/Coex**. Duplicate store is generic |
| `lib/ai/followups.ts:162-169` | Template follow-ups | `resolveCredentials(readCoexistenceState())`, then `sendGate` **without** `businessNumber` | Coex-coupled |
| `lib/ai/integrations.ts:348-390` | `checkWhatsApp` | Admin/`/test` card for Cloud API | Generic. Its text mentions coexistence flags |
| `lib/ai/integrations.ts:501-610` | `checkCoexistence` | Coexistence card for `/test` | **Coex** |
| `lib/ai/health.ts:312-341, :469` | `coexistenceCard`. Agent 4 marks "Business app coexistence" as **required** | Health status | **Coex**. Direct mode would show Agent 4 as degraded |
| `lib/ai/env-registry.ts:139-153` | WhatsApp and coexistence variables | Docs and validation | Mixed (see §1.5) |
| `lib/ai/selftest.ts:349-390`, `lib/ai/provider-selftest.ts:173-178` | Unit checks | Webhook, send gate, signature | Generic |

### 1.2 API routes

| Route | File | ES / Coex? | Notes |
|---|---|---|---|
| `POST /api/meta/whatsapp/signup/exchange` | `app/api/meta/whatsapp/signup/exchange/route.ts` | **ES** | Admin-only, same-origin, rate-limited, replay-blocked. Calls Meta `oauth/access_token` with `allowNetwork: true` when signup is open |
| `POST /api/meta/whatsapp/signup/approve` | `app/api/meta/whatsapp/signup/approve/route.ts` | **ES** | Always 403 (approval comes only from the environment) |
| `POST /api/meta/whatsapp/coexistence` | `app/api/meta/whatsapp/coexistence/route.ts` | **Coex** | verify_number / subscribe_webhooks / sync_contacts / sync_history |
| `GET /api/meta/whatsapp/status` | `app/api/meta/whatsapp/status/route.ts` | **ES + Coex** | Returns `publicStatus()` (masked IDs) |
| `GET/POST /api/meta/whatsapp/webhook` | `app/api/meta/whatsapp/webhook/route.ts` | Generic, with Coex branches | Public by necessity (middleware matches only `/admin` and `/wholesale`) |

### 1.3 Frontend

| File | Dependency |
|---|---|
| `components/AdminWhatsAppPanel.tsx:171` | Loads `connect.facebook.net/en_US/sdk.js` when `signupAllowed` |
| `components/AdminWhatsAppPanel.tsx:82-91, 141-166` | `FB.init` / `FB.login` with `launch` options; listens for `WA_EMBEDDED_SIGNUP` postMessage from `facebook.com` |
| `components/AdminWhatsAppPanel.tsx:229-244` | "Simulate finish" dry-run button (hard-coded sample IDs) |
| `components/AdminWhatsAppPanel.tsx:250-276` | Coexistence onboarding steps UI |
| `components/AdminDashboard.tsx:35, 340, 361, 1200` | "WhatsApp" admin tab renders the panel |
| `app/test/page.tsx:256-290` | "WhatsApp Business app coexistence" section |

### 1.4 Database collections (from code; no database was read)

| Collection | Written by | Direct mode |
|---|---|---|
| `wa_coexistence_state` (`id:"current"`) | signup exchange, coexistence actions, `markWebhookHandshake` | Token ciphertext, IDs and onboarding fields are not needed. `webhookHandshakeAt` is still useful |
| `wa_webhook_events` (unique `key`) | webhook route | **Keep** (duplicate protection) |
| `ai_wa_messages` | inbound, deliver, statuses, history, echoes | **Keep**. Holds customer message text (personal data) |
| `wa_contacts` | contact sync (Coex only) | Not populated in direct mode |
| `ai_sessions.humanTakeoverUntil` | echoes (Coex only) | Never set in direct mode (no Business-app echoes) |
| `ai_messages`, `ai_suppression`, consent records | inbound, followups | Keep |
| `ai_audit` (`wa_coexistence_*`) | coexistence actions | Not used in direct mode |

### 1.5 Environment variables (names only)

| Variable | Read in | Direct mode |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | cloud.ts, integrations, selftest, registry | **Required**: System User token (business-owned) |
| `WHATSAPP_PHONE_NUMBER_ID` | cloud.ts, integrations, selftest, registry | **Required** |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | cloud.ts, integrations, selftest, registry | **Required** |
| `META_APP_ID` | coexistence.ts, exchange route, coexistence-actions, health, integrations | Required for the app-subscription check. `.env.example:199` pre-fills the production ID |
| `META_APP_SECRET` | webhook route, cloud.ts, coexistence, integrations | **Required** (signature) |
| `META_WEBHOOK_APP_SECRET` | webhook route, cloud.ts, integrations | Optional override |
| `META_WEBHOOK_VERIFY_TOKEN` | webhook route, health, integrations | **Required** |
| `META_GRAPH_API_VERSION` | cloud.ts, coexistence, actions, exchange | Optional (default `v26.0`) |
| `WHATSAPP_FOLLOWUP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE` | followups, cloud.ts | Optional |
| `WHATSAPP_OUTBOUND_ENABLED` | coexistence.ts (`outboundAllowed`) | Required to send |
| `WHATSAPP_COEXISTENCE_ENABLED` | coexistence.ts | **ES/Coex.** Currently also required for any send |
| `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED` | coexistence.ts | **Coex.** Currently the production send approval |
| `WHATSAPP_COEXISTENCE_TEST_NUMBER` | coexistence.ts | **Coex.** Currently the test-mode send condition |
| `META_CONFIG_ID` | coexistence.ts, health, integrations | **ES only** |
| `AUTH_SECRET` | token encryption | Not needed for WhatsApp in direct mode (still needed for sign-in) |
| `MARINA_ISOLATED_TEST` | coexistence.ts, isolated-env | Keep |

### 1.6 Scripts, docs and templates

- `scripts/check-whatsapp-coexistence.ts`: 102 unit checks, mostly ES/Coex.
- `scripts/isolated-env.mjs`: forces the three WhatsApp flags to `false`. Accepts only the names in `.env.isolated-test.example`, which lists `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID` and `WHATSAPP_COEXISTENCE_TEST_NUMBER`, **but not `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` or `WHATSAPP_BUSINESS_ACCOUNT_ID`**.
- `scripts/gen-env-docs.ts`, `docs/phase2/WHATSAPP_COEXISTENCE_SETUP.md`, `docs/phase2/WHATSAPP_CLIENT_ONBOARDING_GUIDE.md`, `reports/phase2/META_TEST_APP_REQUIREMENTS.md`: all written for ES/Coex.

---

## 2. Can the current implementation support direct Cloud API credentials?

**Partly.** The read, webhook and send *mechanics* already work with direct credentials. The *permission and status layers* are tied to Coexistence.

| Credential | Supported today? | Evidence | Gap |
|---|---|---|---|
| WABA ID | **Yes**, via `WHATSAPP_BUSINESS_ACCOUNT_ID` (`cloud.ts:15`) | P13 | Not used to filter webhooks (§4.4) |
| Phone Number ID | **Yes**, via `WHATSAPP_PHONE_NUMBER_ID` (`cloud.ts:14`) | P13 | Not used to filter webhooks (P10) |
| Access token | **Yes.** `WHATSAPP_ACCESS_TOKEN` takes precedence over the stored signup token (`cloud.ts:16`) | P13 (`source=env`) | Silent fallback to a stored signup token if the env var is empty (`cloud.ts:17-23`) |
| Meta App ID | **Partly.** Used for app subscription reads | — | Falls back to the hard-coded production ID outside isolated mode (P18) |
| App secret | **Yes.** `META_WEBHOOK_APP_SECRET` → `META_APP_SECRET` (`webhook/route.ts:48`) | P4–P7 | — |
| Webhook verify token | **Yes.** `META_WEBHOOK_VERIFY_TOKEN` | P1–P3 | — |
| Graph API config | **Yes.** `META_GRAPH_API_VERSION`, validated `vNN.N`, default `v26.0` (`coexistence.ts:126-129`) | unit tests | `DEFAULT_GRAPH_API_VERSION` lives in the coexistence module |

### 2.1 What works with direct credentials as-is

- Health check `pingWhatsAppCloud`: reads the phone number, WABA, `subscribed_apps` and templates.
- Webhook GET verification and POST signature verification.
- Parsing and storing inbound `messages`, delivery `statuses`, opt-out/opt-in handling, AI draft generation.
- `postMessage`, text and template payloads.

### 2.2 Coexistence assumptions that do not hold in direct mode

- Human takeover depends on `smb_message_echoes`. A number on the direct Cloud API (not coexistence) produces no Business-app echoes, so staff replies are not detected. Staff would need a separate inbox.
- `wa_contacts` and history sync do not exist in direct mode.

### 2.3 Blocking coupling: sending is gated by coexistence flags (confirmed: P14, P15)

`sendGate` (`cloud.ts:132`) → `outboundAllowed` (`coexistence.ts:903-909`) requires:
- `WHATSAPP_COEXISTENCE_ENABLED=true` **and** `WHATSAPP_OUTBOUND_ENABLED=true`, **and either**
  - `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED=true`, **or**
  - a business number equal to `WHATSAPP_COEXISTENCE_TEST_NUMBER`.

In direct mode:
- With `WHATSAPP_OUTBOUND_ENABLED` alone, sending is refused (P14).
- In test mode, the business number comes from `state.displayNumber`, which only the Coexistence verify step writes. With direct credentials it is empty, so test-mode sending is refused (P15).
- `followups.ts:165` never passes `businessNumber`, so template follow-ups can only send under the production approval flag.

The only way to send in direct mode today is to set the flag named "production *onboarding* approved", which approves the wrong thing. **This is the main code change needed.**

---

## 3. Business-number constraint (decision needed; not a code issue)

- The code describes `917457099540` as the "live Marina Muse WhatsApp Business **app** number" (`coexistence.ts:4`).
- Under a direct (non-coexistence) Cloud API registration, a number is generally used through the API instead of the WhatsApp Business app. Coexistence is the Meta mechanism for using both.
- So "direct Cloud API **on the current business number**" means either:
  - **(a)** moving the number off the Business app, with app history and app-based staff replies affected, or
  - **(b)** a new dedicated number for the Cloud API.
- **Please confirm the current Meta policy for your number before deciding.** This audit did not query Meta. The code currently blocks the live number in every Graph path and as a send recipient, and must keep doing so until the client approves the number plan in writing.

Business-owned direct integration (own app, own WABA, System User token) does **not** require Tech Provider status. Tech Provider status applies to Embedded Signup for onboarding *other* businesses.

---

## 4. Webhook implementation audit

| Area | Finding | Evidence | Rating |
|---|---|---|---|
| **GET verification** | `hub.mode === "subscribe"`, constant-time compare (`timingSafeEqual` after a length check), echoes `hub.challenge` as `text/plain`. 503 if the token is unset, 403 otherwise. Records `webhookHandshakeAt` (best-effort) | `coexistence.ts:573-589`, `route.ts:33-44`. P1–P3. 10 Nov W1–W3 | **Adequate** |
| **POST signature** | HMAC-SHA256 over the raw body text, `sha256=` prefix required, constant-time compare. Checked **before** JSON parse. Placeholder secrets count as unset (503) | `coexistence.ts:591-603`, `route.ts:47-50`. P4–P8. 10 Nov W4–W7 | **Adequate** |
| Signature over decoded text | `req.text()` decodes UTF-8 and HMAC re-encodes it. This matches byte-for-byte for valid UTF-8 (P8 passes with non-ASCII), but would differ for a BOM or invalid sequences. Hashing `arrayBuffer()` bytes is stricter | `route.ts:47` | Low |
| **Invalid signature rejection** | Missing, wrong-secret or altered-body requests get 401 with a generic message. No secret is echoed | P5, P6. 10 Nov W4–W6 | **Adequate** |
| **Inbound processing** | `messages` → `normaliseWebhook` → `planEvents` → `recordWebhookKey` → `draftInbound`. Text only (other types are ignored, not drafted). Opt-out/opt-in honoured. Statuses applied forward-only | `route.ts:59-79`, `inbound.ts`. P9, P11. 10 Nov W8 | **Adequate** |
| No WABA / phone-number filter | Any validly signed event for **any** WABA or phone number subscribed to the same Meta app is processed and drafted. If outbound were on, the reply would go from the configured number to someone who wrote to a different number | **P10** (`action=draft` for a foreign `phone_number_id`) | **Medium** (must fix before direct go-live) |
| **Duplicate handling** | Two layers: an in-memory `Set` (per process, max 5000, lost on restart) and the `wa_webhook_events` unique index | `route.ts:17-31`, `store.ts:173-191`. P9 | Adequate in normal operation |
| Duplicate store fails open | `ensureIndex` swallows errors (`store.ts:14`). `recordWebhookKey` returns `duplicate:false` on any non-11000 error (`store.ts:189`). If the DB or index is unavailable, duplicates across processes or restarts are reprocessed | code | Low–Medium |
| Mark-before-process | `planEvents` marks a key seen before processing. A failed `draftInbound` is not retried in the same process | `coexistence.ts:755-758` | Low (at-most-once by design) |
| **Error handling** | JSON parse → 400. Inbound, coexistence-update and status errors are caught. The route still returns 200, so Meta does not retry. DB outages therefore **silently drop** events | `route.ts:52-79`, `inbound.ts:85-88` | Medium (design choice; document or change) |
| No body-size or rate limit on POST | HMAC is computed on any body size before rejection | `route.ts:47` | Low |
| **Safe logging** | Only fixed labels plus `err.message`. No payloads, tokens or numbers logged. Graph errors pass through `redactSecrets` (tokens, keys, `EAA…`). Signup routes log outcome labels only | `route.ts:74`, `inbound.ts:86`, `http.ts:72-83` | **Adequate** |
| Personal data at rest | Customer message text and phone numbers are stored in `ai_wa_messages` and `ai_messages`. No retention rule seen | `inbound.ts:61` | Note for privacy policy |
| **Prod/test separation** | `isolated-env.mjs` blanks all 75 integration variables, forces outbound/onboarding/coexistence off, generates synthetic secrets, sets `MARINA_ISOLATED_TEST=1` (no fallback app). Mongo guard refuses non-local hosts outside production | `isolated-env.mjs`. 10 Nov WA1–WA4 | **Strong for the isolated launcher** |
| Separation gaps | **(1)** A plain `npm run dev` with `.env.local` loads whatever `WHATSAPP_*` values are there. There is no "refuse real sends outside production" guard like the PayPal and ShipGlobal ones. **(2)** Outside isolated mode, the hard-coded production app and config IDs are the fallback. **(3)** The isolated launcher cannot accept direct test credentials (§1.6) | P18, `.env.isolated-test.example` | Medium |

---

## 5. Existing test evidence reviewed (not re-run unless stated)

| Evidence | Date | Result | Relevance |
|---|---|---|---|
| `reports/evidence/phase2/webhook-tests-20261110T1633Z.log` | 10 Nov | WhatsApp W1–W8 **8/8 pass** against a localhost isolated server with synthetic secrets | GET/POST security and inbound storage, with outbound withheld |
| `reports/evidence/phase2/whatsapp-isolation-tests-20261110T1638Z.log` | 10 Nov | **5/5 pass**: no app ID exposed in isolated mode, Meta never called | Test/production separation |
| `reports/evidence/phase2/EVIDENCE_NOTES.md` | 10 Nov | Explains superseded logs (W8 earlier false failure) | Context |
| `reports/evidence/phase2/check-whatsapp-20261110T1642Z.log`, `check-phase2-20261110T1642Z.log` | 10 Nov | Unit suites | Re-run today (see Results) |

None of this evidence involved a real Meta app, a real WABA, real webhook delivery from Meta, or any sent message. **Live Meta integration has not been verified at any point.**

---

## 6. Summary of findings

| # | Finding | Severity | Change ref (Change Plan) |
|---|---|---|---|
| F1 | Sending is gated by coexistence flags; direct mode cannot send without misusing the "onboarding approved" flag (P14, P15) | **High** (functional blocker) | C1, C2 |
| F2 | Webhook does not filter by configured WABA / phone number ID (P10) | **Medium** (security/correctness) | C4 |
| F3 | Silent fallback to the stored Embedded Signup token and to the hard-coded production app/config IDs (P18) | Medium | C3, C9 |
| F4 | No guard against real WhatsApp sends from a non-production server | Medium | C6 |
| F5 | Isolated launcher cannot accept direct test credentials | Medium (test blocker) | C10 |
| F6 | Webhook returns 200 when DB processing fails; duplicate store fails open | Low–Medium | C5 |
| F7 | Signature computed over decoded text instead of raw bytes; no body-size limit | Low | C4 |
| F8 | ES/Coex routes, admin UI and FB SDK remain reachable and are presented as the onboarding path | Low (risk of an accidental ES/Coex start) | C7, C8 |
| F9 | Health marks "Business app coexistence" as required for Agent 4, so direct mode would show as degraded | Low (reporting) | C8 |
| F10 | Number plan (current business number vs a new number) is undecided; affects Business-app use | **Decision** | §3 |
