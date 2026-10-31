# Implementation status

| Area | Code | Live-verified |
|---|---|---|
| Agent 1 chat — Gemini replies grounded in catalogue, segments, scoring, CRM, alerts, approvals | Done | Catalogue path yes; Gemini needs `GEMINI_API_KEY` |
| Agent 1 recovery — checkout (opt-in at checkout) and enquiry follow-ups, unsubscribe | Done | Job runs; sending needs consent + SMTP/WhatsApp template |
| Agent 2 voice — Vapi webhook, tools, Gemini call summaries, leads, missed-call alerts + callback approval, outbound | Done | Needs Vapi + Exotel accounts; no real call yet |
| Agent 2 Exotel — credential, vSIP trunk, Vapi destination, number mapping checks, StatusCallback | Done | Needs Exotel account with vSIP |
| Agent 3 growth — GA4 + Search Console reports, keyword opportunities, attribution, GA4 purchase events, consent-gated tag, daily report with Gemini insights, content drafts, competitor research | Done | Needs service account + property access |
| Agent 4 WhatsApp — per-sender sessions, Gemini replies (gated), statuses, STOP/START, templates | Done | Needs Cloud API token and written approval flags |
| /test integration checker | Done | Reports actual state; currently all six AI providers Not configured |
| Merchant Center upload, ads APIs | Not built | — |
