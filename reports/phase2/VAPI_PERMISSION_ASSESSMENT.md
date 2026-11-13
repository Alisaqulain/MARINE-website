# Vapi API key: permission assessment

**10 November 2026.** Sources: Vapi's official documentation, read on 10 Nov (URLs below).

**Not done:**
- No Vapi key was requested or used.
- No Vapi request was made.

## Conclusion: a fresh private key CANNOT be restricted to read-only

**Therefore the key is NOT requested.** This needs your decision first.

| Question | Answer (documented) | Source |
|---|---|---|
| Key types | **Private** (server REST API) and **public** (client Web SDK) | https://docs.vapi.ai/security-and-privacy/api-keys.md |
| Can a private key be restricted (read-only, endpoints, assistants, expiry)? | **No.** "A private key can access everything in your organization." "Only public keys support allowed origins and allowed assistants." | api-keys page |
| Private JWT instead? | Short-lived (`exp` ≤ 1 hour), but works "with the same endpoints as a private API key". **Not restricted** | https://docs.vapi.ai/customization/jwt-authentication.md |
| Can a public key read `GET /assistant/{id}`? | **Not confirmed.** That endpoint is documented for private keys only; public keys are documented for starting Web SDK calls | https://docs.vapi.ai/api-reference/assistants/get.md |
| Public-key restrictions | Allowed origins, allowed assistant ids, transient-assistant toggle. **A public key can START web calls** (billable minutes), so it is unsuitable for read-only verification | api-keys page |
| Billing | Dashboard only, Admin role. No billing API found | https://docs.vapi.ai/billing/manage-organizations-and-capacity.md |
| Read-only alternative | Dashboard RBAC **Viewer** role ("read-only access to everything except Org Settings, Billing, Members, and API Keys"). Documented on the SSO page, which is an Enterprise/Premier feature; availability on other plans **not confirmed**. Roles do not authenticate REST calls | https://docs.vapi.ai/security-and-privacy/sso.md |
| Revocation | "Delete it if it is exposed" (Dashboard → API Keys). **Whether deletion is immediate is not documented** | api-keys page |

**Not confirmed by the documentation:**
- per-endpoint permission details (phone numbers, outbound calls);
- revocation timing.

Treat a private key as able to do anything the organization can do, including creating or deleting assistants, attaching phone numbers, and starting calls (billable).

## If you choose to supply a private key anyway: scope, limits and revocation

| Item | Plan |
|---|---|
| Access scope | **Full organization access** (cannot be narrowed). Prefer a separate Vapi organization used only for testing, containing only a test assistant and **no phone numbers** and **no credit balance** |
| Use | Only `GET /assistant/{id}` (and `GET /assistant` list) to compare the test assistant's configuration with `lib/ai/vapi.ts`. No create, update, delete, call, phone-number or billing request. The code's outbound switch stays forced off |
| Storage | `.env.isolated-test.local` only (git-ignored, owner-only access, loaded only by `scripts/isolated-env.mjs`). Never printed; never in chat or e-mail |
| Duration | Single session. Delete the key in the Vapi dashboard (API Keys) immediately after the checks, and record the deletion time |
| After revocation | I run one `GET` with the deleted key and expect 401, as evidence. Because revocation timing is undocumented, I re-check after 10 minutes if the first check still succeeds |

## Safer alternative (recommended)

You (or an Editor/Viewer member) export the test assistant's configuration from the Vapi dashboard as JSON (with no secrets in it). I compare it offline against the required configuration in `VOICE_CALL_AGENT_REPORT.md`, section 2. **No key changes hands.**

## Decision needed

Choose one:
- **(a)** the dashboard export (no key);
- **(b)** a private key in a test-only organization, under the plan above;
- **(c)** skip Vapi-side verification for now.
