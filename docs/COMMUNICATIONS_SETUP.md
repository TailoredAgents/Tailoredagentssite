# Communications setup and activation

Release 2's email, business SMS, unified Inbox, browser calling and voicemail increments are implemented in source. Production deployment, mailbox/number approval and authorized delivery acceptance are separate steps below; this document does not record them as completed. BatchDialer remains the current campaign dialer. Connected-call recordings and transcripts remain later increments. The owner-led calling activation checklist is [VOICE_SETUP.md](VOICE_SETUP.md), including migration 0013, separate voice grants, hours and voicemail retention.

The first unified relationship Inbox is implemented in source at `/dashboard/inbox`; the existing separate provider workspaces remain compatible at `?channel=email` and `?channel=sms`. Apply website migration **0012_unified_inbox.sql** and deploy the latest Mail code for the address-scoped discovery and history APIs. Mail uses the existing migration **0037** and `CRM_MAIL_SECRET`; this increment adds no Mail migration or secret. See [Unified Inbox](UNIFIED_INBOX.md) for current behavior, verification and remaining refinements. The provider activation instructions below still apply.

Ownership: Jeffrey handles the email activation checklist only. The project owner handles Twilio account/number setup, registration, secrets, SMS, calling, recording, transcripts and the remaining development with Codex. The Twilio sections below are the project owner's working checklist. The email-only handoff is [new jeffrey.md](../new%20jeffrey.md).

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

## Business SMS increment

The SMS channel in `/dashboard/inbox?channel=sms` adds the business-number conversation list, text compose/reply, private drafts, open/waiting/done states, assignment, manual business/inquiry links, internal notes and personal read receipts. `/dashboard/settings#sms` lets an owner or administrator verify the configured existing number, grant each teammate read or read/send access, and pause number sending. Connecting the verified number grants only the administrator performing that explicit action; other teammates require individual grants. A workspace viewer cannot send or change shared records even if a number grant permits sending.

The project owner supplied **+1 (678) 541-7725** as the existing SMS/voice-capable Twilio business number. Reuse that number after read-only account ownership and SMS-capability verification. Number ownership, registration state and production delivery have not been independently verified by this implementation. No number purchase, port, registration submission or provider setting change is part of saving this source.

This increment sends plain-text SMS of up to 1,600 characters to one recipient at a time. A long text can be billed as several SMS segments. Incoming MMS records the text and media count; media URLs are never fetched or displayed as downloadable attachments. Staff notes and saved drafts send nothing. The conversation reader shows the latest 200 messages and notes. Message bodies and notes expire after 24 months; private drafts expire after 90 days. Compact provider IDs and outbound-intent keys remain to prevent an old request from creating another message.

The server allows at most **30 new outbound attempts per actor per hour** and **100 new outbound attempts per business number per hour**. Reserving a new attempt consumes this allowance even if delivery is later rejected or uncertain. Repeated requests for the same intent and status checks do not consume another send allowance or create another provider message. These limits count attempts, not billable SMS segments; verify actual provider usage separately.

The first outbound text to a number requires permission confirmation and evidence unless an allowed SMS preference is already recorded. A researched public phone number is not evidence of permission. `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END` and `QUIT` create a workspace-wide SMS block for the normalized phone number. Twilio opt-out error `21610` also records a block. A new compose or confirmation checkbox cannot override it. `START`/`UNSTOP` requests are recorded for review and do not automatically clear the local block. The application returns empty TwiML and sends no automatic confirmation or AI reply; preserve the account's existing provider opt-out behavior. See [Twilio opt-out handling](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out).

## Activate the existing Twilio number

The project owner handles these steps with Codex. Jeffrey's handoff remains email-only.

1. Apply the website's ordered PostgreSQL migrations through **0011_sms_inbox.sql** before serving the SMS routes. The migration adds number bindings, explicit grants, conversations, message metadata/content, drafts, notes, read receipts and durable send intents. It grants no existing teammate automatic SMS access.
2. In the existing Twilio account, confirm the exact account/subaccount owning **+16785417725**, the number's SMS capability, account/trial restrictions and the relevant messaging registration. Do not purchase a replacement or reuse Wholesale's Stonegate account. For a US local application sender, verify the Tailored Agents brand/campaign and opt-in use case with [Twilio's A2P 10DLC guidance](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc). A successful read-only capability check does not establish registration approval or deliverability.
3. Create or select a dedicated server API key with access to the required account's IncomingPhoneNumbers and Messages resources. Prefer a suitable restricted key where supported; otherwise use a dedicated standard key. REST calls use the key SID/secret, while webhook signatures use that account's Auth Token. Twilio recommends [API-key authentication for applications](https://www.twilio.com/docs/usage/requests-to-twilio). Store the following only in the Render **web service** environment; do not put them in public variables, source, chat or screenshots:

   ```dotenv
   TWILIO_ACCOUNT_SID=<owning AC account SID>
   TWILIO_AUTH_TOKEN=<that account's Auth Token>
   TWILIO_API_KEY_SID=<dedicated SK key SID>
   TWILIO_API_KEY_SECRET=<dedicated key secret>
   TWILIO_PHONE_NUMBER=+16785417725
   TWILIO_SMS_ENABLED=false
   BETTER_AUTH_URL=https://www.tailoredagents.com
   ```

   Preserve the existing Mail, website authentication, Google and inquiry notification settings. Use separate test credentials/resources for test environments; local HTTP callback origins are allowed only for loopback outside production. Auth Tokens and API key secrets are not interchangeable. Rotate a compromised key independently; keep valid account signing credentials so incoming opt-outs and previous delivery updates can still be processed while REST keys are replaced.
4. Deploy the verified website while outbound sending remains `false`. Open **Settings → Business SMS**, connect the configured number, and confirm the API returned the same account/number with SMS capability. This is a read-only provider lookup plus a local workspace binding; it does not change Twilio routing or buy a number. Confirm the actual existing Devon, Jeffrey and Austin dashboard memberships and grant the approved number's read/send access deliberately. Do not infer account emails from names or grant every workspace teammate access.
5. After checking existing number routing, configure the number's **incoming messaging** webhook as HTTP `POST` to:

   ```text
   https://www.tailoredagents.com/api/integrations/twilio/sms/incoming
   ```

   This step changes incoming SMS routing for that number. Preserve existing voice/call URLs, voice applications, Studio flows and BatchDialer settings; document and retain any previous messaging URL before replacing it. No voice route or recording setup is created by this increment. An individual outgoing message includes its own signed delivery callback:

   ```text
   https://www.tailoredagents.com/api/integrations/twilio/sms/status?attempt=<actual send attempt UUID>
   ```

   Do not paste the template with a placeholder into a general callback setting. The application generates the exact URL for each reserved send. Both routes validate the SDK signature using `BETTER_AUTH_URL`, including the attempt query and every bounded form field; forwarded Host/protocol headers are not trusted. Duplicate form keys, wrong accounts and non-SMS channels are rejected. Status events with partial participant fields must still bind to the original intent and verified provider message. See [Twilio's webhook security guidance](https://www.twilio.com/docs/usage/webhooks/webhooks-security).
6. With an explicitly authorized test correspondent, verify incoming text and an opt-out while outbound is paused. Then confirm registration/account readiness, recipient permission and approved test costs before setting **TWILIO_SMS_ENABLED=true**. The number must also be active locally and the sender's grant must allow sending. Perform only the approved small acceptance exchange below. Restore the switch to `false` or pause the number if anything remains unresolved.

## SMS acceptance and uncertain sends

Automated PostgreSQL tests and browser checks use guarded disposable local databases, synthetic numbers and the SDK's mocked transport boundary. They do not contact a Twilio account or prove live number readiness.

For controlled production acceptance, record the deployed commit/migration and the approved account, number and teammates without saving secrets or customer messages in source:

- An authorized incoming text appears once in the correct workspace/number conversation. A repeated signed event adds no duplicate; another number/workspace and unsigned payload cannot expose or create a conversation. Incoming messages still arrive when sending is paused.
- The permitted sender can send one authorized text, which the test recipient actually receives. Twilio's queued/accepted state means the provider accepted work; only its delivered state confirms its delivery report, and no SMS status establishes that a person read it. Check account billing/segment usage after the exchange.
- Saving a draft or internal note sends nothing. Verify personal draft/read state, conversation assignment, explicit CRM links, desktop/phone layout and the latest-200-history limit.
- A viewer, unapproved person and read-only number grant cannot send. Revoke a test grant and confirm the next request hides messages and local collaboration data. A paused number/server switch prevents new outgoing sends while still accepting signed incoming/status events.
- An authorized `STOP` exchange blocks further SMS from both the conversation and new compose. A subsequent `START` request does not silently remove the local restriction. Test carefully because provider opt-outs affect real routing and confirmations; record the controlled test state before resolving a restriction.
- Repeating the same request ID never creates another provider message. The Twilio SDK disables automatic creation retries and uses a 15-second timeout. A timeout/network/5xx result may have occurred after acceptance: retain that intent and use **Check SMS status**. When a SID is known the check performs a read; when no SID was returned it waits for a signed callback or authorized provider investigation. It never submits another POST or invents an idempotency guarantee.

If the callback cannot bind safely, or the original create outcome remains unknown, inspect the Twilio console using the account/number, recipient and approximate timestamp before any manual resolution. Do not delete the intent, change its key or create a replacement message merely to retry. Correct missing credentials/routing and allow signed callbacks to reconcile the existing send.

For rollback, leave the additive schema and intent keys in place, disable `TWILIO_SMS_ENABLED` and pause the local number. Keep valid signed webhook handling available for opt-outs and already-sent messages. If reverting to a build without SMS routes, restore the prior messaging webhook deliberately so incoming messages are not dropped. Existing email and voice routing are separate.

## Prepare calling after SMS activation

1. Reuse the verified Tailored Agents number and confirm its sales/support purpose, accountable account owner, business details and approved caller identity. Keep this business's numbers and registrations distinct from Wholesale's Stonegate configuration. Review costs and existing routing before service changes.
2. For US local-number application SMS, prepare the Tailored Agents brand/use-case registration, exact opt-in flow, sample messages, privacy/terms URLs and opt-out handling. Do not infer that a researched public phone number is messaging consent. See [Twilio A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc).
3. Configure the implemented browser staff routing, business hours and voicemail using [VOICE_SETUP.md](VOICE_SETUP.md). Devon's BatchDialer workflow continues separately. External staff fallback numbers and advanced forwarding remain later work.
4. Decide approved call-recording disclosure/consent, which staff can play/download recordings, retention and deletion ownership. Confirm the policy for the jurisdictions actually served before recording activation. See [Twilio recording guidance](https://www.twilio.com/docs/voice/twiml/record).
5. Preserve explicit mailbox sharing above as future SMS/call context is added. Matching a contact address does not authorize sharing private Mail content with a client or another workspace.
6. Prepare environment variables in the appropriate provider's secret store; never copy API keys, passwords, private credentials, production email content or recordings into source, chat, CSVs or screenshots. Staging uses distinct accounts/resources where supported.

## Provider contract and later increments

- Keep providers behind server-only adapters. PostgreSQL stores canonical contacts, conversations, provider IDs, delivery state and durable work; provider events are not authority to cross workspace boundaries.
- Verify webhook signatures using the provider SDK and the exact public request URL/body, including the reverse-proxy contract. Bound bytes and processing time before parsing. See [Twilio request validation](https://www.twilio.com/docs/usage/security).
- Deduplicate incoming events and outbound intent IDs. Persist outgoing intent before provider delivery and reconcile uncertain responses instead of blindly sending a second message.
- Synchronize `START`, `STOP` and `HELP` events with channel restrictions and avoid duplicate confirmation replies when the provider already sent one. Check saved restrictions immediately before an outbound action. See [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out).
- Distinguish queued, provider-accepted, delivered, failed, unknown and genuinely read states. A saved manual log or delivery receipt does not establish that a person read a message.
- Recording callbacks and transcription jobs have separate readiness, retry, expiry and failure state. Media playback/download requires both recording permission and the correct workspace/conversation access.
- Move sustained email synchronization, attachment processing, transcription and agent work into a durable bounded worker. Choose the smallest runtime that meets measured workload and approved costs. The current reporting cron also performs one bounded voicemail retention deletion per invocation; its reporting task remains isolated from voice failures.

## Controlled acceptance for later increments

Record synthetic or explicitly authorized tests for incoming/outgoing email and SMS, replies, threading, attachments, simultaneous staff work, routing, voicemail, unknown callers, STOP/START, unsigned/repeated callbacks, delayed delivery, provider outage/recovery, recording consent/playback/deletion, scoped permissions and browser/phone use. Check actual provider billing and service readiness. Do not declare activation complete based solely on environment configuration or a successful build.
