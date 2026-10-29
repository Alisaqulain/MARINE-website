# Phase 2 architecture

Three agents share one catalogue and CRM path. They do not replace checkout, payment, or shipping.

```
Customer chat → POST /api/ai/chat
             → catalogue facts (regional USD price, stock, material)
             → optional OpenAI rewrite only from those facts
             → ai_sessions / ai_messages / ai_leads / ai_approvals

Voice webhook → signature check → ai_calls or 503 if unconfigured

Admin Marina AI tab → leads, approvals, call log, first-party growth report

Visit → POST /api/ai/attribution → last non-direct source
Checkout → optional sessionId on the order
```

Catalogue answers live in `lib/ai/answer.ts`. Lead scores live in `lib/ai/scoring.ts`. Approval rules live in `lib/ai/permissions.ts`. Restricted actions (discount, payment terms, custom commitment, outbound call, publishing, ad budget) cannot be executed by the assistant. A pending approval is stored for a discount request on a hot or wholesale lead. An admin must approve that exact request.

The growth report reads orders, page views, and leads already in MongoDB. It does not call a search or ads API.
