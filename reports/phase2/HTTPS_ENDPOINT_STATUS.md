# Temporary public HTTPS endpoint: status and plan

**10 November 2026, 17:12 UTC.**

## Status: NOT STARTED. Blocked by the Docker security issue (stop condition)

- No public endpoint was created.
- No tunnel tool was installed (none is present: no `cloudflared`, no `ngrok`).
- No route was exposed.

There is nothing to clean up. A public URL also has no use yet: the tests that need it (real Meta and Vapi webhook delivery) need credentials that have not been supplied.

**Preconditions, all required:**
1. Docker remediation run and verified: `docker-root-verify.sh` prints NOT USABLE; `dev:db verify` 13/13; runtime check 8/8.
2. Meta test-app credentials and/or the Vapi decision supplied (the tests the endpoint exists for).
3. Your approval of the tunnel provider. Any tunnel relays traffic through a third party.

## Planned isolation design (for review before any exposure)

| Layer | Design |
|---|---|
| Server | The isolated test server only (`scripts/isolated-env.mjs -- next dev`, test database, synthetic or fresh test secrets) |
| **Route allowlist proxy** | A small local reverse proxy in front of the server. It forwards **only** `POST /api/ai/voice/webhook`, and `GET`/`POST /api/meta/whatsapp/webhook`. **Everything else gets 404**: admin, `/test`, auth, catalogue, chat, health and every other page and API |
| Tunnel | Points at the **proxy port only**, never at the Next.js port |
| Authentication | Unchanged: Vapi secret and Meta signature and verify token checks stay on (tested 13/13 and 8/8) |
| Outbound | Forced off (`WHATSAPP_OUTBOUND_ENABLED`, `VAPI_OUTBOUND_ENABLED`, onboarding flags false; no SMTP) |

**External checks before any test traffic** (recorded with time, URL and status code):
1. The two allowed routes answer; unsigned requests are refused.
2. `/admin`, `/test`, `/api/admin/ai`, `/api/health`, `/api/auth/csrf`, `/api/catalog/products`, `/` and a random path all return **404 from the proxy**.

**Record kept.**
- Exact URL, routes exposed, start time, end time and the external check results.
- Cleanup: stop the tunnel, then the proxy, then the server.
- After cleanup, external requests to the URL and both routes must fail (no response, or a tunnel "not found").
