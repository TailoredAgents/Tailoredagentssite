# AI Website Factory: implementation plan and resume guide

Created October 26, 2026. Status: **planning saved; implementation has not started**.

This is the durable task specification for the lead research, website planning, human-approved builder, and website copilot discussed with Austin. Read this file before continuing this task after a new chat, context compaction, or work from another computer. Update its checklist and resume log as implementation progresses.

The immediate user request was to save this plan **before we begin**. Creating this document does not mean the builder, hosting, or paid AI jobs have been activated. No builder-specific budget or new paid infrastructure has been approved or configured yet.

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

- Proposed URL pattern: `https://previews.tailoredagents.com/<project-slug>-<opaque-id>/`.
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

- [ ] Reinspect current code and database; read applicable `AGENTS.md` and installed Next.js guides before writing code.
- [ ] Design additive records for a lead's Factory project, research/evidence, chat messages, plan versions, and job state. Attach opportunities/projects when available without requiring them first.
- [ ] Add durable intake hooks for newly created Meta, website, and manual leads, plus deliberate start for existing leads. Intake must succeed even if the AI provider is unavailable.
- [ ] Implement research and plan generation with structured outputs, sources, uncertainty, limits, and explicit job errors/retry controls.
- [ ] Build the lead-linked planning UI and shared pre-approval chat with optional uploads and revised-plan comparisons.
- [ ] Implement permission-checked, version-bound approval and durable build queue creation. Do not mark a build complete before a builder exists.
- [ ] Verify sparse/fake/missing details, source access boundaries, duplicate intake, stale approval, and deletion behavior.

Exit: a lead can produce a plan, humans can refine it through chat, and approval queues exactly the reviewed version. No build can occur without that approval.

### 2. Approved builds, previews, and source export

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
| Budget | Define builder-specific monthly and per-job limits, revision/repair limits, and concurrency. Track planned/reserved/actual or uncertain spend across retries. Do not inherit the unrelated SEO budget or bypass limits with concurrent jobs. |
| Build runtime | Dedicated worker plus isolated project execution and durable job recovery. Select a deployment based on tested workload, not assumptions about the current small CRM service. |
| Cloudflare | Separate preview artifact storage, routing, hostname/DNS, and narrowly scoped credentials. Preserve Mail infrastructure. |
| Render | Deploy CRM changes and relevant workers; provide a deployment configuration for exported customer projects. |
| GitHub | Repository creation access only if direct repository export is enabled. ZIP export must not depend on this. |
| Austin | Optional design references, sample outputs to review, and feedback. These are not mandatory lead inputs. Establish an operating budget before live paid activation. |
| Jeffrey | Infrastructure configuration and secrets where he owns the accounts. Once exact requirements exist, add concrete steps to `new jeffrey.md` and link this specification; do not replace his existing Mail/Meta/SEO tasks. |
| Coding agent | Build the CRM workflow, agents, builder integration, UI, exports, tests, deployment documentation, and evidence. Keep this document current. |

Current platform documentation researched for the proposal (recheck at implementation):

- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Render static sites](https://render.com/docs/static-sites)

No blanket "free hosting" promise: AI, build compute, storage operations, routing, and usage allowances all contribute to cost. Final model choices, exact runtime, budget amounts, and production integration breadth remain implementation decisions. None requires a lead to supply more information before planning can start.

## Resume instructions and progress log

1. Read this specification and the latest user messages; preserve the explicit decisions above.
2. Check `git status`, remote updates, and applicable project instructions. Work on `main`, preserve collaborators' changes, and push focused verified commits as required by `AGENTS.md`.
3. If the user has authorized implementation, start at the first unfinished milestone. The current request only saved the plan; do not activate paid jobs or infrastructure on the strength of this document alone.
4. Keep completed work, actual verification, remaining work, and precise next action here. Record provider setup and deployment separately from local test success.
5. Update the roadmap link and Jeffrey handoff only where new concrete work belongs. Do not restart completed communications or SEO setup.

| Date | Completed | Verification | Remaining / next action |
| --- | --- | --- | --- |
| October 26, 2026 | Saved agreed scope and implementation sequence; added roadmap pointer | Read current mockup, lead-intake, sales-linking, and Render configuration; documentation-only change | Implementation not started. On authorization, begin milestone 1: lead-linked Factory records, durable research jobs, planning chat, and versioned approval. |

Before ending a future implementation session, replace or extend this log with: changed files/commits, tests actually run, live deployment status, any pending configuration, and the next specific action. Never mark a milestone complete because only its UI or specification exists.
