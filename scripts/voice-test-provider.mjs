// Loopback-only voice fixture. No real accounts, microphone, calls or recordings.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import twilio from "twilio";
import pg from "pg";
const url = new URL(process.env.VOICE_TEST_DATABASE_URL || "");
if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55433" || url.pathname !== "/ta_voice_browser_test" || url.search || url.hash)
  throw new Error("Voice fixtures require the exact disposable local database.");
const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });
const workspace = "00000000-0000-4000-8000-000000000001", lineId = "00000000-0000-4000-8000-000000000701";
const businessId = "00000000-0000-4000-8000-000000000702", contactId = "00000000-0000-4000-8000-000000000703";
const account = `AC${"1".repeat(32)}`, phone = "+16785550100", remote = "+16785550101", numberSid = `PN${"3".repeat(32)}`;
const origin = "http://127.0.0.1:3160";
await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
for (const filename of (await readdir("db/migrations")).filter(n => n.endsWith(".sql")).sort()) {
  if (!(await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [filename])).rowCount) {
    await pool.query(await readFile(`db/migrations/${filename}`, "utf8"));
    await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [filename]);
  }
}
const password = await hashPassword("Voice-test-password-2026");
let calls, recordings, devices, events, connects, mediaReads, deletes, accepts;
function sid(prefix) { return prefix + randomUUID().replaceAll("-", ""); }
function attr(xml, name) { return xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]?.replaceAll("&amp;", "&"); }
async function callback(target, params) {
  if (!target.startsWith(origin + "/api/integrations/twilio/voice/")) throw new Error("Unexpected signed callback target");
  const response = await fetch(target, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": twilio.getExpectedTwilioSignature("a".repeat(32), target, params) }, body: new URLSearchParams(params) });
  return { status: response.status, body: await response.text() };
}
async function reset() {
  calls = new Map(); recordings = new Map(); devices = new Set(); events = new Map(); connects = []; mediaReads = 0; deletes = 0; accepts = 0;
  await pool.query('TRUNCATE crm_conversations,crm_conversation_sync,voice_lines,sms_numbers,crm_channel_preferences,crm_businesses,leads,request_rate_limits,"rateLimit","user" CASCADE');
  for (const [name, role] of [["owner", "owner"], ["austin", "member"], ["viewer", "viewer"], ["readonly", "member"], ["unapproved", "member"]]) {
    const id = `voice-${name}`;
    await pool.query('INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)', [id, `Fixture ${name}`, `${name}@example.test`]);
    await pool.query('INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,\'credential\',$2,$3)', [randomUUID(), id, password]);
    await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')", [randomUUID(), workspace, id, role]);
  }
  await pool.query("INSERT INTO crm_businesses(id,workspace_id,name,normalized_phone) VALUES($1,$2,'Example Landscaping',$3)", [businessId, workspace, remote]);
  await pool.query("INSERT INTO contacts(id,workspace_id,business_id,name,phone,is_primary) VALUES($1,$2,$3,'Jordan Example',$4,true)", [contactId, workspace, businessId, remote]);
  await pool.query("INSERT INTO voice_lines(id,workspace_id,account_sid,phone,provider_sid,hours_start,hours_end,hours_days) VALUES($1,$2,$3,$4,$5,'00:00','23:59',ARRAY[0,1,2,3,4,5,6])", [lineId, workspace, account, phone, numberSid]);
  for (const name of ["owner", "austin", "viewer", "readonly"])
    await pool.query("INSERT INTO voice_line_grants(workspace_id,line_id,user_id,can_read,can_call,can_receive,can_manage_voicemail) VALUES($1,$2,$3,true,$4,$4,$4)", [workspace, lineId, `voice-${name}`, ["owner", "austin"].includes(name)]);
}
await reset();
async function incoming() {
  const id = sid("CA"), result = await callback(origin + "/api/integrations/twilio/voice/incoming", { AccountSid: account, CallSid: id, From: remote, To: phone, CallStatus: "ringing" });
  if (result.status !== 200) throw new Error(`Incoming callback ${result.status}`);
  const callId = result.body.match(/name="CallId" value="([^"]+)"/)?.[1] || new URL(attr(result.body, "recordingStatusCallback") || origin).searchParams.get("call");
  const record = { id, callId, from: remote, to: phone, direction: "inbound", xml: result.body, sid: id, account_sid: account, parent_call_sid: null, status: "ringing", duration: "0" };
  calls.set(id, record);
  for (const client of result.body.matchAll(/<Client\b([^>]*)>([\s\S]*?)<\/Client>/g)) {
    const identity = client[2].match(/<Identity>([^<]+)<\/Identity>/)?.[1];
    const child = { ...record, id: sid("CA"), parent_call_sid: id, to: `client:${identity}`, identity, answer: attr(client[1], "url"), callback: attr(client[1], "statusCallback"), direction: "outbound-dial" };
    child.sid = child.id; calls.set(child.id, child);
    if (devices.has(identity)) events.set(identity, [...(events.get(identity) || []), child]);
  }
  return record;
}
async function voicemail(record) {
  let xml = record.xml;
  if (!xml.includes("<Record")) {
    const result = await callback(attr(xml, "action"), { AccountSid: account, CallSid: record.id, From: remote, To: phone, DialCallStatus: "no-answer", DialCallDuration: "0" });
    if (result.status !== 200) throw new Error(`Dial callback ${result.status}`);
    xml = result.body;
  }
  const recordingSid = sid("RE"), target = attr(xml, "recordingStatusCallback");
  if (!target) throw new Error("Voicemail recording not offered");
  recordings.set(recordingSid, { sid: recordingSid, account_sid: account, call_sid: record.id, source: "RecordVerb", channels: 1, duration: "12", status: "completed" });
  const result = await callback(target, { AccountSid: account, CallSid: record.id, RecordingSid: recordingSid, RecordingStatus: "completed", RecordingDuration: "12" });
  if (result.status !== 204 && result.status !== 200) throw new Error(`Recording callback ${result.status}`);
  return { ...result, recordingSid, callId: record.callId };
}
function reply(response, data, status = 200) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(data)); }
createServer(async (request, response) => {
  try {
    // Browser fixture access is limited to the one local test app origin.
    if (request.headers.origin === origin) { response.setHeader("access-control-allow-origin", origin); response.setHeader("access-control-allow-headers", "authorization,content-type"); response.setHeader("access-control-allow-methods", "POST,OPTIONS"); }
    if (request.method === "OPTIONS") { response.writeHead(request.headers.origin === origin ? 204 : 403); return response.end(); }
    if (request.url === "/health") return reply(response, { ok: true });
    if (request.headers.authorization !== "Bearer voice-synthetic-control") return reply(response, {}, 403);
    let raw = ""; for await (const chunk of request) { raw += chunk; if (raw.length > 100000) return reply(response, {}, 413); }
    const input = JSON.parse(raw || "{}");
    if (request.url === "/control") {
      if (input.action === "reset") await reset();
      if (input.action === "revoke") await pool.query("DELETE FROM voice_line_grants WHERE user_id=$1", [`voice-${input.actor || "owner"}`]);
      if (input.action === "close-hours") await pool.query("UPDATE voice_lines SET hours_days=ARRAY[]::integer[] WHERE id=$1", [lineId]);
      if (input.action === "incoming") return reply(response, await incoming());
      if (input.action === "voicemail") return reply(response, await voicemail(await incoming()));
      if (input.action === "connected-recording") {
        const parent=[...calls.values()].find(call=>call.callId===connects.at(-1)?.callId && !call.parent_call_sid);
        if (!parent) throw new Error("Make a synthetic outbound call first");
        const recordingSid=sid("RE");
        recordings.set(recordingSid,{sid:recordingSid,account_sid:account,call_sid:parent.sid,source:"DialVerb",channels:2,duration:"35",status:"completed"});
        const result=await callback(`${origin}/api/integrations/twilio/voice/recordings?call=${parent.callId}`,{AccountSid:account,CallSid:parent.sid,RecordingSid:recordingSid,RecordingStatus:"completed",RecordingSource:"DialVerb",RecordingDuration:"35"});
        if(result.status!==200)throw new Error(`Connected recording ${result.status}`);
        const recording=(await pool.query("SELECT id FROM voice_call_recordings WHERE call_id=$1",[parent.callId])).rows[0];
        const quote="Please send a website proposal next week.";
        await pool.query("UPDATE voice_call_recordings SET transcript=$2,summary=$3,analysis_status='ready' WHERE id=$1",[recording.id,quote,JSON.stringify({summary:"Jordan requested a website proposal for next week.",highlights:[{text:"Website development inquiry",quote}],followUps:[{text:"Prepare the website proposal for Jordan.",quote}]})]);
        return reply(response,{recordingId:recording.id});
      }
      const stored = (await pool.query("SELECT c.id,c.status,c.direction,c.answered_at,v.id AS voicemail_id,v.status AS voicemail_status FROM voice_calls c LEFT JOIN voice_voicemails v ON v.call_id=c.id ORDER BY c.created_at")).rows;
      const presence = (await pool.query("SELECT user_id FROM voice_presence WHERE available AND updated_at>now()-interval '60 seconds'")).rows;
      const tasks=(await pool.query("SELECT id,title,owner_user_id,due_at,status FROM crm_tasks ORDER BY created_at")).rows;
      return reply(response, { connects, devices: [...devices], presence, mediaReads, deletes, accepts, stored, lineId, tasks });
    }
    if (request.url === "/browser") {
      if (input.action === "register") devices.add(input.identity);
      if (input.action === "unregister") { devices.delete(input.identity); events.delete(input.identity); }
      if (input.action === "poll") { const pending = events.get(input.identity) || []; events.delete(input.identity); return reply(response, { events: pending }); }
      if (input.action === "connect") {
        if (Object.keys(input.params).join() !== "IntentToken") throw new Error("Only durable intent may authorize a call");
        const id = sid("CA"), result = await callback(origin + "/api/integrations/twilio/voice/outbound", { AccountSid: account, CallSid: id, From: `client:${input.identity}`, To: "", IntentToken: input.params.IntentToken });
        const number = result.body.match(/<Number\b[^>]*>([^<]+)<\/Number>/)?.[1];
        if (result.status !== 200 || !number) throw new Error(`Outgoing denied ${result.status}`);
        const statusUrl = attr(result.body.match(/<Number\b[^>]*>/)?.[0] || "", "statusCallback"), callId = new URL(statusUrl).searchParams.get("call");
        const parent = { id, callId, from: `client:${input.identity}`, to: "", sid: id, account_sid: account, parent_call_sid: null, status: "in-progress", duration: "0", direction: "inbound", xml:result.body };
        const child = { ...parent, id: sid("CA"), from: phone, to: number, parent_call_sid: id, direction: "outbound-dial" }; child.sid = child.id;
        calls.set(id, parent); calls.set(child.id, child); connects.push({ callId, to: number, keys: Object.keys(input.params) });
        const accepted = await callback(statusUrl, { AccountSid: account, CallSid: child.id, ParentCallSid: id, From: phone, To: number, CallStatus: "in-progress" });
        if (![200, 204].includes(accepted.status)) throw new Error(`Customer answer ${accepted.status}`);
        return reply(response, parent);
      }
      const record = calls.get(input.id);
      if (["accept", "reject", "disconnect"].includes(input.action)) {
        if (!record) return reply(response, {}, 404);
        if (input.action === "accept") {
          accepts++;
          const answered = await callback(record.answer, { AccountSid: account, CallSid: record.id, ParentCallSid: record.parent_call_sid, From: remote, To: record.to, CallStatus: "in-progress" });
          if (answered.status !== 200 || answered.body.includes("<Hangup")) return reply(response, { denied: true });
          record.status = "in-progress";
          await callback(record.callback, { AccountSid: account, CallSid: record.id, ParentCallSid: record.parent_call_sid, From: remote, To: record.to, CallStatus: "in-progress" });
        }
        if (input.action === "reject") record.status = "no-answer";
      }
      return reply(response, { ok: true });
    }
    if (request.url === "/media") { mediaReads++; const bytes = Buffer.from("ID3 synthetic voicemail fixture"); response.writeHead(200, { "content-type": "audio/mpeg", "content-length": bytes.length }); return response.end(bytes); }
    if (request.url !== "/transport") return reply(response, {}, 404);
    const target = new URL(input.uri);
    const envelope = (body, statusCode = 200) => reply(response, { statusCode, body, headers: {} });
    if (target.pathname.endsWith("/IncomingPhoneNumbers.json")) return envelope({ incoming_phone_numbers: [{ sid: numberSid, account_sid: account, phone_number: phone, capabilities: { sms: true, voice: true } }], next_page_uri: null });
    const callSid = target.pathname.match(/\/(CA[0-9a-f]{32})\.json$/i)?.[1];
    if (callSid && calls.has(callSid)) { const call = calls.get(callSid); if (input.method.toUpperCase() === "POST") { const fields = typeof input.data === "string" ? Object.fromEntries(new URLSearchParams(input.data)) : input.data; call.status = fields.Status; call.duration = "12"; } return envelope(call); }
    const recordingSid = target.pathname.match(/\/(RE[0-9a-f]{32})\.json$/i)?.[1];
    if (recordingSid && recordings.has(recordingSid)) { const recording = recordings.get(recordingSid); if (input.method.toUpperCase() === "DELETE") { recordings.delete(recordingSid); deletes++; return envelope(null, 204); } return envelope(recording); }
    return envelope({ code: 20404, message: "Synthetic missing resource" }, 404);
  } catch (error) { process.stderr.write(`Voice fixture: ${error instanceof Error ? error.message : "failure"}\n`); return reply(response, { error: "synthetic_fixture_failure" }, 500); }
}).listen(3161, "127.0.0.1", () => process.stdout.write("Synthetic voice provider ready on loopback 3161.\n"));
