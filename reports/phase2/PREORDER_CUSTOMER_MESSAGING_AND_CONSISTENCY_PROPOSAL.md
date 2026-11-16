# Marina Muse International — Made-to-Order Customer Messaging and Consistency Proposal

**Prepared for:** Ahmad · **Prepared by:** Ali · **Date:** 15 November 2026 · **Type:** planning document only.
- Nothing has been implemented.
- Product data, stock status, feed logic, checkout, emails and pages are unchanged.

**Baseline (unchanged, read-only):** `reports/phase2/PREORDER_PRODUCT_FULFILMENT_REVIEW.md`

Labels used throughout: **[CONFIRMED]** existing behaviour in code · **[PENDING]** business decision not yet made · **[PROPOSED]** future behaviour, not implemented · **[TECH]** implementation requirement.

---

## 1. Executive summary
- **Problem:** the three products are labelled "Made to order" [CONFIRMED], but every customer touchpoint repeats a generic in-stock style promise.
  - The page says "7–12 business days" [CONFIRMED].
  - The order record says today + 5 to + 12 calendar days [CONFIRMED].
  - Checkout shows no estimate at all [CONFIRMED].
  - Google receives `preorder` without a date [CONFIRMED].
- **Proposal:** one approved fulfilment record per product drives all five touchpoints.
  - The order stores a snapshot of what the customer was told at purchase.
  - Until timings are confirmed, the customer sees neutral made-to-order wording with **no duration or date**.
- **Unchanged for now** (per Ahmad's instruction): product data, stock status and the Google Merchant feed.

---

## 2. Existing baseline findings (from the baseline report, re-checked in code)

| Touchpoint | Current behaviour [CONFIRMED] | Source |
|---|---|---|
| Product data | `stock: "made-to-order"`; no date, lead-time or fulfilment field | `lib/products.ts:540, 729, 777`; type at `lib/products.ts:20`, `lib/db/types.ts:125` |
| Product page | Label "Made to order"; plus, for every retail product, "Estimated delivery by 7-12 business days, if you order today" | `app/product/[slug]/page.tsx:181, 455-462` |
| Checkout | Order summary lists items; **no delivery or made-to-order message**; made-to-order items purchasable like in-stock items | `app/checkout/page.tsx:145-160`; `lib/orders.ts:206-235` |
| Order record | One string `estimatedDelivery` = today + 5 to + 12 calendar days, set once at order creation (already a snapshot, but generic) | `lib/orders.ts:57, 103-111`; `app/api/paypal/order/route.ts:63` |
| Order confirmation page | Shows `estimatedDelivery` | `app/checkout/confirmation/page.tsx:96-97` |
| Account orders page | Shows `estimatedDelivery` | `app/account/orders/page.tsx:105` |
| Confirmation email | Plain text including `Estimated Delivery: ${order.estimatedDelivery}` (SMTP; not sent outside production) | `lib/orders.ts:307-330` |
| Google feed | `preorder` for made-to-order; no `availability_date` emitted | `lib/ai/growth.ts:27`; `lib/ai/feed.ts:1-10, 70-106` |
| AI assistants | Approved shipping text "7–12 business days"; may not promise production times | `lib/ai/answer.ts:20-27` |
| Time zone | `+05:30` default for sale dates only | `lib/sale-time.ts:6-8` |

**Not established [PENDING]:**
- production time, transit time and total delivery window for any of the three products;
- the per-product treatment;
- the time zone for fulfilment dates;
- how the Custom Engraved Compass is sold and personalised.

The description texts ("12–18 days" for the helm, "Production from 12 days" for the compass) are **inferred, not confirmed**, and are not used below.

---

## 3. Proposed customer-facing messages [PROPOSED]

Placeholders in `{{…}}` are inserted **only after** Ahmad approves the timing. Until then, the "before confirmation" variant is used, which contains **no duration or date**.

**1. Short product-page message**
- Before confirmation: *"Made to order — crafted after you order. Additional production and dispatch time applies."*
- After confirmation: *"Made to order — usually dispatched within {{production_window}}, then {{transit_window}} for delivery."*

**2. Detailed product-page explanation**
> This piece is made to order in our workshop in India. Production begins after your order is confirmed, so it is not shipped from ready stock and takes longer than our in-stock items. Every piece is inspected and securely packed before dispatch.
>
> *Before timings are confirmed:* We will email you an estimated dispatch and delivery window shortly after your order is confirmed.
>
> *After timings are confirmed:* Typical production time: {{production_window}}. Typical delivery after dispatch: {{transit_window}}. Estimated delivery: {{delivery_window}} from your order date. You will receive tracking details when your order ships.

**3. Short checkout message** (beside each made-to-order line and above the pay button)
- Before confirmation: *"Made to order: this item is produced after purchase and will not ship immediately. We will email your estimated delivery window after your order is confirmed."*
- After confirmation: *"Made to order: estimated delivery {{delivery_window}} from today. This is an estimate, not a guaranteed date."*

**4. Order-confirmation message** (confirmation page and account order view)
- Before confirmation: *"Your order includes made-to-order items. They will be produced for you before dispatch. We will email your estimated delivery window soon."*
- After confirmation: *"Your order includes made-to-order items. Estimated delivery: {{delivery_window_at_purchase}} (estimate given when you ordered)."*

**5. Proposed email notification text**
> Subject: Your Marina Muse order {{order_id}} — made to order
>
> Thank you for your order. {{item_names}} {{is_are}} made to order in our workshop, so production starts now that your payment is confirmed.
>
> *Before timings are confirmed:* We will email you an estimated dispatch and delivery window shortly.
>
> *After timings are confirmed:* Estimated production: {{production_window}}. Estimated delivery: {{delivery_window_at_purchase}}. These are estimates; we will tell you promptly if anything changes, and you will receive tracking details when it ships.
>
> Questions? Reply to this email or contact {{support_contact}}.

**Wording rules:**
- never "in stock", "ships today" or "arrives soon" for made-to-order lines;
- never a specific calendar date unless an approved fixed date exists;
- always the word "estimate" next to any window.

---

## 4. Five-touchpoint consistency plan [PROPOSED]

**Principle:** one approved fulfilment record per product generates every message. The order keeps a frozen copy of what was shown at purchase.

| Touchpoint | Shows | Source | Rule |
|---|---|---|---|
| A. Product page | Made-to-order label; short message; detailed explanation; delivery window once approved | Product fulfilment record | Replace the generic "7–12 business days" line for made-to-order products only; in-stock products unchanged |
| B. Checkout | The same short message per made-to-order line, plus an order-level notice; the same window text as the product page | The **same** record, re-read at checkout time | Identical window text to A; if the record changed since the customer viewed the page, checkout shows the current approved text before payment |
| C. Order confirmation | The delivery text exactly as shown at checkout | **Order snapshot** written when the order is created | Never recomputed from current product settings; later changes do not alter an existing order's original promise. A revised estimate is added as a separate, dated note |
| D. Email | The same snapshot text as C | Order snapshot | Same template variables as C; a later "revised estimate" email only by explicit action, and the original promise stays on record |
| E. Google Merchant feed | Availability from the approved Merchant mapping, independent of the customer message | Product record field `merchantAvailability` (+ date when required) | Changed only after Ahmad approves the treatment **and** the current Merchant specification is checked |

**Merchant availability values (to be verified against Google's current specification before any change):**

| Value | Meaning | Note |
|---|---|---|
| `in_stock` | Can be shipped within normal handling time | Only if the approved made-to-order window fits the store's normal shipping promise |
| `preorder` | Not yet available; available from a future date | Google expects an `availability_date`; current feed sends none [CONFIRMED gap] |
| `backorder` | Temporarily out of stock, will ship later | Also expects an `availability_date`; not used by the code today |
| `out_of_stock` | Not available | Used today only when quantity is 0 |
| "made to order" | Not a separate availability value in the specification as currently understood | Usually expressed as `in_stock` with a longer handling time, or `preorder` with a date. **Must be verified; no change recommended until Ahmad decides** |

A customer-facing message does **not** set Merchant availability. The feed stays unchanged until a separate, approved decision.

---

## 5. Proposed single source of truth [PROPOSED — not implemented, no schema change made]

**Product-level fulfilment record**, one per product, maintained in admin:

| Field | Type / example | Purpose |
|---|---|---|
| `fulfilmentType` | `in_stock` \| `made_to_order` \| `custom_oem` | Which messaging applies |
| `productionDays` | `{ min, max, unit: "business" \| "calendar" }` or null | Production lead time |
| `transitDays` | `{ min, max, unit }` or null (optionally per destination region) | Shipping estimate |
| `deliveryWindow` | derived `{ min, max }` = production + transit, or an approved override | Customer promise |
| `timeZone` | e.g. `+05:30` (pending) | Date calculation and display |
| `availableFrom` | ISO date or null | Only for a fixed-date treatment |
| `merchantAvailability` | `in_stock` \| `preorder` \| `backorder` \| `out_of_stock` \| `exclude` | Feed mapping, decided separately |
| `customerMessageKey` | which approved template variant | Ensures identical wording |
| `approvalStatus` | `pending` \| `approved` + `approvedBy`, `approvedAt` | Unapproved timings are never shown |
| `effectiveFrom` | ISO timestamp | When the approved values start to apply |

**Order-level snapshot**, written once at order creation and never recalculated:
- per line: `fulfilmentType`;
- the exact delivery text shown at checkout;
- `deliveryWindow` min/max;
- `estimatedDeliveryRange` as dates computed in the approved time zone;
- `fulfilmentRecordVersion` / `effectiveFrom`;
- `snapshotAt`.

**Revisions:** later updates to an order's estimate go into a separate `deliveryUpdates[]` history (date, new estimate, reason, sent-to-customer flag), so the original promise is preserved.

**Placement:** product data holds the current approved rules; orders hold what the customer was promised. The existing `estimatedDelivery` string (`lib/orders.ts:57`) would remain for in-stock orders and old orders.

---

## 6. Product-by-product business decision table

| Product | Fulfilment type | Production lead time | Shipping lead time | Customer delivery promise | Merchant availability |
|---|---|---|---|---|---|
| MM-WHL-036 | Pending | Pending | Pending | Pending | Unchanged |
| MM-DEC-030 | Pending | Pending | Pending | Pending | Unchanged |
| MM-CUS-001 | Pending | Pending | Pending | Pending | Unchanged |

**Decisions required before implementation:**
1. Fulfilment type for each product (made to order; for MM-CUS-001 also retail single unit versus OEM programme, MOQ 50).
2. Production lead time (business or calendar days, range).
3. Shipping or transit lead time (by destination if it differs).
4. Whether customer estimates are shown as ranges.
5. Time zone (`+05:30` proposed, **not approved**).
6. Merchant availability treatment per product, after the specification check.
7. Approval of the customer-facing wording in section 3, both variants.
8. Implementation scope (which touchpoints, and whether the generic 7–12 business-day line changes for made-to-order items only).
9. MM-CUS-001: how engraving content is collected (checkout has no field today).

---

## 7. Implementation sequence (only after separate written approval)

| # | Step | Code areas | Risks |
|---|---|---|---|
| 1 | Business fulfilment decisions | — | Unverified timings promised to customers |
| 2 | Approved fulfilment data model | `lib/products.ts:20`, `lib/db/types.ts:125`, `lib/product-fields.ts`, admin product editor (`components/AdminProductList.tsx`, `app/api/admin/products/*`), `lib/storefront-catalog.ts` merge | Bundled catalogue versus database overrides (`mergeStorefrontProducts`); production records not yet inspected |
| 3 | Product-page messaging | `app/product/[slug]/page.tsx:181, 455-462` | Changing the generic line for all products by mistake; mobile layout |
| 4 | Checkout messaging | `app/checkout/page.tsx:145-160`; cart (`lib/cart-context.tsx`) | Cart holds product data from the client; must re-read the record server-side |
| 5 | Order-level snapshot | `lib/orders.ts` (`OrderRecord`, `pricedItemsAsync`, `estimatedDelivery`), `app/api/paypal/order/route.ts:63` | Snapshot must be server-computed, not trusted from the client; old orders lack it |
| 6 | Order confirmation | `app/checkout/confirmation/page.tsx:96-97`, `app/account/orders/page.tsx:105`, `publicOrder` | Display fallback for orders without a snapshot |
| 7 | Transactional email | `lib/orders.ts` `sendOrderConfirmation` (SMTP; not sent outside production) | Email verification needs an authorized test recipient (one-time approval) |
| 8 | Google Merchant feed mapping | `lib/ai/growth.ts:16-30`, `lib/ai/feed.ts` (add `availability_date` if required), `reports/evidence/growth/dev-feed-check.mjs` | Spec mismatch causing disapproval; date in the wrong time zone; stale fixed dates |
| 9 | Automated consistency tests | `lib/ai/selftest.ts`, `scripts/check-phase2.ts`, a new feed/messaging check | Assert the same text across page, checkout, snapshot and email for a made-to-order fixture; in-stock unchanged |
| 10 | Staging verification | Isolated server (port 3939) + local test DB; browser review like `ui-review-recovery.mjs` | No real payment or email in staging |
| 11 | Production deployment | — | **Separate written approval** (G5) |

---

## 8. Risks and validation requirements
- **Over-promising:** showing any duration before approval. Validation: messages render only when `approvalStatus=approved`; otherwise the neutral variant.
- **Inconsistency:** different text on the page, at checkout and in the email. Validation: one template source; automated test comparing all three for the same fixture.
- **Promise drift:** an existing order's estimate changing after a settings update. Validation: snapshot test; a revision only through `deliveryUpdates`.
- **Feed rejection:** `preorder` without a date, or a wrong value. Validation: re-check Google's current specification; feed check 11/11; Merchant diagnostics after the scheduled fetch (client account).
- **Time-zone errors:** dates shifting near midnight. Validation: tests around the 00:00 `+05:30` boundary.
- **Data source mismatch:** database overrides of bundled products in production. Validation: read-only production inspection under separate approval.
- **AI assistant drift:** the approved policy text still says 7–12 business days. It must be updated in step with the page (`lib/ai/answer.ts:20-27`) under the same approval.

---

## 9. Explicit pending approvals
1. Business timings and treatment per product (section 6).
2. Customer-facing wording (section 3).
3. Time zone `+05:30` (proposed only).
4. Merchant availability treatment, after the specification check.
5. The fulfilment data model and implementation scope (sections 5 and 7).
6. Email testing with an authorized recipient (one-time).
7. Staging run, then separate production deployment approval.

Nothing in this document has been implemented. The baseline report, product data, feed, checkout, confirmation, email and pages are unchanged.
