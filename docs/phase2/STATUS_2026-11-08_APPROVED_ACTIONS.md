# Phase 2 — client-approved actions: results (8 November 2026)

**Scope:** only the non-billable work the client authorized in writing.
- No phone number or SIP service was purchased, attached or activated.
- No call was placed and no WhatsApp message was sent.
- No payment, order, shipment or label was created.
- Nothing was deployed and no production configuration changed.
- Riley and both protected WhatsApp numbers were not touched.

**Configuration changed:** only the **development** environment file (`.env.local`):
- `VAPI_WEBHOOK_SECRET` generated.
- `VAPI_ASSISTANT_ID` set.
- `WHATSAPP_COEXISTENCE_TEST_NUMBER` cleared.

A backup copy was taken before editing; it is held outside the repository. The production server's environment still needs these values; that is a deployment step awaiting approval.

---

## 1. Vapi — new assistant

| Item | Result |
|---|---|
| Assistant | **Marina Muse Assistant**, ID **`e0bf7b4e-dcb0-4be1-8f3f-c41f1512ee4d`** (created 8 Nov 2026 via `POST https://api.vapi.ai/assistant`) |
| Model | `google` / `gemini-3.8-flash` (listed in Vapi's Gemini provider docs), temperature 0.3, Marina voice-agent system instructions |
| Tools | `lookup_product` (verified catalogue price, stock, material, MOQ) and `record_enquiry` (wholesale, bulk, OEM or callback, with a consent flag). Both call our server. |
| Server URL | `https://marinamuseinternational.com/api/ai/voice/webhook` |
| Webhook messages | end-of-call-report, status-update, tool-calls, hang |
| Read-back check | `GET /assistant/{id}` returns HTTP 200. **No drift** from the site's expected configuration. The secret header stored in Vapi matches `VAPI_WEBHOOK_SECRET` (compared, not printed). |
| Riley | Unchanged: same `updatedAt` (2026-11-07T18:46:23.498Z) and the same content fingerprint before and after |
| Phone number / SIP credential | **Not created**, as instructed. They need Exotel vSIP first. |

### Webhook secret and verification
- **Generation and storage:**
  - Generated locally with `crypto.randomBytes(32)` (64 hex characters), equivalent to `openssl rand -hex 32`.
  - Stored only in the server-side variable `VAPI_WEBHOOK_SECRET` and in the assistant's server header in Vapi.
  - Never printed, logged, committed, or included in frontend code.
- **How Vapi sends it:** as the `x-vapi-secret` header. Vapi's server-authentication docs describe this header as the legacy secret mechanism, and say that headers on a saved assistant are sent with its webhooks.
- **How our server checks it:** `/api/ai/voice/webhook` accepts `x-vapi-secret: <secret>` or `Authorization: Bearer <secret>`. The comparison is constant-time. Missing, short or placeholder secrets are refused.
- **Tests against the local server, with nothing written and no call placed:**

| Request | Expected | Result |
|---|---|---|
| No auth header | 401 | **401** |
| Wrong secret | 401 | **401** |
| Secret with one character missing | 401 | **401** |
| Correct `x-vapi-secret` | 200 | **200** |
| Correct `Authorization: Bearer` | 200 | **200** |

- **Not yet verified:**
  - That Vapi actually delivers the header on a real call. This needs a live call, which is billable and not approved.
  - That the production server accepts it. That needs a deployment with `VAPI_WEBHOOK_SECRET`; until then production answers Vapi with 401.
  - Whether Vapi's Gemini usage needs a separate Google key in Vapi's provider settings, or uses Vapi's built-in Google integration. This shows on the first call.

## 2. Gemini

| | Result (8 Nov 2026, test prompts only) |
|---|---|
| Model chain (kept) | `gemini-3.8-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite` |
| Primary (3.8 Flash) | **HTTP 429**: Free Tier daily limit (20 requests per day per model) reached. **In cooldown until 2026-11-09 07:59 UTC** (Google resets at midnight Pacific). |
| Fallback (3.5 Flash) | **HTTP 200**, answered in 1.25 s and 1.20 s |
| Cooldown behaviour (real) | Call 1: primary returned 429 (875 ms), then the fallback answered. Call 2: primary **skipped with no request** (0 ms), then the fallback answered. |
| Recovery (mocked) | After the reset time passes, the primary is used again with a single request |

Two real requests went to the fallback model. This health check shows the API path works. **It is not proof that the customer-facing agents are operational.** No real agent conversation has been verified, and production still runs on the Free Tier (20 requests per day per model).

## 3. Exotel
See `docs/phase2/EXOTEL_REQUIREMENTS_AND_COST_REQUEST.md`. It contains the verified account facts, the technical checklist, the cost table (all account-specific prices are awaiting Exotel), and a ready-to-send request. The account remains on Trial.

## 4. WhatsApp
See `docs/phase2/WHATSAPP_CLIENT_ONBOARDING_GUIDE.md`.

- **The number used: none.** No signup was started.
- **Records check:** the project records do not contain the client's designated test number.
- **Problem found:** the app's signup gate was set to the developer's personal number (…7288). It has been **cleared**, so signup is closed.
- **Unchanged:** +91 74570 99540 was not touched. Automatic replies and outbound messaging remain off.
- **Configuration verified:** App ID 1588276335845243 and configuration ID 1760993601871515 match the environment. Embedded Signup v4 and Graph v26.0 match the code.
- **Still missing:**
  - the Meta App Secret,
  - the client's confirmed test number,
  - the client's confirmation that the Meta app is a Tech Provider or Solution Partner (Meta's prerequisite for coexistence onboarding).

## 5. Other checks (read-only)

| Check | Result |
|---|---|
| Database | Ping OK |
| SMTP | Login OK (`transport.verify()`, **no email sent**). Actual delivery not tested, to avoid sending mail. |
| GA4 | Token OK; read 4 sessions for the last 7 days; Measurement Protocol sample valid (debug endpoint, not recorded) |
| Search Console | Token and property access OK; read 1 query row for the last 7 days |
| Google Shopping feed | **340 items, 0 with errors** at `/feeds/google.xml`. Merchant Center scheduled fetch is not verifiable from the site: add `https://marinamuseinternational.com/feeds/google.xml` as a scheduled fetch in Merchant Center (client account). |
| PayPal | Credentials accepted (**live**). Mode routing verified: `sandbox` and unset go to `api-m.sandbox.paypal.com`; `live` goes to `api-m.paypal.com`. **Sandbox readiness:** needs a sandbox client ID, secret and webhook ID. Credentials not changed. |
| ShipGlobal | Unchanged: HTTP 401. The request format was verified correct earlier. The rejected login is not re-sent for 6 hours. No shipment created. |
| Cron | Authentication verified (correct, wrong, missing and placeholder secret tests pass); **never run**, because no scheduler is configured |
| Admin password | Still the sample value. Procedure below. No password was invented. |

### Scheduler (prepared, not installed: production change)

Add to the server crontab, with `CRON_SECRET` read from a root-only file:

```
*/15 * * * * . /etc/marina-cron.env && curl -fsS -m 60 -X POST -H "Authorization: Bearer $CRON_SECRET" https://marinamuseinternational.com/api/ai/jobs >/dev/null
0 8 * * *    . /etc/marina-cron.env && curl -fsS -m 120 -X POST -H "Authorization: Bearer $CRON_SECRET" https://marinamuseinternational.com/api/ai/report/daily >/dev/null
```

**Approval note:**
- The follow-up job sends checkout and enquiry recovery emails to customers who gave consent.
- The daily report emails the owner.
- Enabling the scheduler therefore means real emails. It needs explicit approval together with the deployment.

### Admin password (prepared)
1. The client chooses a strong password: at least 16 characters, from a password manager.
2. The client, or we on approval, set it as `ADMIN_PASSWORD` in the server's `.env.production.local`.
3. Restart the app in PM2.
4. Log in once to confirm.

Notes:
- `/test` flags the sample value until it changes.
- Staff accounts are unaffected.

---

## 6. Tests run

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | Pass, 0 errors |
| `npm run check:phase2` | **218 passed, 0 failed** (logic tests and mocked provider tests, including Gemini fallback, cooldown and recovery, 400/401/403/429/timeout handling, placeholder IDs, cron and webhook signatures) |
| `npm run check:routes` against `http://localhost:3000`, with the Vapi secret supplied | **20 passed, 0 failed** (refused or ignored requests only) |
| Manual webhook checks (table in section 1) | 5 of 5 as expected |
| Live read-only checks: Vapi GET, Gemini test prompts, GA4, Search Console, database, SMTP login, feed build | Results above |
| ESLint | **Not run.** Not installed or configured in this project |
| `npx next build` (isolated copy without `.env.local`, deleted afterwards) | **Pass**: compiled successfully, 74/74 pages. One early "compiled with warnings" notice (2.8 s pass) was printed and not inspected. |

---

## 7. Integration health (8 Nov 2026)

| Category | Items |
|---|---|
| **Working** | GA4 · Search Console · Database · SMTP login · Shopping feed build · Gemini API through the fallback model · Vapi API key and the new assistant's configuration · webhook verification (local) · PayPal credentials (live) |
| **Partially working** | Gemini: primary model out of free daily quota; agents not verified in real conversations · Vapi: assistant ready, but no phone number, SIP or production webhook yet · Cron: authentication OK, never scheduled |
| **Blocked / client action required** | Exotel: KYC, written quote, vSIP · WhatsApp: designated test number, App Secret, Tech Provider confirmation · ShipGlobal: label-API access (401) · PayPal: sandbox credentials for development · Admin password · Merchant Center scheduled fetch |
| **Not tested** (needs approval or is billable) | Live voice call · Vapi webhook delivery from Vapi · live WhatsApp message · real checkout · shipment/label · real email delivery · anything on the production server |
| **Paid activation required** | Exotel plan and vSIP (prices awaiting Exotel) · Gemini paid tier before go-live (the free tier allows only 20 requests per day per model) · Vapi call minutes ($0.05/min hosting plus provider costs) |

## 8. Client action list
1. **WhatsApp:**
   - Confirm in writing the designated test number. It must be neither the live number nor +91 90274 97288.
   - Confirm that the Meta app is a Tech Provider or Solution Partner.
   - Share the Meta App Secret through a secure channel.
2. **Exotel:** complete KYC and send the prepared request; approve costs in writing before any upgrade.
3. **Gemini:** decide on enabling billing (Tier 1) before go-live.
4. **Deployment approval:** production environment values (`VAPI_WEBHOOK_SECRET`, `VAPI_ASSISTANT_ID`, Meta App Secret, new admin password) and the scheduler. The scheduler sends real consent-based customer emails.
5. **PayPal:** sandbox credentials for development.
6. **ShipGlobal:** enable label-API access for the account email, or confirm the password.
7. **Merchant Center:** add the feed URL as a scheduled fetch.
