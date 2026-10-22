// Combined, loopback-only Mail/Twilio fixture. No real accounts or messages.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import twilio from "twilio";
const input = new URL(process.env.CONVERSATIONS_TEST_DATABASE_URL || "");
if (!["postgres:", "postgresql:"].includes(input.protocol) || !["127.0.0.1", "localhost"].includes(input.hostname) || input.pathname !== "/ta_conversations_browser_test" || input.search || input.hash)
  throw new Error("Conversation fixtures require the exact disposable local ta_conversations_browser_test database.");
const pool = new pg.Pool({ connectionString: input.toString(), max: 1 });
const workspace = "00000000-0000-4000-8000-000000000001";
const businessId = "00000000-0000-4000-8000-000000000901", contactId = "00000000-0000-4000-8000-000000000902", leadId = "00000000-0000-4000-8000-000000000903";
const numberId = "00000000-0000-4000-8000-000000000801", smsId = "00000000-0000-4000-8000-000000000811";
const account = `AC${"1".repeat(32)}`, numberSid = `PN${"3".repeat(32)}`, phone = "+16785550100", remote = "+16785550101";
const origin = "http://127.0.0.1:3150";
await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())");
for (const filename of (await readdir("db/migrations")).filter(n => n.endsWith(".sql")).sort()) {
  if (!(await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [filename])).rowCount) {
    await pool.query(await readFile(`db/migrations/${filename}`, "utf8"));
    await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [filename]);
  }
}
let threads, smsMessages, emailSends, smsCreates, emailAttempts, tokens, revokedMail, unknownMail, unknownSms;
const stamp = (minutes = 0) => new Date(Date.now() - 3600000 + minutes * 60000).toISOString();
function mailMessage(id, text, options = {}) {
  return { id, direction: "inbound", from_addr: "customer@example.test", from_name: "Jordan Example", to_addr: "sales@example.test", cc_addr: null, subject: "Website project", body_text: text,
    body_html: '<img src="https://tracking.example.test/pixel">', bcc_addr: "private@example.test", content_key: "private-storage-key", status: null, status_detail: null, is_read: false,
    created_at: stamp(), reply_target: ["customer@example.test"], attachments: [], ...options };
}
async function reset() {
  await pool.query('TRUNCATE crm_conversations,crm_conversation_sync,sms_numbers,crm_channel_preferences,crm_businesses,leads,inbox_conversations,request_rate_limits,"rateLimit","user" CASCADE');
  for (const [name, role, label] of [["owner", "owner", "Devon Example"], ["austin", "member", "Austin Example"], ["viewer", "viewer", "Viewer Example"], ["readonly", "member", "Reader Example"], ["smsonly", "member", "SMS Example"], ["emailonly", "member", "Mail Example"], ["unapproved", "member", "Unapproved Example"]]) {
    await pool.query('INSERT INTO "user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)', [`conv-${name}`, label, `${name}@example.test`]);
    await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')", [randomUUID(), workspace, `conv-${name}`, role]);
  }
  await pool.query("INSERT INTO crm_businesses(id,workspace_id,name,normalized_email,normalized_phone) VALUES($1,$2,'Example Landscaping','customer@example.test',$3)", [businessId, workspace, remote]);
  await pool.query("INSERT INTO contacts(id,workspace_id,business_id,name,email,phone,is_primary) VALUES($1,$2,$3,'Jordan Example','customer@example.test',$4,true)", [contactId, workspace, businessId, remote]);
  await pool.query("INSERT INTO contacts(id,workspace_id,business_id,name,email,phone) VALUES('00000000-0000-4000-8000-000000000904',$1,$2,'Taylor Example','taylor@example.test','+16785550102')", [workspace, businessId]);
  await pool.query("INSERT INTO leads(id,workspace_id,business_id,name,organization,email,phone,interest,description) VALUES($1,$2,$3,'Jordan Example','Example Landscaping','customer@example.test',$4,'Website development','Synthetic website and AI receptionist inquiry')", [leadId, workspace, businessId, remote]);
  await pool.query("INSERT INTO crm_opportunities(id,workspace_id,business_id,primary_contact_id,lead_id,owner_user_id,title,stage,value_cents) VALUES('00000000-0000-4000-8000-000000000905',$1,$2,$3,$4,'conv-owner','Landscaping website','mockup',80000)", [workspace, businessId, contactId, leadId]);
  await pool.query("INSERT INTO crm_tasks(id,workspace_id,opportunity_id,owner_user_id,kind,title,due_at) VALUES('00000000-0000-4000-8000-000000000906',$1,'00000000-0000-4000-8000-000000000905','conv-owner','appointment','Website discovery call',now()+interval '2 days')", [workspace]);
  await pool.query("INSERT INTO crm_mockups(id,workspace_id,opportunity_id,status,brief,preview_url) VALUES('00000000-0000-4000-8000-000000000907',$1,'00000000-0000-4000-8000-000000000905','ready','Synthetic landscaping website','https://example.test/mockup')", [workspace]);
  await pool.query("INSERT INTO sms_numbers(id,workspace_id,account_sid,provider_sid,phone,connected_by_user_id) VALUES($1,$2,$3,$4,$5,'conv-owner')", [numberId, workspace, account, numberSid, phone]);
  for (const [name, canSend] of [["owner", true], ["austin", true], ["viewer", false], ["readonly", false], ["smsonly", true]])
    await pool.query("INSERT INTO sms_number_grants(workspace_id,number_id,user_id,can_send,approved_by_user_id) VALUES($1,$2,$3,$4,'conv-owner')", [workspace, numberId, `conv-${name}`, canSend]);
  await pool.query("INSERT INTO sms_conversations(id,workspace_id,number_id,remote_phone,business_id,lead_id) VALUES($1,$2,$3,$4,$5,$6)", [smsId, workspace, numberId, remote, businessId, leadId]);
  await pool.query("INSERT INTO sms_messages(id,workspace_id,conversation_id,direction,body,status,created_at) VALUES('00000000-0000-4000-8000-000000000812',$1,$2,'inbound','Text: Tuesday morning works for our website review.','received',$3)", [workspace, smsId, stamp(10)]);
  await pool.query("INSERT INTO sms_notes(id,workspace_id,conversation_id,author_user_id,body,created_at) VALUES('00000000-0000-4000-8000-000000000813',$1,$2,'conv-owner','SMS-only legacy note',$3)", [workspace, smsId, stamp(11)]);
  await pool.query("INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status,evidence,actor_user_id) VALUES($1,'sms',$2,'allowed','Synthetic fixture permission','conv-owner')", [workspace, remote]);
  await pool.query("INSERT INTO inbox_conversations(id,workspace_id,mailbox_id,thread_id,business_id,lead_id) VALUES('00000000-0000-4000-8000-000000000914',$1,'address-sales','thread-website',$2,$3)", [workspace, businessId, leadId]);
  await pool.query("INSERT INTO inbox_notes(id,workspace_id,conversation_id,author_user_id,body,created_at) VALUES('00000000-0000-4000-8000-000000000915',$1,'00000000-0000-4000-8000-000000000914','conv-owner','Mail-only legacy note',$2)", [workspace, stamp(5)]);
  threads = new Map([
    ["thread-website", { threadId: "thread-website", subject: "Website project", messages: [mailMessage("message-website", "Email: Could you build our website and an AI receptionist?", { attachments: [{ id: "attachment-brief", filename: "project-brief.txt", content_type: "text/plain", size_bytes: 23 }] })] }],
    ["thread-general", { threadId: "thread-general", subject: "General company inquiry", messages: [mailMessage("message-general", "General correspondence without a lead.", { from_addr: "general@example.test", from_name: "General Example", reply_target: ["general@example.test"], created_at: stamp(-5) })] }],
    ["thread-taylor", { threadId: "thread-taylor", subject: "Separate contact", messages: [mailMessage("message-taylor", "Taylor has a separate request.", { from_addr: "taylor@example.test", from_name: "Taylor Example", reply_target: ["taylor@example.test"], created_at: stamp(-10) })] }],
  ]);
  smsMessages = new Map(); emailSends = new Map(); smsCreates = []; emailAttempts = []; tokens = new Map(); revokedMail = new Set(); unknownMail = false; unknownSms = false;
}
await reset();
function reply(response, data, status = 200) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(data)); }
async function callback(path, params) {
  const target = origin + path;
  const response = await fetch(target, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": twilio.getExpectedTwilioSignature("a".repeat(32), target, params) }, body: new URLSearchParams(params) });
  return { status: response.status, body: await response.text() };
}
createServer(async (request, response) => {
  try {
    if (request.url === "/health") return reply(response, { ok: true });
    let raw = "";
    for await (const chunk of request) { raw += chunk; if (raw.length > 200000) return reply(response, {}, 413); }
    const body = JSON.parse(raw || "{}");
    if (["/control", "/transport"].includes(request.url)) {
      if (request.headers.authorization !== "Bearer conversations-synthetic-control") return reply(response, {}, 403);
      if (request.url === "/control") {
        if (body.action === "reset") await reset();
        if (body.action === "revokeMail") revokedMail.add(body.actor || "owner");
        if (body.action === "revokeSms") await pool.query("DELETE FROM sms_number_grants WHERE user_id=$1", [`conv-${body.actor || "owner"}`]);
        if (body.action === "unknownMail") unknownMail = true;
        if (body.action === "unknownSms") unknownSms = true;
        if (body.action === "incomingEmail") {
          const thread = threads.get(body.threadId || "thread-website");
          thread.messages.push(mailMessage(`incoming-${randomUUID()}`, body.text || "A new customer email.", { created_at: new Date().toISOString() }));
        }
        if (body.action === "removeEmail") threads.delete(body.threadId || "thread-website");
        if (body.action === "manyEmails") for (let i = 0; i < 132; i++) {
          const id = `bulk-${String(i).padStart(3,"0")}`;
          threads.set(id, { threadId: id, subject: `Synthetic inquiry ${i}`, messages: [mailMessage(`message-${id}`, `Fixture mail ${i}`, { from_addr: `person${i}@example.test`, from_name: `Person ${i}`, reply_target: [`person${i}@example.test`], created_at: stamp(-i-20) })] });
        }
        if (body.action === "manyHistory") {
          const thread = threads.get("thread-website");
          for (let i=0;i<70;i++) thread.messages.push(mailMessage(`older-${String(i).padStart(3,"0")}`,`Earlier email ${i}`,{created_at:stamp(-100+i)}));
          thread.messages.sort((a,b)=>a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
        }
        if (body.action === "incomingSms") return reply(response, await callback("/api/integrations/twilio/sms/incoming", { AccountSid: account, MessageSid: body.sid || `SM${randomUUID().replaceAll("-", "")}`, From: remote, To: phone, Body: body.text || "Another customer text.", NumMedia: "0" }));
        if (body.action === "smsStatus") {
          const message = smsMessages.get(body.sid || [...smsMessages.keys()].at(-1));
          if (!message) return reply(response, {}, 404);
          message.status = body.status || "delivered";
          const path = new URL(message.callback);
          return reply(response, await callback(path.pathname + path.search, { AccountSid: account, MessageSid: message.sid, From: message.from, To: message.to, MessageStatus: message.status, ErrorCode: "" }));
        }
        const sources = (await pool.query("SELECT id,conversation_id,channel,thread_id,sms_conversation_id FROM crm_conversation_sources WHERE workspace_id=$1", [workspace])).rows;
        return reply(response, { emailSends: emailSends.size, emailAttempts, smsCreates, threads: [...threads.values()], sources, numberId, smsId, businessId, contactId, leadId });
      }
      const target = new URL(body.uri);
      const envelope = (data, statusCode = 200) => reply(response, { statusCode, body: data, headers: {} });
      if (target.pathname.endsWith("/IncomingPhoneNumbers.json")) return envelope({ incoming_phone_numbers: [{ sid: numberSid, account_sid: account, phone_number: phone, capabilities: { sms: true, voice: true } }], next_page_uri: null });
      if (target.pathname.endsWith("/Messages.json") && body.method.toUpperCase() === "POST") {
        const fields = typeof body.data === "string" ? Object.fromEntries(new URLSearchParams(body.data)) : body.data;
        const sid = `SM${(smsMessages.size + 100).toString(16).padStart(32,"0")}`;
        const message = { sid, account_sid: account, from: fields.From, to: fields.To, body: fields.Body, status: "queued", error_code: null, callback: fields.StatusCallback };
        smsMessages.set(sid, message); smsCreates.push({ sid, text: fields.Body, to: fields.To });
        if (unknownSms) { unknownSms = false; return envelope({ code: 20500, message: "Synthetic unknown response" }, 500); }
        return envelope(message, 201);
      }
      const sid = target.pathname.match(/\/(SM[0-9a-f]{32})\.json$/i)?.[1];
      return sid && smsMessages.has(sid) ? envelope(smsMessages.get(sid)) : envelope({ code: 20404, message: "Synthetic missing resource" }, 404);
    }
    if (request.url === "/api/dashboard-auth") {
      if (request.headers.authorization !== "Bearer conversations-browser-local-identity-secret-1234567890") return reply(response, {}, 403);
      if (body.action === "revoke") { tokens.delete(body.token); return reply(response, { ok: true }); }
      let name = body.action === "inspect" ? tokens.get(body.token) : null;
      if (body.action === "login" && body.password === "Conversations-test-password-2026") name = ["owner", "austin", "viewer", "readonly", "smsonly", "emailonly", "unapproved"].find(n => body.email === `${n}@example.test`);
      if (!name) return reply(response, {}, 401);
      const identity = { user: { id: `mail-${name}`, email: `${name}@example.test`, name: `${name} Example`, isAdmin: name === "owner" }, expiresAt: new Date(Date.now()+86400000).toISOString() };
      if (body.action === "login") { identity.token = randomUUID().replaceAll("-", "") + "fixturegrant"; tokens.set(identity.token, name); }
      return reply(response, identity);
    }
    if (request.url !== "/api/crm-mail" || request.headers.authorization !== "Bearer conversations-browser-local-crm-service-secret-1234567890") return reply(response, {}, 403);
    const actor = tokens.get(body.token);
    if (!actor) return reply(response, {}, 403);
    const allowed = !["smsonly", "unapproved"].includes(actor) && !revokedMail.has(actor);
    const mailbox = { id: "address-sales", name: "Shared sales", email: "sales@example.test", canSend: !["viewer", "readonly"].includes(actor), addresses: [{ id: "address-sales", address: "sales@example.test" }] };
    if (body.action === "mailboxes") return reply(response, { mailboxes: allowed ? [mailbox] : [] });
    if (!allowed || body.mailboxId !== mailbox.id) return reply(response, {}, 403);
    if (body.action === "conversationIndex") {
      const items = [...threads.values()].sort((a,b) => a.threadId.localeCompare(b.threadId)).filter(t => !body.cursor || t.threadId > body.cursor).slice(0, Math.min(body.limit || 50, 100));
      const rows = items.map(t => ({ threadId: t.threadId, latestMessageId: t.messages.at(-1).id, lastMessageAt: t.messages.at(-1).created_at,
        lastInboundAt: [...t.messages].reverse().find(m=>m.direction === "inbound")?.created_at || null,
        lastOutboundAt: [...t.messages].reverse().find(m=>m.direction === "outbound")?.created_at || null,
        externalAddresses: [...new Set(t.messages.flatMap(m=>[m.from_addr,m.to_addr]).filter(a=>a !== mailbox.email))], hasAttachments: t.messages.some(m=>m.attachments.length) }));
      const last = items.at(-1)?.threadId;
      const complete = !last || ![...threads.keys()].some(id => id > last);
      return reply(response, { items: rows, cursor: complete ? null : last, complete });
    }
    if (body.action === "threadHistory") {
      const thread = threads.get(body.threadId);
      if (!thread) return reply(response, {}, 404);
      const ordered = thread.messages.slice().sort((a,b)=>a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      const beforeIndex = body.before ? ordered.findIndex(m=>m.id === body.before) : ordered.length;
      const eligible = ordered.slice(0, Math.max(0,beforeIndex));
      const messages = eligible.slice(-Math.min(body.limit || 50,100));
      const hasOlder = eligible.length > messages.length;
      return reply(response, { threadId: thread.threadId, subject: thread.subject, messages, hasOlder, before: hasOlder ? messages[0]?.id : null });
    }
    if (body.action === "threads") {
      const rows = [...threads.values()].map(t => { const m=t.messages.at(-1); return { thread_id:t.threadId,latest_id:m.id,subject:t.subject,preview:m.body_text,participants:[{address:t.messages[0].from_addr}],message_count:t.messages.length,is_read:false,has_attachments:t.messages.some(m=>m.attachments.length),status:m.status,created_at:m.created_at }; });
      return reply(response, { threads:rows,total:rows.length,page:1,pageCount:1 });
    }
    if (body.action === "thread") return threads.has(body.threadId) ? reply(response, threads.get(body.threadId)) : reply(response, {}, 404);
    if (body.action === "attachment") {
      if (body.messageId !== "message-website" || body.attachmentId !== "attachment-brief") return reply(response, {}, 404);
      response.writeHead(200, { "content-type":"text/plain","content-disposition":'attachment; filename="project-brief.txt"' }); return response.end("Synthetic project brief");
    }
    if (body.action === "send") {
      if (!mailbox.canSend) return reply(response, {}, 403);
      emailAttempts.push({ key:body.idempotencyKey,text:body.text,threadId:body.threadId,to:body.to,subject:body.subject });
      const key=`${actor}:${body.idempotencyKey}`;
      if (emailSends.has(key)) return reply(response,emailSends.get(key));
      const threadId=body.threadId || `thread-new-${emailSends.size+1}`;
      const thread=threads.get(threadId) || {threadId,subject:body.subject,messages:[]};
      const id=`outbound-${emailSends.size+1}`;
      thread.messages.push(mailMessage(id,body.text,{direction:"outbound",from_addr:mailbox.email,from_name:"Sales",to_addr:body.to || thread.messages[0]?.from_addr || "customer@example.test",subject:thread.subject,status:"sent",created_at:new Date().toISOString()}));
      threads.set(threadId,thread);
      const receipt={messageId:id,threadId,status:"accepted"}; emailSends.set(key,receipt);
      if (unknownMail) {unknownMail=false;return reply(response,{},503);}
      return reply(response,receipt);
    }
    return reply(response,{},400);
  } catch (error) { process.stderr.write(`Synthetic conversation fixture: ${error instanceof Error ? error.message : "failure"}\n`);return reply(response,{},500); }
}).listen(3151,"127.0.0.1",()=>process.stdout.write("Synthetic conversation providers ready on loopback 3151.\n"));
