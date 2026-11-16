# G1 MongoDB Authorization Diagnostic

**Date:** 15 November 2026 · **Scope:** G1 diagnostic, local test container `marina-dev-mongo` (`b10ee2630808`) only. Evidence: `reports/evidence/phase2/g1/mongodb-auth-diagnostic/`.

## A. Executive summary
- **Error:** `not authorized on marina_muse to execute command { insert: "_probe" }`
- **Root cause: CONFIRMED — expected behaviour, not a fault.** The insert is a deliberate negative test inside `npm run dev:db -- verify` ("App user cannot write to any other database"). The local app user is correctly limited to `marina_muse_dev`; MongoDB refusing the write to `marina_muse` is what makes that check PASS (it did, 13/13 at 07:4x UTC today). The refusal appears in the mongod log because MongoDB logs every authorization failure.

## B. Application identity
| Field | Value |
|---|---|
| Configuration source | `.env.local`, loaded by `@next/env` (no `.env` file; no Docker Compose file) |
| URI variable | `MONGODB_URI` (`MONGODB_URI_STANDARD` not set) |
| Username | `marina_dev_app` |
| Host | `127.0.0.1:27018` (local container) |
| URI database | `marina_muse_dev` |
| Effective application database | `marina_muse_dev` — `lib/mongodb.ts:25` uses `MONGODB_DB_NAME`, which is `marina_muse_dev` |
| Note | `lib/mongodb.ts:25` defaults to `marina_muse` only when `MONGODB_DB_NAME` is unset; it is set, so the default is not used |

## C. Permissions (from `connectionStatus` with `showPrivileges`, as the app user)
| Database | Roles | find | insert | update | remove | createCollection |
|---|---|---|---|---|---|---|
| `marina_muse_dev` | `readWrite` | yes | yes | yes | yes | yes |
| `marina_muse` | none | no | no | no | no | no |

## D. authSource
`authSource=marina_muse_dev`, explicit in the URI (written by `scripts/dev-db.mjs:111` at setup). The user was created in `marina_muse_dev` (`dev-db.mjs:107`), and `connectionStatus` reports `{user: marina_dev_app, db: marina_muse_dev}`. Authentication database and application database are both `marina_muse_dev`; they match.

## E. `_probe` source
| File:line | Function | Caller | Database / collection | Purpose | Cleanup |
|---|---|---|---|---|---|
| `scripts/dev-db.mjs:197` | `verify()` | `npm run dev:db -- verify` (`dev-db.mjs:226`) | `marina_muse` / `_probe` via the app client | Negative test: must be refused (`otherDbDenied`) | None needed: insert is refused by design |

No application route, health check (`/api/health` only pings `marina_muse_dev`), monitoring process or Docker health check references `_probe`. The only other "probe" is `_dev_isolation_probe` (`dev-db.mjs:182-185`) in `marina_muse_dev`, which is inserted, read back and deleted. The local mongod log shows 4 `_probe` entries in the last 2 hours, consistent with verification runs (including today's G1 run).

## F. Normal database operation results
| Operation | Result | Identity | Database |
|---|---|---|---|
| Application authentication | PASS | `marina_dev_app` | — (authSource `marina_muse_dev`) |
| Normal read | PASS (products count 3; isolation marker present) | `marina_dev_app` | `marina_muse_dev` |
| Normal write | PASS (one `_diag_probe` document inserted, read back) | `marina_dev_app` | `marina_muse_dev` |
| Temporary record cleanup | PASS (deleted 1; confirmed absent) | `marina_dev_app` | `marina_muse_dev` |

## G. Root cause and evidence
`dev:db verify` deliberately attempts `insert` on `marina_muse._probe` with the least-privilege app user. That user holds only `readWrite` on `marina_muse_dev`, so MongoDB refuses it with "not authorized", and the script records the refusal as a PASS. The application itself never targets `marina_muse` in development because `MONGODB_DB_NAME=marina_muse_dev`.

## H. Recommended correction (not executed)
- **No permission change.** Granting rights on `marina_muse` would break the isolation guarantee the check exists to prove.
- Optional documentation change (G3 scope): add a comment beside `dev-db.mjs:197` and a line in `docs/phase2/TESTING.md` stating that one "not authorized on marina_muse … _probe" log entry per verify run is expected.

## I. Safety confirmation
No roles, users or permissions changed; no connection string or `authSource` changed; no `.env*`, container or volume changed; no container restarted or recreated; `lms` untouched; root account not used; no production database, provider, Meta or WhatsApp access; no existing data modified (one temporary diagnostic document created and deleted in `marina_muse_dev`); all four agents remain disabled; live number untouched; no G2/G3 work.
