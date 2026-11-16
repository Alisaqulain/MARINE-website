# Marina Muse International — G4 Provider Test Requirements and Approval Plan

**Prepared for:** Ahmad · **Prepared by:** Ali · **Date:** 15 November 2026 · **Status: DOCUMENTATION ONLY**
**Source of truth:** the current working tree (HEAD `8fe2163` plus the uncommitted Phase 2 changes), read on 15 Nov. File and line references point to that tree.

---

## 1. Authorization boundary and current status

| Item | Status |
|---|---|
| Authorized now | Preparing G4 test requirements and this documentation **only** |
| Not authorized | External API calls; credential use; provider configuration changes; webhook registration; public endpoints; messages, calls, emails, payments; deployment; commits or pushes; production changes; agent activation |
| G4 execution | **Not started.** No provider test has been run. G4 is **not complete**. |
| Already done locally (G3, offline or mocked) | Fetch-spy tests prove the Meta checks use only 4 GET requests (G4M1–G4M4). Provider error handling (400/401/403/404/429/5xx/timeout) is tested with mocked responses in `lib/ai/provider-selftest.ts`. `reports/evidence/phase2/g4-provider-checks.mjs` reports every provider as BLOCKED until test credentials exist. |
| Agents | All four are off by default (fail-closed switch, `lib/ai/agents.ts`). The isolated launcher leaves `AI_AGENTS_ENABLED` empty unless a tester lists an agent in `.env.isolated-test.local`. |

---

## 2. Architecture and integration inventory (current code)

| Provider | Client code | Shared HTTP wrapper | Credential source in G4 |
|---|---|---|---|
| Gemini | `lib/ai/gemini.ts` (`generate`, `pingGemini`); usage logging in `lib/ai/usage.ts` | `lib/ai/http.ts` `requestJson` (timeouts, redaction) | `GEMINI_API_KEY`, set by the launcher **only** from `GEMINI_TEST_API_KEY` when `GEMINI_TEST_PROJECT_CONFIRMED=marina-muse-gemini-testing` (`scripts/isolated-env.mjs`) |
| GA4 Data API | `lib/google/analytics.ts` (`runReport`, `ga4Summary`, `pingGa4`) | same | `GOOGLE_SERVICE_ACCOUNT_JSON` (or email + private key), `GA4_PROPERTY_ID` |
| Search Console | `lib/google/search-console.ts` (`searchAnalytics`, `searchConsoleSummary`, `pingSearchConsole`) | same | same service account, `SEARCH_CONSOLE_SITE_URL` |
| Google OAuth | `lib/google/auth.ts` (`signJwt`, `googleAccessToken`): JWT bearer grant, scopes `analytics.readonly` and `webmasters.readonly` only | same | service account private key (signs locally) |
| Meta WhatsApp Cloud API | `lib/whatsapp/cloud.ts` (`pingWhatsAppCloud`, `postMessage`); `lib/whatsapp/mode.ts` (direct mode, guards); `lib/whatsapp/fingerprints.ts`; webhook route `app/api/meta/whatsapp/webhook/route.ts` | same (`postMessage` uses `retries: 0`) | `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` = `WHATSAPP_TEST_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` = `WHATSAPP_TEST_BUSINESS_ACCOUNT_ID` |
| Vapi | `lib/ai/vapi.ts` (`vapiGet`, `getAssistant`, `syncAssistant`, `createAssistant`, `startOutboundCall`); health in `lib/ai/integrations.ts`; webhook `app/api/ai/voice/webhook/route.ts` → `lib/ai/voice.ts` | same | `VAPI_API_KEY`, `VAPI_ASSISTANT_ID` (both blank in the isolated launcher today) |

**Entry points that can call a provider**
- `/test` and `lib/ai/health.ts`: health checks run whenever `/test` is loaded with credentials present.
- `/api/ai/chat`: Gemini.
- WhatsApp webhook: Gemini reply, then send.
- Voice webhook: Gemini call summary.
- `/api/ai/report/daily`: GA4, Search Console, Gemini, SMTP.
- `/api/admin/ai/actions`:
  - `vapi_sync`: Vapi write
  - `approve_callback`: Vapi call
  - `generate_content`: Gemini with Search grounding
  - `wa_resend`: Meta send
- `/api/ai/jobs`: follow-ups (SMTP, Meta template sends).

All of these are gated by the fail-closed agent switch except `/test` health and the webhook signature checks. In G4 the agents stay off unless a single agent is explicitly listed for a specific scenario, and only after approval.

---

## 3. Provider-by-provider test requirements

### 3.1 Google Gemini

| Operation (current code) | HTTP | Endpoint | Invoked by | Effect |
|---|---|---|---|---|
| List models (key check) | GET | `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1` | `pingGemini` → `pingGeminiLive` (`lib/ai/gemini.ts:244`), via `/test` | Read |
| Get model | GET | `…/v1beta/models/{model}` | `pingGeminiLive` (`:277`) | Read |
| Generate (one-word health check) | POST | `…/v1beta/models/{model}:generateContent` | `pingGeminiLive` → `generate` (`:157`) | Read-only generation; consumes quota |
| Generate (chat or WhatsApp reply) | POST | same | `handleCustomerMessage` → `groundedReply` → `generateFor` (`lib/ai/crm.ts`) | Generation; logs to `ai_usage` in the local test DB |
| Generate (voice call summary, JSON) | POST | same | `analyseCall` (`lib/ai/voice.ts`) | Generation |
| Generate with Google Search grounding (`tools: [{google_search}]`) | POST | same | growth drafts and research (`lib/ai/growth-agent.ts`) | Generation plus Google Search grounding. **Not proposed** (see below) |
| 22 conversation scenarios | POST | same, called directly by the harness | `reports/evidence/text-tests/texttest-v3.mts` (`:156`), batches `v3-batch-1..3.json` | Generation |

- **Proposed for G4:**
  1. One key check: `models.list`, `models.get` and one one-word `generateContent` per configured model.
  2. The 22 scenarios with at most 56 `generateContent` requests, stopping on the first HTTP 429.
  3. Optional: 3–5 chat replies through `/api/ai/chat` on the isolated server, with only `AI_AGENTS_ENABLED=chat` in `.env.isolated-test.local`.
- **Not proposed:** Google Search grounding (growth drafts), any paid model or tier, any production key.
- **Models:** the configured chain from `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` (inherited by the launcher from `.env.local`; names only, values not read here). Code defaults are `gemini-3.5-flash` → `gemini-3.5-flash-lite` (`lib/ai/gemini.ts`). Ahmad to confirm the model names enabled in the test project.
- **Credentials:** a new API key created in a dedicated Google AI Studio or Cloud project named for testing (`marina-muse-gemini-testing`), **billing disabled**, restricted to the Generative Language API. Delivered only as `GEMINI_TEST_API_KEY` in `.env.isolated-test.local`.
- **Data sent to Gemini:** system rules, catalogue facts (product names, prices, stock, MOQ), synthetic test messages. No customer data.
- **Without a real call:** fallback chain, 404/429/503/timeout handling, cooldown and key-error classification are already tested with mocked fetch (`provider-selftest.ts`). Only real quota, latency and model behaviour need the key.
- **Harness caution:** `texttest-v3.mts --snapshot` fetches the public production catalogue endpoint. **Not proposed**; the existing `catalogue-snapshot.json` is used instead.
- **Cleanup:** after the tests, revoke or delete the test key in the testing project; the `ai_usage` and `ai_messages` rows in the local test DB may stay (synthetic).

### 3.2 Google Analytics 4 (Data API, read-only)

| Operation | HTTP | Endpoint | Invoked by | Effect |
|---|---|---|---|---|
| OAuth token (JWT bearer) | POST | `https://oauth2.googleapis.com/token` | `googleAccessToken(SCOPES.analytics)` (`lib/google/auth.ts:63`) | Issues a 1-hour token; no data change |
| Run report | POST (read API) | `https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROPERTY_ID}:runReport` | `runReport` (`lib/google/analytics.ts:28`) via `pingGa4` (7 days, metric `sessions`, limit 1) and `ga4Summary` (28 days, channels and landing pages) | Read aggregated metrics |

- **Scope:** `https://www.googleapis.com/auth/analytics.readonly` only (`lib/google/auth.ts:9`).
- **Minimum role:** the service account added as **Viewer** on the single GA4 property. No Cloud IAM roles; no Editor, Marketer or Administrator.
- **Data read:** aggregated sessions, users, key events, purchases and revenue by channel and landing page. No user-level or personal data.
- **Excluded:** the Measurement Protocol (`https://www.google-analytics.com/mp/collect`, `lib/google/analytics.ts:101`).
  - It is write-side: purchase events.
  - `validateMeasurementProtocol` on `/test` calls the **debug** endpoint with `GA4_API_SECRET`.
  - `GA4_API_SECRET` must stay **blank** in G4, so neither call can happen. No property, stream or configuration changes.
- **Cleanup:** remove the service account's Viewer access, or delete the JSON key, after the tests.

### 3.3 Google Search Console (read-only)

| Operation | HTTP | Endpoint | Invoked by | Effect |
|---|---|---|---|---|
| OAuth token | POST | `https://oauth2.googleapis.com/token` | `googleAccessToken(SCOPES.searchConsole)` | Token only |
| Site permission | GET | `https://www.googleapis.com/webmasters/v3/sites/{SEARCH_CONSOLE_SITE_URL}` | `pingSearchConsole` (`lib/google/search-console.ts:59`) | Read |
| Search analytics query | POST (read API) | `https://www.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query` | `searchAnalytics` (`:29`) via `pingSearchConsole` (7 days, `query`, 5 rows) and `searchConsoleSummary` (28 days, `query` 500 rows and `page` 50 rows) | Read aggregated clicks, impressions, CTR, position |

- **Scope:** `https://www.googleapis.com/auth/webmasters.readonly` only.
- **Minimum role:** **Restricted** user on the one Marina Muse property.
- **Excluded:** sitemap submission, URL inspection, indexing requests, property or user changes. None of these exist in the code.
- **Data:** aggregated search queries and page URLs. No personal data.
- **Cleanup:** remove the service account user from the property after the tests.

### 3.4 Meta WhatsApp Cloud API (direct mode)

**Read-only verification (proposed)**

| Operation | HTTP | Endpoint (Graph `v26.0` default) | Invoked by | Effect |
|---|---|---|---|---|
| Phone number details | GET | `https://graph.facebook.com/v26.0/{WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status` | `pingWhatsAppCloud` (`lib/whatsapp/cloud.ts:72`) | Read |
| WABA details | GET | `…/{WHATSAPP_BUSINESS_ACCOUNT_ID}?fields=name,account_review_status` | same (`:97`) | Read |
| Subscribed apps | GET | `…/{WABA}/subscribed_apps` | same (`:98`) | Read |
| Message templates | GET | `…/{WABA}/message_templates?fields=name,status,language&limit=100` | same (`:99`) | Read |

These four calls are proven by test G4M1–G4M2 to be the only Meta requests the check makes, all GET.

**Inbound only (needs G4-B):** Meta's verification `GET /api/meta/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`, and signed `POST` deliveries (`X-Hub-Signature-256`, HMAC with `META_APP_SECRET`) to the isolated server.

**Message operations (NOT proposed; each needs its own one-time approval):** `POST …/{WHATSAPP_PHONE_NUMBER_ID}/messages`, from `postMessage` (`lib/whatsapp/cloud.ts:167`) via inbound replies, template follow-ups and the admin resend. Outside production it is refused before any request, unless the isolated launcher runs in direct mode with the exact test IDs, `WHATSAPP_OUTBOUND_ENABLED=true` (forced false today) and an allow-listed tester.

**Never called in direct mode:** `POST /{waba}/subscribed_apps` and the other Embedded Signup and Coexistence calls (`lib/whatsapp/coexistence-actions.ts`). The routes answer 410 first.

- **Resources:** a **separate** Meta developer app (Business type, WhatsApp product), a **test** WABA, the Meta-provided **test phone number**, and a System User token scoped to that test WABA.
- **Permissions:** `whatsapp_business_management` (WABA, subscriptions, templates) and `whatsapp_business_messaging` (phone number; and `/messages` only if a send is ever approved).
- **Webhook subscription (later, G4-B):** field `messages` only. Not configured now.
- **Never used:**
  - the live Marina Muse number `+91 74570 99540` (refused in `sendGate`, `postMessage`, `testRecipients` and the launcher);
  - the production app, WABA, phone number or token;
  - real customers or conversations.
- **Without a real call:** signature, handshake, ID filtering, 413, idempotency, delivery classification, recovery and fingerprints are already covered offline (182 checks) and over local HTTP (25/25, 5/5, 19/19).
- **Precondition:** production fingerprint hashes populated (section 9). Until then the launcher refuses any run that supplies Meta identifiers.
- **Cleanup:** revoke the System User token. Remove the test app's webhook (if G4-B ran). The test WABA and number may stay in the test business portfolio or be deleted.

### 3.5 Vapi Voice

**Read-only inspection (proposed only with an approved key; see the alternative below)**

| Operation | HTTP | Endpoint | Invoked by | Effect |
|---|---|---|---|---|
| Get assistant | GET | `https://api.vapi.ai/assistant/{VAPI_ASSISTANT_ID}` | `getAssistant` (`lib/ai/vapi.ts:271`) and `/test` | Read |
| List assistants | GET | `…/assistant?limit=100` | `/test` health (`lib/ai/integrations.ts:181`) | Read (returns **every** assistant in the organization, including Riley) |
| List phone numbers | GET | `…/phone-number?limit=100` | same (`:182`) | Read |
| List credentials | GET | `…/credential?limit=100` | same (`:183`) | Read (SIP credentials) |

**Writes and calls (NOT proposed):**
- `PATCH /assistant/{id}` (`syncAssistant`, admin `vapi_sync`)
- `POST /assistant` (`createAssistant`)
- `POST /call` (`startOutboundCall`, admin `approve_callback`; billable)

All three are blocked by the voice agent switch and, for calls, by `VAPI_OUTBOUND_ENABLED=false` (forced by the launcher).

**Key limitation (from `reports/phase2/VAPI_PERMISSION_ASSESSMENT.md`):** a Vapi private key **cannot be restricted** and has full access to its organization.

**Recommended path (no key):** Ahmad exports the **development** assistant's JSON from the dashboard, with API keys, webhook secret values and customer or call data removed. It is compared offline with `desiredAssistant()` on model, voice, tools, server URL and first message.

**If a key is approved instead:** create it in a **separate Vapi organization** that contains only the development assistant, no phone numbers, no SIP credentials and no credit. **Riley lives in the main organization and must never be reachable by the key.** Run `GET /assistant/{dev id}` only; do **not** load `/test`, because it lists every assistant, number and credential.

- **Webhook delivery** (`POST /api/ai/voice/webhook` from Vapi) needs G4-B and a test call, both separately approved. **Not proposed.**
- **Cleanup:** delete the development key immediately after the GET. Confirm a 401 with the deleted key.

---

## 4. Required test resources and permissions

| Resource | Owner | Must be | Delivered as |
|---|---|---|---|
| Gemini testing project + API key | Ahmad | Billing disabled; Generative Language API only | `GEMINI_TEST_API_KEY`, `GEMINI_TEST_PROJECT_CONFIRMED=marina-muse-gemini-testing` |
| Google Cloud project + service account `marina-muse-growth-readonly` | Ahmad | Analytics Data API + Search Console API enabled; **no** IAM roles; JSON key | `GOOGLE_SERVICE_ACCOUNT_JSON` |
| GA4 property access | Ahmad | Service account = **Viewer** | `GA4_PROPERTY_ID` |
| Search Console access | Ahmad | Service account = **Restricted** user | `SEARCH_CONSOLE_SITE_URL` (`sc-domain:…` or URL prefix) |
| Meta test app | Ahmad / Meta | Separate Business app, WhatsApp product, permissions in 3.4 | `META_APP_ID`, `META_APP_SECRET` |
| Meta test WABA + test number + System User token | Ahmad / Meta | Test only; token scoped to the test WABA | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` = `WHATSAPP_TEST_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` = `WHATSAPP_TEST_BUSINESS_ACCOUNT_ID` |
| Production fingerprint hashes | Ahmad | Section 9 format | committed to `config/whatsapp-production-fingerprints.json` after review |
| Vapi | Ahmad | Dashboard export (recommended), or key in a separate dev organization | file, or `VAPI_API_KEY` + `VAPI_ASSISTANT_ID` |

**Delivery rule:** secrets go only through the agreed secure channel and into `.env.isolated-test.local` (git-ignored, owner-only access set by the launcher). Never by chat or email. Production credentials and live customer data are **not needed** for any G4 test.

---

## 5. Test scenarios and expected results

"Offline" means the scenario is already covered or coverable without a real call.

| # | Provider | Scenario | Expected result | Offline? |
|---|---|---|---|---|
| GM1 | Gemini | Valid test key, key check | `models.list` 200; each model listed; one-word reply; `/test` card "connected" | No |
| GM2 | Gemini | 22 scenarios | Each pass rule in `v3-batch-*.json` met or the failure recorded; ≤56 requests | No |
| GM3 | Gemini | Invalid or revoked key | 400 `API_KEY_INVALID` → "auth" failure; no fallback attempt; chat answers from the catalogue | Yes (mocked) |
| GM4 | Gemini | API disabled or billing-required model | 403 `SERVICE_DISABLED`/`BILLING_DISABLED` → "activation"; next model tried | Yes |
| GM5 | Gemini | Rate limit | 429 with RetryInfo > 60 s → model in cooldown, no further request; stop the scenario run | Yes |
| GM6 | Gemini | Unknown model | 404 → next model in chain | Yes |
| GM7 | Gemini | Timeout or 503 | Fallback model; total budget 30 s | Yes |
| GM8 | Gemini | Ungrounded reply (invented price) | `replyIsGrounded` rejects; catalogue text sent; `ai_audit` "grounding_rejected" | Yes |
| GA1 | GA4 | Valid account and property | Token issued; `runReport` 200; "Read N sessions" | No |
| GA2 | GA4 | Malformed key JSON | "not valid JSON…" before any call | Yes |
| GA3 | GA4 | Wrong private key | Token request 400/401 → auth failure | No (real token endpoint) |
| GA4 | GA4 | No Viewer access | `runReport` 403 → "add … as Viewer" | No |
| GA5 | GA4 | Invalid property id | Local validation fails; `ga4Configured` false; no call | Yes |
| GA6 | GA4 | Timeout or 5xx | Error reported; no retry storm (1 retry max) | Yes |
| GS1 | Search Console | Restricted access | `sites/{site}` 200 with `permissionLevel`; query 200 | No |
| GS2 | Search Console | Wrong site format | 403/404 → configuration error | No |
| GS3 | Search Console | No access | 403 | No |
| WA1 | Meta | Valid test token and IDs, fingerprints populated | 4 GETs 200; masked number; template list | No |
| WA2 | Meta | Expired or invalid token | 401 / OAuth error 190 → "Meta rejected the access token" | Yes (mocked) |
| WA3 | Meta | Token without the WABA permission | 403 or 200 with an error on the WABA calls | No |
| WA4 | Meta | Production identifier supplied by mistake | Launcher **REFUSED**, no process starts; runtime refuses credentials | Yes (F tests) |
| WA5 | Meta | Empty fingerprint lists | Launcher refuses any Meta-related run | Yes |
| WA6 | Meta | Malformed IDs (non-numeric) | Launcher "must be a numeric Meta id" | Yes |
| WA7 | Meta | Rate limit or 5xx on GET | Reported; 1 retry for GET only | Yes |
| WA8 | Meta | Send attempted outside production | Refused before any request | Yes |
| VP1 | Vapi | Export compared offline | Drift list empty or itemised | Yes (no API) |
| VP2 | Vapi | Dev key `GET /assistant/{dev id}` | 200; drift list | No |
| VP3 | Vapi | Placeholder or non-UUID id | Refused locally; never sent | Yes |
| VP4 | Vapi | Deleted key | 401 | No |
| VP5 | Vapi | Webhook with wrong or missing secret | 401 | Yes (13/13 local) |

---

## 6. Data access and modification matrix

| Provider | Data read | Data written at the provider | Data written locally (test DB only) |
|---|---|---|---|
| Gemini | — (prompts sent: rules, catalogue facts, synthetic messages) | None; quota consumed in the test project | `ai_usage`, `ai_messages`, `ai_sessions` (synthetic) |
| GA4 | Aggregated metrics of one property | None | none (health history `ai_health_runs` if `/test` is used) |
| Search Console | Aggregated query and page metrics | None | same |
| Meta (read-only) | Test number details, test WABA name and status, subscriptions, template names and status | None | `wa_coexistence_state` handshake timestamp only if G4-B runs |
| Vapi (export) | Dev assistant configuration | None | none |
| Vapi (key) | Dev assistant configuration | None | none |

---

## 7. Isolation and safety controls (implemented)

1. **Isolated launcher** (`scripts/isolated-env.mjs`):
   - blanks every registry variable;
   - loads credentials only from `.env.isolated-test.local`, accepting only the names in `.env.isolated-test.example`;
   - generates per-session secrets;
   - forces `NODE_ENV=development`, PayPal sandbox, outbound WhatsApp and Vapi off, no SMTP, `WHATSAPP_INTEGRATION_MODE=direct`, `MARINA_ISOLATED_TEST=1`.
2. **Meta guards:** the launcher refuses known production IDs, the live number, mismatched test IDs, empty or invalid fingerprint configuration for Meta-related runs, and fingerprint matches. At runtime, outside production, `directConfig()` and `sendEnvironmentDecision()` refuse the same before any fetch.
3. **Agent switch:** all four agents off unless listed in `AI_AGENTS_ENABLED`. In production they also need `AI_AGENTS_PRODUCTION_APPROVED`.
4. **Local database only:** `lib/env-mongo-uri.ts` refuses non-local hosts outside production. The test DB was verified 13/13.
5. **Redaction:** provider error text passes through `redactSecrets`. `/test` shows set/missing only.
6. **Evidence:** every G4 run would log provider, operation, HTTP status and pass/fail only, to `reports/evidence/phase2/g4/`.

---

## 8. Product feed date clarification

**What the code does today**
- `buildMerchantFeed()` (`lib/ai/growth.ts:16-29`) maps each retail product to a `FeedItem`:
  - `availability: "preorder"` when `product.stock === "made-to-order"`
  - `"out_of_stock"` when `quantity === 0`
  - otherwise `"in_stock"`
- `FeedItem` (`lib/ai/feed.ts:1-10`) has **no date field**. `googleMerchantXml()` (`lib/ai/feed.ts:70-106`) emits `g:availability` but **never emits `g:availability_date`**.
- The feed is served at `/feeds/google.xml` (`app/feeds/google.xml/route.ts`) for a Merchant Center scheduled fetch. Nothing is uploaded by the code.
- The "date" requirement comes from the local feed check (`reports/evidence/growth/dev-feed-check.mjs:22-23`): "Pre-order/backorder items carry availability_date". It fails because the code emits none.

**The three products** (bundled catalogue, `lib/products.ts`, all `stock: "made-to-order"`)

| SKU | Product | Slug | Source |
|---|---|---|---|
| MM-WHL-036 | Captain's Helm 36" | `ship-wheel-36` | `lib/products.ts:533-541` |
| MM-DEC-030 | Vintage Diving Helmet | `diving-helmet-decor` | `lib/products.ts:722-730` |
| MM-CUS-001 | Custom Engraved Compass | `custom-engraved-compass` | `lib/products.ts:770-778` |

- **Meaning:** a Merchant Center `availability_date` is the date a pre-order item becomes available to ship. Google's feed specification requires it for `preorder`; the format is ISO 8601 with a time-zone offset (e.g. `2026-12-15T00:00+05:30`). **The code establishes no format, time zone or value**, because none is implemented.
- **Customer effect:** the product page shows "Made to order" (`app/product/[slug]/page.tsx:181`). Checkout does not use a date. In Google Shopping, a `preorder` item without `availability_date` is expected to be disapproved or limited by Merchant Center (provider-side rule, not verified here).

**Decision needed from Ahmad, per product:**
1. a fixed availability date;
2. a lead time (the feed would compute "feed date + N days"; time zone to confirm, the shop uses `NEXT_PUBLIC_SHOP_UTC_OFFSET`, default +05:30);
3. list as `in_stock` (made on demand within normal shipping); or
4. exclude from the feed.

**Ambiguity:** products added through the admin panel (database) could also have `made-to-order` and would be affected the same way. The three listed are the ones in the bundled catalogue and in the 10 Nov feed check. Any of options 1–2 also needs a small code change (a date field plus emission), which is a separate approval. No date has been invented or assigned.

---

## 9. Production fingerprint hash clarification

- **Why they exist:** to stop a production Meta identifier (copied by mistake into the test credentials file or a development server) from ever being used outside production, without storing the production identifiers in the repository. An accidental-misconfiguration guard, not an access control.
- **Identifier types** (`lib/whatsapp/fingerprints.ts`):
  - Meta kinds `waba`, `phone_number_id`, `app_id`, `config_id`;
  - a **separate** `recipients` list for protected phone numbers (for example the live business number).
- **Canonicalization:** the value must be a string. Trim ASCII whitespace (space, tab, CR, LF). It must then be digits only (`^[0-9]+$`); leading zeros are kept; empty is rejected.
- **Hash input and output:** SHA-256 of `<kind>:<id>` (e.g. `waba:<digits>`, `recipient:<digits without +>`), lowercase hex, 64 characters.
- **File format** (`config/whatsapp-production-fingerprints.json`, committed with empty lists today):
  ```json
  { "version": 1, "note": "…", "ids": { "waba": ["<64 hex>"], "phone_number_id": ["<64 hex>"], "app_id": ["<64 hex>"], "config_id": ["<64 hex>"] }, "recipients": ["<64 hex>"] }
  ```
  Unknown keys, a wrong version, malformed hashes or unreadable JSON are rejected.
- **Enforcement:**
  - The launcher (`scripts/isolated-env.mjs`) validates the file on every run.
  - Runs that supply any Meta or WhatsApp identifier, token or tester number require non-empty `waba`, `phone_number_id` and `app_id` lists (`config_id` only if `META_CONFIG_ID` is supplied), and `recipients` if testers are supplied.
  - It hashes every supplied identifier and refuses a match, with the variable name only.
  - At runtime outside production, `directConfig()` and `sendEnvironmentDecision()` in `lib/whatsapp/mode.ts` repeat the check and refuse before any network call.
  - Gemini-only runs need only a valid file (v1.1 §5.3).
  - There is no bypass flag. Tests F1–F16.
- **How Ahmad would supply them (only if later approved):**
  - Compute locally from Meta Business Manager values (not from server files), e.g. `printf '%s' 'waba:<WABA digits>' | sha256sum`.
  - Send the 64-character hex values with their kind, through the secure channel.
  - The raw identifiers are never sent.
  - Synthetic examples: `waba:100000000000011` → `4dd7b00c…ac78d`; `recipient:919800000000` → `18758268…62de7` (full vectors in v1.1 §5.6).
- **Sensitivity:**
  - Not secrets, but not public either: a 15-digit identifier space can be enumerated, so a hash can in principle be reversed to the identifier.
  - Keep them in the repository only after review; do not post them publicly.
  - The precautions for the identifiers themselves still apply: never put production identifiers into test files, and never use production tokens.

No real production identifier or hash was requested or generated for this document.

---

## 10. Dependencies and decisions required from Ahmad

1. Separate written G4 approval naming the exact operations in the final table (section 12).
2. Gemini: create the testing project (billing off) and key; confirm the model names; approve ≤56 scenario requests plus the key check.
3. Google: create the read-only service account; send its email first; then grant GA4 Viewer and Search Console Restricted; supply the property ID and site URL.
4. Meta: create the test app, WABA, number and token; confirm Tech Provider status is not needed for direct mode; supply production fingerprint hashes (section 9).
5. Vapi: choose a dashboard export (recommended) or a key in a separate dev organization; confirm Riley is out of reach.
6. Feed: choose one option per product (section 8).
7. G4-B (public endpoint) and any one-time test message are separate decisions, not part of this plan's proposed scope.

---

## 11. Proposed execution sequence (only after separate written G4 approval)

| Step | Action | Precondition |
|---|---|---|
| 1 | Place supplied credentials in `.env.isolated-test.local`; run `node scripts/isolated-env.mjs --check` (names only) | Credentials delivered |
| 2 | Run the offline suites again (tsc, 274/102/182) as the baseline | — |
| 3 | Gemini key check (GM1) | Step 1 |
| 4 | Gemini 22 scenarios (GM2), stopping on 429; ledger to `reports/evidence/phase2/g4/` | Step 3 passed |
| 5 | GA4 (GA1) and Search Console (GS1) through `g4-provider-checks.mjs` | Grants in place |
| 6 | Meta read-only (WA1) through `g4-provider-checks.mjs` | Fingerprints populated |
| 7 | Vapi: offline export comparison (VP1), or the single GET (VP2) | Choice made |
| 8 | Report results; cleanup (revoke keys and tokens, remove access); evidence package | — |

Each step stops on any unexpected write, side effect or production identifier.

---

## 12. Explicit approval checklist for Ahmad

| Provider | Proposed operation | Resource required | Permission | Data impact | External side effect | Requires separate approval? |
|---|---|---|---|---|---|---|
| Gemini | `GET models?pageSize=1`, `GET models/{model}`, one-word `POST :generateContent` per model | Testing project + test key, billing off | Generative Language API | Read; quota use | None beyond quota | **Yes (G4)** |
| Gemini | 22 scenarios, ≤56 `POST :generateContent` | same | same | Read; quota use | None beyond quota | **Yes (G4)** |
| Gemini | Search-grounded generation (growth drafts) | — | — | — | Google Search grounding | **Not proposed** |
| GA4 | `POST oauth2/token`; `POST properties/{id}:runReport` | Service account + Viewer | `analytics.readonly` | Read aggregated metrics | None | **Yes (G4)** |
| GA4 | Measurement Protocol (`mp/collect`, debug or live) | `GA4_API_SECRET` | write | Would send events | Yes | **Not proposed** |
| Search Console | `GET sites/{site}`; `POST searchAnalytics/query` | Service account + Restricted | `webmasters.readonly` | Read aggregated metrics | None | **Yes (G4)** |
| Meta | 4 GETs: phone number, WABA, `subscribed_apps`, `message_templates` | Test app, test WABA, test number, scoped token, fingerprints | `whatsapp_business_management`, `whatsapp_business_messaging` | Read test metadata | None | **Yes (G4)** |
| Meta | Webhook verification and signed deliveries | Public HTTPS endpoint | app webhook, field `messages` | Writes synthetic test DB rows | Inbound only | **Yes (G4-B)** |
| Meta | `POST /{phone_number_id}/messages` (one test message) | Test number + approved tester | messaging | Sends a message | **Yes** | **Yes (one-time, separate)** |
| Vapi | Offline comparison of dashboard export | Export file | none | Read | None | **Yes (G4, low risk)** |
| Vapi | `GET /assistant/{dev id}` | Dev key in separate organization | full org (cannot be restricted) | Read | None | **Yes (G4)** |
| Vapi | `PATCH /assistant`, `POST /assistant`, `POST /call`, phone/SIP changes | — | — | Writes or calls | **Yes** | **Not proposed** |
| Feed | Add `availability_date` or change availability for 3 products | Ahmad's decision | — | Code + feed output | None until Merchant Center fetches | **Yes (separate code change)** |
| Fingerprints | Commit the supplied hashes to the config file | Hashes from Ahmad | — | Repository file | None | **Yes (with G3/G4 review)** |
