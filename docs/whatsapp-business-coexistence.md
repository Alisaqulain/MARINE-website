# WhatsApp Business app coexistence

This build prepares Marina Muse International for WhatsApp Business app coexistence. It does not onboard `+91 74570 99540`.

The storefront still uses the `wa.me` link in `lib/company.ts`. Catalogue, collections, and Ask Marina are unchanged. The AI agent still answers from the catalogue through `POST /api/ai/chat`.

## Current status

Code-complete for a closed, testable integration. Live Embedded Signup, webhook subscription changes, contact sync, history sync, phone registration, and outbound WhatsApp messages are not enabled.

Admin → WhatsApp shows the app id, configuration id, missing secrets, masked ids, account state, and blockers. The live number is reported as not connected. A dry run cannot turn that into a connected or verified state.

## Architecture

- The Facebook JavaScript SDK loads only when the server says production signup is allowed. With the default flags, the SDK is not loaded and the signup button stays disabled.
- Launch options are `config_id` `1760993601871515`, `response_type: "code"`, `override_default_response_type: true`, and `extras: {}`.
- `POST /api/meta/whatsapp/signup/exchange` accepts the signup result from the main admin only. A dry run never calls Meta.
- A real code is exchanged with `POST https://graph.facebook.com/v26.0/oauth/access_token` and `grant_type=authorization_code` only when both production flags, the app secret, and `AUTH_SECRET` are set. The route also passes `allowNetwork: true`. Tests use a mock fetch. A call with neither a mock nor that flag does not leave the server.
- The code is hashed with SHA-256 before a second exchange is refused. The raw code is not stored.
- A returned token is encrypted with AES-256-GCM using `AUTH_SECRET` and written to MongoDB collection `wa_coexistence_state`. If Meta returns `expires_in`, that expiry is stored. The browser never receives the token. A later successful exchange replaces the previous ciphertext.
- `GET` and `POST /api/meta/whatsapp/webhook` check Meta’s handshake and `X-Hub-Signature-256` with a constant-time compare. Invalid signatures are rejected. Webhook keys are stored once. Raw message bodies are not kept.
- `history`, `smb_app_state_sync`, `smb_message_echoes`, and `account_update` never create a reply. A new customer text can create a catalogue draft through the existing agent. The draft is not sent.
- `POST /api/meta/whatsapp/signup/approve` always returns HTTP 403.

Graph paths `/register`, `/deregister`, `/messages`, `/subscribed_apps`, and `/smb_app_data` are refused. Any Graph call containing `917457099540` is refused.

Account states:

- `not_connected` — nothing is stored.
- `simulated` — a dry run saved sample ids. This is not a WhatsApp connection.
- `credentials_stored` — an encrypted token exists. Coexistence is still not verified.
- `failed` — the last attempt stopped before a token was stored.

This screen never reports connected or verified.

## Official documentation

- Versions, including v4 and the empty `extras` object: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions
- Embedded Signup implementation and Graph `v26.0`: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation
- Coexistence onboarding, webhook fields, skip registration, `is_on_biz_app`, and one-time sync: https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/

## Meta findings

| Item | Label | Finding |
| --- | --- | --- |
| Coexistence keeps an eligible Business app number on the phone and on Cloud API | VERIFIED FROM OFFICIAL DOCUMENTATION | Described in the onboarding guide. |
| Embedded Signup v4 is current | VERIFIED FROM OFFICIAL DOCUMENTATION | v2 and v3 are deprecated on 15 October 2026. |
| v4 launch uses an empty `extras` object | VERIFIED FROM OFFICIAL DOCUMENTATION | The login configuration selects the product. This build does not send `featureType`. |
| Older `featureType` example | NEEDS META DASHBOARD CONFIRMATION | The onboarding guide still shows `whatsapp_business_app_onboarding`. If configuration `1760993601871515` does not offer the existing WhatsApp Business account, stop. |
| That configuration is coexistence-enabled | NEEDS META DASHBOARD CONFIRMATION | The id was supplied. This project cannot open the Meta app. |
| Tech Provider or Solution Partner, app review, and business verification | NEEDS META DASHBOARD CONFIRMATION | Meta requires the partner role. The permission names were supplied as approved. Access level still has to be read in the dashboard. |
| Authorization-code exchange | VERIFIED FROM OFFICIAL DOCUMENTATION | Server-side `/{version}/oauth/access_token`. |
| Graph version | VERIFIED FROM OFFICIAL DOCUMENTATION | The implementation guide gives `v26.0` for `FB.init`. |
| Webhook fields | VERIFIED FROM OFFICIAL DOCUMENTATION | `account_update`, `history`, `smb_app_state_sync`, and `smb_message_echoes` are separate fields. `messages` covers new customer texts. |
| Webhook subscription is active | BLOCKED BY MISSING ACCESS OR CREDENTIALS | Not called. A local handshake is not a subscription. |
| Skip phone registration | VERIFIED FROM OFFICIAL DOCUMENTATION | The Business app number is already registered. |
| Do not deregister a coexistence number | VERIFIED FROM OFFICIAL DOCUMENTATION | The Deregister API is blocked. |
| `is_on_biz_app` and `platform_type` | BLOCKED BY MISSING ACCESS OR CREDENTIALS | This is the coexistence check. It has not been called. |
| One-time contact sync and history sync | BLOCKED BY MISSING ACCESS OR CREDENTIALS | Meta uses `POST /{phone-number-id}/smb_app_data` once per sync type, within 24 hours of a real onboarding. This build does not call it. |
| Separate-number test | NEEDS SEPARATE-NUMBER TEST | Not run. A Cloud API test number does not prove coexistence. |

## Environment

Put these in `.env.local`. Do not commit that file. `.env.example` has the same placeholders.

```
META_APP_ID=1588276335845243
META_APP_SECRET=
META_CONFIG_ID=1760993601871515
META_GRAPH_API_VERSION=v26.0
META_WEBHOOK_VERIFY_TOKEN=
META_WEBHOOK_APP_SECRET=
WHATSAPP_COEXISTENCE_ENABLED=false
WHATSAPP_PRODUCTION_ONBOARDING_APPROVED=false
WHATSAPP_OUTBOUND_ENABLED=false
```

`META_WEBHOOK_APP_SECRET` can match the app secret. If it is empty, signature checks use `META_APP_SECRET`. `AUTH_URL` and `NEXTAUTH_URL` must be full URLs, with `http://` or `https://` and no trailing punctuation. A stray character makes NextAuth reject every session.

Leave the three WhatsApp flags `false`. Restart the server after a change. Setting the flags does not subscribe webhooks, register a number, or send messages.

## Local troubleshooting

- Admin sign-in or `/api/meta/whatsapp/status` returns an invalid-URL error: check `AUTH_URL` for a trailing character and restart.
- Status returns 401: the dashboard session is missing.
- Exchange returns 403 for a staff user: only the main admin can post a signup result.
- Webhook POST returns 503: `META_APP_SECRET` or `META_WEBHOOK_APP_SECRET` is empty. That is expected before credentials are added.
- A simulated finish shows masked sample ids: the account state is `simulated`, not connected.

## Webhooks

When a separate test is approved:

1. Deploy the site on public HTTPS.
2. Set the callback to `https://YOUR-DOMAIN/api/meta/whatsapp/webhook` and the verify token to `META_WEBHOOK_VERIFY_TOKEN`.
3. Subscribe `messages`, `account_update`, `history`, `smb_app_state_sync`, and `smb_message_echoes`.
4. The admin screen still says the subscription is not verified until that subscription is confirmed in Meta.

Do not complete Embedded Signup with `+91 74570 99540`.

## Automated tests

```
npm run check:whatsapp
```

The script mocks Meta. It uses documentation sample ids `102290129340398` and `106540352242922`. It does not use the client’s number. A test fails if an unmocked exchange tries to call Meta, or if registration, deregistration, sync, or sending is allowed.

## Separate-number test

Run this only with a WhatsApp Business app number that is not `+91 74570 99540`, on app version 2.24.17 or newer, and only after written approval for that number.

1. Keep the three flags false. In Admin → WhatsApp, use “Simulate finish (no Meta call)”. Meta must not be called, credentials stored must stay no, and the state must stay `simulated`.
2. On a staging host, set the flags and secrets only for that test window.
3. Open Embedded Signup. Continue only if the screen offers the existing WhatsApp Business account. Enter the separate test number, not the client’s number.
4. Confirm the response has no token and the admin state is `credentials_stored`, with coexistence still not verified.
5. Deliver a signed `history` fixture, an `smb_app_state_sync` fixture, and an `smb_message_echoes` fixture. None of them may create a reply.
6. Deliver one new customer `messages` text. The agent may draft a catalogue answer. It must not send a WhatsApp message.
7. Leave contact sync and history sync uncalled unless you accept that each can be started only once.
8. Set the three flags back to `false` and restart when the window ends.

A normal Cloud API test number does not prove the Business app and Cloud API are sharing a number.

## Live approval sequence

Do all of this in writing before the client’s number is used:

1. Confirm the login configuration shows the existing WhatsApp Business account.
2. Confirm the partner role, permissions, and business verification.
3. Finish the separate-number test.
4. Put the app secret and verify token in the server environment, not in chat.
5. Approve the public webhook URL and the field subscription.
6. Approve Embedded Signup on the live number.
7. Approve the one-time contact sync and the one-time history sync within 24 hours.
8. Accept Meta’s Business app changes: companion devices unlink, broadcast lists become read-only, and disappearing, view-once, and live-location messages turn off for individual chats. Coexistence throughput is 20 messages per second. API messages are billed. Messages sent from the Business app stay free.

The disabled admin control cannot grant this approval.

## Rollback

If a future onboarding must be stopped before it starts, set the three WhatsApp flags to `false` and restart. Do not call deregister, register, or `smb_app_data`.

If a business has already connected and wants to disconnect, the business uses WhatsApp Business app → Settings → Account → Business Platform → Disconnect. That is a Meta account action, not a button in this website. This build has not performed that connection.

A dry-run row in `wa_coexistence_state` can be deleted from MongoDB. Deleting it does not change the WhatsApp number.
