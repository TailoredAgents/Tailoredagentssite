# Communications setup and activation

Release 2's first email increment is implemented in source. Production deployment, mailbox approval and authorized delivery acceptance are separate steps below; this document does not record them as completed. BatchDialer remains the current campaign dialer. Twilio SMS, calling, voicemail, recordings and transcripts remain later increments.

## First email increment

`/dashboard/inbox` reads approved Tailored Mail addresses through a separate server-only API. It includes folder/search pagination, plain-text compose/reply, conversation assignment and open/waiting/done states, explicit business/lead links, internal notes, private drafts, per-person read receipts and protected incoming attachment downloads. Replies use Mail's verified original message for recipients and subject. Outgoing attachments, watchers and automatic client sharing are not part of this increment.

Mail remains the system of record for message bodies, attachments and provider delivery state. PostgreSQL stores CRM collaboration metadata, private drafts and content-free idempotency receipts. Saving a note or draft never sends email. Notes expire after 24 months; private drafts expire after 90 days through the existing retention command. Compact send receipts retain their keys so an old request cannot send another copy. A provider-accepted or queued message is not proof of delivery or reading.

The approved shared address is **sales@tailoredagents.com**, with read and reply access for **Devon, Jeffrey and Austin**. Use their confirmed existing Mail accounts. Their names do not establish an email address; do not guess login emails or grant the address to every dashboard teammate. Sharing includes existing address-scoped messages. Personal aliases and other messages in the address owner's mailbox remain outside this grant.

## Activate the two services

Generate a new high-entropy **CRM_MAIL_SECRET** of at least 32 characters before the commands below. Its value must match between the website and Mail for the same environment and must differ from the existing website `MAIL_AUTH_SECRET` / Mail `DASHBOARD_AUTH_SECRET`. Store it only in Cloudflare's secret store and the Render web service's environment. It is an additional capability, not a replacement for existing Mail login credentials.

1. Apply the ordered website migrations through **0010_inbox.sql** to PostgreSQL. The existing Render build command runs `npm run db:migrate`, `npm run db:retention` and the production build. Migration 0010 adds Inbox metadata; it does not copy Mail messages into PostgreSQL or grant access.
2. Apply Mail's ordered D1 migrations through **0037_crm_mail.sql** in the intended Cloudflare environment, then deploy the separate Mail application. A push to the website's `main` does not deploy Mail. From the repository root, the production commands are:

   ```powershell
   Push-Location apps/mail
   npx wrangler d1 migrations apply DB --remote --env production
   npx wrangler secret put CRM_MAIL_SECRET --env production
   npm run deploy:production
   Pop-Location
   ```

   Enter the new secret at Wrangler's prompt. For staging, use `--env staging` and `npm run deploy:staging` with that environment's own resources and secret. Keep the existing `DASHBOARD_AUTH_SECRET`, Resend, webhook, D1, R2 and queue settings intact.
3. On the Render **web service**, add the matching `CRM_MAIL_SECRET`. Keep `DASHBOARD_AUTH_MODE=mail`, `MAIL_AUTH_URL=https://mail.tailoredagents.com/api/dashboard-auth` and the existing `MAIL_AUTH_SECRET`. Deploy the verified website build with migration 0010. No CRM secret is required by the existing Search Console cron.
4. In **Mail → Manage team**, an active Mail owner confirms the existing Devon, Jeffrey and Austin accounts, their dashboard approval and the exact **sales@tailoredagents.com** address. Grant that address **Read + send** to each of those three accounts, including Jeffrey even if he owns the address. Do not grant personal aliases, create guessed accounts or expand access to additional teammates. A dashboard login grant alone permits no mailbox reading or sending. Read-only mailbox grants cannot send, and dashboard viewers cannot change shared records or send even with a Mail send grant.
5. Sign in to the website with each approved Mail account and open `/dashboard/inbox`. The bridge verifies the current identity and explicit address grant on every call. Missing configuration shows setup state; missing/revoked approval shows an access state and hides local notes, drafts and conversation metadata. Record authenticated production acceptance separately from the deployment.

There is no reason to set `API_SEND_ENABLED=true` or enable Mail's disabled public APIs. The new private endpoint uses its own secret, live identity grant and explicit address approval. Incoming attachment downloads use the same scope and force a file download; there is no public attachment URL.

## Email acceptance and recovery

Local PostgreSQL tests use only the guarded disposable `ta_inbox_test` database on loopback port 55433 and a mocked Mail transport. Browser fixtures and Mail's isolated tests use synthetic messages. Passing them establishes local behavior; it does not prove that production credentials, routing or delivery are active.

For production acceptance, use explicitly authorized test correspondents and record:

- Devon, Jeffrey and Austin can open the approved address; another unapproved account cannot. Confirm that personal aliases, drafts in Mail, trash and unrelated messages remain unavailable. Remove one test approval and confirm the next request hides messages and local collaboration data.
- An authorized incoming test email appears in the correct conversation. Read state is personal; a new message becomes unread again. Internal notes are shared only with approved readers, while a saved draft is visible only to its author.
- A deliberate compose/reply sends from sales@tailoredagents.com, appears in Mail's Sent view and reaches the authorized recipient. Replies follow the original Mail message's recipient and subject. Confirm actual delivery rather than relying on an accepted response.
- Existing email opt-outs prevent sending. Viewer, suspended, other-workspace and read-only Mail permissions deny the corresponding changes or sends. Verify explicit CRM links and incoming attachment download on desktop and phone.
- A repeated submit/status check reuses the same send key. For an uncertain outcome, keep the message unchanged and use **Check send status**; do not create a second attempt. Inspect Mail's actual state before any manual resolution. Provider outages preserve private drafts and do not expose stale mailbox content.

Record the deployed website commit, Mail deployment, migration versions, approved accounts and acceptance results without placing secrets or real customer message content in source or screenshots.

## Prepare Twilio alongside email activation

1. Choose the Tailored Agents business number and its purpose (sales/support), the accountable account owner, business details and approved sender identity. Keep this business's numbers and registrations distinct from Wholesale's Stonegate configuration. Review cost before purchase, port or service changes.
2. For US local-number application SMS, prepare the Tailored Agents brand/use-case registration, exact opt-in flow, sample messages, privacy/terms URLs and opt-out handling. Do not infer that a researched public phone number is messaging consent. See [Twilio A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc).
3. Specify team routing, Devon's BatchDialer workflow, staff fallback numbers, business hours, voicemail greeting and missed-call responsibility. Begin with a single simple business line; browser calling is a later increment.
4. Decide approved call-recording disclosure/consent, which staff can play/download recordings, retention and deletion ownership. Confirm the policy for the jurisdictions actually served before recording activation. See [Twilio recording guidance](https://www.twilio.com/docs/voice/twiml/record).
5. Preserve explicit mailbox sharing above as future SMS/call context is added. Matching a contact address does not authorize sharing private Mail content with a client or another workspace.
6. Prepare environment variables in the appropriate provider's secret store; never copy API keys, passwords, private credentials, production email content or recordings into source, chat, CSVs or screenshots. Staging uses distinct accounts/resources where supported.

## Required contract for later providers

- Keep providers behind server-only adapters. PostgreSQL stores canonical contacts, conversations, provider IDs, delivery state and durable work; provider events are not authority to cross workspace boundaries.
- Verify webhook signatures using the provider SDK and the exact public request URL/body, including the reverse-proxy contract. Bound bytes and processing time before parsing. See [Twilio request validation](https://www.twilio.com/docs/usage/security).
- Deduplicate incoming events and outbound intent IDs. Persist outgoing intent before provider delivery and reconcile uncertain responses instead of blindly sending a second message.
- Synchronize `START`, `STOP` and `HELP` events with channel restrictions and avoid duplicate confirmation replies when the provider already sent one. Check saved restrictions immediately before an outbound action. See [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out).
- Distinguish queued, provider-accepted, delivered, failed, unknown and genuinely read states. A saved manual log or delivery receipt does not establish that a person read a message.
- Recording callbacks and transcription jobs have separate readiness, retry, expiry and failure state. Media playback/download requires both recording permission and the correct workspace/conversation access.
- Move sustained email synchronization, attachment processing, transcription and agent work into a durable bounded worker. Choose the smallest runtime that meets measured workload and approved costs; retain the current reporting cron for its existing task.

## Controlled acceptance for later increments

Record synthetic or explicitly authorized tests for incoming/outgoing email and SMS, replies, threading, attachments, simultaneous staff work, routing, voicemail, unknown callers, STOP/START, unsigned/repeated callbacks, delayed delivery, provider outage/recovery, recording consent/playback/deletion, scoped permissions and browser/phone use. Check actual provider billing and service readiness. Do not declare activation complete based solely on environment configuration or a successful build.
