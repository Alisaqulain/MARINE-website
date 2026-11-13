# WhatsApp Business app coexistence

## Status on 3 November 2026

- **Not active.** No real Embedded Signup has run; `/test` → WhatsApp Business app coexistence shows *Partially configured / not connected*.
- In this environment `META_APP_SECRET` is set but not in Meta's 32-hex format, so webhook signatures and Meta's subscription list cannot be verified yet; `WHATSAPP_COEXISTENCE_ENABLED` and `WHATSAPP_COEXISTENCE_TEST_NUMBER` are not set, so signup stays closed.
- The client's live number has not been registered, migrated, deregistered or messaged.

### Standard Cloud API vs coexistence — kept separate

| | Standard Cloud API | Coexistence (this build) |
| --- | --- | --- |
| Signup event | `FINISH` | `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` |
| What the site does | **Refuses** it (HTTP 409, nothing registered) | Exchanges the code on the server, checks the number |
| `/register`, `/deregister` | — | **Never called** (blocked by `coexistenceCallAllowed`) |
| Phone stays on the WhatsApp Business app | No | Yes |

Required Meta setup, eligibility and the approval sequence are below.

Coexistence keeps a WhatsApp Business **app** number working on the phone while the same number is connected to the Cloud API (and Marina AI). This build implements the full flow, gated so that only an approved **test number** can be onboarded until you give written production approval. The client's live number `+91 74570 99540` is refused in code and is never registered, migrated or deregistered by this site.

## Modes (shown in Admin → WhatsApp and on `/test`)

| Mode | When | What can happen |
| --- | --- | --- |
| Not configured | secrets/flags missing, or no test number and no production approval | nothing; signup is closed |
| Test | `WHATSAPP_COEXISTENCE_ENABLED=true`, `WHATSAPP_COEXISTENCE_TEST_NUMBER` set, production approval **false** | Embedded Signup may run; after the code exchange, any number other than the test number has its token deleted immediately |
| Ready for onboarding | `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED=true` (your written approval) | the client's number may be onboarded |
| Live | production approval + a non-test number verified with `is_on_biz_app=true`, `platform_type=CLOUD_API`, app subscribed | coexistence running on the client's number |

"Connected" on `/test` additionally requires Meta to confirm the app's webhook fields (`messages`, `history`, `smb_app_state_sync`, `smb_message_echoes`, `account_update`).

## Flow

1. **Embedded Signup v4** (`FB.login`, code flow): `config_id 1760993601871515`, `response_type: "code"`, `override_default_response_type: true`, `extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }`. Meta's v4 page says Business-app onboarding "continues to be supported through the featureType parameter".
2. **Finish event** `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` — Meta documents only `waba_id`; `phone_number_id` is optional and looked up afterwards.
3. **Code exchange** (server only): `POST /api/meta/whatsapp/signup/exchange` — main admin, same origin, rate limited, replayed codes refused, token encrypted (AES-256-GCM with `AUTH_SECRET`) in `wa_coexistence_state`. Never returned to the browser.
4. **Number check** (automatic, read-only): `GET /{waba}/phone_numbers` if needed, then `GET /{phone-number-id}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type`. A number that is not allowed in the current mode → token deleted, nothing else runs.
5. **Subscribe the app** (admin click + confirmation): `POST /{waba}/subscribed_apps`.
6. **Contacts sync** and **history sync** (admin click + confirmation each): `POST /{phone-number-id}/smb_app_data` with `sync_type` `smb_app_state_sync` / `history`. Meta allows each **once**, within **24 hours** of onboarding; the site never retries them and shows the remaining time.
7. `/register` and `/deregister` are never called (the Business app already registered the number). Graph calls are limited by `coexistenceCallAllowed`.

## Webhooks (`/api/meta/whatsapp/webhook`)

Signature (`X-Hub-Signature-256`) and verify-token checks are constant-time. Every event key is stored once, so retries are ignored.

- `history` — chats from the Business app (up to 6 months) are saved to `ai_wa_messages` and as CRM context in `ai_messages` (`source: "history"`). Progress/phase is shown in admin. If the business turned history sharing off (error 2593109) the status shows "declined". Never answered.
- `smb_app_state_sync` — contacts saved to `wa_contacts` (add/remove).
- `smb_message_echoes` — messages the owner sends from the Business app are saved, edits/deletions applied, and that chat enters **human takeover** for 24 hours: the AI does not reply on top of the owner.
- `messages` — new customer texts go to the shared Marina AI (Gemini + catalogue + lead scoring). Replies are sent only if allowed (below); otherwise kept as withheld drafts. Delivery/read statuses update stored messages.

## Automatic replies

- Test mode: `WHATSAPP_COEXISTENCE_ENABLED=true` + `WHATSAPP_OUTBOUND_ENABLED=true`, and the business number must be the verified test number. Replies only inside the 24-hour customer-service window, never to opted-out numbers, paused during human takeover.
- Production: all three flags true.

## Environment

```
META_APP_ID=1588276335845243
META_CONFIG_ID=1760993601871515
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
META_WEBHOOK_APP_SECRET=          # optional, defaults to META_APP_SECRET
META_GRAPH_API_VERSION=v26.0
WHATSAPP_COEXISTENCE_ENABLED=false
WHATSAPP_PRODUCTION_ONBOARDING_APPROVED=false
WHATSAPP_OUTBOUND_ENABLED=false
WHATSAPP_COEXISTENCE_TEST_NUMBER= # 10 digits = India (+91 added)
```

## Testing with the test number

Requirements: the test phone runs the **WhatsApp Business app 2.24.17+** with that number; your Meta business is a **Tech Provider or Solution Partner**; the site is on **public HTTPS** with the webhook configured.

1. Set the env above with `WHATSAPP_COEXISTENCE_ENABLED=true` and the test number; keep production approval and outbound **false**. Restart.
2. `/test` → WhatsApp Coexistence should show **Test**.
3. Admin → WhatsApp → "Start test signup". In Meta's window choose the existing WhatsApp Business account and scan the QR code shown, on the test phone. *This links the test number's Business app to Cloud API (coexistence).*
4. The server exchanges the code and checks the number. Expect "Approved test number … on the WhatsApp Business app and Cloud API".
5. Click "Subscribe the app", then (optional, once each) contacts and history sync.
6. Send a message to the test number from another phone: it appears in Admin → Marina AI; the AI draft is withheld (outbound off). Reply from the Business app: the echo is stored and the chat enters human takeover.
7. Only if you want automatic replies on the test number: set `WHATSAPP_OUTBOUND_ENABLED=true`.

## Automated tests

`npm run check:whatsapp` (98 checks, Meta mocked) covers: featureType launch, waba-only finish, test/live number gating, the Graph allow-list (no register/deregister/messages/DELETE), 24-hour one-time steps, history/contacts/echo parsing incl. declined history and edits/deletes, duplicate keys, outbound rules, modes, and that status never shows the token or full test number.

## Live approval sequence (all in writing, before the client's number)

1. Test-number run completed and reviewed.
2. Partner role, permissions and business verification confirmed in the Meta dashboard.
3. Webhook URL and field subscriptions approved.
4. Set `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED=true` and run Embedded Signup on the client's number.
5. Approve the one-time contacts sync and history sync within 24 hours.
6. Approve live AI replies (`WHATSAPP_OUTBOUND_ENABLED=true`).
7. Accept Meta's Business-app limits: up to 4 companion devices (Windows/WearOS companions unlink), broadcast lists become read-only, disappearing / view-once / live-location turn off, group chats are not synced, throughput 20 msg/s, Cloud API messages are billed (Business-app messages stay free).

## Rollback

Set `WHATSAPP_COEXISTENCE_ENABLED=false` (and the other flags) and restart: no signup, no steps, no replies. Disconnecting a connected number is done by the business in the WhatsApp Business app → Settings → Account → Business Platform → Disconnect; this site never deregisters numbers.
