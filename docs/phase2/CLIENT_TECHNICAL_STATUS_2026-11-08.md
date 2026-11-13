# Marina Muse International — Phase 2 technical status

> **Correction (8 Nov 2026, later):** +91 90274 97288 is the developer’s personal testing number, not the client’s designated Embedded Signup number. The client’s test number is not yet in the project records; signup is closed until it is confirmed. See `WHATSAPP_CLIENT_ONBOARDING_GUIDE.md`.

**Date:** 8 November 2026 · **Environment checked:** development (`.env.local`, `NODE_ENV` development) · **Prepared by:** development team

All provider checks in this report were read-only (GET requests, token requests, or one-word test prompts). No call was placed, no WhatsApp message was sent, no payment, order, shipment or label was created, no paid service was activated, and no production configuration or credential was changed. Credentials and identifiers are masked throughout.

---

## Executive summary

| Area | Status (evidence-based) | Blocked on |
|---|---|---|
| Gemini | Key valid. **gemini-3.8-flash is out of its Free Tier daily quota (20 requests/day).** Replies currently come from the fallback model gemini-3.5-flash, which answered in 2.5 s. | Billing decision before production (evidence below) |
| Vapi | Private key valid. Assistant, phone number, SIP credential and webhook secret are **not configured** (the `.env` values are placeholder text). | Client decision on the assistant; Exotel vSIP for the phone number and SIP credential |
| Exotel | Credentials valid. Account is **Trial, KYC not started**. One ExoPhone (…0364) exists. vSIP / v2 Trunks API **not enabled**. | Client KYC and Exotel activation; written pricing from Exotel |
| WhatsApp | Code ready; test-number onboarding not done; `META_APP_SECRET` is placeholder text. Live number untouched. | Client's test-number Embedded Signup |
| GA4 / Search Console | Working (read-only reports succeed) | — |
| PayPal | Credentials accepted (live). Shown with an "Unsafe for testing" warning in development. | Sandbox credentials for development |
| ShipGlobal | Login rejected with HTTP 401 — the request format was verified as correct. | ShipGlobal label-API access for the account |

**Readiness:** the `/test` dashboard reported **68 %** agent readiness on 8 November. Since then, the following has been fixed in code: the Gemini fallback, quota handling and the Vapi diagnostics. The remaining blockers are all account-side or provider-side. They are listed in the client action list below.

**Completed non-billable work this round:**
- Gemini quota handling, so the dashboard and agents no longer use up the daily quota.
- Clearer health-dashboard states, including "placeholder credentials", "client action required" and "quota restriction".
- Placeholder secrets are now refused by the Vapi, WhatsApp and cron endpoints.
- A safety warning when PayPal is in live mode during development.
- ShipGlobal failed logins are no longer re-sent repeatedly.
- 217 automated tests and 19 HTTP route checks, all passing.

---

## 1. Vapi

### What exists in the Vapi organisation (read-only GET, 8 Nov 2026 10:38 UTC)

| Object | Count | Detail |
|---|---|---|
| Assistants | 1 | "Riley" (ID …8abc), created 2026-11-07. It is Vapi's default template: model `openai/gpt-4.1`, no server URL, no tools. It is **not** connected to Marina. |
| Phone numbers | 0 | — |
| SIP credentials | 0 | — |

### Exact HTTP 400 response (reproduced with the same read-only request)

```
Timestamp:        2026-11-08T10:38:36.665Z (sent) · response Date: Sun, 08 Nov 2026 10:38:38 GMT
Method / endpoint: GET https://api.vapi.ai/assistant/<VAPI_ASSISTANT_ID>
                  (the value sent was placeholder text, 17 characters, not a UUID)
Request headers:  Authorization: Bearer ********bffc
Status:           400 Bad Request
Response headers: content-type: application/json; charset=utf-8 · server: cloudflare
Request ID:       none returned by Vapi; Cloudflare ray ID a573f2feedccf507-DEL
Body:             {"message":["id must be a valid UUID."],"error":"Bad Request","statusCode":400}
```

**Cause:** the assistant ID in the configuration was placeholder text. Vapi only accepts UUIDs, so it rejected the request before checking anything else. The API key itself is valid: listing assistants returns HTTP 200, and a deliberately wrong key returns 401. Our dashboard used to label this 400 as an authentication failure. That was our bug, and it is now fixed: IDs are format-checked locally and placeholders are never sent.

### What can be configured, and by whom

| Component | Can developer configure? | Client action needed? | Cost / approval required? | Current status |
|---|---|---|---|---|
| Assistant | Yes, technically: Vapi's API (`POST /assistant`) and our "Sync Vapi assistant" action can create or configure an assistant with Gemini and Marina's two tools (`lookup_product`, `record_enquiry`) using the existing key. | **Yes — decision:** create a new "Marina" assistant, or convert "Riley" (which overwrites Riley's settings). | Approval required: it changes the client's Vapi account. Creating an assistant has no published fee. Calls are billed per minute (see costs). | Not configured (placeholder) |
| Webhook secret | Yes. Generated by us, not by Vapi. | No | No cost. Not generated yet, so that no environment configuration changes without approval. | Placeholder |
| SIP credential (BYO trunk) | Yes, via `POST /credential` (provider `byo-sip-trunk`), **once Exotel provides the trunk**. | Yes: Exotel must enable vSIP and create the trunk. | Depends on Exotel's vSIP pricing (unconfirmed). Vapi's own SIP transport is listed as "Free". | Not possible yet: Exotel vSIP not enabled |
| Phone number | Yes, via `POST /phone-number` (provider `byo-phone-number`, ExoPhone + credential ID), after the SIP credential exists. | Yes: needs the ExoPhone on an Exotel vSIP trunk. | Vapi's free numbers are US-only and inbound-only, so not suitable for an Indian number. BYO import of the ExoPhone has no published Vapi fee. | Not possible yet |

**Details Exotel must provide for the SIP credential**, per Exotel's SIP trunking docs:
- **Trunk:** `trunk_sid`.
- **SIP domain:** `<account_sid>.pstn.exotel.com`.
- **Transport:** TLS on port 443 (recommended) or TCP on 5070.
- **Outbound authentication**, one of:
  - digest credentials (`user_name` and `password` created on the trunk), or
  - Exotel whitelisting Vapi's signalling IPs `44.229.228.186/32` and `44.238.177.138/32`.
- **Inbound:** a trunk destination URI of `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai`, plus the ExoPhone mapped to the trunk.
- Exotel's exact gateway IPs and media ranges are on its docs portal and should be confirmed by Exotel for this account.

### Webhook secret — procedure (not executed; awaiting approval)

1. **Generate locally:** `openssl rand -hex 32`, or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Vapi does not generate it.
2. **Store** it in `VAPI_WEBHOOK_SECRET`: `.env.local` for development and the server's environment for production. Never in source control.
3. **Configure in Vapi:** the assistant's server URL `https://marinamuseinternational.com/api/ai/voice/webhook`, with header `x-vapi-secret: <secret>`. Our admin action *Admin → Marina AI → Health → "Sync Vapi assistant"* writes both, so the assistant must be synchronised once it exists.
4. **How the app validates:** `/api/ai/voice/webhook` accepts a request only if `x-vapi-secret` or `Authorization: Bearer` matches the secret. The comparison is constant-time. Secrets that are missing, shorter than 24 characters or placeholder text are refused.
5. **Test without a call:** `npm run check:routes` sends unsigned and wrong-secret requests, which must get 401. With `VAPI_SECRET=<secret>` set for the script, it also sends a correctly signed test request, which must be accepted.

---

## 2. Gemini

### Model verification
- **Configured model:** `gemini-3.8-flash`.
  - It is listed for this key (models.list) and on Google's pricing page.
  - Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`, with header `x-goog-api-key`.
  - The payload uses `systemInstruction`, `contents`, `generationConfig` and `safetySettings`, and it worked on 3.8 Flash earlier today.
- **Key format:** the key starts with `AQ.` (Google's newer format). Our old validator wrongly expected `AIza…`; this is fixed.
- **Alternatives:**
  - `gemini-3.5-flash` is listed for the key and answered (HTTP 200, 2.5 s), but it **is not on Google's pricing page**, so its price is unknown.
  - `gemini-3.5-flash-lite` answered (HTTP 200, about 2 s) and is priced.
  - `gemini-2.5-flash` returns 404 "no longer available to new users".
- **Fallback:** now implemented and verified.
  - Chain: `gemini-3.8-flash → gemini-3.5-flash → gemini-3.5-flash-lite`.
  - It moves to the next model on a timeout, 503, 404 or quota error.
  - It stops on an invalid key.

### Exact quota failure (8 Nov 2026 10:38 UTC, one request)

```
HTTP 429 RESOURCE_EXHAUSTED
quotaMetric:  generativelanguage.googleapis.com/generate_content_free_tier_requests
quotaId:      GenerateRequestsPerDayPerProjectPerModel-FreeTier
dimensions:   location=global, model=gemini-3.8-flash
quotaValue:   20
message:      "Generate content requests per day limit exceeded on Free Tier."
retryDelay:   76879s (≈ 21 h 21 m; Google resets daily quotas at midnight Pacific time)
```

- **Metric:** requests **per day**, per project, per model.
- **Tier:** **Free Tier**, verified from the quota ID.
- **Affected scope:** the API key's Google Cloud project. Google applies limits per project, not per key.
- **Temporary or daily:** daily. It resets at midnight Pacific time.
- **Cause:** our own testing and health checks used up the 20 daily requests:
  - each dashboard load sent live prompts,
  - a 503 retry counted twice,
  - and our investigation sent probes too.

  It is not a billing misconfiguration or a per-minute limit.

### Timeout analysis
- Earlier timeouts on 3.8 Flash were **separate from the quota**. Google returned `503 UNAVAILABLE "This model is currently experiencing high demand"`, or nothing within 20–30 s. The same key on 3.5 Flash answered in 1–5 s.
- **Fixes:**
  - A timed-out model is no longer retried; the request goes to the fallback.
  - The first model gets at most half of the 30 s budget, so the fallback always has time.
  - A long 429 is not retried at all.
- **Quota-aware changes** (these reduce usage, they never increase it):
  - After a 429 whose wait exceeds one minute, the model is skipped, with no request, until Google's reset time.
  - `/test` reuses its live Gemini result for 10 minutes instead of calling Gemini on every load.

### Cost estimate (verified official prices only)

Google's official pricing page (aistudio.google.com/docs/pricing, read 8 Nov 2026), paid tier, per 1 million tokens:

| Model | Input | Output (includes thinking tokens) |
|---|---|---|
| gemini-3.8-flash | $0.75 until 31 Dec 2026 → **$1.50 from 1 Jan 2027** | $3.75 → **$7.50 from 1 Jan 2027** |
| gemini-3.5-flash-lite | $0.30 | $2.50 |
| gemini-3.5-flash | **UNKNOWN (not listed)** | **UNKNOWN** |

**Assumptions** (not measured; adjust with real traffic):
- 4 Gemini replies per chat or WhatsApp conversation.
- 2,000 input and 400 output tokens per chat or WhatsApp reply.
- Voice: 1 Gemini call-summary per call (3,000 in / 400 out). Live voice conversation is billed through Vapi, not counted here.
- Growth agent: 4,000 in / 1,500 out per request. Google Search grounding stays within the 5,000 free searches per month.
- 30 days per month.

| Scenario | Chats/day | WhatsApp conv./day | Calls/day | Growth requests/day | Gemini requests/day | 3.8 Flash, 2026 prices | 3.8 Flash, from Jan 2027 | 3.5 Flash-Lite |
|---|---|---|---|---|---|---|---|---|
| Low | 20 | 10 | 5 | 5 | 130 | **$12.66 / month** | $25.31 | $6.79 |
| Expected | 100 | 50 | 20 | 10 | 630 | **$58.84 / month** | $117.68 | $31.43 |
| High | 500 | 200 | 60 | 20 | 2,880 | **$263.93 / month** | $527.85 | $140.79 |

INR figures are not given because no verified exchange rate was used. Taxes are not included.

### Is a billing upgrade necessary?
- **For development testing:** no.
  - The free tier still allows 20 requests per day per model.
  - The fallback keeps the agents answering.
  - The new quota handling stops the dashboard from using up the quota.
- **For production:** the evidence says **yes**.
  - The verified Free Tier limit is 20 requests per day per model.
  - Even the low scenario needs about 130 requests per day.
  - Google's own rate-limits page states that Tier 1 is reached by linking an active billing account, typically instantly. It also lists a $10 per 10-minute spend limit on Tier 1.
- **Our recommendation:** the client enables billing on the project only before go-live, and sets a budget alert.
- **Not done:** we have not changed billing or the account.

---

## 3. Exotel

### Verified account facts (read-only, v1 API on `api.exotel.com`, Singapore cluster)

| Item | Value |
|---|---|
| Authentication | Valid (API key, token and SID accepted) |
| Plan / status / billing | **Trial** · active · prepaid |
| KYC | **notstarted** |
| ExoPhones | **1** (…0364). `EXOTEL_PHONE_NUMBER` is not yet set in the app. |
| vSIP / v2 Trunks API | `GET /v2/accounts/{sid}/trunks` returns **HTTP 400** `"Exotel API Version v2 not supported. Contact Exotel for details."`. The request matches Exotel's documented endpoint and the same credentials work on v1, so the feature is not enabled on this account. |

### Technical requirements checklist

| # | Requirement | Owner | Source |
|---|---|---|---|
| 1 | Complete KYC on the Exotel account | Client | Exotel SIP trunking quickstart lists "Exotel account with KYC completed" as a prerequisite |
| 2 | Move the account from Trial to a plan that includes SIP trunking | Client + Exotel | Trial limits are not published; Exotel must confirm |
| 3 | Enable vSIP / SIP trunking and the v2 Trunks API (`/v2/accounts/{sid}/...`) | Exotel | Account returns "v2 not supported"; enablement steps are not published |
| 4 | Create a trunk: `trunk_name`, `nso_code` `ANY-ANY`, `domain_name` `<sid>.pstn.exotel.com` | Developer (via API, after 3) | developer.exotel.com, dynamic SIP trunking |
| 5 | Map the ExoPhone (…0364) to the trunk | Developer (after 4) | same |
| 6 | Outbound authentication: digest credentials on the trunk, or whitelisted Vapi IPs 44.229.228.186/32 and 44.238.177.138/32 | Developer (after 4) | Exotel + Vapi docs |
| 7 | Inbound destination URI `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai`, TLS 443 / TCP 5070 per Exotel | Developer | Exotel + Vapi docs |
| 8 | Vapi BYO SIP credential + BYO phone number (see Vapi section) | Developer | Vapi docs |
| 9 | Missed-call StatusCallback to `https://marinamuseinternational.com/api/ai/voice/webhook?provider=exotel&token=…` | Developer | Implemented; token set |
| 10 | Firewall: Exotel media UDP 10000–40000; Vapi media UDP 40000–60000 | Exotel/Vapi confirm | Published docs (Exotel's exact IP pools are on its docs portal and need confirmation) |
| 11 | Number portability / extra numbers | Not required: the existing ExoPhone can be used | — |

### Cost breakdown

| Item | Published price | Account-specific (awaiting Exotel in writing) |
|---|---|---|
| Account plan (Trial → paid) | Not published (exotel.com/pricing shows no plan prices for APIs/telephony) | **Awaiting** |
| vSIP / SIP trunk activation | Not published | **Awaiting** |
| v2 API activation | Not published | **Awaiting** |
| ExoPhone rental | Not published | **Awaiting** |
| Incoming / outgoing per-minute rates | Not published | **Awaiting** |
| Setup / activation fees, minimum monthly commitment | Not published | **Awaiting** |
| KYC / compliance charges | Not published | **Awaiting** |
| Taxes (GST) | Not stated | **Awaiting** |
| Vapi (per call) | $0.05/min hosting + model, voice and transcriber at provider cost (vapi.ai/pricing, read 8 Nov 2026); Vapi SIP transport "Free"; carrier charges billed by the carrier | — |

The only prices on exotel.com are for its contact-centre products (XPrime "$70", XPro "$100", billing period and currency not stated). These are not the API/vSIP service needed here and must not be taken as its cost.

**Questions for Exotel support** (account SID to be quoted by the client):
1. Can this account (Singapore cluster, currently Trial) be enabled for vSIP / SIP trunking and the v2 Trunks API? What plan is required?
2. One-time activation or setup fees, and any minimum monthly commitment, for vSIP?
3. Monthly rental for the existing ExoPhone (…0364), and for any additional number?
4. Per-minute rates for incoming and outgoing calls, both over SIP trunk and PSTN, for Indian numbers?
5. KYC documents required for this account, and any KYC or compliance charge?
6. Are prices inclusive or exclusive of GST?
7. The exact SIP gateway FQDN/IPs, ports and media IP ranges for this account. Does the trunk support digest authentication, IP whitelisting, or both?
8. Any restriction on routing calls to a third-party SIP endpoint (Vapi, `*.sip.vapi.ai`)?

---

## 4. WhatsApp — test number only

**Confirmed:**
- The live number (+91 74570 99540) was not registered, migrated, deregistered, modified or messaged.
- The code also hard-blocks it from signup and outbound sending unless written production approval is set.
- Automatic outbound replies remain **off**.

### What is implemented (inspected and tested with mocks)
- **Embedded Signup v4:** coexistence mode (`featureType: whatsapp_business_app_onboarding`, `sessionInfoVersion: 3`), authorization-code flow, Graph API `v26.0`.
- **Backend exchange:** `POST /api/meta/whatsapp/signup/exchange`.
  - Restricted to the main admin, same-origin only, and rate-limited.
  - Replayed codes are blocked.
  - Only the configured test number is allowed.
  - The code is exchanged server-side at `graph.facebook.com/v26.0/oauth/access_token`, using `META_APP_ID` and `META_APP_SECRET`.
- **Token storage:** the access token is encrypted with AES-256-GCM (key derived from `AUTH_SECRET`) and is never shown.
- **After signup:**
  - Verify the number (`is_on_biz_app` and `platform_type = CLOUD_API`).
  - `POST /{waba}/subscribed_apps`.
  - Optionally, one-time contacts and history sync via `POST /{phone-number-id}/smb_app_data`, each confirmed per click.
- **Webhook:** `/api/meta/whatsapp/webhook`, with the verify-token handshake and an HMAC-SHA256 `X-Hub-Signature-256` check against `META_APP_SECRET`.
  - Fixed this round: a placeholder app secret is now treated as "not configured".
  - Previously, a webhook signed with the guessable placeholder would have been accepted.
- **Events handled:** messages, statuses, `history`, `smb_app_state_sync`, `smb_message_echoes` (human takeover), STOP/START, duplicates.
- **Current stored IDs:** from a simulated run, and labelled as samples on `/test`. They are not real.

### Client checklist — test-number signup
1. **Meta app → Settings → Basic:** copy the **App Secret**. Send it only through a secure channel (password manager share or a one-time secret link), or enter it directly on the server. Not by email or chat.
2. **Meta app → WhatsApp → Configuration:**
   - Callback URL `https://marinamuseinternational.com/api/meta/whatsapp/webhook`.
   - Verify token: we provide this through the same secure channel.
   - Subscribe `messages`, `history`, `smb_app_state_sync`, `smb_message_echoes` and `account_update`.
3. Confirm the Embedded Signup **configuration ID** belongs to this app and has WhatsApp Business App onboarding (coexistence) enabled.
4. On the phone that holds the **client’s designated test number** (to be confirmed by the client — see the correction note at the top), use the WhatsApp Business app, version 2.24.17 or later.
5. Log in to `/admin` as the main admin → WhatsApp → "Start test signup", and complete Meta's popup **with the test number only**. Scan the QR code from the Business app when Meta asks.
6. **What the system receives automatically:** the authorization code is exchanged for a token by our server, along with the WABA ID and phone number ID. No IDs need to be copied by hand.
7. Tell us when done. We then verify the number, subscribe the app and send one inbound test message from another phone. Replies stay withheld unless you approve otherwise.

---

## 5. Engineering

### Bugs fixed this round (no production behaviour or external charges changed)
1. **Gemini quota burn:**
   - A model whose quota is exhausted is skipped until Google's reset time.
   - The `/test` result is cached for 10 minutes.
   - A long 429 is never retried.
2. **Gemini:** 429 is now classified as "quota", separate from timeout (temporary) and 403 (API restriction). A model out of quota while the fallback works shows as "API operation successful", with a quota warning.
3. **Health dashboard:** the new states listed below.
4. **Vapi:**
   - Placeholder IDs and secrets are classified as "placeholder credentials".
   - The missing assistant is classified as "client action required".
5. **Cron:** `cronAllowed` refuses a placeholder `CRON_SECRET`. A real secret behaves exactly as before.
6. **WhatsApp:** the webhook signature check refuses a placeholder `META_APP_SECRET`.
7. **PayPal:** the card shows "Connected" when the credentials are accepted, plus an "Unsafe for testing" badge when live mode is used outside production. Previously this was wrongly shown as "Not connected".
8. Also from earlier today:
   - Gemini `AQ.` key validator.
   - Working fallback chain.
   - Vapi key checked separately from IDs.
   - Exotel plan, KYC and ExoPhone reporting (and the earlier "0 ExoPhones" error, corrected).
   - ShipGlobal: a rejected login is not re-sent for 6 hours.
   - Placeholder Vapi webhook secret refused.

**Dashboard states now distinguished:**
1. Not configured
2. Placeholder credentials
3. Credentials present
4. Authentication verified
5. API operation successful
6. External activation required
7. Client-side action required
8. Provider quota restriction
9. Provider API restriction
10. Internal code/configuration error
11. Timeout/temporary failure
12. Production activity verified

Plus "Authentication failed" and "Configuration incomplete". Each failing step shows the HTTP status, the cause, internal or external, whether the client is needed, and the next action.

### Files changed (this round and earlier today)
- **Core:** `lib/ai/http.ts`, `lib/ai/gemini.ts`, `lib/ai/integration-status.ts`, `lib/ai/integrations.ts`, `lib/ai/health.ts`, `lib/ai/vapi.ts`, `lib/ai/exotel.ts`, `lib/ai/env-registry.ts`, `lib/ai/usage.ts`, `lib/ai/cron.ts`
- **Other:** `lib/shipglobal.ts`, `lib/whatsapp/cloud.ts`, `lib/whatsapp/coexistence.ts`, `app/test/page.tsx`
- **Tests:** `lib/ai/selftest.ts`, `lib/ai/provider-selftest.ts` (new), `scripts/check-phase2.ts`
- **Generated:** `.env.example` and `docs/phase2/ENVIRONMENT_SETUP.md`

### Tests run

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | Pass (0 errors) |
| `npm run check:phase2` (logic tests and mocked provider tests) | **217 passed, 0 failed** |
| `BASE_URL=http://localhost:3000 npm run check:routes` (refused or read-only requests only) | **19 passed, 0 failed** |
| `npx next build` (isolated copy, deleted afterwards) | Pass: 74 pages generated. The compiler printed a "compiled with warnings" notice that was not inspected. |
| ESLint | **Not run:** ESLint is not installed or configured in this project, and no dependencies were added |

**What the mocked tests cover:**
- HTTP 400, 401, 403, 404 and 429 (per-minute, and the real daily-quota response), plus 503, timeouts and network errors.
- Retry-After handling.
- The fallback after a timeout, 503, 404 and 429, with no fallback on an invalid key.
- The quota cooldown sends no further requests.
- Placeholder and invalid IDs; missing variables.
- Webhook signatures: valid, forged and placeholder secret.
- Cron authorization: correct, wrong, missing, unset and placeholder secret.
- Exotel XML errors and ExoPhone parsing.
- Credentials never appear in results.

Mocked tests prove our handling, not the providers. The live results above come from real read-only requests.

### Remaining issues
- **Scheduled jobs:** have never run, because no scheduler is configured on the server. This is a deployment step that needs approval.
- **PayPal:** development uses live-only credentials. Sandbox credentials are needed before any local checkout test.
- **Admin password:** still the sample value (from the earlier audit).
- **ShipGlobal:** label-API access not granted for the account (HTTP 401; request format verified).
- **`package-lock.json`:** shows as modified, but not by this work. Review it before committing.

---

## Client action list

1. **Gemini:** before go-live, enable billing on the API key's Google Cloud project (Tier 1), with a budget alert. Not needed for development testing.
2. **Vapi:** decide whether we create a new "Marina" assistant or convert "Riley". Approve generating the webhook secret and synchronising the assistant.
3. **Exotel:**
   - Complete KYC.
   - Send Exotel the eight questions above.
   - After written pricing is approved, request the move off Trial and vSIP / v2 Trunks API enablement.
4. **WhatsApp:** carry out the test-number checklist. Share the App Secret through a secure channel only.
5. **PayPal:** provide sandbox credentials for development.
6. **ShipGlobal:** ask ShipGlobal to enable label-API access for the account email, or confirm its password.

---

## Client response draft (not sent)

> Dear [Client name],
>
> Thank you for the clarifications. We have completed the investigation using read-only checks only. No calls were placed, no WhatsApp messages were sent, no payments, orders or shipments were created, nothing was purchased or activated, and your live WhatsApp number (+91 74570 99540) was not touched.
>
> **1. Vapi**
> Your private API key works. Your Vapi account currently has one assistant, "Riley" (Vapi's default template, using OpenAI GPT-4.1, not connected to our system), and no phone number or SIP credential.
> The HTTP 400 you asked about, reproduced on 8 Nov 2026 at 10:38 UTC (GET /assistant/{id}): `{"message":["id must be a valid UUID."],"error":"Bad Request","statusCode":400}`. The assistant ID in our configuration was a placeholder, not a real ID. It was not a key problem, and our dashboard now reports this correctly.
> - *We can do (with your approval):* create a "Marina" assistant using Gemini and our product and enquiry tools, or convert Riley if you prefer; generate the webhook secret and link it to the assistant. There is no setup fee for this. Calls cost $0.05/min Vapi hosting plus model and voice charges at provider cost.
> - *Needs Exotel first:* the SIP credential and phone number. Vapi's free numbers are US-only, so your ExoPhone must be connected over Exotel SIP trunking (vSIP).
>
> **2. Gemini**
> The key is valid. The 429 is Google's **Free Tier daily limit: 20 requests per day for gemini-3.8-flash** (quota "GenerateRequestsPerDayPerProjectPerModel-FreeTier"). It resets at midnight Pacific time. Our own testing used up that allowance, and we have changed the system so health checks no longer consume it. The earlier timeouts were separate: Google reported 503 "high demand" on 3.8 Flash. Replies now fall back automatically to gemini-3.5-flash, which answered in about 2.5 s.
> Estimated Gemini cost on 3.8 Flash at Google's published prices ($0.75 input / $3.75 output per million tokens until 31 Dec 2026, doubling from 1 Jan 2027): about **$13 / $59 / $264 per month** for low, expected and high usage (130 / 630 / 2,880 requests per day; assumptions in the attached report). Since even low usage exceeds 20 requests per day, **billing (Tier 1) will be needed before go-live**, but not for testing.
>
> **3. Exotel**
> The credentials work. Your account is a **Trial** account, **KYC not started**, with one ExoPhone (ending 0364). SIP trunking is not enabled: Exotel returns "API Version v2 not supported". Exotel's KYC requirement for SIP trunking is published. Prices for plans, vSIP, number rental and per-minute calls are **not published**, so the attached report includes the exact questions to send Exotel. We recommend completing KYC and getting Exotel's written quote before any upgrade.
>
> **4. WhatsApp**
> Everything is ready for your designated test number once you confirm it to us (it is not +91 90274 97288, which is our developer’s own testing number). The attached checklist shows the steps on your side. After you complete Meta's signup with the test number, our server receives the token and IDs automatically. Please share the Meta App Secret only through a secure channel, not by email or chat. Automatic replies remain off.
>
> **What we need from you:** your decision on the Vapi assistant; KYC and the Exotel quote; Google billing before go-live; the test-number signup; PayPal sandbox credentials; and ShipGlobal label-API access.
>
> The full technical report with evidence is attached (CLIENT_TECHNICAL_STATUS_2026-11-08.md).
>
> Kind regards,
> [Your name]
