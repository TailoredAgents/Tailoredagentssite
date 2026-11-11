# CRM refinements for relationship-led AI and automation work

November 10 current source addendum: [the operating-model guide](OPERATING_MODEL_GUIDE.md) now covers the implemented solution briefs, encounter capture, work-focus views, referral ledger and service/outcome records. Conner configures actual private financial policies before activation. Historical assessments below remain dated evidence.

November 10, 2026. Owner direction: refine the current software, preserve its look and workflow, and keep websites and SEO available. This plan complements the active agency roadmap and employee-assistant work; it does not replace either.

## Current reading guide

The first-increment assessment below is historical. The **second increment** later in this document implements structured discovery, persistent introductions, separate client account management and Meeting Intelligence. See [the meeting runbook](MEETING_INTELLIGENCE.md) for deployment evidence, the approved $10/month allowance and still-open physical Omi/live-processing acceptance. The earlier deferred list is not the current implementation backlog.

## Repository assessment — first-increment checkpoint

Reviewed main through `d21daad` and fetched origin/main before implementation; there were no remote commits to pull. Uncommitted assistant chat, permissions, memory, routines, calendar, Mail and migration `0050_assistant_operations.sql` work was present. This increment leaves those files alone and must stage only its own files. Recheck the shared tree before committing.

| Area | Already implemented | Gap and smallest useful change |
| --- | --- | --- |
| Prospects | Optional business name, service interest, notes, source, owner, next action; manual entry and incoming inquiries | Make prompts fit networking and automation. Preserve original source and submitted answers. |
| Businesses and opportunities | Shared business/contact identity; existing stages, values, sales owner, activity, tasks and client/project conversion | Remove website assumptions from new titles and handoff defaults. Leave historical titles and stage keys unchanged. |
| Discovery | Business notes, dated activity notes, appointment location/preparation, assigned follow-ups | Add a compact optional guide now; structured, versioned discovery can follow when needed. |
| Referral relationships | Free-text notes and intake source; public partnership invitation | No dedicated partner attribution or client account-manager field was found. Notes are not a reliable commission ledger. |
| Recordings | Twilio call recordings, transcription/summary worker, client memory and reviewed follow-up tasks | Those records depend on calls and line permissions. They are not a meeting-upload system. |
| Assistant | Existing employee chat and Operations read/write services; active work on durable operations | Extend those services after meeting records exist; do not create a competing assistant. |

## First increment: small interface and default changes

Implemented in this change:

- New manual opportunities default to **Business opportunity**. Newly linked prospects and CSV-imported businesses get service-neutral titles. Existing opportunities retain their saved titles, including on repeated linking/import.
- The stored `prospect` stage displays **Prospect** instead of **Cold prospect**. Every stored stage, including `mockup`, stays valid; no stage, price or offer type is removed or migrated.
- Sales and My day copy supports introductions, discovery and business solutions. Sales owner is explicitly labeled; a task owner remains the person doing that task.
- Activity defaults to **Internal / meeting note** and **Internal**. Call/email/SMS logging remains available. Live communications still use Inbox.
- An optional, expandable discovery guide appears beside the existing opportunity notes. It covers how we met, who introduced us, business problems, current tools/workflows, desired automation, and our commitment. Answers are saved only when staff enter and save a note. Opening the guide changes no record.
- Follow-up wording fits discovery meetings and office visits. A note does not create a task: staff assign and schedule it through the existing follow-up form.
- Client handoff proposes the actual opportunity title as the project name. Website mockups remain available as optional work; creating an automation opportunity does not start Website Builder.
- Manual prospect entry prompts now emphasize business needs and introductions while retaining optional website/service fields.

No database migration, new role, navigation redesign, AI request, recording integration, commission rule, or automated message is part of this increment. Contact requirements are unchanged: manual prospects still need a phone or email; standalone opportunities need a business name and phone/email/website. An independent meeting record in the next phase must not inherit those requirements.

## Next small functional additions — separate implementation

1. **Structured discovery on the existing relationship.** Add optional fields for meeting/source context, problems, current workflow/software/documents, volume/time baseline, desired outcome, constraints and next-step agreement. Link to the existing prospect/business/opportunity rather than duplicate the customer. Preserve old notes verbatim; never automatically infer facts from them. Store staff-confirmed facts separately from hypotheses and retain source/date/editor. Keep unanswered fields optional. Existing task and calendar services remain the only scheduling system.
2. **Durable partner attribution and separate responsibilities.** Before migration, coordinate with whoever owns partnership agreements. Reuse or link existing contacts/businesses for the external introducer; do not force a partner to become an employee or customer. Keep `crm_opportunities.owner_user_id` as sales owner. Add a nullable client account-manager assignment separately from project owner. Record the business relationship's original introducer and each opportunity's referral evidence/date with an audited correction history. Converting a prospect, changing a salesperson, merging/linking contacts, or archiving a partner must not silently erase attribution. Historical records start unknown; no automatic backfill or inferred referral credit.
3. **Commercial terms remain separate.** Attribution records who introduced whom; it does not establish a payable commission. No percentages, revenue definitions, accrual, invoices or payouts until Austin's agreements and calculation rules are deliberately specified. Future reporting can join reviewed attribution to those agreements.

Acceptance: empty values and older records still work; cross-workspace associations fail; stale edits do not overwrite changes; original attribution survives conversion and reassignment; ordinary sales tasks and website opportunities still work. Use additive nullable schema changes only where durable structured data actually requires them.

## Meeting Inbox — phased architecture

Start with one modest feature inside the current dashboard, using existing workspace identity and visual components. Do not build another app, an iPhone client, or live coaching.

### 1. Independent recording and manual import

- Create a workspace-scoped meeting record with uploader, title/date/time zone, processing state and private audio artifact. A prospect, company name, website and identified participant are all optional. Start private to the uploader, with deliberate team sharing.
- Store audio in private object storage using the project's storage conventions; never in the public website-preview service. Reuse existing Render hosting/worker patterns, but isolate meeting records and permissions from Twilio call-line grants. `lib/factory/storage.ts` is a reference for storage operations, not permission to expose meeting audio through Factory.
- Validate real file type, size and duration; stream large uploads rather than buffering an entire recording in a Next request. Reject unsupported files clearly. Set retention and deletion behavior before activation. Scope downloads and playback to authorized viewers and use short-lived URLs or authenticated streaming.
- Deduplicate deliberate retries with an upload request ID and scoped content hash. Permit an explicit second import when needed. Record progress and recover interrupted jobs without losing the uploaded file or blindly rebilling an uncertain provider request.

### 2. Transcription and review

- A bounded background job uses our server-side OpenAI credentials. Extract reusable provider code only after checking the existing call-analysis implementation; its MP3 assumptions, size limit, timeout and Twilio polling are not suitable for arbitrary long Omi recordings unchanged.
- Record transcript/model/source version, timestamps when available, processing costs and errors. Require an explicit meeting-processing allowance; existing website, SEO and assistant budgets are not permission to spend on meetings. Keep processing off until configured and tested.
- Show a draft summary, confirmed statements, possible automation opportunities, open questions and suggested follow-ups. Every factual extraction needs transcript evidence; do not invent identities, contact details, ROI or promises. Treat recorded speech as untrusted content, not commands to execute.
- Suggest CRM matches using available identity evidence, displaying ambiguity. Staff choose **Link existing**, **Create prospect**, or **Leave unlinked** after review. Never match/merge on a name alone or fabricate contact details to satisfy a CRM form. A meeting can remain unlinked indefinitely.
- Only reviewed facts enter the shared client brief. Suggested tasks become real tasks through existing authorized task services and review/confirmation appropriate to the action. Meeting review does not send a follow-up, start a build, or create a commission obligation.
- Linking a meeting must not silently widen its audience. Define unlinking, prospect deletion, retention and independently retained meeting behavior explicitly; do not cascade-delete the original meeting merely because an optional prospect link is removed.

### 3. Verify Omi, then add ingestion

Official sources checked November 10:

- [Omi subscriptions](https://help.omi.me/en/articles/12058411-understanding-omi-subscriptions) says recording/export remains available on the free Basic plan and after its processing allowance is used. This supports a manual-import pilot; it is not a test of Austin's or Jeffrey's device/app.
- [Omi integration apps](https://docs.omi.me/doc/developer/apps/Integrations) distinguishes completed-conversation, transcript and raw-audio deliveries. An Omi-processed transcript is not the same as receiving audio for our own OpenAI transcription.
- [Omi audio streaming](https://docs.omi.me/doc/developer/apps/AudioStreaming) describes raw PCM chunks and device-dependent sample rates. The documented streaming path is not a guarantee of reliable historical/offline recording delivery.

Before committing to subscription-free automatic ingestion, Austin/Jeffrey should export one short, non-sensitive sample from their actual official iPhone app/device on Basic. Test recording while offline, recovery, background/locked-phone behavior, and behavior after the free processing allowance is exhausted. Verify that usable audio—not only an Omi transcript—is delivered. Record app/firmware versions and observed results. Manual upload remains the fallback.

Then test the exact supported webhook transport: authenticated installation/user mapping, sender verification, payload limits, event IDs, replay resistance, out-of-order chunks and retry behavior. A supplied `uid` is not authentication. If the official route cannot authenticate deliveries adequately, keep manual import rather than expose an unauthenticated ingestion endpoint. Acknowledge only after durable receipt; process asynchronously. Do not send private client audio to public webhook-inspection services for testing.

### 4. Existing assistant extension

Add meeting search/read, reviewed solution-brief preparation and permitted link/task tools to the current Operations services and native employee chat. Check the employee's current access on every read, tool call and background step. Keep private recordings out of shared memory until deliberately shared. Use the existing action receipts, execution policy, cost accounting and durable-run work once that work is settled; do not edit the active assistant implementation as part of this CRM refinement.

## Completion gates and next ownership

- This increment: verify service-neutral creation/linking/import, preserved website sales/conversion, meeting-note save/read, viewer denial, mobile layout/accessibility and the normal type/lint/build checks. Commit only the scoped CRM changes.
- Next implementation: structured discovery and attribution, coordinated with the partnership work, followed by independent manual Meeting Inbox. Before that larger implementation, review the concrete schema/UI proposal with Austin.
- Austin/Jeffrey: provide a non-sensitive Omi export and confirm what the actual free-plan device workflow delivers; settle sharing, retention and meeting-processing allowance when activating that feature. No credentials belong in this file.
- Deferred: Omi automatic ingestion, assistant meeting tools, automatic discovery research, live coaching, a custom phone app, and commission calculation. None is implied complete by these wording changes.

## Verification record

Local verification completed November 10 against the latest committed collaborator release `fab93f3` plus this scoped change, in a separate checkout and disposable local PostgreSQL container:

- **79 tests passed:** sales service/database and CSV normalization/import checks. New assertions cover neutral titles for website, Facebook and manual intake, and preservation of existing titles on relinking. Existing permissions, sparse leads, deduplication, task, mockup and conversion checks remain intact.
- **10 browser tests passed:** desktop and Chromium phone journeys, both website and automation sales, internal discovery-note persistence, viewer restrictions, CSV replay, accessibility and overflow/readability checks at 1440/768/390/320 pixels. The checks found pre-existing small phone-label text in Sales; a scoped 14px minimum fixes it without changing the shared phone component.
- **Lint, TypeScript and the production Webpack build passed.** Tests used synthetic local records with provider credentials absent. No production CRM record, real email/SMS, paid AI request, Omi device, or audio upload was used.
- Initial test runs caught assertions using the old default title, a new test selector that included select-option text, and the phone-label sizes. The final reruns above passed after correcting those specific issues; no assertions were weakened.

Commands (use only a dedicated local database/container; the test scripts reject other database names):

```powershell
$env:TEST_SALES_DATABASE_URL='postgresql://ta_test@127.0.0.1:<local-port>/ta_sales_test'
npx vitest run lib/sales/service.integration.test.ts lib/sales/import.test.ts
$env:TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:<local-port>/ta_reporting_browser_test'
node scripts/seed-reporting-preview.mjs
npm exec next build -- --webpack
$env:REPORTING_TEST_DATABASE_URL=$env:TEST_DATABASE_URL
$env:REPORTING_TEST_PORT='3142'
npx playwright test tests/reporting/sales.spec.ts --config playwright.config.ts
npm run lint
npm run typecheck
```

Build and test in a clean verification checkout without production `.env` files; keep OpenAI/Resend credentials absent and SMS/call analysis disabled. The seed command resets only the named test database. This record establishes local readiness, not production acceptance; verify the exact commit's Render deployment after pushing. Meeting Inbox, structured attribution and Omi remain planned, not deployed capabilities.

## Second increment — Meeting Intelligence and structured relationships

November 10, 2026: Austin authorized the complete implementation and a separate **$10/month** OpenAI meeting allowance. The first-increment/deferred sections above describe the earlier release; this increment implements structured discovery, persistent introductions, separate client account management, independent Meeting Inbox, authenticated Omi intake and explicitly permissioned assistant meeting reads.

See [Meeting Intelligence implementation, deployment and acceptance record](MEETING_INTELLIGENCE.md) for the current source of truth. Manual audio upload, privacy, review, linking/unlinking, deliberate sparse prospect creation, retention and deletion are implemented. Uploads are sent in bounded 1 MB requests; finalization assembles at most 24 MB. Private audio reuses the existing storage service's authenticated object endpoint, never the public preview resolver. AI records retained request reservations and stage attempts; this initial release does not offer word timestamps, speaker diarization or provider invoice reconciliation.

Physical Omi/free-plan/background/offline behavior and live OpenAI accuracy remain explicit acceptance checks. Neither a synthetic webhook test nor a deployment makes those complete. Assistant reads need a new `meetings:read` consent; communication and CRM mutation permissions stay unchanged. No commission or revenue-share calculation is implemented.
