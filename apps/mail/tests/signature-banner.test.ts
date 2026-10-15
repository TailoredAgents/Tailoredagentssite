import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createTestDb, insertTestUser } from '../src/lib/server/test-db';
import { testStorage } from './storage';
import { saveEmailSignature, getEmailSignature, getSignatureBanner, signatureBannerAttachment } from '../src/lib/server/email-signature';
import { appendEmailSignature, MAX_SIGNATURE_BANNER_BYTES } from '../src/lib/email-signature';
import { sendAndStore } from '../src/lib/server/outbox';
import { readOutboundAttachments } from '../src/lib/server/attachments';
import { getEmailForUser } from '../src/lib/server/mail-store';
import { purgeExpiredMail } from '../src/lib/server/retention';
import { recoverOutgoing } from '../src/lib/server/outgoing-recovery';
import { ProviderError, type EmailProvider } from '../src/lib/server/email-provider';
import type { OutboundMailInput } from '../src/lib/server/send-mail';
import type { User } from '../src/lib/types';

const png = readFileSync(new URL('./fixtures/signature-banner.png',import.meta.url));
const jpg = readFileSync(new URL('./fixtures/signature-banner.jpg',import.meta.url));
function mockProvider(send: EmailProvider['send']): EmailProvider {
 return {kind:'resend',send,listDomains:async()=>[],getDomain:async()=>{throw new Error('Not used');}};
}
const upload = (bytes=png) => ({ filename:'signature.png', content:bytes.toString('base64') });
function fixture() {
 const {db,sqlite}=createTestDb(),{bucket,objects}=testStorage();
 for(const id of ['alice','bob'])insertTestUser(sqlite,id);
 sqlite.exec("INSERT INTO domains(id,name,status,sending_enabled,receiving_enabled) VALUES ('domain','tailoredagents.com','verified',1,1)");
 sqlite.exec("INSERT INTO addresses(id,user_id,domain_id,address,is_default) VALUES ('address','alice','domain','alice@tailoredagents.com',1)");
 const user:User={id:'alice',email:'alice@example.com',name:'Alice',is_admin:false,must_change_password:false,created_at:new Date().toISOString()};
 return {db,sqlite,bucket,objects,user,env:{DB:db,ATTACHMENTS:bucket,RESEND_API_KEY:'test-only',MAIL_DOMAIN:'tailoredagents.com'}};
}

test('PNG and JPG banners persist per user; text-only updates keep the image',async()=>{
 const f=fixture();
 const saved=await saveEmailSignature(f.db,f.bucket,'alice',{signature:'Alice\nTailored Agents',banner:upload(),bannerAlt:'Alice at Tailored Agents',bannerLink:'tailoredagents.com'});
 assert.equal(saved.banner?.link,'https://tailoredagents.com/');assert.equal(saved.banner?.width,1200);
 assert.equal(saved.banner?.content_type,'image/png');assert.equal('storage_key' in saved.banner!,false);
 assert.equal(await getSignatureBanner(f.db,'bob'),null);assert.equal(await getEmailSignature(f.db,'bob'),'');
 const updated=await saveEmailSignature(f.db,f.bucket,'alice',{signature:'New text'});assert.equal(updated.banner?.id,saved.banner?.id);
 const jpeg=await saveEmailSignature(f.db,f.bucket,'bob',{signature:'Bob',banner:upload(jpg)});assert.equal(jpeg.banner?.content_type,'image/jpeg');assert.match(jpeg.banner!.filename,/\.jpg$/);
 const stored=(await getSignatureBanner(f.db,'alice'))!;
 assert.deepEqual(Buffer.from(f.objects.get(stored.storage_key)!),png);
});

test('invalid files, excessive sizes, bad links and oversize text leave the saved signature unchanged',async()=>{
 const f=fixture();await saveEmailSignature(f.db,f.bucket,'alice',{signature:'Keep me',banner:upload()});
 const id=(await getSignatureBanner(f.db,'alice'))!.id;
 const cases=[
  {banner:{filename:'fake.png',content:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')}},
  {banner:{filename:'bad.png',content:'not base64!'}},
  {banner:upload(Buffer.alloc(MAX_SIGNATURE_BANNER_BYTES+1))},
  {banner:upload(Buffer.from([137,80,78,71]))},
  {bannerLink:'javascript:alert(1)'},{bannerLink:'data:text/html,hello'},{bannerLink:'https://user:password@example.com'},
  {signature:'x'.repeat(1001)},{bannerAlt:'x'.repeat(161)}
 ];
 for(const input of cases)await assert.rejects(saveEmailSignature(f.db,f.bucket,'alice',{signature:'Should not save',...input}));
 assert.equal(await getEmailSignature(f.db,'alice'),'Keep me');assert.equal((await getSignatureBanner(f.db,'alice'))!.id,id);
});

test('HTML escapes signature fields, fits the banner and provides plain-text fallback',()=>{
 const result=appendEmailSignature({text:'Hello <friend>',html:null,signature:'Alice & Co',banner:{width:1200,height:300,alt:'A "logo" <test>',link:'https://example.com/?a=1&b=2',contentId:'banner-id'}});
 assert.match(result.html!,/Hello &lt;friend&gt;/);assert.match(result.html!,/cid:banner-id/);assert.match(result.html!,/width="600" height="150"/);
 assert.match(result.html!,/A &quot;logo&quot; &lt;test&gt;/);assert.match(result.html!,/a=1&amp;b=2/);
 assert.match(result.text,/Alice & Co/);assert.match(result.text,/https:\/\/example.com/);
});

test('outgoing banner is snapshotted before sending, retries send once, and old mail survives replacement',async()=>{
 const f=fixture();await saveEmailSignature(f.db,f.bucket,'alice',{signature:'Alice',banner:upload(),bannerAlt:'Our banner'});
 let calls=0;let payload:OutboundMailInput|undefined;
 const provider=mockProvider(async(input:OutboundMailInput)=>{calls++;payload=input;
  const file=await f.db.prepare('SELECT storage_key FROM email_attachments LIMIT 1').first<{storage_key:string}>();assert.ok(file);assert.deepEqual(Buffer.from(f.objects.get(file.storage_key)!),png);
  return {providerId:'sent-banner'};
 });
 const input={to:'friend@example.net',subject:'Banner',text:'Hello',idempotencyKey:'banner-once'};
 const sent=await sendAndStore(f.env,provider,f.user,input);const repeated=await sendAndStore(f.env,provider,f.user,input);
 assert.equal(sent.emailId,repeated.emailId);assert.equal(calls,1);
 const file=payload!.attachments![0];assert.equal(file.disposition,'inline');assert.ok(payload!.html!.includes('cid:'+file.contentId));
 assert.deepEqual(Buffer.from(file.content,'base64'),png);
 await saveEmailSignature(f.db,f.bucket,'alice',{signature:'Changed',banner:upload(jpg)});
 const old=await getEmailForUser(f.db,'alice',sent.emailId,f.bucket);assert.ok(old?.body_html?.includes('cid:'+file.contentId));
 assert.equal(await getEmailForUser(f.db,'bob',sent.emailId,f.bucket),null);
 const files=await readOutboundAttachments(f.db,f.bucket,'alice',sent.emailId);assert.deepEqual(Buffer.from(files[0].content,'base64'),png);
 assert.deepEqual(await readOutboundAttachments(f.db,f.bucket,'bob',sent.emailId),[]);
 // A forwarded copy retains its original image and uses a distinct ID for the new signature.
 let forwarded:OutboundMailInput|undefined;
 await sendAndStore(f.env,mockProvider(async(value:OutboundMailInput)=>{forwarded=value;return {providerId:'forwarded-banner'};}),f.user,{...input,html:old!.body_html,attachments:files,idempotencyKey:'banner-forward'});
 assert.equal(forwarded!.attachments!.length,2);assert.notEqual(forwarded!.attachments![0].contentId,forwarded!.attachments![1].contentId);
});

test('missing banners stop sending and banner bytes count toward the total size limit',async()=>{
 const f=fixture();await saveEmailSignature(f.db,f.bucket,'alice',{signature:'Alice',banner:upload()});
 let calls=0;const provider=mockProvider(async()=>{calls++;return {providerId:'never'};});
 const input={to:'friend@example.net',subject:'Banner',text:'Hello',idempotencyKey:'banner-missing'};
 await assert.rejects(sendAndStore(f.env,provider,f.user,{...input,attachments:[{filename:'large.bin',type:'application/octet-stream',content:Buffer.alloc(20*1024*1024).toString('base64')}]}),/20 MB/);
 const banner=(await getSignatureBanner(f.db,'alice'))!;f.objects.delete(banner.storage_key);
 await assert.rejects(sendAndStore(f.env,provider,f.user,input),/banner is unavailable/);assert.equal(calls,0);
});

test('recovery uses the original banner after the user replaces it',async t=>{
 const f=fixture();await saveEmailSignature(f.db,f.bucket,'alice',{signature:'Alice',banner:upload()});
 let first:OutboundMailInput|undefined;
 const provider=mockProvider(async(input:OutboundMailInput)=>{first=input;throw new ProviderError(503,'unavailable','unknown');});
 await assert.rejects(sendAndStore(f.env,provider,f.user,{to:'friend@example.net',subject:'Banner retry',text:'Hello',idempotencyKey:'banner-retry'}));
 await saveEmailSignature(f.db,f.bucket,'alice',{signature:'New signature',banner:upload(jpg)});
 f.sqlite.exec("UPDATE send_attempts SET updated_at=datetime('now','-6 minutes')");
 let recovered:{html:string;attachments:{content:string}[]}|undefined;
 t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,options?:RequestInit)=>{
  if(options?.method==='POST'){recovered=JSON.parse(String(options.body));assert.equal(new Headers(options.headers).get('Idempotency-Key'),first!.idempotencyKey);return Response.json({id:'recovered-banner'});}
  return Response.json({id:'recovered-banner',message_id:'wire@example.net'});
 });
 await recoverOutgoing(f.env);assert.ok(recovered);assert.equal(recovered.html,first!.html);
 assert.deepEqual(Buffer.from(recovered.attachments[0].content,'base64'),png);
 assert.equal((await f.db.prepare('SELECT status FROM send_attempts').first<{status:string}>())!.status,'sent');
});

test('replaced/removed banners are retained for restoration, and referenced restored files are not purged',async()=>{
 const f=fixture();await saveEmailSignature(f.db,f.bucket,'alice',{signature:'Alice',banner:upload()});
 const original=(await getSignatureBanner(f.db,'alice'))!;
 await saveEmailSignature(f.db,f.bucket,'alice',{signature:'Alice',banner:upload(jpg)});
 const replacement=(await getSignatureBanner(f.db,'alice'))!;
 const retained=await f.db.prepare("SELECT (julianday(purge_after)-julianday('now')) AS days FROM retained_objects WHERE storage_key=?").bind(original.storage_key).first<{days:number}>();assert.ok(retained!.days>31);
 await saveEmailSignature(f.db,f.bucket,'alice',{signature:'Alice',banner:null});assert.equal(await getSignatureBanner(f.db,'alice'),null);
 assert.ok(f.objects.has(original.storage_key));assert.ok(f.objects.has(replacement.storage_key));
 const keys=Object.keys(original);f.sqlite.query(`INSERT INTO signature_banners(user_id,${keys.join(',')}) VALUES (?,${keys.map(()=>'?').join(',')})`).run('alice',...Object.values(original));
 f.sqlite.exec("UPDATE retained_objects SET purge_after=datetime('now','-1 day')");await purgeExpiredMail(f.env);
 assert.ok(f.objects.has(original.storage_key));assert.equal(f.objects.has(replacement.storage_key),false);
 assert.deepEqual(Buffer.from((await signatureBannerAttachment(f.bucket,original,'restored')).content,'base64'),png);
});
