# G1 Execution Evidence — Local Docker Remediation and Environment Preparation

**Date:** 15 November 2026 (UTC 07:4x, updated 09:3x) · **Operator:** Ali (via Claude Code) · **Final status (after Run 2): G1 PARTIALLY COMPLETE — backup done; root-credential remediation BLOCKED by a conflicting restriction; 8/8 runtime check deferred to G2 (see Run 2 at the end).** Sections A–G below are the original Run 1 record, preserved unchanged.

## A. Authorization
- Ahmad authorized **G1 only**, under the scope of v1.1 Section 10 (as relayed by Ali on 15 Nov). The verbatim client sentence should be filed with this report.
- G1 permits: start Docker Desktop; identity check of `marina-dev-mongo`; before/after evidence; `docker-root-remediation.sh`; `docker-root-verify.sh`; `npm run dev:db -- verify`; `isolation-proof.ps1`. Excludes container recreation, other containers, production, network, providers.
- **G2, G3, G4, G4-B and G5 remain NOT AUTHORIZED.** None of their work was performed.

## B. Initial environment
| Item | Value |
|---|---|
| Repository | `E:\marina e-comm (2)\marina e-comm`, branch `main`, HEAD `8fe2163` (2026-11-13 16:27 +0530) |
| Working tree | One pre-existing uncommitted change: `app/checkout/page.tsx` (trailing whitespace, not from this work) |
| Docker | Client 29.9.2; engine was stopped; started Docker Desktop; server 29.9.2 |
| Containers after start | `b10ee2630808` `marina-dev-mongo` (`mongo:7.0`, `127.0.0.1:27018->27017`, restart `unless-stopped`, created 2026-11-09T11:55:39Z); `52e40018da56` `lms` (other project, auto-started by its own restart policy when Docker Desktop started; **not operated on**) |
| Target full id | `b10ee26308087be0452721aee773c6ab1dfc7bbb276891bc5bd134aea60c7031` |
| Mounts | volume `marina-dev-mongo-data` → `/data/db`; anonymous volume `bbd1bf64…549ed` → `/data/configdb` |
| Container env (names only) | `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, image defaults |
| App DB target (`.env.local`, host only) | `127.0.0.1:27018`, database `marina_muse_dev` — local test DB, not production |
| Existing backups | None found for the test DB |

## C. Backup evidence
**No backup taken.** Section 10 lists no backup operation for G1, while the execution instruction makes a verified backup mandatory before any credential change and says to stop if the backup method is not permitted by Section 10. A `mongodump` (or volume copy) would be an unlisted database or container operation. Per the stop conditions, I did not improvise one.

Risk context: the remediation changes only the `devroot` password (a fresh value generated and discarded inside the container); test data and the app user are not modified. After it, root access is lost by design; the documented recovery is `npm run dev:db -- reset --yes` then `setup` + `seed`, which recreates the container and discards the test data (3 TEST products, 1 user, no orders).

## D. Actions performed
| # | Action | Reason | Command (sanitized) | Outcome |
|---|---|---|---|---|
| 1 | Pre-flight identity | G1 identity check | `git …`, `docker version`, `docker ps -a`, `docker inspect marina-dev-mongo` (env names only), `docker volume ls` | Recorded above |
| 2 | Start Docker Desktop | Permitted; engine was off | `Start-Process "Docker Desktop.exe"`; polled `docker info` | Engine ready |
| 3 | Before-state root check | Permitted before-evidence | `bash reports/evidence/phase2/docker-root-verify.sh` | Root credential **USABLE**; unauthenticated `listDatabases` refused |
| 4 | Before-state DB verification | Permitted | `npm run dev:db -- verify` (writes and deletes one probe document on the local test DB) | **13/13 ISOLATED** |
| 5 | Remediation | — | `docker-root-remediation.sh` | **NOT RUN** (backup blocker, Section C) |

Files changed: this report and logs under `reports/evidence/phase2/g1/` only. No configuration, container, volume or application file changed.

## E. Verification results
| ID | Check | Expected | Actual | Result |
|---|---|---|---|---|
| G1-1 | Container identity (`mongo:*`, `127.0.0.1:27018`) | Match | `mongo:7.0`, `127.0.0.1:27018` | PASS |
| G1-2 | Root credential after remediation | `NOT USABLE` | Before: `USABLE`; remediation not run | BLOCKED |
| G1-3 | Unauthenticated access refused | refused | refused (Unauthorized) | PASS |
| G1-4 | `dev:db verify` | 13/13 | 13/13 (before remediation) | PASS (re-run required after remediation) |
| G1-5 | Runtime isolation 8/8 (`isolation-proof.ps1`) | 8/8 | Not run: needs a running isolated app server on port 3939, and starting the app server is not listed in G1 | BLOCKED |
| G1-6 | Container id unchanged | same id | `b10ee2630808` unchanged | PASS |

Totals: **4 PASS, 0 FAIL, 2 BLOCKED.** Evidence: `reports/evidence/phase2/g1/before-root-verify-*.log`, `before-devdb-verify-*.log`.

## F. Safety confirmation
- No container recreated, removed or modified; `lms` untouched (only auto-started by Docker Desktop).
- No volume deleted or replaced; no data changed except the self-deleting `dev:db verify` probe.
- No production database, external provider, Meta API or network call (beyond local Docker).
- No WhatsApp activity; live number untouched.
- No production change; all four agents remain disabled; no agent activated.
- No G2/G3 work: no tsc, build, test suite, `npm audit`, code change, commit or push.
- No secret printed or written.

## G. Final status
**G1 PARTIALLY COMPLETE.** Docker is running, the container identity is confirmed and before-evidence is captured. Remediation (G1-2) and the runtime check (G1-5) are blocked.

**Decisions needed from Ahmad to finish G1:**
1. **Backup:** either (a) confirm no backup is required because only the root password changes and the documented reset is the accepted recovery, or (b) authorize a local `mongodump` of `marina_muse_dev` with the app user via `docker exec` into the same container, copied to `reports/evidence/phase2/g1/backup/` (git-ignored), before remediation.
2. **Runtime isolation 8/8:** either authorize starting the isolated app server (`node scripts/isolated-env.mjs -- next dev -p 3939`, local only) for `isolation-proof.ps1`, or move that check to G2.

---

## Run 2 — 15 November 2026, 09:31–09:33 UTC

### Client decisions applied
- **MongoDB backup: APPROVED** (local `mongodump` of `marina_muse_dev` with `marina_dev_app`; no restore).
- **Runtime isolation 8/8 on port 3939: DEFERRED TO G2.** Server not started.
- Restrictions in force: no database role, user or permission modification; no reset or restore; no container recreation; `lms` untouched.

### Backup evidence
| Item | Value |
|---|---|
| Method | `mongodump --db marina_muse_dev` run inside `marina-dev-mongo` via `docker exec`, authenticated as `marina_dev_app` (URI passed by environment variable, never printed); copied out with `docker cp`; temporary in-container copy removed |
| Location | `C:\Users\ali\marina-dev-backups\marina_muse_dev-20261115T0931Z\` (outside the repository, local only) |
| Contents | 18 collections (`.bson` + `.metadata.json`) plus `prelude.json` |
| Integrity | `SHA256SUMS.txt` (37 files) verified with `sha256sum -c` |
| Content check (no restore) | Per-collection document counts via `bsondump` equal live counts read with the app user: products 3, users 1, ai_jobs 13, ai_health_runs 3, ai_attribution 2, ai_usage 2, page_views 2, _dev_isolation 1, wa_coexistence_state 1, all others 0 |
| Restore | Not performed |

### Remediation
**NOT RUN — BLOCKED.** The only G1 remediation (`docker-root-remediation.sh`) changes the `devroot` user's password with `changeUserPassword`. The latest written restrictions prohibit any database user modification. Running it would violate that restriction, so it was not attempted. Resolution needs Ahmad to confirm explicitly that the `devroot` password change is permitted as the G1 remediation (it is the purpose of G1 in v1.1 §10).

### Verification (after Run 2)
| ID | Check | Result | Evidence |
|---|---|---|---|
| G1-1 | Container identity: `b10ee2630808…7031`, `mongo:7.0`, running | PASS | `g1/after-container-*.log` |
| G1-2 | Root credential `NOT USABLE` | BLOCKED (still USABLE; remediation not run) | `g1/after-root-verify-*.log` |
| G1-3 | Unauthenticated access refused | PASS | same |
| G1-4 | `dev:db verify` 13/13, incl. expected negative `_probe` check | PASS | `g1/after-devdb-verify-*.log` |
| G1-5 | Runtime isolation 8/8 | DEFERRED TO G2 (client decision) | — |
| G1-6 | Container id unchanged across runs | PASS | — |
| G1-7 | Backup created and verified | PASS | backup folder above |
| G1-8 | Test data preserved (3 products, 1 user) | PASS | live counts and dump counts |
| G1-9 | App authentication and isolation | PASS | `G1_MONGODB_AUTH_DIAGNOSTIC.md` |

Totals: **7 PASS, 0 FAIL, 1 BLOCKED, 1 DEFERRED.**

### Safety confirmation (Run 2)
No container recreated or restarted by this work; `lms` untouched; no role, user or permission changed; no reset, restore or data deletion (dev:db verify's own probe document only); root account not used; no production, provider, Meta or WhatsApp access; agents disabled; live number untouched; no G2/G3 work.

---

## Run 3 — 15 November 2026, 10:23 UTC — root credential remediation (FINAL)

**Authorization:** Ahmad's explicit written approval of `docker-root-remediation.sh` and `docker-root-verify.sh`, limited to changing and verifying the `devroot` password inside the existing `marina-dev-mongo`.

| Step | Result |
|---|---|
| Scripts unchanged (tracked in Git, no diff); remediation touches only `MONGO_INITDB_ROOT_USERNAME` via `changeUserPassword` | Confirmed |
| Container id before | `b10ee26308087be0452721aee773c6ab1dfc7bbb276891bc5bd134aea60c7031` |
| `bash reports/evidence/phase2/docker-root-remediation.sh` | exit 0; "devroot password replaced (fresh value generated in-container and discarded)" |
| Embedded verify | `stored root credential: NOT USABLE (AuthenticationFailed)`; unauthenticated `listDatabases` refused |
| Standalone `bash reports/evidence/phase2/docker-root-verify.sh` | `NOT USABLE (AuthenticationFailed)`; refused (Unauthorized) |
| Container id after | identical |
| App user before/after (`connectionStatus`) | `marina_dev_app@marina_muse_dev`, role `readWrite` on `marina_muse_dev` only — unchanged |
| `npm run dev:db -- verify` | 13/13 ISOLATED |
| Test data | 3 TEST products, 1 user — unchanged |
| Backup `C:\Users\ali\marina-dev-backups\marina_muse_dev-20261115T0931Z` | present; 37-file SHA-256 manifest re-verified |
| Restore / reset | none |
| Git | only pre-existing `app/checkout/page.tsx` change plus new report files |

Evidence: `reports/evidence/phase2/g1/remediation-*.log`, `final-root-verify-*.log`, `final-devdb-verify-*.log`, `final-backup-verify-*.log`.

### Final G1 checks
| ID | Check | Result |
|---|---|---|
| G1-1 | Container identity unchanged | PASS |
| G1-2 | Root credential `NOT USABLE` | PASS |
| G1-3 | Unauthenticated access refused | PASS |
| G1-4 | `dev:db verify` 13/13 | PASS |
| G1-5 | Runtime isolation 8/8 | DEFERRED TO G2 (client decision; not a G1 requirement any more) |
| G1-6 | App user, roles, connection string unchanged | PASS |
| G1-7 | Backup present and verified | PASS |
| G1-8 | Test data preserved | PASS |

**G1 FINAL STATUS: COMPLETE.** Root access to the test DB is now unavailable by design; the documented recovery, if ever needed, is `dev:db reset --yes` + `setup` + `seed` (separate authorization), or restoring the verified backup (separate authorization).

Safety: no container recreated; `lms` untouched; no other user, role or permission changed; no production, provider, Meta or WhatsApp access; agents disabled; live number untouched; G2/G3 not started.
