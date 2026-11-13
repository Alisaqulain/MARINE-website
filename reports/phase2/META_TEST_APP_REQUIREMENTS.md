# WhatsApp: separate Meta test app requirements

**10 November 2026.** Verified against the code:
- `lib/whatsapp/coexistence.ts`
- `lib/whatsapp/coexistence-actions.ts`
- `lib/whatsapp/cloud.ts`
- `app/api/meta/whatsapp/*`

**Nothing here touches the Marina Muse business number.** The code refuses any Graph call that includes it (`BLOCKED_LIVE_NUMBER`). In the isolated environment it now has **no fallback** to the client's Meta app (`metaAppIds()`).

## 1. Separate developer app and test business

| Item | Requirement |
|---|---|
| Meta developer app | **New** app of type **Business**, used only for Marina Muse testing. Never the production app (`1588276335845243`) |
| Business portfolio | A **test** business portfolio (or the client's portfolio with a separate test WABA). The production WABA and the business number must **not** be added |
| Products on the app | **WhatsApp**, **Facebook Login for Business** |
| App mode | Development mode is enough for testers who have a role on the app. Test users must be app admins, developers or testers |

## 2. Credentials and identifiers to supply (in `.env.isolated-test.local`)

| Variable | What it is | Where to find it | Needed for |
|---|---|---|---|
| `META_APP_ID` | Test app id | App Dashboard → App settings → Basic | Embedded Signup launch (`FB.init`); code exchange client id |
| `META_APP_SECRET` | Test app secret | App settings → Basic → App secret | Webhook `X-Hub-Signature-256` verification; code-for-token exchange |
| `META_CONFIG_ID` | **Facebook Login for Business** configuration id for WhatsApp Embedded Signup | Facebook Login for Business → Configurations → Create (variation: WhatsApp Embedded Signup) | Embedded Signup v4 `config_id` |
| `WHATSAPP_COEXISTENCE_TEST_NUMBER` | The **previously approved personal test number**, digits with country code | — | The only number the code allows to onboard before production approval |

**Not needed from you:**
- WABA id, phone-number id and access token. Embedded Signup returns them; the token is stored encrypted with the per-session `AUTH_SECRET`.
- Webhook verify token. The launcher generates it per test session, and I'll give it to you for the dashboard.

## 3. Permissions on the Login for Business configuration

- `whatsapp_business_management`
- `whatsapp_business_messaging`

These are the two the code requests and checks (`lib/whatsapp/cloud.ts:77`). No other permission is needed.

## 4. Webhook configuration (test app → WhatsApp → Configuration)

| Setting | Value |
|---|---|
| Callback URL | `https://<temporary test host>/api/meta/whatsapp/webhook`. **Only after the Docker blocker is fixed** and the temporary endpoint is approved |
| Verify token | The isolated session's `META_WEBHOOK_VERIFY_TOKEN` (provided at setup time) |
| Subscribed fields | `messages`, `history`, `smb_app_state_sync`, `smb_message_echoes`, `account_update` |
| Signature | Meta signs with the app secret (`X-Hub-Signature-256`); the code rejects unsigned or altered events (tested 8/8) |

## 5. Test number requirements (coexistence flow)

- A **personal** number, not the business number, already approved by the client.
- It runs the **WhatsApp Business app version 2.24.17 or newer**, with coexistence available in the region.
- The number must not already be registered on another Cloud API WABA.
- History and contact sync are offered by Meta **once, within 24 hours** of onboarding (`smb_app_data`). The code requests them only on an explicit admin action.

## 6. Prerequisites outside the code (Meta-side; please confirm)

| Prerequisite | Why |
|---|---|
| **Tech Provider** (or Solution Partner) status for the business that owns the test app | Required by Meta for Embedded Signup to onboard WhatsApp Business **app** numbers (coexistence) for others. Listed in the code's blocker list |
| Business verification of that business | Typically required for Tech Provider status and for advanced access |
| App Review / advanced access for the two permissions | **Not needed for testing** when the testers have roles on the app (standard access in development mode). Needed only for production onboarding of external businesses |

## 7. What stays off during tests

`WHATSAPP_OUTBOUND_ENABLED`, `WHATSAPP_COEXISTENCE_ENABLED` and `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED` are forced `false` by the launcher, so **no message can be sent**.

Any single test message to the test number needs:
- your separate explicit approval for that message; and
- a deliberate, recorded change to the test session.

## 8. Approvals needed from you

1. Create the test app and test business setup above, and supply the four values in section 2.
2. Confirm Tech Provider status, or tell me it is pending. If it is pending, Embedded Signup coexistence cannot complete.
3. Approve the temporary HTTPS endpoint (after the Docker fix) for real webhook delivery.
