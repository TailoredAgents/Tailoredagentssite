// Synthetic loopback-only Mail contract fixture. Never uses a real email provider.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
const database = new URL(process.env.INBOX_TEST_DATABASE_URL || "");
if (!["postgres:", "postgresql:"].includes(database.protocol) || !["127.0.0.1", "localhost"].includes(database.hostname) || database.pathname !== "/ta_inbox_browser_test" || database.search || database.hash)
  throw new Error("Synthetic Inbox fixtures require the exact local ta_inbox_browser_test database.");
const pool = new pg.Pool({ connectionString: database.toString(), max: 1 });
const workspace = "00000000-0000-4000-8000-000000000001";
await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
for (const filename of (await readdir("db/migrations")).filter(n => n.endsWith(".sql")).sort()) {
  if (!(await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [filename])).rowCount) {
    await pool.query(await readFile(`db/migrations/${filename}`, "utf8"));
    await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [filename]);
  }
}
await pool.query('TRUNCATE crm_channel_preferences,crm_lists,crm_businesses,leads,request_rate_limits,"rateLimit","user" CASCADE');
for (const [name, role] of [["owner", "owner"], ["viewer", "viewer"], ["readonly", "member"], ["unapproved", "member"]]) {
  await pool.query('INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)', [`inbox-${name}`, `Fixture ${name}`, `${name}@example.test`]);
  await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')", [randomUUID(), workspace, `inbox-${name}`, role]);
}
await pool.query("INSERT INTO crm_businesses(id,workspace_id,name,normalized_email) VALUES('00000000-0000-4000-8000-000000000901',$1,'Example landscaping','customer@example.test')", [workspace]);
await pool.query("INSERT INTO leads(id,workspace_id,name,organization,email,description) VALUES('00000000-0000-4000-8000-000000000902',$1,'Customer','Example inquiry','customer@example.test','Synthetic website request')", [workspace]);
const tokens = new Map();
let threads, sends, attempts, uncertain, revoked;
function message(id, text, attachments = []) {
  return { id, direction: "inbound", from_addr: "customer@example.test", from_name: "Example Customer", to_addr: "sales@example.test", cc_addr: null,
    subject: "Website project", body_text: text, body_html: '<img src="https://tracking.example.test/pixel">', bcc_addr: "private@example.test", content_key: "private-storage-key",
    status: null, status_detail: null, is_read: false, created_at: "2026-10-21T12:00:00Z", reply_target: ["customer@example.test"], attachments };
}
async function reset() {
  threads = new Map([["thread-website", { threadId: "thread-website", subject: "Website project", messages: [message("message-website", "Could you build our website and an AI receptionist?", [{ id: "attachment-brief", filename: "project-brief.txt", content_type: "text/plain", size_bytes: 23 }])] }],
    ["thread-quote", { threadId: "thread-quote", subject: "Quote follow-up", messages: [message("message-quote", "Please send a quote.")] }]]);
  sends = new Map(); attempts = []; uncertain = false; revoked = false;
  await pool.query("TRUNCATE inbox_conversations,inbox_notes,inbox_drafts,inbox_read_receipts,inbox_outbound_intents CASCADE");
  await pool.query('TRUNCATE request_rate_limits,"rateLimit"');
}
await reset();
function respond(response, value, status = 200) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(value)); }
createServer(async (request, response) => {
  try {
    if (request.url === "/health") return respond(response, { ok: true });
    let raw = "";
    for await (const chunk of request) { raw += chunk; if (raw.length > 100000) return respond(response, { error: "too_large" }, 413); }
    const body = raw ? JSON.parse(raw) : {};
    if (request.url === "/test-control") {
      if (request.headers.authorization !== "Bearer inbox-synthetic-control") return respond(response, {}, 403);
      if (body.action === "reset") await reset();
      if (body.action === "uncertain") uncertain = true;
      if (body.action === "revoke") revoked = true;
      return respond(response, { sends: sends.size, attempts, messages: [...threads.values()] });
    }
    if (request.url === "/api/dashboard-auth") {
      if (request.headers.authorization !== "Bearer inbox-browser-local-identity-secret-1234567890") return respond(response, {}, 403);
      if (body.action === "revoke") { tokens.delete(body.token); return respond(response, { ok: true }); }
      let name;
      if (body.action === "login" && body.password === "Inbox-test-password-2026") name = ["owner", "viewer", "readonly", "unapproved"].find(n => body.email === `${n}@example.test`);
      if (body.action === "inspect") name = tokens.get(body.token);
      if (!name) return respond(response, { error: "invalid_credentials" }, 401);
      const identity = { user: { id: `mail-${name}`, email: `${name}@example.test`, name: `Fixture ${name}`, isAdmin: name === "owner" }, expiresAt: new Date(Date.now()+86400000).toISOString() };
      if (body.action === "login") { identity.token = randomUUID().replaceAll("-", "") + "fixturegrant"; tokens.set(identity.token, name); }
      return respond(response, identity);
    }
    if (request.url !== "/api/crm-mail" || request.headers.authorization !== "Bearer inbox-browser-local-crm-service-secret-1234567890") return respond(response, {}, 403);
    const actor = tokens.get(body.token);
    if (!actor) return respond(response, {}, 403);
    const allowed = actor !== "unapproved" && !revoked;
    const mailbox = { id: "address-sales", name: "Shared sales", email: "sales@example.test", canSend: actor !== "readonly", addresses: [{ id: "address-sales", address: "sales@example.test" }] };
    if (body.action === "mailboxes") return respond(response, { mailboxes: allowed ? [mailbox] : [] });
    if (!allowed || body.mailboxId !== mailbox.id) return respond(response, {}, 403);
    if (body.action === "threads") {
      const rows = [...threads.values()].filter(t => !body.q || `${t.subject} ${t.messages.map(m=>m.body_text).join(" ")}`.toLowerCase().includes(body.q.toLowerCase())).map(t => {
        const m = t.messages.at(-1);
        return { thread_id: t.threadId, latest_id: m.id, subject: t.subject, preview: m.body_text, participants: [{ label: "Example Customer", address: "customer@example.test", self: false }], message_count: t.messages.length, is_read: false, has_attachments: t.messages.some(m=>m.attachments.length), status: m.status, created_at: m.created_at };
      });
      return respond(response, { threads: body.view === "archive" ? [] : rows, total: body.view === "archive" ? 0 : rows.length, page: 1, pageCount: 1 });
    }
    if (body.action === "thread") return threads.has(body.threadId) ? respond(response, threads.get(body.threadId)) : respond(response, {}, 404);
    if (body.action === "attachment") {
      if (body.messageId !== "message-website" || body.attachmentId !== "attachment-brief") return respond(response, {}, 404);
      response.writeHead(200, { "content-type": "text/plain", "content-disposition": 'attachment; filename="project-brief.txt"', "content-length": "23" }); return response.end("Synthetic project brief");
    }
    if (body.action === "send") {
      if (!mailbox.canSend) return respond(response, {}, 403);
      if (!/^[0-9a-f-]{36}$/i.test(body.idempotencyKey) || (body.threadId && ("to" in body || "subject" in body))) return respond(response, {}, 400);
      attempts.push({ key: body.idempotencyKey, text: body.text, threadId: body.threadId, to: body.to, subject: body.subject });
      const key = `${actor}:${body.idempotencyKey}`;
      if (sends.has(key)) return respond(response, sends.get(key));
      const threadId = body.threadId || `thread-${sends.size+1}`;
      const thread = threads.get(threadId) || { threadId, subject: body.subject, messages: [] };
      const id = `outbound-${sends.size+1}`;
      thread.messages.push({ ...message(id, body.text), direction: "outbound", from_addr: mailbox.email, from_name: "Sales", to_addr: body.to || "customer@example.test", subject: thread.subject, status: "sent", created_at: new Date().toISOString() });
      threads.set(threadId, thread);
      const receipt = { messageId: id, threadId, status: "accepted" }; sends.set(key, receipt);
      if (uncertain) { uncertain = false; return respond(response, { error: "unavailable" }, 503); }
      return respond(response, receipt);
    }
    return respond(response, {}, 400);
  } catch { return respond(response, { error: "synthetic_fixture_failure" }, 500); }
}).listen(3131, "127.0.0.1", () => process.stdout.write("Synthetic Mail fixture ready on loopback 3131.\n"));
