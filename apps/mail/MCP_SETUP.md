# Tailored Agents Mail MCP — deployment and connection handoff

Updated November 1, 2026, **6:45 PM EST. Austin's own ChatGPT/Mail connection is
installed and read-tested; his existing business-email monitor includes Mail and
passed a manual run.** Production configuration
enables OAuth sending with Jeffrey's approved cap of **100 messages per user per Eastern calendar day (EST/EDT)**.
No production assistant clients, access tokens, or mailbox grants were created during deployment.
No real messages were sent through MCP. Unit tests use a mocked provider; browser
tests use disposable local accounts, drafts and OAuth credentials. Separately,
Jeffrey approved one CRM Sales test on November 1: delivery and the Hotmail reply
were verified, with the original landing in Junk. That test does not establish
Austin's MCP sending or inbox placement. See the [Sales acceptance record](../../new%20jeffrey.md#november-1-hotmail-round-trip-and-timestamp-correction).

## Eastern calendar — November 1, 2026

Jeffrey chose Georgia time, **America/New_York (EST/EDT)**. The 100/day assistant
allowance now uses midnight Eastern, including 23/25-hour DST days. The count is
still atomic per user; a failed-send refund credits its original reservation day.
Existing counters, credentials, consent and approval requirements are preserved.
Mail display, date searches and draft-save times share the CRM calendar. MCP
`whoami` exposes `time_zone`, `sending.reset_time_zone` and `next_reset_at` (a UTC
instant); message dates are explicitly zoned UTC instants for clients to display
in Eastern. See [the system time policy](../../docs/BUSINESS_TIME.md).

Verification before release: 429 Mail tests passed with `TZ=Asia/Tokyo`, plus two
built-Worker OAuth/MCP browser tests running with a Tokyo browser timezone, Svelte
check and production build. Code `3fcd00b` is deployed as Worker
`c18a7f3b-817c-49f6-b89c-bba31df1cd09` (uploaded **6:41:54 PM EST**).
Austin's actual connected ChatGPT verified enabled sending, `daily_limit:100`,
both timezone fields `America/New_York`, and `next_reset_at:2026-11-02T05:00:00.000Z`
(**November 2 at midnight EST**). The live settings panel matches. No mail was
accessed or sent during this read-only policy check.

## Daily send limit increased — November 1, 2026

Jeffrey explicitly requested **100/day**, replacing the initial 25/day limit.
Main `5ea47a9` sets production `API_DAILY_SEND_LIMIT="100"`; Worker
`53819be1-c88c-4d30-97ae-3c852ada1fcf` was uploaded at **6:23:50 PM EST** and deployed.
At **6:24 PM EST**, Austin's connected ChatGPT `whoami` returned
`austin@tailoredagents.com`, `sending.enabled:true`, and `sending.daily_limit:100`.
The 28 existing sending-policy/outbox checks and production build passed; binding
types regenerated successfully. No email was sent. At that release the limit was per user per UTC
day; the Eastern-calendar release above supersedes that reset boundary. It covers assistant/API sends; normal Mail sending is unaffected. OAuth scopes,
approval-before-change permissions and monitoring were preserved. The 25/day
observations below are historical evidence from the initial connection.

## Production verification — November 1, 2026

- Built from main `c9bb7cacb626ac6232dce1f9396d8eb2eded1134`; deployed Worker
  `1a5cc2d4-babc-45db-81a2-8719609c7e4f` at **1:02:13 PM EST** using
  `npm run deploy:production`. Production account, D1, R2, queue, domain and existing
  secret binding names matched the intended configuration; no secrets were replaced.
- Private D1 export verified before migration at **12:59:48 PM EST**, outside Git
  and shared folders, on FileVault storage with operator-only permissions.
- Migration `0038_mcp_authorization.sql` applied at **1:01:49 PM EST**; no migrations
  remain pending. Historical assistant grants were revoked. Existing assistants must
  reconnect; normal Mail sessions and CRM Sales grants remain intact.
- All three OAuth/resource discovery endpoints returned **200 JSON**. Unauthenticated
  MCP GET and POST returned **401** with the resource-metadata challenge. `/login`
  returned 200 and anonymous `/` redirected to login. This is curl evidence, not
  proof of access from Austin's ChatGPT client.
- Initial deployment vars were `APP_URL=https://mail.tailoredagents.com`,
  `API_SEND_ENABLED=true`, `API_DAILY_SEND_LIMIT=25`. Austin's later `whoami` check
  confirmed the effective enabled policy and 25-per-user-UTC-day cap.
- Fresh local verification passed **424/424 tests**, **2/2 MCP browser tests**,
  Worker build, and Svelte/TypeScript check with zero errors or warnings.
- The later connection and body-tool correction are recorded below. Live sends,
  mailbox mutations and production refresh/revocation remain untested. The custom
  tools are available in Austin's ChatGPT, not this separate Codex conversation.

## Austin connection verification — November 1, 2026

Austin signed in himself. Jeffrey, with Austin present, relayed his consent and
confirmed the intended ChatGPT account. The assistant completed DCR/OAuth in that
session for **`austin@tailoredagents.com`**, explicitly selecting Read, Send and Manage.
Mail's Connected assistants page confirms all three scopes. ChatGPT's plugin
permission is **Allow read-only tools** (`ask_before_writes`): reads may run without
asking, while every change requires approval. This does not remove the send/manage
OAuth scopes.

- `whoami` returned only Austin's owned address, all three scopes,
  `sending.enabled:true` and `daily_limit:25`. All **23 tools** are available:
  11 read, 5 send and 7 manage.
- Three Inbox and three Sent threads were sampled. Both folder searches returned
  known conversations. Repeated reads with `markRead:false` preserved message IDs
  and read flags; latest-response direction/time were inspected. No mailbox records
  were changed and no messages were sent.
- An actual client failure was found: `get_message_body` returned `{}` to ChatGPT
  even with the correct message ID, while `get_thread` worked. Main **`2e1b3ed`**
  adds explicit output schemas and `structuredContent` to body/attachment chunk
  tools, retaining the JSON text representation for existing clients. This follows
  the [OpenAI MCP result guidance](https://developers.openai.com/api/docs/mcp).
  Worker **`0c669d63-88d1-4389-bfa1-0a85893ed27e`** was uploaded at **6:14:40 PM EST**
  and deployed successfully. After refreshing tools, the same ChatGPT read returned
  **16,491 characters**, the correct metadata and `next_offset:null`, matching
  `get_thread`. The empty-result failure is resolved.
- Verification: **425/425 Mail tests**, **18/18 targeted MCP checks**, **2/2 built
  Worker browser tests** (including structured body output over HTTP), production
  build, zero-error/zero-warning type check and clean targeted lint. After deploy,
  the three discovery endpoints returned 200 with curl; anonymous MCP GET/POST
  returned 401 with challenges. Python urllib requests encountered an edge 403;
  curl and the actual authenticated ChatGPT client passed. No edge policy changed.
- Austin's existing **Business email updates** monitor was edited, saved and read
  back. iCloud, prior context, task name and Custom/Eastern Time/same-chat/Medium
  settings were preserved. Mail uses `markRead:false`, owned-mail scope, deduplication,
  quiet unchanged checks and explicit access-failure reporting. **Run now** completed
  with both mailboxes accessible and established Austin's Mail baseline. No duplicate
  monitor or automatic replies were created. A future unattended run is not yet observed.

**Remaining limits:** The six sampled threads had no attachments and no further
thread pages; the full body fit in one chunk. Production attachment retrieval,
continuation pages, token refresh/revocation, actual sends and management actions
remain **UNTESTED**. Local chunk/attachment/refresh/revocation coverage passed.
Shared Sales remains outside Austin's ownership-only MCP scope. Installing the
plugin in his ChatGPT account did not expose its tools in this Codex conversation.
Private configuration backups and sanitized verification reports are outside Git in
the operator's `TailoredAgents/operations/austin-mail-connection-2026-11-01` folder.

## What changed

The existing `/mcp`, OAuth routes, and MCP SDK remain in use. Exact protocol routes
can now reach their handlers. All mailbox tools still require an OAuth bearer token.
Ordinary app routes retain their session, owner, password-change and origin checks.
Login preserves validated OAuth and deletion-confirmation return URLs.

The built Worker converts form-encoded `/oauth/token` and `/oauth/revoke` POSTs to
bounded JSON before SvelteKit's form-CSRF filter. This applies only when Origin is
absent or matches the request's origin; it removes cookies and never applies to
consent or ordinary app routes. Consent and confirmation forms retain same-origin
CSRF checks and use `Referrer-Policy: same-origin`, preventing cross-origin referrer
disclosure without turning their form Origin into `null`.

Discovery uses configured `APP_URL`, not an arbitrary host header. Code exchange
requires PKCE S256, matching client, redirect URI and resource. Access tokens expire
after one hour; refresh tokens rotate and expire after 30 days. Replay revokes the
family, including concurrent refresh attempts. Disabled accounts, revoked families,
malformed expiry dates and wrong resources fail closed. Tokens are stored hashed.

Public-client dynamic registration (DCR, authentication method `none`) is supported.
Arbitrary Client ID Metadata Documents are no longer fetched: the old implementation
could not guarantee DNS-safe outbound fetching. Metadata advertises CIMD as disabled.
Legacy API keys do not authenticate MCP. No new API key, client secret, Resend proxy
or replacement authentication service is needed.

**Migration 0038 revokes old OAuth grants and codes once.** Their old omitted-scope
behavior granted sending implicitly. Reconnect through explicit consent; old tokens
are never upgraded. Session logins and CRM shared-address grants are unaffected.

## Permissions and tools

Omitted scope defaults to `mail:read`. The consent page shows the signed-in account,
owned addresses, and three independently selectable permissions. Only read is
preselected, even if a client requested broader scopes. Selecting all three grants
full implemented capabilities. Refresh can narrow, never widen, a grant.

| Permission | Tools and behavior |
| --- | --- |
| `mail:read` | `whoami`, `list_folders`, `list_threads`, `search_mail`, `get_thread`, `get_message_body`, `list_attachments`, `get_attachment`, `list_labels`, `get_draft`, `get_draft_attachment` |
| `mail:send` | `send_message`; `reply`, `forward`, `forward_thread`, and `send_draft` also require `mail:read` because they disclose existing content |
| `mail:manage` | `save_draft`, `delete_draft`, `restore_message`, `update_thread`, `set_thread_labels`, `manage_label`, `request_permanent_delete` |

`whoami` reports the account, owned addresses, effective permissions and send policy.
Tool discovery follows the token's permissions. A production emergency send switch
still applies. Production now sets `API_SEND_ENABLED=true` and `API_DAILY_SEND_LIMIT=100`;
local and staging sending remain disabled. Sending still requires an explicit `mail:send`
grant, and the client must request approval for each send. Mailbox management does not
depend on this switch. Normal Mail browser sending is not subject to this assistant cap.

Reading never marks read. `get_thread` retains optional `markRead:false`; `true` is
rejected and the assistant must use `update_thread({id,isRead:true})` instead.
Monitoring does not archive, label, update read status or modify message records.
Security bookkeeping, such as token last-use timestamps, is separate from mail state.

Search supports the Mail system's current-folder operators (`from:`, `to:`, `subject:`,
`after:`, `before:`, `has:attachment`). Inbox and Sent results include the latest live,
non-draft message's sender, recipient, direction, time and delivery state. Thread
results include both directions. Bodies load from R2, report truncation, and provide
offsets for remaining content. Missing R2 content is an error, not a false full-body
result. Threads/attachment lists return ten messages at a time; body chunks are 20,000
characters; attachment chunks are 64 KiB of base64-encoded bytes.

Draft edits preserve omitted fields. Deleting a draft moves it to Trash and can be
undone. `send_draft` requires its reviewed `draft_revision`; changes invalidate that
revision. With a management grant, sending moves the draft to Trash; otherwise it
retains the draft. Use the same idempotency key when retrying a send.

All sends use `sendAndStore`: owned sending identity, recipient validation, signature,
stored sent copy, reply headers, durable provider payload and duplicate-send guard.
Reply-To is respected, and replies reject changed recipients or newer conversation
messages. Recovery preserves provider idempotency and rechecks the OAuth family,
send scope, account, public resource, enabled policy and sender ownership. A disconnected
assistant cannot initiate a recovery resend. Already accepted messages cannot be recalled.
The default external-send allowance is 100 messages per user per Eastern calendar day; choose a
smaller production cap if desired. A retry of an accepted send does not consume another
slot. Ambiguous provider results retain their allowance and original recovery key.

## Approval: what is and is not enforced

- Mail enforces authentication, ownership, scopes, expiry, enabled policy and send caps.
- Write tools explicitly use `readOnlyHint:false`; sends are consequential, irreversible
  external actions. Destructive mailbox actions are also marked as writes.
- **The client enforces per-action human confirmation for sends and other writes.**
  MCP annotations and instructions are hints, not cryptographic evidence of approval.
  There is no model-supplied `approved:true` bypass or claim of server-verified send approval.
  A stolen send token or a client that ignores confirmation can send within its grant.
  Use a trusted client and require confirmation on each send; do not remember blanket
  approvals. Connecting is not permission to send unsolicited messages.
- **Permanent deletion adds a server-enforced human step.** The MCP tool only returns
  a ten-minute confirmation URL for one owned message already in Trash. The mailbox
  owner must sign in to Mail, review the exact subject/sender, type `DELETE`, and submit
  a same-origin form. A bearer token alone cannot complete it. Confirmation is single-use
  and checks the current management grant. This is a separate authenticated confirmation
  boundary, not proof that a human rather than automation holding the session clicked it.
  Protect browser sessions as well as OAuth tokens. Existing file-retention rules still apply;
  deletion is not a promise of immediate physical erasure from all backups/providers.

Disconnect via **Mail → Settings → Connected assistants** or
`https://mail.tailoredagents.com/settings/connections`.

## Ownership and current limitations

- MCP follows **Mail user ownership**, not CRM address sharing. Austin cannot use this
  connector to read Jeffrey's `sales@` mailbox merely because the CRM shares it with him.
  No persistent access was granted here. Supporting shared-address MCP access would
  need a separately designed grant-aware mode, not a relaxed owner check.
- Consent covers the signed-in user's existing/future owned mailbox, including aliases;
  it is not a per-alias selective grant.
- Fixed Inbox/Sent/Drafts/Archive/Starred/Spam/Trash views are supported. Custom organization
  uses labels; the Mail system has no arbitrary nested IMAP folder creation/renaming.
- New inline attachment uploads through MCP are bounded by the 1 MiB request limit,
  700,000 base64 characters per file, and ten files. Larger files can be attached in the
  Mail composer, then read/sent as saved drafts. Stored attachments can be forwarded
  within the existing 20 MiB outgoing total. There is no multipart/chunked upload tool.
- `forward_thread` forwards up to twenty explicitly listed messages; it never silently
  includes newly arriving messages. Existing UI `forwardAll` drafts must currently be
  sent in Mail. Direct thread forwarding is supported through `forward_thread`.
- No Reply All tool, scheduled-send tool, custom-folder tool or automatic-label-rule
  administration is exposed. Use Mail's Reply All for CC-aware replies. MCP `reply`
  uses the reviewed reply target only. These are identified gaps, not read-only mode.
- Attachment bytes are not executed or rendered by the server. The assistant's ability
  to interpret a PDF/image depends on its client. Download URLs for normal Mail remain
  session-only; MCP uses the authenticated attachment tools.
- No push subscription or unattended monitoring scheduler was added. Clients may poll
  read tools without mutating mail; their own scheduling availability varies.
- Sending/read tests with a real ChatGPT account and production provider remain pending
  approval. Local results do not establish email deliverability or ChatGPT plan eligibility.

## Local verification

Final local results: **424/424 unit/integration tests passed**, **2/2 browser tests
passed**, production Worker build passed as part of the browser suite, Svelte/TypeScript
check passed with zero errors and warnings, targeted lint passed with two pre-existing unused-parameter warnings in `receive.ts`,
and `git diff --check`
passed. Desktop/mobile consent screenshots were inspected. The browser test callback
is deliberately a nonexistent local path, so its expected callback-page 404 is not
an OAuth failure; the tests verify and exchange the returned authorization code.
Production deployment and public discovery are now verified above. Real ChatGPT
connection/plan eligibility, edge accessibility from ChatGPT and live delivery remain
unverified; a live send still requires the exact approved recipient and content.

From `apps/mail`:

```powershell
npm test
npm run check
npm run db:migrate:local
npx tsx scripts/seed-local-test.ts
npx playwright test tests/browser/mcp.spec.ts
```

The browser suite builds and runs the actual wrapped Cloudflare Worker locally. It
tests discovery, login continuation, read-only/default and all-scope consent, PKCE,
form-encoded token exchange, authenticated MCP reads, rotation, revocation, and the
permanent-deletion confirmation flow using disposable local data. It never calls a
send tool. Do not run the broader browser suite against live credentials: older tests
exercise the composer send button.

From the repo root, run targeted lint on changed Mail TS/Svelte files and `git diff --check`.
The root `npm run lint` does not cover `apps/mail`; it is not a substitute for Mail checks.

## Deployment — only after the user's explicit approval

This is the **Cloudflare Mail Worker**, not the Render website. The user approved
committing and pushing this update on October 30, 2026, then requested deployment and
enabled production sending on October 31. Jeffrey's authenticated Cloudflare account
completed deployment on November 1. The procedure below is retained for recovery;
do not rerun migration SQL manually. Austin must personally consent to his connection,
and a live send requires approval of its exact recipient/content. Do not copy local
fixture accounts/tokens.

1. Review the diff and local results. Production sending is authorized with the
   approved cap of 100 per user per Eastern calendar day. Commit/push to `main` is authorized.
   Do not force-push or overwrite collaborator changes.
2. Use the Cloudflare account already authorized for Mail. Do not create new secrets
   without approval. Existing Resend/D1/R2/queue bindings are reused.
3. From `apps/mail`, export a pre-migration backup **to a private location outside Git**:

   ```powershell
   npx wrangler d1 export DB --env production --remote --output C:/private-backups/tailored-mail-before-mcp.sql
   ```

   Create/use a protected backup directory first. This file contains private mailbox
   data and hashed credentials. Never attach it to a chat or commit it.
4. Apply the additive migration (this invalidates old OAuth tokens, not Mail sessions):

   ```powershell
   npx wrangler d1 migrations apply DB --env production --remote
   ```

5. Verify `env.production.vars.APP_URL` is exactly `https://mail.tailoredagents.com`.
   Verify **only production** has `API_SEND_ENABLED` set to `"true"` and
   `API_DAILY_SEND_LIMIT` set to `"100"`. Keep staging/local choices
   separate. Changing this flag alone would not have fixed the old outbox; this code does.
6. Deploy the wrapped Worker, including queue and scheduled recovery handlers:

   ```powershell
   npm run deploy:production
   ```

7. Verify public endpoints without authenticating:
   - `GET /.well-known/oauth-authorization-server`: 200 JSON, canonical issuer, PKCE S256,
     three scopes, DCR and token/revoke endpoints.
   - `GET /.well-known/oauth-protected-resource/mcp` and root metadata alias: 200 JSON,
     resource `https://mail.tailoredagents.com/mcp`.
   - Unauthenticated `GET` and `POST /mcp`: 401 with `WWW-Authenticate` and resource metadata.
     Mailbox data must never appear. Authenticated GET is 405 (stateless POST transport).
8. Check Cloudflare Security Events if ChatGPT sees 403/challenge HTML. Match the actual
   request path, timestamp and Ray ID. Remove only the specific challenge/Access policy
   preventing protocol discovery or token transport, scoped to this hostname and exact
   protocol paths as appropriate. Keep ordinary login/consent session and CSRF protections,
   WAF protections and DCR/token rate limits. Do not broadly disable Cloudflare security,
   trust a spoofable User-Agent, or expose mailbox tools without OAuth.
9. With approval to create the connection, complete the ChatGPT settings below. Confirm
   account/addresses, grant selected scopes, inspect effective `whoami`, read an owned
   incoming thread and a sent conversation without marking read, and test cross-account
   denial. Verify refresh and disconnect/reconnect. This creates persistent grants; do
   not perform it as an unauthenticated discovery test.
10. **Arrange a harmless send first:** user confirms the recipient they control, sending
    address, subject and exact text. Review and approve the client prompt. Send once with
    one idempotency key, verify Sent and receipt, then retry the same key to verify replay.
    No email should be sent merely to test setup without that explicit approval.

Rollback: set production `API_SEND_ENABLED=false` and redeploy to halt new token sends;
disconnect grants for access revocation. To close MCP completely, restore the former
route guard in a reviewed rollback deployment. Retain migration 0038 and the existing
CRM schema. Do not restore revoked tokens from backup or drop data tables as a rollback.

## Exact ChatGPT settings (after approved deployment)

Current official documentation describes **ChatGPT on the web → Plugins → plus →
Add custom MCP server**. Create/install a personal plugin or the intended workspace
plugin. Workspace controls and Lockdown may restrict access. See
[OpenAI's custom MCP guide](https://developers.openai.com/api/docs/guides/custom-mcp-server).

| Setting | Value |
| --- | --- |
| Name | Tailored Agents Mail |
| Description | Search and manage my owned Mail mailbox; confirm every send and destructive action. |
| Connection | Server URL |
| Server URL | `https://mail.tailoredagents.com/mcp` |
| Authentication | **OAuth**, not “No authentication” or mixed OAuth/anonymous |
| OAuth client registration | Dynamic client registration (DCR); leave static client ID/secret empty |
| Requested scopes, if editable | `mail:read mail:send mail:manage` |
| Resource, if editable | `https://mail.tailoredagents.com/mcp` |
| Mail consent | Verify your account/owned addresses; explicitly check Read, Send, Manage |
| Tool approvals | Confirm each write/send; do not enable remembered blanket approvals |

Authorization URL, token URL and registration URL are discovered from metadata; if
the client asks explicitly they are `/oauth/authorize`, `/oauth/token`, `/oauth/register`
on `https://mail.tailoredagents.com`. Do not invent a client secret for public-client DCR.
After changing scopes or deploying new tools, refresh the plugin's tool list and reconnect
if the granted scopes changed. Invoke the installed plugin with `@Tailored Agents Mail`.

OpenAI documents support for both read and write custom MCP tools, with write confirmation
by default. The user confirmed **ChatGPT Pro** on October 30, 2026; the actual client and
available custom MCP controls have not yet been verified. A plan name alone does not
verify this connection's write support. If this account exposes only read-only
connectors or lacks custom MCP creation/write tools, use a supported ChatGPT web/workspace
configuration or another approval-capable MCP client. Keep OAuth and the server capabilities
intact; do not work around plan limitations by exposing anonymous endpoints.

## Observed public baseline

Before deployment, this computer received HTTP **404 application/json** from Cloudflare
for `/mcp` and both discovery endpoints on October 30, 2026. The web research tool could
not access them. This confirms the deployed application block but does not rule out
different Cloudflare policy results for ChatGPT's egress. No edge settings were changed.
