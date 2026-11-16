# Marina Muse International — Phase 2 Technical Evidence Response

**Prepared for:** Ahmad · **Prepared by:** Ali · **Version 2, 15 November 2026** (replaces version 1 of the same day)
**Session type:** read-only audit and evidence collection.
- No application code, configuration, Git state, database or process was changed.
- No server, agent or provider call was started.
- The only new files are the evidence files in `reports/phase2/evidence-20261115/`.

**Companion:** `reports/phase2/FINAL_PHASE2_G1_G6_COMPLETION_REPORT.md` (addendum v2 at its top).

Paths are relative to `E:\marina e-comm (2)\marina e-comm\` unless absolute. "Logged" means the result exists in an original log file. "Narrative only" means it is recorded in a report written during execution, with no separate log file.

---

## 1. Authorization status (your distinction, preserved)

| Item | Status |
|---|---|
| G1 | Technically completed; **your evidence review and formal acceptance pending** |
| G2, G3 | Technical work reported complete. **No separate written authorization is recorded**: only go-ahead statements relayed through me exist, with no written text, quote or time from you. **Awaiting your technical review and formal acceptance.** No retrospective authorization is assumed. |
| G4 real provider checks | Not authorized; also blocked on test credentials |
| G4-B temporary public HTTPS endpoint | Not authorized |
| G5 rotation and deployment | Not authorized |
| Git commit and push | Not authorized; not performed |
| Production database changes | Not authorized; not performed |
| Agents | All four must remain disabled (section 5) |
| WhatsApp | No registration, connection, migration or messaging; the live number untouched |
| Other side effects | No Vapi calls, customer emails, payments |

---

## 2. G1 original evidence

| # | Item | Original file(s) | Time (UTC, 15 Nov) | What it proves | Type |
|---|---|---|---|---|---|
| 1 | Root credential before | `reports/evidence/phase2/g1/before-root-verify-20261115T0745Z.log`; `g1/after-root-verify-20261115T0932Z.log` | 07:45; 09:32 | Stored `devroot` credential USABLE before remediation; unauthenticated access refused | Logged |
| 1 | Root credential after | `g1/remediation-20261115T1023Z.log` (embedded verify); `g1/final-root-verify-20261115T1023Z.log`; later `final/root-verify-20261115T1456Z.log` | 10:23; 14:56 | NOT USABLE (AuthenticationFailed) after `docker-root-remediation.sh` (exit 0) | Logged |
| 2 | Container identity before and after | `g1/remediation-20261115T1023Z.log` ("container before"/"container after"); `g1/after-container-20261115T0932Z.log` | 09:32; 10:23 | Same full id `b10ee26308087be0452721aee773c6ab1dfc7bbb276891bc5bd134aea60c7031`, image `mongo:7.0`, started 07:45:29Z (not recreated) | Logged |
| 2 | Container identity at the very start (Run 1, before 07:45) | `reports/phase2/G1_EXECUTION_EVIDENCE.md`, Run 1 section B | ~07:45 | Pre-flight `docker ps`/`inspect`/`volume ls` outputs | **Narrative only** |
| 3 | Database verification 13/13 | `g1/before-devdb-verify-20261115T0746Z.log`, `g1/after-devdb-verify-20261115T0932Z.log`, `g1/final-devdb-verify-20261115T1023Z.log` (G1); later `g4local/devdb-verify-20261115T1455Z.log`, `final/devdb-verify-20261115T1456Z.log` | 07:46; 09:32; 10:23; 14:55; 14:56 | Local-only URI, test database, probe write/read/delete, least privilege, port bound to 127.0.0.1, guards | Logged (13/13 each) |
| 4 | Backup manifest | `C:\Users\ali\marina-dev-backups\marina_muse_dev-20261115T0931Z\SHA256SUMS.txt` (outside the repository) | created 09:31 | 37 files with SHA-256 | Original file |
| 4 | Manifest verification | `g1/final-backup-verify-20261115T1023Z.log` | 10:23 | `sha256sum -c` passed, 37 files | Logged; **re-verified read-only during this audit: OK** |
| 5 | Backup creation | `G1_EXECUTION_EVIDENCE.md`, Run 2 ("Backup evidence") | 09:31 | `mongodump --db marina_muse_dev` as `marina_dev_app` inside the container; "dump-ok"; copied out with `docker cp` | **Narrative only**: command output was not saved to a log file |
| 6 | Dump-versus-live count comparison | `G1_EXECUTION_EVIDENCE.md`, Run 2 ("Content check") | 09:31 | 18 collections; dump counts equal live counts (products 3, users 1, ai_jobs 13, …) | **Narrative only**. Reproducible read-only now with `bsondump` on the backup, but live counts have changed since through later test activity (for example `ai_jobs`), so a re-run would not reproduce the 09:31 comparison |
| 7 | App user permissions and roles | `g1/mongodb-auth-diagnostic/app-identity-and-ops-20261115T0755Z.log`; `g1/remediation-20261115T1023Z.log` ("app before"/"app after"); `reports/phase2/G1_MONGODB_AUTH_DIAGNOSTIC.md` | 07:55; 10:23 | `marina_dev_app` authenticated on `marina_muse_dev`; only role `readWrite@marina_muse_dev`; unchanged by remediation | Logged |
| 8 | Test data preserved | `g1/remediation-20261115T1023Z.log` (products 3, users 1 before and after); every 13/13 log ("TEST fixtures (3/3)", "users: 1") | 10:23 onward | 3 test products and 1 user unchanged | Logged |
| — | Runtime isolation 8/8 | **Not G1 evidence.** You moved it to G2. Historical: `reports/evidence/phase2/runtime-isolation-isolated-20261110T1631Z.log` (10 Nov, older code). G2 runs: `g4local/runtime-isolation-20261115T1452Z.log`, `final/runtime-isolation-20261115T1456Z.log` (8/8) | 14:52; 14:56 | Server under test connected only to `127.0.0.1:27018` | Logged (G2) |

All G1 log paths are under `reports/evidence/phase2/`. No original log was recreated.

---

## 3. Git handover

| Item | Value | Evidence |
|---|---|---|
| Branch / HEAD | `main` at `8fe21634aae383a941e40a1955df3bac4c0a6279` (2026-11-13 16:27 +0530) | `reports/phase2/evidence-20261115/git-head-and-reflog.txt` |
| Remote | `## main...origin/main`, 0 ahead / 0 behind (last fetched reference; no fetch run) | same |
| Commits / pushes / resets / stashes | None since 13 Nov: reflog top entry is the 13 Nov commit; 0 stash entries | same |
| Working tree | 56 entries: 39 modified tracked files, 17 untracked paths | `evidence-20261115/git-status.txt` |
| Diff statistics | 39 files, 1,045 insertions, 292 deletions | `evidence-20261115/git-diffstat.txt` |
| Full tracked diff | 2,459 lines | `evidence-20261115/git-tracked-changes.diff` |
| Untracked files | 23 files, incl. new code, test scripts, reports, screenshots | `evidence-20261115/git-untracked-files.txt` |
| Checkout edit | One line in `CheckoutForm` (line 150): trailing spaces added after `{product.name} × {qty}`; **preserved unchanged** | `evidence-20261115/git-checkout-page.diff` |
| Deployments | None (no deployment tooling was run) | — |

**Note:** the evidence logs under `reports/evidence/phase2/{g1,g2,g3,g4local,final}/*.log` are git-ignored (`*.log`). They exist on disk but will not appear in a commit unless the ignore rule changes.

---

## 4. Secret scan

| Item | Detail |
|---|---|
| Method | Custom read-only pattern scanner `reports/phase2/evidence-20261115/secret-scan.mjs`; prints file, line and pattern name only. |
| Patterns | MongoDB URI with credentials, Google API key, `AQ.` key, Meta token, private-key block, long Bearer literal, `password=` assignment, live payment keys, Resend key, JWT, `ya29` token |
| Included | 115 files: all git-modified tracked files, all untracked non-ignored files, all evidence logs in `reports/evidence/phase2/g1, g2, g3, g4local, final` |
| Excluded | Binary screenshots (2); `tsconfig.tsbuildinfo` (generated cache); this audit's own output folder (the diff copy duplicates scanned files) |
| Not scanned | `.env.local` and other git-ignored env files (development values by design; inspected for names only), `node_modules/`, `.next/`, `.git/`, the rest of the unchanged repository, the backup folder. **The whole repository was not scanned.** |
| Findings | 3 matches, **all false positives**: `.env.example:7` and `scripts/gen-env-docs.ts:7` (pre-existing `USER:PASSWORD` placeholder); `scripts/check-whatsapp-direct.ts:43` (fake offline-test token). Real secrets: 0 |
| Results | `reports/phase2/evidence-20261115/secret-scan-results.txt` |
| Earlier evidence | Repository and disk scans of 9–10 Nov in `reports/evidence/security/` and `reports/MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md` (they found the exposed production credentials outside the project that still need rotation, G5) |

---

## 5. Local agent safety (observed during this audit, read-only)

| Check | Observation |
|---|---|
| Local app servers | **None running.** No process listens on ports 3000, 3919 or 3939 (`netstat`); `tasklist` shows no `node.exe` process |
| Agent or scheduler processes | **None running** (no `node.exe`; agents run inside the app server, which is not running). The dev scheduler (`scripts/dev-scheduler.mjs`) is not running |
| Docker | `marina-dev-mongo` and `lms` running since Docker Desktop started (not touched). Port 27018 bound to 127.0.0.1 |
| Chrome | 24 `chrome.exe` processes exist, almost certainly the user's normal browser. The headless review instance was stopped earlier; its debugging port 9333 is not listening |
| `AI_AGENTS_DISABLED` in `.env.local` | **Absent.** A local dev server would therefore run all four agents enabled |
| Production templates | `MARINA_MUSE_PRODUCTION_ENV_TEMPLATE_SANITIZED.env` and `reports/MARINA_MUSE_PRODUCTION_ENV_TEMPLATE.env` set `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp` |
| Isolated launcher | Blanks every integration credential; forces outbound WhatsApp and Vapi off, PayPal sandbox, no SMTP, direct mode; Meta-related runs need populated fingerprint lists |
| Code safeguards | Non-production send guard before any network call (`lib/whatsapp/mode.ts`); live number refused in `sendGate` and `postMessage`; outbound calls need `VAPI_OUTBOUND_ENABLED` + consent + main admin; owner mail refused outside production without `OWNER_ALERT_EMAILS`; customer order email not sent outside production |

**Are all four agents confirmed disabled?**
- **Production:** disabled by template, but the production server itself was never inspected.
- **Local:** not disabled by configuration (`.env.local` lacks the flag). They are inactive only because no server is running. All Phase 2 test servers ran through the isolated launcher with no provider credentials.

**Provider-call evidence.**
- The 15 Nov isolated-server logs contain only local API routes (summary in `reports/evidence/phase2/g2/isolated-server-20261115.log`, `final/isolated-server.log`, `final/isolated-server-ui.log`).
- No log in `g2/`, `g3/`, `g4local/` or `final/` names a provider host. The only matches for "SMTP" are test names and advisory titles.
- `/api/geo` was called during the UI review; `lib/geo.ts:11` returns early for loopback and private addresses, so no lookup to `api.country.is` or `ipapi.co` is expected.
- `npm audit` contacted the npm registry, as authorized for G2.
- **Limitation:** Next.js does not log outbound requests, so the absence of provider calls is inferred from blanked credentials, forced switches, code guards and fetch-spy tests, not from a network capture.
- Activity on 8–11 Nov is documented in those earlier reports and is outside this session.

---

## 6. Outstanding risk analysis

### A. Isolated-launcher build failure
- **Failure:** `final/build-via-launcher-20261115T1512Z.log` shows "Failed to compile. HookWebpackError: _webpack.WebpackError is not a constructor", from `minify-webpack-plugin`. That is a Next.js bug that hides the real minifier error.
- **Difference from the normal build:** both use Next.js 15.5.29 and `.env.local`. The launcher additionally defines about 79 integration variables as empty strings, including `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_GA4_MEASUREMENT_ID`. The normal build leaves them undefined. Removing the forced `NODE_ENV` did not help (tested and reverted earlier).
- **Likely cause (hypothesis, not verified in this read-only session):**
  - Next.js inlines every defined `NEXT_PUBLIC_*` variable at build time.
  - `lib/auth-url.ts:51` assigns `process.env.NEXT_PUBLIC_SITE_URL = base`.
  - With the variable defined as `""`, that line becomes the invalid `"" = base`, which the minifier cannot handle.
  - With the variable undefined, Next.js leaves it alone, which is why the normal build passes.
- **Recommended fix:** for builds, have the launcher delete `NEXT_PUBLIC_*` variables instead of blanking them. Alternatively, and more robustly, change `lib/auth-url.ts` to keep the resolved URL in a module variable instead of writing to `process.env`.
- **Validation:** build through the launcher; build normally; compare the rendered `<meta>`/canonical URL; run the four suites. Low priority: production builds never use the launcher.

### B. Dependency advisories (installed versions from `npm ls`, 15 Nov; details `reports/evidence/phase2/final/npm-audit-handover-20261115.json`)

| Package | Installed | Severity | Advisories (affected range) | Patched | Upgrade impact |
|---|---|---|---|---|---|
| `nodemailer` | 8.0.11 (direct; also under `@auth/core`) | High | GHSA-p6gq-j5cr-w38f (≤9.0.0), GHSA-8m3c-c648-2xjj (≤9.1.0), GHSA-wmmp-3585-3rmp, GHSA-2x7j-588g-ccc2, GHSA-cc9r-2j5m-2m83 (<9.1.0), GHSA-6vj9-mwq6-2f5v, GHSA-8vvx-rff5-p5rq (<10.0.2), GHSA-v53p-9fqp-m79j (≤10.0.5), GHSA-39m8-27wv-hr27, GHSA-4g23-2xm8-66gc (≤10.0.9), GHSA-4ffr-jq9g-5ffx, GHSA-g73g-hqqh-jr95 (≤10.0.12), GHSA-8c8m-p3m8-cjg8, GHSA-m943-m63m-w62w, GHSA-85x2-q946-cp5h (<10.1.4); overall ≤10.1.3 | 10.5.0 (major) | Mail transport API used by OTP, owner alerts, follow-ups and order confirmations |
| `@auth/core` | 0.41.3 (via `next-auth`) | High | via its `nodemailer` dependency | depends on an `@auth/core` release with a fixed `nodemailer` | Authentication core; not upgraded directly |
| `next-auth` | 5.0.0-beta.32 (direct) | High | via `@auth/core` (≥2.0.0-beta.0) | npm suggests 1.12.1, an obsolete line and **not a valid remedy** | Sign-in for customers, wholesale and admin |
| `postcss` (inside `next`) | 8.4.31 bundled; project copy 8.5.28 | High | GHSA-qx2v-qp2m-jg93 (<8.5.10), GHSA-6g55-p6wh-862q (≤8.5.11), GHSA-r28c-9q8g-f849 (≤8.5.17), GHSA-fxqj-rqcc-2cmp (≤8.5.22) | only via `next` 16.4.6 (major) | Build-time CSS processing |
| `next` | 15.5.29 (direct) | Moderate | via the bundled `postcss`; affected 9.3.4-canary.0 – 16.3.0-preview.10 | 16.4.6 (major) | Framework major: routing, build, runtime, React requirements |

**Recommended sequence, each step a separate decision on its own branch with the full test set:**
1. `nodemailer` to 10.x first. Small API surface: `lib/mail.ts` plus `@auth/core` compatibility. Highest relevance, because the site sends mail.
2. Track an `@auth/core`/`next-auth` v5 release that pins a fixed `nodemailer`. Do not follow npm's suggested 1.12.1.
3. `next` 16, which also clears the bundled `postcss`. Largest change; needs a full storefront, checkout, admin and agent regression.

**Exposure (assessment):** `postcss` issues need untrusted CSS at build time, and the site builds only its own CSS. The `nodemailer` issues need attacker-controlled message options or a malicious SMTP server; messages here are fixed-format and go to the configured server.

### C. Mobile admin navigation (outside Phase 2 scope)
- **Issue:** `components/AdminDashboard.tsx:145-147` sets the drawer open state once on mount (`window.innerWidth >= 1024`) and never on resize. A phone loading the page starts closed and works. If the viewport shrinks after load (tablet rotation, desktop window resize), the drawer stays open with its overlay, as in `final/ui-recovery-phone-mwhz2uw1.png`.
- **Smallest fix (separate approval):** a `matchMedia("(min-width: 1024px)")` listener that closes the drawer when the viewport drops below 1024 px. About 6 lines; test by resizing and rotating.

### D. Production index compatibility and duplicate orders
- **Indexes Phase 2 creates at runtime (best-effort):**
  - `ai_wa_messages`: `wa_inbound_wamid_once` (partial unique), `wa_reply_once` (partial unique), `wa_status_at`
  - `ai_wa_delivery_events`: `wa_delivery_event_once` (unique)
  - `wa_webhook_events`: `key` (unique, required)
  - `ai_job_leases`: `job_lease_name` (unique)
  - `orders`: `order_id_once` (unique)
- **Risk 1:** unique indexes fail to build if production already holds duplicates. Creation is caught and logged, so the app keeps running, but with weaker protection. The guarantee for the paid transition and the inbound/reply indexes then depends on application logic only.
- **Risk 2 (confirmed in code, pre-existing):** `newOrderId()` returns `MM-` + base-36 milliseconds (`lib/orders.ts:95-97`). Two checkouts in the same millisecond get the same id. `persistOrder` upserts by id, so the second silently overwrites the first. If `order_id_once` builds, it does not stop this, because the upsert matches rather than inserts.
- **Risk 3:** Razorpay verify reads orders from process memory only (`getOrder`, `app/api/razorpay/verify/route.ts:24`). Razorpay is excluded from Phase 2 and unchanged.
- **Recommendation:**
  1. Under G5, run a read-only duplicate inspection on production (the same aggregation as `g2/index-inspection-20261115T1240Z.log`, plus duplicates on `orders.id`).
  2. Decide per decision C.
  3. Create the indexes explicitly in a maintenance window with a backup.
  4. Separately approve a collision-safe order id (random suffix) before launch.
  Nothing was accessed or applied.

### E. Multiple PM2 instances
- **Shipped configuration:** both example PM2 configs use `instances: 1, exec_mode: "fork"` and warn against more (`ecosystem.config.example.cjs:6,19-20,40-41`).
- **Safe across instances (database-coordinated):**
  - WhatsApp event claims and reply reservations (unique indexes plus fenced claims)
  - Resend claims (atomic `findOneAndUpdate`)
  - Paid-order transition (conditional update)
  - Cron job lease (`ai_job_leases`)
- **Per-process only:**
  - Rate limits (`lib/ai/crm.ts`), Gemini cooldowns, the webhook done-cache
  - The in-memory order map; `getOrder` reads used by Razorpay and ShipGlobal booking dedup (`lib/shipglobal.ts:394-403`)
- **Effect:** with two instances, ShipGlobal in-flight dedup and memory reads could diverge. A double shipment booking is possible only if two paid finalisations ran on different instances, which the paid-transition guard now prevents. Rate limits would be per instance.
- **Recommendation:** keep a single instance. If scaling is needed:
  - move rate limits to MongoDB or Redis;
  - make ShipGlobal booking claim a database field (`shipment.bookingClaim`) atomically;
  - test with two local instances against the test database.
  No PM2 process was accessed.

---

## 7. Items not verifiable or not located
1. Written G2/G3 authorization text: not on file.
2. Backup creation output and the 09:31 dump-versus-live count comparison: narrative only.
3. G1 Run 1 pre-flight outputs: narrative only.
4. Production server configuration, including whether `AI_AGENTS_DISABLED` is actually set there: never inspected.
5. Absence of provider calls: inferred from configuration, guards and logs; no network capture exists.
6. Remote repository state beyond the last fetched reference.
7. The launcher build root cause: a hypothesis, not tested in this read-only session.

## 8. Decisions requested
1. Accept or reject G1.
2. Review G2/G3 and decide on formal authorization and acceptance.
3. Dependency remediation sequence (section 6B).
4. Separate approvals, if wanted: launcher build fix (6A); mobile drawer fix (6C); collision-safe order ids (6D).
5. Test credentials for G4.
6. G4-B and G5 approvals when ready.
7. Git commit approval.
