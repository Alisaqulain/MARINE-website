# Marina Muse International: Phase 2 Readiness Audit (Corrected)

**Prepared:** 16 November 2026, for Ahmad's review. Based only on existing documentation and evidence files, read without running anything. No test, build, script, Docker, database or provider operation was run for this audit.

**Status labels**

| Label | Meaning |
|---|---|
| IMPLEMENTED | Code is present in the working tree (uncommitted) |
| HISTORICALLY TESTED | A dated log exists, but on an earlier tree |
| VERIFIED ON AUDITED TREE | A log exists for the current working-tree content |
| PENDING | Awaiting a decision or work |
| NOT VERIFIED | No evidence |
| BLOCKED | Missing evidence or credentials |

---

## 1. Executive summary

- **G1:** previously authorized by Ahmad and reported completed on 15 Nov. Original logs back every technical criterion: root credential NOT USABLE, 13/13, same container. The written authorization text, backup-creation output and Run 1 pre-flight output are not on file. See `G1_COMPLETION_EVIDENCE_REGISTER.md`.
- **G2 and G3 await Ahmad's separate written decisions.** One correction to earlier reports must be stated plainly: **G2 verification and G3 code changes were already carried out locally on 15 Nov.** They were done on go-ahead statements relayed through Ali, and **no written G2/G3 authorization is on file**.
  - The G3 code exists as **uncommitted** changes in the working tree.
  - Ahmad's decision therefore covers whether to authorize, review, accept, re-run or revert that work.
  - It is not treated as authorized or accepted.
- **G4, G4-B and G5:** not authorized. G4 provider checks are also blocked on test credentials.
- **Production:** no deployment, provider call, message, agent activation, commit or push has occurred. All four agents must remain disabled.

## 2. Repository baseline (from records)

| Item | Value | Source |
|---|---|---|
| Branch / HEAD | `main` at `8fe21634aae383a941e40a1955df3bac4c0a6279` (13 Nov 2026 16:27 +0530) | `reports/phase2/evidence-20261115/git-head-and-reflog.txt`; `git log` (read-only) still shows `8fe2163` |
| Commits since baseline | None | Same |
| Working tree | All Phase 2 G3 and later work is **uncommitted**. The pre-existing one-line change in `app/checkout/page.tsx` is preserved | `git status` (read-only) |
| Audited tree | **Not a commit.** It is HEAD `8fe2163` plus uncommitted changes, so no test result can be tied to a commit hash other than the G2 baseline runs | — |

## 3. Corrected gate status

| Gate | Status |
|---|---|
| **G1** | **Previously authorized and reported completed** (15 Nov). Technical criteria verified by original logs; authorization text not on file |
| **G2** | **Awaiting Ahmad's separate written decision.** Verification runs were already performed on 15 Nov (relayed go-ahead only) |
| **G3** | **Awaiting Ahmad's separate written decision.** Code and offline tests were already performed on 15 Nov (relayed go-ahead only); uncommitted |
| **G4** | Not authorized. Local and mocked parts done; real provider checks blocked on credentials |
| **G4-B** | Not authorized |
| **G5** | Not authorized; each side effect needs its own approval |

## 4. G1 historical authorization and completion evidence

Summary (full detail in the register):

| Evidence | Time | File |
|---|---|---|
| Root credential USABLE | 07:45Z and 09:32Z | `g1/before-root-verify-…0745Z.log`, `g1/after-root-verify-…0932Z.log` |
| Remediation | 10:23Z | `g1/remediation-…1023Z.log`: exit 0, same container id, app user unchanged |
| Root credential NOT USABLE | 10:23Z | `g1/final-root-verify-…1023Z.log` |
| 13/13 | 07:46Z, 09:32Z, 10:23Z | the three `devdb-verify` logs |
| Backup manifest | 10:23Z | `final-backup-verify` log: 37 files verified |

**The historical records the request lists:**
- The 10 Nov USABLE log and the 11 Nov "Docker unavailable" log are pre-execution history.
- Later logs supersede them; they prove nothing about G1 completion.

## 5. G1 evidence gaps and limitations

- The written authorization text is missing.
- The script approval text is missing.
- Run 1 pre-flight outputs, backup-creation output and the count comparison are narrative only.
- No log records HEAD at execution time.
- Runtime 8/8 is not G1 evidence; it was moved to G2.
- The backup manifest is outside the repository.

## 6. Existing implementation status

| Work | Status | Evidence |
|---|---|---|
| WhatsApp direct-mode C1–C10 | IMPLEMENTED; HISTORICALLY TESTED (11 Nov) and VERIFIED ON AUDITED TREE (15 Nov suites) | `reports/evidence/phase2/c1-c10-changes-20261111T0714Z.diff`; `g2/check:whatsapp-direct-…1240Z.log` 114/114 |
| D, zero automatic WhatsApp retries | IMPLEMENTED (uncommitted, G3) | `g3/check:whatsapp-direct-…1306Z.log` 178/178 |
| F, fingerprints and fail-closed launcher | IMPLEMENTED (uncommitted). `config/whatsapp-production-fingerprints.json` holds **no real production hashes** (none supplied) | same; F1–F14 |
| E, recovery lifecycle, admin controls, cron lease | IMPLEMENTED (uncommitted) | `lib/whatsapp/recovery.ts`, `lib/ai/job-lease.ts`, `components/AdminWhatsAppRecovery.tsx`; `final/g3-local-tests-…1456Z.log` 19/19 |
| Production agent disablement (template) plus fail-closed agent switch | IMPLEMENTED (uncommitted) | `agent-safety/check:phase2-…1549Z.log` 274/274 |
| Commerce: PayPal single finalisation, authenticated DB lookup, SMTP confirmation | IMPLEMENTED (uncommitted) | `lib/orders.ts`, PayPal and order routes; checks in `check:phase2` |
| Made-to-order fulfilment | **Specification only**, not implemented | `reports/phase2/FINAL_MADE_TO_ORDER_FULFILMENT_IMPLEMENTATION_SPECIFICATION.md` |

## 7. WhatsApp C1–C10 status and D/E/F gaps

- **C1–C10:** implemented and tested offline. HTTP suites passed in isolation (`final/wa-isolation-…1456Z.log` 5/5; `final/webhook-tests-…1456Z.log`).
- **Never exercised against Meta:** no real Meta call has been made. G4 and G4-B are needed.
- **C11/C12:** excluded and untouched.

| Proposal | Gap |
|---|---|
| D | Verified only with a fetch spy and a local server with outbound forced off. Real send behaviour is NOT VERIFIED |
| E | Tested against the local MongoDB test DB and HTTP. Production index compatibility NOT VERIFIED (production DB never inspected) |
| F | The fingerprint lists are empty, so Meta-related isolated runs are refused by design. Real hashes are needed from the client (BLOCKED) |

## 8. Duplicate-send and retry risks

- **Committed code (`8fe2163`):** WhatsApp sends can still be retried automatically, which is the active duplicate risk D addresses. The committed code is what any deployment of HEAD would ship.
- **Uncommitted D:**
  - one attempt per send;
  - ambiguous results are recorded as `unknown` and never retried;
  - resend is manual only, with a claim token and 409 on a concurrent resend (E-H7).
- **Residual risks:**
  - D/E are not committed or deployed;
  - real Meta timeout and ambiguous-response behaviour is not verified;
  - multiple PM2 instances in production are not inspected (handover §6E);
  - `newOrderId()` same-millisecond collision (pre-existing, commerce).

## 9. Production agent-disablement risks

- Production templates set `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp`. In the uncommitted fail-closed switch, production also requires `AI_AGENTS_ENABLED` and `AI_AGENTS_PRODUCTION_APPROVED`.
- **The actual production server configuration has never been inspected**, so whether agents are disabled in production today is NOT VERIFIED.
- The committed HEAD has the older opt-out switch (empty means all on). Deploying HEAD without the env value would enable all four agents.
- `.env.local` lacks `AI_AGENTS_DISABLED`. This was safe only because no server runs; the new switch defaults to off.

## 10. Commerce outstanding issues

| Issue | Status |
|---|---|
| PayPal double finalisation, anonymous order lookup, confirmation privacy and `emailSent` | Fixed in uncommitted G3 code; real PayPal and SMTP NOT VERIFIED |
| `newOrderId()` same-millisecond collision | Open (pre-existing); needs separate approval |
| MOQ not enforced in retail checkout (e.g. compass, MOQ 50) | Open |
| Made-to-order delivery text generic or inconsistent | Specification awaiting Ahmad's product decisions |
| Razorpay routes | Untouched by decision |
| Dependency advisories | `g2/npm-audit-…1240Z.log` reported 8 (1 critical, 6 high, 1 moderate); the later handover lists 5 remaining after review. **Discrepancy disclosed**; the fixes are major upgrades and need a decision |
| Isolated-launcher build | Fails (`g2/build-…1240Z.log`, `final/build-via-launcher-…1512Z.log`); the standard build succeeds. Cause hypothesised at `lib/auth-url.ts:51`, not tested |

## 11. Existing test evidence, dates and commit limitations

| Run | Date (UTC) | Tree | Result |
|---|---|---|---|
| 8–11 Nov logs (`reports/evidence/`, `phase2/*2026111*`) | 8–11 Nov | Earlier trees | HISTORICAL ONLY |
| G2 baseline (`g2/`) | 15 Nov 12:40 | `8fe2163` plus earlier uncommitted C1–C10 work | tsc 0 errors; 251 / 102 / 114 passed; standard build OK; launcher build failed; audit 8; index conflicts 0 |
| G3 (`g3/`) | 15 Nov 13:06 | Working tree with D/E/F | 251 / 102 / 178 passed; build OK |
| Local HTTP (`final/`) | 15 Nov 14:56 | Same | runtime 8/8; routes 19/19; G3 local 19/19; WA isolation 5/5; webhook suites passed |
| After the handover changes (`final/…1512Z`) | 15 Nov 15:12 | Changed tree | 251 / 182 passed |
| Agent safety (`agent-safety/`) | 15 Nov 15:49 | **Latest tree** | 274 / 102 / 182 passed; build OK |

**Limitations:**
- No run is tied to a commit except as "HEAD plus uncommitted changes".
- Later documentation-only changes did not touch code; this is per the checksum checks made at the time, not re-verified now.
- Nothing was re-run for this audit.

## 12. G2 pending verification scope

Re-run or accept, per Ahmad's decision:
- TypeScript, `check:phase2`, `check:whatsapp`, `check:whatsapp-direct`, build, `npm audit`;
- read-only database index inspection;
- runtime 8/8, `check:routes`, HTTP suites.

All of these already have 15 Nov logs. See the task breakdown.

## 13. G3 pending implementation scope

D, agent disablement, F, E, the three commerce fixes, regression tests and documentation. The code exists uncommitted; Ahmad decides on review, acceptance and commit. The launcher build fix, order-id collision and dependency upgrades are **outside** the G3 scope unless approved.

## 14. G4 / G4-B / G5 dependencies

| Gate | Needs |
|---|---|
| G4 | Gemini test key; Google service account plus grants; Meta test app, test WABA, test number and token; fingerprint hashes; Vapi export; feed dates |
| G4-B | Endpoint host and time window |
| G5 | Rotation of the exposed production credentials; named commit; environment; window; separate approval per scheduler, per agent and per message |

## 15. Completion estimate (ESTIMATE ONLY)

The v1.1 plan totals **13.5–15.5 engineering days**: G1 0.5, G2 1, G3 8, G4 2–3, G4-B 0.5–1, G5 1.5–2.

| Measure | Estimate |
|---|---|
| Technically executed (G1 + G2 + G3 days) | 9.5 days, about 61–70 % |
| Formally authorized and completed | G1 only: 0.5 days, about 3–4 % |

**Discrepancy:** an earlier report ("Revision 4") stated "about 75 %". That figure counted local G4 work and did not separate authorization from execution; it is superseded here.

## 16. Recommendation and strict hold

1. Ahmad confirms the G1 record and supplies or attaches the written authorization text.
2. Ahmad decides separately on G2 and on G3, knowing that the work already exists uncommitted. Options:
   - authorize and accept the existing work;
   - authorize a fresh re-run or review;
   - instruct a revert, which itself needs explicit instruction.

**STRICT HOLD:** no further action of any kind is authorized. Existing work is preserved unchanged.
