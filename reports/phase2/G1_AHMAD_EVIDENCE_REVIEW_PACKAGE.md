# G1 Evidence Review Package — for Ahmad

**Prepared 15 November 2026 from the original execution logs, copied verbatim by script (no retyping, no edits).** Original logs are unchanged. A secret scan of every included log found no passwords, keys, tokens or full connection strings; the only URI form present is `mongodb://<user>:<redacted>@127.0.0.1:27018/marina_muse_dev`, already redacted by the tool that wrote it. **This package is not acceptance; G1 acceptance is Ahmad's decision.**

Legend: **VERIFIED** = shown by a log or by a fresh read-only check while preparing this package · **REPORTED** = stated in the execution report, not independently provable from a log.

## 1. Executive summary
| Item | Result | Basis |
|---|---|---|
| Container identity unchanged | `b10ee2630808…7031` before and after; 0 restarts | VERIFIED |
| Root credential before → after | USABLE (07:45 and 09:32 UTC) → NOT USABLE (AuthenticationFailed) (10:23 UTC) | VERIFIED |
| `dev:db verify` | 13/13 at 07:46, 09:32 and 10:23 UTC | VERIFIED |
| Backup | 37-file SHA-256 manifest verified at 10:23 UTC and again while preparing this package | VERIFIED |
| Test data | 3 test products, 1 user, before and after remediation | VERIFIED |
| Runtime isolation 8/8 | **NOT YET VERIFIED for 15 Nov.** Only historical 10 Nov evidence exists (Section 7) | — |
| Scope protection | See Section 10 | Mixed |

## 2. Master G1 completion status
The master report records G1 as COMPLETE (15 Nov 10:23 UTC), with the runtime 8/8 check moved to G2 by an earlier client decision. That decision now conflicts with this review request (Section 12).

## 3. Gate acceptance checklist (G1 extract, verbatim)
## G1 — Local environment (AUTHORIZED, COMPLETE 15 Nov)
- [x] Docker running; `marina-dev-mongo` identity `b10ee2630808` confirmed (`evidence/phase2/g1/after-container-*.log`)
- [x] Backup of `marina_muse_dev` with app user, checksum and count verified (`C:\Users\ali\marina-dev-backups\marina_muse_dev-20261115T0931Z`)
- [x] `dev:db verify` 13/13 after Run 2
- [x] Test data preserved (3 products, 1 user)
- [x] Root credential `NOT USABLE` (`evidence/phase2/g1/final-root-verify-*.log`)
- [x] Re-run 13/13 after remediation
- [~] Runtime isolation 8/8 — moved to G2 by client decision


## 4. Container identity evidence

**`reports/evidence/phase2/g1/after-container-20261115T0932Z.log`** (sha256 `e7e5c076c37d84d3…`)
```
id=b10ee26308087be0452721aee773c6ab1dfc7bbb276891bc5bd134aea60c7031 image=mongo:7.0 running=true started=2026-11-15T07:45:29.3232334Z
```

Before/after lines from the remediation log (10:23 UTC):
```
container before: b10ee26308087be0452721aee773c6ab1dfc7bbb276891bc5bd134aea60c7031
container after: b10ee26308087be0452721aee773c6ab1dfc7bbb276891bc5bd134aea60c7031
```

Fresh read-only check while preparing this package:
```
marina-dev-mongo id=b10ee26308087be0452721aee773c6ab1dfc7bbb276891bc5bd134aea60c7031 started=2026-11-15T07:45:29.3232334Z restarts=0
```
**Match: yes.** The container was never restarted after Docker Desktop started it.

## 5. Root credential verification (before and after)

**`reports/evidence/phase2/g1/before-root-verify-20261115T0745Z.log`** (sha256 `5b9f0f3c66635c5e…`)
```
Stored root credential check, 2026-11-15T07:45:47Z, container marina-dev-mongo
stored root credential: USABLE  <-- remediation NOT effective
unauthenticated listDatabases:
  refused (Unauthorized)
```

**`reports/evidence/phase2/g1/after-root-verify-20261115T0932Z.log`** (sha256 `3ebb33730b68c224…`)
```
Stored root credential check, 2026-11-15T09:32:41Z, container marina-dev-mongo
stored root credential: USABLE  <-- remediation NOT effective
unauthenticated listDatabases:
  refused (Unauthorized)
```

**`reports/evidence/phase2/g1/remediation-20261115T1023Z.log`** (sha256 `97a5bd2479b49317…`)
```
container before: b10ee26308087be0452721aee773c6ab1dfc7bbb276891bc5bd134aea60c7031
app before: {"users":[{"user":"marina_dev_app","db":"marina_muse_dev"}],"roles":[{"role":"readWrite","db":"marina_muse_dev"}],"products":3,"users_coll":1}
devroot password replaced (fresh value generated in-container and discarded)
Stored root credential check, 2026-11-15T10:23:17Z, container marina-dev-mongo
stored root credential: NOT USABLE (AuthenticationFailed)
unauthenticated listDatabases:
  refused (Unauthorized)
exit=0
container after: b10ee26308087be0452721aee773c6ab1dfc7bbb276891bc5bd134aea60c7031
app after: {"users":[{"user":"marina_dev_app","db":"marina_muse_dev"}],"roles":[{"role":"readWrite","db":"marina_muse_dev"}],"products":3,"users_coll":1}
```

**`reports/evidence/phase2/g1/final-root-verify-20261115T1023Z.log`** (sha256 `e391aff2128a5286…`)
```
Stored root credential check, 2026-11-15T10:23:25Z, container marina-dev-mongo
stored root credential: NOT USABLE (AuthenticationFailed)
unauthenticated listDatabases:
  refused (Unauthorized)
```

## 6. Database verification (13/13)
The post-remediation run in full:

**`reports/evidence/phase2/g1/final-devdb-verify-20261115T1023Z.log`** (sha256 `e2521683af43dcbb…`)
```
Target: mongodb://<user>:<redacted>@127.0.0.1:27018/marina_muse_dev  uri-fp b96b2a672c
PASS  URI uses a local host only  (127.0.0.1)
PASS  URI is not an Atlas/SRV string
PASS  MONGODB_URI_STANDARD is not set
PASS  MONGODB_DB_NAME is the test database  (marina_muse_dev)
PASS  Isolation marker present (connected DB is the test DB)
PASS  Write, read back and delete a probe document
PASS  Products collection holds only TEST fixtures  (3/3)
      orders: 0 documents
      users: 1 documents
      ai_leads: 0 documents
      contact_messages: 0 documents
      wholesale_applications: 0 documents
PASS  App user cannot write to any other database
PASS  App user can see only the test database (least privilege)  (marina_muse_dev)
PASS  Container port bound to 127.0.0.1 only  (127.0.0.1:27018)
PASS  Guard refuses an Atlas SRV URI in development
PASS  Guard refuses a remote standard URI in development
PASS  Guard allows the local test URI

RESULT: ISOLATED (13/13 checks passed)
```

Also on file, both 13/13: `before-devdb-verify-20261115T0746Z.log`, `after-devdb-verify-20261115T0932Z.log`. The check "App user cannot write to any other database" is the expected refusal of the `_probe` insert, explained in `G1_MONGODB_AUTH_DIAGNOSTIC.md`.

## 7. Runtime isolation (8/8)
**15 November 2026: NOT YET VERIFIED.** No run exists for today or for commit `8fe2163`; the isolated app server on port 3939 has not been started, per the earlier client decision deferring this check to G2.

Historical evidence only (10 Nov 2026, earlier code tree, before commit `8fe2163`). It shows the check works but does not prove the current tree and is not counted as G1 evidence:

**`reports/evidence/phase2/runtime-isolation-isolated-20261110T1631Z.log`** (sha256 `7d75bfe40f8cdd44…`)
```
[isolated-env] running "node reports/evidence/security/runtime-isolation-check.mjs http://localhost:3939" with 75 integration variables blanked; fresh credentials: none
(node:13360) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, as the arguments are not escaped, only concatenated.
(Use `node --trace-deprecation ...` to show where the warning was created)
PASS  Running app reads products from the test database  (3 TEST fixtures in /api/catalog/products)
PASS  Running app writes to the test database  (page_views probe documents: 1)
PASS  PayPal checkout refused without creating an order  (HTTP 503)
PASS  No order created in the test database  (0 orders)
PASS  Admin sign-in works with the new password  (session cookie issued)
PASS  Published sample password is refused
PASS  Admin user record was written to the test database  (1 user(s))
PASS  Server under test has no connection to a remote MongoDB  (pid 20184; db connections: 127.0.0.1:27018)

RESULT: RUNTIME ISOLATED (8/8)
```

## 8. Backup verification
Location: `C:\Users\ali\marina-dev-backups\marina_muse_dev-20261115T0931Z\` (local, outside the repository). Created 09:31 UTC with `mongodump` as `marina_dev_app`; 18 collections; dump document counts matched live counts at creation (recorded in Run 2 of `G1_EXECUTION_EVIDENCE.md`). No restore performed.

**`reports/evidence/phase2/g1/final-backup-verify-20261115T1023Z.log`** (sha256 `f178fdce7718b66e…`)
```
backup manifest verified: 37 files
```

Fresh re-check while preparing this package:
```
backup manifest verified: 37 files (2026-11-15T10:54:07Z)
```

## 9. Test data preservation
From the remediation log (app user, before and after):
```
app before: {"users":[{"user":"marina_dev_app","db":"marina_muse_dev"}],"roles":[{"role":"readWrite","db":"marina_muse_dev"}],"products":3,"users_coll":1}
app after: {"users":[{"user":"marina_dev_app","db":"marina_muse_dev"}],"roles":[{"role":"readWrite","db":"marina_muse_dev"}],"products":3,"users_coll":1}
```
From `final-devdb-verify-20261115T1023Z.log`: "Products collection holds only TEST fixtures (3/3)" and "users: 1 documents".

App identity and privileges (diagnostic, 07:55 UTC):

**`reports/evidence/phase2/g1/mongodb-auth-diagnostic/app-identity-and-ops-20261115T0755Z.log`** (sha256 `8307a637f662d006…`)
```
env source: .env.local (via @next/env, dev mode)
username: marina_dev_app | host: 127.0.0.1:27018 | URI path db: marina_muse_dev | authSource: marina_muse_dev | MONGODB_DB_NAME: marina_muse_dev | MONGODB_URI_STANDARD set: false
authenticatedUsers: [{"user":"marina_dev_app","db":"marina_muse_dev"}]
roles: [{"role":"readWrite","db":"marina_muse_dev"}]
privileges (find/insert/update/remove/createCollection) by db: {"marina_muse_dev":["createCollection","find","insert","remove","update"]}
read: products count = 3 | isolation marker present = true
write on marina_muse_dev : insert ok, readback true , deleted 1 , gone true
```

## 10. Scope protection
| Statement | Basis | Evidence |
|---|---|---|
| No production database accessed or modified | VERIFIED | Every DB log targets `127.0.0.1:27018/marina_muse_dev`; MongoDB log client origins over the last 4 hours are only `127.0.0.1` (174) and `172.17.0.1` (42, the Docker bridge carrying the host's local port mapping); the dev guard refuses remote URIs (13/13) |
| No production credentials used | REPORTED, structurally supported | Only `.env.local` (local test DB) was loaded; no production environment file exists in the repository |
| No external provider, Meta or WhatsApp operation | REPORTED | No app server, isolated launcher or provider script was run; no log shows a network-facing command |
| All four agents remain disabled | REPORTED, with a caveat | No production change and no app server ran, so no agent executed. Caveat: `.env.local` has no `AI_AGENTS_DISABLED` value, so a local dev server would start with agents enabled; production disablement is a G3/G5 configuration item |
| Live WhatsApp number untouched | REPORTED | No WhatsApp code path executed |
| `lms` untouched | VERIFIED (state) | `lms` started 07:45:29Z with 0 restarts, by its own restart policy when Docker Desktop started; no command targeted it |
| No unauthorized application or database resources modified | VERIFIED (repository) / REPORTED (database) | `git status`: only the pre-existing `app/checkout/page.tsx` change plus new report files; HEAD `8fe2163`. Database writes: the authorized `devroot` password change, the self-deleting `dev:db verify` probe, one self-deleting diagnostic document |

## 11. Evidence log index
All paths relative to `reports/evidence/phase2/`.

| File | UTC | Content |
|---|---|---|
| `g1/before-root-verify-20261115T0745Z.log` | 07:45 | Root USABLE (before) |
| `g1/before-devdb-verify-20261115T0746Z.log` | 07:46 | 13/13 |
| `g1/mongodb-auth-diagnostic/app-identity-and-ops-20261115T0755Z.log` | 07:55 | App identity, privileges, read/write |
| `g1/after-container-20261115T0932Z.log` | 09:32 | Container id |
| `g1/after-root-verify-20261115T0932Z.log` | 09:32 | Root USABLE (after backup, before remediation) |
| `g1/after-devdb-verify-20261115T0932Z.log` | 09:32 | 13/13 |
| `g1/remediation-20261115T1023Z.log` | 10:23 | Before/after id, app user, remediation, embedded verify |
| `g1/final-root-verify-20261115T1023Z.log` | 10:23 | Root NOT USABLE |
| `g1/final-devdb-verify-20261115T1023Z.log` | 10:23 | 13/13 |
| `g1/final-backup-verify-20261115T1023Z.log` | 10:23 | Manifest, 37 files |
| `runtime-isolation-isolated-20261110T1631Z.log` | 10 Nov | Historical 8/8 only |

Narrative reports: `reports/phase2/G1_EXECUTION_EVIDENCE.md` (Runs 1–3), `G1_MONGODB_AUTH_DIAGNOSTIC.md`, `MASTER_PHASE2_COMPLETION_REPORT.md`.

## 12. Outstanding items requiring Ahmad's decision
1. **Runtime isolation 8/8: authorization conflict.** It was deferred to G2 by your earlier decision; this review asks for its output. Choose one:
   - (a) Keep it in G2 and decide on G1 using the evidence above.
   - (b) Authorize it now as a G1 addendum with this sentence: "I authorize starting the isolated app server on port 3939 via scripts/isolated-env.mjs against the local test database only, running reports/evidence/security/runtime-isolation-check.mjs and reports/evidence/phase2/isolation-proof.ps1, and stopping the server afterwards. No provider, Meta, WhatsApp or production access."
2. **G1 acceptance** on the evidence in Sections 4 to 10.
3. **G2 authorization**, as a separate sentence.
