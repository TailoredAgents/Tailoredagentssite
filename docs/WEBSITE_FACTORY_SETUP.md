# Website Factory: research, planning and website builds

## Salesperson workflow (October 27 update)

1. Open **Website Builder** in the dashboard sidebar. **Create website mockup** lets you search for a lead by name, company, email or phone. A lead’s own page has the same entry point. Missing company, website or location details do not block starting.
2. Review the proposed direction and pages. Use **Your direction → Update the plan** to add context or request changes. **Full plan** and **Research & sources** contain the details. Unsent chat drafts are preserved and must be sent or cleared before approval.
3. Select **Approve plan & build website** after reviewing the latest version. Approval applies to that exact plan. The page follows real build stages automatically; you can leave and return.
4. When ready, choose **Open website** or **Copy preview link** at the top of the project. Source downloads and sharing controls are in **Download source & sharing options**. To plan a new version, expand **Plan & project history**. Planning chat does not edit already published files.

The workspace filters are **Needs review**, **Building**, **Ready to share** and **Needs attention**. Error details stay visible in the project’s error disclosure; revised-plan/technical failures explain the required next step rather than encouraging blind retries. Administrators can retry technical failures after fixing the cause. Budget and retry enforcement are unchanged.

Research and building controls now live under **Website Builder → Builder settings**. **Manual mockups** is the older team-built preview tracker; saving a brief there does not start AI generation. Existing project/preview URLs remain valid.

**Verified recovery complete — October 27, 2:57 PM EDT:** Cosmo website v3 (`d6efcb6c-9358-443a-933d-35f7016aca03`) is READY, QA passed, published and hosted-file verification completed. Builder `35bb20094c0c860139ac5418bdee9152809e3dbc`, deployment `dep-dbgf748m7kps73c0uapg`, was verified Live before resuming QA. Public URL: https://www.tailoredagents.com/preview/cosmos-heating-air-v3 . CRM offers the matching source ZIP. Live browser inspection confirmed the newer design and navigation from the Services closing Contact link to the Contact page. Proof: [CRM ready](previews/cosmos-v3-ready.png). Final ledger estimates for v3 including earlier failures: generation $0.269556 (two original requests), image $0.013546 (one), QA/review/repair $0.588265 (four), total $0.871367. Recovery reused captured generation, then the saved blueprint/image; no budget or attempt counters were reset.

Optional review follow-ups remain: reduce concept framing on About and duplicate timeline numbering. Manual inspection additionally found the legacy hero secondary-action renderer always targets the first section even when the label says Call/Email/Contact; explicit hero action targets should be addressed in a future builder release and acceptance checks. These do not change the resolved validation/contrast failures; do not claim every CTA has been verified semantically. Ready artifacts stay immutable and v1 remains available.

**Follow-up — inner-page contact contrast, October 27:** Resuming v3 on `b333dbb` recovered generation and created its hero, then the visual reviewer correctly flagged two seemingly missing closing links. Read-only rendered HTML confirmed the links existed. The inherited `.page-inner .text-link` selector forced dark ink onto links inside dark contact bands. Scope that rule to hero actions; section links now inherit their section contrast. A desktop/mobile browser regression checks >=4.5:1 actual computed contrast, keyboard focus and navigation, in addition to whole-site QA. Existing v3 pages/image are retained; the renderer change requires the remaining bounded review, with no reset of repair/review counts or spending. Final outcome pending deployment.

**Latest checkpoint — contact-action failure fix, October 27:** The next v3 attempt retained its response and exposed the actual rejection: three valid closing contact-section actions targeted the existing contact page, while validation allowed actions only in services/features. Added escaped, relative internal contact-item links to validation and rendering; missing targets, duplicate items and unsupported section types still fail. Explicit contact links suppress the redundant automatic inquiry fallback and do not create forms. Approved contact/coverage utility pages can count substantive form/direct-contact guidance toward depth when a real configured form exists; sales pages and empty guidance retain the depth gate. This fixes the observed retry failure, not a conclusively known cause for the original uncaptured attempt. Validation: 124 site/build integration tests, including desktop/mobile link checks and zero-provider-request cached recovery; lint and production build passed. Deploy and resume the existing approved v3 using its captured response; retain all prior costs and caps. Final live outcome to be recorded after deployment.

**Generation retry diagnostics, October 27:** Cosmo's failed v3 had one settled AI receipt estimating $0.134382, but the original response was not saved; the precise rejection cannot be established from retained data. The updated worker saves initial generation privately before validation and reuses saved responses on an explicit retry, so validation alone cannot charge for duplicate generation. It reports specific validation/response errors without exposing generated values. No automatic retry or budget change was added. Existing failed attempts without a saved response need one new generation request on retry. If the retry fails with a saved response, investigate that error before retrying again; new paid generation requires a newly approved version rather than repeatedly revalidating rejected data.

**Latest checkpoint, October 27:** Austin approved Cosmo's plan v3 at 2:14 PM EDT. The 2:15 PM builder run stopped at `generate` at 2:17:18 PM; the CRM shows website v3 failed with the generic build error. This supersedes the earlier checkpoint that v3 was awaiting approval. No additional retry was started during the progress-display work. Review-response recovery `0364625` and explicit form/service-link controls `0fb669f` were already live on CRM, builder and preview/storage. V2 remains failed after its included repair; its total ledger estimate is $0.705398. See [the incident checkpoint](AI_WEBSITE_FACTORY_BUILD_PLAN.md#cosmos-v2-review-response-recovery-october-27-2026). No visitor chatbot or finished-site editing copilot is enabled.

### Live build progress

Deployed October 27 from `26f64cf`: CRM `dep-dbgepeuc6qcc73ftjs20` live at 2:28:11 PM EDT; builder's last successfully deployed source verified at the same commit. Signed-in Cosmo workspace shows the new tracker and its existing v3 generation failure.

The build panel reads saved worker milestones, with the active stage highlighted and completed stages checked. Quality checks distinguish browser checks, design/content review, corrections, rechecking and saving. Publishing and verification have their own activities. The worker persists each milestone before starting that operation; existing builds without milestones still show their main stage.

The page refreshes status every six seconds while visible and when returning to the tab, including while a build is queued or paused. Refreshing preserves an unsent planning draft. Elapsed time is measured since approval (including waits/retries), plus time in the current reported activity; it is not a completion estimate. Between stages the panel says **Next: [stage]**, rather than claiming the whole website is awaiting its initial build. A failed stage is marked **Stopped here**. There is no automatic paid retry, new provider request, budget change or migration for progress reporting.

**October 27 update:** Austin confirmed the first generated website and requested deeper content and shorter preview links. The deployed release `3d9958e` adds company-based links such as `https://www.tailoredagents.com/preview/cosmos-heating-air`, which redirect to the isolated Render preview host. Migration `0032_factory_preview_names.sql` also names existing versions without rebuilding them. Original token links, expiry, sharing revocation and source exports continue to work. Same-name businesses receive a numeric suffix; later versions add `-v2`, etc. These are public demo links, not passwords, and remain excluded from indexing.

New approved builds receive fuller content instructions, HVAC-aware design selection, showcase/checklist layouts, compact inner-page introductions and mobile call/contact controls. Content QA checks page coverage, minimum section depth, duplicated page content and layout variety alongside browser QA, with the existing single bounded repair attempt. Existing finished artifacts are immutable; a redesigned version still needs human approval. Budget limits remain $50/month and $5/site, with research at $25/month separately. No additional image call, hosting service or DNS setup is required for this update. Release verification is recorded in the build plan below.

**Historical checkpoint, October 26 — ready for the first approved build:** source `e3acba848a7d77e81310aab96864ab976da0ef12` is live on all three Render services. Production private storage/authentication/restart checks, sandboxed Chromium and a resumed idle cron run passed. Building is enabled and read back after reload at **$50/month and $5/site**, with $0.00 estimated/reserved usage, zero previews and one plan ready for review. Research remains enabled at $25/month with automatic intake off. **Austin's exact real-client plan approval is the next step**; these checks did not approve or generate a site. Cloudflare and Jeffrey are not dependencies. The under-$1 initial-preview target remains unmeasured; historical milestones retain their original evidence.

October 26, 2026. This guide covers milestone 1 of the [build plan](AI_WEBSITE_FACTORY_BUILD_PLAN.md): lead research, proposed website plans, planning chat, immutable plan versions, and human approval saved to a build queue.

CRM deployment is recorded in the [implementation log](AI_WEBSITE_FACTORY_BUILD_PLAN.md#resume-instructions-and-progress-log): Render `dep-dbfta4vb9u1s73bugmkg`, GitHub deployment `7345235695`, source `1fb1d0f`. Health returned 200; anonymous source and unsigned preview resolver requests returned 401. This does not establish build-infrastructure activation, live build quality or a verified provider bill. Implementation checks use synthetic responses. No paid builds or new infrastructure were activated.

The standalone builder CLI correction subsequently deployed successfully from source `2f4acb22b6531c4a530bb3fe3ff27afbd7e197c4`: Render `dep-dbftct95efls73ecjp1g`, GitHub deployment `7345338624`. This confirms the website release containing the correction; it does not establish that the separate builder service has been created or run.

**Research activation history:** Austin explicitly approved **$25 per month for research and planning** on October 26, 2026. Saved settings were read back in the live UI under Austin's Owner account: research enabled, automatic new-lead research off and monthly limit $25. At that activation checkpoint, the queue contained zero workspaces and $0 estimated/reserved usage, and the paused banner was removed. Austin subsequently confirmed the first live research-to-plan result, with a screenshot showing plan v1 **Ready to review** at **5:56 PM EDT**, two research sources, submitted details, possible matches and unknowns. That screenshot established the first provider result, not measured cost, cron inspection, chat revisions, approval or a build. Later chat confirmation, cron inspection, all-Render infrastructure and building activation are recorded below. The broader pilot and first approved website remain unfinished.

## What this release does

Open **Website Builder** in the sidebar, or create/open a website project from a lead. A lead needs no company name, website, location, industry, or other specific business field to enter this workflow. Missing or questionable information should yield an explicitly provisional, useful general concept.

1. A deliberate start creates a durable research request. After automatic intake is enabled, new Meta, website and manual leads can create the same request automatically. Existing leads are never silently backfilled.
2. The worker saves a research result, then uses a separate bounded request to produce the proposed plan. Findings, possible matches, submitted details, assumptions and unknowns remain distinct.
3. Teammates can discuss the plan and supply public reference URLs in the persistent chat. New directions create a revised plan when needed; a clarification can preserve the current version. While an agent is processing the saved context, the chat draft remains available and can be sent afterward.
4. **Approve plan & build website** records the exact current plan and its approver. Stale plans and plans with pending revisions cannot be approved. Repeated requests do not duplicate the build request.

**Milestone 2 has produced the first approved website:** exact approvals produce durable website-build versions. The pipeline prepares portable static source and one hero image, checks layouts, publishes and verifies hosted bytes before exposing a preview URL. Hero uploads and source ZIP are included; actual website editing through chat remains milestone 3. All Render services are deployed and building is enabled. Austin confirmed Cosmo's v1; the first quality release still needs its own deployed, human-approved v2 acceptance. Earlier dated checkpoints preserve the initial infrastructure evidence.

The planning context includes standard lead fields, shared lead notes, planning chat and the preceding plan. It does **not** copy Mail, SMS, call transcripts or channel-restricted client memory into the shared planning workspace. It does not overwrite the original lead or change its contact details. Context and output have size limits; older history can be shortened and the agent receives an explicit notice.

## Required configuration

Apply all website migrations through `0033_factory_brand_assets.sql` before serving these pages. The existing Render build command runs `npm run db:migrate`; confirm the deployment actually succeeded. No Mail migration is required. Research keeps its existing configuration; building needs the separate Render storage/preview setup below.

The October 27 [quality upgrade](WEBSITE_BUILDER_QUALITY_UPGRADE.md) needs no new service, key or subscription. Deploy both the CRM and existing builder from the same release. Optional uploads now distinguish logo/photos and are frozen at approval; old uploads remain photos. New builds can use multiple responsive local images and bundled licensed fonts. Existing published previews are unchanged. Run the free benchmark command in the upgrade document to check the renderer without paid generation. A new client build still requires its exact plan approval.

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

**Current setup: all Render.** The CRM, private storage/preview service and existing builder are deployed; the builder is resumed and building enabled. Source `e3acba8` records the initial infrastructure release, and `3d9958e` added deeper content and company-name links. Austin subsequently confirmed Cosmo's first generated site. The quality release described below is a new implementation checkpoint, not a claim that v1 was rebuilt. Preserve working research/planning and its separate $25/month cap. Build/image/review ceilings of **$50/month and $5/site** remain maximums, not expected charges. The under-$1 initial preview target is unmeasured. Render web-service, disk and builder compute charges are separate from the AI allowance.

**Ownership, superseding the earlier Cloudflare handoff:** Austin/Codex handle all Factory hosting, environment configuration, verification and activation in Render. Jeffrey has no remaining Factory infrastructure task. His unrelated Mail, Meta and SEO work stays unchanged. The default HTTPS `onrender.com` hostname avoids DNS/Cloudflare dependencies; a custom domain is optional later.

**Historical Render provisioning checkpoint, October 26:** created `tailored-agents-website-builder` (`crn-dbfth6uk1f9s73amh7ig`) in TA / Production, Ohio, from main `f4be5ee241ac80f8fae0b3117a059b49423fa829` at 6:47:55 PM EDT. Deployment `dep-dbfth6uk1f9s73amh840` succeeded at 6:48:53 PM. The isolated startup triggered at 6:49:08 PM logged `{worker:'website-builder',status:'unconfigured',more:false}` at 6:49:49 PM and finished successfully at 6:50:04 PM; Render shows a 56.7-second successful run. This verifies real CLI imports, CRM database connectivity/recovery and clean exit without provider calls. It did not test live Chromium QA, AI generation, storage or previews. Manual suspension was confirmed after reloading Render. A scheduled run that started at 6:50 PM was canceled by that suspension after 31.5 seconds, as expected. Settings used `deploy/factory-builder.Dockerfile`, repository-root context, `1c-2g` and `*/5 * * * *`. Existing CRM database/provider credentials were copied privately, along with the then-proposed R2 bucket name and custom preview origin; R2 credentials and the preview secret were absent. Those storage settings are superseded by the all-Render configuration below. Ohio matches the CRM database's private-network region. Startup compute was used and is subject to Render billing; website health returned 200.

### All-Render release evidence — October 26

Source `e3acba848a7d77e81310aab96864ab976da0ef12` was pushed to main. New service `tailored-agents-site-previews` (`srv-dbfu0g2jnfac73elqll0`) is live at [the shared preview origin](https://tailored-agents-site-previews.onrender.com), in Ohio on `0.5c-512mb` with a 5 GB persistent disk at `/var/data/factory`. Deployment `dep-dbfu0gijnfac73elqmq0` started at 7:20:34 PM EDT and succeeded in 51.3 seconds. CRM environment deployment `dep-dbfu0tajnfac73elruhg` started at 7:21:25 PM and succeeded in 1 minute 59 seconds. The existing builder resumed and deployment `dep-dbfu1gifngtc7382tve0` succeeded in 35.4 seconds. All three use the verified storage/preview configuration; the old builder R2 bucket variable was removed.

Production synthetic checks passed: private upload/read; anonymous storage 401; a 64-byte artifact requested with `maxBytes=1` rejected with 413; direct public artifact access 404; artifact bytes preserved after the 7:22 PM service restart; exact-prefix cleanup followed by 404. The 413 verifies the read-size limit, not an oversized upload. An unknown public preview and authenticated CRM resolver returned 404, confirming the resolver is reachable and secrets match, without inventing a published site. These checks did not create a CRM approval or call a paid generation model.

Production Chromium also passed in the actual deployed builder image through Render Web Shell: UID 1001, `chromiumSandbox:true`, sanitized environment, blocked network and synthetic HTML yielded an 8,957-byte screenshot. The resumed manual cron run from 7:25:06–7:25:53 PM EDT succeeded, logging `{worker:'website-builder',status:'idle',more:false}` at 7:25:37 PM. Building was enabled and read back after reloading the CRM: $50/month, $5/site, $0.00 estimated/reserved usage, zero previews and one plan ready for review. There was no human-approved real-client plan, so no paid generation occurred. The first complete site, visual quality, measured provider cost and export acceptance remain for the human-approved pilot.

Local verification for this change: 10 preview-service tests, 113 Factory tests across 12 files with all three guarded disposable local databases and no skips, type checks, lint and the production build passed. The service also passed real Docker checks under 512 MiB / 0.5 CPU as UID 1000, including authentication, storage and restart persistence. These are separate from the production checks above. Render's setup UI quoted **$7/month service + $1.25/month disk = $8.25/month**, plus builder cron active-time billing; AI usage is separate. This is the displayed infrastructure rate, not a measured final invoice.

### Configuration by service

| Variable | Website | Existing build worker | Render preview/storage service |
| --- | --- | --- | --- |
| `DATABASE_URL` | Existing CRM connection | Same CRM database | Never |
| `FACTORY_OPENAI_API_KEY` or `OPENAI_API_KEY` | Existing research key | Blueprint and image generation | Never |
| `FACTORY_STORAGE_URL` | `https://tailored-agents-site-previews.onrender.com` | Same | Not needed |
| `FACTORY_STORAGE_SECRET` | Random 32+ character bearer secret | Same | Identical secret for private storage operations |
| `FACTORY_PREVIEW_ORIGIN` | Same public `onrender.com` origin | Same | Service's HTTPS origin |
| `FACTORY_PREVIEW_SECRET` | Separate random 32+ character secret | Same for final verification | Identical secret for CRM resolution |
| `FACTORY_RESOLVER_URL` | Not needed | Not needed | `https://www.tailoredagents.com/api/integrations/factory/preview` |
| `FACTORY_STORAGE_DIRECTORY` | Not needed | Not needed | `/var/data/factory` persistent disk mount |

The new service uses Ohio, a Starter instance with 512 MB RAM, and a 5 GB persistent disk mounted at `/var/data/factory`. It stores artifacts on that disk; the CRM and builder access private operations with `FACTORY_STORAGE_SECRET`. Public previews use the same service's default HTTPS origin and must pass the CRM capability resolver. Source ZIPs, screenshots and uploads remain authenticated CRM downloads, not public files. Never put artifacts on ephemeral service storage or reuse Mail storage. Keep actual secrets only in hosting settings, not Git, chat, URLs or this guide. The service receives no database or AI keys.

Use two independent secrets: `FACTORY_STORAGE_SECRET` for private artifact operations and `FACTORY_PREVIEW_SECRET` for preview resolution. Each value must match across the CRM, existing builder and preview/storage service. Both client services must use the actual same HTTPS service origin for `FACTORY_STORAGE_URL` and `FACTORY_PREVIEW_ORIGIN`. Anyone with an enabled preview link can view its demo; it is not an authenticated client account. Previews expire after 90 days and an editor can revoke or renew sharing. The new adapter selects Render storage when `FACTORY_STORAGE_URL` is set; the retained R2 backend is an optional fallback when it is unset, not a dependency of this setup.

### Setup and acceptance

1. **Completed:** the all-Render adapter/service change `e3acba8` is verified locally and deployed with **Enable website building** off. Preserve working Mail, research, communications and SEO settings.
2. **Completed:** the shared preview/storage service above is deployed from `deploy/factory-preview-render.yaml` and `deploy/factory-preview.Dockerfile`, in Ohio on `0.5c-512mb`, with a 5 GB disk at `/var/data/factory`. Its four Factory variables are installed; no AI or database keys belong there. Use the recorded `onrender.com` origin; no custom domain is needed. `/health` verifies configuration and writable disk, not an end-to-end website build.
3. **Completed:** the CRM and reused builder have matching `FACTORY_STORAGE_URL`, `FACTORY_STORAGE_SECRET`, `FACTORY_PREVIEW_ORIGIN` and `FACTORY_PREVIEW_SECRET`. The old builder R2 bucket setting was removed. Private storage, resolver access and artifact persistence after a service restart passed using synthetic content.
4. **Completed:** existing builder `crn-dbfth6uk1f9s73amh7ig` is updated and resumed; do not create a duplicate. It uses `deploy/factory-builder.Dockerfile`, runs as a non-root user every five minutes on `1c-2g` / 2 GB and starts `--drain`: exit when idle, or stop before another claim after 30 stages / 30 minutes. Production sandboxed Chromium and the resumed idle run passed. Preserve the separate research/reporting cron.
5. **Completed:** building is enabled and read back after reload at $50 monthly and $5/site, $0.00 usage, zero previews and one unapproved plan ready for review. The queue was checked before activation; no real-client approval was added. Anonymous storage/source access remains denied; unknown previews do not resolve.
6. **Austin — next:** select and approve the exact real-client plan in the CRM for the pilot. Building is already enabled; this approval makes that version eligible for the worker. Hosting/budget authorization and synthetic tests do not approve the plan. Research completion alone never approves a build.
7. Observe **Design & code → Images → Quality checks → Publishing → Final verification**. A URL appears only after the hosted version is verified. Inspect desktop/mobile screenshots and the actual demo; then download source.
8. Extract the ZIP in a clean temporary directory, run `node build.mjs` on Node 22 or newer, and serve `dist/`. Confirm it reproduces the preview without CRM dependencies, secrets or expiring image URLs. Its `render.yaml` targets an independent static site. Forms, booking/payment integrations, final content and domain configuration still need production finishing.
9. Test sharing revocation/renewal, a failed stage, and explicit retry. Record actual provider usage, runtime, turnaround and quality before broadening use. Do not claim a fixed price or completion time from synthetic tests.

### Current behavior and boundaries

- A validated blueprint drives a trusted portable renderer; generated commands or dependencies are not executed. Six initial design families are trades, editorial, wellness, hospitality, professional and general. Several compositions vary the pages. This first builder creates marketing-site previews.
- One hero image is generated or supplied. PNG/JPEG/WebP uploads are limited to 5 MB, normalized to PNG and stripped of metadata. The UI allows replacing that hero. Logo placement, multiple image roles and visual analysis in planning chat are not implemented. Asset metadata does not constitute visual understanding of an image.
- Each bounded stage has a durable lease. Failed/expired work requires an explicit retry; transport is not blindly retried. Normal builds use at most two screenshot/content assessments and one repair. One additional review request is available through explicit failed-build recovery, with three requests total per version and the same spending limits. A failed build preserves earlier good previews. Budget denial before provider dispatch does not consume an attempt; attempted or uncertain provider work does.
- Monthly/per-version allowances include estimates, reservations and unknown charges. Retry does not erase previous spend. Infrastructure bills are not controlled by the AI ledger.
- The image stage conservatively reserves **$2** before a provider attempt. This is not an image price: reported usage settles to an estimate afterward, while an unknown outcome retains its reservation. A $5 per-site ceiling and $50 monthly ceiling are likewise limits, not expected costs.
- The existing scheduled builder and shared preview/storage service are deployed; the cron is resumed and the CRM building toggle enabled. Work still requires exact human plan approval. The shared scheduled builder exits when idle. Render bills cron compute by active running seconds, with a **$1 minimum per cron service per month**; this is not a flat $1 bill. The preview/storage service and disk displayed $8.25/month together at setup, outside the AI ledger. [Render cron billing](https://render.com/docs/cronjobs#billing).
- A local Docker check passed as a non-root user with the browser sandbox enabled under a 0.5-CPU/512-MiB limit: three pages and six screenshots completed in 14.85 seconds, with peak memory of 431 MiB. That leaves little headroom and does not measure the whole worker or a provider-backed build. Keep the initial 2-GB `1c-2g` default until full-worker workloads are measured on the deployed service.
- Preview bytes are verified against the stored manifest. The preview service restricts file paths and checks each published object; forms remain demonstrative. Authenticated artifact routes check workspace access. Lead/project deletion revokes access and queues storage cleanup, including delayed passes for late writes. Verify completed-site sharing, revocation and authenticated export boundaries during the first human-approved pilot.
- Pause building through its dashboard toggle; suspend the opt-in builder cron when appropriate to stop future scheduled runs. The dashboard toggle does not remove the Render service or its minimum charge. Preserve records and receipts. Do not drop additive tables as ordinary rollback.
- Keep the preview/storage service to one instance with its attached persistent disk; the CRM and builder use authenticated HTTP rather than a cross-service filesystem mount. Back up the disk separately from the CRM database, and verify restore before relying on it as the sole retained copy. Source ZIP export is portable, but it is not a complete service backup. Coordinate secret rotation across all three services.
- Current chat still revises plans. Editing actual website files, comparisons/source restoration, richer image workflows and direct GitHub export remain milestone 3.

`npm run factory:build-worker -- --drain` uses the bounded scheduled-run behavior above. `npm run factory:build-worker -- --once` performs one stage; `npm run factory:build-worker` remains available for continuous operation when intentionally chosen. All operate on the configured database and provider key and are not synthetic tests.

Local UI verification passed all eight desktop/phone Playwright flows, followed by two focused completed-preview checks after the final copy changes. Type checks, focused UI lint and the production build also passed. Automated browser checks use fixtures for ready/failed/paused UI, budgets, sharing, uploads and accessibility; mocked screenshot/download transport does not establish actual production artifacts. Separate runtime/export tests exercise those. Production infrastructure verification is recorded above; a real provider-backed build, measured total cost and completed-site source/preview acceptance remain unverified. Record the pilot results separately in the build-plan resume log.

A subsequent standalone CLI smoke check exposed a startup issue outside the Next application. Its correction uses async `main` and portable `build-images.ts` imports; ten focused tests, lint, type checks and a fresh production build pass. The actual Dockerfile and exact default command were also verified offline as `pwuser`, producing only the expected sanitized missing-database error when credentials were omitted. A run against the disposable local database exited successfully as `unconfigured`. These startup checks are distinct from the renderer-only Docker check above and do not activate production infrastructure. Deploy the latest main revision, which includes the CLI correction after CRM release `1fb1d0f`.

## Quality release operation October 27, 2026

This release is implemented with local tests, browser/export checks, lint, type checks and production build verification. Final test totals, source commit and Render acceptance belong in the [latest build-plan checkpoint](AI_WEBSITE_FACTORY_BUILD_PLAN.md#first-quality-release-october-27-2026). No extra database migration, model change, environment setting, service subscription or Cloudflare work is needed. The existing server-held Factory/OpenAI key is used; it never enters a generated website or source ZIP.

### What new approved versions do

1. Preserve explicit approved palette roles and typography through generation and repair. The versioned design block adds heading/body font controls, scale/weight, density, radius, focal point and section surfaces, with contrast validation. Additional trusted compositions/layouts make distinct designs possible without executing generated code.
2. Keep the normalized hero PNG privately and encode mobile/desktop WebP derivatives. New HTML chooses the responsive variant with intrinsic dimensions and focal placement. The portable export includes the same derivatives. Existing completed versions keep their original files. One hero image remains the limit; uploaded logos, galleries and reference-image analysis are still future work.
3. Check page identities, substantive duplication, concrete public claims, browser behavior/accessibility and resource sizes. Then assess every page's desktop and mobile screenshot alongside the approved plan and full blueprint. The model returns a bounded structured review with no tools. Warnings are optional refinements; concrete errors require correction. A useful concept does not require a verified company name, address, website, credentials or other missing lead fields.
4. Allow **two normal assessments and one repair**, with one extra review request for explicit failed-build recovery (three requests total). Review uses the unchanged `gpt-6.1-sol` model and shares the existing **$50/month and $5/site** ledger with generation/images. Reserve cost before HTTP. Reuse the first hero during repair, retain attempted/uncertain spend, and pause if the allowance cannot cover further work. The separate research/planning allowance remains **$25/month**.
5. Save all page screenshots, the review summary and delivery report. Freeze reviewed files under the version's private `checked/` prefix and retain the checked manifest. Publication reads and verifies those exact bytes, builds the source export from them, and then runs hosted hash verification. A code deployment between QA and Publishing therefore cannot silently alter what was reviewed.
6. New blueprints explicitly configure demonstration forms and service-card links. Forms appear only on listed contact sections and can include name, email, phone, city/ZIP, service concern, or a preferred-contact/detail pair. Fixed notices and confirmation state that nothing is sent or stored. The paired field switches email/phone validation. Local service links can target an existing page/section. Validation rejects missing, duplicate and external destinations, and browser QA checks every form and cross-page anchor. Existing blueprints without interaction controls retain legacy rendering; completed previews keep their frozen files.

### Budgets and recovery

- The mobile hero limit is **250,000 bytes**, the desktop hero limit **400,000 bytes**, and each mobile page's HTML + shared CSS/JS + mobile image limit **800,000 bytes**. These are resource budgets, not recorded loading times, Lighthouse scores or a Core Web Vitals guarantee. Fixed-profile timing and real-visitor measurements remain acceptance work.
- A preflight budget denial before provider dispatch does not spend a review/repair attempt. After room is available, the normal explicit retry can proceed. An actual attempted request, including an uncertain response, remains counted. Do not edit counters or delete receipts to bypass the allowance.
- If a legacy in-flight build reaches **Publishing** without `checkedManifest`, it stops. Update/review the plan and obtain approval for a new version. Do not re-render that older version with current templates and mark it reviewed. Completed previews and prior downloads are preserved.
- If checked bytes no longer match their stored hashes, publication fails. Investigate storage/recovery; do not substitute new content under an already-reviewed manifest.
- Save bounded review responses privately before local validation. A matching valid saved response can be parsed again without another provider request. Invalid responses stop with a controlled diagnostic; an explicit retry can request another assessment within the three-request ceiling. Exact page enums and severity-derived outcomes avoid unknown-page labels and contradictory verdicts. No raw assessment or private blueprint enters the public error message.
- Three review requests (including explicit recovery) and one repair are ceilings, not a guarantee that all quality concerns can be resolved automatically. Remaining errors need a new reviewed plan/version; preserve the last successful preview.

### Acceptance still required

The local encoder was tested read-only against Cosmo's current hero: **2,930,343 bytes** originally, **28,816 bytes** for mobile and **117,548 bytes** for desktop. No live image changed. This is one asset's byte-size comparison, not a regenerated website or measured user performance.

Cosmo's v1 stays at [its existing short preview link](https://www.tailoredagents.com/preview/cosmos-heating-air). V2 resumed successfully after response recovery but exhausted its quality allowance against the old fixed form renderer. Its charges/counters remain intact. The corrected **plan v3**, dated October 27 at 2:06 PM EDT, is ready for Austin's exact approval. Then inspect every resulting page on desktop/mobile, compare content/design with v1, validate export, and record elapsed time and actual ledger/provider usage. Local synthetic tests do not establish excellent taste or reliable factual judgment from the model; calibrate against human review across representative briefs.

The customer-facing chatbot and finished-site editing copilot are still separate future work. Planning chat currently changes plans. No visitor-chat endpoint, live widget, live lead delivery or chatbot usage allowance is activated by this release.
