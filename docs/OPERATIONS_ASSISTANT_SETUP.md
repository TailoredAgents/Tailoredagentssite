# Operations assistant setup and release notes

This is an implementation checkpoint, not the completion of the full owner-assistant plan. The capability inventory explicitly tracks pending and partial coverage.

## Connect the existing ChatGPT client

Use a separate OAuth MCP connection named **Tailored Agents Operations** with:

`https://www.tailoredagents.com/api/mcp/operations`

Keep **Tailored Agents Mail** connected. Its sending and approval policies are unchanged. Use the ChatGPT surface that supports custom MCP connections; do not assume every phone/agent mode exposes the same connections. Actual acceptance in Austin’s client is still required.

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
- `operations:read`, `conversations:read`, `personal:read`, `operations:write`, and `personal:write` are separate choices. Viewers cannot grant writes. Every tool rechecks active authority.
- Reads retain pagination and source state. Dashboard summaries have explicit bounds and are not complete exports. Responses over 240 KB fail clearly and require a narrower query or dashboard review.
- Proposals expire after 24 hours and bind exact parsed content, action, account, workspace and connection. Customer, teammate, calendar and existing-goal identities are resolved by the server for review and rechecked before execution. One idempotency key cannot be reused for different content. Only the same human account can approve in the dashboard; no MCP approval endpoint exists.
- Goal, opportunity and CRM/project edits check revisions. Ten additional proposals cover lead status/details/notes, clients, contacts, site records, projects, milestones and project records. Existing records require the latest updatedAt and acquire a row lock in the mutation transaction. Supply all editable fields, preserving optional values you do not intend to clear. Sales-task editing and full booking management remain pending.
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
- Local browser review passed: real sign-in, Assistant navigation, exact proposal review and a completed private goal receipt. A 390-pixel phone viewport had no horizontal overflow. OAuth consent displayed the account and separate permission choices. First release `94e1216455ac291888907452cd7bc7c7c07b5d0b` deployed successfully to Render web service `srv-db6hod8473hc739q2uo0` in deployment `dep-dbkh8e2vcj2c73fl9b20` at November 2, 5:54:53 PM Eastern. Live health and both OAuth discovery documents returned 200; unauthenticated MCP returned 401 with the correct resource challenge and no-store caching. Actual ChatGPT consent, reading and renewal acceptance remain pending with Austin.

CRM/project increment: 26 focused tests passed, including client/contact/site/project creation, milestone completion, current-role enforcement, competing edits and stale-review rejection. The production build passed. Existing dashboard lead/note/contact/milestone browser workflows passed on desktop and phone (2 tests).

Reproduce the focused integration suite only against `ASSISTANT_TEST_DATABASE_URL=postgresql://ta_test@127.0.0.1:55433/ta_assistant_test`; it refuses other host/database names and resets that disposable schema. Never use production credentials. The full browser suites use the installed Playwright browser runtime.

## Next work

Follow phases 0–7 in `OPERATIONS_ASSISTANT_PLAN.md`. The code-derived manifest lists outstanding features; the dashboard also describes what is and is not available. First verify discovery/consent/reading/revocation in the real ChatGPT client. Then complete the pending service extraction, calendar and communication flows, longer-lived identity delegation and durable routines without bypassing existing approvals or spending limits.
