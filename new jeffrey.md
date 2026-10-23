# New Jeffrey — Meta leads, email and SEO manager handoff

Prepared October 21, 2026. SEO handoff expanded October 22. Meta connection handed to Jeffrey October 23, 2026 at Austin's request.

## Meta leads — remaining connection assigned to Jeffrey

Austin assigned the remaining **developer app, Page access, credentials, webhooks and live Facebook/Instagram Instant Form delivery into the CRM** to Jeffrey. Use [META_SETUP.md](docs/META_SETUP.md) for the detailed technical steps. Coordinate account access with Austin privately and preserve the existing implementation on `main`.

### Already completed — preserve this setup

- Austin says the business portfolio, Page, ad account and related business assets already exist. Reuse them.
- Website Pixel/Dataset ID: **1785858192683666** (public identifier).
- Austin confirmed **PageView and Lead events work** after a website-review inquiry saved to the CRM. This is owner-reported live acceptance. Do not install another Pixel snippet. Automatic advanced matching remains off.
- The connector is deployed in `10a9cf3`; `4abb3c3` adds review-form browser coverage. Migration **0017_meta_leads.sql** provides durable signed lead receipts, retries and attribution. CRM Leads supports Facebook/Instagram filtering and original form answers; Settings shows connection/import status and failed-import retry controls.
- **Instant Form imports are not yet live-verified.** The Pixel does not retrieve Facebook form answers. The developer app identifies and authorizes the CRM integration; it is not a separate customer-facing product.

### Jeffrey's activation checklist

1. [ ] Obtain the exact numeric Facebook **Page ID**. Create/select **Tailored Agents CRM** in [Meta Developer Apps](https://developers.facebook.com/apps/), associated with the existing business portfolio, with Lead Ads retrieval and Page webhooks. Use the actual business contact, website and `https://www.tailoredagents.com/privacy` as required.
2. [ ] Authorize the intended Page and obtain a production-suitable **Page access token**. Check `leads_retrieval`, `pages_manage_metadata`, Page listing/read permissions and additional Page/ad permissions required by the chosen flow. Complete applicable permission review, business verification and publishing requirements shown by Meta. Check token identity, expiration and renewal ownership; do not leave a short-lived Explorer testing token in production.
3. [ ] Set the following server-only variables on Render **tailored-agents-web**, then redeploy. Keep secrets out of this file, Git and chat.

| Variable | Value |
| --- | --- |
| `META_PAGE_ID` | Exact numeric business Page ID |
| `META_APP_SECRET` | CRM developer app secret |
| `META_PAGE_ACCESS_TOKEN` | Authorized Page token |
| `META_WEBHOOK_VERIFY_TOKEN` | New securely stored random secret, at least 32 characters |
| `META_GRAPH_API_VERSION` | `v26.0` |
| `META_LEADS_ENABLED` | `false` during setup; `true` for acceptance and operation |

Preserve the working browser settings `NEXT_PUBLIC_META_PIXEL_ID=1785858192683666` and `NEXT_PUBLIC_META_PIXEL_ENABLED=true`.

4. [ ] Configure the app's **Page** webhook: callback `https://www.tailoredagents.com/api/integrations/meta/leads`, verification token matching Render, and **leadgen** subscription. Also subscribe the **actual Page** using `POST /{PAGE_ID}/subscribed_apps` with `subscribed_fields=leadgen` and the authorized Page token. Verify with `GET /{PAGE_ID}/subscribed_apps`. App-level webhook configuration alone is insufficient.
5. [ ] Check Business Settings **Leads Access**. Where customized, grant the token identity and connected CRM app access to this Page's leads. Confirm linked Instagram form delivery uses the intended Page. Keep access scoped to the business assets needed.
6. [ ] Enable `META_LEADS_ENABLED=true`, redeploy and check **Settings → Facebook & Instagram**. Verify the existing **tailored-agents-search-console-sync** cron runs successfully every five minutes; it resumes queued Meta imports through the shared worker. No new paid worker is needed.
7. [ ] Test the actual Page/form with the [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/), then verify an ordinary public submission and Instagram delivery if used. Confirm one CRM lead with correct answers/contact details, no duplicate on replay, and Austin/Devon can follow up. An app-role test alone does not establish public-lead access.
8. [ ] Check failed-import recovery after correcting permissions/token issues. Record live acceptance date and Page/form identifiers without secrets or private lead data. Reconcile leads collected before activation: historical backfill is not automatic. New imports are unassigned and do not automatically contact the customer or send team alerts.

### Interim alerts and follow-through

- Inspect the actual Meta account for native lead notification controls and test delivery to Austin/Devon. Availability, channels and timing must be verified in that account; do not assume instant email delivery. Use Meta's lead views as the interim queue.
- If native alerts are unavailable, **Facebook Lead Ads → New Lead → Email by Zapier** can notify the team without creating a custom developer app first. It requires an eligible **paid Zapier plan**, authorized Page/leads access and confirmed alert recipients. No subscription or automation has been created. [Zapier integration](https://zapier.com/apps/facebook-lead-ads/integrations), [plan/access prerequisites](https://help.zapier.com/hc/en-us/articles/8496061306253-How-to-get-started-with-Facebook-Lead-Ads-on-Zapier).
- Website contact/review forms already support **Resend** alerts through `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` (verified sender) and `CONTACT_TO_EMAIL` (comma-separated recipients, up to ten). Confirm actual configuration and delivery before claiming alerts work. This is independent of shared Mail inbox activation. A saved CRM inquiry does not prove its alert was delivered. This path currently does not notify on Meta Instant Form imports.
- Confirm ongoing assignment and alert recipients with Austin, and avoid duplicate alerts when retiring a temporary integration. **Conversions API and qualified/won feedback remain future development**, not prerequisites for this handoff.

## SEO manager — Jeffrey owns the remaining work

Austin is handing **all remaining SEO manager activation, acceptance and follow-on development** to Jeffrey. This section is the working checklist. [SEO_MANAGER_SETUP.md](docs/SEO_MANAGER_SETUP.md) provides the detailed operating reference and verification record. Jeffrey should coordinate with Austin for account ownership, billing access or business facts that are unavailable; the setup steps previously assigned to Austin are now part of this handoff.

### Goal and confirmed decisions

- Build an ongoing SEO operator for **Tailored Agents' own website**, not just an audit dashboard. Use evidence to improve useful visibility and qualified inquiries over time; rankings are not guaranteed.
- Target national customers plus **Woodstock, Canton, Marietta, Acworth and Roswell, Georgia**. These are service areas, not additional office addresses.
- Preserve the existing website-development, SEO and AI-agent/business-automation offers and published prices. Use actual business expertise and published case-study facts.
- The owner's recurring AI/SEO-data preference is **under $100/month**. Start with the implemented **$40 monthly AI/data limit**. Its ledger excludes Render, call analysis and other applications sharing a key; account for those separately rather than treating the limit as a total vendor bill. The researched broader operating estimate is $30–$40/month; the starter release may use less.
- Automate permitted monitoring, research and planning. The initial publisher requires an owner/admin to fact-check the exact public wording. Broader publication permissions must be defined before expanding unattended changes.

### Already delivered — do not rebuild

The website code through **510e09a** deployed successfully on **October 22, 2026 at 4:25:01 p.m. EDT**. Migration **0016** adds the internal manager, durable runs, page snapshots, versioned changes, publications, cost receipts and keyword observations.

The release implements daily scans of 14 public pages, weekly strategy and independent critique, national/local desktop/mobile search observations, content briefs, reviewed title/description publishing with matching social metadata, live verification, rollback and a complete 28-day outcome window. Restored/replaced publications are marked not comparable when their pending review cannot be attributed safely.

Local verification passes **405 code/database checks**, **eight SEO browser checks** across light/dark desktop/phone, **four shared Inbox regressions**, populated PostgreSQL upgrade/dump/restore, lint, strict types, production build and dependency audit. The CLI also completed a read-only scan of all 14 live public pages into a guarded local database with zero paid requests. These checks use synthetic AI/search providers; **real model quality, provider billing and recurring production operation remain unverified**.

**The manager starts paused. Website deployment does not establish that the cron service exists, the providers authenticate or paid work is enabled.**

### 1. Finish accounts and credentials

- [ ] Create or obtain a business-controlled [DataForSEO account](https://dataforseo.com/). None was available when Austin supplied the markets. Coordinate any necessary account ownership/payment access with Austin.
- [ ] In **API Access**, obtain the **API login and API password**, rather than assuming the website password is the API password. Store credentials in Render or the team's secure credential store, never this file, Git or chat.
- [ ] Confirm funding. The October 22 research found a **$50 minimum prepaid deposit**, rather than a monthly subscription; confirm current terms before funding. No account or top-up was purchased by Codex. [Official pricing](https://dataforseo.com/Pricing).
- [ ] Preserve the existing `OPENAI_API_KEY` used for call analysis. Confirm it can access the configured **GPT-6 Astra** model. This release uses separate Astra requests for plan and critique, with medium reasoning and 8,000 maximum output tokens each. Check provider usage and project spending controls; do not silently change models without evaluating the result.
- [ ] Add `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` to `tailored-agents-web`. Set `SEO_WORKER_SECRET` to a random value of at least 32 characters if Blueprint sync has not generated it. Redeploy after environment changes. Do not change Twilio or Mail settings for SEO activation.

The starter research workload is five keywords × six markets (US plus the five cities) × two devices = **60 observations per weekly run**, Google organic Standard queued tasks, English, depth 50. Current code reserves up to **$0.18** for that batch at its configured pricing and settles known provider cost afterward. This is a starting sample, not comprehensive market coverage. Up to 50 keywords and eight local areas are supported.

### 2. Deploy and verify the separate Render worker

- [ ] Confirm the website build has applied **0016_seo_manager.sql** to **tailored-agents-db**. Keep migrations in the website's ordered build workflow.
- [ ] Check whether Blueprint sync already created `tailored-agents-seo-manager`; avoid creating a duplicate job. If absent, apply `render.yaml` or create the job with these exact settings:

| Setting | Value |
| --- | --- |
| Type / name | Cron Job / `tailored-agents-seo-manager` |
| Repository / branch | `TailoredAgents/Tailoredagentssite` / `main` |
| Runtime / region / instance | Node / Ohio / 0.5 CPU, 512 MB |
| Schedule | `*/15 * * * *` — Render cron uses UTC |
| Build / start | `npm ci` / `npm run seo:worker` |
| `NODE_VERSION` | `22.18.0` |
| `DATABASE_URL` | Existing `tailored-agents-db` **internal** connection string |
| Provider environment | `OPENAI_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, referencing the web service's corresponding values |

- [ ] Enable deploys from `main`. Keep the existing Search Console/call-analysis job. The SEO worker is an additional service, does not run migrations itself and does not need Mail/Twilio/login secrets.
- [ ] Check current Render runtime/minimum charges before creation. [Render cron reference](https://render.com/docs/cronjobs).
- [ ] Trigger one worker check while the manager is paused. Confirm successful completion, no paid work and a recent **Worker** timestamp at [Dashboard → SEO manager](https://www.tailoredagents.com/dashboard/seo).

The optional `POST /api/cron/seo` trigger runs one stage and requires `Authorization: Bearer <SEO_WORKER_SECRET>`; it falls back to the existing Search Console sync secret when no dedicated secret exists. Keep secrets server-side. The standalone cron above is the recommended runner.

### 3. Verify Google evidence and business settings

- [ ] Confirm the existing Google Search Console connection in **Analytics** is active for the actual Tailored Agents property. Reuse it; follow [Search Console readiness](docs/SEARCH_CONSOLE_READINESS.md) if repair is necessary. Check finalized dates, coverage and actual sync results, not just the presence of credential fields.
- [ ] Sign in with an authorized owner/admin account. Review the SEO page's business knowledge, published offers, service areas, seed keywords and guidance. Resolve unknown facts with Austin; do not invent offices, testimonials, clients, results or guarantees.
- [ ] Keep the **$40** initial monthly AI/data limit. Review the facts checkbox, enable recurring work and save settings when accounts, funding and the worker are ready.
- [ ] Verify all 14 pages scan. Investigate genuine metadata, canonical, heading, status or index-directive observations. Check keyword research reaches real provider results for the requested markets/devices. Free retrieval is bounded to 20 results per stage and retains successful rows when another retrieval fails.
- [ ] Queue a fresh strategy after the first research results finish if the automatic first strategy ran without them. A badge marked configured proves only that environment values exist; it does not prove authenticated provider use.

### 4. Complete and record the first real improvement cycle

- [ ] Inspect an actual plan and independent critique. Check factuality, specificity, useful intent, exact source quotations, local/national relevance and whether a change is justified. A valid no-change decision is acceptable; do not rewrite a healthy page merely to demonstrate activity.
- [ ] Check real OpenAI/DataForSEO receipts against provider usage, including billed reasoning, and confirm the remaining monthly allowance. Unknown charges must retain their reservation and must not be silently retried. Reconcile using the dashboard only after checking the provider.
- [ ] For a justified proposal, review/edit the exact title and description, check business facts, publish through the normal owner/admin flow and confirm **verified** against the actual public HTML. Stale proposals require a fresh scan/plan; do not bypass version checks or update database statuses to force publication.
- [ ] Confirm before/after versions, factual review, verification, baseline and observation dates are retained. Confirm the rollback control is available; exercise forced verification failures and interrupted requests in isolated fixtures, rather than deliberately breaking the public site.
- [ ] Record the first real run/change IDs, target page, exact wording, source evidence, model/provider usage, actual accounted cost, publication/verification times and next review date. Keep credentials and private CRM messages out of the record.
- [ ] Confirm a later scheduled invocation runs successfully without a person clicking the trigger. Check that normal no-work runs stay quiet, failures are visible and pause prevents new paid requests. A one-off successful run is not proof of recurring operation.
- [ ] After at least **28 complete finalized Google dates**, inspect the equal-window search and measured inquiry comparison. Missing/limited evidence stays unknown. Restored/replaced changes must not receive a false performance attribution. Record no-effect or adverse observations as well as improvements; before/after differences do not prove causation.

Activation is complete when the providers authenticate, scheduled operation is confirmed, real costs are reconciled and a justified reviewed improvement completes publication/verification, or the pilot records an evidenced no-change decision. A no-change pilot verifies the decision/runtime only; keep production publication acceptance open until a justified live improvement is verified. The subsequent outcome review remains due even after activation is signed off.

### 5. Continue the remaining SEO development

The deployed publisher handles **titles/descriptions and social metadata only**. Content briefs are proposals, not published articles. Jeffrey owns these remaining phases in order:

1. **Evaluate the live decision quality.** Create reviewed cases for fabricated business facts, fake local offices, competitor/source prompt injection, missing/stale data, small samples, duplicate content, pointless rewrites, scope/access violations, exhausted budgets and interrupted/failed publication. Compare candidate models/prompts within the budget before changing routing. An independent critique or passing mock-provider tests is not a substitute for this evaluation.
2. **Build original content delivery.** Turn retained briefs into useful service/industry improvements, supported case studies and articles grounded in real expertise. Add source-linked drafts, factual/editorial review, preview, versioned page-body/article publication, internal links, deployment verification, rollback and measurement. Develop genuinely useful national/local material; avoid copied content and repetitive city-name substitutions. Preserve collaborators' changes on `main`.
3. **Add scoped technical repair tools.** Extend evidence and validated fixes for crawl/index directives, canonicals, sitemap freshness, broken/internal links, supported structured data and mobile/performance issues. Keep lab and field evidence distinct. Redirects, deletions, pricing, service claims and broad structure changes need an explicit action/resource policy and recovery path.
4. **Improve recurring strategy and oversight.** Expand buying-intent keyword coverage from actual Search Console inquiries/results, retain page/query relationships and failed/no-effect approaches, and make outcome reviews revise the work backlog. Add useful failure/stale-worker alerts and concise change/spend/results reporting. Additional keyword-volume or backlink services are optional and require a separately checked data/cost contract; they are not implemented simply because DataForSEO is connected.
5. **Connect external local SEO only when ready.** Google Business Profile, directory updates and outreach need separately connected accounts, confirmed business details and exact permissions. They are not part of the current publisher. Do not infer permission to send outreach from a generated draft.
6. **Expand autonomy and client delivery after reliability is demonstrated.** Define standing permissions for each action/resource, retain pause/budget/audit/rollback controls and keep initial public-copy fact checks. Client-site support needs workspace/business/engagement/site isolation and authorization tests; the current manager is intentionally restricted to Tailored Agents' own production site. Broader recurring-service billing and the client Growth Hub remain the later agency roadmap.

Use [the active roadmap](docs/AGENCY_OS_ROADMAP.md) for the wider architecture and release gates. Finish each increment with the relevant code/database/browser checks, populated migration/restore checks when schema changes, lint, types, production build and dependency audit. Keep changes focused on **main**, push verified work and record deployment separately from live provider acceptance.

### Handoff completion record

- [ ] Account ownership/funding and secure environment setup recorded.
- [ ] Exact cron service exists once, has correct variables and shows recurring successful operation.
- [ ] Google evidence and confirmed national/local business profile checked.
- [ ] Live model/search quality and actual costs reviewed within the spending limit.
- [ ] First reviewed improvement verified, or justified no-change pilot documented.
- [ ] Outcome review assigned with its due date and evidence requirements.
- [ ] Next content-delivery increment and remaining technical/local/client work tracked.

Record completed items and remaining blockers here so Austin can see the actual state. Website availability, source presence and synthetic checks must remain distinct from real SEO operation and eventual search outcomes.

## Priority: Austin needs Mail team-management access

Requested October 22, 2026. Austin is signed into Mail as **austin@tailoredagents.com** and cannot see **Manage team**. He wants the same Mail management permission as Jeffrey so he can approve **devon@tailoredagents.com** for the website dashboard today. **This change is pending; Codex has not verified or modified these production accounts.** Austin does not have the Cloudflare account, and this workstation is signed out.

The current Mail app shows team management only to `users.is_admin = 1`. Its account API deliberately refuses role changes with “This mail service has one owner.” Use the existing Cloudflare administrator access for this one-time, explicitly requested additional Mail owner. Keep Jeffrey's owner access. No website or Mail deployment, password reset, credential sharing, or changes to Devon's owner role are needed.

1. In Cloudflare, open **D1 SQL Database**, select **tailored-mail-production**, and open its SQL console. Confirm the database name is exactly `tailored-mail-production`, not staging or local. Alternatively, an authenticated operator can execute the same queries from `apps/mail` with `npx wrangler d1 execute DB --remote --env production --command '<SQL>'`; see [Cloudflare's query documentation](https://developers.cloudflare.com/d1/best-practices/query-d1/).
2. Run this read-only check. Confirm Austin and Jeffrey are the intended existing accounts, both enabled (`disabled_at` is null), and that Austin has completed his temporary-password change (`must_change_password = 0`). Record Austin's original `is_admin` and `dashboard_access` values privately for rollback. Devon may be missing; create his account through Mail after Austin has management access if needed.

```sql
SELECT email, name, is_admin, dashboard_access, must_change_password, disabled_at
FROM users
WHERE email IN (
  'austin@tailoredagents.com',
  'jeffrey@tailoredagents.com',
  'devon@tailoredagents.com'
);
```

3. After confirming those identities and statuses, run the following guarded update. It grants Austin Mail owner management and dashboard approval, and requires an active Jeffrey owner to remain in place. It does not modify Jeffrey or Devon. If no row changes, stop and resolve the failed prerequisite rather than weakening the conditions.

```sql
UPDATE users
SET is_admin = 1, dashboard_access = 1
WHERE email = 'austin@tailoredagents.com'
  AND disabled_at IS NULL
  AND must_change_password = 0
  AND EXISTS (
    SELECT 1 FROM users
    WHERE email = 'jeffrey@tailoredagents.com'
      AND is_admin = 1
      AND disabled_at IS NULL
  );
```

4. Repeat the read-only query. Confirm Austin and Jeffrey both have `is_admin = 1`, Austin has `dashboard_access = 1`, and Devon's permissions are unchanged. Austin should refresh Mail and open [Manage team](https://mail.tailoredagents.com/admin). Mail looks up the current user role on each authenticated request; signing out and back in can also refresh the interface.
5. Austin can then find Devon under **Team members** and choose **Allow dashboard access**. If Devon has no account, use **Create an account**, name **Devon**, email name **devon**, and a privately shared temporary password (12–128 characters). Devon must choose his own password in Mail first. Do not make Devon an owner. Have him verify his own login at [Dashboard sign-in](https://www.tailoredagents.com/sign-in) using **devon@tailoredagents.com** and his Mail password. A new approved account receives the dashboard `member` role; existing dashboard roles remain unchanged.

Mail owner management includes creating/enabling/disabling accounts, resetting teammate passwords, approving dashboard access and managing shared-mailbox grants. It does not automatically share every person's private mailbox in the CRM. Sales mailbox grants below still apply separately.

If this change must be reversed, use Cloudflare to restore **only Austin's** `is_admin` and `dashboard_access` to the original values recorded in step 2; keep Jeffrey's owner account intact. Verify the next request denies Austin's team-management access when `is_admin = 0`. Do not reset either person's password.

- [ ] Austin opens **Your team** using his own Mail account.
- [ ] Jeffrey retains owner access.
- [ ] Devon completes his own dashboard sign-in as a regular teammate.

## What this handoff covers

Connect **sales@tailoredagents.com** to the internal website CRM. **Devon, Jeffrey and Austin** should have read and reply access. Confirm their actual existing Mail login accounts; their names are not permission to guess email addresses or share the inbox with everyone.

This email section covers Cloudflare/Render configuration, Mail deployment, Sales address approvals and email acceptance. Jeffrey also owns the Meta connection and SEO work above. The project owner handles Twilio and the remaining agency development with Codex.

**Unified Inbox update:** deploy the latest Mail code from `main`, including the new address-scoped `conversationIndex` and `threadHistory` API actions. The website now has a shared email/SMS/notes conversation workspace at `/dashboard/inbox` and needs these actions to discover email histories. There is no additional Mail migration or secret beyond **0037** and `CRM_MAIL_SECRET` below. The website's ordered migrations now include **0012_unified_inbox.sql**. Its existing email-only workspace remains at `/dashboard/inbox?channel=email` for compatibility. An older Mail deployment cannot provide the unified discovery API, even if the original email bridge works.

Mail API source commit: **4bdc828** (or a later `main` containing it). This code passes 406 Mail code/SQLite tests, 12 Mail browser checks, type checks and the production Mail build. Website deployment still does not deploy the Mail Worker.

## Implemented in this release

- `/dashboard/inbox`: unified customer conversation queue, mixed permitted email/SMS/notes history, ownership, reminders and CRM context. The compatible email list/folders/new-email workspace remains at `?channel=email`.
- Relationship ownership, Needs reply/Waiting/Done/Archived states, reminders, explicit contact/business/inquiry links, source-scoped internal notes, private drafts and personal reads. The compatible email workspace retains its original open/waiting/done controls.
- Narrow Mail service API with explicit address grants. Sharing Sales does not share the address owner's unrelated aliases or private messages.
- Durable send keys and recovery after uncertain confirmation; a status check reuses the same attempt. Saving a draft or note never sends email.
- Mail owner controls to approve or revoke each account's address access. Dashboard roles apply in addition to Mail permissions.
- Settings displays actual shared-email availability. Twilio configuration and activation remain the project owner's separate work.

Mail remains the source for email bodies, attachments and delivery state. CRM PostgreSQL stores collaboration metadata, private drafts and content-free send receipts. Replies derive recipients and subject from Mail's verified original message. Incoming HTML is displayed as safe plain text; outgoing attachment upload remains in native Mail for now. The CRM composer sends plain text up to 12,000 characters, with one explicit recipient for a new email.

Keep both existing maintenance paths running: website `npm run db:retention` expires private Inbox drafts after 90 days and internal notes after 24 months, alongside its earlier retention work. Content-free send-key receipts remain to prevent an old request from sending again. Mail retains its existing scheduled outbound recovery; deploy its migration before the Worker code that queries the new authorization tables.

## What still needs live setup

The development environment is signed out of Cloudflare and Render. **No live mailbox grants or new production secrets were installed here.** Local tests use synthetic data and do not prove production mail delivery. A website push can auto-deploy Render; it does **not** deploy the separate Mail Worker.

**Website delivery record for the earlier email increment:** source revision `f8569fe2b9e1d9acbaf20cdf0ef92a92a7e5f376` auto-deployed successfully on October 21 at **6:47 p.m. EDT** (22:47:38 UTC), [Render deployment dep-dbck1b0u01pc73bduusg](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbck1b0u01pc73bduusg), GitHub deployment `7239112044`. Public health/pricing/sign-in and Mail login respond successfully; anonymous Inbox and attachment requests redirect to sign-in. **Live shared email is still pending** the Mail deployment, matching secret and explicit grants below. The included prerequisite commits are `ced01f8` (Mail lock repair) and `74a7c38` (Mail bridge).

Do these steps using your existing authorized accounts. Keep secret values in the provider secret stores, not source, this document or chat.

1. Update your clean checkout from `main` and review the Inbox release commits. Preserve any local changes. Work stays on `main`; do not force-push.

   ```powershell
   git pull --ff-only origin main
   npm ci
   npm --prefix apps/mail ci
   ```

2. Generate one new high-entropy **CRM_MAIL_SECRET** with at least 32 characters. Use the same value for the website and Mail in the same environment. It must differ from the existing website **MAIL_AUTH_SECRET** / Mail **DASHBOARD_AUTH_SECRET**. Preserve those existing login credentials. Staging should have its own secret.

3. Back up the intended Mail D1 database using the existing backup procedure. Apply the ordered D1 migrations through **0037_crm_mail.sql before deploying the new Mail Worker**. The new scheduled recovery/retention code references those tables. Install the new secret and deploy Mail separately:

   ```powershell
   Push-Location apps/mail
   npx wrangler whoami
   # If needed, sign in with your authorized Cloudflare account:
   npx wrangler login
   npx wrangler d1 migrations apply DB --remote --env production
   npx wrangler secret put CRM_MAIL_SECRET --env production
   # Enter the new value at the secure prompt.
   npm run deploy:production
   Pop-Location
   ```

   Production Worker: `tailored-mail-production`, configured in `apps/mail/wrangler.jsonc`. For staging use `--env staging` and `npm run deploy:staging`. Verify the target environment before running a remote migration. Preserve D1/R2/queue bindings, Resend settings, webhook secrets and the existing dashboard identity secret. **Do not enable the disabled public Mail APIs or set API_SEND_ENABLED=true for this feature.**

4. Confirm the existing PostgreSQL backup/recovery procedure, then in the Render **website web service**, add the matching **CRM_MAIL_SECRET** and redeploy the verified `main` revision. The website code already deployed successfully as recorded above; adding the secret and accepting the live connection still require your access. The existing build runs ordered PostgreSQL migrations through **0010_inbox.sql**, retention, then the production build. Verify the migration/build logs and successful deployment. Preserve:

   ```text
   DASHBOARD_AUTH_MODE=mail
   MAIL_AUTH_URL=https://mail.tailoredagents.com/api/dashboard-auth
   MAIL_AUTH_SECRET=<existing identity secret; preserve it>
   BETTER_AUTH_URL=https://www.tailoredagents.com
   NEXT_PUBLIC_SITE_URL=https://www.tailoredagents.com
   DATABASE_URL=<existing private PostgreSQL connection; preserve it>
   BETTER_AUTH_SECRET=<existing session secret; preserve it>
   CRM_MAIL_SECRET=<new matching CRM service secret>
   ```

   Website: [Render service](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0). Add the CRM secret only to the web service; the Search Console cron does not need it. Do not create another database/service or change DNS for this integration. Missing CRM configuration should show an Inbox setup screen while existing website and sign-in workflows continue.

5. Sign in to [Tailored Mail](https://mail.tailoredagents.com) as the existing Mail owner. Open **Manage team** (the `/admin` page, titled **Your team**). Verify that `sales@tailoredagents.com` exists and that Devon, Jeffrey and Austin each have an active, correct Mail account and dashboard approval. In **Website CRM inbox access**, select **Mailbox** = sales@tailoredagents.com and the confirmed **Teammate with dashboard access**; check **Also allow sending as this mailbox**, then click **Save mailbox approval**. Repeat for those three accounts, including Jeffrey if he owns the address. Each saved entry must say **Read and send**. If an account or Sales address is missing, resolve its identity with Jeffrey before creating it. Do not share personal aliases or the whole underlying account. Assignment in the CRM alone does not grant mailbox access.

6. Complete the authenticated acceptance checks below. Record deployed website revision, Mail deployment ID, migration versions, actual approved account emails and results in the release record. Never include secret values or customer message content.

## Live acceptance checklist

Use synthetic messages and explicitly authorized test correspondents; avoid test outreach to real prospects.

- [ ] Public website, `/api/health`, Mail login and dashboard sign-in still work. Anonymous visitors cannot open `/dashboard/inbox` or download its attachments.
- [ ] Devon, Jeffrey and Austin can each open Sales in [Team Inbox](https://www.tailoredagents.com/dashboard/inbox). An unapproved account cannot. Other aliases, Mail drafts/trash and unrelated private messages remain absent.
- [ ] Approved existing Sales conversations and a new authorized inbound test email appear. Historical duplicate alias deliveries without provable Sales recipient metadata are deliberately excluded; do not broaden sharing to recover them.
- [ ] A private saved draft survives refresh and another teammate cannot see it. An internal note is visible to approved readers and never becomes an outgoing email. Per-person Mark read does not mark it read for everyone; new email becomes unread again.
- [ ] Assign a conversation, set its status and link the correct CRM business/inquiry. Assignment does not grant an unapproved teammate access.
- [ ] An explicit new email/reply from Sales reaches an authorized test recipient and appears in Mail Sent. Check actual delivery; service acceptance alone is insufficient. Reply recipient and subject come from the original message.
- [ ] Existing email opt-outs block sends. A dashboard viewer cannot edit shared data or send, even with a Mail send grant. A read-only Mail grant cannot send.
- [ ] An incoming test attachment downloads only while authorized. Message HTML/remote tracking images are not rendered in the CRM.
- [ ] Verify desktop and phone layouts. Revoke one approved test account and confirm its next request loses message and collaboration access, then restore only the intended grant.
- [ ] For an uncertain send, retain the original message and use **Check send status**. Confirm one provider message for the repeated attempt. Do not make a new send key or manually resubmit through another client until Mail's state is resolved.

## Scope after email acceptance

Twilio, SMS, calling, voicemail, recordings, transcripts and the remaining agency development stay with the project owner and Codex. The active queue is in [the roadmap](docs/AGENCY_OS_ROADMAP.md). Jeffrey owns the email, SEO manager and remaining Meta connection checklists in this file.

## Developer references and repeatable local checks

Local release verification: 185 website code/PostgreSQL tests, 10 Inbox browser checks and 33 existing CRM/reporting browser checks pass (one intentional phone skip). Mail independently passes 395 tests and 11 Worker browser checks after a clean locked install. Lint, strict types, both builds, dependency audits and populated PostgreSQL upgrade/dump/restore checks pass. The Mail lockfile's two missing optional entries were repaired without upgrading existing dependencies. These results use synthetic data; live acceptance above is still required.

- [Full communications setup](docs/COMMUNICATIONS_SETUP.md)
- [Agency OS roadmap](docs/AGENCY_OS_ROADMAP.md)
- [Mail service README](apps/mail/README.md)

Website lint, types, tests and production build use the root scripts. Mail checks/build/tests are separate. The new browser suite uses real website Mail-mode login against a synthetic loopback Mail contract on ports **3130/3131** and the guarded disposable database **ta_inbox_browser_test**; it never calls a real email provider. Do not point any test seeder at production.

```powershell
npm run lint
npm run typecheck
# See the roadmap for the isolated TEST_*_DATABASE_URL values.
# Also set TEST_INBOX_DATABASE_URL to the disposable ta_inbox_test database.
npm test
npm run build
npm run mail:check
npm run mail:test
npm run mail:build
npx playwright install chromium
$env:INBOX_TEST_DATABASE_URL='postgresql://ta_test@127.0.0.1:55433/ta_inbox_browser_test'
npm run test:inbox:browser -- --reporter=line
```

Production authentication, permissions and email delivery acceptance remain your live setup responsibility after these local checks.
