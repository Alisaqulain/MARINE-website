# Integrations

| Service | Code | What it does | Verified by /test |
|---|---|---|---|
| Google Gemini API | `lib/ai/gemini.ts` | Replies (chat, WhatsApp), voice model in Vapi, call summaries, growth drafts, research (Google Search grounding) | Model lookup + one real generation |
| Vapi | `lib/ai/vapi.ts`, `lib/ai/voice.ts` | Voice assistant (Gemini), tools, end-of-call reports, owner-approved outbound callbacks | API key, assistant config drift (provider google, tools, server URL), phone number on SIP trunk, BYO SIP credential |
| Exotel | `lib/ai/exotel.ts` | ExoPhone + vSIP trunk to Vapi, missed-call StatusCallback | Credentials (read-only call log), vSIP enabled, trunk destination → `*.sip.vapi.ai`, ExoPhone mapped |
| WhatsApp Cloud API | `lib/whatsapp/cloud.ts`, `lib/whatsapp/inbound.ts` | Inbound conversations, gated replies, templates, delivery statuses, STOP/START | Token + phone number id, WABA, app subscription, template approval, webhook secrets |
| Google Analytics 4 | `lib/google/analytics.ts` | Channel / landing-page reports, server-side purchase events, consent-gated browser tag | Service-account token + a real 7-day report; Measurement Protocol debug validation |
| Google Search Console | `lib/google/search-console.ts` | Queries, pages, keyword opportunities | Token, property permission, a real query |

Not integrated: Google Merchant Center upload (the feed is served at `/feeds/google.xml` for a scheduled fetch), paid-ads APIs, third-party SEO rank trackers. OpenAI was removed.

## Manual provider setup

1. **Gemini** — create an API key (AI Studio or Cloud). Enable billing for production quotas.
2. **Vapi** — create an assistant; set `VAPI_*`; click *Admin → Marina AI → Health → Sync Vapi assistant* (sets model provider `google`, the Marina system prompt, tools and the webhook with the `x-vapi-secret` header). If you use your own Google key in Vapi, add it under Vapi → Integrations.
3. **Exotel ↔ Vapi** — ask Exotel to enable vSIP; create a trunk, add destination `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai:5060;transport=tcp`, map the ExoPhone, whitelist Vapi SIP IPs `44.229.228.186/32` and `44.238.177.138/32`. In Vapi create a `byo-sip-trunk` credential (gateway = Exotel PSTN gateway for your region, port 5070, TCP) and a `byo-phone-number` for the ExoPhone. Set the ExoPhone StatusCallback to `/api/ai/voice/webhook?provider=exotel&token=<EXOTEL_WEBHOOK_TOKEN>`.
4. **WhatsApp** — System User permanent token; webhook `https://<site>/api/meta/whatsapp/webhook` with `META_WEBHOOK_VERIFY_TOKEN`; subscribe `messages`; approve a follow-up template. Keep the three `WHATSAPP_*` flags false until written approval.
5. **GA4 / Search Console** — one service account; enable *Google Analytics Data API* and *Search Console API*; add the service-account email as GA4 Viewer and as a Search Console user.
6. **Scheduler** — `POST /api/ai/jobs` every 15 min and `POST /api/ai/report/daily` daily, both with `Authorization: Bearer $CRON_SECRET` (cron, PM2 cron, or any uptime scheduler).
