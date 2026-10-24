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

## October 24 release: Sales inbox and affordable SEO

Jeffrey approved finishing the existing features first, using **at most $10/month for SEO AI/data**, deferring city-ranking services and article publishing. This replaces the earlier $40/Astra/DataForSEO/separate-worker setup. Follow [SEO_MANAGER_SETUP.md](docs/SEO_MANAGER_SETUP.md) for current instructions.

### Applied in production

- Mail D1 was exported and its recovery bookmark recorded privately before changes.
- Austin now has Mail owner management; Jeffrey retains ownership.
- Devon's existing active account now has dashboard approval and remains a regular teammate.
- Mail migration 0037 is applied. Sales was created under Jeffrey's account, with explicit read-and-send grants for Jeffrey, Austin and Devon only.
- Matching CRM bridge secrets are installed separately from login secrets. Mail was deployed separately; the website environment update is live.
- Jeffrey confirmed that **Sales appears** in the live Team Inbox on October 24.
- The Sales message to Gmail was delivered. The Gmail reply and 9,186-byte logo attachment were saved in Mail; the file was downloaded from private R2 and visually verified on October 24 at 21:17 UTC.
- Search Console remains active for `sc-domain:tailoredagents.com`; coverage reached October 21 at the baseline check.
- A private PostgreSQL export was saved. Temporary backup access was removed and the original external access restriction restored.
- Mail security update deployed as Worker `df7992d5-4d35-4d59-bacb-9155610bec63` (source `d68637f`). No domain or email-provider settings changed.
- SEO source `3c044b0` went live on the website at 21:20:34 UTC (`dep-dbei1ess728c73ckuku0`), with migration 0018 applied. The existing cron deployed the same source (`dep-dbei1f4s728c73ckulh0`); its matching SEO secret/URL are configured, with no additional service.
- A genuine scheduled check at 21:20:37 UTC attempted **both Reporting and SEO**, with zero errors. The subsequent manual invocation completed all **14 public pages** in **31.31 seconds**; the saved scan finished at 21:21:31 UTC. Free daily monitoring is enabled. Paid AI and the model pilot remain off; production has **zero AI cost receipts and $0 charged by this integration**.
- During the first free scan, Render's sampled web-service CPU stayed below 0.04 CPU, memory below 114 MB and reported 95th-percentile HTTP latency about 0.213 seconds. This short sample supports free monitoring on the current service; it does not establish paid-model runtime or a monthly hosting bill. Reusing the cron avoids another minimum service charge; extra active runtime remains billable.
- Public health, contact, sign-in and Mail pages return successfully. Anonymous SEO access redirects to sign-in. Database external access was restored to its original blocked setting after verification.

### Release verification

The final full website suite passed **446 tests**. The subsequent worker-deadline guard passed nine targeted scheduler/command checks. Mail passed 406 tests and 12 browser checks. Team Inbox passed 10 browser checks; SEO passed four desktop/phone checks in each of light and dark appearances, including accessible controls, publication verification and rollback against synthetic providers. Lint, strict types and production builds passed. The populated PostgreSQL upgrade/restore test preserves prior reports, credentials, collaboration, Meta records, SEO publications and uncertain charges while applying the $10 migration.

Website dependency audit: zero findings. Mail: zero moderate/high/critical findings; three low dependency entries affect SvelteKit capabilities this app does not use. See [Mail's current dependency assessment](apps/mail/README.md#october-24-shared-sales-acceptance-and-dependency-review). These automated checks do not replace the pending real model and teammate acceptance below.

### Still requires live acceptance

- [ ] Austin and Devon confirm their own Mail/dashboard access.
- [x] Gmail sending, reply receipt and stored attachment verified. Jeffrey confirmed Sales appears in Team Inbox.
- [ ] Verify the attachment opens from Team Inbox and complete the separate Hotmail delivery check.
- [ ] Dedicated OpenAI SEO project/key and provider spending control are installed.
- [ ] Jeffrey reviews the business facts in SEO settings.
- [ ] Sol/Astra pilot and controlled safety cases pass; actual costs are reconciled within the $5 pilot / $10 monthly limits.
- [ ] Paid automation is enabled only after review; natural daily and weekly runs are observed.
- [ ] Observe the next day's complete free scan; the first completed scan above was manually triggered, and the first scheduled check was idle.
- [ ] First justified reviewed metadata change is published and verified, or a valid no-change pilot is documented with publishing still unverified.
- [ ] Outcome review is completed after 28 finalized Google dates.

No paid AI requests, city-ranking purchases or public wording changes have been performed during this activation work so far. New articles, broader repairs, Google Business Profile work and client-site SEO remain later work. Meta setup described above remains a separate assignment.

## Priority: Austin needs Mail team-management access

Requested October 22, 2026. Austin is signed into Mail as **austin@tailoredagents.com** and cannot see **Manage team**. He wants the same Mail management permission as Jeffrey so he can approve **devon@tailoredagents.com** for the website dashboard today. **Completed October 24: Austin is an additional owner, Jeffrey remains an owner, and Devon has regular dashboard approval. The guarded procedure below is retained for recovery reference.** Austin does not have the Cloudflare account, and this workstation is signed out.

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

**October 24 update:** Cloudflare and Render access were verified; migration 0037, Sales grants and the matching CRM secret have now been installed. The checklist below remains the repeatable setup procedure. Local tests use synthetic data and do not prove production mail delivery. A website push can auto-deploy Render; it does **not** deploy the separate Mail Worker.

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
