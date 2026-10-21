# Jeffrey technical handoff: production closeout and product roadmap

## Instructions to Jeffrey's Codex IDE

If Jeffrey asks you only to read or follow `JEFFREY.md`, treat this file as the full task brief and begin the workflow below. Do not require him to restate the roadmap in chat.

1. Read this entire file before taking action. Do not stop after the Search Console section; the later sections define the complete product roadmap and safety gates.
2. Read `AGENTS.md`, `README.md`, `docs/PRODUCT_PLAN.md`, and `docs/LAUNCH_CHECKLIST.md` completely.
3. Inspect the repository, current branch, recent commits, working tree, existing infrastructure declarations, migrations, tests, and documentation. Preserve all existing work and never discard unrelated changes.
4. Identify the first incomplete workstream in **Master execution sequence** using repository state and verified production evidence. Do not redo work that is already proven complete.
5. Work directly on `main`, as Jeffrey requested on October 20, 2026. Do not create a feature branch unless he explicitly requests one.
6. Create and maintain a concrete working plan for the active workstream. Work autonomously through every safe code, documentation, test, and diagnostic step in scope.
7. For Google, DNS, Render, email-provider, payment, or other external-account actions, guide Jeffrey one step at a time and inspect the resulting non-secret state when tooling permits. Never request that a password, two-factor code, API secret, token, database URL, or DNS verification value be pasted into chat.
8. Pause only when a human must enter credentials, approve a new cost, make a business decision, or authorize a materially broader action. State exactly what Jeffrey must do and how you will verify it afterward.
9. Follow the applicable instructions in `node_modules/next/dist/docs/` before changing Next.js code. Use versioned database migrations and the repository's existing security and data-access patterns.
10. Complete the release gate appropriate to the change. At minimum, code releases require lint, strict type checking, tests, a production build, dependency audit, migration verification when applicable, and focused authorization tests.
11. Update `README.md`, `docs/PRODUCT_PLAN.md`, and `docs/LAUNCH_CHECKLIST.md` in the same release whenever capability or phase status changes. Describe only what is genuinely operational.
12. Review the final diff for secret leakage, unrelated edits, unsafe migrations, authorization gaps, misleading product claims, and conflicts with Austin's public design work.
13. Commit and push completed, verified repository work directly to `main`. Do not create an empty commit for external configuration that produced no repository change.
14. Deliver the required non-secret completion report. Jeffrey has authorized merging the Search Console readiness release into `main` without a separate pull-request review. Keep later roadmap workstreams outside this release until requested.

When information is uncertain, investigate the repository and authoritative primary documentation rather than guessing. The objective is to complete the Tailored Agents vision safely and sequentially, not merely to generate code or interfaces.

## Assignment

Own the remaining technical roadmap for Tailored Agents while Austin works on public website design and marketing presentation. Begin by completing the production Google Search Console connection. Then close the Phase 2 and Phase 3 production gates before proceeding sequentially through the client Growth Hub, the human-operated SEO workspace, and the bounded SEO agent.

October 20 update: Jeffrey approved a bounded Search Console readiness and reporting upgrade after the audit identified hostname and import failures. The existing integration is extended in this release. Jeffrey subsequently directed that all completed work be merged into `main`, the feature branch removed, and future development stay on `main`. This explicitly supersedes the earlier activation-only restriction. See `docs/SEARCH_CONSOLE_READINESS.md` for implementation evidence, the preview, deployment order and remaining live gates. Other roadmap workstreams remain outside this release.

Start from the `main` commit that contains this handoff or a newer commit. Read this file completely before taking action. Also read `README.md`, `docs/PRODUCT_PLAN.md`, `docs/LAUNCH_CHECKLIST.md`, and the applicable Next.js documentation under `node_modules/next/dist/docs/` before changing application code.

### Commercial direction to preserve

- Websites and managed SEO remain the primary way Tailored Agents acquires and begins serving clients.
- The relationship can expand into two agent categories: website intelligence and business operations.
- Founding-client standard offers are the Website Chat Assistant at $99/month, Lead Qualification Assistant at $149/month, Lead Follow-Up Agent at $199/month plus messaging usage, and AI Phone Receptionist at $299/month plus voice usage.
- The approved standard configuration has $0 setup. Nonstandard knowledge preparation, integrations, compliance needs, outside software, and custom development are scoped separately.
- Advanced agents and connected systems retain implementation pricing, support pricing, and usage terms defined by proposal.
- Normal analytics and the eventual human-reviewed SEO intelligence layer are included in managed SEO rather than sold as separate agent subscriptions.
- Public prices describe a limited founding-client rollout. Do not treat every listed agent as generally available or technically complete until its delivery workflow and product gate pass.
- The long-term architecture should let these services share client context, evidence, approvals, activity history, and reporting through the Growth Hub without weakening tenant isolation.

## Ownership and repository boundaries

Austin owns public website design, public-facing copy, brand presentation, and marketing-page iteration. Jeffrey owns backend, database, dashboard, analytics, integrations, client access, SEO tooling, agent infrastructure, and technical production validation.

### Austin's primary paths

- Public routes such as `app/page.tsx`, `app/websites/`, `app/seo/`, `app/automation/`, `app/engineering/`, `app/pricing/`, `app/packages/`, `app/work/`, `app/company/`, and `app/contact/`.
- Public presentation components in `components/` except `components/dashboard/` and measurement components.
- `app/globals.css` and public visual assets.
- Public service, pricing, package, and business copy in `lib/services.ts`, `lib/packages.ts`, and `lib/site.ts`.

### Jeffrey's primary paths

- `app/dashboard/` and `components/dashboard/`.
- Protected and operational routes under `app/api/`.
- `lib/dashboard/`, `lib/operations/`, `lib/analytics/`, and `lib/search-console/`.
- `db/migrations/`, operational scripts, server configuration, and technical tests.
- Future client-portal, SEO-workspace, crawler, agent, approval, and job-processing code.
- Technical sections of `README.md`, `docs/PRODUCT_PLAN.md`, and `docs/LAUNCH_CHECKLIST.md`.

### Shared paths that require coordination

Treat `app/layout.tsx`, `app/privacy/`, `app/terms/`, `app/robots.ts`, `app/sitemap.ts`, `package.json`, lockfiles, `render.yaml`, and top-level documentation as shared. Rebase or merge the latest `main` before editing them, keep changes narrow, and call out every shared-path change in the handoff.

Do not restyle or rewrite Austin's public pages as part of technical work. If a backend feature requires a public-facing entry point, define the interface and ask Austin to own its final presentation.

## Git workflow

Jeffrey's October 20, 2026 instruction replaces the earlier feature-branch and pre-merge review requirements.

1. Fetch and fast-forward the latest `main` before every workstream when the working tree permits it.
2. Work directly on `main`; do not create feature branches unless Jeffrey explicitly asks.
3. Keep releases bounded and commits focused and descriptive.
4. Run the relevant test gate, then commit and push to `main`.
5. Provide a clear completion report, including any remaining live setup or verification.
6. Do not start an unrelated roadmap phase without an instruction to do so.
7. Never force-push `main`, rewrite shared history, or discard Austin's changes.
8. If Austin has changed a shared path, reconcile rather than overwrite his work.

## Master execution sequence

Work in this order:

1. Activate Search Console using the detailed instructions in this file.
2. Close the remaining Phase 2 operations and production-safety gates.
3. Close the full Phase 3 measurement gate using real production evidence.
4. Implement Phase 4 in small releases: client isolation first, client experience second, public demo last.
5. Implement Phase 5 as a complete human-operated SEO workflow without autonomous actions.
6. Research, evaluate, and implement Phase 6 as a bounded, approval-based SEO agent.

Stop after every numbered workstream, update the product plan and launch checklist truthfully, and provide Austin with a reviewable report. Do not mark a phase complete merely because its interface exists.

## Search Console activation definition of done

This task is complete only when all of the following are true:

- The Domain property `sc-domain:tailoredagents.com` is verified in Google Search Console.
- A dedicated Google Cloud project named `Tailored Agents Production` exists under the personal Google account Jeffrey selected for this setup.
- The Google Search Console API is enabled in that project.
- Google Auth is configured for an External audience and requests only the Search Console read-only scope.
- A Web application OAuth client has the exact production callback URI.
- The OAuth app is set to In production so the offline authorization does not normally expire after seven days.
- The Google client ID and client secret exist only in the Render web service's secret environment.
- The updated Render Blueprint is synced and the Search Console cron service exists exactly once.
- `/dashboard/analytics` reports the verified property as connected.
- A manual dashboard sync and a manually triggered Render cron run both complete successfully.
- No password, OAuth secret, refresh token, DNS verification value, database URL, or private account address is committed, copied into Codex, or placed in the completion report.

## Production facts

Use these exact values:

| Setting | Value |
| --- | --- |
| Website | `https://www.tailoredagents.com` |
| Search Console property | `sc-domain:tailoredagents.com` |
| Google Cloud project name | `Tailored Agents Production` |
| OAuth audience | `External` |
| OAuth client type | `Web application` |
| OAuth client name | `Tailored Agents Website` |
| OAuth scope | `https://www.googleapis.com/auth/webmasters.readonly` |
| Authorized redirect URI | `https://www.tailoredagents.com/api/integrations/search-console/callback` |
| Web service | `tailored-agents-web` |
| Cron service | `tailored-agents-search-console-sync` |
| Dashboard analytics | `https://www.tailoredagents.com/dashboard/analytics` |

The redirect URI must use HTTPS, must contain `www`, and must not have a trailing slash. Jeffrey chose www on October 21, 2026; this replaces the earlier apex-only decision. Update the existing Google OAuth client to allow this exact www callback before connecting.

## Access and security rules

October 21 update: Jeffrey is completing setup himself using his selected personal Google account. This replaces the earlier Austin-only assignment. Use the same verified owner for Search Console and the Google Cloud project; do not switch to an unrelated account.

- Do not ask anyone to send a Google, DNS, Render, or dashboard password through chat.
- Jeffrey should enter account credentials and two-factor codes himself, or provide access through an approved signed-in session.
- Ensure two-factor authentication is enabled on the personal Google account.
- Never give a secret value to Codex. Codex can guide the browser interaction without reading the value.
- Never paste secrets into the repository, an issue, a commit, a screenshot, or the completion report.
- Verify the outstanding credential-rotation checklist before connecting Google. Jeffrey is not sure whether Austin completed it. The approved readiness plan permits completing outstanding rotation first; coordinate privately and retain recovery material securely. Rotating `BETTER_AUTH_SECRET` after authorization invalidates stored Google credentials and requires reconnecting.
- Keep the existing Render apex-to-www direction. Jeffrey chose www as the canonical website hostname on October 21. Preserve all mail records and `mail.tailoredagents.com`. Google verification uses the additional TXT record below.
- Do not create a second web service, database, Blueprint, or duplicate cron service.
- Resend is unrelated to this task and can remain unconfigured.

## Before starting

1. Pull the latest `main` branch.
2. Confirm commit `d779eb1` or a newer commit is present.
3. Confirm the worktree is clean.
4. Arrange authorized access to:
   - Jeffrey's selected personal Google account.
   - The DNS manager for `tailoredagents.com`.
   - The Tailored Agents Render workspace.
   - The private Tailored Agents dashboard.
5. If any access is unavailable, complete all safe read-only checks you can, then report the exact missing access. Do not invent credentials or create resources in another account.

## Task 1: verify the Search Console Domain property

1. Sign in to <https://search.google.com/search-console/> with the personal Google account Jeffrey selected for this setup.
2. Open the property selector in the upper-left.
3. If `sc-domain:tailoredagents.com` already exists, open it and confirm the account is an owner. Do not create a duplicate.
4. Otherwise, select **+ Add property**.
5. Under **Domain**, enter `tailoredagents.com` only. Do not include `https://`, `www`, or a path.
6. Select **Continue**.
7. Google will provide a unique TXT verification value beginning with `google-site-verification=`. Treat it as private setup evidence and do not copy it into Codex or this repository.
8. In the authoritative DNS manager for `tailoredagents.com`, add a record with:
   - Type: `TXT`
   - Name or host: `@` (or blank if the DNS provider uses blank for the root)
   - Value: the exact value supplied by Google
   - TTL: the provider default or automatic value
9. Do not edit the existing Render `A`, `AAAA`, or `CNAME` records.
10. Save the record, return to Search Console, and select **Verify**.
11. If verification fails, wait for DNS propagation and retry. Do not add multiple copies of the same record.
12. After verification, leave the TXT record in DNS permanently.

Expected result: the selected property is displayed as `sc-domain:tailoredagents.com`, and the personal Google account Jeffrey selected for this setup is an owner.

## Task 2: create or select the production Google Cloud project

1. Open <https://console.cloud.google.com/> with the same personal Google account.
2. Open the project selector.
3. Look for a project named `Tailored Agents Production`.
4. If it exists and is clearly the project created for this integration, select it. Do not create a duplicate.
5. Otherwise, select **New Project** and use:
   - Project name: `Tailored Agents Production`
   - Organization: `No organization`, if Google asks
6. Create the project and make it the active project.
7. Before every later Google Cloud action, confirm `Tailored Agents Production` is still shown in the project selector.

## Task 3: enable the Search Console API

1. In the active Google Cloud project, open **APIs & Services -> Library**.
2. Search for `Google Search Console API`.
3. Open the Google Search Console API, sometimes displayed as `Search Console API`.
4. Select **Enable**.
5. Confirm its API status is Enabled before continuing.

Do not enable the Google Indexing API as a substitute. It is a different API and does not provide the analytics data used by this application.

## Task 4: configure Google Auth

1. Open **Google Auth Platform** in the same project.
2. If the platform displays **Get Started**, select it.
3. Configure the initial fields:
   - App name: `Tailored Agents`
   - User support email: the personal Google account Jeffrey selected for this setup, unless Google accepts an authorized Tailored Agents support address
   - Audience: `External`
   - Developer contact email: the personal Google account Jeffrey selected for this setup
4. Complete the initial setup.
5. Open **Google Auth Platform -> Branding** and provide:
   - App name: `Tailored Agents`
   - Home page: `https://www.tailoredagents.com`
   - Privacy policy: `https://www.tailoredagents.com/privacy`
   - Terms of service: `https://www.tailoredagents.com/terms`
   - Authorized domain: `tailoredagents.com`
   - Developer contact email: the personal Google account Jeffrey selected for this setup
6. An app logo is optional and should be skipped unless an approved Tailored Agents asset is readily available.
7. Save the Branding configuration.

## Task 5: configure the minimum OAuth scope

1. Open **Google Auth Platform -> Data Access**.
2. Select **Add or remove scopes**.
3. Find and add only:

   ```text
   https://www.googleapis.com/auth/webmasters.readonly
   ```

4. Save or update the scope selection.
5. Do not add `https://www.googleapis.com/auth/webmasters`; that is the broader read/write permission and is not needed.

## Task 6: configure the audience

1. Open **Google Auth Platform -> Audience**.
2. While the app is in Testing, add the same personal Google account Jeffrey selected under **Test users**.
3. Save the change.
4. After the OAuth client in Task 7 is configured, return here and select **Publish App** or **Move to Production**.
5. Confirm the status reads **In production**.
6. Google might offer **Prepare for verification**. Do not begin a public verification submission as part of this assignment. A limited personal-use integration can operate unverified, subject to Google's warning screen and user cap.

Do not leave this External app in Testing. Because the integration requests offline Search Console access, a Testing authorization normally expires after seven days.

## Task 7: create the OAuth Web client

1. Open **Google Auth Platform -> Clients**.
2. Look for an existing Web application client created specifically for the Tailored Agents production website.
3. If a correct client exists, edit and reuse it. Do not create duplicates.
4. Otherwise, select **Create Client** and set:
   - Application type: `Web application`
   - Name: `Tailored Agents Website`
5. Leave **Authorized JavaScript origins** empty. This is a server-side OAuth flow.
6. Under **Authorized redirect URIs**, add exactly:

   ```text
   https://www.tailoredagents.com/api/integrations/search-console/callback
   ```

7. Remove any accidental variation missing `www`, using HTTP, adding a trailing slash, or using a different path.
8. Create or save the client.
9. Securely transfer the displayed client ID and client secret directly into Render in Task 8. Do not place either value in Codex or the repository. The client ID is less sensitive than the secret, but treat both as configuration data.

## Task 8: configure the existing Render web service

1. Open <https://dashboard.render.com/> and select the Tailored Agents workspace.
2. Open the existing `tailored-agents-web` service.
3. Open **Environment**.
4. Add or update these two variables using the values from the Google OAuth client:

   ```text
   GOOGLE_SEARCH_CONSOLE_CLIENT_ID
   GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET
   ```

5. Do not add `NEXT_PUBLIC_` to either key.
6. Do not change `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, or the dashboard credentials.
7. Save the environment changes and select **Save and deploy** if Render offers that option.
8. Confirm these non-secret values remain correct:

   ```text
   BETTER_AUTH_URL=https://www.tailoredagents.com
   NEXT_PUBLIC_SITE_URL=https://www.tailoredagents.com
   ```

The two Google variables are declared with `sync: false` in `render.yaml`. Render ignores newly added `sync: false` variables during updates to an existing Blueprint, so entering them manually is required.

## Task 9: verify the Render Blueprint and cron service

1. Return to the Tailored Agents Render workspace and open the Blueprint that owns `tailored-agents-web`.
2. Review its latest sync.
3. If commit `d779eb1` or a newer commit has already synced successfully, check whether `tailored-agents-search-console-sync` exists.
4. If the cron service exists, do not create another one.
5. If it does not exist, select **Manual Sync**, review the proposed change, and approve creation of `tailored-agents-search-console-sync`.
6. The cron service has Render's minimum charge of $1 per month; Austin has been informed of this cost.
7. Confirm the Blueprint created `SEARCH_CONSOLE_SYNC_SECRET` on the web service and references the same value from the cron service.
8. Do not manually reveal, copy, or replace `SEARCH_CONSOLE_SYNC_SECRET` unless troubleshooting proves the Blueprint reference failed.
9. Confirm the cron configuration uses:
   - Schedule after cost review: `*/5 * * * *`; the first check after 10:17 UTC requests the daily refresh.
   - Command: `npm run search-console:sync`
   - URL: `https://www.tailoredagents.com/api/cron/search-console`
10. Wait for the web service deployment to report **Live**.

The web build runs database migrations. Migrations through `db/migrations/0006_www_canonical_site.sql` must deploy successfully before connecting Google. The www migration updates only the existing internal website's address, preserving its ID, credentials and reports. Both application and Render routing send apex visitors to www. The old `ENABLE_APEX_REDIRECT` setting is obsolete and ignored. Keep authentication, public metadata, the OAuth callback and the worker URL on www.

## Task 10: connect Google from the private dashboard

1. Open <https://www.tailoredagents.com/sign-in> and use your Tailored Mail email address and password. The mail owner can approve teammates in Mail → Manage team; complete any temporary-password change in Mail first.
2. Open <https://www.tailoredagents.com/dashboard/analytics>.
3. Select **Connect Google**.
4. Choose the same personal Google account that owns `sc-domain:tailoredagents.com` and the Google Cloud project.
5. Confirm the consent screen requests read-only Search Console access.
6. If Google displays an unverified-app warning, proceed only after confirming:
   - The app name is `Tailored Agents`.
   - The project and OAuth client are the ones created in this assignment.
   - The requested access is read-only.
7. For the expected warning, select **Advanced**, then **Go to Tailored Agents**, and approve the request.
8. Google should redirect back to the production analytics dashboard.
9. Confirm the dashboard reports the connected property as `sc-domain:tailoredagents.com`.
10. Confirm the connection does not select an unrelated Search Console property from the selected Google account.

The initial connection queues 90 days of finalized Search Console history; it continues after the browser closes. Search Console reporting can trail current activity by a few days, and a low-traffic site can legitimately have no metric rows yet.

## Task 11: test manual and scheduled synchronization

### Dashboard test

1. On `/dashboard/analytics`, select **Refresh Google**.
2. Confirm an import is queued and its days-checked progress advances through the background worker.
3. Confirm the integration remains connected.
4. Confirm **Last completed import** advances when the import finishes, and worker check-in time is current.
5. If Google has finalized data for the site, confirm the dashboard can render clicks, impressions, click-through rate, average position, queries, and pages.

### Render cron test

1. In Render, open `tailored-agents-search-console-sync`.
2. Open **Runs**.
3. Select **Trigger Run**.
4. Wait for the run to complete.
5. Confirm the run status is successful and its logs do not contain a credential, token, or database URL.
6. Refresh `/dashboard/analytics` and confirm the completed-import timestamp remains current.
7. Verify the next genuinely scheduled daily refresh, reconcile an identical fixed range with Google, and repeat a manual refresh to prove there are no duplicate results. Do not mark the connection complete before this observation.

## Troubleshooting guide

### `redirect_uri_mismatch`

- Open the Web application client in Google Auth Platform.
- Confirm the redirect URI is exactly `https://www.tailoredagents.com/api/integrations/search-console/callback`.
- Remove `www`, HTTP, a trailing slash, or whitespace.

### Dashboard says setup is unavailable

- Confirm both Google environment-variable keys exist on `tailored-agents-web`.
- Confirm the latest web deployment occurred after the variables were saved.
- Do not expose the values while checking.

### Google says access is denied

- Confirm the correct personal Google account was selected.
- Confirm it is a Test user if the app is still temporarily in Testing.
- Confirm the app's audience is External.

### No verified Tailored Agents property is found

- Confirm the selected Google account owns `sc-domain:tailoredagents.com`.
- Confirm the Domain property is verified, not merely created.
- Do not work around this by selecting another property or changing the production hostname.

### Search Console API error or `accessNotConfigured`

- Confirm the Search Console API is enabled in the exact Google Cloud project that owns the OAuth client.
- Do not enable the Indexing API as a replacement.

### Sync reports an error

- Check the dashboard's sanitized status and the Render server logs.
- Confirm the OAuth app is In production and the account still grants access.
- Confirm `SEARCH_CONSOLE_SYNC_SECRET` exists on the web service and is referenced by the cron service.
- Do not paste raw logs into Codex until all URLs, tokens, cookies, database strings, personal email addresses, and secrets have been removed.

### Connected but no metrics appear

- Check Search Console's own Performance report for the same property and date range.
- Google data is finalized with a delay; a recent or low-traffic site may have no rows.
- Treat a successful connection and sync with zero returned rows as different from a failed sync.

## Relevant repository files

Review these files if Codex needs to understand the implementation:

- `README.md`, section **Google Search Console activation**
- `render.yaml`
- `.env.example`
- `db/migrations/0004_search_console.sql`
- `lib/search-console/config.ts`
- `lib/search-console/google.ts`
- `lib/search-console/connection.ts`
- `lib/search-console/sync.ts`
- `lib/search-console/data.ts`
- `app/api/integrations/search-console/`
- `app/api/cron/search-console/route.ts`
- `app/dashboard/analytics/page.tsx`

Do not change application code merely to bypass a configuration problem. If a genuine code defect is found, document reproduction evidence, make the smallest safe correction, run the full release gate, and obtain approval before changing infrastructure behavior.

The full code gate is:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

## Completion report

Send Austin a concise report containing only non-secret evidence:

```text
Google Search Console property verified: yes/no
Google Cloud project configured: yes/no
Search Console API enabled: yes/no
OAuth audience/status: External / In production
Read-only scope only: yes/no
OAuth callback exact: yes/no
Render Google environment keys present: yes/no (names only, never values)
Web deployment status: Live/not Live
Cron service present: yes/no
Dashboard connection: connected/not connected
Connected property: sc-domain:tailoredagents.com or error
Manual dashboard sync: success/failure
Manual cron run: success/failure
Last successful sync time and timezone:
Outstanding issues:
```

Do not include screenshots that show secrets. After setup, remove any temporary plaintext copy of the Google client secret and close sensitive account pages.

## Later ownership improvement

When Tailored Agents obtains a dedicated Google identity, add it to both Search Console and Google Cloud IAM, verify its access independently, and reconnect the dashboard under that identity. Keep the personal Google account as a backup owner until the new business identity has been fully tested.

## Phase 2 and Phase 3 production closeout

After Search Console is connected, finish the operational work that remains open in `docs/LAUNCH_CHECKLIST.md`. Configuration evidence belongs in a private operational record or a sanitized report, never in Git.

### Credential and infrastructure safety

1. Rotate any database password or authentication secret that was exposed during initial setup. Update only Render's secret store and dependent resource configuration.
2. Do not rotate `BETTER_AUTH_SECRET` after Google has been connected without planning a Search Console reconnection, because stored provider tokens are encrypted with a key derived from that secret.
3. Confirm the persistent PostgreSQL service is in the intended Render region, uses private connectivity, and does not expose unrestricted public access.
4. Establish a documented logical-backup process and perform a restore drill with non-production records.
5. Record recovery ownership, frequency, retention, encryption, and the exact restore verification steps without committing credentials or backup contents.
6. Ensure retention maintenance runs at least monthly. Do not create another paid Render resource without Austin's explicit approval; first propose the simplest reliable scheduling option and its cost.
7. Confirm migrations `0001` through `0004` each appear exactly once in `schema_migrations`.

### Authentication validation

1. Verify the approved owner can sign in and sign out.
2. Verify public sign-up is unavailable.
3. Verify a non-allowlisted address cannot provision or access a dashboard account.
4. Verify direct unauthenticated access to every protected route redirects to sign-in.
5. Verify removing an address from the allowlist revokes data access even when an old session cookie exists.
6. Confirm dashboard responses are not publicly cached and protected routes are excluded from search indexing and sitemaps.
7. Review every protected read and mutation for session, workspace, role, and resource-ownership checks.

Use synthetic or explicitly authorized test identities. Do not record passwords, session cookies, or private email addresses in test artifacts.

### Internal operations validation

1. Submit authorized test project inquiries and website-review requests.
2. Confirm each inquiry is stored even if Resend is absent or fails.
3. Exercise lead qualification, assignment, notes, next actions, won/lost state, and conversion.
4. Verify a converted lead can become a client, contact, site, and project without duplicate data entry.
5. Exercise milestones, deliverables, decisions, internal notes, search, filtering, pagination, and CSV export.
6. Verify every important mutation creates an attributable audit event.
7. Test anonymization and retention using non-production records.
8. If Austin authorizes Resend setup later, configure it as a separate bounded operational task. It is not a prerequisite for dashboard access or Search Console.

### First-party analytics validation

1. Confirm migration `0003_first_party_analytics.sql` is applied exactly once.
2. Generate authorized production test visits and verify page views, CTA clicks, phone clicks, form starts, and successful submissions use the documented event definitions.
3. Confirm duplicate inquiry submissions do not double-count successful conversions.
4. Verify UTM source, medium, campaign, and external referring-host attribution.
5. Verify Do Not Track and Global Privacy Control prevent client-side analytics requests.
6. Verify `/dashboard`, `/sign-in`, and other private routes do not generate public analytics events.
7. Validate 7-day, 30-day, and 90-day reports, empty states, funnel counts, top pages, acquisition rows, and freshness labels.
8. Confirm stored analytics events contain no raw IP address, user-agent string, full referrer URL, or form contents.
9. Confirm the 25-month event-retention behavior with controlled test data.

### Search Console validation after activation

1. Confirm migration `0004_search_console.sql` is applied exactly once.
2. Verify the initial import covers up to 90 days of finalized history.
3. Compare a controlled date range against Google Search Console for clicks, impressions, click-through rate, average position, top queries, and top pages.
4. Confirm the dashboard clearly displays connection health and last successful synchronization.
5. Run **Refresh Google** twice and confirm the rolling import is idempotent rather than duplicating metrics.
6. Confirm the daily Render cron refreshes the finalized trailing window.
7. Test disconnect behavior only after Austin agrees: tokens should be cleared while retained historical metrics remain available. Reconnect and verify recovery.
8. Confirm token encryption and ensure access tokens, refresh tokens, authorization codes, and OAuth state never appear in responses, logs, audit metadata, screenshots, or source.
9. Test or inspect the 10-minute OAuth-state expiry, 18-month Search Console metric retention, and 24-month sync-history retention.
10. Keep GA4 deferred unless a written use case demonstrates value not already provided by first-party events and Search Console.

### Phase 2 and Phase 3 exit report

Do not move real clients into the product until Austin has reviewed a sanitized report confirming:

- Authentication and denial paths passed.
- Lead-to-client operations passed.
- Backup and restore were tested.
- Retention behavior was tested.
- First-party event definitions and privacy controls passed.
- Search Console connected and returned either reconciled metrics or a legitimate zero-data result.
- Manual and scheduled synchronization passed.
- Remaining launch-checklist items are listed explicitly rather than silently deferred.

## Phase 4: client Growth Hub and public demonstration

### Goal

Turn the proven internal workflow into a secure client experience and a separate sales demonstration. Client access must never be created by weakening the internal dashboard or exposing internal queries.

### Phase 4A: architecture and client-isolation contract

Before implementation:

1. Audit the current workspace, membership, client, contact, site, project, record, analytics, and integration ownership model.
2. Write a short architecture decision describing the client access boundary, route boundary, invitation lifecycle, session behavior, and visibility rules.
3. Decide whether the production client experience uses `/portal` or another dedicated protected namespace. Do not place client members inside internal `/dashboard` routes by merely hiding navigation.
4. Define an explicit matrix for owner, administrator, internal member, client member, and demo visitor permissions.
5. Define which data can be client-visible:
   - Approved reports
   - Explicitly shared projects, milestones, and deliverables
   - Approved recommendations and upcoming priorities
   - Client-visible comments and decisions
6. Define data that can never be client-visible:
   - Internal notes
   - Other clients or workspaces
   - Provider credentials and connection internals
   - Unapproved drafts and recommendations
   - Security and internal audit details
7. Define invite expiry, single-use behavior, revocation, membership suspension, account recovery, and audit requirements.
8. Add threat cases and cross-tenant integration tests before building the full interface.

### Phase 4B: client access foundation

Implement the smallest complete access layer:

1. Versioned migrations for invitation and client-membership data with explicit constraints and retention behavior.
2. Server-only authorization functions that verify the session, active membership, client/site assignment, role, and target resource on every read and mutation.
3. Invitation creation, delivery-independent invite-link handling, acceptance, expiry, revocation, and audit events.
4. A client portal shell that is visually separate from the internal dashboard and does not expose internal navigation.
5. Safe unavailable, unauthorized, empty, expired-invite, and suspended-access states.
6. Integration tests for horizontal and vertical authorization failures, including guessed IDs and direct route access.

Resend may eventually deliver invitations, but invitation correctness must not depend on successful email delivery. An owner should be able to copy a secure invitation through an audited workflow while email is unavailable.

### Phase 4C: useful client experience

Add, in bounded releases:

1. Client overview and current priorities.
2. Approved analytics and Search Console reporting scoped to the assigned site.
3. Completed and upcoming work.
4. Client-visible milestones, deliverables, and recommendations.
5. Approval and comment workflows with actor, time, state, and audit history.
6. Notification preferences without assuming a provider is always available.
7. Accessible exports that include only client-approved and client-owned data.
8. Clear freshness and disconnected-integration states.

Do not show synthetic numbers inside an authenticated production client portal. Empty or disconnected states must be truthful.

### Phase 4D: public demonstration

1. Build the demo in a separate public route such as `/demo/growth-hub`.
2. Use synthetic or deliberately sanitized fixtures stored separately from production records.
3. Do not share private authentication, provider credentials, database queries, or server actions with the demo.
4. Label demo data clearly.
5. Add an accessible demo-to-contact conversion path without altering Austin's final visual direction.
6. Prove through tests that the demo cannot query production client records.

### Phase 4 exit criteria

- Cross-client and cross-workspace isolation is covered by integration tests.
- A revoked or expired invitation cannot be reused.
- A client cannot access internal notes, unapproved work, credentials, or another client's data through UI or direct requests.
- Approval and comment changes are attributable and audited.
- Exports respect the same authorization rules as on-screen reads.
- The public demo uses only its isolated synthetic or sanitized source.
- Austin approves the client-facing scope and presentation before any real invitation is sent.

## Phase 5: human-operated SEO workspace

### Goal

Create a complete, reviewable SEO delivery workflow that humans can operate before any AI system is allowed to recommend or act.

### Phase 5A: research and architecture

1. Document the real Tailored Agents SEO engagement workflow from intake through audit, prioritization, client approval, implementation, and measurement.
2. Define the supported audit classes before choosing tools. Begin with a narrow, testable set of technical and on-page checks.
3. Evaluate crawler and job-runtime options against Render limits, JavaScript rendering needs, robots directives, rate controls, cost, reliability, and resumability.
4. Obtain Austin's approval before adding a paid service, proxy network, data provider, or long-running worker.
5. Define crawl authorization rules. Never crawl a client site without an active engagement and explicit site assignment.
6. Treat page content and connected external content as untrusted input from the beginning.

### Phase 5B: crawl and evidence model

Implement versioned records for:

- Crawl runs, status, bounds, errors, and resumable progress.
- Canonical page identity and page snapshots.
- Response status, indexability, canonicalization, metadata, headings, links, structured data, and other approved signals.
- Evidence attached to each detected issue.
- Retention and deletion appropriate to client content.

Required behavior:

- Respect explicit page, request, time, and concurrency limits.
- Identify the crawler appropriately.
- Obey the approved robots and site-access policy.
- Make retries idempotent and failures visible.
- Avoid storing secrets, session-only content, or unnecessary page data.
- Move sustained or long-running crawl work out of request-response web handlers when the workload justifies a worker or workflow service.

### Phase 5C: human SEO workflow

Implement:

1. Technical and on-page issues with evidence, severity, owner, state, timestamps, and resolution history.
2. Keyword targets associated with pages, locations, services, and intent.
3. Competitor records and manually reviewed comparison evidence.
4. A recommendation queue with impact, effort, confidence, owner, approval state, and source links.
5. Content briefs and change drafts with revision history.
6. Explicit relationships between Search Console metrics, first-party conversions, pages, issues, and recommendations.
7. Client-visible approval states that integrate with Phase 4 without exposing internal drafts.
8. Filters, exports, audit events, empty states, and data-freshness indicators.

### Phase 5D: quality baseline

Before Phase 6:

1. Complete at least one representative SEO engagement manually inside the product using authorized or synthetic data.
2. Create reviewed examples of true positives, false positives, severity decisions, prioritization decisions, acceptable briefs, and rejected drafts.
3. Record the evidence a human needs to approve each recommendation class.
4. Measure the time and failure modes of crawl and review workflows.
5. Build a versioned evaluation dataset from approved, non-sensitive examples.

### Phase 5 exit criteria

- A human can perform and document the supported SEO engagement without external spreadsheets becoming the hidden system of record.
- Every issue and recommendation can be traced to evidence.
- Reviewers can distinguish observed facts, calculated signals, assumptions, and editorial judgment.
- Recommendation quality can be evaluated consistently.
- No model is publishing or changing a client site.

## Phase 6: bounded SEO agent

### Goal

Add intelligence to the proven SEO workflow without creating opaque autonomy. The initial agent audits and drafts; it does not publish.

### Phase 6A: research and written proposal

Before implementation:

1. Research current model providers, structured-output support, tool controls, pricing, latency, privacy terms, data-retention settings, and operational limits using primary documentation.
2. Compare build-versus-buy options for crawling, retrieval, evaluation, and background execution.
3. Define the smallest useful agent scope from the Phase 5 evaluation set.
4. Produce a cost model for low, expected, and high usage.
5. Produce a threat model covering prompt injection, poisoned content, cross-tenant leakage, tool abuse, secret exposure, unsafe output, excessive spend, and partial failure.
6. Present the proposal and costs to Austin. Do not create paid accounts or resources without approval.

Do not select a model or framework permanently from memory or popularity. Re-evaluate current primary documentation when this phase begins.

### Phase 6B: agent platform foundation

Implement:

1. Versioned agent definitions, prompts, tool schemas, policies, and evaluation cases.
2. Durable agent runs and step state with idempotent, resumable jobs.
3. Per-workspace budgets, usage accounting, timeouts, and concurrency limits.
4. Narrow tool allowlists and least-privilege integration credentials.
5. Structured outputs validated before persistence or display.
6. Complete input, evidence, output, approval, rejection, failure, retry, cost, and latency history.
7. A global kill switch plus per-workspace and per-agent disable controls.
8. A background worker or workflow boundary if jobs can outlive normal web requests.

### Phase 6C: safe capability sequence

Add capabilities only in this order:

1. Read-only classification and audits for the explicitly supported issue classes.
2. Prioritized recommendations grounded in stored evidence.
3. Human-reviewed content briefs, metadata, and proposed edits.
4. Narrowly scoped external changes only after explicit human approval, reliable previews, idempotency, and rollback procedures exist.
5. Do not introduce automatic publishing in the initial release.

Each capability must pass its evaluation gate before enabling the next one. A polished interface is not evidence of acceptable model quality.

### Required defenses

- Treat crawled text, metadata, linked documents, and provider responses as untrusted data, never instructions.
- Keep system policy and tool authorization outside model-controlled content.
- Never place provider secrets, session tokens, or unrestricted database access in model context.
- Validate every proposed URL, resource ID, workspace ID, and mutation server-side.
- Require human approval for every externally visible change.
- Show citations to the stored evidence used by each recommendation.
- Make failures, stale evidence, uncertainty, and unsupported conclusions visible.
- Test malicious and misleading pages in the evaluation suite.

### Phase 6 exit criteria

- Evaluation cases demonstrate an approved precision threshold for every enabled recommendation class.
- A reviewer can trace each output to evidence, prompt version, model version, tools, costs, and policy version.
- Failures and retries cannot duplicate, partially publish, or cross workspace boundaries.
- Budgets, latency, and usage are observable per run and workspace.
- The kill switch and per-workspace disable controls are tested.
- No action reaches a client website without an attributable human approval and an available rollback path.

## Ongoing coordination with Austin

Austin may continue changing public pages while this roadmap proceeds. Before each push:

1. Pull or fetch the latest `main`.
2. Inspect whether Austin changed a shared path.
3. Preserve his public design and copy unless a technical correction is necessary.
4. If a technical requirement affects the public interface, document the required data or behavior and let Austin make the final presentation decision.
5. Never replace real public content with dashboard placeholders or agent-generated copy without approval.

At the end of each bounded release, report:

```text
Branch and commit(s):
Roadmap phase/workstream:
Implemented:
Database migrations:
Environment or paid-resource changes requiring approval:
Authorization and isolation tests:
Other tests run and results:
Production actions performed:
Documentation/checklist updates:
Known limitations:
Exact review steps for Austin:
Next recommended workstream:
```

Never include passwords, cookies, API keys, tokens, database URLs, DNS verification values, customer records, or private account addresses in that report.
