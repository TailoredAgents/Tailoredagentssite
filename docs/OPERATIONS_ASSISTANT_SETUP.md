# Operations assistant setup and release notes

This is an implementation checkpoint, not the completion of the full owner-assistant plan. The capability inventory explicitly tracks pending and partial coverage.

## Native employee operations — November 10

The dashboard assistant serves company operations: customer work, planning, research, scheduling and communications. Austin builds custom client AI systems and automation workflows; the assistant is explicitly instructed not to program, construct or deploy those systems.

Migration `0050_assistant_operations.sql` builds on `0049_employee_assistant_chat.sql`. Existing grants gain no new permissions automatically. Each employee opens **Chat settings**, selects their capabilities and updates access. The existing shared **$25/month AI allowance** remains separate from website builds and ordinary SMS/call charges. No new routine or customer outreach is activated by this deployment.

Implemented:

- **Durable background turns:** PostgreSQL queue, exclusive renewable-by-step leases, saved model responses and tool checkpoints. The HTTP route returns immediately and uses Next `after()` to advance work; the existing five-minute shared cron recovers unfinished work. Closing a page does not cancel it. Maximum 12 tool steps, one tool at a time. Saved responses are reused without another paid request. Action receipts and stable request identifiers prevent blind replay. Uncertain paid requests, sends and calls stop instead of automatically retrying.
- **Recurring work:** explicitly requested daily, weekday or weekly routines in America/New_York; one catch-up run after downtime, no backlog burst, no overlapping run of one routine. Private results appear as conversations. Chat settings shows schedules and pause/resume controls. Authorization is still tied to the real employee session (currently up to 14 days); expiration, revocation or suspended membership blocks work. Reconnect and resume routines after expiry. Independent perpetual delegation is not implemented.
- **Public research and calculations:** optional hosted web search with citations and sandboxed Python through OpenAI Code Interpreter. A separate model request receives only the explicit research question/data, with no business tools or inherited conversation. No server shell, browser account control, credentials, file uploads or artifact downloads. External apps remain unconfigured because Austin has not selected any apps/tasks yet.
- **Chat communications:** optional SMS through existing number permissions, opt-out checks and send receipts; new email through the existing session-bound Mail transport, always with exact human dashboard review; phone calls through the existing employee callback flow. The employee answers and presses 1 before the customer connects. Device tokens never reach the model. Emails do not silently bypass sender permissions or use a separate employee identity. SMS and calls follow the selected direct/review mode.
- **Long-term context:** private saved facts with revisions, correction/forget tools, and full-text search across all retained chats. The immediate context still uses at most 20 turns / 32 KB, plus a bounded set of private notes; this is searchable history, not perfect recall. Forgetting a note does not delete the original chat or action history. Shared business facts remain in CRM/project records, not another employee’s private memory.
- **Automatic consultation notices:** select an allowed SMS number in Chat settings. Native chat then books, moves or cancels consultations through tools that atomically save a notification outbox row with the calendar transaction. The worker sends the server-generated appointment/cancellation text, checks current authority and the customer/booking revision, and suppresses obsolete notices. Status distinguishes queued, accepted, failed and unknown; accepted is not delivered. Missing setup or an opted-out customer blocks the assistant booking change. Existing manual Calendar changes and external MCP legacy booking tools retain their existing behavior. Sales task appointments do not gain these notifications.

Budgets are reserved transactionally across employees before provider calls. Unknown outcomes retain reservations. Hosted research has conservative extra reservations ($0.70 for a one-call web request; $6 for a one-call calculation) for intermediate context/container costs; completed requests release unused allowance. The ledger charges published token rates conservatively plus $0.01 per search and $0.03 per 1 GB Code Interpreter call (container reuse may make actual billing lower). Maximum one hosted tool call per isolated research request. Provider-reported usage above the estimate is recorded and stops the turn. Rates are not a replacement for OpenAI billing reconciliation.

Sources checked: [Responses function calling](https://developers.openai.com/api/docs/guides/function-calling), [web search](https://developers.openai.com/api/docs/guides/tools-web-search), [Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter), [pricing](https://developers.openai.com/api/docs/pricing). Runtime controls: `ASSISTANT_CHAT_ENABLED=false`, Operations access/write/direct flags, employee pause/revoke, routine pause, and company allowance 0. The separate Mail connector’s own approval policy is unchanged.

Verification: the full regression run passed 831 tests (477 environment-dependent tests skipped); the final focused assistant/inbox/worker run passed 73 tests (21 separate inbox integration tests skipped). Both desktop and phone browser cases passed, including capability selection and persistence. Lint, TypeScript and an isolated production build passed. Verification uses disposable local PostgreSQL and synthetic provider responses. Tests cover private memory/history, DST, due-run concurrency, revoked authority, checkpoint replay, uncertain paid requests, exact reviewed-email transport, employee callback behavior, and atomic booking-notification delivery/supersession. No real customer messages, calls or paid model requests are sent during verification. Live provider output and deployment acceptance remain separate checks.

Run `ASSISTANT_CHAT_TEST_DATABASE_URL` against disposable local `/ta_assistant_chat_test` and `ASSISTANT_TEST_DATABASE_URL` against `/ta_assistant_test`, then `npx vitest run lib/assistant lib/inbox/mail-provider.test.ts`. For desktop/phone browser tests, seed `/ta_reporting_browser_test`, set `REPORTING_TEST_DATABASE_URL` and `REPORTING_TEST_PORT`, then run `npm run test:assistant-chat:browser`. The `.next-assistant-test` output avoids another developer’s server. No new hosting service or cron schedule is required.

## Connect the existing ChatGPT client

Use a separate OAuth MCP connection named **Tailored Agents Operations** with:

`https://www.tailoredagents.com/api/mcp/operations`

Keep **Tailored Agents Mail** connected. Its sending and approval policies are unchanged. Use the ChatGPT surface that supports custom MCP connections; do not assume every phone/agent mode exposes the same connections. Austin confirmed the real ChatGPT connection and account/permissions check worked after the November 2 consent correction. Renewal, disconnection and real-client direct execution remain to be accepted.

Sign in with your Tailored Agents account, check the application name, choose desired permissions, and approve the connection yourself. OAuth client names are supplied by the client and are not verified brand identity. Choose the reading and change permissions the bot needs. Enable **Allow direct actions without asking me each time** on consent, or **Enable direct actions** on the existing connection at `/dashboard/assistant`. This is a one-time owner choice: supported changes then run through `execute_action` without per-action dashboard approval. Existing connections stay in review mode until the owner changes that setting. Review mode remains available for optional proposals. The separate Mail connection and ChatGPT may impose their own confirmations.

Example requests:

- “Show my connected account and permissions.”
- “Find this customer and summarize the history I’m allowed to see.”
- “Show the team’s appointments and our daily sales priorities.”
- “Prepare a follow-up task for Devon for Friday afternoon.”
- “Prepare a private goal for this week.”
- “Check the receipt for the change I just approved.”

The public Smart Card agent cannot access these tools. No outgoing messages, calls, paid builds, new routines or new memberships are created just by connecting.

## Current behavior and boundaries

- Account, workspace, session and role are resolved on the server. No input can select an actor. Tenant and channel checks remain in the existing services.
- Access tokens last up to one hour; refresh tokens rotate. All tokens are stored as hashes. Resource is exactly the Operations MCP endpoint. Credentials, provider keys and Mail sessions never appear in tool results.
- **Temporary session binding:** connection life cannot exceed the real sign-in used at consent, currently up to 14 days. Signing out or losing that identity stops the connection. Renewal beyond this requires reconnecting; independent long-lived Mail delegation remains pending.
- `operations:read`, `conversations:read`, `personal:read`, `operations:write`, and `personal:write`, and `conversations:send` are separate choices. Viewers cannot grant writes. Every tool rechecks active authority.
- Reads retain pagination and source state. Dashboard summaries have explicit bounds and are not complete exports. Responses over 240 KB fail clearly and require a narrower query or dashboard review.
- Proposals expire after 24 hours and bind exact parsed content, action, account, workspace and connection. Customer, teammate, calendar and existing-goal identities are resolved by the server for review and rechecked before execution. One idempotency key cannot be reused for different content. In review mode only the same human account can approve in the dashboard. In direct mode `execute_action` uses the connection’s saved authority with the same validation/claim/receipt path. There is no MCP tool to enable direct mode or expand permissions. Receipts distinguish dashboard approval from delegated execution; direct actions do not fabricate a human approval timestamp.
- Goal, opportunity and CRM/project edits check revisions. Ten additional proposals cover lead status/details/notes, clients, contacts, site records, projects, milestones and project records. Existing records require the latest updatedAt and acquire a row lock in the mutation transaction. Supply all editable fields, preserving optional values you do not intend to clear. Sales tasks now support creation, revision-checked editing, completion and cancellation. Phone consultations support staff booking for an existing lead, rescheduling, cancellation after the user confirms visitor contact, and revision-checked block removal. These actions send no visitor notification.
- Execution is claimed before calling a domain service. If a process dies or the outcome is ambiguous, no automatic retry occurs. Inspect the target record first. The daily retention worker marks interrupted executions uncertain after 15 minutes.
- Pausing blocks future writes; revoking blocks future reads and writes. Already-started work may finish. The UI explains this boundary.
- Assistant Mail reads reuse the exact user’s live server-only Mail grant. Assistant execution cannot call the dashboard’s direct Mail send transport. Owned Mail sends remain in the separate Mail MCP.
- Tool activity logs contain metadata only. Activity expires after 90 days, proposal content after 90 days, receipt metadata after one year. Private goals remain until explicitly changed or removed through future owner controls.

## Deployment and rollback

Migrations `0042_operations_assistant.sql` and `0043_assistant_direct_actions.sql` are additive. The latter defaults every existing grant to reviewed execution. Apply it before this code. Render’s existing web build runs sorted migrations, retention and build. No Mail Worker deployment or environment secret is required for this increment. Existing search/reporting maintenance also performs assistant retention.

`OPERATIONS_ASSISTANT_ENABLED=false` disables tool access. `OPERATIONS_ASSISTANT_WRITES_ENABLED=false` disables proposal creation/execution without disabling normal dashboard work. Unset values enable the connection endpoints; explicit OAuth consent is still required. `OPERATIONS_ASSISTANT_DIRECT_ENABLED=false` independently disables direct execution while preserving reviewed proposals. These switches never create user grants or turn direct mode on. Use the Assistant page for individual revocation/pause. A code rollback can leave these additive tables in place; do not drop stored approvals or credentials during emergency rollback.

Discovery endpoints:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource/api/mcp/operations`

OAuth routes: `/oauth/operations/register`, `/authorize`, `/consent`, `/token`, `/revoke`. MCP uses stateless Streamable HTTP with JSON responses; no SSE session or browser cookie is accepted as the MCP credential.

## Verification record — November 2, 2026

- Node 22.18.0 matches Render. SDK 1.32.2; dependency audit reports zero known vulnerabilities after the transitive update.
- Production build, TypeScript and lint passed.
- 46 focused tests passed: OAuth/PKCE/resource and callback binding, refresh replay, consent replay, account/session expiry, current role, owner/grant isolation, private goals, stale revisions, idempotency, concurrent approvals, pause/revoke/expiry, actual SDK handler discovery/structured output, actual sales/follow-up/mockup/time-block mutations, reviewed target changes, tenant separation, retention, OAuth tracking exclusions, and Mail delegation/send-bypass protection. The nine existing Mail sign-in integration tests also passed.
- Broader suite: 768 tests passed during the final parallel run; two existing Website Builder browser suites encountered timing/cleanup interruptions. Their isolated rerun passed 28 tests (one existing test skipped). Database suites require dedicated local test URLs; unconfigured integration suites are skipped. No production send or paid build was used as a test.
- Local browser review passed: real sign-in, Assistant navigation, exact proposal review and a completed private goal receipt. A 390-pixel phone viewport had no horizontal overflow. OAuth consent displayed the account and separate permission choices. First release `94e1216455ac291888907452cd7bc7c7c07b5d0b` deployed successfully to Render web service `srv-db6hod8473hc739q2uo0` in deployment `dep-dbkh8e2vcj2c73fl9b20` at November 2, 5:54:53 PM Eastern. Live health and both OAuth discovery documents returned 200; unauthenticated MCP returned 401 with the correct resource challenge and no-store caching. Austin subsequently confirmed actual ChatGPT consent and the account/permissions read worked. Renewal and reviewed-write acceptance remain pending.

CRM/project increment: 26 focused tests passed, including client/contact/site/project creation, milestone completion, current-role enforcement, competing edits and stale-review rejection. The production build passed. Existing dashboard lead/note/contact/milestone browser workflows passed on desktop and phone (2 tests).

Reproduce the focused integration suite only against `ASSISTANT_TEST_DATABASE_URL=postgresql://ta_test@127.0.0.1:55433/ta_assistant_test`; it refuses other host/database names and resets that disposable schema. Never use production credentials. The full browser suites use the installed Playwright browser runtime.

## Consent correction — November 2

Austin's first real ChatGPT connection reached the Tailored Agents permission page but returned `access_denied` after Allow. The initial `no-referrer` page policy suppresses the Origin on native form posts, conflicting with the strict consent-origin check. OAuth pages now use `same-origin`, keeping same-site POST identity while omitting the referrer to external callbacks. The check still rejects missing, opaque/null and foreign origins; it was not relaxed.

Interactive consent exchanges the saved decision through same-origin JSON, then navigates to the server-validated registered callback. This avoids browsers blocking an external form redirect under `form-action 'self'`. Without JavaScript, the same form returns an explicit Continue link. The callback remains bound to the original consent, client and PKCE code; no arbitrary redirect was added.

Verification: 24 assistant tests passed. Four real browser flows passed (desktop/phone, interactive/plain form), covering sign-in, selected-scope consent, callback state, absence of a cross-origin referrer, token exchange, and `whoami` with the correct synthetic account. The external callback was intercepted locally; no code was sent to ChatGPT and no production grant was created by the tests. Use `npm run test:assistant:browser` with the isolated reporting-test database. Its development server uses webpack because this machine's Turbopack hot reload repeatedly refreshed sign-in.

The consent correction and CRM increment deployed as `1359eb57b8b8aca8dd46fd0f8f664fd49366284b` in Render deployment `dep-dbkhiqavcj2c73fln300`, live November 2 at 6:17:41 PM Eastern. Live health returned 200 and the OAuth page returned the corrected same-origin referrer policy. Austin confirmed: “Connected and the account check worked.”

## Calendar and task increment

Reviewed proposals now cover sales follow-ups/appointments (create, edit, complete, cancel), extra public consultation times, existing-lead consultation booking/rescheduling/cancellation, and closing time blocks/openings. `get_calendar_entry` supplies a targeted record and revision. Staff booking shares the public calendar lock and availability rules, including recurring 8 AM–7 PM Eastern hours, two-hour notice and a 90-day window. Appointment conflict checks now also detect other internal sales appointments and exclude the same task when editing it.

Cancellations preserve the existing requirement that the visitor has already been contacted. Other calendar actions explicitly return `notificationSent: false`; notifications remain a separate reviewed operation. Booked leads need a phone number. Rescheduling transfers the lead to the new slot and records both slot IDs in audit; a cancelled consultation can be rescheduled. Existing-lead creation/selection is separate from booking. These tools do not invoke public inquiry notifications or paid processing.

Verification: 54 assistant/Smart Card integration and security tests passed, including stale edits, concurrent internal appointments, reviewed booking/moving/cancellation and a public-versus-staff race with exactly one booking. The 46 existing sales integration tests also passed, including browser-action service extraction regressions. Production build, typecheck and lint passed. The existing sales workflow passed on desktop and phone (2 browser tests), including Eastern/DST conversion, scheduling and client/project handoff. The device fixtures now use separate appointment times; the old shared time correctly triggers the new conflict check. Real customer booking changes were not used as tests.

Calendar/task release `20b0c09cb8a4e05cb0dd161c3e8b2296b0ff6a5f` is live on Render, deployment `dep-dbkho0t9el5s73bqvrpg`.

## Reviewed communications increment

`prepare_send_sms` prepares an exact recipient/body proposal. It requires the new, separate `conversations:send` permission plus conversation reading. Existing grants retain their original permissions; selecting sending requires the owner to authorize a new connection. No permission is added automatically. The existing Mail connection is unchanged.

The bot first reads `get_sms_recipient` and the latest conversation, then supplies their identifiers with a stable request ID. Review and delivery recheck identity, history, live number permissions, enabled status, recipient opt-outs and the existing hourly limits. A newer reply invalidates the saved proposal. Sending uses the existing durable outbound intent and provider adapter, cancels competing introductory-message jobs, and never blindly retries a timeout. Receipts preserve the request ID and distinguish provider acceptance from delivery; use `get_sms_send_status` to check the outcome without resending. Approval can incur normal messaging charges. A sent text cannot be recalled.

`prepare_save_conversation_work` updates assignment, reminder and Needs reply / Waiting / Done / Archived status. It requires access to every linked source and the current work/activity timestamps. Done means no outstanding follow-up; it does not delete history, prove a sale or send a reply. New authorized customer activity still reopens follow-up work.

Verification: 112 Operations, SMS and conversation tests passed against isolated local databases and simulated providers. They cover stale work and new replies, viewer/scope restrictions, concurrent approvals with one send, lost number grants, opt-outs, unknown delivery receipts and status checks without resending. Four desktop/phone OAuth browser flows, the production build, typecheck, lint and coverage check also passed. No production message was sent.

Communication release `ede6960080fc12e95dacc60407c828bde8e8c50b` is live on Render in deployment `dep-dbkhu8nlk1mc738rghf0`, November 2 at 6:41 PM Eastern.

## Call follow-up tasks

The assistant can read saved call suggestions and eligible assignees, prepare one follow-up task from exact transcript evidence, edit an open task or complete/cancel it with a factual outcome. It uses existing call-source tasks and My Day; it does not create a duplicate sales opportunity. Creation binds the saved suggestion and quote, rejects an already-created suggestion, and never requests paid transcription or calls anyone. Edits/completion require the current `updatedAt`, lock the task row and preserve live line permissions. Expired recordings cannot produce new suggestions; existing tasks remain accessible only to users with access to the call source.

Verification: 78 Operations and voice integration/security tests passed, including the real OAuth/proposal/review path, concurrent approval, stale and competing task edits, transcript evidence changes, existing-task detection, revoked line access and viewer restrictions. The production build, typecheck, lint and coverage check also passed. Providers were simulated; no customer call or paid analysis was used as a test.

Call-task release `5e60f822d545fb434802752116cb7997d457c4ac` is live on Render in deployment `dep-dbki01nlk1mc738rja0g`, November 2 at 6:45 PM Eastern.

## Smart Card management

Public profile edits, creation of a permanent personal/giveaway-batch link, destination changes, pause/resume, and enabling/disabling the public card assistant use the same service as dashboard forms. Read tools return the exact profile revision, card destination/active state, and existing AI allowance. Each proposal binds those saved values and displays the affected public profile/link. Current owner/admin status is required at execution. The permanent URL remains unchanged when reassigning a card; a newly created link returns distinct NFC and QR attribution URLs. A shared batch URL does not identify individual physical cards or anonymous visitors.

AI toggles preserve both the monthly cap and current usage. Resuming can permit new visitor API requests within the existing allowance; that consequence appears in review. Portrait changes still require the repository/media workflow, and this release does not change login identities, create team memberships, print cards or order stock.

Verification: 61 assistant/Smart Card integration and security tests passed, including exact proposal review, stale profile/settings rejection, stable redirects, one link after concurrent approval, disabled links, current admin role, public attribution and the unchanged allowance. The production build, typecheck, lint and coverage checks passed. No live public profile or card was changed during testing.

Smart Card release `be142ed4e6d4f2c85a8b7eaa16ca529d80a58e91` is live on Render in deployment `dep-dbki26142hec73bvfm60`, November 2 at 6:50 PM Eastern.

## Private drafts

The assistant can list permitted mailboxes, read its connected owner's CRM email/text draft, and prepare a reviewed save. Email drafts here belong to the dashboard Inbox; the separate Tailored Agents Mail app has its own draft tools. Saving a draft never sends a message and does not grant permission to send it later.

A save requires the exact draft ID/revision, or an explicit null only when none is present. The shared service rechecks that state under its existing transaction lock. Newer edits from another device or a competing approval are preserved; drafts remain author/workspace/channel-scoped, and current Mail/number permissions still apply. Drafts older than the existing 90-day retention window are unavailable and can be replaced by a new draft. To save a reply, retain its original thread and reply-to message rather than inventing a new recipient.

Verification: 82 Operations, email Inbox and SMS tests passed with simulated providers, including real proposal approval, private ownership, stale edits, competing saves, expired drafts and zero provider sends from draft saves. Production build, typecheck, lint and coverage checks passed.

Private-draft release `6521e4df2c8e30eff06b58bae9909af85e988719` is live on Render in deployment `dep-dbki5dqvcj2c73fmgdsg`, November 2 at 6:56 PM Eastern.

## Direct execution — updated owner request

Austin explicitly requested work without per-action approval. Direct mode now exposes a typed `execute_action` catalog, restricted to the connection’s selected scopes and live editor role. The user enables it once in consent or on that connection’s Assistant card. Enabling it does not execute waiting proposals automatically, add permissions, resume paused changes, or create recurring jobs. A read-only connection must first be reconnected with the desired change permissions. Text sending still requires `conversations:send`.

The bot reads `whoami.directActions` and uses `execute_action` instead of preparing a review when direct mode is enabled. Existing `prepare_` tools remain available when the user asks to review first. Each direct call binds canonical inputs and an idempotency key, checks current record identities/revisions and domain permissions, claims execution once, and writes a receipt labeled `delegated`. Repeating the same request returns its receipt; a changed payload cannot reuse its key. Unknown outcomes never automatically resend. Disabling direct mode is checked again on nested delivery work; already accepted provider work may finish.

Verification: 65 Operations/SMS tests passed, including actual MCP direct execution, explicit consent, default reviewed mode, owner isolation, scope/role/pause/revoke checks, mode changes during nested work, the direct kill switch and one simulated SMS send despite concurrent/repeated calls. Eight browser flows also passed across desktop/phone and interactive/plain consent, including direct goal execution and the owner’s mode controls. Production build, typecheck, lint and coverage checks passed. No customer message or production setting was used as a test.

## Next work

Follow phases 0–7 in `OPERATIONS_ASSISTANT_PLAN.md`. The code-derived manifest lists outstanding features; the dashboard also describes what is and is not available. Real ChatGPT discovery, consent and account reading are accepted; direct writes, renewal and revocation still need real-client acceptance. Austin replaced the proposed per-action write test with a request for direct mode. Then complete the pending service extraction, calendar and communication flows, longer-lived identity delegation and durable routines without bypassing existing approvals or spending limits.
