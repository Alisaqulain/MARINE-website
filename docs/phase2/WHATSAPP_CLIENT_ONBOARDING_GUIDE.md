# WhatsApp — client Embedded Signup guide (designated test number)

**Prepared:** 8 November 2026 · **Status: NOT STARTED — waiting for the client to confirm the designated test number.**

## Number rules (do not mix these up)

| Number | Role | Rule |
|---|---|---|
| +91 74570 99540 | Client's **live** WhatsApp Business number | Never onboarded, migrated, re-registered, disconnected or messaged. The code also blocks it from signup and sending. |
| +91 90274 97288 | **Developer's personal** testing number | Not the client's number. Not to be used for the client's onboarding. |
| *Client's designated test number* | The number for the client's Embedded Signup | **Not found in the project records.** The client must confirm it in writing. |

**What was done on 8 Nov 2026:** the app's signup gate (`WHATSAPP_COEXISTENCE_TEST_NUMBER` in the development environment) was set to the developer's personal number. It has been **cleared**, so "Start test signup" is now **closed**. It will be reopened only with the client's confirmed test number. No signup was started and no Meta authorization took place.

## Verified configuration

| Item | Value | Verified |
|---|---|---|
| Meta App ID | 1588276335845243 | Matches the environment |
| Business Login configuration ID | 1760993601871515 | Matches the environment. Its contents (permissions, assets) can only be checked in the Meta App Dashboard |
| Embedded Signup | v4, `FB.login` code flow, `extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }` | Code; matches Meta's coexistence page |
| Graph API | v26.0 (default) | Code |
| Meta App Secret | **Missing (placeholder text)** | Environment check |
| Outbound / automatic replies | **Off** | Environment and code |

Meta's pages also say that **Embedded Signup v2 and v3 were scheduled for deprecation on 15 October 2026**. We use v4. On v5, Business-app onboarding is the default.

## Eligibility (Meta's published requirements)

- The test number must already be active in the **WhatsApp Business app, version 2.24.17 or higher**, on the phone that holds the number.
- The Meta app owner must be a **Tech Provider or Solution Partner** (Meta: "You must already be a Solution Partner or Tech Provider"). **Client to confirm** the app's status in the Meta App Dashboard.
- Our webhook must accept webhooks (implemented) and be on a valid SSL URL (`https://marinamuseinternational.com`).
- Meta's pages do **not** publish country, account-age or how-long-active rules. These cannot be verified in advance, so eligibility is only confirmed when Meta's flow accepts the number.

## Before starting (client)

1. Confirm in writing the **exact designated test number**. It must not be the live number or the developer's number.
2. Confirm that this number is active in the WhatsApp Business app (2.24.17 or later) on a phone you can hold during signup.
3. Confirm which **Facebook account** has admin access to the **Business Portfolio** that should own this test WhatsApp account. Use that same account for the signup.
4. In the Meta App Dashboard (app 1588276335845243) → WhatsApp → Configuration, add the webhook:
   - **Callback URL:** `https://marinamuseinternational.com/api/meta/whatsapp/webhook`
   - **Verify token:** we will share it through a secure channel.
   - **Subscribe** `messages`, `account_update`, `history`, `smb_app_state_sync` and `smb_message_echoes`.
5. Provide the **Meta App Secret** (App Dashboard → Settings → Basic) through a **secure channel only**: a password-manager share (1Password or Bitwarden Send) or a one-time secret link. You could also enter it directly in the server's environment file. **Never by email or chat.**
6. The production server must run the current code with the App Secret, before the signup. Deployment needs your approval.

## Signup steps (client, after we reopen signup for the confirmed number)

The screen names are as described in Meta's documentation. Meta may change wording.

1. Sign in at `https://marinamuseinternational.com/admin` as the main admin → **WhatsApp** → **Start test signup (…last 4 digits of the confirmed number)**.
2. Meta's window opens. **Log in with the Facebook account from step 3** above and choose the Business Portfolio.
3. Choose the option to **connect your existing WhatsApp Business app account**. Do not create a new number.
4. Enter the **designated test number**. WhatsApp shows a verification code.
5. On the phone, a message arrives from the official Facebook Business account. Tap **Connect**, then **Connect to the Business Platform**.
6. Choose whether to **share chat history** (up to the last 6 months), then tap **Confirm**.
7. Paste the verification code back into Meta's window, review the permissions Meta shows for the app, and click **Finish**.
8. Keep the WhatsApp Business app open on the phone while the sync runs.

## What the backend receives

- From the popup:
  - `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` with the **WABA ID**.
  - A one-time authorization **code**, valid for about 30 seconds.
- Server-side, our backend:
  - Exchanges the code at `graph.facebook.com/v26.0/oauth/access_token` with the App ID and App Secret.
  - Receives a **business access token**, stored **encrypted** (AES-256-GCM) and never shown.
  - Looks up the **phone number ID**. Meta's coexistence example returns only `waba_id`, so we look the number up from the WABA.
- Allowed only for the confirmed test number. The live number is refused in code.

## Verification (developer, after signup)

1. `GET /{phone-number-id}?fields=is_on_biz_app,platform_type` must show `is_on_biz_app: true` and `platform_type: CLOUD_API` (coexistence active).
2. `POST /{waba-id}/subscribed_apps` subscribes our app to the WABA.
3. Within 24 hours, one-time contacts and history sync (`/smb_app_data`, `smb_app_state_sync` then `history`). Each runs only after the client confirms in Admin → WhatsApp.
4. `/test` shows real WABA and phone number IDs from the signup, not sample IDs, plus "Coexistence verified".
5. One **inbound** test message from another phone to the test number. Our replies stay **withheld**; nothing is sent.

## Limits once coexistence is active (from Meta)

- Throughput fixed at 20 messages per second.
- No groups, calls, broadcast lists or certain Business-app tools via the API.
- Messages sent from the Business app stay free.
- The app must be used regularly: disconnection after about 14 days of primary-app inactivity.
