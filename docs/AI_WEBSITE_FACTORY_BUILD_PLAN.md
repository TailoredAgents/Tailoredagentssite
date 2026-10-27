# AI Website Factory: implementation plan and resume guide

Created October 26, 2026. Updated October 27: **The first quality release is implemented: stronger approved-design controls, responsive images, full-page visual/content review and publication of the exact checked files. Local verification has passed; final release/deployment evidence is recorded separately. Cosmo's existing v1 and its company-name link remain unchanged; a richer v2 still needs exact human plan approval. All-Render hosting and research/planning are live; builder limits remain $50/month and $5/site. Finished-site editing and visitor chat are not implemented.**

This is the durable task specification for the lead research, website planning, human-approved builder, and website copilot discussed with Austin. Read this file before continuing this task after a new chat, context compaction, or work from another computer. Update its checklist and resume log as implementation progresses. Historical checkpoints below describe what was known at that time; the latest dated checkpoint takes precedence.

**Latest checkpoint — generation diagnostics, October 27:** Austin asked whether to retry website v3. Read-only production inspection confirmed one settled generation receipt: 5,455 input tokens, 6,326 output tokens, estimated $0.134382, with no saved blueprint or provider response and retry count zero. The original response therefore cannot be locally replayed or conclusively diagnosed. Approved design constraints themselves pass the inspected text/background contrast check. Do not claim the underlying generation error has been fixed.

The worker now privately saves the initial generation response before parsing/validation, reuses it on an explicit retry, and drops it after successfully saving the blueprint/advancing. Validation failures expose fixed application messages or schema field paths, never raw provider values; incomplete/refused responses receive explicit messages. This addresses lost diagnostic evidence and repeated charges for revalidation; it does not add paid retries, weaken validation, change spending caps or regenerate Cosmo automatically. The API edge-case handling follows the [official Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs). Local validation: 121 site/provider/build integration tests, lint and production build passed. After the worker release is verified, Austin can use **Retry website build** once for the existing approved v3; if it fails, inspect the retained response and specific error before another attempt.

**Latest checkpoint — live progress, October 27:** Austin requested a visible current build stage. Added worker-saved activity before generation, images, browser checks, design/content review, corrections, rechecking, saving, publication and verification. The UI distinguishes working, waiting between stages and stopped work, shows elapsed and last-saved times, and updates every six seconds without losing the planning draft. Only known milestone names and timestamps leave private build data. No paid retry or new site generation is triggered by this change. Deployment evidence follows in the progress log.

**Cosmo's current state:** live CRM inspection shows Austin approved plan v3 at 2:14 PM EDT and website v3 failed. Render's 2:15 PM run reported `failed`, stage `generate`, at 2:17:18 PM. The generic error does not establish the underlying cause; investigate it before another paid attempt. The previous note that v3 awaits approval is historical. The progress-display implementation does not resolve this generation failure.

Progress validation: 32 build integration/activity checks passed using the isolated local database and synthetic providers. All 10 desktop/phone Factory browser scenarios passed across the initial run and the targeted rerun after correcting the outdated long-link expectation. Coverage includes automatic stage/activity changes, transition to ready without reload, preserved chat drafts, failed/waiting states, preview controls and accessibility. Screenshots: [desktop](previews/factory-live-progress-desktop.png), [phone](previews/factory-live-progress-phone.png). Lint and TypeScript passed. No live AI call was made for this verification.

Release verification: source `26f64cf71232b10e2f3d866757a923f7689ac806` passed the production build and was pushed to `main`. CRM deployment `dep-dbgepeuc6qcc73ftjs20` became live at 2:28:11 PM EDT. The builder reported the same source as its last successfully deployed commit (build `bld-dbgepf6c6qcc73ftjt20`). Reloading the signed-in Cosmo workspace verified the new five-stage tracker, with website v3 correctly marked **Design & code — Stopped here**. Granular running activity was verified with synthetic work locally; no production build was retried just to demonstrate progress.

**Latest direction, October 27:** Austin authorized the recommended work after the [quality and chatbot audit](#quality-and-chatbot-audit-october-27-2026). The first design, image and review implementation is recorded in [First quality release](#first-quality-release-october-27-2026). That implementation authorization does not approve a new Cosmo's plan or activate visitor-chat spending. Read the dated audit findings as the baseline before this release, not a description of the updated implementation.

Austin subsequently authorized implementation and explicitly approved **$25 per month for research and planning** on October 26, 2026. Research, versioned plans, pre-approval chat, and exact-version approval are implemented. Saved live settings were verified under Austin's Owner account: research enabled, automatic intake off and monthly limit $25. Austin then confirmed the first successful live research-and-plan run with a screenshot showing version 1 ready for review, two sources, possible matches and explicit unknowns. This confirms an initial live result, not an exhaustive quality review or measured average cost. Website construction, preview hosting, hero image generation and source export are implemented in milestone 2; all-Render deployment and infrastructure/runtime checks are complete, and Austin has now confirmed the first human-approved generated site, with requests for richer design and content recorded below. Building is enabled at Austin's $50/month and $5/site ceilings; under $1 is an unmeasured target. Editing finished sites through chat remains milestone 3.

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

**Historical October 26 implementation checkpoint:** migration `0031_factory_builds.sql`, separate build budgets/leases/artifacts, six design families, one generated or uploaded hero image, browser QA and one bounded repair, shared preview capability URLs, and portable source ZIP were implemented. CRM release `1fb1d0f` deployed successfully; infrastructure/building were not yet activated at that checkpoint. Later all-Render deployment and activation are recorded in the current resume log. Austin approved **$50/month for website builds and images, with a $5/site ceiling**. Under $1 per initial mockup is a target without measured evidence, not a promised price. This supersedes earlier references to an unset builder budget.

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
| Budget | Austin approved $25/month for research and planning on October 26, 2026; live settings were saved and verified with research enabled and automatic intake off. Building is enabled at the separately approved $50/month and $5/site ceilings, after infrastructure/runtime checks. Exact human plan approval still gates generation. Preserve bounded repairs and concurrency. Track planned/reserved/estimated or uncertain spend across retries. Do not inherit the unrelated SEO budget or bypass limits with concurrent jobs. |
| Build runtime | Dedicated worker plus isolated project execution and durable job recovery. Select a deployment based on tested workload, not assumptions about the current small CRM service. |
| Storage and previews | Austin/Codex: one shared Render web service in Ohio, Starter / 512 MB, 5 GB persistent disk at `/var/data/factory`; private artifact HTTP API plus capability-checked previews. Use its default HTTPS `onrender.com` origin. No database or AI key belongs on this service. |
| Render | Austin/Codex: deploy CRM changes, reuse the existing builder cron, configure matching storage/preview environments and verify runtime. Keep Ohio to match the CRM database's private network. Provide an independent Render configuration for exported customer projects. |
| Cloudflare | Superseded for Factory by Austin's all-Render decision. R2/Worker support remains an optional fallback; custom DNS can be added later. Preserve unrelated Mail infrastructure. |
| GitHub | Repository creation access only if direct repository export is enabled. ZIP export must not depend on this. |
| Austin | Research/planning allowance approved at $25/month; building enabled at $50/month and $5/site. Optional design references and feedback are not mandatory lead inputs. Next: personally approve the exact real-client plan, then review the generated output, measured cost and export. |
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
3. Research and planning chat work at the approved $25/month allowance; do not redo their setup. Remaining pilot checks include exact-version approval acceptance, broader factual review and measured usage. Direct research-cron inspection confirms its idle scheduled lane. All-Render storage/preview, CRM and existing Ohio builder are deployed from `e3acba8`; production storage/authentication/persistence/resolver, sandboxed Chromium and resumed idle-worker checks passed. Existing builder `crn-dbfth6uk1f9s73amh7ig` is resumed; building is enabled and read back at $50/month and $5/site, with $0.00 usage and no previews. Do not create a duplicate service or repeat setup. Austin must approve the exact real-client plan himself; then inspect the first generated site, cost and source export. Jeffrey/Cloudflare are not dependencies.
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
- Runtime: the original R2/Cloudflare proposal is superseded by the deployed Render preview/storage service with a persistent disk and existing resumed builder cron in `deploy/factory-render.yaml`. The cron runs every five minutes on `1c-2g` (2 GB RAM), drains queued stages and exits when idle; it stops before another claim after 30 stages or 30 minutes. `--once` and continuous operation remain available. Production storage, Chromium and idle-cron checks passed; building activation was read back. These checks do not establish a completed paid build.
- Hosting: Render cron compute is billed by active running seconds with a $1 monthly minimum per service, not a guaranteed flat $1 bill. The new always-on preview/storage web service and persistent disk have separate charges outside the AI allowance. [Render cron billing](https://render.com/docs/cronjobs#billing). The sandboxed non-root Docker renderer check passed on 0.5 CPU/512 MiB: three pages, six screenshots, 14.85 seconds and 431 MiB peak memory. Keep the builder at 2 GB until complete workloads are measured; this renderer test does not measure the separate preview service.
- Limits: planning chat revises proposals, not finished website files. Actual source-editing copilot, comparison/restoration, richer asset roles and direct GitHub export remain milestone 3. ZIP export is independent of GitHub.
- Next: Austin approves one exact real-client plan in the CRM, then verify its live build and clean export. Measure actual cost, quality and time. Research/chat, storage, runtime and activation are complete and must not be restarted. Infrastructure checks do not establish provider-backed design quality or a completed website. Editing finished sites through chat remains milestone 3.

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

Austin explicitly chose to proceed entirely in Render. Austin/Codex own implementation, deployment and verification; Jeffrey has no remaining Factory infrastructure task. Source `e3acba848a7d77e81310aab96864ab976da0ef12` is pushed to main and deployed on all three Factory services. Production storage and resolver checks below establish the new backend's tested behavior; an AI-generated website has not yet been built.

Use one shared Ohio web service from `deploy/factory-preview-render.yaml` on Starter / 512 MB with a 5 GB persistent disk mounted at `/var/data/factory`; use its default HTTPS `onrender.com` origin to avoid DNS dependencies. The service receives only `FACTORY_STORAGE_SECRET`, `FACTORY_PREVIEW_SECRET`, `FACTORY_RESOLVER_URL` and `FACTORY_STORAGE_DIRECTORY=/var/data/factory`, never AI/database keys. The CRM and existing builder receive `FACTORY_STORAGE_URL` plus `FACTORY_STORAGE_SECRET`, and `FACTORY_PREVIEW_ORIGIN` plus the separate `FACTORY_PREVIEW_SECRET`. Both secrets are independent random values of at least 32 characters, with each value matching across all three services. Keep values out of Git and chat.

The Render HTTP storage backend is primary when configured; the original R2 implementation remains an optional fallback. Mail storage was not reused. Austin must approve the exact real-client plan in the CRM himself; hosting/AI-budget authorization does not approve an unapproved plan. Runtime and activation checks have passed. The first real build, its screenshots/ZIP, actual cost and share revocation remain to verify.

Deployment evidence, October 26: preview/storage service `srv-dbfu0g2jnfac73elqll0` at `https://tailored-agents-site-previews.onrender.com`, Ohio / `0.5c-512mb` / 5 GB disk `/var/data/factory`. Its deployment `dep-dbfu0gijnfac73elqmq0` started at 7:20:34 PM EDT and succeeded in 51.3 seconds. CRM environment deployment `dep-dbfu0tajnfac73elruhg` started at 7:21:25 PM and succeeded in 1 minute 59 seconds. Existing builder was resumed and deployment `dep-dbfu1gifngtc7382tve0` succeeded in 35.4 seconds. Matching private storage/preview configuration was saved across all three services and the old builder R2 bucket setting removed.

Production synthetic checks passed: authenticated private upload/read; anonymous storage 401; read-size limit 413 when requesting a 64-byte artifact with `maxBytes=1` (not an oversized upload test); direct public artifact 404; exact bytes preserved across the 7:22 PM restart; exact-prefix cleanup then 404. Unknown public preview and authenticated CRM resolver both returned 404, establishing matching preview secrets and a reachable resolver without creating a published version. Before activation, CRM readback showed one plan ready for review, zero approvals/previews; research enabled at $25/month, automatic intake off and $0.12 estimated usage; building off at $50/month and $5/site with $0.00 usage. Final activation readback follows below.

Change verification passed: 10 preview-service tests; 113 Factory tests in 12 files with all three exact disposable local databases and zero skips (26.72 seconds); production build; actual non-root Docker service checks on 512 MiB / 0.5 CPU including disk persistence after restart. Render's setup UI displayed $7/month service plus $1.25/month disk, or $8.25/month, plus existing cron active-time billing and separate AI usage. These are configured rates, not a measured invoice. No paid generation or real-client approval occurred during these checks.

Final production runtime and activation evidence: actual builder Web Shell used the deployed image as UID 1001, with Playwright `chromiumSandbox:true`, sanitized environment and blocked network, to render synthetic HTML and produce an 8,957-byte screenshot. The resumed cron run from 7:25:06–7:25:53 PM EDT finished successfully, logging `{worker:'website-builder',status:'idle',more:false}` at 7:25:37 PM. Building was enabled, then reloaded and read back: $50/month, $5/site, $0.00 estimated/reserved usage, zero previews and one plan ready for review. Type checks, lint and production build passed. Runtime evidence was saved privately outside Git. No human plan approval was supplied or performed, and no paid website was generated. Next action belongs to Austin: open the ready plan, review it and use its exact-version approval/build button; then inspect the first generated result and export before continuing to milestone 3.

### October 27 deeper websites and readable preview links

Austin supplied the first finished-site screenshot and asked for more substantial websites and URLs that a salesperson can say aloud or a prospect can type. The implementation adds:

- Migration `0032_factory_preview_names.sql`: company-based, globally unique, version-specific public slugs, including existing builds. Missing company names receive a short neutral identifier. Personal names are not used as fallback. New builds retain the legacy token too.
- Branded `/preview/company-name` entry URLs redirect to the separate Render preview origin. Both forms of URL keep expiry, revocation, active-workspace and deleted-lead checks. Published HTML, source ZIP and manifest remain immutable; no regeneration is needed for existing links.
- Industry detection recognizes heating/air conditioning and distinguishes website redesign work from the customer's industry. Stronger generation instructions call for substantial service explanations, useful FAQs, distinct planned pages and fewer public-facing research-gap disclaimers, while retaining factual honesty.
- Trusted showcase and checklist layouts, reduced empty sections, compact inner-page heroes, footer navigation, direct phone CTAs and mobile contact controls. Browser QA eagerly loads offscreen images before testing them, with bounded readiness.
- Structural content review joins browser QA and the existing single repair attempt. It rejects missing page counts, thin sections, identical page content and repetitive layouts; it does not claim to judge visual quality or verify business facts. Output ceiling increases to 12,000 tokens within the existing budget reservation system. One hero image remains the limit; richer asset roles and finished-site chat editing remain future work.

Local verification: 84 Factory unit/integration tests passed (22 unrelated research/worker integration cases skipped because their separate test databases were not selected); 18 renderer/export/browser tests passed, including all 12 design combinations, multipage navigation, mobile layout and WCAG checks; 10 Render service tests passed. The 16 build integration cases were rerun after adding an alias-expiry assertion and all passed. Type checking, lint and production build passed. Desktop/mobile screenshots were inspected. Tests use synthetic content and make no paid provider calls; no replacement client site was generated. Actual new-model output quality and cost still need a human-approved pilot.

Release status: deployed and verified from `3d9958e83b105a189133ceeba0d67d954ac86be9`. Deploy the CRM (including migration), preview/storage service and builder cron from the same commit. Keep the existing $50/$5 builder limits, $25 research limit and approval requirement. Jeffrey has no DNS or infrastructure task for these branded redirects. Do not rewrite the existing finished mockup or silently approve a replacement build.


Production release verification, October 27: all three services auto-deployed `3d9958e`. CRM `dep-dbgc8u7b9u1s73874qdg` reported live at 11:36:25 AM EDT; preview/storage `dep-dbgc8u7b9u1s73874r5g` succeeded in 48.8 seconds; builder cron `dep-dbgc8unb9u1s73874rn0` succeeded in 38.4 seconds. The branded company URL returned 307 with no-store/noindex to the named isolated path; that path, its Services page and CSS returned 200. The original token path also returned 200, with exactly the same homepage SHA-256 as the new alias. CRM health returned 200. Signed-in CRM reload displayed the branded preview link; Copy link reported success. Existing desktop/mobile preview screenshots loaded after the deployment restart. A browser visit through the branded URL showed the existing finished website; private verification images remain outside Git.

Live settings readback still shows research $25/month with auto-intake off, builder $50/month and $5/site, one completed version and $0.09 estimated/reserved builder usage. That is the system's ledger display for the prior build, not a measured invoice or a price prediction for the upgraded builder. This turn made no paid generation calls and created no replacement plan approval. Next: prepare and human-approve a richer version, assess its generated content and actual spend, then proceed to the finished-site copilot.

## Quality and chatbot audit October 27, 2026

This section preserves the pre-implementation audit. The subsequent implementation and its remaining limits are recorded below under [First quality release](#first-quality-release-october-27-2026).

Austin wants beautiful, distinctive, fast websites and is considering a customer-facing chatbot using this project's OpenAI connection. This audit inspected research, planning, blueprint generation, renderer, image handling, QA, worker publication, preview delivery, and source export. It also inspected the existing live Cosmo's homepage and fresh desktop/mobile renderer fixtures. The live Cosmo's design remains the earlier build; it is not evidence of the newer generation prompt's output quality.

### Findings and evidence

| Priority | Finding | Evidence and practical effect |
| --- | --- | --- |
| High | The design language is too restrictive for reliably bespoke sites. | `site/types.ts`, `site/families.ts`, `site/render.ts`: six families, two allowed hero compositions per family, eight section layouts, three system-font choices, and one editable accent. Background, surface, text colors, radius and much of spacing come from family constants. The approved plan's full palette and typography are not enforced. The model creates JSON content and choices; it does not write a custom website implementation. |
| High | There is no visual critique of the generated result. | `site/qa.ts` takes screenshots and tests overflow, structure, links, demo forms and serious/critical accessibility issues. `build-worker.ts` sends text issues to one repair call; no rendered screenshot reaches a visual reviewer. A technically passing site can still have poor hierarchy, repetitive composition, weak imagery or unhelpful copy. Only the homepage desktop/mobile screenshots are retained in the build report. |
| High | Image handling creates avoidable page weight and limits art direction. | `build-images.ts` normalizes all images to PNG. `site/render.ts` serves the same image without `picture`, `srcset` or `sizes`. The one upload becomes the hero; there are no dedicated logo, service, gallery or team image roles. The model receives upload descriptors, not image pixels for visual understanding. |
| High | Content checks do not establish full plan fidelity or factual correctness. | `site/quality.ts` checks page count, section/item counts, exact serialized content repetition and layout variety. It does not match every approved page by identity or detect near-duplicate copy. `site/validate.ts` validates the claims the model declares, but does not require every factual assertion in page copy to be declared. Prompt instructions alone do not close that gap. |
| Medium | Initial research is deliberately shallow. | `provider.ts` permits at most two web actions with low search context. Useful for inexpensive initial triage; insufficient evidence of a complete existing-site, competitor, content or visual audit. Optional deeper discovery should be separate and budgeted, with missing details still allowed. |
| Medium | Preview delivery prioritizes revocation over caching. | `apps/factory-preview/worker.mjs` resolves access through the CRM for every file and returns `no-store`; it also hashes bytes per response. These are deliberate safeguards. Reduce asset weight first. Any caching redesign must specify expiry/deletion/revocation semantics and must not turn private export metadata into public cacheable files. |
| Medium | Production launch remains manual finishing work. | Export is genuinely portable and contains a Render static-site definition, but it preserves demo forms, noindex, the demo notice and restrictive CSP. There is no completed live-form/chatbot/booking integration or complete production SEO launch package. Preview success is not production launch readiness. |
| Medium | Finished-site chat editing is still missing. | Planning chat revises plans. Milestone 3's targeted edits, visual comparison, restore and concurrent-edit handling remain necessary for salesperson-driven refinement. |

Read-only live HTTP audit of `/p/cosmos-heating-air/`: HTML 7,423 bytes; CSS 18,280 bytes; JS 948 bytes; hero PNG 2,930,343 bytes; total decoded resource size 2,956,994 bytes. The image is approximately 99.1% of these bytes. HTML/CSS/JS responses already use Brotli; PNG does not. All four responses were 200 with `no-store`. These are resource measurements, not wire-transfer totals, Lighthouse scores, Core Web Vitals, or representative user timings.

Fresh verification: `npx vitest run lib/factory/site` passed **30 tests across three files**, including real local desktop/mobile checks of twelve compositions and independent source export. No AI calls were made. Additional disposable in-memory probes confirmed that the current validators accept (a) invented credentials embedded in copy when `factualClaims` is empty, (b) a substituted page when the page count stays equal, and (c) a copied page with only one title punctuation change. These demonstrate validator gaps, not evidence that the live site contains fabricated credentials. The first probe invocation hit the repository's CJS/ESM import boundary; rerunning with the correct module loader produced the stated results.

### Recommended build sequence

1. **Improve the design system and image pipeline first.** Add a versioned design brief with full palette tokens, approved typography, density, image focal points, section surfaces and composition choices. Expand industry-aware components such as service detail, gallery, real proof/reviews when available, coverage, FAQs and clear inquiry flows. Select sections for their purpose rather than adding content to satisfy counts. Allow materially different compositions within the same industry. Keep original assets privately and render responsive WebP variants; add AVIF or bundled WOFF2 only when renderer, manifest, MIME validation, CSP, safety checks and export support them end to end. Store explicit asset roles and provenance. Vision analysis of uploaded references should receive the actual authorized image and distinguish inspiration from an asset to publish.
2. **Add a bounded review-and-repair stage.** Check approved page identities, design tokens and required features; review all public copy against submitted/sourced evidence; detect near-duplicate copy. Keep unresolved business details in the internal handoff while producing useful honest concept content. Have a vision-capable reviewer inspect desktop/mobile screenshots for hierarchy, industry fit, composition, typography, imagery and content density. Compare results to a small human-reviewed reference set. Give the reviewer no execution tools. Reserve review/repair cost before provider calls; keep a hard attempt limit and preserve the previous successful preview if review fails. Human taste remains the calibration for the automated review.
3. **Make speed a release requirement and validate an approved Cosmo's v2.** Add fixed mobile lab profiles, repeated measurements and per-page budgets. Proposed initial targets: mobile hero at most 250 KB, desktop hero at most 400 KB, initial mobile page under 800 KB, and Lighthouse performance at least 90 under a recorded profile. These are proposed engineering budgets, subject to visual comparison, not measured results or universal guarantees. Check keyboard navigation, moderate accessibility findings, 320/390/768/1440px layouts, zoom, reduced motion, broken links and image crops. After launch, target real-user p75 LCP <=2.5s, INP <=200ms and CLS <=0.1; lab tests cannot establish a real-user pass. Prepare the richer plan for Austin, build only after his exact-version approval, and compare it with v1 on useful content, appearance, speed, cost and turnaround.
4. **Implement the finished-site copilot.** Support requests such as "make this more modern," "use this logo," or "add an AC repair page" against the actual current blueprint/assets. Show what changed, keep version history and restore, run the same checks, serialize edits, and keep exports tied to the displayed version. Ordinary explicitly requested edits should not require repeating initial plan approval. Full custom-code generation can be evaluated later if the richer renderer still prevents the desired designs; it would require a materially broader execution and review system.
5. **Add an optional business chatbot and production launch workflow.** Start with approved business Q&A, inquiry qualification and human handoff; add scheduling and customer-system tools only after their integrations are real and tested. Finish real forms, domain configuration, canonical URLs, sitemap, metadata/social cards, accurate structured data, and deliberately removing preview-only noindex/demo settings at launch. Do not publish research briefs or private planning chat as website assets.

### Chatbot proposal

The customer-facing chatbot and the team's website-editing copilot are separate products. A visitor must never acquire the copilot's ability to change the website or see internal CRM information.

- **Shared Render backend:** the widget sends a message to a controlled server endpoint, which calls OpenAI using a server-held project key. Never place the key in HTML, JavaScript, downloadable source, logs or a public widget configuration. Reusing the current project connection is technically possible; a separately scoped server key can make accounting/rotation easier later. The static site should keep working if chat is unavailable.
- **Per-business knowledge:** use approved public services, location/coverage, hours, policies, FAQs and authorized documents. For small sites, start with a compact versioned knowledge bundle; add retrieval/file search when volume warrants it. Keep research candidates, private sales notes, other clients and unauthenticated customer histories out. The server selects the business and its allowed tools; a caller-supplied tenant ID is not authorization.
- **Useful actions:** answer questions, explain options, collect a service need and contact details, and request a callback. Create an inquiry through a scoped, validated, idempotent tool and save a summary/transcript to the configured destination. A purchased client's leads belong in that client's approved destination; do not silently add them to Tailored Agents' own prospect pipeline. Real bookings require a working calendar tool and explicit confirmation of the details.
- **Preview versus live:** a preview can demonstrate business Q&A with a clear concept notice, while submissions and appointments remain demonstrations. Enabling real delivery is a separate launch setting. An unknown business can still receive a general helpful concept without invented policies or mandatory lead fields.
- **Speed and usage:** load the full chat UI on interaction, stream replies, bound conversation context and tool calls, rate-limit by site/session and apply abuse controls. Use server-verified scopes and short-lived sessions; an allowed browser Origin alone is not authentication. Add per-site and workspace spending ledgers, usage displays and a graceful contact fallback when a limit or provider failure occurs.
- **Evaluation:** test accurate answers, honest unknowns, follow-up context, mobile usability, malicious instructions, isolation between businesses, duplicate submissions, tool errors, budget exhaustion and handoff. The assistant must not claim a booking or callback is confirmed unless the tool confirms it.

### Budget, approval and acceptance boundaries

Research remains **$25/month**; generation/images remain **$50/month and $5 per initial site**. No additional monthly allowance, increased model/image spend, new service subscription or chatbot traffic has been activated by this audit. Chatbot operating spend needs its own explicit cap before live enablement. New visual review and image work must fit the reserved build budget or pause with an explanation. Benchmark model/reasoning changes on the same brief set before deciding they improve value; this audit does not change `gpt-6.1-sol` or the image model.

Use roughly ten representative briefs across HVAC/trades, wellness, hospitality, professional services and unknown/new businesses. Include incomplete identities and missing assets. Record independent human preferences, visual defects, factual issues, page weight, lab results, export integrity, elapsed time and estimated versus provider-reported cost. Persist all page screenshots and the review report. Automated scores guide improvement; they do not establish universal beauty or guarantee conversion/rankings.

**Next recommended implementation:** design-token fidelity and responsive image variants, followed by the visual/content review stage. The existing Cosmo's preview and all customer communications remain unchanged. Only this audit/specification was saved in the repository during the audit turn; unrelated lead-status changes from another task were preserved.

### Official references consulted

- [Google Web Vitals](https://web.dev/articles/vitals): field thresholds and 75th-percentile evaluation.
- [Google responsive image guidance](https://web.dev/articles/serve-responsive-images): responsive variants and their effect on image loading/LCP.
- [OpenAI Responses overview](https://developers.openai.com/api/reference/responses/overview): image input, conversational state, retrieval and custom function capabilities.
- [OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices): task-specific evaluation and calibration against human judgments. Build our rubric in the repository; do not add a dependency on the hosted Evals platform, which the current documentation says is being retired.

## First quality release October 27, 2026

Austin said to proceed with the recommended sequence. The first design/image/review release is **live on Render**, source commit `b574796283c71335968d7855c55f9802c4d68568`. The [CRM deployment](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbgdjv0ae00c73d0sn7g), [builder deployment](https://dashboard.render.com/cron/crn-dbfth6uk1f9s73amh7ig/deploys/dep-dbgdjvgae00c73d0soi0), and [preview/storage deployment](https://dashboard.render.com/web/srv-dbfu0g2jnfac73elqll0/deploys/dep-dbgdjv0ae00c73d0so1g) all report Live on this commit. Existing Cosmo's v1 was not regenerated, and no v2 plan approval was created. Its current link remains [Cosmo's existing preview](https://www.tailoredagents.com/preview/cosmos-heating-air).

### Implemented

- **Approved design fidelity:** a versioned design block controls six palette roles, heading/body system-font families, type scale/weight, density, radius, hero focal point and per-section surfaces. Explicitly labeled palette and typography choices in the approved plan take precedence over generated defaults, including during repair. Text/surface contrast and referenced sections are validated. New framed, spotlight, feature-list and comparison choices extend the trusted renderer; existing blueprints remain readable. This is a richer renderer, not arbitrary generated application code or exact reproduction of an uploaded design reference.
- **Responsive images:** retain the normalized original privately; publish bounded mobile and desktop WebP derivatives with intrinsic dimensions, responsive selection and the approved focal point. Encoding has explicit source/dimension/byte limits and a bounded quality ladder. New previews and portable exports use those derivatives; existing finished previews retain their old immutable files. The image allowance remains one hero, with no extra image-generation call. Dedicated logo/gallery/service assets and visual understanding of uploaded references remain future work.
- **Deterministic content checks:** match approved page identities one to one, including narrow familiar aliases; detect copied substantive bodies despite altered headings; ignore ordinary repeated contact invitations. Scan actual public text for conspicuous unsupported credentials, prices, ratings, dates, counts and similar concrete claims. Submitted/sourced details can support claims; possible matches and assumptions cannot. These checks are intentionally conservative, and sparse or unknown businesses can still receive useful honest concepts.
- **Visual and semantic review:** after structural/browser/resource checks pass, send every page's desktop and mobile screenshot plus the full approved plan and blueprint to the existing `gpt-6.1-sol` model. Local screenshots are bounded JPEG inputs; the reviewer has no tools and returns a strict assessment. It evaluates actual hierarchy, spacing, composition, mobile usability and all public copy, rather than trusting the model's declared `factualClaims`. Unknown pages, tool calls, incomplete/refused output and inconsistent verdicts are rejected. Optional refinements remain warnings; material defects require revision.
- **Bounded paid work:** at most two visual-review attempts and one repair per version. The repair retains the original hero image. Reserve review/repair cost before sending HTTP; existing per-site and monthly allowances still apply. A budget denial before provider dispatch does not consume a review/repair attempt, so an explicit retry after funds become available can proceed. A provider attempt with an uncertain outcome remains counted; retries cannot create an unbounded repair loop or clear uncertain spend.
- **Resource budgets:** mobile hero at most 250,000 bytes, desktop hero at most 400,000 bytes, and each initial mobile page at most 800,000 bytes for its HTML, shared local CSS/JS and selected image. These are file-size gates, not measured network timings, Lighthouse scores or real-user Core Web Vitals. Recorded-profile lab timing and field measurements remain pilot work.
- **Checked files are the published files:** retain every page's desktop/mobile screenshot, reviewer summary and resource report. After QA passes, freeze the exact rendered files and their manifest under private checked storage. Publication reads those files and verifies their hashes; it does not render again after a deployment could change templates or encoding. The source export uses the same checked bytes, and hosted verification still compares the final files with their manifest.

### Recovery and release boundaries

A legacy in-flight version that has already reached **Publishing** without the new checked manifest must stop and request a fresh approved version. Do not bypass review by reconstructing its files with the current renderer. Completed previews and existing downloads remain available. Failed quality review preserves the preceding successful preview; requested business/plan changes belong in a new plan and approval.

No additional environment variable, paid service, Cloudflare dependency or model change is introduced. Research stays at **$25/month**, with automatic intake off during the pilot. Builder/image/review work shares **$50/month and $5/site**. Review adds real provider work within those ceilings; it is not a promise that the actual build price is unchanged. Visitor-chat traffic is not activated and requires its own budget before enablement.

### Evidence and next acceptance

Final focused verification passed: **90 site/provider tests**, **28 disposable-database build integration tests**, **10 Render storage/preview service tests**, lint, type checks and the Next.js production build. This followed the broader Factory run (157 passed, 22 unrelated research/planning database tests skipped) before the last recovery/design regressions were added. Recovery covers budget denial, missing screenshots, pausing before provider dispatch, exact lease/value checks, deletion, and resuming without repeating a completed review. Browser tests cover all family compositions, responsive image selection, new section surfaces, exports and a narrow 320px layout. Provider outputs were mocked and no paid website generation was used for these checks.

A read-only image probe used Cosmo's existing **2,930,343-byte** hero as input to the new local encoder: the mobile derivative was **28,816 bytes** and the desktop derivative **117,548 bytes**. This demonstrates substantial byte reduction for that asset; it did not replace any live file, regenerate the site, measure user loading time or establish visual-review model quality.

Cosmo's **plan v2 is prepared** in [its planning workspace](https://www.tailoredagents.com/dashboard/sales/factory/7663f9da-2652-46b5-93dc-74881ea1d39e), dated October 27 at 1:02 PM EDT. The existing planning agent revised the proposal within the unchanged research allowance. It has distinct Home, Services, Service Areas, About and Contact pages, substantive educational HVAC copy, the original navy/teal/amber palette, bold sans-serif typography and one responsive illustrative hero. The UI shows **Approve v2 & queue build**; it has not been clicked. No website v2 was generated. The current v1 homepage still returns 200 with SHA-256 `50c1c7dafd0ee65ff76a1f08f05d31aae55f941c047180e16c20036fd5fd6163`.

Post-deployment acceptance: the CRM health endpoint returned 200; the Cosmo short link returned 200 with the unchanged v1 hash above. The signed-in planning workspace still shows website v1 checked/ready and plan v2 awaiting approval. This establishes deployment and preservation, not a successful real model-generated v2 or a calibrated visual reviewer.

Next: Austin reviews and approves the exact v2 plan. Compare the resulting desktop/mobile website with v1, review content and crops, inspect the exported project, and record actual review/build cost and elapsed time. Calibrate the reviewer against human judgments across representative industries and sparse briefs before claiming consistently excellent results.

**Still to build:** the finished-site editing copilot with version comparisons/restore; optional visitor-facing business chatbot and its separate usage cap; dedicated asset roles/reference-image understanding; broader performance measurements; and real production forms, booking, SEO launch configuration and customer deployment finishing. Planning chat continues to revise plans only.

## Cosmo's v2 review-response recovery October 27, 2026

Austin approved plan v2 at 1:14 PM EDT. Build `e9e70bbc-4d85-4172-ab07-777916aec155` completed its five-page blueprint and hero image, then failed at QA at 1:18 PM. The review provider response was settled (22,618 input / 500 output tokens), but no parsed assessment was saved. The original precise local validation failure cannot be recovered: the old code retained only a generic error and the provider response used `store:false`. Do not claim a specific original parser error from this evidence.

The three settled receipts total **$0.272883** (generation $0.126908, image $0.013326, review $0.132649). These are ledger estimates from reported usage, not a reconciled provider invoice. No uncertain charge is outstanding. Existing v1 remains ready and unchanged.

Recovery changes save bounded raw review responses privately before validation, provide safe specific diagnostics, constrain issue page paths in the provider schema, and derive pass/fail directly from issue severity. Legacy reports remain readable and contradictory legacy verdicts remain rejected. A valid saved assessment can be reused without paid generation. The original response is unavailable, so this build needs a fresh assessment of its saved pages/image.

Normal builds still need at most two assessments and one repair. An explicit failed-build retry can use one extra review request, capped at **three requests total** for the version; there are no blind automatic retries. Pre-dispatch denial restores its attempt slot, while attempted/uncertain work and all previous charges remain counted. Research/build monthly and per-site allowances are unchanged. Remaining material issues still block publication.

Local verification: **50 focused review/provider/build integration tests**, lint, type checks and the Next.js production build passed. Tests cover saved-response reuse, invalid response -> explicit retry -> repair -> final review, and the hard three-request ceiling without clearing spend. Deployment and live retry acceptance remain pending at this checkpoint.

### Live recovery result and renderer correction

Recovery commit `0364625e9a515addc695f21df5fe51f77140c78e` is live on CRM, builder and preview/storage. The existing approved v2 was explicitly retried once through the CRM and resumed QA without repeating initial generation or its image. The saved review then exposed an actual renderer limitation: the approved custom Contact/coverage fields and specific service links were only described in blueprint copy; rendering always produced the same generic form and inferred links. The included repair could not configure controls that did not exist. The final review correctly blocked publication.

All six receipts are settled, total **$0.705398**: original generation/image/review $0.272883, recovery review $0.131747, repair $0.161755, final review $0.139013. This remains an estimate from provider-reported tokens, not an invoice. V2 has three review requests and one repair; do not reset its counters, remove charges or bypass quality review. V1 remains the available preview. The original response-format failure and the newly confirmed renderer limitation are separate findings.

The renderer correction adds a versioned `interactions` block, required for new generations and optional for legacy stored blueprints. It selects exact demonstration forms/fields and service/feature-item links using existing local page/section identities. The renderer honors these controls, suppresses unrequested forms, uses a fixed honest demo notice/confirmation, and switches preferred email/phone validation. Controls remain trusted code; no arbitrary markup, remote requests, persistence or delivery is added. Form labels/actions are included in public-copy review. Browser QA checks all forms and cross-page fragments, rather than assuming one generic name/email/message form. Review instructions distinguish blueprint prose from the actual approved plan.

Validation passed across **126 site/provider/build integration tests**, lint, type checks and production build. Focused browser checks cover four-page desktop/mobile interactions, absent extra forms, correct section links, invalid email/phone details, demo-only submission without requests/storage, and invalid cross-page anchors. The corrected v3 proposal was requested in planning chat; it must be reviewed and approved by Austin before a new build. No further v2 retry or new website approval was performed. Renderer deployment and v3 readiness will be recorded after verification.

### Final live checkpoint

Renderer commit `0fb669f4a00522ec9fc75f8141f4f3803a73232f` is Live on [CRM](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbgegt3bc2fs73b62ht0), [builder](https://dashboard.render.com/cron/crn-dbfth6uk1f9s73amh7ig/deploys/dep-dbgegtjbc2fs73b62it0) and [preview/storage](https://dashboard.render.com/web/srv-dbfu0g2jnfac73elqll0/deploys/dep-dbgegt3bc2fs73b62ik0). The final Contact-link preference regression passed the five focused browser/interaction tests after the broader 126-test run. CRM health returns 200. Existing v1 still returns 200, 7,423 bytes and SHA-256 `50c1c7dafd0ee65ff76a1f08f05d31aae55f941c047180e16c20036fd5fd6163`.

Plan v3 completed at **2:06 PM EDT** and the signed-in workspace visibly shows **Ready to review** and **Approve v3 & queue build**. It keeps the five-page design, specifies exactly two forms and concrete Home-to-Services links, and preserves v1/v2. No new approval has been recorded. The next action is Austin's review/approval of this exact proposal, then real model-backed acceptance of the new interactions. Do not claim the new renderer has already produced a completed Cosmo v3. The final user-facing screenshot is `C:/Users/xenon/AppData/Local/Temp/cosmos-v3-ready-for-approval.png` (temporary local proof, not a repository asset).
