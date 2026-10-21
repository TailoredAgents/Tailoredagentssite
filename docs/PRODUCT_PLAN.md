# Tailored Agents product plan

Last updated: October 18, 2026

This document is the durable product and implementation plan for the Tailored Agents website, internal dashboard, future client Growth Hub, analytics platform, SEO workspace, and eventual SEO agent. It records the intended sequence, boundaries, data model, security posture, and completion criteria so future work does not drift from the business goals.

## Product direction

Tailored Agents uses websites and managed SEO as the primary entry point for client relationships:

1. Premium website design and development.
2. Managed local SEO and growth analytics.
3. Standardized website intelligence and business-operations agents introduced through a limited founding-client rollout.
4. Focused business automation and, where justified, advanced managed agents.
5. Custom software and connected systems for qualified projects.

The software product grows out of those services. A website creates the customer-facing foundation, managed SEO adds recurring improvement and reporting, website intelligence adds chat, qualification, booking, or follow-up, and operations agents can later support calls, service, documents, reporting, and connected workflows. These capabilities should accumulate through one client relationship and shared infrastructure rather than become unrelated systems.

The immediate goal is not to launch a broad autonomous-agent platform. It is to build a reliable internal operating system that helps Tailored Agents manage leads, clients, websites, work, evidence, and eventually bounded agent activity. That system can then become a client-facing Growth Hub and, only after the data and workflows are trustworthy, support a bounded SEO agent.

### Commercial service ladder

- Websites generally carry the larger upfront project fee and establish the initial client relationship.
- Managed SEO and growth analytics create recurring monthly value after launch.
- Standardized agents use a $0 setup model for the approved standard configuration and a recurring monthly fee, with usage and nonstandard work identified separately.
- Founding-client introductory prices are $99/month for a Website Chat Assistant, $149/month for a Lead Qualification Assistant, $199/month plus messaging usage for a Lead Follow-Up Agent, and $299/month plus voice usage for an AI Phone Receptionist.
- Smaller future add-ons may generally fall between $49 and $149 per month, but they must not be published as available before their scope and delivery model exist.
- Advanced agents, broader integrations, and custom software retain implementation pricing plus an individually defined support and usage model.
- Normal analytics and the planned human-reviewed SEO intelligence layer belong inside the existing managed SEO subscription rather than becoming separate agent charges.
- Founding-client pricing is positioned as an introductory program for suitable early clients, not as low-service or universally available work.

## Product principles

- Sell what exists. Conceptual interfaces must stay labeled as illustrative until the corresponding production capability is operational.
- Collect evidence before adding autonomy. Analytics, work history, and reviewed recommendations come before an SEO agent.
- Keep people accountable. Generated recommendations, content, and actions require review and an attributable approval path.
- Design for multiple clients without overbuilding the first release. Every business record belongs to a workspace, even while Tailored Agents is the only workspace.
- Treat access control as a data-layer concern. Every protected read and mutation must verify the session, workspace membership, role, and resource ownership.
- Minimize sensitive data. Store only what the product needs, return narrow data-transfer objects, and never expose provider credentials to the browser.
- Prefer explicit states over hidden automation. Users should see what ran, what changed, who approved it, and what needs attention.
- Protect the marketing site from application failures. Missing dashboard infrastructure must not take down public pages or inquiry delivery.

## Current state

### Operational today

- A production Next.js 16.4 marketing website deployed on Render.
- Public pages for websites, SEO, automation, engineering, packages, pricing, work, company, and contact.
- Transparent starting prices and an interactive website/SEO package calculator.
- Project inquiry and free website-review forms stored in PostgreSQL, with Resend notifications when configured.
- First-party page, acquisition, intent, form, and conversion events with an internal analytics dashboard.
- A Blueprint-managed persistent PostgreSQL database and private internal operations dashboard.
- Lead qualification and conversion plus client, contact, site, project, milestone, and project-record workflows.
- A separate Tailored Mail application under `apps/mail`, deployed independently to Cloudflare Workers.
- Conceptual Growth Hub and analytics visuals that are explicitly presented as illustrative.

### Not yet operational

- Production-authorized Google Search Console data; the readiness upgrade is implemented and Jeffrey has authorized its merge to `main`; production ownership, authorization and scheduled behavior remain unverified.
- Client accounts or a client-facing Growth Hub.
- A public interactive product demo.
- A generally available standardized website-agent or operations-agent catalog; the public site describes a limited founding-client rollout without claiming that every listed capability is operational.
- Automated SEO auditing, recommendations, content generation, or publishing.

## Intended users and access

### Internal owner

Full access to workspace settings, members, integrations, data exports, and sensitive operations.

### Internal administrator

Can manage leads, clients, sites, projects, reports, and reviewed recommendations. Cannot transfer ownership or perform restricted security operations.

### Internal member

Can work within assigned operational areas but cannot change workspace-wide security or billing settings.

### Client member

Future role. Can see only the client workspace and the reports, work items, approvals, and settings explicitly made available to that client.

### Demo visitor

Future public, read-only experience. It must use synthetic or deliberately sanitized data and must never share authentication, routes, data queries, or credentials with the private dashboard.

## Product information architecture

The private application lives under `/dashboard` and remains separate from public marketing navigation.

- Overview: current operating signals, recent activity, and items needing attention.
- Leads: inquiries, qualification status, follow-up ownership, and conversion outcome.
- Clients: business accounts, contacts, status, and associated projects.
- Sites: managed websites, domains, environments, health, and connected data sources.
- Projects: scoped work, milestones, deliverables, decisions, and handoffs.
- Analytics: traffic and conversion reporting after measurement is implemented.
- SEO: audits, issues, opportunities, and reviewed recommendations before agent automation.
- Activity: append-only record of important operational and security events.
- Settings: workspace, members, integrations, retention, and security configuration.

The future public demo should use a dedicated route such as `/demo/growth-hub` or `/demo/seo`. It should never be implemented by weakening authorization on `/dashboard`.

## Delivery roadmap

### Phase 0 — Documentation and architecture

Status: completed with the initial Phase 1 implementation.

Deliverables:

- Reconcile the repository documentation with the actual product state.
- Record this master product plan and decision log.
- Define the initial domain model, authorization boundaries, deployment model, and environment contract.
- Separate current capability, near-term roadmap, and long-term agent work.

Exit criteria:

- The README explains the whole repository and current operating state.
- This plan is linked from the README and kept current as decisions change.
- Launch and operations checklists include both the marketing site and dashboard infrastructure.

### Phase 1 — Backend and private dashboard foundation

Status: implemented and activated for the internal owner account.

Deliverables:

- PostgreSQL connection layer and versioned, repeatable migrations.
- Email-and-password authentication for explicitly allowlisted internal email addresses.
- Secure, HTTP-only database sessions.
- Tailored Agents internal workspace bootstrap.
- Workspace membership and role model.
- Initial site, lead, and append-only audit tables.
- Server-only data-access layer that verifies authentication, allowlist status, membership, and role.
- Protected `/dashboard` shell with real database-backed overview and activity data.
- Clear unavailable/setup state when infrastructure has not been configured.
- Render and environment documentation that does not commit secrets or silently create a paid resource.

Exit criteria:

- Public routes build and run with or without dashboard configuration.
- An allowlisted team member can request a single-use link, sign in, reach `/dashboard`, and sign out.
- A non-allowlisted identity cannot create an authorized dashboard account.
- Direct dashboard access without a valid session redirects to sign-in.
- The authenticated user has an active membership in the Tailored Agents workspace.
- Data queries return only the fields needed by the interface.
- Migrations can be run repeatedly without reapplying completed files.
- Lint, strict type checking, unit tests, production build, and dependency audit pass.

### Phase 2 — Internal operations

Goal: make the dashboard useful every day before making it customer-facing.

Status: implemented in this release. Production use remains gated on credential rotation, backup/restore preparation, and live authentication and workflow verification.

Deliverables:

- Persist new project and website-review inquiries as leads while preserving email delivery.
- Lead status, owner, notes, next action, and conversion outcome.
- Client, contact, site, and project creation/editing.
- Project milestones, deliverables, decisions, and internal notes.
- Search, filtering, pagination, and safe exports.
- Role-aware mutations with audit entries.
- Database-backed abuse protection for inquiry and authentication endpoints.
- Retention rules for inquiry content and operational logs.

Exit criteria:

- The team can manage a lead from submission through won/lost status.
- A converted lead can become a client, site, and project without duplicate data entry.
- Every important mutation identifies the actor, workspace, action, target, and time.

### Phase 3 — Measurement and analytics

Goal: collect and explain the evidence needed for growth work.

Status: Jeffrey authorized the readiness release to merge into `main`; production Google activation remains pending. The release adds durable daily imports, complete-date coverage, recovery and leases, verified inquiry attribution, canonical-origin checks, protected exports and a redesigned reporting screen. Local PostgreSQL, browser and restore evidence is recorded in `docs/SEARCH_CONSOLE_READINESS.md`. A real Google import and the next scheduled daily refresh are still required; the phase is not complete. GA4 remains outside this release.

Deliverables:

- Privacy-reviewed first-party events for page views, CTA clicks, phone clicks, form starts, server-verified successful submissions, and booking-button clicks.
- UTM and referrer attribution with documented retention.
- Website-specific conversion definitions.
- Google Search Console connection and scheduled ingestion.
- GA4 connection where it adds useful data rather than duplicating first-party events.
- Data freshness, connection state, and last-successful-sync visibility.
- Internal dashboards for acquisition, conversion, search visibility, and trends.

Implementation note:

Instrumentation is live first so reporting can accumulate history. The dashboard labels external integrations as unconnected rather than filling their views with synthetic data.

Exit criteria:

- Key conversion events are reproducible and documented.
- Reports distinguish observed data from estimates or synthetic examples.
- Failed or stale integrations are visible and do not silently present old data as current.

### Phase 4 — Client Growth Hub and public demonstration

Goal: turn the proven internal workflow into a useful client experience and sales demonstration.

Deliverables:

- Invitation-based client access and client-scoped roles.
- Client overview, approved reports, completed work, recommendations, and upcoming priorities.
- Approval and comment workflows for relevant deliverables.
- Notification preferences and accessible exports.
- A separately implemented public demo with synthetic or sanitized data.
- Clear demo-to-contact conversion path.

Exit criteria:

- Cross-workspace isolation is covered by integration tests.
- Clients cannot see internal notes, other clients, credentials, or unapproved work.
- The public demo cannot query private production records.

### Phase 5 — SEO workspace without autonomous action

Goal: standardize the inputs and reviewed outputs that an eventual agent will use.

Deliverables:

- Crawl inventory and page snapshots.
- Technical and on-page issue model with evidence, severity, ownership, and lifecycle.
- Keyword, page, location, and competitor tracking model.
- Recommendation queue with impact, effort, confidence, and approval state.
- Content briefs and change drafts with source links and revision history.
- Search Console and analytics evidence attached to relevant recommendations.

Exit criteria:

- Humans can perform and document an SEO engagement completely within the product.
- Recommendation quality can be reviewed consistently before any AI system is allowed to generate or act.

### Phase 6 — Bounded SEO agent

Goal: add intelligence to a proven workflow, not replace the workflow with opaque autonomy.

Initial scope:

- Crawl and classify pages.
- Detect a defined set of technical and on-page issues.
- Rank opportunities using explicit business and performance signals.
- Draft recommendations, content briefs, metadata, and proposed edits.
- Cite the source data used for each recommendation.
- Route every proposed external change through human approval.

Required controls:

- Per-workspace budgets and usage limits.
- Versioned prompts, tools, policies, and evaluation cases.
- Idempotent jobs and resumable run state.
- Tool allowlists and least-privilege integration credentials.
- Structured outputs with validation before storage or execution.
- Complete run, input, output, approval, and failure history.
- Prompt-injection defenses for crawled and connected content.
- No automatic publishing in the initial agent release.
- Kill switch and per-workspace disable controls.

Expansion sequence:

1. Read-only audits.
2. Prioritized recommendations.
3. Human-reviewed content briefs and drafts.
4. Human-approved changes through narrowly scoped integrations.
5. Only consider limited automatic actions after measured reliability and rollback procedures exist.

Exit criteria:

- Evaluation cases demonstrate acceptable precision for every supported recommendation class.
- A reviewer can trace every output to its evidence and agent version.
- Failures are visible, retry-safe, and cannot publish partial work.
- Cost and latency are observable per run and workspace.

## Initial domain model

### Identity and tenancy

- `user`: Better Auth identity record.
- `session`: Better Auth database session.
- `account`: Better Auth provider account record.
- `verification`: single-use authentication verification records.
- `rateLimit`: shared authentication rate-limit records.
- `workspaces`: internal or client tenant boundary.
- `workspace_memberships`: user, workspace, role, and membership status.

### Operations

- `leads`: inquiry and qualification lifecycle.
- `clients`: client business records and lifecycle state.
- `contacts`: contacts belonging to a client.
- `sites`: websites, domains, and environment state.
- `projects`: scoped engagements and delivery status.
- `project_milestones`: project checkpoints and completion state.
- `project_records`: project deliverables, decisions, and internal notes.
- `lead_notes`: attributed internal lead follow-up notes.
- `request_rate_limits`: shared, short-lived public-form abuse controls.
- `audit_logs`: append-only security and business activity.

### Measurement and integrations

- `analytics_events`: implemented first-party events with session-scoped attribution and retention.
- `daily_metrics`: deferred until observed volume or ingestion workload justifies maintained aggregates; current bounded reports query indexed events directly.
- `integration_connections`: implemented encrypted Search Console connection metadata and health state.
- `integration_sync_runs`: implemented ingestion range, trigger, freshness, row count, and failure history.
- `search_console_metrics`: implemented finalized daily property, query, and page performance with 18-month retention.

### SEO and agent work

- `crawl_runs`, `crawl_pages`, and `seo_issues`.
- `search_queries`, `keyword_targets`, and `competitors`.
- `recommendations`, `content_briefs`, and `content_revisions`.
- `agent_definitions`, `agent_runs`, `agent_steps`, and `approvals`.

The first migration creates the identity, tenancy, initial lead/site, and audit foundation. The second migration adds the Phase 2 operational records, shared inquiry controls, delivery states, and retention metadata. The third migration adds the first-party event stream and its 25-month retention contract. The fourth adds encrypted Search Console connections, bounded sync history, and finalized metrics with explicit retention. The fifth migration adds connection generations, resumable jobs, per-date coverage, worker health and verified inquiry attribution while preserving existing reports and encrypted credentials. Later-phase tables should be added with their behavior and retention rules, not speculatively.

## Security and privacy baseline

- Authentication is invitation/allowlist based; there is no public account registration.
- Passwords are hashed by Better Auth, public registration is unavailable, and identity remains restricted to allowlisted addresses.
- Sessions are stored in PostgreSQL and delivered through secure HTTP-only cookies.
- Dashboard access is denied unless the current email is still allowlisted and the user has an active workspace membership.
- Authorization must be repeated in every protected data-access function and mutation.
- The browser never receives database URLs, Resend keys, auth secrets, provider tokens, or full database rows.
- First-party analytics uses a session-scoped random identifier, honors DNT/GPC, and does not persist raw IP addresses, user-agent strings, form contents, or full referrer URLs with events.
- All client-supplied fields, route parameters, and integration payloads must be validated on the server.
- Important mutations must write an audit record in the same transaction where practical.
- Provider credentials must be encrypted at rest before integration work begins.
- Production client data must not be placed on an expiring free database.
- Backup, restore, retention, and deletion procedures must be tested before client records become operationally critical.

## Deployment model

- The public website and dashboard use the existing Render Node web service.
- PostgreSQL is a separate managed resource connected through `DATABASE_URL`.
- Migrations run before the production build and record applied filenames in `schema_migrations`.
- If `DATABASE_URL` or authentication values are absent, migration is skipped, public routes remain healthy, auth APIs return an unavailable response, and the sign-in page explains that setup is incomplete.
- The Render Blueprint provisions the owner-approved `0.1c-256mb` PostgreSQL plan in Ohio and injects its private connection string as `DATABASE_URL`.
- Public database access is disabled in the Blueprint; administrative access should use an explicitly reviewed temporary rule if it is ever required.
- Before storing real lead or client data, use a persistent paid database with recovery support and document a logical-backup schedule.
- Long-running crawls, scheduled syncs, and agent runs should eventually move to a background worker or workflow service instead of blocking web requests.

## Environment contract

Public site:

- `NEXT_PUBLIC_SITE_URL`
- `RESEND_API_KEY`
- `CONTACT_FROM_EMAIL`
- `CONTACT_TO_EMAIL`
- `TRUSTED_PROXY_IPS` when explicitly required by the hosting topology

Dashboard foundation:

- `DATABASE_URL`: server-only PostgreSQL connection string.
- `BETTER_AUTH_SECRET`: at least 32 high-entropy characters.
- `BETTER_AUTH_URL`: canonical application origin.
- `DASHBOARD_ALLOWED_EMAILS`: comma-separated internal email allowlist.
- `DASHBOARD_INITIAL_PASSWORD`: private password of at least 10 characters used to create the first owner credential.

Search Console:

- `GOOGLE_SEARCH_CONSOLE_CLIENT_ID`: server-only Web application OAuth client ID.
- `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET`: server-only OAuth client secret.
- `SEARCH_CONSOLE_SYNC_SECRET`: generated high-entropy secret shared only between the web service and Render cron trigger.

Future integrations must use server-only environment variables or encrypted database records. Do not introduce `NEXT_PUBLIC_` credentials.

## Decisions that are intentionally deferred

- The final client billing and subscription system.
- Whether client workspaces require SSO or MFA beyond the internal password flow.
- The primary analytics stack beyond first-party conversion events and authorized Google integrations.
- The crawler/runtime used for large SEO scans.
- The model provider and orchestration framework for the SEO agent.
- Automated publishing. It is not part of the initial SEO-agent scope.
- A separate backend service. The Next.js backend-for-frontend remains sufficient until background workload, scaling, or organizational boundaries justify separation.

## Decision log

### October 15, 2026 — Sequence the product around evidence

Build the backend and internal dashboard first, internal operations second, analytics third, the client/demo experience fourth, the manual SEO workspace fifth, and the SEO agent last.

### October 15, 2026 — Keep the agent approval based

The initial SEO agent will audit and propose work. It will not publish changes automatically.

### October 15, 2026 — Use one application deployment initially

The marketing site and dashboard remain in the existing Next.js service, with protected routes and a server-only data layer. A separate worker will be introduced only when scheduled or long-running work requires it.

### October 15, 2026 — Use PostgreSQL as the system of record

PostgreSQL provides durable relational constraints, transactions, workspace isolation, reporting support, and a viable path from internal operations to client and agent workloads.

### October 15, 2026 — Do not silently provision a paid database

The initial release contained the database schema, migrations, and deployment contract without creating a paid resource. The free Render database is not acceptable for real business records because it expires and lacks managed recovery.

### October 16, 2026 — Provision the approved database through the Blueprint

The owner approved Render's smallest persistent PostgreSQL plan. The Blueprint now creates `tailored-agents-db`, restricts it to private-network access, and injects its connection string directly into the web service so database configuration cannot drift between resources.

### October 16, 2026 — Make inquiry storage independent of email delivery

Public inquiries are stored transactionally before the application attempts a Resend notification. This lets Tailored Agents begin collecting and managing leads while email setup is pending, keeps delivery failure visible, and prevents provider availability from discarding a valid inquiry. Public inquiry content defaults to 24-month retention; non-won expired inquiries are anonymized and audit events expire after 36 months.

### October 18, 2026 — Make dashboard login independent of email delivery

The private dashboard uses an allowlisted email and password backed by Better Auth database sessions. The first approved identity creates the owner account with a password stored privately in Render and hashed in PostgreSQL. Resend remains optional for public-inquiry notifications and no longer blocks dashboard access.

### October 18, 2026 — Own the initial measurement layer

Phase 3 begins with a small first-party event stream instead of immediately adding another analytics vendor. Session-scoped identifiers, normalized attribution, explicit conversion events, bounded retention, and a private reporting view create useful historical data without advertising profiles or persistent analytics cookies. Search Console remains the next external source; GA4 is optional rather than assumed.

### October 18, 2026 — Connect search evidence read-only

The Search Console integration uses the narrow read-only scope, exact production-property matching, single-use OAuth state, encrypted offline credentials, finalized Google data, and idempotent daily imports with recorded coverage and interruption recovery. The existing Render cron checks pending work every five minutes after schedule review. Its first check after 10:17 UTC queues a daily refresh; manual refresh queues the same durable work. Missing days and the latest ten completed days are checked. Imported query and page evidence is retained for 18 months. GA4 remains deferred because the first-party event stream already owns conversion measurement.

### October 18, 2026 — Expand client relationships through modular agents

Websites and managed SEO remain the primary acquisition offer. Suitable clients can then add standardized website intelligence or business-operations agents through the same long-term relationship and, eventually, the same Growth Hub. Founding-client prices make the first repeatable agents accessible without treating Tailored Agents as a discount provider. Standard configurations use $0 setup and recurring fees; custom integrations and advanced systems remain separately scoped. Public messaging must distinguish the limited founding rollout from generally available or fully implemented capabilities.

## Maintaining this plan

- Update the current-state section whenever a capability becomes operational.
- Mark phase status and exit criteria in the same pull request or commit that changes them.
- Add material architecture, security, pricing, or product-scope decisions to the decision log.
- Do not mark a future feature complete because a visual mockup exists.
- When implementation and this document disagree, resolve the discrepancy rather than allowing both versions to persist.

### October 20, 2026 — Reporting readiness release

Jeffrey approved the expanded readiness plan after the audit found a hostname mismatch and fragile imports. This supersedes the earlier activation-only restriction for this workstream. Scope remains internal reports for Tailored Agents; public design, email, CRM expansion, client portals, SEO agents, GA4 and MFA remain separate. The preview uses isolated demonstration data. Production is not declared complete until the documented live acceptance passes.

### October 21, 2026 — website address

Jeffrey chose `https://www.tailoredagents.com` as the canonical website address and requested completion and testing directly on `main`. Keep Render’s existing apex-to-www direction. Align website metadata, login, Google callback and the existing background job with www; retain the Google Domain property `sc-domain:tailoredagents.com` and preserve historical reports and mail configuration. Deployed on October 21; all 16 public canonical pages and the next five-minute scheduled idle worker check passed. Local checks include 63 automated tests, 10 browser tests and a database restoration drill. Actual Google authorization/import, individual account access, production credential/backup verification and a live inquiry remain open. See `SEARCH_CONSOLE_READINESS.md` for evidence and remaining checks.
