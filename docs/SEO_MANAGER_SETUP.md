# Tailored Agents SEO manager

Updated October 24, 2026. Applies only to **https://www.tailoredagents.com**. Work stays on `main`. See [the Jeffrey handoff](../new%20jeffrey.md) for the live acceptance record.

## Current release and costs

Daily monitoring checks the 14 registered public pages. Weekly paid strategy proposes useful improvements, with a separate critique request and exact supporting quotations. An owner/admin must review the final public title and description before publication. Matching social metadata, live verification, version checks, rollback and 28-finalized-day outcome review remain in place. Articles, page-body changes, city-ranking measurements, automatic code repair, outreach and client sites are outside this release.

**DataForSEO is optional and off. Do not create or fund its account for this release.** Search Console supplies the site's own search evidence free of API charges. The five Georgia service areas guide business relevance; they are not office claims or measured city rankings.

The maximum is **$10 per UTC calendar month**, including manual requests, retries, the real model pilot and unresolved reservations. Hosting, call analysis and taxes are separate. Five weekly Sol plan/critique pairs reserve at most approximately $3.50 at the configured context/output limits and standard 30-minute cache-write rates. Actual charges depend on tokens and cache use. Provider funding is separate from consumption; no automatic top-up is implemented.

Production model: `gpt-6.1-sol`, medium reasoning, standard service tier, maximum 8,000 output tokens, bounded plain-text context, no hosted tools. Preserve this role and evaluate before changing models. The comparison pilot may use Astra explicitly, within its own **$5 sub-limit** of the same monthly allowance.

Sources checked October 24: [Sol pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [cache accounting](https://developers.openai.com/api/docs/guides/prompt-caching), [project limits](https://developers.openai.com/api/docs/guides/spend-limits), [free Search Console API](https://developers.google.com/webmaster-tools/pricing), [Render cron billing](https://render.com/docs/cronjobs).

## Connection and deployment

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
- Queue a scan before a strategy. A strategy requires all 14 pages from a completed recent scan; partial scans cannot be treated as complete evidence. Missing Google data remains explicitly incomplete.
- **Retry update** resumes a blocked/failed stage only when that stage has no attempted paid request. Concurrent clicks reuse active work. If a paid result is uncertain, review its receipt first; the system never quietly repeats the charge. Unresolved charges from an older month still block paid work.
- After a charge is reconciled, deliberately request new work if needed. Money reconciliation does not recreate a lost model output.
- Public changes require factual review and a current version. A changed source page invalidates stale proposals. Verify actual public HTML; restoring previous metadata is available. Public cache invalidation occurs on reviewed publication/rollback; automatic rollback can take up to five minutes.
- Outcome review waits for 28 complete finalized Google dates. Restored/replaced changes are not falsely attributed. Before/after differences do not prove causation.

## Tests and rollback

Use isolated PostgreSQL 18 on loopback port 55433. `TEST_SEO_DATABASE_URL` must identify `ta_seo_test`. Run `npm test` with the documented independent TEST_* databases, `npm run test:seo:browser`, shared Inbox regressions, lint, strict types, build and both dependency audits. Browser transports are local and synthetic. Repeat dark-mode browser coverage with `DASHBOARD_TEST_THEME=dark` if supported by the shared theme helper.

The recovery script upgrades populated fixtures, dumps/restores PostgreSQL and checks existing reporting, communications, costs, publications and retention. Back up production separately before migration. Do not put exports or credentials in Git.

Rollback: pause paid AI/pilot, unset only the cron's `SEO_WORKER_URL`, and preserve the existing reporting/call/Meta job. Restore a compatible application release and keep additive migrations and cost receipts. If restoring a release without the $10 guards, keep SEO processing paused. Restore individual public metadata through its reviewed rollback control. Keep database access restrictions in place after operator backup/maintenance.

## Acceptance record

Implementation and synthetic verification are separate from live activation. The real model key/pilot, actual costs, teammates' own sign-ins, external mail delivery, scheduled daily/weekly operation and first justified public change must be recorded in the handoff. A no-change pilot is valid; publication acceptance remains open until a warranted change is verified. The 28-day outcome review remains due afterward.
