# WhatsApp message flows — DRAFT (16 Nov 2026)

Status: draft written by the developer, as Ahmad asked ("make the flows yourself for now; we'll confirm and change later").
Nothing here is live. All changes need Ahmad's confirmation before submission to Meta.

Live business number: +91 74570 99540 (stays locked until G5 deployment approval).

## How the code sends messages (fixed rules)

| Situation | What is sent | Rule in code |
|---|---|---|
| Customer messaged within the last 24 h | Free-text reply (agent / staff) | `sendGate` allows free-form only inside the 24-hour window |
| Outside 24 h | Only an **approved template** | Needs recorded opt-in consent |
| Customer writes STOP / unsubscribe | Opt-out confirmation, no further messages | `isOptOut` → suppressed |

The follow-up sender (`lib/ai/followups.ts`) currently sends the template **with no variables**, so template 1 below has none.

## Templates to submit in WhatsApp Manager (category, language `en`)

### 1. `marina_followup` — MARKETING (used as `WHATSAPP_FOLLOWUP_TEMPLATE`)
> Hi! Thank you for your interest in Marina Muse. Your saved pieces are still waiting for you. Reply to this message and our team will help you with sizes, personalisation or your order.
>
> Reply STOP to stop these messages.

Button (quick reply): `Talk to us`

### 2. `marina_order_confirmed` — UTILITY *(for later; needs code to pass variables)*
> Hi {{1}}, thank you for your order {{2}} with Marina Muse. We have received your payment of {{3}}. We will message you again when it ships.

### 3. `marina_made_to_order_update` — UTILITY *(for later)*
> Hi {{1}}, an update on your made-to-order piece (order {{2}}): {{3}}. Expected dispatch: {{4}}.

### 4. `marina_order_shipped` — UTILITY *(for later)*
> Hi {{1}}, your Marina Muse order {{2}} has shipped. Track it here: {{3}}

## Fixed in-window replies (no approval needed)

- **Greeting:** "Hi, welcome to Marina Muse! How can we help — a product, an order, or personalisation?"
- **Hand-off to staff:** "Thanks — a member of our team will reply shortly (Mon–Sat, 10 am–7 pm IST)."
- **Opt-out confirmation:** "You have been unsubscribed and will not receive more messages from Marina Muse. Reply START to subscribe again."

## Open questions for Ahmad
1. Template wording and brand tone OK?
2. Business hours for the hand-off message?
3. Which of templates 2–4 are wanted in Phase 2 (each needs a small code change to pass order details)?
