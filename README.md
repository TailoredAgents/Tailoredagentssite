# Tailored Agents

This repository contains the Tailored Agents public website, its private operating dashboard, a separately deployed team mail application, and a private iPhone companion.

The business uses premium websites and managed local SEO as the primary client entry point, then expands suitable relationships into website intelligence, focused automation, managed operations agents, and custom software. The product direction is to connect those services through a secure Growth Hub over time. Analytics and human-reviewed SEO operations come before any autonomous SEO agent.

Read [the product plan](docs/PRODUCT_PLAN.md) and [active agency OS sequence](docs/AGENCY_OS_ROADMAP.md) before making architectural or roadmap changes. It is the source of truth for the current state, delivery phases, security boundaries, deferred decisions, and eventual SEO-agent scope.

For the latest verified Meta, shared Sales inbox and SEO activation status, use [Jeffrey's current checklist](new%20jeffrey.md). It separates completed setup, remaining live checks and future work; the linked setup guides contain reusable technical procedures.

Documentation reconciled with source on October 25, 2026. Use this README for the overview, the opening of the active roadmap for the development queue, and feature guides for current behavior. Dated verification sections describe their recorded release only; they are not fresh test results for the latest commit. [JEFFREY.md](JEFFREY.md) is a historical handoff, not the current assignment or setup checklist. Update current instructions when behavior changes, and preserve dated evidence separately.

## Agency operating-system expansion

The owner has prioritized the internal sales CRM around researched calling lists, Devon's BatchDialer outreach, personalized Factory previews and website sales. The first source release adds Sales, My day, Calling lists and Mockups inside this existing dashboard, using canonical businesses and the existing contacts/clients/projects. It includes reviewed CSV imports, visual sales stages, list attribution, manual/imported communications, evidence-backed channel restrictions, explicit appointments/follow-ups, mockup handoffs and repeat-safe client/project conversion. Public package prices are unchanged; a promotional $800 offer is entered on its individual opportunity.

Read [the active agency OS roadmap](docs/AGENCY_OS_ROADMAP.md) for implemented scope, deployment acceptance and the next releases. [Communications setup](docs/COMMUNICATIONS_SETUP.md) covers the implemented unified Inbox, separate Mail activation and owner-managed Twilio SMS/calling activation. Source implementation and production provider acceptance are tracked separately.

## Current release state

### Public website

Operational today:

- Production Next.js marketing site deployed on Render.
- Service, package, pricing, work, industry, company, legal, and contact routes.
- Transparent starting prices and a website/SEO package calculator.
- A founding-client pricing direction for standardized website and operations agents, clearly separated from custom implementation work and unfinished product capabilities.
- Durable project-inquiry and free website-review capture in PostgreSQL, with live Resend notifications to Jeffrey and Austin. One labeled test inquiry reached both inboxes exactly once on October 21.
- Privacy-conscious first-party measurement for public page views, acquisition, next-step clicks, and inquiry conversions.
- Conceptual Growth Hub and analytics visuals labeled as illustrative.

### Private dashboard

The existing operations and measurement releases are active. The agency sales foundation is implemented in source, with its deployment acceptance tracked in the agency roadmap:

- Versioned PostgreSQL migrations.
- Shared Tailored Mail email-and-password sign-in for owner-approved teammates; passwords remain in the mail service.
- Database-backed sessions and shared authentication rate limiting.
- Workspace membership and owner/admin/member/viewer roles.
- Initial site, lead, and append-only audit tables.
- Server-only authorization and narrow dashboard data-transfer objects.
- Protected dashboard routes for operations, activity, settings, and real website analytics.
- Readable desktop and phone layouts across every dashboard tab, with an overview of open inquiries, due follow-ups and project deadlines. See [dashboard usability and verification](docs/DASHBOARD_USABILITY.md).
- A shared private-workspace design system, grouped navigation with a keyboard page finder, focused creation drawers and organized record/settings pages. See the [22-page design scorecard and implementation](docs/DASHBOARD_DESIGN_AUDIT.md) and [desktop/phone comparison gallery](docs/previews/design/index.html).
- Slate & blue and Midnight blue palettes with a saved Light / Dark / System preference in the sidebar and Settings. See [dashboard appearance](docs/DASHBOARD_APPEARANCE.md) and the [light/dark gallery](docs/previews/themes/index.html).
- Manual lead entry requires a phone number or email; business name, contact name, website, service and notes are optional. Lead search, qualification, ownership, next actions, conversion, safe CSV export and confirmed deletion are implemented. Deletion preserves linked sales, client, project and conversation records while removing the lead and its derived client memory.
- A unified customer Inbox with email, SMS, calls, internal notes, assignment, reminders and personal drafts/read state. New conversation starts with a contact/lead picker and uses saved recipient details; each channel retains its own access permissions.
- Browser calling, voicemail, connected-call recordings, transcripts, summaries and explicitly reviewed follow-up tasks in My day. The owner has confirmed working SMS, calling and recording/analysis setup; feature-specific live acceptance limits remain in the [recording guide](docs/CALL_RECORDINGS.md).
- AI email/SMS suggestions inserted into the editable composer for human review, plus editable, source-backed client briefs. Migration 0019 supports recipient drafts; migration 0020 adds client memory. Suggestions never send automatically. See [Inbox behavior and limits](docs/UNIFIED_INBOX.md).
- Client, contact, site, and project workspaces with milestones, deliverables, decisions, and notes.
- Shared database-backed inquiry controls, delivery status, retention metadata, and audited mutations.
- Internal website reporting with visits, stored inquiries, separate visitor activities, trends, and freshness indicators.
- Read-only Google Search Console connection, encrypted credentials, resumable daily imports, coverage records, and reporting. Jeffrey connected Google on October 21; the automatic worker completed the initial 90-day import without failures. See [activation evidence and remaining checks](docs/CONNECTION_ACTIVATION.md).
- Safe setup behavior: the marketing site remains operational when dashboard infrastructure is absent.

The Blueprint provisions the persistent database. Production dashboard access uses the existing Mail account and password, with approval controlled by a Mail owner. Resend notifications and the Google Search Console connection are active in production. Shared Sales mail is connected, and free SEO monitoring has completed its first production scan. Paid SEO recommendations remain paused pending the dedicated key, business-facts review and model pilot. GA4, client accounts, broader automated SEO publishing and a generally available standardized-agent catalog remain future work. Recorded acceptance and outstanding daily-refresh/team checks are in [Jeffrey's checklist](new%20jeffrey.md) and [Google activation evidence](docs/CONNECTION_ACTIVATION.md).

### Tailored Mail

`apps/mail` is a separate Cloudflare Workers application with its own deployment, database, storage, queues, tests, and operational documentation. Pushing the Render website does not deploy the mail application. See [the mail README](apps/mail/README.md) before changing or deploying it.

### Private iPhone companion

`apps/ios` contains an initial sideloadable iPhone companion with Mail and Dashboard tabs, using the existing deployments and accounts. It builds separately with Xcode and is signed/installed through Sideloadly. Jeffrey confirmed installation and sign-in on his iPhone on October 21, with no blocking problems observed. It requires internet access; push notifications and offline mail are outside this first version. See [the iPhone build, installation, and verification guide](apps/ios/README.md) for the remaining workflow and renewal checks.

## Technology

- Next.js 16.4 App Router and Turbopack
- React 19.3 and strict TypeScript
- Tailwind CSS 4 plus the repository design system
- PostgreSQL through `pg`
- Better Auth 1.7 with email-and-password authentication
- Resend HTTPS API for optional inquiry notification delivery
- Lucide React for functional interface icons
- Vitest for unit tests and Oxlint for source linting
- Node.js 22 on Render

Most marketing routes are statically rendered. Contact, health, authentication, sign-in, and configured dashboard requests execute on the server. Database and authentication modules are server-only.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/` | Public routes, protected dashboard routes, and server route handlers. |
| `components/` | Marketing, form, pricing, visualization, and dashboard interface components. |
| `lib/` | Site configuration, pricing, validation, authentication, database access, and dashboard data layer. `lib/sales/` implements the agency CRM. |
| `db/migrations/` | Ordered PostgreSQL migrations applied by `npm run db:migrate`; 0008 adds agency sales and bounded prospect retention. |
| `docs/PRODUCT_PLAN.md` | Durable product architecture and implementation roadmap. |
| `docs/LAUNCH_CHECKLIST.md` | Production and release verification checklist. |
| `apps/mail/` | Independently deployed Tailored Mail Cloudflare application. |
| `apps/ios/` | Private iPhone companion, Xcode project, Sideloadly packaging, and native checks. |

## Public pricing

The site publishes transparent starting points rather than gating prices behind a form. `/pricing` contains full package scopes; the homepage and service pages provide shorter summaries.

- Launch Website: $1,500
- Custom Growth Website: from $2,250
- Advanced Website: from $4,000
- SEO Essentials: $400/month
- SEO Growth: $650/month
- SEO Foundation Setup: $350 for Essentials or $500 for Growth; included with a new website and SEO package
- Website Chat Assistant: $99/month during the founding-client rollout, with $0 setup for a standard deployment
- Lead Qualification Assistant: $149/month during the founding-client rollout, with $0 setup for a standard deployment
- Lead Follow-Up Agent: $199/month plus messaging usage during the founding-client rollout, with $0 setup for a standard deployment
- AI Phone Receptionist: $299/month plus voice usage during the founding-client rollout, with $0 setup for a standard configuration
- Focused Workflow automation: from $650
- Custom agent systems and connected software: tailored proposal

`lib/services.ts` is the source of truth for public pricing and package inclusions. Review any price change against actual delivery capacity before release.

Founding-client pricing is an introductory commercial program, not a claim that every agent is immediately available or suitable for every business. Fit, standard configuration, usage, outside software, compliance needs, and nonstandard integrations are confirmed before billing. Advanced agents and custom systems retain implementation pricing and an individually defined support model.

The Growth Hub remains a product direction until its client access and production workflows are operational. Do not describe a conceptual dashboard as an included live client portal.

`lib/packages.ts` defines the website and SEO package calculator. The six-month option adds a 20% payment-plan premium to the deferred website amount; SEO remains month to month. Have written payment terms reviewed in each applicable jurisdiction before accepting an agreement.

## Local development

Install dependencies and prepare local values:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Public pages render without dashboard credentials. Inquiry capture requires `DATABASE_URL`; notification email is optional. The team sign-in page reports incomplete setup until its full authentication contract is configured.

For a working local dashboard using separate disposable credentials, keep `DASHBOARD_AUTH_MODE=password`, provide PostgreSQL and the legacy dashboard variables below, run `npm run db:migrate`, and start the application. The first allowlisted identity to sign in with `DASHBOARD_INITIAL_PASSWORD` becomes the Tailored Agents workspace owner. Public registration remains disabled.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical public origin, normally `https://www.tailoredagents.com`. |
| `RESEND_API_KEY` | Optional | Server-only Resend API credential used by inquiry notifications. Public inquiries are still stored without it. |
| `CONTACT_FROM_EMAIL` | For inquiry notifications | Sender on a domain verified by Resend. |
| `CONTACT_TO_EMAIL` | For inquiry notifications | One authorized business inbox or a comma-separated list of up to 10 team addresses. Duplicate addresses receive only one copy. |
| `DATABASE_URL` | Dashboard | Server-only PostgreSQL connection string. |
| `BETTER_AUTH_SECRET` | Dashboard | At least 32 high-entropy characters used by authentication. |
| `BETTER_AUTH_URL` | Dashboard | Canonical authentication origin, normally `https://www.tailoredagents.com`. |
| `DASHBOARD_AUTH_MODE` | Dashboard | `mail` in production; `password` (default) for legacy/local preview accounts. |
| `MAIL_AUTH_URL` | Mail mode | Exact private identity endpoint, `https://mail.tailoredagents.com/api/dashboard-auth`. |
| `MAIL_AUTH_SECRET` | Mail mode | Random secret of at least 32 characters, matching Mail’s `DASHBOARD_AUTH_SECRET`. |
| `DASHBOARD_ALLOWED_EMAILS` | Password mode only | Comma-separated internal email allowlist. |
| `DASHBOARD_INITIAL_PASSWORD` | Password mode only | At least 10 characters. Creates the first owner credential on first successful sign-in. |
| `GOOGLE_SEARCH_CONSOLE_CLIENT_ID` | Search Console | Server-only Google Web application OAuth client ID. |
| `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET` | Search Console | Server-only Google OAuth client secret. |
| `SEARCH_CONSOLE_SYNC_SECRET` | Scheduled sync | At least 32 high-entropy characters; generated by the Render Blueprint and shared only with the cron trigger. |

The full configuration template is [.env.example](.env.example). Feature-specific setup is documented in [Communications](docs/COMMUNICATIONS_SETUP.md), [Voice](docs/VOICE_SETUP.md), [Call recordings](docs/CALL_RECORDINGS.md), [Inbox AI and memory](docs/UNIFIED_INBOX.md#ai-message-drafts-october-24-2026), [Meta](docs/META_SETUP.md), and [SEO](docs/SEO_MANAGER_SETUP.md). The general OpenAI key supports call analysis and message suggestions; SEO uses its separate key and spending controls.

Never expose secrets through a `NEXT_PUBLIC_` variable. Do not commit `.env.local`, database URLs, tokens, customer records, or temporary setup evidence.

## Database and migrations

The migration runner creates `schema_migrations`, applies each new `.sql` file from `db/migrations` in lexical order, and records the filename in the same transaction. Re-running it skips completed files.

```powershell
npm run db:migrate
npm run db:retention
```

If `DATABASE_URL` is absent, the command exits successfully after reporting that dashboard migrations were skipped. This keeps the existing marketing deployment safe while infrastructure is being connected.

Do not use an expiring free database for real business data. Render's free PostgreSQL tier expires after 30 days and has no managed recovery. Select a persistent plan deliberately, restrict external database access where practical, and establish backup and restore procedures before Phase 2 stores leads or clients. See [Render's free-tier limitations](https://render.com/docs/free) and [PostgreSQL recovery documentation](https://render.com/docs/postgresql-backups).

## Authentication and authorization

- There is no public registration.
- In production mail mode, use the same primary email address and password as Tailored Mail. The owner approves dashboard access in Mail → Manage team. Temporary passwords must be changed in Mail first.
- Mail verifies its existing scrypt password hash through a private authenticated server connection. The website stores no new password copy. Dashboard grants cannot open an inbox.
- Existing workspace roles are preserved. Newly approved teammates receive member access; the mail owner receives admin access if no membership exists. Suspended or removed memberships are not restored by login.
- Password changes, resets, account disabling and removal of dashboard approval revoke dashboard access. Each protected request checks the active Mail grant and membership; a Mail outage fails closed.
- Legacy password mode remains available for isolated local previews and deliberate operator recovery. It uses the internal allowlist and Better Auth password hashes; it is never an automatic fallback.
- Authentication rate limits use PostgreSQL so they work across web instances.
- Sessions last up to 14 days and are stored in PostgreSQL.
- Mail and website use separate secure cookies. You sign in to each website with the same credentials; this is not automatic cross-site sign-in. Signing out of the dashboard leaves the inbox signed in.
- Protected reads and future mutations must authorize at the data layer; hiding interface elements is never sufficient.
- The public demo planned for a later phase must use a separate read-only implementation and sanitized data.

## Contact handling

The project-inquiry and free website-review forms share one protected route. Both types are validated on the server and stored as leads before optional notification delivery. Missing or failed Resend delivery does not discard an inquiry; its delivery state remains visible to the team.

The route applies a honeypot, minimum completion time, request-size limit, PostgreSQL-backed rate limit, duplicate fingerprint window, unique submission identifiers, and provider idempotency. The rate-limit key is one-way hashed; raw IP addresses and inquiry contents are not intentionally written to application logs.

New inquiries receive a 24-month retention date. The retention command anonymizes expired inquiries that have not become won business, removes their notes, deletes expired rate-limit records, and expires audit events after 36 months. Won/converted business records require deliberate business-record handling instead of automatic inquiry anonymization. The reporting worker checks retention daily; Render also runs `npm run db:retention` during deployments.

## First-party analytics

Public pages record a narrow set of first-party events: page views, selected CTA clicks, phone clicks, form starts, successful inquiry submissions, and future booked-call links. Events use a random session-scoped identifier in browser session storage. The system does not set an analytics cookie or store a persistent visitor ID, raw IP address, user-agent string, full referrer URL, or form contents with analytics events.

The event route applies origin checks, schema validation and database rate limiting. It rejects browser claims of successful inquiries. A saved inquiry records its optional attribution on the server, with durable recovery if attribution storage fails. DNT/GPC disable measurement in the browser and on incoming requests while allowing the inquiry itself. Events expire after 25 months. Older browser-reported submissions remain stored and are labelled unverified; no missing historical attribution is invented.

`/dashboard/analytics` reports observed first-party data plus authorized Google Search Console clicks, impressions, click-through rate, average position, top queries, and top pages. Production Search Console is connected; the screen distinguishes checked zero-activity dates from missing or disconnected data, without placeholder metrics. GA4 remains optional and should be connected only if it contributes useful data without duplicating the first-party system.

## Google Search Console activation

The integration requests only `webmasters.readonly`. OAuth state is random, database-backed, single-use, and expires after 10 minutes. Access and refresh tokens are encrypted with an application-specific key derived from `BETTER_AUTH_SECRET`; rotating that secret requires reconnecting Google. Imported finalized metrics are retained for 18 months, sync history for 24 months, and raw Google tokens are never returned to the browser or written to logs.

1. In Google Search Console, create and verify the Domain property `sc-domain:tailoredagents.com`. DNS verification is preferred because it covers the apex and `www` hostnames.
2. In Google Cloud, enable the Google Search Console API and configure the OAuth consent screen for the Google account that owns the property.
3. Create an OAuth client with application type **Web application**.
4. Add the exact authorized redirect URI `https://www.tailoredagents.com/api/integrations/search-console/callback`.
5. On the existing Render web service, manually add `GOOGLE_SEARCH_CONSOLE_CLIENT_ID` and `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET`. Render does not add new `sync: false` variables to an existing Blueprint-managed service automatically.
6. Reuse the existing five-minute cron and private shared secret. Its URL must be `https://www.tailoredagents.com/api/cron/search-console`; verify successful checks and review actual runtime cost. See [the release runbook](docs/SEARCH_CONSOLE_READINESS.md).
7. After the credential-rotation check and reviewed deployment, sign in and select **Connect Google** on `/dashboard/analytics`. The callback validates the exact Domain property and saves a 90-day import request. The background worker performs the import even after the browser closes.

The worker checks every five minutes and requests the daily refresh on the first check after **10:17 UTC** (normally 10:20). It imports missing dates and refreshes the latest ten days, one date at a time. Initial history ends three Pacific calendar days ago to use finalized data; Google ordinarily has a 2–3 day delay. Completed zero-activity dates are recorded. Google search-term/page limits are disclosed. **Refresh Google** queues work and repeated clicks reuse the pending job. Disconnecting cancels work and removes tokens while preserving reports.

Reports support 7/30/90-day and custom ranges, preceding-period comparisons where history is sufficient, accessible chart tables, searchable/sortable/paginated detail tables, and protected CSV export. Website presets end yesterday; Google presets end at the latest imported date. Report days use Pacific Time. Visits are sessions; phone and booking activity are clicks; inquiry counts come from stored leads. Conversion rate counts distinct measured visiting sessions with a verified submission.

For private account checks/provisioning, preview steps, recovery instructions, evidence and outstanding live acceptance, use [SEARCH_CONSOLE_READINESS.md](docs/SEARCH_CONSOLE_READINESS.md).

## Checks

The shared Sales Inbox is connected at `/dashboard/inbox` through the separately deployed, address-scoped Mail bridge. [Jeffrey's checklist](new%20jeffrey.md#shared-sales-inbox--remaining-work) tracks the remaining teammate and delivery checks; [the communications runbook](docs/COMMUNICATIONS_SETUP.md) holds setup/recovery procedures. The isolated email browser suite is `npm run test:inbox:browser`; it uses synthetic Mail on loopback and requires the disposable `ta_inbox_browser_test` PostgreSQL database.

The SMS channel at `/dashboard/inbox?channel=sms` adds text conversations and an owner-managed Twilio connection in Settings. The owner has confirmed working two-way SMS; [the communications runbook](docs/COMMUNICATIONS_SETUP.md) remains the setup/recovery reference. `npm run test:sms:browser` uses the exact disposable `ta_sms_browser_test` database and intercepts the SDK transport only inside the guarded test process. It sends no real texts. New environments default sending off; configured sending still requires current grants and respects channel restrictions.

The unified customer Inbox includes a Call composer, persistent browser phone, signed staff routing, business hours, call history and protected voicemail. Migration **0013** and [the voice runbook](docs/VOICE_SETUP.md) cover calling. Migration **0014** adds [recordings, transcripts and summaries](docs/CALL_RECORDINGS.md); **0015** adds [reviewed call follow-up tasks](docs/CALL_FOLLOW_UP_TASKS.md). `npm run test:voice:browser` uses only `ta_voice_browser_test` on loopback port 55433, with a development-only SDK fixture and intercepted provider transport. It places no real calls. Long-audio chunking and speaker-labeled/timestamped transcripts remain future refinements.

`npm run test:conversations:browser` covers the unified Inbox, contact-first entry, AI drafting and client briefs with isolated synthetic providers. See [Inbox verification](docs/UNIFIED_INBOX.md) and the [local release gate](docs/AGENCY_OS_ROADMAP.md#repeat-the-local-release-gate) for database and fixture setup. Historical test totals are not a substitute for rerunning the relevant checks after code changes.

Run the complete website gate after dependency, schema, authentication, route, or design changes:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

Mail checks and builds are separate:

```powershell
npm run mail:check
npm run mail:test
npm run mail:build
```

## Render deployment

`render.yaml` defines the Node web service, a persistent Render PostgreSQL database, their private-network connection, the health check, automatic deploy trigger, build-time migration and retention commands, and the existing shared reporting/SEO cron. The configured schedule is every five minutes; reporting also processes due retention, call maintenance/analysis and Meta imports. The owner approved the smallest paid database plan on October 16, 2026. Existing deployments and scheduled checks are recorded in the current handoff; review actual hosting/runtime charges separately from the SEO AI allowance.

Production uses Mail-backed sign-in. The following is a configuration/recovery reference, not a request to repeat completed activation:

1. Confirm the existing `tailored-agents-db` and web service are in Ohio and `DATABASE_URL` uses the intended database connection. Preserve the existing database and recovery arrangements.
2. Confirm Mail migration **0036_dashboard_login.sql** and its private `DASHBOARD_AUTH_SECRET` are installed before enabling website Mail mode. Mail is deployed separately; a website push does not update it.
3. Set `DASHBOARD_AUTH_MODE=mail`, `MAIL_AUTH_URL=https://mail.tailoredagents.com/api/dashboard-auth`, and the matching private `MAIL_AUTH_SECRET` on the website. Keep a valid `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL=https://www.tailoredagents.com`.
4. In Mail → **Manage team**, approve the intended teammate for dashboard access. Complete any temporary-password change in Mail first. Sharing a Sales inbox is a separate address-specific grant with its own CRM bridge secret.
5. Deploy the website as needed. The build runs pending migrations before `next build`.
6. Visit `/sign-in` with the approved Mail credentials and verify dashboard access, sign-out and denial for an unapproved account. Follow [the shared sign-in runbook](docs/SEARCH_CONSOLE_READINESS.md#october-21-shared-mail-sign-in) for recovery and rollback.

**Local previews or deliberate password-mode recovery only:** use `DASHBOARD_AUTH_MODE=password` with `DASHBOARD_ALLOWED_EMAILS` and `DASHBOARD_INITIAL_PASSWORD`. These legacy settings do not configure Mail-mode access and are never an automatic fallback during a Mail outage. See [Local development](#local-development).

The web process starts with `next start -H 0.0.0.0`; Next.js reads Render's injected `PORT` automatically.

## Domain and HTTPS

The canonical website address is `https://www.tailoredagents.com`, as Jeffrey requested on October 21. Render redirects the apex to www; the application uses the same direction. Set both public and authentication origins to www, and call the worker directly at www. The Google Domain property remains `sc-domain:tailoredagents.com`. Apply only the DNS records Render displays, wait for its managed TLS certificate, and verify HTTPS redirects plus HSTS, CSP, frame, MIME, referrer, and permissions headers.

Do not add another proxy or CDN until certificate, forwarding-header, authentication callback, and redirect behavior have been tested end to end.

## Content and asset notes

- StonegateOS capability language was grounded in its public repository and canonical system documents reviewed on October 12, 2026.
- Source presence is not proof that every provider, flag, or protected workflow is active in a specific deployment.
- Marketing interface visuals use synthetic data and are labeled conceptual where appropriate.
- No customer data or StonegateOS implementation code is included in the marketing application.

## Current release gates

- Confirm the Blueprint-managed PostgreSQL resource is healthy, private, backed up, and restorable before relying on it for business records.
- Rotate any setup credentials that were exposed outside the intended secret store, verify Mail dashboard approvals and complete live sign-in/denial/session tests. Keep legacy password-mode recovery separate.
- Confirm the authorized inquiry recipient and a Resend-verified sender.
- Replace the temporary personal phone number through `lib/site.ts` when the final Woodstock-area business number is ready.
- Add an authorized privacy/legal contact and confirm governing-law language if counsel requires it.
- Complete browser-based responsive, accessibility, and authenticated-flow QA.
- Verify production analytics ingestion, conversion definitions, privacy controls, and 7/30/90-day dashboard ranges.
- Review service scope, public copy, and the StonegateOS case study with the business owner.

See [the launch checklist](docs/LAUNCH_CHECKLIST.md) for the complete production gate.

The internal **Dashboard → SEO manager** has live free monitoring and implemented tools for reviewed search-title/description changes, verification, rollback and outcome tracking. Paid recommendations remain paused for the live model pilot. The allowance is capped at **$10/month**, the existing reporting job is reused, and DataForSEO/city-ranking checks are off. See [SEO manager setup](docs/SEO_MANAGER_SETUP.md) for configuration and recovery. Full article and technical repair publishing remain later stages.
