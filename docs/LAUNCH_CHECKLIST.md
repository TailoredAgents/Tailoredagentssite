# Launch and release checklist

Use this checklist for the public website and private dashboard. The mail application has a separate live-test checklist in `apps/mail/README.md` and a separate Cloudflare deployment process.

## Product and documentation

- [ ] Review `docs/PRODUCT_PLAN.md` and update phase status when capabilities change.
- [ ] Confirm public copy distinguishes current production features from illustrative or planned product direction.
- [ ] Confirm the Growth Hub is not described as included client access until Phase 4 is operational.
- [ ] Confirm the SEO agent is not described as active until its evaluation, approval, and audit controls pass.
- [ ] Update the README, environment example, migration notes, and this checklist in the same release as architecture changes.

## Ownership and business configuration

- [ ] Confirm GitHub repository ownership, branch protection, and authorized collaborators.
- [ ] Confirm the authorized Tailored Agents business email address.
- [ ] Replace the temporary personal phone number with the final Woodstock-area business number through `lib/site.ts`.
- [ ] Verify the Resend sending domain and configure inquiry delivery variables.
- [ ] Confirm the legal/privacy contact and required governing jurisdiction.
- [ ] Review public StonegateOS capability language with the system owner.

## PostgreSQL and dashboard activation

- [ ] Select a persistent PostgreSQL plan deliberately; do not store real business records on an expiring free database.
- [ ] Place the database in an appropriate region and restrict external access where practical.
- [ ] Set `DATABASE_URL` as a server-only Render environment value.
- [ ] Confirm `BETTER_AUTH_SECRET` is generated, private, and at least 32 high-entropy characters.
- [ ] Set `BETTER_AUTH_URL=https://tailoredagents.com` using the final canonical hostname.
- [ ] Set `DASHBOARD_ALLOWED_EMAILS` to the exact approved internal accounts.
- [ ] Confirm `RESEND_API_KEY` and a verified `CONTACT_FROM_EMAIL` or `DASHBOARD_FROM_EMAIL` sender.
- [ ] Run `npm run db:migrate` and verify every expected filename exists once in `schema_migrations`.
- [ ] Confirm the Tailored Agents workspace and production site seed records exist.
- [ ] Establish logical backup, retention, restore, and credential-rotation procedures before Phase 2 stores real lead/client records.

## Authentication and authorization

- [ ] Complete the first allowlisted magic-link login and confirm it provisions the owner membership.
- [ ] Confirm later allowlisted accounts receive the intended membership role.
- [ ] Confirm a non-allowlisted address receives no email and cannot create an authorized account.
- [ ] Confirm magic links expire after 10 minutes and fail after first use.
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
- [ ] Confirm unconfigured project and website-review forms report failure.
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

## Phase 2 data gate

Complete these before persisting public inquiries in PostgreSQL:

- [ ] Approve inquiry retention and deletion rules.
- [ ] Add database-backed abuse controls suitable for multiple web instances.
- [ ] Make database persistence and email delivery failure states explicit and retry-safe.
- [ ] Add role-aware lead mutations and same-transaction audit records.
- [ ] Test export, deletion, backup, and restore with non-production records.
- [ ] Confirm privacy disclosures match the data actually stored.

## After each release

- [ ] Monitor Render health, migration output, authentication errors, database capacity, and failed email delivery without logging message contents or secrets.
- [ ] Review dependency advisories and rerun the full verification gate.
- [ ] Confirm an owner for content, dependency, privacy, data-retention, case-study, and dashboard-access updates.
- [ ] Add any material product, security, or architecture decision to the product-plan decision log.
