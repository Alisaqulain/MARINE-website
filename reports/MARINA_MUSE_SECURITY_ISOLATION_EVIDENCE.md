# Marina Muse: development security isolation evidence

> **Update, 10 November 2026:** see section "10 November 2026: full verification" at the end, and `MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md`.
>
> The disk-wide fingerprint sweep found the production MongoDB credentials in **several places outside the project** that the 9 November checks did not cover:
> - another project's `.env.local`;
> - VS Code and Cursor local history of Marina's `.env.local`;
> - Cursor's agent data;
> - a ChatGPT cache entry.
>
> The statement below that the production password is "not fully out of reach until both [backups] are removed" understated the exposure: removing the backups did not remove these copies. **Rotation is required.**

9 November 2026, 12:40–13:05 UTC. Development environment only. **The production database was not connected to, queried or modified.** No production configuration was changed, nothing was deployed, and no secret appears in this document or in the evidence logs.

## Result

| # | Task | Status | Evidence |
|---|---|---|---|
| 1 | Replace the sample development admin password | **Completed** | Runtime check: new password signs in, published sample refused |
| 2 | Remove PayPal LIVE credentials; sandbox only | **Completed** (checkout safely disabled) | Configuration scan; runtime check: checkout answers 503, no order created |
| 2a | PayPal sandbox credentials | **Pending client action** | Not available, so checkout stays disabled locally |
| 3 | Disconnect development from the production database | **Completed** for configuration and code | Configuration scan: no Atlas string in development configuration |
| 3a | Two dev servers started before this sprint still hold production connections | **Pending your action** | See "Open item" below |
| 4 | Separate test database with test data only | **Completed** | `dev-db verify` 13/13 |
| 5 | No fallback to production (connection paths, jobs, cron, routes) | **Completed** | Code inspection + guard + self-tests |
| 6 | Development reads and writes only the test database | **Completed** | `runtime-isolation-check` 8/8 |

## What changed

**`.env.local`** (development only; previous file backed up outside the repository with owner-only access):
- `MONGODB_URI` now targets `mongodb://<app user>:<redacted>@127.0.0.1:27018/marina_muse_dev`; `MONGODB_DB_NAME=marina_muse_dev`.
- `ADMIN_PASSWORD`: a new 28-character random password (upper, lower, digit, symbol). It was generated and written by script and never printed.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `PAYPAL_WEBHOOK_ID` (all live) removed; `PAYPAL_MODE=sandbox`.
- `VAPI_PHONE_NUMBER_ID` and `VAPI_SIP_CREDENTIAL_ID`: placeholder text cleared to empty.

**Test database:** MongoDB 7.0 in Docker (container `marina-dev-mongo`, volume `marina-dev-mongo-data`).
- Bound to 127.0.0.1 only, with authentication on.
- The app user has `readWrite` on `marina_muse_dev` and nothing else.
- *Correction (17:33 UTC):* this document first said the root password was discarded. It was never printed or saved to a file, but Docker keeps it in the container's configuration (`MONGO_INITDB_ROOT_PASSWORD`), so anyone with Docker access on this PC can read it. It grants access to the local test container only, not production.
- Contents:
  - an isolation marker;
  - 3 synthetic products named "TEST ONLY …";
  - documents created by the tests themselves (1 local admin user, job-run records, AI usage records).
- No production customer, order or enquiry data was copied.

**Code (local, not deployed):**

| File | Change |
|---|---|
| `lib/env-mongo-uri.ts`, `lib/mongodb.ts` | Outside production, the app refuses any database host that is not on this machine (or listed in `MONGODB_DEV_ALLOWED_HOSTS`). The error never repeats the URI. Production (`NODE_ENV=production`) is unaffected |
| `lib/atlas-connect.ts` | Bug fix: on Windows with Node 24, a standard `mongodb://` URI was never tried (only SRV-derived Atlas shards). It is now tried as given. Production on Linux is unaffected |
| `scripts/test-mongo.mjs` | The hard-coded production shard hosts are only used with credentials for that same cluster, never another one |
| `lib/paypal.ts` | Prepared guard applied: `PAYPAL_MODE=live` is refused outside production |
| `lib/shipglobal.ts` | Label booking is refused outside production, so a sandbox test order can't book a real, billable shipment |
| `lib/google/analytics.ts`, `components/GoogleAnalytics.tsx` | Development sends purchase events only to GA4's debug endpoint (not recorded) and doesn't load the browser tag unless `NEXT_PUBLIC_GA4_IN_DEVELOPMENT=1` |
| `lib/mail.ts`, `lib/ai/daily-report.ts` | Development never emails the owner list; owner mail needs an explicit `OWNER_ALERT_EMAILS` test recipient. A refused send is rejected before any AI request |
| `scripts/dev-db.mjs` (`npm run dev:db`), `scripts/dev-scheduler.mjs` (`npm run dev:scheduler`) | Reproducible test-database setup, seed and verify; localhost-only scheduler |
| `lib/ai/env-registry.ts`, `.env.example`, `docs/phase2/ENVIRONMENT_SETUP.md` | 4 new opt-in development variables documented (106 total) |
| `lib/ai/selftest.ts` | 7 new guard checks (251 total) |

## Connection paths inspected

- **Every database access** goes through `getDb()` → `getClientPromise()` → `connectClient()` → `normalizedSrvFromEnv()`, where the guard runs.
  - No other `new MongoClient` exists in `app/` or `lib/`.
  - Nothing uses mongoose.
- **Background jobs:**
  - There are no in-process schedulers: no `setInterval` on the server, and no node-cron.
  - The follow-up job (`/api/ai/jobs`) and the daily report (`/api/ai/report/daily`) use `getDb()`.
- **API routes:**
  - Server code never calls the production site's own API.
  - In development the site origin resolves to `localhost` (`lib/auth-url.ts`). The production URL appears only in page metadata.
- **Scripts:**
  - `check-mongo-env.mjs` and `test-mongo.mjs` read the URI from the env file, which is now local.
  - `test-mongo.mjs` no longer pairs other credentials with the production shard hosts.
- **Operating system:** no user- or machine-level `MONGODB_*` or `PAYPAL_*` variables.
- **Env files:** only `.env.local` exists. There is no `.env`, `.env.development` or `.env.development.local`.

## Tests performed

| Test | Kind | Result | Evidence (`reports/evidence/security/`) |
|---|---|---|---|
| Test database: local host, not Atlas, marker present, write/read/delete probe, no other database writable, only the test database visible, port bound to 127.0.0.1, guard refuses SRV and remote hosts, allows local | real, local database | **13/13 PASS** | `dev-db-verify-20261109.log` |
| Running app reads the TEST products, writes a page-view probe to the test database, checkout 503 with no order, new admin password works, sample refused, admin user created in the test database, server holds connections only to 127.0.0.1:27018 | real, local server (port 3919) | **8/8 PASS** | `runtime-isolation-20261109.log` |
| Development configuration scan (counts only) | static | **PASS**: 0 Atlas strings, 0 PayPal credentials, 0 sample passwords in `.env.local`. The 3 code matches are synthetic test strings | `dev-config-scan-20261109.log` |
| Guard unit checks | pure | **7/7 PASS** (part of 251) | `check-phase2-20261109-final.log` |
| Secret scan of reports, docs, code and logs against 22 live and removed secret values | static | **PASS**: no new secret anywhere. See the note on the scratchpad backups | `secret-scan-20261109-final.log` |

## Closed item: two dev servers started before this sprint held production connections

At 13:05 UTC, two `next dev` processes started before the change still held their cached connections to the production cluster:

| PID | Command | Started |
|---|---|---|
| 3548 | `next dev --turbopack` (the `npm run dev` server on port 3000) | 8 Nov 23:04 |
| 18668 | `next dev -p 3918` (an earlier verification server) | 9 Nov 14:58 local time |

Both have since exited. This session didn't stop them: its permission settings refused to. Re-verification is below.

## Re-verification, 9 November 2026, 17:19–17:24 UTC

All checks are read-only. No database connection to production was made; the production cluster was looked up in DNS only. Logs are in `reports/evidence/security/`.

**1. The old processes have exited.** `Get-Process` and `Win32_Process` both report PID 3548 and PID 18668 as not present. The only `next` processes for this project are the isolated server on port 3919 (PIDs 18224, 22536 and 23668, started 18:22 local time, after the change). Log: `prod-connection-check-20261109.log`.

**2. No connection to the production database remains, from any process.** This is not based on port 27017 alone:
- **Production addresses.** The production cluster named in the pre-isolation `.env.local` is `cluster0.1za3pdr.mongodb.net`. Its SRV record resolves to 3 shards: 159.41.188.88, .99 and .111. The cluster hard-coded in `scripts/test-mongo.mjs` (`a9zxbuj`) adds 3 more addresses. All 6 were compared.
- **Every TCP connection on the machine** (186 entries, every state, every process) was compared against those 6 addresses on any port.
  - Connections to a production address: **0**.
  - Connections to remote port 27017 on any host: **0**.
  - Connections owned by PID 3548 or 18668: **0**.
- **This project's processes:**
  - The dev server (PID 23668) has exactly one kind of database connection: `127.0.0.1:27018`, the test container.
  - Its parent processes hold no connections.
- Log: `prod-connection-check-20261109.log`. Script: `prod-connection-check.ps1`.

**3. Development and its test processes can reach only the test database.**

| Check | Result | Log |
|---|---|---|
| Test database: local only, marker present, write/read/delete probe, products are TEST fixtures, no other database writable or visible, port bound to 127.0.0.1, guard refuses SRV and remote URIs | **13/13 PASS** | `dev-db-verify-20261109-recheck.log` |
| Running app (port 3919): reads and writes the test database, checkout 503 with no order, new admin password, server's only database connection is 127.0.0.1:27018 | **8/8 PASS** | `runtime-isolation-20261109-recheck.log` |
| Production URI, password, user name and cluster host searched, by value, in `.env.example` and `.env.local` | **0 found** | `prod-credential-scan-20261109.log` |
| Same values in this shell's environment and in the persistent user and machine environment; no `MONGO*` or `DATABASE_URL` variables at all | **0 found** | same |
| Same values in 588 project files (excluding `node_modules`, `.git`, `.next`) | **No credential.** Only the cluster host name, in this check's own script and log, and the `a9zxbuj` host names in `scripts/test-mongo.mjs` (no credentials) | same |
| Same values in 915 files of the `.next` build and dev cache | **0 found** | same |
| Git history (all branches) for the production URI, password and user name; is `.env.local` tracked | **0 commits; not tracked** | same |

**Production credentials still on this machine (not loaded by the app, but readable by the Windows user account):**

| File | Contents | Action |
|---|---|---|
| `C:\Users\ali\.marina-env-backup\env.local.pre-isolation-20261109` | Full pre-isolation `.env.local` (owner-only access) | Move into a password manager, then delete |
| `…\Temp\claude\…\a847478c-…\scratchpad\env.local.backup-2026-11-08` | **A second full copy**, made by an earlier work session on 8 November. Found by this scan | Delete (or store it as above) |

The app never reads either file; Next.js loads only `.env*` files in the project root. But any process running as this Windows user could read them, so the production password is not fully out of reach until both are removed. Rotating the production database user's password would close this completely. That is the client's decision.

**Finding: another local project shares the test database's port.** Three `next start` servers from a different project on this machine (CareerPath AI; PIDs 6316, 19152 and 21008 on ports 3300, 3100 and 3400, started 8 November) hold connections to `127.0.0.1:27018`. Their configuration names database `careerpath` and has **no credentials**. An unauthenticated client was tested against the container: `listDatabases`, reading `marina_muse_dev`, and reading or writing `careerpath` were all **refused (Unauthorized)**; only `ping` answers. So these processes can't see or change Marina test data, and they aren't production. Log: `unauthenticated-access-check-20261109.log`. Recommendation: give CareerPath its own port, since it can't work against this container anyway.

## Remaining dependencies

- PayPal sandbox credentials (client), if local checkout is needed.
- **Production** admin password: unknown; changing it needs separate approval.
- Rotating the production database user's password is recommended if the development copy of `.env.local` was ever shared. That is the client's decision.
- Delete the `.env.local` backup once it is stored in a password manager.
- Delete two full-configuration backups of the Marina assistant, which contain the current webhook secret, after the secret rotation. They sit in the session's temporary scratchpad, outside the repository.
- Docker Desktop must be running for the test database (`npm run dev:db -- start` after a reboot).

---

## 10 November 2026: full verification

Full detail: `MARINA_MUSE_PHASE2_SECURITY_VERIFICATION_REPORT.md`. Read-only throughout:
- no production access, no rotation, no deployment;
- no CareerPath AI change;
- no Gemini request.

### 1. The 9 November disk sweep was interrupted
- At 18:54:45 UTC the PC was powered off from the Start menu (Windows Event 1074).
- That killed workers A1, A2, A3 and B before they wrote any result.
- The interrupted scope was re-run in full with a journaled, resumable scanner (v2, 28/28 controls). D: and `C:\ProgramData` were added.

### 2. Matches outside the project (production MongoDB fingerprints)

| Location | Content |
|---|---|
| `E:\jobwebsiteansariroad\Job-Career-Pao\.env.local` (written 4 Nov) | Full URI and password. A copy of Marina's environment file (57 of 59 variable names match Marina's `.env.example`) in an unrelated project. No evidence that the project ran with it. Left untouched |
| VS Code local history of Marina `.env.local` (17 snapshots, 24 Oct–9 Nov) | Full URI and password |
| Cursor local history of the same file (4 snapshots, 25–27 Oct) | Full URI and password |
| Cursor `state.vscdb` and an agent transcript (25 Oct) | Full URI and password. The values were sent to Cursor's AI service |
| Chrome cache for chatgpt.com (since evicted) | Password and user name |
| Claude Code transcripts | The user name only, which is also the database name |

### 3. The project itself is clean
Marina's own folder (`.env.local`, `.next`, `node_modules`, git history) holds **no** production credential.

### 4. Deleted backups re-checked
Both backup files are absent, and so is any other `env.local*` copy in the profile. This is not forensic erasure.

### 5. Runtime, 07:28 UTC
- Marina development processes: 0 of 3 production fingerprints in their environment; database host `127.0.0.1:27018`.
- Whole machine: 0 TCP connections to the 6 production addresses.
- **13/13 and 8/8 not re-run: NOT VERIFIED today.** Docker Desktop is stopped, and starting it could restart CareerPath AI containers.

### 6. Development fixes
- `check:mongo` no longer prints the database user name, and refuses remote hosts on a development machine.
- `dev-db` message corrected about the root password.
- Security headers added in `next.config.ts`.
- Regression: tsc, 251/251, 98/98, 19/19, build exit 0.

### 7. Correction to the 9 November "Remaining dependencies"
Deleting the backups is no longer enough.
- **Rotate the production MongoDB password and every other secret** that was in the pre-isolation `.env.local`.
- Then clean the copies listed above.
