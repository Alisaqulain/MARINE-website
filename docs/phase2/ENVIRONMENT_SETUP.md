# Environment

All names, with comments, are in `.env.example`. Put values in `.env.local` / `.env.production.local` only (gitignored), restart the server, then open `/test`.

| Agent / area | Required | Optional |
|---|---|---|
| Shared AI | `GEMINI_API_KEY` | `GEMINI_MODEL` (default `gemini-2.5-flash`) |
| Jobs | `CRON_SECRET` | `OWNER_ALERT_EMAILS`, `AI_OWNER_ALERT_SCORE`, `AI_OWNER_ALERT_VALUE_USD` |
| Voice — Vapi | `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET` | `VAPI_PHONE_NUMBER_ID`, `VAPI_SIP_CREDENTIAL_ID`, `VAPI_OUTBOUND_ENABLED`, `VAPI_MODEL`, `VAPI_API_BASE`, `VOICE_LANGUAGES` |
| Voice — Exotel | `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_ACCOUNT_SID` | `EXOTEL_SUBDOMAIN`, `EXOTEL_PHONE_NUMBER`, `EXOTEL_TRUNK_SID`, `EXOTEL_WEBHOOK_TOKEN` |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN` (or Embedded Signup token), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET` | `META_WEBHOOK_APP_SECRET`, `WHATSAPP_FOLLOWUP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`, the three approval flags |
| GA4 | `GOOGLE_SERVICE_ACCOUNT_JSON` (or `_EMAIL` + `_PRIVATE_KEY`), `GA4_PROPERTY_ID` | `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID` |
| Search Console | service account, `SEARCH_CONSOLE_SITE_URL` | — |

Missing values never crash an agent: chat/WhatsApp fall back to catalogue text, voice webhooks return 401/503, Google sections show "Not connected".
`OPENAI_API_KEY` / `OPENAI_MODEL` are no longer read and can be deleted.
