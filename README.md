# Tailored Agents

This repository contains the Tailored Agents public website, the foundation of its private operating dashboard, and a separately deployed team mail application.

The business currently delivers premium websites, managed local SEO and growth analytics, focused automation, managed agents, and custom software. The product direction is to turn the internal delivery workflow into a secure Growth Hub over time. Analytics and human-reviewed SEO operations come before any autonomous SEO agent.

Read [the product plan](docs/PRODUCT_PLAN.md) before making architectural or roadmap changes. It is the source of truth for the current state, delivery phases, security boundaries, deferred decisions, and eventual SEO-agent scope.

## Current release state

### Public website

Operational today:

- Production Next.js marketing site deployed on Render.
- Service, package, pricing, work, industry, company, legal, and contact routes.
- Transparent starting prices and a website/SEO package calculator.
- Project inquiry and free website-review delivery through Resend when configured.
- Conceptual Growth Hub and analytics visuals labeled as illustrative.

### Private dashboard

Phase 1 is implemented in the application source:

- Versioned PostgreSQL migrations.
- Allowlisted passwordless authentication using short-lived, single-use links.
- Database-backed sessions and shared authentication rate limiting.
- Workspace membership and owner/admin/member/viewer roles.
- Initial site, lead, and append-only audit tables.
- Server-only authorization and narrow dashboard data-transfer objects.
- Protected `/dashboard`, `/dashboard/activity`, and `/dashboard/settings` routes.
- Safe setup behavior: the marketing site remains operational when dashboard infrastructure is absent.

Activation still requires the owner to connect a persistent PostgreSQL database and set the dashboard environment variables. Client operations, measurement, client accounts, SEO tooling, and the SEO agent are not implemented yet.

### Tailored Mail

`apps/mail` is a separate Cloudflare Workers application with its own deployment, database, storage, queues, tests, and operational documentation. Pushing the Render website does not deploy the mail application. See [the mail README](apps/mail/README.md) before changing or deploying it.

## Technology

- Next.js 16.4 App Router and Turbopack
- React 19.3 and strict TypeScript
- Tailwind CSS 4 plus the repository design system
- PostgreSQL through `pg`
- Better Auth 1.7 with the magic-link plugin
- Resend HTTPS API for inquiry and dashboard email delivery
- Lucide React for functional interface icons
- Vitest for unit tests and Oxlint for source linting
- Node.js 22 on Render

Most marketing routes are statically rendered. Contact, health, authentication, sign-in, and configured dashboard requests execute on the server. Database and authentication modules are server-only.

## Repository map

| Path | Purpose |
| --- | --- |
| `app/` | Public routes, protected dashboard routes, and server route handlers. |
| `components/` | Marketing, form, pricing, visualization, and dashboard interface components. |
| `lib/` | Site configuration, pricing, validation, authentication, database access, and dashboard data layer. |
| `db/migrations/` | Ordered PostgreSQL migrations applied by `npm run db:migrate`. |
| `docs/PRODUCT_PLAN.md` | Durable product architecture and implementation roadmap. |
| `docs/LAUNCH_CHECKLIST.md` | Production and release verification checklist. |
| `apps/mail/` | Independently deployed Tailored Mail Cloudflare application. |

## Public pricing

The site publishes transparent starting points rather than gating prices behind a form. `/pricing` contains full package scopes; the homepage and service pages provide shorter summaries.

- Launch Website: $1,500
- Custom Growth Website: from $2,250
- Advanced Website: from $4,000
- SEO Essentials: $400/month
- SEO Growth: $650/month
- SEO Foundation Setup: $350 for Essentials or $500 for Growth; included with a new website and SEO package
- Focused Workflow automation: from $650
- Managed Tailored Agent: from $500 activation plus $750/month and usage
- Connected agent systems and custom software: tailored proposal

`lib/services.ts` is the source of truth for public pricing and package inclusions. Review any price change against actual delivery capacity before release.

The Growth Hub remains a product direction until its client access and production workflows are operational. Do not describe a conceptual dashboard as an included live client portal.

`lib/packages.ts` defines the website and SEO package calculator. The six-month option adds a 20% payment-plan premium to the deferred website amount; SEO remains month to month. Have written payment terms reviewed in each applicable jurisdiction before accepting an agreement.

## Local development

Install dependencies and prepare local values:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Public pages render without delivery or database credentials. The inquiry forms clearly report unconfigured delivery, and the team sign-in page clearly reports incomplete dashboard setup.

For a working local dashboard, provide a PostgreSQL database, set every dashboard variable below, run `npm run db:migrate`, and start the application. The first allowlisted identity to complete a magic-link sign-in becomes the Tailored Agents workspace owner; later allowlisted identities become administrators.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical public origin, normally `https://tailoredagents.com`. |
| `RESEND_API_KEY` | For email delivery | Server-only Resend API credential used by inquiries and dashboard links. |
| `CONTACT_FROM_EMAIL` | For email delivery | Sender on a domain verified by Resend. Also serves as the dashboard sender unless overridden. |
| `CONTACT_TO_EMAIL` | For inquiry delivery | Authorized business inbox that receives public inquiries. |
| `TRUSTED_PROXY_IPS` | Optional | Explicitly trusted custom proxies allowed to set forwarding headers. |
| `DATABASE_URL` | Dashboard | Server-only PostgreSQL connection string. |
| `BETTER_AUTH_SECRET` | Dashboard | At least 32 high-entropy characters used by authentication. |
| `BETTER_AUTH_URL` | Dashboard | Canonical authentication origin, normally `https://tailoredagents.com`. |
| `DASHBOARD_ALLOWED_EMAILS` | Dashboard | Comma-separated internal email allowlist. |
| `DASHBOARD_FROM_EMAIL` | Optional | Dashboard-specific verified sender; falls back to `CONTACT_FROM_EMAIL`. |

Never expose secrets through a `NEXT_PUBLIC_` variable. Do not commit `.env.local`, database URLs, tokens, customer records, or temporary setup evidence.

## Database and migrations

The migration runner creates `schema_migrations`, applies each new `.sql` file from `db/migrations` in lexical order, and records the filename in the same transaction. Re-running it skips completed files.

```powershell
npm run db:migrate
```

If `DATABASE_URL` is absent, the command exits successfully after reporting that dashboard migrations were skipped. This keeps the existing marketing deployment safe while infrastructure is being connected.

Do not use an expiring free database for real business data. Render's free PostgreSQL tier expires after 30 days and has no managed recovery. Select a persistent plan deliberately, restrict external database access where practical, and establish backup and restore procedures before Phase 2 stores leads or clients. See [Render's free-tier limitations](https://render.com/docs/free) and [PostgreSQL recovery documentation](https://render.com/docs/postgresql-backups).

## Authentication and authorization

- There is no public registration.
- Only addresses in `DASHBOARD_ALLOWED_EMAILS` receive a sign-in link or pass identity validation.
- Magic links expire after 10 minutes, are single-use, and are stored hashed.
- Authentication rate limits use PostgreSQL so they work across web instances.
- Sessions last up to 14 days and are stored in PostgreSQL.
- Dashboard data access rechecks the active allowlist and workspace membership.
- Protected reads and future mutations must authorize at the data layer; hiding interface elements is never sufficient.
- The public demo planned for a later phase must use a separate read-only implementation and sanitized data.

## Contact handling

The project inquiry and free website-review forms share one protected delivery route. The review funnel uses a public `websiteUrl` field while retaining `website` as the hidden honeypot. Both types apply server-side field validation, minimum completion time, request-size limits, an in-memory rate limit, a duplicate-content guard, and provider idempotency.

Phase 1 does not write inquiry contents to PostgreSQL. Persisting inquiries as leads while preserving email delivery is a Phase 2 task. The application does not intentionally log inquiry contents.

Render may run multiple instances, so the current public-form abuse controls remain per instance. Phase 2 should move those controls to shared storage before higher traffic or abuse risk.

## Checks

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

`render.yaml` defines the Node web service, a persistent Render PostgreSQL database, their private-network connection, the health check, automatic deploy trigger, build-time migration command, and the remaining environment contract. The owner approved the smallest paid database plan on October 16, 2026.

To activate the dashboard:

1. Sync the Render Blueprint and approve creation of `tailored-agents-db` on the `0.1c-256mb` plan.
2. Confirm the database and web service are both in Ohio and `DATABASE_URL` resolves from the database connection string.
3. Set `DASHBOARD_ALLOWED_EMAILS` to the approved internal accounts.
4. Confirm `RESEND_API_KEY` and `CONTACT_FROM_EMAIL`, or set `DASHBOARD_FROM_EMAIL` separately.
5. Confirm Render generated `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL=https://tailoredagents.com`.
6. Redeploy. The build runs migrations before `next build`.
7. Visit `/sign-in`, complete the first allowlisted login, and verify `/dashboard`, activity, settings, sign-out, expired-link behavior, and denial for a non-allowlisted address.

The web process starts with `next start -H 0.0.0.0`; Next.js reads Render's injected `PORT` automatically.

## Domain and HTTPS

The canonical metadata uses the apex domain. Keep one canonical hostname and redirect the other. Apply only the DNS records Render displays, wait for its managed TLS certificate, and verify HTTPS redirects plus HSTS, CSP, frame, MIME, referrer, and permissions headers.

Do not add another proxy or CDN until certificate, forwarding-header, authentication callback, and redirect behavior have been tested end to end.

## Content and asset notes

- StonegateOS capability language was grounded in its public repository and canonical system documents reviewed on October 12, 2026.
- Source presence is not proof that every provider, flag, or protected workflow is active in a specific deployment.
- Marketing interface visuals use synthetic data and are labeled conceptual where appropriate.
- No customer data or StonegateOS implementation code is included in the marketing application.

## Current release gates

- Sync the Blueprint and confirm the approved persistent PostgreSQL resource is healthy before activating the dashboard with real business data.
- Configure the dashboard allowlist and complete live sign-in/denial/session tests.
- Confirm the authorized inquiry recipient and a Resend-verified sender.
- Replace the temporary personal phone number through `lib/site.ts` when the final Woodstock-area business number is ready.
- Add an authorized privacy/legal contact and confirm governing-law language if counsel requires it.
- Complete browser-based responsive, accessibility, and authenticated-flow QA.
- Review service scope, public copy, and the StonegateOS case study with the business owner.

See [the launch checklist](docs/LAUNCH_CHECKLIST.md) for the complete production gate.
