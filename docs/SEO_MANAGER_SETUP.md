# Tailored Agents SEO manager

October 22, 2026. This is the internal manager for **www.tailoredagents.com**. It targets national customers plus **Woodstock, Canton, Marietta, Acworth and Roswell, Georgia**. These are service areas, not claims that we have offices there.

**Ownership update:** Austin has handed the remaining SEO activation, pilot and follow-on development to Jeffrey. Use [new jeffrey.md](../new%20jeffrey.md#seo-manager--jeffrey-owns-the-remaining-work) as the working handoff; this document remains the detailed operating reference. Coordinate account ownership, payment access and unknown business facts with Austin as needed.

## What this release does

The manager scans 14 registered public pages daily, prepares a weekly strategy, checks national/local keyword results on desktop and mobile, and retains its evidence and history. A planning model proposes improvements; a second, separate model request critiques each proposed metadata change. Owners/admins can edit and publish the exact title/description after factual review. The manager checks the live result, restores the previous metadata if verification fails, and records search and measured inquiry evidence after at least 28 finalized Google dates.

This first publisher supports **search titles and descriptions**, including matching social metadata. It also prepares content briefs. Writing/publishing full articles, changing page bodies, code fixes, redirects, Google Business Profile edits, outreach and client-site SEO remain later work. No rankings or lead counts are invented when data is missing. The manager starts paused; deploying the code alone does not start paid requests.

## Jeffrey: arrange DataForSEO access

1. Create your business account through [DataForSEO](https://dataforseo.com/). Use an account you control.
2. In the DataForSEO dashboard, open **API Access**. Copy the **API login** and **API password** shown there. They are API credentials; do not assume your website login password is the API password. Keep both out of chat and Git.
3. Fund the account when ready. The published minimum deposit is **$50**, prepaid usage credit rather than a monthly subscription. Confirm the amount on the funding screen before paying. [Official pricing](https://dataforseo.com/Pricing).
4. Store the credentials using your team's secure credential-sharing method and enter them in the website's Render Environment settings:
   - `DATAFORSEO_LOGIN` = the API login.
   - `DATAFORSEO_PASSWORD` = the API password.
5. Redeploy the web service after saving. No Twilio number changes are needed.

The manager uses **Google organic Standard queued tasks**, English, depth 50. Its five initial keywords × six markets (US plus five cities) × two devices produce **60 observations per weekly run**, with at most **$0.18 reserved** at current pricing. This is a small starter set, not comprehensive market coverage. Add specific national and local buying-intent terms as the first strategy learns from actual results. Up to 50 keywords and eight service areas are supported. [Official task pricing and fields](https://docs.dataforseo.com/v3/serp/google/organic/task_post/).

## Jeffrey: deploy the scheduled worker

1. Let the website deployment finish. Its existing build applies **0016_seo_manager.sql** before building. Do not run migrations against another application's database.
2. On `tailored-agents-web`, preserve the existing `OPENAI_API_KEY` used for call analysis. Add the two DataForSEO variables above. Set `SEO_WORKER_SECRET` to a new random value of at least 32 characters if the Blueprint has not supplied it. Never print these values in logs.
3. Apply the repository's `render.yaml` Blueprint addition, or create this **separate Cron Job** manually in the same Render workspace:
   - Name: `tailored-agents-seo-manager`.
   - Repository: `TailoredAgents/Tailoredagentssite`, branch `main`, runtime Node, Ohio region.
   - Instance: **0.5 CPU / 512 MB**.
   - Schedule: **`*/15 * * * *`** (Render cron timezone is UTC).
   - Build: **`npm ci`**.
   - Start: **`npm run seo:worker`**.
   - `NODE_VERSION`: **22.18.0**.
   - `DATABASE_URL`: the existing **tailored-agents-db internal connection string**.
   - `OPENAI_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`: reference the web service's corresponding variables, as the Blueprint does, or securely copy the same values.
4. Enable deploys from `main`. This worker does not need Mail, Twilio or the website's login secrets. It does not run migrations itself. Keep the Search Console/call-analysis worker as well; this is an additional job.
5. Trigger one run while the manager is paused. Logs should show no failed stage and no paid work. In **Dashboard → SEO manager**, confirm **Worker** displays a recent timestamp. A configuration badge only checks whether server variables exist; it is not proof of successful provider authentication.

The separate job keeps model latency out of normal CRM requests. Render charges cron runtime with a minimum per service; verify the current price before creating it. [Render cron documentation](https://render.com/docs/cronjobs). The Blueprint is configuration to apply, not evidence that the service already exists.

The optional protected HTTP endpoint `POST /api/cron/seo` executes one bounded stage, using `Authorization: Bearer <SEO_WORKER_SECRET>`. It falls back to the existing Search Console sync secret when no dedicated secret exists. Never expose either secret to the browser. The CLI cron above is the recommended runner.

## Jeffrey: run the first supervised cycle

1. Sign in to **Dashboard → SEO manager** with an owner/admin account. Viewers can inspect evidence but cannot enable work, spend funds or publish.
2. Under **Settings**, review the displayed business knowledge, prices, target markets and initial keywords. Add any accurate business instructions. Keep the initial **$40 monthly AI/data limit**.
3. Select the business-facts review checkbox and **Run daily monitoring…**, then **Save SEO settings**. The scheduler creates daily scans and weekly strategy/research runs; it does not publish public copy automatically.
4. Confirm all registered pages are scanned and inspect any real technical observations. The first strategy can run before keyword research finishes and will explicitly have less search evidence. Free result retrieval runs in bounded batches of up to 20, preserving successful rows when another retrieval fails. Queue another strategy once the observations finish if useful.
5. Open **Review change**. Compare the before/after wording, actual source quotations and critique. Edit or reject unsupported copy. Check the final wording against your services before publishing. Publication is version checked and refused if the observed page changed after the proposal.
6. After publication, confirm **verified** appears. **Restore previous metadata** reverses an active change. Public pages use a five-minute cache, with immediate invalidation for dashboard publication/rollback. An automatic worker rollback can take up to five minutes to appear.
7. Check **Analytics** has an active, correctly scoped Google Search Console connection. If not, follow [Search Console readiness](SEARCH_CONSOLE_READINESS.md). Missing dates are reported; they do not become zero clicks. A full follow-up comparison needs Google's finalized data to cover at least 28 dates after publication.

## Costs and controls

The broader planned usage estimate remains roughly **$30–$40/month**, depending on actual context/output and worker runtime. This initial metadata publisher and five-keyword starter set can consume substantially less; the estimate is not a subscription charge. No account has been purchased or funded by this code change. The first month may require about **$80 cash funding** if you choose $30 OpenAI credit plus the $50 DataForSEO minimum; prepaid balance is not the same as monthly consumption.

This implementation uses **GPT-6 Astra for both weekly planning and critical review**, with medium reasoning and an 8,000-output-token ceiling per request. The default set of pages is bounded and each request reserves a conservative maximum before sending. Current configured rates are $10/M input and $50/M output tokens; reasoning output is billable. This prioritizes the quality requested by the owner. No paid live model comparison has yet been run, so synthetic checks establish runtime behavior, not the model's SEO quality. [Official OpenAI pricing](https://developers.openai.com/api/docs/pricing).

The **$40** limit covers this manager's OpenAI/DataForSEO receipts, including unresolved reservations, within a UTC calendar month. It **does not include** call analysis, other applications using the same key, taxes, prepaid deposits, database charges or Render hosting. Set provider-side spending controls as well. The UI allows $1–$90; the $90 ceiling leaves some room below the owner's $100 total preference. No automatic credit top-up is implemented.

Concurrent paid stages share a database budget lock. An attempted request with an unknown result is retained as **uncertain** and never resent automatically. Check provider usage, then reconcile its real cost/reference in the dashboard. Reconciling money does not replay the lost operation; deliberately queue fresh work only after reviewing what happened. If actual usage exceeds the reservation, paid work pauses. Provider prices must be reviewed when models or task types change.

## Operating limits and next development

- Public-site requests are restricted to registered pages on the canonical host, use public DNS/address validation, refuse redirects, and have size/time limits. The manager does not crawl competitors' sites or private CRM/Mail routes. It observes page-level robots directives; it is not a general recursive crawler.
- Strategies use only public business evidence, owner instructions, aggregate search/first-party measurements and bounded search results. Customer mail and call transcripts are not sent to this manager.
- Paid requests use durable stages and receipts. Interrupted free work can resume. Unknown charged requests stop for review rather than silently duplicating a bill.
- Search results are observations for a location/device/time, not guaranteed personal rankings. Before/after measurements do not prove causation. Search Console first needs to collect enough finalized data.
- The next development after a successful live pilot is an evaluated content workflow: original service/industry pages and useful articles, factual review, preview, publication and measurement. Technical repair publishing and Google Business Profile management need separate scoped tools. Expand autonomy based on reviewed live results.

For repeatable synthetic verification, use the disposable loopback PostgreSQL container and `TEST_SEO_DATABASE_URL=postgresql://ta_test@127.0.0.1:55433/ta_seo_test`, then `npx vitest run lib/seo`. `npm run test:seo:browser` creates and resets only `ta_seo_browser_test` on the same guarded port. Its AI/search transports are synthetic; it sends no paid requests and publishes no production content.

## Local verification

October 22, 2026:

- **405 code/database checks** pass across 37 files, including **51 SEO checks** for public-path boundaries, current database permissions, concurrent budgets, lowered limits, UTC month rollover, unknown charges, worker leases, interrupted requests, metered search submission, partial/free retrieval recovery, evidence validation, publication, stale proposals, verification, rollback and complete Pacific-date measurement windows. Missing Google evidence and limited page detail remain unknown, rather than invented zero metrics.
- **Eight SEO browser checks** pass against actual production builds: desktop/phone in light and dark. They cover the full scan → plan → critique → search observations → factual review → publication → actual HTML verification → rollback cycle, read-only access and unsigned worker rejection. Axe A/AA and viewport containment checks pass. Paid providers are synthetic in these tests.
- **Four existing shared Inbox regressions** pass, covering combined customer history, CRM context, draft preservation and sending on desktop/phone with synthetic providers. The existing Twilio/Mail production settings were not changed.
- Populated migration **0016**, PostgreSQL 18 dump/restore and the combined retention function pass. Reviewed active SEO publications and uncertain cost receipts survive the restore alongside existing reporting, sales and communications data.
- Lint, strict types, the production build and the full dependency audit pass; the audit reports zero vulnerabilities. The standalone worker also completes an actual **read-only scan of all 14 public production pages**, persisting its result only in the guarded local database, with **zero paid requests**.
- The Next.js development CSP now includes the debugging script permission required by the installed framework guide, only in development. Production retains the existing strict script sources. The development cache was refreshed before the shared Inbox checks.

Reviewed synthetic previews: [light desktop manager](previews/seo-manager-desktop.png), [light phone review](previews/seo-change-phone.png), [dark desktop manager](previews/themes/dark/providers/seo-manager-desktop.png), [dark phone review](previews/themes/dark/providers/seo-change-phone.png).

These results establish the application mechanism. A real provider quality/cost pilot, the first reviewed production improvement, scheduled-service acceptance and later search outcomes remain separate live gates.

## Website delivery

Implementation `1e5c988ac41c4dd2a4c638499d3b4ea751461bab` and the measurement follow-up `510e09a9c18572ad7b9d294e0b40f181af460aaf` are pushed to `main`. GitHub deployment **7262788867** reports Render success for the final code revision at **4:25:01 p.m. EDT on October 22, 2026** (20:25:01 UTC). [Render deployment](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbd71hmk1f9s738q646g).

After that deployment, the health, sign-in, Websites and Pricing endpoints return 200. Both SEO dashboard routes redirect anonymous visitors to sign-in. The worker rejects unsigned POST requests with 401 and GET with 405. Production CSP does not allow development eval. The public Websites page still serves its original title and passes this release's metadata/canonical/heading checks; no production SEO copy was published during delivery.

Open [SEO manager](https://www.tailoredagents.com/dashboard/seo) with your existing approved login. Authenticated owner/admin acceptance, Render cron existence/environment checks, real AI/DataForSEO authentication and billing, the first reviewed publication and its eventual search outcome remain pending. The live availability checks above do not establish that the recurring manager is activated. Jeffrey owns the remaining steps under the updated handoff above; no paid provider request, account funding or production content change was performed by Codex.
