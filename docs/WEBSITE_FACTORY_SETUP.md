# Website Factory: research and planning setup

October 26, 2026. This guide covers milestone 1 of the [build plan](AI_WEBSITE_FACTORY_BUILD_PLAN.md): lead research, proposed website plans, planning chat, immutable plan versions, and human approval saved to a build queue.

This guide does not establish production deployment, paid activation, live model quality, or a verified provider bill. Implementation checks use synthetic responses. No paid provider calls or new infrastructure were activated while implementing this milestone.

**Current status:** Austin explicitly approved **$25 per month for research and planning** on October 26, 2026. Saved settings were read back in the live UI under Austin's Owner account: research enabled, automatic new-lead research off, monthly limit $25, zero workspaces and $0 estimated/reserved usage. The paused banner was removed. This enables manually selected pilot work; cron configuration, authenticated scheduled processing, provider access/model quality and the paid pilot remain unverified. Builder/image spending is separate and has not been approved.

## What this release does

Open **Sales → Website mockups → Website planning**, or start/open the planning workspace from a lead. A lead needs no company name, website, location, industry, or other specific business field to enter this workflow. Missing or questionable information should yield an explicitly provisional, useful general concept.

1. A deliberate start creates a durable research request. After automatic intake is enabled, new Meta, website and manual leads can create the same request automatically. Existing leads are never silently backfilled.
2. The worker saves a research result, then uses a separate bounded request to produce the proposed plan. Findings, possible matches, submitted details, assumptions and unknowns remain distinct.
3. Teammates can discuss the plan and supply public reference URLs in the persistent chat. New directions create a revised plan when needed; a clarification can preserve the current version. While an agent is processing the saved context, the chat draft remains available and can be sent afterward.
4. **Approve vN & queue build** records the exact current plan and its approver. Stale plans and plans with pending revisions cannot be approved. Repeated requests do not duplicate the build request.

**There is no website builder or hosted preview in this milestone.** Approved plans show `awaiting_builder`; no preview URL is invented. File/logo/image uploads, generated images, source export, shared preview hosting and the site-editing copilot belong to the next milestones. Reference URLs work now; uploaded files do not.

The planning context includes standard lead fields, shared lead notes, planning chat and the preceding plan. It does **not** copy Mail, SMS, call transcripts or channel-restricted client memory into the shared planning workspace. It does not overwrite the original lead or change its contact details. Context and output have size limits; older history can be shortened and the agent receives an explicit notice.

## Required configuration

Apply all website migrations through `0030_factory_costs.sql` before serving these pages. The existing Render build command runs `npm run db:migrate`; confirm the deployment actually succeeded. No Mail migration or Cloudflare change is required for this milestone.

| Setting | Service | Behavior |
| --- | --- | --- |
| `DATABASE_URL` | Website | Existing CRM PostgreSQL connection; use the normal website migration process. |
| `FACTORY_OPENAI_API_KEY` | Website | Optional dedicated OpenAI project/key for research and planning. If empty, the existing `OPENAI_API_KEY` is used. Never a `NEXT_PUBLIC_` variable. |
| `OPENAI_API_KEY` | Website | Existing fallback key. Do not rotate or remove it merely to configure Factory; call analysis and Inbox drafting may depend on it. |
| `FACTORY_WORKER_URL` | Existing reporting cron | Exact value: `https://www.tailoredagents.com/api/cron/factory`. Omitting it pauses this lane while other scheduled lanes continue. |
| `FACTORY_WORKER_SECRET` | Website and cron, if used | Optional separate secret with at least 32 high-entropy characters; the same value must be present on both services. |
| `SEARCH_CONSOLE_SYNC_SECRET` | Website and cron | Existing fallback when `FACTORY_WORKER_SECRET` is empty. The Render blueprint already shares this from the website to the cron. |

Provider keys belong only on the website service. The cron needs its URL and worker secret, not an OpenAI key. Keep secret values out of Git, screenshots, chat, request URLs and logs.

Adding a key **does not enable paid work**. Research settings live in PostgreSQL and default off for a new workspace. Austin explicitly approved **$25/month for research and planning**, and the live settings have been saved and verified with research enabled and automatic intake off. That approval does not need repeating. The Factory allowance is independent of SEO, call analysis, Inbox drafting and hosting.

## Scheduled processing

The existing `tailored-agents-search-console-sync` cron is configured in `render.yaml` to run every five minutes. `scripts/scheduled-workers.mjs` runs reporting, optional SEO, and optional Website planning as independent lanes. A failure in one lane does not prevent the others from running.

For Website planning it sends an authenticated `POST` to `/api/cron/factory`, refuses redirects or a different origin/path, and repeats while the endpoint reports more work and the invocation budget allows. Each HTTP invocation handles at most one provider stage. The provider timeout is 65 seconds, the cron HTTP deadline is 110 seconds, and the route's declared maximum is 120 seconds. The overall scheduled invocation budget is 210 seconds. Work still queued afterward continues on a later scheduled run.

The two-minute worker lease prevents concurrent processing of the same request. An expired lease becomes a visible failed job requiring a deliberate retry; the worker does not silently resend a request that may already have incurred a charge. Do not promise a fixed plan completion time from the five-minute cron schedule alone.

No separate paid cron service or always-running builder was added. Additional active time on the existing service can affect its hosting bill. `render.yaml` supplies the optional Factory URL for Blueprint deployments; verify the actual existing cron's environment after deploying rather than assuming a repository edit changed it.

## Pilot and activation

1. Deploy the additive migrations and website changes; keep research disabled.
2. Verify that the Website planning queue opens for an authorized teammate and that a sparse existing lead can start a workspace. Its research should remain queued while disabled. Viewers can read but cannot start work, change settings, send planning chat or approve plans.
3. Confirm the cron URL/secret configuration. An authenticated worker invocation while research is disabled should find no paid work. An unauthenticated request must be rejected. This confirms routing, not model quality.
4. Use Austin's approved **$25 monthly research/planning allowance**. The live settings are already saved and verified for a deliberate pilot: research enabled and **automatic research for new leads** off. The queue was empty at verification. Existing deliberately queued requests become eligible when research is enabled; keep automatic intake off while selecting and evaluating pilot leads.
5. Select a small, authorized set of leads, including no website, an unhelpful company name, uncertain business matches and sparse details. Run research and assess the sources and proposed plans. A nonexistent search match must not become a factual assertion that the business lacks a site.
6. Use planning chat to correct a detail and change the design direction. Verify a revised version and its change explanation. Ask a clarification and verify that no unnecessary version is created when the plan is unchanged.
7. Approve the latest plan and verify that exactly that version enters `awaiting_builder`. There is no build or URL to validate yet. Check that further discussion preserves the already approved snapshot.
8. Compare observed quality, timing, conservative usage estimates and OpenAI project usage. Then enable automatic research for new leads if the owner wants it. This does not authorize any automatic website construction.

No paid pilot has been performed merely by writing or deploying this code. Record actual live acceptance and model quality separately from local fixtures in the build plan's resume log.

## Model, sources and estimated spending

The fixed model policy is `gpt-6.1-sol`, standard service tier, low reasoning effort and 30-minute prompt caching. Requests use the Responses API with `store: false`. Research has only the hosted `web_search` tool, at most two tool calls and bounded output. Planning uses a strict JSON schema with no tools. Shell, code, computer-use, deployment and messaging tools are not exposed.

The source URLs shown in a plan originate from actual provider `url_citation` annotations. A model-authored URL in prose is not promoted into a source. Sourced findings and possible matches must reference one of the saved source IDs. A source's evidence text is the provider's cited research statement, not a verbatim quotation independently scraped from that page. The source URL and retrieval time are retained so a person can review it. Research content, lead fields and chat are treated as untrusted data and cannot approve builds.

Official documentation checked October 26, 2026:

- [GPT-6.1 Sol model capabilities and pricing notes](https://developers.openai.com/api/docs/models/gpt-6.1-sol): web search and structured outputs supported.
- [Responses web search](https://developers.openai.com/api/docs/guides/tools-web-search): actual citation annotations, bounded search controls and the 128K search context window.
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs): strict JSON-schema planning results.
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing): standard Sol short-context input/output rates are $2/$10 per million tokens; search calls are $10 per thousand, plus search content tokens. Cache writes and long contexts have distinct rates.

The app intentionally reserves more than a typical short request is expected to consume. Research reserves the possible repeated search context, bounded input, fixed framing and bounded output for each permitted model turn, plus tool calls. Planning reserves its bounded plain input/schema and output with no tools. Both use conservative long-context 30-minute cache-write/output rates and an additional contingency rather than assuming cache discounts. The maximum accepted reservation is **$5 per provider stage**. This is a ceiling on reservation acceptance, not a quoted price per lead.

The ledger settles to a **conservative usage estimate**, not an exact invoice: `input_tokens × $5/million + output_tokens × $15/million + counted web actions × $0.01`, with a 10% contingency. An API response can cost less than this estimate. Account-specific adjustments or later price changes can differ; recheck the model/pricing policy before changing it. Actual OpenAI billing remains the authority.

Monthly limits use UTC calendar months. Reservations serialize across concurrent jobs. Uncertain requests retain their full reservation for that billing month. An unrelated job can still proceed if the remaining allowance covers it; uncertainty does not freeze the entire workspace. Retrying is explicit and requires a new reservation, so it can incur another charge. Usage exceeding a reservation is recorded and pauses both research and automatic intake for review. Never erase receipts or silently release an uncertain reservation to make room.

## Recovery and rollback

- **Request queued:** check research enabled, accepted allowance, available server key, worker URL/secret and cron execution. A key alone is insufficient.
- **Failed planning:** the previous plan and saved discussion remain available. Check the sanitized error and provider/project usage, correct the cause, then use **Retry**. Repeated automatic provider requests are intentionally disabled.
- **Interrupted or timed-out request:** assume its charge may be unknown. Its full reservation remains counted. A later confirmed receipt may settle it; do not blindly reset cost rows.
- **Budget reached:** keep the job failed until the owner deliberately raises the allowance or a new month has room, then retry. There is no bypass through concurrent requests.
- **Pause paid work:** disable research in Website planning settings. Automatic intake must be off when research is off. Already-running HTTP cannot be recalled, but a late result is rejected after the worker observes the pause.
- **Pause only scheduling:** clear `FACTORY_WORKER_URL` on the cron. Reporting and SEO lanes remain configured. Queue records persist; this does not clear the feature's intake setting.
- **Delete/anonymize a lead:** associated planning content/jobs are removed. Late provider results cannot recreate it. Cost receipts retain only operational usage and remain counted after their job reference is removed.
- **Rollback the application:** keep these additive tables and receipts; do not drop them as a routine rollback. Disable research and the optional cron lane first. Existing communications do not depend on the Factory feature.

## Local verification

The Factory tests use synthetic provider responses. They do not call OpenAI, contact prospects, or establish live research quality. Integration tests refuse databases outside their exact disposable local addresses.

With the existing local PostgreSQL container on port `55433`, create the following databases if they do not already exist: `ta_factory_test`, `ta_factory_worker_test`, and `ta_factory_browser_test`. The test harness applies migrations and resets fixture data inside those databases.

PowerShell from the repository root:

```powershell
$env:TEST_FACTORY_DATABASE_URL='postgresql://ta_test@127.0.0.1:55433/ta_factory_test'
$env:TEST_FACTORY_WORKER_DATABASE_URL='postgresql://ta_test@127.0.0.1:55433/ta_factory_worker_test'
npx vitest run lib/factory
npm run test:factory:browser
npm run lint
npm run typecheck
npm run build
```

The browser config starts a local fixture provider and a Next development server on ports `3181` and `3180`; its test-only preload intercepts OpenAI requests. Production provider code always targets the official OpenAI endpoint. Avoid simultaneous Next builds/dev servers sharing `.next`. The browser harness can update generated `next-env.d.ts`; review that incidental change after the test.

`npm run factory:worker` runs one real worker stage against the configured database and key; it is **not** a synthetic smoke test. Only run it for an explicitly enabled environment with an accepted allowance. The normal production path is the protected cron endpoint.

The milestone's provider/worker suite covers sparse leads, source validation, strict planning output, no-op revisions, size limits, duplicate claims, concurrent budget reservations, uncertain outcomes, overages, deletion during HTTP, pause during HTTP and stale leases. Deployment and live acceptance results belong in the [implementation resume log](AI_WEBSITE_FACTORY_BUILD_PLAN.md#resume-instructions-and-progress-log).
