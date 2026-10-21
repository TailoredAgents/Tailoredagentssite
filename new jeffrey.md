# New Jeffrey — shared Sales Inbox handoff

Prepared October 21, 2026 for the developer who manages Cloudflare and Render.

## What Jeffrey requested

Connect **sales@tailoredagents.com** to the internal website CRM. **Devon, Jeffrey and Austin** should have read and reply access. Confirm their actual existing Mail login accounts; their names are not permission to guess email addresses or share the inbox with everyone.

This handoff covers the first email increment. Twilio SMS, calling, voicemail, call recordings and transcripts come afterward. No new phone number or paid provider service has been purchased.

## Implemented in this release

- `/dashboard/inbox`: shared email list, search/folders, plain-text history, new email/replies, incoming attachment downloads and phone layouts.
- Conversation owner and open/waiting/done status, explicit business/inquiry links, shared internal notes, private saved drafts and per-person read receipts.
- Narrow Mail service API with explicit address grants. Sharing Sales does not share the address owner's unrelated aliases or private messages.
- Durable send keys and recovery after uncertain confirmation; a status check reuses the same attempt. Saving a draft or note never sends email.
- Mail owner controls to approve or revoke each account's address access. Dashboard roles apply in addition to Mail permissions.
- Settings displays actual shared-email availability and identifies SMS/calling as not yet enabled.

Mail remains the source for email bodies, attachments and delivery state. CRM PostgreSQL stores collaboration metadata, private drafts and content-free send receipts. Replies derive recipients and subject from Mail's verified original message. Incoming HTML is displayed as safe plain text; outgoing attachment upload remains in native Mail for now. The CRM composer sends plain text up to 12,000 characters, with one explicit recipient for a new email.

Keep both existing maintenance paths running: website `npm run db:retention` expires private Inbox drafts after 90 days and internal notes after 24 months, alongside its earlier retention work. Content-free send-key receipts remain to prevent an old request from sending again. Mail retains its existing scheduled outbound recovery; deploy its migration before the Worker code that queries the new authorization tables.

## What still needs live setup

The development environment is signed out of Cloudflare and Render. **No live mailbox grants or new production secrets were installed here.** Local tests use synthetic data and do not prove production mail delivery. A website push can auto-deploy Render; it does **not** deploy the separate Mail Worker.

**Website delivery record:** source revision `f8569fe2b9e1d9acbaf20cdf0ef92a92a7e5f376` auto-deployed successfully on October 21 at **6:47 p.m. EDT** (22:47:38 UTC), [Render deployment dep-dbck1b0u01pc73bduusg](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbck1b0u01pc73bduusg), GitHub deployment `7239112044`. Public health/pricing/sign-in and Mail login respond successfully; anonymous Inbox and attachment requests redirect to sign-in. **Live shared email is still pending** the Mail deployment, matching secret and explicit grants below. The included prerequisite commits are `ced01f8` (Mail lock repair) and `74a7c38` (Mail bridge).

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

## Subsequent work after email acceptance

1. **Twilio SMS:** confirm the business number/account owner, registration/use case, consent/opt-out flow and budget with Jeffrey. Add server-side adapter, verified callbacks, inbound threading, delivery events and restrictions. BatchDialer remains Devon's campaign dialer.
2. **Calling:** browser calls, inbound routing/forwarding, business hours, missed-call responsibility and voicemail.
3. **Recordings and transcripts:** settle disclosure/consent, access and retention before activation; then protected recording playback/deletion, bounded transcription jobs and reviewed summaries/follow-ups.
4. **Inbox refinements:** outgoing attachments, watchers, richer needs-reply workflows and deliberate client sharing. No automatic sharing based only on matching an email address.
5. Continue the existing agency roadmap for proposals/onboarding, recurring services/billing and client SEO/AI assistance.

Do not buy/port a number, submit registration, enable recording or create a paid service solely because it appears in this handoff. Confirm the concrete selection, budget and policy with Jeffrey first.

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
