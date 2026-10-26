# Website Factory: research, planning and website builds

**Latest checkpoint, October 26 — all Render selected:** Austin chose Render for both preview hosting and private artifact storage so this work no longer depends on Cloudflare or Jeffrey. The new preview/storage service and adapter changes are being implemented; no deployment is claimed yet. The existing Render builder is deployed, passed initial CLI/database startup and remains suspended until connected to the new service. Research/planning are owner-confirmed live, and the existing research cron was inspected. Last signed-in Owner readback showed research enabled, automatic intake off and its $25/month cap; building disabled at **$50/month and $5/site**, $0 estimated/reserved builder usage and missing storage. Existing tests and deployment evidence below precede this storage change and do not verify it. The under-$1 initial-preview target is unmeasured. Historical milestones retain their original evidence; current setup is the all-Render configuration below.

October 26, 2026. This guide covers milestone 1 of the [build plan](AI_WEBSITE_FACTORY_BUILD_PLAN.md): lead research, proposed website plans, planning chat, immutable plan versions, and human approval saved to a build queue.

CRM deployment is recorded in the [implementation log](AI_WEBSITE_FACTORY_BUILD_PLAN.md#resume-instructions-and-progress-log): Render `dep-dbfta4vb9u1s73bugmkg`, GitHub deployment `7345235695`, source `1fb1d0f`. Health returned 200; anonymous source and unsigned preview resolver requests returned 401. This does not establish build-infrastructure activation, live build quality or a verified provider bill. Implementation checks use synthetic responses. No paid builds or new infrastructure were activated.

The standalone builder CLI correction subsequently deployed successfully from source `2f4acb22b6531c4a530bb3fe3ff27afbd7e197c4`: Render `dep-dbftct95efls73ecjp1g`, GitHub deployment `7345338624`. This confirms the website release containing the correction; it does not establish that the separate builder service has been created or run.

**Current status:** Austin explicitly approved **$25 per month for research and planning** on October 26, 2026. Saved settings were read back in the live UI under Austin's Owner account: research enabled, automatic new-lead research off and monthly limit $25. At that activation checkpoint, the queue contained zero workspaces and $0 estimated/reserved usage, and the paused banner was removed. Austin subsequently confirmed the first live research-to-plan result, with a screenshot showing plan v1 **Ready to review** at **5:56 PM EDT**, two research sources, submitted details, possible matches and unknowns. This establishes the first live provider workflow result; it does not establish measured cost, inspected cron configuration/logs, live chat revisions, human approval or a build. The broader pilot remains unfinished. Builder/image spending is separately approved at $50/month and $5/site; infrastructure and live build activation are still outstanding.

## What this release does

Open **Sales → Website mockups → Website planning**, or start/open the planning workspace from a lead. A lead needs no company name, website, location, industry, or other specific business field to enter this workflow. Missing or questionable information should yield an explicitly provisional, useful general concept.

1. A deliberate start creates a durable research request. After automatic intake is enabled, new Meta, website and manual leads can create the same request automatically. Existing leads are never silently backfilled.
2. The worker saves a research result, then uses a separate bounded request to produce the proposed plan. Findings, possible matches, submitted details, assumptions and unknowns remain distinct.
3. Teammates can discuss the plan and supply public reference URLs in the persistent chat. New directions create a revised plan when needed; a clarification can preserve the current version. While an agent is processing the saved context, the chat draft remains available and can be sent afterward.
4. **Approve vN & queue build** records the exact current plan and its approver. Stale plans and plans with pending revisions cannot be approved. Repeated requests do not duplicate the build request.

**Milestone 2 CRM is deployed:** exact approvals produce durable website-build versions, while older approvals can be picked up when the builder is enabled. The pipeline prepares portable static source and one hero image, checks layouts, publishes and verifies hosted bytes before exposing a preview URL. Hero uploads and source ZIP are included; actual website editing through chat remains milestone 3. The existing Render builder is suspended while the all-Render storage/preview change is implemented and deployed.

The planning context includes standard lead fields, shared lead notes, planning chat and the preceding plan. It does **not** copy Mail, SMS, call transcripts or channel-restricted client memory into the shared planning workspace. It does not overwrite the original lead or change its contact details. Context and output have size limits; older history can be shortened and the agent receives an explicit notice.

## Required configuration

Apply all website migrations through `0031_factory_builds.sql` before serving these pages. The existing Render build command runs `npm run db:migrate`; confirm the deployment actually succeeded. No Mail migration is required. Research keeps its existing configuration; building needs the separate Render storage/preview setup below.

| Setting | Service | Behavior |
| --- | --- | --- |
| `DATABASE_URL` | Website | Existing CRM PostgreSQL connection; use the normal website migration process. |
| `FACTORY_OPENAI_API_KEY` | Website | Optional dedicated OpenAI project/key for research and planning. If empty, the existing `OPENAI_API_KEY` is used. Never a `NEXT_PUBLIC_` variable. |
| `OPENAI_API_KEY` | Website | Existing fallback key. Do not rotate or remove it merely to configure Factory; call analysis and Inbox drafting may depend on it. |
| `FACTORY_WORKER_URL` | Existing reporting cron | Exact value: `https://www.tailoredagents.com/api/cron/factory`. Omitting it pauses this lane while other scheduled lanes continue. |
| `FACTORY_WORKER_SECRET` | Website and cron, if used | Optional separate secret with at least 32 high-entropy characters; the same value must be present on both services. |
| `SEARCH_CONSOLE_SYNC_SECRET` | Website and cron | Existing fallback when `FACTORY_WORKER_SECRET` is empty. The Render blueprint already shares this from the website to the cron. |

For research/planning, provider keys belong only on the website service. The existing reporting/research cron needs its URL and worker secret, not an OpenAI key. The separate website-builder cron described below does need a provider key because it performs generation itself. Keep secret values out of Git, screenshots, chat, request URLs and logs.

Adding a key **does not enable paid work**. Research settings live in PostgreSQL and default off for a new workspace. Austin explicitly approved **$25/month for research and planning**, and the live settings have been saved and verified with research enabled and automatic intake off. That approval does not need repeating. The Factory allowance is independent of SEO, call analysis, Inbox drafting and hosting.

## Scheduled processing

The background research worker is already implemented and has produced a live plan. There is no requirement for Jeffrey specifically: a hosting administrator with Render access can inspect the recurring schedule or fix a scheduling issue if one appears. Do not treat uninspected scheduler logs as evidence that the working feature still needs a new worker.

The existing `tailored-agents-search-console-sync` cron is configured in `render.yaml` to run every five minutes. `scripts/scheduled-workers.mjs` runs reporting, optional SEO, and optional Website planning as independent lanes. A failure in one lane does not prevent the others from running.

**Live inspection, October 26:** cron `crn-dbaggnjncjis73dgadhg` runs `npm run search-console:sync` every five minutes with the exact Factory URL above and `SEARCH_CONSOLE_SYNC_SECRET` present. Its 6:45 PM EDT scheduled run succeeded in 29.8 seconds; the 6:45:44 PM log reported “Website planning: 0 checked; 0 need review.” No existing cron settings or secrets were changed. This verifies the idle scheduled lane, not a new research result, measured provider cost or the wider quality pilot.

For Website planning it sends an authenticated `POST` to `/api/cron/factory`, refuses redirects or a different origin/path, and repeats while the endpoint reports more work and the invocation budget allows. Each HTTP invocation handles at most one provider stage. The provider timeout is 65 seconds, the cron HTTP deadline is 110 seconds, and the route's declared maximum is 120 seconds. The overall scheduled invocation budget is 210 seconds. Work still queued afterward continues on a later scheduled run.

The two-minute worker lease prevents concurrent processing of the same request. An expired lease becomes a visible failed job requiring a deliberate retry; the worker does not silently resend a request that may already have incurred a charge. Do not promise a fixed plan completion time from the five-minute cron schedule alone.

No separate paid cron service or always-running builder was added. Additional active time on the existing service can affect its hosting bill. `render.yaml` supplies the optional Factory URL for Blueprint deployments; verify the actual existing cron's environment after deploying rather than assuming a repository edit changed it.

## Pilot and activation

- [x] **First live research and plan, October 26 at 5:56 PM EDT:** Austin confirmed success and supplied a screenshot showing version 1 Ready to review, two sources, and separate submitted details, possible matches and unknowns. No client identity or contact details are retained in this guide. Actual cost, cron environment/log inspection, live chat revision and exact-version approval remain to be checked.

The sequence below is the setup and pilot procedure; completed deployment, allowance activation and the first live plan are recorded above and in the implementation log.

1. Deploy the additive migrations and website changes; keep research disabled.
2. Verify that the Website planning queue opens for an authorized teammate and that a sparse existing lead can start a workspace. Its research should remain queued while disabled. Viewers can read but cannot start work, change settings, send planning chat or approve plans.
3. Confirm the cron URL/secret configuration. An authenticated worker invocation while research is disabled should find no paid work. An unauthenticated request must be rejected. This confirms routing, not model quality.
4. Use Austin's approved **$25 monthly research/planning allowance**. The live settings are already saved and verified for a deliberate pilot: research enabled and **automatic research for new leads** off. The queue was empty at verification. Existing deliberately queued requests become eligible when research is enabled; keep automatic intake off while selecting and evaluating pilot leads.
5. Select a small, authorized set of leads, including no website, an unhelpful company name, uncertain business matches and sparse details. Run research and assess the sources and proposed plans. A nonexistent search match must not become a factual assertion that the business lacks a site.
6. Use planning chat to correct a detail and change the design direction. Verify a revised version and its change explanation. Ask a clarification and verify that no unnecessary version is created when the plan is unchanged.
7. Approve the latest plan and verify that the exact version enters the build queue. While building is disabled, it must remain queued without an invented URL. Check that further discussion preserves the already approved snapshot.
8. Compare observed quality, timing, conservative usage estimates and OpenAI project usage. Then enable automatic research for new leads if the owner wants it. This does not authorize any automatic website construction.

The first live result above is separate from the synthetic implementation tests. Austin subsequently confirmed planning chat works. Continue the remaining pilot checks and record actual cost, broader model quality and exact-version approval evidence separately in the build plan's resume log.

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

With the existing local PostgreSQL container on port `55433`, create the following databases if they do not already exist: `ta_factory_test`, `ta_factory_worker_test`, `ta_factory_build_test`, and `ta_factory_browser_test`. The test harness applies migrations and resets fixture data inside those databases.

PowerShell from the repository root:

```powershell
$env:TEST_FACTORY_DATABASE_URL='postgresql://ta_test@127.0.0.1:55433/ta_factory_test'
$env:TEST_FACTORY_WORKER_DATABASE_URL='postgresql://ta_test@127.0.0.1:55433/ta_factory_worker_test'
$env:TEST_FACTORY_BUILD_DATABASE_URL='postgresql://ta_test@127.0.0.1:55433/ta_factory_build_test'
npx vitest run lib/factory
npm run test:factory:browser
npm run lint
npm run typecheck
npm run build
```

The browser config starts a local fixture provider and a Next development server on ports `3181` and `3180`; its test-only preload intercepts OpenAI requests. Production provider code always targets the official OpenAI endpoint. Avoid simultaneous Next builds/dev servers sharing `.next`. The browser harness can update generated `next-env.d.ts`; review that incidental change after the test.

Browser traces/results are isolated under `test-results/factory-browser`. Portable-site renderer/export tests write disposable artifacts under the operating-system temporary directory `tailored-agents-factory-site-core`, rather than the Playwright output directory. These local artifacts are synthetic and do not establish production hosting or model quality.

`npm run factory:worker` runs one real worker stage against the configured database and key; it is **not** a synthetic smoke test. Only run it for an explicitly enabled environment with an accepted allowance. The normal production path is the protected cron endpoint.

The milestone's provider/worker suite covers sparse leads, source validation, strict planning output, no-op revisions, size limits, duplicate claims, concurrent budget reservations, uncertain outcomes, overages, deletion during HTTP, pause during HTTP and stale leases. Deployment and live acceptance results belong in the [implementation resume log](AI_WEBSITE_FACTORY_BUILD_PLAN.md#resume-instructions-and-progress-log).

## Milestone 2: private storage, preview hosting and build worker

**Current plan: all Render.** The CRM and separate Render builder are deployed; the new private storage/preview service and storage adapter are being implemented. Initial builder CLI/database startup passed, and that existing cron remains suspended until connected. Live generation and hosted preview acceptance are pending. Preserve working research/planning and its separate $25/month cap. Build/image ceilings of **$50/month and $5/site** are already approved; they are maximums, not expected charges. The under-$1 initial preview target is unmeasured. Render web-service, disk and builder compute charges are separate from the AI allowance.

**Ownership, superseding the earlier Cloudflare handoff:** Austin/Codex handle all Factory hosting, environment configuration, verification and activation in Render. Jeffrey has no remaining Factory infrastructure task. His unrelated Mail, Meta and SEO work stays unchanged. The default HTTPS `onrender.com` hostname avoids DNS/Cloudflare dependencies; a custom domain is optional later.

**Historical Render provisioning checkpoint, October 26:** created `tailored-agents-website-builder` (`crn-dbfth6uk1f9s73amh7ig`) in TA / Production, Ohio, from main `f4be5ee241ac80f8fae0b3117a059b49423fa829` at 6:47:55 PM EDT. Deployment `dep-dbfth6uk1f9s73amh840` succeeded at 6:48:53 PM. The isolated startup triggered at 6:49:08 PM logged `{worker:'website-builder',status:'unconfigured',more:false}` at 6:49:49 PM and finished successfully at 6:50:04 PM; Render shows a 56.7-second successful run. This verifies real CLI imports, CRM database connectivity/recovery and clean exit without provider calls. It did not test live Chromium QA, AI generation, storage or previews. Manual suspension was confirmed after reloading Render. A scheduled run that started at 6:50 PM was canceled by that suspension after 31.5 seconds, as expected. Settings used `deploy/factory-builder.Dockerfile`, repository-root context, `1c-2g` and `*/5 * * * *`. Existing CRM database/provider credentials were copied privately, along with the then-proposed R2 bucket name and custom preview origin; R2 credentials and the preview secret were absent. Those storage settings are superseded by the all-Render configuration below. Ohio matches the CRM database's private-network region. Startup compute was used and is subject to Render billing; website health returned 200.

### Configuration by service

| Variable | Website | Existing build worker | Render preview/storage service |
| --- | --- | --- | --- |
| `DATABASE_URL` | Existing CRM connection | Same CRM database | Never |
| `FACTORY_OPENAI_API_KEY` or `OPENAI_API_KEY` | Existing research key | Blueprint and image generation | Never |
| `FACTORY_STORAGE_URL` | Actual `https://<service>.onrender.com` origin | Same | Not needed |
| `FACTORY_STORAGE_SECRET` | Random 32+ character bearer secret | Same | Identical secret for private storage operations |
| `FACTORY_PREVIEW_ORIGIN` | Same public `onrender.com` origin | Same | Service's HTTPS origin |
| `FACTORY_PREVIEW_SECRET` | Separate random 32+ character secret | Same for final verification | Identical secret for CRM resolution |
| `FACTORY_RESOLVER_URL` | Not needed | Not needed | `https://www.tailoredagents.com/api/integrations/factory/preview` |
| `FACTORY_STORAGE_DIRECTORY` | Not needed | Not needed | `/var/data/factory` persistent disk mount |

The new service uses Ohio, a Starter instance with 512 MB RAM, and a 5 GB persistent disk mounted at `/var/data/factory`. It stores artifacts on that disk; the CRM and builder access private operations with `FACTORY_STORAGE_SECRET`. Public previews use the same service's default HTTPS origin and must pass the CRM capability resolver. Source ZIPs, screenshots and uploads remain authenticated CRM downloads, not public files. Never put artifacts on ephemeral service storage or reuse Mail storage. Keep actual secrets only in hosting settings, not Git, chat, URLs or this guide. The service receives no database or AI keys.

Use two independent secrets: `FACTORY_STORAGE_SECRET` for private artifact operations and `FACTORY_PREVIEW_SECRET` for preview resolution. Each value must match across the CRM, existing builder and preview/storage service. Both client services must use the actual same HTTPS service origin for `FACTORY_STORAGE_URL` and `FACTORY_PREVIEW_ORIGIN`. Anyone with an enabled preview link can view its demo; it is not an authenticated client account. Previews expire after 90 days and an editor can revoke or renew sharing. The new adapter selects Render storage when `FACTORY_STORAGE_URL` is set; the retained R2 backend is an optional fallback when it is unset, not a dependency of this setup.

### Setup and acceptance

1. **Austin/Codex:** finish and verify the all-Render adapter/service change, then deploy it with **Enable website building** off. Earlier CRM migrations and CLI releases are already deployed but do not include this new storage change. Preserve working Mail, research, communications and SEO settings.
2. **Austin/Codex — Render:** deploy one shared preview/storage web service from `deploy/factory-preview-render.yaml` and `deploy/factory-preview.Dockerfile`, in Ohio on Starter / 512 MB, with a 5 GB persistent disk at `/var/data/factory`. Set its four Factory variables from the table: storage secret, preview secret, resolver URL and storage directory. Render supplies the runtime port. No OpenAI or database key belongs there. Record its actual `onrender.com` origin; a custom domain is not required. `/health` verifies service configuration and writable disk, not an end-to-end website build.
3. **Austin/Codex — Render:** set `FACTORY_STORAGE_URL`, `FACTORY_STORAGE_SECRET`, `FACTORY_PREVIEW_ORIGIN` and `FACTORY_PREVIEW_SECRET` on both the CRM and existing builder, using the actual preview/storage origin and matching independent secrets. Remove the superseded Factory R2 values/custom preview origin from this setup when applying the replacement. Verify private storage access and public resolver behavior without running paid generation; verify an artifact survives a service restart.
4. **Austin/Codex — Render:** reuse `tailored-agents-website-builder` (`crn-dbfth6uk1f9s73amh7ig`) and deploy the verified adapter update. Do not create a duplicate. It uses `deploy/factory-builder.Dockerfile`, includes Playwright, runs as a non-root user and is scheduled every five minutes when resumed. `1c-2g` supplies 2 GB RAM. Resume after configuration checks pass; keep the CRM building toggle off until the pilot is ready. Docker starts `--drain`: process queued stages, exit when idle, and stop before claiming another stage after 30 stages or 30 minutes. Preserve the separate research/reporting cron. Verify live Chromium sandbox behavior and scheduled-run logs during the pilot; the earlier unconfigured startup did not exercise Chromium.
5. **Austin/Codex:** while building stays off, open **Website planning → Website builder**, confirm $50 monthly and $5/site, and confirm approved requests remain queued. Anonymous screenshot/source requests must be rejected; invalid/revoked preview links must not resolve.
6. **Austin:** select and approve the exact real-client plan in the CRM for the pilot. Hosting/budget authorization and synthetic tests do not approve that plan. **Austin/Codex:** review all waiting approvals before enabling building with the already approved limits; enabling makes all waiting human-approved plans eligible. Research completion alone never approves a build.
7. Observe **Design & code → Images → Quality checks → Publishing → Final verification**. A URL appears only after the hosted version is verified. Inspect desktop/mobile screenshots and the actual demo; then download source.
8. Extract the ZIP in a clean temporary directory, run `node build.mjs` on Node 22 or newer, and serve `dist/`. Confirm it reproduces the preview without CRM dependencies, secrets or expiring image URLs. Its `render.yaml` targets an independent static site. Forms, booking/payment integrations, final content and domain configuration still need production finishing.
9. Test sharing revocation/renewal, a failed stage, and explicit retry. Record actual provider usage, runtime, turnaround and quality before broadening use. Do not claim a fixed price or completion time from synthetic tests.

### Current behavior and boundaries

- A validated blueprint drives a trusted portable renderer; generated commands or dependencies are not executed. Six initial design families are trades, editorial, wellness, hospitality, professional and general. Several compositions vary the pages. This first builder creates marketing-site previews.
- One hero image is generated or supplied. PNG/JPEG/WebP uploads are limited to 5 MB, normalized to PNG and stripped of metadata. The UI allows replacing that hero. Logo placement, multiple image roles and visual analysis in planning chat are not implemented. Asset metadata does not constitute visual understanding of an image.
- Each bounded stage has a durable lease. Failed/expired work requires an explicit retry; transport is not blindly retried. QA permits one repair. A failed build preserves earlier good previews.
- Monthly/per-version allowances include estimates, reservations and unknown charges. Retry does not erase previous spend. Infrastructure bills are not controlled by the AI ledger.
- The image stage conservatively reserves **$2** before a provider attempt. This is not an image price: reported usage settles to an estimate afterward, while an unknown outcome retains its reservation. A $5 per-site ceiling and $50 monthly ceiling are likewise limits, not expected costs.
- The existing scheduled builder is deployed but paused; the all-Render preview/storage deployment is still pending. The shared scheduled builder exits when idle. Render bills cron compute by active running seconds, with a **$1 minimum per cron service per month**; this is not a flat $1 bill. The new always-on preview/storage service and persistent disk have separate hosting charges and are not controlled by the AI ledger. [Render cron billing](https://render.com/docs/cronjobs#billing).
- A local Docker check passed as a non-root user with the browser sandbox enabled under a 0.5-CPU/512-MiB limit: three pages and six screenshots completed in 14.85 seconds, with peak memory of 431 MiB. That leaves little headroom and does not measure the whole worker or a provider-backed build. Keep the initial 2-GB `1c-2g` default until full-worker workloads are measured on the deployed service.
- Preview bytes are verified against the stored manifest. The preview service restricts file paths and checks each published object; forms remain demonstrative. Authenticated artifact routes check workspace access. Lead/project deletion revokes access and queues storage cleanup, including delayed passes for late writes. Verify those boundaries again against the new Render storage backend before live activation.
- Pause building through its dashboard toggle; suspend the opt-in builder cron when appropriate to stop future scheduled runs. The dashboard toggle does not remove the Render service or its minimum charge. Preserve records and receipts. Do not drop additive tables as ordinary rollback.
- Keep the preview/storage service to one instance with its attached persistent disk; the CRM and builder use authenticated HTTP rather than a cross-service filesystem mount. Back up the disk separately from the CRM database, and verify restore before relying on it as the sole retained copy. Source ZIP export is portable, but it is not a complete service backup. Coordinate secret rotation across all three services.
- Current chat still revises plans. Editing actual website files, comparisons/source restoration, richer image workflows and direct GitHub export remain milestone 3.

`npm run factory:build-worker -- --drain` uses the bounded scheduled-run behavior above. `npm run factory:build-worker -- --once` performs one stage; `npm run factory:build-worker` remains available for continuous operation when intentionally chosen. All operate on the configured database and provider key and are not synthetic tests.

Local UI verification passed all eight desktop/phone Playwright flows, followed by two focused completed-preview checks after the final copy changes. Type checks, focused UI lint and the production build also passed. Automated browser checks use fixtures for ready/failed/paused UI, budgets, sharing, uploads and accessibility; mocked screenshot/download transport does not establish actual production artifacts. Separate runtime/export tests exercise those. Production infrastructure, a real provider-backed build, actual hosting cost and live source/preview acceptance remain unverified. Record deployment and live results separately in the build-plan resume log.

A subsequent standalone CLI smoke check exposed a startup issue outside the Next application. Its correction uses async `main` and portable `build-images.ts` imports; ten focused tests, lint, type checks and a fresh production build pass. The actual Dockerfile and exact default command were also verified offline as `pwuser`, producing only the expected sanitized missing-database error when credentials were omitted. A run against the disposable local database exited successfully as `unconfigured`. These startup checks are distinct from the renderer-only Docker check above and do not activate production infrastructure. Deploy the latest main revision, which includes the CLI correction after CRM release `1fb1d0f`.
