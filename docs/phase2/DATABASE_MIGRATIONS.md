# Phase 2 database changes

No existing collection is dropped or rewritten.

New collections, created on first write:

- `ai_sessions` — chat session id, region, message count, score
- `ai_messages` — customer and assistant text, product slugs
- `ai_leads` — score, stage, quantity, estimated value, summary
- `ai_approvals` — pending, approved, or rejected discount requests
- `ai_calls` — voice events after a verified webhook
- `ai_suppression` — phone opt-out from a voice opt-out event
- `ai_audit` — owner alerts and approval decisions
- `ai_attribution` — session touch list

`orders.sessionId` is optional. Older orders simply have no source link.

There is no migration script to run. Indexes are not required for the current volume.
