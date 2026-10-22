# New Jeffrey — shared Sales Inbox handoff

Prepared October 21, 2026 for Jeffrey: email activation only.

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

This handoff covers email activation. The project owner handles Twilio and the remaining development with Codex. Jeffrey's scope is the email-specific Cloudflare/Render configuration, Mail deployment, Sales address approvals and email acceptance below.

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

Twilio account/number setup, SMS, calling, voicemail, recordings, transcripts and the remaining agency development stay with the project owner and Codex. The active queue is in [the roadmap](docs/AGENCY_OS_ROADMAP.md). Jeffrey's assignment is the email activation and acceptance checklist above.

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
