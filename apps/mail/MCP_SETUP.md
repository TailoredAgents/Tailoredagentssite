# Tailored Agents Mail MCP — deployment and connection handoff

Updated October 31, 2026. **Commit/push and production sending authorized; Cloudflare deployment remains pending authentication.**
Production configuration now enables OAuth sending with a starting cap of 25 messages
per user per UTC day. This is a source configuration change, not a verified live deployment.
No production clients, access tokens, credentials, or mailbox grants were created.
No real messages were sent. Unit tests use a mocked provider; browser tests use
disposable local accounts, drafts and OAuth credentials.

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
still applies. Production now sets `API_SEND_ENABLED=true` and `API_DAILY_SEND_LIMIT=25`;
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
The default external-send allowance is 100 messages per user per UTC day; choose a
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
Production deployment, real ChatGPT connection/plan eligibility, edge accessibility
from ChatGPT, and live delivery remain unverified pending approval.

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
enabled production sending on October 31. Cloudflare CLI authentication is unavailable
on this computer. Creating a persistent connection and the live send test still require
separate approval. Do not copy local fixture accounts/tokens.

1. Review the diff and local results. Production sending is authorized with a configured
   starting cap of 25 per user per UTC day. Commit/push to `main` is authorized.
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
   `API_DAILY_SEND_LIMIT` set to `"25"`. Keep staging/local choices
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
