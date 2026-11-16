# Marina Muse International — Pre-order Product Fulfilment Review

**Prepared for:** Ahmad · **Prepared by:** Ali · **Date:** 15 November 2026 · **Type:** read-only inspection.
- No code, data, feed, configuration or database was changed.
- No provider, credential or production resource was accessed.

Line numbers refer to the current working tree.

---

## 1. Executive summary
- All three products are defined only by `stock: "made-to-order"` in the bundled catalogue (`lib/products.ts`). **None has an availability date, a lead-time field or product-specific shipping data**; the product model has no such fields.
- **Storefront:** shows the label "Made to order". It also shows the same generic retail delivery promise as every other product: "Estimated delivery by 7-12 business days, if you order today".
- **Checkout:** accepts the three products like any in-stock product and records a generic estimated delivery of **today + 5 to today + 12 calendar days** on every order.
- **Google feed:** sends `preorder` for them and **no date**; the feed code has no date field.
- **Text evidence:** only one product description states a production time: Captain's Helm, "Made to order in 12–18 days". The Custom Engraved Compass story says "Production from 12 days". These are **marketing text, not configured fulfilment rules**, and they conflict with the 7–12 business-day storefront promise.
- **No confirmed shipping lead time exists in the project for any of the three products.**
- **Time zone:** `+05:30` exists as the default shop time zone for **sale dates only** (`lib/sale-time.ts`). No availability or delivery date uses it.

| Product | Product ID | Current status | Availability date | Shipping lead time | Evidence | Business confirmation needed |
|---|---|---|---|---|---|---|
| Captain's Helm 36" | MM-WHL-036 | `stock: "made-to-order"` (`lib/products.ts:540`); feed `preorder`; page label "Made to order" | **None** (no field exists) | **Unknown (not configured).** Inferred from description: "Made to order in 12–18 days" (`lib/products.ts:551`), production time only, shipping not included. Conflicts with the page's "7-12 business days" | `lib/products.ts:534-555`; `app/product/[slug]/page.tsx:181,461`; `lib/ai/growth.ts:27` | Yes: production time, shipping time, total; which treatment |
| Vintage Diving Helmet | MM-DEC-030 | `stock: "made-to-order"` (`lib/products.ts:729`); feed `preorder`; label "Made to order" | **None** | **Unknown.** Description says only "Made to order." (`lib/products.ts:741`), no duration | `lib/products.ts:723-745`; same page and feed references | Yes: all timings and the treatment |
| Custom Engraved Compass | MM-CUS-001 | `stock: "made-to-order"` (`lib/products.ts:777`); collection `custom-manufacturing`; feed `preorder`; label "Made to order" | **None** | **Unknown.** Inferred from story: "Proof in 48 hours. Production from 12 days." (`lib/products.ts:790`), a minimum production time for OEM programmes with MOQ 50, not a retail shipping lead time | `lib/products.ts:771-794`; same references | Yes: retail single-unit timing versus OEM timing, plus the treatment |

---

## 2. Inspection scope and limitations
- **Inspected:**
  - catalogue and product type: `lib/products.ts`, `lib/db/types.ts`, `lib/product-fields.ts`, `lib/storefront-catalog.ts`
  - storefront: `app/product/[slug]/page.tsx`, `components/ProductCard.tsx`, `components/CatalogCard.tsx`
  - orders and checkout: `lib/orders.ts`, `app/api/paypal/order/route.ts`, `app/checkout/confirmation/page.tsx`, `app/account/orders/page.tsx`
  - feed: `lib/ai/growth.ts`, `lib/ai/feed.ts`, `app/feeds/google.xml/route.ts`
  - policy text: `lib/ai/answer.ts`
  - time zone: `lib/sale-time.ts`, the env registry
  - static pages: `/shipping`, `/about`, `/returns`, `/collections`
  - earlier reports
- **Limitation 1: production data.** The storefront merges the bundled catalogue with database products (`lib/storefront-catalog.ts:130-154`, `mergeStorefrontProducts`). The **production database was not inspected**, so production may hold edited stock values or descriptions for these products, or additional products marked `made-to-order`. The local test database holds only 3 synthetic test products.
- **Limitation 2: no business source.** No operations document, supplier schedule or ShipGlobal service-level data exists in the repository, so nothing can be confirmed beyond the code and text above.

---

## 3. Product-by-product findings

### Captain's Helm 36" — MM-WHL-036 (`lib/products.ts:533-555`)
- **Identity:** slug `ship-wheel-36`; collection `ship-wheels`; price USD 279; wholesale from USD 168, MOQ 4.
- **Physical:** material teak and brass; 36" diameter; 7.8 kg; packaging "Export crate".
- **Stock:** `made-to-order`. No `quantity`, so no stock count; no `b2cOutOfStock`.
- **Availability date / lead-time field:** none.
- **Shipping data:** none product-specific; `packaging` and `weight` exist. Not marked free shipping, as far as the definition shows (no `freeShipping` field).
- **Customisation:** no `personalisationPrice`, so no personalisation option.
- **Timing text:** description "Made to order in 12–18 days" (`:551`).

### Vintage Diving Helmet — MM-DEC-030 (`lib/products.ts:722-745`)
- **Identity:** slug `diving-helmet-decor`; collection `nautical-decor`; badge "Atelier"; price USD 249; wholesale from USD 155, MOQ 4.
- **Physical:** brass and copper; 18" high; 8.5 kg; "Export crate"; includes a display stand.
- **Stock:** `made-to-order`. No quantity.
- **Date, lead time, shipping, customisation fields:** none.
- **Timing text:** "Made to order." with no duration (`:741`).

### Custom Engraved Compass — MM-CUS-001 (`lib/products.ts:770-794`)
- **Identity:** slug `custom-engraved-compass`; collection `custom-manufacturing`; badge "Custom"; price USD 49; wholesale from USD 16, **MOQ 50**.
- **Physical:** solid brass; dimensions "As specified"; weight "From 180 g"; packaging "Your packaging or ours".
- **Includes:** "Sample on request", "Logo proof", "Production".
- **Stock:** `made-to-order`. No quantity.
- **Date or lead-time field:** none.
- **Customisation:** engraving is the product itself (logo, crest or coordinates), but there is **no personalisation field or price** (`personalisationPrice` unset). The engraving content would need to be captured outside checkout.
- **Timing text:** "Proof in 48 hours. Production from 12 days." (`:790`).
- **Note:** this listing reads as an OEM or custom programme (MOQ 50, proofing) while also being sold as a USD 49 retail item. Business confirmation is needed on how a single retail unit is fulfilled.

---

## 4. Current storefront availability behaviour
- **Stock label:** `app/product/[slug]/page.tsx:181`. "Made to order" when `stock === "made-to-order"`, unless a quantity alert applies; otherwise "In Stock".
- **Delivery promise (retail, non-wholesale branch):** `app/product/[slug]/page.tsx:455-462`, "Arrives soon! Estimated delivery by **7-12 business days**, if you order today", shown for **every** retail product, these three included. Wholesale pages show a different branch.
- **Cart and checkout:** `pricedItemsAsync` (`lib/orders.ts:206-235`) excludes a line only when `b2cOutOfStock`, `b2bOutOfScope`, or a numeric stock ≤ 0. `made-to-order` items have no quantity, so they are **purchasable like in-stock items**. There is no made-to-order notice or separate estimate at checkout.
- **Order delivery estimate:** `estimatedDelivery()` (`lib/orders.ts:103-111`) returns **today + 5 to today + 12 calendar days**, formatted `en-GB`, using the server's local clock (no shop time zone). It is stored on every PayPal order (`app/api/paypal/order/route.ts:63`) and shown on the confirmation page, in the account page and in the confirmation email (`lib/orders.ts:327`).
- **Approved AI policy text** (`lib/ai/answer.ts:20-21`): "Retail product pages show an estimated delivery of 7–12 business days." The manufacturing policy (`:26-27`) forbids the assistant from promising a production time.
- **Inconsistencies (confirmed in code):**
  - page promise 7–12 **business** days;
  - order record 5–12 **calendar** days;
  - helm description 12–18 days for **production** alone.

---

## 5. Current feed availability behaviour
- **Function:** `buildMerchantFeed()` in `lib/ai/growth.ts:16-30`, served at `/feeds/google.xml`, using retail storefront products.
- **Value sent:** `availability: product.stock === "made-to-order" ? "preorder" : product.quantity === 0 ? "out_of_stock" : "in_stock"` (`lib/ai/growth.ts:27`). All three products get `preorder`.
- **Storefront versus feed:** the storefront says "Made to order" but still sells the products and promises 7–12 business days. The feed tells Google `preorder`. **The two differ in meaning.**
- **Date support:**
  - `FeedItem` (`lib/ai/feed.ts:1-10`) has no date field.
  - `googleMerchantXml()` (`lib/ai/feed.ts:70-106`) writes `g:availability` but **never** `g:availability_date`.
  - `feedItemErrors()` does not check for a date.
  - The missing date was found only by the local check script (`reports/evidence/growth/dev-feed-check.mjs:22-23`), which fails 1 of 11 checks.
- **Data-only versus code changes:**
  - Changing to `in_stock` can be done **through data alone**, by changing `stock` to `"in-stock"`, which also changes the storefront label.
  - Excluding from the feed, or adding a date or lead time, **requires code changes** (section 8).

---

## 6. Shipping and fulfilment evidence

| Evidence | Classification | Source |
|---|---|---|
| Retail delivery promise "7-12 business days" on every retail product page | **Confirmed in code** (displayed text), but generic, not per product; whether it is correct for made-to-order items is not confirmed | `app/product/[slug]/page.tsx:461`; `lib/ai/answer.ts:21` |
| Order record estimate today + 5 to + 12 calendar days | **Confirmed in code**, generic | `lib/orders.ts:103-111` |
| Dispatch location Roorkee, Uttarakhand; air parcels through ShipGlobal; sea freight | **Confirmed** (site text), no durations | `app/shipping/page.tsx:9,13,67` |
| Captain's Helm "Made to order in 12–18 days" | **Inferred:** product copy, production only, not configured | `lib/products.ts:551` |
| Compass "Proof in 48 hours. Production from 12 days." | **Inferred:** product copy, OEM context, minimum only | `lib/products.ts:790` |
| Diving Helmet duration | **Unknown** | `lib/products.ts:741` |
| Transit time after production, per destination | **Unknown** | none |
| Wholesale timeline | "confirmed after order review" (policy text) | `lib/ai/answer.ts:21` |

**Conclusion:** the project does **not** establish a shipping lead time for any of the three products. Ahmad must confirm the timings.

---

## 7. Time-zone findings
- **`+05:30` exists:**
  - as the default in `lib/sale-time.ts:6-8` (`NEXT_PUBLIC_SHOP_UTC_OFFSET` if valid, otherwise `+05:30`);
  - documented in the env registry (`lib/ai/env-registry.ts:67`: "Shop time zone for sale dates, default +05:30 (India)");
  - as a commented line in `.env.example` (`# NEXT_PUBLIC_SHOP_UTC_OFFSET=+05:30`).
- `.env.local` does not set it (name check only), so local development uses the `+05:30` default.
- **Used only for sale start and end dates** (`lib/sale-time.ts`). Not used by `estimatedDelivery()`, which uses the server clock and `toLocaleDateString`, nor by the feed (no dates), nor by any product availability.
- **Conclusion:** applying `+05:30` to availability dates would be **new behaviour**, pending Ahmad's confirmation.

---

## 8. Code changes required for each possible treatment (not implemented)

| Treatment | Data change | Code change | Tests / evidence |
|---|---|---|---|
| **A. Fixed availability date per product** | New field on the product (e.g. `availableFrom`, ISO date) for the three products | Add the field to `Product` (`lib/products.ts:20` area) and `lib/db/types.ts:125` area, plus admin form (`lib/product-fields.ts`). Add `availabilityDate` to `FeedItem`; emit `<g:availability_date>` in `googleMerchantXml` with the `+05:30` offset (e.g. `2026-12-15T00:00+05:30`) through a helper shared with `lib/sale-time.ts`. Validation in `feedItemErrors`: `preorder` requires a date. Optionally show the date on the product page and use it in `estimatedDelivery`. | Feed unit checks; feed check 11/11; product-page check; expired-date behaviour |
| **B. Lead time (N days) per product** | New field (e.g. `leadTimeDays`) | Same model and admin changes. Feed computes date = today + N in the shop time zone and emits it. Product page and order estimate should use N plus transit instead of the generic 7–12 / 5–12. | Same as A; date arithmetic around midnight IST |
| **C. List as in stock** | Change `stock` to `"in-stock"` for the three products (bundled catalogue and/or database) | None for the feed. The page label changes to "In Stock", and the generic 7–12 business-day promise then applies unchanged. | Feed check 11/11 (no pre-order items); review whether 7–12 business days is achievable |
| **D. Exclude from the feed** | Optionally a flag such as `excludeFromFeed` | Filter in `buildMerchantFeed()` (`lib/ai/growth.ts:16-30`), either on the flag or on `stock === "made-to-order"`. Storefront unchanged. | Feed item count drops by 3; feed check 11/11 |

**Independent of the treatment (separate decision):** the storefront's 7–12 business-day promise and the 5–12 calendar-day order estimate apply to made-to-order items today. If production plus shipping takes longer, the page and the confirmation email understate delivery. That would need its own approved change: a per-product estimate, or a made-to-order message.

---

## 9. Questions requiring Ahmad's confirmation
1. For each product: actual **production time** (working or calendar days), **dispatch-to-delivery transit time** (main destinations), and whether the 7–12 business-day promise is correct.
2. Which treatment applies per product: A fixed date, B lead time, C in stock, or D exclude.
3. **Custom Engraved Compass:** is it sold as a single retail unit at USD 49, or only as an OEM programme (MOQ 50, proof first)? How should the engraving text or logo be captured, given that checkout has no personalisation field for it?
4. Confirm `+05:30` (India) as the time zone for any availability date.
5. Should the product page and order confirmation show a made-to-order-specific estimate instead of the generic one?
6. Does production hold different `stock` values or descriptions for these products, or other made-to-order products? This can only be checked with production access, which is separately authorized.

---

## 10. Final recommendation
- Confirm real timings first (question 1). The current text gives three different, unverified durations, and none is a configured rule.
- **If a reliable lead time exists:** treatment **B** keeps Google listings accurate without a manual date per product, and can also fix the storefront estimate.
- **If production is fast enough to meet the existing 7–12 business-day promise:** treatment **C** is the smallest change (data only).
- **D** is the safe interim option if timings cannot be confirmed soon.
- **A** suits one-off stock events, but needs updating as dates pass.
- The decision, and the confirmation of `+05:30`, stay with Ahmad. Nothing has been changed.
