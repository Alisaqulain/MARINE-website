# Marina Muse: Vapi webhook secret rotation guide

Prepared 9 November 2026. **Not performed:** the client has not yet provided the replacement secret. Nothing was generated, deleted or changed. Production webhook configuration is out of scope and stays unchanged (it currently answers HTTP 401).

## Status record

| Date (UTC) | Status | Detail |
|---|---|---|
| 9 Nov 08:10 | Pending client action | `--check` stopped correctly: `VAPI_WEBHOOK_SECRET_NEXT` not set (`evidence/final/rotation-check-*.log`) |
| 9 Nov 13:05 | **Pending client action** | Replacement still not provided. Nothing generated, deleted or changed; no Vapi call made. Riley untouched; Marina stays unconnected, with phone and SIP variables empty |

When the replacement arrives, follow the procedure below and add its `--apply` and `--verify` output (fingerprints only) here. Valid, old, missing and invalid signatures are all covered by `--verify` and the route checks. After rotation, also delete the two full-configuration backups of the Marina assistant in the session scratchpad: they contain the current secret.

## What the secret protects

- Vapi sends `x-vapi-secret: <secret>` on every tool call and server message to `/api/ai/voice/webhook`.
- The site compares it in constant time against `VAPI_WEBHOOK_SECRET`. A placeholder, a short value or a mismatch gets 401.
- The same value is stored in Vapi in three places on the **Marina Muse Assistant** (`e0bf7b4e-dcb0-4be1-8f3f-c41f1512ee4d`): `server.headers` and each tool's `server.headers` (`lookup_product`, `record_enquiry`).
- **Riley** (`c9069498-818d-4f78-95be-3ee571a98abc`) does not use it and is never written.

Current state (read-only check, 9 Nov, `reports/evidence/final/rotation-check-*.log`):
- The three stored headers match the local secret (SHA-256 fingerprint compare; values never shown).
- Marina is at v4.
- Riley is unchanged from the 8 Nov baseline.

## Tool

`reports/prepared-changes/rotate-vapi-webhook-secret.mjs` reads `.env.local` with Next.js's own loader and prints only 10-character SHA-256 fingerprints. It has three modes:

| Mode | Effect |
|---|---|
| `--check` | Read-only. Requires `VAPI_WEBHOOK_SECRET_NEXT`: 32+ characters, not placeholder text, different from the current secret. Confirms Marina's stored headers equal the current secret and Riley matches its baseline hash |
| `--apply` | Runs the same checks, then PATCHes **only** Marina: the live configuration is copied and just the three header values are replaced. Reads it back and proves only the headers changed. Re-checks Riley |
| `--verify <url>` | Against a local dev server: new secret → 200, previous secret → 401, no secret → 401. Then scans `reports/`, `docs/`, `app/`, `lib/`, `components/`, `scripts/` for either value |

## Procedure, once the client has securely provided the replacement

1. **Enter the replacement** in `.env.local` (never in chat, a ticket, a log or a report):
   `VAPI_WEBHOOK_SECRET_NEXT=<replacement>`
2. **Check (read-only):**
   `node reports/prepared-changes/rotate-vapi-webhook-secret.mjs --check` should print `READY`.
3. **Update Vapi (Marina only):**
   `node reports/prepared-changes/rotate-vapi-webhook-secret.mjs --apply` should print "only the header changed: true" and "Riley unchanged: true". This creates a new Marina version (v5). The assistant stays unconnected: no phone number, no SIP, no calls.
4. **Swap the development values** in `.env.local`:
   - rename the current `VAPI_WEBHOOK_SECRET=` line to `VAPI_WEBHOOK_SECRET_PREVIOUS=`
   - rename `VAPI_WEBHOOK_SECRET_NEXT=` to `VAPI_WEBHOOK_SECRET=`
5. **Restart the development application:** stop the dev server, then run `npx next dev -p 3918`.
6. **Verify:**
   `node reports/prepared-changes/rotate-vapi-webhook-secret.mjs --verify http://localhost:3918` should print `VERIFIED`. That means the new secret is accepted, the old one is rejected, and neither appears in any report, doc or source file.
7. **Remove** the `VAPI_WEBHOOK_SECRET_PREVIOUS=` line from `.env.local`.
8. **Record** the date, the new Marina version and the `--verify` output (fingerprints only) in the evidence folder.

**Rollback:** if `--apply` reports a mismatch, run it again with the previous secret as `VAPI_WEBHOOK_SECRET_NEXT` (swap the values) to restore the old header. Riley is never involved.

## Production (separate approval, not part of this procedure)

Production must get the **new** value in its own environment before Vapi is used for real calls; production currently has no secret and answers 401. Deploying it needs separate written approval. The order then is:
1. Set it on the production server.
2. Restart.
3. Re-test `lookup_product` against production.
