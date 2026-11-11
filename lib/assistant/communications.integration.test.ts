import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import type {Pool} from 'pg';
vi.mock('server-only',()=>({}));
const mail=vi.hoisted(()=>({send:vi.fn(),reply:vi.fn(),status:vi.fn(),capabilities:vi.fn(),mailbox:vi.fn()}));
vi.mock('@/lib/inbox/data',async original=>({...await original<typeof import('@/lib/inbox/data')>(),requireInboxMailbox:mail.mailbox}));
vi.mock('@/lib/inbox/mail-provider',async original=>({...await original<typeof import('@/lib/inbox/mail-provider')>(),sendMail:mail.send,getMailReplyContext:mail.reply,getMailSendStatus:mail.status,getMailComposeCapabilities:mail.capabilities,getMailThread:async()=>({messages:[{id:'message',replyTargets:['customer@example.test']}]})}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {connectNative,nativePrincipal,beginChatTurn} from './chat-store';
import {prepareAction,executeAction,reviewAction} from './actions';
import {inlineReview,editInlineEmail,checkInlineEmail} from './inline-review';
import {storeDocument,exportDocument,controlDocument} from './documents';
import {asAssistant} from './access';
import {emailReview} from './outbound';
import type {Principal} from './oauth';
const url=process.env.ASSISTANT_COMMUNICATIONS_TEST_DATABASE_URL,ws='00000000-0000-4000-8000-000000000001';let db:Pool,p:Principal;
const owner={user:{id:'communications-owner',name:'Owner',email:'owner@example.test'},workspace:{id:ws,name:'Tailored Agents',slug:'tailored-agents'},role:'owner' as const},other={...owner,user:{id:'communications-other',name:'Other',email:'other@example.test'}};
const input=()=>({mailboxId:'sales',to:'customer@example.test',subject:'Discovery',text:'Reviewed message',requestId:randomUUID()});
describe.skipIf(!url)('Chat communication review and delivery',()=>{
 beforeAll(async()=>{
  const target=new URL(url!);if(!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/ta_assistant_communications_test')throw Error('Use the isolated communications database.');
  vi.stubEnv('DATABASE_URL',url);vi.stubEnv('BETTER_AUTH_URL','http://localhost:3162');vi.stubEnv('DASHBOARD_AUTH_MODE','password');vi.stubEnv('DASHBOARD_ALLOWED_EMAILS','owner@example.test,other@example.test');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-communications-secret-at-least32');
  db=getDatabasePool();await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');for(const f of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.query(await readFile('db/migrations/'+f,'utf8'));
  for(const c of [owner,other]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[c.user.id,c.user.name,c.user.email]);await db.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')",[randomUUID(),ws,c.user.id]);}
 },30000);
 beforeEach(async()=>{
  vi.stubEnv('OPERATIONS_ASSISTANT_ENABLED','true');vi.stubEnv('OPERATIONS_ASSISTANT_WRITES_ENABLED','true');vi.stubEnv('OPERATIONS_ASSISTANT_DIRECT_ENABLED','true');vi.stubEnv('ASSISTANT_BACKGROUND_ENABLED','false');vi.stubEnv('ASSISTANT_COMMUNICATIONS_ENABLED','true');
  await db.query('TRUNCATE assistant_actions,assistant_grants,assistant_chat_threads,assistant_documents,inbox_outbound_intents,inbox_conversations CASCADE');await db.query("UPDATE workspace_memberships SET status='active'");await db.query(`INSERT INTO "session"(id,"userId",token,"expiresAt") VALUES('communication-session',$1,'synthetic-communication-session',now()+interval '1 day') ON CONFLICT(id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt"`,[owner.user.id]);await connectNative(owner,'communication-session','direct',true,{email:true});p=await nativePrincipal(owner,'communication-session');
  mail.mailbox.mockReset().mockResolvedValue({id:'sales',email:'sales@example.test',canSend:true,addresses:[]});mail.capabilities.mockReset().mockResolvedValue({version:2,replyAll:true,generatedAttachments:true});mail.send.mockReset().mockResolvedValue({messageId:'sent',threadId:'thread',status:'accepted'});mail.status.mockReset().mockResolvedValue({state:'accepted',messageId:'sent',threadId:'thread',delivery:'delivered'});mail.reply.mockReset().mockResolvedValue({messageId:'message',revision:'a'.repeat(64),subject:'Re: Discovery',reply:{to:['customer@example.test'],cc:[],bcc:[]},replyAll:{to:['customer@example.test'],cc:['partner@example.test'],bcc:[]}});vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('No real network calls')));
 });
 afterAll(async()=>{await db?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('requires human review even in direct mode and sends only once under concurrent approval',async()=>{
  const action=await executeAction(p,'send_email',input(),'communication-1');expect(action.status).toBe('awaiting_approval');expect(mail.send).not.toHaveBeenCalled();const v=await inlineReview(owner,action.id);await expect(inlineReview(other,action.id)).rejects.toThrow('unavailable');await expect(reviewAction(owner,action.id,'approve','f'.repeat(64))).rejects.toThrow('changed');await Promise.all([reviewAction(owner,action.id,'approve',v.inputHash),reviewAction(owner,action.id,'approve',v.inputHash)]);expect(mail.send).toHaveBeenCalledTimes(1);expect((await inlineReview(owner,action.id)).status).toBe('succeeded');
 });
 it('replaces an edited email so the old review cannot authorize new content',async()=>{
  const action=await prepareAction(p,'send_email',input(),'communication-edit'),v=await inlineReview(owner,action.id);const thread=randomUUID(),turn=randomUUID();await beginChatTurn(p,thread,turn,'Prepare a follow-up');await db.query("UPDATE assistant_chat_turns SET status='waiting',waiting_action_id=$2::uuid,activity=jsonb_build_array(jsonb_build_object('label','Email','status','awaiting_approval','reviewUrl','/dashboard/assistant?action='||$2::text)) WHERE id=$1",[turn,action.id]);
  const edited=await editInlineEmail(owner,action.id,v.inputHash,{text:'Corrected message',subject:'Corrected subject',to:'customer@example.test',cc:[],bcc:[],attachments:[]});expect(edited.id).not.toBe(action.id);expect((await reviewAction(owner,action.id,'approve',v.inputHash)).status).toBe('cancelled');expect(mail.send).not.toHaveBeenCalled();const saved=(await db.query('SELECT waiting_action_id,activity FROM assistant_chat_turns WHERE id=$1',[turn])).rows[0];expect(saved.waiting_action_id).toBe(edited.id);expect(saved.activity[0].reviewUrl).toBe('/dashboard/assistant?action='+edited.id);await reviewAction(owner,edited.id,'approve',edited.inputHash);expect(mail.send.mock.calls[0][1].text).toBe('Corrected message');
 });
 it('binds replies to current recipients, mode and thread revision',async()=>{
  const reply={...input(),subject:'Re: Discovery',threadId:'thread',replyToMessageId:'message',replyMode:'reply_all',threadRevision:'a'.repeat(64),cc:['partner@example.test']};const a=await prepareAction(p,'send_email',reply,'communication-reply');mail.reply.mockResolvedValue({...await mail.reply(),revision:'b'.repeat(64)});expect((await inlineReview(owner,a.id)).stale).toBe(true);expect((await reviewAction(owner,a.id,'approve')).status).toBe('failed');expect(mail.send).not.toHaveBeenCalled();
 });
 it('checks generated file hashes and current access; uploaded originals cannot be forwarded',async()=>{
  const thread=randomUUID(),turn=randomUUID();await beginChatTurn(p,thread,turn,'Prepare a file');const file=await exportDocument(owner,turn,{title:'Discovery brief',format:'csv',body:'',columns:['Task'],rows:[['Discovery']],sources:[]});const v={...input(),attachments:[{id:file.id,hash:file.hash}]};const action=await prepareAction(p,'send_email',v,'communication-file');await controlDocument(owner,file.id,{operation:'delete',revision:file.revision});expect((await reviewAction(owner,action.id,'approve')).status).toBe('failed');expect(mail.send).not.toHaveBeenCalled();
  const original=await storeDocument(owner,{idempotency:randomUUID(),name:'original.csv',bytes:Buffer.from('Task\nDiscovery')});await db.query("UPDATE assistant_documents SET status='ready',mime='text/csv' WHERE id=$1",[original.id]);await expect(asAssistant(p,['mail:send','conversations:read'],false,f=>emailReview(f,{...input(),attachments:[{id:original.id,hash:original.hash}]}))).rejects.toThrow('generated');
 });
 it('carries generated bytes and explicit CC/BCC in the reviewed envelope',async()=>{
  const thread=randomUUID(),turn=randomUUID();await beginChatTurn(p,thread,turn,'Prepare a file');const file=await exportDocument(owner,turn,{title:'Discovery brief',format:'csv',body:'',columns:['Task'],rows:[['Discovery']],sources:[]});const action=await prepareAction(p,'send_email',{...input(),cc:['partner@example.test'],bcc:['archive@example.test'],attachments:[{id:file.id,hash:file.hash}]},'communication-envelope');await reviewAction(owner,action.id,'approve');expect(mail.send).toHaveBeenCalledTimes(1);const envelope=mail.send.mock.calls[0][1].envelope;expect(envelope.cc).toEqual(['partner@example.test']);expect(envelope.bcc).toEqual(['archive@example.test']);expect(Buffer.from(envelope.attachments[0].content,'base64').toString()).toContain('Discovery');
 });
 it('blocks revoked permissions and reconciles an uncertain receipt without calling the sender again',async()=>{
  mail.send.mockRejectedValueOnce(Error('Provider response lost'));const a=await prepareAction(p,'send_email',input(),'communication-unknown');expect((await reviewAction(owner,a.id,'approve')).status).toBe('outcome_unknown');expect((await checkInlineEmail(owner,a.id)).status).toBe('succeeded');expect(mail.send).toHaveBeenCalledTimes(1);const b=await prepareAction(p,'send_email',input(),'communication-revoke');await db.query('UPDATE assistant_grants SET revoked_at=now() WHERE id=$1',[p.grantId]);await expect(reviewAction(owner,b.id,'approve')).rejects.toThrow();expect(mail.send).toHaveBeenCalledTimes(1);
 });
});
