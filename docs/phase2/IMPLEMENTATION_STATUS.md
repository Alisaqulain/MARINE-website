# Phase 2 implementation status

| Area | State | Notes |
|---|---|---|
| Baseline audit | Implemented | This folder |
| Catalogue-grounded chat | Tested | Local `POST /api/ai/chat` returned the live compass price |
| Lead score and stages | Tested | `scripts/check-phase2.ts` |
| Owner approval records | Implemented | Admin Marina AI → Approvals. Not exercised in a browser session |
| B2C checkout handoff | Implemented | Chat links to the existing product page and wholesale quote flow |
| Voice calls | Awaiting credentials | Webhook returns HTTP 503 until `VOICE_PROVIDER` and `VOICE_WEBHOOK_SECRET` are set |
| OpenAI rewrite | Awaiting credentials | Used only when `OPENAI_API_KEY` is set; otherwise the catalogue sentence is returned |
| SEO sitemap and robots | Implemented | `/sitemap.xml`, `/robots.txt` |
| Product schema | Implemented | Product pages emit schema from the current product record |
| Merchant Center feed | Implemented | `/feeds/google.xml` is generated. It is not uploaded |
| Search and competitor volumes | Awaiting credentials | Report says this data is unavailable |
| Revenue attribution | Implemented | Last non-direct touch. Paid orders link only when `sessionId` was stored |
| Daily growth loop | Implemented | Runs when an admin opens Marina AI. No separate cron worker is running |
| Ad budget changes | Not started | Explicitly blocked. No ads are launched |
| Production build | Not started | Not run while the dev server was using `.next` |
| Existing checkout and payments | Unchanged path | PayPal capture route was not rewritten |

Do not treat voice, Merchant Center upload, or search-volume reports as live.
