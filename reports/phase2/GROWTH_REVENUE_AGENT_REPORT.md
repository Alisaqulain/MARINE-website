# Agent 3: Growth & Revenue — isolated development and test report

**10 November 2026, 16:40 UTC.** Scope: isolated development and testing only.

**Not done:**
- No Google API was called; no analytics property, feed or marketing setting was changed.
- No e-mail was sent; no Gemini request was made.
- The old service-account key and GA4 secret (exposed) were not used. They are blanked in the isolated environment.

Evidence paths are relative to `reports/evidence/`.

## Summary

| | Status |
|---|---|
| Development | **Complete.** GA4 Data API reports, Search Console performance, revenue attribution, daily owner report, shopping feed, scheduler (cron) authentication, health reporting |
| Isolated configuration | **Complete.** Fresh synthetic `CRON_SECRET` per session; owner mail impossible (no SMTP; `OWNER_ALERT_EMAILS` empty); Gemini blank |
| Isolated tests (no Google) | **Cron 9/9 PASS** (1 skipped: needs Gemini). **Feed 10/11** (1 known content failure). Webhook cron checks 4/4 |
| GA4 and Search Console read-only tests | **BLOCKED.** The dedicated service account does not exist yet (instructions in section 3) |
| Completion (verifiable) | Development 100%. Isolated tests without Google: done. **Google read-only tests 0% (blocked)** |
| Production readiness | **Not ready.** GA4 tag not on the live site (rebuild needed), production scheduler not set up, 3 feed items need dates (client) |

## 1. Exact Google access the code needs (verified in the source)

| Use | API (endpoint in code) | OAuth scope (`lib/google/auth.ts:9-10`) | Property permission |
|---|---|---|---|
| GA4 traffic, landing pages and revenue reports | **Google Analytics Data API v1beta**: `properties/{GA4_PROPERTY_ID}:runReport` (`lib/google/analytics.ts:28`) | `https://www.googleapis.com/auth/analytics.readonly` | GA4 property **Viewer** |
| Search performance | **Search Console API (webmasters v3)**: `/webmasters/v3/sites…` (`lib/google/search-console.ts:17`) | `https://www.googleapis.com/auth/webmasters.readonly` | Search Console user, **Restricted** |

**Authentication.** A service-account JWT signed with Node crypto, with no Google SDK and no personal Google login. It reads `GOOGLE_SERVICE_ACCOUNT_JSON`, or `GOOGLE_SERVICE_ACCOUNT_EMAIL` plus `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (`lib/google/auth.ts`).

**Not needed:**
- **Merchant Center.** The code only generates `/feeds/google.xml`, and `lib/ai/health.ts:362` says "Merchant Center upload is not part of this build".
- **GA4 Measurement Protocol** (`GA4_API_SECRET`). This is write-side (purchase events), not part of read-only Growth testing.
- **Google Cloud IAM roles.** Access is granted inside GA4 and Search Console, not through Cloud IAM.

## 2. Tests executed (isolated server, port 3939, local test database)

| Test | Result | Evidence |
|---|---|---|
| Cron and scheduler, 9 checks (1 skipped) | **CRON VERIFIED 9/9:** test database has no leads or orders; follow-up job refuses missing and wrong tokens and runs with the correct one (run recorded); daily report refuses anonymous and wrong tokens; send refused without a test recipient (**no e-mail sent**, **no AI request**); refused send recorded as a failed run. **SKIP:** AI preview needs Gemini | `phase2/growth-cron-check-isolated-after-cleanup-20261110T1634Z.log` |
| First cron run | **1 FAIL, explained.** Precondition "no leads" failed because the WhatsApp webhook test had just created a synthetic lead. After removing the synthetic records it passed | `phase2/growth-cron-check-isolated-20261110T1633Z.log`, `phase2/cleanup-synthetic-test-data-*.log` |
| Shopping feed structure (230 items) | **10 PASS, 1 FAIL:** ids ≤ 50 characters and unique, titles ≤ 150, identifier, price, availability, image, link and condition present. **FAIL:** 3 pre-order items lack `availability_date`. This is the known **content decision** from 9 Nov (`MM-WHL-036`, `MM-CUS-001`, `MM-DEC-030`) | `phase2/growth-feed-check-isolated-20261110T1633Z.log` |
| Cron authentication in the webhook suite (C1–C4) | **4/4 PASS** | `phase2/webhook-tests-20261110T1633Z.log` |
| Mocked agent checks (GA4 and Search Console 4; journey and recommendations 9; attribution 10; daily report 6; feed 7) | **PASS** (within 251/251) | `phase2/check-phase2-20261110T*.log` |

## 3. Dedicated read-only service account: creation instructions

I don't have access to your Google Cloud project, and I won't use anyone's personal Google login. **The account has not been created, so its exact email address is not yet known.** Once it exists, please send me the email address. I'll confirm it here before asking you to grant any property access.

1. **Project.** In Google Cloud Console, choose a project you control. It can be the separate testing project.
2. **Enable the two APIs only** (APIs & Services → Library):
   - **Google Analytics Data API**;
   - **Google Search Console API**.
3. **Create the service account** (IAM & Admin → Service Accounts → Create):
   - suggested name: `marina-muse-growth-readonly`;
   - the email will then be `marina-muse-growth-readonly@<PROJECT_ID>.iam.gserviceaccount.com`;
   - grant **no** project roles; skip the "grant access" steps.
4. **Create a JSON key** (Keys → Add key → JSON).
   - Put it only into `.env.isolated-test.local` as `GOOGLE_SERVICE_ACCOUNT_JSON` (raw JSON, or base64 of it).
   - Never send it by chat or e-mail.
   - If an organisation policy blocks key creation (`iam.disableServiceAccountKeyCreation`), tell me and we'll agree an alternative.
5. **Send me the service-account email.** Then, after my confirmation, grant access:
   - **GA4:** Admin → Property access management → **Add user** → the service-account email → role **Viewer** (property level only).
   - **Search Console:** Settings → Users and permissions → **Add user** → the service-account email → **Restricted**, on the verified Marina Muse property only.
6. **Add the identifiers** to `.env.isolated-test.local`. Neither is secret:
   - `GA4_PROPERTY_ID`: the numeric id, not `G-…`;
   - `SEARCH_CONSOLE_SITE_URL`: `sc-domain:marinamuseinternational.com` or the URL-prefix form.

**Tests I'll run once access is granted** (read-only):
- one GA4 `runReport` (sessions, 7 days);
- the growth report queries;
- one Search Console performance query;
- the `/test` integration cards.

Nothing can be written: both scopes are read-only, and the permissions are Viewer and Restricted.

## 4. Remaining risks

- The GA4 tag is not on the live site; a production rebuild with `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is needed.
- The production scheduler is not set up; it needs deployment approval.
- The daily report's AI summary is untested live (needs the Gemini test key). Delivery is untested (needs an authorized test recipient).
- The old `GOOGLE_SERVICE_ACCOUNT_JSON` and `GA4_API_SECRET` were exposed. Delete that key in Google Cloud and issue a new GA4 secret (client).

---

## Update: 10 Nov 2026, 17:15 UTC

- **Service account not created:** there is no authorized Google Cloud access in this environment (no gcloud, no credentials). See `GOOGLE_SERVICE_ACCOUNT_STATUS.md` for the exact access needed. No email exists yet.
- **Feed:** the three pre-order products are identified in `GROWTH_FEED_DATE_CONFIRMATION_REQUEST.md`:
  - MM-WHL-036 Captain's Helm 36";
  - MM-DEC-030 Vintage Diving Helmet;
  - MM-CUS-001 Custom Engraved Compass.
- **Waiting for the client's dates.** Nothing invented or changed.
