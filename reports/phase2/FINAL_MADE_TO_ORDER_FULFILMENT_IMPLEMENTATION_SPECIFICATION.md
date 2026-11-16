# Marina Muse International — Made-to-Order Fulfilment Implementation Specification

**Prepared for:** Ahmad · **Prepared by:** Ali · **Date:** 15 November 2026 · **Status: SPECIFICATION ONLY, NOT AUTHORIZED FOR IMPLEMENTATION**

**Inputs (unchanged):**
- `reports/phase2/PREORDER_PRODUCT_FULFILMENT_REVIEW.md` (baseline)
- `reports/phase2/PREORDER_CUSTOMER_MESSAGING_AND_CONSISTENCY_PROPOSAL.md`
- `reports/phase2/G4_PROVIDER_TEST_REQUIREMENTS_AND_APPROVAL_PLAN.md`

All code references were re-checked against the current working tree.

**Classifications:** **APPROVED IN PRINCIPLE** · **CONFIRMED EXISTING** · **PENDING BUSINESS DECISION** · **PROPOSED DESIGN (unimplemented)** · **NOT AUTHORIZED**.

---

## 1. Executive summary
- **Approved in principle by Ahmad:**
  - one product-level fulfilment record;
  - an order-level snapshot of what the customer was promised;
  - consistent text across product page, checkout, confirmation and email;
  - AI assistants following the same policy;
  - the Google Merchant feed handled separately.
- **Confirmed today:**
  - **On the site:** the three products are only `stock: "made-to-order"`. Every page promises a generic 7–12 business days, checkout shows no estimate, and the order stores a generic 5–12 calendar-day range.
  - **Elsewhere:** the email repeats that stored range, the AI assistants quote 7–12 business days, and the feed sends `preorder` with no date.
- **Pending:**
  - all product timings and treatments;
  - the time zone (`+05:30` proposed, not approved);
  - the compass business model (retail versus OEM) and the engraving workflow;
  - the Merchant mapping;
  - the customer wording.
- **Nothing in this document is implemented. Nothing is authorized** beyond writing it.

---

## 2. Authorization and scope

| Allowed now | Not authorized |
|---|---|
| Reading code and reports; writing this specification | Code, schema, database, feed, configuration, product-data or stock-status changes; external API calls; credentials; email tests; provider operations; deployment; commits or pushes; any production or shipping duration |

The three products, their data and the Google Merchant feed remain unchanged.

---

## 3. Ahmad's approved architectural principles (APPROVED IN PRINCIPLE)

| ID | Principle | Note |
|---|---|---|
| P-A | One product-level fulfilment record is the source of truth: fulfilment type, availability treatment, production lead time, transit lead time, customer estimate, approved time zone, approval status | Field names in §5 are proposals |
| P-B | The order keeps a snapshot of the fulfilment information and estimate shown at purchase; later product changes never rewrite it; revisions are separate updates | Extends the existing `estimatedDelivery` (§6) |
| P-C | The same approved information on product page, checkout, order confirmation and transactional email | §7 |
| P-D | AI assistant shipping answers follow the same approved policy; the 7–12 business-day wording is aligned after timings are final | §8 |
| P-E | Google Merchant availability is mapped independently of customer messaging; made-to-order does not automatically mean `in_stock` or `preorder`; Merchant requirements are verified first | §9 |

---

## 4. Existing system architecture and verified behaviour (CONFIRMED EXISTING)

| Area | Behaviour | Evidence |
|---|---|---|
| Product model | `stock: "in-stock" \| "low" \| "made-to-order"`; optional `quantity`, `moq`, `personalisationPrice`; **no** fulfilment, lead-time or date field | `lib/products.ts:20, 39, 95`; DB type `lib/db/types.ts:125`; admin parsing `lib/product-fields.ts:50` |
| Three products | `made-to-order`; no quantity; no personalisation price | `lib/products.ts:534-555` (MM-WHL-036), `:723-745` (MM-DEC-030), `:771-794` (MM-CUS-001) |
| Catalogue source | Bundled products merged with database records (`mergeStorefrontProducts`); production database not inspected | `lib/storefront-catalog.ts:130-154` |
| Product page label | "Made to order" if `stock === "made-to-order"`, unless a quantity alert applies | `app/product/[slug]/page.tsx:181` |
| Product page promise | Retail branch: "Estimated delivery by 7-12 business days, if you order today", same for every product | `app/product/[slug]/page.tsx:455-462` |
| Personalisation | Selector and message (≤300 characters) rendered **only** when `personalisationPrice` is set | `app/product/[slug]/page.tsx:96-97, 183-202, 395-430`; server: `lib/orders.ts:222-226` |
| Cart and checkout | Lines priced server-side; made-to-order items accepted like in-stock items; checkout summary shows no delivery or made-to-order text | `lib/orders.ts:206-235`; `app/checkout/page.tsx:145-160` |
| MOQ | Stored on products (`moq`; compass 50) but **not enforced** in retail checkout | `lib/products.ts` (`moq` fields); no `moq` use in `lib/orders.ts` or `app/checkout/page.tsx` |
| Order record | One string `estimatedDelivery` = today + 5 to + 12 calendar days (server clock, `en-GB` format), set at order creation | `lib/orders.ts:57, 103-111`; `app/api/paypal/order/route.ts:63` |
| Order confirmation | Shows `estimatedDelivery` | `app/checkout/confirmation/page.tsx:96-97`; account `app/account/orders/page.tsx:105` |
| Email | Plain-text confirmation includes `Estimated Delivery: ${order.estimatedDelivery}` and the personalisation message; SMTP; not sent outside production | `lib/orders.ts:307-330` |
| AI assistants (chat, WhatsApp) | Approved shipping policy "Retail product pages show an estimated delivery of 7–12 business days…" is returned for shipping questions and included in the Gemini facts | `lib/ai/answer.ts:20-21, 78-80`; `lib/ai/crm.ts:117` |
| AI manufacturing policy | "does not promise a production time…" | `lib/ai/answer.ts:26-27` |
| Voice agent | Uses the `lookup_product` and `record_enquiry` tools; instructions forbid guaranteeing a delivery date | `lib/ai/vapi.ts:12, 195`; `lib/ai/agents.ts` (voice rules) |
| Google feed | `preorder` for made-to-order; `FeedItem` has no date; no `availability_date` emitted | `lib/ai/growth.ts:16-30` (`:27`); `lib/ai/feed.ts:1-10, 70-106` |
| Time zone | `NEXT_PUBLIC_SHOP_UTC_OFFSET`, default `+05:30`, used **only** for sale dates; not set in `.env.local` | `lib/sale-time.ts:6-8`; `lib/ai/env-registry.ts:67` |

---

## 5. Proposed fulfilment data model (PROPOSED DESIGN — unimplemented)

`ProductFulfilment`, stored with the product (bundled catalogue default plus database override), edited in admin:

| Field | Type | Notes |
|---|---|---|
| `fulfilmentType` | `"stock" \| "made_to_order" \| "custom_oem"` | Pending per product |
| `availabilityTreatment` | `"in_stock" \| "made_to_order_window" \| "fixed_date" \| "enquiry_only"` | Customer-facing treatment |
| `productionDays` | `{ min: number; max: number; unit: "business" \| "calendar" } \| null` | Pending |
| `transitDays` | same shape, optional per-region map | Pending |
| `customerEstimate` | derived `{ min, max, unit }` or approved override | Displayed only when approved |
| `availableFrom` | ISO date or null | `fixed_date` only |
| `timeZone` | `"+05:30"`-style offset or null | Pending approval |
| `messageKey` | approved template id (proposal §3 wording) | Same text everywhere |
| `merchantAvailability` | `"in_stock" \| "preorder" \| "backorder" \| "out_of_stock" \| "exclude" \| null` | Separate approval (§9); `null` = current behaviour |
| `approval` | `{ status: "pending" \| "approved"; approvedBy?; approvedAt?; effectiveFrom? }` | Nothing shown unless approved |

**Rules:**
- Pure calculation module, proposed `lib/fulfilment.ts`. Input: record, purchase timestamp, approved time zone. Output: display text, a min/max date range, and Merchant fields.
- With no approved record, it returns the neutral "made to order, estimate emailed later" variant, or the current in-stock behaviour for in-stock products.
- **Failure cases:** a missing record (neutral text, never a duration); `min > max` (validation error in admin); unapproved values (ignored); time zone missing while dates are required (no dates shown).

---

## 6. Proposed order snapshot model (PROPOSED DESIGN)

- **Today:** `OrderRecord.estimatedDelivery: string` (`lib/orders.ts:57`), written once in the order route. This already behaves like a snapshot, but its content is generic.
- **Proposed extension**, all optional so old orders stay valid:
  - `OrderItem.fulfilment`: `{ fulfilmentType, displayedText, estimate: { min, max, unit }, dateRange?: { from, to }, timeZone?, recordVersion, snapshotAt }`;
  - `OrderRecord.fulfilmentSummary`: the order-level text shown at checkout.
- **Computed server-side** in `pricedItemsAsync` (`lib/orders.ts:206-235`), using the same `lib/fulfilment.ts` call the checkout page used. The client's copy is never trusted.
- **Immutable:** later edits to a product's record never touch existing orders.
- **Revisions:** `OrderRecord.deliveryUpdates[]` = `{ at, newEstimate, reason, notifiedAt? }`, appended by an explicit admin action. Confirmation views show the original snapshot plus the updates.
- **Fallback:** orders without a snapshot keep showing `estimatedDelivery`.
- **Failure cases:** a snapshot write fails (order creation fails, as today on DB errors in `markPaidOnce`); clock skew (server time only).

---

## 7. Five-touchpoint consistency architecture (PROPOSED DESIGN)

| Touchpoint | Gets delivery info today | Future source | Proposed location |
|---|---|---|---|
| Product page | Hard-coded "7-12 business days" (`page.tsx:455-462`) | `lib/fulfilment.ts` render of the product record | Same file; made-to-order branch only |
| Checkout | None (`app/checkout/page.tsx:145-160`) | Same render per line, from a server-provided catalogue value | `app/checkout/page.tsx` + catalogue API |
| Order confirmation | `order.estimatedDelivery` | Order snapshot (+ updates) | `app/checkout/confirmation/page.tsx:96-97`, `app/account/orders/page.tsx:105` |
| Email | `order.estimatedDelivery` (`lib/orders.ts:307-330`) | Order snapshot | `sendOrderConfirmation` |
| Google feed | `stock` → `preorder` (`growth.ts:27`) | `merchantAvailability` + date if required (§9) | `lib/ai/growth.ts`, `lib/ai/feed.ts` |

**How this prevents contradictions:**
- One function renders the text for the page and for checkout.
- Checkout and order creation compute from the same record within the same request.
- Confirmation and email read only the snapshot.
- The feed reads only its own approved field.

**Validation:** an automated test renders all four customer touchpoints for a made-to-order fixture and asserts identical estimate text.

---

## 8. AI assistant alignment (PROPOSED; current wording unchanged)

| Component | Today | Future |
|---|---|---|
| `APPROVED_POLICIES.shipping` (`lib/ai/answer.ts:20-21`) | Generic 7–12 business days | Generic text for in-stock items, plus a made-to-order clause generated from approved records ("made-to-order pieces take longer; see the product page") |
| Shipping-question shortcut (`answer.ts:78-80`) | Returns the generic policy unless the question names certain products | Product-aware: if a made-to-order product is in context, answer with that product's approved estimate |
| Gemini facts (`lib/ai/crm.ts:117`, `factsBlock` in `lib/ai/agents.ts`) | Policy line and `stock` per product | Add the approved estimate per product, so the grounding guard (`replyIsGrounded`) accepts only those numbers |
| Voice (`lookup_product`, `lib/ai/voice.ts`) | Catalogue text; no delivery promise | Same approved estimate text; still never a guaranteed date |
| Manufacturing policy (`answer.ts:26-27`) | No production times | Unchanged until approved |

**Dependency:** changing the policy changes the self-test "Shipping policy matches the site (7–12 business days)" (`lib/ai/selftest.ts:85`), which would be updated in the same approved change.

---

## 9. Google Merchant separation (PROPOSED; feed unchanged)
- Customer wording never sets feed availability. The feed uses `merchantAvailability`, approved separately.
- **Values to verify against Google's current specification before any change:** `in_stock`, `out_of_stock`, `preorder` and `backorder` (the last two expect an `availability_date`).
- Made-to-order is commonly expressed as `in_stock` with a longer handling time (shipping or handling settings), or `preorder` with a date. **Not decided; requires verification and Ahmad's approval.**
- **Code impact if approved:**
  - add optional `availabilityDate` (and possibly handling-time fields) to `FeedItem`;
  - emit them in `googleMerchantXml`;
  - extend `feedItemErrors` so `preorder` and `backorder` require a date;
  - dates use the approved time zone.
- **Current feed:** unchanged (`preorder` without a date for the three products).

---

## 10. Compass retail/OEM and engraving workflow (PENDING; options only)
- **Facts:**
  - MM-CUS-001 sells at USD 49 retail, with wholesale from USD 16 and MOQ 50.
  - Its text describes OEM proofing ("Proof in 48 hours…").
  - There is no `personalisationPrice`, so **no engraving field appears** on the product page.
  - Retail checkout does not enforce MOQ.
  - The order and email already support a ≤300-character personalisation message when the field exists (`lib/orders.ts:222-226`; email line in `sendOrderConfirmation`).

| Option (not selected) | Technical implication |
|---|---|
| Retail single unit with engraving | Set a personalisation price (data), or add a dedicated engraving field. Validate length and characters. Store on `OrderItem.message` (exists). Show in confirmation and email (exists). Consider a proof or approval step, and returns policy (custom goods may be excluded, `answer.ts:23`) |
| OEM programme only (MOQ 50) | Replace "Add to bag" with a quote or enquiry flow for this product (existing `/wholesale/quote` and `bulk_quotes`). Enforce MOQ or hide it from retail checkout and the feed. Logo upload and proof belong to the quote workflow |
| Both | Separate retail and OEM listings or variants, each with its own fulfilment record |

**Open:** which model applies; the allowed engraving content (text, logo, coordinates); the maximum length; character sets; proof approval; display to the customer.

---

## 11. Pending business decisions (PENDING BUSINESS DECISION)

| Product | Fulfilment type | Production duration | Transit duration | Ranges? | Customer wording | Merchant treatment |
|---|---|---|---|---|---|---|
| MM-WHL-036 Captain's Helm 36" | Pending | Pending | Pending | Pending | Pending | Pending (unchanged) |
| MM-DEC-030 Vintage Diving Helmet | Pending | Pending | Pending | Pending | Pending | Pending (unchanged) |
| MM-CUS-001 Custom Engraved Compass | Pending (retail / OEM / both) | Pending | Pending | Pending | Pending | Pending (unchanged) |

Also pending:
- the time zone (`+05:30` proposed, **not approved**; no date-based estimate until approved);
- the compass engraving workflow (§10);
- the AI policy wording (§8);
- the implementation scope.

---

## 12. Technical dependencies and risks

| Dependency / risk | Detail | Mitigation |
|---|---|---|
| Catalogue merge | Database records may override bundled products (`lib/storefront-catalog.ts`); production values unknown | Read-only production inspection under separate approval; fulfilment record must merge the same way |
| Admin editing | `lib/product-fields.ts`, admin product API and UI need new fields and validation | Validate ranges; approval status editable by the main admin only |
| Client-side cart | Cart data comes from the client (`lib/cart-context.tsx`) | Compute fulfilment server-side at order creation |
| Order creation path | PayPal order route (Razorpay routes untouched by decision) | Snapshot only in the active PayPal path; Razorpay out of scope |
| Email | SMTP; not sent outside production | One-time authorized test recipient for verification |
| AI grounding | New numbers in replies must exist in the facts, or `replyIsGrounded` rejects them | Add approved estimates to the facts block |
| Feed spec | Wrong value or missing date → disapproval | Verify the spec; feed check; Merchant diagnostics (client account) |
| Time zone | Date boundaries around midnight | Tests at 00:00 in the approved offset |
| Self-tests | `selftest.ts:85` asserts 7–12 days | Update in the same approved change |
| Agents off by default | AI behaviour tests need `AI_AGENTS_ENABLED` in the isolated test file | Documented in G3 |

---

## 13. Proposed implementation sequence (nothing started)

| # | Step | Gate |
|---|---|---|
| 1 | Product-wise business decisions | Ahmad |
| 2 | Production and transit timings | Ahmad |
| 3 | Time zone | Ahmad |
| 4 | Compass retail/OEM and engraving collection | Ahmad |
| 5 | Merchant availability treatment (after spec check) | Ahmad |
| 6 | Customer wording | Ahmad |
| 7 | **Separate written implementation authorization** | Ahmad |
| 8 | Product fulfilment record + `lib/fulfilment.ts` + admin fields | after 7 |
| 9 | Order snapshot + `deliveryUpdates` | after 8 |
| 10 | Product page and checkout | after 8 |
| 11 | Order confirmation and email | after 9 |
| 12 | AI assistant policy and facts | after 8 |
| 13 | Merchant feed mapping (separately approved) | after 5, 8 |
| 14 | Automated tests (§14) | after 10–13 |
| 15 | Staging verification (isolated server, browser review) | after 14 |
| 16 | **Separate production deployment approval** | Ahmad |

---

## 14. Acceptance criteria (future; not executed)
1. For each made-to-order fixture, the product page and checkout render identical fulfilment text.
2. The order stores exactly the estimate text and range shown at checkout, computed server-side.
3. The snapshot is unchanged after the product record is edited (test edits after purchase).
4. Later product-setting changes never rewrite historical estimates; revisions appear only in `deliveryUpdates`.
5. Confirmation page, account page and email read the snapshot; old orders fall back to `estimatedDelivery`.
6. Chat, WhatsApp and voice answers about these products use the approved estimate, pass `replyIsGrounded`, and never state an unapproved duration.
7. Feed availability equals the approved `merchantAvailability`, with a date when required; the feed check passes.
8. No duration or date appears anywhere while `approval.status !== "approved"`.
9. Compass engraving data follows the approved workflow (collection, validation, storage, display).
10. All fulfilment dates are calculated and displayed in the approved time zone, with boundary tests.

---

## 15. Explicit approval gates

| Area | Decision/status | Evidence | Pending input | Implementation authorized? |
|---|---|---|---|---|
| Single product fulfilment record | Approved in principle | Ahmad's decision; §5 | Final field names | **No** |
| Order snapshot | Approved in principle | `lib/orders.ts:57, 103-111`; §6 | Approval of design | **No** |
| Four customer touchpoints consistent | Approved in principle | §4, §7 | Wording, timings | **No** |
| AI assistant alignment | Approved in principle; current text 7–12 business days (confirmed existing) | `lib/ai/answer.ts:20-21` | Policy wording | **No** |
| Merchant feed separate | Approved in principle; current `preorder` without date (confirmed existing) | `lib/ai/growth.ts:27`; `lib/ai/feed.ts` | Spec check, treatment | **No** |
| MM-WHL-036 timings and treatment | Pending business decision | `lib/products.ts:534-555` | All values | **No** |
| MM-DEC-030 timings and treatment | Pending business decision | `lib/products.ts:723-745` | All values | **No** |
| MM-CUS-001 model and engraving | Pending business decision | `lib/products.ts:771-794`; `page.tsx:395` | Retail/OEM; engraving workflow | **No** |
| Time zone `+05:30` | Pending business decision (proposed only) | `lib/sale-time.ts:6-8` (sale dates only) | Approval | **No** |
| `lib/fulfilment.ts` and schema fields | Proposed technical design | §5–6 | Approval | **No** |
| Email verification | Proposed | `lib/orders.ts:307-330` | One-time test recipient | **No** |
| Production deployment | Not authorized | — | Separate approval | **No** |

**STOP:** nothing proceeds without Ahmad's product-wise decisions and separate written implementation authorization.
