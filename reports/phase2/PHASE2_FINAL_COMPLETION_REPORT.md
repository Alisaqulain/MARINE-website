# Marina Muse International: Phase 2 Final Completion Report

**Date:** 16 November 2026
**Baseline:** `PHASE2_FINAL_CONSOLIDATED_DECISION_AND_EXECUTION_PLAN_v1.1.md`
**Evidence:** `reports/evidence/phase2/final2/*-20261116T0544Z.log`, run in the local isolated environment only

## 1. Authorization matrix

| Gate | Authorization | Status |
|---|---|---|
| G1 | Written (earlier) | Complete (15 Nov) |
| G2, G3, dependency update | **Verbal**, from Ahmad by phone to Ali, 16 Nov ("permission for the whole project"). **No written text on file** | Executed locally, 16 Nov |
| G4: real provider checks | Covered by the same verbal permission | **BLOCKED.** No test credentials exist (Gemini test key, Google service account, Meta test app/WABA/number/token, fingerprint hashes, Vapi export) |
| G4-B: temporary HTTPS endpoint | Same | **BLOCKED.** No host or time window |
| G5: production | Same | **NOT EXECUTED.** No production server access, no secret rotation, no deployment window. Section 12 is the checklist |
| Agent activation, messages, calls, push | Not requested; separate approval needed in any case | Not done. All four agents remain disabled |

## 2. Initial repository state

| Item | Value |
|---|---|
| Branch / HEAD | `main` / `8fe21634aae383a941e40a1955df3bac4c0a6279` |
| Working tree | 47 modified tracked files and 38 untracked files (G3 work from 15 Nov, the 15 Nov `npm audit fix`, reports) |
| Preserved user change | `app/checkout/page.tsx` (one line, trailing spaces), left unchanged |

Records: `final2/git-head-*.txt`, `final2/git-status-before-*.txt`.

## 3. G2 evidence assessment

- Historical logs from 15 Nov are not tied to a commit hash, because no log recorded HEAD.
- **All G2 checks were therefore re-run on 16 Nov on the current tree** (section 7). The 15 Nov results are superseded.

## 4. G3 implementation summary

The work below was implemented on 15 Nov and reviewed and re-verified on 16 Nov. The v1.1 task IDs are mapped in `PHASE2_IMPLEMENTATION_TASK_BREAKDOWN_CORRECTED.md`.

**D: delivery safety**
- One send attempt only.
- Results classified as delivered, failed or `unknown`. `reached:false` alone is classified as `unknown`, not as failed.
- WhatsApp follow-ups are terminal; only email retries.

**E: recovery**
- Two clocks: original inbound time and recovery expiry.
- Pending → stale sweep that writes labels only.
- Token-fenced resend claims.
- Insert-only delivery evidence.
- Admin expand, resolve, resend and reconcile actions: main admin only, with origin check, rate limit, acknowledgement and audit log.
- Cron lease.
- No automatic release or resend.

**F: fingerprints**
- SHA-256 fingerprints.
- The launcher and runtime fail closed for Meta-related runs.
- The Gemini-only exception from §5.3 is kept.
- The config file is structurally valid but its lists are empty, because no client hashes have been supplied.

**Agent safety**
- Fail-closed switch: in production, agents need both `AI_AGENTS_ENABLED` and `AI_AGENTS_PRODUCTION_APPROVED`.
- Production templates set `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp`.

**Commerce**
- `markPaidOnce()`: a single PayPal finalisation.
- Session-authenticated, database-backed order list and tracking.
- SMTP confirmation without logging the email body; `emailSent` is set only on success.

**New on 16 Nov**
1. **Launcher build fixed** in `scripts/isolated-env.mjs`. Diagnosis by experiment, with all logs in `final2/diag-*`:
   - an empty `NEXT_PUBLIC_SITE_URL` alone breaks `next build` with the minifier error;
   - `NODE_ENV=development` alone breaks prerendering;
   - both are needed to explain the failure, which is why the single fixes tried on 15 Nov failed.
   - **Fix, launcher only:** empty `NEXT_PUBLIC_*` variables are unset rather than blank, and `NODE_ENV` is left to Next.js for build commands only. Every other forced switch and blanked credential is unchanged.
   - The `lib/auth-url.ts:51` hypothesis was tested twice (bracket access, alias), **disproved**, and both edits were reverted.
2. **Three test expectations updated** for the fail-closed switch: V6 in `webhook-tests.mjs`, E-H5 and E-H7 in `g3-local-tests.mjs`.
   - With agents off, the endpoints correctly refuse (409, or the voice "unavailable" reply).
   - The tests now assert that refusal: nothing sent, no claim, no evidence row.
   - The original enabled-agent branches are kept.

## 5. Dependency update

- **Kept** the `npm audit fix` of 15 Nov 14:56Z. It was non-breaking, and `package.json` is unchanged.
- **Changes:**
  - `next` / `@next/*` 15.5.25 → 15.5.29
  - `sharp` / `@img/sharp-*` 0.35.4 → 0.35.5
  - `@img/sharp-libvips-*` 1.3.3 → 1.3.4
  - `postcss-selector-parser` 6.1.4 → 6.1.6
  - `source-map-js` 1.2.1 → 1.2.2
  - `semver` 7.8.5 → 7.8.6
  - `cssesc` removed
- **Resolved:**
  - `next` critical: GHSA-4jqv-mc3x-m676, -mcj8-r9mp-w47p, -2464-fhr4-w9xw, -p3m5-59mp-jv5r
  - `sharp` GHSA-wq5f-xc86-pv6w
  - `source-map-js` GHSA-68fv-2mgg-jv7q
  - `postcss-selector-parser` GHSA-rj75-hqrm-r3gf
- **Remaining: 5 findings (4 high, 1 moderate)** in `nodemailer`, `@auth/core`, `next-auth`, `postcss` (bundled in `next`) and `next`. All need major upgrades, which were **not applied**: they carry breaking-change risk and need their own decision.
- Verified compatible: all tests and both builds pass on 15.5.29 (section 7). The before-versions are backed up in the session scratchpad.

## 6. Files changed on 16 Nov

- `scripts/isolated-env.mjs`: launcher build fix
- `reports/evidence/phase2/webhook-tests.mjs`: V6 agent-off branch
- `reports/evidence/phase2/g3-local-tests.mjs`: E-H5/E-H7 agent-off branch
- `reports/phase2/PHASE2_FINAL_COMPLETION_REPORT.md`: this report
- `reports/evidence/phase2/final2/`: logs

`lib/auth-url.ts` was edited and reverted twice; it is unchanged.

## 7. Test results (16 Nov 2026, from 05:44Z)

**Tree tested:** HEAD `8fe2163` plus the uncommitted working tree. There is no commit; see section 13.

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | PASS (0 errors), before and after the fix |
| Phase 2 suite | `npm run check:phase2` | PASS 274/274 |
| WhatsApp suite | `npm run check:whatsapp` | PASS 102/102 |
| D1–D12, E1–E20, F1–F14, C1–C10 | `npm run check:whatsapp-direct` | PASS 182/182 |
| Standard build | `npm run build` | PASS, before and after the fix |
| Launcher build | `node scripts/isolated-env.mjs -- npm run build` | Before: FAIL. **After the fix: PASS** (74 pages, static check OK) |
| Runtime isolation | `runtime-isolation-check.mjs` via the launcher | PASS 8/8 |
| Database isolation | `npm run dev:db -- verify` | PASS 13/13, before and after cleanup |
| Routes | `BASE_URL=… check-routes.mjs` | PASS 19/19. The first attempt hit port 3000 because of a wrong argument form; it was re-run |
| Webhook suite | `webhook-tests.mjs` | First run 24/25 (V6, agent off); **after the expectation update 25/25** |
| WhatsApp isolation | `whatsapp-isolation-tests.mjs` | PASS 5/5 |
| G3 local HTTP and MongoDB | `g3-local-tests.mjs` | First run 17/19 (E-H5, E-H7, agent off); **after the update 19/19** |
| Root credential | `docker-root-verify.sh` | NOT USABLE (as required) |
| Secret scan of the new logs | pattern grep | No matches |

## 8. Provider verification

**None performed.** No Gemini, Google, Meta, Vapi or SMTP call was made, and no message, email or call was sent. These checks are blocked on test credentials.

## 9. Production deployment

**Not performed.** There is no production access or deployment window, and the secret rotation is still pending.

## 10. Outstanding blockers

1. Written confirmation from Ahmad of the 16 Nov verbal permission.
2. G4 test credentials, and the fingerprint hashes needed for Meta runs.
3. G4-B endpoint host and time window.
4. G5:
   - client rotation of the exposed production secrets;
   - a named commit;
   - server access;
   - a deployment window;
   - inspection of the production environment (agents disabled, indexes).
5. Five dependency advisories that need major upgrades.
6. Pre-existing and out of scope:
   - `newOrderId()` same-millisecond collision;
   - mobile admin drawer;
   - MOQ not enforced at checkout;
   - made-to-order decisions.

## 11. Security and safety

- All four agents remain disabled. No agent, scheduler, message, call or payment was activated.
- The live WhatsApp number was untouched.
- Only the local test database was used, and synthetic data was cleaned up.
- No credentials were printed.
- No commit or push was made, and no deployment.

## 12. Rollback and the G5 checklist

**Rollback of the 16 Nov changes:** restore `scripts/isolated-env.mjs`, `webhook-tests.mjs` and `g3-local-tests.mjs` from the diff; this affects tests only. The dependency fix can be rolled back from the lockfile backup.

**G5 checklist, when approved:**
1. The client rotates secrets.
2. Validate the production environment names. Required values:
   - `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp`;
   - empty `AI_AGENTS_ENABLED` and `AI_AGENTS_PRODUCTION_APPROVED`;
   - `WHATSAPP_OUTBOUND_ENABLED=false`;
   - `VAPI_OUTBOUND_ENABLED=false`.
3. Back up the production database.
4. Deploy the named commit.
5. Smoke-test the home page, product, checkout, admin login, `/api/catalog/products` and the order lookup (401 when anonymous).
6. Run a rollback test.
7. Separately approve each scheduler, agent and message.

## 13. Remaining work (estimate)

v1.1 total: 13.5–15.5 days. **Done and verified locally:** G1 + G2 + G3 = 9.5 days, about 61–70%.

**Remaining:**
- G4: 2–3 days (credentials);
- G4-B: 0.5–1 day;
- G5: 1.5–2 days (access);
- a local commit of this work, when approved (a few minutes).
