# Launch and release checklist

Use this checklist for the public website and private dashboard. The mail application has a separate live-test checklist in `apps/mail/README.md` and a separate Cloudflare deployment process.

## Product and documentation

- [ ] Review `docs/PRODUCT_PLAN.md` and update phase status when capabilities change.
- [ ] Confirm public copy distinguishes current production features from illustrative or planned product direction.
- [ ] Confirm the Growth Hub is not described as included client access until Phase 4 is operational.
- [ ] Confirm the SEO agent is not described as active until its evaluation, approval, and audit controls pass.
- [ ] Confirm founding-client agent pricing is described as a limited rollout rather than general availability, and that $0 setup is limited to the approved standard configuration.
- [ ] Confirm usage, outside software, nonstandard integrations, compliance work, and custom development are not implied to be included in the introductory monthly price.
- [ ] Update the README, environment example, migration notes, and this checklist in the same release as architecture changes.

## Ownership and business configuration

- [ ] Confirm GitHub repository ownership, branch protection, and authorized collaborators.
- [ ] Confirm the authorized Tailored Agents business email address.
- [ ] Replace the temporary personal phone number with the final Woodstock-area business number through `lib/site.ts`.
- [ ] Verify the Resend sending domain and configure inquiry delivery variables.
- [ ] Confirm the legal/privacy contact and required governing jurisdiction.
- [ ] Review public StonegateOS capability language with the system owner.

## PostgreSQL and dashboard activation

- [x] Select a persistent PostgreSQL plan deliberately; the owner approved `0.1c-256mb` on October 16, 2026.
- [ ] Sync the Blueprint and confirm `tailored-agents-db` is created in Ohio with public access disabled.
- [ ] Confirm Render injects the database's private connection string into `DATABASE_URL`.
- [ ] Confirm `BETTER_AUTH_SECRET` is generated, private, and at least 32 high-entropy characters.
- [ ] Rotate the database password and authentication secret previously exposed during setup, then update only Render's secret store.
- [ ] Set `BETTER_AUTH_URL=https://tailoredagents.com` using the final canonical hostname.
- [ ] Set `DASHBOARD_ALLOWED_EMAILS` to the exact approved internal accounts.
- [ ] Set a private `DASHBOARD_INITIAL_PASSWORD` of at least 10 characters.
- [ ] Configure `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, and `CONTACT_TO_EMAIL` when inquiry email notifications are ready; dashboard login does not depend on them.
- [ ] Verify `sc-domain:tailoredagents.com` in Search Console, enable the Search Console API, and configure the exact production OAuth redirect URI.
- [ ] Add `GOOGLE_SEARCH_CONSOLE_CLIENT_ID` and `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET` manually to the existing Render web service.
- [ ] Run `npm run db:migrate` and verify every expected filename exists once in `schema_migrations`.
- [ ] Confirm the Tailored Agents workspace and production site seed records exist.
- [ ] Establish and test logical backup, retention, restore, and credential-rotation procedures before relying on stored lead/client records.

## Authentication and authorization

- [ ] Complete the first allowlisted password login and confirm it provisions the owner membership.
- [ ] Confirm public email/password sign-up is unavailable.
- [ ] Confirm a non-allowlisted address cannot create or access an authorized account.
- [ ] Confirm `/dashboard`, `/dashboard/activity`, and `/dashboard/settings` redirect without a valid session.
- [ ] Confirm removing an address from the allowlist removes dashboard data access even if an old session cookie exists.
- [ ] Confirm sign-out invalidates the active session and returns to sign-in.
- [ ] Confirm protected responses are not cached publicly and dashboard routes are excluded from indexing/sitemaps.
- [ ] Review every new protected read and mutation for session, workspace, role, and resource-ownership checks.

## Public website production build

- [ ] Run `npm ci` from the committed lockfile.
- [ ] Run `npm run db:migrate` against the intended environment.
- [ ] Run lint, strict type checking, unit tests, production build, and `npm audit`.
- [ ] Confirm all public routes return 200 and unknown routes show the branded 404.
- [ ] Confirm `/api/health` returns 200 without exposing configuration.
- [ ] Confirm project and website-review forms persist leads when Resend is unconfigured and clearly report successful receipt.
- [ ] Confirm the dashboard shows `not_configured`, `sent`, and `failed` notification states accurately.
- [ ] Confirm each configured inquiry type delivers exactly once with the correct subject and reply-to behavior.
- [ ] Confirm no secrets, private records, internal addresses, or security evidence exist in the source/build output.

## Visual and accessibility QA

- [ ] Inspect public pages, sign-in, and authenticated dashboard at 320, 375, 390, 768, 1024, 1440, and 1920 pixel widths.
- [ ] Verify no horizontal overflow, clipping, collision, or inaccessible off-screen content.
- [ ] Test public mobile navigation, workflow tabs, pricing controls, forms, dashboard navigation, and sign-out with keyboard and touch.
- [ ] Check heading hierarchy, landmarks, accessible names, focus visibility, contrast, error messages, and reduced motion.
- [ ] Verify sign-in never reveals whether a submitted address is allowlisted.
- [ ] Run Lighthouse or an equivalent tool for Performance, Accessibility, Best Practices, and SEO on public routes.
- [ ] Inspect browser console and network activity for errors, leaked values, unexpected third-party requests, or mixed content.

## Render, domain, and deployment

- [ ] Review the Render Blueprint and confirm `autoDeployTrigger: commit` still targets the intended branch.
- [ ] Confirm the build runs migrations before `next build` and skips migrations safely only when the dashboard is intentionally unconfigured.
- [ ] Add production secrets in Render, never in the repository.
- [ ] Confirm the apex and optional `www` domains use Render's displayed DNS records.
- [ ] Confirm certificate issuance, HTTPS redirect, canonical hostname, sitemap, robots file, and Open Graph image.
- [ ] Verify response security headers over HTTPS.
- [ ] Verify the authentication callback uses the canonical host and does not create a redirect loop between apex and `www`.
- [ ] Submit authorized project and website-review test inquiries and confirm receipt and duplicate protection.

## Phase 2 operations gate

- [x] Define 24-month inquiry anonymization and 36-month audit retention defaults.
- [x] Add database-backed abuse controls suitable for multiple web instances.
- [x] Make database persistence independent from email delivery and expose delivery state.
- [x] Add role-aware mutations and same-transaction audit records.
- [x] Update privacy disclosures for stored inquiries and hashed rate-limit identifiers.
- [ ] Verify lead qualification, notes, ownership, next actions, won/lost state, and conversion in production.
- [ ] Verify client, contact, site, project, milestone, and project-record create/edit flows in production.
- [ ] Test safe export, anonymization, backup, and restore with non-production records.
- [ ] Schedule `npm run db:retention` at least monthly in addition to deployment-time maintenance.

## Phase 3 measurement gate

- [ ] Confirm migration `0003_first_party_analytics.sql` is recorded once in `schema_migrations`.
- [ ] Confirm a public page view appears in `/dashboard/analytics` without recording a raw IP address, user-agent string, full referrer URL, or form contents.
- [ ] Verify CTA, phone, form-start, and successful inquiry events use their documented definitions and do not double count duplicate inquiry submissions.
- [ ] Verify UTM source, medium, and campaign plus external referring host attribution with authorized test visits.
- [ ] Verify Do Not Track and Global Privacy Control prevent client-side event requests.
- [ ] Verify `/dashboard` and `/sign-in` activity is excluded from public analytics.
- [ ] Verify 7, 30, and 90-day reports, empty states, funnel counts, top pages, acquisition rows, and last-event freshness.
- [ ] Confirm analytics events expire after 25 months through `npm run db:retention`.
- [ ] Keep Search Console and GA4 marked unconnected until real authorization and successful ingestion exist.
- [ ] Confirm migration `0004_search_console.sql` is recorded once in `schema_migrations`.
- [ ] Confirm OAuth requests only `webmasters.readonly`, rejects expired/reused state, and selects only the exact verified Tailored Agents property.
- [ ] Confirm stored Google access and refresh tokens are encrypted and never appear in responses, source, logs, or audit metadata.
- [ ] Authorize Search Console and verify the initial 90-day finalized-data import, top queries, top pages, click/impression totals, CTR, position, and last-successful-sync state.
- [ ] Trigger **Sync now**, then verify the daily Render cron refreshes the trailing finalized window without duplicate metrics.
- [ ] Disconnect and verify tokens are cleared while retained historical metrics remain available.
- [ ] Confirm Search Console metrics expire after 18 months, sync runs after 24 months, and OAuth state after 10 minutes.

## After each release

- [ ] Monitor Render health, migration output, authentication errors, database capacity, and failed email delivery without logging message contents or secrets.
- [ ] Review dependency advisories and rerun the full verification gate.
- [ ] Confirm an owner for content, dependency, privacy, data-retention, case-study, and dashboard-access updates.
- [ ] Add any material product, security, or architecture decision to the product-plan decision log.
