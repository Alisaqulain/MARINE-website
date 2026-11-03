# Implementation status

Updated 3 November 2026. *Code* = implemented and covered by automated tests. *Live* = verified against the real service in the checked environment (see `/test`).

## Agent 1 — Chat & Sales

| Requirement | Code | Live |
| --- | --- | --- |
| Website chat (`/api/ai/chat`, ChatWidget) | ✅ | ✅ route probe |
| Gemini replies, checked against catalogue facts | ✅ | ⏳ no `GEMINI_API_KEY` (catalogue-only fallback works) |
| Catalogue + policies knowledge base, real prices/stock/MOQ | ✅ | ✅ 328 products |
| B2C / wholesale / B2B / bulk / OEM segments, lead score 0–100 | ✅ | ✅ logic |
| Contact capture, CRM leads, conversation history | ✅ | ✅ DB |
| Owner alerts (score / deal value / approval requests) | ✅ | ⚠ SMTP login OK, no alert delivered yet |
| Owner approval gateway (discounts etc., 72 h) | ✅ | ✅ logic |
| Checkout & enquiry recovery with consent, unsubscribe link | ✅ (bag-only abandonment without contact cannot be recovered) | ⏳ needs `CRON_SECRET` + scheduler |
| Rate limits, fallbacks, agent switch | ✅ | ✅ |

## Agent 2 — Voice & Call

| Requirement | Code | Live |
| --- | --- | --- |
| Vapi webhook (secret, tool calls, status, end-of-call) | ✅ | ✅ route refuses unsigned requests · ⏳ no Vapi account |
| Gemini as Vapi model, assistant sync & drift check | ✅ | ⏳ |
| Exotel credentials, vSIP trunk → Vapi destination, ExoPhone mapping, missed-call callbacks | ✅ (vSIP paths from Exotel's connector repo) | ⏳ needs KYC + vSIP |
| Inbound calls, approved outbound callbacks (consent + owner + flag) | ✅ | ⏳ |
| Transcripts, Gemini summaries, CRM, owner alerts, missed-call recovery | ✅ | ⏳ |

## Agent 3 — Growth & Revenue

| Requirement | Code | Live |
| --- | --- | --- |
| GA4 Data API, Measurement Protocol purchases, consent-gated tag | ✅ | ⏳ no service account |
| Search Console queries, pages, keyword opportunities | ✅ | ⏳ |
| SEO/GEO/AEO drafts, buying guides, FAQs, competitor research (Google Search grounding) | ✅ | ⏳ no Gemini |
| Journey tracking: visit, add to cart, checkout, order, chat, call, quote | ✅ | ✅ events stored |
| Checkout / CRO analysis, low-conversion products, internal links, labelled recommendations | ✅ | ✅ from first-party data |
| Revenue attribution, daily owner report | ✅ | ⏳ report needs cron |
| Google Shopping feed | ✅ feed | ⚠ Merchant Center API not built (scheduled fetch) |

## Agent 4 — WhatsApp Sales & Support

| Requirement | Code | Live |
| --- | --- | --- |
| Cloud API inbound/outbound, Gemini replies, CRM, history | ✅ | ⏳ no token/IDs |
| Signature + verify token, duplicate prevention, statuses | ✅ | ✅ route refuses forged/wrong requests |
| 24-hour window, opt-in/out (STOP/START), templates with consent, owner approval flags | ✅ | ⏳ |
| Retry: one retry on 5xx/timeout, failures stored | ✅ | ⏳ |
| Coexistence (featureType, waba-only finish, server exchange, test-number gating, subscribe, one-time syncs, history/contacts/echoes, human takeover) | ✅ | ⏳ not onboarded |

## Shared

Gemini service with grounding guard ✅ · shared catalogue & CRM ✅ · lead scoring ✅ · owner notifications ✅ · approval gateway ✅ · audit log (`ai_audit`) ✅ · **Gemini usage/error monitoring** (`ai_usage`) ✅ · **agent switches** (`AI_AGENTS_DISABLED`) ✅ · **central env registry** ✅ · `/test` health dashboard with history ✅.
