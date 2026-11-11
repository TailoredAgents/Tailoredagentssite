# Employee assistant: one delivery goal

Prepared November 10, 2026 for Austin, Devon, Jeffrey and the rest of Tailored Agents.

**Status: code implementation and local verification complete; production activation remains partial.** See the [release record and partner handoff](OPERATIONS_ASSISTANT_RELEASE.md). Mail deployment, real employee SMS acceptance and signed iPhone push remain open; code/test completion does not close those gates. This replaces the earlier overlapping phase lists; [the previous plan is archived](OPERATIONS_ASSISTANT_PLAN_ARCHIVE.md). Implemented behavior and verification remain in [setup and release notes](OPERATIONS_ASSISTANT_SETUP.md). The reviewed committed baseline is main `63dac95`, including assistant release `fab93f3`. Separate, uncommitted relationship and Meeting Inbox work was present during planning; coordinate with it rather than treating it as released or duplicating it.

## The single goal

Give every employee a dependable company assistant that can take an authorized assignment, keep working after the employee leaves, use permitted company information and documents, prepare useful files and communications, and notify the right employee when work finishes or needs attention.

Deliver recommendations **1–5** under this goal. Employee **SMS alerts ship first** while the mobile app is not ready for push. Extend the existing iPhone app with native push, then make push the preferred channel for employees with a verified setup. SMS remains an explicitly selected fallback. Recommendation **6, external apps**, waits for Austin to identify the applications and tasks.

The assistant supports selling and servicing AI agents, document automation and websites. Austin remains responsible for designing, programming and deploying custom client AI systems and workflows. The assistant may organize requirements, prepare documents and coordinate the work; it does not build those client systems.

The shared company AI allowance remains **$25/month**. Ordinary SMS/call charges remain separate. Existing grants, customer opt-outs, exact email approval, employee-connected calling, Website Builder approvals and independent budgets stay in force.

## What employees should experience

An employee asks: “Review these discovery notes and documents, prepare a client brief and follow-up draft, and remind me if I have not acted tomorrow.”

The assistant shows the saved assignment and its progress. It processes permitted files, cites the evidence, creates the brief as a downloadable file, and prepares the reply in the correct conversation. The employee can close the app. A short SMS, and later a push notification, links back to the work when review is needed. The employee reviews the exact recipients, message and attachment before sending. The assistant records the actual outcome and creates a real follow-up task when requested.

Every employee has their own conversations, preferences and delegations. Shared company knowledge is deliberately published and permissioned. Changing a CRM association does not automatically share a private chat, recording or document.

## Build on what exists

| Foundation | Current implementation | Remaining work in this goal |
| --- | --- | --- |
| Background chat | PostgreSQL queue, leases, saved responses, tool checkpoints; recovery through the existing five-minute cron; bounded turns | Durable assignments spanning bounded turns, explicit authority independent of browser sign-in, a work list, employee alerts and operational visibility |
| Routines | Explicit daily/weekday/weekly schedules, pause/resume, private results | Longer-lived scoped delegation, event-triggered follow-up, useful templates and notifications |
| Knowledge | Private saved facts and search across retained personal chats; permissioned business record tools | Uploaded document retrieval, published company knowledge, versioned sources and correction/removal |
| Communications | Opted-in SMS, exactly reviewed new email, employee callback calls; existing Inbox has thread logic | Native chat replies, attachments, inline review, unified outcome display and short voice dictation |
| Booking notices | Native assistant consultation changes atomically enqueue customer SMS | Reuse delivery discipline for employee alerts; retain the explicit limits of the current booking feature |
| iPhone | Existing UIKit/WebKit app with Mail/Dashboard tabs and authenticated downloads | Native APNs registration, account/device binding, push handling, signing and physical-device validation |
| Mail push | Separate Cloudflare Mail service has web-push subscriptions | Preserve it; web push is not proof that the native iPhone app supports APNs |

Primary code: [assistant services](../lib/assistant/), [assistant UI](../components/assistant-chat.tsx), [Inbox](../lib/inbox/), [employee SMS alerts](../lib/sms/alerts.ts), [iPhone app](../apps/ios/README.md), [Mail push](../apps/mail/src/lib/server/push-notifications.ts). Keep the [code-derived capability inventory](OPERATIONS_ASSISTANT_COVERAGE.json) truthful as implementation changes.

## Delivery order

These are milestones within one goal, not independent products or new agents.

| Milestone | Employee benefit | Depends on | Exit evidence |
| --- | --- | --- | --- |
| A. Confirm the baseline | Existing capabilities remain dependable | Current assistant release | Exact deployed versions, worker health, permission and budget checks recorded |
| B. Reliable assignments and SMS | Work continues, progress is visible, employee gets useful alerts | A | Browser-close/restart recovery, scoped delegation, private notifications, tested staff SMS |
| C. Mobile push | Alerts open the correct assignment on iPhone | B notification contracts | Native code, signed build, real-device receipt/navigation and fallback tests |
| D. Documents and finished files | Upload material and receive useful downloadable outputs | B queue/storage/access contracts | Representative file fixtures, citations, rendered outputs, failure/cost/deletion checks |
| E. Company knowledge | Reliable shared answers alongside private employee memory | D ingestion and source permissions | Published source versions, citations, correction and cross-user access tests |
| F. Proactive follow-up | Relevant work is surfaced without repeated prompting | B; E for knowledge-backed briefs | Event deduplication, useful brief/follow-up flows, cancellation and quiet-hours tests |
| G. Complete chat communications | Reply, attach, review, send and see outcomes in chat | B and D; existing Mail services | Thread/attachment approval, send recovery, voice-note and callback acceptance |
| H. Team rollout | Austin, Devon and Jeffrey can use the whole experience | B, D, E, F, G; C for push activation | End-to-end employee journeys and release record |

Implement B before adding more tools. Build C against the existing app, but do not hold document, knowledge or communication development while waiting for Apple signing/device access. H can release with SMS while C's activation gate is pending; the **full push milestone remains open** until verified.

### A. Establish a trustworthy baseline

Confirm the current Render release, migrations, cron invocation and Mail deployment against their exact commits. Existing local tests establish readiness; they do not establish live provider delivery or native push.

Record queue age, failed/unknown work, active workers, AI allowance/reservations and provider configuration without logging private message bodies or secrets. Exercise representative existing chat, routine, review and booking paths in isolated fixtures before extending them. Use designated employee test destinations for any subsequent live messaging acceptance; never use a real prospect merely to generate a test event.

Recheck the shared tree before each migration or commit. Coordinate migration numbering with the active relationship/Meeting Inbox work. Read the relevant installed Next.js documentation before modifying its routes, lifecycle or caching behavior.

### B. Reliable assignments, authority and employee SMS

#### One saved assignment and work list

Extend the existing queue rather than introduce another scheduler. Each assignment records its owner/workspace, original request, bounded plan, dependencies, current step, checkpoints, outputs, authority, cost ceiling, cancellation state and action receipts.

Provide a phone-friendly **My work** list beside chat: queued, working, waiting for input, waiting for review, blocked by access or allowance, paused, completed, failed and outcome unknown. Show the reason and the next useful action. “Completed” requires an actual result or receipt; generating a plan alone does not complete an execution request.

Continue long work through bounded turns under a single assignment ceiling. Do not bypass the current step limit by giving each continuation a new unlimited budget. Serialize conflicting work for the same record, keep fair employee scheduling and bound workspace concurrency. Start with the existing queue, quick request-driven advancement and five-minute recovery cron. Measure backlog before adding another hosting service or promising faster recovery.

Stop/pause prevents future steps; already-issued provider actions may finish. Preserve their receipts. Restart resumes from the last confirmed checkpoint. Unknown paid requests and uncertain sends/calls require reconciliation, never blind replay. Alert once when intervention is needed.

#### Explicit background delegation

Current authority expires with the real dashboard session. Add a purpose-specific, employee-approved background delegation rather than removing those checks or inventing a browser session.

Store owner, workspace, selected scopes/actions, resource restrictions, expiry, revision and revocation. Proposed initial consent duration: **30 days**, visible and renewable by the employee. This is a product default to verify during implementation, not an existing permission. Recheck active membership, current source access and current delegation before every step. An employee can revoke one assignment, all background work or the underlying grant. Account suspension/password-reset policy must revoke dependent authority.

Make sign-out behavior clear: only explicitly authorized background work may survive ordinary browser sign-out; **stop all background access** must remain available. Revocation or expiry blocks future work and suppresses private outbound alerts, except a generic reconnect notice where policy permits.

Mail steps need a real Mail-issued, scoped background credential with introspection/revocation. Extend the separate Mail service deliberately. Never substitute a service credential for an employee or fabricate the session-bound Mail identity. Until that contract exists, block only the affected Mail step and show reconnect/review instructions. Preserve the existing external MCP connection semantics unless separately migrated with consent.

#### One notification record, multiple delivery channels

Introduce a shared employee notification service. Producers save an event in the same transaction as the relevant assignment/domain change, then a worker delivers it. Customer booking notices and customer messages retain their separate purposes and permissions.

Proposed records:

| Record | Required ownership and state |
| --- | --- |
| Assignment | Workspace, authorizing employee, versioned plan/steps, bounded allowance, delegation, state and receipts |
| Employee notification | Workspace/recipient, event/source/version, safe summary, trusted destination, category, expiry, read/resolved state and deduplication key |
| Delivery attempt | Notification, channel/device, claim/lease, stable request identity, provider ID, attempts and accepted/delivered/failed/unknown state |
| Employee preferences | Verified phone, SMS opt-in, categories, time zone, quiet hours, digest and fallback choices |
| Push device | Employee/workspace, installation binding, app/environment, protected token, permission/registration state, last verification and revocation |

Names are architectural proposals, not a reserved migration number. Keep domain transactions small; provider calls occur after durable claims.

**Initial alert policy:**

- Keep an in-app notification feed regardless of external delivery.
- Send SMS for review/input needed, failed work requiring attention and explicitly requested completion notices. Group routine completions into a digest; do not text every reasoning step.
- Each employee opts in and verifies their own phone. An existing call callback number may be offered for selection but must not silently become an alert subscription.
- Start with configurable quiet hours of **9 PM–8 AM in the employee's time zone**, initially America/New_York. Allow explicitly selected urgent categories; delayed notices must still be relevant at dispatch.
- Proposed starting caps: ten immediate alerts per employee per day and fifty per workspace, with overflow summarized in the feed/digest. Verification attempts also need rate limits. These caps control volume, not a guaranteed dollar cost; track segments and provider charges separately.
- Use concise, preferably single-segment templates such as “Your assistant needs review. Open Tailored Agents: …”. Do not place customer messages, documents, secrets or financial details on a lock screen.
- Links open an authenticated, authorized dashboard record. They are not bearer approval tokens. Expired sessions sign in first; revoked record access denies the target.
- Coalesce repeated events, suppress superseded/resolved work and avoid loops from the assistant's own actions. Coordinate with existing incoming-SMS/lead alert settings so one event does not produce competing alerts.
- Honor employee notification opt-out and provider suppression. Route STOP/START correctly without creating a customer prospect or treating a staff reply as an assistant instruction. A staff SMS reply is not approval to send a customer email.

Reuse the durable delivery and signed-callback patterns in `lib/sms/alerts.ts`; its existing single-recipient configuration is not a per-employee notification system. Avoid routing staff alerts through customer conversation/lead-introduction code.

Validate Twilio callbacks against the expected account, sender, recipient and provider message ID. Track out-of-order callbacks and uncertain submission. Provider acceptance, delivery and human reading are different states; SMS can be billed in multiple segments. [Twilio Message resource](https://www.twilio.com/docs/messaging/api/message-resource).

**B acceptance:** closing the browser and restarting the worker preserves progress; revocation stops subsequent effects; duplicate events/retries do not duplicate alerts or actions; a stale review request is not texted; quiet hours/DST and STOP work; one employee never receives another's private work. A real opted-in employee receives a test alert and opens the correct authorized assignment.

### C. Extend the existing iPhone app with push

Use `apps/ios`, its UIKit/WebKit structure and `com.tailoredagents.workspace`. Keep Mail and Dashboard's separate sign-ins. Preserve authenticated attachments, origin restrictions and the app-switcher privacy cover. Do not replace the app with a new mobile framework.

Add a contextual notification-permission screen, APNs registration/error handling, device-token updates and foreground presentation/tap handling. Bind registration to the actual signed-in Dashboard account through an authenticated, narrowly scoped first-party bridge or endpoint. A user ID supplied by JavaScript is not identity. Reject messages from child frames or untrusted origins. Logout/account switch must remove the old device binding and never show the previous employee's private destination.

APNs requires an enabled app capability/App ID and appropriate signing entitlement; registration returns the app/device token, which may change. Verify the Apple team, provisioning and key setup rather than assuming the existing Sideloadly installation enables push. [Apple registration guidance](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns).

Keep provider keys on the server. Implement distinct development/production delivery configuration, bounded expiry and collapse behavior, invalid-token removal and safe error reporting. APNs delivery is best effort; an accepted request does not prove the employee saw it. Keep work and unread state on the server. [Apple APNs request guidance](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns).

Update `apps/ios/scripts/create-project.py` alongside Swift sources, capabilities and entitlements; regenerate the checked-in Xcode project. Native changes require a signed rebuild and installation. A Git push or web deployment does not update installed iPhones.

**Channel switching:**

- Until push is configured and verified for that employee/device, use opted-in SMS.
- Once verified, prefer push for selected categories; keep the in-app feed authoritative.
- Missing permission or a definitively invalid token can use opted-in SMS fallback.
- Do not send a duplicate SMS merely because an accepted push is unread. Any urgent acknowledgement/escalation policy must be separately selected, delayed, deduplicated and capped.
- Disabling push or changing accounts updates routing immediately; queued deliveries recheck access and preferences before dispatch.

**C acceptance:** signed app tested on an actual iPhone in foreground, background and closed state; permission allowed/denied; token refresh/reinstall; expired session; wrong account; logout; safe navigation; duplicate/out-of-order provider responses; SMS fallback. Run existing native policy/UI tests on macOS/Xcode. Simulator payload injection alone does not prove APNs delivery. Keep SMS live until this gate passes; record missing signing access as an activation dependency, not as completed push support.

**November 10 implementation:** server APNs transport, verification challenges, account-scoped device registration/removal, owner-checked tap resolution, invalid-token handling and push-first/SMS-fallback dispatch are implemented. Native UIKit controls, Keychain installation binding, APNs delegate callbacks, safe destinations and first-party sign-out bridge are added; the generated project retains a default push-disabled free-account build. The owner confirmed only a free Apple account. No APNs credentials, paid enrollment or physical-device activation were performed. Forty focused server checks, both desktop/phone assistant browser journeys, typecheck/lint, the inventory check and an isolated production build pass. The isolated full suite passed 813 tests, with 593 environment-dependent cases skipped; the new Swift changes still require Xcode compilation/UI checks and signed-device acceptance. See `apps/ios/README.md`. C remains an activation gate, not a claim of live push delivery.

### D. Documents and downloadable work

Add attachments to native assistant chat and a file/result view linked to assignments. Use a dedicated assistant storage namespace with workspace/owner/access metadata, scoped content hashes, versioning and authenticated downloads. `lib/factory/storage.ts` offers storage patterns but its Factory key restrictions and permissions must not be reused as generic document access.

Initial format targets: PDF, DOCX, TXT/Markdown, CSV/XLSX and PNG/JPEG. Validate supported formats against actual parser libraries and fixtures before exposing them. Proposed initial bounds: 25 MB per file, five files per assignment and 100 PDF pages, with separate spreadsheet/image/resource limits. Display final measured limits in the UI.

Processing order: deterministic text/table extraction first, then bounded OCR or AI only when needed and allowed by the remaining company budget. Reject password-protected/unsupported files explicitly; show partial or uncertain extraction. Save source version, page/sheet/cell or image reference and extraction warnings. Treat document instructions as source content, not permission to run commands or contact customers.

Validate content signatures rather than trusting extensions. Bound archive expansion, pages, pixels, rows, parser time and memory. Disable macros, formulas that fetch external data and arbitrary embedded network access. Quarantine unvalidated content and choose a tested malware-screening strategy before allowing external forwarding. Do not execute uploaded programs. Keep parser failures recoverable without charging again for confirmed work.

Produce real versioned **PDF/DOCX briefs and CSV/XLSX tables**, with previews and downloads, using deterministic templates for formatting and calculations where practical. A chat answer alone is not a finished file. Link outputs to source versions and record generation state; review sample renderings and spreadsheet values, including blank/long data. Preserve the iPhone's authenticated download/share-sheet behavior.

Private upload is the default. Explicitly share to an allowed employee/team/project audience; linking a client does not silently widen access. Recheck permission for processing, retrieval, download and attachment sending. Proposed temporary-file retention is 90 days; deliberate published knowledge has its own retention/review policy. Show expiry and allow deletion. Deletion removes or invalidates derived text, indexes, cached results and pending processing; retain only permitted audit metadata. Explain any separately retained original chat/action record.

Consume permitted meeting transcripts through the evolving [Meeting Inbox services](CRM_BUSINESS_REFINEMENTS.md) when available. Do not build a second Meeting Inbox or spend the assistant allowance on long-recording ingestion. Meeting processing and Omi integration have their own scope and activation decisions.

**D acceptance:** representative supported files produce source-linked results and usable downloads; malformed/oversized/hostile files fail safely; private/cross-workspace access is denied; restart does not lose uploads or blindly rebill; deleting a source prevents later retrieval; output checks establish actual usability on desktop and iPhone.

**November 10 implementation:** private uploads, persisted extraction, source/version references, explicit employee/workspace sharing, authenticated downloads, generated PDF/DOCX/CSV/XLSX results, one-page visual reading charged to the existing allowance, 90-day expiry and transitive deletion/access invalidation are implemented. The measured limits and exact format support are in [the document guide](OPERATIONS_ASSISTANT_DOCUMENTS.md). Desktop and phone browser upload → cited brief → download → delete journeys passed. Independent document/spreadsheet readers and rendered PDF checks passed. Original upload forwarding is disabled; communication attachments must use data-only regenerated outputs unless a tested malware scanner is added. Sixteen document checks and thirty chat integration checks passed. The isolated full suite passed 822 tests (601 environment-dependent cases skipped), and the isolated production build, typecheck, lint and capability inventory checks passed. Physical iPhone acceptance and live release checks remain separate gates.

### E. Shared company knowledge with sources

Build a small company knowledge area on D's ingestion and the existing private memory service. Start with service descriptions, approved discovery guidance, operating procedures, reusable document templates and staff-confirmed business facts. Reuse CRM as the source for changing customer/project state.

Each knowledge entry has an owner, audience, source/document version, effective/review date and draft/published/superseded/archived state. Authorized employees publish it explicitly. Do not automatically convert private chats or generated guesses into shared truth. Keep personal preferences editable and separate.

Retrieve only permitted active versions, with access checks before search and before use. Start with indexed text/metadata search and source links; add semantic retrieval only if evaluation shows a material benefit within the allowance. No new external vector service is required by this plan.

Answers cite the source version and location. Approved current guidance takes precedence over old conversational recollections; unresolved contradictions are surfaced instead of silently reconciled. Outdated pricing or policies prompt review. Unknown facts stay unknown. Correction, withdrawal, permission changes and deletion invalidate derived indexes/caches and future answers.

**E acceptance:** two employees can share approved guidance while private notes remain isolated; source citations resolve; conflicting/stale facts are identified; revoked/deleted entries cease appearing; an employee can correct a mistaken preference without it reappearing from a cached summary.

**November 10 implementation:** versioned private drafts, explicit author publication, workspace/selected-employee audiences, source retention and immutable citations, indexed retrieval, overdue/overlapping-topic warnings, corrections, withdrawal, derived-file removal and cached-work invalidation are implemented. Private preference corrections refresh subsequent model context and discard a pre-correction cached response before its action executes. See [company knowledge](OPERATIONS_ASSISTANT_KNOWLEDGE.md). Eleven knowledge checks, sixteen document checks and thirty-one chat integration checks pass. Desktop and phone publication → correction → withdrawal journeys pass; the phone result was visually inspected. The isolated full suite passed 823 tests (612 environment-dependent cases skipped), and production build, typecheck, lint and the capability inventory passed. The inventory check now tolerates Windows line endings without weakening its content comparison. Production rollout remains part of H.

### F. Useful proactive follow-up

Use transactional business events and deterministic due-date queries, not constant model polling. Initial triggers: a permitted customer reply, an overdue assigned task, an approaching or changed meeting, a blocked project/milestone, and an assistant assignment needing intervention.

An employee deliberately enables each routine with scope, schedule/event, permitted actions, notification choice and cost limit. Provide simple templates: morning priorities, meeting preparation, unanswered follow-ups and a weekly work summary. Existing arbitrary saved routines remain available within their permissions.

Persist event ID/source revision and execution identity; debounce related changes, respect time zones and skip stale/resolved conditions. Recheck source access at execution and notification time. Evaluate cheap rules first; reuse a brief only while its source versions and access remain valid. Bound paid analysis per event/day.

Default behavior prepares a draft or recommends a next action. Real CRM tasks use existing assignment services and eligible assignees; a sentence in chat is not an assigned task. Customer messages still follow channel permissions, opt-outs and exact email review. A customer reply, document or transcript cannot expand the routine's authority.

Coordinate with existing staff SMS/lead alerts and booking outboxes. Keep employee work reminders distinct from customer appointment messages. Broader automatic notifications for manual Calendar changes are a separate follow-on unless deliberately added and tested across all booking paths.

**F acceptance:** one event produces one useful run despite replay; completing a task cancels its pending reminder; brief sources match current permissions; noisy events coalesce; no duplicate customer outreach; stopped routines stay stopped; allowance exhaustion yields a clear blocked result and one appropriate alert.

**November 10 implementation:** opt-in templates, event watches, time-zone schedules, daily/per-run allowances, persisted scan/run/source identities, source rechecks, private historical briefs and notification controls are implemented. Templates have a read-only business tool catalog; custom routines preserve existing permissions. See [routines and follow-up](OPERATIONS_ASSISTANT_ROUTINES.md). Fourteen proactive database checks and sixteen document checks pass; the existing chat and employee notification/push suites also passed during integration. Desktop and phone enable → edit → pause journeys pass in an isolated checkout, with the phone layout inspected. The isolated full suite passes 823 tests (626 environment-dependent cases skipped); production build, typecheck, lint and the capability inventory pass. No employee routine or live external alert was created. Production worker/employee activation remains H.

### G. Complete communication inside chat

Reuse existing Inbox/Mail, SMS and call services. Finish the chat experience around those services rather than add a parallel sender.

**Email threads and attachments:** read the current thread, derive permitted sender and actual reply recipients from message identity, and preserve subject/reply headers. Offer reply/reply-all deliberately; never expose hidden recipients or accidentally reply to the employee's own outbound address. Bind review to the message/thread revision, sender, exact To/CC/BCC, subject/body and immutable attachment hashes. Edits or changed thread targets invalidate approval.

Extend the separate Mail transport and attachment contract with scoped file access, size/type checks and idempotency before exposing the feature. Attachment forwarding is included in the exact human review. Never let the model approve its own message. Preserve all per-mailbox and shared-sender grants.

**Inline review and receipts:** show the exact message and files in chat, with edit, approve, cancel and status controls backed by the existing action service. Review endpoints verify the actual user and current revision. Record queued, accepted, delivered where supported, failed and unknown separately. Reconcile through saved provider IDs; checking status must never resend. Display what the provider actually proves.

**Short voice notes:** explicit press-to-record, clear recording indicator, short bounded clips (initial target two minutes), transcription preview/correction and normal Send. Verify spoken names, phone numbers and amounts before action where ambiguous. Include transcription in the $25 allowance and retain/delete clips under a visible policy. This is dictation, not ambient recording, live meeting capture or an AI voice calling customers.

**Calls:** keep the employee-connected call flow: the selected employee answers and presses 1 before the customer connects. Show initiation, connection/failure and the saved receipt in chat. Never switch to autonomous AI voice.

**G acceptance:** correct reply routing from inbound and outbound messages; stale/edited approval rejected; attachments match the reviewed hashes; lost permission blocks send; provider timeout cannot cause duplicate send; voice correction works on desktop/mobile; callback behavior remains unchanged.

**November 10 implementation:** replies/reply-all, generated-file attachments, exact inline editing/reapproval, read-only receipt reconciliation and bounded voice dictation are implemented. See [communications evidence and deployment order](OPERATIONS_ASSISTANT_COMMUNICATIONS.md). Ten desktop/phone journeys and the targeted communication/voice/Mail suites pass with synthetic providers. Austin cannot access Cloudflare; his partner must deploy the separate Mail release before enhanced Mail/background activation.

## Budget, performance and privacy throughout

Use the existing shared reservation/settlement ledger for all assistant model/tool/OCR/dictation costs. Reserve conservatively before work, reconcile actual usage and retain unknown charges until resolved. Track employee, assignment and feature so the owner can see what used the allowance. A continuation or retry inherits the original ceiling.

Keep notification routing, schedules, template formatting and routine condition checks deterministic. Cache permitted extraction by scoped source/version, not globally accessible file hash. Stop expensive work clearly when allowance is insufficient; keep saved results and cheap reminders available. Do not promise unlimited document processing or daily research for the whole team within $25.

SMS/call spend, storage and any Apple account/distribution costs are separate from AI. Prefer existing infrastructure, expose SMS usage/caps and make any new paid service or limit increase a concrete activation decision. Never treat the AI allowance as permission to enable another paid service.

Minimize notification content and audit payloads. Credentials, device tokens and session secrets never reach the model or client logs. Apply source-level access to artifacts, search, summaries, events and alerts. Preserve existing audit retention while defining retention for the newly added file/device/delivery records.

## Verification and rollout

Use additive migrations and feature flags for delegation, employee SMS, push, document processing, shared knowledge, proactive routines and enhanced communications. Disabled features leave existing chat/CRM/Inbox paths functional. Pause or disable workers without deleting queued evidence; never roll back by replaying uncertain outbound actions.

Test in isolated databases and storage with synthetic providers first. Required cross-cutting cases:

| Risk | Evidence required |
| --- | --- |
| Worker crash, duplicate cron, stale lease | One confirmed side effect; resumed work uses saved results and receipt identity |
| Access revoked during work | Next read/action/download/notification denied; no cross-user or cross-workspace leakage |
| Provider accepted but response lost | Unknown state retained, reservation held, no automatic resend/rebill |
| Budget exhausted or concurrent requests | Shared ceiling enforced, fair bounded execution and understandable blocked state |
| Noisy or stale events | Deduplication, expiry, quiet hours, DST and resolution suppression |
| Document injection or malicious upload | No permission escalation/external action; bounded parser behavior |
| Edited review or attachment | Exact approval invalidated; no stale recipients or replacement files |
| Mobile identity change | Correct account/device binding, private destination denied, SMS routing updated |
| Source correction/deletion | Retrieval, caches, queued work and generated citations honor current policy |

Run meaningful targeted unit/database/browser tests, then required type/lint/build checks. Run iOS policy/UI/build tests on macOS and physical APNs acceptance separately. Update coverage inventory, setup notes, configuration examples and release evidence for the exact final commit; clearly label simulated versus live checks.

Roll out to Austin with controlled employee test destinations, then Devon and Jeffrey with their own preferences/permissions, then the wider team. Confirm notification usefulness and actual costs before broad activation. Web/Render, Cloudflare Mail and native iOS are separate deployables; record each version and any manual activation gate. Commit focused, verified increments directly to **main**, preserving collaborators' work, then push without rewriting shared history.

## Completion checklist for this one goal

November 10 progress: the first implementation increment adds the employee work list, durable notification feed and opted-in SMS with verification, quiet hours and receipts. See [the release notes](OPERATIONS_ASSISTANT_SETUP.md) for evidence. Independent 30-day background delegation is also implemented and locally verified; bounded assignments, saved plans, pause/resume, review/input waiting and per-assignment spending ceilings are implemented. Production activation and real employee alert acceptance remain open. Document and knowledge implementation passed local acceptance. Proactive routines also passed local acceptance. Chat communications passed local acceptance. Native push activation and live team rollout remain open. Austin confirmed only a free Apple account is available, so signed physical-device push acceptance requires future Developer Program enrollment.

- [ ] A: Baseline health and current production acceptance recorded.
- [ ] B: Durable assignments, independent scoped delegation, work list and employee SMS pass acceptance.
- [ ] C: Existing iPhone app supports native push, with signed physical-device delivery and fallback verified.
- [x] D: Supported uploads produce useful, source-linked downloadable files (local acceptance; live/iPhone rollout remains H).
- [x] E: Shared knowledge is published, cited, correctable and permissioned (local acceptance; production rollout remains H).
- [x] F: Opted-in proactive routines are useful, bounded and deduplicated (local acceptance; employee activation remains H).
- [x] G: Replies, attachments, inline review, delivery states and voice dictation pass local acceptance; separate Mail deployment and real iPhone acceptance remain H.
- [ ] H: Employee end-to-end journeys, cost controls and staged rollout are accepted.
- [ ] Exact changes, deployment state and remaining activation dependencies are recorded; verified commits are pushed to main.

The planning deliverable is this document. Implementation is complete only when the corresponding checklist gates pass; a plan, passing mock, deployed web page or generated unsigned IPA is not a substitute.

## Explicitly deferred

- Recommendation 6: new external application connectors, arbitrary logged-in browser/computer control and any selection of external apps on Austin's behalf.
- Programming/deploying custom customer AI systems or automation workflows.
- Autonomous AI voice calls, bulk marketing campaigns, commission/payment automation and widening existing permissions without employee consent.
- A replacement mobile app, Android client, offline mailbox synchronization or unified Mail/Dashboard sign-in.
- Long meeting recording/transcription and Omi ingestion under the assistant allowance; coordinate separately with [CRM/Meeting Inbox work](CRM_BUSINESS_REFINEMENTS.md).
- Broad Website Builder/SEO/settings parity from the historical backlog unless separately requested. Preserve those existing features and their budgets.

No employee needs to choose external apps for milestones A–H to move forward. Apple signing/provider configuration and verified employee destinations are concrete activation dependencies to resolve when the implementation is ready to test.
