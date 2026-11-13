# Marina Muse: environment variable checklist

Prepared 9 November 2026, **updated 13:05 UTC after the development security isolation**, from `lib/ai/env-registry.ts` (106 variables) and the project's own validator, run against `.env.local`. **No values are shown.** 🔒 marks a secret.

## Summary

| Status | Count | Meaning |
|---|---|---|
| READY | 45 | Set and valid. "Evidence" says whether it was verified live in this audit or only format-checked |
| MISSING | 2 | A real value is needed: `GEMINI_TEST_API_KEY`, `GEMINI_TEST_PROJECT_CONFIRMED` |
| PLACEHOLDER | 1 | Must be replaced: `META_APP_SECRET` |
| BLOCKED | 8 | Depends on a client or provider action (PayPal sandbox credentials, Embedded Signup, Exotel KYC/vSIP, test number) |
| OPTIONAL | 39 | Intentionally unset until approved or needed |
| NOT REQUIRED | 11 | Not needed for the approved scope |

## Values you need to enter in `.env.local`

Enter these only after confirming them with the client.

1. `GEMINI_TEST_API_KEY` 🔒: the key from Google Cloud project `marina-muse-gemini-testing`. **It is not in the saved file yet.**
2. `GEMINI_TEST_PROJECT_CONFIRMED=marina-muse-gemini-testing`: only after checking in Google AI Studio → API keys that the key belongs to that project.
3. `META_APP_SECRET` 🔒: the current App Secret, provided securely by the client. It currently holds placeholder text.
4. ~~`VAPI_PHONE_NUMBER_ID` and `VAPI_SIP_CREDENTIAL_ID`~~: **done 9 Nov**, both cleared to empty and staying unconfigured.
5. `OWNER_ALERT_EMAILS`: an authorized test recipient, before any SMTP delivery test. Since 9 Nov, development refuses owner mail entirely while this is empty, so nothing can reach the client by accident.
6. When approved:
   - `WHATSAPP_COEXISTENCE_TEST_NUMBER`: your personal test number, for isolated testing only.
   - `VAPI_WEBHOOK_SECRET_NEXT` 🔒: the replacement secret, temporarily (see the rotation guide).
7. PayPal **sandbox** credentials (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) from developer.paypal.com → Sandbox, only if checkout must work locally. `PAYPAL_MODE=sandbox` is already set; until then local checkout answers "not configured" (HTTP 503).

**Done on 9 Nov (security isolation):**
- `MONGODB_URI` / `MONGODB_DB_NAME` point to the local test database (`npm run dev:db`).
- `ADMIN_PASSWORD` is a new generated 28-character password (read it from `.env.local`; it is never shown).
- The PayPal LIVE credentials and live webhook ID were removed, and `PAYPAL_MODE=sandbox` set.
- `VAPI_PHONE_NUMBER_ID` / `VAPI_SIP_CREDENTIAL_ID` placeholder text cleared.
- The previous file is backed up outside the repository at `C:\Users\ali\.marina-env-backup\env.local.pre-isolation-20261109` (owner-only access). Move it into a password manager, then delete it.

**Do not change:** `GEMINI_API_KEY`, any READY value, `WHATSAPP_OUTBOUND_ENABLED` (keep unset), `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED` (keep unset), `VAPI_OUTBOUND_ENABLED` (keep unset).

## `.env.example`

Regenerated on 9 Nov with `npm run docs:env` from the registry:
- 106 variables, names and safe placeholders only (regenerated again on 9 Nov at 13:00 UTC, adding the four development guards).
- The example model is now `gemini-3.8-flash` (it was the retired `gemini-2.5-flash`).
- The two test-only Gemini variables are added.
- Checked: no secret's real value appears in it. Values shared with `.env.local` are non-secret settings only: hosts, ports, site URL, business email, and Meta's public App and Config IDs.

## Full inventory

| Variable | Agent | Required/Optional | Current Status | Evidence | Source/Action |
|---|---|---|---|---|---|
| **Database (MongoDB Atlas)** | | | | | |
| `MONGODB_URI` 🔒 | Platform | Required | **READY** | live: local test database 127.0.0.1:27018; read/write probe and 13/13 isolation checks pass (`evidence/security/`) | Development only. The production connection string is no longer in development configuration. |
| `MONGODB_DEV_ALLOWED_HOSTS` | Platform | Optional | **OPTIONAL** | not set | Leave unset. Development refuses every non-local database host; list a dedicated development host only. |
| `MONGODB_URI_STANDARD` 🔒 | Platform | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| `MONGODB_DB_NAME` | Platform | Required | **READY** | live: `marina_muse_dev` | Keep. Do not overwrite. |
| `MONGODB_PREFER_IPV4` | Platform | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `MONGODB_NODE_PROCESSES` | Platform | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `MONGODB_EXTERNAL_CLIENTS` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `MONGODB_MAX_POOL_SIZE` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `MONGODB_CONNECTION_BUDGET` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `MONGODB_DIRECT` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `MONGODB_SRV_ONLY` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `MONGODB_SKIP_SRV_FALLBACK` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `MONGODB_SERVER_API` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `MONGODB_AUTO_SELECT_FAMILY` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `MONGODB_FORCE_IPV4` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `MONGODB_REPLICA_SET` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| **Site & sign-in** | | | | | |
| `AUTH_SECRET` 🔒 | Platform/4 WhatsApp | Required | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `AUTH_URL` | Platform | Required | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `NEXTAUTH_URL` | Platform | Required | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `NEXT_PUBLIC_SITE_URL` | Platform/3 Growth/2 Voice | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `GOOGLE_CLIENT_ID` | Platform | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `GOOGLE_CLIENT_SECRET` 🔒 | Platform | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `ADMIN_EMAILS` | Platform | Required | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `ADMIN_PASSWORD` 🔒 | Platform | Required | **READY** | live (local): new password signs in, sample refused | Development value replaced 9 Nov. **The production value is unknown and still needs changing** (separate approval). |
| `NEXT_PUBLIC_SHOP_UTC_OFFSET` | Platform/3 Growth | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `CONTACT_EMAILS` | Platform | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| **Email & owner alerts** | | | | | |
| `SMTP_HOST` | Platform/1 Chat/2 Voice/3 Growth | Required for feature | **READY** | live: SMTP login accepted 9 Nov (nothing sent) | Keep. Do not overwrite. |
| `SMTP_PORT` | Platform/1 Chat/2 Voice/3 Growth | Required for feature | **READY** | live: same | Keep. Do not overwrite. |
| `SMTP_USER` | Platform/1 Chat/2 Voice/3 Growth | Required for feature | **READY** | live: same | Keep. Do not overwrite. |
| `SMTP_PASS` 🔒 | Platform/1 Chat/2 Voice/3 Growth | Required for feature | **READY** | live: same | Keep. Do not overwrite. |
| `SMTP_FROM` | Platform | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `OWNER_ALERT_EMAILS` | 1 Chat/2 Voice/4 WhatsApp/3 Growth | Optional | **OPTIONAL** | not set | Set to an authorized test recipient in development before any SMTP delivery test. |
| `AI_OWNER_ALERT_SCORE` | 1 Chat/2 Voice/4 WhatsApp | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `AI_OWNER_ALERT_VALUE_USD` | 1 Chat/2 Voice/4 WhatsApp | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `RESEND_API_KEY` 🔒 | Platform | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| `ORDER_EMAIL_FROM` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| **Payments & shipping (existing store)** | | | | | |
| `PAYPAL_CLIENT_ID` | Platform | Required for feature | **BLOCKED** | removed from development 9 Nov (was LIVE) | Client provides PayPal **sandbox** credentials if local checkout is needed. |
| `PAYPAL_CLIENT_SECRET` 🔒 | Platform | Required for feature | **BLOCKED** | removed from development 9 Nov (was LIVE) | Same. |
| `PAYPAL_MODE` | Platform | Required for feature | **READY** | `sandbox`; local checkout refused with 503 (runtime check) | Keep `sandbox` in development. Live mode outside production is now refused in code. |
| `PAYPAL_ALLOW_LIVE_OUTSIDE_PRODUCTION` | Platform | Optional | **OPTIONAL** | not set | Keep unset. |
| `PAYPAL_WEBHOOK_ID` | Platform | Required for feature | **NOT REQUIRED** | removed from development 9 Nov (was the live webhook) | Production only; a sandbox webhook is optional for local testing. |
| `RAZORPAY_KEY_ID` | Platform | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| `RAZORPAY_KEY_SECRET` 🔒 | Platform | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| `SHIPGLOBAL_EMAIL` | Platform | Required for feature | **READY** | set, format valid (not live-checked) | Live account. Since 9 Nov, booking is refused outside production. |
| `SHIPGLOBAL_PASSWORD` 🔒 | Platform | Required for feature | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `SHIPGLOBAL_SERVICE` | Platform | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `SHIPGLOBAL_API_BASE` | Platform | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `SHIPGLOBAL_HSN` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `SHIPGLOBAL_CSB5` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `SHIPGLOBAL_IOSS` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `SHIPGLOBAL_SELLER_FIRST` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `SHIPGLOBAL_SELLER_LAST` | Platform | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `SHIPGLOBAL_ALLOW_OUTSIDE_PRODUCTION` | Platform | Optional | **OPTIONAL** | not set | Keep unset (bookings are real and billable). |
| `KVM2_UPLOAD_URL` | Platform | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| `KVM2_UPLOAD_TOKEN` 🔒 | Platform | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| `KVM2_UPLOAD_SKIP` | Platform | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| **Gemini (shared AI)** | | | | | |
| `GEMINI_API_KEY` 🔒 | 1 Chat/2 Voice/3 Growth/4 WhatsApp | Required | **READY** | live: the 9 Nov daily-report dry run generated insights with it | Kept unchanged, as instructed. **It is the website's key**, so any AI use in development spends the live site's quota (consolidated report, section 9). |
| `GEMINI_MODEL` | 1 Chat/2 Voice/3 Growth/4 WhatsApp | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `GEMINI_FALLBACK_MODEL` | 1 Chat/2 Voice/3 Growth/4 WhatsApp | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `GEMINI_TEST_API_KEY` 🔒 | 1 Chat/2 Voice | Optional | **MISSING** | not set | Key from project marina-muse-gemini-testing (not yet in the saved .env.local). |
| `GEMINI_TEST_PROJECT_CONFIRMED` | 1 Chat/2 Voice | Optional | **MISSING** | not set | Set to marina-muse-gemini-testing after checking the key's project in Google AI Studio. |
| `AI_AGENTS_DISABLED` | 1 Chat/2 Voice/3 Growth/4 WhatsApp | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| **Scheduled jobs** | | | | | |
| `CRON_SECRET` 🔒 | 1 Chat/3 Growth/4 WhatsApp | Required | **READY** | live: wrong/missing bearer refused (route checks) | Keep. Do not overwrite. |
| **Vapi (voice AI)** | | | | | |
| `VAPI_API_KEY` 🔒 | 2 Voice | Required for feature | **READY** | live: read-only Vapi API calls succeed | Keep. Do not overwrite. |
| `VAPI_ASSISTANT_ID` | 2 Voice | Required for feature | **READY** | live: resolves to Marina Muse Assistant (v4) | Keep. Do not overwrite. |
| `VAPI_WEBHOOK_SECRET` 🔒 | 2 Voice | Required for feature | **READY** | live: matches the header stored in Vapi (hash compare) | Keep. Do not overwrite. |
| `VAPI_PHONE_NUMBER_ID` | 2 Voice | Required for feature | **OPTIONAL** | empty (placeholder text cleared 9 Nov) | Keep unconfigured (no phone number in scope). |
| `VAPI_SIP_CREDENTIAL_ID` | 2 Voice | Required for feature | **OPTIONAL** | empty (placeholder text cleared 9 Nov) | Keep unconfigured (no SIP in scope). |
| `VAPI_OUTBOUND_ENABLED` | 2 Voice | Optional | **OPTIONAL** | not set | Keep unset (outbound calls off). |
| `VAPI_MODEL` | 2 Voice | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `VAPI_API_BASE` | 2 Voice | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `VOICE_LANGUAGES` | 2 Voice | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `VOICE_PROVIDER` | 2 Voice | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| `VOICE_WEBHOOK_SECRET` 🔒 | 2 Voice | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| **Exotel (telephony)** | | | | | |
| `EXOTEL_API_KEY` | 2 Voice | Required for feature | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `EXOTEL_API_TOKEN` 🔒 | 2 Voice | Required for feature | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `EXOTEL_ACCOUNT_SID` | 2 Voice | Required for feature | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `EXOTEL_SUBDOMAIN` | 2 Voice | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `EXOTEL_REGION` | 2 Voice | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `EXOTEL_PHONE_NUMBER` | 2 Voice | Required for feature | **BLOCKED** | not set | Needs Exotel KYC and an ExoPhone (client/provider action). |
| `EXOTEL_TRUNK_SID` | 2 Voice | Required for feature | **BLOCKED** | not set | Needs Exotel vSIP trunk (provider activation; not in approved scope). |
| `EXOTEL_WEBHOOK_TOKEN` 🔒 | 2 Voice | Required for feature | **READY** | live: bad token refused (route checks) | Keep. Do not overwrite. |
| **WhatsApp Cloud API** | | | | | |
| `WHATSAPP_ACCESS_TOKEN` 🔒 | 4 WhatsApp | Required for feature | **BLOCKED** | not set | Comes from Embedded Signup / system user; blocked on App Secret, eligibility and test number. |
| `WHATSAPP_PHONE_NUMBER_ID` | 4 WhatsApp | Required for feature | **BLOCKED** | not set | Comes from Embedded Signup with the designated test number. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | 4 WhatsApp | Required for feature | **BLOCKED** | not set | Comes from Embedded Signup (test WABA, never the production WABA). |
| `WHATSAPP_FOLLOWUP_TEMPLATE` | 4 WhatsApp/1 Chat | Optional | **OPTIONAL** | not set | Only after an approved template and outbound approval. |
| `WHATSAPP_TEMPLATE_LANGUAGE` | 4 WhatsApp | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `META_APP_ID` | 4 WhatsApp | Required for feature | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `META_APP_SECRET` 🔒 | 4 WhatsApp | Required for feature | **PLACEHOLDER** | set, invalid: META_APP_SECRET is placeholder text, not a real value | Client provides the current App Secret securely; you enter it in .env.local. |
| `META_WEBHOOK_APP_SECRET` 🔒 | 4 WhatsApp | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| `META_WEBHOOK_VERIFY_TOKEN` 🔒 | 4 WhatsApp | Required for feature | **READY** | live: local verify handshake: wrong token refused | Keep. Do not overwrite. |
| `META_GRAPH_API_VERSION` | 4 WhatsApp | Optional | **OPTIONAL** | not set | Leave unset unless needed. |
| **WhatsApp coexistence** | | | | | |
| `META_CONFIG_ID` | 4 WhatsApp | Required for feature | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `WHATSAPP_COEXISTENCE_ENABLED` | 4 WhatsApp | Optional | **READY** | set, format valid (not live-checked) | Keep. Do not overwrite. |
| `WHATSAPP_COEXISTENCE_TEST_NUMBER` | 4 WhatsApp | Optional | **BLOCKED** | not set | Your authorized personal test number, entered by you; never +91 74570 99540. |
| `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED` | 4 WhatsApp | Optional | **OPTIONAL** | not set | Keep unset: production onboarding is not approved. |
| `WHATSAPP_OUTBOUND_ENABLED` | 4 WhatsApp | Optional | **OPTIONAL** | not set | Keep unset: no automatic replies or outbound messages. |
| **Google Analytics & Search Console** | | | | | |
| `GOOGLE_SERVICE_ACCOUNT_JSON` 🔒 | 3 Growth | Required for feature | **READY** | live: GA4 + Search Console calls succeed | Keep. Do not overwrite. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 3 Growth | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` 🔒 | 3 Growth | Optional | **NOT REQUIRED** | not set | Not needed for the approved scope. |
| `GA4_PROPERTY_ID` | 3 Growth | Required for feature | **READY** | live: GA4 reports return data | Keep. Do not overwrite. |
| `GA4_MEASUREMENT_ID` | 3 Growth | Optional | **READY** | live: Measurement Protocol debug validation passes | Keep. Do not overwrite. |
| `GA4_API_SECRET` 🔒 | 3 Growth | Optional | **READY** | live: same | Keep. Do not overwrite. |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | 3 Growth | Optional | **READY** | set locally; MISSING from the production build | Keep. Development builds no longer load the tag unless the next variable is 1, so local browsing stays out of the live property. |
| `NEXT_PUBLIC_GA4_IN_DEVELOPMENT` | 3 Growth | Optional | **OPTIONAL** | not set | Keep unset; 1 loads the tag in development, in debug mode. |
| `SEARCH_CONSOLE_SITE_URL` | 3 Growth | Required for feature | **READY** | live: siteFullUser access | Keep. Do not overwrite. |
