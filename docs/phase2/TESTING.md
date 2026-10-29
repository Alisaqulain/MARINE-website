# Phase 2 testing

## Passed

`npx tsc --noEmit` — exit 0 after the Phase 2 files were added.

`node --experimental-strip-types scripts/check-phase2.ts` — 15 passed, 0 failed:

- Catalogue price is repeated, missing products and warranties stay unknown.
- A prompt-override does not replace the catalogue price.
- Cold score stays at or below 30. A strong wholesale signal scores as high-value.
- Discount permission is restricted. Rejected approvals and changed terms do not pass.
- Last non-direct attribution skips a later direct visit.
- Duplicate order ids and failed orders are not added to revenue.
- A zero feed price is rejected.
- Voice HMAC signatures differ for different secrets.

Local server:

- `POST /api/ai/voice/webhook` with no voice credentials returned HTTP 503 and did not store a call.
- `POST /api/ai/chat` with an invalid session returned HTTP 400.
- `POST /api/ai/chat` for “What is the price of the brass compass?” returned HTTP 200 and the live catalogue price of $39.00 USD for Antique Brass Nautical Compass, plus other compass matches.

## Not run

- `npm run build` was not run while `npm run dev` was using the `.next` directory.
- Admin approval buttons were not clicked in a signed-in browser session.
- No live voice call, Merchant Center upload, or paid campaign was made.
