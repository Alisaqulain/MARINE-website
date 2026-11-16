# Marina Muse International: G1 Completion Evidence Register

**Prepared:** 16 November 2026, from read-only inspection of existing files. No command in this delivery started Docker, accessed MongoDB, or re-ran any G1 step.

**G1 status:** previously authorized by Ahmad and reported completed on 15 November 2026. This register shows which parts of that completion are backed by original logs and which are not.

**Copies:** every file in `G1_EVIDENCE/` is a byte-identical copy of an original, checked with `cmp`. Filenames are preserved. SHA-256 checksums are in `G1_EVIDENCE_SHA256SUMS.txt`. The originals under `reports/evidence/phase2/` were not modified.

---

## 1. Authorization record

| Item | Status | Source |
|---|---|---|
| Ahmad's G1 authorization | **Reported, confirmed by Ahmad's clarification that G1 was authorized in writing and completed** | Ahmad's clarification, relayed by Ali; `reports/phase2/G1_EXECUTION_EVIDENCE.md` §A ("Ahmad authorized G1 only, under the scope of v1.1 Section 10, as relayed by Ali on 15 Nov") |
| Original written authorization text (verbatim message, sender, time) | **NOT AVAILABLE in the repository.** `G1_EXECUTION_EVIDENCE.md` §A says the verbatim sentence "should be filed with this report"; it never was | Searched `reports/`, `docs/` for the authorization text: not found |
| Approval of `docker-root-remediation.sh` / `docker-root-verify.sh` | Reported as "Ahmad's explicit written approval" (`G1_EXECUTION_EVIDENCE.md:111`); **the text itself is not on file** | Same |

Ahmad's own records are the authoritative source for the written approval. It should be attached to this register; it must not be reconstructed.

## 2. Evidence items

All times are UTC on 15 November 2026 unless stated. Paths are relative to `G1_EVIDENCE/`.

| # | File | Time | What it proves | Type |
|---|---|---|---|---|
| 1 | `g1/before-root-verify-20261115T0745Z.log` | 07:45:47 | Before remediation, the stored `devroot` credential was **USABLE**; unauthenticated `listDatabases` was refused | Original log |
| 2 | `g1/before-devdb-verify-20261115T0746Z.log` | 07:46 | Database isolation **13/13** before remediation | Original log |
| 3 | `g1/mongodb-auth-diagnostic/app-identity-and-ops-20261115T0755Z.log` | 07:55 | App user `marina_dev_app` has only `readWrite@marina_muse_dev`; a probe write/read/delete worked; 3 products | Original log |
| 4 | `g1/after-container-20261115T0932Z.log` | 09:32 | Container identity: id `b10ee263…c7031`, image `mongo:7.0`, started 07:45:29Z | Original log |
| 5 | `g1/after-root-verify-20261115T0932Z.log` | 09:32:41 | Still **USABLE** at 09:32 (Run 2 before remediation) | Original log |
| 6 | `g1/after-devdb-verify-20261115T0932Z.log` | 09:32 | 13/13 | Original log |
| 7 | `g1/remediation-20261115T1023Z.log` | 10:23:17 | Remediation output: container id before = after (same full id as #4); app user and roles unchanged; products 3, users 1 before and after; embedded check **NOT USABLE (AuthenticationFailed)**; `exit=0` | Original log |
| 8 | `g1/final-root-verify-20261115T1023Z.log` | 10:23:25 | Standalone final check: **NOT USABLE (AuthenticationFailed)**; unauthenticated access refused | Original log |
| 9 | `g1/final-devdb-verify-20261115T1023Z.log` | 10:23 | Database isolation **13/13** after remediation | Original log |
| 10 | `g1/final-backup-verify-20261115T1023Z.log` | 10:23 | "backup manifest verified: 37 files" (manifest at `C:\Users\ali\marina-dev-backups\marina_muse_dev-20261115T0931Z\SHA256SUMS.txt`, outside the repository; **not copied**) | Original log |
| H1 | `historical-pre-execution/docker-root-credential-check-before-20261110T1705Z.log` | 10 Nov 17:05 | Historical: root USABLE, roles listed | Historical, **not completion proof** |
| H2 | `historical-pre-execution/docker-root-credential-check-current-20261110T1709Z.log` | 10 Nov 17:09 | Historical: still USABLE ("remediation NOT effective") | Historical, superseded by #7 and #8 |
| H3 | `historical-pre-execution/docker-status-readonly-20261111T0714Z.log` | 11 Nov 07:14 | Docker was unavailable on 11 Nov; nothing was verified | Historical |
| H4 | `historical-pre-execution/docker-root-remediation.sh`, `docker-root-verify.sh` | — | The scripts that were run; they contain no credential values | Scripts |

**Later corroboration, outside G1 and not copied:** `reports/evidence/phase2/final/root-verify-20261115T1456Z.log` (14:58:55Z) still shows NOT USABLE.

## 3. Acceptance criteria versus evidence

v1.1 §10 / plan T1.1–T1.3 criteria: `NOT USABLE`, 13/13, 8/8, same container id.

| Criterion | Result | Status |
|---|---|---|
| Stored root credential NOT USABLE after remediation | #7, #8 (10:23Z) | **VERIFIED by original log** |
| Database isolation 13/13 | #2, #6, #9 | **VERIFIED by original log** |
| Same container (not recreated) | #4 and #7: identical full id | **VERIFIED by original log** for 09:32–10:23. The Run 1 pre-flight identity (~07:45) is narrative only. The start time 07:45:29Z indicates the container was started, not recreated, in Run 1; this is an inference |
| App user and test data unchanged | #3, #7 | **VERIFIED by original log** |
| Backup taken and verifiable | #10 | Manifest verification **VERIFIED**. Backup creation output **NOT AVAILABLE** (narrative only) |
| Runtime isolation 8/8 | No 8/8 run exists inside the G1 window. Ahmad moved this check to G2 | **NOT G1 EVIDENCE.** Runs at 14:52Z and 14:56Z (`reports/evidence/phase2/g4local/…1452Z`, `final/runtime-isolation-20261115T1456Z.log`) belong to the G2 scope. The 10 Nov run (`runtime-isolation-isolated-20261110T1631Z.log`) is on an older tree |
| Execution environment | `marina-dev-mongo`, `127.0.0.1:27018`, `marina_muse_dev`; repository HEAD `8fe2163` (per `G1_EXECUTION_EVIDENCE.md:13`; no log captures HEAD at execution time) | HEAD **reported**, not logged |

## 4. Missing G1 evidence

1. Original written G1 authorization text (message, sender, timestamp).
2. Written approval text for the two Docker scripts.
3. Run 1 pre-flight outputs (`docker ps`, `docker inspect`, `docker volume ls`, about 07:45Z). Narrative only, in `G1_EXECUTION_EVIDENCE.md`.
4. Backup creation output (`mongodump`, "dump-ok", `docker cp`, 09:31Z). Narrative only.
5. Dump-versus-live count comparison (09:31Z). Narrative only, and no longer reproducible because live counts changed in later testing.
6. A log capturing the Git commit at execution time.
7. Runtime isolation 8/8 within G1. None exists; it was moved to G2 by Ahmad's decision.

Nothing has been re-run to fill these gaps.
