# Communications activation preparation

Release 1 stores manual/imported communication history and channel restrictions. It does not connect a mailbox, send messages, place calls, record conversations or create paid resources. BatchDialer remains the current campaign dialer.

## Prepare while sales is implemented

1. Choose the Tailored Agents business number and its purpose (sales/support), the accountable account owner, business details and approved sender identity. Keep this business's numbers and registrations distinct from Wholesale's Stonegate configuration. Review cost before purchase, port or service changes.
2. For US local-number application SMS, prepare the Tailored Agents brand/use-case registration, exact opt-in flow, sample messages, privacy/terms URLs and opt-out handling. Do not infer that a researched public phone number is messaging consent. See [Twilio A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc).
3. Specify team routing, Devon's BatchDialer workflow, staff fallback numbers, business hours, voicemail greeting and missed-call responsibility. Begin with a single simple business line; browser calling is a later increment.
4. Decide approved call-recording disclosure/consent, which staff can play/download recordings, retention and deletion ownership. Confirm the policy for the jurisdictions actually served before recording activation. See [Twilio recording guidance](https://www.twilio.com/docs/voice/twiml/record).
5. Identify Mail business aliases/inboxes that may be shared with the CRM, authorized senders and restricted mail that must stay private. Mail's dashboard-auth grant grants no email access. Implement and test a narrow mailbox service contract before enabling Inbox synchronization.
6. Prepare environment variables in the appropriate provider's secret store; never copy API keys, passwords, private credentials, production email content or recordings into source, chat, CSVs or screenshots. Staging uses distinct accounts/resources where supported.

## Required transport and data contract

- Keep providers behind server-only adapters. PostgreSQL stores canonical contacts, conversations, provider IDs, delivery state and durable work; provider events are not authority to cross workspace boundaries.
- Verify webhook signatures using the provider SDK and the exact public request URL/body, including the reverse-proxy contract. Bound bytes and processing time before parsing. See [Twilio request validation](https://www.twilio.com/docs/usage/security).
- Deduplicate incoming events and outbound intent IDs. Persist outgoing intent before provider delivery and reconcile uncertain responses instead of blindly sending a second message.
- Synchronize `START`, `STOP` and `HELP` events with channel restrictions and avoid duplicate confirmation replies when the provider already sent one. Check saved restrictions immediately before an outbound action. See [Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out).
- Distinguish queued, provider-accepted, delivered, failed, unknown and genuinely read states. A saved manual log or delivery receipt does not establish that a person read a message.
- Recording callbacks and transcription jobs have separate readiness, retry, expiry and failure state. Media playback/download requires both recording permission and the correct workspace/conversation access.
- Move sustained email synchronization, attachment processing, transcription and agent work into a durable bounded worker. Choose the smallest runtime that meets measured workload and approved costs; retain the current reporting cron for its existing task.

## Controlled acceptance before release

Record synthetic or explicitly authorized tests for incoming/outgoing email and SMS, replies, threading, attachments, simultaneous staff work, routing, voicemail, unknown callers, STOP/START, unsigned/repeated callbacks, delayed delivery, provider outage/recovery, recording consent/playback/deletion, scoped permissions and browser/phone use. Check actual provider billing and service readiness. Do not declare activation complete based solely on environment configuration or a successful build.
