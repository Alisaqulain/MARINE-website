# Testing

| Command | What it covers |
|---|---|
| `npx tsc --noEmit` | Type check |
| `npm run check:phase2` | 116 pure-logic checks (also shown on /test): grounding guard, scoring/segments, approvals, Vapi parsing/auth/config drift, Exotel callbacks, WhatsApp parsing/send gate/signatures, JWT signing, GA4 events, Search Console opportunities, /test status rules, secret redaction |
| `npm run check:whatsapp` | 51 WhatsApp coexistence checks |
| `npm run build` | Production build + static asset verification |
| `/test` | Live provider checks (admin only in production) |

## HTTP route checks (run against a local `next start`)

Verified with throwaway local secrets, then test records were deleted: `/test` redirects anonymous users in production; chat answers with catalogue prices and resists price injection; Vapi webhook rejects missing/wrong secrets, answers `lookup_product` from the catalogue, stores a missed end-of-call report once (duplicate ignored); Exotel callback rejects a bad token and records a missed call; WhatsApp verify handshake accepts the right token and rejects a wrong one, forged signatures get 401, a signed inbound message is drafted and withheld while sending is off (duplicate ignored); cron, daily report and admin endpoints reject anonymous calls; consent API validates input; forged unsubscribe tokens are rejected.

## Needs real credentials

A real Gemini generation, Vapi assistant/phone checks, an actual phone call through Exotel → Vapi, WhatsApp sending and delivery receipts, GA4 and Search Console data. `/test` reports these as Not configured until the credentials exist, and only reports a live call/message as verified when one has actually been received.
