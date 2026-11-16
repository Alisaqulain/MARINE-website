# Phase 2 Gate Acceptance Checklist

**15 November 2026.** Gate wording: v1.1 §10. Task detail: `PHASE2_REMAINING_IMPLEMENTATION_PLAN.md`. A box is ticked only with an evidence file.

## G1 — Local environment (AUTHORIZED, COMPLETE 15 Nov)
- [x] Docker running; `marina-dev-mongo` identity `b10ee2630808` confirmed (`evidence/phase2/g1/after-container-*.log`)
- [x] Backup of `marina_muse_dev` with app user, checksum and count verified (`C:\Users\ali\marina-dev-backups\marina_muse_dev-20261115T0931Z`)
- [x] `dev:db verify` 13/13 after Run 2
- [x] Test data preserved (3 products, 1 user)
- [x] Root credential `NOT USABLE` (`evidence/phase2/g1/final-root-verify-*.log`)
- [x] Re-run 13/13 after remediation
- [~] Runtime isolation 8/8 — moved to G2 by client decision

## G2 — Baseline and local verification (NOT AUTHORIZED)
- [ ] `npx tsc --noEmit` exit 0 on `8fe2163` (plus the uncommitted whitespace change, recorded)
- [ ] `npm run check:phase2` ≥ 251 pass, 0 fail
- [ ] `npm run check:whatsapp` ≥ 102 pass, 0 fail
- [ ] `npm run check:whatsapp-direct` ≥ 114 pass, 0 fail
- [ ] `npm run build` exit 0, static verify OK
- [ ] `npm audit` (npm registry only) report saved; high/critical listed
- [ ] Read-only index/duplicate inspection: counts for `wa_inbound_wamid_once`, `wa_reply_once` → decision C
- [ ] Isolated server on port 3939 via `scripts/isolated-env.mjs`; `isolation-proof.ps1` 8/8; only `127.0.0.1:27018` connection
- [ ] `webhook-tests.mjs`, `whatsapp-isolation-tests.mjs` (WA1 updated for direct mode), `check:routes` pass; synthetic fixtures removed
- **Failure handling:** any failure is logged, not retried silently; root cause recorded; no assertion weakened.

## G3 — Implementation (NOT AUTHORIZED)
- [ ] D1–D12 pass; one fetch per send; WhatsApp follow-ups terminal after one attempt
- [ ] Production template carries `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp`
- [ ] F1–F14 pass; launcher fails closed on missing/invalid/empty required lists; §5.3 Gemini-only exception
- [ ] E1–E20 pass; no exit from `expired`/`resolved`/`resent`; reconciliation audited
- [ ] Commerce: single finalisation, authenticated DB-backed order lookup, SMTP confirmation; tests pass
- [ ] Razorpay untouched; no PayPal Sandbox work
- [ ] Full offline regression; counts not reduced; diff secret scan clean; local commits on `phase2-def`, no push

## G4 — Isolated verification (NOT AUTHORIZED; credentials missing)
- [ ] Local HTTP + real-Mongo: claims, indexes, lease, restart, concurrency
- [ ] Gemini 22/22 executed (≤ 56 requests, stop on 429), ledger saved
- [ ] GA4 `runReport`, GSC query read-only
- [ ] Meta test-app GETs (4 operations), 0 sends, fingerprints populated
- [ ] Vapi export compared offline

## G4-B — HTTPS endpoint (NOT AUTHORIZED)
- [ ] Only two webhook routes exposed; other paths 404
- [ ] Signed Meta test-app and Vapi deliveries verified
- [ ] Teardown verified

## G5 — Production (NOT AUTHORIZED)
- [ ] Rotation schedule executed by client; verified without printing values
- [ ] Env validated: 112 registry names, `META_APP_ID`, `WHATSAPP_INTEGRATION_MODE=direct`, `AI_AGENTS_DISABLED=chat,voice,growth,whatsapp`, WhatsApp switches false, `VAPI_OUTBOUND_ENABLED=false`
- [ ] Backup taken; named commit deployed; smoke tests; rollback tested
- [ ] Monitoring: `/test` dashboard, `ai_jobs`, `ai_usage`, webhook error logs reviewed
- [ ] Each side effect (scheduler, each agent, any message) separately approved and recorded
- [ ] Client acceptance signed

---
## Status update — 15 November 2026 (final run, evidence in `reports/evidence/phase2/final/`)
- **G2: COMPLETE (local).** tsc 0; 251/251; 102/102; 114/114 baseline and 178/178 after G3; build 74/74; npm audit reviewed and the non-breaking fixes applied; index inspection 0 conflicts; runtime isolation 8/8; check:routes 19/19; webhook suite 25/25; admin-session isolation 5/5 (WA1/WA2, W8 and two route checks updated to the approved direct-mode behaviour, decision J).
- **G3: COMPLETE (code + offline + local HTTP/MongoDB).** D/E/F, cron lease, commerce 1–3, agent-disable templates, docs; D1–D12, E1–E22, F1–F16, K1–K6 offline; 19/19 local HTTP + real-MongoDB tests. Not done: visual browser check of the recovery UI.
- **G4:** local part (T4.1) done; provider parts BLOCKED — CREDENTIALS. **G4-B, G5:** BLOCKED — AUTHORIZATION.
