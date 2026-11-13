# Agent 4: WhatsApp — isolated development and test report

**10 November 2026, 16:40 UTC.** Scope: isolated development and testing only.

**Not done:**
- The Marina Muse business number was never accessed or connected. The code also refuses any Graph call that includes it (`BLOCKED_LIVE_NUMBER`, `lib/whatsapp/coexistence.ts:5`).
- No message was sent; no onboarding was done.
- No production token was used; no webhook was changed.
- **No Meta Graph API request was made.**

Evidence paths are relative to `reports/evidence/`.

## Summary

| | Status |
|---|---|
| Development | **Complete.** Embedded Signup v4 (coexistence featureType), code exchange with replay protection, encrypted token storage, webhook verify and signature, inbound planning (customer, echo, history and contact sync), withheld drafts, multi-flag send gate, live-number block |
| **Isolation fix (10 Nov)** | **Done.** In the isolated environment the code fell back to the hard-coded supplied Meta app and config ids. A test could therefore have called Meta with the client's app id. Now there is **no fallback** when `MARINA_ISOLATED_TEST=1`; production behaviour is unchanged |
| Isolated tests | **Webhook 8/8, admin-session isolation 5/5, mocked suite 102/102** (4 new) |
| Embedded Signup, message sync, test inbound and outbound | **BLOCKED.** Isolated Meta test app credentials not supplied; a public HTTPS test endpoint needs approval |
| Completion (verifiable) | Development 100%. **Isolated webhook and gating tests 100%.** Live test-app flows 0% (blocked) |
| Production readiness | **Not ready.** Meta App Secret, eligibility, Tech Provider status and production approval are all outstanding |

## 1. Isolation fix

| Before | After |
|---|---|
| `META_APP_ID` or `META_CONFIG_ID` unset → `SUPPLIED_APP_ID` / `SUPPLIED_CONFIG_ID`, in **every** environment. Three places: status, signup code exchange, and the app-subscriptions check that calls the Graph API | New `metaAppIds()` (`lib/whatsapp/coexistence.ts`): no fallback when `MARINA_ISOLATED_TEST=1`. The exchange route refuses with 503 `calledMeta:false` without an app id. The subscriptions check returns "Meta was not called". Outside isolation nothing changed |

**Proof that nothing reached Meta before the fix.** The isolated server log shows the five Meta-capable endpoints were each hit once, all **refused** (401, or 307 to login) by the anonymous refusal suite. No Graph activity appears in the log.

## 2. Tests executed (isolated server, port 3939; synthetic session secrets)

| # | Test | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| W1 | Verify handshake, wrong token | 403 | 403 | PASS | `phase2/webhook-tests-20261110T1633Z.log` |
| W2 | Verify handshake, correct token | 200, echoes the challenge | 200, `987654321` | PASS | same |
| W3 | Verify handshake, wrong mode | 403 | 403 | PASS | same |
| W4 | Event without signature | 401 | 401 | PASS | same |
| W5 | Event signed with the wrong secret | 401 | 401 | PASS | same |
| W6 | Body changed after signing | 401 | 401 | PASS | same |
| W7 | Valid signature, body not JSON | 400 | 400 | PASS | same |
| W8 | Valid signature, synthetic customer text | 200; inbound stored; **nothing sent** | 200; inbound stored in `ai_wa_messages`; draft **withheld**; **0 sent** | PASS | same |
| A0 | Admin session on the isolated server | session | session | PASS | `phase2/whatsapp-isolation-tests-20261110T1638Z.log` |
| WA1 | Status exposes no Meta app id in isolation | `appId=""` | `appId=""`, `configId=""` | PASS | same |
| WA2 | Production signup not allowed; live number untouched | false / false | false / false | PASS | same |
| WA3 | Signup exchange never calls Meta | `calledMeta:false` | 400, `calledMeta:false` (refused at payload validation before the app-id guard; the guard itself is covered by the unit checks) | PASS | same |
| WA4 | Integrations check does not query Meta subscriptions | not attempted | not attempted | PASS | same |
| U1–U4 | `metaAppIds`: isolated → no fallback; isolated + explicit test app → used; normal → unchanged; isolated status → no app id | — | — | PASS (part of 102/102) | `phase2/check-whatsapp-20261110T*.log` |

**Test history.**
- An earlier W8 run failed because my synthetic sender matched the synthetic business number. The app correctly treated it as a business echo and ignored it.
- Fixing the test data gave PASS.
- The synthetic lead and messages created by W8 were removed afterwards (`phase2/cleanup-synthetic-test-data-*.log`).

## 3. Meta requirements, verified against the code (not requested until now)

| Variable or item | Purpose | Meta permission or configuration | Why the code needs it | Needed for |
|---|---|---|---|---|
| `META_APP_ID` | **Isolated Meta test app** id (Business-type developer app, never the production app) | WhatsApp product added to the test app | Launches Embedded Signup (`FB.init`); client id for the code exchange | Development flow and message testing |
| `META_CONFIG_ID` | Facebook Login for Business configuration for WhatsApp Embedded Signup **in the test app** | Configuration with **`whatsapp_business_management`** and **`whatsapp_business_messaging`** (`lib/whatsapp/cloud.ts:77`) | `config_id` for Embedded Signup v4 with the coexistence `featureType` | Signup test |
| `META_APP_SECRET` | The test app's secret | — | Webhook `X-Hub-Signature-256` verification; code-for-token exchange | Message testing (real webhooks) and signup |
| `WHATSAPP_COEXISTENCE_TEST_NUMBER` | The previously approved **personal test number** (not the business number) | Phone running WhatsApp Business app ≥ 2.24.17 (code blocker list) | The only number allowed to onboard before production approval | Signup and sync test |
| Webhook subscription (configuration, not a credential) | Callback `https://<public test host>/api/meta/whatsapp/webhook` + verify token | Subscribe fields `messages`, `history`, `smb_app_state_sync`, `smb_message_echoes`, `account_update` | Meta cannot call `localhost` | Real inbound and sync testing. **Needs separate approval for a public test endpoint** |
| Tech Provider or Solution Partner status | — | Business verification in Meta | Required by Meta for coexistence Embedded Signup | Signup test |

**Not needed from you:** WABA id, phone-number id and access token. Embedded Signup returns them, and the token is stored encrypted.

**Safe outbound testing.** Sending stays off: `WHATSAPP_OUTBOUND_ENABLED`, `WHATSAPP_COEXISTENCE_ENABLED` and `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED` are forced `false` in isolation. A test send to the test number would need your explicit go-ahead for that single message.

## 4. Remaining risks

- No real Meta webhook delivery or sync has been tested; it needs a public endpoint and test-app credentials.
- The production webhook answered 503 on 8 Nov (App Secret placeholder).
- The production `WHATSAPP_ACCESS_TOKEN` and `META_WEBHOOK_VERIFY_TOKEN` are exposed and must be rotated before production.

---

## Update: 10 Nov 2026, 17:15 UTC

- **Meta test-app requirements** are documented in `META_TEST_APP_REQUIREMENTS.md`:
  - app, Login for Business configuration, two permissions;
  - webhook fields;
  - test-number requirements;
  - Tech Provider prerequisite.
- **Real webhook delivery** needs the temporary HTTPS endpoint, which stays **not started** until the Docker blocker is remediated (`DOCKER_SECURITY_EVIDENCE.md`).
- **No Meta request was made.** The business number was not touched.
