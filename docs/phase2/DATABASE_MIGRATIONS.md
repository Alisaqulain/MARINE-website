# Database changes

No existing collection is dropped or rewritten. Collections are created on first write; no migration script is needed.

- `ai_sessions`, `ai_messages` — conversations (chat `attr_*`, WhatsApp `wa_<number>`, calls `call_<number>`); messages record `model` (gemini / catalogue / approval)
- `ai_leads` — score, stage, **segment** (b2c / wholesale / b2b / bulk / oem), contact, quantity, estimated value
- `ai_approvals` — owner decisions on restricted requests
- `ai_calls` — Vapi and Exotel calls: direction, ended reason, transcript, Gemini summary, objections, questions
- `ai_followups` — checkout/enquiry recovery and missed-call callbacks (pending / needs_approval / sent / skipped / failed)
- `ai_consent` — opt-in/out per channel and address; `ai_suppression` — opted-out phones/emails
- `ai_wa_messages` — WhatsApp in/out with delivery status (sent → delivered → read / failed, or withheld + reason)
- `ai_content` — growth drafts and research awaiting owner review
- `ai_jobs` — scheduled job runs (shown on /test); `ai_healthcheck` — transient /test round-trip doc
- `ai_audit` — alerts, consent changes, grounding rejections, admin actions
- `orders.analyticsSent` — GA4 purchase event accepted

Recommended indexes once volume grows: `ai_followups {status:1, dueAt:1}`, `ai_consent {channel:1, address:1}` (unique), `ai_wa_messages {wamid:1}`, `ai_calls {id:1}` (unique), `ai_leads {sessionId:1}`.

## Phase 2 (D/E/F and commerce), created at runtime, no migration script

- `ai_wa_messages` reservation fields: `inboundAt` (customer's Meta timestamp, epoch seconds), `sendToken`, `firstProblemAt`, `staleAt`, `expiredAt`, `resolvedBy/At`, `resendClaim {token, actor, workerId, at}`, `resendAttempt`, `resentAs`, `reconciledBy/At`, `deliveryStatus`. New statuses: `unknown`, `stale`, `expired`, `resolved`, `sent_late`, `resend_claimed`, `resent`, `resend_failed`, `resend_unknown`. Legacy records keep their statuses and, without `inboundAt`, are never resendable.
- Index `wa_status_at` `{status:1, at:1}` on `ai_wa_messages` (non-unique; recovery sweep and admin list).
- `ai_wa_delivery_events` (append-only) with unique index `wa_delivery_event_once` `{inReplyTo:1, token:1}`.
- `ai_job_leases` with unique index `job_lease_name` `{name:1}` (one running instance per scheduled job).
- `orders`: unique index `order_id_once` `{id:1}` (best-effort; creation is skipped if existing data holds duplicate ids) supporting the single paid transition.
- `ai_followups.status` may now be `unknown` (WhatsApp template outcome not confirmed); never re-selected by cron.
