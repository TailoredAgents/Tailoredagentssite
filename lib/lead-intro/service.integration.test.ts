import { randomUUID } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { beforeAll,beforeEach,afterAll,describe,it,expect,vi } from 'vitest';
import type { Pool } from 'pg';
import type { DashboardContext } from '@/lib/dashboard/data';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({generate:vi.fn(),create:vi.fn(),lookup:vi.fn(),meta:vi.fn()}));
vi.mock('./provider',()=>({generateIntroduction:mocks.generate}));
vi.mock('@/lib/twilio/config',()=>({TWILIO_MESSAGE_SID:/^SM[0-9a-f]{32}$/i,getTwilioConfiguration:()=>({baseUrl:'https://example.test',ready:true,webhookReady:true,enabled:true,accountSid:'AC'+'1'.repeat(32),phoneNumber:'+16785417725'})}));
vi.mock('@/lib/twilio/provider',async(original)=>({...await original<typeof import('@/lib/twilio/provider')>(),createSms:mocks.create,lookupOwnedNumber:mocks.lookup}));
vi.mock('@/lib/meta/provider',async(original)=>({...await original<typeof import('@/lib/meta/provider')>(),fetchMetaLead:mocks.meta}));
import { enqueueMetaLeads,runMetaLeadWorker } from '@/lib/meta/service';
import { getDatabasePool } from '@/lib/dashboard/db';
import { saveIntroSettings,enqueueLeadIntroduction,introTransaction,cancelLeadIntroduction,getIntroSettings } from './service';
import { runLeadIntroductionStep,reconcileIntroductions } from './worker';
import { connectSmsNumber,sendSmsMessage,receiveSmsWebhook,receiveSmsStatus } from '@/lib/sms/service';
import { getConversationIntroduction,getIntroductionCalls,completeIntroductionCall } from './data';
import { deleteLead } from '@/lib/operations/delete-lead';
const url=process.env.TEST_LEAD_INTRO_DATABASE_URL;
const ws='00000000-0000-4000-8000-000000000001',user='intro-owner',phone='+12125550123',account='AC'+'1'.repeat(32);
const context:DashboardContext={user:{id:user,name:'Owner',email:'owner@example.test'},workspace:{id:ws,name:'Fixture',slug:'fixture'},role:'owner'};
let pool:Pool,numberId:string;
const settings=()=>({enabled:true,numberId,ownerId:user,formIds:['222222222'],startMinute:0,endMinute:1440,weekdays:[0,1,2,3,4,5,6],instructions:'Friendly',dailyLimit:20,reviewed:true});
async function lead(overrides:{form?:string;submitted?:string;phone?:string}={}){
 const id=randomUUID(),event=randomUUID();
 await pool.query("INSERT INTO leads(id,workspace_id,name,organization,source,status,phone,description,meta_context) VALUES($1,$2,'Jamie','','facebook','new',$3,'Interested in a website and SEO',$4)",[id,ws,overrides.phone||phone,JSON.stringify({formId:overrides.form||'222222222',submittedAt:overrides.submitted||new Date().toISOString()})]);
 await pool.query("INSERT INTO meta_lead_events(id,workspace_id,page_id,provider_lead_id,form_id,lead_id,status) VALUES($1,$2,'111111111',$3,'222222222',$4,'imported')",[event,ws,randomUUID(),id]);
 await introTransaction(ws,db=>enqueueLeadIntroduction(db,ws,event,id));
 return {id,event};
}
async function job(){return (await pool.query('SELECT * FROM lead_intro_jobs ORDER BY created_at LIMIT 1')).rows[0];}
async function ready(){await runLeadIntroductionStep();await pool.query("UPDATE lead_intro_jobs SET due_at=now()-interval '1 second' WHERE status='ready'");}
describe.skipIf(!url)('First SMS introductions in isolated PostgreSQL',()=>{
 beforeAll(async()=>{
  const parsed=new URL(url!);if(parsed.hostname!=='127.0.0.1'||parsed.port!=='55433'||parsed.pathname!=='/ta_lead_intro_test'||parsed.search||parsed.hash)throw new Error('Use exact disposable ta_lead_intro_test on loopback:55433.');
  vi.stubEnv('DATABASE_URL',url!);pool=getDatabasePool();
  expect((await pool.query('SELECT current_database() name')).rows[0].name).toBe('ta_lead_intro_test');
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY)');
  for(const file of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort()){
   if((await pool.query('SELECT 1 FROM schema_migrations WHERE filename=$1',[file])).rowCount)continue;
   const db=await pool.connect();try{await db.query('BEGIN');await db.query(await readFile('db/migrations/'+file,'utf8'));await db.query('INSERT INTO schema_migrations VALUES($1)',[file]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  }
 },30000);
 beforeEach(async()=>{
  await pool.query('TRUNCATE sms_numbers,crm_channel_preferences,crm_businesses,leads,audit_logs,"user" CASCADE');
  await pool.query('DELETE FROM lead_intro_settings');
  await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$1,$2)',[user,'owner@example.test']);
  await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')",[randomUUID(),ws,user]);
  vi.resetAllMocks();vi.stubEnv('LEAD_INTRO_SMS_ENABLED','true');
  mocks.lookup.mockResolvedValue({accountSid:account,phone:'+16785417725',providerSid:'PN'+'2'.repeat(32),smsEnabled:true});
  mocks.create.mockImplementation(async(i:{from:string;to:string})=>({sid:'SM'+'3'.repeat(32),status:'queued',accountSid:account,from:i.from,to:i.to}));
  mocks.generate.mockResolvedValue('Hi Jamie! Thanks for reaching out to Tailored Agents about your website and SEO. What is your main priority? Our team will also give you a call to follow up.');
  numberId=await connectSmsNumber(context,{phone:'+16785417725'});
  await saveIntroSettings(context,settings());
  // Provider timestamps have second precision; fixture activation predates the new lead.
  await pool.query("UPDATE lead_intro_settings SET enabled_at=now()-interval '1 minute'");
 });
 afterAll(async()=>{await pool?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();});
 it('does not enroll when disabled, on wrong forms, old imports or duplicate phones',async()=>{
  vi.stubEnv('LEAD_INTRO_SMS_ENABLED','false');await lead();expect(await job()).toBeUndefined();vi.stubEnv('LEAD_INTRO_SMS_ENABLED','true');
  await lead({form:'999999999'});await lead({submitted:new Date(Date.now()-7200000).toISOString()});expect(await job()).toBeUndefined();
  await lead();await lead();expect((await pool.query('SELECT count(*)::int n FROM lead_intro_jobs')).rows[0].n).toBe(1);
  expect((await job()).due_at.getTime()).toBeGreaterThan(Date.now()+15000);
 });
 it.each([false,true])('imports the real Meta path, isolating optional queue failure=%s',async(failQueue)=>{
  for(const [key,value] of Object.entries({META_LEADS_ENABLED:'true',META_PAGE_ID:'111111111',META_APP_SECRET:'fixture-secret-123456789',META_WEBHOOK_VERIFY_TOKEN:'v'.repeat(32),META_PAGE_ACCESS_TOKEN:'synthetic-token'.repeat(3)}))vi.stubEnv(key,value);
  mocks.meta.mockResolvedValue({id:'333333333',form_id:'222222222',created_time:new Date().toISOString(),field_data:[{name:'full_name',values:['Jamie']},{name:'phone_number',values:[phone]},{name:'what_do_you_need',values:['A website and SEO']}]});
  if(failQueue)await pool.query("UPDATE lead_intro_settings SET weekdays='{}'");
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try{
   await enqueueMetaLeads({object:'page',entry:[{id:'111111111',changes:[{field:'leadgen',value:{page_id:'111111111',leadgen_id:'333333333',form_id:'222222222'}}]}]});
   expect((await runMetaLeadWorker()).failed).toBe(0);expect((await pool.query("SELECT count(*)::int n FROM leads WHERE source='facebook'")).rows[0].n).toBe(1);
   if(failQueue){expect(await job()).toBeUndefined();expect((await getIntroSettings(context))?.settings.last_error_code).toBe('enqueue_failed');}else expect((await job()).status).toBe('queued');
  }finally{log.mockRestore();}
 });
 it('drafts once, sends once, creates one owned call task and stores the SMS',async()=>{
  await lead();await ready();await Promise.all([runLeadIntroductionStep(),runLeadIntroductionStep()]);await runLeadIntroductionStep();
  expect((await job()).status).toBe('accepted');expect(mocks.generate).toHaveBeenCalledTimes(1);expect(mocks.create).toHaveBeenCalledTimes(1);
  const calls=await getIntroductionCalls(context,'mine');expect(calls).toHaveLength(1);expect(calls[0].owner_name).toBe(user);
  await completeIntroductionCall(context,{id:calls[0].id,outcome:'Called and left voicemail',status:'completed'});expect(await getIntroductionCalls(context,'mine')).toHaveLength(0);
  expect((await pool.query('SELECT body FROM sms_messages')).rows[0].body).toContain('website and SEO');
 });
 it.each(['reply','manual','pause','optout','grant','change','delete','anonymize','settings'])('stops pending work on %s',async(kind)=>{
  const l=await lead();await ready();const j=await job();
  if(kind==='reply')await receiveSmsWebhook({AccountSid:account,MessageSid:'SM'+'4'.repeat(32),From:phone,To:'+16785417725',Body:'Hello',NumMedia:'0'});
  if(kind==='manual')await sendSmsMessage(context,{numberId,to:phone,text:'Human reply',requestId:randomUUID()});
  if(kind==='pause')await cancelLeadIntroduction(context,j.conversation_id);
  if(kind==='optout')await pool.query("INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status) VALUES($1,'sms',$2,'blocked')",[ws,phone]);
  if(kind==='grant')await pool.query('UPDATE sms_number_grants SET can_send=false');
  if(kind==='change')await pool.query("UPDATE leads SET description='New details' WHERE id=$1",[l.id]);
  if(kind==='delete')await deleteLead(context,{leadId:l.id,confirmed:"yes"});
  if(kind==='anonymize')await pool.query('UPDATE leads SET anonymized_at=now() WHERE id=$1',[l.id]);
  if(kind==='settings')await saveIntroSettings(context,{...settings(),enabled:false});
  mocks.create.mockClear();await runLeadIntroductionStep();expect(mocks.create).not.toHaveBeenCalled();expect((await job()).status).toBe('cancelled');
  if(['delete','anonymize'].includes(kind)){expect((await job()).body).toBeNull();expect((await job()).phone).toBeNull();}
 });
 it('does not resurrect a draft after takeover during generation',async()=>{
  await lead();const j=await job();mocks.generate.mockImplementation(async()=>{await cancelLeadIntroduction(context,j.conversation_id);return 'Discard me';});
  await ready();await runLeadIntroductionStep();expect((await job()).status).toBe('cancelled');expect((await job()).body).toBeNull();expect(mocks.create).not.toHaveBeenCalled();
 });
 it('never retries an uncertain provider POST and resolves a later receipt',async()=>{
  await lead();await ready();mocks.create.mockRejectedValue(new Error('network timeout'));await runLeadIntroductionStep();await runLeadIntroductionStep();
  expect((await job()).status).toBe('unknown');expect(mocks.create).toHaveBeenCalledTimes(1);
  await receiveSmsStatus((await job()).id,{AccountSid:account,MessageSid:'SM'+'3'.repeat(32),MessageStatus:'delivered',From:'+16785417725',To:phone});await reconcileIntroductions();expect((await job()).status).toBe('accepted');
 });
 it('uses a safe fallback if AI fails',async()=>{
  await lead();mocks.generate.mockRejectedValue(new Error('unavailable'));await ready();expect((await job()).generated_by).toBe('fallback');expect((await job()).body).toContain('What would you most');
 });
 it('does not repeat a provider generation interrupted by process loss',async()=>{
  await lead();await pool.query("UPDATE lead_intro_jobs SET status='generating',generation_started_at=now(),lease_until=now()-interval '1 second'");await runLeadIntroductionStep();
  expect((await job()).status).toBe('failed');expect((await job()).reason).toBe('generation_interrupted');expect(mocks.generate).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
 });
 it('honors an expired lead and server kill switch before sending',async()=>{
  await lead();await ready();vi.stubEnv('LEAD_INTRO_SMS_ENABLED','false');await runLeadIntroductionStep();expect(mocks.create).not.toHaveBeenCalled();
  vi.stubEnv('LEAD_INTRO_SMS_ENABLED','true');await pool.query("UPDATE lead_intro_jobs SET expires_at=now()-interval '1 second'");await runLeadIntroductionStep();expect((await job()).reason).toBe('expired');expect(mocks.create).not.toHaveBeenCalled();
 });
 it('enforces a daily quota using stable timestamps',async()=>{
  await pool.query('UPDATE lead_intro_settings SET daily_limit=1');await lead();await ready();await runLeadIntroductionStep();await lead({phone:'+12125550124'});await runLeadIntroductionStep();
  expect(mocks.generate).toHaveBeenCalledTimes(1);expect((await pool.query("SELECT reason FROM lead_intro_jobs WHERE phone='+12125550124'")).rows[0].reason).toBe('daily_intro_limit');
 });
 it('does not expose bodies or call tasks without the number grant even to an admin',async()=>{
  await lead();await ready();const j=await job();await pool.query('DELETE FROM sms_number_grants');
  expect(await getConversationIntroduction(context,j.conversation_id)).toBeNull();expect((await getIntroSettings(context))?.recent).toHaveLength(0);
  await expect(cancelLeadIntroduction(context,j.conversation_id)).rejects.toThrow('access');
 });
});
