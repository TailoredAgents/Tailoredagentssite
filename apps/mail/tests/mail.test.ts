import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDb,insertTestUser} from '../src/lib/server/test-db';
import {testStorage} from './storage';
import {receiveEmail} from '../src/lib/server/receive';
import {getEmailForUser,getDraft,listMailbox,deleteEmailsPermanently} from '../src/lib/server/mail-store';
import {getAttachmentForUser} from '../src/lib/server/attachments';
import {storeDraft,readDraftContent} from '../src/lib/server/drafts';
import {sendAndStore,assertOutboundAttachments} from '../src/lib/server/outbox';
import {mayRetrySend,recoverOutgoing} from '../src/lib/server/outgoing-recovery';
import {ProviderError,type EmailProvider} from '../src/lib/server/email-provider';
import {hashPassword,verifyPassword} from '../src/lib/server/password';
import {setUserPassword,login,getAuthenticatedSession} from '../src/lib/server/auth';
import {queueEvent,processJob,maintainMail} from '../src/lib/server/mail-jobs';
import {purgeExpiredMail} from '../src/lib/server/retention';
import type {User} from '../src/lib/types';
function fixture(){
 const {db,sqlite}=createTestDb(),{bucket,objects}=testStorage();
 for(const id of ['alice','bob'])insertTestUser(sqlite,id);
 sqlite.query("INSERT INTO domains(id,name,status,sending_enabled,receiving_enabled) VALUES ('domain','tailoredagents.com','verified',1,1)").run();
 for(const id of ['alice','bob'])sqlite.query("INSERT INTO addresses(id,user_id,domain_id,address,is_default) VALUES (?,?,'domain',?,1)").run(id+'-address',id,id+'@tailoredagents.com');
 const user:User={id:'alice',email:'alice@tailoredagents.com',name:'Alice',is_admin:true,must_change_password:false,created_at:new Date().toISOString()};
 const queued:string[]=[];
 return {db,sqlite,bucket,objects,user,queued,env:{DB:db,ATTACHMENTS:bucket,RESEND_API_KEY:'test-only',MAIL_DOMAIN:'tailoredagents.com',MAIL_JOBS:{send:async({id}:{id:string})=>{queued.push(id);}} as any}};
}
function receiveMock(t:any,overrides:Record<string,unknown>={},failFile=false){
 let fileFails=failFile;
 const mail={id:'provider-1',from:'Sender <sender@example.net>',to:['alice@tailoredagents.com','bob@tailoredagents.com'],cc:[],bcc:['alice@tailoredagents.com'],reply_to:['reply@example.net'],subject:'Shared document',text:'hello '+ 'x'.repeat(300000)+' long-message-tail',html:null,message_id:'remote@example.net',created_at:new Date().toISOString(),attachments:[{id:'file1',filename:'report.txt'}],...overrides};
 const files=[{id:'file1',filename:'report.txt',content_type:'text/plain',download_url:'https://files.resend.test/file'}];
 t.mock.method(globalThis,'fetch',async(url:any)=>{const u=String(url);if(u.includes('/attachments'))return Response.json({data:files});if(u.includes('/emails/receiving/'))return Response.json(mail);if(u.includes('files.resend')){if(fileFails){fileFails=false;return new Response('temporary',{status:503});}return new Response('saved file');}throw new Error('Unexpected request '+u);});
 return mail;
}
test('every recipient gets one private copy; long body, files and full-body search survive retries',async t=>{
 const f=fixture();const source=receiveMock(t);
 await receiveEmail(f.env,'provider-1');await receiveEmail(f.env,'provider-1');
 const rows=await f.db.prepare('SELECT id,user_id,bcc_addr,reply_to_addr FROM emails').all<any>();assert.equal(rows.results.length,2);
 for(const row of rows.results){assert.equal(row.bcc_addr,null);assert.equal(row.reply_to_addr,'reply@example.net');assert.equal((await getEmailForUser(f.db,row.user_id,row.id,f.bucket))!.body_text,source.text);assert.equal(await getEmailForUser(f.db,row.user_id==='alice'?'bob':'alice',row.id,f.bucket),null);}
 const alice=rows.results.find(r=>r.user_id==='alice');const file=await f.db.prepare('SELECT id FROM email_attachments WHERE email_id=?').bind(alice.id).first<any>();assert.equal(await getAttachmentForUser(f.db,'bob',alice.id,file.id),null);
 const results=await listMailbox(f.db,'alice',{view:'inbox',q:'long-message-tail has:attachment from:sender@example.net'});assert.equal(results.total,1);
 await f.db.prepare('UPDATE emails SET is_read=1,archived_at=datetime(\'now\') WHERE user_id=?').bind('alice').run();assert.equal((await f.db.prepare('SELECT is_read FROM emails WHERE user_id=?').bind('bob').first<any>()).is_read,0);
});
test('attachment failure is visible and resumes without duplicates',async t=>{
 const f=fixture();receiveMock(t,{},true);await assert.rejects(receiveEmail(f.env,'provider-1'));
 assert.equal((await f.db.prepare('SELECT import_state FROM emails LIMIT 1').first<any>()).import_state,'pending');
 await receiveEmail(f.env,'provider-1');assert.equal((await f.db.prepare('SELECT count(*) AS n FROM emails').first<any>()).n,2);assert.equal((await f.db.prepare("SELECT count(*) AS n FROM email_attachments WHERE download_state='ready'").first<any>()).n,2);
});
test('unknown recipient files remain assignable after provider retention ends',async t=>{
 const f=fixture();receiveMock(t,{to:['unknown@tailoredagents.com'],bcc:[]});await receiveEmail(f.env,'provider-1');
 assert.ok(f.objects.has('received/provider-1/files/file1'));assert.equal((await f.db.prepare('SELECT count(*) AS n FROM emails').first<any>()).n,0);
 t.mock.method(globalThis,'fetch',async()=>{throw new Error('Provider retention ended');});
 await receiveEmail(f.env,'provider-1','bob');assert.equal((await f.db.prepare('SELECT user_id FROM emails').first<any>()).user_id,'bob');
});
test('draft text and attachments are saved together and cannot be overwritten by another account',async()=>{
 const f=fixture(),files=[{filename:'notes.txt',type:'text/plain',content:btoa('my saved file')}];
 const id=await storeDraft(f.db,f.bucket,f.user,{id:'saved-draft',to:'someone@example.net',subject:'Draft',text:'Keep this',attachments:files});
 const row=await getDraft(f.db,'alice',id);assert.ok(row?.content_key);const saved=await readDraftContent(f.bucket,row.content_key);assert.equal(saved.text,'Keep this');assert.deepEqual(saved.attachments,files);
 const found=await listMailbox(f.db,'alice',{view:'drafts',q:'has:attachment'});assert.equal(found.total,1);assert.equal(found.threads[0].has_attachments,true);
 await storeDraft(f.db,f.bucket,f.user,{id,text:'Updated text'});const updated=await getDraft(f.db,'alice',id);assert.deepEqual((await readDraftContent(f.bucket,updated!.content_key!)).attachments,files);assert.equal(await getDraft(f.db,'bob',id),null);
 await assert.rejects(storeDraft(f.db,f.bucket,{...f.user,id:'bob'},{id,text:'steal'}),/unavailable/);
});
test('outgoing body and files exist before provider call; retries send only once',async()=>{
 const f=fixture();let calls=0;
 const provider={kind:'resend',send:async()=>{calls++;assert.ok([...f.objects.keys()].some(k=>k.startsWith('messages/')));assert.equal((await f.db.prepare('SELECT count(*) AS n FROM email_attachments').first<any>()).n,1);return {providerId:'sent-provider'};}} as unknown as EmailProvider;
 const input={to:'friend@example.net',subject:'Hello',text:'Hello friend',attachments:[{filename:'hello.txt',type:'text/plain',content:btoa('hello')}],idempotencyKey:'one-send-key'};
 const sent=await sendAndStore({DB:f.db,ATTACHMENTS:f.bucket},provider,f.user,input);assert.equal((await sendAndStore({DB:f.db,ATTACHMENTS:f.bucket},provider,f.user,input)).emailId,sent.emailId);assert.equal(calls,1);
});
test('uncertain sends stay claimed and expired safety windows prohibit another send',async()=>{
 const f=fixture();let calls=0;const provider={kind:'resend',send:async()=>{calls++;throw new ProviderError(503,'unavailable','unknown');}} as unknown as EmailProvider;
 const input={to:'friend@example.net',subject:'Hello',text:'message',idempotencyKey:'uncertain-key'};
 await assert.rejects(sendAndStore({DB:f.db,ATTACHMENTS:f.bucket},provider,f.user,input));await assert.rejects(sendAndStore({DB:f.db,ATTACHMENTS:f.bucket},provider,f.user,input));assert.equal(calls,1);
 assert.equal(mayRetrySend(new Date(Date.now()-24*3600000).toISOString()),false);assert.equal(mayRetrySend(new Date().toISOString()),true);
});
test('20 MB is a total outgoing attachment limit',()=>{assert.throws(()=>assertOutboundAttachments([{filename:'a',type:'text/plain',content:'A'.repeat(15*1024*1024)},{filename:'b',type:'text/plain',content:'A'.repeat(15*1024*1024)}]),/total|combined|20/i);});
test('scrypt passwords, reset revocation and disabled accounts',async()=>{
 const f=fixture(),password='A long temporary password';const hash=await hashPassword(password);assert.match(hash,/^scrypt:32768:8:3:/);assert.ok(await verifyPassword(password,hash));assert.equal(await verifyPassword('wrong',hash),false);
 await f.db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(hash,'alice').run();const session=await login(f.db,f.user.email.replace('@tailoredagents.com','@example.com'),password);assert.ok(session);await setUserPassword(f.db,'alice','A different temporary password');assert.equal(await getAuthenticatedSession(f.db,session.token),null);
 await f.db.prepare("UPDATE users SET disabled_at=datetime('now') WHERE id='alice'").run();assert.equal(await login(f.db,'alice@example.com','A different temporary password'),null);
});
test('duplicate incoming notifications create one durable job and private copies',async t=>{
 const f=fixture();receiveMock(t);await queueEvent(f.env,'event1',{type:'email.received',data:{email_id:'provider-1'}});await queueEvent(f.env,'event2',{type:'email.received',data:{email_id:'provider-1'}});
 assert.equal((await f.db.prepare('SELECT count(*) AS n FROM mail_jobs').first<any>()).n,1);await processJob(f.env,f.queued[0]);await processJob(f.env,f.queued[1]);assert.equal((await f.db.prepare('SELECT count(*) AS n FROM emails').first<any>()).n,2);
});
test('deleted files remain available to a restored database for 32 days',async t=>{
 const f=fixture();receiveMock(t,{to:['alice@tailoredagents.com'],bcc:[]});await receiveEmail(f.env,'provider-1');const row=await f.db.prepare('SELECT * FROM emails').first<any>();const snapshot=await f.bucket.get(row.content_key);const original=await snapshot!.text();
 const files=(await f.db.prepare('SELECT * FROM email_attachments WHERE email_id=?').bind(row.id).all<any>()).results;
 await deleteEmailsPermanently(f.db,f.bucket,'alice',[row.id]);await purgeExpiredMail(f.env);assert.equal(await (await f.bucket.get(row.content_key))!.text(),original);
 // Restore the saved D1 row as Time Travel would; the same content reference still works.
 const columns=Object.keys(row);await f.db.prepare(`INSERT INTO emails(${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...Object.values(row)).run();assert.equal((await getEmailForUser(f.db,'alice',row.id,f.bucket))!.body_text,JSON.parse(original).text);
 for(const file of files){const keys=Object.keys(file);await f.db.prepare(`INSERT INTO email_attachments(${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).bind(...Object.values(file)).run();assert.ok(await getAttachmentForUser(f.db,'alice',row.id,file.id));assert.equal(await (await f.bucket.get(file.storage_key))!.text(),'saved file');}
 await f.db.prepare("UPDATE retained_objects SET purge_after=datetime('now','-1 day')").run();await purgeExpiredMail(f.env);assert.ok(await f.bucket.get(row.content_key));assert.ok(await f.bucket.get(files[0].storage_key));
});
test('a repeated import cannot resurrect a deliberately deleted recipient copy',async t=>{
 const f=fixture();receiveMock(t);await receiveEmail(f.env,'provider-1');const alice=await f.db.prepare("SELECT id FROM emails WHERE user_id='alice'").first<any>();
 await deleteEmailsPermanently(f.db,f.bucket,'alice',[alice.id]);await receiveEmail(f.env,'provider-1');
 assert.equal((await f.db.prepare("SELECT count(*) AS n FROM emails WHERE user_id='alice'").first<any>()).n,0);assert.equal((await f.db.prepare("SELECT count(*) AS n FROM emails WHERE user_id='bob'").first<any>()).n,1);
});
test('saved notifications survive a queue outage and scheduled reconciliation recovers missed mail',async t=>{
 const f=fixture();receiveMock(t);const event={type:'email.received',data:{email_id:'provider-1'}};
 await assert.rejects(queueEvent({...f.env,MAIL_JOBS:{send:async()=>{throw new Error('Queue offline');}} as any},'event',event));
 assert.equal((await f.db.prepare('SELECT state FROM mail_jobs').first<any>()).state,'pending');
 const priorFetch=globalThis.fetch;t.mock.method(globalThis,'fetch',async(url:any,options:any)=>String(url).includes('receiving?')?Response.json({data:[{id:'provider-2',to:['bob@tailoredagents.com'],created_at:new Date().toISOString()}],has_more:false}):priorFetch(url,options));
 await maintainMail(f.env);assert.ok(f.queued.includes('receive:provider-1'));assert.ok(f.queued.includes('receive:provider-2'));
 await processJob(f.env,'receive:provider-1');assert.equal((await f.db.prepare('SELECT count(*) AS n FROM emails').first<any>()).n,2);
});
test('webhooks from other Resend domains never enter this app’s storage or queues',async()=>{
 const f=fixture();await queueEvent(f.env,'unrelated',{type:'email.received',data:{email_id:'unrelated',to:['person@another-domain.example'],cc:[],bcc:[]}});
 await queueEvent(f.env,'unrelated-sent',{type:'email.sent',data:{email_id:'unrelated-sent',from:'Someone <person@another-domain.example>'}});
 assert.equal(f.queued.length,0);assert.equal((await f.db.prepare('SELECT count(*) AS n FROM mail_jobs').first<any>()).n,0);
 await queueEvent(f.env,'display-only',{type:'email.received',data:{email_id:'display-only',to:['person@another-domain.example'],cc:['alice@tailoredagents.com'],bcc:[]}});assert.equal(f.queued.length,0);
 await queueEvent(f.env,'bcc-mine',{type:'email.received',data:{email_id:'bcc-mine',to:['alice@tailoredagents.com'],cc:[],bcc:[]}});assert.equal(f.queued.length,1);
});
test('delivery updates use provider ordering, including events received before the send response',async()=>{
 const f=fixture();const provider={kind:'resend',send:async()=>({providerId:'sent-provider'})} as unknown as EmailProvider;
 await sendAndStore({DB:f.db,ATTACHMENTS:f.bucket},provider,f.user,{to:'friend@example.net',subject:'Status',text:'Status',idempotencyKey:'status-key'});
 const sendEvent=async(type:string,date:string)=>{const id=type+date;await queueEvent(f.env,id,{type,created_at:date,data:{email_id:'sent-provider'}});await processJob(f.env,'event:'+id);};
 await sendEvent('email.delivered','2026-01-01T00:00:02.500Z');assert.equal((await f.db.prepare('SELECT status FROM emails').first<any>()).status,'delivered');
 await sendEvent('email.sent','2026-01-01T00:00:02.100Z');await sendEvent('email.delivery_delayed','2026-01-01T00:00:03Z');assert.equal((await f.db.prepare('SELECT status FROM emails').first<any>()).status,'delivered');
 await sendEvent('email.bounced','2026-01-01T00:00:04Z');await sendEvent('email.delivered','2026-01-01T00:00:05Z');assert.equal((await f.db.prepare('SELECT status FROM emails').first<any>()).status,'bounced');
});
test('restored uncertain sends stop after the safety window and retain their files',async t=>{
 const f=fixture();const provider={kind:'resend',send:async()=>{throw new ProviderError(503,'unavailable','unknown');}} as unknown as EmailProvider;
 await assert.rejects(sendAndStore({DB:f.db,ATTACHMENTS:f.bucket},provider,f.user,{to:'friend@example.net',subject:'Restored',text:'Saved',idempotencyKey:'restored-key'}));
 const row=await f.db.prepare('SELECT email_id FROM send_attempts').first<any>();
 await assert.rejects(deleteEmailsPermanently(f.db,f.bucket,'alice',[row.email_id]),/confirmation/);
 await f.db.prepare("UPDATE send_attempts SET created_at=datetime('now','-25 hours'),updated_at=datetime('now','-10 minutes'),first_provider_call_at=NULL").run();
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('Must not contact provider');});await recoverOutgoing(f.env);assert.equal(calls,0);
 assert.match((await f.db.prepare('SELECT status_detail FROM emails').first<any>()).status_detail,/could not be confirmed/);
});

test('separate envelope deliveries deduplicate aliases and never disclose a hidden recipient',async t=>{
 const f=fixture();
 await f.db.prepare("INSERT INTO addresses(id,user_id,domain_id,address) VALUES ('alias','bob','domain','private@tailoredagents.com')").run();
 const common={from:'sender@example.net',cc:['alice@tailoredagents.com'],bcc:[],subject:'Envelope test',text:'Exact same content',html:null,message_id:'envelope@example.net',created_at:new Date().toISOString(),headers:{to:'alice@tailoredagents.com',cc:'alice@tailoredagents.com'},attachments:[]};
 const copies:Record<string,any>={a:{...common,id:'a',to:['alice@tailoredagents.com']},b:{...common,id:'b',to:['bob@tailoredagents.com']},alias:{...common,id:'alias',to:['private@tailoredagents.com']},later:{...common,id:'later',to:['bob@tailoredagents.com']}};
 t.mock.method(globalThis,'fetch',async(url:any)=>{const u=new URL(String(url));if(u.pathname.endsWith('/attachments'))return Response.json({data:[]});return Response.json(copies[u.pathname.split('/').at(-1)!]);});
 await receiveEmail(f.env,'b');assert.equal((await f.db.prepare("SELECT count(*) AS n FROM emails WHERE user_id='alice'").first<any>()).n,0);
 await receiveEmail(f.env,'a');await receiveEmail(f.env,'alias');
 const rows=(await f.db.prepare('SELECT id,user_id,to_addr,cc_addr,bcc_addr FROM emails').all<any>()).results;assert.equal(rows.length,2);
 for(const row of rows){assert.equal(row.to_addr,'alice@tailoredagents.com');assert.equal(row.bcc_addr,null);assert.ok(!JSON.stringify(row).includes('private@'));}
 const bob=rows.find(r=>r.user_id==='bob');await deleteEmailsPermanently(f.db,f.bucket,'bob',[bob.id]);await receiveEmail(f.env,'later');assert.equal((await f.db.prepare("SELECT count(*) AS n FROM emails WHERE user_id='bob'").first<any>()).n,0);
});
test('a reused Message-ID with different content preserves both incoming messages',async t=>{
 const f=fixture();const source=receiveMock(t,{to:['alice@tailoredagents.com'],attachments:[]});await receiveEmail(f.env,'first');source.text='Different message content';await receiveEmail(f.env,'second');assert.equal((await f.db.prepare('SELECT count(*) AS n FROM emails').first<any>()).n,2);
});
test('provider-assigned Message-ID is saved for reply matching and refreshed by signed events',async()=>{
 const f=fixture();const provider={kind:'resend',send:async()=>({providerId:'wire-provider',messageId:'actual@resend.example'})} as unknown as EmailProvider;
 await sendAndStore({DB:f.db,ATTACHMENTS:f.bucket},provider,f.user,{to:'friend@example.net',subject:'Wire ID',text:'message',idempotencyKey:'wire-id'});
 assert.equal((await f.db.prepare('SELECT message_id FROM emails').first<any>()).message_id,'actual@resend.example');
 await queueEvent(f.env,'wire-event',{type:'email.delivered',data:{email_id:'wire-provider',message_id:'<actual-event@resend.example>'}});await processJob(f.env,'event:wire-event');assert.equal((await f.db.prepare('SELECT message_id FROM emails').first<any>()).message_id,'actual-event@resend.example');
});
test('one failed incoming attachment does not prevent the remaining files from being saved',async t=>{
 const f=fixture();let failed=true;
 const mail={id:'two-files',from:'sender@example.net',to:['alice@tailoredagents.com'],cc:[],subject:'Independent files',text:'two files',html:null,created_at:new Date().toISOString(),attachments:[]};
 const files=[{id:'bad',filename:'retry.txt',content_type:'text/plain',download_url:'https://files.resend.test/bad'},{id:'good',filename:'available.txt',content_type:'text/plain',download_url:'https://files.resend.test/good'}];
 t.mock.method(globalThis,'fetch',async(url:any)=>{const u=String(url);if(u.includes('/attachments'))return Response.json({data:files});if(u.includes('/emails/receiving/'))return Response.json(mail);if(u.endsWith('/bad')&&failed)return new Response('',{status:503});return new Response('file bytes');});
 await assert.rejects(receiveEmail(f.env,'two-files'));
 const states=(await f.db.prepare('SELECT filename,download_state FROM email_attachments ORDER BY filename').all<any>()).results;
 assert.deepEqual(states,[{filename:'available.txt',download_state:'ready'},{filename:'retry.txt',download_state:'pending'}]);
 failed=false;await receiveEmail(f.env,'two-files');assert.equal((await f.db.prepare("SELECT count(*) AS n FROM email_attachments WHERE download_state='ready'").first<any>()).n,2);
});
