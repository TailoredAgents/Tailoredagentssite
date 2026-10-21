# Search Console readiness release

Jeffrey authorized merging this release into `main` and removing the feature branch on October 20, 2026. Future development stays on `main` unless he requests otherwise. Google activation still requires the live checks below; a merge is not proof of activation.

## Work tracker

- [x] Durable daily imports, coverage records, retries, leases, connection replacement and disconnect safety.
- [x] Canonical origin validation, protected status and export routes, owner-controlled account provisioning.
- [x] Verified inquiry attribution and privacy controls.
- [x] Accessible reporting screen, date comparisons, searchable tables and exports.
- [x] PostgreSQL integration tests, browser checks, restore drill and complete release checks.
- [x] Reviewable preview, documentation and focused commits prepared for review.
- [x] Reporting release deployed with migration 0005.
- [x] October 21 www configuration, migration 0006 and live scheduled-worker verification.
- [ ] Google authorization, reconciled import, browser-independent processing and scheduled daily refresh.

## Confirmed baseline, October 20, 2026

- Main commit `5f02db3` is deployed on the existing Render website service.
- Deployment logs record database migrations 0001–0004 as applied.
- The live apex redirects to www, contrary to the configured canonical origin.
- The daily job failed with HTTP 401 on October 19 and 20. Requests from the www reporting page fail the integration's origin check.
- The earlier implementation only refreshed ten days after its first import and did not recover a longer gap.
- The original 28 unit tests, lint, type check, build and dependency audit passed; those checks did not exercise the full live integration.

## Production gates

Confirm private operational evidence of credential rotation and tested backups before Google authorization. Never put credentials, account cookies, customer records, or raw private logs in this document. Database administration must use private access; do not open the database to the internet to facilitate tooling.

Use the existing web service, database and cron service. Review actual runtime cost before changing the cron cadence. No additional paid resource is part of this release. Preserve the separate mail application and its DNS records.

October 21 choice: canonical https://www.tailoredagents.com (replaces the original apex choice), full internal reporting redesign, initial 90 days of Google history, live connection and verification included. Dashboard access for Jeffrey still needs checking. Jeffrey subsequently chose to complete Google setup himself with his selected personal Google account.

## What is implemented in this release

- The existing OAuth routes and encrypted credential storage remain the foundation. New connections require the exact Domain property, read-only scope, a new refresh token, and a successful read before replacing a working connection. Active membership and ownership of the production site are checked on reads, management and exports.
- Migration 0005 adds connection versions, durable jobs, expiring leases, completed-date coverage (including zero days), worker/retention health, and an inquiry-attribution outbox. Existing metrics, credentials and operational records survive. Long URLs and queries are preserved; a compact hash index replaces the oversized text index. A hash collision fails the date transaction rather than combining distinct values.
- Initial import checks 90 days, recent first, ending three Pacific calendar days ago to use finalized data. Later requests check every missing date plus the latest ten days. Unrecoverable gaps older than Google's 16-month window are disclosed. Pagination retrieves up to Google's 50,000 detailed rows per day/type and reports the limit.
- Each date replaces its saved results only after all three Google reports succeed. Expired leases recover after interruption. Version checks prevent a previous connection's work from committing after disconnect/reconnect. Temporary failures wait before retrying; revoked permission stops retries. Manual requests return HTTP 202 and reuse pending work.
- The existing cron's configured cadence is every five minutes. A daily refresh is requested on its first check after 10:17 UTC, normally 10:20. Each request processes bounded work; the trigger exits when idle or after its runtime budget. Requests refuse redirects. Worker check-in, Google data dates and completed imports are distinct.
- Website presets use completed Pacific days through yesterday; Google presets use the latest covered date. Custom dates are retained, with missing portions marked. Comparisons require sufficient earlier history. Google totals use property totals; missing chart dates are gaps.
- Actual stored website inquiries are authoritative. Optional attribution is recorded server-side, with retryable pending work. Browser claims of successful submissions are rejected. Retries reuse the submission ID. DNT/GPC inquiries remain receivable without creating tracked sessions. Legacy browser submission records are retained but excluded from verified conversion rates.
- The redesigned screen has readable controls, two charts with accessible data tables, searchable/sortable/paginated detail tables, protected CSV export with formula escaping, progress, update history, connection recovery and disconnect confirmation. Scoped navigation size/contrast adjustments apply on this route only.

## Preview and reproducible checks

These screenshots contain **demonstration data from a separate local database**, not actual business or Google results:

- [Desktop report](previews/search-console-desktop.png)
- [Phone report](previews/search-console-phone.png)

Requirements: Node 22 or newer, Docker, PostgreSQL 18 client tools for recovery, and Chromium for Playwright. The test database is bound only to localhost. It contains no production credentials or records.

```sh
docker run --name ta-reporting-test --detach --publish 127.0.0.1:55432:5432 \
  --env POSTGRES_DB=ta_reporting_test --env POSTGRES_USER=ta_test \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:18-alpine
npm ci
npx playwright install chromium
npm run lint
npm run typecheck
TEST_DATABASE_URL=postgresql://ta_test@127.0.0.1:55432/ta_reporting_test npm test
TEST_DATABASE_URL=postgresql://ta_test@127.0.0.1:55432/ta_reporting_test npm run test:recovery
npm run build
TEST_DATABASE_URL=postgresql://ta_test@127.0.0.1:55432/ta_reporting_browser_test node scripts/seed-reporting-preview.mjs
npm run test:browser
npm audit
npm run reporting:preview
```

If the named container already exists, start it rather than creating another. The recovery script creates and removes only the two named local `ta_reporting_test_upgrade` and `ta_reporting_test_restore` databases. It tests upgrading populated migrations 0001–0004, then an actual `pg_dump`/`pg_restore`, checking reports and connection metadata. `PG_DUMP_BINARY` and `PG_RESTORE_BINARY` can specify PostgreSQL 18 executable paths.

The local-only preview is at `http://127.0.0.1:3100/dashboard/analytics`. Its deliberately public fixture account is `owner@example.test`, password `Reporting-test-password-2026`; `viewer@example.test` uses the same fixture password for restricted-access checks. These accounts exist only in the disposable test database. Never provision them in production. The preview script resets demonstration data and starts the built app; Ctrl+C stops it.

Verified locally on October 21:

- Lint and strict type checks pass.
- **63 automated tests pass**, including **22 PostgreSQL integration tests**. Running tests without `TEST_DATABASE_URL` intentionally skips the database suite and is not the full release gate.
- **10 browser tests pass** across desktop Chromium and a phone viewport, including real password sign-in, private routes, viewer restrictions, tables, filters, export, safe hostname handling and disconnect confirmation.
- Automated WCAG A/AA checks on the reporting screen found no violations in those desktop/phone runs. Chart tables and keyboard access were also exercised. These checks do not replace broad assistive-technology testing.
- Production build passes; dependency audit reports **0 vulnerabilities**.
- Populated migration upgrade and PostgreSQL dump/restore pass.
- Owner-controlled account check and creation commands pass against the isolated preview database.

## Shared files for Austin's review

Public form markup and appearance are unchanged. `components/contact-form.tsx` and `components/website-review-form.tsx` retain submission IDs on retries and send optional measurement context. The event tracker no longer sends browser-claimed success. `app/api/contact/route.ts` records optional attribution after saving an inquiry. These changes need Austin's coordination because the files are shared.

`next.config.ts` sends apex requests to www while preserving paths and queries, matching Render's existing direction. `ENABLE_APEX_REDIRECT` is obsolete and ignored. Authentication trusts the configured www origin; Google management requests use the same origin. The sitemap, canonical metadata and reporting worker use www. Migration 0006 updates the existing site's URL without rewriting historical Google page addresses or credentials. Membership lookup no longer silently recreates a removed membership. The reporting release left Mail unchanged. Jeffrey subsequently requested shared sign-in; the separate changes and deployment order are recorded below.

## Legacy website account provisioning (password mode only)

Use the Render web service's private shell with its existing secret environment. These commands are for an authorized operator. Do not run them through a public endpoint, open PostgreSQL to the internet, pass passwords as command arguments, or paste secrets into chat.

```sh
npm run dashboard:provision -- --check --email jeffrey@tailoredagents.com
# Only if the approved account is missing:
npm run dashboard:provision -- --email jeffrey@tailoredagents.com --name Jeffrey --role admin
```

The address must already be in `DASHBOARD_ALLOWED_EMAILS`. The command requires an existing active owner, prompts privately for a new password, uses the installed Better Auth password hashing, creates an individual credential/membership and an audit record. It refuses to overwrite an existing account or assign the owner role. `--password-stdin` is reserved for a secure operator pipeline. This command applies only to the legacy password mode. In production mail mode, approve the person through Mail → Manage team instead; their website identity is linked on first sign-in. Verify their own sign-in and report access before proceeding.

## Production deployment order and cost review

1. Work directly on `main`. The existing Render web service and cron auto-deploy it. Share the preview, shared-file changes, migrations and this runbook for coordination. Do not start another roadmap workstream.
2. Privately check whether the exposed database credential and `BETTER_AUTH_SECRET` were rotated. Jeffrey answered **“Not sure”**; this is unverified. Complete outstanding rotation before Google authorization, update dependent secret stores, and verify sign-in. Keep required backup encryption material in the approved private secret store. A later authentication-secret change requires Google reconnection.
3. Verify current production backup availability and the ability to restore into a separate database privately. The local restore drill proves the migrations, not Render account-level backup availability. The current database connector is blocked by the private allowlist; do not make the database public to bypass this.
4. Keep Render's existing **apex-to-www** routing. Merge only `NEXT_PUBLIC_SITE_URL=https://www.tailoredagents.com` and `BETTER_AUTH_URL=https://www.tailoredagents.com` into the existing web service's environment, preserving all secrets. Set the existing cron's `SEARCH_CONSOLE_SYNC_URL=https://www.tailoredagents.com/api/cron/search-console`. Rebuild after changing the public origin, because public metadata is generated during the build. Preserve mail DNS and the email subdomain.
5. Verify www HTTPS, `/sign-in`, `/api/health`, canonical links, sitemap, public pages and apex redirects preserving paths/query strings. Check Jeffrey's own website login and reporting access. Google requires the exact www callback on its existing OAuth client; the Domain property remains `sc-domain:tailoredagents.com`.
6. Verify the existing web service deployed `main` and migrations 0001–0006 are recorded once. Migration 0005 is already deployed; 0006 only changes the internal site's URL. Do not undo tables or overwrite stored credentials. The build performs migrations and retention before building.
7. The **existing** cron is already set to `*/5 * * * *` as observed October 21. Confirm its private shared secret still matches the web service, observe successful checks, and review actual active runtime and billing. No new service or schedule increase is required for the www change.
8. Verify successful scheduled processing, worker heartbeat and daily retention. Complete the private credential, account and backup checks before Google authorization.

**Runtime estimate, not a billing quote:** five-minute checks produce 8,640 runs in a 30-day month. At 2 seconds per idle run that is 4.8 active hours/month; at 10 seconds it is 24 hours, plus import time. Measure actual startup and request runtime in Render; local timings do not predict billed startup. Charge is `max($1 monthly minimum, active seconds × the current instance rate)`. The job processes at most roughly 210 seconds plus one bounded request per invocation, then saves remaining work for the next check. Do not assume more frequent checks are free. The current per-second rate could not be verified through the available account tools; verify it in Render before changing the live schedule. [Render cron billing](https://render.com/docs/cronjobs).

## Google connection and live acceptance — still pending

Jeffrey has taken over setup using his selected personal Google account. He reported ownership verification and publishing completion; the Web client JSON was validated and its client settings installed directly into Render without displaying secret values. Confirm **Audience → In production** separately from branding publication before authorization. Enter credentials only on Google/Render pages. Follow the account/project/API/External-audience instructions in `JEFFREY.md`; the app must be **In production**, because Testing-mode offline authorization normally expires after seven days. Request only `webmasters.readonly` and use the exact callback:

`https://www.tailoredagents.com/api/integrations/search-console/callback`

Record non-secret evidence for each item before declaring activation complete:

- Exact verified Domain property `sc-domain:tailoredagents.com`; no URL-prefix substitution.
- Real queued import reaches 90/90 days, including legitimate zero days if applicable. Finalized history ends three days before the current Pacific date. [Google's import guidance and detailed-row limits](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data).
- Identical fixed date range and **Web** search type reconcile with Google's property totals; detail differences are explained by Google's documented limits, not silently asserted equal.
- Two manual refreshes do not duplicate results; close the browser and verify work completes.
- A manual Render worker run succeeds. Then observe the **next genuinely scheduled daily refresh** after 10:17 UTC; record the date, completion and worker heartbeat. A manual trigger is not evidence of a scheduled run.
- Public website, an authorized contact submission, authenticated reports, exports and the separate mail service remain available.
- Verify recovery actions for an interrupted import and renewed Google permission without discarding saved reports.

## Rollback and recovery

1. Pause the existing cron in Render. Stop manual sync/Google authorization during the incident. Preserve database backups and logs containing only safe error categories.
2. Keep migration 0005 and stored data. Prefer a compatible hotfix or a reviewed application build that understands the new queued/retry/cancelled states and metric hash index. **Do not blindly redeploy pre-0005 sync code:** its old conflict target and assumptions are incompatible with the new schema.
3. If the earlier public website must be restored urgently, first remove the Google client settings and disable the cron secret on that earlier application so neither manual nor scheduled imports run; retain private copies for recovery. Keep the corrected primary hostname and authentication secret consistent. Reports during this fallback use the old definitions and are not acceptance evidence.
4. Restore a backup into a **separate** private PostgreSQL instance; use a PostgreSQL 18 client, `pg_dump -Fc`/`pg_restore --exit-on-error --no-owner`, and the approved private connection method. Never overwrite production as a first diagnostic step. Verify metrics, coverage, integration versions and encrypted credential metadata, plus representative internal account/membership records. Preserve the secret needed to decrypt backed-up credentials, or plan to reconnect Google.
5. On the restored candidate, cancel old in-flight jobs and invalidate leases/versions before reconnecting or resuming. Confirm the same property and account permissions. The normal missing-date planner can recover dates still available from Google; older unrecoverable gaps stay visible.
6. Only after verification, point the reviewed application at the restored candidate, verify sign-in/report access, and resume the existing cron. Re-run live acceptance and observe the next scheduled daily refresh. Do not drop additive schema changes as rollback.

Read-only live availability check on October 20: apex health still redirects to www (301); www health and contact page return 200; mail redirects to its login (303). This was the pre-merge baseline. The subsequent user-authorized merge triggers the existing Render deployment and its migration command; it does not itself complete the later www environment alignment or Google acceptance checks. These availability checks do not replace the post-deployment submission and Google acceptance tests.


## October 21 www rollout — verified live

Jeffrey chose www, replacing the earlier apex-only plan. Commit `78cc5fd` is deployed on both existing Render services. The web deployment finished at 12:14:11 UTC; the cron build finished at 12:13:20 UTC. The workspace remains on `main`, with no feature branch.

- Updated only `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` on the existing web service, and `SEARCH_CONSOLE_SYNC_URL` on the existing cron, using merged environment updates. Existing secrets were preserved. No domain, mail, billing-plan or cron-schedule changes were made in this rollout.
- Production build logs confirm migration 0006 applied successfully. Existing migrations 0001–0005 remain recorded.
- All **16 sitemap pages** return HTTP 200 and declare their own matching `https://www.tailoredagents.com` canonical URL. The sitemap and robots file use www. Apex `/contact?source=www-check&keep=1` redirects to the same page and query on www.
- The health and sign-in pages return 200. Signed-out reports, exports, tables and Google status return 401. The Google callback sends signed-out users to the www sign-in page. Unsigned scheduled requests return 401.
- An invalid contact submission returns 400 with database-backed rate limiting available. This did **not** create a real inquiry or send notification email. A successful live inquiry and dashboard count still need checking.
- The separate mail login returns 200; no mail files or DNS records changed. This is an availability check, not a repeat of mail send/receive testing.
- The genuinely scheduled **12:15 UTC** cron run started at 12:15:05 and finished successfully at 12:15:27. Its worker response was **0 date updates, 0 stopped imports**. This verifies the URL, matching job authentication and successful idle processing. It does not establish a real Google import or a completed daily Google-data refresh.
- Local checks: **63 automated tests**, including **22 PostgreSQL integration tests**; **10 desktop/phone browser tests**; lint; strict types; production build; dependency audit with **0 vulnerabilities**; and a populated-database upgrade through migration 0006 followed by PostgreSQL dump/restore all passed. The tests include www management requests, the exact OAuth callback, preserved paths/queries, prevention of redirect loops, and rejection of redirects by the private worker command.

### Remaining live acceptance

1. Verify Jeffrey and Austin can each sign in with their own approved dashboard account and see the expected reports and controls. Use Mail → Manage team to approve a teammate; in mail mode, website accounts are linked or created on first sign-in.
2. Confirm the previously flagged database password and website authentication secret were rotated, and confirm current production backups and private restore access. The local restore drill passed; the production connector cannot inspect the private database. Do not open its network allowlist for this task.
3. In the existing Google OAuth client, allow exactly `https://www.tailoredagents.com/api/integrations/search-console/callback`. Verify the Search Console API, the exact Domain property, the approved Google owner and read-only permission; then authorize from the dashboard. The exact callback was verified in the downloaded Google Web client and its settings installed in Render on October 21. The real user authorization and import remain pending. Google requires the return address to match its registered callback. [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server).
4. Import the actual 90 days; compare a fixed range with Google's report; refresh twice; close the browser while processing; verify recovery and the next scheduled daily data refresh. A successful idle worker check is separate evidence from these Google-data checks.
5. Submit a clearly identified real inquiry and verify one saved inquiry, correct reporting/attribution, privacy behavior and notification delivery. Local controlled tests cover these behaviors; no live notification was sent during this rollout.
6. Review actual active-runtime charges for the existing five-minute cron. Its schedule and plan were already in place before this change. The observed run elapsed about 23 seconds including startup and shutdown; one run is not a monthly billing estimate.

For rollback, use a compatible application build that keeps www as the canonical origin and understands migration 0005. Keep both migrations and stored reports. Do not reenable the old www-to-apex redirect or restore an apex worker URL. Pause the existing job if operational recovery requires it, then repeat the live checks after restoring service.


## October 21 shared Mail sign-in

Jeffrey requested the same email address and password for Mail and the dashboard. Production uses `DASHBOARD_AUTH_MODE=mail`; a mailbox alone does not grant dashboard access. The mail owner is approved automatically, and can allow/remove other teammates through **Mail → Manage team**. Existing workspace roles are preserved; new teammates receive `member`, and a new owner identity receives `admin`. Removed/suspended memberships remain blocked.

The website validates the existing mail password over an authenticated, fixed HTTPS endpoint. A separate dashboard grant is encrypted in PostgreSQL and checked on each protected request. It cannot open an inbox. Password changes/resets, disabled accounts, removed approval and sign-out revoke access; temporary passwords must be changed in Mail first. Mail outages deny protected access with no fallback to an old website password. The two sites keep separate browser cookies: matching credentials do not mean automatic cross-site sign-in.

Deployment order:

1. Apply additive Mail migration `0036_dashboard_login.sql`; it approves only existing mail owners.
2. Install a fresh private `DASHBOARD_AUTH_SECRET` in the production Mail Worker and deploy Mail. Staging must use a different secret and database.
3. Deploy the website code, applying PostgreSQL migration `0007_mail_dashboard_login.sql`. This adds identity/session mappings without altering existing accounts, passwords, roles, reports or Google credentials.
4. Merge `DASHBOARD_AUTH_MODE=mail`, the exact production `MAIL_AUTH_URL`, and the matching `MAIL_AUTH_SECRET` into the existing Render web environment. An environment update triggers a deployment. Do not replace unrelated environment variables. Cron needs none of these new values.
5. Verify public availability, private endpoint denial without its secret, blocked public registration/legacy login, and the owner's real sign-in. No DNS, billing, delivery, inbox storage or cron schedule changes are required.

Local checks use a second isolated PostgreSQL database named exactly `ta_mail_login_test`. Add `TEST_MAIL_AUTH_DATABASE_URL=postgresql://ta_test@127.0.0.1:55432/ta_mail_login_test` to the website test command to run the real Better Auth cookie, role, revocation and privacy tests. The mail suite checks password resets racing sign-in, disabled accounts, grant expiry, separate inbox sessions, request bounds and attempt limits. A temporary staging account also exercised the real Cloudflare identity endpoint from the built website in desktop and phone browsers. No production password or inbox content was needed. The temporary staging account is removed after validation.

Rollback: retain both additive migrations and all stored data. A prior Mail version is compatible with the added columns/tables but cannot serve dashboard grants; pause shared sign-in or restore the matching Mail version first. To deliberately restore legacy website login, an authorized operator must set `DASHBOARD_AUTH_MODE=password` and verify the approved allowlist and existing separate website credentials. Existing Mail-only users have no copied legacy password. Never enable public signup, copy Mail password hashes into PostgreSQL, or silently fall back when Mail is unavailable. Restoring a database can revive old sessions: revoke restored Mail sessions and website sessions before reopening access. Preserve encrypted connection recovery material; rotating `BETTER_AUTH_SECRET` requires users to sign in again and Google to reconnect.


### Shared sign-in rollout evidence

Commit `6a99d6e` is deployed in Render as `dep-dbcec30n74is7389b480`, live **October 21, 16:20:55 UTC**. Build logs confirm migration 0007 applied successfully without repeating migrations 0001–0006. Mail production is version `7a543289-1bbb-47b5-8684-5d94e8278256`, with migration 0036 applied. Matching service secrets are stored only in the intended provider environments. No new paid services or schedule changes were introduced.

The live website displays the shared-password instructions, is fully configured, and reaches Mail to verify credentials. A controlled nonexistent-account attempt returns `401 invalid_credentials`. Missing-secret access to the private identity endpoint is denied, as are unsigned report/export requests, public registration, old website-password endpoints and cross-site sign-in requests. Website health, home, contact, privacy, terms and Mail login remain HTTP 200. These checks do not claim a successful sign-in as Jeffrey: he still needs to enter his existing Mail password himself.

Final validation: **73 website tests** (including **29 PostgreSQL integration tests**), **382 Mail backend tests**, **10 reporting browser tests**, **10 Mail browser tests**, lint, strict type checks, both production builds, and both complete dependency audits pass; both audits report zero known vulnerabilities. The populated migration upgrade and PostgreSQL dump/restore passed through migration 0007. Staging-to-website authentication, report access, member restrictions and sign-out were exercised using a temporary account in desktop/phone browsers; its remote Mail and local website records were then removed. No production passwords or inbox contents were accessed.

Next user check: sign in at `https://www.tailoredagents.com/sign-in` with `jeffrey@tailoredagents.com` and the existing Mail password. Approve Austin through Mail → Manage team if desired. Then finish the pending Google authorization and live acceptance above; deployment of shared sign-in does not establish a Google import or scheduled data refresh.
