# Tailored Agents Mail

A separate, private team inbox for `@tailoredagents.com` at https://mail.tailoredagents.com. This application lives beside the existing Next.js website and builds and deploys separately.

**Status, October 24, 2026: deployed at the final address, with the shared Sales bridge connected to the dashboard.** [Jeffrey's handoff](../../new%20jeffrey.md) records current deployments, verified delivery and remaining team checks. The production application uses its own Cloudflare database, private file bucket and queues. Resend's production sending/receiving records and signed incoming-mail webhook were verified during launch. The existing website's DNS records are preserved. Staging remains at https://tailored-mail-staging.jeffrey-78e.workers.dev with separate `@mail-test.tailoredagents.com` accounts and storage. Older dated test/deployment sections below are historical evidence.

Internal sending, receiving, replies and forwarding have passed staging checks. Gmail and Hotmail text replies also passed, including Reply All and conversation matching. **The incoming attachment failure was fixed on October 15:** previously stalled photos and files are saved, production image downloads match the original bytes, embedded images display, forwarding preserves files, and complete original MIME is retained in private R2. Inbox versus Spam/Junk placement still needs confirmation. Do not copy local or staging accounts into production.

Based on Quickinbox commit `2af17e2fcd824aff0f5e8c91194f226dc2090d87`. Its MIT license is preserved in [LICENSE.md](LICENSE.md). [UPSTREAM.md](UPSTREAM.md) records the source. `UPSTREAM_README.md` is historical and does not describe this deployment.

**Trial scope.** The owner requested deployment to the final address before completing attachment investigation. The attachment issue has since been fixed and verified on the live application. The remaining launch checklist items still apply; passing the attachment checks alone does not establish every mail-client behavior or mailbox placement.

## Assistant connection (local repair, awaiting deployment approval)

The existing authenticated MCP integration has been repaired and expanded locally.
Production has **not** been enabled by this change. See [MCP setup, permissions,
verification and deployment](MCP_SETUP.md). That runbook supersedes historical
statements below that MCP is entirely disabled; ordinary private APIs remain closed.

## For the team

- Sign in with your email address and password. A temporary password must be changed before opening your inbox.
- Use Compose to write messages, add CC/BCC and files, and choose one of your assigned sending addresses.
- Drafts save automatically. Wait for **Saved** before leaving. Attachments are saved too, and unchanged files are reused during later saves. Unfinished replies and forwards also appear in Drafts.
- Up to 20 MB of outgoing attachments in total, with up to 20 newly attached files. Forwarded conversation files also count toward the same total size limit.
- Inbox, Sent, Drafts, Archive, Starred, Junk, Trash, labels, bulk actions, and keyboard shortcuts are available. Search supports `from:`, `to:`, `subject:`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`, and `has:attachment` in the current folder.
- External images start off. Only allow them if you want the sender’s image server contacted. Files that can contain active content download rather than opening as an active page on this site.
- Settings contains your signature, light/dark appearance, blocked senders, password change and shortcut help.
- Sending failures leave the draft available. “Waiting to send” can also mean the service is checking an uncertain response; do not create a second copy in a new draft.

### Add a signature banner

Open **Settings → General → Your signature**. Enter your signature text, select **Upload banner**, choose a PNG or JPG, and select **Save signature**. Each teammate manages their own signature. A wide image around 1,200 × 300 pixels works well; images must be no larger than 1 MB. The preview fits the image to the email width, up to 600 pixels. You can add a website link and an image description, replace the banner, or remove it while keeping your text.

The saved signature is added when sending new emails, replies, and forwards. It is embedded using an inline attachment rather than a public image URL. The image counts toward the 20 MB outgoing attachment limit. A plain-text alternative retains the signature text, image description and link. Individual email readers may choose how to display images; [Resend documents its inline-image behavior](https://resend.com/docs/dashboard/emails/embed-inline-images).

Original uploads are private and can only be previewed by the account that owns them. Every outgoing message saves a separate copy before contacting Resend, so later signature changes do not alter sent messages or retry payloads. Replaced/removed originals are retained for 32 days; migration `0035_signature_banners.sql` adds the metadata and retention triggers. Apply it before deploying this version. Restoration uses the existing D1/R2 recovery procedure; the cleanup job preserves files referenced by restored signature records.

Validated on October 15, 2026: 375 automated tests, 9 browser tests, type checks and the build passed. A real staging send delivered a PNG banner whose downloaded bytes matched the upload, and the image rendered inside the inbox. A reply delivered the second user's JPG banner; a forward preserved both images with separate content IDs. Repeating the original send reused its result. Test account signatures were restored afterward. The private verification record is `~/.config/tailored-mail/signature-banner-verification.json` on the setup machine. Gmail/Outlook rendering of this new signature feature has not been separately checked.

## For the owner

The original production owner is **Jeffrey, `jeffrey@tailoredagents.com`**, who retains access. **Austin, `austin@tailoredagents.com`, also has Mail owner-management permission** following the authorized October 24 update. Devon remains a regular teammate with dashboard approval. Initial protected setup is closed and the one-time `SETUP_SECRET` has been removed. The [communications guide](../../docs/COMMUNICATIONS_SETUP.md#mail-management-and-recovery) records management and recovery boundaries.

Open your account menu → **Manage team** to create accounts, add addresses, disable access, or reset passwords. Give temporary passwords to teammates privately. Passwords must be 12–128 characters; a memorable phrase works well.

**Unassigned mail** holds mail to unknown or disabled addresses. Review it and assign it to an active teammate. This folder is accessible only to the owner. Incoming To/CC/BCC recipients each receive their own copy; one person’s read/archive/delete choices do not change another person’s copy. BCC is not exposed in recipient copies.

Resend can provide a separate delivery record for each envelope recipient. The app routes those actual deliveries, uses the original visible headers for To/CC display, and combines matching deliveries to one person's aliases into one inbox copy. The provider's actual Message-ID is saved for reply matching, because Resend replaces the locally generated ID.

**Mail status** shows stalled work, missing downloads, unconfirmed outgoing messages, storage access, and the last successful check for missed incoming messages. Retry failed incoming jobs there after fixing the connection. An uncertain send is never automatically resent after its 23-hour safety window. Check its content, recipients and timing in Resend before taking any manual action; do not reset or delete its send identifier to force a retry.

## Using your mail password for the website dashboard

The website supports the same primary email address and password you use here. Open https://www.tailoredagents.com/sign-in. Complete a temporary-password change in Mail first. You still sign in separately on each site, but only need to remember one password.

The owner already has dashboard approval. To approve another person, open **Manage team** and choose **Allow dashboard access** next to their account. **Remove dashboard access** signs them out of the dashboard while leaving their inbox available. Approval gives a new teammate member access; existing dashboard roles are preserved. The website continues to deny suspended/removed workspace memberships. Password changes, resets and account disabling revoke both kinds of session. Signing out of just the dashboard does not sign out of the inbox.

The private `/api/dashboard-auth` endpoint accepts only authenticated server requests with a random secret of at least 32 characters. Apply migration `0036_dashboard_login.sql`, install `DASHBOARD_AUTH_SECRET` in the Worker, and deploy before enabling `DASHBOARD_AUTH_MODE=mail` on the website. Its `MAIL_AUTH_SECRET` must match; its `MAIL_AUTH_URL` must be the production endpoint. Staging has its own secret and database. Never put this secret in public environment variables or browser code. The website stores a separate encrypted grant, not a copy of the password, and that grant cannot authenticate an inbox request.

Keep both apps' additive migrations during rollback. Deploying an older Mail build temporarily disables shared dashboard sign-in; restore a compatible build or deliberately enable the website's legacy password mode with verified separate credentials. A restore can revive sessions: revoke restored Mail and website sessions before allowing access. See [the website runbook](../../docs/SEARCH_CONSOLE_READINESS.md#october-21-shared-mail-sign-in) for deployment, testing and rollback details.

## Local development

### Website CRM shared inbox

Migration `0037_crm_mail.sql` adds explicit address sharing for the CRM. In
**Manage team → Website CRM inbox access**, the owner chooses one email
address and a teammate with dashboard approval, then grants read access or
read/send access. No accounts receive implicit access, including the owner.
Share `sales@tailoredagents.com` with the selected sales team; sharing that
address does not share the owner's other aliases or private inbox messages.
Revoking an approval applies to subsequent reads, downloads and sends
immediately. Pending CRM sends cannot be replayed by recovery after revocation.

The private `POST /api/crm-mail` endpoint needs a separate random
`CRM_MAIL_SECRET` of at least 32 characters, different from
`DASHBOARD_AUTH_SECRET`. The website stores its matching value only in its
server environment. The endpoint also requires the signed-in user's live
dashboard grant and checks the owner-approved address permission on every
operation. Apply the migration and deploy Mail before enabling the website's
matching CRM connection. Installing the secret alone never shares a mailbox.

Messages are selected by proven envelope address or exact sending identity,
not by a search of the visible To header. Future alias deliveries record all
proven routes, including deduplicated BCC deliveries. Historical deliveries
whose alias cannot be proven are excluded conservatively; their complete
mailbox remains available in Mail. Messages and attachments from a different
alias inside the same Mail conversation are excluded from CRM previews,
search, reading, replies and downloads. Manual unassigned-mail reassignment
does not prove a delivery to the shared address.

The first increment supports Inbox/Sent/Archive, search, paginated threads,
safe plain-text reading, private attachment downloads and explicit new email
or reply. Opening a thread does not mutate Mail's read flag. New CRM messages
accept one recipient, text up to 12,000 characters and a UUID idempotency key.
Replies require the last reviewed scoped message ID; the server derives the
recipient, subject and reference headers. Outgoing files, CC/BCC, rich text
and mailbox operations remain available in Mail. The existing durable outbox,
signatures, provider idempotency and uncertain-delivery recovery are reused;
the public API/MCP sending switch stays disabled.

CRM approval/send audit records contain actor/address/message IDs rather than
message contents or recipient lists, and expire after 90 days.

The new bridge and approval tests use isolated SQLite, synthetic accounts and
a mock provider; they never send real mail or enable production approvals.

The unified CRM adds two private read actions to this same endpoint:
`conversationIndex` discovers all eligible address-scoped threads, including
archived threads, through stable thread-ID keyset pages; `threadHistory` loads
the newest message page and continues backward through history. Both default
to 50 items and allow up to 100. They recheck the current address approval and
keep every message/attachment within the same proven delivery boundary.
Discovery caps each response at 25 threads to keep participant checks inside
the D1 Free invocation query budget; its cursor continues the same full sweep.

Discovery returns only thread/message IDs, UTC activity timestamps, normalized
external participant addresses and an attachment flag. It never returns
subjects, previews, bodies, BCC or storage keys and never hydrates R2 content.
The outbound-response timestamp includes only sent, delivered or delayed
messages; queued/uncertain sends and failed, bounced or complained deliveries
do not clear reply work.
The explicit `complete` flag distinguishes a finished sweep from a partial
one. Unusually large or ambiguous participant sets require review instead of
being silently truncated into a complete index. History pages return safe
plain-text messages in chronological order with `hasOlder` and a `before`
cursor. Pages also enforce a response-byte budget, so a page can contain fewer
items than its requested maximum without skipping the next older message.

Cursors are opaque, signed and address-bound; history cursors additionally
bind the thread and timestamp/message-ID boundary. Rotating `CRM_MAIL_SECRET`
invalidates outstanding cursors: restart discovery from its first page rather
than treating a failed continuation as complete. Changes behind the discovery
cursor are picked up by the next full sweep. The website reconciles source
removal after a complete sweep and rechecks grants independently. Deploy this
Mail version before enabling unified discovery; an older Mail build returns
an unavailable capability, never a valid empty-complete inbox. No additional
Mail migration is required beyond `0037_crm_mail.sql`.

Use Node 24 LTS (or a supported Node version at least 22.12). This machine has Node 24 at `/usr/local/bin/node`; its default Homebrew Node 20 is too old. From this directory:

```sh
export PATH="/usr/local/bin:$PATH"
npm ci
npm run db:migrate:local
npm run test:seed
npm run preview
```

Open `http://localhost:8787`. Disposable accounts are `local-owner@tailoredagents.com` and `local-teammate@tailoredagents.com`; their local-only password is `Local browser test password`. The seed command edits only the local Wrangler database and refuses ambiguous database paths. It never creates live users or sends email. Do not deploy a database populated from this seed.

For hot reloading use `npm run dev` (usually port 5173). Local D1/R2 data is stored under `.wrangler/state`; staging and production use different remote resources. `.dev.vars` is ignored by Git. Copy `.dev.vars.example` only when connecting a separate test Resend domain. Do not paste credentials into chat, source code, or documentation.

Checks:

```sh
npm test
npm run check
npm run build
npx playwright install chromium
npm run test:browser
npm audit
```

Browser checks expect local migrations and a current build first. `npm run test:browser` seeds disposable accounts and resets their local login limits automatically. Playwright starts the local preview if it is not running. The backend tests use SQLite with every migration and isolated test file storage. They do not call live providers. Browser tests run the built app in Cloudflare’s local Workers runtime.

From the repository root, `npm run mail:check`, `npm run mail:test` and `npm run mail:build` run the mail checks. Website TypeScript, Tailwind, lint and Vitest scanning exclude the mail application; run the root checks separately.

## Connect staging before production

The staging resources below already exist in the intended Cloudflare account. The owner confirmed the Workers Paid upgrade on October 14, 2026; the connected API cannot independently read billing. Resend's usage API reports an active paid subscription with a 50,000-email monthly allowance. No Resend billing change was made. The staging R2 bucket has public access disabled, migrations 0001–0036 are applied, and the signed Resend webhook is connected. All five Resend DNS records for the test domain are verified. Protected owner setup and the second test account have been exercised remotely, and the staging `SETUP_SECRET` was removed. The following steps are also the reference procedure for a new environment; do not recreate existing resources.

1. Sign in with `npx wrangler login`. Verify the account with `npx wrangler whoami`. Confirm the actual Workers and Resend subscriptions in their dashboards before any billing change. The requested 30-day D1 recovery requires the paid Workers plan; free-plan recovery is shorter.
2. Use the `staging` resources in `wrangler.jsonc`. Create its D1 database, private R2 bucket, incoming queue, and dead-letter queue in the intended account. For example:

   ```sh
   npx wrangler d1 create tailored-mail-staging
   npx wrangler r2 bucket create tailored-mail-staging-files
   npx wrangler queues create tailored-mail-staging-jobs
   npx wrangler queues create tailored-mail-staging-failed
   ```

   Put the returned D1 `database_id` in `env.staging.d1_databases[0]`. Production has its own database/bucket/queues, with `production` in the names. Never point staging at production storage. R2 must remain private, without an r2.dev public URL or public custom domain.
3. Add `mail-test.tailoredagents.com` to Resend for staging. Enable both sending and receiving. Add **the exact records Resend provides for that domain** in Cloudflare, including verification and receiving MX records. Do not guess MX regions, overwrite unrelated website records, or replace existing live mail records during testing. Verify DKIM/SPF and the domain’s DMARC policy with the actual Resend values. Cloudflare Email Routing must not compete with Resend’s MX records on the same receiving domain.
4. Configure secrets interactively:

   ```sh
   npx wrangler secret put RESEND_API_KEY --env staging
   npx wrangler secret put RESEND_WEBHOOK_SECRET --env staging
   npx wrangler secret put SETUP_SECRET --env staging
   ```

   Use a Resend key with the permissions required for sending, domain lookup and receiving. Generate a random setup secret of at least 32 characters and keep it in a password manager. Obtain the webhook signing secret from Resend. Never use a sending-only key for receiving.
5. Apply migrations and deploy staging:

   ```sh
   npx wrangler d1 migrations apply DB --remote --env staging
   npm run deploy:staging
   ```

   Set `env.staging.vars.APP_URL` to the staging URL printed by Wrangler (or configure the `mail-staging.tailoredagents.com` custom domain). Register that URL plus `/api/webhooks/resend` in Resend. Subscribe to incoming mail and sent/delivered/delayed/bounced/failed/complained/suppressed events. Webhooks must be signed. No login cookie is required for this one endpoint.
6. Visit staging `/setup`, enter the one-time setup secret and create the owner. Setup closes after the first account is created. Remove `SETUP_SECRET` with `wrangler secret delete SETUP_SECRET --env staging` afterward. Create the second test account through Manage team.
7. For the owner's requested trial at the final address, repeat resource creation and secret setup for `production`, verify `tailoredagents.com` in Resend, and connect the receiving records. `npm run deploy:production` uses the `mail.tailoredagents.com` custom domain. Use a fresh production owner account; never copy test accounts. Finish the launch checklist before treating the trial as ready for normal team email. GitHub has no mail deployment workflow configured; committing or pushing the repository does not run this separate Cloudflare deployment.

References: [Resend receiving](https://resend.com/docs/dashboard/receiving/introduction), [signed webhooks](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests), [Resend pricing](https://resend.com/pricing), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Current production deployment

- Address: https://mail.tailoredagents.com
- Worker: `tailored-mail-production`; scheduled maintenance every five minutes.
- D1: `tailored-mail-production`, with migrations 0001–0036 applied.
- R2: `tailored-mail-production-files`, with public URLs and public custom domains disabled.
- Queues: `tailored-mail-production-jobs` and `tailored-mail-production-failed`.
- Resend: `tailoredagents.com`, sending and receiving enabled; all provider DNS records verified.
- Webhook: `https://mail.tailoredagents.com/api/webhooks/resend`.
- DMARC starts at `v=DMARC1; p=none;` for delivery testing. It does not reject spoofed messages or request aggregate reports. Confirm authentication across legitimate sending sources before tightening the policy, following [Resend's DMARC guidance](https://resend.com/docs/dashboard/domains/dmarc).

Secret values and temporary setup evidence are kept outside Git in the owner's private configuration directory. Deployments are currently manual: pushing to GitHub does not redeploy this app. From `apps/mail`, use `npm run deploy:production` for a reviewed update. Staging uses `npm run deploy:staging`.

## Owner password recovery

An owner with terminal access and Cloudflare credentials can reset their own password without knowing the old one:

```sh
npm run recover-owner -- --email jeffrey@tailoredagents.com --env production
```

The password prompt is hidden. The command resets only an existing owner, ends sessions and requires a password change at next login. It does not make a regular user an owner. Use `--env staging` for staging or `--local` for disposable local testing. For automation, `--password-file /private/path` reads a private file instead of prompting; remove that file afterward. Never put the password in the command itself. The temporary SQL file contains only the password hash and is removed when the command ends.

## Storage and recovery

D1 holds accounts, recipient copies, folder state, labels, search text, file references, delivery receipts and durable jobs. R2 holds full message content, original inbound MIME when supplied by Resend, original metadata, attachments, immutable draft versions and outgoing requests. Provider retention does not control the lifetime of successfully imported mail.

Trash is recoverable for 30 days. When a message or a draft version is deleted, its files are marked for removal **32 days later**, and the cleanup checks that no remaining message or draft uses them. Shared incoming files are kept while any recipient copy or unassigned item still uses the source. Do not add an R2 lifecycle rule that deletes these objects earlier. The 32-day delay supports D1 Time Travel; it is not a separate off-site backup.

Every five minutes the scheduled worker retries stored jobs, checks for missed incoming emails, reconciles uncertain outgoing sends within the safe window and removes expired trash/storage. Queues process one message per batch. Repeated notifications reuse one durable incoming job. Each recipient has a stable delivery ID, including a deletion receipt, so retries or separate alias deliveries cannot recreate deliberately deleted copies. Each attachment has its own download state; a failed file does not prevent the other files from being saved. Retries reuse saved files and obtain fresh provider URLs for missing files.

Before a restore, take a current export, record the current Time Travel bookmark, and pause sending, queue consumption and scheduled cleanup. Retain both the database and file bucket; do not create an empty replacement bucket. Rehearse on staging first:

```sh
npx wrangler d1 export DB --remote --env staging --output /private/path/mail-before-restore.sql
npx wrangler d1 time-travel info DB --env staging
npx wrangler d1 time-travel restore DB --env staging --timestamp REPLACE_WITH_RFC3339_TIME
```

Use the timestamp/bookmark for the exact tested restore point, within the recovery window. The restore changes the whole database, including users, passwords and sessions. Keep the original deployment version available when restoring across schema changes. After restoring, revoke old sessions (`DELETE FROM sessions`) using the D1 console before admitting users; a restore can otherwise revive earlier credentials.

Verify these steps before resuming normal operation:

- A saved message’s full body and original attachment download match copies made before deletion.
- Both test accounts see only their own restored messages and drafts.
- An edited or deleted draft restores with its files, using the old content reference.
- Jobs and outgoing send attempts are reviewed before queues/cron resume. Resend’s idempotency protection lasts 24 hours; this app stops automatic uncertain retries at 23 hours and also uses the original attempt creation time if a restored row predates the first provider call.
- Post-restore incoming reconciliation completes. Preserve the pre-restore export to recover records created after the chosen restore point; Time Travel returns the database to that point, not to the present.

For a longer retention period or recovery from a lost bucket/account, keep encrypted D1 exports and a separate copy of the R2 objects. Set that backup policy before relying on the service for irreplaceable business mail. [Cloudflare Time Travel documentation](https://developers.cloudflare.com/d1/reference/time-travel/).

### Recorded validation — October 14–15, 2026

- 363 automated mail checks passed; Svelte/TypeScript reported no errors or warnings. Eight browser checks passed in the local Workers runtime, including account isolation, saved draft files, malicious HTML, temporary passwords, account resets/disabling, keyboard/phone layouts, and the 20 MB attachment limit.
- The existing website passed lint, TypeScript, its three tests and the production build. The mail dependency audit reported no known vulnerabilities.
- A real staging D1 Time Travel rehearsal completed at `2026-10-15T01:10:42Z`, before accounts or scheduled processing were enabled. It saved a complete message body and attachment to private R2, deleted their database references, restored the earlier D1 bookmark, and downloaded both files through the restored references. Their SHA-256 hashes matched the original bytes. Disposable database rows were then removed and the files marked for 32-day retention. The durable private validation record, including the restore bookmark, is `~/.config/tailored-mail/validation.json` on the setup machine.
- Remote staging checks passed protected first-owner setup, setup closure, sign-in, temporary-password changes, reset/session revocation, disabling/re-enabling accounts and the actual owner recovery command. Remote SQL-file imports do not return SELECT rows; the recovery command now verifies the owner with a separate query before resetting the account.
- Hosted browser checks passed compose/autosave/file reopening and phone layout. Remote API checks verified long draft preservation, private search/message/file access, cross-site request rejection and a full 20 MB saved draft. A real 20 MB outgoing email was delivered; its stored Sent attachment downloaded byte-for-byte and was inaccessible to the other account.
- Real internal delivery passed To/CC/BCC, one incoming copy per teammate even with a second alias, independent archive state, complete long-message preservation, reply matching and forwarding. A repeated send request reused the existing message. Valid repeated webhook notifications were accepted and altered/unsigned notifications rejected. Scheduled reconciliation has run successfully on Cloudflare.
- An unknown-address message appeared in the owner-only Unassigned mail view. The owner reviewed it, assigned it to the test teammate, and verified that it arrived and disappeared from the unassigned list.
- Test emails with a small attachment were sent to the owner's supplied Gmail and Hotmail addresses, with the second test teammate in CC. Both external accounts replied. Each initial reply reached both teammates once, matched the original conversation, preserved its text and rejected direct access by the other account. Later replies from both accounts included `tailored-mail-test.txt` (159 bytes), confirmed by Resend's attachment API. Downloading those files through the app returned 503; fetching fresh provider URLs also failed with a TLS connection error. The complete file round trip has therefore not passed. Inbox versus Spam/Junk placement also needs user confirmation. Private send/reply identifiers and progress are recorded in `~/.config/tailored-mail/external-delivery-tests.json`.
- These checks do not yet establish complete Gmail/Outlook compatibility or successful incoming attachment/MIME downloads. The owner authorized connecting the production domain for a controlled trial; the remaining checks still apply before normal team use.
- A user-sent photo test also reached the test inbox, including metadata for a 2.3 MB JPEG. The actual image download returned 503, and the browser showed a pending-attachment warning instead of a viewable photo. A fresh provider download URL failed its TLS connection as well. Private evidence is in `~/.config/tailored-mail/photo-tests.json` and `photo-test-browser-validation.json`. Receiving a file's name and size is not a successful image-viewing test.

### Production validation — October 15, 2026

- The owner account was created in the fresh production database. Real sign-in, owner-only account management, setup closure, rejection of unsigned incoming notifications and rejection of cross-site changes passed. The setup secret was removed from Cloudflare and local setup storage afterward.
- Real browser checks at `mail.tailoredagents.com` passed sign-in, compose, automatic draft saving, closing/reopening a draft with its original text and attachment, phone width and the Mail status page. No browser script errors occurred. The disposable browser-test draft was deleted afterward.
- Two test emails with a small PNG were sent to the owner's supplied Gmail and Hotmail addresses, with the TA owner address in CC. Resend delivery events marked both sends delivered. Repeating each send request reused its original identifier. Each copied message arrived once in the TA inbox and joined the original conversation. This verifies the TA recipient copies; external replies to these production tests and Inbox versus Spam/Junk placement still need confirmation.
- Before the attachment fix below, both Sent image attachments downloaded successfully and matched the original 15,178-byte file by SHA-256, while both incoming copies returned 503. Those incoming copies have since been recovered and verified.
- Private production test details are recorded in `~/.config/tailored-mail/production-validation.json` on the setup machine. No credentials, session cookies, message bodies or private test screenshots are committed.

### Resolved attachment issue — October 15, 2026

The deployed Workers runtime rejected the attachment downloader's `redirect: 'error'` option before making the network request. The catch block reported that as a connection failure, which obscured the cause. Earlier direct downloads on the setup Mac had also produced TLS errors; fresh Mac downloads later succeeded. A separate Cloudflare preview reproduced the unsupported-option error and demonstrated that the same signed URL succeeded with `redirect: 'manual'`.

The downloader now uses manual redirect handling and rejects non-success responses, including redirects, without following them. Rejected response bodies are cancelled. This applies to both incoming attachments and complete original MIME. HTTPS checks remain enabled; URLs are not rewritten, and the Resend API key is never sent to the file host.

A regression test executes the actual Resend client in workerd with an isolated file service. It failed before the fix and now passes complete-byte downloads, refusal to follow redirects, and a retry with a fresh signed URL after an expired link. Miniflare is declared as a test dependency at the same version already used by Wrangler. All **367 mail tests** pass, Svelte reports zero errors/warnings, and the app builds successfully.

The fix was deployed to staging before production. Staging recovered the original 2,299,821-byte photo through the authenticated TA attachment endpoint, matched it byte-for-byte against Resend, and continued to return 404 to the other user. Stalled production incoming jobs were then retried through the owner recovery control.

Production verification passed:

- All three previously pending incoming files downloaded and matched fresh provider copies, including the owner's 4,826,516-byte photo.
- A new message delivered a regular PNG, an embedded PNG and a text file. Each download matched its source, and anonymous requests were rejected.
- The browser displayed the embedded image from private app storage with external images still blocked, opened a regular image attachment, and displayed the owner's 4284 × 5712 photo within the inbox and in its image viewer. There were no browser script errors.
- Forwarding the test message to the owner's TA address delivered one incoming copy with all three original files intact.
- The full original email was downloaded from private R2; its 6,613,257-byte MIME copy contained the same photo bytes as the inbox download.

Evidence is kept privately in `~/.config/tailored-mail/production-attachment-fix-verification.json`, `staging-attachment-recovery.json`, `attachment-forward-recovery.json` and `production-raw-mail-verification.json`. Historical failed tests above describe the state before this fix. New provider interruptions can still put jobs into retry or attention states; use Mail status to inspect and retry those jobs after restoring service.

## Launch checklist — do not skip the live tests

- [x] Verify intended Cloudflare account, owner-confirmed Workers Paid upgrade, Resend paid usage, private R2 and separate staging/production resources. Billing changes were not made by this app.
- [x] Verify Resend sender/receiving records, webhook signature and incoming endpoint in staging and production.
- [ ] Send and receive with Gmail, Outlook and two Tailored Agents users: To, CC, BCC, reply, reply-all, forwarding and attachments. Check real reply threading, especially the provider’s treatment of Message-ID.
- [x] Deliver one message to two teammates exactly once; verify BCC privacy and independent read/archive/delete state (live archive/read and local delete tests).
- [ ] Close/reopen new-message, reply and forward drafts with files; check Saved and the 20 MB total warning.
- [ ] Exercise failed sends, lost responses, repeated webhooks, expired file URLs, missing storage and the 23-hour stop rule.
- [x] Verify owner setup closure, temporary passwords, resets, disabled accounts and the owner recovery command.
- [x] Check keyboard, phone, dark-mode contrast and safe viewing of hostile email and attachments.
- [x] Perform the staging Time Travel restoration above and verify bodies/files, then record the evidence and restore bookmark privately.
- [x] Run all local mail and website checks before the production deployment.

The private CRM bridge is enabled for explicitly shared addresses. MFA, calendars, Mail AI, external-agent access, public account registration and native email-client connections remain outside this release. Logs use generic operation names and IDs, not message bodies or passwords.


## October 21 shared sign-in validation

Mail migration 0036 is applied in staging and production. The production Worker version is `7a543289-1bbb-47b5-8684-5d94e8278256`; staging is `05dd3664-ec9b-4af9-a501-a4e987ea5369`. The production owner is approved, and other teammates require the owner's action in Manage team. A temporary staging account successfully authenticated to the website; it and its sessions were removed afterward. Production Mail remains reachable, and the private identity endpoint rejects missing service credentials and nonexistent grants.

All **382 backend tests**, **10 browser tests**, type/Svelte checks and the production build pass. Browser checks include owner-only dashboard approval, persisted changes on reload, phone layout, and continued inbox access after dashboard approval is removed. Vite was updated to 8.1.6 to address the upstream [development-tool advisories](https://github.com/advisories/GHSA-r825-w8mm-5pxw); the complete dependency audit now reports zero known vulnerabilities. No mail delivery, DNS, billing or queue settings were changed.

## October 24 shared Sales acceptance and dependency review

The shared Sales delivery result, deployed versions, exact approved accounts and remaining live checks are maintained in [Jeffrey's current handoff](../../new%20jeffrey.md#shared-sales-inbox--remaining-work) and its [release evidence](../../new%20jeffrey.md#release-evidence). This replaces repeated acceptance checklists here; the broader native-Mail launch checklist above remains separate.

Updated postal-mime, Zod, Undici and compatible transitive dependencies. All 406 Mail tests, 12 browser checks, Svelte/type checks and the production build pass. The audit has no moderate/high/critical findings; three low dependency entries remain for two SvelteKit 2 advisories. The application uses neither `use:enhance` nor prerendered pages with untrusted cache headers, the prerequisites described in the [enhanced-form advisory](https://github.com/sveltejs/kit/security/advisories/GHSA-pfhg-q3qv-9q6r) and [prerender advisory](https://github.com/sveltejs/kit/security/advisories/GHSA-27mw-82g8-phjj). A SvelteKit 3/adapters migration remains a separate compatibility upgrade; do not use an unreviewed forced major upgrade. These current audit results supersede the October 21 zero-findings snapshot.
