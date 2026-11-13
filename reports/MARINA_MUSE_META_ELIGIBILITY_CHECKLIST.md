# Marina Muse: Meta eligibility checklist (WhatsApp Embedded Signup and Business App Coexistence)

Prepared 9 November 2026, re-checked 13:05 UTC. **Embedded Signup has not been started.**

**Verified versus assumed.** Only items marked VERIFIED were checked here. Everything about Meta's own records (verification, Tech Provider status, permissions, reviews, coexistence eligibility) is an **assumption until the client confirms it** in Meta Business Suite or the App Dashboard. No Meta API call was made, and none is possible until the real App Secret is entered.

Statuses come only from what could actually be checked. Meta-side status (verification, reviews, eligibility) **cannot** be read from here: `META_APP_SECRET` holds placeholder text, so no Graph API call can authenticate, and no Meta call was made. Code configuration alone is never treated as eligibility.

Statuses: **VERIFIED** · **PENDING** (needs a check or answer from the client in Meta Business Suite or the App Dashboard) · **BLOCKED** (cannot proceed until a prerequisite exists) · **NOT APPLICABLE**.

| # | Item | Status | What was checked | What is needed |
|---|---|---|---|---|
| 1 | Business Verification (Meta Business Portfolio) | **PENDING** | Not readable without Meta access | Client: Business Settings → Security Center → screenshot of the verification status |
| 2 | Tech Provider eligibility/status | **PENDING** | Not readable | Client: App Dashboard → app type / Tech Provider onboarding status. Embedded Signup for other businesses needs Tech Provider (or Solution Partner) access |
| 3 | Embedded Signup configuration | **PENDING** | `META_CONFIG_ID` and `META_APP_ID` are set and format-valid (code only) | Client: confirm in App Dashboard → Facebook Login for Business → Configurations that this configuration exists, is the WhatsApp Embedded Signup type, and allows the coexistence feature type |
| 4 | Business App Coexistence eligibility | **PENDING** | Code implements the coexistence flow (`featureType` for business-app onboarding, history and contact sync, message echoes; 98 automated checks pass) | Client: Meta's current coexistence eligibility for the number's country and the WhatsApp Business app version. The test number must be an active WhatsApp **Business app** number |
| 5 | Required app permissions | **PENDING** | Code requests `whatsapp_business_management`, `whatsapp_business_messaging` and the business-app onboarding scope; it subscribes to `messages`, `smb_app_data`, `smb_message_echoes` and history events | Client: App Dashboard → App Review → confirm these permissions are approved (Advanced Access where required) |
| 6 | Outstanding Meta reviews or approvals | **PENDING** | Not readable | Client: list any pending App Review, Business Verification or display-name review |
| 7 | Meta App Secret availability | **BLOCKED** | `META_APP_SECRET` is placeholder text (project validator) | Client provides the current secret securely; you enter it in `.env.local`. Never in chat, logs or reports |
| 8 | Dedicated test-number readiness | **BLOCKED** | `WHATSAPP_COEXISTENCE_TEST_NUMBER` is not set. The code permanently blocks the live number (`BLOCKED_LIVE_NUMBER` = +91 74570 99540) | You enter your authorized personal number, for isolated testing only. Never add it to Marina Muse's production WABA or register it as the business number |
| 9 | Authentication-code exchange readiness | **BLOCKED** | Code exists (`/api/meta/whatsapp/signup/exchange`, admin-only, refuses anonymous callers in route checks); unit-tested with mocks | Needs a valid App Secret (item 7) and a test number (item 8). A real exchange has never been run |
| 10 | Webhook and event-subscription readiness | **PENDING** | Local: wrong verify token refused (403), forged signature refused. `META_WEBHOOK_VERIFY_TOKEN` is set and valid. **Production** answered a wrong-token verify request with HTTP 503 "Forbidden" (9 Nov), unlike the local 403, which suggests production lacks the verify token or runs older code | Signature checks need the real App Secret. Production webhook setup needs separate deployment approval |

Re-check 9 Nov 13:05 UTC: `META_APP_SECRET` is still placeholder text (fingerprint unchanged), and `WHATSAPP_COEXISTENCE_TEST_NUMBER` is empty. No item changed status.

**Result: not eligible to start yet.** Items 7 and 8 block. Items 1–6 and 10 need the client's confirmation from Meta's dashboards.

## Safeguards already in code (verified by automated checks)

- **No sending of any kind** unless `WHATSAPP_COEXISTENCE_ENABLED` and `WHATSAPP_OUTBOUND_ENABLED` are both set, plus written production approval or replies from the verified test number. `WHATSAPP_OUTBOUND_ENABLED` is unset, so no automatic replies and no outbound messages. Every send, including AI replies to inbound messages, goes through this one gate (`sendGate`).
- **The live number** +91 74570 99540 can never be messaged and is never treated as a test number.
- **The Graph API allow-list** excludes register, deregister, `messages` and DELETE calls during onboarding.

## Test and cleanup record

| Date (UTC) | Action | Resources created | Cleanup |
|---|---|---|---|
| 9 Nov 13:05 | No test performed (App Secret and eligibility pending) | **None**: no test WABA, no number registration, no system-user token, no app subscription, no webhook change | Nothing to clean up. `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_BUSINESS_ACCOUNT_ID` are unset; `WHATSAPP_OUTBOUND_ENABLED` is unset |

Add a row for each step of the test plan below as it happens, with the matching cleanup step.

## Test plan once eligible (not started)

1. The client confirms items 1–6 and 10. You enter `META_APP_SECRET` and `WHATSAPP_COEXISTENCE_TEST_NUMBER` (personal number) in `.env.local`. `WHATSAPP_OUTBOUND_ENABLED` and `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED` stay unset.
2. Run `npm run check:whatsapp` and `/test` again (read-only status).
3. Run Embedded Signup from the admin panel with the personal number into a **test** WABA, never Marina Muse's production WABA.
4. Verify: the code exchange, webhook subscription, history and contact sync events, and that no message is sent.
5. **Clean up:**
   - Remove the test number from the test WABA.
   - Revoke the test system-user token.
   - Unsubscribe the test app from the test WABA.
   - Clear `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_BUSINESS_ACCOUNT_ID` from `.env.local`.
   - Record each step.
   - Do not touch unrelated Meta Business assets.
