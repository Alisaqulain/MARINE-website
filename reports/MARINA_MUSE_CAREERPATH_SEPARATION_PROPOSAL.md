# Proposal: separate CareerPath AI from the Marina Muse test database

**Status: proposal only. Nothing in this document has been carried out.** No CareerPath AI process, container, database or configuration was stopped, restarted, changed or migrated. The Marina Muse development environment was also left as it is. Each step below needs separate written approval.

Prepared 10 November 2026 from read-only inspection: files, process list, TCP table, and the 9 November evidence logs.

**Status, 10 November 2026, 07:35 UTC: PROPOSED, not approved, not started.**
- **Nothing is running.** No CareerPath AI process is running, and Docker Desktop is stopped. The PC was powered off on 9 November at 18:54 UTC, and nothing has been restarted since.
- **Docker was deliberately not started.** `marina-dev-mongo` has restart policy `unless-stopped`, and any CareerPath containers may have the same. Starting Docker could therefore restart CareerPath workloads, which is not authorized.
- **What cannot be confirmed:** whether CareerPath has containers of its own, what their restart policies are, and whether a `careerpath` database exists in Marina's container. These need Docker running, so they are open questions for step 1 (baseline) and step 3 (existing data).
- **No CareerPath file was changed.** Its `.env.local` was read for variable names and the database host and port only.
- **Fingerprint sweep:** CareerPath's folder (`E:\mca sem1 grp projecct\code`) is covered by worker A2. Result: **0 matches**. All 33,240 files in `code\` (571 MB, 0 unreadable) and the folder's documents were scanned at 09:18–09:22 UTC. CareerPath holds no copy of Marina's production credentials.

## 1. Current situation

### Marina Muse (development and test)

| Item | Value |
|---|---|
| Project | `E:\marina e-comm (2)\marina e-comm` |
| Test database | Docker container `marina-dev-mongo`, image MongoDB 7.0 |
| Port | `127.0.0.1:27018` on the host, mapped to 27017 in the container. Bound to loopback only |
| Volume | `marina-dev-mongo-data` |
| Restart policy | `unless-stopped`: starts automatically whenever Docker Desktop starts |
| Authentication | On. Root user `devroot`. App user with `readWrite` on `marina_muse_dev` only |
| Database | `marina_muse_dev` |
| Configuration | `.env.local`, `MONGODB_URI=mongodb://<app user>:<redacted>@127.0.0.1:27018/marina_muse_dev?authSource=marina_muse_dev&directConnection=true` |
| Code guard | Outside production, `lib/mongodb.ts` refuses any database host that is not local |

### CareerPath AI

| Item | Value |
|---|---|
| Project | `E:\mca sem1 grp projecct\code` (`careerpath-ai`, Next.js 16, Mongoose 8) |
| Configuration | `.env.local`, `MONGODB_URI=mongodb://127.0.0.1:27018/careerpath`, with **no credentials** |
| Variables (names only) | `MONGODB_URI`, `SESSION_SECRET`, `AI_API_KEY`, `AI_ENABLED` |
| Designed for | MongoDB Atlas (see its README). The local port 27018 is a local substitution |
| Processes seen 9 Nov | 3 × `next start`: PIDs 6316, 19152, 21008 on ports 3300, 3100, 3400, started 8 Nov. Each held connections to `127.0.0.1:27018` |
| Processes seen 10 Nov 05:48 UTC | **None.** The PC was powered off on 9 Nov at 18:54 UTC, which ended them. Docker Desktop is also not running |

### The overlap

CareerPath AI's connection string points at the same port as Marina's test container. Because that container requires authentication and CareerPath sends none, the 9 November test (`reports/evidence/security/unauthenticated-access-check-20261109.log`) showed:
- `listDatabases` refused;
- reading `marina_muse_dev` refused;
- reading or writing `careerpath` refused;
- only `ping` answers.

**Consequences:**
- **No data crosses between the projects today.** CareerPath AI cannot read or change Marina test data.
- **CareerPath AI cannot work against this container.** Every query it makes is refused.
- **The risk is future misconfiguration.** The obvious "fix" for CareerPath would be to give it Marina's credentials, or to create a CareerPath user inside Marina's container. Either would mix the two projects' data and credentials in one container, under one root password.
- **Marina's code guard can't tell the projects apart.** It only checks that the host is local, so a CareerPath database on this PC would pass it.

## 2. Recommended target

| Item | CareerPath AI (new) | Marina Muse (unchanged) |
|---|---|---|
| Container | `careerpath-dev-mongo` | `marina-dev-mongo` |
| Image | `mongo:7.0` (same pinned major version) | `mongo:7.0` |
| Host port | `127.0.0.1:27019` (loopback only; confirm free first) | `127.0.0.1:27018` |
| Volume | `careerpath-dev-mongo-data` | `marina-dev-mongo-data` |
| Label | `purpose=careerpath-dev-db` | `purpose=marina-muse-dev-test-db` |
| Database | `careerpath` | `marina_muse_dev` |
| Root user | `cproot`, its own random password | `devroot` |
| App user | `careerpath_app`, `readWrite` on `careerpath` only | existing app user, `readWrite` on `marina_muse_dev` only |
| Restart policy | `unless-stopped` (or `no`, if CareerPath should only run on demand) | unchanged |

**Credential rules:**
- Passwords are generated by script, never printed, never reused between the projects, and stored only in each project's `.env.local` and a password manager.
- To avoid repeating Marina's Docker disclosure (see the security report, section 12), pass the root password with `MONGO_INITDB_ROOT_PASSWORD_FILE`. Use a temporary file that is deleted after the first start, so it never sits in the container's environment.

### Environment-variable separation

| Project | File | Variable |
|---|---|---|
| CareerPath AI | `E:\mca sem1 grp projecct\code\.env.local` | `MONGODB_URI=mongodb://careerpath_app:<generated>@127.0.0.1:27019/careerpath?authSource=careerpath&directConnection=true` |
| Marina Muse | `.env.local` | no change |
| Both | Windows user and machine environment | no `MONGODB_*` variables (confirmed absent 9 Nov) |

**Optional Marina hardening (separate approval):**
- Add the expected port (27018) and database name to Marina's development guard.
- Have `dev-db verify` assert the isolation marker.
- Then a local database belonging to another project is refused, not just a remote one.

## 3. Migration steps (on approval)

1. **Baseline:** record `docker ps -a`, `docker volume ls`, listening ports and the CareerPath and Marina process lists, and confirm port 27019 is free.
2. **Back up configuration:** copy CareerPath's `.env.local` to a backup outside the repository (owner-only access).
3. **Existing CareerPath data:**
   - Because unauthenticated writes were refused, the `careerpath` database in Marina's container is expected to be empty or absent.
   - Confirm this read-only with the local root user (`listDatabases`, count per collection).
   - If any data exists, export it with `mongodump --db careerpath` into a backup folder.
4. **Create the new container** as described in section 2, with authentication and the root password passed by file. Then delete the temporary file.
5. **Create** `careerpath_app` with `readWrite` on `careerpath` only.
6. **Load data:**
   - restore the dump from step 3, or
   - run CareerPath's `npm run seed`. Seed empties the CareerPath collections first, so run it only against the new database.
7. **Switch CareerPath AI:**
   - The owner stops the CareerPath servers.
   - Update its `.env.local` to the new URI.
   - Start the servers again.
8. **Clean-up (optional, separate confirmation):** drop any `careerpath` database left in Marina's container.
9. **Marina Muse:** no change at any step.

## 4. Rollback

1. Stop the CareerPath servers.
2. Restore the `.env.local` backup from step 2 (back to `127.0.0.1:27018`, no credentials).
3. Start the CareerPath servers.
4. Stop `careerpath-dev-mongo` (`docker stop`). Keep its volume until the owner confirms it can be deleted.
5. Marina Muse needs no rollback, because nothing in it changes.

## 5. Post-migration verification

| Check | Expected |
|---|---|
| CareerPath server PIDs: TCP connections | only to `127.0.0.1:27019` |
| Marina dev server PIDs: TCP connections | only to `127.0.0.1:27018` |
| `careerpath_app` credentials against 27018 | authentication refused |
| Marina app credentials against 27019 | authentication refused |
| Unauthenticated `listDatabases` on 27018 and 27019 | refused on both |
| Docker port bindings | both `127.0.0.1` only |
| `docker inspect careerpath-dev-mongo` | no root password in `Config.Env` |
| Marina `npm run dev:db -- verify` | 13/13 PASS |
| Marina `runtime-isolation-check.mjs` | 8/8 PASS |
| CareerPath `npm test` and a login smoke test | pass |
| Production MongoDB endpoints (all 6 addresses) | 0 connections from any process |

Evidence would be saved under `reports/evidence/security/careerpath-separation-<date>.log`, with no secret values.
