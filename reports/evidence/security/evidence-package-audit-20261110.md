# Evidence-package audit

Generated 2026-11-10T11:19:55.130Z by `evidence-package-audit.mjs`. Read-only: no scan was re-run and no evidence was changed or deleted.

## 1. Per-scan artefacts

| Scan | Log | Journal | Progress | Completion marker | Exit code record | Journal complete record | Verdict |
|---|---|---|---|---|---|---|---|
| A1 | yes | yes | yes | 2026-11-10T07:13:43.036Z | exit 0 | yes (310 units) | COMPLETE |
| A2 | yes | yes | yes | 2026-11-10T09:58:05.320Z | exit 0 | yes (533 units) | COMPLETE |
| A3 | yes | yes | yes | 2026-11-10T07:11:14.611Z | exit 0 | yes (282 units) | COMPLETE |
| B | yes | yes | yes | 2026-11-10T07:02:25.324Z | exit 0 | yes (70 units) | COMPLETE |
| D | yes | yes | yes | 2026-11-10T06:14:57.511Z | exit 0 | yes (73 units) | COMPLETE |
| G1 | yes | yes | yes | 2026-11-10T05:46:18.121Z | **NOT CAPTURED** (see 2) | yes (1 units) | COMPLETE (log), exit code not recorded |
| G2 | yes | yes | yes | 2026-11-10T08:04:35.797Z | exit 0 | yes (1 units) | COMPLETE |
| Z1 | yes | yes | yes | 2026-11-10T07:12:59.067Z | exit 0 | yes (50 units) | COMPLETE |
| Z2 | yes | yes | yes | 2026-11-10T07:24:52.370Z | exit 0 | yes (466 units) | COMPLETE |
| Z3 | yes | yes | yes | 2026-11-10T07:19:09.963Z | exit 0 | yes (231 units) | COMPLETE |
| Z4 | yes | yes | yes | 2026-11-10T10:53:55.296Z | exit 0 | yes (1095 units) | COMPLETE |
| A4 (9 Nov, v1) | yes | n/a (v1) | n/a | 2026-11-09T18:17:39.982Z | not recorded (v1 runner) | n/a | COMPLETE (log), exit code not recorded |
| A5 (9 Nov, v1) | yes | n/a (v1) | n/a | 2026-11-09T18:33:14.026Z | not recorded (v1 runner) | n/a | COMPLETE (log), exit code not recorded |

Failed or aborted attempts are kept, not overwritten:
- `fingerprint-scan-A4-E-git-history-20261109-attempt1-failed.progress` (A4 attempt 1).
- `fingerprint-scan-G2-flutter-git-20261110-v2-attempt1-failed.journal` (G2 attempt 1, exit 134).
- Z2 attempt 1 never started; recorded in `archive-scan-status-20261110.log`.
- The interrupted v1 workers' `fingerprint-scan-{A1,A2,A3,B}-*-20261109-final.progress` files.

## 2. G1 exit code

G1 (`git:E:\tourtravelwebiste`) was run in the foreground before the runner existed, as `(time node … ) | tail -5`. A pipe returns the exit status of its last command (`tail`), so node's own exit code was **never captured**, and no status log recorded it.

Evidence that the run nevertheless completed normally:
- its log ends with `SCAN COMPLETED at 2026-11-10T05:46:18.121Z`;
- its journal has a `complete` record;
- the scanner prints `complete:` only after writing the log, and that line was shown;
- `Unreadable entries: 0`;
- the 4,457 MB read matches git's own object total (4,456 MB, 8,140 objects).

It is still reported as **exit code not captured**, never as exit 0.

## 3. Unreadable-entry reconciliation

### Disk sweep: 168 unreadable entries (log totals: A1 1, A2 0, A3 1, B 71, D 95)

| Category | Entries | By worker | Report classification |
|---|---|---|---|
| C:\ProgramData, Windows-owned (EPERM) | 93 | D 93 | 7.3 C:\ProgramData PARTIALLY SCANNED |
| Profile: Store-app data held open (EBUSY) | 44 | B 44 | 7.3 C:\Users\ali PARTIALLY SCANNED |
| Profile: other files held open (EBUSY) | 12 | B 12 | 7.3 C:\Users\ali PARTIALLY SCANNED |
| Profile: browser/editor cookies, sessions (EBUSY) | 9 | B 9 | 7.3 C:\Users\ali PARTIALLY SCANNED |
| Profile: registry hive (EBUSY) | 3 | B 3 | 7.3 C:\Users\ali PARTIALLY SCANNED |
| Recycle Bin of SYSTEM or of an orphaned SID | 2 | A1 1, B 1 | 7.3 E: PARTIALLY SCANNED; 7.4 C:\$Recycle.Bin\S-1-5-18 |
| Windows memory/dump file (locked) | 2 | D 2 | 7.4 NOT SCANNED (page files); 7.3 D: and E: PARTIALLY SCANNED |
| System Volume Information (Windows-owned) | 1 | A3 1 | 7.3 E: PARTIALLY SCANNED |
| File vanished during scan (ENOENT) | 1 | B 1 | 7.3 C:\Users\ali (transient temp file; nothing left to scan) |
| C:\Windows\Temp (EPERM) | 1 | B 1 | 7.4 NOT SCANNED |

### Archive phase: 80 unreadable entries (log totals: Z1 17, Z2 52, Z3 5, Z4 6)

| Category | Entries | By phase | Report classification |
|---|---|---|---|
| third-party library test fixture (encrypted/malformed/bz2/xz by design) | 70 | Z1 17, Z2 50, Z4 3 | Section 5: explained failures; raw bytes covered by the disk sweep |
| webpack cache .pack.gz (not valid gzip) | 7 | Z3 4, Z4 3 | Section 5: explained failures; raw bytes covered by the disk sweep |
| Office lock file (~$…), not a document | 2 | Z2 1, Z3 1 | Section 5: explained failures; raw bytes covered by the disk sweep |
| this session's deliberately corrupt control fixture | 1 | Z2 1 | Section 5: explained failures; raw bytes covered by the disk sweep |

## 4. Z4 completeness

- Inventory roots: **1095**; distinct finished units: **1095**; inventory roots without a finished unit: **0**.
- Top-level results: 1095 (ok 1089, partial 4, failed 2).
- Production fingerprint matches: **0**.

| Container | Result | Files scanned from it | Reason |
|---|---|---|---|
| `E:\G-Drive-Backup\aliminor\dekstop data\e-rikhsawabuzabhai\e-rikhsaw\.next\cache\webpack\client-development-fallback\0.pack.gz` | PARTIAL | 1 | tar.exe: Error opening archive: Unrecognized archive format / stream: invalid block type |
| `E:\G-Drive-Backup\devforge\node_modules\tar-fs\test\fixtures\invalid.tar` | PARTIAL | 1 | foo: Can't create '\\<scratch>': Invalid argument / tar.exe: Error exit delayed from previous errors |
| `E:\G-Drive-Backup\production\dcc_webiste_crm\.next\cache\webpack\client-development-fallback\0.pack.gz` | PARTIAL | 1 | tar.exe: Error opening archive: Unrecognized archive format / stream: incorrect header check |
| `E:\mcp project\node_modules\@fastify\static\test\static-pre-compressed\all-three.html.gz` | FAILED | 0 | tar.exe: Error opening archive: Unrecognized archive format / stream: incorrect header check |
| `E:\mcp project\node_modules\@fastify\static\test\static-pre-compressed\gzip-only.html.gz` | FAILED | 0 | tar.exe: Error opening archive: Unrecognized archive format / stream: incorrect header check |
| `E:\national\.next\cache\webpack\client-development-fallback\0.pack.gz` | PARTIAL | 1 | tar.exe: Error opening archive: Unrecognized archive format / stream: invalid distance code |

## 5. 13-check database and 8-check runtime verification

- Newest `dev-db verify` log: `dev-db-verify-20261109-recheck2.log`, modified 2026-11-09T17:34:20.784Z.
- Newest runtime-isolation log: `runtime-isolation-20261109-recheck2.log`, modified 2026-11-09T17:34:27.230Z.
- No log dated 10 November exists for either check.
- Both remain **NOT VERIFIED today**: Docker Desktop was never started in this session, because starting it could restart CareerPath AI containers.
- What was verified today instead:
  - the process environment (`process-env-check-20261110T0728Z.log`);
  - the TCP table (`prod-connection-check-20261110T0728Z.log`);
  - refusals (`headers-and-routes-20261110T0727Z.log`).

## 6. Reports and template

| File | Exists | Size | Modified (UTC) | Consistency checks |
|---|---|---|---|---|
| MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md | yes | 37757 | 2026-11-10T10:57:05.315Z | 6/6 key facts present; no pending markers |
| MARINA_MUSE_SECURITY_ISOLATION_EVIDENCE.md | yes | 15989 | 2026-11-10T07:35:08.418Z | 3/3 key facts present; no pending markers |
| MARINA_MUSE_PHASE2_FINAL_COMPLETION_REPORT.md | yes | 33502 | 2026-11-10T10:45:57.101Z | 5/5 key facts present; no pending markers |
| MARINA_MUSE_PRODUCTION_DEPLOYMENT_CHECKLIST.md | yes | 10173 | 2026-11-10T07:30:37.418Z | 3/3 key facts present; no pending markers |
| MARINA_MUSE_CAREERPATH_SEPARATION_PROPOSAL.md | yes | 8828 | 2026-11-10T09:59:06.913Z | 3/3 key facts present; no pending markers |
| MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env | yes | 12962 | 2026-11-10T06:50:30.054Z | 3/3 key facts present; no pending markers |

Template: 107 variable lines. Active lines with a value other than a placeholder, empty, `false` or `live`: **0**.
Secret check of the whole `reports/` folder (`reports-folder-secret-check-20261110.log`): **complete, 0 production URI/password/user fingerprints**.

## 7. Evidence inventory

- **157 files, 8.6 MB**, each with its SHA-256, size and modification time.
- Listed in `evidence-manifest-20261110.sha256`, generated with the same timestamp as this file.
- Covered: every file in `reports/evidence/security/` and every `MARINA_MUSE_*` report.
- This audit and the manifest are excluded, since neither can hash itself.
- To verify later, recompute each SHA-256 and compare.

