# Phase 2 baseline audit

Stack that stays in place: Next.js 15 App Router, React 19, TypeScript, Tailwind, MongoDB, NextAuth, PayPal, and the existing ShipGlobal label client.

## Existing features that must keep working

- Catalogue, categories, product images, regional USD prices (India, United States, other countries).
- Cart, checkout, PayPal capture, order confirmation, and order tracking.
- ShipGlobal booking after a paid order, including the `/test` shipping check.
- Admin products, categories, sales, blog, customers, quotes, returns, shipments, and team access.
- Customer and wholesale accounts, contact, returns, and page-view recording.
- Homepage, shop, product pages, and the Ask Marina widget placement.

## Safe integration points

- `components/ChatWidget.tsx` now calls `POST /api/ai/chat` instead of inventing a quote.
- `components/AppShell.tsx` records a first-party attribution touch beside the existing page-view beacon.
- `components/AdminDashboard.tsx` adds a Marina AI tab. Existing tabs stay.
- Paid PayPal orders can store an optional `sessionId` so attribution can link a session to an order. Payment fields are unchanged.
- New Mongo collections are additive: `ai_sessions`, `ai_messages`, `ai_leads`, `ai_approvals`, `ai_calls`, `ai_suppression`, `ai_audit`, `ai_attribution`.

## Credentials still required

- `OPENAI_API_KEY` optional. Without it, chat answers from the catalogue only.
- `VOICE_PROVIDER` and `VOICE_WEBHOOK_SECRET` for call webhooks. Voice is not live without them.
- A search-data provider and Google Merchant Center account are not configured. The product feed is generated locally and is not uploaded.

## Verification

- `npx tsc --noEmit`
- `node --experimental-strip-types scripts/check-phase2.ts`
- `POST /api/ai/chat` against the local server
- `POST /api/ai/voice/webhook` without credentials
