// Loopback-only synthetic Twilio contract. No provider account or real messages.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import twilio from "twilio";
import pg from "pg";
const url = new URL(process.env.SMS_TEST_DATABASE_URL || "");
if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/ta_sms_browser_test" || url.search || url.hash)
  throw new Error("SMS fixtures require the exact disposable local ta_sms_browser_test database.");
const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
const workspace = "00000000-0000-4000-8000-000000000001";
const numberId = "00000000-0000-4000-8000-000000000801";
const account = `AC${"1".repeat(32)}`, phone = "+16785550100", numberSid = `PN${"3".repeat(32)}`;
const remote = "+16785550101", origin = "http://127.0.0.1:3140";
await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
for (const filename of (await readdir("db/migrations")).filter(n=>n.endsWith(".sql")).sort()) {
  if (!(await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [filename])).rowCount) {
    await pool.query(await readFile(`db/migrations/${filename}`, "utf8"));
    await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [filename]);
  }
}
await pool.query('TRUNCATE sms_numbers,crm_channel_preferences,crm_lists,crm_businesses,leads,request_rate_limits,"rateLimit","user" CASCADE');
const password = await hashPassword("Sms-test-password-2026");
for (const [name, role] of [["owner", "owner"], ["viewer", "viewer"], ["readonly", "member"], ["unapproved", "member"]]) {
  const id = `sms-${name}`;
  await pool.query('INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)', [id, `Fixture ${name}`, `${name}@example.test`]);
  await pool.query('INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,\'credential\',$2,$3)', [randomUUID(), id, password]);
  await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')", [randomUUID(), workspace, id, role]);
}
await pool.query("INSERT INTO crm_businesses(id,workspace_id,name,normalized_phone) VALUES('00000000-0000-4000-8000-000000000802',$1,'Example landscaping',$2)", [workspace, remote]);
await pool.query("INSERT INTO leads(id,workspace_id,name,organization,phone,description) VALUES('00000000-0000-4000-8000-000000000803',$1,'Customer','Example inquiry',$2,'Synthetic website request')", [workspace, remote]);
let messages = new Map(), creates = [], unknownNext = false;
async function reset() {
  messages = new Map(); creates = []; unknownNext = false;
  await pool.query('TRUNCATE sms_numbers,crm_channel_preferences,request_rate_limits,"rateLimit" CASCADE');
  await pool.query("INSERT INTO sms_numbers(id,workspace_id,account_sid,provider_sid,phone,connected_by_user_id) VALUES($1,$2,$3,$4,$5,'sms-owner')", [numberId, workspace, account, numberSid, phone]);
  for (const [userId, send] of [["sms-owner", true], ["sms-viewer", false], ["sms-readonly", false]])
    await pool.query("INSERT INTO sms_number_grants(workspace_id,number_id,user_id,can_send,approved_by_user_id) VALUES($1,$2,$3,$4,'sms-owner')", [workspace, numberId, userId, send]);
}
await reset();
async function callback(path, params) {
  const target = origin+path;
  const response = await fetch(target, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": twilio.getExpectedTwilioSignature("a".repeat(32), target, params) }, body: new URLSearchParams(params) });
  return { status: response.status, body: await response.text() };
}
function reply(response, data, status = 200) { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(data)); }
createServer(async (request, response) => {
  try {
    if (request.url === "/health") return reply(response, { ok: true });
    if (request.headers.authorization !== "Bearer sms-fixture-control") return reply(response, {}, 403);
    let raw = ""; for await (const chunk of request) { raw += chunk; if (raw.length > 100000) return reply(response, {}, 413); }
    const input = JSON.parse(raw || "{}");
    if (request.url === "/control") {
      if (input.action === "reset") await reset();
      if (input.action === "unknown") unknownNext = true;
      if (input.action === "clear-number") await pool.query("DELETE FROM sms_numbers WHERE id=$1", [numberId]);
      if (input.action === "revoke") await pool.query("DELETE FROM sms_number_grants WHERE user_id=$1", [input.userId || "sms-owner"]);
      if (input.action === "incoming") {
        const params = { AccountSid: account, MessageSid: input.sid || `SM${"4".repeat(32)}`, From: input.from || remote, To: phone, Body: input.text || "Could you help with our website?", NumMedia: "0", FutureField: "signature-covered" };
        return reply(response, { ...await callback("/api/integrations/twilio/sms/incoming", params), creates, numberId });
      }
      if (input.action === "status") {
        const message = messages.get(input.sid || [...messages.keys()].at(-1));
        if (!message) return reply(response, {}, 404);
        message.status = input.status || "delivered";
        return reply(response, { ...await callback(new URL(message.callback).pathname+new URL(message.callback).search, { AccountSid: account, MessageSid: message.sid, From: message.from, To: message.to, MessageStatus: message.status, ErrorCode: "" }), creates });
      }
      return reply(response, { creates, messages: [...messages.values()], numberId });
    }
    if (request.url !== "/transport") return reply(response, {}, 404);
    const target = new URL(input.uri);
    const envelope = (body, statusCode = 200) => reply(response, { statusCode, body, headers: {} });
    if (target.pathname.endsWith("/IncomingPhoneNumbers.json")) return envelope({ incoming_phone_numbers: [{ sid: numberSid, account_sid: account, phone_number: phone, capabilities: { sms: true, voice: true } }], next_page_uri: null });
    if (target.pathname.endsWith("/Messages.json") && input.method.toUpperCase() === "POST") {
      const fields = typeof input.data === "string" ? Object.fromEntries(new URLSearchParams(input.data)) : input.data;
      const sid = `SM${(messages.size+100).toString(16).padStart(32,"0")}`;
      const message = { sid, account_sid: account, from: fields.From, to: fields.To, body: fields.Body, status: "queued", error_code: null, callback: fields.StatusCallback };
      messages.set(sid, message); creates.push({ sid, text: fields.Body, to: fields.To, callback: fields.StatusCallback });
      if (unknownNext) { unknownNext = false; return envelope({ code: 20500, message: "Synthetic uncertain response" }, 500); }
      return envelope(message, 201);
    }
    const sid = target.pathname.match(/\/(SM[0-9a-f]{32})\.json$/i)?.[1];
    if (sid && messages.has(sid)) return envelope(messages.get(sid));
    return envelope({ code: 20404, message: "Synthetic missing resource" }, 404);
  } catch { return reply(response, { error: "synthetic_fixture_failure" }, 500); }
}).listen(3141, "127.0.0.1", ()=>process.stdout.write("Synthetic SMS fixture ready on loopback 3141.\n"));
