# Marina AI architecture — four agents, one brain

All four agents share Google Gemini (`lib/ai/gemini.ts`), one set of rules (`lib/ai/agents.ts`), the live catalogue and one CRM (`lib/ai/crm.ts`). They do not replace checkout, payment, or shipping.

```
Agent 1 Chat & Sales     POST /api/ai/chat ─┐
Agent 4 WhatsApp         POST /api/meta/whatsapp/webhook (signed) ─┤
                                            ├─ catalogue facts (regional USD price, stock, MOQ)
                                            ├─ Gemini writes the reply → replyIsGrounded() → else catalogue text
                                            └─ lead score 0–100 + segment (B2C/wholesale/B2B/bulk/OEM) → ai_leads → owner alert

Agent 2 Voice & Call     Exotel ExoPhone ⇄ Exotel vSIP trunk ⇄ Vapi BYO SIP trunk ⇄ Vapi assistant (model.provider "google")
                         POST /api/ai/voice/webhook
                           · Vapi tool-calls  → lookup_product / record_enquiry (verified catalogue)
                           · end-of-call      → ai_calls + Gemini summary + lead; missed → owner alert + callback task
                           · Exotel callback  → missed-call recovery (?provider=exotel&token=…)

Agent 3 Growth & Revenue GA4 Data API + Search Console (service account) + first-party attribution + orders
                           · daily report (POST /api/ai/report/daily, cron)
                           · content drafts / competitor research (Gemini + Google Search grounding) → ai_content (owner review)
                           · server-side GA4 purchase events on paid orders (Measurement Protocol)

Follow-ups               POST /api/ai/jobs (cron, every 15 min) — checkout & enquiry recovery, consent-gated
Owner                    Admin → Marina AI (leads, approvals, follow-ups, calls, WhatsApp, content, Vapi sync)
Health                   /test (admin-only in production)
```

## Rules that hold for every agent

- Prices, stock, MOQ and policies come only from the catalogue and `APPROVED_POLICIES`. A Gemini reply that states a money amount, quantity, duration or percentage not present in the facts is discarded (`replyIsGrounded`).
- Discounts, payment terms, custom commitments, outbound calls, publishing and ad budgets are restricted (`lib/ai/permissions.ts`) and wait for the owner.
- WhatsApp sending needs all three approval flags; free-form replies only inside the 24-hour window; templates only with opt-in; never to opted-out numbers or the business's own live number.
- Outbound calls are billable and only start from an owner action in admin, with recorded consent and `VAPI_OUTBOUND_ENABLED=true`.

## Why Exotel connects over SIP

Vapi imports Twilio/Vonage/Telnyx numbers natively but not Exotel. The supported path is SIP: an Exotel vSIP trunk with destination `<VAPI_SIP_CREDENTIAL_ID>.sip.vapi.ai:5060;transport=tcp` (inbound), and a Vapi `byo-sip-trunk` credential whose gateway is the Exotel PSTN gateway (outbound), plus a Vapi `byo-phone-number` for the ExoPhone. This is the design in Exotel's own Exotel-Vapi-Connector.
