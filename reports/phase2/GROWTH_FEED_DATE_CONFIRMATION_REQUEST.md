# Request: availability dates for 3 made-to-order products

**10 November 2026.**

**What happens now.** The Google Shopping feed marks these products **pre-order**, because their catalogue status is `stock: "made-to-order"`. Google requires an `availability_date` for every pre-order item, so they fail the feed check: 1 of 11 checks, `phase2/growth-feed-check-isolated-20261110T1633Z.log`.

**What I have not done:**
- No date has been invented.
- No product availability has been changed.
- No test expectation will change until you confirm.

| SKU | Product | Product page | Price (USD) | Source |
|---|---|---|---|---|
| **MM-WHL-036** | Captain's Helm 36" | `/product/ship-wheel-36` | 279 | `lib/products.ts:536` |
| **MM-DEC-030** | Vintage Diving Helmet | `/product/diving-helmet-decor` | 249 | `lib/products.ts:725` |
| **MM-CUS-001** | Custom Engraved Compass | `/product/custom-engraved-compass` | 49 | `lib/products.ts:773` |

## Please confirm for each product

1. **Lead time** (for example "ships 21 days after order"). The feed would then send `availability_date` = feed date + lead time.

   **or**

2. **A fixed date** when stock will be available.

   **or**

3. Whether it should be listed as **in stock** (made on demand within normal shipping times), or **out of stock**.

Once you reply, I'll update the feed logic or the test expectation to match, and re-run the feed check.
