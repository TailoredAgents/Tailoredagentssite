# Assistant communications and voice notes

Implemented November 10, 2026. Local acceptance is complete; the separate Mail release and physical iPhone acceptance remain separate deployment gates.

## Employee use

Ask the assistant to prepare an email, reply or reply-all. It reads the permitted mailbox and current message to select the sender, recipients, subject and reply headers. Chat displays To, CC, BCC, message and each generated attachment before approval. Editing saves a new proposal and requires a fresh review. Cancelling or checking a receipt never sends a message. Mail adds the employee's standard signature, as stated in the preview.

Only generated PDF, DOCX, CSV and XLSX results can be attached: at most five files and 5 MB combined. Original uploads cannot be forwarded through this feature. Downloads and sends recheck access and immutable file hashes, including current source access. A changed reply target or deleted file blocks the old proposal. Reply-all includes visible recipients and never reconstructs hidden BCC recipients.

The website requires Mail's version-2 compose capability before enabling extended email sends. Old Mail deployments fail closed rather than silently omit CC, BCC or files. Existing single-recipient new email keeps its legacy transport.

SMS and employee-connected calls reuse existing permissions, opt-outs and services. The employee answers and presses 1 before the customer connects. No AI voice calls were added. Saved action receipts are visible in chat; detailed call/SMS delivery is available through the existing status tools and Inbox. Provider acceptance does not prove recipient delivery.

## Voice notes

Open **Voice note**, record, stop, then explicitly select **Transcribe voice note**. Correct the text and select **Use text in message**. This fills the composer without sending it. Normal Send is still required.

Clips are limited to two minutes, converted in the browser to bounded mono PCM WAV and validated from actual samples on the server. Recording stops when the page becomes hidden, the section closes or the component leaves the page. The server does not save audio. The private transcript preview expires after 24 hours or is discarded; sent chat text follows normal chat retention.

Transcription uses `gpt-transcribe` through OpenAI's audio API. The shared company ledger reserves $0.05 before a request; the measured/provider duration settles at $0.0045/minute (about $0.009 for two minutes). Dictation occurs before an assignment, so it uses the company allowance, not a particular assignment ceiling. Unknown requests retain their reservation and are not automatically repeated. The same recording identifier retrieves its saved result. Successful/failed receipts are retained for 90 days; uncertain receipts remain for reconciliation.

Pricing and API reference checked November 10, 2026: [speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text), [model](https://developers.openai.com/api/docs/models/gpt-transcribe), [pricing](https://developers.openai.com/api/docs/pricing).

## Deployment and rollback

1. Website migration `0061_assistant_dictation.sql` is additive and runs through the normal Render build. `ASSISTANT_COMMUNICATIONS_ENABLED=false` blocks extended email; `ASSISTANT_DICTATION_ENABLED=false` blocks new transcription. Both default enabled, but enhanced Mail still requires the capability handshake.
2. The separately deployed Cloudflare Mail service needs the CRM compose update and migration `0039_assistant_background_grants.sql` from the earlier delegation increment. Deploy Mail before enabling `ASSISTANT_BACKGROUND_ENABLED=true` on the website. Each employee must still explicitly authorize their own 30-day scope; the flag creates no grants.
3. Preserve existing secrets and mailbox grants. Do not reuse or reveal tokens in chat. Pause features through flags without replaying unknown sends. Status checks are read-only provider receipt lookups, never resends.
4. iPhone microphone purpose text is updated. Browser tests emulate a phone using Chromium; they do not establish Safari/WKWebView or real iPhone capture/APNs acceptance.

## Evidence

- Six PostgreSQL communication cases: concurrent approval sends once, old edited proposals cannot send, current reply revision, generated file access/hash checks, CC/BCC bytes, revoked access and unknown receipt reconciliation.
- Thirty-two Mail CRM transport cases, including reply-all routing, reply headers, attachment validation and status ownership. All 438 Mail tests pass after Svelte configuration generation; check/build pass.
- Eight voice validation/database cases: actual duration, shared allowance/concurrency, one provider request per identifier, private preview/discard and uncertain charge preservation.
- Ten desktop/phone browser journeys cover email edit/reapproval/status, voice correction into an unsent composer, saved work/review continuation, uploaded sources/downloadable cited results and workspace navigation. The email browser transport and audio/model provider are synthetic; server/database/provider contract tests cover the real implementation separately.
- Website full suite: 826 passed, 638 environment-dependent tests skipped; targeted database suites above were run separately. Typecheck, lint, capability inventory and production build are checked for this increment.

No live customer email, SMS, call, paid transcription or APNs delivery was used as a test. Live Mail deployment and designated employee alert acceptance remain pending; see the release record.
