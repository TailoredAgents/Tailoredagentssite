# Tailored Agents Operations assistant — full implementation plan

Status: **Implementation in progress. Connection, read tools, reviewed internal proposals and private goals implemented; full phases 0–7 and real ChatGPT acceptance are not complete. No new routine or autonomous sending enabled.**
Owner: Austin. Prepared November 2, 2026, America/New_York.
Baseline reviewed: main `19daac8`, including the November 1 Mail and Eastern-time releases.

## November 2 implementation checkpoint

The first implementation adds `/api/mcp/operations` and `/dashboard/assistant`. Austin selected the existing ChatGPT bot connected to Tailored Agents Mail as the first client. Operations is a separate OAuth connection; it does not replace Mail or expand Mail permissions.

Implemented in this increment:

- Resource-bound OAuth authorization-code flow, S256 PKCE, dynamic client registration, rotating hashed refresh tokens, replay-family revocation, explicit scopes and live membership/account checks.
- Business read tools across leads, clients, contacts, sites, projects, sales, permitted Inbox/call history, calendar, Smart Cards, Builder, sanitized SEO and integration/reporting data. Responses expose collection limits and source availability; oversized records fail explicitly instead of silently truncating.
- Eight reviewed proposal types: private goals, create/update opportunities, internal sales notes, new follow-ups, mockup requests, conversation notes and time blocks. The bot cannot approve its own proposal. Exact content hashing, idempotency keys, owner-only review, expiry and receipts prevent duplicate execution; uncertain attempts are never automatically retried.
- Private goals with owner/workspace isolation and revision checks; a phone-friendly Assistant page for connections, pause/revoke, review, receipts, read activity and goals.
- Code-derived action/transport inventory in [OPERATIONS_ASSISTANT_COVERAGE.json](OPERATIONS_ASSISTANT_COVERAGE.json). Pending and partial rows remain real work, not completed handoffs. Run `node scripts/assistant/coverage.mjs --check` to detect inventory drift.
- Audit metadata and retention. Customer content is removed from old action receipts after 90 days; receipt metadata remains for one year. Used refresh hashes remain until expiration to detect replay.

Temporary connection constraint: Operations deliberately binds to the real dashboard sign-in used at consent and expires with it (currently up to 14 days). Sign-out, lost Mail identity access or suspended membership stops access. A separate long-lived identity delegation requires a reviewed Mail-side addition; no service credential may be used to impersonate a user. That work is still outstanding, as are actual ChatGPT connection and renewal acceptance. The Assistant UI states this limitation.

Still pending: full CRM/project service extraction and revisions; staff booking/rescheduling/cancellation; reviewed SMS/shared Mail; call controls; full Builder/SEO/card mutations; personal preferences/commitments; durable routines; complete exports/reports and parity checks. Existing Mail sends, channel grants, build approvals and spend limits remain unchanged. See the coverage inventory and phases below.

Verification and live deployment evidence are recorded in [Operations setup](OPERATIONS_ASSISTANT_SETUP.md). This checkpoint does not declare any phase with unmet live acceptance gates complete.

## Product mandate

Austin requested a fully built-out bot that can work across the business on his behalf, rather than a small read-only CRM integration. Build account-wide operational coverage: understand context, maintain records, coordinate people and projects, manage scheduling, prepare and execute authorized communications, operate existing website/SEO workflows, monitor failures, and track personal goals. Deliver it in verified increments without treating the first increment as the completed product.

“Act as me” means a revocable delegate of the signed-in person. It never means a fabricated human identity, using another teammate's credentials, ignoring existing channel grants, or claiming work happened when it only produced a draft. Audit records must preserve both the authorizing user and the assistant that acted. Existing provider restrictions and host-client approval requirements still apply.

This document is the implementation backlog. It does not grant new OAuth permissions, enable unattended sends, approve a particular website plan, spend additional money, or create scheduled jobs. No new runtime feature is claimed by this planning commit.

## What is already available to build on

| Area | Source of truth | Existing foundation / required adaptation |
| --- | --- | --- |
| Identity and roles | `lib/dashboard/data.ts`, `lib/dashboard/mail-identity.ts`, workspace memberships | Browser sessions and Mail-backed account checks exist. Add bearer-token delegated identity without manufacturing a browser session. |
| Mail MCP | `apps/mail/src/lib/server/mcp*.ts`, `apps/mail/MCP_SETUP.md` | OAuth, owned-mail read/send/manage, drafts, attachment chunks, revocation and atomic sending limits. Preserve the separate Worker and ownership-only Mail MCP scope. Shared CRM mail has separate grants. |
| Leads, clients, contacts, sites, projects | `lib/operations/data.ts`, `lib/operations/actions.ts` | Existing CRUD, project milestones, decisions and deliverables. Much mutation logic is embedded in browser server actions: extract shared, authorized services before exposing tools. |
| Sales and calling lists | `lib/sales/data.ts`, `lib/sales/service.ts` | Opportunities, tasks, activity, imports, channel preferences, mockup queue and conversion. Add exhaustive cursor-based reads and typed adapters; don't turn capped dashboard lists into business-wide reports. |
| Unified Inbox and customer memory | `lib/conversations/`, `lib/inbox/` | Channel-aware history, assignment, notes, source-backed briefs and drafts. Preserve per-mailbox/line grants and explicitly report unavailable sources. |
| SMS and calls | `lib/sms/`, `lib/voice/` | Messaging, call control, voicemail, recordings, analysis and evidence-backed follow-up tasks. Provider state, consent, delivery outcomes and call-device prerequisites remain authoritative. |
| Central calendar | `lib/booking/`, `lib/time.ts` | Daily 8 AM–7 PM Eastern availability, half-hour slots, two-hour notice, booked slots and CRM appointment conflicts. Add staff booking/rescheduling APIs through one shared transaction path. |
| Smart Cards | `lib/smart-cards/`, `components/smart-cards/dashboard.tsx` | Profiles, permanent redirects, QR/artwork, inquiries, engagement and AI allowance. Extract settings mutations and add reporting with documented attribution. |
| Website Builder | `lib/factory/`, `docs/WEBSITE_BUILDER_STANDARDS.md` | Planning/chat, exact human approval, bounded builds/repairs, previews, draft edits, artifacts and diagnostics. Expose staff operations, not internal worker claim/finish/lease APIs. |
| SEO and reporting | `lib/seo/`, `lib/reporting/`, `lib/search-console/` | Reports, sync state, bounded SEO runs, reviewed metadata publication and rollback. Broader content publishing is not implemented merely by adding MCP. |
| Integrations and introductions | `lib/meta/`, `lib/lead-intro/`, dashboard settings | Import status/retry, introductory-message queue and configuration. Report actual configured/live/disabled states; never activate a dormant campaign implicitly. |
| Mobile access | `apps/ios/README.md` | Existing private companion is a possible dashboard surface. Verify approval links work there; it is not proof that the user's conversational bot supports this connection. |
| New product work | No existing general goals/delegation/workflow subsystem established by this review | Add private goals, durable commitments, assistant preferences, permission policies, action receipts, scheduled workflows and the Assistant dashboard. |

## End-state coverage and authority

Every dashboard feature must appear in a maintained coverage manifest with one of: implemented tool, existing Mail tool, human handoff, separately scoped provider integration, or explicit product gap. No silent omissions and no generic SQL/shell/HTTP escape hatch in place of missing tools.

| Work | Bot behavior to implement | Approval boundary |
| --- | --- | --- |
| Read/search/brief | Read all records the connected user can access, search across sources, prepare meeting/customer/project briefs | Delegated read scope; no repeated approval for each authorized read. Bulk export is separately controlled. |
| Routine internal work | Create/update leads, contacts, notes, tasks, milestone records, drafts and user preferences; assign eligible teammates; mark work complete with a real outcome | Execute a clear user instruction within granted scope. Background changes require a saved, bounded workflow policy. Never turn inferred suggestions into commitments silently. |
| Calendar | Inspect free/busy; book/reschedule/cancel; block time; show proposed changes in Eastern | Clear direct instruction can authorize a specific internal change. Ambiguous attendee/time or externally communicated commitments require concrete review. Sending a notification is a separate recorded action. |
| Email/SMS | Draft/reply/forward, read attachments, maintain conversation work state; send reviewed content using an allowed identity | Preserve Mail's current approval-before-every-send and client write approval. Apply reviewed recipient/body/attachment binding to SMS. No wider autonomous outreach inferred from this plan. |
| Calling | Prepare calls; initiate an authorized call on an available supported staff device; inspect/end own call; read permitted recordings/transcripts | Confirm recipient and initiating-device behavior. This is staff call control, not an AI voice impersonating Austin; autonomous voice conversations are a separate product. |
| Website/SEO work | Research, plan, revise, inspect, queue eligible work, fetch artifacts, publish/rollback supported changes | Preserve exact human plan/version approval, cost ceilings, publication controls and bounded retry rules. One valid approval can cover its exact operation; don't ask again for identical approved content. |
| Settings/admin | Inspect health/configuration; change ordinary preferences; prepare owner settings changes | Access expansion, credential handling, security controls, permanent deletion and changes to spending limits require the corresponding human action/review. Secrets never appear in tool output. |
| Personal goals | Save goals, weekly targets, focus blocks, progress and preferences; link business work to goals | Private to the owner by default, even inside a shared workspace. Only explicitly shared goals enter team views. |
| Recurring work | Check replies, deadlines, bookings, stalled leads, delivery blockers, imports and build failures | Explicitly saved schedule, scope, actions, limits and notification destination. Quiet when unchanged; no monitor created merely because a plan lists it. |

The assistant must explain when information or an operation is unavailable. It must not imply that owner status alone grants every teammate's private mail, that a generated draft was sent, or that an accepted provider request proves delivery.

## Architecture decisions

### Separate Operations resource, shared business services

- Add a Node-runtime Streamable HTTP MCP endpoint to the existing Render application, proposed canonical resource `https://www.tailoredagents.com/api/mcp/operations`. Keep Mail MCP at its existing separate Worker endpoint. Final discovery URLs must match the deployed routing exactly.
- Use the supported MCP SDK and schema library; inspect installed Next.js route documentation before implementation. No long-running execution inside an MCP HTTP request.
- Proposed files: `lib/assistant/{auth,policy,registry,results,actions,audit}.ts`, `lib/assistant/tools/`, `app/api/mcp/operations/route.ts`, OAuth/discovery routes and `app/dashboard/assistant/`. Domain rules remain in their existing modules.
- Browser actions and MCP adapters call the same context-aware services. Extract mutations from `lib/operations/actions.ts`, Smart Cards actions and other session-only entrypoints. Each service authorizes current membership, channel access and the object being changed; a TypeScript context type is not proof of authorization.
- Existing public Smart Card AI stays isolated. Never give anonymous visitors internal Operations tools, private goals, staff credentials or unrestricted CRM search.
- Every tool has a narrow input schema, useful description, explicit read/write/destructive annotations, output schema, structured content and a compatible text representation. Advertise only permitted capabilities. Hints assist clients; they do not enforce authorization.
- Use domain-specific tools and small composite brief/report tools. Keep related families discoverable without dumping every record and every tool into every model request. Test actual client discovery rather than assuming tool filtering works identically across products.

### Delegated authentication

Implement resource-specific Operations OAuth in the Render/PostgreSQL app using the established Mail protocol design and existing dashboard login for consent. This avoids forwarding a Mail bearer token into a different resource or broadening Mail's existing grants. Share reviewed pure protocol utilities where appropriate; do not blindly copy a D1 implementation into PostgreSQL.

Requirements:

1. Protected-resource metadata, authorization-server metadata and canonical HTTPS resource/issuer; authorization code + PKCE S256; exact registered redirect URIs; explicit scopes and selected workspace on consent.
2. DCR or explicitly registered clients using the path proven by the existing Mail client. Do not enable arbitrary CIMD URL fetching without a separately verified safe implementation. Follow the exact callback shown by the real client.
3. Hashed bearer/refresh credentials; short-lived access tokens, rotating refresh tokens, replay detection and revocable grant families. No pasted owner API key or raw database credentials in a bot conversation.
4. Bind immutable subject, workspace, resource, client and grant; resolve the existing verified Mail/dashboard identity. Never trust a model-supplied user ID/email/role as authority or auto-provision privileged membership.
5. Recheck revocation, current active identity/membership, scopes and object/channel grants on every call and immediately before queued side effects. Define a bounded, fail-closed Mail account-state check for this non-browser path; revoked/disabled accounts cannot retain stale delegated access.
6. OAuth scopes by domain: core read/search, CRM write, conversations read/manage/send, calendar read/write, projects read/write, cards read/write, builder read/write/execute, SEO read/write/publish, reports read/export, goals read/write, workflows manage, settings read/write. Privileged approvals are distinct from granting a write scope.
7. Preserve the existing Mail connection, 100-per-user-per-Eastern-day assistant send limit and its send/manage consent. No historical tokens silently gain Operations or shared-mail access.
8. Austin can disconnect one assistant, revoke a domain or stop all assistant writes immediately. Jeffrey and Devon get independently consented identities and their own effective permissions when they connect.

Official references reviewed: [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth) and [MCP connections through the Responses API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp). The API guide supports transport, tool filtering and approval design; it does not prove the user's current phone/chat surface supports every tool. Validate the actual connected bot early.

### Action receipts and durable execution

- Reads return canonical IDs/links, source dates, fetched time, timezone, completeness/cursor and unavailable-source reasons. Bounded text/attachment chunks must indicate continuation and missing content explicitly.
- Mutations require a stable idempotency key, an expected record revision where relevant, validation and a saved result receipt. Retrying cannot duplicate a task, booking, email, paid build or import.
- For reviewed actions, prepare the exact proposal first: actor, recipients, content, attachment hashes, objects/revisions, cost ceiling and expiry. A human-authenticated approval records those details. Model-supplied `approved:true` is never proof. Approval consumption and execution must be atomic or durably reconciled.
- Initially use authenticated dashboard approval links when the client cannot supply verifiable approval evidence. Support host approvals where the implementation can verify and bind them. Do not force a second approval when a valid exact receipt already exists.
- Maintain `prepared / awaiting_approval / queued / running / succeeded / failed / outcome_unknown / cancelled` states. If a provider times out after accepting a send, reconcile its identifier; never blindly retry an uncertain side effect.
- Resolve recipient/contact ambiguity before execution. Revalidate a conversation's latest message, opt-outs, current grants, appointment availability and approved build version at execution time.
- Cross-system workflows are a series of linked receipts, not a pretend database transaction across Mail, PostgreSQL and providers. Report partial completion and compensate only where the operation is reversible and authorized.
- Evidence embedded in email, imported notes, transcripts, documents or websites is untrusted content, not instructions or authorization. Preserve source attribution and avoid carrying private notes into customer-visible output by default.
- Logs record intent, actor, tool, policy, resource IDs, result and correlation ID with appropriate redaction. Do not store raw tokens, duplicate entire mailboxes in audit, or leak private goal text through workspace activity.

## Tool catalog to deliver

Names below are proposed contracts, not live tools. Split tools further when access or approval semantics differ; do not expose an unrestricted `execute(action)` dispatcher.

| Family | Read / prepare | Write / execution | Important edge |
| --- | --- | --- | --- |
| Identity/discovery | `whoami`, `list_capabilities`, `get_limits`, `search_workspace`, `get_record` (enumerated types) | Consent/disconnect handled through trusted UI | Searches honor grants and return disambiguation candidates. |
| Leads/clients | `search_leads`, `get_lead`, `search_clients`, `get_client`, `get_contact`, `list_sites` | `create_lead`, `update_lead`, `add_lead_note`, `save_client`, `save_contact`, `save_site`, `convert_lead`, `prepare_lead_deletion` | Preserve canonical identity, retention and existing linked history. |
| Sales/lists | `search_opportunities`, `get_opportunity`, `get_daily_priorities`, `list_calling_lists`, `preview_import` | `create_opportunity`, `update_opportunity`, `log_activity`, `save_follow_up`, `complete_task`, `commit_import`, `set_channel_preference` | No inferred permission to contact; safe CSV export, source attribution and repeat protection. |
| Conversations | `search_conversations`, `get_conversation`, `get_source_history`, `get_customer_brief`, `get_attachment` | `save_conversation_work`, `add_note`, `save_reply_draft`, `update_customer_fact`, `prepare_conversation_link`, `prepare_conversation_merge` | Merge/link needs explicit identity review. Marking done is internal work state, not deleting the conversation. |
| Communications | Existing owned-Mail tools; `get_allowed_senders`, `get_sms_delivery`, `prepare_sms`, shared-mail read/draft through CRM | `send_reviewed_sms`, `send_reviewed_shared_mail`; existing Mail send/reply/forward remain canonical for owned mail | Never route through a second sender to bypass an approval, limit or channel denial. Shared-mail integration must explicitly cover permissions and assistant limits before enabling sends. |
| Calls | `list_calls`, `get_call`, `get_voicemail`, `get_transcript`, `prepare_call_brief`, `get_call_follow_ups` | `start_staff_call`, `end_own_call`, `request_call_analysis`, `create_call_follow_up`, reviewed recording deletion | Audio/analysis requires actual provider and device readiness. No export of browser voice tokens to a language model. |
| Calendar | `list_calendar_events`, `get_availability`, `prepare_booking_change` | `book_consultation`, `reschedule_appointment`, `cancel_appointment`, `block_time`, `remove_time_block` | All booking entrypoints share locking/conflict checks; appointment and notification results reported separately. |
| Projects | `list_projects`, `get_project`, `get_delivery_brief`, `list_waiting_items` | `save_project`, `save_milestone`, `add_project_record`, `update_milestone`, `save_waiting_item` | Explicit client-vs-team dependency records may require new fields/tables; do not infer completion from a draft or message. |
| Mockups/Builder | `list_mockups`, `get_factory_project`, `get_plan`, `get_build_status`, `get_build_findings`, `get_artifact` | `request_mockup`, `save_mockup`, `start_planning`, `revise_plan`, `prepare_build_approval`, `queue_approved_build`, `revise_draft`, eligible stage recovery and sharing controls | Approval binds exact plan/assets/version; failed QA is not bypassed; artifacts distinguish draft, preview and production. |
| Smart Cards | `list_cards`, `get_profile`, `get_card_links`, `get_card_engagement`, `list_card_inquiries` | `save_card_profile`, `create_card_batch`, `set_card_destination`, `set_card_active`, reviewed portrait update | Preserve permanent links; anonymous taps cannot identify people. URLs/uploads must pass existing media/URL checks. |
| Reporting | `get_sales_report`, `get_acquisition_report`, `get_booking_report`, `get_site_report`, `get_search_report`, `prepare_export` | Authorized bounded export jobs | Metric definitions, date basis, freshness, pagination and incomplete sources explicit. Won value is not collected revenue. |
| SEO/integrations | `get_seo_status`, `get_seo_change`, `get_integration_health`, `get_import_failures`, `get_intro_queue` | Queue approved runs, publish/reject/rollback supported SEO changes, retry eligible imports, pause automation, save reviewed settings | Respect separate allowances and disabled states. Do not expose webhook ingestion or cron secrets as generic tools. |
| Goals/preferences | `list_goals`, `get_goal`, `get_weekly_review`, `get_assistant_preferences` | `save_goal`, `record_progress`, `link_goal_task`, `save_preferences`, `save_commitment` | Private/user-owned by default; editable facts separate from inferred suggestions. |
| Workflows/control | `list_workflows`, `get_run`, `list_pending_actions`, `get_action_receipt`, `get_assistant_activity` | `prepare_workflow`, `save_approved_workflow`, `pause_workflow`, `cancel_action`, safe retry | Bound scope, cadence, destinations and spend; revoked access halts queued work. |
| Administration | `get_effective_permissions`, sanitized settings, audit and health | Ordinary preferences; prepare sensitive admin changes and secure handoff | Membership/credentials/security and destructive actions retain human-controlled flows. |
| Development operations | Registered repository/deployment status, recent changes, linked issues and failure summaries | Create an internal engineering task or reviewed issue; separately authorized provider actions | Optional official GitHub/Render integration. No arbitrary shell, secrets, force-push, migrations or production deploy endpoint masquerading as an Operations tool. |

## Data additions and execution infrastructure

Use additive, versioned migrations; allocate numbers from the current branch at implementation time. Inventory includes:

- `assistant_oauth_clients`, codes, hashed tokens and grant families, with subject/workspace/resource binding, expirations, revoke timestamps and retention.
- `assistant_policies`: grant-specific domains, routine actions, bounded autonomous rules, budgets and allowed destinations; revisioned and visible to the owner.
- `assistant_actions` / `assistant_approvals`: intent hash, revision dependencies, idempotency key, approval evidence, attempt state, provider receipt and result link; unique keys and transaction boundaries documented.
- `assistant_workflows`, runs and step receipts: schedules/events, checkpoints, leases, heartbeat, next attempt, bounded retries, deduplication and dead-letter state. No overlapping run for the same workflow/window.
- `personal_goals`, progress, task links and preferences with owner-only access. Team goals use explicit sharing. New general personal tasks must not require inventing a sales opportunity.
- Explicit commitments/waiting items linked to customer/project/message evidence, owner, due date, confirmation status and resolution. Reuse CRM tasks where appropriate; avoid duplicating the same commitment across three queues.
- Grant-filtered search initially composes existing queries; introduce an index only if measured query latency requires it. If added, update/delete/revoke propagation must prevent stale data exposure.
- Allow safe files through typed attachment/artifact APIs with size/type checks, malware handling where relevant, short-lived scoped downloads and redacted logs. A general filesystem or arbitrary URL fetch tool is outside the design.

Business dates use `lib/time.ts` and the established [Eastern-time policy](BUSINESS_TIME.md). Store instants as UTC, label user-visible times Eastern, preserve date-only deadlines, and retain provider-specific report calendars such as Search Console Pacific dates. Calendar changes must cover DST and concurrent booking races.

## Recurring assistant work

Build a server-side workflow engine for reliability when the chat is closed. Reuse a suitable existing scheduler entrypoint or add a narrowly scoped Render worker after assessing capacity; do not assume MCP itself runs schedules. Basic checks should use deterministic queries before paying for model reasoning.

Offer these templates, initially disabled until the owner saves their actual cadence and scope:

1. Daily personal/team brief: bookings, important replies, overdue commitments, next sales actions and blocked deliverables.
2. Waiting-for-reply monitor: only user-selected conversations or explicit saved rules; deduplicate by last relevant message and never mark read.
3. Appointment preparation: source-linked customer brief before a booked call; changes/cancellations suppress obsolete preparation.
4. Post-call review: derive suggested notes/tasks from permitted transcript evidence; explicit policy controls which internal drafts/tasks may be saved.
5. Weekly goal review: real progress, carried work, proposed priorities and requested decisions; no fabricated completion.
6. Project/client dependency review: waiting on us versus waiting on them, with a draft progress update.
7. Integration/build health: sustained failures, stale imports, stuck jobs, failed QA, disabled providers and budget limits; notify only on meaningful change/recovery or required action.

Preserve Austin's existing Mail monitor. Do not install a second monitor that duplicates its notifications. Choose one owner for each schedule; record whether execution belongs to the external bot or our server.

New model-backed monitoring gets a separate explicitly set budget. Never borrow the Smart Card, SEO or Factory allowances, and do not assume a chat subscription funds server API work. Notifications need an approved channel and recipient; a default internal dashboard notice can be available without silently sending email/SMS. A scheduler is not permission to make external commitments.

## Assistant dashboard

Build a plain-language, phone-friendly workspace under Assistant:

- **Today:** brief, next actions, private goals and relevant team work with source links.
- **Waiting for you:** exact send/booking/build/publication/admin proposals with approve/reject/edit and expiry. Changed content requires new review.
- **Activity:** requested, queued, completed, failed and uncertain work with receipts, source records and undo where supported.
- **Routines:** schedules, last result, next run, allowed actions, limits, notification destination, pause and run-now.
- **Connections & permissions:** effective scopes, current restrictions, source freshness, reconnect/revoke, and stop-all-writes.
- **Preferences:** writing tone, known business facts, private objectives, desired digest format and editable memory. Credentials and MFA remain in their existing secure flows.

## Delivery sequence and acceptance gates

Each phase is a focused implementation/check/commit/push on main, preserving collaborators' work. Update this document with real verification evidence after each delivery. No phase may claim live operation from source tests alone.

| Phase | Deliverable | Exit evidence |
| --- | --- | --- |
| 0 — Coverage and client contract | Enumerate every dashboard/server action, map to a service/tool/handoff, verify the user's actual bot's connection and approval surface; document identity and Mail boundary | Machine-readable coverage manifest plus reviewed auth/approval contract; no unsupported claims about the phone/chat client. |
| 1 — Connection and controls | OAuth, scopes, delegated principal, revocation, typed results, audit, rate limits, feature flags, `whoami` and search/read framework; initial Assistant settings | Local HTTP/OAuth end-to-end checks including revocation, wrong resource, wrong tenant and disabled identity; real client can connect, read identity and disconnect. |
| 2 — Complete operational reading | Leads, opportunities, lists, clients, sites, projects, conversations/calls, calendar, cards, Builder, SEO, reporting and sanitized integrations | Known fixture data reconciles across pagination; channel denial and missing-source reporting work; actual bot produces accurate customer and daily briefs with links. |
| 3 — Internal work, calendar and goals | Shared service extraction; notes, tasks, CRM updates, assignments, project records, private goals, preferences, time blocks and staff booking/rescheduling | Browser regression checks; stale-edit/retry tests; concurrent bookings have one winner; all calendar entrypoints agree; personal data never appears in team views. |
| 4 — Reviewed communications | Drafts, attachments, shared/owned sender routing, SMS, staff call controls, concrete approvals and provider receipts | Real client preview/approval succeeds; stale conversation/recipient or changed attachments invalidate review; no duplicate send on retry. Production sends/calls use separately authorized test recipients only. |
| 5 — Builder, SEO and business controls | Full supported plan/build/draft/artifact/share/SEO flow, Smart Card maintenance, eligible integration retries and settings handoffs | Exact human approval and spend limits survive MCP; no bypass of QA attempts; disabled providers stay disabled; scope/permission regression tests pass. |
| 6 — Reliable routines | Durable workflows, private weekly reviews, briefs, waiting-item monitors, integration alerts, mobile approvals and kill switch | Observe real scheduled runs and one failure/recovery cycle; deduplication, missed-run catch-up, DST, revocation and lease recovery verified; unchanged runs remain quiet. |
| 7 — Full parity and release | Close coverage-manifest gaps, operational reports/exports, optional repository/deployment status connector, runbook and recovery | Every current feature has a verified tool or clearly justified handoff; no unexplained missing module. Austin can complete the owner workflows below using the real connected bot. |
| 8 — Adjacent product completion | Proposals/scopes, onboarding, renewals, support and financial records where desired; connect real billing/ad-spend providers under separately selected scopes | Add actual product workflows before exposing them. No invoice/payment/ROAS claims until source integration is verified. Financial transactions/signatures retain human completion. |

Phases are sequencing, not permission to stop after a read-only pilot. Phases 0–7 define full coverage of the existing platform plus the personal/workflow functions requested. Phase 8 records genuine new business-system features rather than pretending MCP creates them. No dates or total cost are promised before Phase 0 resolves integration dependencies.

## Owner workflows that define completion

- “Plan my day and show what Devon and Jeffrey need from me.” Correct Eastern bookings, tasks, pending decisions and evidence; distinguish mine/team scopes.
- “Prepare me for this customer.” Relevant allowed emails, SMS, calls, project context, needs and promises; inaccessible sources explicitly listed.
- “Save these notes and give Devon a follow-up for Friday.” Right identity/owner/date; one task after retries; dashboard reflects it.
- “Move my consultation to tomorrow at 10.” Disambiguate the appointment, recheck conflicts, update both calendar views, show whether anyone was notified.
- “Reply to this person with our next steps.” Exact sender/recipient/thread, editable content, requested approval and confirmed outcome; incoming replies invalidate stale drafts appropriately.
- “What are we waiting on from each client?” Real dependencies and dates; no invented obligations; draft status updates remain drafts until approved.
- “Build this prospect's website.” Preserve sparse input support, reviewable plan and exact human approval; bounded costs and quality checks; report saved failures honestly.
- “What did our cards and Facebook leads produce?” Reconciled inquiries, conversations, appointments and sales with transparent attribution, freshness and missing cost data.
- “Track my weekly goals and tell me when I drift.” Saved private targets, actual progress evidence, authorized routine and quiet unchanged checks.
- “Check the project for things to do.” Read registered repo/deployment health and open work, prepare an engineering task, distinguish code observation from live diagnosis; no implicit production changes.
- “Stop working for me.” Revocation/pause halts queued future side effects, confirms in-flight outcomes and preserves the audit trail.

## Verification and release requirements

- Unit/schema tests for normalization, permissions, revisions, limits and dates; PostgreSQL integration tests for tenant/channel isolation, approvals, races and idempotency; mocked providers for failure and unknown-outcome handling.
- Real local MCP HTTP tests for discovery, structured results, chunking, tool schemas and protocol errors. Test client compatibility early, including login/refresh, write confirmation and long-running job polling.
- Browser checks for existing dashboard flows affected by service extraction and the new Assistant controls on desktop/phone. Assess accessibility and readable approval details, not only API success.
- Negative cases: forged actor, same-name contacts, wrong workspace, changed mailbox/line grant, disabled account, revoked token, expired approval, replay, hostile email instructions, arbitrary URL/file paths, oversized attachments, opt-out, budget exhausted, midnight/DST, deleted source evidence and source unavailability.
- Query performance and bounded exports; source timestamps and cursors; no unreported truncation. Prefer deterministic totals over model-generated arithmetic.
- Preserve historical records, customer previews, existing grants, mail monitors and allowances. Add migrations with verified backup/rollback procedures before production schema changes.
- Render and Mail deploy separately. Only deploy Mail if a reviewed Mail change is part of the phase. A documentation-only commit does not activate either feature.
- Real production acceptance starts read-only in Austin's authenticated client. Record provider-backed writes only with a specific authorized test and mark anything else UNTESTED. Never send a customer message, call a prospect or launch a paid build as an unapproved test.
- Record source commit, deployment IDs, migration versions, actual tool discovery, test counts, known limitations and rollback controls. Release behind domain flags; disabling assistant access leaves normal website/dashboard operation intact.

## Decisions to resolve at the relevant phase

Proceed with the architecture and existing Eastern calendar without asking Austin to decide routine implementation details. Obtain only missing activation choices when they become concrete:

- Exact bot/client surface for connection testing and whether it exposes Operations alongside Mail; verify instead of assuming all chat/phone modes share capabilities.
- Which recurring routines to activate, their cadence/destination, and any new paid reasoning budget. Existing Mail monitor stays intact.
- Which routine internal background actions Austin wants delegated automatically, and whether any future outbound autonomy should be proposed. Current Mail send approvals remain in force.
- Any additional teammate private-mail grants, external calendars, GitHub/Render provider credentials, advertising-spend or billing integrations. Request narrow access only when the corresponding adapter is ready.

## Resume checklist

- [x] Sync current main and review existing modules, Mail acceptance, calendar and time policy.
- [x] Save full product scope, architecture, tool families, authority boundaries, phases and exit checks.
- [ ] Phase 0: create the code-derived capability manifest and resolve the actual client connection contract.
- [ ] Phase 1: implement delegated authentication and the first real identity/read call end to end.
- [ ] Complete phases 2–7; document each deployment and remaining capability gaps here.
- [ ] Scope phase 8 integrations from real business/provider needs without mislabeling them as existing capabilities.

Related: [Agency roadmap](AGENCY_OS_ROADMAP.md), [Mail MCP](../apps/mail/MCP_SETUP.md), [Unified Inbox](UNIFIED_INBOX.md), [Smart Cards/calendar](SMART_CARDS.md), [Website Builder standards](WEBSITE_BUILDER_STANDARDS.md), [Eastern time](BUSINESS_TIME.md).
