# Marina Muse: production readiness checklist

Prepared 9 November 2026, updated 13:10 UTC after the development security isolation sprint. **Nothing here has been deployed or approved for production.** Each item says who must act. "Dev" items can be done in development after approval; "Prod" items need separate written production approval.

Statuses: ✅ done/verified · ⏳ pending client or provider · ⛔ blocked · ❌ failing.

## 1. Security (do these first)

| # | Item | Status | Dev / Prod | Action |
|---|---|---|---|---|
| S1 | `ADMIN_PASSWORD` sample value | ✅ dev / ❌ Prod | Prod | Development replaced 9 Nov (verified). Production value unknown: client approves a new production password; confirm without logging in with the sample |
| S2 | PayPal LIVE in development | ✅ | Dev | Done 9 Nov: live credentials removed, `PAYPAL_MODE=sandbox`, live-mode guard applied; checkout disabled (503). Sandbox credentials from the client only if local checkout is needed |
| S3 | Development used the production database | ✅ | Dev | Done 9 Nov: local test database + remote-host guard (13/13 and 8/8). Old servers 3548/18668 exited. Re-verified 10 Nov: 0 production references, 0 production connections |
| S8 | **Production credentials exposed outside the project** (found 10 Nov): `jobcareerpao\.env.local`, 21 VS Code/Cursor history snapshots, Cursor state and transcript, ChatGPT cache | ❌ | Prod | **Rotate the MongoDB password and every secret from the pre-isolation `.env.local`**; review the Atlas access log; then clean the copies. See `MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md` section 15 |
| S9 | Security headers | ✅ dev / ⏳ Prod | Prod | Basic headers added and verified locally 10 Nov; HSTS and script CSP at deployment |
| S4 | Placeholder credentials | ⏳ | Dev | Vapi phone/SIP cleared 9 Nov. `META_APP_SECRET`: client provides it securely |
| S6 | Development uses the website's Gemini key (shared quota) | ⏳ | Dev | Use the test key in development once it is confirmed (`GEMINI_API_KEY` kept unchanged as instructed) |
| S7 | Development side effects (ShipGlobal bookings, GA4 revenue, owner mail) | ✅ | Dev | Refused or redirected outside production since 9 Nov |
| S5 | Vapi webhook secret rotation | ⏳ | Dev (Vapi Marina only) | Client provides replacement → follow `MARINA_MUSE_WEBHOOK_SECRET_ROTATION_GUIDE.md` |

## 2. Agent 1: Chat & Sales

| # | Item | Status | Action |
|---|---|---|---|
| C1 | Gemini fallback, retries, timeouts, quota cooldown | ✅ (mocked tests) | — |
| C2 | Live Gemini conversation tests | ⛔ | Isolated test key and project confirmation (see Agent 2 V5) |
| C3 | Owner alerts by email | ⏳ | Authorized test recipient → `OWNER_ALERT_EMAILS` locally → one controlled send |
| C4 | Follow-up job scheduler | ✅ dev / ⛔ Prod | Development: `npm run dev:scheduler` verified 9 Nov. Production: a scheduler calling `/api/ai/jobs` every 15 min with the cron bearer (deployment approval) |

## 3. Agent 2: Voice & Call

| # | Item | Status | Action |
|---|---|---|---|
| V1 | Marina Muse Assistant v4 (Emma, Gemini 3.8 Flash, tools, consent gate) | ✅ | Client approves Emma and the configuration |
| V2 | Riley unchanged | ✅ (re-verified 9 Nov) | — |
| V3 | Production webhook answers 401 | ⛔ Prod | Deploy `VAPI_WEBHOOK_SECRET` (new value after rotation) and the agent code; re-test tools on production |
| V4 | Phone number / SIP / Exotel | ⛔ | Out of approved scope; Exotel KYC + vSIP; then a supervised test call |
| V5 | 22 conversation scenarios | ⛔ | `GEMINI_TEST_API_KEY` + `GEMINI_TEST_PROJECT_CONFIRMED`; the harness then runs offline from the catalogue snapshot (no production DB) |
| V6 | Publishing the assistant | ⛔ | Only after V3–V5 and written approval |

## 4. Agent 3: Growth & Revenue

| # | Item | Status | Action |
|---|---|---|---|
| G1 | GA4 and Search Console APIs | ✅ | — |
| G2 | GA4 tag on the live site | ❌ Prod | Rebuild production with `NEXT_PUBLIC_GA4_MEASUREMENT_ID` set (it is compiled in at build time) |
| G3 | Shopping feed faults (ids > 50 chars, duplicate id, long titles, no identifiers) | ✅ fixed locally / ⛔ Prod | Deploy the feed fix before the first Merchant Center fetch |
| G4 | Feed content (212 stock photos, 3 preorders without date: `MM-WHL-036`, `MM-CUS-001`, `MM-DEC-030`, 45 thin descriptions) | ⏳ | Client decisions; see `docs/phase2/MERCHANT_CENTER_SCHEDULED_FETCH.md`. Local feed otherwise passes all structural checks (9 Nov) |
| G5 | Merchant Center scheduled fetch | ⏳ | Client's Merchant Center account; follow the guide |
| G6 | Daily report scheduler | ✅ dev / ⛔ Prod | Development scheduler verified 9 Nov. Production: scheduler calling `/api/ai/report/daily` daily 08:00 with the cron bearer |
| G7 | Daily report email delivery | ⏳ | Authorized test recipient first |

## 5. Agent 4: WhatsApp Sales & Support

| # | Item | Status | Action |
|---|---|---|---|
| W1 | Code, gates and mocked tests (98 + 13 checks) | ✅ | — |
| W2 | Meta eligibility (10 items) | ⏳/⛔ | `MARINA_MUSE_META_ELIGIBILITY_CHECKLIST.md` |
| W3 | Isolated Embedded Signup with your personal number | ⛔ | After W2; test WABA only; clean up afterwards |
| W4 | Production WhatsApp webhook (answered 503 to a verify probe) | ⛔ Prod | Deploy verify token + app secret; re-test |
| W5 | Outbound / automatic replies | ⛔ by design | Stay off until separate written approval |

## 6. Deployment gate (all must be true before requesting production approval)

- [x] S2, S3 resolved in development (9 Nov); old dev servers exited; re-verified 10 Nov
- [ ] **S8: production MongoDB password and all other exposed secrets rotated** (client); Atlas access log reviewed
- [ ] S1 on production (admin password)
- [ ] All 22 conversation scenarios recorded and reviewed as PASS
- [ ] Controlled SMTP delivery test passed
- [ ] Client approved Emma and the v4 configuration
- [ ] Feed content decisions made
- [ ] Meta eligibility items confirmed (if WhatsApp is in the release)
- [ ] Written production deployment approval covering: environment variables (`VAPI_WEBHOOK_SECRET`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, admin password), code (agents, feed, report), scheduler
