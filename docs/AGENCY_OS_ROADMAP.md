# Tailored Agents internal operating system

Updated October 21, 2026. This is the active implementation sequence authorized by the owner's agency-OS brief. It supersedes the earlier instruction to proceed directly from internal analytics to the client Growth Hub. The historical Search Console, Mail and website release records remain evidence for those releases.

## Current development resume point

The shared-email and first SMS Inbox increments are implemented. The project owner supplied the existing SMS/voice-capable number **+16785417725**; live Twilio credentials, number/account verification, registration and delivery acceptance remain separate activation work with the owner. The next feature development is **calling and voicemail**. Jeffrey's handoff covers only email-specific Cloudflare/Render configuration, Mail deployment, Sales address approvals and email acceptance. The project owner handles Twilio and all remaining development with Codex.

The repository now includes the Twilio SMS adapter, explicit number grants, SMS message store, signed inbound/status callbacks and the Inbox SMS channel. Calling, voicemail, recordings and transcription are not implemented. Marketing illustrations do not establish those later capabilities.

Our development queue is:

1. **SMS activation:** use the implemented number-scoped Inbox, provider adapter and callback handlers. Follow the owner activation checklist in `COMMUNICATIONS_SETUP.md`, keeping outbound sending off until the existing account/number, registration, grants and authorized test exchange are confirmed. Local implementation and synthetic verification do not prove live delivery.
2. **Calling and voicemail:** persistent phone controls, outbound browser calls, incoming routing/forwarding, business hours, missed calls and voicemail linked to CRM records.
3. **Recordings, transcripts and assistance:** approved recording controls, protected playback/deletion and retention; then transcription, summaries and editable follow-up suggestions.
4. **Remaining Inbox and design work:** outgoing email attachments, watchers, richer needs-reply/follow-up views and further visual refinement of real staff workflows. The shared shell and first email Inbox redesign are already implemented.
5. **Agency delivery and recurring services:** proposals/scopes, onboarding, billing/payment events, hosting/maintenance/SEO agreements and renewals, following the releases below. Client SEO and internal AI architecture continue in parallel; their operational agents and client portal remain later implementation.

The project owner handles Twilio accounts, business-number decisions, registrations, secrets and live activation, alongside the SMS, calling, recording, transcript and remaining agency development with Codex. Jeffrey handles the separate email setup only. Local feature code, migrations, tests and UI work can proceed while email activation is completed. Provider acceptance follows when the corresponding implementation and setup are ready. The email-only handoff remains in [new jeffrey.md](../new%20jeffrey.md).

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

### First increment — shared sales email

Implemented in source and deployed to the website as recorded below; separate Mail activation and authenticated production acceptance remain pending. Follow [Communications setup](COMMUNICATIONS_SETUP.md) to verify website migration **0010**, apply Mail migration **0037**, separately deploy Mail, configure the independent `CRM_MAIL_SECRET` in both services and approve the exact address grants.

- `/dashboard/inbox` provides a conversation queue, plain-text timeline/composer and CRM context on desktop, with separate panes on phone. Live folder/search pagination comes from Tailored Mail.
- Conversation status is open, waiting or done, with an active teammate owner and deliberate business/lead links. Notes are internal to approved readers; drafts and read receipts are personal. The unread toggle applies to the current provider page, not a claimed whole-mailbox unread count. Watchers and more detailed needs-reply automation remain future work.
- Compose and reply require a deliberate send. Reply recipients and subject come from the approved original Mail message; the first increment sends plain text with one explicit compose recipient. Existing email opt-outs, actual workspace roles and current Mail send permission are enforced. Incoming attachments have authenticated downloads; outgoing file attachments remain later work.
- An outgoing intent is reserved before Mail is called. A stable send key protects retries, and uncertain attempts keep the same payload/key for status checks. Accepted/queued state is distinct from confirmed delivery. Notes expire after 24 months and private drafts after 90 days; content-free send-key receipts remain to prevent replay.
- Mail remains separately deployed and owns message bodies, attachments, routing and delivery. Next.js reads live through a narrow private API and stores only CRM metadata/private drafts, rather than caching mailbox content or sharing Mail's database. The existing login endpoint grants no email access; disabled public APIs remain disabled.
- The owner approved **sales@tailoredagents.com** for **Devon, Jeffrey and Austin** with read/reply access. Activation must select their confirmed existing Mail accounts and that exact address; names are not guessed login emails and dashboard membership does not imply mailbox access. Personal aliases and unrelated messages remain private. Client-facing message sharing is not automatic.

### Remaining communications increments

1. **Twilio SMS activation:** source implementation is complete for text compose/reply, inbound messages, delivery callbacks and opt-outs. Confirm the existing number/account, registration, credentials, number grants and live delivery using `COMMUNICATIONS_SETUP.md`. MMS file transfer remains later work; incoming messages record only text and media count.
2. **Calling and voicemail:** add direct CRM calling, inbound routing/forwarding, hours, staff fallback, missed calls, voicemail and a persistent phone panel. BatchDialer continues Devon's campaign calling.
3. **Recordings and transcripts:** activate recordings only with an approved disclosure/consent process, restricted playback/download, visible readiness, retention/deletion and provider failure handling. Transcription and structured summaries run in bounded background jobs, link timestamped evidence and propose editable follow-ups.

Signed callbacks, bounded payloads, idempotent events and reliable retry state apply to each later provider. Human review controls important CRM changes and external actions. No Twilio number, paid service, port, call, recording or customer outreach is created by implementing the first email increment. SEO-agent architecture continues in the parallel track below; proposals, billing and recurring services follow communications.

### Email increment local verification

Verified on October 21 using isolated synthetic fixtures: 185 website code/PostgreSQL tests, including 19 Inbox persistence/authorization/send tests and eight Mail gateway tests; 10 desktop/phone Inbox browser checks; and 33 existing reporting, manual-lead, sales and operations browser checks, with one intentional phone skip. Mail separately passes 395 code/SQLite tests and 11 real Worker browser checks after a clean install. Lint, strict types, both production builds, dependency audits and the populated PostgreSQL migration/dump/restore check pass.

The Inbox checks include attachments and revoked download access, private drafts, internal notes, status/assignment/links, viewer/read-only grants, explicit send, uncertain retry with the same key across refresh, accessibility and widths from 320 to 1440 pixels. Accepted-send cleanup handles whitespace while preserving a newer draft from another tab. Reviewed synthetic previews: [desktop Inbox](previews/inbox-desktop.png) and [phone Inbox](previews/inbox-phone.png). Mail's tests verify individual alias isolation, approval/revocation, safe plain text, forged/stale replies and durable recovery. The Mail lockfile repair adds only its two missing optional dependency entries; existing dependency versions remain unchanged.

Live setup and authenticated provider acceptance remain assigned to the developer with Cloudflare/Render access. The complete handoff is [new jeffrey.md](../new%20jeffrey.md); source verification does not establish live mailbox access or delivery.

Website revision `f8569fe2b9e1d9acbaf20cdf0ef92a92a7e5f376` auto-deployed successfully on October 21 at 22:47:38 UTC (6:47 p.m. EDT), GitHub deployment `7239112044`, [Render deployment dep-dbck1b0u01pc73bduusg](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbck1b0u01pc73bduusg). Public health/pricing/sign-in and Mail login return 200; anonymous Inbox and attachment requests redirect to sign-in. This verifies website deployment and its unauthenticated boundary. Mail has not been deployed by this push, and no production CRM secret, mailbox grant or customer message was created here.

### SMS increment

`/dashboard/inbox?channel=sms` adds number-scoped conversations, text compose/reply, private drafts, internal notes, per-person reads, assignment/status and deliberate business/inquiry links. Settings verifies ownership/SMS capability of the configured existing number through a read-only Twilio lookup. Connecting grants only the connecting administrator; further read/send grants are explicit. Number pause and the server sending switch block outgoing requests while signed incoming opt-outs/status updates continue.

Every outgoing request reserves a durable intent before one provider create call. Repeating or checking that request never creates another provider message. Unknown outcomes retain the original intent; known SIDs can be checked with a provider read, and signed callbacks reconcile missing confirmations. No Twilio create-idempotency guarantee is assumed. First outbound permission evidence, existing restrictions, inbound STOP and provider opt-out errors are enforced. New attempts are capped at 30 per hour per actor and 100 per hour per number. Message bodies/notes expire after 24 months and private drafts after 90 days; content-free intent/provider metadata remains for reconciliation and replay protection.

The owner supplied **(678) 541-7725**, normalized to **+16785417725**, and confirmed SMS/voice capability. Account ownership, registration and actual production delivery have not been independently verified. No live Twilio credentials, number changes, customer texts, calls or recording settings were created during implementation. The setup checklist belongs to the project owner; Jeffrey's email handoff remains separate.

Local verification on October 21 passes **246 code/PostgreSQL tests** across 25 files, including 25 SMS database cases and 36 Twilio transport/signature/route cases. Browser checks pass for 14 SMS desktop/phone workflows, all 10 email workflows, and 33 existing reporting/sales/operations workflows (one intentional phone skip). SMS coverage includes configured-number ownership checks, read/send grant updates and revocation, pause/resume, internal notes/private drafts, explicit sending, delivery callbacks, STOP restrictions, unknown-send status checks across refresh with one create request, accessibility and 320–1440px layouts. Reviewed synthetic previews: [desktop SMS](previews/sms-desktop.png) and [phone SMS](previews/sms-phone.png).

Lint, strict types, production build, dependency audit and clean-install lockfile validation pass. The populated PostgreSQL migration/dump/restore check now also preserves SMS number grants, private drafts, business links and unknown outbound receipts. Expired bodies are hidden from previews/detail/search before maintenance. Synthetic provider fixtures intercept the SDK transport only in a guarded local test process; production has no test endpoint override. These results establish source behavior, not live SMS readiness or delivery.

Website revision `c3b98fd17ec170eb6eeba776da29e3ad41bd408a` auto-deployed successfully on October 21 at **23:13:34 UTC (7:13 p.m. EDT)**, GitHub deployment `7239504746`, [Render deployment dep-dbckde49v7es73bl8c30](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbckde49v7es73bl8c30). Public health/pricing/sign-in and Mail login return 200; anonymous SMS Inbox requests redirect to sign-in; both new POST-only SMS callback routes reject GET with 405. This verifies website delivery and basic boundaries. Twilio credentials, account/number verification, registration and authorized live-message acceptance remain the owner's activation steps in `COMMUNICATIONS_SETUP.md`; no live SMS was sent here.

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
$env:TEST_INBOX_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_inbox_test'
$env:TEST_SMS_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_sms_test'
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

# Separate Mail-mode Inbox suite with synthetic local Mail on 3130/3131.
$env:INBOX_TEST_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_inbox_browser_test'
npm run test:inbox:browser -- --reporter=line

# Separate SMS suite: synthetic SDK transport on 3140/3141, no real messages.
$env:SMS_TEST_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_sms_browser_test'
npm run test:sms:browser -- --reporter=line
```

For an interactive synthetic workspace, run `npm run reporting:preview` with those final two `REPORTING_TEST_*` variables. This intentionally reseeds the disposable browser database. Open `http://127.0.0.1:3120/dashboard/sales` and sign in as `owner@example.test` or `viewer@example.test`, password `Reporting-test-password-2026`. These fixture credentials grant no production access. Import a small synthetic CSV through Calling lists to exercise the workflow; production uses the existing Mail login and approved dashboard grants.
