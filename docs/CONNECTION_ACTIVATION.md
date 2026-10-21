# Website connection activation — October 21, 2026

Jeffrey requested activation of Google Search Console and inquiry notifications. He chose alerts for both Jeffrey and Austin, signed the Render CLI back in, and supplied a domain-restricted Resend sending key through a private local dialog. Secret values are kept out of this document and source control.

## Inquiry alerts

- `CONTACT_TO_EMAIL` accepts one address or a comma-separated list of up to ten valid, unique team addresses. Visitor input cannot change the recipients.
- The website sends from the dedicated `notifications@tailoredagents.com` address, with the display name “Tailored Agents Website.” Replies go to the person who submitted the inquiry.
- Each stored inquiry triggers one Resend request for the configured recipients. Retrying the same submission does not create another lead or send another alert. Invalid configuration leaves the inquiry stored and records that no alert was sent.
- Settings shows the configured destinations. Historical leads explain when alerts were not enabled at receipt; enabling alerts does not rewrite those records or resend old inquiries.
- Local validation: 79 code/database tests, 19 browser checks, lint, strict types, production build and dependency audit passed. The audit reports zero vulnerabilities. New tests cover both recipients, normalization, duplicate addresses, invalid settings, visitor-supplied destinations and repeated submissions.

## Preparation for Google

- The installed Google client and secret match Jeffrey’s downloaded Web client. Its registered callback is exactly `https://www.tailoredagents.com/api/integrations/search-console/callback`.
- Render reports point-in-time recovery available. A production logical export created at 17:30 UTC was restored successfully into a disposable PostgreSQL 18 container with no network access. The restored database included all seven migrations, identities, leads and the site. It contained no Google connection or imported Google reports at that point.
- The temporary restored database, its Docker volume and local copy of the export were removed after verification. The provider retains its export under its normal retention policy. No production network allowlist was changed and no paid service was created.
- A new Render-managed database credential and fresh authentication/encryption secret are deployed. After the new deployment and successful database-backed inquiry, the original database login was revoked. The provider credential list now contains only the new login. The temporary rollback copy of old credentials was removed. Dashboard sessions require sign-in again; Mail passwords are unchanged.

## Live acceptance still to record

- [x] New deployment uses the updated settings and remains healthy.
- [x] Old database login revoked after confirming the new credential works.
- [x] A clearly marked live test inquiry is saved once and its alert reaches both team inboxes.
- [x] Jeffrey authorized Google from Analytics and confirmed the connected state.
- [x] Real 90-day import, repeated refresh, fixed-range reconciliation and automatic processing verified.
- [ ] Confirm Google Auth Platform → Audience explicitly says **In production**, separately from the earlier reported branding publication.
- [ ] Next genuinely scheduled daily Google refresh observed separately from an idle worker check.

Rollback: retain all database data and the current Mail deployment. The prior website application remains compatible with the new database credential and authentication secret. If reverting to code without multiple destinations, temporarily choose one approved recipient rather than leaving a comma-separated value. Do not restore the exposed setup credentials or alter mail DNS.

## Verified production results

Commit `285587f192b8f92a317e2b5eeaee5e4b1472a483` is live in deployment `dep-dbcfh0ijnfac73bslsl0`, finished at **17:39:49 UTC**. Home, sign-in and health return 200. No database migration was required for this release.

The contact endpoint accepted the clearly labeled inquiry `TA inquiry alert check 2026-10-21 1740` with 201. Repeating the identical submission returned 200 with `duplicate: true`. The request included Global Privacy Control and no measurement session. The test record remains visibly labeled in Leads; it is not a real sales inquiry.

A read-only query of the production Mail database found exactly one inbound copy for each selected teammate. Both imports are `complete`, both reference saved full content, and both contain the message text. No existing inbox messages were opened or changed. Historical inquiry notification states were preserved.

The scheduled **17:40 UTC** reporting worker check succeeded, and an authenticated manual worker check after rotation returned 200 with no failed imports. At that stage Google was not yet authorized, so these are successful **idle checks**, not proof of a Google import or daily data refresh.

After Jeffrey authorized Google, the genuinely scheduled **17:45 UTC** worker completed **90 date updates with zero stopped imports** at 17:45:42 UTC. A subsequent authenticated worker check returned 200 with no remaining work or failed imports.

Jeffrey then clicked **Refresh Google** twice and closed the dashboard. An authenticated manual worker request completed **10 date updates, zero failures, no remaining work**. A fresh production export created at 17:47 UTC was restored into a disposable PostgreSQL 18 container with no network access. It confirmed:

- Exactly one active connection to `sc-domain:tailoredagents.com`, with `siteOwner` permission and only `https://www.googleapis.com/auth/webmasters.readonly` granted. Refresh credentials are encrypted; no connection error is recorded.
- **90 covered dates**, July 21–October 18 inclusive; no detailed-data limit flags. The initial OAuth import completed 90/90 dates at 17:45:42 UTC.
- Exactly one subsequent manual job, completed 10/10 dates at 17:47:07 UTC after Jeffrey reported closing the browser. No pending dates or duplicate metric groups.
- The labeled inquiry exists once, has delivery state `sent`, and has no measurement attribution because Global Privacy Control was enabled.

The restored refresh credential successfully obtained a new Google access token in memory. A separate read-only Google request for the same **July 21–October 18 / Web / finalized / property totals** range matched the stored report: **0 clicks, 0 impressions, 0 dates with returned activity, 0 mismatches**. Coverage records distinguish these successfully checked dates from unimported dates. No query/page rows were returned, so live reconciliation of nonzero detailed rows remains a future-data check; pagination and nonzero aggregation are covered by controlled automated tests.

The temporary restored database, its volume and downloaded backup were removed. Google tokens and application secrets were neither printed nor committed. The genuinely scheduled **17:50 UTC** worker subsequently reported zero remaining date updates and zero stopped imports.

The next daily refresh is expected on **October 22, at the first check after 10:17 UTC**, normally **10:20 UTC / 6:20 a.m. Eastern**. Record that job and the new covered date after it actually runs; today's successful initial/manual imports and idle checks do not prove tomorrow's daily refresh.
