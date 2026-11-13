# Google Merchant Center: scheduled fetch of the Shopping feed

The site publishes its product feed at **`https://marinamuseinternational.com/feeds/google.xml`**. It is built on each request from the live catalogue (retail prices in USD) and needs no login. Merchant Center reads it on a schedule; nothing in the site uploads to Google.

Nothing below has been set up. It needs the client's Merchant Center account and approval.

## Before the first fetch

Deploy the feed fixes of 9 Nov 2026 first. The live feed still has these faults (`reports/evidence/growth/feed-validation-20261109T0737Z.log`):

| Live feed fault | Items | Fixed in code (not deployed) |
| --- | --- | --- |
| Item id longer than Google's 50-character limit | 109 | yes, ids now ≤ 50 characters, unique and stable |
| Duplicate id `MM-BIN-TR-01` (two different binoculars) | 2 | yes, a repeated SKU falls back to a slug-based id |
| Title longer than 150 characters | 17 | yes, cut at the last whole word |
| No GTIN / MPN / `identifier_exists` | 340 | yes, `identifier_exists=no` (handmade own-brand products) |

The fixed feed was regenerated locally and re-validated: 340 items, 0 ids over 50 characters, 0 duplicates, longest title 150 (`feed-validation-local-fixed-20261109T0738Z.log`).

Ids change with this fix. That is harmless only because nothing has been uploaded to Merchant Center yet. **Do not change ids again after the first fetch:** Merchant Center treats a new id as a new product and loses its history.

**Still needs a client decision** (each affects approval in Merchant Center):

1. **Product photos:** 212 of 340 items use stock photos from Pexels or Unsplash. Google requires images of the actual product and can suspend the account for misrepresentation. Replace them with real product photos before the first fetch, or leave those items out of the feed.
2. **Made-to-order items:** 3 items are sent as `preorder`, which Google rejects without an `availability_date`. Choose one:
   - give a date;
   - send them as `in_stock` with a longer handling time in shipping settings;
   - leave them out.
3. **Thin descriptions:** 45 items have a description that only repeats the title. Write real descriptions.
4. **Shipping and returns:** the feed has no per-item shipping, so set them at account level (below).

## Setting up the scheduled fetch

In [Merchant Center](https://merchants.google.com), signed in with the client's Google account:

1. **Business info:** verify and claim `marinamuseinternational.com` (Search Console verification can be reused, because the site is already verified as `sc-domain:marinamuseinternational.com`).
2. **Shipping and returns:** add a shipping service for each target country (rates, handling time, transit time) and a return policy matching `/returns`.
3. **Products → Add products → Add products from a file → Enter a link to your file:**
   - File URL: `https://marinamuseinternational.com/feeds/google.xml`
   - Fetch frequency: **Daily**, at a time after the catalogue is usually edited (e.g. 03:00 IST)
   - Country of sale: the target countries
   - Language: English
   - Currency: **USD**
   - Leave username and password empty (the feed is public)
4. Press **Fetch now** once and check **Products → Diagnostics** before relying on the daily schedule.

## After the first fetch

- **Diagnostics:** fix item-level issues in the catalogue, not in Merchant Center. The next scheduled fetch picks the fixes up.
- **Price and availability** come from the live catalogue at fetch time. A sale or stock change appears after the next fetch, so prices can lag by up to a day. Google may flag mismatches it detects on the product page in between.
- **Monitoring:** `/test` shows the feed card (item count and items with errors). The daily owner report shows "Merchant Center upload: not connected" until the code is told otherwise. `merchantConnected` is hard-coded to `false` in `lib/ai/daily-report.ts`, and there is no Merchant Center API integration to read fetch status.

## Not in scope / needs approval

- Google Ads, Shopping campaigns or any paid listing: not set up, needs separate approval and billing.
- The Merchant Center Content API (automatic upload and status read-back): not built.
