# Unified Inbox correction

Updated October 21, 2026 after the owner asked us to inspect Wholesale's actual Inbox. This defines the next development increment. It describes intended behavior; the current website still has separate email and SMS workspaces.

## What the owner meant

Open a lead or customer conversation and see the whole relationship: texts, emails, incoming/outgoing calls, voicemail, recordings, transcripts and internal notes. Choose how to respond inside that conversation. Ownership, follow-ups and CRM context stay with the relationship when the response channel changes.

The first email and SMS increments supply useful provider adapters, sending/recovery behavior and access controls. They do not yet deliver this experience. More channel tabs would continue the wrong direction. Build the shared conversation workspace before adding calling.

## Reference inspected

Wholesale was reviewed at commit `032ae5a37d7d0e1d0f957ad5f0237bb83263ec4b`, including the Inbox page/workspace, communication models and services, email actions, call integration, manuals and finishing roadmap. This was a source review, not an authenticated production acceptance test.

- [Workspace and channel composer](https://github.com/TailoredAgents/Wholesale/blob/032ae5a37d7d0e1d0f957ad5f0237bb83263ec4b/apps/web/src/app/os/inbox/inbox-workspace.tsx#L300-L342): Mine, Unassigned, Team, Needs reply, Appointments, Unread and Archived are conversation views; SMS, Email, Call and Note are composer choices.
- [Shared history and three panes](https://github.com/TailoredAgents/Wholesale/blob/032ae5a37d7d0e1d0f957ad5f0237bb83263ec4b/docs/USER_MANUAL.md#L1191-L1240): changing the composer keeps earlier channels visible.
- [Conversation model](https://github.com/TailoredAgents/Wholesale/blob/032ae5a37d7d0e1d0f957ad5f0237bb83263ec4b/apps/api/app/models/foundation.py#L3142-L3211) and [communication model](https://github.com/TailoredAgents/Wholesale/blob/032ae5a37d7d0e1d0f957ad5f0237bb83263ec4b/apps/api/app/models/foundation.py#L3378-L3419): the CRM conversation is the parent; a provider thread is routing/deduplication information beneath it.
- [Timeline assembly](https://github.com/TailoredAgents/Wholesale/blob/032ae5a37d7d0e1d0f957ad5f0237bb83263ec4b/apps/api/app/services/inbox.py#L1484-L1770): communications, call evidence, handoffs and appointments are ordered together.
- [Response rules](https://github.com/TailoredAgents/Wholesale/blob/032ae5a37d7d0e1d0f957ad5f0237bb83263ec4b/docs/USER_MANUAL.md#L1266-L1279) and [general email handling](https://github.com/TailoredAgents/Wholesale/blob/032ae5a37d7d0e1d0f957ad5f0237bb83263ec4b/docs/USER_MANUAL.md#L1313-L1351): reply work follows communication, reminders are deliberate, and general correspondence can exist without creating a fake lead.

Adapt these interactions to Tailored Agents. Wholesale's real-estate fields, queues, accounts and records do not belong in this application. Its finishing roadmap also distinguishes implemented capabilities from live provider acceptance.

## The Tailored Agents workspace

| Area | Required behavior |
| --- | --- |
| Conversation queue | Contact/business identity, latest permitted activity, owner, unread indicator and reply state. Mine, Team, Unassigned, Needs reply, Unread and Archived views. Add appointment/follow-up views using our existing scheduled work. Mailbox/number filters refine this queue. |
| Conversation header | Person and business, relationship/stage, assigned teammate, reply state and direct contact actions. An email subject belongs to an email event rather than replacing the customer's identity. |
| Shared timeline | Emails, texts and internal notes together first; calls, voicemail, recordings and transcripts extend this same history. Show direction, author, time, channel and real provider status. Keep email subjects and reply chains intact. |
| Composer | SMS, Email and Note within the selected conversation. Preserve the appropriate recipient, sender, reply target and private draft for each channel. Call becomes functional in the next increment. Changing the composer leaves history and selection in place. |
| Work controls | Shared owner, Needs reply, Waiting, Done and deliberately scheduled reminders. A new customer reply reopens work; a note or saved draft does not count as a customer response. Delivery callbacks and STOP/START/HELP control messages update their own state rather than creating reply work. Ordinary unanswered messages do not manufacture overdue deadlines. |
| CRM context | Business/contact details, lead or opportunity stage, service interest, source, next appointment/follow-up, mockup preview/status and linked client/project. Provide useful links/actions into the existing sales and delivery records. |
| General correspondence | Receive and respond without forcing a lead. Deliberately link to an existing relationship, create a lead when appropriate, or archive. Ambiguous identities go to review. |
| Desktop and phone | A compact conversation list, generous timeline with a persistent composer, and a collapsible context panel. Phone switches between Conversations, Thread and Details. Use Tailored Agents typography, colors and shared controls. |

Example: Devon opens an interested business, reads its earlier email and texts in the same thread, sends a text, adds an internal note and schedules a follow-up. Austin later sees that history and its mockup link. A later call and recording appear in that history rather than creating another inbox to check.

## Correct the underlying model

1. Add a canonical workspace-scoped CRM conversation with a stable relationship identity and common work state. Bind it to the correct contact and relevant lead/opportunity/client context. A company with several people is not automatically one conversation; unrelated work and restricted correspondence need separate contexts.
2. Add unique bindings for existing Mail address/thread and SMS number/thread identities. Preserve provider IDs, timestamps and existing send intents. Resolve exact, unambiguous contact identities or an explicit staff link. Company names, similar email subjects and guessed phone matches cannot merge histories.
3. Keep Tailored Mail as the email content/provider authority. Its existing mailbox/thread endpoints can hydrate known threads; reliable queue discovery needs an address-scoped metadata API with bounded cursor pagination, external participant identities, activity/message IDs and change/removal reconciliation. Recheck current grants independently and reconcile revoked sources. Track discovery progress and refresh state. This API is development work for the owner and Codex; Jeffrey's role remains email deployment/activation. Do not cache email bodies merely to make a mixed timeline.
4. Apply filtering, ordering, counts and pagination across that read model. Initial shared search covers permitted contact/business identities and indexed address metadata; searching message bodies requires a separately implemented provider-aware query and must not be implied by the metadata index. Combining page one of Mail with page one of SMS cannot establish a complete team queue. During initial discovery or provider failure, show coverage/freshness accurately.
5. Resolve permitted source bindings for each request, load the corresponding provider/local events, and return a single chronologically ordered timeline. Support older-history pagination; a bounded recent window must be labeled accurately.
6. Move new relationship-level assignment, response state and reminders to the canonical record. Preserve existing owners/status/notes/drafts/reads during migration. Conflicting existing channel assignments require explicit reconciliation rather than an arbitrary winner.
7. Keep provider sending adapters and their durable recovery contracts. A composer switch must never create another outbound attempt, change an uncertain attempt's payload, or reinterpret a local note as a sent message.

### Access and existing data

Mailbox/number approval remains independent of CRM linking and assignment. Every timeline item, preview, attachment, search match and count must respect its source's current access. A teammate with SMS access cannot gain email history by opening the same customer. Revocation must take effect on the next request.

Existing email notes stay mailbox-scoped; linking their thread must not expose them to SMS-only readers. Private drafts stay private and channel-specific. Define the audience for new relationship notes explicitly. Retention and anonymization still apply through the existing maintenance process.

Keep the approved email scope: **sales@tailoredagents.com**, with Devon, Jeffrey and Austin using their confirmed Mail accounts. Keep the supplied Twilio number **+16785417725** and explicit number grants. This correction does not change sending preferences or activate providers.

## Implementation order and acceptance

**Next coherent increment: shared email/SMS/notes conversation workspace.** Add the canonical relationship/source bindings, safe existing-data reconciliation, authorized queue discovery and unified read model, then replace the separate default channel screens with the three-pane workspace and channel composer. Establish this end-to-end behavior before adding another communication channel. Existing setup and provider acceptance can continue independently.

Acceptance uses synthetic records and both same-user and different-user grants:

- A deliberately linked email thread and SMS conversation for one relationship appear in one queue row and one timeline, while unrelated contacts and general mail stay separate.
- Sending a text, replying to the correct email and adding a note work from that selected conversation. Channel changes preserve drafts, selection and history; uncertain sends still reconcile without a second create request.
- Mine/Team/Unassigned/Needs reply/Unread/Archived views, counts, global ordering and pagination remain correct across multiple provider pages. Customer replies reopen work; delivery/control events do not. Only deliberate reminders create a deadline.
- Email-only, SMS-only, read-only, revoked and other-workspace access return only permitted content and metadata. Existing narrower notes and private drafts do not widen their audience.
- Existing populated records, assignments, links, preferences, notes, receipts and send intents survive upgrade and restore; ambiguous/conflicting links are reviewable.
- Provider outage/discovery lag is visible without inventing an empty complete inbox or exposing stale unauthorized Mail content. Desktop/phone interactions and existing sales/auth/provider regressions pass.

**Following increments:** integrated calling and voicemail, then protected recordings/transcripts and editable assistance, all attached to the same conversation. Complete richer email features (outgoing attachments, CC/BCC, signatures/templates), watchers/coverage and visual refinements within this workspace. Do not treat them as another standalone mailbox product.

Jeffrey's assignment remains email activation in [new jeffrey.md](../new%20jeffrey.md). The owner and Codex handle the unified workspace, Twilio, calling, recordings, transcripts and remaining agency development. [Communications setup](COMMUNICATIONS_SETUP.md) records current implemented provider behavior; [the agency roadmap](AGENCY_OS_ROADMAP.md) records release evidence and the active development order.
