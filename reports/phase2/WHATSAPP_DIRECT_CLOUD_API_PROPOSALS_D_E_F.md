# WhatsApp Direct Cloud API: Technical Proposals D, E and F

**Date:** 11 November 2026
**Status:** **PROPOSALS ONLY. Nothing has been implemented.** The C1–C10 working tree is unchanged, uncommitted and unpushed. No database, Docker, Meta API, production resource or live WhatsApp number was accessed while preparing this document.
**Context:** decisions D, E and F from §10 of `WHATSAPP_DIRECT_CLOUD_API_CLIENT_CLARIFICATIONS.md`.

Tags: **[SRC]** verified from current source · **[TEST]** verified from existing offline evidence · **[PROPOSED]** recommendation, not executed · **[OPEN]** unresolved question for the client.

---

## Proposal D: HTTP retry and duplicate-delivery prevention for `POST /messages`

### D1. Current behaviour **[SRC]**

| Fact | Location |
|---|---|
| Every WhatsApp send goes through `postMessage()`, which calls `requestJson(..., { timeoutMs: 12_000, retries: 1 })` | `lib/whatsapp/cloud.ts:162-174` |
| `requestJson` retries once after: a timeout (`retryTimeouts` defaults `true`), any network error, or HTTP 408/429/500/502/503/504; it honours `Retry-After` up to 3 s | `lib/ai/http.ts:21-23, 115-150` |
| No idempotency key or client reference is sent with the message body | `cloud.ts:170` |
| The coexistence Graph helper already uses `retries: method === "GET" ? 1 : 0` ("POSTs here are one-time actions at Meta: never retried automatically") | `lib/whatsapp/coexistence-actions.ts:47-48` |
| The reply reservation is written before the send (`status:"pending"`) and updated after it (`sent`/`failed`, with `wamid`) | `lib/whatsapp/inbound.ts:23, 49-51` |
| Template follow-ups use the same `postMessage`, then insert a `kind:"template"` record | `lib/ai/followups.ts:167-171` |

### D2. The problem

A retry is safe only when the first attempt provably did not reach Meta. Of the retry triggers above:
- **Connection refused / DNS failure before the request is written:** safe to retry.
- **Timeout after the request was sent, 502/503/504 from a proxy after Meta accepted, or an ambiguous 500:** the message may already be queued for delivery. A retry sends it again, and Meta has no client-supplied idempotency key in this request to collapse the two. **[OPEN D-1]** whether Meta de-duplicates identical `/messages` posts is not documented in anything inspected here and must not be relied on.
- **429:** the first attempt was rejected, so a retry is safe, but the gap also exists for 500-class answers.

### D3. Proposed change **[PROPOSED]**

**D3.1 Never auto-retry `/messages` at the HTTP layer.**
- File: `lib/whatsapp/cloud.ts` (`postMessage`).
- Change: `retries: 0` and `retryTimeouts: false`. One attempt per call, as `coexistence-actions.ts` already does for its POSTs.
- Effect: a timeout or 5xx is reported as a failure to the caller; nothing is re-sent automatically.

**D3.2 Treat an ambiguous outcome as "unknown", not "failed".**
- `requestJson` already returns `reached: true/false` and `timedOut` (`http.ts:148`). `postMessage` should return a third state: `{ ok: false, unknown: true }` when `timedOut` or `reached` with 5xx, versus `{ ok: false, unknown: false }` when the request never left (`reached:false`, not timed out) or Meta answered a definite 4xx.
- `deliver()` records the reservation as `status:"unknown"` (new value) for the ambiguous case, `failed` only for definite failures.
- A later delivery-status webhook (`sent`/`delivered`) for a message we do not know the `wamid` of cannot be matched today (`applyStatusUpdates` looks up by `wamid`). **[OPEN D-2]** whether to also store `to` + `at` and match status webhooks by recipient within a short window to resolve `unknown` records; this is heuristic and is **not** recommended without client agreement.

**D3.3 Manual re-send only.**
- `unknown` and `failed` reservations are never re-sent automatically. They become visible through Proposal E and can be re-sent by an admin action that creates a new, explicit send with an audit record. No code for this exists yet; it is part of E.

**D3.4 Template follow-ups.**
- Same `retries: 0` applies automatically (shared `postMessage`). `sendFollowUp` currently marks `failed` on any `!res.ok`; with D3.2 it should mark `unknown` for the ambiguous case so the cron job (`runFollowUps`) does not pick the row up again as if it had never been sent. **[OPEN D-3]** confirm that `runFollowUps` only selects `pending`/`needs_approval` rows (it appears to, `followups.ts:60, 114`), so `unknown` would be excluded without further change.

### D4. Impact

| | |
|---|---|
| Delivery guarantee after D | Application: at most one attempt per reservation. HTTP: one request per attempt. Combined: **at most once**. Still not exactly-once: a message may be lost on a transient network error that previously would have been retried |
| Lost-send rate | Transient failures that today succeed on the second attempt will instead end as `failed`/`unknown` and need the Proposal E path. Expected to be rare (one retry only existed), but not measured **[OPEN D-4]** |
| Coexistence mode | Same change; same benefit |
| Reversibility | One constant and one status value; fully reversible |

### D5. Required tests (offline, extend `scripts/check-whatsapp-direct.ts`)

- Fetch spy: timeout on first attempt → exactly **1** call made, result `unknown:true`.
- Spy returning 503 → 1 call, `unknown:true`. Spy throwing `ECONNREFUSED` before send → 1 call, `unknown:false`, `failed`. Spy returning 400 → `failed`, not unknown.
- `deliver()` with simulated collection: reservation ends `unknown` vs `failed` accordingly; a redelivery sends nothing in both cases (existing C5.9–C5.11 logic).
- `sendFollowUp` row status for each case; `runFollowUps` never re-selects `unknown`.
- Existing 102 / 251 / 114 suites still pass.

---

## Proposal E: Safe recovery of pending (and unknown/failed) reply reservations

### E1. Current behaviour **[SRC]**

- A reservation is one document in `ai_wa_messages` with `inReplyTo`, `direction:"out"`, `to`, `sessionId`, `text`, `at`, `status` (`pending` on creation; later `withheld`, `sent`, `failed`) (`inbound.ts:23-25`, `event-claims.ts:121-129`).
- `pending` persists forever if processing fails between reservation and send, or after a send whose `finish` write failed (`inbound.ts:49-51`). Nothing queries, lists, retries or expires `pending` reservations; no admin API or component reads `ai_wa_messages` directly (grep of `app/` and `components/`).
- A redelivery of the same inbound message finds the reservation and sends nothing (`inbound.ts:71`) — correct for at-most-once, but it also means the customer never gets a reply and nobody is told.

### E2. Design principles **[PROPOSED]**

1. **Never auto-send from a recovery path.** A `pending` reservation is ambiguous by definition (the send may or may not have happened). Automatic re-sending would reintroduce the duplicate risk D removes.
2. **Make the state visible and classifiable**, then let a human decide, with every decision audited.
3. **Age out automatically only into a terminal, non-sending state.**

### E3. Proposed change

**E3.1 Classification sweep (read-only on messages, writes only status labels).**
- A scheduled job (hook into the existing `/api/ai/jobs` cron entry; `lib/ai/cron.ts`) runs every 15 min:
  - `pending` older than **10 minutes** → `status:"stale"`, `staleAt`. (A healthy send completes in seconds; 10 min clears any in-flight request and the 120 s event lease.) **[OPEN E-1]** threshold.
  - `stale`/`unknown`/`failed` older than **24 hours** → `status:"expired"` (WhatsApp's free-form reply window has closed; a reply would now need a template and consent). Terminal; never resurfaced for sending.
- Each transition is a single `updateOne` guarded on the previous status (`{ _id, status: "pending" }`), so it cannot race with a late `finish` write that sets `sent`. If `finish` arrives after the sweep set `stale`, `finish`'s filter (`{ inReplyTo }`) would overwrite it with `sent` — acceptable and correct (the send did happen). **[SRC]** `finish` filters on `inReplyTo` only (`inbound.ts:25`); keep that.

**E3.2 Admin visibility.**
- New read-only endpoint under the existing admin API (`app/api/admin/ai/…`, admin session required, same pattern as `app/api/admin/ai/route.ts`): lists reservations with status in `stale|unknown|failed`, newest first, limit 100. Fields returned: `_id`, `status`, `at`, `inReplyTo` **last 6 characters only**, recipient **masked** (`…1234`), `reason` (from `failed`), and **no message text** by default (text shown only on explicit per-row expand, since it may contain personal data). Counts per status for the dashboard card.
- `/test`: surface `messageIndexState` (C5 index health) in the WhatsApp card — currently unexposed [SRC] `store.ts:35`.

**E3.3 Manual resolution actions (admin, audited).**
- `mark_resolved`: sets `status:"resolved"`, `resolvedBy`, `resolvedAt`, optional note. No send.
- `resend`: allowed only when: status ∈ `stale|unknown|failed`, age < 24 h, recipient not suppressed, `sendGate` passes, and the admin confirms a warning that the customer **may already have received** the message. The action creates a **new** outbound record (`inReplyTo` unset, `resendOf: <original _id>`) and sends once via `postMessage` (with D's `retries: 0`). The original is set to `resolved` with `resentAs`. Audit row in `ai_audit`. Never available for `expired`.
- Both actions reuse the existing admin-action pattern (`app/api/admin/ai/actions`, main-admin only, same-origin, rate-limited, `confirm:true`).

**E3.4 What is explicitly not proposed.**
- Automatic re-send of any reservation.
- Any change to the reservation's uniqueness (`wa_reply_once` stays).
- Deleting records.

### E4. Impact

| | |
|---|---|
| Customer impact | Lost replies become visible within 15 min and can be re-sent by a person within the 24 h window |
| Duplicate risk | Only through an explicit, warned, audited `resend` |
| Data | New status values `stale`, `unknown`, `expired`, `resolved`; new fields `staleAt`, `resolvedBy/At`, `resendOf`, `resentAs`. No migration needed; old records keep their statuses |
| Cron | One extra query per 15 min on `ai_wa_messages` by `{status, at}`; a non-unique index `{status:1, at:1}` is advisable **[OPEN E-2]** (another index: same pre-deployment inspection discipline as C5, though a non-unique index cannot conflict with data) |

### E5. Required tests

- Simulated collection: `pending` → `stale` after 10 min, not before; `stale` → `expired` after 24 h; a late `finish` write after `stale` yields `sent`.
- Sweep never touches `sent`, `withheld`, `resolved`, `expired`.
- `resend` refused for `expired`, suppressed recipients, age ≥ 24 h, missing `confirm`; allowed path creates a new record, sends exactly once (spy), audits, marks original `resolved`.
- Admin list endpoint: requires admin session; returns masked fields; no `text` unless expanded.
- Existing suites unchanged.

---

## Proposal F: Fingerprint-based production identifier protection

### F1. Current behaviour **[SRC][TEST]**

- The isolated launcher refuses the two known production IDs and the live number (`scripts/isolated-env.mjs:56-57, 76-78`) and enforces `WHATSAPP_PHONE_NUMBER_ID === WHATSAPP_TEST_PHONE_NUMBER_ID` and `WHATSAPP_BUSINESS_ACCOUNT_ID === WHATSAPP_TEST_BUSINESS_ACCOUNT_ID` (`:70-71`); tests C10.3–C10.9.
- The production **WABA ID** and **phone-number ID** are unknown to the code; production files were not read. If both the configured and the "test" variables were set to a production ID, the launcher would accept them (sends still impossible under the launcher because outbound is forced off; read-only Graph calls would be possible).

### F2. Proposed change **[PROPOSED]**

**F2.1 Fingerprints instead of values.**
- The client computes, on their side, `sha256(<id>)` for the production WABA ID, phone-number ID, app ID and config ID (and any other number they want protected), e.g. `printf '%s' '<id>' | sha256sum`. IDs are not secrets, but fingerprints avoid copying production values into the repository, chats or logs.
- New committed file `config/whatsapp-production-fingerprints.json`: `{ "sha256": ["<64 hex>", …], "note": "production Meta identifiers; values never stored" }`. Alternatively an env variable `WHATSAPP_PRODUCTION_ID_FINGERPRINTS` (comma-separated) read only by the launcher. **[OPEN F-1]** file (versioned, reviewable) vs variable (no repo change per rotation). Recommendation: the file.

**F2.2 Enforcement points.**
- `scripts/isolated-env.mjs` → `validateWhatsAppTestCreds`: hash every supplied ID (`META_APP_ID`, `META_CONFIG_ID`, the four `WHATSAPP_*_ID`s, and each `WHATSAPP_TEST_RECIPIENTS` entry) and refuse on a match ("`<NAME>` matches a production identifier fingerprint"), fatal before spawn, same as today's deny-list.
- `lib/whatsapp/mode.ts` → `sendEnvironmentDecision` and `directConfig`: outside production (`NODE_ENV !== "production"`), refuse to use a configured ID whose fingerprint matches. This closes the read-only-Graph gap for any non-production process, not only the launcher. In production the list is ignored (the production IDs are, by definition, the ones in use).
- The existing literal deny-list (`PRODUCTION_IDS`, `LIVE_NUMBER`, `KNOWN_PRODUCTION_*`) stays; fingerprints add to it.

**F2.3 Operational rule.**
- When a production ID changes (new number, new WABA), the client adds the new fingerprint; old ones stay (harmless).

### F3. Verification without production credentials **[PROPOSED]**

1. **Offline:** tests with fingerprints of **fake** IDs in a test-only list: matching fake ID refused; non-matching accepted; env variable/file parse errors fail closed (launcher refuses to start if the list is present but unreadable). Problem messages contain names only.
2. **Client-side, one time:** the client runs `node scripts/isolated-env.mjs --check` with their real `.env.isolated-test.local` and the real fingerprint list; expected output: no `PROBLEM` lines. Then, deliberately, they put a production ID into the local file and re-run: expected `REFUSED: … production identifier fingerprint`, exit 1. They revert the file. This proves the real production IDs are rejected **without those IDs ever reaching this side or the repository**. Record both outputs (names only) as evidence.
3. **Written confirmation** from the client that the fingerprints were computed from Meta Business Manager values, not from server env files.

### F4. Impact and limits

| | |
|---|---|
| Closes | §5.3 of the clarifications: production WABA/phone IDs become rejectable in every non-production process |
| Does not close | A production server (`NODE_ENV=production`) is unaffected by design. A mis-labelled server is still treated as production (same limit as C6) |
| Secrecy | SHA-256 of a 15-digit ID is not a strong secret (the ID space is enumerable), so the file protects against accidental use, not against a determined attacker who wants to learn the IDs. The IDs are not secrets in Meta's model either; this is acceptable, but should be stated to the client **[OPEN F-2]** |
| Reversibility | Delete the file/variable; behaviour returns to today's |

### F5. Required tests

- Launcher: C10.7-style checks with fingerprint matches for each of the six ID names and for recipients.
- `sendEnvironmentDecision` / `directConfig` in development with a fingerprinted configured ID → refused, 0 fetch calls (spy); in production → unaffected.
- Malformed fingerprint file → launcher refuses to start (fail closed); missing file → no change (today's behaviour), with a `--check` notice that no fingerprints are configured.
- Existing 102 / 251 / 114 suites unchanged.

---

## Summary of approvals requested

| Proposal | Approve to implement? | Open questions to answer first |
|---|---|---|
| D: `retries: 0` for `/messages`, `unknown` outcome state, no automatic re-send | ☐ | D-1 Meta de-duplication (assume no), D-2 heuristic status matching (recommend no), D-3 follow-up selection, D-4 acceptable lost-send rate |
| E: sweep (`stale`/`expired`), admin list with masked fields, audited `mark_resolved` / `resend` | ☐ | E-1 10 min threshold, E-2 non-unique `{status, at}` index |
| F: fingerprint deny-list in launcher and non-production runtime | ☐ | F-1 file vs variable, F-2 accept the "not a secret" limit |

Implementation order if all approved: D (smallest, removes the active duplicate risk) → F (small, test-only plus one runtime guard) → E (largest; needs UI). Each would get its own snapshot, diff, offline tests and report, as with C1–C10. **No implementation starts without separate written approval.**
