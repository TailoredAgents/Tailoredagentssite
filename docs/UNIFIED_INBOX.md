# Unified Inbox

Current behavior reconciled with source on October 25, 2026. Contact-first entry, calling/recording workflows, AI drafts and client briefs are implemented. The design rationale and dated test/deployment evidence below retain their original scope; they do not establish fresh production acceptance. [Jeffrey's current handoff](../new%20jeffrey.md) tracks shared Sales acceptance; the [active roadmap](AGENCY_OS_ROADMAP.md) tracks remaining development.

## Alternate phone numbers — October 26, 2026

Open a lead, sales contact, client contact, or the Inbox customer-details pane and use **Phone numbers → Add another number**. Give it a label such as **Website**, **Office**, or **Mobile**, with an optional source note. Ten-digit US numbers normalize automatically. The original primary number stays intact; alternate labels and notes can be edited, and removing an alternate preserves its conversation history.

In the Inbox, **Text to** selects the destination; **Customer phone** selects among saved calling numbers. Unsent text stays in its own composer when switching numbers. Saved drafts and uncertain send recovery are scoped to the destination, so switching or refreshing cannot resend a pending message to another number. AI suggestions accept saved alternates and use the authorized customer history.

New channel histories join the selected customer when identity and access allow. New inbound texts to a unique saved alternate can join that person's existing conversation. Shared office numbers remain ambiguous and do not automatically combine different people's histories; older conflicting links still require explicit review. Lead-to-sales/client conversion copies researched numbers without replacing existing contact labels. Lead deletion clears its saved recipient drafts; retention clears alternate numbers when their record is anonymized.

Deployment requires migration **0026**; no additional credentials or Twilio configuration. Verified with 117 conversation/SMS/voice service checks and eight desktop/phone browser cases, including alternate-number calling, separate drafts, uncertain-send recovery, conversion, deletion and shared-number conflicts. Calls and messages in these tests used synthetic providers. Lint, TypeScript and production build passed. The browser fixtures use Webpack to avoid the local Turbopack reload loop; production remains on Turbopack.

## Contact-first entry — October 24, 2026

- **New conversation** opens a searchable contact/lead directory. Search by name, business, email or phone, then open that person's Inbox. The lead detail page now has **Contact lead** using the same flow.
- Existing authorized CRM-linked history takes priority. Exact normalized email/phone matches can open unlinked history; conflicting CRM identities are excluded. Other matching histories remain individually accessible, without silently merging older records.
- A person without history gets email, SMS and call options with saved contact details filled in. Missing email/SMS channels can also be started inside an existing conversation. Mailbox/number grants and actual workspace roles still control sending; opening a person never sends a message or starts a call.
- Accepted first email/SMS sends bind to the selected lead/contact. A new channel source joins the selected conversation when all its histories are available and its identity matches. Existing sources retain their context; binding failures leave the accepted send accepted and show a separate link warning. Provider content and grants are checked before linking.
- Migration **0019** expands the SMS draft key length for separate private drafts per CRM recipient. Pending sends retain their original request across refresh, including when a newly discovered thread replaces the initial composer. No provider setup or new environment values are required.

Verification: **74 focused PostgreSQL/service checks**, **26 Inbox browser cases** across desktop and phone, plus **four dark-theme recipient-flow cases** passed. The browser suites use isolated synthetic Mail/Twilio providers; no real customer message or call was sent. Lint, TypeScript and the production build passed.

Remaining Inbox work includes general-email-to-lead conversion, outgoing attachments, CC/BCC, signatures/templates and team coverage. The remaining shared Mail acceptance checks stay with Jeffrey's handoff.

The original October 21, 2026 design followed the owner's request to inspect Wholesale's Inbox. The shared email/SMS/notes foundation has since expanded as described here. Production delivery and provider acceptance remain separate records.

**Outbound handset calling (October 26):** the teammate assigned the approved forwarding cell can choose **My phone** in the Call composer. The system rings their cell first, requires press 1, then calls the customer with business caller ID. Browser audio remains available. Migration **0027**; see [Calling](VOICE_SETUP.md) for recovery, recording and setup details.

Calling extends this same conversation model through the **Call** composer, persistent dashboard phone, signed incoming staff routing, call history and protected voicemail. Voice sources use explicit line grants independent of SMS. [Calling](VOICE_SETUP.md), [recordings/transcripts](CALL_RECORDINGS.md) and [reviewed call follow-up tasks](CALL_FOLLOW_UP_TASKS.md) are implemented. The owner has confirmed calling and recording/analysis operation; the guides distinguish that confirmation from independent live checks and later refinements.

October 22 visual refinement: incoming messages now use an opaque light slate card (raised slate in dark mode), outgoing messages use a distinct soft blue, and the timeline has a deeper background. Sender names and message bodies use the primary text color. Conversation lists and customer details have separate panel shading; search, reply and context fields have solid input surfaces, and the selected channel has a filled tab. Internal notes keep their warm team-only treatment. These changes apply to the shared Inbox, including email, SMS and call events, without changing sending or permissions. Existing synthetic desktop/phone workspace, draft/send and accessibility checks passed in both themes (eight cases); lint, TypeScript and the production build passed. No real messages or calls were made. Updated previews: [incoming](previews/conversations-desktop.png), [outgoing](previews/conversations-outgoing-desktop.png), [dark outgoing](previews/themes/dark/providers/conversations-outgoing-desktop.png).

## What the owner meant

Open a lead or customer conversation and see the whole relationship: texts, emails, incoming/outgoing calls, voicemail, recordings, transcripts and internal notes. Choose how to respond inside that conversation. Ownership, follow-ups and CRM context stay with the relationship when the response channel changes.

The email, SMS and calling adapters share the conversation layer while retaining their provider-specific sending/recovery behavior and access controls.

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
| Shared timeline | Emails, texts, internal notes, calls, voicemail, recordings and transcripts in the same history. Show direction, author, time, channel and real provider status. Keep email subjects and reply chains intact. |
| Composer | SMS, Email, Call and Note within the selected conversation. Preserve the appropriate recipient, sender, reply target and private draft for each channel. Changing the composer leaves history and selection in place. Email/SMS suggestions remain editable and require an explicit send. |
| Work controls | Shared owner, Needs reply, Waiting, Done and deliberately scheduled reminders. A new customer reply reopens work; a note or saved draft does not count as a customer response. Delivery callbacks and STOP/START/HELP control messages update their own state rather than creating reply work. Ordinary unanswered messages do not manufacture overdue deadlines. |
| CRM context | Business/contact details, editable source-backed client brief, lead or opportunity stage, service interest, source, next appointment/follow-up, mockup preview/status and linked client/project. Provide useful links/actions into the existing sales and delivery records. |
| General correspondence | Receive and respond without forcing a lead. Deliberately link to an existing relationship or archive. Direct general-email-to-lead conversion remains future work. Ambiguous identities require review. |
| Desktop and phone | A compact conversation list, generous timeline with a persistent composer, and a collapsible context panel. Phone switches between Conversations, Thread and Details. Use Tailored Agents typography, colors and shared controls. |

Example: Devon opens an interested business, reads its earlier email and texts in the same thread, sends a text, adds an internal note and schedules a follow-up. Austin later sees that history and its mockup link. A later call and recording appear in that history rather than creating another inbox to check.

## Conversation architecture

The following records the foundation implemented with migration 0012 and the Mail discovery/history APIs. Calling and recipient/memory migrations extend it without changing the source-access boundary.

1. Add a canonical workspace-scoped CRM conversation with a stable relationship identity and common work state. Bind it to the correct contact and relevant lead/opportunity/client context. A company with several people is not automatically one conversation; unrelated work and restricted correspondence need separate contexts.
2. Add unique bindings for existing Mail address/thread and SMS number/thread identities. Preserve provider IDs, timestamps and existing send intents. Resolve exact, unambiguous contact identities or an explicit staff link. Company names, similar email subjects and guessed phone matches cannot merge histories.
3. Keep Tailored Mail as the email content/provider authority. Its mailbox/thread endpoints hydrate known threads; the implemented address-scoped metadata API supplies bounded cursor pagination, external participant identities, activity/message IDs and change/removal reconciliation. Recheck current grants independently and reconcile revoked sources. Track discovery progress and refresh state. Mail is separately deployed; its current acceptance and Jeffrey's assignments are in the current handoff. Do not cache email bodies merely to make a mixed timeline.
4. Apply filtering, ordering, counts and pagination across that read model. Initial shared search covers permitted contact/business identities and indexed address metadata; searching message bodies requires a separately implemented provider-aware query and must not be implied by the metadata index. Combining page one of Mail with page one of SMS cannot establish a complete team queue. During initial discovery or provider failure, show coverage/freshness accurately.
5. Resolve permitted source bindings for each request, load the corresponding provider/local events, and return a single chronologically ordered timeline. Support older-history pagination; a bounded recent window must be labeled accurately.
6. Move new relationship-level assignment, response state and reminders to the canonical record. Preserve existing owners/status/notes/drafts/reads during migration. Conflicting existing channel assignments require explicit reconciliation rather than an arbitrary winner.
7. Keep provider sending adapters and their durable recovery contracts. A composer switch must never create another outbound attempt, change an uncertain attempt's payload, or reinterpret a local note as a sent message.

### Access and existing data

Mailbox/number approval remains independent of CRM linking and assignment. Every timeline item, preview, attachment, search match and count must respect its source's current access. A teammate with SMS access cannot gain email history by opening the same customer. Revocation must take effect on the next request.

Existing email notes stay mailbox-scoped; linking their thread must not expose them to SMS-only readers. Private drafts stay private and channel-specific. Define the audience for new relationship notes explicitly. Retention and anonymization still apply through the existing maintenance process.

Keep the approved email scope: **sales@tailoredagents.com**, with Devon, Jeffrey and Austin using their confirmed Mail accounts. Keep the supplied Twilio number **+16785417725** and explicit number grants. This correction does not change sending preferences or activate providers.

## Implementation order and acceptance

**Implemented first increment: shared email/SMS/notes conversation workspace.** Migration **0012** introduces canonical relationship/source bindings and independently backfills existing channel histories, preserving their original collaboration data. The default Inbox now uses the three-pane workspace, authorized queue discovery, global indexed ordering/pagination and channel composer. Existing setup and provider acceptance continue independently.

Acceptance uses synthetic records and both same-user and different-user grants:

- A deliberately linked email thread and SMS conversation for one relationship appear in one queue row and one timeline, while unrelated contacts and general mail stay separate.
- Sending a text, replying to the correct email and adding a note work from that selected conversation. Channel changes preserve drafts, selection and history; uncertain sends still reconcile without a second create request.
- Mine/Team/Unassigned/Needs reply/Unread/Archived views, counts, global ordering and pagination remain correct across multiple provider pages. Customer replies reopen work; delivery/control events do not. Only deliberate reminders create a deadline.
- Email-only, SMS-only, read-only, revoked and other-workspace access return only permitted content and metadata. Existing narrower notes and private drafts do not widen their audience.
- Existing populated records, assignments, links, preferences, notes, receipts and send intents survive upgrade and restore; ambiguous/conflicting links are reviewable.
- Provider outage/discovery lag is visible without inventing an empty complete inbox or exposing stale unauthorized Mail content. Desktop/phone interactions and existing sales/auth/provider regressions pass.

**Implemented extensions:** integrated calling/voicemail, protected recordings/transcripts, reviewed follow-up tasks, contact-first entry, AI message suggestions and client briefs. **Remaining work:** general-email-to-lead conversion, richer email features (outgoing attachments, CC/BCC, signatures/templates), watchers/coverage and the account-assistant phase described below. These extend this workspace rather than creating another standalone mailbox product.

## Using the Inbox

- Start in **Team**, then select a conversation. **Mine**, **Unassigned**, **Needs reply**, **Unread**, **Archived**, **Reminders** and **Due now** describe work across the permitted indexed sources. Search covers contact/business names and external addresses, not uncached email bodies. Counts describe discovered records; discovery notices identify incomplete or unavailable sources.
- In **Customer details**, connect the correct contact, business and inquiry. Use **Combine conversations** to move another history into the destination relationship after review. The destination's assignment, work state and CRM context are retained; different contexts require explicit confirmation. Linking never grants Mail or number access. The existing histories stay separate until this deliberate action.
- Switch **Email**, **SMS**, **Call** and **Note** inside the selected customer. Unsent email/text survives channel switches. Explicit private draft saving remains available. A note's selected email/number audience controls who can read it, including after merging. Existing narrower notes and private drafts keep their access boundary. Accepted receipts are processed once; unknown sends retain their original request through refresh/channel changes.
- Assign a teammate and set work state in the context panel. A new customer reply reopens work; a confirmed outbound updates Waiting. Failed/unknown sends, delivery callbacks, opt-out controls, notes and drafts do not prove a customer response. Reminders require Needs reply and a deliberately selected future time; Due now surfaces elapsed reminders. Read state remains personal.
- Desktop uses a scrollable list/timeline/context panel with the composer anchored below the timeline. Phone switches **Conversations / Thread / Details**. A visible-tab refresh runs about every 20 seconds while idle, with a manual refresh control; typing and pending forms pause automatic refresh.
- **New conversation** opens the searchable contact/lead picker. Choose a person to reuse authorized history or start an email, SMS or call with saved details. Accepted first messages bind to the selected CRM person; missing email/SMS channels can be started within an existing conversation. Raw email/phone entry remains a secondary option. General-email-to-lead conversion remains future work.

Mail remains the email body/attachment authority. Deploy the latest Mail code before relying on unified email discovery/history; it adds signed cursor APIs using the existing **0037** schema and service secret. The discovery endpoint returns at most **25 threads per invocation** within the D1 query budget. Website discovery advances bounded sweeps and rotates approved addresses; vanished sources are hidden only after a complete sweep. Grant checks are independent and apply on every request. Provider outages hide unverifiable source data and show an availability notice.

Conversation queue pagination is 25 rows. For a relationship with many provider threads, connected-history pages load up to 20 permitted threads at a time with explicit coverage/Previous/Next controls. Each thread supports older-message loading; initial SMS history is the latest 200 messages, and email page size is bounded by Mail's count/byte budget. Save private drafts before changing reply threads or connected-history pages. Recent note reads are bounded to 200 entries per query. New notes expire after 24 months through the existing maintenance function; private draft and provider retention contracts are unchanged.

## Local verification

Historical evidence for the original unified Inbox release follows. Contact-first, AI-draft and client-memory verification is recorded in their dated sections; none of these totals represents a new run during documentation maintenance.

Verified October 21 with isolated synthetic data: **273 website code/PostgreSQL tests** across 26 files, including **22 unified-conversation database cases**, and **406 Mail code/SQLite tests**. The unified suite covers explicit linking/replay/conflicts, contact separation, source audiences, current grants, per-person reads, multiple metadata pages, missing sources, bounded reads during Mail outages, late delivery failure, deliberate reminders, older messages, more than 20 connected histories and permission changes while a mutation waits for its lock. Gateway tests preserve the existing Mail contract alongside the new APIs.

**16 unified Inbox desktop/phone browser checks** pass for the actual combined workspace, channel draft preservation (including a fresh draft after a confirmed send), explicit email/text/note actions, assignment/reminders, customer reply reopening, revoked and SMS-only access, viewers, uncertain-send recovery across refresh without duplicate creation, older email history and discovery beyond one metadata page. Accessibility and 320–1440px layouts are included. Synthetic previews: [desktop](previews/conversations-desktop.png), [phone](previews/conversations-phone.png). Mail's 12 Worker browser checks also pass, including the actual new signed-cursor API and revoked grants.

The populated PostgreSQL upgrade/dump/restore check preserves independent canonical/source backfills, scoped email notes/private drafts and SMS grants/drafts/unknown intents. These results verify local implementation; they do not establish provider activation or actual customer delivery.

All **10 existing email** and **14 existing SMS** browser checks pass after the compatibility and composer changes. The existing reporting/manual-lead/sales/operations suite passes **33 checks** with one intentional phone skip. A final desktop/phone layout check confirms the message body and Send control remain in the viewport, with no accessibility violations. Lint, strict types and the production build pass. Provider credentials, grants, routing and authorized live delivery remain separate activation steps.

## Website delivery

Website revision **8d23c1f2b44dee9fbe1f96d44f67250321eeb5af** deployed successfully at **01:19:19 UTC on October 22, 2026 (9:19:19 p.m. EDT on October 21)**, GitHub deployment **7241255271**, [Render deployment dep-dbcm8fc9v7es73bn4v1g](https://dashboard.render.com/web/srv-db6hod8473hc739q2uo0/deploys/dep-dbcm8fc9v7es73bn4v1g).

After delivery, public health, pricing, sign-in and Mail login return 200. Anonymous default/email/SMS Inbox requests return 307 to sign-in. Both POST-only SMS callbacks return 405 to GET. These checks establish website delivery and basic access boundaries; authenticated team/provider acceptance remains pending activation.

The website push includes Mail API source **4bdc828**, but it does not deploy the separate Mail Worker. Jeffrey's email activation handoff identifies that prerequisite. No production secrets, grants, messaging routes, customer messages, calls or recording settings were created or changed during this implementation.

Jeffrey's assignment remains email activation in [new jeffrey.md](../new%20jeffrey.md). The owner and Codex handle the unified workspace, Twilio, calling, recordings, transcripts and remaining agency development. [Communications setup](COMMUNICATIONS_SETUP.md) records current implemented provider behavior; [the agency roadmap](AGENCY_OS_ROADMAP.md) records release evidence and the active development order.


## AI message drafts (October 24, 2026)

Email and SMS composers have a small **Suggest message** button. Open it, optionally choose Introduce us / Suggest a reply / Set up a meeting or type a direction, then Generate draft. The suggestion goes directly into the editable message box and focuses it; there is no preview or Use draft step. No message is sent or saved automatically. Send remains a separate action. Useful, sourced client facts can be saved to the client brief as part of generation (see below). New emails also receive a suggested subject; reply subjects and recipients stay unchanged. Existing text is used as a starting point, and a suggestion is discarded if the recipient, subject or message changes during generation, sending begins, or its composer is unmounted. Unconfirmed sends and read-only accounts cannot use the assistant.

The server loads saved client/business details, lead inquiry and service interest, and at most 24 recent accessible SMS/email messages or available call summaries from the selected conversation (up to 20 accessible sources, each message capped at 1,600 characters). Internal notes, attachments and raw recordings/transcripts are excluded. Grants are checked before sending context to OpenAI and again before returning a draft. The assistant uses the existing general `OPENAI_API_KEY`, independently of call analysis and the dedicated SEO key/budget. `CRM_AI_DRAFTS_ENABLED=false` disables it; otherwise an existing key is sufficient. The original drafting feature needed no migration; client memory now adds migration **0020**. No new provider key, worker service, Meta or Twilio setup is needed.

OpenAI Responses uses `gpt-6.1-sol` with low reasoning effort, structured JSON, `store:false`, no tools, a 40-second timeout and 2,200 maximum output tokens. The owner approved the upgrade from Luna on October 24 to prioritize client-facing draft quality. Full prompt/response bodies are not logged or persisted. Client memory stores only bounded, sourced facts and evidence excerpts described below. Existing request-rate counters enforce 3 attempts per user/minute, 100 per user/24 hours and 300 per workspace/24 hours across app instances. Failed paid attempts count; no automatic retries. These are usage limits, not a dollar budget. Normal manual drafting/sending remains available when AI is unavailable or a limit is reached.

Validation uses synthetic OpenAI, Mail and Twilio transports: no real customer messages or paid AI calls. Coverage includes new-lead context, cross-channel history, grant loss before/after generation, viewer/foreign-workspace denial, atomic quotas, provider refusals/errors/oversized output, no auto-send, direct insertion and focus, preservation of edits made during generation, reply subject preservation, and desktop/mobile accessibility.


## Client brief and durable memory (October 24, 2026)

**Shipped foundation:** Inbox → customer → Customer context → **Client brief**. On a phone, use the **Details** tab. The brief shows dated facts, preferences, commitments and questions, with original evidence for AI takeaways. Add a fact with **+**, edit with the pencil, or remove it in the editor. Manual entries default to **Internal only**; select **Use in client message suggestions** for details appropriate to use when writing to that customer. Internal Inbox notes stay in their original history and are not silently copied into draft context.

- First outbound calls from the contact/lead composer now carry the selected recipient through the server intent, validate its current phone number and bind the new call history to that CRM record. Retries preserve call identity. Conflicting existing customer links are rejected. New inbound callers can match a unique lead as well as a contact; ambiguous numbers remain unlinked for the team to review.
- Analyzed calls automatically contribute short highlights and follow-up commitments through the existing recording worker. It copies only evidence-backed takeaways, without another AI request. Each run backfills at most 20 eligible, unexpired analyzed recordings. Old audio/transcripts that have already expired cannot be recovered.
- **Suggest message** reads up to 20 recent, draft-enabled saved facts in addition to its existing recent history. It can extract up to 8 new facts from the same response, using exact quotes from the accessible email/SMS evidence. There is no second provider request or independent paid background loop. Facts update when calls finish analysis or someone generates a message suggestion; incoming email/SMS alone does not run an always-on memory extractor yet.
- Memory follows the original channel source, including when histories are deliberately combined. Related threads can contribute saved facts only when explicitly linked to the same person; a shared business or phone alone is insufficient. Current channel grants apply to reading, edits and AI context. Draft generation rechecks both grants and memory revisions after the provider finishes. A correction or revocation during generation discards the derived draft.
- Exact evidence IDs/quotes are checked before saving. Edits are versioned and take precedence over replayed extraction of the same evidence. Removal clears fact/quote text and retains only a suppression marker until expiry, preventing the same evidence from restoring the removed item. Other evidence can still produce a related suggestion; removing a brief fact does not alter the original message.
- Memory is retained for **24 months from capture**, independently of the recording's 90-day media/analysis retention. Normal recording expiry preserves the short brief; explicit recording deletion also removes its derived brief entries. Deleting a linked lead or anonymizing its business clears derived memory. Expired memory is hidden immediately and removed by existing retention maintenance. The brief is a curated working record, not an archive of every message or permanent AI recollection.

Migration **0020_client_memory.sql** adds the source-scoped facts, deletion/anonymization hooks, recording capture checkpoint and retention wrapper. The normal Render pre-deploy migration applies it. Existing general OpenAI configuration and draft quotas remain unchanged. Additional context/output tokens can modestly increase the cost of an individual draft, even though the number of provider requests does not increase.

**Next phase:** build an account assistant on this foundation: reconcile completed/changed commitments, offer meeting preparation and missing-question suggestions, and create reviewed follow-up tasks using the existing My day queue. Then add bounded, event-driven refresh for incoming email/SMS, with explicit cadence and usage limits, and team-selected rules for automatic internal tasks. Automatic customer outreach, scheduling or changes to projects/billing are not enabled by client memory. Existing reviewed call-summary follow-up tasks remain available now.


Client-memory verification: **84 targeted code/PostgreSQL checks** pass, including the existing lead-deletion regressions. **10 relevant browser checks** pass across desktop/phone: message drafting and uncertain-send regressions, plus brief add/edit/remove, draft-context selection and accessibility in both light and dark themes. Lint, TypeScript and the production build pass. Tests use synthetic provider responses, not paid live AI or customer outreach.
