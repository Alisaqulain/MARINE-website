# Marina Muse: production environment template audit

Generated 2026-11-10T16:37:53.702Z. Template: `MARINA_MUSE_PRODUCTION_ENV_TEMPLATE_SANITIZED.env` (project root). Generator: `reports/evidence/security/gen-sanitized-env-template.mjs`. Source inventory: `reports/evidence/security/env-source-inventory.mjs` → `env-source-inventory-20261110.json`.

**Method.** All application and script source files were scanned for environment reads (`process.env.X`, `process.env["X"]`, the `env("X")` helper, `read("X")`, and `env.X`/`source.X` on a passed-in env object), with file:line evidence. Inputs: `lib/ai/env-registry.ts` (106 entries), `.env.example` and its 19 committed versions (names only), and the PM2/nginx examples. **No value was read from `.env.local`, a backup, an editor snapshot, Cursor data, a log or a transcript.** The rotation column uses the variable *names* of the exposed copy, recorded during the 10 Nov security sweep. No existing env file was modified, no application behaviour changed, and no external service was contacted.

## 1. Counts

| | Count |
|---|---|
| Variables in the template (verified, production-relevant) | **97** |
| REQUIRED | 12 |
| CONDITIONAL | 34 |
| OPTIONAL | 51 |
| Development-only (listed, must stay unset) | 7 |
| RETIRED (listed, do not set) | 8 |
| **Total names audited** | **112** (+ 5 local test-tool inputs excluded: APP_PW, APP_SECRET, BASE_URL, VAPI_SECRET, VERIFY_TOKEN) |

Verified variable count: **97** production variables, each with source or configuration evidence; 0 have only script, test or no evidence (none expected).

Consistency checks: every name read in code is classified; every classified name has code evidence; every registry name is classified.

## 2. Template validation

| Check | Result |
|---|---|
| Active (uncommented) lines | 97 |
| Active lines with any value | **0** |
| Duplicate variable names | 0 |
| Pattern scan: mongodb URI | 0 |
| Pattern scan: private key | 0 |
| Pattern scan: JWT/long token | 0 |
| Pattern scan: Google API key | 0 |
| Pattern scan: PayPal/Stripe-like key | 0 |
| Pattern scan: Resend key | 0 |
| Pattern scan: Meta token | 0 |
| Pattern scan: long hex/base64 secret | 0 |
| Pattern scan: e-mail address | 0 |
| Production credential fingerprint scan | see section 9 |

Every value is blank. Two non-secret values are described in comments only (`NODE_ENV` = the word production, `PAYPAL_MODE` = the word live).

## 3. Rotation requirements

Fresh credentials are needed for every secret below before any production deployment. **YES (exposed)** means the variable name was in the exposed copy of the pre-isolation `.env.local` (security report, section 8.1). Treat its value, whatever environment it belonged to, as compromised.

| Variable | Rotation | Class |
|---|---|---|
| `MONGODB_URI` | YES (exposed) | REQUIRED |
| `MONGODB_URI_STANDARD` | NEW VALUE (never reuse a development value) | OPTIONAL |
| `AUTH_SECRET` | YES (exposed) | REQUIRED |
| `ADMIN_PASSWORD` | YES (exposed) | REQUIRED |
| `GOOGLE_CLIENT_SECRET` | YES (exposed) | CONDITIONAL |
| `GEMINI_API_KEY` | YES (exposed) | CONDITIONAL |
| `VAPI_API_KEY` | YES (exposed) | CONDITIONAL |
| `VAPI_WEBHOOK_SECRET` | YES (exposed) | CONDITIONAL |
| `VOICE_WEBHOOK_SECRET` | NEW VALUE (never reuse a development value) | OPTIONAL |
| `EXOTEL_API_KEY` | YES (exposed) | CONDITIONAL |
| `EXOTEL_API_TOKEN` | YES (exposed) | CONDITIONAL |
| `EXOTEL_WEBHOOK_TOKEN` | YES (exposed) | CONDITIONAL |
| `META_APP_SECRET` | YES (exposed) | CONDITIONAL |
| `META_WEBHOOK_APP_SECRET` | NEW VALUE (never reuse a development value) | OPTIONAL |
| `META_WEBHOOK_VERIFY_TOKEN` | YES (exposed) | CONDITIONAL |
| `WHATSAPP_ACCESS_TOKEN` | YES (exposed) | CONDITIONAL |
| `SMTP_PASS` | YES (exposed) | REQUIRED |
| `RESEND_API_KEY` | NEW VALUE (never reuse a development value) | OPTIONAL |
| `PAYPAL_CLIENT_ID` | YES with the new PayPal app | CONDITIONAL |
| `PAYPAL_CLIENT_SECRET` | YES (exposed) | CONDITIONAL |
| `SHIPGLOBAL_PASSWORD` | YES (exposed) | CONDITIONAL |
| `GA4_API_SECRET` | YES (exposed) | OPTIONAL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | YES (exposed) | CONDITIONAL |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | NEW VALUE (never reuse a development value) | OPTIONAL |
| `CRON_SECRET` | YES (exposed) | CONDITIONAL |
| `KVM2_UPLOAD_TOKEN` | YES (exposed) | CONDITIONAL |
| `RAZORPAY_KEY_SECRET` | NEW VALUE (never reuse a development value) | CONDITIONAL |

Also: the identifiers `PAYPAL_CLIENT_ID` (if a new PayPal app is created) and `GOOGLE_CLIENT_ID` (if the OAuth client is re-created) change together with their secrets. Rotating `AUTH_SECRET` signs every user out and makes a stored WhatsApp token unreadable.

## 4. Initial launch recommendation

| Group | Integrations / variables | Recommendation |
|---|---|---|
| **Essential for the initial storefront launch** | Runtime (`NODE_ENV`, `NEXT_PUBLIC_SITE_URL`), MongoDB (`MONGODB_URI`, `MONGODB_DB_NAME`), Auth (`AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAILS`, `ADMIN_PASSWORD`), SMTP (`SMTP_HOST/PORT/USER/PASS`: sign-up OTP and password reset) | Set with **new** values |
| Essential only if payments / shipping are enabled | PayPal (4), Razorpay (2), ShipGlobal (`SHIPGLOBAL_EMAIL/PASSWORD` + optional label fields) | New live credentials. Until then checkout stays unavailable (503, by design) |
| Optional AI features | Chat & Sales (`GEMINI_API_KEY` …), Growth & Revenue (Gemini + GA4 property + service account + Search Console), Voice & Call (Vapi), `CRON_SECRET` + scheduler for follow-ups and the daily report | **Not required for launch.** The 22 conversation scenarios have not run, the Vapi secret is unrotated, and GA4 is not tracking. Recommended: `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp` (the switch is read at runtime, `lib/ai/agents.ts:19`) until each agent is approved |
| Optional analytics and marketing | GA4 tag and Measurement Protocol, Search Console, Merchant Center feed (no variable), Resend order e-mails, Google sign-in | Can follow launch. The GA4 tag needs `NEXT_PUBLIC_GA4_MEASUREMENT_ID` **before the build** |
| Keep disabled until credentials and written approval | WhatsApp/Meta (App Secret missing; switches `WHATSAPP_COEXISTENCE_ENABLED`, `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED`, `WHATSAPP_OUTBOUND_ENABLED` = false), Exotel (KYC/vSIP), Vapi outbound (`VAPI_OUTBOUND_ENABLED` = false), every development-only switch | Leave blank or false |

**The four agents.** None is required for the storefront to work: chat, voice, growth and WhatsApp are optional add-ons, and each can be switched off at runtime with `AI_AGENTS_DISABLED`.
- **Chat & Sales.** Blocked: the 22 scenarios have not been run.
- **Voice & Call.** Blocked: webhook secret rotation pending.
- **Growth & Revenue.** Partially usable: the reports need GA4 and the service account; the scheduler needs `CRON_SECRET`.
- **WhatsApp.** Blocked: Meta App Secret and eligibility outstanding.

## 5. Retired, superseded and development-only variables

| Variable | Status | Evidence |
|---|---|---|
| `KVM2_UPLOAD_SKIP` | DEV-ONLY | Skips the remote upload (development). Must be unset in production. (lib/kvm-upload.ts:23, lib/kvm-upload.ts:23) |
| `MARINA_ISOLATED_TEST` | DEV-ONLY | Set only by scripts/isolated-env.mjs for the isolated Phase 2 test environment (no fallback to the client's Meta app). Must be unset in production. (lib/whatsapp/coexistence.ts:20) |
| `MONGODB_DEV_ALLOWED_HOSTS` | DEV-ONLY | Development database-host allow-list (guard is inactive in production). Must be unset in production. (lib/env-mongo-uri.ts:44) |
| `WHATSAPP_COEXISTENCE_TEST_NUMBER` | DEV-ONLY | The only number allowed for a test onboarding before approval. Leave unset in production. (lib/whatsapp/coexistence.ts:156) |
| `PAYPAL_ALLOW_LIVE_OUTSIDE_PRODUCTION` | DEV-ONLY | Overrides the live-mode guard outside production. Must be unset. (lib/paypal.ts:21) |
| `SHIPGLOBAL_ALLOW_OUTSIDE_PRODUCTION` | DEV-ONLY | Allows real bookings outside production. Must be unset. (lib/shipglobal.ts:391) |
| `NEXT_PUBLIC_GA4_IN_DEVELOPMENT` | DEV-ONLY | Loads the GA4 tag in development builds. Must be unset. (components/GoogleAnalytics.tsx:7) |
| `MONGODB_REPLICA_SET` | RETIRED | Read only by the diagnostic script scripts/test-mongo.mjs, never by the application. (scripts/test-mongo.mjs:37 (script only)) |
| `GEMINI_TEST_API_KEY` | RETIRED | Isolated test key for the offline text-test harness under reports/; never read by the application. (scripts/isolated-env.mjs:87 (script only)) |
| `GEMINI_TEST_PROJECT_CONFIRMED` | RETIRED | Harness gate flag; never read by the application. (scripts/isolated-env.mjs:86 (script only)) |
| `SMTP_FROM` | RETIRED | Not read by any code; the sender is fixed in lib/password-otp-email. (no code reference (registry/.env.example only)) |
| `CONTACT_EMAILS` | RETIRED | Not read by any code; contact addresses come from lib/company. (no code reference (registry/.env.example only)) |
| `OPENAI_API_KEY` | RETIRED | Legacy AI provider key. In .env.example until commit 5e61d6c (31 Oct); Gemini replaced it. No reference in code, scripts or docs.  |
| `MERCHANT_CENTER_ID` | RETIRED | In .env.example until 9e34acc (3 Nov). Not read by code; Merchant Center fetches /feeds/google.xml and needs no app variable. Mentioned only in docs/phase2/PHASE2_AUDIT_REPORT.md.  |
| `SEARCH_DATA_PROVIDER` | RETIRED | In .env.example until 5e61d6c (31 Oct). No reference anywhere.  |
| `NEXTAUTH_URL` | Superseded (kept as OPTIONAL alias) | Read only as a fallback for `AUTH_URL`, then overwritten (`lib/auth-url.ts:21,49`). The registry marks it "required"; that is stricter than the code |
| `VOICE_PROVIDER`, `VOICE_WEBHOOK_SECRET` | Alternative path (OPTIONAL) | Generic non-Vapi voice webhook (`lib/ai/voice.ts:27`). Unused when Vapi is the provider |

**Legacy OpenAI.** `OPENAI_API_KEY` appears in no current file (code, scripts, docs, `.env.example`). It left `.env.example` in commit 5e61d6c (31 Oct). Gemini is the only AI provider in code. No other AI-provider variable exists (searched: `OPENAI_*`, `ANTHROPIC_*`).

**Old authentication names.** `NEXTAUTH_SECRET`, `JWT_SECRET`, `SESSION_SECRET` and `ADMIN_USER*` are referenced nowhere. `ADMIN_PASSWORD` is **current**, not retired: `auth.ts:112` reads it.

## 6. Missing or inconsistent with the previous registry and template

| Finding | Detail |
|---|---|
| Read in code, missing from the registry | `NODE_ENV` (12 runtime reads; set by the process manager), `PORT` (PM2 example; read by Next.js). Both are added to this template |
| In the registry, not read by the application | `CONTACT_EMAILS`, `SMTP_FROM` (no reader), `GEMINI_TEST_API_KEY`, `GEMINI_TEST_PROJECT_CONFIRMED` (harness only), `MONGODB_REPLICA_SET` (diagnostic script only) |
| Registry classification stricter than the code | `NEXTAUTH_URL` ("required", but only a fallback alias) |
| Registry classification looser than the code | `SMTP_*` ("required for feature", but customer sign-up OTP and password reset depend on it, so REQUIRED for a storefront with accounts). `NEXT_PUBLIC_SITE_URL` ("optional", but build-time and used for absolute URLs, so REQUIRED here) |
| Previous template (`reports/MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env`) | Built from the registry alone: no `NODE_ENV` or `PORT`; retired names listed as active; set `PAYPAL_MODE`/`WHATSAPP_*` values. This sanitized template supersedes it for client review. The old file was left unchanged |
| Only in old `.env.example` versions | `OPENAI_API_KEY`, `MERCHANT_CENTER_ID`, `SEARCH_DATA_PROVIDER` (retired) |
| Local test-tool inputs (not configuration) | `APP_PW`, `APP_SECRET`, `BASE_URL`, `VAPI_SECRET`, `VERIFY_TOKEN`: read only by `scripts/check-routes.mjs` / `scripts/dev-db.mjs` |

## 7. Per-variable evidence

| Variable | Section | Class | Initial launch | Rotation | Secret | Evidence (file:line) |
|---|---|---|---|---|---|---|
| `NODE_ENV` | Core application and runtime | REQUIRED | yes | no | no | `components/GoogleAnalytics.tsx:6`, `lib/ai/health.ts:525`, `lib/ai/health.ts:526` |
| `PORT` | Core application and runtime | OPTIONAL | yes | no | no | `ecosystem.config.example.cjs (PM2 env), read by Next.js` |
| `NEXT_PUBLIC_SITE_URL` | Core application and runtime | REQUIRED | yes | no | no | `app/layout.tsx:6`, `app/product/[slug]/layout.tsx:10`, `lib/ai/health.ts:520` |
| `NEXT_PUBLIC_SHOP_UTC_OFFSET` | Core application and runtime | OPTIONAL | no | no | no | `lib/sale-time.ts:6`, `lib/sale-time.ts:7` |
| `AI_AGENTS_DISABLED` | Core application and runtime | OPTIONAL | yes | no | no | `lib/ai/agents.ts:19` |
| `MONGODB_URI` | MongoDB | REQUIRED | yes | YES (exposed) | yes | `lib/env-mongo-uri.ts:19` |
| `MONGODB_DB_NAME` | MongoDB | REQUIRED | yes | no | no | `lib/mongodb.ts:25` |
| `MONGODB_NODE_PROCESSES` | MongoDB | OPTIONAL | yes | no | no | `lib/mongodb-pool.ts:25` |
| `MONGODB_PREFER_IPV4` | MongoDB | OPTIONAL | yes | no | no | `lib/atlas-connect.ts:108`, `lib/mongodb.ts:21` |
| `MONGODB_EXTERNAL_CLIENTS` | MongoDB | OPTIONAL | no | no | no | `lib/mongodb-pool.ts:21` |
| `MONGODB_MAX_POOL_SIZE` | MongoDB | OPTIONAL | no | no | no | `lib/mongodb-pool.ts:13` |
| `MONGODB_CONNECTION_BUDGET` | MongoDB | OPTIONAL | no | no | no | `lib/mongodb-pool.ts:18` |
| `MONGODB_URI_STANDARD` | MongoDB | OPTIONAL | no | NEW VALUE (never reuse a development value) | yes | `lib/env-mongo-uri.ts:17`, `lib/mongodb.ts:184` |
| `MONGODB_DIRECT` | MongoDB | OPTIONAL | no | no | no | `lib/atlas-connect.ts:62`, `lib/mongodb.ts:165`, `lib/mongodb.ts:226` |
| `MONGODB_SRV_ONLY` | MongoDB | OPTIONAL | no | no | no | `lib/atlas-connect.ts:60` |
| `MONGODB_SKIP_SRV_FALLBACK` | MongoDB | OPTIONAL | no | no | no | `lib/atlas-connect.ts:16`, `lib/atlas-connect.ts:17` |
| `MONGODB_SERVER_API` | MongoDB | OPTIONAL | no | no | no | `lib/mongodb.ts:87` |
| `MONGODB_AUTO_SELECT_FAMILY` | MongoDB | OPTIONAL | no | no | no | `lib/atlas-connect.ts:86`, `lib/atlas-connect.ts:88` |
| `MONGODB_FORCE_IPV4` | MongoDB | OPTIONAL | no | no | no | `lib/atlas-connect.ts:107` |
| `AUTH_SECRET` | Authentication and security | REQUIRED | yes | YES (exposed) | yes | `app/api/meta/whatsapp/signup/exchange/route.ts:104`, `lib/ai/followups.ts:77`, `lib/ai/followups.ts:84` |
| `AUTH_URL` | Authentication and security | REQUIRED | yes | no | no | `app/layout.tsx:6`, `app/product/[slug]/layout.tsx:11`, `lib/ai/health.ts:520` |
| `NEXTAUTH_URL` | Authentication and security | OPTIONAL | yes | no | no | `lib/auth-url.ts:21`, `lib/auth-url.ts:49`, `lib/media-url.ts:21` |
| `ADMIN_EMAILS` | Authentication and security | REQUIRED | yes | no | no | `lib/roles.ts:7` |
| `ADMIN_PASSWORD` | Authentication and security | REQUIRED | yes | YES (exposed) | yes | `auth.ts:112` |
| `GOOGLE_CLIENT_ID` | Authentication and security | CONDITIONAL | only if the feature is enabled | no | no | `auth.ts:43`, `auth.ts:51` |
| `GOOGLE_CLIENT_SECRET` | Authentication and security | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `auth.ts:43`, `auth.ts:52` |
| `GEMINI_API_KEY` | Gemini AI / Chat and Sales | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/ai/gemini.ts:36`, `lib/ai/gemini.ts:121`, `lib/ai/gemini.ts:232` |
| `GEMINI_MODEL` | Gemini AI / Chat and Sales | OPTIONAL | no | no | no | `lib/ai/gemini.ts:19`, `lib/ai/gemini.ts:26` |
| `GEMINI_FALLBACK_MODEL` | Gemini AI / Chat and Sales | OPTIONAL | no | no | no | `lib/ai/gemini.ts:27` |
| `AI_OWNER_ALERT_SCORE` | Gemini AI / Chat and Sales | OPTIONAL | no | no | no | `lib/ai/crm.ts:266` |
| `AI_OWNER_ALERT_VALUE_USD` | Gemini AI / Chat and Sales | OPTIONAL | no | no | no | `lib/ai/crm.ts:268` |
| `VAPI_API_KEY` | Vapi Voice Agent | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/ai/vapi.ts:264`, `lib/ai/vapi.ts:268`, `lib/ai/vapi.ts:287` |
| `VAPI_ASSISTANT_ID` | Vapi Voice Agent | CONDITIONAL | only if the feature is enabled | no | no | `lib/ai/vapi.ts:272`, `lib/ai/vapi.ts:281`, `lib/ai/vapi.ts:332` |
| `VAPI_WEBHOOK_SECRET` | Vapi Voice Agent | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/ai/vapi.ts:55`, `lib/ai/vapi.ts:178`, `lib/ai/vapi.ts:287` |
| `VAPI_PHONE_NUMBER_ID` | Vapi Voice Agent | OPTIONAL | no | no | no | `lib/ai/vapi.ts:333` |
| `VAPI_SIP_CREDENTIAL_ID` | Vapi Voice Agent | OPTIONAL | no | no | no | `lib/ai/integrations.ts:221`, `lib/ai/exotel.ts:201` |
| `VAPI_OUTBOUND_ENABLED` | Vapi Voice Agent | OPTIONAL | no | no | no | `lib/ai/vapi.ts:44` |
| `VAPI_MODEL` | Vapi Voice Agent | OPTIONAL | no | no | no | `lib/ai/vapi.ts:188` |
| `VAPI_API_BASE` | Vapi Voice Agent | OPTIONAL | no | no | no | `lib/ai/vapi.ts:17` |
| `VOICE_LANGUAGES` | Vapi Voice Agent | OPTIONAL | no | no | no | `lib/ai/crm.ts:457`, `lib/ai/voice.ts:69` |
| `VOICE_PROVIDER` | Vapi Voice Agent | OPTIONAL | no | no | no | `lib/ai/crm.ts:455`, `lib/ai/crm.ts:463`, `lib/ai/crm.ts:467` |
| `VOICE_WEBHOOK_SECRET` | Vapi Voice Agent | OPTIONAL | no | NEW VALUE (never reuse a development value) | yes | `lib/ai/crm.ts:455`, `lib/ai/voice.ts:27` |
| `EXOTEL_API_KEY` | Exotel | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/ai/exotel.ts:15` |
| `EXOTEL_API_TOKEN` | Exotel | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/ai/exotel.ts:16` |
| `EXOTEL_ACCOUNT_SID` | Exotel | CONDITIONAL | only if the feature is enabled | no | no | `lib/ai/exotel.ts:17` |
| `EXOTEL_SUBDOMAIN` | Exotel | CONDITIONAL | only if the feature is enabled | no | no | `lib/ai/exotel.ts:13` |
| `EXOTEL_REGION` | Exotel | OPTIONAL | no | no | no | `lib/ai/exotel.ts:104` |
| `EXOTEL_PHONE_NUMBER` | Exotel | CONDITIONAL | only if the feature is enabled | no | no | `lib/ai/exotel.ts:19` |
| `EXOTEL_TRUNK_SID` | Exotel | CONDITIONAL | only if the feature is enabled | no | no | `lib/ai/exotel.ts:20` |
| `EXOTEL_WEBHOOK_TOKEN` | Exotel | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/ai/integrations.ts:319`, `lib/ai/exotel.ts:261` |
| `META_APP_ID` | WhatsApp Cloud API / Meta | CONDITIONAL | only if the feature is enabled | no | no | `lib/whatsapp/coexistence.ts:22` |
| `META_APP_SECRET` | WhatsApp Cloud API / Meta | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `app/api/meta/whatsapp/signup/exchange/route.ts:70`, `app/api/meta/whatsapp/webhook/route.ts:48`, `lib/ai/integrations.ts:359` |
| `META_WEBHOOK_APP_SECRET` | WhatsApp Cloud API / Meta | OPTIONAL | no | NEW VALUE (never reuse a development value) | yes | `app/api/meta/whatsapp/webhook/route.ts:48`, `lib/ai/integrations.ts:359`, `lib/ai/integrations.ts:522` |
| `META_WEBHOOK_VERIFY_TOKEN` | WhatsApp Cloud API / Meta | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `app/api/meta/whatsapp/webhook/route.ts:39`, `lib/ai/integrations.ts:361`, `lib/ai/integrations.ts:524` |
| `META_GRAPH_API_VERSION` | WhatsApp Cloud API / Meta | OPTIONAL | no | no | no | `app/api/meta/whatsapp/signup/exchange/route.ts:92`, `lib/whatsapp/coexistence-actions.ts:24`, `lib/whatsapp/cloud.ts:28` |
| `META_CONFIG_ID` | WhatsApp Cloud API / Meta | OPTIONAL | no | no | no | `lib/whatsapp/coexistence.ts:23` |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API / Meta | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/whatsapp/cloud.ts:13` |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Cloud API / Meta | CONDITIONAL | only if the feature is enabled | no | no | `lib/whatsapp/cloud.ts:14` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Cloud API / Meta | CONDITIONAL | only if the feature is enabled | no | no | `lib/whatsapp/cloud.ts:15` |
| `WHATSAPP_FOLLOWUP_TEMPLATE` | WhatsApp Cloud API / Meta | OPTIONAL | no | no | no | `lib/ai/followups.ts:162`, `lib/ai/followups.ts:202`, `lib/whatsapp/cloud.ts:110` |
| `WHATSAPP_TEMPLATE_LANGUAGE` | WhatsApp Cloud API / Meta | OPTIONAL | no | no | no | `lib/ai/followups.ts:167` |
| `WHATSAPP_COEXISTENCE_ENABLED` | WhatsApp Cloud API / Meta | OPTIONAL | no | no | no | `lib/whatsapp/coexistence.ts:120` |
| `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED` | WhatsApp Cloud API / Meta | OPTIONAL | no | no | no | `lib/whatsapp/coexistence.ts:121` |
| `WHATSAPP_OUTBOUND_ENABLED` | WhatsApp Cloud API / Meta | OPTIONAL | no | no | no | `lib/whatsapp/coexistence.ts:122` |
| `SMTP_HOST` | SMTP / Email | REQUIRED | yes | no | no | `lib/mail.ts:27` |
| `SMTP_PORT` | SMTP / Email | REQUIRED | yes | no | no | `lib/mail.ts:28`, `lib/mail.ts:29` |
| `SMTP_USER` | SMTP / Email | REQUIRED | yes | no | no | `lib/mail.ts:19` |
| `SMTP_PASS` | SMTP / Email | REQUIRED | yes | YES (exposed) | yes | `lib/mail.ts:20` |
| `OWNER_ALERT_EMAILS` | SMTP / Email | CONDITIONAL | only if the feature is enabled | no | no | `lib/mail.ts:61`, `lib/mail.ts:73` |
| `RESEND_API_KEY` | SMTP / Email | OPTIONAL | no | NEW VALUE (never reuse a development value) | yes | `lib/orders.ts:285` |
| `ORDER_EMAIL_FROM` | SMTP / Email | OPTIONAL | no | no | no | `lib/orders.ts:294` |
| `PAYPAL_CLIENT_ID` | PayPal | CONDITIONAL | only if payments enabled | YES with the new PayPal app | no | `lib/paypal.ts:9`, `lib/paypal.ts:59` |
| `PAYPAL_CLIENT_SECRET` | PayPal | CONDITIONAL | only if payments enabled | YES (exposed) | yes | `lib/paypal.ts:9`, `lib/paypal.ts:60` |
| `PAYPAL_MODE` | PayPal | CONDITIONAL | only if payments enabled | no | no | `lib/ai/health.ts:527`, `lib/paypal.ts:4`, `lib/paypal.ts:13` |
| `PAYPAL_WEBHOOK_ID` | PayPal | CONDITIONAL | only if payments enabled | no | no | `app/api/paypal/webhook/route.ts:9`, `lib/paypal.ts:29` |
| `SHIPGLOBAL_EMAIL` | ShipGlobal | CONDITIONAL | only if shipping labels enabled | no | no | `lib/shipglobal.ts:25`, `lib/shipglobal.ts:31`, `lib/shipglobal.ts:191` |
| `SHIPGLOBAL_PASSWORD` | ShipGlobal | CONDITIONAL | only if shipping labels enabled | YES (exposed) | yes | `lib/shipglobal.ts:25`, `lib/shipglobal.ts:31`, `lib/shipglobal.ts:192` |
| `SHIPGLOBAL_SERVICE` | ShipGlobal | OPTIONAL | no | no | no | `lib/shipglobal.ts:35` |
| `SHIPGLOBAL_API_BASE` | ShipGlobal | OPTIONAL | no | no | no | `lib/shipglobal.ts:11` |
| `SHIPGLOBAL_HSN` | ShipGlobal | OPTIONAL | no | no | no | `lib/shipglobal.ts:259` |
| `SHIPGLOBAL_CSB5` | ShipGlobal | OPTIONAL | no | no | no | `lib/shipglobal.ts:318` |
| `SHIPGLOBAL_IOSS` | ShipGlobal | OPTIONAL | no | no | no | `lib/shipglobal.ts:345` |
| `SHIPGLOBAL_SELLER_FIRST` | ShipGlobal | OPTIONAL | no | no | no | `lib/shipglobal.ts:320` |
| `SHIPGLOBAL_SELLER_LAST` | ShipGlobal | OPTIONAL | no | no | no | `lib/shipglobal.ts:321` |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 | OPTIONAL | no | no | no | `components/GoogleAnalytics.tsx:8`, `lib/ai/integrations.ts:423`, `lib/ai/integrations.ts:424` |
| `GA4_MEASUREMENT_ID` | Google Analytics 4 | OPTIONAL | no | no | no | `lib/google/analytics.ts:96`, `lib/google/analytics.ts:100` |
| `GA4_API_SECRET` | Google Analytics 4 | OPTIONAL | no | YES (exposed) | yes | `lib/google/analytics.ts:96`, `lib/google/analytics.ts:100`, `lib/google/analytics.ts:135` |
| `GA4_PROPERTY_ID` | Google Analytics 4 | CONDITIONAL | only if the feature is enabled | no | no | `lib/google/analytics.ts:10`, `lib/google/analytics.ts:75` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Analytics 4 | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/ai/integrations.ts:397`, `lib/ai/integrations.ts:407`, `lib/google/auth.ts:17` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Analytics 4 | OPTIONAL | no | no | no | `lib/ai/integrations.ts:397`, `lib/google/auth.ts:28` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Analytics 4 | OPTIONAL | no | NEW VALUE (never reuse a development value) | yes | `lib/google/auth.ts:29` |
| `SEARCH_CONSOLE_SITE_URL` | Google Search Console | CONDITIONAL | only if the feature is enabled | no | no | `lib/ai/integrations.ts:452`, `lib/google/search-console.ts:10` |
| `CRON_SECRET` | Scheduled jobs / Cron | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/ai/cron.ts:6` |
| `KVM2_UPLOAD_URL` | Other verified integrations | CONDITIONAL | only if the feature is enabled | no | no | `lib/kvm-upload.ts:3` |
| `KVM2_UPLOAD_TOKEN` | Other verified integrations | CONDITIONAL | only if the feature is enabled | YES (exposed) | yes | `lib/kvm-upload.ts:17` |
| `RAZORPAY_KEY_ID` | Other verified integrations | CONDITIONAL | only if payments enabled | no | no | `app/api/razorpay/order/route.ts:6` |
| `RAZORPAY_KEY_SECRET` | Other verified integrations | CONDITIONAL | only if payments enabled | NEW VALUE (never reuse a development value) | yes | `app/api/razorpay/order/route.ts:7`, `app/api/razorpay/verify/route.ts:13` |
| `KVM2_UPLOAD_SKIP` | Other verified integrations | DEV-ONLY | no (must be unset) | n/a | no | `lib/kvm-upload.ts:23`, `lib/kvm-upload.ts:23` |
| `MARINA_ISOLATED_TEST` | Core application and runtime | DEV-ONLY | no (must be unset) | n/a | no | `lib/whatsapp/coexistence.ts:20` |
| `MONGODB_DEV_ALLOWED_HOSTS` | MongoDB | DEV-ONLY | no (must be unset) | n/a | no | `lib/env-mongo-uri.ts:44` |
| `WHATSAPP_COEXISTENCE_TEST_NUMBER` | WhatsApp Cloud API / Meta | DEV-ONLY | no (must be unset) | n/a | no | `lib/whatsapp/coexistence.ts:156` |
| `PAYPAL_ALLOW_LIVE_OUTSIDE_PRODUCTION` | PayPal | DEV-ONLY | no (must be unset) | n/a | no | `lib/paypal.ts:21` |
| `SHIPGLOBAL_ALLOW_OUTSIDE_PRODUCTION` | ShipGlobal | DEV-ONLY | no (must be unset) | n/a | no | `lib/shipglobal.ts:391` |
| `NEXT_PUBLIC_GA4_IN_DEVELOPMENT` | Google Analytics 4 | DEV-ONLY | no (must be unset) | n/a | no | `components/GoogleAnalytics.tsx:7` |
| `MONGODB_REPLICA_SET` | MongoDB | RETIRED | no | n/a | no | `scripts/test-mongo.mjs:37 (script only)` |
| `GEMINI_TEST_API_KEY` | Gemini AI / Chat and Sales | RETIRED | no | n/a | yes | `scripts/isolated-env.mjs:87 (script only)` |
| `GEMINI_TEST_PROJECT_CONFIRMED` | Gemini AI / Chat and Sales | RETIRED | no | n/a | no | `scripts/isolated-env.mjs:86 (script only)` |
| `SMTP_FROM` | SMTP / Email | RETIRED | no | n/a | no | `no code reference (registry/.env.example only)` |
| `CONTACT_EMAILS` | SMTP / Email | RETIRED | no | n/a | no | `no code reference (registry/.env.example only)` |
| `OPENAI_API_KEY` | Retired (old templates) | RETIRED | no | n/a | yes | `git history of .env.example` |
| `MERCHANT_CENTER_ID` | Retired (old templates) | RETIRED | no | n/a | no | `git history of .env.example` |
| `SEARCH_DATA_PROVIDER` | Retired (old templates) | RETIRED | no | n/a | no | `git history of .env.example` |

## 8. Uncertainties (assumptions, not verified)

- **Production process manager and port.** PM2 with `NODE_ENV=production` and `PORT=3002` is taken from `ecosystem.config.example.cjs`. The real server configuration was not inspected (production access not authorized).
- **Which integrations the client launches with.** The classification assumes a storefront with customer accounts. If customer sign-up is disabled, SMTP drops to CONDITIONAL.
- **`META_APP_SECRET` and `WHATSAPP_ACCESS_TOKEN`.** Their names were in the exposed copy, but the 9 Nov evidence says `META_APP_SECRET` held placeholder text. Rotation is listed as YES regardless; a placeholder needs no rotation, but a new real value is required anyway.
- **Rotation scope.** Names come from one exposed copy (`jobcareerpao`, 4 Nov). The 21 editor snapshots (24 Oct–9 Nov) may have held other variables at other times. Their values were never read, so any secret ever stored in Marina's development `.env.local` should be treated as exposed.
- **Behaviour when a "REQUIRED" variable is missing.** Inferred from code, not executed against a production-like configuration.

## 9. Production credential fingerprint scan of the outputs

After generation, both files (this report and the template) were scanned with `fingerprint-scan-v2.mjs` against the production MongoDB URI, password and user-name fingerprints. Result log: `reports/evidence/security/env-template-secret-check-postgen2-20261110.log`. It must show **ABSENT** for all three and a `SCAN COMPLETED` line; re-run the scan if either file is regenerated.

Other secrets (API keys, tokens) have no stored fingerprints. For those, the template guarantee rests on construction: every active line is `NAME=` with nothing after it (validated above, 0 non-blank). The generator never reads an env file.

