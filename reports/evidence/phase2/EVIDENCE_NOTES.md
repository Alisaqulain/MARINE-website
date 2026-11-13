# Phase 2 isolated-test evidence: notes and corrections (10 November 2026)

**All superseded logs are kept unchanged.** This note explains them.

| Log | Status | Explanation |
|---|---|---|
| `webhook-tests-20261110T1629Z.log` | **Superseded; contains a wrong label** | Six tests are labelled "graceful-only (database unavailable)". That was wrong: Docker Desktop had been started at 16:18:10 UTC by someone other than this session, and the test database was up. Those six requests reached the local test database. The tests asserted only a clean 200 response, not stored data |
| `webhook-tests-20261110T1632Z.log` | **Superseded: 23/25, 2 test bugs** | Stored-data assertions added. **X3:** the test looked for `exotel:<CallSid>`, but the code stores `exotel_<CallSid>`; the record existed. **W8:** the synthetic sender `910000000000` matched the synthetic business display number `0000000000` on its last 10 digits, so the app correctly ignored it as a business echo |
| `webhook-tests-20261110T1633Z.log` | **Final: 25/25** | Correct ids and distinct synthetic numbers. Every stored-data assertion passes |
| `growth-cron-check-isolated-20261110T1633Z.log` | **Superseded: 1 FAIL, explained** | The precondition "test database has no leads" failed because W8 (16:33) had created a synthetic WhatsApp lead (`wa_919999000001`). Synthetic records were then removed (`cleanup-synthetic-test-data-20261110T1634Z.log`) |
| `growth-cron-check-isolated-after-cleanup-20261110T1634Z.log` | **Final: 9/9** | — |
| `isolation-proof-20261110T1628Z.log` (first file of that minute) | First attempt reported "No process listens on port 3939" | The IPv6 listener's `State` is blank in this PowerShell session. The script now filters on the port only, and the second run in the same file name is the valid one |
| `../security/env-template-secret-check-*.log` | Superseded by `…-postgen2-20261110.log` | Earlier scans either resumed a journal (`Runs: 2`) or predate a regeneration of the template |

**Database writes.**
- All writes went to the **local test database** `127.0.0.1:27018/marina_muse_dev`; the 9 Nov 13/13 and 10 Nov 13/13 checks confirm it holds TEST fixtures only.
- The synthetic records the tests created were removed with `cleanup-synthetic-test-data.mjs`, which deletes only records carrying the test markers.

**Docker.** This session did not start Docker. When checked read-only, only one container existed, `marina-dev-mongo`. **CareerPath AI has no containers and was not running.**
