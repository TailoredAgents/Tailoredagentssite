# AI Website Factory: implementation plan and resume guide

Created October 26, 2026. Status: **all-Render hosting selected; new private storage/preview service and adapter in progress, not yet deployed; existing Render builder deployed, startup passed and suspended; research/planning live; paid building pending**.

This is the durable task specification for the lead research, website planning, human-approved builder, and website copilot discussed with Austin. Read this file before continuing this task after a new chat, context compaction, or work from another computer. Update its checklist and resume log as implementation progresses.

Austin subsequently authorized implementation and explicitly approved **$25 per month for research and planning** on October 26, 2026. Research, versioned plans, pre-approval chat, and exact-version approval are implemented. Saved live settings were verified under Austin's Owner account: research enabled, automatic intake off and monthly limit $25. Austin then confirmed the first successful live research-and-plan run with a screenshot showing version 1 ready for review, two sources, possible matches and explicit unknowns. This confirms an initial live result, not an exhaustive quality review or measured average cost. Website construction, preview hosting, hero image generation and source export are implemented in milestone 2; the CRM release and builder are deployed, while the subsequently requested all-Render storage/preview change and live acceptance remain unfinished. Austin approved $50/month and a $5/site ceiling for building; under $1 is an unmeasured target. Editing finished sites through chat remains milestone 3.

## Outcome

Give the sales team a personalized website proposal and, after human approval, a working preview without Austin manually building every mockup. Let the team refine both the proposed plan and the resulting website through the same chat. Preserve the actual source and assets so a purchased website can become an independent customer project hosted on Render or elsewhere.

```text
New lead
  -> Automatic research using whatever information exists
  -> Proposed website plan
  <-> Human chat, additional details, optional research, revised plan
  -> Human approves the latest plan
  -> Build, browser checks, bounded repairs
  -> Preview URL attached to the lead and mockup queue
  <-> Same chat becomes the website-editing copilot
  -> Download/export the current project
  -> Production finishing and independent deployment when purchased
```

## Decisions from the user: preserve these

1. **No specific lead information is required by this workflow.** A lead may lack a website, company name, location, industry, or other details. It may contain an inaccurate or fake company name. Work with whatever the CRM received. Missing fields must not block research, creation of a plan, or approval of a general concept.
2. **Research starts automatically when a new lead arrives**, once the feature is activated. Existing leads need a deliberate way to start it. Do not silently run a paid backfill across historical leads.
3. The research agent reads the lead profile and relevant available CRM context, researches what it can establish, and presents what it proposes to build.
4. **No website construction until human approval.** Receiving a lead, completing research, or revising a plan must never automatically trigger the first build.
5. **Chat must exist before approval.** People can add details, correct information, supply references, and give direction. The agent returns a revised plan when needed, with further research only when useful. It must be a persistent conversation, not just a one-time notes field.
6. Approval refers to the latest displayed plan version. Save who approved it, when, and the exact plan used for the build.
7. Once completed, the system provides a working preview URL and links it to the lead/mockup record.
8. The same chat becomes a copilot that can change the actual website, comparable in purpose to continuing the project in Codex. Preserve the planning discussion as context.
9. Sites should have genuinely different industry-appropriate designs, layouts, and imagery. Include image generation and user-provided assets.
10. Use shared preview hosting to avoid an always-running hosting service for each mockup.
11. Export **actual source code and assets**, including revisions. Instructions alone are insufficient. The exported project should be usable independently for a purchased customer's site.

These decisions supersede the earlier suggestion to automatically build qualified leads on arrival. Do not reintroduce required company/website fields or a requirement to identify a real business before a general proposal can be prepared.

## Existing project: reuse, do not rebuild

Inspected baseline: `main`, commit `3e6cb0e` (October 26, 2026). This is an inspection reference, not a version to reset to. Reinspect the current branch and collaborators' changes before implementation.

| Existing capability | Relevant code or documentation |
| --- | --- |
| Website, manual, and Meta lead creation | `lib/operations/public-inquiries.ts`, `lib/operations/manual-leads.ts`, `lib/meta/service.ts` |
| Sales opportunities and lead-to-sales linking | `lib/sales/service.ts`, `lib/sales/data.ts` |
| Mockup queue, brief, owner, status, preview/repository/project references, QA notes | `app/dashboard/sales/mockups/page.tsx`, `lib/sales/service.ts`, `lib/sales/validation.ts`, migration `0008_agency_sales.sql` |
| Lead and conversation context, source-backed client memory | `lib/conversations/`, especially `memory.ts` |
| Authentication, workspace membership, roles, audit patterns | Existing dashboard context and operations/sales services |
| Durable job and budget patterns | `lib/seo/`, `lib/meta/`, existing voice workers; reuse concepts without coupling budgets |
| Existing Render web app, PostgreSQL, reporting/SEO cron configuration | `render.yaml` |
| Mail infrastructure and its separate private storage | `apps/mail/`; do not repurpose Mail storage for website previews |
| Lead deletion and history cleanup | `lib/operations/delete-lead.ts`, `lib/operations/delete-lead-history.ts` |

Today the mockup queue is a handoff to an externally operated Website Factory. It does not generate websites. `requestMockup` currently requires an opportunity and a manually written brief, with one mockup record per opportunity. The new planning workspace must work directly from a lead without requiring the salesperson to manufacture a business record, opportunity, or brief first. Preserve and connect existing mockup records when appropriate.

The current CRM already has working communications. Keep calling, SMS, Mail permissions, lead alerts, and SEO behavior intact. This task is separate from the remaining Mail, Meta, and SEO work in `new jeffrey.md`.

## Product behavior

### Research and business identity

- Read original lead fields, form answers, and relevant authorized notes/conversation facts. Preserve the original submission.
- Search the public web when useful. Retain clickable sources, retrieval dates, and the evidence supporting a finding.
- Separate submitted facts, sourced findings, possible matches, assumptions, and unknowns.
- Treat text such as `None`, unclear names, missing domains, and conflicting results as uncertainty, not authoritative company identity.
- "Website not found" must not become "business has no website." An old website does not establish that the prospect requested a redesign.
- Do not overwrite submitted phone/email or merge businesses based on an uncertain match. Found phone numbers may be proposed as additional contact details.
- Sparse or unidentifiable leads still receive a useful general concept and an explanation of its assumptions. Optional questions may improve it, but are not prerequisites to proceed.
- Never invent testimonials, certifications, addresses, staff, completed jobs, prices, or other factual business claims to fill a layout.
- Research content is untrusted input. It cannot authorize commands, reveal secrets, or approve a build.

### Proposed plan and planning chat

Show the following together in the lead's website workspace:

- Known business/request details, evidence, and uncertainty.
- Proposed site goal, visitor audience, pages, sections, and calls to action.
- Design direction, typography, palette, imagery, and optional references.
- Features included in the preview and integrations still needed for production.
- Assumptions, revision history, current job state, and available cost/usage information.
- Chat, optional uploads, and **Approve & build**.

Example chat requests: "They mostly do commercial roofing," "They do not have a logo yet," "Use these colors," or "Add booking to the plan."

Store each human message and agent response. A plan revision should explain what changed. A clarification that does not change the plan should not manufacture a new build. Research requests and plan revisions remain separate from build authorization.

### Approval and execution

- Enforce approval on the server, not just by hiding a UI button.
- Bind approval to an immutable plan version; reject approval of a stale version.
- Save the approver and time, and create one durable build request for that approval.
- Repeated clicks, page reloads, provider callbacks, and retries must not create duplicate builds or duplicate exports.
- A running build uses its approved snapshot. Later discussion cannot silently change that snapshot; show which version is building and retain later instructions for a subsequent revision.
- Proposed team behavior: authorized Austin, Jeffrey, and Devon accounts can collaborate and approve; viewers cannot mutate or spend. Implement through real workspace permissions, not hard-coded names or guessed accounts.
- Do not automatically send preview URLs by email/SMS to prospects. Make sharing a deliberate salesperson action. A dashboard notification for the team is the initial notification scope.

### Website builder and design quality

- Run a dedicated builder with isolated per-project execution, not a long-running build inside a normal dashboard request or the existing reporting endpoint.
- Use an exportable source project and retain its built output. Start with marketing websites; arbitrary applications and functioning ecommerce are not implied by a mockup.
- Provide several industry-specific design families and multiple compositions within them. Include a general fallback for unknown industries. Industry identification is not a gate.
- Generate appropriate imagery and accept uploads. Keep asset provenance and licensing information where relevant. Generated illustrations must not masquerade as the company's actual staff or completed work.
- Build and inspect desktop/mobile views; check overflow, navigation, missing images, links, basic accessibility, and factual consistency with the plan.
- Allow a bounded repair loop with recorded failures and costs. A failed check must not replace a working preview with a broken build.
- Keep CRM/database/provider secrets out of generated source, browser bundles, and downloadable artifacts. Restrict build dependencies and network access appropriately; prevent research fetches from reaching private infrastructure.
- Initial preview forms and booking/payment interfaces must clearly demonstrate their behavior. Do not imply a real booking or payment occurred.

### Preview hosting and lifecycle

- Current hosting choice: the shared preview service's default HTTPS `onrender.com` origin with opaque version links. The earlier `previews.tailoredagents.com` custom domain is optional future work; no DNS change blocks this implementation.
- Serve built static files from shared storage through a preview service. Keep source archives private. Separate generated content from the CRM's authenticated application and cookies.
- Shared storage does not mean projects share files or permissions. Scope every artifact, URL, and project lookup correctly.
- Include preview sharing/revocation, expiry/archive controls, search-engine exclusion, and version-aware publication.
- Search-engine exclusion is not authentication. Decide and document the actual access behavior; do not call a publicly accessible link private.
- Build-ready means the stored preview is reachable and checked, not merely that an AI response claimed success.
- Handle lead/project deletion, cancellation, and retention: stop queued work, reject late results that could resurrect deleted records, revoke applicable previews, and clean up derived artifacts. Preserve independently converted client/project work where appropriate to the established deletion policy.

### Website copilot

- Reuse the same project chat, approved plan, and source history after the first build.
- Support content, layout, color, image, section, and page changes, including uploaded reference assets.
- A requested edit produces a new version, runs checks, and publishes only a successful result. Preserve the last good preview on failure.
- Queue or serialize concurrent edits so teammates do not overwrite one another.
- Provide change descriptions, version comparison/previews, and restore. Source and preview must refer to the same version.
- Keep the initial-build approval rule distinct from subsequent explicit editing requests. Do not force users through the initial planning approval flow for every ordinary requested edit.

### Export and purchased-site handoff

- ZIP download must include the current source, assets, dependency lockfile, build/run instructions, and appropriate Render deployment configuration.
- Include the design brief and a list of remaining production integrations, placeholders, and required environment variables; never include secret values.
- Optional direct GitHub repository export can follow ZIP export. Preserve a stable exported version and link it to the CRM project.
- Verify that an export builds in a clean environment without private Factory dependencies or expiring preview asset URLs.
- Production finishing includes real forms, booking/payment integrations when applicable, analytics, domain configuration, and final content review. A static preview does not automatically complete those features.

## Implementation milestones

### 1. Research, proposed plans, and pre-approval chat

- [x] Reinspect current code and database; read applicable `AGENTS.md` and installed Next.js guides before writing code.
- [x] Design additive lead-linked records for Factory projects, research/evidence, chat messages, immutable plan versions, job state, and usage receipts. Existing sales links remain available through the lead; builder-to-mockup linkage follows in milestone 2.
- [x] Add durable intake hooks for newly created Meta, website, and manual leads, plus deliberate start for existing leads. Intake makes no AI calls and does not depend on provider availability.
- [x] Implement research and plan generation with structured outputs, sources, uncertainty, limits, and explicit job errors/retry controls.
- [x] Build the lead-linked planning UI and shared pre-approval chat with optional reference links, change summaries, and version selection.
- [ ] Add optional image/file uploads with the artifact storage introduced in milestone 2. Text and reference URLs work now; uploads are explicitly unavailable.
- [x] Implement permission-checked, version-bound approval and durable build queue creation. Approval creates `awaiting_builder`, never a completed website.
- [x] Verify sparse/fake/missing details, source access boundaries, duplicate intake, stale approval, and deletion behavior in synthetic provider/database tests.

Exit: a lead can produce a plan, humans can refine it through chat, and approval queues exactly the reviewed version. No build can occur without that approval.

### 2. Approved builds, previews, and source export

**October 26 implementation checkpoint:** migration `0031_factory_builds.sql`, separate build budgets/leases/artifacts, six design families, one generated or uploaded hero image, browser QA and one bounded repair, shared preview capability URLs, and portable source ZIP are implemented. CRM release `1fb1d0f` is deployed successfully; build infrastructure and live building remain unactivated. The builder is opt-in and its disabled state was read back in production. Austin approved **$50/month for website builds and images, with a $5/site ceiling**. Under $1 per initial mockup is a target without measured evidence, not a promised price. This supersedes earlier references to an unset builder budget.

- [ ] Define the portable project format and initial design families, including an unknown-industry fallback.
- [ ] Implement isolated coding/image jobs, durable artifacts, build checks, screenshots, and bounded repair attempts.
- [ ] Configure preview storage/routing and stable publication of successful versions.
- [ ] Show progress, errors, final URL, and screenshots on the lead and existing mockup queue; add dashboard ready notifications.
- [ ] Implement ZIP source export and verify it independently builds.
- [ ] Prepare exact setup/deploy/rollback instructions and verify the deployed workflow separately from local fixtures.

Exit: an approved plan becomes a checked preview, and its downloadable project reproduces that preview independently.

### 3. Copilot editing and restoration

- [ ] Continue the planning chat against the actual project files.
- [ ] Support targeted edits, new pages, uploaded assets, and bounded rechecks.
- [ ] Implement concurrent-edit handling, version history, comparison, restore, and current-version export.
- [ ] Optionally add separate GitHub repository export after ZIP is reliable.

Exit: a teammate can request a change, inspect the new version, restore an earlier one, and export either version without losing work.

### 4. Pilot and broader activation

- [ ] Exercise roughly ten representative leads, including no website, no useful company name, uncertain matches, sparse submissions, and multiple industries.
- [ ] Measure actual research/build/revision costs, turnaround time, visual quality, and failure rates; do not promise an unmeasured fixed price or completion time.
- [ ] Verify real browser layouts and factual accuracy, not just successful compilation.
- [ ] Test provider interruption, retries, approval races, concurrent edits, budget exhaustion, preview revocation, deletion, and clean export.
- [ ] Have the team use the plan-chat-approval-preview-edit-export flow; record feedback and fixes.
- [ ] Activate automatic research for new leads after the pilot. This staged activation does not change the final requirement that incoming leads are researched automatically.
- [ ] Record deployment IDs/commits, live acceptance evidence, outstanding limits, and the next concrete task below.

## Configuration and responsibilities

| Area | Required work |
| --- | --- |
| OpenAI | Research, coding, and image access. Prefer a dedicated Factory project/key for usage separation. Verify current models, SDK behavior, account access, and prices when implementing; model IDs are not fixed by this plan. |
| Budget | Austin approved $25/month for research and planning on October 26, 2026; live settings were saved and verified with research enabled and automatic intake off. Builder/image ceilings are separately approved at $50/month and $5/site, with building disabled until infrastructure is ready. Preserve bounded repairs and concurrency. Track planned/reserved/estimated or uncertain spend across retries. Do not inherit the unrelated SEO budget or bypass limits with concurrent jobs. |
| Build runtime | Dedicated worker plus isolated project execution and durable job recovery. Select a deployment based on tested workload, not assumptions about the current small CRM service. |
| Storage and previews | Austin/Codex: one shared Render web service in Ohio, Starter / 512 MB, 5 GB persistent disk at `/var/data/factory`; private artifact HTTP API plus capability-checked previews. Use its default HTTPS `onrender.com` origin. No database or AI key belongs on this service. |
| Render | Austin/Codex: deploy CRM changes, reuse the existing builder cron, configure matching storage/preview environments and verify runtime. Keep Ohio to match the CRM database's private network. Provide an independent Render configuration for exported customer projects. |
| Cloudflare | Superseded for Factory by Austin's all-Render decision. R2/Worker support remains an optional fallback; custom DNS can be added later. Preserve unrelated Mail infrastructure. |
| GitHub | Repository creation access only if direct repository export is enabled. ZIP export must not depend on this. |
| Austin | Research/planning allowance approved at $25/month. Optional design references, sample outputs to review, and feedback are not mandatory lead inputs. The separate builder/image allowance is approved at $50/month and $5/site; infrastructure and live acceptance remain before activation. |
| Jeffrey | No remaining Factory infrastructure task under the all-Render setup. Mark earlier Factory Cloudflare tasks superseded in `new jeffrey.md`; retain unrelated Mail/Meta/SEO tasks. |
| Coding agent | Build the CRM workflow, agents, builder integration, UI, exports, tests, deployment documentation, and evidence. Keep this document current. |

Current platform documentation researched for the proposal (recheck at implementation):

- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Render static sites](https://render.com/docs/static-sites)

No blanket "free hosting" promise: AI, build compute, storage operations, routing, and usage allowances all contribute to cost. Research/planning has an approved $25/month allowance. Builder/image ceilings are approved at $50/month and $5/site. Infrastructure bills, actual output quality, observed provider cost and production finishing still need verification. None requires a lead to supply more information before planning can start.

## Resume instructions and progress log

1. Read this specification and the latest user messages; preserve the explicit decisions above.
2. Check `git status`, remote updates, and applicable project instructions. Work on `main`, preserve collaborators' changes, and push focused verified commits as required by `AGENTS.md`.
3. Implementation and a $25/month research/planning allowance are authorized. Research and planning chat work; do not redo their setup. Remaining pilot checks include exact-version approval acceptance, broader factual review and measured usage. Direct research-cron inspection confirms its idle scheduled lane. Builder/image ceilings are approved at $50/month and $5/site, with building disabled. Austin selected all Render: finish the new private storage/preview service and HTTP adapter, verify and deploy them, then configure the CRM and existing Ohio builder with the service origin and two matching independent secrets. Existing builder `crn-dbfth6uk1f9s73amh7ig` passed CLI/database startup and is suspended; do not create a duplicate. Jeffrey/Cloudflare are no longer dependencies. Resume only after configuration checks and proceed to the deliberate live pilot.
4. Keep completed work, actual verification, remaining work, and precise next action here. Record provider setup and deployment separately from local test success.
5. Update the roadmap link and Jeffrey handoff only where new concrete work belongs. Do not restart completed communications or SEO setup.

| Date | Completed | Verification | Remaining / next action |
| --- | --- | --- | --- |
| October 26, 2026 | Saved agreed scope and implementation sequence; added roadmap pointer | Read current mockup, lead-intake, sales-linking, and Render configuration; documentation-only change | Implementation not started. On authorization, begin milestone 1: lead-linked Factory records, durable research jobs, planning chat, and versioned approval. |
| October 26, 2026 | Implemented milestone 1 in migrations `0029`/`0030`, `lib/factory/`, lead intake hooks, `/dashboard/sales/factory`, lead actions, and independent `/api/cron/factory` worker lane. Pushed implementation `0bb3a62` to main. | 325 tests passed, including 30 Factory tests and affected Sales/Meta regressions; 223 unrelated integration cases skipped without their database configuration. Four desktop/phone browser flows and two additional dark-theme flows passed, including accessibility checks. Lint and production build/type checks passed. Screenshots inspected. All AI responses were synthetic. | Research remains disabled. Confirm the research cap and configure the cron lane for a manual pilot. Continue milestone 2 with portable source projects, isolated build execution, artifact storage, previews, optional uploads, and export. |
| October 26, 2026, 21:28 UTC | Implementation `0bb3a62bc2486593f443497f14511724874add2f` deployed successfully; Render `dep-dbfsb2h42hec739rm1t0`, GitHub deployment `7343996117` | Signed-in Austin Owner opened the live planning queue; zero projects, research paused, automatic intake off, $25 suggested cap, $0 estimated/reserved usage. Health returned 200; unsigned worker POST returned 401; anonymous planning page redirected to sign-in. No production lead mutation or paid AI call performed. | Existing cron environment, authenticated scheduled Factory invocation, provider access/model quality, and paid pilot are not verified. Jeffrey's exact remaining steps are in his handoff. The visible suggested cap is not spending authorization. |
| October 26, 2026, about 5:51 PM EDT | Austin explicitly approved $25/month for research and planning; settings saved for a manually selected pilot | Read back the live Website planning settings as Austin Owner: Enable AI research checked, automatic new-lead research unchecked, monthly limit $25, zero workspaces and $0 estimated/reserved usage. The paused banner was removed. Earlier rows describe the pre-approval state. No provider call was performed by saving settings. | Existing cron environment, authenticated scheduled Factory invocation, provider access/model quality and paid pilot remain unverified. Keep automatic intake off during the pilot. Builder/image spending is still unset. |
| October 26, 2026; screenshot shows 5:56 PM EDT | Austin confirmed the first live research-and-plan run succeeded | User-provided screenshot shows version 1 ready for review, a proposed five-page site, planning-assistant reply, two research sources, submitted information, possible business matches and explicit unknowns. No client contact details are copied into this log. | Live chat revision and approval still need acceptance checks. Exact provider charge, average cost and scheduled-worker configuration/logs were not inspected. This is an initial success, not completion of the full pilot. Website builder, preview URLs, image generation, export and editing copilot remain to implement. |
| October 26, 2026; milestone 2 final local verification | Implemented approved builds, one hero image, isolated renderer QA, shared preview hosting, source export and bounded scheduled builder; owner has confirmed live planning chat | With the three exact disposable Factory PostgreSQL databases configured, `npm test` passed 320 tests across 43 files; 281 unrelated tests across 10 files were skipped. This includes 26 build-backend and 23 portable-site core tests. Eight desktop/phone browser flows and two focused follow-up checks passed. Lint, type checks, production build and non-root sandboxed Docker renderer QA passed. Provider results and build fixtures were synthetic; no paid build or new hosting service was activated. | Commit/deploy the additive website release with building off, configure private R2, the separate preview Worker and opt-in shared builder cron, then verify one approved live build and clean source export. Measure actual quality, cost and runtime. Source-editing copilot remains milestone 3. |
| October 26, 2026; milestone 2 CRM deployment | Implementation `1fb1d0f` pushed to `main`; Render deployment `dep-dbfta4vb9u1s73bugmkg` and GitHub deployment `7345235695` report success | Signed-in Owner readback preserved research enabled, automatic intake off and $25/month, with one plan visible. Building remained disabled at $50/month and $5/site, with $0 estimated/reserved builder usage and “Private website storage needs to be connected.” Health returned 200; anonymous source access and an unsigned preview resolver request both returned 401. No paid build or new hosting service was activated. | Configure private R2, the separate preview Worker and opt-in builder cron, then perform the approved live build/export pilot. A subsequent standalone CLI startup correction is being verified separately before its own commit; it is not part of `1fb1d0f`. |

Milestone 1 reads the lead profile, shared lead notes, planning chat, and prior plan. It does not copy permission-scoped Inbox messages, recordings, or client-memory facts into the shared planning workspace. Any expansion must preserve those source permissions. Budget totals are conservative estimates plus reservations, not an OpenAI invoice. Failed or uncertain requests require an explicit retry; they do not silently repeat provider calls.

Read [the setup and operating guide](WEBSITE_FACTORY_SETUP.md) for activation, budget behavior, worker configuration, test commands, and known limits. Exact infrastructure steps are also appended to `new jeffrey.md`.

Before ending a future implementation session, replace or extend this log with: changed files/commits, tests actually run, live deployment status, any pending configuration, and the next specific action. Never mark a milestone complete because only its UI or specification exists.

### October 26 milestone 2 working checkpoint

- UI: approved-plan build stages, saved website versions, actual ready preview links, authenticated screenshots/source ZIP, sharing revocation and 90-day renewal, hero-image upload/removal, and ready indicators on leads/mockups/planning queue. Owners/admins manage building and spending; editors collaborate; viewers cannot mutate.
- Output: portable HTML/CSS/JS with local assets and a dependency-free Node build script. Six design families and several compositions are supported. The provider supplies a validated design/content blueprint; arbitrary generated commands are not executed. One hero image is generated or provided. Uploaded images are build assets; planning chat does not visually inspect them. Logo placement and multiple image roles remain future work.
- Allowances: working research remains $25/month separately. Builder/image ceilings are approved at $50/month and $5/site; do not repeat that approval question. Under $1 is an unmeasured target. Reservations and uncertain requests remain counted; retries can incur additional charges. Hosting/storage are separate costs.
- Runtime: the original R2/Cloudflare preview proposal is superseded by a separate Render preview/storage service with a persistent disk, plus the existing shared Render/Docker builder cron in `deploy/factory-render.yaml`. The cron runs every five minutes on `1c-2g` (2 GB RAM), drains queued stages and exits when idle; it stops before another claim after 30 stages or 30 minutes. `--once` and continuous operation remain available. Configuration readiness is not proof of execution. The new storage/preview change is being implemented; the existing builder remains suspended.
- Hosting: Render cron compute is billed by active running seconds with a $1 monthly minimum per service, not a guaranteed flat $1 bill. The new always-on preview/storage web service and persistent disk have separate charges outside the AI allowance. [Render cron billing](https://render.com/docs/cronjobs#billing). The sandboxed non-root Docker renderer check passed on 0.5 CPU/512 MiB: three pages, six screenshots, 14.85 seconds and 431 MiB peak memory. Keep the builder at 2 GB until complete workloads are measured; this renderer test does not measure the separate preview service.
- Limits: planning chat revises proposals, not finished website files. Actual source-editing copilot, comparison/restoration, richer asset roles and direct GitHub export remain milestone 3. ZIP export is independent of GitHub.
- Next: finish/verify/deploy the new Render storage and preview service, configure both CRM and existing builder, verify private artifact and public preview boundaries, then resume the existing cron for one deliberately approved live build and clean export. Measure actual cost, quality and time. Existing research/chat are owner-confirmed working and must not be restarted. Earlier unconfigured startup does not establish live Chromium, storage or provider-backed build quality.

UI verification: eight desktop/phone Playwright flows passed, including paused/failed build states, $50/$5 settings, ready preview visibility, real sharing mutations, upload/error/removal UI, download transport, role restrictions, draft persistence, accessibility scans and overflow checks. These use synthetic planning responses and seeded build records; screenshot/download/upload transport is mocked where stated in the test. They do not establish live model quality, actual R2 upload/export bytes or production hosting. Those are covered separately by backend/runtime tests and the later live pilot. Type checking, focused UI lint and the production build passed.

After final ready-state wording and screenshot positioning changes, the completed-preview flow passed again on desktop and phone (two focused checks). Browser artifacts now use `test-results/factory-browser` to avoid deleting unrelated runtime-test artifacts.

Post-deployment standalone entrypoint smoke testing caught a CommonJS top-level-await startup failure and a Next-only image import in the builder CLI. The follow-up wraps startup in async `main` and extracts portable image handling to `lib/factory/build-images.ts`. Ten focused tests, including the CLI entrypoint check, plus lint, type checks and a fresh production build pass. The actual Dockerfile was built from a 2.05 MB minimal context and its exact default `--drain` command ran offline as `pwuser`: without credentials it exited with the expected sanitized missing-database error, with no module, React/Next, TSX or transform failures. A separate local run against the exact disposable test database exited successfully with `unconfigured`, without paid calls. This startup verification is distinct from the earlier renderer/Chromium check and occurred before the production provisioning below.

### October 26 Render provisioning checkpoint — before all-Render decision

Austin clarified that Austin/Codex have Render access; Jeffrey handles only Cloudflare for the Factory. The standalone CLI correction `2f4acb22b6531c4a530bb3fe3ff27afbd7e197c4` deployed successfully as website Render deployment `dep-dbftct95efls73ecjp1g` / GitHub deployment `7345338624`. The subsequent configuration commit `f4be5ee241ac80f8fae0b3117a059b49423fa829` assigns these responsibilities and sets the builder's Ohio region to match the CRM database's private network.

At 6:47:55 PM EDT, Austin/Codex created `tailored-agents-website-builder` (`crn-dbfth6uk1f9s73amh7ig`) in TA / Production from main `f4be5ee`. It uses `deploy/factory-builder.Dockerfile`, repository-root context, Ohio, `1c-2g` and a five-minute schedule. Existing database/provider credentials, the intended bucket name and preview origin were copied privately. Deployment `dep-dbfth6uk1f9s73amh840` succeeded at 6:48:53 PM EDT.

The isolated startup began at 6:49:08 PM, logged `{worker:'website-builder',status:'unconfigured',more:false}` at 6:49:49 PM and finished successfully at 6:50:04 PM; Render reports a 56.7-second successful run. This confirms real CLI imports, CRM database connectivity/recovery and clean exit without provider calls. It does not exercise live Chromium QA, AI generation, R2 or preview hosting. Manual suspension was confirmed after reloading Render. The scheduled run that started at 6:50 PM was canceled by suspension after 31.5 seconds, as expected. No paid website generation occurred; the startup used billable hosting compute.

Signed-in CRM readback still shows building disabled, missing private storage, $50/month and $5/site ceilings and $0.00 estimated/reserved builder usage. Research remains enabled at $25/month with automatic intake off. Website health returned 200. The private verification screenshot is stored outside Git; no credentials are recorded in this log.

A read-only inspection of the existing reporting/research cron `crn-dbaggnjncjis73dgadhg` confirmed `npm run search-console:sync`, a five-minute schedule, the exact `FACTORY_WORKER_URL=https://www.tailoredagents.com/api/cron/factory` and the existing fallback `SEARCH_CONSOLE_SYNC_SECRET` present. The 6:45 PM EDT scheduled run succeeded in 29.8 seconds and logged “Website planning: 0 checked; 0 need review” at 6:45:44 PM. No settings or secret values were changed. This establishes idle scheduled routing, not a new provider-backed research result, measured spending or completion of the broader pilot.

At that checkpoint, the next dependency was Jeffrey's Cloudflare bucket/Worker setup. Austin subsequently replaced that approach with the all-Render decision below. Do not follow the old Cloudflare dependency or recreate the existing builder. No paid website generation had been run.

### October 26 all-Render storage and preview decision — current

Austin explicitly chose to proceed entirely in Render. Austin/Codex own implementation, deployment and verification; Jeffrey has no remaining Factory infrastructure task. The new service and adapter are in progress and have not yet been deployed or verified live. Earlier tests and deployment results do not establish this new backend's behavior.

Use one shared Ohio web service from `deploy/factory-preview-render.yaml` on Starter / 512 MB with a 5 GB persistent disk mounted at `/var/data/factory`; use its default HTTPS `onrender.com` origin to avoid DNS dependencies. The service receives only `FACTORY_STORAGE_SECRET`, `FACTORY_PREVIEW_SECRET`, `FACTORY_RESOLVER_URL` and `FACTORY_STORAGE_DIRECTORY=/var/data/factory`, never AI/database keys. The CRM and existing builder receive `FACTORY_STORAGE_URL` plus `FACTORY_STORAGE_SECRET`, and `FACTORY_PREVIEW_ORIGIN` plus the separate `FACTORY_PREVIEW_SECRET`. Both secrets are independent random values of at least 32 characters, with each value matching across all three services. Keep values out of Git and chat.

The Render HTTP storage backend is primary when configured; retain the original R2 implementation as an optional fallback, not a required setup step. Do not reuse Mail storage. Keep website building disabled and the existing builder suspended during the change. Verify storage authentication, path and size boundaries, durable bytes after restart, capability resolution/revocation, screenshots and ZIP access before the live pilot. Austin must approve the exact real-client plan in the CRM himself; authorization for hosting or the AI spending limits does not approve an unapproved plan. Actual deployment/service IDs, checks and remaining work must be appended after they occur.
