# WhatsApp Direct Cloud API: Isolated Test Results

**Date:** 11 November 2026 (UTC 04:01–04:03)
**Scope:** Stage **T1 only** (offline) of `WHATSAPP_ISOLATED_TEST_PLAN.md`. This report records what was executed. Code-inspection findings are in the separate Audit report.

**This is not evidence of a working integration with Meta.**
- No Meta app, WABA, phone number or token (test or production) was used.
- No Graph API call was made. No webhook was received from Meta.
- No message was sent.

## Execution conditions

| Condition | Value |
|---|---|
| Launcher | `node scripts/isolated-env.mjs -- …` |
| Integration variables | **75 blanked**. Fresh credentials supplied: **none** (launcher output) |
| Forced switches | `WHATSAPP_OUTBOUND_ENABLED=false`, `WHATSAPP_COEXISTENCE_ENABLED=false`, `WHATSAPP_PRODUCTION_ONBOARDING_APPROVED=false`, `MARINA_ISOLATED_TEST=1`, `NODE_ENV=development` |
| Secrets | Synthetic per session (launcher). The probe also deletes all `WHATSAPP_*` / `META_*` from its own process and uses literal synthetic strings |
| Network | None used by these tests. Network functions were not invoked; unit tests use mocked `fetch` |
| Database | None. The Docker test DB was **down** (port 27018 refused, Docker engine not running) and was **not started** by this session |
| `.env.local` | Not opened |
| Code changes | None. The probe script lives in `reports/evidence/phase2/` (a test artefact, not application code) |

## Results

| ID | Suite | Result | Log |
|---|---|---|---|
| T1.1 | `npm run check:whatsapp` | **102 passed, 0 failed** | `reports/evidence/phase2/check-whatsapp-direct-audit-20261111T0401Z.log` |
| T1.2 | `npm run check:phase2` | **251 passed, 0 failed**. Agent 4 (WhatsApp) section: 13/13. Provider WhatsApp signature checks: 3/3 | `reports/evidence/phase2/check-phase2-direct-audit-20261111T0401Z.log` |
| T1.3 | Direct-API in-process probe | 19 checks: **14 expected-pass**, **3 gaps confirmed**, **2 informational** | `reports/evidence/phase2/whatsapp-direct-api-probe-20261111T0405Z.log`, script `whatsapp-direct-api-probe.mts` |

The log file timestamps follow the launch minute. The probe ran at 04:02:26Z.

### T1.3 detail

| ID | Check | Observed | Outcome |
|---|---|---|---|
| P1 | Handshake, correct token | `{ok:true, challenge:"42"}` | Pass |
| P2 | Handshake, wrong token | 403 | Pass |
| P3 | Handshake, token not configured | 503 | Pass |
| P4 | Signature valid | accepted | Pass |
| P5 | Signature with wrong secret | 401 | Pass |
| P6 | Signature header missing | 401 | Pass |
| P7 | App secret unset | 503 | Pass |
| P8 | Non-ASCII body, valid signature | accepted | Pass (raw-bytes hardening still recommended, Audit §4) |
| P9 | Same wamid delivered twice | first `draft`, second `duplicate` | Pass (in-memory layer only; the DB layer was not exercised) |
| **P10** | Signed event for a **foreign** phone_number_id | `action=draft` | **Gap F2**: not filtered |
| P11 | Delivery status parsed | `wamid.s1 delivered` | Pass |
| P12 | Non-WhatsApp object | 0 events | Pass |
| P13 | Credentials from env only (no signup state) | `source=env`, IDs present | Pass: direct credentials are read |
| **P14** | Send gate: direct creds + `WHATSAPP_OUTBOUND_ENABLED` only | refused | **Gap F1**: coexistence flag required |
| **P15** | Send gate: test mode, direct creds, no stored display number | refused | **Gap F1**: depends on the Coexistence verify step |
| P16 | Send gate: test mode with business number = test number | allowed (gate decision only; **nothing sent**) | Informational |
| P17 | Send gate: recipient = live business number | refused | Pass |
| P18 | `metaAppIds()` outside isolated mode | production app/config IDs returned | Informational → **F3** |
| P19 | `metaAppIds()` in isolated mode | empty | Pass |

## Earlier evidence (not re-run today)

| Evidence | Result | Why not re-run |
|---|---|---|
| `webhook-tests-20261110T1633Z.log` (WhatsApp W1–W8 over HTTP on localhost) | 8/8 pass on 10 Nov | Needs the local Docker test DB, which is down. This session did not start Docker |
| `whatsapp-isolation-tests-20261110T1638Z.log` (WA1–WA4 with admin session) | 5/5 pass on 10 Nov | Same reason |

## Not tested: blocked or not authorized

| Stage | Status | Reason |
|---|---|---|
| T1 extensions for direct mode (new truth tables, foreign-event filtering) | Not possible | Need the proposed changes C1–C4, C6, C9, C10 (awaiting approval) |
| T2 local HTTP suite + D1–D10 | **Blocked** | Docker test DB down. D-tests also need the approved changes |
| T3 read-only Graph checks | **Blocked** | No separate Meta test app or credentials. Launcher cannot accept them yet (C10). Needs approval |
| T4 real Meta webhook delivery | **Blocked** | Public HTTPS endpoint not approved. Docker remediation precondition |
| T5 outbound messages | **Not authorized** | Excluded by instruction |

## Conclusion

- **Offline:** all existing WhatsApp unit checks pass (102 + 251).
- **Security mechanics:** webhook GET verification and POST signature verification behave correctly in-process.
- **Gaps:** the probe confirmed three that block or weaken a direct Cloud API integration (P10, P14, P15).
- **Not verified:** the direct integration with Meta has **not** been tested or verified.
