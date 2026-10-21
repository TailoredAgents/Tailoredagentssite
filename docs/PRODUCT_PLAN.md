# Tailored Agents product plan

Last updated: October 21, 2026

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
- Project inquiry and free website-review forms stored in PostgreSQL, with live Resend notifications to Jeffrey and Austin.
- First-party page, acquisition, intent, form, and conversion events with an internal analytics dashboard.
- Read-only Google Search Console reporting, authorized October 21 with the first 90-day import completed by the automatic worker. Final acceptance still includes observing the next scheduled daily refresh.
- A Blueprint-managed persistent PostgreSQL database and private internal operations dashboard.
- Lead qualification and conversion plus client, contact, site, project, milestone, and project-record workflows.
- Shared Mail/dashboard credentials for owner-approved teammates; Jeffrey confirmed live sign-in on October 21.
- Readable, responsive internal dashboard screens and a daily-work overview showing open inquiries, follow-ups and project deadlines. Release evidence is in `DASHBOARD_USABILITY.md`.
- A separate Tailored Mail application under `apps/mail`, deployed independently to Cloudflare Workers.
- Conceptual Growth Hub and analytics visuals that are explicitly presented as illustrative.

### Not yet operational

- Client accounts or a client-facing Growth Hub.
- A public interactive product demo.
- A generally available standardized website-agent or operations-agent catalog; the public site describes a limited founding-client rollout without claiming that every listed capability is operational.
- Automated SEO auditing, recommendations, content generation, or publishing.


### October 21 agency operating-system expansion

The first agency-sales release is implemented in source, extending this application's existing database and contact/client/project records. It adds reviewed calling-list imports, source attribution, a visual pipeline, staff sales queues, manual/imported communication history, deliberate appointments/follow-ups, Factory mockup handoffs and repeat-safe sales conversion. No production/provider activation is inferred from the local implementation. See `AGENCY_OS_ROADMAP.md` for actual capability, security/retention boundaries and release gates. The owner prioritized this internal sales workflow before the client Growth Hub; SEO-agent architecture is planned alongside it. Published website/SEO package prices remain separate from individual $800 promotional opportunities.

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

The owner approved an expanded internal operating system on October 21. Website sales now drives the implementation order: imported research, Devon's BatchDialer outreach, interested prospects, appointments/mockups, proposals, won sales, projects and recurring services. The [agency OS roadmap](AGENCY_OS_ROADMAP.md) defines the active release sequence and supersedes the earlier client-portal-first sequencing. Existing production evidence remains in the release-specific documents.

### Release 1 — Prospecting and sales foundation

Implemented in this source release; deployment and live acceptance are recorded separately. Migration0008 extends canonical businesses, existing contacts/clients, sales opportunities, source lists, communication history, explicit appointments/follow-ups, mockups and channel preferences. New private Sales, My day, Calling lists and Mockups screens share a redesigned responsive dashboard. Reviewed CSV imports preserve scores/research and exact identity links; repeat files/results are safe, ambiguous matches are reported and DNC/STOP restrictions survive missing opportunities. Deliberate won conversion reuses existing identities and creates an existing project. Promotional $800 opportunities remain separate from published prices. No new dialer, live mailbox connection, Twilio sending, payment collection or agent runtime is implied.

Exit criteria: populated migration preservation, workspace/role denial, import replay/opt-outs, real browser prospect-to-project workflow, desktop/phone accessibility, existing reporting/auth regressions and backup/restore checks pass; actual production acceptance is recorded after deployment.

### Release 2 — Unified communications

Narrow owner-approved Tailored Mail integration, conversation ownership and response workflow, Twilio SMS/voice activation, inbound routing, voicemail, controlled recordings and evidence-linked transcripts. Preserve BatchDialer for campaign calls. Prepare registration and policy through [communications setup](COMMUNICATIONS_SETUP.md) while the foundation is developed. Calls and messages require explicit authorized provider actions; generated drafts and saved manual notes do not send anything.

### Release 3 — Proposals and delivery

Versioned scopes/proposals, acceptance, accurate payment-provider references/status, deposits, onboarding, deliverable review, scope changes and support. Factory projects stay independent, connected through their real brief, source/preview links and QA state.

### Parallel SEO and internal AI architecture

Define per-client/site ownership, encrypted integrations, trustworthy evidence, human-operated SEO delivery, supported audits, versioned prompts/tools/evaluations, durable jobs, cost budgets, source-linked recommendations and exact reviewed change approval. The current Search Console/reporting implementation is internal-site scoped, not already a multi-client SEO platform. Do not publish automatically or add speculative tables before implementing their behavior. Research current providers and runtime/cost limits when the corresponding release begins.

### Release 4 — Recurring services and bounded SEO assistance

Track active service agreements, package inclusions, completed work, usage allowances, renewals/cancellations, recurring revenue and customer results. Keep subscriptions, earned sales and received payments distinct. Build the manual SEO evidence workflow before the bounded agent audits and drafts useful site changes for human review. Include per-client budgets, run history, pause controls and attributable approvals.

### Release 5 — Client Growth Hub and public demo

Add invitation-based, independently protected client access after internal workflows/isolation pass. Clients see only shared work, approved reports, comments/approvals and scoped exports. The public demo uses an isolated synthetic source and cannot query private records. Preserve internal notes, mail visibility, provider credentials and unapproved drafts.

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

- Authentication is owner-approved; there is no public account registration.
- In production mail mode, Mail verifies its existing scrypt password hashes through a private authenticated connection. Website sessions store a separate encrypted identity grant, never a password copy. Legacy password mode uses Better Auth hashes only for its separately provisioned credentials.
- Sessions are stored in PostgreSQL and delivered through secure HTTP-only cookies.
- Dashboard access rechecks the live Mail grant and active workspace membership on every protected request. Password resets, disabled accounts and removed dashboard approval revoke grants; an identity-service outage fails closed. In legacy mode the allowlist is rechecked.
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
- `DASHBOARD_AUTH_MODE`: `mail` in production; `password` for isolated previews or deliberate legacy recovery.
- `MAIL_AUTH_URL` / `MAIL_AUTH_SECRET`: trusted Mail identity endpoint and matching private Worker `DASHBOARD_AUTH_SECRET`.
- `DASHBOARD_ALLOWED_EMAILS`: internal allowlist, required only in password mode.
- `DASHBOARD_INITIAL_PASSWORD`: initial owner credential, required only in password mode.

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


### October 21, 2026 — Share Mail credentials with the dashboard

Jeffrey requested the same sign-in credentials for both apps. Mail remains the password authority, with owner-controlled dashboard approval and separate website roles. Additive Mail migration 0036 and website migration 0007 store approval and revocable identity grants. Existing roles, reports and Google credentials are preserved. The website checks grants on each protected request, and password resets/account disabling revoke access. Each site keeps its own cookie; this release does not provide automatic cross-site sign-in or MFA. Google setup is now being completed by Jeffrey with his selected personal account. Real Google authorization, imports and the next daily refresh remain required.

### October21,2026 — Prioritize the agency's website-sales workflow

The owner's new operating-system brief supersedes the earlier portal-first sequence and handoff restrictions for this workstream. Extend the existing application, reuse business/contact/client identities, preserve BatchDialer and the separate Factory, and build prospecting/sales first, communications next, then delivery/recurring services. Plan the bounded SEO/AI architecture in parallel. Human approval controls important decisions and external actions. The detailed active sequence is `AGENCY_OS_ROADMAP.md`.
