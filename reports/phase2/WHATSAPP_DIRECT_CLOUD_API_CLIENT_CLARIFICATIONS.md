# WhatsApp Direct Cloud API: Client Clarifications (C1–C10)

**Date:** 11 November 2026
**Task:** read-only clarification of the C1–C10 implementation report, before the client authorises the next stage.
**Nothing was changed.** No application code, test, configuration, report or earlier evidence file was modified. No database, Docker, Meta API, production resource or live WhatsApp number was accessed. The working tree remains uncommitted and unpushed (`main` is level with `origin/main` at `9e34acc`; 90 uncommitted paths; nothing stashed).

**Classification used for every statement**

| Tag | Meaning |
|---|---|
| **[SRC]** | Verified by reading the current source code (file and line references given) |
| **[TEST]** | Verified from existing offline test evidence (log file named). Offline means: no network, no database; C5 scenarios ran on a simulated collection |
| **[PROPOSED]** | A procedure written here, **not executed** |
| **[BLOCKED]** | Not verified; the reason is given |

Line numbers refer to the working tree as of this report. They match the copies in the review package (§8).

---

## 1. Executive summary

1. **Docker.** The old root credential of the local test container `marina-dev-mongo` is still usable because the MongoDB user `devroot` still has the password the container was created with; that password is also stored in the container's Docker configuration. Making it unusable means changing the user's password inside MongoDB (prepared script, not run). Verification is `docker-root-verify.sh` printing `NOT USABLE`, plus the two existing app-level checks. All of it needs Docker Desktop started and a separate approval. **[SRC][PROPOSED]**
2. **Indexes.** C5 defines two partial unique indexes on `ai_wa_messages` (`wa_inbound_wamid_once`, `wa_reply_once`), created automatically on first use after a process start, best-effort. A read-only inspection procedure is given; it has not been run anywhere. No production database was accessed and no index was created on any database. **[SRC][PROPOSED]**
3. **C5 lease and reservations.** The event claim (120-second lease on `wa_webhook_events.claimedAt`) prevents duplicate *processing*; the `inReplyTo` reservation prevents duplicate *reservation* of a reply. **Exactly-once outbound delivery is not guaranteed**: the HTTP client retries a timed-out `POST /messages` once, and a failure between reservation and send leaves a `pending` reservation that nothing retries. Both are stated plainly in §4 with the other unresolved scenarios. **[SRC]**
4. **Production identifiers.** The launcher enforces exact test-ID matching for WABA and phone-number ID and refuses the two known production IDs and the live number. It **cannot** refuse the production WABA ID or phone-number ID because those values are not known to the code and production files were not read. A verification method that needs no production credentials is proposed. **[SRC][TEST][BLOCKED]**
5. **Self-test change.** One block in `lib/ai/selftest.ts` now pins `WHATSAPP_INTEGRATION_MODE=coexistence` for its own synchronous duration and restores it. The block already saved, forced and restored three other variables the same way; the function is synchronous (no `await`), so no concurrent request can observe the pinned value, including when the self-test runs inside the live server from `lib/ai/health.ts:425`. **[SRC][TEST]**
6. **C6 and C9 apply in every mode.** C6: any non-production server refuses real sends (coexistence test-number replies from a dev server included). C9: `META_APP_ID` and `META_CONFIG_ID` have no built-in default; a production deployment that relied on the defaults must set them before the next deploy. **[SRC][TEST]**

---

## 2. Docker security remediation

### 2.1 What the existing evidence establishes **[SRC]** (evidence files read, nothing executed)

| Fact | Evidence |
|---|---|
| The container `marina-dev-mongo` was created by `scripts/dev-db.mjs` with `-e MONGO_INITDB_ROOT_USERNAME=devroot -e MONGO_INITDB_ROOT_PASSWORD`, the password generated in that script and passed through the process environment | `scripts/dev-db.mjs:91-98` |
| The MongoDB image created the `root@admin` user `devroot` from those variables at first start. A second user `marina_dev_app` has `readWrite` on `marina_muse_dev` only | `docker-root-credential-check-before-20261110T1705Z.log` (users list) |
| The password remains in the container's Docker configuration (`Config.Env`), readable by anyone who can run `docker inspect`/`docker exec`, and on the Docker VM disk | `DOCKER_SECURITY_EVIDENCE.md` D1 |
| On 10 Nov at 17:05 and again at 17:09 UTC the stored value **authenticated as root** | `…-before-20261110T1705Z.log`, `…-current-20261110T1709Z.log`: `stored root credential: USABLE <-- remediation NOT effective` |
| Unauthenticated access is refused; the port is bound to `127.0.0.1:27018` only | `…-current…log`; `DOCKER_SECURITY_EVIDENCE.md` D4, D5 |
| The remediation script exists and was never run (an earlier permission check refused it) | `docker-root-remediation.sh` header; `DOCKER_SECURITY_EVIDENCE.md` "Status: BLOCKER, NOT REMEDIATED" |
| On 11 Nov the Docker engine was not running and port 27018 refused connections | `docker-status-readonly-20261111T0714Z.log` |

There is **no later evidence** than 17:09 UTC on 10 Nov. Nothing shows the credential was rotated.

### 2.2 Why the credential is still considered usable **[SRC]**

Two copies of the same secret exist:

1. **The credential store that actually authenticates:** MongoDB's `admin.system.users` entry for `devroot` (SCRAM hash). Authentication succeeds because this entry still matches the original password. `docker-root-verify.sh` tests exactly this by calling `db.getSiblingDB("admin").auth(user, password)` inside the container.
2. **The disclosure location:** the container's `Config.Env` (`MONGO_INITDB_ROOT_PASSWORD`). Docker cannot edit the environment of an existing container; this copy stays until the container is re-created.

The credential is usable because (1) has not been changed. Changing (2) alone is impossible on the running container and would not be enough anyway.

### 2.3 What must change **[SRC]**

- **Must change:** the `devroot` password in MongoDB (`admin.changeUserPassword`). After that, the value in `Config.Env` is a dead credential.
- **Need not change:** `marina_dev_app` (the app user), the data volume `marina-dev-mongo-data`, the app's `MONGODB_URI`, port binding.
- **Optional hardening (R3 in the existing evidence):** re-create the container without `MONGO_INITDB_*` variables on the same volume, so the dead value disappears from `docker inspect`; future setups should use `MONGO_INITDB_ROOT_PASSWORD_FILE`.

### 2.4 Remediation steps **[PROPOSED, not executed; requires separate approval and Docker Desktop running]**

| Step | Action | Notes |
|---|---|---|
| R0 | Start Docker Desktop (by the client, or with explicit authorisation) | The earlier permission check classed the container as a shared resource |
| R1 | Confirm identity: `docker ps --format '{{.ID}} {{.Names}} {{.Image}} {{.Ports}}'` must show `marina-dev-mongo`, image `mongo:*`, port `127.0.0.1:27018->27017` | The remediation script itself refuses any container whose image is not `mongo:` |
| R2 | Capture "before" evidence (§2.6) | |
| R3 | Run `bash reports/evidence/phase2/docker-root-remediation.sh` from the project folder | Inside the container, `mongosh` authenticates with the stored value read from the container's own environment, generates 48 random bytes, calls `changeUserPassword`, discards the value. No value is printed, written or put on a command line |
| R4 | The script then runs `docker-root-verify.sh` automatically | |
| R5 | Run `npm run dev:db -- verify` (app user, 13 checks) and the runtime isolation check (`reports/evidence/phase2/isolation-proof.ps1`, 8 checks) | Proves the app user and the app are unaffected |
| R6 | Optional R3-hardening (re-create container) | Separate decision |

### 2.5 Verification procedure and expected evidence **[PROPOSED]**

| Check | Command | Successful output |
|---|---|---|
| Old credential dead | `bash reports/evidence/phase2/docker-root-verify.sh` | `stored root credential: NOT USABLE` (or `NOT USABLE (AuthenticationFailed)`) **and** `unauthenticated listDatabases: refused (Unauthorized)` |
| App user still works | `npm run dev:db -- verify` | `13/13` |
| Running app isolated | `isolation-proof.ps1` against the isolated server | `8/8` |
| Identity | `docker ps` line from R1 | Same container ID before and after |

**Remediation must be considered unsuccessful if any of these holds:**
- `docker-root-verify.sh` prints `USABLE` after R3.
- The script's `auth()` with the stored value did not return `ok: 1` *before* the change (then the password was not the one in `Config.Env`, and the wrong credential may have been rotated; investigate before concluding anything).
- `dev:db verify` is below 13/13 or the runtime check below 8/8 (the change hit the wrong user or container).
- The container ID or image differs between R1 and the post-check.
- Docker was not running or the script exited non-zero.

### 2.6 Evidence to capture

| When | Artefact | Content rules |
|---|---|---|
| Before | `docker-root-credential-check-before-<ts>.log` (verify script output) | Must say `USABLE` |
| Before | `docker-inspect-env-names-<ts>.log`: `docker inspect marina-dev-mongo --format '{{range .Config.Env}}{{index (split . "=") 0}}{{"\n"}}{{end}}'` | **Names only**, never values |
| Before/after | `docker ps` identity line | |
| After | `docker-root-credential-check-after-<ts>.log` | Must say `NOT USABLE` |
| After | `dev-db-verify-after-<ts>.log`, `runtime-isolation-after-<ts>.log` | 13/13 and 8/8 |
| Always | Operator, UTC time, exit code of each command | No password, hash or token anywhere |

---

## 3. MongoDB index definitions and conflict inspection

### 3.1 The two partial unique indexes **[SRC]**

Definitions, `lib/whatsapp/event-claims.ts:30-43` (verbatim):

```ts
/** Index definitions (names fixed so their presence can be checked). */
export const INDEXES = {
  events: { collection: "wa_webhook_events", spec: { key: 1 }, options: { unique: true } },
  inboundOnce: {
    collection: "ai_wa_messages",
    spec: { wamid: 1, direction: 1 },
    options: { name: "wa_inbound_wamid_once", unique: true, partialFilterExpression: { direction: { $eq: "in" }, wamid: { $type: "string" } } },
  },
  replyOnce: {
    collection: "ai_wa_messages",
    spec: { inReplyTo: 1 },
    options: { name: "wa_reply_once", unique: true, partialFilterExpression: { inReplyTo: { $type: "string" } } },
  },
} as const;
```

| | Index 1 | Index 2 |
|---|---|---|
| Collection | `ai_wa_messages` | `ai_wa_messages` |
| Keys | `{ wamid: 1, direction: 1 }` | `{ inReplyTo: 1 }` |
| Options | `name`, `unique: true`, `partialFilterExpression` | `name`, `unique: true`, `partialFilterExpression` |
| `unique` | `true` | `true` |
| `partialFilterExpression` | `{ direction: { $eq: "in" }, wamid: { $type: "string" } }` | `{ inReplyTo: { $type: "string" } }` |
| Name | `wa_inbound_wamid_once` | `wa_reply_once` |
| Purpose | At most one **inbound** record per WhatsApp message ID. Documents with any other `direction`, or without a string `wamid`, are not in the index | At most one **reply reservation** per inbound message ID (`inReplyTo`). Documents without the field are not in the index |

(The third entry, `wa_webhook_events {key:1} unique`, predates C5; the old code created it best-effort too. C5 now **requires** it: `lib/whatsapp/store.ts:15-27` throws if it cannot be confirmed, so the webhook answers 500 rather than run unprotected.)

### 3.2 Creation: where, when, how **[SRC]**

`lib/whatsapp/store.ts:35-56` (verbatim):

```ts
export const messageIndexState: { ok: boolean | null; at: string | null; error: string | null } = { ok: null, at: null, error: null };
let messageIndexes: Promise<void> | null = null;
export function ensureMessageIndexes() {
  if (!messageIndexes) {
    messageIndexes = getDb()
      .then(async (db) => {
        const col = db.collection(INDEXES.inboundOnce.collection);
        await col.createIndex(INDEXES.inboundOnce.spec, INDEXES.inboundOnce.options);
        await col.createIndex(INDEXES.replyOnce.spec, INDEXES.replyOnce.options);
        Object.assign(messageIndexState, { ok: true, at: new Date().toISOString(), error: null });
      })
      .catch((err) => {
        const serverRefused = Boolean(err && typeof err === "object" && "codeName" in err);
        Object.assign(messageIndexState, { ok: false, at: new Date().toISOString(), error: serverRefused ? String((err as { codeName: unknown }).codeName) : "database_unavailable" });
        console.error("[whatsapp] message idempotency index unavailable");
        // Database unreachable: retry on the next request. The server refused the index (e.g. existing duplicates): retry in 10 min.
        if (!serverRefused) messageIndexes = null;
        else setTimeout(() => (messageIndexes = null), 600_000).unref?.();
      });
  }
  return messageIndexes;
}
```

- **Function:** `ensureMessageIndexes()` in `lib/whatsapp/store.ts`, called only by `messagesCollection()` (`store.ts:81-85`).
- **Trigger:** the first inbound message that reaches `draftInbound()` (`lib/whatsapp/inbound.ts:69`) or `deliver()` (`inbound.ts:21`) after a process start. **Automatic**; nothing invokes it explicitly, and there is no migration script.
- **Idempotent:** `createIndex` with the same name and options is a no-op on MongoDB. The same name with different options fails with `IndexOptionsConflict`.
- **Error handling:** the promise never rejects to the caller. A server refusal (any error carrying `codeName`, e.g. `DuplicateKey` from existing conflicting data, or `IndexOptionsConflict`) is recorded in `messageIndexState` and retried after 10 minutes; an unreachable database is retried on the next request. In both cases the webhook keeps working **without** these two indexes; duplicate protection then rests on the event claim plus the upserts (see §4.5 for why that is weaker).
- **Note:** `messageIndexState` is exported for reporting but **no page reads it yet** (grep of `app/` and `components/`: no reference). Index failure is visible only in the server log line `[whatsapp] message idempotency index unavailable`.

### 3.3 Safe pre-deployment conflict inspection **[PROPOSED, not executed anywhere]**

Read-only. Run with a **read-only** role against the target database by the client, or against the local test database after Docker remediation. Prints counts and `_id` values only; no message text, phone numbers, tokens or full message IDs. No writes, no index creation, no deletion.

```js
// 0. Current indexes (names/keys only)
db.ai_wa_messages.getIndexes().map(i => ({ name: i.name, key: i.key, unique: !!i.unique, partial: i.partialFilterExpression || null }));
db.wa_webhook_events.getIndexes().map(i => ({ name: i.name, key: i.key, unique: !!i.unique }));

// 1. Conflicts for wa_inbound_wamid_once: same (wamid, direction="in") more than once.
//    The $match is the index's exact partialFilterExpression.
db.ai_wa_messages.aggregate([
  { $match: { direction: { $eq: "in" }, wamid: { $type: "string" } } },
  { $group: { _id: { wamid: "$wamid", direction: "$direction" }, count: { $sum: 1 }, ids: { $push: "$_id" }, sources: { $addToSet: "$source" } } },
  { $match: { count: { $gt: 1 } } },
  { $project: { _id: 0, count: 1, ids: 1, sources: 1, wamidLast6: { $substrCP: ["$_id.wamid", { $subtract: [{ $strLenCP: "$_id.wamid" }, 6] }, 6] } } },
  { $sort: { count: -1 } }, { $limit: 200 }
]);
// Totals
db.ai_wa_messages.aggregate([
  { $match: { direction: { $eq: "in" }, wamid: { $type: "string" } } },
  { $group: { _id: "$wamid", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $group: { _id: null, conflictingWamids: { $sum: 1 }, extraDocuments: { $sum: { $subtract: ["$count", 1] } } } }
]);

// 2. Conflicts for wa_reply_once: same inReplyTo more than once (the field is new in C5, so 0 is expected).
db.ai_wa_messages.aggregate([
  { $match: { inReplyTo: { $type: "string" } } },
  { $group: { _id: "$inReplyTo", count: { $sum: 1 }, ids: { $push: "$_id" } } },
  { $match: { count: { $gt: 1 } } },
  { $project: { _id: 0, count: 1, ids: 1 } }
]);
db.ai_wa_messages.countDocuments({ inReplyTo: { $exists: true } });   // should be 0 before C5 is deployed

// 3. Name clashes: an existing index with one of the new names but a different definition would fail with IndexOptionsConflict.
db.ai_wa_messages.getIndexes().filter(i => ["wa_inbound_wamid_once", "wa_reply_once"].includes(i.name));

// 4. Informational: pre-C5 event documents (no status) — these are treated as "done" by the new code.
db.wa_webhook_events.countDocuments({ status: { $exists: false } });
db.wa_webhook_events.countDocuments({});
```

**Where conflicts can plausibly come from [SRC]:** the pre-C5 code inserted an inbound record with a plain `insertOne` for every drafted message (old `inbound.ts`, snapshot `…/lib/whatsapp/inbound.ts.orig:61`) and its duplicate store returned `duplicate:false` on any database error, so a redelivery during a database hiccup could have stored the same `wamid` twice. Also, in coexistence mode a customer message can exist both as a live inbound record and as a `source:"history"` record with the same `wamid` (the old history import skipped only if a record already existed, not the reverse). The `sources` field in pipeline 1 shows this.

**If conflicts are found:** stop; do not create the indexes; report the counts and `_id` lists to the client. Options for the client to decide (each is a separate approval; **no automatic deletion or modification is proposed**):
- (a) manual review and de-duplication of the listed documents by the client;
- (b) a narrower partial filter (e.g. excluding `source:"history"`) — a code change;
- (c) deploy without the two indexes, accepting the weaker protection in §4.5.

**Statement:** no production database has been accessed, no index has been created on any database (the local test database was down throughout), and the pipelines above have not been run.

---

## 4. C5 retry and lease behaviour

### 4.1 Three different guarantees, kept apart

| Guarantee | Mechanism | Status |
|---|---|---|
| Duplicate **processing** of a webhook event is prevented | Event claim in `wa_webhook_events` (unique `key`, status, token, 120 s lease) | **[SRC]** implemented; **[TEST]** simulated (C5.1–C5.14, C5.18–C5.21); real MongoDB **[BLOCKED]** |
| Duplicate **reply reservation** is prevented | Upsert on `inReplyTo` + partial unique index `wa_reply_once` | **[SRC]**; **[TEST]** C5.15–C5.17 incl. C5.16 showing it fails without the index; real MongoDB **[BLOCKED]** |
| **Exactly-once outbound delivery** | **Not provided.** See §4.6 | — |

### 4.2 Reservation lifecycle **[SRC]**

| # | Question | Answer (code) |
|---|---|---|
| 1 | How is a reservation created? | `deliver()` calls `reserveReply()` **before** reading credentials, checking the gate or sending: `inbound.ts:23`. `reserveReply` is one `updateOne({ inReplyTo }, { $setOnInsert: {...doc, inReplyTo, status: "pending"} }, { upsert: true })`: `event-claims.ts:121-129`. `reserved` is true only when the upsert inserted (`upsertedCount`); an 11000 error also means "not reserved" |
| 2 | Where is its state stored? | As a document in `ai_wa_messages` with `inReplyTo`, `direction:"out"`, `to`, `sessionId`, `text`, `at`, `status` (`pending` → `withheld` / `sent` / `failed`). **Persistent, database-backed; nothing in memory** |
| 3 | How is a still-pending reservation identified? | By `status: "pending"` with `inReplyTo` set. **No code queries for it**: there is no sweeper, no admin listing (no API or component reads `ai_wa_messages` directly), and no retry. It is identifiable only by a database query |
| 4 | Failure after reservation, before the send? | The error propagates: `deliver` → `draftInbound` (re-throws, `inbound.ts:95-99`) → `processWebhookBody` catch (`webhook-process.ts:86-93`) → event marked `failed`, HTTP 500. Meta redelivers; the event is re-claimed (`event-claims.ts:78-83`); `draftInbound` finds the reservation (`inbound.ts:71`) and returns without sending; the event is marked `done`. **The reply is never sent. The reservation stays `pending` permanently.** This is a deliberate at-most-once design, and it is a gap: there is no recovery path |
| 5 | Process crash or restart? | Nothing is in memory. The event stays `processing` until the lease (§4.3) expires; the reservation, if already written, stays `pending` as in #4. After the lease, the redelivery is handled as in #4 |
| 6 | How do failed/stale items become retryable? | **Events:** `status:"failed"` immediately; `status:"processing"` once `claimedAt` is older than 120 s (`event-claims.ts:77-83`). **Reservations: never** (see #3, #4) |
| 7 | Duplicate deliveries vs reservations? | A duplicate of a `done` event never reaches `deliver` (claim answers `duplicate`). A redelivery of a failed/stale event reaches `draftInbound`, which checks `findOne({ inReplyTo })` first (`inbound.ts:71`) and, if it slips past that check concurrently, `reserveReply` returns `reserved:false` |
| 8 | Concurrent workers sending twice? | Two layers: only one worker can hold a fresh event claim (atomic insert / `findOneAndUpdate`); and even if two reach `deliver` (lease takeover), only one upsert can insert the `inReplyTo` document **when the `wa_reply_once` index exists**. Without that index, two concurrent upserts can both insert (find-then-insert gap; demonstrated for the inbound index in C5.16) and **both could send** |
| 9 | Persistent or in-memory? | Persistent (database). The route's `__marinaWaDone` set is filled only after the database says `done` (`webhook/route.ts:11-24`, `webhook-process.ts:81-85`) and is only an optimisation |
| 10 | Atomic? | **Reservation:** one upsert — atomic on the server given the unique index; not atomic without it. **Completion of the event:** one `updateOne` fenced by `claimToken` (`event-claims.ts:91-94`). **The sequence reserve → send → `finish` is not atomic** (no transaction; the local test database is a standalone server). The `finish` write after a successful send (`inbound.ts:49-51`) can fail independently |

### 4.3 The 120-second lease **[SRC]**

| Question | Answer |
|---|---|
| Field | `wa_webhook_events.claimedAt` (ISO-8601 string) compared with `now - CLAIM_LEASE_MS` (`event-claims.ts:28, 77-79`). ISO strings compare correctly with `$lt` because they share one fixed format |
| Renewed? | **No.** There is no heartbeat; `claimedAt` is set only when a claim is taken |
| Worker exceeds 120 s | Nothing happens to the worker. But any redelivery arriving after that can re-claim: `findOneAndUpdate` sets a **new** `claimToken`, increments `attempts` |
| Can another worker claim after expiry? | Yes (that is the purpose). Before expiry it gets `in_progress` → HTTP 500 "in progress" (`webhook-process.ts:96-98`) |
| What prevents both from sending? | Only the reply reservation (§4.2 #8). If the original worker reserved first, the second finds it (`inbound.ts:71`) or loses the upsert. If the original is still inside the AI call (`handleCustomerMessage`, `inbound.ts:86`) when the second starts, **both run the AI**; then one reservation wins and one send happens — provided the `wa_reply_once` index exists |
| Original worker after takeover | Its `completeEvent` matches nothing (`claimToken` differs) and returns `completed:false`; `processWebhookBody` does **not** check that value (`webhook-process.ts:82`), so the original still returns 200 and adds the key to its memory cache. Database state is governed by the new holder. Harmless for data, but the original's response is optimistic |
| Process restart | The lease lives in the database, so a restart changes nothing about it; it only empties the memory cache |
| Send succeeds, completion fails | `finish` at `inbound.ts:51` throws → event `failed` → 500 → redelivery finds the reservation → **no resend**. The reservation stays `pending` with no `wamid`, so later delivery-status webhooks for that message match no record (`applyStatusUpdates` skips unknown wamids). The customer received the message; the record says `pending` |

### 4.4 Why exactly-once delivery is **not** guaranteed **[SRC]**

1. **HTTP-layer retry.** `postMessage` calls `requestJson(..., { retries: 1 })` (`lib/whatsapp/cloud.ts:167-174`). `requestJson` retries on a timeout (`retryTimeouts` defaults to `true`), on network errors and on the retryable statuses (`lib/ai/http.ts:115-150`). If the first `POST /messages` reaches Meta but the response times out after 12 s, the request is sent **a second time**: two deliveries of the same text are possible. The code sends no idempotency key; whether Meta de-duplicates identical posts is not established here and is not relied on. **Mitigation (proposed, not implemented):** `retries: 0` for `/messages`, or record the attempt before sending and never retry at the HTTP layer.
2. **At-most-once by design elsewhere.** A reservation written but never sent (§4.2 #4, #5) is lost. So the application layer is *at most once per reservation*, the HTTP layer is *up to two attempts per send*, and nothing provides exactly-once.

### 4.5 Race conditions and unresolved scenarios (explicit list)

| # | Scenario | Outcome today | Verified? |
|---|---|---|---|
| R1 | Failure between reservation and send | Reply lost; `pending` forever; no UI shows it | [SRC] reasoning; simulated partially (C5.9 covers failure *after* send) |
| R2 | Timeout after Meta accepted the send | Possible double delivery (HTTP retry) | [SRC]; not testable offline |
| R3 | Worker slower than 120 s (long AI call) | Second worker re-claims; AI may run twice; one send if `wa_reply_once` exists; **two sends possible without it** | [SRC]; lease takeover simulated (C5.11), AI double-run not simulated |
| R4 | Indexes not created (existing duplicates, name clash, DB down at first use) | Protection degrades to claim + upserts; concurrent inbound duplicates and double reservations possible | [TEST] C5.16 shows the race without the index; real creation [BLOCKED] |
| R5 | `failEvent` write itself fails (DB down) | Event stays `processing` until the 120 s lease expires; then retried | [SRC] (`event-claims.ts:96-104`) |
| R6 | Events unique index cannot be confirmed | **Every** webhook answers 500 until the database recovers (fail closed; inbound WhatsApp stops) | [SRC] (`store.ts:15-27`) |
| R7 | Clock skew between app instances | Lease is computed from each instance's `Date.now()`; skew shortens or lengthens the effective lease | [SRC]; single-instance deployment assumed |
| R8 | Coexistence-mode history/echo writes | Made idempotent by wamid upserts; echo without an id falls back to a plain insert (duplicates possible on retry) | [SRC] (`inbound.ts` `applyCoexistenceUpdates`) |
| R9 | Template follow-ups (`lib/ai/followups.ts`) | Not covered by reservations; cron-driven with their own status. Out of C5 scope and **not analysed here** | — |

---

## 5. Production identifier protection

### 5.1 What the launcher does **[SRC]** (`scripts/isolated-env.mjs`)

| Item | Code | Behaviour |
|---|---|---|
| Accepted credential names | `ALLOWED` is built from `.env.isolated-test.example` (`:37`) | Exactly the names in that template: `GEMINI_TEST_API_KEY`, `GEMINI_TEST_PROJECT_CONFIRMED`, `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`, `SEARCH_CONSOLE_SITE_URL`, `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`, `WHATSAPP_COEXISTENCE_TEST_NUMBER`, and the six added by C10: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEST_PHONE_NUMBER_ID`, `WHATSAPP_TEST_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEST_RECIPIENTS`. Any other name in the credentials file is **fatal** (`:112`) |
| Source of credentials | `CRED_FILE = .env.isolated-test.local` only (`:35`); `.env.local` is never opened (test C10.17) | Every registered integration variable is first set to `""` (`:101-104`), so values from `.env.local` cannot reach the child through Next.js. `MONGODB_*`, admin and a few non-secret names are inherited by design (`INHERIT`, `:29`) |
| Comparisons | `validateWhatsAppTestCreds` (`:64-93`) | `WHATSAPP_PHONE_NUMBER_ID === WHATSAPP_TEST_PHONE_NUMBER_ID` and `WHATSAPP_BUSINESS_ACCOUNT_ID === WHATSAPP_TEST_BUSINESS_ACCOUNT_ID`, exact string equality after trim; all five direct names required together; numeric 6–20 digits |
| Deny-list | `PRODUCTION_IDS = ["1588276335845243", "1760993601871515"]`, `LIVE_NUMBER = "917457099540"` (`:56-57`) | Applied to `META_APP_ID`, `META_CONFIG_ID` and the four WhatsApp IDs; the live number is also refused inside any ID and in `WHATSAPP_TEST_RECIPIENTS` |
| Checks both WABA and phone-number ID? | Yes (`:70-71`) | |
| On a problem | `fatal` → `--check` exits 1; run mode prints `REFUSED: …` and exits 2 **before** spawning (`:177-181`) | Problem texts contain variable names only, never values (test C10.11) |
| Forced | `WHATSAPP_INTEGRATION_MODE=direct`, `WHATSAPP_OUTBOUND_ENABLED=false`, `WHATSAPP_PRODUCTION_SENDING_APPROVED=false`, `MARINA_ISOLATED_TEST=1` (`:141-147`) | |

**Hard-coded fallbacks removed [SRC][TEST]:** `metaAppIds()` returns environment values only (`lib/whatsapp/coexistence.ts:22-29`); the constants survive only as the deny-list in `lib/whatsapp/mode.ts:16-17` (test C9.6 confirms no other occurrence in `app/` or `lib/`); `.env.example` and the generator carry no IDs (C9.3, C9.4).

**Stored Embedded Signup credentials as fallback [SRC][TEST]:** in direct mode `resolveCredentials()` returns environment values only and `source:"none"` if any of the three is missing (`lib/whatsapp/cloud.ts:12-21`; tests C3.1–C3.3). In coexistence mode the earlier fallback is unchanged (C3.4).

**Fake identifiers only in offline tests [SRC][TEST]:** `scripts/check-whatsapp-direct.ts` defines `WABA = "100000000000011"`, `PNID = "100000000000022"` etc. and a fake token; `.env.isolated-test.local` does not exist (`final-isolated-env-check-20261111T0714Z.log`: "credentials file: (absent)").

### 5.2 A. Verifiable now, without production credentials **[SRC][TEST]**

- Exact-match enforcement for both IDs (C10.3–C10.6).
- Refusal of the two known production IDs and the live number (C10.7–C10.9).
- No fallback to production IDs or to a stored signup token (C9.1–C9.6, C3.1–C3.3).
- Ambient (e.g. `.env.local`-style) WhatsApp values are blanked (C10.12).
- Sending is impossible under the launcher regardless of IDs: `WHATSAPP_OUTBOUND_ENABLED` is forced `false`, so `sendGate` refuses before `postMessage` is reached (C1 truth table "outbound only").

### 5.3 B. Not verifiable: production WABA ID and phone-number ID **[BLOCKED]**

The code does not know the production WABA ID or phone-number ID, and production environment files were not read. Therefore:
- The launcher has **no deny-list entry** for them.
- If an operator put the production phone-number ID into **both** `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TEST_PHONE_NUMBER_ID` (and likewise for the WABA), the launcher **would accept** the configuration. No message could be sent (outbound forced off), but **read-only Graph calls** from `/test` (`pingWhatsAppCloud`) would then target the production WABA with whatever token was supplied.
- **No claim is made that actual production identifiers are rejected.**

### 5.4 Proposed independent verification without production credentials **[PROPOSED]**

1. **Out-of-band confirmation by the client.** The client reads the production WABA ID and phone-number ID from Meta Business Manager (not from any server file) and confirms in writing that both differ from the test-app values they supply. This is a human check, no code.
2. **Fingerprint deny-list (small code change, needs approval).** The client supplies SHA-256 fingerprints of the production WABA ID and phone-number ID (IDs are not secrets, but fingerprints avoid copying them into the repository). The launcher hashes every supplied ID and refuses a match. Verification is then an offline test with the fingerprint of a fake ID, plus one `--check` run by the client with their real test file. Proposed names: `WHATSAPP_PRODUCTION_ID_FINGERPRINTS` (comma-separated `sha256:` prefixes), read only by the launcher.
3. **Token-scope argument (to be confirmed with Meta documentation by the client).** A System User token created in the **test** business portfolio should not be able to read the production WABA at all; a mis-typed production ID would then fail at Graph with a permissions error rather than succeed. This is a property of Meta's permission model, not of this code, and is **not verified here**.

---

## 6. Self-test modification (`lib/ai/selftest.ts`)

### 6.1 Original behaviour **[SRC]** (snapshot `…/lib/ai/selftest.ts.orig:377-388`)

The "Agent 4 · WhatsApp Cloud API" block saves the three coexistence flags from `process.env`, forces them to `"false"`, asserts `sendGate` refuses, forces them to `"true"`, asserts the window/consent/suppression/live-number rules, and restores the three saved values. It is a test of the **coexistence-mode** send rules, and it assumed the mode was coexistence (the only mode that existed).

### 6.2 The failure **[TEST]**

`check-phase2-post-c1-c10-20261111T0709Z.log:162`: `FAIL Reply allowed inside the 24-hour window` (250 passed, 1 failed). Cause: C10 makes the launcher force `WHATSAPP_INTEGRATION_MODE=direct`; under direct mode, `sendGate` applies `directOutboundDecision`, which ignores the three coexistence flags and refuses because neither `WHATSAPP_PRODUCTION_SENDING_APPROVED` nor the test configuration is set. The coexistence rule itself was unchanged; the test's environment assumption was.

### 6.3 The exact change **[SRC]** (from `c1-c10-changes-20261111T0714Z.diff`)

```diff
@@ -377,6 +377,10 @@
   const flagNames = ["WHATSAPP_COEXISTENCE_ENABLED", "WHATSAPP_PRODUCTION_ONBOARDING_APPROVED", "WHATSAPP_OUTBOUND_ENABLED"];
   const saved = flagNames.map((n) => process.env[n]);
+  // These are the coexistence-mode send rules: pin the mode so an ambient WHATSAPP_INTEGRATION_MODE (the isolated
+  // launcher forces "direct") cannot change what is tested. Direct-mode rules: scripts/check-whatsapp-direct.ts.
+  const savedMode = process.env.WHATSAPP_INTEGRATION_MODE;
+  process.env.WHATSAPP_INTEGRATION_MODE = "coexistence";
   flagNames.forEach((n) => (process.env[n] = "false"));
@@ -386,6 +390,8 @@
   flagNames.forEach((n, i) => (saved[i] === undefined ? delete process.env[n] : (process.env[n] = saved[i])));
+  if (savedMode === undefined) delete process.env.WHATSAPP_INTEGRATION_MODE;
+  else process.env.WHATSAPP_INTEGRATION_MODE = savedMode;
   check("Template payload shape", …
```

No assertion, expected value or check count changed (251 before and after).

### 6.4 Why this restores the intended context

The block tests coexistence rules; pinning the mode makes that explicit instead of implicit, using the same save/force/restore pattern the block already used for the three flags. Direct-mode send rules are tested separately and exhaustively in `scripts/check-whatsapp-direct.ts` (C1 truth table, 18 checks).

### 6.5 Runtime impact **[SRC][TEST]**

- `runPhase2SelfTest()` is a **synchronous** function (`selftest.ts:37`); the Agent 4 block contains **no `await`** (0 occurrences between lines 349-400). Every mutation and its restoration happen inside one synchronous JavaScript tick.
- The self-test runs in two places: the offline script `scripts/check-phase2.ts:10`, and **inside the live server** from `lib/ai/health.ts:425` (`const tests = runPhase2SelfTest();`, un-awaited) when a health run is triggered from `/test`.
- Because the block is synchronous, no other request can execute between the mutation and the restore, so no webhook or send can observe `WHATSAPP_INTEGRATION_MODE="coexistence"` (nor, for the pre-existing part, `WHATSAPP_OUTBOUND_ENABLED="true"`). This was already true of the three flags before the change; the change adds a fourth variable to the same synchronous window.
- Outside the self-test, application runtime code never writes `WHATSAPP_INTEGRATION_MODE`; it only reads it (`lib/whatsapp/mode.ts:25-31`).
- Evidence: 251/251 in `final-check-phase2-20261111T0714Z.log`; the direct-mode behaviour unchanged by this edit is covered by `final-check-whatsapp-direct-20261111T0714Z.log` (114/114).
- **Observation (pre-existing, not introduced by C1–C10):** running a self-test that mutates `process.env` inside a production server is fragile by nature; if that block were ever made asynchronous, the window would open. A cleaner design (passing an env object instead of mutating `process.env`) is a possible future change, not proposed now.

---

## 7. C6 and C9 operational impact

### 7.1 C6: non-production send guard **[SRC][TEST]**

| Question | Answer |
|---|---|
| Affected send paths | The single function `postMessage()` (`lib/whatsapp/cloud.ts:162-176`). Its only callers are `deliver()` in `lib/whatsapp/inbound.ts:49` (inbound replies, opt-in/opt-out confirmations) and `sendFollowUp` in `lib/ai/followups.ts:167` (template follow-ups). Test C6.12–C6.14: only `cloud.ts` builds a Graph `/messages` URL; `postMessage` is defined once; the coexistence Graph helper refuses `/messages` |
| Global or direct-mode only? | **Global.** `sendEnvironmentDecision()` (`lib/whatsapp/mode.ts:95-106`) is evaluated for every mode. It returns `ok` only when `NODE_ENV === "production"`, or when **all** of: `MARINA_ISOLATED_TEST=1`, direct mode, exact test-ID match, and the sending phone-number ID equals `WHATSAPP_TEST_PHONE_NUMBER_ID` |
| Coexistence sends in non-production | **Blocked** (test C6.7). Before C6, a development server could send coexistence test-number replies; now it cannot. This is the behaviour change to review |
| How production is determined | `NODE_ENV === "production"` only. `next start` sets it; the PM2 example config also sets it explicitly (`ecosystem.config.example.cjs:28,49`). No other variable or flag makes an environment "production" |
| Configuration needed before a production deployment | `NODE_ENV=production` (already the case for `next start`); then, as before, the mode-specific approval flags (`WHATSAPP_OUTBOUND_ENABLED` plus `WHATSAPP_PRODUCTION_SENDING_APPROVED` in direct mode, or the three coexistence flags). Nothing new is required for production |
| Bypass paths | None found: no override variable exists (C6.4 shows `WHATSAPP_ALLOW_OUTSIDE_PRODUCTION` is ignored); the guard precedes the network call (C6.1–C6.3: 0 fetch calls on refusal); the live number is refused inside `postMessage` as well (`cloud.ts:165`). A server **mis-labelled** `NODE_ENV=production` would of course be treated as production — the guard is an environment check, not an identity check |

### 7.2 C9: hard-coded Meta identifiers removed **[SRC][TEST]**

| Question | Answer |
|---|---|
| Removed | The fallback to `1588276335845243` (app ID) and `1760993601871515` (Embedded Signup configuration ID) in `metaAppIds()` (`lib/whatsapp/coexistence.ts:22-29`, formerly `:19-26`); the pre-filled values in `.env.example`; the generator defaults in `scripts/gen-env-docs.ts`; the ID text in `lib/ai/env-registry.ts`. The constants remain only as a deny-list (`lib/whatsapp/mode.ts:16-17`) |
| Must now be configured | `META_APP_ID` (both modes: direct mode uses it for the app-subscription read; coexistence mode for Embedded Signup and the subscription read). `META_CONFIG_ID` (coexistence mode only) |
| Did existing deployments rely on the defaults? | **Unknown.** `.env.example` shipped with the values filled in, so a deployment that copied it has them set explicitly; one that left the variables empty relied on the fallback. Production configuration was not read and cannot be checked from here **[BLOCKED]** |
| If missing | `metaAppIds()` returns `""`. Consequences [SRC]: the signup exchange answers 503 "META_APP_ID is not set" (`signup/exchange/route.ts:84-90`); the app-subscription check reports "META_APP_ID is not set" without calling Meta (`coexistence-actions.ts:168-170`); the admin panel shows `—` for App ID and `FB.init` is skipped (`AdminWhatsAppPanel.tsx:142`); `/test` shows the variable as missing. Webhook receipt and signature checks do **not** depend on these IDs, so inbound processing continues |
| Verify before any deployment | That the server environment sets `META_APP_ID` (and `META_CONFIG_ID` if coexistence mode stays); that `/test` shows both as set after deploy; that the existing check `scripts/check-whatsapp-coexistence.ts:54-55` (now "no fallback") stays green |

---

## 8. Evidence package inventory

A review copy was created at **`reports/evidence/phase2/review-package-c1-c10-20261111/`** (33 files plus `README.txt` and `SHA256SUMS.txt`). Source copies carry a `.txt` suffix so the TypeScript build never compiles them; contents are byte-identical to the originals at copy time (hashes in `SHA256SUMS.txt`). Originals were not touched. No `.env.local`, credential or secret file is included; the only env file copied is the committed template `.env.isolated-test.example` (all values blank).

Token-like strings present in the copied **test** files are pre-existing or new **fake fixtures**: `EAAB1234567890abcdef` (`lib/ai/selftest.ts:534`, redaction test), `EAAsecretTokenValue` (`scripts/check-whatsapp-coexistence.ts`, mock exchange, in the repo since commits `ef8d9bd`/`5e61d6c`), `EAAfakeTokenForOfflineTestsOnly000`, `EAAstoredSignupTokenFake000`, `EAAambientShouldBeBlanked0000` (new offline tests). The `mongodb://app:pw@…` strings in `selftest.ts:485-491` are fixtures for the dev-database guard test.

| # | Item | Path (relative to repo root) | Proves | Does not prove | Kind |
|---|---|---|---|---|---|
| 1 | Full unified diff | `reports/evidence/phase2/c1-c10-changes-20261111T0714Z.diff` | Every change to the 24 modified files and the 5 new files, relative to the pre-change snapshot (2,279 lines) | Runtime behaviour; completeness relative to the *committed* tree (the files already had uncommitted earlier work; the snapshot is the baseline) | Original |
| 2 | 114-test log | `reports/evidence/phase2/final-check-whatsapp-direct-20261111T0714Z.log` | 114/114 offline checks for C1–C10, exit 0, 78 integration variables blanked, 2 intercepted fetch calls, 0 real | Anything against MongoDB, HTTP or Meta; C5 is simulated | Original |
| 3 | Direct-mode and credential logic | `lib/whatsapp/mode.ts` | C1, C3 (`directConfig`), C4 filter, C6 guard, C7 block, C8 status | — | Original source |
| 4 | Credentials and send | `lib/whatsapp/cloud.ts` | `resolveCredentials` (C3), `sendGate` (C1), `postMessage` guard (C6) | — | Original source |
| 5 | Webhook route | `app/api/meta/whatsapp/webhook/route.ts` | Size limit → raw-byte signature → ID filter → claim-based processing (C4, C5) | HTTP behaviour (not run) | Original source |
| 6 | Event claims and reservations | `lib/whatsapp/event-claims.ts` | Claim/lease/fencing, inbound-once, reply reservation, index definitions (C5) | Behaviour on real MongoDB | Original source |
| 7 | Orchestration | `lib/whatsapp/webhook-process.ts` | Claim → process → done ordering; 500 paths (C5) | — | Original source |
| 8 | Index creation and store | `lib/whatsapp/store.ts` | Required events index; best-effort message indexes; error handling (C5) | That creation succeeds on any real database | Original source |
| 9 | Inbound/deliver | `lib/whatsapp/inbound.ts` | Record-once, reservation-before-send, re-throw on error, idempotent coexistence writes (C2, C5) | — | Original source |
| 10 | Follow-ups | `lib/ai/followups.ts` | C2 direct-mode credential path; second `postMessage` caller | — | Original source |
| 11 | Coexistence module | `lib/whatsapp/coexistence.ts` | `metaAppIds` without fallback (C9); mode-aware `outboundAllowed` (C1); `verifySignature` over bytes (C4) | — | Original source |
| 12 | Closed routes | `app/api/meta/whatsapp/signup/exchange/route.ts`, `signup/approve/route.ts`, `coexistence/route.ts`, `status/route.ts` | C7 410 block first in each `POST`; C8 status | HTTP behaviour (not run) | Original source |
| 13 | Isolated launcher + template | `scripts/isolated-env.mjs`, `.env.isolated-test.example` | C10 validation, blanking, forced switches, fatal exit | Rejection of the real production WABA/phone IDs | Original source |
| 14 | Self-test | `lib/ai/selftest.ts` | §6 change; synchronous Agent 4 block | — | Original source |
| 15 | New offline suite | `scripts/check-whatsapp-direct.ts` | What each of the 114 checks asserts, incl. the simulated collection | — | Original source (test) |
| 16 | Existing suite (updated expectation) | `scripts/check-whatsapp-coexistence.ts` | 4b change at `:54-55` | — | Original source (test) |
| 17 | TypeScript check | `reports/evidence/phase2/final-tsc-20261111T0714Z.log` | `tsc --noEmit` exit 0 | Runtime correctness | Original |
| 18 | WhatsApp 102/102 | `reports/evidence/phase2/final-check-whatsapp-20261111T0714Z.log` | Existing coexistence checks pass after C1–C10, exit 0 | — | Original |
| 19 | Phase 2 251/251 | `reports/evidence/phase2/final-check-phase2-20261111T0714Z.log` | Existing self-test and provider checks pass, exit 0 | — | Original |
| 20 | Phase 2 250/251 (kept) | `reports/evidence/phase2/check-phase2-post-c1-c10-20261111T0709Z.log` | The failure explained in §6.2 (line 162) | — | Original |
| 21 | Direct suite first run 112/113 (kept) | `reports/evidence/phase2/check-whatsapp-direct-20261111T0713Z.log` | The C6.13 test-pattern defect before its fix | — | Original |
| 22 | Isolated environment check | `reports/evidence/phase2/final-isolated-env-check-20261111T0714Z.log` | No credentials file, session secrets owner-only, variable sources, exit 0 | — | Original |
| 23 | Docker read-only status | `reports/evidence/phase2/docker-status-readonly-20261111T0714Z.log` | Engine not running, port 27018 closed, last remediation evidence still USABLE, on 11 Nov | — | Original |
| 24 | Docker remediation evidence | `reports/phase2/DOCKER_SECURITY_EVIDENCE.md`, `reports/evidence/phase2/docker-root-credential-check-{before-20261110T1705Z,current-20261110T1709Z}.log`, `docker-root-remediation.sh`, `docker-root-verify.sh` | §2 facts; the prepared, unrun procedure | That remediation happened | Original |
| 25 | Pre-change snapshot | `reports/evidence/phase2/pre-c1-c10-snapshot-20261111T0700Z/` (`*.orig`, `SHA256SUMS*.txt`, `README.txt`) | Baseline for the diff; 25/25 hashes verified | — | Original |
| 26 | Implementation report | `reports/phase2/WHATSAPP_DIRECT_CLOUD_API_IMPLEMENTATION_REPORT.md` | Mapping C1–C10 → files, results, limitations as reported on 11 Nov | — | Explanatory (earlier) |
| 27 | This report | `reports/phase2/WHATSAPP_DIRECT_CLOUD_API_CLIENT_CLARIFICATIONS.md` | — | — | **Newly prepared explanatory document** |
| 28 | Review package | `reports/evidence/phase2/review-package-c1-c10-20261111/` | Copies of items 1–2, 3–16 (as `.txt`), 17–24, with `SHA256SUMS.txt` | — | **Newly prepared copies** (originals untouched) |

**Missing evidence (none exists, by construction):** any MongoDB-backed result; any HTTP-level result after C1–C10; any Meta interaction; post-remediation Docker evidence; production configuration state.

---

## 9. Outstanding risks and verification gaps

| # | Risk / gap | Severity | Tag |
|---|---|---|---|
| 1 | Docker root credential still usable; all HTTP and database-backed verification blocked behind it | High (process) | [BLOCKED] |
| 2 | Two new unique indexes created automatically at first use; existing data not inspected; failure degrades duplicate protection silently (log line only; `messageIndexState` not surfaced in any page) | High | [SRC][BLOCKED] |
| 3 | No exactly-once delivery: HTTP-layer retry (`retries: 1`) can double-send after a timeout | Medium–High | [SRC] |
| 4 | Reply lost if failure occurs between reservation and send; `pending` reservations are not retried and not shown anywhere | Medium | [SRC] |
| 5 | Lease takeover after 120 s can run the AI twice; without `wa_reply_once`, two sends possible | Medium | [SRC] |
| 6 | Production WABA/phone-number IDs cannot be deny-listed; launcher accepts them if supplied as both configured and test IDs (reads only; sends impossible under the launcher) | Medium | [BLOCKED] |
| 7 | C9: production may have relied on the removed defaults; unknown without reading production configuration | Medium (deploy) | [BLOCKED] |
| 8 | C6 blocks coexistence test-number replies from development servers (behaviour change) | Low–Medium (operational) | [SRC] |
| 9 | Events index unavailability makes every webhook 500 (fail closed) — inbound WhatsApp stops until the database is healthy; Meta may disable the webhook after prolonged failure | Medium (availability) | [SRC] |
| 10 | Self-test mutates `process.env` inside the live server (pre-existing pattern; safe only while synchronous) | Low | [SRC] |
| 11 | Original claim holder ignores `completed:false` after a takeover (optimistic 200) | Low | [SRC] |
| 12 | Template follow-ups not analysed under C5 | Low (scope) | — |

---

## 10. Approval required before the next stage

| Decision | Needed for |
|---|---|
| A. Authorise Docker Desktop start and execution of `docker-root-remediation.sh` (§2.4), with the before/after evidence of §2.6 | Unblocks HTTP and database-backed testing |
| B. Authorise the read-only index conflict inspection of §3.3 against the **local test database** (after A), and decide who runs it against production and when | Index deployment decision |
| C. Decide the index policy if conflicts are found: manual de-duplication, narrower filter (code change), or deploy without the indexes | C5 guarantee level |
| D. Decide on the HTTP-retry change for `/messages` (`retries: 0` or equivalent) — a code change outside C1–C10 | Double-delivery risk (§4.4) |
| E. Decide whether `pending` reservations should be surfaced (admin list) and/or retried — a code change outside C1–C10 | Lost-reply gap (§4.2 #4) |
| F. Choose a production-ID verification method from §5.4 (1, 2 or 3) | Closes the §5.3 gap to the chosen degree |
| G. Confirm production has `META_APP_ID` (and `META_CONFIG_ID` if coexistence remains) set explicitly | Safe deployment with C9 |
| H. Accept or reject the self-test pinning in `lib/ai/selftest.ts` (§6) | Keeps 251/251 under the launcher |
| I. Accept the global effect of C6 on development-server coexistence sends | Operational |
| J. Authorise re-running `webhook-tests.mjs`, `whatsapp-isolation-tests.mjs`, `check:routes` and D1–D10 after A (the isolation test WA1 will need updating for direct mode) | HTTP verification |

**No further work is performed until written authorisation is received.** C11 and C12 remain out of scope.
