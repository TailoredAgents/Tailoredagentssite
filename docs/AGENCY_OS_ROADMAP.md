# Tailored Agents internal operating system

Updated October 21, 2026. This is the active implementation sequence authorized by the owner's agency-OS brief. It supersedes the earlier instruction to proceed directly from internal analytics to the client Growth Hub. The historical Search Console, Mail and website release records remain evidence for those releases.

## Business workflow and boundaries

The immediate business is website sales: researched prospect -> Devon's BatchDialer outreach -> interested conversation -> appointment and/or personalized mockup -> proposal -> won sale -> website project -> recurring services.

The existing Next.js/Render application and PostgreSQL remain the internal system of record. Tailored Mail remains a separately deployed mailbox and password authority. Website Factory remains a separate development toolkit producing standalone customer websites. BatchDialer remains the bulk calling tool. Wholesale supplies architecture and interaction references; none of its real-estate workflows, databases, credentials or client records are imported.

Public prices remain in `lib/services.ts` and `lib/packages.ts`. The introductory $800 website acquisition offer belongs to an individual opportunity's `promotion` offer type and entered value. It changes neither published packages nor future renewal prices. A won opportunity is a sales amount, not proof of payment or recurring revenue.

## Release 1 — Prospecting and sales foundation

Implemented and deployed in this release. Deployment evidence is recorded below; the first owner-accepted production sales workflow remains a separate gate.

- A redesigned internal shell and shared controls with desktop/mobile navigation.
- `/dashboard/sales`: real PostgreSQL pipeline and table, stage/owner/list/search filters, pagination, separate cold prospects and interested opportunities, and explicitly entered offer values.
- `/dashboard/sales/today`: signed-in user's assigned opportunities, deliberately scheduled follow-ups, appointments and mockups; team view is also available. This is a work queue, not a replacement dialer. Each bounded queue describes the records shown rather than claiming an uncapped total.
- `/dashboard/sales/imports`: browser-local CSV parsing and review followed by independent server validation, existing-identity checks and an audited transactional import. Up to 750,000 UTF-8 bytes and 1,000 rows per import. Excel sheets must be saved as CSV first. Unknown research columns are retained in notes; the original supported row metadata is attached to the list membership. Validation errors prevent import; ambiguous account matches are skipped with row-specific explanations.
- Repeated list files do not create another list, business or opportunity. Existing clients are not silently enrolled as cold prospects. A deliberate new opportunity can reuse the same business and contact for a later sale.
- BatchDialer result imports match exact saved email/phone identities. A unique open sale receives the imported outcome; unmatched or ambiguous opportunities are reported rather than guessed. A stable external identity and/or dated result provides repeat protection. A missing call timestamp is explicitly described as import time, not an invented call time. No call is placed and no appointment is inferred from a disposition label.
- DNC/STOP restrictions are stored even if no open opportunity can be resolved. Manual channel preferences require a saved address and recorded evidence. `allowed` is an operator-recorded preference, not an automatic conclusion about legal consent.
- Prospect detail connects the business, existing contacts, opportunity, history, explicitly scheduled commitments, contact restrictions and source lists. Stale opportunity/business edits require a reload rather than silently overwriting a teammate's update.
- A deliberate mockup request creates one team build-queue record with the real brief. The Factory is operated separately. Progress, preview URL, repository URL, local project reference and QA notes are attached to that opportunity. Ready/delivered states require a real URL.
- Complete sale reuses the business/contact/client identity and creates one existing project, repeat-safely. Existing clients can acquire additional projects. Website inquiries can be deliberately linked into sales; historical inquiries are not bulk-manufactured into overdue sales tasks. Legacy client/contact editing and lead conversion keep their established routes and reuse the canonical business relationship.
- First-touch list attribution: closed-sale counts and entered sales value belong to the earliest recorded list for the opportunity. Other list metrics show the records that list touched and may overlap. These are CRM attribution rules, not claims of causal marketing lift, collected cash or lifetime recurring revenue.

Release exit: migration 0008 upgrades populated data; viewer/tenant/assignment denial paths pass; CSV replay and opt-out behavior pass; the prospect -> mockup -> client/project browser workflow passes; existing inquiries, auth and reporting regressions pass; actual screenshots are reviewed on desktop and phone; production acceptance is recorded after deployment.

## Data architecture

- Staff can add a lead directly from `/dashboard/leads` using **Add lead**. Business name and either phone or email are required; contact name, website, service and notes are optional. New entries start in `new`, assigned to the signed-in teammate, and open their saved lead record. Manual source is preserved through the sales/client workflow and excluded from website-inquiry analytics. Migration 0009 permits a genuinely unknown email to remain NULL; public inquiry validation still requires email. Original phone formatting/extensions are retained, while matching uses the normalized base number. A retry of the same form cannot create another record. Viewer access remains read-only.
- `crm_businesses` is the durable company identity. Exact normalized phone, email and domain checks reuse unambiguous businesses. Names alone never merge companies. Shared or conflicting identities need human review; automatic fuzzy merging is outside this release.
- Existing `contacts` can belong to a prospect business before a client exists. Their IDs survive conversion. Existing clients gain a business reference through the additive migration and established save workflows.
- `crm_opportunities` represents an individual potential sale. A business can have multiple opportunities without duplicating its customer record. Stage, ownership, entered value and promotional classification belong here.
- `crm_lists` and `crm_list_members` preserve import provenance and supported research, with separate performance reporting. `crm_activities` stores attributable manual/imported communication history. It does not imply a provider delivered a message.
- `crm_tasks` records deliberately scheduled follow-ups and appointments. Completion needs an outcome; creating another task is optional. AI processing and suggestions must never silently become human overdue work.
- `crm_mockups` records a requested Factory handoff and its result. `crm_channel_preferences` records address/channel restrictions independent of opportunity status.
- New business relations use workspace constraints, protected server reads and role-aware transactional mutations with audit records. Authentication continues to check the Mail grant through the existing data layer. DTOs expose only necessary fields.

Imported prospect records are eligible for content anonymization after both their retention date and 24 months without business/opportunity/task/mockup/activity work. Maintenance processes a bounded batch and avoids active sales transactions. Client records, won sales and linked projects are excluded from this prospect policy and require deliberate business-record handling. Expired prospect contact/research/history content is scrubbed. Minimal blocked channel/address tuples remain to avoid contacting an opted-out person again; free-text suppression evidence is removed. Existing inquiry, analytics, Google and audit retention still run through the same scheduled entry point.

Anonymized records remain readable as sanitized history and reject further edits, activities, tasks, mockups and conversion. New business activity requires a new deliberately created record. Restrictions are displayed for all saved business contacts, including secondary contacts and legacy numbers with extensions.

## Release 2 — Communications and provider activation

Build the unified Inbox using the saved company/contact/opportunity links. Desktop uses conversation queue, timeline/composer and context panel; phone uses separate panes. Include assignment, unread/needs-reply/waiting/done states, watchers, internal notes, drafts, safe attachments and explicit source/delivery states. Provider administration belongs in Settings.

Tailored Mail integration requires a new narrow authenticated service API plus owner-approved sender/mailbox grants. The existing login endpoint cannot read an inbox. Keep personal/restricted messages private; avoid sharing the Mail database with Next.js or enabling inherited disabled APIs wholesale. Email synchronization uses durable provider events and deduplication. Decide explicitly whether an individual message is shared with a client record; matching an email address does not grant mailbox visibility.

Twilio setup can be prepared in parallel with Release 1 using `COMMUNICATIONS_SETUP.md`. After registration and controlled acceptance, add direct-number SMS/MMS, delivery callbacks, opt-outs and browser calling. BatchDialer continues Devon's campaign calling. Subsequent increments add inbound routing, forwarding, hours, voicemail and a persistent phone panel. Signed callbacks, bounded payloads, idempotent events and reliable retry/exception state are mandatory.

Add recordings only with an approved disclosure/consent process, restricted playback/download, visible readiness, retention/deletion and provider failures. Transcription and structured call summaries run in bounded background jobs; they link timestamped evidence and propose editable follow-ups. Human review controls important CRM changes and external actions. No new provider, paid service, number purchase, port or customer outreach is performed by Release 1.

## Release 3 — Proposals, onboarding and delivery

Add versioned proposals/scopes, signed acceptance, explicit package/promotion terms, deposits and onboarding checklists. Track the real invoice/payment provider's identifiers and events; never infer payment from `won`. Add deliverable approval, scope changes, support requests and launch/maintenance checklists to existing projects. Preserve the Factory's standalone output and approved publishing boundary.

## Parallel architecture track — Client SEO and internal AI

Plan these contracts alongside sales implementation; implement capability in small later releases rather than building empty speculative tables now.

1. **Per-client access and evidence.** Replace hard-coded internal-site reporting assumptions through a new client/site-scoped contract. Every connector, metric, crawl, recommendation and run belongs to a workspace, business, engagement and assigned site. Website reporting and client data remain separate until authorization tests establish access. Reuse the proven encrypted Google connection/job concepts without assuming the current internal property is multi-client ready.
2. **Human SEO delivery.** Define monthly package inclusions, supported audit classes, crawl limits, robots/access policy, snapshots, source evidence, severity, ownership, recommendation state, change drafts and revisions. Tie delivered work to measured Search Console/conversion outcomes. Complete an SEO engagement manually in the product and establish reviewed examples before agent-generated judgments become operational.
3. **Agent runtime.** Version prompts, tools, policies and evaluation cases; validate structured results; use durable jobs, idempotency, timeouts, per-client budgets, usage/cost accounting and pause controls. Treat fetched/crawled text as untrusted data. Keep secrets outside model context. Model/provider/runtime selection and costs require current primary-source research when implementation begins.
4. **Approval and publication.** Initial agents identify issues and draft useful changes with evidence. A person reviews the exact proposed changes and authorizes the target site/action. Every external change needs permissions, an immutable approval/version relationship, retry safety and a rollback path. No autonomous publishing in the initial release.
5. **Internal assistance.** Call summaries, follow-up drafts, discovery briefs, proposal assistance and sales insights use the same traceability and budgets. Suggestions are separate from staff tasks. Staff can edit/reject them. External communication is not implicitly authorized by generating a draft.

## Release 4 — Recurring services and SEO delivery

Service agreements/subscriptions identify hosting, maintenance, SEO, chat, phone and custom automation separately, including scope, term, billing cadence, provider references, allowance, work due/completed and renewal/cancellation state. Monthly recurring revenue comes from active recurring agreements; cash and receivables come from payment events. Link SEO work, results and approvals to the correct paid engagement. Record hosting/agent deployment ownership and failures without embedding secrets in customer records.

## Release 5 — Client Growth Hub

After internal workflows and isolation gates are proven, add a separate invitation-based client namespace, approved reports, deliverables, comments, approvals and exports. Internal notes, sales details, private mail, credentials and unapproved drafts remain private. A public demo uses isolated synthetic data and cannot query customer records.

## Operating and release rules

- Work on `main` with focused verified commits, preserve collaborators' work and never force-push.
- Keep website pages, published pricing, Mail authentication, inquiry alerts and Search Console available. Mail builds/deployments stay separate.
- Run lint, strict types, unit/PostgreSQL/browser tests, populated migration/restore checks, production build and dependency audit appropriate to each release. Use isolated synthetic fixtures; never test imports against production client records.
- Record precise local verification separately from deployment/provider acceptance. A configured field or attractive mockup is not evidence of a completed external integration.
- Coordinate changes to shared public paths with the website-design owner. This release changes private operations and the legacy conversion bridge, not public marketing presentation.

## Release 1 acceptance record

Local verification on October 21, 2026 uses disposable synthetic PostgreSQL 18 databases. Production workflow acceptance remains a separate gate.

- All 151 code/database tests pass across 18 test files, including 31 sales service tests and 10 migration/schema tests. These cover real PostgreSQL mutations, tenant/viewer/suspended-user denial, import and conversion replay, conflicting identities, secondary-contact restrictions, retention and existing client/contact/inquiry workflows.
- A populated upgrade and PostgreSQL 18 dump/restore pass. Existing reporting data, encrypted credential metadata and linked client/contact identities survive; the combined retention entry point remains callable after restore.
- Lint, strict TypeScript, the production build and the dependency audit pass. No dependency or lockfile changes are required. The separate Mail application remains unchanged.
- The final browser run passes 27 checks, with one existing desktop-width-only check intentionally skipped on phone. It exercises import -> appointment -> mockup -> won -> existing project on desktop and phone, BatchDialer replay/opt-outs, viewer controls, existing operations/reporting, accessible text and viewport containment. New sales routes pass at 320, 390, 768 and 1440 pixels; the existing dashboard sweep also reaches 1920 pixels. Axe A/AA checks pass for all six sales views at desktop and phone widths.
- Reviewed synthetic screenshots: [desktop pipeline](previews/agency-sales-pipeline-desktop.png), [desktop active record](previews/agency-sales-record-desktop.png), [phone pipeline](previews/agency-sales-pipeline-phone.png), [phone record](previews/agency-sales-record-phone.png). Preview fixture records are deliberately separate from production.
- Public marketing routes, package/pricing modules, Mail code and existing provider configuration are unchanged. No real prospects were imported and no customer messages, calls, recordings or paid resources were created.

### Production deployment

Code commit `18bd0925f8e6bfb3df7d06cbbbf69951ad942550` was pushed to `main`. GitHub deployment `7238132426` reports Render success at **5:50 p.m. EDT on October 21** (21:50:28 UTC), deployment `dep-dbcj6h0u01pc73bcqtrg`. See [Render deployment](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbcj6h0u01pc73bcqtrg).

The Render build is configured to run the existing ordered migrations and retention command before the production build. The public health/pricing/sign-in endpoints and separate Mail login respond successfully. All four new sales workspace routes redirect anonymous visitors to sign-in; Sales also does so on the Render origin. This verifies deployment and the unauthenticated boundary; it is not an authenticated production import or acceptance using real business records. Sign in with the existing approved Tailored Mail account at [Sales](https://www.tailoredagents.com/dashboard/sales). The first real calling-list import, Devon's assignment, mockup handoff and client conversion remain owner workflow acceptance items. No production Mail inbox, call or customer record was used for local verification.

### Repeat the local release gate

Manual lead entry follow-up: 158 code/database tests pass, including seven new persistence, authorization, retry, phone-extension and conversion cases. Six focused desktop/phone browser checks pass for actual entry, validation retention, source labels, phone search, viewer restrictions, accessibility and 320px layouts. Existing reporting, sales and operations browser regressions pass (27 checks, one intentional phone skip). Migration 0009 also passes the populated PostgreSQL upgrade/dump/restore check; lint and the production build pass. No production lead or customer message was created during testing.

Use isolated databases with the exact names below. The schema suite resets its own test schema; service fixtures and the browser seeder remove synthetic test records. Never point these tools at business data.

The verification container is `ta-sales-review-20261021`, using `public.ecr.aws/docker/library/postgres:18-alpine`, bound only to `127.0.0.1:55433`. If it is stopped, start that container before these commands. Database authentication in this disposable loopback-only container is deliberately test-only.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_reporting_test'
$env:TEST_MAIL_AUTH_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_mail_login_test'
$env:TEST_SALES_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_sales_test'
$env:TEST_SALES_SCHEMA_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_sales_schema_test'
npm test
npm run lint
npm run typecheck
$env:RECOVERY_TEST_CONTAINER = 'ta-sales-review-20261021'
npm run test:recovery
npm run build

$env:REPORTING_TEST_PORT = '3120'
$env:REPORTING_TEST_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_reporting_browser_test'
$env:TEST_DATABASE_URL = $env:REPORTING_TEST_DATABASE_URL
node scripts/seed-reporting-preview.mjs
npm run test:browser -- --reporter=line
```

For an interactive synthetic workspace, run `npm run reporting:preview` with those final two `REPORTING_TEST_*` variables. This intentionally reseeds the disposable browser database. Open `http://127.0.0.1:3120/dashboard/sales` and sign in as `owner@example.test` or `viewer@example.test`, password `Reporting-test-password-2026`. These fixture credentials grant no production access. Import a small synthetic CSV through Calling lists to exercise the workflow; production uses the existing Mail login and approved dashboard grants.
