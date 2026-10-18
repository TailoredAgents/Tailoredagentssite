# Jeffrey handoff: activate Google Search Console analytics

## Assignment

Complete the production Google Search Console connection for Tailored Agents. The application code, database migration, dashboard reporting, manual sync, and Render cron job are already implemented. This assignment is configuration and verification work; do not redesign or replace the integration.

Start from `main` at commit `d779eb1` or newer. Read this file completely before taking action.

## Definition of done

This task is complete only when all of the following are true:

- The Domain property `sc-domain:tailoredagents.com` is verified in Google Search Console.
- A dedicated Google Cloud project named `Tailored Agents Production` exists under Austin's approved personal Google account.
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
| Website | `https://tailoredagents.com` |
| Search Console property | `sc-domain:tailoredagents.com` |
| Google Cloud project name | `Tailored Agents Production` |
| OAuth audience | `External` |
| OAuth client type | `Web application` |
| OAuth client name | `Tailored Agents Website` |
| OAuth scope | `https://www.googleapis.com/auth/webmasters.readonly` |
| Authorized redirect URI | `https://tailoredagents.com/api/integrations/search-console/callback` |
| Web service | `tailored-agents-web` |
| Cron service | `tailored-agents-search-console-sync` |
| Dashboard analytics | `https://tailoredagents.com/dashboard/analytics` |

The redirect URI must use HTTPS, must not contain `www`, and must not have a trailing slash.

## Access and security rules

Austin has approved use of his personal Google account for this setup. Do not use an account owned by his other business.

- Do not ask Austin to send a Google, DNS, Render, or dashboard password through chat.
- Austin should enter account credentials and two-factor codes himself, or provide access through an approved signed-in session.
- Ensure two-factor authentication is enabled on the personal Google account.
- Never give a secret value to Codex. Codex can guide the browser interaction without reading the value.
- Never paste secrets into the repository, an issue, a commit, a screenshot, or the completion report.
- Do not rotate `BETTER_AUTH_SECRET`. Search Console token encryption is derived from it.
- Do not change existing DNS records. Add only the Google verification record described below.
- Do not create a second web service, database, Blueprint, or duplicate cron service.
- Resend is unrelated to this task and can remain unconfigured.

## Before starting

1. Pull the latest `main` branch.
2. Confirm commit `d779eb1` or a newer commit is present.
3. Confirm the worktree is clean.
4. Arrange authorized access to:
   - Austin's personal Google account.
   - The DNS manager for `tailoredagents.com`.
   - The Tailored Agents Render workspace.
   - The private Tailored Agents dashboard.
5. If any access is unavailable, complete all safe read-only checks you can, then report the exact missing access. Do not invent credentials or create resources in another account.

## Task 1: verify the Search Console Domain property

1. Sign in to <https://search.google.com/search-console/> with Austin's approved personal Google account.
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

Expected result: the selected property is displayed as `sc-domain:tailoredagents.com`, and Austin's approved personal Google account is an owner.

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
   - User support email: Austin's approved personal Google account, unless Google accepts an authorized Tailored Agents support address
   - Audience: `External`
   - Developer contact email: Austin's approved personal Google account
4. Complete the initial setup.
5. Open **Google Auth Platform -> Branding** and provide:
   - App name: `Tailored Agents`
   - Home page: `https://tailoredagents.com`
   - Privacy policy: `https://tailoredagents.com/privacy`
   - Terms of service: `https://tailoredagents.com/terms`
   - Authorized domain: `tailoredagents.com`
   - Developer contact email: Austin's approved personal Google account
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
2. While the app is in Testing, add Austin's same personal Google account under **Test users**.
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
   https://tailoredagents.com/api/integrations/search-console/callback
   ```

7. Remove any accidental variation containing `www`, HTTP, a trailing slash, or a different path.
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
   BETTER_AUTH_URL=https://tailoredagents.com
   NEXT_PUBLIC_SITE_URL=https://tailoredagents.com
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
   - Schedule: `17 10 * * *`
   - Command: `npm run search-console:sync`
   - URL: `https://tailoredagents.com/api/cron/search-console`
10. Wait for the web service deployment to report **Live**.

The web build runs database migrations. Migration `db/migrations/0004_search_console.sql` must deploy successfully before connecting Google.

## Task 10: connect Google from the private dashboard

1. Open <https://tailoredagents.com/sign-in> and sign in to the Tailored Agents dashboard.
2. Open <https://tailoredagents.com/dashboard/analytics>.
3. Select **Connect Google Search Console**.
4. Choose the same personal Google account that owns `sc-domain:tailoredagents.com` and the Google Cloud project.
5. Confirm the consent screen requests read-only Search Console access.
6. If Google displays an unverified-app warning, proceed only after confirming:
   - The app name is `Tailored Agents`.
   - The project and OAuth client are the ones created in this assignment.
   - The requested access is read-only.
7. For the expected warning, select **Advanced**, then **Go to Tailored Agents**, and approve the request.
8. Google should redirect back to the production analytics dashboard.
9. Confirm the dashboard reports the connected property as `sc-domain:tailoredagents.com`.
10. Confirm the connection does not select an unrelated Search Console property from Austin's Google account.

The initial connection imports up to 90 days of finalized Search Console history. Search Console reporting can trail current activity by a few days, and a low-traffic site can legitimately have no metric rows yet.

## Task 11: test manual and scheduled synchronization

### Dashboard test

1. On `/dashboard/analytics`, select **Sync now**.
2. Wait for the request to finish and the page to reload.
3. Confirm the integration remains connected.
4. Confirm **Last synced** has a recent timestamp.
5. If Google has finalized data for the site, confirm the dashboard can render clicks, impressions, click-through rate, average position, queries, and pages.

### Render cron test

1. In Render, open `tailored-agents-search-console-sync`.
2. Open **Runs**.
3. Select **Trigger Run**.
4. Wait for the run to complete.
5. Confirm the run status is successful and its logs do not contain a credential, token, or database URL.
6. Refresh `/dashboard/analytics` and confirm the synchronization timestamp remains current.

## Troubleshooting guide

### `redirect_uri_mismatch`

- Open the Web application client in Google Auth Platform.
- Confirm the redirect URI is exactly `https://tailoredagents.com/api/integrations/search-console/callback`.
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
