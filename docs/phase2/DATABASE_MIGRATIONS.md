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
