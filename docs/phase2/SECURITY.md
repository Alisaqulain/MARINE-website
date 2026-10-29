# Phase 2 security

- Admin AI routes use the existing `requireAdminSession` check.
- Public chat and attribution routes are rate-limited in memory per IP.
- The assistant cannot approve its own discount. Approval is a separate admin POST.
- An approval matches one stored terms string. A different request needs a new approval.
- Customer chat text is treated as data. Instruction-override phrases do not change catalogue prices.
- Voice webhooks require HMAC-SHA256. Without the secret the route returns 503 and stores nothing.
- Outbound call events require `consent: true`.
- Opt-out numbers are stored in `ai_suppression`.
- API responses do not include model keys, webhook secrets, or payment card data.
- Chat does not collect card numbers and does not call PayPal.
- Attribution stores referrer, path, and UTM values for a random session id. It does not store a password or payment token.

The permission matrix is in `lib/ai/permissions.ts`. Restricted actions are discount, payment terms, custom commitment, outbound call, publishing, and ad-budget changes.
