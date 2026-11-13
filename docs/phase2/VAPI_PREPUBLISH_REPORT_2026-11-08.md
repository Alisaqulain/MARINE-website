# Marina Muse Assistant: pre-publishing configuration and testing (2026-11-08)

Scope: non-billable configuration and testing only. No calls, no phone numbers, no SIP credentials, no credits, no paid packages.

## 1. Assistant

- Name: Marina Muse Assistant
- ID: `e0bf7b4e-dcb0-4be1-8f3f-c41f1512ee4d`

## 2. Actual status (draft / published)

Vapi's API has no draft state and no publish endpoint. Every API update is saved as a new version immediately:

- v1: created 11:02 UTC when the assistant was created.
- v2: created 14:47 UTC by today's configuration update. `latestVersion` reports `v2`.

The dashboard's "Draft" / "Publish" feature applies to edits made in the dashboard editor, not to API updates. **The assistant should not be described as "in draft".** What is true:

- It is not connected to anything. The org has 0 phone numbers and 0 credentials (SIP or provider keys).
- It has never been used: 0 calls, 0 chats, 0 sessions.
- It cannot receive inbound calls (no number attached). It can only run if someone explicitly starts a call with its ID.

Nothing more will happen until the client approves publishing in writing.

## 3. Voice

- Provider: Vapi (built-in voices). Voice ID: `Clara` (female, adult, American English, tagged "Professional", not a beta voice).
- Why: of Vapi's 22 built-in voices, Clara is the female voice tagged professional and not beta. The beta "Mia" (professional, articulate) is the alternative if the client prefers it.

## 4. Does the voice need paid credits or a credential?

- No separate API key or credential. Built-in Vapi voices need only `{"provider":"vapi","voiceId":"Clara"}`. Setting it needed no paid activation.
- Cost: voice is charged only as part of call usage when calls happen. Vapi's docs do not give a separate price for built-in voices. No cost was incurred today.

## 5. Model and fallback

- Primary: provider `google`, model `gemini-3.8-flash`, temperature `0.3`. Confirmed by reading it back from Vapi.
- **Vapi fallback: not available for Gemini.** Vapi's `model.fallbackModels` works only for OpenAI and Anthropic-on-Bedrock models, and must stay on the same provider. No fallback is configured in Vapi, and none should be claimed.
- The website's own Gemini fallback (`gemini-3.5-flash`, `gemini-3.5-flash-lite`) is a separate system. It covers the website's chat, WhatsApp and call summaries, not Vapi's conversation model.
- Vapi supports fallbacks for the voice and the transcriber. None are configured; this is optional.
- The org has no Google credential in Vapi, so Vapi uses its own Gemini access. That usage is billed through Vapi per call, not through the site's Google key.

## 6. System prompt

The existing prompt already covered: accurate company description, verified catalogue facts only, no invented prices/stock/specs/delivery times/discounts, no discounts or payment terms, no card or password requests, escalation ("the team will call back"), and concise spoken style.

Added in `lib/ai/agents.ts` (voice only, same business scope):

- Use `lookup_product` before stating material or minimum order as well as price or stock; say "I don't have that detail" when the tool returns none.
- Collect the product as well, and handle callback requests.
- **Ask for consent before saving an enquiry**; set `consentToContact` only on a clear yes.
- Never say an order has been placed or that a delivery date is guaranteed; never ask for card or bank details.

## 7. Product tools

| Check | lookup_product | record_enquiry |
|---|---|---|
| Endpoint | `https://marinamuseinternational.com/api/ai/voice/webhook` | same |
| Auth header in Vapi matches `VAPI_WEBHOOK_SECRET` | Yes (compared by hash, not printed) | Yes |
| Schema | `query` (required string). Valid. | `notes` required. Added `enquiryType` (wholesale, bulk, oem, callback, other). Valid. |
| Live production endpoint | **401: production does not have `VAPI_WEBHOOK_SECRET` deployed yet** (already pending deployment approval) | not called on production (would create a real lead and may email the owner) |
| Tested against | local server, same route code, real catalogue (read-only) | pure functions, no database, no email |

lookup_product results against the real catalogue:

| Query | Result |
|---|---|
| "brass compass" | 3 compasses with price, stock count, material. No MOQ (catalogue has none for these). Pass. |
| "telescope" | 3 telescope products with prices and stock. Pass. |
| "anchor" | $49.00, in stock, solid brass, 12" H, wholesale minimum 30 units. Pass. |
| "steering wheel" | 3 ship wheels with prices and MOQ (24 / 12 / 12). Pass. |
| "purple umbrella xyz-999" | "No verified catalogue match… offer a callback." Pass. |
| empty query | "Ask the caller which product they mean." Pass. |
| no secret | 401. Pass. |
| **"ship wheel"** | **Was a defect:** returned the shipping policy instead of the products. **Fixed** in `lib/ai/answer.ts`, with a regression check in `lib/ai/selftest.ts`. "Do you ship to Germany" still returns the shipping policy. |

record_enquiry checks:

- Wholesale → wholesale lead; bulk → bulk; OEM → oem; callback → general lead whose note starts "callback enquiry".
- Consent is recorded only when `consentToContact === true`.
- Saving an enquiry writes a CRM lead and, above the alert score, emails the owner. It sends nothing to the customer. That is why it was not run against production.
- `lib/ai/voice.ts` now adds the enquiry type to the lead note. It needs deployment; until then production ignores the field.

## 8. Text tests

Vapi's text chat (`POST /chat` and the dashboard Chat tab) requires purchased credits and is billed, so it was **not used**. Instead, the assistant's exact prompt, model, temperature and tool schemas were run through Google's Gemini API using the site's key. `lookup_product` went to the local webhook on the real catalogue, and `record_enquiry` went to a mock.

| # | Test | Result |
|---|---|---|
| 1 | Greeting and introduction | Pass |
| 2 | Product search ("brass telescopes") | Pass: called the tool, read three prices as words |
| 3 | Price ("decorative brass anchor") | Pass: "forty-nine US dollars", in stock |
| 4 | Stock (teak ship wheel) | Partial: correct tool call and data; the reply was blocked by the quota |
| 5–12 | Material/MOQ, missing data, unknown product, wholesale, bulk/OEM, callback, consent declined, discount/delivery/order/payment | **Not run: blocked by quota** (below). Scripts are ready. |

**Blocker:** the site's Gemini key is on Google's **free tier: 20 requests per day per model**. Today's `gemini-3.8-flash` allowance ran out during test 4 (it resets about 17 hours after 14:50 UTC). I did not switch the tests to the fallback models, because that could use up the live website's daily allowance if production uses the same key. A 20-requests-per-day limit is also a production risk for website chat and WhatsApp.

## 9. Voice preview

Vapi's official preview clip for Clara was downloaded (WAV, 2.9 MB, from Vapi's static preview storage). No session or call was created. The clip still needs to be played and approved by the client; it was not judged by ear here.

## 10. Remaining blockers

1. Production needs `VAPI_WEBHOOK_SECRET` (and today's code changes) deployed, otherwise every tool call returns 401. This needs deployment approval.
2. Text tests 4–12 need either tomorrow's Gemini quota or a paid Gemini key.
3. A real voice/latency test needs a call, which needs credits. Out of scope.
4. Telephony (Exotel vSIP, phone number, SIP credential) is not started. Out of scope.

## 11. Riley

Before and after: ID `c9069498-818d-4f78-95be-3ee571a98abc`, `updatedAt` 2026-11-07T18:46:23.498Z, SHA-256 of the full configuration `9b7c0c6b…e716`. The before and after snapshots are byte-identical. **Riley is unchanged.**

## 12. Confirmation

No credits purchased, no paid package, no phone number, no SIP credential, no calls, no Vapi chats or sessions, no messages or emails sent, no production records created. No secrets appear in this report.

**Stopped here. Publishing waits for the client's written approval.**
