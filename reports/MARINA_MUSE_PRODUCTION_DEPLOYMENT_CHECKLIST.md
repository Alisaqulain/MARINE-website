# Marina Muse: production deployment checklist

Prepared 10 November 2026 from local, read-only checks.

**Production deployment is NOT authorized.**
- Nothing in this checklist has been carried out on production.
- No production system was contacted.
- No production configuration was changed.

**Companion files:**
- `MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env`: every variable name, with placeholders only.
- `MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md`: the security findings that gate this checklist.

**Legend:**
- **VERIFIED**: checked in this environment today, with an evidence file.
- **CODE-REVIEWED**: read in the code, not exercised.
- **NOT VERIFIED**: needs production or client input.
- **BLOCKED**: cannot proceed without a decision or a credential.

## 0. Gate: must be done before any deployment

| # | Item | Status |
|---|---|---|
| 0.1 | **Rotate the production MongoDB user's password.** The current password is exposed (security report, section 8). Then update `MONGODB_URI` on the server only | **BLOCKED**: client decision and authorization |
| 0.2 | **Rotate every other secret that was in the pre-isolation development `.env.local`.** Copies of that whole file exist outside the project: VS Code/Cursor local history, Cursor state and transcripts, and the `jobcareerpao` project. This covers SMTP, Google OAuth, WhatsApp/Meta, Vapi, Exotel, ShipGlobal, KVM2 upload, GA4 API secret, `AUTH_SECRET`, `CRON_SECRET`, `ADMIN_PASSWORD` and the PayPal live credentials | **BLOCKED**: client |
| 0.3 | `AUTH_SECRET` rotation also makes the stored WhatsApp token unreadable. Plan to re-onboard, or re-encrypt the token, at the same time | NOT VERIFIED |
| 0.4 | Written production deployment approval | **BLOCKED**: not given |

## 1. Build and start

| Item | Requirement | Status / evidence |
|---|---|---|
| Build | `npm ci && npm run build` (Next.js 15, then `scripts/verify-build-static.mjs` CSS check) | **VERIFIED** locally: exit 0, 74/74 static pages, CSS 85 KB. `evidence/security/build-20261110T0725Z.log` |
| Type check | `npx tsc --noEmit` | **VERIFIED**: exit 0. `tsc-20261110T0647Z.log` |
| Unit and mocked tests | `npm run check:phase2`, `npm run check:whatsapp` | **VERIFIED**: 251/251 and 98/98. `check-phase2-20261110T0647Z.log`, `check-whatsapp-20261110T0647Z.log` |
| Start | `npm start` (`next start -H 0.0.0.0`) under the process manager with `NODE_ENV=production` | CODE-REVIEWED. The process-manager name and config on the VPS are not in the repository: NOT VERIFIED |
| Node version | Node 20+ (development uses Node 24) | NOT VERIFIED on the server |
| Env file location | `.env.production.local` (or `.env`) next to `package.json` on the server, owner-only permissions. Never in the repository | NOT VERIFIED |

## 2. Configuration and environment validation

| Item | Status / evidence |
|---|---|
| Variable inventory | **VERIFIED**: the 106 variables in the registry all match `.env.example` (70 active and 36 advanced, commented out); none obsolete or duplicated. `env-readiness-audit-20261110.log` |
| Production template | `MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env`: 98 production variables, placeholders only. 8 development-only variables listed as must-not-set |
| Must be unset in production | `MONGODB_DEV_ALLOWED_HOSTS`, `PAYPAL_ALLOW_LIVE_OUTSIDE_PRODUCTION`, `SHIPGLOBAL_ALLOW_OUTSIDE_PRODUCTION`, `KVM2_UPLOAD_SKIP`, `GEMINI_TEST_API_KEY`, `GEMINI_TEST_PROJECT_CONFIRMED`, `WHATSAPP_COEXISTENCE_TEST_NUMBER`, `NEXT_PUBLIC_GA4_IN_DEVELOPMENT` |
| Validation on the server | `/test` (admin only) shows set/valid flags from the registry validators without printing values. Run it after deployment: NOT VERIFIED |
| Build-time variables | `NEXT_PUBLIC_*` (GA4 tag, shop UTC offset) are compiled in. Set them **before** `npm run build` |
| Known invalid values in development | `META_APP_SECRET` is placeholder text. `GOOGLE_SERVICE_ACCOUNT_JSON` fails JSON/base64 validation. Both need real values for production (client) |

## 3. Database

| Item | Status |
|---|---|
| `MONGODB_URI` | **BLOCKED** until rotation (0.1). Set on the server only. Never paste it into chat, AI tools, issue trackers or another project |
| `MONGODB_DB_NAME`, `MONGODB_NODE_PROCESSES` (= number of PM2 instances), `MONGODB_PREFER_IPV4=1` | CODE-REVIEWED (`lib/mongodb.ts`, `lib/mongodb-pool.ts`) |
| Atlas network access | Only the VPS IP. Remove any `0.0.0.0/0` entry: NOT VERIFIED (production console) |
| Migrations | No migration framework. The only index creation is at runtime in `lib/whatsapp/store.ts` (idempotent). No schema migration is needed for this release: CODE-REVIEWED |
| Pre-deploy backup | Atlas snapshot (or `mongodump`) immediately before deployment: NOT VERIFIED |
| Development isolation | **VERIFIED** today: the dev process environment and TCP table show no production reference. `process-env-check-20261110T0728Z.log`, `prod-connection-check-20261110T0728Z.log` |

## 4. Authentication, sessions, cookies

| Item | Status |
|---|---|
| `AUTH_SECRET` (≥ 24 characters, new value), `AUTH_URL` = `NEXTAUTH_URL` = the https site URL | CODE-REVIEWED. Values NOT VERIFIED |
| Cookies | NextAuth v5 defaults: `__Secure-`/`__Host-` prefixed, `HttpOnly`, `SameSite=Lax`, `Secure` when served over https. `trustHost: true` relies on the proxy passing the correct `Host` and `X-Forwarded-Proto`: CODE-REVIEWED |
| `ADMIN_PASSWORD` | Production value unknown. Must be new (S1 and 0.2): BLOCKED |
| Admin-only routes | **VERIFIED** refusals: 19/19 in `check:routes`, including admin APIs, cron, webhooks and `/test`. `headers-and-routes-20261110T0727Z.log` |

## 5. Security headers and CORS

| Item | Status |
|---|---|
| `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'`, no `X-Powered-By` | **VERIFIED** on a local server (pages and API). Added to `next.config.ts` today; not deployed |
| HSTS (`Strict-Transport-Security: max-age=31536000`) | Set on the HTTPS reverse proxy once every host is HTTPS-only: NOT VERIFIED |
| Full script CSP | Not set. It needs an audit of GA4, PayPal, Vapi and Google sign-in origins first. Recommended next hardening step |
| CORS | No `Access-Control-Allow-*` headers are sent, so APIs are same-origin only. This is the safe default: CODE-REVIEWED |
| TLS certificate and redirect from http to https | NOT VERIFIED (proxy) |

## 6. Payments

| Item | Status |
|---|---|
| PayPal | `PAYPAL_MODE=live`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`. The live credentials were in the exposed development file, so **issue new ones** (0.2). Configure the webhook URL in the PayPal dashboard: BLOCKED |
| Live-mode guard | Live mode is refused outside production unless `PAYPAL_ALLOW_LIVE_OUTSIDE_PRODUCTION` is set (it must be unset): CODE-REVIEWED, with self-tests |
| Razorpay | Optional, `RAZORPAY_KEY_ID`/`SECRET`. Only if used |
| Post-deploy | One controlled low-value order, refunded, with written approval: NOT VERIFIED |

## 7. Email (SMTP)

`SMTP_HOST`, `SMTP_PORT` (465 or 587), `SMTP_USER`, `SMTP_PASS` (new value, 0.2) and `OWNER_ALERT_EMAILS`.
- A controlled delivery test to an authorized recipient is still pending: NOT VERIFIED.
- In development, owner mail is refused unless a test recipient is set: CODE-REVIEWED.

## 8. WhatsApp, Vapi, Exotel

| Integration | Requirements | Status |
|---|---|---|
| WhatsApp / Meta | `META_APP_ID`, `META_APP_SECRET` (currently a placeholder), `META_WEBHOOK_VERIFY_TOKEN`, `META_CONFIG_ID`, `WHATSAPP_*`. `WHATSAPP_OUTBOUND_ENABLED=false` and `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED=false` until written approval. Webhook URL set in Meta | BLOCKED (App Secret, eligibility). The production webhook answered 503 on 8 Nov |
| Vapi | `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET` (new value after rotation), `VAPI_OUTBOUND_ENABLED=false` | BLOCKED (rotation). The production webhook answered 401 on 8 Nov |
| Exotel | `EXOTEL_*` (8 variables) | Out of current scope (KYC, vSIP): BLOCKED |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Live testing is paused (22 scenarios not run): BLOCKED |

## 9. Growth integrations and scheduled jobs

| Item | Status |
|---|---|
| GA4 | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` (set before build), `GA4_MEASUREMENT_ID`, `GA4_API_SECRET` (new), `GA4_PROPERTY_ID` |
| Service account | `GOOGLE_SERVICE_ACCOUNT_JSON` currently fails validation: NOT VERIFIED |
| Search Console | `SEARCH_CONSOLE_SITE_URL` |
| Merchant feed | `/feeds/google.xml` (feed fixes are local and not deployed) |
| `CRON_SECRET` | New value. Constant-time bearer comparison; placeholder secrets refused: CODE-REVIEWED, refusals VERIFIED |
| Scheduler | Every 15 minutes: `POST /api/ai/jobs`. Daily at 08:00 IST: `/api/ai/report/daily`. Both with `Authorization: Bearer $CRON_SECRET`. NOT VERIFIED (server crontab) |

## 10. Health checks and post-deployment verification

1. `GET /api/health` returns 200 with `mongo.connected: true`. It returns 503 when the database is unreachable; this was verified locally with the database stopped.
2. Sign in to `/test` as admin: every required variable shows **set/valid**, and no placeholder warnings appear.
3. `BASE_URL=https://<site> npm run check:routes`: 19/19 refusals. This only sends requests that must be refused; no data is created.
4. Response headers include the section 5 set.
5. Webhook verification for Vapi, WhatsApp and PayPal, from each provider's dashboard test tool.
6. Watch the logs for 30 minutes: no database authentication errors, no 5xx bursts.
7. Confirm Atlas shows connections only from the VPS IP.

## 11. Rollback

1. Keep the previous build directory (or git tag) and the previous `.env.production.local` (owner-only) on the server before deploying.
2. Rollback means restoring the previous build and env file, restarting the process manager, then running health check 1 and step 3.
3. If a database-affecting change misbehaves, restore from the pre-deploy Atlas snapshot. This release has no schema migration.
4. Credential rotation is **not** rolled back. Old credentials stay revoked.
