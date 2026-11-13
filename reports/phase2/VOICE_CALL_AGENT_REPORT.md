# Agent 2: Voice & Call (Vapi) — isolated development and test report

**10 November 2026, 16:40 UTC.** Scope: isolated development and testing only.

**Not done:**
- No call was placed and no phone number was connected.
- No assistant was published or modified.
- No Vapi API request was sent, no credits were bought, and nothing was activated.
- The old (exposed) Vapi credentials were **not** used. They are blanked in the isolated environment.

Evidence paths are relative to `reports/evidence/`.

## Summary

| | Status |
|---|---|
| Development | **Complete.** Webhook (Vapi messages, Exotel callbacks, generic HMAC), constant-time authentication, tool calls (`lookup_product`, `record_enquiry`), call records, missed-call alerts, assistant configuration builder and checker |
| Isolated configuration | **Complete.** Fresh synthetic webhook secret per test session; `VAPI_OUTBOUND_ENABLED=false` forced; Vapi API key blank until a fresh one is supplied |
| Isolated tests | **13/13 PASS:** authentication, signature validation, webhook processing with records in the test database, error handling |
| Vapi API checks with a fresh key | **BLOCKED.** No fresh `VAPI_API_KEY` supplied |
| End-to-end voice calling | **NOT TESTED, and not authorized.** No claim is made that calling works |
| Completion (verifiable) | Development 100%. **Isolated webhook testing 100% (13/13).** Vapi-side verification 0% (blocked). Live calls: out of scope |
| Production readiness | **Not ready.** Webhook secret rotation, assistant approval, phone number and live-call testing all need separate approval |

## 1. Tests executed (isolated server, port 3939, local test database)

Evidence:
- `phase2/webhook-tests-20261110T1633Z.log` (final run);
- earlier runs `…T1629Z.log` and `…T1632Z.log`, explained in the master report, section 4.

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| V1 | No credentials | 401 | 401 | PASS |
| V2 | Wrong Bearer secret | 401 | 401 | PASS |
| V3 | Wrong legacy `X-Vapi-Secret` | 401 | 401 | PASS |
| V4 | Correct secret minus one character | 401 | 401 | PASS |
| V5 | Correct secret, malformed JSON | 400 | 400 | PASS |
| V6 | Correct secret, `lookup_product` tool call | 200 with the tool result | 200; result for `tc1` names the Decorative Brass Anchor | PASS |
| V7 | Correct legacy header, `status-update` | 200 | 200 (status messages are not stored, by design) | PASS |
| V8 | Correct secret, `end-of-call-report` | 200 and a stored call record | 200; `ai_calls` record with `endedReason=customer-ended-call` | PASS |
| V9 | GET without provider | 405 | 405 | PASS |
| X1 | Exotel callback, wrong token | 401 | 401 | PASS |
| X2 | Exotel callback, no token | 401 | 401 | PASS |
| X3 | Exotel callback, correct token | 200 and a stored call record | 200; `ai_calls` record `exotel_<CallSid>` | PASS |
| G1 | Generic HMAC voice event, no `VOICE_WEBHOOK_SECRET` configured | 503 refused | 503 | PASS |

**Also verified:**
- **No response contains the secret or a stack trace.** This is part of every check.
- **Route refusals 19/19**, including "Vapi webhook rejects unsigned requests" and "rejects a wrong secret" (`phase2/check-routes-isolated-*.log`).
- **Mocked Vapi and Exotel checks:** 31 + 7 + 4 + 4, within 251/251.
- **Synthetic records removed.** Records created by these tests were deleted from the test database afterwards (`phase2/cleanup-synthetic-test-data-*.log`).

**Logging and error handling.** Call outcomes are stored in `ai_calls`. Handler errors return a generic 503 ("Voice event could not be processed.") and log only the error message (`app/api/ai/voice/webhook/route.ts`).

## 2. Assistant configuration requirements (from `lib/ai/vapi.ts`)

| Setting | Required value |
|---|---|
| First message | "Hello, thank you for calling Marina Muse International. How can I help you today?" |
| Voice | Vapi's own voice `Emma` (`provider: "vapi"`): no separate voice-provider key |
| Model | `provider: "google"`, model `VAPI_MODEL` or the configured Gemini model |
| Tools | `lookup_product` and `record_enquiry`. The configuration checker reports any missing tool |
| Server (webhook) | `https://<site>/api/ai/voice/webhook`, sending the server secret as `Authorization: Bearer …` (or the legacy `X-Vapi-Secret`). It must equal `VAPI_WEBHOOK_SECRET` |
| Outbound | Off (`VAPI_OUTBOUND_ENABLED=false`). Outbound needs the flag, API key, assistant and phone number together (`lib/ai/vapi.ts:44`) |

**Vapi cannot reach `localhost`.** A real Vapi-to-webhook test needs a public HTTPS test endpoint, which means a separate approval. Every webhook behaviour above was tested by sending the exact Vapi message format to the local server.

## 3. Required to continue (not requested until now; verified against the code)

| Variable | Purpose | Needed for | Who |
|---|---|---|---|
| `VAPI_API_KEY` (fresh private key) | Read-only checks of the test assistant's configuration (`GET /assistant/{id}`, used by `lib/ai/integrations.ts`). **No publishing and no calls** | Isolated Vapi-side verification | Client |
| `VAPI_ASSISTANT_ID` (optional) | An assistant created for testing. Without it, only key validity can be checked | Configuration comparison | Client |
| Fresh production `VAPI_WEBHOOK_SECRET` | The current one is exposed. A rotation guide exists | Production only (not this scope) | Client |

## 4. Remaining risks

- No real Vapi-to-server delivery has been tested (it needs a public endpoint).
- No real call has been tested; that needs live-call authorization.
- The production webhook answered 401 on 8 Nov and needs the rotated secret deployed.
- The old Vapi API key and webhook secret are exposed and must be rotated before production.

---

## Update: 10 Nov 2026, 17:15 UTC

**Vapi permissions established from the official docs: a private key cannot be restricted to read-only.** It has full organization access.

- The key was **not requested**.
- See `VAPI_PERMISSION_ASSESSMENT.md`: scope, limits, storage and revocation plan, plus the recommended no-key alternative (dashboard export).
- Live calls remain unauthorized.
- Real Vapi webhook delivery is blocked by the HTTPS step, which is blocked by Docker remediation.
