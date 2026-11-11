# Tailored Agents SEO manager

Updated November 11, 2026. Applies only to **https://www.tailoredagents.com**. Work stays on `main`. See [the Jeffrey handoff](../new%20jeffrey.md) for dated live acceptance records.

## Automatic metadata publishing — November 11

Austin requested autonomous SEO operation without per-change approval. Migration **0067_seo_autonomy.sql** adds an explicit owner/admin setting, **Publish validated metadata automatically**. It is off by default: migrations never impersonate an authorizing owner. Saving it records the current owner, time and a unique grant. Daily monitoring, weekly Sol, the reviewed business profile and the existing $10/month allowance remain prerequisites. No new credentials, provider purchases or DataForSEO activation are needed.

In this mode, each new normal strategy can prepare up to three metadata updates. Exact source quotations, a separate AI critique, current page fingerprints, current authorizer membership, a valid worker lease and the saved grant are checked before publication. The worker publishes titles, descriptions and matching Open Graph/Twitter text, invalidates page caches, verifies public HTML and restores the previous version if verification does not pass within 15 minutes. The 28-day observation window remains. Automatic publications are labelled as automatic and never receive a fabricated human-review timestamp. Articles, page-body edits, code repairs, backlinks, outreach and client sites remain unsupported by this publisher.

The November 11 live audit found daily scans healthy but the November 2 and 9 weekly runs blocked on `scan_required`. The cause was a planning/scan race: page snapshots were partially replaced during an incremental scan. Planning now waits through scan delays; missing evidence queues a scan and resumes automatically. Only the latest unpaid historical scan block is recovered, without replaying old paid requests. Uncertain receipts still stop paid work. Stale evidence is retired so a later strategy can prepare a fresh proposal. A model may legitimately recommend no change.

**Deployment / activation:** push the verified website release on `main`; `tailored-agents-web` runs the ordered migrations and build through its existing Render build command. Keep the existing shared scheduled job and all secrets. Verify migration 0067 and the exact live commit. In `/dashboard/seo`, an owner saves daily checks, weekly AI and automatic metadata publishing, with reviewed AI/automation-first priorities and the existing budget. Saving different priorities or disabling/re-enabling automation creates a new grant; older proposals are not silently opted in. **Pause SEO automation** stops new paid work and future publications, while already published metadata and free verification/rollback remain available. Changing a grant during a publication is rechecked at commit.

**Local release evidence, November 11:** 85 focused SEO tests passed (including 48 PostgreSQL cases), plus six real-page browser journeys across desktop and phone, production build, strict types, lint and `git diff --check`. The broader website run before the final one-per-grant scheduling refinement passed 880 tests with 641 skipped; focused tests, types/lint and all browser journeys/build were rerun after that refinement. All provider traffic in these tests was synthetic; skipped suites are not passed checks. The pre-release live audit observed 14/14 pages, zero technical flags, $0.697127 spent, no reservations, and the existing `/seo` observation due November 29. Production activation is recorded separately below when observed.

Enabling automatic mode (or saving changed priorities under it) schedules one fresh strategy within the same allowance. Previous unapproved wording is retained as stale history, not silently published. An in-flight strategy finishes before new work starts; completed grant work is not repeatedly charged on each worker check.

Final worker review also corrected empty-queue polling (`GREATEST` must not convert an absent next job into zero delay). The added idle/inactive-site regression and all focused tests pass: **86 SEO tests, including 49 database cases**, with strict types and lint. The six browser journeys/build above cover the same publication UI and workflow; this final SQL-only scheduling correction was verified against PostgreSQL.

### Observed production acceptance — November 11

- Source commits `2e6ebfb` and `8cbf34a` are pushed to `main`. Render web deployment `dep-dbpvt88ae00c73fjm82g` for `8cbf34afe29ad28ec8a0252bb881f39b9e594ace` reported **Deploy succeeded / Live**, with service-live log at **12:38:42 AM Eastern**. The deployed settings and automatic publication successfully used the migration 0067 fields; no replacement infrastructure or secrets were installed.
- Austin's signed-in owner account saved **Publishing: automatic**, daily scans and weekly Sol enabled, budget **$10/month**, the existing five Georgia service areas, and AI/automation/software-first keywords and instructions. Partnership terms stay private. The UI confirmed **SEO settings saved**.
- The existing scheduled worker recovered the blocked strategy, completed planning and critique, automatically published `/engineering`, then reported **Published search title and description verified on the live page** at **12:41 AM Eastern**. Its publication history says **Published automatically**, with observation review due **December 9 at 12:41 AM Eastern**. No manual publication/retry click or forced example edit was used.
- Final observed dashboard status: **Ready**, **14/14 pages**, **zero technical flags**, **$0.77 settled/displayed this month**, **$0 reserved**, **$9.23 remaining**. The existing `/seo` publication and November 29 observation remain. The first real automatic publication is verified; later daily/weekly cycles and ranking/conversion outcomes require elapsed time and are not claimed by this check.

**Historical state, November 1:** free daily monitoring is working (nine completed
14-page scans), Google remains connected, and Jeffrey's business-facts review is
saved. The dedicated SEO project/key and enforced $10/month provider limit are
configured. Both real comparison models and all five safety cases succeeded with
14 settled receipts totaling **$0.697127**. Jeffrey approved the named pilot review
and enabled weekly Sol recommendations within the $10 cap. His separately approved
`/seo` metadata was published at about 18:44 UTC and verified by the existing
scheduled worker at 18:45 UTC; observation review is due November 29. See the
[actual pilot review](SEO_PILOT_REVIEW_2026-11-01.md). The first scheduled weekly
paid cycle and 28 complete reporting days still require real elapsed time.
Do not repeat paid pilot calls or earlier infrastructure setup.

The dedicated **Tailored Agents SEO** project is under **Stonegatejunkremoval** at
Jeffrey's explicit direction. Its service key is stored as `SEO_OPENAI_API_KEY` only
on `tailored-agents-web`; configuration deploy `dep-dbjo70142hec73dkai1g` went live
November 1 at 18:25:05 UTC on `c9bb7ca`. No call-analysis credential was changed,
credits purchased or auto-reload enabled. Provider Usage had not yet displayed the
new project activity at the immediate check; returned token-usage receipts were
independently recalculated and matched every application charge. The monthly
provider invoice remains separate evidence.

## Current release and costs

Daily monitoring checks the 14 registered public pages. Enabled weekly paid strategy proposes useful improvements, with a separate critique request and exact supporting quotations. Manual mode requires an owner/admin to review final wording. Automatic mode publishes new validated proposals under the saved owner authorization described above. Matching social metadata, live verification, version checks, rollback and 28-finalized-day outcome review are implemented. The first real reviewed publication was live-verified November 1; its outcome review remains pending. Articles, page-body changes, city-ranking measurements, automatic code repair, outreach and client sites are outside this release.

**DataForSEO is optional and off. Do not create or fund its account for this release.** Search Console supplies the site's own search evidence free of API charges. The five Georgia service areas guide business relevance; they are not office claims or measured city rankings.

The maximum is **$10 per Eastern calendar month**, including manual requests, retries, the real model pilot and unresolved reservations. Hosting, call analysis and taxes are separate. Five weekly Sol plan/critique pairs reserve at most approximately $3.50 at the configured context/output limits and standard 30-minute cache-write rates. Actual charges depend on tokens and cache use. Provider funding is separate from consumption; no automatic top-up is implemented.

Approved active model: `gpt-6.1-sol`, medium reasoning, standard service tier, maximum 8,000 output tokens, bounded plain-text context, no hosted tools. It passed the real pilot and Jeffrey's named review. Preserve this role and evaluate before changing models. The comparison pilot may use Astra explicitly, within its own **$5 sub-limit** of the same monthly allowance.

Sources checked October 24: [Sol pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [cache accounting](https://developers.openai.com/api/docs/guides/prompt-caching), [project limits](https://developers.openai.com/api/docs/guides/spend-limits), [free Search Console API](https://developers.google.com/webmaster-tools/pricing), [Render cron billing](https://render.com/docs/cronjobs).

## Connection and deployment

This is the reusable operator procedure. Production migration, worker configuration and free monitoring are already complete. Dedicated project/key, spending control, pilot review and activation are also complete. Preserve installed secrets and the working Google connection; do not repeat these setup steps.

1. Preserve existing Mail, Google, Meta, Twilio, database and login settings. Apply the ordered website migrations through **0018_affordable_seo.sql**. It preserves costs/reports/publications, caps the saved allowance at $10, and starts paid AI/pilot controls off.
2. Create a dedicated OpenAI project and key for SEO. Store it as `SEO_OPENAI_API_KEY` on `tailored-agents-web`. Never substitute the call-analysis `OPENAI_API_KEY`. Set a project spending limit of $10 and enable hard enforcement where available. Provider enforcement can lag; application reservations remain required.
3. Keep `SEO_EXTERNAL_RESEARCH_ENABLED=false`. Credentials alone cannot activate DataForSEO. Retained older observations remain historical; they are excluded from new strategy inputs while research is off.
4. Reuse **tailored-agents-search-console-sync**, every five minutes, starting `npm run search-console:sync`. Add `SEO_WORKER_URL=https://www.tailoredagents.com/api/cron/seo` and its matching `SEO_WORKER_SECRET`. Keep the reporting URL/secret unchanged. Do not create the former separate SEO cron.
5. The job independently attempts reporting and SEO, rejects redirects, honours saved-stage delays, and stops starting work before its 210-second allowance expires. A later check resumes unfinished work. API keys and database credentials stay on the web service, not on the cron.
6. Enable free monitoring and verify the first full scan and a later naturally scheduled check. Measure runtime and website load. Hosting is billed by active runtime even when reusing a service.

An empty `SEO_WORKER_URL` disables only the SEO lane. The standalone `seo:worker` command remains an operator recovery tool; it is not an additional deployed service.

## Real model pilot and approval

In the dashboard, review the business knowledge, service areas, published offers and instructions; check the factual-review box and save. Free monitoring can run before this review. Paid recommendations remain unavailable until both the key and model review are ready.

From an authorized server shell with the existing private database configuration:

```sh
npm run seo:pilot -- queue
npm run seo:pilot -- status
```

The queue command captures the same completed recent website scan and reporting evidence for Sol and Astra. Both jobs use the production durable worker and cost ledger. Repeated queue commands return existing active/uncertain jobs. No provider request is made by queuing alone. **Pause paid AI** also pauses the pilot. The pilot flag clears after the jobs finish.

Review the exact proposals and critiques for factual support, usefulness, source quotes, unjustified local-office claims, scope, missing/weak evidence and valid no-change decisions. After both comparison jobs finish, run `npm run seo:pilot -- cases` to exercise five controlled Sol cases: fabricated claims, unsupported offices, source instructions, unavailable evidence and pages still in their observation window. These use the same $5 pilot allowance and never create publishable changes. Inspect each result and critique with `status`; success means a response was saved, not that its judgement passed. Synthetic transport tests do not establish real model quality. Any critical failure blocks approval.

Reconcile provider usage, including cache writes and billable output; reasoning is already part of output and must not be added twice. Keep a private review JSON with `model`, both `runIds`, the five `caseRunIds`, the dashboard owner/admin `reviewerEmail`, `criticalFailures: 0`, and true values for `factuality`, `usefulness`, `sourceInjection`, `unsupportedLocations`, `weakEvidence`, `noChange`, `costsReconciled`. Record the cases and conclusions with it. Do not mark a case passed without evidence.

```sh
npm run seo:pilot -- approve /private/path/review.json
```

Approval checks both completed model runs, active reviewer membership and resolved receipts. It records the review but does not enable paid automation. The owner/admin can then enable **Run weekly paid AI recommendations** in the dashboard. Paid work requires current factual approval, reviewed model quality, the separate key and sufficient budget.

## Everyday operation and recovery

- **Free daily website checks** and **weekly paid AI recommendations** have separate switches. Budget exhaustion or pausing AI leaves monitoring available.
- The screen shows settled cost, reservations, remaining allowance, latest Google date, completed scan/strategy and last successful worker check. A warning appears after 20 minutes without a successful check. A configured key is not proof of provider authentication.
- Planning automatically waits for or queues a complete scan. A strategy requires all 14 pages from a completed recent scan; partial scans cannot be treated as complete evidence. Missing Google data remains explicitly incomplete.
- **Retry update** resumes a blocked/failed stage only when that stage has no attempted paid request. Concurrent clicks reuse active work. If a paid result is uncertain, review its receipt first; the system never quietly repeats the charge. Unresolved charges from an older month still block paid work.
- After a charge is reconciled, deliberately request new work if needed. Money reconciliation does not recreate a lost model output.
- Public changes require either individual factual review or current standing automatic authority, plus source validation and a current version. A changed source page invalidates stale proposals. The authenticated worker invalidates caches on automatic publication/rollback and verifies actual HTML. The standalone recovery worker relies on the five-minute ISR fallback. Restoring previous metadata is available.
- Outcome review waits for 28 complete finalized Google dates. Restored/replaced changes are not falsely attributed. Before/after differences do not prove causation.

## Tests and rollback

Use isolated PostgreSQL 18 on loopback port 55433. `TEST_SEO_DATABASE_URL` must identify `ta_seo_test`. Run `npm test` with the documented independent TEST_* databases, `npm run test:seo:browser`, shared Inbox regressions, lint, strict types, build and both dependency audits. Browser transports are local and synthetic. Repeat dark-mode browser coverage with `DASHBOARD_TEST_THEME=dark`; the existing theme helper supports it.

The recovery script upgrades populated fixtures, dumps/restores PostgreSQL and checks existing reporting, communications, costs, publications and retention. Back up production separately before migration. Do not put exports or credentials in Git.

Rollback: pause paid AI/pilot, unset only the cron's `SEO_WORKER_URL`, and preserve the existing reporting/call/Meta job. Restore a compatible application release and keep additive migrations and cost receipts. If restoring a release without the $10 guards, keep SEO processing paused. Restore individual public metadata through its reviewed rollback control. Keep database access restrictions in place after operator backup/maintenance.

## Acceptance record

Keep actual results in [the handoff's release evidence](../new%20jeffrey.md#release-evidence), and update its single remaining-work checklist as checks pass. Successful scans and scheduled idle checks do not prove paid model quality or the next complete daily/weekly run. A no-change pilot is valid. The warranted `/seo` publication passed November 1; the 28-day outcome review remains due afterward.
