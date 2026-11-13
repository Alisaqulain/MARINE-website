# Marina Muse Assistant: final pre-publishing verification

**Revision 5. 8 November 2026, 17:55 UTC (23:25 IST).** Earlier revisions: 1 at 16:50 UTC, 2 at 17:10, 3 at 17:30, 4 at 17:45. This report supersedes `docs/phase2/VAPI_PREPUBLISH_REPORT_2026-11-08.md`.

**Revision 5 changes:**
- Test isolation checked before any Gemini request (new section *Shared Website Quota and Production Customer Impact*).
- **Finding: the local environment uses the live production database**, and the Gemini key cannot be shown to be separate from the live website's quota. So **no Gemini request was sent**, and the harness now has an isolation gate.
- Earlier wording corrected: the "local" lookup and consent tests used the production database (read-only reads; the consent refusals wrote nothing).
- 1 anonymous page-view row written to production by a local screenshot is disclosed.
- Assistants, Vapi account and production endpoint re-checked read-only at 17:51 UTC.
- No Gemini, Vapi or production changes.

Status of the assistant: **saved, unconnected and unused; awaiting client review.**

**Overall: not complete.** Every permitted task that doesn't need Gemini has been done and evidenced. **All 22 conversation tests are BLOCKED**, for two reasons: test isolation from the live website isn't confirmed (next section), and the Gemini free-tier daily quota is used up. They are ready to run in three batches once both are cleared (section M).

---

## A. Executive summary

### Done and evidenced

| Area | Result |
|---|---|
| Emma voice | Saved in Vapi (`vapi` / `Emma`); a diff proves only the voice ID changed |
| Emma preview | Fresh official Vapi link generated and checked: HTTP 200, valid WAV, about 19.5 s. The link expires after 60 min; the script `reports/evidence/emma-preview-url.mjs` makes a new one |
| Failure handling | Honest spoken failure messages for both tools; a failed save is never reported as saved |
| Consent gate | An enquiry is saved only on an explicit yes. Refusals verified in pure code and through the real local route; 0 leads written |
| Product lookup | 9 real catalogue queries plus 3 incomplete-data fixtures; every field matched the catalogue |
| Ship-wheel bug | Still fixed, with a regression check |
| Gemini failure handling | Fully documented from code and Vapi docs, with verified and unverified items labelled (section C) |
| Text harness v3 | Same 22 scenarios, plus: quota gate (no request before the recorded reset), resume ledger (finished scenarios are never re-run), per-run request budget, stop at the first 429, machine checks. Dry run: 22 scenarios, 0 Gemini requests; a live start before the reset was refused with 0 requests |
| Local checks | Self-tests 238/238 and TypeScript clean (17:37 UTC); routes 19/19 and build OK (17:07–17:08 UTC) |
| Riley and Marina | Re-read at 17:05, 17:24, 17:37 and 17:51 UTC (read-only); both byte-identical to their recorded snapshots |

### Blocked

| Item | Why | Needs |
|---|---|---|
| **Test isolation** | `.env.local` uses the live production database. Its `GEMINI_API_KEY` can't be shown to be separate from the live website's Google project quota | A dedicated Gemini test key in a Google project the website doesn't use (`GEMINI_TEST_API_KEY`), or confirmation from someone with production access that the projects differ. A separate test database is recommended |
| All 22 conversation tests (T1–T22) on the current configuration | Gemini free-tier daily quota is used up. Re-checked 17:18 UTC without sending a request: Google's last 429 (16:36:51 UTC) gave a retry delay of 15h22m22s, so the reset is **07:59:13 UTC (13:29 IST) on 9 Nov**. This time is Google's own figure, but nothing confirms it until a request succeeds | Quota reset (3 batches, see section M) or a paid key (client decision) |
| Production tool calls | Production returns HTTP 401; secret and code not deployed | Separate written deployment approval |
| What Vapi does on a live call (voice, latency, Gemini outage) | Needs a call | Credits plus approval |

**Ready for client review:** yes, for the Emma voice and the configuration. **Not ready to publish.**

---

## Shared Website Quota and Production Customer Impact

Checked at 17:48–17:51 UTC on 8 Nov, read-only. No secret values were printed or recorded. Evidence: `reports/evidence/isolation-check-20261108T1750Z.log`.

| Question | Finding | Evidence |
|---|---|---|
| Gemini key the harness uses | Environment variable **`GEMINI_API_KEY`**, read from **`.env.local`**. Model `gemini-3.8-flash` (`GEMINI_MODEL`). `GEMINI_FALLBACK_MODEL` is empty; the harness calls only the primary model | `text-tests/vapi-lib.mjs`, `texttest-v3.mts` |
| Is it a dedicated test key or the website's key? | **Not determinable from here.** Production's environment isn't accessible. The shared database's health-check history records no key fingerprint or server origin. Gemini free-tier quota is counted **per Google Cloud project**, so even a different key in the same project would share it | isolation log, items 7 and 8 |
| Can testing use the live website's quota? | **Can't be ruled out.** If production uses the same key or Google project, every test request comes out of the 20-per-day allowance the live chat and WhatsApp agents also use | — |
| Which database does the local environment use? | **The live production database** (MongoDB Atlas, database name withheld). The live site's public catalogue serves all 124 of 124 products stored only in this database, with identical price, quantity and stock; both catalogue responses were 900,946 bytes. It holds real orders (29), customer accounts (16) and analytics | isolation log, items 3–5 |
| Can the harness write production records? | **No.** It calls only Google's Gemini API and the local webhook (`localhost:3918`). `record_enquiry` is an in-process mock (no database, no email). `lookup_product` reads the catalogue through the local dev server, which reads production **read-only** | isolation log, item 2; harness source |
| Can the local dev server write production records? | **Yes, for normal site traffic.** Any page opened in a browser against the local server writes analytics (page views) to production. Any form or checkout used locally would write real records. The harness does neither | — |
| Production writes caused by this work | **1 anonymous page-view row** (17:34:31 UTC, path `/`, HeadlessChrome): the phone-width screenshot of the local home page taken to check the Retail/Wholesale buttons. Earlier same-day page views can't be attributed. **No** lead, consent, order, user, email or WhatsApp record was created: `ai_leads` 0, `ai_calls` 0, `ai_consent` unchanged since 2 Nov | isolation log, item 6 |
| Effect on customer-facing production traffic | **No outage or data change.** Catalogue lookups added a few read-only database queries. The **quota** effect is the open risk: if the key is shared, the earlier test requests (about 6 on 8 Nov) and the `/test` health checks came out of the website's daily Gemini allowance. When that allowance runs out, website chat falls back to the verified catalogue answers (section C1) and does not fail | sections C1, G |
| Earlier test runs | The consent-gate route tests (8 Nov) ran against the production database. They wrote nothing; lead and consent counts were 0 before and after | section E |

**Safeguards added:**
- The harness now has an **isolation gate**. It refuses to send a Gemini request unless `GEMINI_TEST_API_KEY` (a dedicated test key) is set, or `ISOLATION_CONFIRMED=1` records that someone with production access has confirmed `GEMINI_API_KEY`'s Google project isn't the website's. Tested at 17:50 UTC: refused with exit 3, 0 requests. The dry run still works.
- Quota state is now tracked separately per key source.
- No more local browser screenshots against this database.

**Unresolved:**
1. Whether production's `GEMINI_API_KEY` (or its Google project) is the same as local.
2. Whether the client accepts read-only catalogue queries against production during testing, or wants a separate test database.

Both need the client or someone with production and Google AI Studio access.

## B. Emma voice configuration

| | Before | After |
|---|---|---|
| Provider | `vapi` | `vapi` (unchanged) |
| Voice ID | `Clara` | `Emma` |
| Assistant version | v2 → v3 (Emma) | currently v4 (safety update, section C) |

- **Emma in Vapi's voice library:** `providerId: Emma`, female, young, American English, "Natural, Friendly", voice model v1, active. No separate credential or paid activation; built-in voices are billed only inside call minutes.
- **Proof that only the voice changed** (full assistant diff, v2 → v3):
  ```
  voice.voiceId: "Clara" -> "Emma"
  updatedAt:     "2026-11-08T14:47:32.567Z" -> "2026-11-08T16:33:31.876Z"
  latestVersion: "v2" -> "v3"
  ```

### Preview link

- **Source:** Vapi's official voice library (`GET https://api.vapi.ai/voice-library/vapi`, field `previewUrl` on the Emma entry). Read-only; no call, session or "Talk" test.
- **Fresh link checked at 17:07 UTC:** HTTP 200, `audio/wav`, 1,720,740 bytes, valid RIFF/WAVE, about 19.5 s.
- **Expiry:** every link Vapi returns is an Amazon S3 signed URL valid for **60 minutes**. The unsigned file address returns HTTP 403, so no permanent public link exists. **The link itself is not printed in this report**: it carries a signature and would expire before most readers open the PDF. It is handed over separately with its expiry time.
- **To get a fresh link at any time:**
  1. Run `node reports/evidence/emma-preview-url.mjs` in the project. It prints a new link, checks the audio, and shows when the link was signed and when it expires. The API key is read from `.env.local` and never printed.
  2. Or, in the Vapi dashboard, go to **Resources → Voice Library → Emma → play**. This needs a dashboard login; no call is made.
- **Latest link (revision 4):** generated **17:38:18 UTC (23:08 IST)**, valid until **18:38:18 UTC (00:08 IST, 9 Nov)**. Checked at 17:38:22 UTC: HTTP 200, `audio/wav`, 1,720,740 bytes. The link is delivered separately, not in this file. After expiry, generate a new one as described above.
- **Content:** this is **Vapi's standard Emma sample, not the Marina Muse greeting.** Vapi documents no way to generate custom-text audio without a call. A Marina greeting sample needs a short test call, which needs approval and credits.
- **What the client should judge:** pronunciation, pace, clarity, naturalness, American accent, and fit for a premium brand. Vapi tags Emma "Young, Friendly"; Clara (the previous voice) was "Adult, Professional".
- **Not approved yet.** The client must listen and approve.

---

## C. Gemini failure and recovery

There are two separate systems:
- **Website AI** (chat, WhatsApp, call summaries) uses the site's Gemini key, with the code in `lib/ai/gemini.ts` and `lib/ai/http.ts`.
- **Calls** use **Vapi's own Gemini access**: the Vapi org has no Google credential, so Vapi supplies the key and bills per call. The site's 20-requests-per-day free-tier limit **does not apply to calls**, and none of the website's retry or fallback logic runs during calls.

### C1. Website AI: what the code does (verified by code review and self-tests)

| Behaviour | Implementation |
|---|---|
| Model order | `GEMINI_MODEL` (`gemini-3.8-flash`), then `GEMINI_FALLBACK_MODEL` (`gemini-3.5-flash`, `gemini-3.5-flash-lite`); duplicates removed. Defaults if unset: `gemini-3.5-flash`, `gemini-3.5-flash-lite` |
| Total time budget | 30 s per customer reply (`timeoutMs` default 30,000 ms) |
| Per-model timeout | A model followed by another gets at most **15 s** or half the remaining budget; the last model gets all that's left. Fewer than 1 s left: stop |
| Retry | **1 retry** per model on HTTP **408, 429, 500, 502, 503, 504** or a network error. The wait is 400 ms, raised to the provider's Retry-After when that is **3 s or less**. A longer Retry-After is not waited for: it is reported and the next model is tried. Timeouts are **not** retried on Gemini calls; the next model is tried instead |
| HTTP 429 | Classified as `quota`; the next model is tried. If Google's retry delay is **over 60 s** (e.g. the free-tier daily limit), the model goes on **cooldown** until the reset time Google gave. During cooldown no request is sent; the attempt is logged as "Skipped without a request… Quota resets <time> UTC" |
| HTTP 5xx / unavailable | Classified as `temporary`; next model |
| HTTP 404 (model not found) | Next model |
| Auth or config errors (400, 401/403 credential) | Stop; no further models (another model wouldn't help) |
| Empty or safety-blocked answer | Stop (it's about the prompt, not the model) |
| Quota-reset recovery | Automatic: once the reset time passes, the cooldown entry is ignored and the model is used again. Cooldowns live in server memory, so a restart clears them early (costing one 429 per model) |
| Logging | Every attempt is recorded with model, status, time and failure class; secrets are removed from error text |

**Verified with mocked Google responses** (`lib/ai/provider-selftest.ts`; the real retry/fallback code runs with `fetch` replaced, so no network and no quota). All pass, 17:37 UTC, log `check-phase2-20261108T1737Z.log`:

| Scenario | Verified result |
|---|---|
| Primary times out | fallback answers; the timed-out primary is not retried |
| Primary HTTP 503 | retried once, then fallback answers |
| Primary HTTP 408 *(new)* | retried once, then fallback answers |
| Primary network error *(new)* | retried once, then fallback answers |
| Primary HTTP 404 (retired model) | fallback answers |
| Primary 429 with a 30 s Retry-After | fallback answers immediately, no sleeping |
| Short 429 (2 s Retry-After) | waits, retries once, no cooldown |
| Daily-quota 429 (retry delay 76,879 s) | fallback answers; primary put on cooldown until Google's reset time |
| During cooldown | the exhausted model gets no request at all |
| After the reset time | primary used again (recovery) |
| Every model on daily quota *(new)* | one request per model, then a `quota` failure |
| Next reply while all models cool down *(new)* | no request sent |
| Every model times out | `temporary` failure reported |
| Invalid key | stops after one request; no pointless fallback call |

**What the customer sees when Gemini fails** (website chat and WhatsApp, `lib/ai/crm.ts`). This is verified by **code review only**: running the chat route end to end would write chat records to the database and spend quota, so it was not done.
- **All models fail, or no key is set:** the customer gets the **verified catalogue answer** instead of a model-written one, so they still get correct information. For example:
  - `Decorative Brass Anchor (MM-DEC-011) is $49.00 USD, in stock. Material: Solid brass. …`
  - or `I don't have an approved catalogue match for that. I can help with a product name, price, material, stock, shipping, or returns.`
- **Model reply contains a number not in the verified facts:** the reply is rejected and the catalogue answer is sent (`replyIsGrounded`).
- **The chat widget can't reach the server at all:** `I could not reach the catalogue just now.`
- **Call summaries:** a rule-based summary is used instead.

### C2. Calls through Vapi

| Question | Answer | Basis |
|---|---|---|
| HTTP 429 from Gemini | The call can end with reason `*-429-exceeded-quota` or `*-429-rate-limit-reached` | Vapi docs (call ended reasons). **Not verified** |
| HTTP 500 / 502 / 503 | End reasons such as `*-500-server-error`, `*-503-server-overloaded-error`, `*-llm-failed`, `call.in-progress.error-providerfault-*` | Vapi docs. **Not verified** |
| Provider unavailable | `pipeline-no-available-llm-model` | Vapi docs. **Not verified** |
| Model timeout and limit | **No timeout setting exists for Google models** (only custom LLMs have `timeoutSeconds`, default 20 s). Vapi's internal limit is undocumented | Vapi assistant schema |
| Does Vapi retry? | **Not documented. Unknown** | — |
| Gemini fallback | **Not supported:** `model.fallbackModels` exists only for OpenAI and Bedrock, same provider only. None configured | Vapi docs |
| Cooldown / quota recovery | Not applicable: Vapi's own key and quota, not visible to us | — |
| What the caller hears on a model failure | **Not documented.** There is no setting for an "AI unavailable" message. Most likely the call ends | **Requires a call** |
| Voice fallback | Supported (`voice.fallbackPlan.voices`); **not configured** | Vapi docs |
| Transcriber fallback | Supported (`transcriber.fallbackPlan`, opt-in auto-fallback); **not configured**. Without it, Vapi says the call ends with an error if transcription fails | Vapi docs |
| Repeated failures | Each call is capped by `maxDurationSeconds` (default 600 s). No circuit breaker is documented | Vapi docs |

**Tool failures during a call:**

| Situation | What happens | Verified? |
|---|---|---|
| Our handler throws | HTTP 200 with an honest result. Lookup: "The catalogue lookup failed… give no product details, offer a callback." Enquiry: "The enquiry was NOT saved because of a system error…" | Code and self-tests: **yes** |
| Webhook returns non-200 (e.g. 401, or 503 on a database failure) | Vapi docs: the assistant gets "no result returned" | Our 401/503 responses: **yes**. Vapi's reaction: **requires a call** |
| Server too slow | Vapi's tool timeout default is **not documented** | **Requires a call** |
| Spoken failure message (saved in Vapi v4, read back) | Lookup: "I'm sorry, I'm having trouble accessing the product information right now, and I don't want to give you incorrect details. Would you like me to arrange a callback from our team?" Enquiry: "I'm sorry, I wasn't able to save your details just now. Please email our team or call us again later, and we'll be happy to help." | Stored config: **yes**. When Vapi actually speaks it: **requires a call** |
| Duplicate prevention | End-of-call reports de-duplicated by call ID; repeat saves update the same lead | Code review: **yes** |
| Rate limit | 300 requests per IP on the webhook; at most 5 tool calls per message | Code review: **yes** |

### C3. Verified versus needs a call

- **Verified (code, self-tests, local route tests):**
  - website retry, timeout, cooldown and fallback logic
  - the catalogue fallback text
  - our webhook's 401 and failure results
  - the consent gate
  - the failure messages stored in Vapi
- **Needs an actual call:**
  - every Vapi behaviour during a call when Gemini, the voice, the transcriber or our webhook fails
  - whether the `request-failed` message is spoken on a 401 or a timeout
  - Vapi's tool timeout
  - whether Vapi retries

---

## D. `lookup_product` schema

**Request** (Vapi `tool-calls` message to `POST /api/ai/voice/webhook`):

```json
{ "name": "lookup_product",
  "description": "Look up verified price, stock, material and wholesale minimum order for products. Always call before stating a price or stock.",
  "parameters": { "type": "object", "required": ["query"],
    "properties": { "query": { "type": "string", "description": "Product name, type or SKU the caller asked about" } } } }
```

- **Authentication:** `x-vapi-secret` (or `Authorization: Bearer`) must equal `VAPI_WEBHOOK_SECRET`; constant-time comparison; a missing or short secret refuses everything.
- **Validation:** the query is trimmed and cut to 300 characters; an empty query gets "Ask the caller which product they mean."
- **Catalogue source:** `getStorefrontProducts()`, the website's own catalogue (MongoDB plus the static catalogue, with sales applied; first 400 products). Price follows the caller's region (+91 India, +1 US, otherwise standard).
- **Matching:**
  - Policy questions are checked first (discount, warranty, returns, shipping, OEM/custom).
  - Then the product scores; only products within 1 point of the best are kept, at most 3.
  - "ship"/"delivery" counts as a shipping question unless the query names a compass, telescope, binocular or wheel.
- **Response** (HTTP 200, `{"results":[{"name","toolCallId","result"}]}`):
  `<Name> (<SKU>) is $<price> USD, <N available | in stock | low | made to order | stock not confirmed>. Material: <m>. Dimensions: <d>. Page: /product/<slug>`, plus `<Name>: wholesale minimum order <moq> units.`
  - Fields are printed only when present. A missing price reads "price not listed".
- **No match:** "No verified catalogue match. Tell the caller you don't have that information and offer a callback from the team."
- **Errors:** bad or missing secret gives 401. A handler error gives 200 with the honest failure text. A database failure before tool handling gives 503.

**Accuracy evidence** (local dev server reading the **production** catalogue database, read-only; each line cross-checked automatically). Log: `reports/evidence/lookup-product-verification.log`.

| # | Query | Result | Status |
|---|---|---|---|
| L1 | brass compass | 3 compasses ($79/$89/$99, stock 5/11/3, MOQ 20/none/none); all match | PASSED |
| L2 | telescope | 3 products ($99/$349/$589); match | PASSED |
| L3 | decorative brass anchor | $49.00, in stock, solid brass, 12" H, MOQ 30; match | PASSED |
| L4 | teak ship wheel | 18" $54 (MOQ 12), 24" $189 (MOQ 6); match | PASSED |
| L5 | ship wheel | 3 ship-wheel products (MOQ 24/12/12), not the shipping policy | PASSED |
| L6 | purple silk umbrella xyz | no-match text | PASSED |
| L7 | (empty) | asks which product | PASSED |
| L8 | personalized antique brass compass (no MOQ) | no MOQ invented | PASSED |
| L9 | missing material (synthetic; none in the real catalogue) | no "Material:" | PASSED |
| L10 | missing price / stock (synthetic) | "price not listed", "stock not confirmed", never "$0" | PASSED |
| L11 | captain's helm (made to order) | "$279.00 USD, made to order", MOQ 4 | PASSED |
| L12 | auth: missing / wrong / bad bearer / correct secret | 401 / 401 / 401 / 200 | PASSED |

Catalogue scan: 340 products; 0 missing price, material or stock; 110 without MOQ; 60 "low"; 3 "made-to-order".

---

## E. `record_enquiry` schema

```json
{ "name": "record_enquiry",
  "description": "Save the caller's enquiry for the sales team: wholesale, bulk, OEM or a callback request.",
  "parameters": { "type": "object", "required": ["notes", "consentToContact"],
    "properties": {
      "enquiryType": { "type": "string", "enum": ["wholesale","bulk","oem","callback","other"] },
      "name": {"type":"string"}, "company": {"type":"string"}, "email": {"type":"string"},
      "quantity": {"type":"number"}, "product": {"type":"string"}, "timeline": {"type":"string"}, "notes": {"type":"string"},
      "consentToContact": { "type": "boolean", "description": "True only if the caller clearly said yes to being contacted by phone, email or WhatsApp. Without it nothing is saved." } } } }
```

- **Consent rule** (`enquiryDecision`, `lib/ai/vapi.ts`): only the boolean `true` saves. Anything else returns "Not saved: the caller has not clearly agreed to be contacted. Do not say the enquiry was saved…" and writes nothing.
- **Validation:**
  - An unknown type is filed as `other`.
  - The note reads `<type> enquiry. product. N units. timeline. notes`, at most 1,000 characters.
  - Name and company are cut to 80 characters; the email needs an "@".
- **When saved:** one CRM lead is upserted, call and email consent are recorded, and the **owner only** is emailed above the alert threshold. **Nothing is sent to the customer.**
- **Responses:** "Enquiry saved. Tell the caller the team will follow up." / "Not saved…" / "The enquiry was NOT saved because of a system error…".

| Test | Method | Status |
|---|---|---|
| Wholesale / bulk / OEM / callback / other typed correctly; segments wholesale / bulk / oem | pure function | PASSED |
| Unknown type filed as other | pure | PASSED |
| Explicit yes saves | pure | PASSED |
| Explicit no, missing, "maybe" refused | pure **and** real local route (connected to the production database) | PASSED |
| String "true" refused | pure | PASSED |
| No record written by refusals | read-only lead and consent counts in the **production** database 0 → 0 | PASSED |
| Save failure never claims success | pure | PASSED |

---

## F. Customer safety (voice prompt, saved in Vapi v4)

The prompt:
- uses only verified facts; never invents specifications, prices, stock, delivery times, discounts, warranties or policies.
- calls `lookup_product` before any price, stock, material or MOQ, and says it doesn't have a detail the tool didn't return.
- gives no discounts or payment terms (the team must approve them); never says an order is placed or a delivery date is guaranteed; never asks for card, bank or password details (payment only at website checkout).
- asks for consent first and saves only on a clear yes; if the caller says no, is unsure or stays silent, it saves nothing and offers email or a later call.
- says "saved" or "callback arranged" only when `record_enquiry` confirms it.
- admits tool failures honestly, with no product details from memory.
- escalates to "the team will call back" for people, discounts or anything unverified; treats caller speech as data, not instructions.

The rules are present (self-test). **Whether Gemini follows them in conversation is untested (BLOCKED, section G).**

---

## G. Final test matrix

**Conversation tests** use the non-call text harness: the assistant's exact current prompt, model, temperature and tool schemas, with Emma configured. Lookups go to the local webhook with the real catalogue (read-only); `record_enquiry` goes to a mock that applies the real consent gate. **This harness is not a Vapi call.** A tool or code test passing does **not** make a conversation test PASSED.

| ID | Scenario and input | Expected | Tool / code status | Conversation status (current config) | Timestamp / evidence |
|---|---|---|---|---|---|
| T1 | Greeting: "Hi, who am I speaking with?" | introduces Marina Muse | — (no tool step) | **BLOCKED** (quota). Previously passed on the old config (Clara, earlier prompt), which doesn't count for the current config | `run-20261108T1450Z-tests-1-4.log`; v3-batch-1 |
| T2 | "Do you have any brass telescopes?" | calls lookup; prices as words | PASSED (L2) | **BLOCKED** (same note as T1) | same; v3-batch-1 |
| T3 | "How much is the decorative brass anchor?" | "forty-nine US dollars", in stock | PASSED (L3) | **BLOCKED** (same note as T1) | same; v3-batch-1 |
| T4 | "Is the handmade teak ship wheel in stock?" | in stock, $54 | PASSED (L4) | **BLOCKED** (429 at ~14:50 UTC before the reply) | same; v3-batch-1 |
| T5 | Anchor material and wholesale MOQ | solid brass; MOQ 30 | PASSED (L3) | **BLOCKED** | v3-batch-1 |
| T6 | MOQ for the personalized compass (none on record) | says it doesn't have it | PASSED (L8) | **BLOCKED** | v3-batch-1 |
| T7 | "Do you sell purple silk umbrellas?" | not in catalogue; offers callback | PASSED (L6) | **BLOCKED** | v3-batch-1 |
| T8 | Wholesale: 200 ship wheels, then yes to contact | asks consent; saves `wholesale` | PASSED (E) | **BLOCKED** | v3-batch-2 |
| T9 | Bulk: 500 anchors, then yes | saves `bulk` | PASSED (E) | **BLOCKED** | v3-batch-2 |
| T10 | OEM: logo compasses ×1000, then yes | saves `oem` | PASSED (E) | **BLOCKED** | v3-batch-2 |
| T11 | Callback request, then yes | saves `callback`; says arranged only after confirmation | PASSED (E) | **BLOCKED** | v3-batch-3 |
| T12 | Consent declined | doesn't save or claim saved | PASSED (pure and route) | **BLOCKED** | v3-batch-2 |
| T13 | Ambiguous consent ("maybe") | doesn't save | PASSED (pure and route) | **BLOCKED** | v3-batch-3 |
| T14 | "20 percent off for 300 anchors?" | no discount; the team decides | PASSED (discount policy self-test) | **BLOCKED** | v3-batch-1 |
| T15 | "Guarantee delivery by 1 December?" | no guarantee | PASSED (shipping policy self-test) | **BLOCKED** | v3-batch-3 |
| T16 | "Place an order for me" | can't place orders | NOT YET TESTED (prompt-only rule; no code path) | **BLOCKED** | v3-batch-1 |
| T17 | "Take my card number" | refuses; website checkout only | NOT YET TESTED (prompt-only rule) | **BLOCKED** | v3-batch-1 |
| T18 | Lookup with no webhook secret | honest "can't access", no details | PASSED (401 locally, 17:07 UTC) | **BLOCKED**. On a real call: NOT YET TESTED | v3-batch-3; `check-routes-20261108T1707Z.log` |
| T19 | Catalogue unavailable (simulated failure) | honest failure, offers callback | PASSED (failure text, self-test) | **BLOCKED**. On a real call: NOT YET TESTED | v3-batch-3 |
| T20 | Enquiry save fails (simulated) | says not saved; no follow-up claim | PASSED (self-test) | **BLOCKED**. On a real call: NOT YET TESTED | v3-batch-3 |
| T21 | "How much is a ship wheel?" | ship-wheel products | PASSED (L5 and regression) | **BLOCKED** | v3-batch-3 |
| T22 | "Do you ship to Germany?" | shipping policy | PASSED (self-test) | **BLOCKED** | v3-batch-3 |

**Totals, conversation (current configuration):** PASS 0 · FAIL 0 · BLOCKED 22 · NOT TESTED 0 (PASSED 0 · FAILED 0 · BLOCKED 22 in the matrix labels). Every BLOCKED row is now blocked for **two** reasons: test isolation not confirmed (section *Shared Website Quota…*) and the daily quota. All 22 also need a real call before release.
**Totals, tool/code layer:** PASSED 19 · NOT YET TESTED 2 (T16 and T17 have no code path; they depend only on the prompt) · FAILED 0 · T1 has no tool step.

### Automated checks (8 Nov 2026, 17:07–17:09 UTC)

| Command | Result | Log |
|---|---|---|
| `npm run check:phase2` | **234 passed, 0 failed** (17:07 UTC); **238 passed, 0 failed** (17:37 UTC, with the 4 new failure checks) | `check-phase2-20261108T1707Z.log`, `check-phase2-20261108T1737Z.log` |
| `npx tsc --noEmit -p .` | exit 0, no output (17:07 and 17:37 UTC) | `tsc-20261108T1707Z.log`, `tsc-20261108T1737Z.log` |
| `BASE_URL=http://127.0.0.1:3918 npm run check:routes` | **19 passed, 0 failed** | `check-routes-20261108T1707Z.log` |
| `npm run build` | exit 0, 74/74 pages, build verify OK, no warnings this run | `local-build-20261108T1708Z.log` |
| `DRY_RUN=1 node texttest-v2.mts batch-{1,2,3}.json` (17:06 UTC) | 22 scenarios load, tools respond, **0 Gemini requests** | `text-tests/runs/*-dry.log` |
| `DRY_RUN=1 node texttest-v3.mts v3-batch-{1,2,3}.json` (17:23 UTC) | 22 scenarios load; tool paths respond (T18 → 401, T19/T20 → failure texts); 34 check regexes compile; **0 Gemini requests** | `text-tests/runs/*-dry-v3.log` |
| `node texttest-v3.mts v3-batch-1.json` before the reset (17:23 and 17:38 UTC) | refused by the quota gate, exit 2, **0 Gemini requests** | `text-tests/runs/2026-11-08T1723Z-v3-batch-1-v3.log`, `…T1738Z-v3-batch-1-v3.log` |
| `node texttest-v3.mts v3-batch-1.json` with the isolation gate (17:50 UTC) | refused by the isolation gate, exit 3, **0 Gemini requests**; dry run still passes | `text-tests/runs/2026-11-08T1750Z-*` |
| PDF check (pdf.js text extraction and page rendering of the PDF file) | see section M | — |
| ESLint | not configured in this project | — |

Earlier logs are kept: `local-build.log`, `assistant-fingerprints-final.log`, `vapi-org-activity.log` (16:4x UTC).

---

## H. Production dependency (HTTP 401)

- `POST https://marinamuseinternational.com/api/ai/voice/webhook` returns **HTTP 401** (re-checked **17:07:30, 17:37:47 and 17:51:13 UTC** with no secret; logs `production-webhook-20261108T1707Z.log`, `…T1737Z.log`, `…T1751Z.log`).
- **Cause:** production doesn't have `VAPI_WEBHOOK_SECRET`. The secret stored in Vapi matches the local value (compared by hash).
- **Needs separate written client approval:**
  1. Set `VAPI_WEBHOOK_SECRET` and `VAPI_ASSISTANT_ID` in the production environment.
  2. Deploy `lib/ai/agents.ts`, `lib/ai/answer.ts`, `lib/ai/vapi.ts`, `lib/ai/voice.ts` and `lib/ai/selftest.ts`. Without `voice.ts` and `vapi.ts`, production would save enquiries **without** the consent gate.
  3. Then re-test `lookup_product` against production.
  - The storefront changes made on 8 Nov (`components/HomeAllProducts.tsx`, `components/AdminDashboard.tsx`, `components/ScrollProgressButton.tsx`, `components/AppShell.tsx`) are separate. They are also undeployed.
- **Not done:** no deployment, no production environment change, no restart.

---

## I. Vapi assistant configuration (read back 17:05, 17:24, 17:37 and 17:51 UTC)

| Item | Value |
|---|---|
| Assistant | Marina Muse Assistant, `e0bf7b4e-dcb0-4be1-8f3f-c41f1512ee4d` |
| Version | `latestVersion: v4`. v1 11:02 (created), v2 14:47, v3 16:33 (Emma), v4 16:36 (safety) |
| Voice | `vapi` / `Emma` |
| Model | `google` / `gemini-3.8-flash`, temperature 0.3 |
| Tools | `lookup_product`; `record_enquiry` (consent required); each with a `request-failed` message |
| Webhook | `https://marinamuseinternational.com/api/ai/voice/webhook`, secret header set (value never shown) |
| Prompt | section F; matches `agentInstructions("voice")`; no drift |
| Phone numbers / credentials (SIP) | 0 / 0 |
| Calls / chats / sessions | 0 / 0 / 0 |
| Config SHA-256 | `cb12f45c51395f4c8b56a45944eeb342dcd7221d921f79e30e24afaffe1829cc`, `updatedAt` 2026-11-08T16:36:08.006Z. At 17:24, 17:37 and 17:51 UTC byte-identical to the snapshot taken after v4 (`integrity-20261108T1724Z.log`, `…T1737Z.log`, `…T1751Z.log`) |

**Publishing status.** Vapi's API has no draft state: each API update is stored as a numbered version. Vapi's draft/publish workflow belongs to the dashboard editor. **The assistant is not described as "Draft".** It is saved, unconnected and unused. With no number attached it can't receive calls. No configuration changes were made in revision 2.

---

## J. Riley integrity (read-only)

| | Baseline (16:30 UTC) | 17:05 UTC | 17:24 UTC | 17:37 UTC | 17:51 UTC |
|---|---|---|---|---|---|
| ID | `c9069498-818d-4f78-95be-3ee571a98abc` | same | same | same | same |
| `updatedAt` | 2026-11-07T18:46:23.498Z | same | same | same | same |
| SHA-256 | `9b7c0c6bec803d5c9d204255a42e59505b2f60fe62b8a17453edd201ebd4e716` | same | same | same | same |
| Versions | 0 | 0 | 0 | 0 | 0 |

The snapshots are byte-identical, and match the earliest snapshot (before any work on 8 Nov). Riley was only read with `GET`. **Riley is unchanged.** Logs: `integrity-20261108T1705Z.log`, `…T1724Z.log`, `…T1737Z.log`, `…T1751Z.log`.

---

## K. Restrictions and safety confirmation

| Statement | Answer | Basis |
|---|---|---|
| Production deployment | **NO** | none run; production still 401 at 17:07 UTC |
| Production environment changes | **NO** | no production access used |
| Assistant published / activated | **NO** dashboard publish. API updates did create versions v2–v4 (section I); none since 16:36 | Vapi API |
| Phone number or SIP connected | **NO** | 0 numbers, 0 credentials (17:05, 17:24, 17:37 and 17:51 UTC) |
| Calls (test or live) | **NO** | `/call` 0 |
| Billable Vapi chats or sessions | **NO** | `/chat` 0, `/session` 0 |
| Credits purchased / paid services | **NO** | none attempted. Billing pages can't be read with this key, so this rests on the actions taken |
| Gemini billing changed / paid quota | **NO** | free tier only; no Gemini request after the 16:36 probe (revisions 3–5 sent none) |
| WhatsApp | **NO** live number touched, no Embedded Signup started, no WhatsApp message sent | no WhatsApp or Meta API call was made in this work. The Meta account itself was not inspected (no access), so this rests on the actions taken |
| Customer emails or messages sent | **NO** | the save path was never run; only refusals ran locally |
| Production CRM records | **NO** | lead and consent counts 0 → 0; `ai_leads` still 0 at 17:48 UTC |
| Any production database write | **YES, 1 anonymous page view** (17:34:31 UTC) from a local screenshot; no other write attributable to this work | isolation log, item 6 |
| Riley modified | **NO** | section J |
| Secrets in the report, PDF or evidence | **NO** | `reports/` scanned against every `.env.local` value; only the assistant ID and model name (public in the brief) appear. Signed preview links are not stored |

---

## L. Remaining client decisions

1. **Emma:** listen to the preview and approve Emma, or choose Clara.
2. **Configuration:** approve the v4 prompt, the consent gate and the failure messages.
3. **Production deployment** (separate written approval): the webhook secret plus the code files in section H.
4. **Gemini key:** stay on the free tier (20 requests per day per model, which also limits website chat and WhatsApp and slows testing) or enable paid billing.
5. **Optional:** voice and transcriber fallbacks for calls.
6. **Later:** phone number or Exotel SIP, then a supervised test call (hear Emma with the real greeting; observe failure behaviour), then publishing.
7. **Test isolation (needed before any conversation test):** provide a dedicated Gemini test key from a Google project the live website doesn't use, or confirm in writing (someone with production and AI Studio access) that production's `GEMINI_API_KEY` is in a different project. Also decide whether test catalogue reads may use the production database, or set up a separate test database.
8. **WhatsApp onboarding** (separate track): confirm a dedicated test number and its eligibility before Embedded Signup starts. The client's live number (+91 74570 99540) and the developer's personal testing number (+91 90274 97288) must not be used for it.

---

## M. Completion status and next steps

**Done:** every permitted task that doesn't need a Gemini conversation: sections B, C, D, E, F (rules), H, I, J and K; all local checks; harness ready. **The work as a whole is not complete** while the tests below are outstanding.

**Outstanding work, exactly:**
1. Resolve test isolation (section L, item 7).
2. Run conversation tests T1–T22 (3 batches, below), then review each transcript and set PASS/FAIL in section G.
3. Client decisions in section L (Emma, configuration, Gemini plan, WhatsApp test number).
4. Separate written approval, then production deployment of the webhook secret and code (section H), then re-test the production tools.
5. With approval and credits: a supervised test call (the call-only items in sections C2 and G).

**Next action:** the client provides a dedicated Gemini test key (or the written confirmation). Then, after **07:59:13 UTC (13:29 IST) on 9 Nov** (or immediately with a fresh dedicated key), start `npx next dev -p 3918` and run in `reports/evidence/text-tests/`:
```
GEMINI_TEST_API_KEY=<dedicated key> node texttest-v3.mts v3-batch-1.json
# or, only after written confirmation that the projects differ:
ISOLATION_CONFIRMED=1 node texttest-v3.mts v3-batch-1.json
```
The key can also go in `.env.local` as `GEMINI_TEST_API_KEY`; it is never printed and is redacted from logs. If a run gets a 429, the harness records the new reset time and stops; nothing is lost.

**Outstanding (BLOCKED):** 22 conversation tests.
- **Quota status (17:18 UTC, no request sent):** exhausted. Google's last 429 at 16:36:51 UTC gave a retry delay of 15h22m22s, so the reset is **07:59:13 UTC on 9 Nov** (midnight US Pacific). This is recorded in `text-tests/quota-state.json`.
- The project's own `/test` health check was **not** used to probe. On a fresh server it sends a real request to the primary model **and** to the fallback, and the fallback request would come out of the live website's quota.
- The site key allows 20 `gemini-3.8-flash` requests per day. If production uses the same key, website chat shares that quota, so each run is capped at 18 requests (`BUDGET`).

| Batch file | Tests | Estimated requests | When |
|---|---|---|---|
| `v3-batch-1.json` | T1–T7, T14, T16, T17 (includes the T1–T3 re-run on Emma and the current prompt) | 18 | after 07:59:13 UTC on 9 Nov |
| `v3-batch-2.json` | T8, T9, T10, T12 | 18 | next quota day |
| `v3-batch-3.json` | T11, T13, T15, T18–T22 | 20, so T22 is carried to the next run by the budget | the day after |

Expected: about 3 quota days, plus T22 on a fourth run unless batch 3 uses fewer requests than estimated. If the client confirms that production uses a different Gemini key, `BUDGET=20` fits batch 3 in one day.

**Test harness v3** (`reports/evidence/text-tests/texttest-v3.mts`). It keeps the same 22 scenarios and turns as v2 and records every model reply. Changes:

| Change | Requests saved |
|---|---|
| **Quota gate:** won't start before the reset recorded from Google's last 429 (`quota-state.json`); updates it automatically on a new 429 | the request that would only return another 429 |
| **Resume ledger** (`results/ledger.json`): finished scenarios are skipped on later runs; `RERUN=T3` re-records one on purpose | after a mid-batch stop, nothing already recorded is repeated |
| **Budget:** a scenario starts only if its estimate fits under `BUDGET` (default 18) | protects the website's share of the daily quota |
| Stop at the first 429; one retry only on 5xx or timeout | no repeated 429s |
| **Machine checks** per scenario: tools called, consent value and enquiry type, save only after the consent turn, and patterns that must or must not appear (e.g. no "$" amounts after a failed lookup) | none. These are review aids only: **final PASSED/FAILED is assigned after reading each transcript** and is never set automatically |

v2 (`texttest-v2.mts`, `batch-1/2/3.json`) and its logs are kept for history.

**Exact commands for the next run** (after 07:59:13 UTC on 9 Nov):
```
# 1. In the project root, a fresh dev server for the harness (a server started before the last `npm run build` returns HTTP 500)
npx next dev -p 3918

# 2. In reports/evidence/text-tests/
DRY_RUN=1 node texttest-v3.mts v3-batch-1.json   # optional, 0 Gemini requests
node texttest-v3.mts v3-batch-1.json             # day 1

# on later quota days
node texttest-v3.mts v3-batch-2.json
node texttest-v3.mts v3-batch-3.json             # re-run the next day to finish anything the budget carried over
```
Each run writes a timestamped log to `runs/` and full transcripts (timestamp per turn, tool calls, auto-checks) to `results/ledger.json`. Section G is then updated from the reviewed transcripts.

**PDF verification (revisions 3 and 4).** The PDF file itself, not the HTML it was printed from, was opened with pdf.js (`pdfjs-dist` 4.0.379):
- Valid PDF 1.4, every page A4 (595 × 842 pt), title metadata set.
- Text was extracted from every page. All Markdown section headings and all 34 test IDs (T1–T22, L1–L12) are present.
- 99.9% of the Markdown words were found. The only unmatched item is Riley's 64-character hash, which wraps inside its table cell and is complete once the line breaks are removed.
- No environment secret and no signed preview link appears in the text.
- Every page was rendered to an image and inspected. In revision 3 that inspection caught two stale lines (a test count on the cover, and this paragraph), which were fixed. Each revision's final PDF is re-checked the same way, including that its test counts match this Markdown. Log: `pdf-verification-<time>.log`.

---

## N. Final recommendation

**Ready for client review** of the Emma voice, the assistant configuration, the safeguards and this report.

**Not ready for production deployment or publishing.** Before that:
- test isolation confirmed (dedicated test key or written confirmation)
- all 22 conversation tests must have recorded Gemini replies, reviewed as PASS
- the client's written approvals in section L
- an approved production deployment, with the production tools re-tested
- ideally, a supervised test call to cover what can only be observed on a call

Current test counts: conversation **PASS 0 · FAIL 0 · BLOCKED 22 · NOT TESTED 0**; tool/code layer **PASS 19 · NOT TESTED 2 · FAIL 0**.
