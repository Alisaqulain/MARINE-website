# Phase 2 environment

Add these to `.env.local` only when you have the account. Do not commit the file. `.env.local` is gitignored.

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
VOICE_PROVIDER=
VOICE_WEBHOOK_SECRET=
CRON_SECRET=
SEARCH_DATA_PROVIDER=
MERCHANT_CENTER_ID=
```

- Chat works with no new variables. It reads products from MongoDB and the static catalogue.
- Voice stays offline until both `VOICE_PROVIDER` and `VOICE_WEBHOOK_SECRET` are set. The webhook is `POST /api/ai/voice/webhook` with header `x-marina-voice-signature` (hex HMAC-SHA256 of the raw body).
- `OPENAI_API_KEY` only rewrites the already approved catalogue sentence. If the call fails, the catalogue sentence is kept.
- Nothing here starts a paid ads campaign.
