# Phase 2 integrations

| Integration | Status |
|---|---|
| Existing catalogue, regional prices, PayPal, ShipGlobal | Used as they are |
| OpenAI | Optional rewrite. Not configured in this environment |
| Voice provider | Interface and signed webhook only. Not live |
| Google Merchant Center | XML feed at `/feeds/google.xml`. No upload was attempted |
| Search / competitor API | Not connected. Reports do not invent volumes |
| Email owner alerts | Not added. Alerts appear in the Marina AI admin tab and `ai_audit` |

Enable voice by setting the two voice variables and pointing the provider at `POST /api/ai/voice/webhook`. Outbound events without `consent: true` are rejected. Duplicate event ids are ignored.
