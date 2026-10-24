# Tailored Agents internal operating system

Updated October 24, 2026. This is the active implementation sequence authorized by the owner's agency-OS brief. It supersedes the earlier instruction to proceed directly from internal analytics to the client Growth Hub. The historical Search Console, Mail and website release records remain evidence for those releases.

## Current development resume point

**Inbox update, October 24:** New conversation now starts with a searchable contact/lead picker, and lead details include **Contact lead**. Existing authorized history opens directly; first email/SMS/call composers and missing channels use saved recipient details. Accepted first messages connect to CRM context, and migration **0019** separates private drafts per person. See [contact-first Inbox behavior](UNIFIED_INBOX.md#contact-first-entry--october-24-2026). Next Inbox work is converting general email into a lead, followed by outgoing attachments, CC/BCC, signatures/templates and team coverage.

[Jeffrey's handoff](../new%20jeffrey.md) is the single current acceptance checklist for Meta, shared Sales email and SEO. Its [release evidence](../new%20jeffrey.md#release-evidence) records deployed versions, actual tests and remaining observations. The setup guides hold reusable procedures, not additional unfinished-setup lists.

- **Meta:** Austin confirmed the website Pixel events. Jeffrey still owns the developer app/Page connection and real Facebook/Instagram form delivery tests. Follow [Meta setup](META_SETUP.md); do not recreate the existing business assets.
- **Sales email:** Mail deployment, migration 0037, the matching CRM secret and address-specific grants are complete. Jeffrey sees Sales, and Gmail send/reply/image storage passed. Austin/Devon sign-ins, the Team Inbox attachment check, Hotmail and remaining live collaboration/privacy checks are still due.
- **Internal SEO:** migration 0018 and the shared five-minute reporting/SEO job are deployed. Free monitoring completed all 14 pages; scheduled checks succeeded. Paid recommendations remain paused pending the dedicated OpenAI project/key, business-facts review and real pilot. The enforced allowance is **$10/month**, including a **$5 pilot sub-limit**. DataForSEO/city-ranking measurements are off; no separate SEO job is needed. Follow [SEO setup](SEO_MANAGER_SETUP.md).

This SEO release supports reviewed titles/descriptions and matching social metadata, with verification, rollback and a 28-complete-day observation window. Articles, broader repairs, Business Profile and client SEO remain deferred. Sol is the proposed regular planning/critique model; the real comparison with Astra and safety cases have not yet passed. No paid SEO requests or public metadata changes were recorded at the handoff's verification cutoff.

The owner now confirms **two-way SMS, live calling and the recording/analysis setup are working**. Connected-call recording, protected playback/deletion, full transcripts and summaries are implemented through migration **0014**. Migration **0015** adds [reviewed call follow-ups as assigned, dated CRM tasks](CALL_FOLLOW_UP_TASKS.md), with My day, conversation context, reassignment, rescheduling and saved outcomes. Do not repeat OpenAI or initial Twilio activation as the next task. **Recommended next development: finish Inbox handoffs**, beginning with turning general correspondence into a lead now that contact-first entry and prefilled channels are implemented. Then continue the remaining Inbox conveniences and agency delivery/billing track below. [Call recording release and owner confirmation](CALL_RECORDINGS.md) distinguish owner-reported live acceptance from automated verification.

Call task revision **5cf148d** deployed successfully on October 22 at **3:09:44 p.m. EDT**. Verification passed **353 code/database tests**, **22 calling browser checks**, the new task flow in both dark-theme viewports and **four shared Inbox regressions**. [Task handoff delivery evidence](CALL_FOLLOW_UP_TASKS.md#website-delivery) records the production availability checks separately from the synthetic staff workflow.

The project owner's configured business number is **+16785417725**. Earlier instructions to finish initial SMS/voice activation are historical; do not repeat that setup after the owner's working-call/SMS confirmations. Jeffrey's handoff covers remaining Sales acceptance, the SEO pilot and the Meta connection. Keep the dedicated SEO key separate from the existing call-analysis configuration; do not repeat completed calling setup.

The October 22 visual pass covers all 22 dashboard page/view templates: shared tokens and controls, four navigation groups and keyboard page finder, client/project/site creation drawers, business-first Overview, service cards and SMS/voice disclosures in Settings, record facts and section navigation. [The design audit](DASHBOARD_DESIGN_AUDIT.md) records every before/after score, desktop/phone comparisons, verification and delivery. Remaining Inbox capabilities below are functional follow-up work.

Design revision **43bb466** deployed successfully on October 22 at **10:43:40 a.m. EDT**. Verification passed 327 code/database tests and 101 browser checks, with one existing duplicate viewport sweep skipped. All 44 revised page captures passed their automated accessibility and overflow checks. [Delivery evidence](DASHBOARD_DESIGN_AUDIT.md#website-delivery) records the production checks.

The owner's follow-up appearance release replaces bright white work surfaces with **Slate & blue**, adds **Midnight blue** and a saved **Light / Dark / System** preference. The shared semantic palette covers every dashboard family, composers, drawers, charts and the persistent phone. [Appearance notes and delivery](DASHBOARD_APPEARANCE.md) track the separate 88-view light/dark review and verification.

Appearance revision **e82363c** deployed successfully on October 22 at **11:30:48 a.m. EDT**. The live CSS serves both palettes; production route, policy and availability checks passed. [Delivery evidence](DASHBOARD_APPEARANCE.md#website-delivery) records the deployment and the local verification, including preference persistence, draft preservation and active-call theme changes.

Unified Inbox website revision **8d23c1f** deployed successfully on October 21 at **9:19:19 p.m. EDT** (October 22, 01:19:19 UTC). [Unified Inbox](UNIFIED_INBOX.md#website-delivery) records that historical deployment and verification; current provider acceptance is recorded above.

Calling/voicemail website revision **4f8b887** deployed successfully on October 21 at **10:28:44 p.m. EDT** (October 22, 02:28:44 UTC). [Calling setup and delivery](VOICE_SETUP.md#website-delivery) records that original increment's verification. The owner subsequently confirmed working SMS and live calling. Recording/analysis revision **423106a** deployed on October 22 at **2:26:16 p.m. EDT**; new recording/transcript acceptance follows the [current checklist](CALL_RECORDINGS.md#enable-analysis-in-render).

The repository includes the Twilio SMS adapter, explicit number grants, signed callbacks, browser calling, staff routing/hours, voicemail and the new connected-call recording/analysis pipeline. Source and synthetic verification do not establish live acceptance of the new recording/analysis feature.

Our development queue is:

1. **Unified conversation workspace acceptance:** the canonical conversation/source bindings, authorized discovery/global queue pagination, shared timeline/composer, team queues and CRM context are implemented. Migration **0012** backfills existing channel histories independently. The updated Mail code is deployed; existing grants/secrets remain the authorization boundary. Complete the remaining team acceptance from the handoff.
2. **Provider activation in parallel:** the owner has completed and verified SMS/calling and the recording/analysis setup. Jeffrey handles the remaining shared-email checks, SEO activation and Meta connection. Keep those checklists separate from the owner's completed setup.
3. **Calling, voicemail, recordings and transcripts:** live operation is owner-confirmed. Migration **0014** adds automatic recording (announcement off as requested), protected playback/deletion, 90-day audio/analysis retention, bounded transcription/summary jobs and quoted-evidence suggestions. Migration **0015** turns explicitly reviewed suggestions into assigned/scheduled tasks, with editing, outcomes and links between My day and the conversation. External forwarding/escalation, long-audio chunking and timestamped/speaker-labeled transcripts remain refinements.
4. **Remaining Inbox capabilities:** outgoing email attachments, CC/BCC, signatures/templates, watchers/coverage, direct general-email conversion into a lead. Contact-first entry and starting missing channels with saved details are implemented. AI message drafting is also implemented: SMS/email suggestions use saved client details and recent permitted conversation history, with optional staff direction and direct insertion into the editable composer before the teammate sends. See [AI message drafts](UNIFIED_INBOX.md#ai-message-drafts-october-24-2026). The first unified release already includes Mine/Team/Needs reply/Unread/Archived plus deliberate reminder queues and CRM context. New conversation now chooses a CRM contact or lead first; raw email/phone entry remains available as a secondary option. Existing histories are reused and accepted new email/text sources can join the selected relationship. The shared dashboard design pass is implemented; its remaining real-device and team-use refinements are tracked in the design audit.
5. **Agency delivery and recurring services:** proposals/scopes, onboarding, billing/payment events, hosting/maintenance/SEO agreements and renewals, following the releases below. Client SEO and internal AI architecture continue in parallel; their operational agents and client portal remain later implementation.

The project owner handles Twilio accounts, business-number decisions, registrations, secrets and live activation, alongside the SMS, calling, recording, transcript and remaining agency development with Codex. Jeffrey handles shared Sales acceptance, SEO activation and the Meta connection. Provider acceptance must be recorded separately from source/synthetic verification. His current checklist is [new jeffrey.md](../new%20jeffrey.md).

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
- `crm_tasks` records deliberately scheduled follow-ups and appointments. Each task belongs to either a sales opportunity or a durable call source. Call-source work follows conversation merges and requires current call access, including in My day team views. Completion needs an outcome; creating another task is optional. AI processing and suggestions must never silently become human overdue work. `voice_follow_up_tasks` keeps one saved conversion per recording/suggestion; retries open the existing task.
- `crm_mockups` records a requested Factory handoff and its result. `crm_channel_preferences` records address/channel restrictions independent of opportunity status.
- New business relations use workspace constraints, protected server reads and role-aware transactional mutations with audit records. Authentication continues to check the Mail grant through the existing data layer. DTOs expose only necessary fields.

Imported prospect records are eligible for content anonymization after both their retention date and 24 months without business/opportunity/task/mockup/activity work. Maintenance processes a bounded batch and avoids active sales transactions. Client records, won sales and linked projects are excluded from this prospect policy and require deliberate business-record handling. Expired prospect contact/research/history content is scrubbed. Minimal blocked channel/address tuples remain to avoid contacting an opted-out person again; free-text suppression evidence is removed. Existing inquiry, analytics, Google and audit retention still run through the same scheduled entry point.

Anonymized records remain readable as sanitized history and reject further edits, activities, tasks, mockups and conversion. New business activity requires a new deliberately created record. Restrictions are displayed for all saved business contacts, including secondary contacts and legacy numbers with extensions.

## Release 2 — Communications and provider activation

### First increment — shared sales email

Deployed and connected on October 24, including Mail migration **0037**, the independent `CRM_MAIL_SECRET` in both services and explicit Sales grants. Gmail delivery/reply/attachment storage passed. Remaining live team checks are in [Jeffrey's checklist](../new%20jeffrey.md#shared-sales-inbox--remaining-work); [Communications setup](COMMUNICATIONS_SETUP.md) is the reusable setup/recovery reference.

- `/dashboard/inbox` provides a conversation queue, plain-text timeline/composer and CRM context on desktop, with separate panes on phone. Live folder/search pagination comes from Tailored Mail.
- Conversation status is open, waiting or done, with an active teammate owner and deliberate business/lead links. Notes are internal to approved readers; drafts and read receipts are personal. The unread toggle applies to the current provider page, not a claimed whole-mailbox unread count. Watchers and more detailed needs-reply automation remain future work.
- Compose and reply require a deliberate send. Reply recipients and subject come from the approved original Mail message; the first increment sends plain text with one explicit compose recipient. Existing email opt-outs, actual workspace roles and current Mail send permission are enforced. Incoming attachments have authenticated downloads; outgoing file attachments remain later work.
- An outgoing intent is reserved before Mail is called. A stable send key protects retries, and uncertain attempts keep the same payload/key for status checks. Accepted/queued state is distinct from confirmed delivery. Notes expire after 24 months and private drafts after 90 days; content-free send-key receipts remain to prevent replay.
- Mail remains separately deployed and owns message bodies, attachments, routing and delivery. Next.js reads live through a narrow private API and stores only CRM metadata/private drafts, rather than caching mailbox content or sharing Mail's database. The existing login endpoint grants no email access; disabled public APIs remain disabled.
- The owner approved **sales@tailoredagents.com** for **Devon, Jeffrey and Austin** with read/reply access. The grants are installed for their confirmed existing accounts and that exact address; dashboard membership alone does not imply mailbox access. Personal aliases and unrelated messages remain private. Client-facing message sharing is not automatic.

### Communications foundations and remaining refinements

The unified Inbox, SMS, browser calling, voicemail, recordings/transcripts and reviewed call follow-up tasks are implemented. SMS/calling/recording operation is owner-confirmed as described above; the shared Sales connection now has its own delivery evidence. Do not repeat initial provider activation from older release descriptions.

Remaining product work is listed in the current development queue: richer CRM email composing/uploads, watchers/coverage, missing-channel handoffs, external call routing refinements and later transcript features. Keep BatchDialer as the campaign dialer. Preserve grants, signed callbacks, durable send/job state and existing opt-outs. Follow [Communications setup](COMMUNICATIONS_SETUP.md), [calling guidance](VOICE_SETUP.md) and [recording guidance](CALL_RECORDINGS.md) for recovery and feature-specific acceptance.

### Historical email increment verification — October 21

Verified on October 21 using isolated synthetic fixtures: 185 website code/PostgreSQL tests, including 19 Inbox persistence/authorization/send tests and eight Mail gateway tests; 10 desktop/phone Inbox browser checks; and 33 existing reporting, manual-lead, sales and operations browser checks, with one intentional phone skip. Mail separately passes 395 code/SQLite tests and 11 real Worker browser checks after a clean install. Lint, strict types, both production builds, dependency audits and the populated PostgreSQL migration/dump/restore check pass.

The Inbox checks include attachments and revoked download access, private drafts, internal notes, status/assignment/links, viewer/read-only grants, explicit send, uncertain retry with the same key across refresh, accessibility and widths from 320 to 1440 pixels. Accepted-send cleanup handles whitespace while preserving a newer draft from another tab. Reviewed synthetic previews: [desktop Inbox](previews/inbox-desktop.png) and [phone Inbox](previews/inbox-phone.png). Mail's tests verify individual alias isolation, approval/revocation, safe plain text, forged/stale replies and durable recovery. The Mail lockfile repair adds only its two missing optional dependency entries; existing dependency versions remain unchanged.

This is historical source/deployment evidence. The later Mail activation and delivery results supersede its initial setup state; see [the current handoff](../new%20jeffrey.md).

Website revision `f8569fe2b9e1d9acbaf20cdf0ef92a92a7e5f376` auto-deployed successfully on October 21 at 22:47:38 UTC (6:47 p.m. EDT), GitHub deployment `7239112044`, [Render deployment dep-dbck1b0u01pc73bduusg](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbck1b0u01pc73bduusg). Public health/pricing/sign-in and Mail login return 200; anonymous Inbox and attachment requests redirect to sign-in. This verifies website deployment and its unauthenticated boundary. Mail has not been deployed by this push, and no production CRM secret, mailbox grant or customer message was created here.

### SMS increment

`/dashboard/inbox?channel=sms` adds number-scoped conversations, text compose/reply, private drafts, internal notes, per-person reads, assignment/status and deliberate business/inquiry links. Settings verifies ownership/SMS capability of the configured existing number through a read-only Twilio lookup. Connecting grants only the connecting administrator; further read/send grants are explicit. Number pause and the server sending switch block outgoing requests while signed incoming opt-outs/status updates continue.

Every outgoing request reserves a durable intent before one provider create call. Repeating or checking that request never creates another provider message. Unknown outcomes retain the original intent; known SIDs can be checked with a provider read, and signed callbacks reconcile missing confirmations. No Twilio create-idempotency guarantee is assumed. Existing restrictions, inbound STOP and provider opt-out errors are enforced. The owner removed the first-send permission-confirmation form on October 22; sending does not manufacture an allowed preference. New attempts are capped at 30 per hour per actor and 100 per hour per number. Message bodies/notes expire after 24 months and private drafts after 90 days; content-free intent/provider metadata remains for reconciliation and replay protection.

The owner supplied **(678) 541-7725**, normalized to **+16785417725**, and confirmed SMS/voice capability. Account ownership, registration and actual production delivery have not been independently verified. No live Twilio credentials, number changes, customer texts, calls or recording settings were created during implementation. The setup checklist belongs to the project owner; Jeffrey's Meta/SEO/shared-email checklist remains separate.

Local verification on October 21 passes **246 code/PostgreSQL tests** across 25 files, including 25 SMS database cases and 36 Twilio transport/signature/route cases. Browser checks pass for 14 SMS desktop/phone workflows, all 10 email workflows, and 33 existing reporting/sales/operations workflows (one intentional phone skip). SMS coverage includes configured-number ownership checks, read/send grant updates and revocation, pause/resume, internal notes/private drafts, explicit sending, delivery callbacks, STOP restrictions, unknown-send status checks across refresh with one create request, accessibility and 320–1440px layouts. Reviewed synthetic previews: [desktop SMS](previews/sms-desktop.png) and [phone SMS](previews/sms-phone.png).

Lint, strict types, production build, dependency audit and clean-install lockfile validation pass. The populated PostgreSQL migration/dump/restore check now also preserves SMS number grants, private drafts, business links and unknown outbound receipts. Expired bodies are hidden from previews/detail/search before maintenance. Synthetic provider fixtures intercept the SDK transport only in a guarded local test process; production has no test endpoint override. These results establish source behavior, not live SMS readiness or delivery.

Website revision `c3b98fd17ec170eb6eeba776da29e3ad41bd408a` auto-deployed successfully on October 21 at **23:13:34 UTC (7:13 p.m. EDT)**, GitHub deployment `7239504746`, [Render deployment dep-dbckde49v7es73bl8c30](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbckde49v7es73bl8c30). Public health/pricing/sign-in and Mail login return 200; anonymous SMS Inbox requests redirect to sign-in; both new POST-only SMS callback routes reject GET with 405. This verifies website delivery and basic boundaries. Twilio credentials, account/number verification, registration and authorized live-message acceptance remain the owner's activation steps in `COMMUNICATIONS_SETUP.md`; no live SMS was sent here.

## Release 3 — Proposals, onboarding and delivery

Add versioned proposals/scopes, signed acceptance, explicit package/promotion terms, deposits and onboarding checklists. Track the real invoice/payment provider's identifiers and events; never infer payment from `won`. Add deliverable approval, scope changes, support requests and launch/maintenance checklists to existing projects. Preserve the Factory's standalone output and approved publishing boundary.

## Parallel architecture track — Client SEO and internal AI

**Owner clarification, October 22:** the SEO AI agent means an ongoing SEO manager for **Tailored Agents' own website**, responsible for monitoring, planning, carrying out improvements and measuring performance over time. The target is a recurring operating service. A reporting screen, audit tool or recommendation/task queue alone does not fulfill this request. Client SEO delivery remains a future extension; multi-client Google connections, subscriptions and a client portal are not prerequisites for the internal agent.

### Tailored Agents SEO manager — primary scope

- **Observe:** use the existing site's Search Console and first-party conversion evidence, supplemented by bounded site crawls and technical checks. Track the terms and services that matter to website-development and AI-agent customers. Keep missing/stale evidence explicit.
- **Plan:** maintain a persistent SEO strategy, prioritized work backlog, page/query relationships and content plan. Retain the reasoning and previous changes across runs. Schedule daily monitoring, weekly prioritization and longer-window outcome reviews; use an explicit change budget rather than rewriting pages on every daily ranking movement.
- **Execute:** provide tools to prepare and apply targeted site improvements, validate the exact changes, deploy through the website's established workflow and verify the published result. Define standing permissions by action and resource. Preserve before/after versions, rollback, run history, cost limits and a pause control. Free monitoring is enabled; paid planning requires the completed pilot and explicit activation. External ranking research is off for the current release. Public wording requires owner/admin review. This clarification does not itself activate an unattended publisher.
- **Measure:** record a baseline, implementation date and evaluation window for each change. Compare search visibility, qualified organic visits and inquiries, retaining uncertainty about attribution, seasonal effects and small samples. Use those observations to revise priorities; do not claim guaranteed or continually increasing rankings.
- **Report:** give the owner a concise account of what changed, why, results so far, next work and genuine decisions needing input. The dashboard provides oversight of the running service.

Implement the full observe → plan → execute → verify → measure cycle on tailoredagents.com first. The first release should complete a bounded, real improvement cycle; a new SEO dashboard by itself is not its acceptance criterion. Later releases can broaden standing permissions and extend the proven workflow to clients.

### Owner's quality target and operating budget

**Current owner choices, October 24:** finish the existing internal manager before adding broader features, with **at most $10/month for SEO AI/data**. Optimize for useful inquiries and search visibility. National targeting and Woodstock, Canton, Marietta, Acworth and Roswell, Georgia, remain business context, subject to factual review. They are not office claims or measured city rankings. Hosting, call analysis and taxes are separate.

The capabilities below are long-term quality requirements. They do not expand this release's metadata-only publishing scope or activate deferred tools.

The build standard is:

| Capability | Required behavior |
| --- | --- |
| Business knowledge | Maintain versioned, source-linked facts about services, actual prices, differentiation, demonstrated work, intended customers and confirmed service areas. Use existing public service/package records and approved case studies. Unknown claims stay unknown; generated reviews, clients, results and local offices are rejected. |
| Search evidence | Combine finalized Search Console data, measured inquiries and bounded crawls. Retain dates, coverage, source URLs and snapshots. Separate brand/non-brand and national/local intent where supported. Missing metrics and insufficient samples must remain visible. Search Console's average position is not an exact city-level rank tracker. |
| Research and strategy | Research customer questions, actual search competitors, useful content gaps, overlapping pages and opportunities on existing pages. Maintain a prioritized strategy and page/query map, considering business value, evidence, effort and uncertainty. Competitor content supplies research evidence, never instructions or copy to reproduce. |
| Useful original content | Prepare service-page improvements, supported case studies, helpful explanations and internal links grounded in actual business expertise. Every factual claim needs a source. Apply a separate editorial/fact-check pass; use Google's guidance for manual review of AI-written public content and metadata. Content volume is not a success metric. |
| Technical delivery | Inspect crawl/index directives, response status, canonicals, sitemaps, links, metadata, structured data, mobile usability and performance evidence. Apply only supported changes through explicit tools; distinguish lab performance from field data. Business Profile and external-directory work need separately connected accounts and exact resource permissions. |
| Complete execution | Convert a selected improvement into a versioned change, run relevant validation and build checks, deploy through the established website workflow and verify the live result. Keep before/after versions, source revision, checks, deploy status and rollback. Collaborator changes on main must be preserved; stale changes require rebasing/replanning. The agent must finish or expose a concrete failure, rather than merely claiming a task was done. |
| Memory and measurement | Persist hypotheses, actions, review dates, observations and rejected approaches across runs. Revisit changes over suitable multi-week windows with baseline/coverage and sample-size context. Use history to improve the next plan; association does not establish causation and ranking increases are not guaranteed. |
| Independent evaluation | Test strategy, factuality, tool choice, execution and cost behavior against reviewed cases. A separate critique step can help, but its agreement is not proof of correctness. Model/prompt upgrades must pass repeatable evaluations before deployment. |
| Routine operation | Durable scheduled jobs, leases, bounded retries, idempotent actions, stale-evidence detection and recovery. Monitor daily, revise priorities weekly and evaluate outcomes over longer windows. Quiet healthy runs should not produce repeated notifications. Useful reports show completed changes, observations, spend and decisions that actually need the owner. |

#### Budget design

The October 24 decision replaces the earlier larger-workload estimates and provider shopping list. Use existing Search Console, first-party reporting, PostgreSQL and bounded public-site scans. Reuse the existing scheduled reporting job; no separate SEO service or DataForSEO funding is required. City-specific rankings and paid external research stay off in manual and scheduled paths.

The implemented ledger enforces **$10 per UTC month**, counting paid requests, retries, evaluations and unresolved reservations. The model pilot has a **$5 sub-limit within the same allowance**. It reserves a conservative maximum before a request, records model/pricing rules, accounts for cache charges without double-counting reasoning, and blocks further paid work on uncertain charges. Free monitoring can continue while AI is paused or blocked. Actual recurring AI cost has not yet been measured.

Evaluate Sol for routine planning and critique, comparing it with Astra on the same website evidence before activation. The dedicated SEO project/key must remain separate from call analysis. Provider spending controls are an additional safeguard, not a substitute for application reservations. [SEO setup](SEO_MANAGER_SETUP.md) contains the current pricing assumptions, pilot commands and operational limits. Additional hosting runtime is billable and must be measured; no new paid service is approved by this roadmap.

#### Implementation sequence and quality gates

1. **Evidence and budget foundation:** establish the confirmed business profile, national/local seed strategy, current reporting health, page inventory, crawl snapshots and persistent cost/job records. Test stale/missing evidence, malformed pages, private-path exclusion and concurrent reservations before paid automation. Use an allowlisted public-site crawler with redirect/address validation, request/size/depth limits and robots handling. CRM messages, call transcripts and credentials are not general SEO input.
2. **Working manager loop:** schedule bounded monitoring and planning runs, retain decisions and produce prioritized, source-linked changes. Include a correct no-change decision for a healthy page or insufficient evidence. Benchmark candidate models using a small, pre-budgeted evaluation run; do not infer quality from model name or simulated fixtures alone.
3. **A complete improvement cycle:** prepare a real scoped patch, validate facts and the target revision, execute through the configured publication policy, verify deployment and register its measurement window. Apply standing action/resource permissions once configured; routine permitted operations should not repeatedly ask the owner. Prices, offered services, business claims, deletion, redirects and broad site structure need distinct explicit treatment. Fetched pages must not be able to expand tool permissions.
4. **Continuous quality improvement:** compare predictions with observed outcomes; retain failed/no-effect results and revise priorities. Run evaluations on model, prompt and tool changes. Add specialist steps only when they improve demonstrated quality enough to justify added cost and complexity. Broaden automation from observed reliability while retaining pause and rollback.

Release acceptance requires: a real end-to-end improvement with recorded verification; persistence through worker interruption; no duplicate publication on retry; preserved collaborators' changes; no unbudgeted paid call in concurrency/retry tests; all critical factuality, scope, access and recovery cases passing; reviewed desktop/phone oversight screens; and a follow-up measurement record that distinguishes actual observations from predictions. Minimum evaluation coverage includes fabricated business facts, unconfirmed local addresses, competitor prompt injection, missing/stale Google data, small samples, duplicate content, unnecessary changes to a working page, out-of-scope edits, exhausted budget, interrupted deployment and failed rollback. A model's evaluation score measures agent behavior, not a promised SEO ranking score.

Current Google guidance supports allowing time to evaluate changes and manually fact-checking/reviewing AI-generated public content, including metadata. Reflect that content-review step in the operating policy while automating the surrounding work: [SEO evaluation timing](https://developers.google.com/search/docs/fundamentals/seo-starter-guide#how-long-until-i-see-impact-in-search-results), [AI content guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content). These are product-design considerations, not a claim that an SEO agent is already running.

Google's [helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) and [AI-search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) inform the content standard: serve the real audience with original business expertise and sound technical foundations. Treat any new search-report surface as unavailable until its actual API/account support is checked. Use [OpenAI's evaluation guidance](https://developers.openai.com/api/docs/guides/agent-evals) for traces, reviewed cases and repeatable comparisons; no evaluation service or orchestration framework has been installed by this planning update.

### Shared architecture and later client extension

Plan these contracts alongside implementation; add tables with their working behavior. The per-client requirements below apply when extending the internal manager to customer engagements.

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
$env:TEST_CONVERSATIONS_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_conversations_test'
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

# Combined Mail-mode/SMS suite on 3150/3151, entirely synthetic providers.
$env:CONVERSATIONS_TEST_DATABASE_URL = 'postgresql://ta_test@127.0.0.1:55433/ta_conversations_browser_test'
npm run test:conversations:browser -- --reporter=line
```

For an interactive synthetic workspace, run `npm run reporting:preview` with those final two `REPORTING_TEST_*` variables. This intentionally reseeds the disposable browser database. Open `http://127.0.0.1:3120/dashboard/sales` and sign in as `owner@example.test` or `viewer@example.test`, password `Reporting-test-password-2026`. These fixture credentials grant no production access. Import a small synthetic CSV through Calling lists to exercise the workflow; production uses the existing Mail login and approved dashboard grants.
