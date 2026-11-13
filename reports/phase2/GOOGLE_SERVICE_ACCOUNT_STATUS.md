# Google: dedicated read-only service account status

**10 November 2026, 17:08 UTC.**

## Status: STOPPED. No authorized Google Cloud access in this environment

**The service account was not created**, so there is **no service-account email** to report yet.

| Check (read-only) | Result |
|---|---|
| `gcloud` / `gsutil` installed | No |
| gcloud configuration (`%APPDATA%\gcloud`) | Absent |
| `GOOGLE_APPLICATION_CREDENTIALS` (process, user, machine) | Not set |
| Personal Google credentials | Not requested and not used, as instructed |

## Exactly what access is needed (choose one)

1. **You create the account** using `GROWTH_REVENUE_AGENT_REPORT.md`, section 3, then send me only its email address. Recommended: no access needs to be granted to anyone else.
2. **Or grant scoped access** for the agent's environment: a Google Cloud project you control, plus credentials for an identity holding only:
   - `roles/iam.serviceAccountAdmin` (create the account);
   - `roles/iam.serviceAccountKeyAdmin` (create its key);
   - `roles/serviceusage.serviceUsageAdmin` (enable the two APIs);

   all on **that project only**, and revoked afterwards. This option exposes more than option 1.

## What the account needs (unchanged; verified in the code)

| Item | Value |
|---|---|
| Suggested name | `marina-muse-growth-readonly` (email `marina-muse-growth-readonly@<PROJECT_ID>.iam.gserviceaccount.com`) |
| APIs to enable | Google Analytics Data API; Google Search Console API |
| Cloud IAM roles | **None** |
| GA4 | Property access management → the account's email → **Viewer** (property level) |
| Search Console | Users and permissions → the account's email → **Restricted** (Marina Muse property only) |
| Scopes the code requests | `analytics.readonly`, `webmasters.readonly` |
| Merchant Center | **Not needed.** The code only generates the feed |

**Process.** Once the account exists, I'll restate its exact email and these permissions to you. Only then should you grant GA4 Viewer and Search Console Restricted.
