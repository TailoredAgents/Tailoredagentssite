# Mail smart inbox — November 24, 2026

Jeffrey selected the standalone Mail app and sender learning/authentication without new AI costs. This release does not enable the disabled paid content classifier or change the CRM reader.

## Behavior

- **Junk / Not junk learn exact senders per account.** The active Resend receiving path now reads the same preferences these actions save. Blocked senders and learned junk senders go to Junk. Not junk removes the sender's block and keeps future messages in the inbox, including forwarded mail with failed authentication. The authentication warning remains. A correction to a message is locked against an in-flight import retry.
- **Unknown does not mean junk.** Without a saved sender rule, the receiving provider's explicit DMARC failure sends a message to Junk. Missing, gray or temporarily unavailable results leave it in the inbox. No automatic historical mailbox sweep, deletion or content-based AI judgment is performed.
- **Domain verified** means the receiving provider reported DMARC pass. SPF/DKIM/DMARC details are available in the message. It does not verify a person's identity or endorse the content. Evidence comes from Resend's structured `authentication` result, never sender-controlled headers. [Provider field definition](https://resend.com/docs/api-reference/emails/retrieve-received-email).
- **Images show automatically for verified messages.** Each sender has Show when verified, Always show, or Ask before showing. Choices persist per account. Junk, blocked senders and failed authentication always require the one-message Show images button, even with an Always show preference. Embedded images continue to work. Links alone no longer cause an image warning.
- The HTML sandbox and sanitization remain. Recognizable 1×1/hidden image pixels are removed, including when images are enabled. This is not comprehensive tracking prevention: ordinary visible images can also track opens, and loading remote images contacts their host directly. No image proxy is introduced.
- **Settings → General** explains the rules and correctly displays/removes blocked senders, including earlier learned junk senders. The former response-key mismatch is fixed.

For older messages, the reader checks the original provider response already retained in private R2. If historical authentication evidence is absent or unavailable, it displays Sender not verified. New deliveries save normalized results in D1. Original provider responses, private routing headers and BCC data are not returned by the security metadata API.

## Verification

- 445 backend/unit/integration tests passed, no failures or skips, under Node 24.
- Svelte/TypeScript: zero errors and warnings. Production Worker build passed.
- All 17 distinct local browser journeys passed across two runs. The combined run passed 12 before repeated synthetic owner sign-ins reached the existing 10/account/15-minute login limit. After resetting only the disposable local fixture, the remaining five plus the earlier MCP journey passed (six in that run). Production limits were unchanged.
- New browser checks observed automatic verified images, persistent preferences after reload, blocked tracking pixels, unknown/failed-message behavior, settings block removal, invalid/unauthorized message preference requests, and a 390px phone layout. New server tests cover provider-only evidence, account isolation, inbound routing, missing evidence and retry-safe corrections.
- The isolated preview used synthetic accounts, local D1/R2 and mocked remote images. It did not send mail. The phone capture is outside Git at `/tmp/tailored-mail-smart.ThT37H/repo/apps/mail/test-results/smart-inbox-phone.png`.

## Release and recovery

Apply `0040_smart_inbox.sql` before deploying this Mail version. It adds nullable authentication/reason fields and an account-scoped sender-image preference table. This schema is additive; leave it in place on a code rollback. Production also had pending migration 0039; it adds the background-grant schema but grants no access. Staging had 0037–0039 pending. Neither a migration nor this release opts employees into background processing.

Before migration, export D1 to protected storage outside Git. The production backup for this change is `~/.config/tailored-mail/backups/2026-11-24-before-smart-inbox.sql`. Never commit or print its private contents.

Pre-release Worker versions: staging `05dd3664-ec9b-4af9-a501-a4e987ea5369`; production `c18a7f3b-817c-49f6-b89c-bba31df1cd09`. Keep production sender permissions, the existing 100/user/Eastern-day assistant send cap, secrets and background opt-in gates. Sending/reply-all/attachment delivery tests require separately approved recipients/content. This task authorizes no test messages.

## Live release evidence — November 24, 2026

Implementation `3ced054` is pushed to `main`. Staging migrations 0037–0040 and production migrations 0039–0040 completed after private backups; production reports no pending migrations. No existing production OAuth grants were reset.

- **Staging:** Worker `2bc8b519-7dcc-46f2-832f-d8021b142768`. The existing synthetic owner account signed in successfully. General settings rendered Smart inbox, mailbox and an already-read thread returned 200, and that historical thread exposed a provider-backed **verified** result. Unauthenticated mailbox access returned 401; OAuth discovery returned 200. The test session was signed out afterward.
- **Production:** Worker `612cb273-c4d8-48c9-8c66-4c752cbd921f` deployed to `mail.tailoredagents.com`, observed at 10:10 PM Eastern. Login and OAuth discovery returned 200, unauthenticated mailbox access returned 401, and the new domain-verification and image-preference client assets were fetched successfully. The existing Austin Mail MCP connection still authenticates with its prior scopes and reports sending enabled, 100/day, resetting in America/New_York. No mail was sent.
- Production bindings retain the same database, private bucket, queue, five-minute maintenance schedule and send settings. The paid AI classifier remains disabled; background access remains an explicit employee opt-in and was not activated here.

The authenticated browser journeys and tracking-request assertions were local; the authenticated API/settings checks were staging. A fresh production delivery through the new sender-learning path and every employee's production browser remain follow-up acceptance, not results implied by these smoke checks. The later Mail polish and background/compose source already on `main` are included in this deployment; their broader delivery/device acceptance is separate from this inbox release.
