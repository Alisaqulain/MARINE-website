# Marina Muse Phase 2: consolidated security verification report

**10 November 2026.** Verification window: 05:30–10:55 UTC. This report supersedes the security sections of the 9 November reports.

**Scope and limits:**
- This was local, read-only verification on this PC.
- **No production system was accessed.** No production database, no production API, no production configuration.
- No credential was rotated. No Gemini request was sent. No CareerPath AI process, container or file was changed.
- Nothing was deployed or published.
- No secret value appears in this report or in any evidence file. Credentials are identified only by SHA-256 fingerprints (first 10 hex characters).

Evidence lives in `reports/evidence/security/`. File names below are relative to that folder.

---

## 1. Executive summary

| Question | Answer |
|---|---|
| Is the security verification complete? | **Complete with documented limitations: 13 of 15 planned items done (87%).** Every scan finished with `SCAN COMPLETED` (exit code 0 for all v2 runs; G1's exit code not captured), and every accessible location was scanned. **NOT VERIFIED today:** the 13/13 test-database checks and the 8/8 running-application checks, because Docker is stopped and starting it could restart CareerPath AI. Locations that cannot be scanned (page and hibernation files, shadow copies, virtual disks, off-machine copies) are listed in section 7.4 |
| Did development use the production database today? | **No.** The fresh check (07:28 UTC) found 0 production references in the Marina process environments and 0 TCP connections to the 6 production MongoDB addresses |
| Was production database access by any copy of the credentials confirmed? | **NOT VERIFIED.** That needs the Atlas access log, which is outside authorization. No local evidence shows a connection from the exposed copies (section 8.2) |
| Are the production MongoDB credentials still exposed? | **Yes, CONFIRMED.** The full production URI and password are in **24 files** outside the project:
- another project's `.env.local`;
- 21 VS Code/Cursor local-history snapshots of Marina's `.env.local`;
- Cursor's state database;
- a Cursor agent transcript.

The password also appeared in a ChatGPT cache entry, now evicted. They were also sent to two third-party AI services, Cursor and ChatGPT |
| Is production deployment authorized? | **No.** |
| Is Marina ready for production? | **No.** Production credentials must be rotated first (section 14), and the earlier functional blockers remain (Gemini scenarios, webhooks, Meta) |

**The most important finding.** Between 24 October and 9 November, Marina's development `.env.local` contained the **production** MongoDB URI and other live credentials. Copies of that file survive in at least four places outside the project, and its contents reached two external AI services. Deleting the 9 November backups did not remove these copies. **Only rotating the credentials closes the exposure.** That is the client's decision and outside the current authorization.

---

## 2. What happened to the original A1/A2/A3/B workers

| Fact | Evidence |
|---|---|
| The 9 November sweep started 5 workers at 17:55 UTC: A1, A2, A3 (E:), A4 (git) and B (profile) | `disk-scan-status-20261109.log` |
| A4 (git history) completed at 18:17 UTC | `fingerprint-scan-A4-E-git-history-20261109-final.log` (has `SCAN COMPLETED`) |
| **A1, A2, A3 and B never completed.** Their progress logs stop at 18:51–18:53 UTC, and no result log or exit code was written | `fingerprint-scan-{A1,A2,A3,B}-*-20261109-final.progress`; the status log has no `Finished` lines |
| Cause: at **18:54:45 UTC** the PC was powered off from the Start menu (Event 1074, `Explorer.EXE`, user `ali`, reason "Other (Unplanned)"), followed by sleep and Fast Startup | Windows System log, events 1074 and 42 |
| When this session began (05:32 UTC), none of the 6 PIDs existed and no node process was running | Process check in this session |
| The v1 scanner kept results in memory until the end, so the four interrupted runs left **no usable results** | `fingerprint-scan.mjs` |

**Response:**
- No worker was terminated, restarted or duplicated while it was running. All of them had already been dead for about 10 hours.
- The interrupted scope was re-run in full with **scanner v2** (`fingerprint-scan-v2.mjs`). v2 uses the same detection logic and adds:
  - a crash-safe journal: every match, coverage gap and finished unit is written to disk immediately, and a re-run resumes;
  - real archive decompression;
  - low-memory git reading.
- The v1 logs are kept unchanged as evidence.
- The runner keeps the PC from idle-sleeping (`run-disk-scans-v2.ps1`).
- D: and `C:\ProgramData` were added. v1 never covered them.

---

## 3. Final scan results

Every number below comes from the logs; `scan-inventory.mjs` regenerates the table.

| Scan | Scope | Files | MB | Unreadable | Exit code | Completed (UTC) | Credential matches (files) |
|---|---|---|---|---|---|---|---|
| A1 | E: section 1 (40 top-level entries) | 399,602 | 12,110 | 1 | 0 | 2026-11-10 07:13:43 | none |
| A2 | E: section 2 (40 top-level entries) | 1,964,454 | 57,393 | 0 | 0 | 2026-11-10 09:58:05 | none |
| A3 | E: section 3 (39 top-level entries) | 401,719 | 8,554 | 1 | 0 | 2026-11-10 07:11:14 | full URI 1; password 1; user 1 |
| B | Windows profile, C: Recycle Bin, `C:\Windows\Temp`, `C:\Users\Public` | 230,907 | 16,078 | 71 | 0 | 2026-11-10 07:02:25 | full URI 23; password 24; user 28 |
| D | D:\ and `C:\ProgramData` (new) | 44,770 | 17,961 | 95 | 0 | 2026-11-10 06:14:57 | none |
| G1 | Git history retry, `E:\tourtravelwebiste` | 1 store | 4,457 | 0 | not captured (foreground; log complete) | 2026-11-10 05:46:18 | none |
| G2 | Git history, `D:\src\flutter` | 1 store | 19,365 | 0 | 0 (attempt 2; attempt 1 exit 134, out of memory) | 2026-11-10 08:04:35 | none |
| Z1 | Archives found by D (50) | 192,873 | 7,407 | 17 | 0 | 2026-11-10 07:12:59 | none |
| Z2 | Archives found by A1 and B (466) | 95,849 | 4,726 | 52 | 0 (attempt 2; attempt 1 never started: command line too long) | 2026-11-10 07:24:52 | none |
| Z3 | Archives found by A3 (231) | 726 | 1,644 | 5 | 0 | 2026-11-10 07:19:09 | none |
| Z4 | Archives found by A2 (1,095) | 46,890 | 10,297 | 6 | 0 | 2026-11-10 10:53:55 | none |
| A4 | Git history, 130 repositories (9 Nov, v1) | 93 stores | 4,207 | 37 (explained in section 4) | not recorded (log complete) | 2026-11-09 18:17:39 | none |
| A5 | Git stores git refused (9 Nov, v1) | 12 stores | 2,771 | 1 (repo13, covered by G1) | not recorded (log complete) | 2026-11-09 18:33:14 | none |

**Totals:**
- **Disk sweep (A1–A3, B, D): 3,041,452 files, 112,096 MB, 168 unreadable entries.**
- Archive phase (Z1–Z4): 336,338 files (containers plus extracted files), 24,074 MB, 80 unreadable entries.
- Git: 107 object stores (A4 93, A5 12, G1 1, G2 1), 30,800 MB of decompressed objects.

Source: `scan-inventory-20261110.md`, generated by `scan-inventory.mjs` from the logs.

**Distinct files with a production fingerprint match: 29** (section 7.2):
- **24** with the full URI and password;
- 1 with the password and user name (the ChatGPT cache);
- 4 with the user name only.

**Exit codes:**
- A1, A2, A3, B and D were started by `run-disk-scans-v2.ps1`, which records exit codes in worker order in `disk-scan-status-20261110.log`.
- Z1–Z4 and G2 exit codes are in `archive-scan-status-20261110.log`.
- G1 ran in the foreground; its log ends with `SCAN COMPLETED` and its exit code was not captured.
- The 9 November runner never recorded exit codes for A4 and A5; both logs are complete.

---

## 4. Git history

| Scan | Result |
|---|---|
| **A4** (9 Nov, v1): every object in 130 repositories on E: | 93 object stores read; **0 matches**. 37 refused, as follows |
| 23 of those 37 | `.git` folder is **empty**: no history exists. Their working trees were scanned in the E: sweep. `git-refused-repos-check-20261110.log` |
| 12 of those 37 (`G-Drive-Backup\…`, no HEAD) | Read via alternates in **A5**: 12/12 read, **0 matches**. `git-alternates-map-20261109.log` |
| `E:\tourtravelwebiste`: out of memory twice (A4; A5 repo13) | **Retry G1 succeeded** (10 Nov): low-memory git settings, run alone. All **8,140 objects, 4,456 MB** decompressed, 0 errors, **0 matches**. Repository not modified (index timestamp unchanged). `fingerprint-scan-G1-tourtravel-git-retry-20261110.log` |
| Repositories on C: profile, D:, Public, ProgramData | One found: `D:\src\flutter`, an unmodified upstream Flutter clone (98,226 commits, none by this user, no local changes). **G2:**
- **Attempt 1 failed:** node heap out of memory, exit code 134. The token cache outgrew 3 GB.
- The cache cap was made configurable; controls re-ran 28/28 with both the default and a 1,000-entry cache.
- **Attempt 2 succeeded (exit code 0):** all **1,163,647 objects, 19,365 MB** decompressed, 0 unreadable, **0 matches**. This agrees with git's own count (19,305 MB of content plus headers). `fingerprint-scan-G2-flutter-git-20261110-v2.log` |
| Marina's own history | Covered by A4: 0 matches. `.env.local` was never committed |

**Classification: git histories are FULLY SCANNED — NO MATCHES.** Every repository with a history was read; 23 repositories have none.

---

## 5. Archive decompression

**Method:**
- Each archive is unpacked into an empty scratch folder (`D:\fp-extract-tmp-20261110`, removed afterwards) with Windows `tar` (bsdtar). A single-file gzip falls back to a stream decoder.
- Every extracted file is scanned separately.
- Nested archives are opened up to depth 3.
- Failures are recorded, never skipped.

| Phase | Inventory | Top-level processed | OK | Partial | Failed | Nested opened | Files scanned | MB | Matches |
|---|---|---|---|---|---|---|---|---|---|
| Z1 (D:) | 50 | 50 | 50 | 0 | 0 | 301 (284 ok, 3 partial, 14 failed) | 192,823 extracted | 7,407 | 0 |
| Z2 (A1 + B) | 466 | 466 | 455 | 0 | 11 | 183 (142 ok, 5 partial, 36 failed) | 95,383 extracted | 4,726 | 0 |
| Z3 (A3) | 231 | 231 | 226 | 4 | 1 | 0 | 495 extracted | 1,644 | 0 |
| Z4 (A2) | 1,095 | **1,095** (1,095 distinct finished units) | 1,089 | 4 | 2 | 3 (3 ok) | 45,795 extracted | 10,297 | 0 |
| **Total** | **1,842** | **1,842** | **1,820** | **8** | **14** | 487 | 334,496 | 24,074 | **0** |

**Z4's non-OK containers:**
- 3 webpack cache `.pack.gz` files (partial);
- `tar-fs` test fixture `invalid.tar` (partial);
- 2 deliberately corrupt `@fastify/static` test fixtures (`*.html.gz`, failed).

**Evidence:**
- Status: `archive-scan-status-20261110.log`, which also records the two earlier failed attempts.
- Logs: `fingerprint-scan-Z{1,2,3,4}-…-20261110-v2.log`.

**Clean-up.** The extraction folder `D:\fp-extract-tmp-20261110` is **empty but still exists**: a Claude Code safety check refused to remove it. Delete it manually.

**Every top-level failure was examined:**
- 1 is this session's own deliberately corrupt control fixture.
- 9 are malformed-on-purpose test fixtures from Go libraries in an old Claude scratchpad.
- 2 are Office lock files (`~$….docx`), which are not real documents.
- 4 partial results are webpack cache `.pack.gz` files that aren't valid gzip.

The raw bytes of all of these were still scanned in the disk sweep. Every nested failure is a test fixture inside the Flutter, Dart `archive` or Go toolchain archives: encrypted, malformed, or bz2/xz samples with no decoder.

**Not decompressed: zip-based packages** (`.jar`, `.apk`, `.aar`, `.whl`, `.vsix` …). Their raw bytes were scanned; their compressed contents were not. They are third-party build and SDK artefacts (Oracle, Android, Gradle, VS Code extensions), so the residual risk is low. **Classification: PARTIALLY SCANNED.** Counts are in section 7.

---

## 6. Scanner validation (positive and negative controls)

`positive-control-v2.mjs` builds fixtures with **synthetic** credentials, runs the scanner with their fingerprints added, and checks every expected detection and non-detection.

- First run: **28/28 PASS** at 05:37 UTC, log `fingerprint-scan-positive-control-v2-20261110.log`.
- Re-run after the `@file` argument change: **28/28 PASS**, log `…-v2b-20261110-summary.log`.

| Case | Result |
|---|---|
| Environment files: full URI; `KEY=password`; quoted user | PASS ×3 |
| JSON (nested) and JSONL transcript (prose, escaped quotes) | PASS ×3 |
| JavaScript strings: single-quoted, template literal, double-quoted | PASS ×3 |
| Chunk boundaries: value straddling the 4 MiB and the 8 MiB read boundary | PASS ×2 |
| Decompressed archives: zip, tar.gz, tar, 7z, single-file .gz, zip-in-zip, .docx | PASS ×7 |
| Git history: value committed then removed from the working tree | PASS |
| Negative: near-miss value (1 character different) not matched; production fingerprints absent from the fixtures | PASS ×2 |
| Failure handling: corrupt archive reported FAILED; missing repository reported unreadable | PASS ×2 |
| Raw archive bytes contain no plaintext, so archive hits prove decompression | PASS |
| Resume: only the unfinished unit is re-scanned and totals are identical | PASS ×2 |
| Exit codes 0/0; extraction folder empty afterwards | PASS ×2 |

The 9 November v1 control (`fingerprint-scan-positive-control-20261109-final.log`) also passed: env, JSONL, JS, a large file, and a zip read through the archive path.

---

## 7. Coverage inventory and classification

### 7.1 FULLY SCANNED — NO MATCHES

| Location | Evidence |
|---|---|
| Marina Muse project, `E:\marina e-comm (2)\marina e-comm` (incl. `.env.local`, `.next`, `node_modules`, reports) | A3. Only the cluster host name appears, in 10 of this project's own evidence scripts and logs. The host name is not secret |
| All readable files in E: section A1 | A1 |
| All readable files in E: section A3 except `Job-Career-Pao\.env.local` (section 7.2) | A3 |
| All files in E: section A2 (incl. `G-Drive-Backup`, 46 sub-folders, and CareerPath AI `E:\mca sem1 grp projecct`): 1,964,454 files, 0 unreadable | A2 |
| Git histories (all repositories with history) | Section 4 |
| Compressed archives and office documents: all top-level containers that unpacked | Z1–Z4 (section 5) |
| `C:\Users\Public` (13 files) | B |
| Your own Recycle Bin on C:, D: and E: (SID `…-1458126277-1001`) | B, D, A1 |
| Claude scratchpads, all sessions (`C:\Users\ali\AppData\Local\Temp\claude\…`) | B. No match in any scratchpad |
| `C:\Users\ali\.marina-env-backup\` (now empty) | B and the deleted-path check (section 9) |
| D: all readable files except the two listed in 7.4 | D |

### 7.2 SCANNED — MATCHES REQUIRE INVESTIGATION

All matches are investigated in section 8.

| Location | Fingerprints |
|---|---|
| `E:\jobwebsiteansariroad\Job-Career-Pao\.env.local` | full URI, password, user |
| `C:\Users\ali\AppData\Roaming\Code\User\History\-ed0dd53\` (VS Code local history of Marina `.env.local`, 17 snapshots) | full URI, password, user, in all 17 |
| `C:\Users\ali\AppData\Roaming\Cursor\User\History\-ed0dd53\` (Cursor local history of the same file, 4 snapshots) | full URI, password, user, in all 4 |
| `C:\Users\ali\AppData\Roaming\Cursor\User\globalStorage\state.vscdb` | full URI, password, user |
| `C:\Users\ali\.cursor\projects\e-marina-e-comm-2\agent-transcripts\00bb67f6-…\compaction\segment_002.md` | full URI, password, user |
| `C:\Users\ali\AppData\Local\Google\Chrome\User Data\Default\IndexedDB\https_chatgpt.com_0.indexeddb.blob\2\5a\5a62` | password, user (file evicted by Chrome after the scan) |
| `C:\Users\ali\AppData\Local\Google\Chrome\User Data\Default\History` | user name only |
| `C:\Users\ali\.claude\projects\…\904a677e-….jsonl`, `…\a847478c-….jsonl`, `C:\Users\ali\.claude\file-history\904a677e-…\ccd7e0cfcfef8e70@v2` | user name only |

### 7.3 PARTIALLY SCANNED

| Location | Scanned | Not scanned | Reason | Residual risk |
|---|---|---|---|---|
| `C:\Users\ali` (profile) | 230,891 files, 16,078 MB | 69 locked files: Chrome `Cookies`, `Sessions`, `Tabs`; VS Code and Discord `Cookies`; `NTUSER.DAT` and its logs; 44 under `AppData\Local\Packages` (Store apps); others under `AppData\Local\Microsoft`/`Comms`. Also `weights.bin` (Chrome on-device model, 4.3 GB, over the size limit) | EBUSY (held open by running apps or Windows); size limit | Low–medium. Cookie and session stores could hold pasted text only in unusual cases. The registry hive is not a normal place for a connection string |
| `C:\ProgramData` | 1,079 files | 93 entries, 91 of them under `ProgramData\Microsoft` | EPERM (Windows-owned) | Low: system data |
| D: drive | 43,691 files, 17,575 MB | `D:\pagefile.sys`, `D:\DumpStack.log.tmp` | Locked by Windows | **Medium.** The page file can hold fragments of process memory, including any process that once loaded the production `.env.local` |
| E: drive | All readable files (sections 7.1/7.2) | `E:\pagefile.sys` (12.3 GB), `E:\System Volume Information`, the orphaned Recycle Bin of SID `…-170627101-1001` | Over 4 GB and locked; Windows-owned; inaccessible to this account | Medium (page file); low (an old Windows installation's bin) |
| Zip-based packages (`.jar`, `.apk` …) | Raw bytes | Compressed contents. Counts per worker are in the inventory logs: A1 277, A2 5,216, A3 136, B 38, D 1,841 (7,508 in total), plus 2,674 nested packages inside archives (Z1 2,050, Z2 6, Z3 4, Z4 614) | Third-party build artefacts | Low |
| Files skipped by extension | — | Images, fonts, audio/video, `.exe`/`.dll`/`.pdb`/`.node`, `.vhdx`, `.iso`, `.msi` (counts per log) | Cannot hold readable pasted text | Low, except the `.vhdx` files in 7.4 |

### 7.4 NOT SCANNED / INACCESSIBLE

| Location | Reason | Residual risk |
|---|---|---|
| `C:\Users\ali\AppData\Local\Docker\wsl\disk\docker_data.vhdx` (6.8 GB) and `…\main\ext4.vhdx` | Virtual disks (skipped by extension; would need Docker/WSL running) | Contains the test database volume and container configuration (the local test root password, section 12). It is not a known location for production values |
| `C:\hiberfil.sys` (6.3 GB), `C:\swapfile.sys`, `D:\pagefile.sys`, `E:\pagefile.sys` | Locked memory images | **Medium.** These can retain memory of processes that held the production URI before 9 November |
| `C:\Windows\Temp` | EPERM | Low |
| `C:\$Recycle.Bin\S-1-5-18` (SYSTEM) | EPERM | Low |
| Volume Shadow Copies and restore points | Need administrator rights (`Win32_ShadowCopy` refused) | **Medium.** A shadow copy could still hold the deleted 9 November backups |
| Rest of C: (`Program Files`, `Windows`, other profiles) | Out of scope: system and vendor files | Low |
| Unallocated disk space (deleted-file remnants, SSD-remapped blocks) | A forensic tool would be needed | Medium. Section 9 explains why deletion is not erasure |
| Off-machine copies: Cursor's and ChatGPT's servers, GitHub remotes, the real Google Drive behind `E:\G-Drive-Backup`, the production server | Not reachable, and not authorized | **High** for the two AI services, which are known to have received the values |

---

## 8. Fingerprint matches: investigation

Method: `investigate-matches.mjs` reads each matched file and reports, for every occurrence:
- the byte position;
- the nearest key name;
- for a URI, whether its password part is a placeholder, the production password (by fingerprint), or something else.

It **never prints the value or the surrounding text**. Logs:
- `match-investigation-interim-20261110.log`
- `match-investigation-final-20261110.log`

### 8.1 Confirmed exposures of the full production credentials

| # | Location | What | Since | Notes |
|---|---|---|---|---|
| E1 | `E:\jobwebsiteansariroad\Job-Career-Pao\.env.local` (6,530 bytes, written **4 Nov 2026 18:11 UTC**) | `MONGODB_URI` with the production password; `MONGODB_DB_NAME`. **57 of its 59 variable names match Marina's `.env.example`**: a copy of Marina's pre-isolation environment file inside an unrelated project, `jobcareerpao` | 4 Nov | See section 8.2. File left untouched as instructed |
| E2 | VS Code local history of Marina `.env.local`: **17 snapshots, 24 Oct–9 Nov 06:26 UTC** | Full URI and password in every snapshot | 24 Oct | Kept automatically by VS Code on every save. The 9 Nov clean-up did not cover it |
| E3 | Cursor local history of the same file: **4 snapshots, 25–27 Oct** | Full URI and password | 25 Oct | as E2 |
| E4 | Cursor `globalStorage\state.vscdb` and agent transcript `segment_002.md` (25 Oct) | Full URI and password, under the key `MONGODB_URI` | 25 Oct | **A Cursor AI agent read Marina's `.env.local`.** The values were therefore sent to Cursor's AI service, a third party outside local control |
| E5 | Chrome IndexedDB cache for `chatgpt.com` | Production password and user name | unknown | Strong indication that the values were pasted into ChatGPT. Chrome evicted the cache entry between the scan (05:54 UTC) and the investigation (06:51 UTC), so the local copy is gone. **Any copy held by ChatGPT is beyond local verification** |

**Scope of E1–E4.** These are copies of the **entire** pre-isolation `.env.local`. Only the MongoDB values were fingerprinted, but the same copies also held every other credential in that file. By variable name: `AUTH_SECRET`, `ADMIN_PASSWORD`, `SMTP_PASS`, `GOOGLE_CLIENT_SECRET`, `PAYPAL_CLIENT_SECRET` (live), `SHIPGLOBAL_PASSWORD`, `KVM2_UPLOAD_TOKEN`, `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `GEMINI_API_KEY`, `VAPI_API_KEY`, `VAPI_WEBHOOK_SECRET`, `EXOTEL_API_KEY`/`TOKEN`, `GA4_API_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON` and `CRON_SECRET`. **Treat them all as exposed.**

### 8.2 The `jobcareerpao` copy (E1): production-configuration exposure

| Question | Finding | Method |
|---|---|---|
| What is it? | `.env.local` of the unrelated Next.js project `jobcareerpao` (`E:\jobwebsiteansariroad\Job-Career-Pao`). 59 variables, 57 shared with Marina's `.env.example`; production MongoDB URI with password; production cluster id present | Variable names and fingerprints only |
| When? | File written 4 Nov 2026 18:11:52 UTC. Nothing else in the project has changed since 16 Sep | File timestamps |
| In git? | Not tracked; never committed; the project's `.git` folder is empty; no remote | `git ls-files`, `git log --all` |
| Did that project run with it? | **No evidence that it did.** Its `.next` build folder is **empty** and unchanged since 16 Sep; `next dev`/`next build` would have written files there. No other file has changed since 4 Nov. No process from the project is running. Claude Code has no project history for it, and its Cursor transcript (26 Oct) predates the file and has no Marina or MongoDB references | `find -newermt`, process list, transcript counts |
| How did it get there? | **Not determined.** The nearest activity is a single path mention in an unrelated Claude Code session on 4 Nov 14:04 UTC, about 4 hours earlier, which is not conclusive | Transcript path search (path names only) |
| Did anything reach production with it? | **NOT VERIFIED.** No local evidence of a run. Proving or excluding access needs the Atlas access/audit log, outside authorization | — |

**Classification: CONFIRMED production-configuration exposure.** If anyone runs that project's dev server, it will connect to Marina's **production** database. Nothing in Marina's guards can prevent that, because the guard lives in Marina's code, not jobcareerpao's. The file was left untouched as instructed.

### 8.3 User name / database name only (lower severity)

The production database **user name equals the production database name**. Every remaining match is that single string with no password beside it:

- **Claude Code transcripts and file-history (2 transcripts, 1 snapshot):**
  - 11 occurrences in total;
  - in tool output (`stdout`), message text or plain text;
  - never inside a URI and never next to a password.
- **Likely cause.** `npm run check:mongo` printed `user: <name>`. It has now been changed to print a fingerprint (section 13).
- **Chrome History:** the name appears in a URL with no password part, which fits an Atlas console page.

### 8.4 Production database access status

| Item | Status |
|---|---|
| Access from Marina development **today** | **NOT CONFIRMED.** Verified absent: 0 connections, 0 environment references (section 11) |
| Access by the two pre-isolation dev servers (PIDs 3548, 18668) before 9 Nov | **CONFIRMED** in the 9 Nov evidence. Development genuinely used production until 9 Nov 13:05 UTC. Those processes have since exited |
| Access by anyone using the exposed copies (E1–E5) | **NOT VERIFIED.** Needs Atlas logs (client) |

---

## 9. Deleted backup paths

Rechecked 10 Nov 05:47:31 UTC. Read-only: existence, parent listing, name search. The files were never opened. Log: `deleted-backup-paths-check-20261110.log`.

| Path | Result |
|---|---|
| `C:\Users\ali\.marina-env-backup\env.local.pre-isolation-20261109` | **Absent.** Parent folder exists and is empty. No `env.local*` file anywhere under `C:\Users\ali` |
| `…\Temp\claude\e--marina-e-comm--2--marina-e-comm\a847478c-…\scratchpad\env.local.backup-2026-11-08` | **Absent.** The parent holds 30 unrelated helper scripts. No `env.local*` file anywhere in that session's folder |
| Recycle Bin (C:) | 1 `$I` record, none referring to `env.local` or `.marina-env-backup`. Recycle Bins on C:, D: and E: also fingerprint-scanned: 0 matches |
| Fingerprint sweep | Neither path, nor any other location in the profile, holds a backup copy of the file **except** the editor histories in section 8.1 (E2, E3) |

**This is not forensic erasure.** Deleted data can remain in unallocated clusters, Volume Shadow Copies (inaccessible here), page and hibernation files, and SSD-remapped blocks. The editor-history copies show the same values never left the disk.

---

## 10. Fresh runtime and process environment evidence

Taken 10 Nov 07:27–07:29 UTC, after the sweep's matches were known.

| Check | Result | Evidence |
|---|---|---|
| Marina processes at session start (05:48 UTC) | **None running** (the PC was powered off on 9 Nov) | Process list |
| Marina dev server for this check | Started by this session with `next dev -p 3929` (development mode, guards on), **then stopped** (PIDs 17584 and 21528; no listener on 3929 afterwards) | `headers-and-routes-20261110T0727Z.log` |
| Process environment of both PIDs (read from process memory, values hashed) | 0 of 3 production fingerprints. `MONGODB_URI` host `127.0.0.1:27018`. `MONGODB_DB_NAME=marina_muse_dev`. No `1za3pdr`/`mongodb.net` anywhere in the environment block | `process-env-check-20261110T0728Z.log` |
| Application database configuration | `/api/health` reports connection mode `direct (127.0.0.1:27018…)`, `connected:false` (container stopped) | headers-and-routes log |
| Development configuration review | `.env.local`: database host local only; `PAYPAL_MODE` not live; no `*_ALLOW_*_OUTSIDE_PRODUCTION` switch set; outbound and onboarding switches off. One production-domain reference: `SEARCH_CONSOLE_SITE_URL`, a read-only property identifier and expected | `env-readiness-audit-20261110.log` |
| Refusal checks against the running app | **19/19 PASS** | headers-and-routes log |

## 11. Fresh database and network isolation evidence

| Check | Result |
|---|---|
| Production addresses (DNS only, no connection) | 6 IPs: 3 shards of `cluster0.1za3pdr`, 3 of `a9zxbuj` |
| All TCP entries on the machine (99, every state) | **0** to a production IP; **0** to remote port 27017 |
| Old processes 3548 and 18668 | Not present |
| Local test database `127.0.0.1:27018` | **NOT VERIFIED today.** Docker Desktop is stopped. Starting it would also restart containers with restart policies, possibly CareerPath's, which is not authorized. Last verified 9 Nov 17:22 UTC |
| `dev-db verify` (previously 13/13) | **NOT VERIFIED** today (needs the container). Last result 13/13 PASS on 9 Nov (`dev-db-verify-20261109-recheck2.log`) |
| Running-application isolation (previously 8/8) | **NOT VERIFIED** as a full 8/8 today: its write/read checks need the database. Partial equivalent today: environment 0/3, connections 0, refusals 19/19. Last full result 8/8 PASS on 9 Nov |

Log: `prod-connection-check-20261110T0728Z.log`.

**Conclusion.** Every Marina development process run today was configured for, and could only reach, the local test database. No connection to production existed from any process on this PC at the time of checking.

---

## 12. Docker test-database credential disclosure

| Aspect | Detail |
|---|---|
| The risk | `marina-dev-mongo` was created with `MONGO_INITDB_ROOT_PASSWORD` as an environment variable. Docker keeps it in the container configuration, so `docker inspect marina-dev-mongo` shows it. `docker exec` also gives direct shell and database access |
| Who can do this | Anyone who can use Docker on this PC. The `docker-users` group contains only `DESKTOP-F8B4JJT\ali`. In practice, any process running as this Windows user, including AI coding agents, can |
| Also | The test app user's password is in `.env.local`, readable by the same account. The data volume lives in `docker_data.vhdx` |
| Impact | Full control of the **local test database only**: 3 synthetic "TEST ONLY" products and test records. Port bound to 127.0.0.1, so not reachable from the network |
| Not affected | The **production** database. The container holds no production credential or data (9 Nov check: no `1za3pdr`/`mongodb.net` in its environment) |
| Recommended (each needs separate approval) | 1. Re-create the container with `MONGO_INITDB_ROOT_PASSWORD_FILE` (a temporary file, deleted after first start), or change the root password inside MongoDB and re-create without the variable. The volume keeps the users. 2. Store the root password only in a password manager. 3. Keep `docker-users` limited to this account. 4. Treat Docker access as administrator-equivalent |
| Done now | Nothing changed. The `dev-db` script's message that said "root password discarded" was corrected (section 13) |

---

## 13. Fixes made in this session (development only, not deployed)

| File | Change | Test |
|---|---|---|
| `scripts/check-mongo-env.mjs` | (a) Prints a fingerprint of the database user name, not the name itself; this is the likely source of the user name in AI transcripts. (b) On a development machine (`.env.local` present, no `.env.production.local`, `NODE_ENV` not production) it applies the app's remote-host guard and refuses before connecting. The server diagnostic is unchanged | `check-mongo-guard-test-20261110.log`: 3/3 PASS (synthetic URIs) |
| `scripts/dev-db.mjs` | Message corrected: the root password is **not** discarded; Docker keeps it | `node --check` |
| `next.config.ts` | Conservative security headers on every route (`nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'`); `X-Powered-By` removed | Verified on a local server (pages and API) |
| `reports/evidence/security/fingerprint-scan-v2.mjs` (+ controls, runner, inventory, investigator, env audit, template generator) | New evidence tooling | 28/28 controls |

| `app/contact/page.tsx`, `app/custom-manufacturing/page.tsx`, `components/TopBar.tsx`, `auth.config.ts`, `components/WholesaleNavLink.tsx`, `lib/ai/integrations.ts` | 6 unused imports and locals removed. Lint substitute: 7 warnings → 1 (`lib/mongodb.ts` `uriPromise`, deliberately left) | `lint-substitute-unused-20261110T*.log` |

**Regression after the changes:**

| Check | Result | Run (UTC) |
|---|---|---|
| `tsc` | exit 0 | 10:13 |
| `check:phase2` | 251/251 | 10:13 |
| `check:whatsapp` | 98/98 | 10:13 |
| `check:routes` | 19/19 | 07:27, after the headers change and before the unused-import clean-up, which changed no route logic |
| `npm run build` | exit 0 (74/74 pages) | 10:13 |

**No test failed.** No Gemini request was made: these suites are mocked or refusal-only, and the build makes no AI calls.

---

## 14. Remaining security risks

| # | Risk | Severity | Owner |
|---|---|---|---|
| R1 | Production MongoDB password exposed (E1–E5), including to Cursor's and possibly ChatGPT's services | **Critical** | Client: rotate |
| R2 | Every other secret in the pre-isolation `.env.local` exposed through the same copies (live PayPal, SMTP, WhatsApp token, Meta secret, Vapi, Exotel, ShipGlobal, Google OAuth, GA4, `AUTH_SECRET`, `CRON_SECRET`, admin password, Gemini key) | **Critical** | Client: rotate |
| R3 | `jobcareerpao` would connect to production if run | High | Client: delete the file after rotation, or decide otherwise |
| R4 | Editor histories (21 snapshots) and Cursor state still hold the old values on disk | High until rotation, low afterwards | Client: clear after rotation |
| R5 | Page and hibernation files, shadow copies and unallocated space not scanned | Medium | Accept, or run a forensic or administrator scan |
| R6 | Whether the exposed credentials were used against production is unknown | Medium (unknown) | Client: review the Atlas access log, network access list and database users |
| R7 | Local test-database root password readable through Docker | Low (local test data only) | Section 12 |
| R8 | CareerPath AI shares the test database port | Low | Proposal: `MARINA_MUSE_CAREERPATH_SEPARATION_PROPOSAL.md` |
| R9 | No HSTS or script CSP yet | Medium (production hardening) | Deployment checklist, section 5 |
| R10 | 13/13 and 8/8 database checks not re-run today | Low (unchanged configuration, re-verified indirectly) | Run `npm run dev:db -- verify` and `runtime-isolation-check.mjs` the next time Docker is started intentionally |

## 15. Recommended actions

**Client decisions, outside the current authorization:**
1. **Rotate the production MongoDB user's password** in Atlas, or create a new user and delete the old one. Then review Atlas: access/audit logs since 24 Oct, the network access list (remove `0.0.0.0/0` if present), and database users.
2. **Rotate every credential listed in R2** at its provider. Plan `AUTH_SECRET` together with WhatsApp re-onboarding.
3. After rotation, delete or clean:
   - `E:\jobwebsiteansariroad\Job-Career-Pao\.env.local`;
   - the VS Code and Cursor local history for Marina's `.env.local` (the two `-ed0dd53` folders);
   - the Cursor conversation that contains the file;
   - the ChatGPT conversation in which the values were pasted.
4. Policy: never open `.env*` files with AI agents enabled, and never paste credentials into AI chats. Use a password manager.
5. Approve or decline the CareerPath separation, and the Docker hardening in section 12.

**Developer, development only, can proceed once Docker can safely be started:**
6. Start Docker intentionally, then run `npm run dev:db -- verify` (expect 13/13) and `runtime-isolation-check.mjs` (expect 8/8).

## 16. Completion status and evidence references

**Final status, 10 November 2026, 10:55 UTC:**

**Security verification is COMPLETE WITH LIMITATIONS: 13 of 15 planned items (87%).**

| Item | Status |
|---|---|
| A1, A2, A3, B, D disk sweep | Complete: `SCAN COMPLETED`, exit code 0 for all five |
| Git histories (A4, A5, G1, G2) | Complete, 0 matches. G2 needed a second attempt (first failed: out of memory) |
| Archive decompression (Z1–Z4, 1,842 containers) | Complete: 1,842/1,842 processed, 0 matches; 22 partial or failed, all explained |
| Scanner controls | 28/28, run three times (plus a small-cache variant) |
| Match investigation | Complete: 29 files; 24 with full credentials |
| Deleted backup paths | Both absent (not forensic erasure) |
| Runtime environment and network | Verified: 0 production references, 0 production connections |
| Test-database 13/13 and running-application 8/8 | **NOT VERIFIED today** (Docker stopped; starting it could restart CareerPath AI). Last PASS 9 Nov |
| Docker disclosure, CareerPath proposal | Documented. Proposal only, nothing changed |

**Quality checks:**
- All logs referenced here exist.
- Totals come from `scan-inventory.mjs`.
- Every completion claim rests on a `SCAN COMPLETED` line.
- Incomplete and inaccessible locations are listed in sections 7.3/7.4 and are not called clean.
- No credential value appears in this report or the evidence.

**Restricted activity performed: none.**
- No production access.
- No credential rotation.
- No Gemini requests.
- No CareerPath AI change.
- No deployment.
- No customer-facing action.

| Evidence | File (in `reports/evidence/security/`) |
|---|---|
| v1 status (interrupted) | `disk-scan-status-20261109.log`, `fingerprint-scan-*-20261109-final.progress` |
| v2 runner and status | `run-disk-scans-v2.ps1`, `disk-scan-status-20261110.log`, `archive-scan-status-20261110.log` |
| v2 scan logs and journals | `fingerprint-scan-{A1,A2,A3,B,D,G1,G2,Z1,Z2,Z3,Z4}-…-20261110*.log` (+ `.journal`, `.progress`) |
| Git | `fingerprint-scan-A4-…-20261109-final.log`, `…A5…`, `git-alternates-map-20261109.log`, `git-refused-repos-check-20261110.log`, `git-repos-C-D-20261110.txt` |
| Archives | `archive-roots-*.txt`, `fingerprint-scan-Z*-…` |
| Controls | `positive-control-v2.mjs`, `fingerprint-scan-positive-control-v2*-20261110*` |
| Inventory | `scan-inventory.mjs`, `scan-inventory-20261110.md` |
| Matches | `investigate-matches.mjs`, `match-investigation-*-20261110.log` |
| Deleted paths | `deleted-backup-paths-check-20261110.log` |
| Runtime and network | `process-env-check-20261110T0728Z.log`, `prod-connection-check-20261110T0728Z.log`, `headers-and-routes-20261110T0727Z.log` |
| Environment | `env-readiness-audit.mjs`, `env-readiness-audit-20261110.log`, `gen-prod-env-template.mjs` |
| Tests and build | `tsc-20261110T0647Z.log`, `check-phase2-20261110T0647Z.log`, `check-whatsapp-20261110T0647Z.log`, `build-20261110T0725Z.log`, `check-mongo-guard-test-20261110.log` |
