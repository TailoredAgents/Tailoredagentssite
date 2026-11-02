# Operations assistant setup and release notes

This is an implementation checkpoint, not the completion of the full owner-assistant plan. The capability inventory explicitly tracks pending and partial coverage.

## Connect the existing ChatGPT client

Use a separate OAuth MCP connection named **Tailored Agents Operations** with:

`https://www.tailoredagents.com/api/mcp/operations`

Keep **Tailored Agents Mail** connected. Its sending and approval policies are unchanged. Use the ChatGPT surface that supports custom MCP connections; do not assume every phone/agent mode exposes the same connections. Austin confirmed the real ChatGPT connection and account/permissions check worked after the November 2 consent correction. Renewal, disconnection and a real reviewed write remain to be accepted.

Sign in with your Tailored Agents account, check the application name, choose desired permissions, and approve the connection yourself. OAuth client names are supplied by the client and are not verified brand identity. Start with reading; choose write permissions to prepare changes. Write scopes allow proposals, not self-approval. Review proposals at `/dashboard/assistant`.

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
- Proposals expire after 24 hours and bind exact parsed content, action, account, workspace and connection. Customer, teammate, calendar and existing-goal identities are resolved by the server for review and rechecked before execution. One idempotency key cannot be reused for different content. Only the same human account can approve in the dashboard; no MCP approval endpoint exists.
- Goal, opportunity and CRM/project edits check revisions. Ten additional proposals cover lead status/details/notes, clients, contacts, site records, projects, milestones and project records. Existing records require the latest updatedAt and acquire a row lock in the mutation transaction. Supply all editable fields, preserving optional values you do not intend to clear. Sales tasks now support creation, revision-checked editing, completion and cancellation. Phone consultations support staff booking for an existing lead, rescheduling, cancellation after the user confirms visitor contact, and revision-checked block removal. These actions send no visitor notification.
- Execution is claimed before calling a domain service. If a process dies or the outcome is ambiguous, no automatic retry occurs. Inspect the target record first. The daily retention worker marks interrupted executions uncertain after 15 minutes.
- Pausing blocks future writes; revoking blocks future reads and writes. Already-started work may finish. The UI explains this boundary.
- Assistant Mail reads reuse the exact user’s live server-only Mail grant. Assistant execution cannot call the dashboard’s direct Mail send transport. Owned Mail sends remain in the separate Mail MCP.
- Tool activity logs contain metadata only. Activity expires after 90 days, proposal content after 90 days, receipt metadata after one year. Private goals remain until explicitly changed or removed through future owner controls.

## Deployment and rollback

Migration `0042_operations_assistant.sql` is additive. Apply it before this code. Render’s existing web build runs sorted migrations, retention and build. No Mail Worker deployment or environment secret is required for this increment. Existing search/reporting maintenance also performs assistant retention.

`OPERATIONS_ASSISTANT_ENABLED=false` disables tool access. `OPERATIONS_ASSISTANT_WRITES_ENABLED=false` disables proposal creation/execution without disabling normal dashboard work. Unset values enable the connection endpoints; explicit OAuth consent is still required. These switches never create user grants. Use the Assistant page for individual revocation/pause. A code rollback can leave these additive tables in place; do not drop stored approvals or credentials during emergency rollback.

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

## Private drafts

The assistant can list permitted mailboxes, read its connected owner's CRM email/text draft, and prepare a reviewed save. Email drafts here belong to the dashboard Inbox; the separate Tailored Agents Mail app has its own draft tools. Saving a draft never sends a message and does not grant permission to send it later.

A save requires the exact draft ID/revision, or an explicit null only when none is present. The shared service rechecks that state under its existing transaction lock. Newer edits from another device or a competing approval are preserved; drafts remain author/workspace/channel-scoped, and current Mail/number permissions still apply. Drafts older than the existing 90-day retention window are unavailable and can be replaced by a new draft. To save a reply, retain its original thread and reply-to message rather than inventing a new recipient.

Verification: 82 Operations, email Inbox and SMS tests passed with simulated providers, including real proposal approval, private ownership, stale edits, competing saves, expired drafts and zero provider sends from draft saves. Production build, typecheck, lint and coverage checks passed.

## Next work

Follow phases 0–7 in `OPERATIONS_ASSISTANT_PLAN.md`. The code-derived manifest lists outstanding features; the dashboard also describes what is and is not available. Real ChatGPT discovery, consent and account reading are accepted; reviewed writes, renewal and revocation still need real-client acceptance. Then complete the pending service extraction, calendar and communication flows, longer-lived identity delegation and durable routines without bypassing existing approvals or spending limits.
