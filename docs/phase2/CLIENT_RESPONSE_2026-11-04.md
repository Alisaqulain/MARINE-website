# Phase 2 integrations — audit findings and response to the client (4 November 2026)

All results below come from the codebase and from **read-only** checks run on 4 November 2026 with the credentials in the development `.env.local`. Nothing was purchased, upgraded, activated, onboarded, sent or called. No credential value is reproduced here (account SIDs are masked).

---

## 1. Technical audit findings

| Area | Finding | Evidence |
| --- | --- | --- |
| Gemini | Key valid; configured model `gemini-3.8-flash` exists, but a real generation returned **HTTP 503 "This model is currently experiencing high demand"** | `/test` live check (models.get = 200, generateContent = 503) |
| Gemini code | Correct API usage (`v1beta/models/{model}:generateContent`, `x-goog-api-key` header, system instruction, timeouts, one retry on 429/5xx, catalogue fallback). **Gap:** no `thinkingConfig`; on thinking models the reasoning tokens count against `maxOutputTokens` (1,024 for replies) and are billed as output — can truncate replies and raise cost | `lib/ai/gemini.ts`, `lib/ai/crm.ts:146` |
| Vapi | Private key **accepted**; no assistant, phone number, SIP credential or webhook secret configured | `GET /assistant?limit=1` = 200 |
| Exotel | v1 credentials **accepted** on the Singapore cluster; **v2 vSIP trunk API returns HTTP 400 "Exotel API Version v2 not supported"** | see §2 |
| WhatsApp | Test mode active (signup restricted to the test number ending …7288); **`META_APP_SECRET` is wrong** — Meta rejected the app token with error 190 "Invalid OAuth access token signature" | coexistence check |
| Google | No service account configured (`GOOGLE_SERVICE_ACCOUNT_JSON` empty) | env registry |
| Config | `PAYPAL_MODE=live` while the app runs in development (`AUTH_URL=http://localhost:3000`) — a local test checkout would charge real money | `.env.local` |
| Config | `EXOTEL_REGION` is set but not read by the code; the cluster is selected only by `EXOTEL_SUBDOMAIN` (correctly `api.exotel.com` = Singapore) | `lib/ai/exotel.ts` |
| Config | `ADMIN_PASSWORD` was still the sample value at the last audit — must be changed before production | env registry |

---

## 2. Exotel — exact endpoint and error

The code first validates the credentials on v1, then checks SIP trunking on the v2 vSIP API (`lib/ai/exotel.ts`, function `pingExotel`). The v2 paths are the ones used in Exotel's own Exotel-Vapi-Connector repository, because Exotel's public v2 API reference page returned 404 during implementation.

**Request that fails**

```
GET https://api.exotel.com/v2/accounts/<ACCOUNT_SID>/trunks
Authorization: Basic base64(<API_KEY>:<API_TOKEN>)
Accept: application/json
```

**Response (4 Nov 2026, 14:28:05 GMT)**

```
HTTP/1.1 400
Content-Type: application/xml
Server: Apache

<?xml version="1.0" encoding="UTF-8"?>
<TwilioResponse>
 <RestException>
  <Status>400</Status>
  <Message>Exotel API Version v2 not supported. Contact Exotel for details.</Message>
 </RestException>
</TwilioResponse>
```

**Control requests (same credentials, same minute)**

| Request | Result | Meaning |
| --- | --- | --- |
| `GET https://api.exotel.com/v1/Accounts/<SID>/Calls.json?PageSize=1` | **HTTP 200** (JSON, `Server: istio-envoy`) | credentials and account are valid on the Singapore cluster |
| `GET https://api.in.exotel.com/v2/accounts/<SID>/trunks` | **HTTP 401** `{"http_code":401,"response":[{"code":401,"error_data":{"code":1010,"message":"Authorization failed"}}]}` | the Mumbai cluster serves the v2 API, but this account is not on that cluster |

**What the evidence shows / does not show**

- Shown: the account authenticates on v1 (Singapore); the Singapore host answers v2 requests from a legacy endpoint that says v2 is **not supported for this account**; v2 exists on the Mumbai cluster but these credentials are not valid there.
- **Not shown — needs Exotel to confirm:** whether the cause is (a) the trial plan, (b) the Singapore region not offering the v2 / vSIP API, or (c) vSIP / SIP trunking not being provisioned on the account. We do not guess between these.

---

## 3. Gemini — recommended model and estimated costs

**Recommendation: `gemini-2.5-flash`** (set `GEMINI_MODEL=gemini-2.5-flash`).
- Google labels it *"Stable version of Gemini 2.5 Flash"* (models.get on this key); `gemini-3.8-flash` carries no stable label and was rate-limited (503) during our check.
- Supported as a Vapi model (`model.provider: "google"`), so one model serves all four agents.
- Cheaper; replies are short and grounded in catalogue facts, so a larger model adds little.
- Lowest-cost alternative: `gemini-2.5-flash-lite` (also Stable).

**Prices used (per 1 million tokens, paid tier, text):** these come from third-party summaries of Google's price list and **must be confirmed on ai.google.dev/pricing** before budgeting.

| Model | Input | Output (incl. thinking) |
| --- | --- | --- |
| gemini-2.5-flash-lite | $0.10 | $0.40 |
| gemini-2.5-flash | $0.30 | $2.50 |
| gemini-3.8-flash | $0.75 (reported to rise to $1.50 on 1 Jan 2027) | $3.75 (reported $7.50 from 1 Jan 2027) |

**Assumptions per request** (a chat/WhatsApp reply): ~2,000 input tokens (rules + catalogue facts + recent conversation) and ~300 output tokens. "With thinking" adds ~800 thinking tokens billed as output (today's code does not limit thinking).

| Requests | 2.5 Flash-Lite | 2.5 Flash | 2.5 Flash + thinking | 3.8 Flash | 3.8 Flash + thinking |
| --- | --- | --- | --- | --- | --- |
| 1,000 | $0.32 | $1.35 | $3.35 | $2.63 | $5.63 |
| 10,000 | $3.20 | $13.50 | $33.50 | $26.25 | $56.25 |
| 100,000 | $32 | $135 | $335 | $262.50 | $562.50 |

Actual cost depends on real input/output token counts (longer conversations and content drafts cost more; a buying-guide draft can be 10× a chat reply). The free tier has strict rate limits and Google may use free-tier data to improve its products, so production should run on a **paid (billing-enabled) Google AI Studio / Cloud project**. A Gemini app subscription (Gemini Advanced / Google One AI) **does not include API credits**.

**Recommended code adjustment (not yet made):** set a thinking budget (e.g. off for chat/WhatsApp replies on 2.5 Flash) or raise `maxOutputTokens`, so thinking cannot truncate replies or inflate cost. Needs the model decision first.

---

## 4. Vapi + Exotel voice architecture

Exotel numbers cannot be imported into Vapi directly; the supported path is **SIP trunking**:

```
Customer ──PSTN──▶ ExoPhone (Exotel, India number) ──Exotel vSIP trunk──▶ <VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai
                                                                                │
                              Vapi assistant (Gemini) ◀── tool calls / reports ──▶ https://marinamuseinternational.com/api/ai/voice/webhook
Outbound (owner-approved only): Vapi BYO SIP credential ──▶ Exotel PSTN gateway ──▶ customer
Missed calls: ExoPhone StatusCallback ──▶ /api/ai/voice/webhook?provider=exotel&token=…
```

**Order of setup and the missing values**

| Step | Who | Result / variable |
| --- | --- | --- |
| 1 Exotel enables vSIP / SIP trunking, creates a trunk, maps the ExoPhone, whitelists Vapi SIP IPs 44.229.228.186/32 and 44.238.177.138/32, gives the gateway address for outbound | Exotel | `EXOTEL_TRUNK_SID`, `EXOTEL_PHONE_NUMBER` |
| 2 Vapi BYO SIP trunk credential pointing at the Exotel gateway | us (free to create) | `VAPI_SIP_CREDENTIAL_ID` |
| 3 Exotel trunk destination = `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai:5060;transport=tcp` | Exotel | — |
| 4 Vapi BYO phone number (the ExoPhone) on that credential | us | `VAPI_PHONE_NUMBER_ID` |
| 5 Vapi assistant, then "Sync Vapi assistant" (Gemini model, Marina tools, webhook) | us | `VAPI_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET` |
| 6 Missed-call callback token | us | `EXOTEL_WEBHOOK_TOKEN` |

**Can the phone number be configured before Exotel SIP provisioning?** The Vapi assistant can be created now. A Vapi BYO phone number needs a SIP credential, and that credential needs the Exotel gateway address — so the number can technically be created as a record, but **it cannot carry calls until Exotel provisions the trunk** (steps 1 and 3). We recommend waiting for Exotel's answer before creating it.

**Estimated per-minute cost** (estimates from third-party summaries; confirm on vapi.ai/pricing and with Exotel):

| Component | Estimate |
| --- | --- |
| Vapi platform fee | ~$0.05 / min |
| Speech-to-text (via Vapi, e.g. Deepgram) | ~$0.01 / min |
| Text-to-speech voice (depends on provider/voice) | ~$0.02–0.04 / min |
| Gemini 2.5 Flash (≈6 turns/min, ≈3k input tokens per turn) | ~$0.005–0.01 / min |
| **Vapi + AI subtotal** | **≈ $0.09–0.11 / min** |
| Exotel telephony minutes + ExoPhone rental + vSIP | **not published — quote required from Exotel** |

Paid activation needed: Vapi (credit/billing), Exotel plan upgrade with vSIP (KYC), Gemini paid tier.

---

## 5. WhatsApp — test-number-only readiness

| Item | Status |
| --- | --- |
| Embedded Signup v4, config 1760993601871515, `featureType: "whatsapp_business_app_onboarding"`, code flow | ✅ implemented |
| Finish event `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` (WABA-only payload supported); standard `FINISH` refused | ✅ |
| Server-side code exchange, encrypted token, replay protection, main-admin only | ✅ |
| Test-number restriction: only the number ending **…7288** can be onboarded; any other number has its token deleted immediately; the client's live number is always refused | ✅ active (test mode) |
| Webhooks: messages, statuses, `history`, `smb_app_state_sync`, `smb_message_echoes`, duplicates, signature + verify token | ✅ implemented, tested with signed simulations |
| `/register` / `/deregister` never called; no outbound messages (outbound flag off) | ✅ |
| **`META_APP_SECRET` invalid** (Meta error 190) | ❌ must be corrected before any test signup |
| `META_APP_ID`, `META_CONFIG_ID` not set in env (code uses the supplied IDs as defaults) | ⚠ set explicitly |
| Public HTTPS webhook + subscribed fields (messages, history, smb_app_state_sync, smb_message_echoes, account_update) | ⏳ needs production deployment |
| Tech Provider / Solution Partner status; WhatsApp Business app ≥ 2.24.17 on the test phone | ⏳ client to confirm |

Remaining steps (test number only): correct the app secret → deploy on HTTPS → configure webhook and fields in the Meta app → client approves the test onboarding (it changes the test phone's Business app: companion devices on Windows/WearOS unlink, broadcast lists become read-only) → run signup → verify number → subscribe → optional one-time syncs within 24 h.

---

## 6. Google Analytics 4 and Search Console

**Service account:** none exists in this project yet, so there is no email to share. Recommended approach that keeps the key off chat:
1. We create a Google Cloud project for the site, enable **Google Analytics Data API** and **Google Search Console API**, and create a service account (e.g. `marina-analytics@<project-id>.iam.gserviceaccount.com`).
2. We send the client **only the service-account email** (it is not secret).
3. The JSON key is created and copied **directly to the server** (`GOOGLE_SERVICE_ACCOUNT_JSON` in `.env.production.local`) by the person deploying — never pasted into chat or email.

**Permissions (minimum required by our code — read-only scopes `analytics.readonly` and `webmasters.readonly`):**

| Service | Where | Grant |
| --- | --- | --- |
| GA4 | Admin → Property → Property access management → + Add users | service-account email as **Viewer** |
| Search Console | Settings → Users and permissions → Add user | service-account email as **Restricted** (Full is not needed; our code only reads site details and search analytics). If Google returns 403 for search analytics, upgrade to Full. |

**Formats**
- `GA4_PROPERTY_ID`: the **numeric Property ID** from Admin → Property details (e.g. `123456789`) — not the `G-XXXX` measurement ID.
- `SEARCH_CONSOLE_SITE_URL`: `sc-domain:marinamuseinternational.com` for a Domain property, or `https://marinamuseinternational.com/` (with trailing slash) for a URL-prefix property.
- Optional for purchase tracking: `GA4_MEASUREMENT_ID` (`G-XXXX`) and `GA4_API_SECRET` (web stream → Measurement Protocol API secrets).

---

## 7. Production deployment requirements

| Item | Requirement (from the codebase) |
| --- | --- |
| Domain | `https://marinamuseinternational.com` (canonical; `www` also served by nginx) |
| DNS | A/AAAA records for both names → the VPS |
| HTTPS | Let's Encrypt certificate on nginx (paths in `nginx.example.conf`); HTTP → HTTPS redirect |
| Reverse proxy | nginx → `127.0.0.1:3000`, forwarding `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`; `/_next/static/` served from disk; `client_max_body_size 15M` |
| Runtime | Node.js **20** (`.nvmrc`, `engines >=20`); `npm ci && npm run build && npm run start` under **PM2**, one fork instance per app, unique port (`ecosystem.config.example.cjs`); never `npm run dev` on the server |
| Env file | `.env.production.local` in the app folder; restart with `pm2 restart <app> --update-env`; `NEXT_PUBLIC_*` changes need a rebuild |
| Site URLs | `AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL` = `https://marinamuseinternational.com` |
| Database | Atlas network access must allow the VPS IP; `MONGODB_NODE_PROCESSES` = number of PM2 apps sharing the cluster |
| Cron | `POST https://marinamuseinternational.com/api/ai/jobs` every 15 min and `POST …/api/ai/report/daily` daily, each with `Authorization: Bearer $CRON_SECRET` (crontab with curl, or PM2 cron) |
| Webhooks | PayPal `…/api/paypal/webhook` · WhatsApp `…/api/meta/whatsapp/webhook` · Vapi server URL `…/api/ai/voice/webhook` (header `x-vapi-secret`) · Exotel StatusCallback `…/api/ai/voice/webhook?provider=exotel&token=<EXOTEL_WEBHOOK_TOKEN>` |
| PayPal | **Live mode only in production.** Development currently has `PAYPAL_MODE=live` with `localhost` — switch development to `sandbox` with sandbox credentials |
| After deploy | open `/test` (admin login) and work through each card's “Next action” |

**Required variables by integration** (names only — full list, sources and formats in `docs/phase2/ENVIRONMENT_SETUP.md`):
- Platform: `MONGODB_URI`, `MONGODB_DB_NAME`, `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAILS`, `ADMIN_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Payments/shipping: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`, `SHIPGLOBAL_EMAIL`, `SHIPGLOBAL_PASSWORD`
- Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`
- Jobs: `CRON_SECRET`
- Vapi: `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET`, `VAPI_PHONE_NUMBER_ID`, `VAPI_SIP_CREDENTIAL_ID`
- Exotel: `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_ACCOUNT_SID`, `EXOTEL_SUBDOMAIN`, `EXOTEL_PHONE_NUMBER`, `EXOTEL_TRUNK_SID`, `EXOTEL_WEBHOOK_TOKEN`
- WhatsApp: `META_APP_ID`, `META_CONFIG_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_COEXISTENCE_ENABLED`, `WHATSAPP_COEXISTENCE_TEST_NUMBER` (flags `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED`, `WHATSAPP_OUTBOUND_ENABLED` stay `false`)
- Google: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`, `SEARCH_CONSOLE_SITE_URL` (optional `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID`)

---

## 8. Paid services and approvals

Figures are **estimates** from third-party pricing summaries unless stated; confirm on each provider's official page before approval. Taxes (e.g. 18% GST in India) are extra.

| Service | Required configuration | Free / trial / paid | Estimated cost | Client approval required |
| --- | --- | --- | --- | --- |
| Gemini API | Billing-enabled project, `GEMINI_MODEL=gemini-2.5-flash` | Free tier (rate-limited) / paid per token | ≈ $1.35–3.35 per 1,000 replies on 2.5 Flash (see §3) | **Yes** — enable billing; confirm model |
| Vapi | Assistant, BYO SIP credential, BYO number, webhook secret | Pay-as-you-go (credits) | ≈ $0.09–0.11 / min (platform + STT + TTS + LLM), excluding telephony | **Yes** — before adding credit/first live call |
| Exotel phone number (ExoPhone) | Number on the account, KYC | Trial → paid plan | Plan pricing in INR (third-party: plans from ~₹4,999–9,999 upwards; extra numbers ~₹500–1,000/month) — **quote required** | **Yes** — no upgrade approved yet |
| Exotel SIP trunk (vSIP) | vSIP enabled, trunk, number mapping, IP whitelist | Not on trial (per the v2 error) — **Exotel to confirm** | **Not published — quote required** | **Yes** |
| Exotel call minutes | Per plan (pulse billing) | Paid | **Not published — quote required** | Included in the Exotel quote |
| Meta WhatsApp | Business verification, Cloud API token, templates | Customer-initiated replies within 24 h: free (Meta's free allowance rules changed in 2026 — **confirm on Meta's rate card**); templates paid per delivered message | India (third-party): utility ≈ ₹0.115, marketing ≈ ₹0.86 per message | **Yes** — templates, test onboarding, any live-number change |
| Google Analytics 4 | Property + service-account Viewer access | Free | $0 | Access grant only |
| Search Console | Verified property + service-account user | Free | $0 | Access grant only |
| Google Cloud project (service account, APIs) | Analytics Data API + Search Console API enabled | Free within API quotas | $0 expected | No (we can create it) |
| Hosting | Existing VPS + nginx + PM2, Let's Encrypt | Existing / free certificate | Existing cost | Only if a larger server is needed |
| MongoDB Atlas | Current cluster; consider a dedicated tier for production load | Existing (shared tier) | Dedicated tiers are paid — check Atlas pricing | If upgrading |
| SMTP (owner alerts) | Existing mailbox | Existing | $0 extra | No |

---

## 9. Client-ready response

> **Subject: Marina Muse — Phase 2 integrations: answers and next steps**
>
> Thank you for the details. We checked every point against the live services (read-only — nothing was purchased, activated, sent or called). Here are our answers.
>
> **1. Gemini.** Your Google AI Studio key works. We recommend the model **`gemini-2.5-flash`** — Google lists it as a *stable* model, it is supported by Vapi for the voice agent, and it costs less. The model currently configured (`gemini-3.8-flash`) returned "high demand" errors during our test. Estimated cost for chat/WhatsApp replies (about 2,000 input and 300 output tokens each): roughly **$1.35 per 1,000 replies, $13.50 per 10,000 and $135 per 100,000** (up to about 2.5× more if the model's internal "thinking" is not limited — we will limit it). Actual cost depends on message length and usage. Please enable billing on the Google project for production; a Gemini app subscription does not include API credits. *Prices to be confirmed on ai.google.dev/pricing.*
>
> **2. Vapi.** Your key works. We can create the assistant now at no cost. A phone number cannot carry calls until Exotel provisions the SIP trunk, so we will not create the number or add Vapi credit until you approve. Architecture: callers dial your Exotel number → Exotel SIP trunk → Vapi AI assistant (Gemini) → our website records the call, summary and lead. Estimated Vapi + AI cost: about **$0.09–0.11 per minute**, plus Exotel's call charges.
>
> **3. Exotel.** Your credentials work on Exotel's Singapore API (v1). The SIP-trunk API needed to connect Exotel to Vapi fails. For your support ticket:
> - **Endpoint:** `GET https://api.exotel.com/v2/accounts/<your Account SID>/trunks` (Basic authentication with your API key and token)
> - **Response:** `HTTP 400` — `Exotel API Version v2 not supported. Contact Exotel for details.`
> - **Please ask Exotel:** (1) Is the v2 / vSIP (SIP trunking) API available to Singapore-cluster accounts, and on which API host? (2) Is it unavailable because the account is on trial? (3) What plan and steps are needed to enable vSIP for routing an ExoPhone to an external SIP endpoint (Vapi), including SIP gateway details and pricing? (4) The same request on `api.in.exotel.com` returns 401 — should this account use a different cluster?
>
> No upgrade will be made without your approval.
>
> **4. WhatsApp.** The system is locked to your separate test number only; the live number is refused by the code and will not be onboarded, migrated or changed without your written approval. Before the test onboarding we need the correct **Meta App Secret** (the one we have is rejected by Meta) and the site live on HTTPS for webhooks. Please also confirm your Meta business is a Tech Provider/Solution Partner and that the test phone runs WhatsApp Business app 2.24.17 or newer.
>
> **5. Google Analytics & Search Console.** We will create a service account and send you **its email address** (no keys are shared). Please add it as **Viewer** in GA4 (Admin → Property access management) and as a **Restricted** user in Search Console (Settings → Users and permissions). Then send us the **numeric GA4 Property ID** (Admin → Property details, not the G- ID) and the Search Console property (`sc-domain:marinamuseinternational.com` or `https://marinamuseinternational.com/`).
>
> **6. Production.** Final URL: **https://marinamuseinternational.com**. Server requirements: Node.js 20, PM2, nginx with HTTPS (Let's Encrypt), DNS pointing to the server, MongoDB access from the server IP, two scheduled jobs (every 15 minutes and daily), and webhook URLs for PayPal, WhatsApp, Vapi and Exotel. PayPal will run in live mode only on production.
>
> **Approvals we need from you:** Gemini billing and model choice · Vapi credit before the first live call · Exotel plan/vSIP quote · WhatsApp test onboarding (after the app secret is corrected) · any paid template messages.
>
> Best regards

---

Sources (pricing summaries are third-party and must be confirmed with each provider): [Gemini pricing summary (morphllm)](https://www.morphllm.com/gemini-api-pricing), [Gemini pricing 2026 (maximem)](https://www.maximem.ai/blog/gemini-api-pricing-2026), [Vapi pricing (11x)](https://www.11x.ai/guides/vapi-pricing), [Vapi pricing per minute (trillet)](https://trillet.ai/blogs/vapi-pricing-per-minute), [Exotel pricing guide (cloudtalk)](https://www.cloudtalk.io/blog/exotel-pricing/), [Exotel rentals (official docs)](https://docs.exotel.com/business-phone-system/rentals), [WhatsApp API pricing India (chatmaxima)](https://chatmaxima.com/whatsapp-api-pricing/india/), [Meta WhatsApp pricing by country (go4whatsup)](https://www.go4whatsup.com/guides/meta-whatsapp-pricing/), [Exotel-Vapi-Connector](https://github.com/exotel/Exotel-Vapi-Connector), [Vapi SIP trunking](https://docs.vapi.ai/advanced/sip/sip-trunk), [Vapi Gemini provider](https://docs.vapi.ai/providers/model/gemini).
