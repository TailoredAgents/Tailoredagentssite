import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import type {Pool} from 'pg';
vi.mock('server-only',()=>({}));
const gateway=vi.hoisted(()=>({create:vi.fn(),fetch:vi.fn()}));
vi.mock('@/lib/twilio/provider',async original=>({...await original<typeof import('@/lib/twilio/provider')>(),createSms:gateway.create,fetchSms:gateway.fetch}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {TwilioProviderError} from '@/lib/twilio/provider';
import {requestEmployeePhoneVerification,confirmEmployeePhone,saveEmployeeNotificationPreferences,employeeWorkState,markEmployeeNotificationRead,receiveEmployeeNotificationStatus,receiveEmployeeAlertReply} from './employee-notifications';
import {runEmployeeNotificationWorker} from './notification-worker';
import {notificationPreferencesSchema,workRequestSchema} from './notification-contract';

const url=process.env.ASSISTANT_NOTIFICATIONS_TEST_DATABASE_URL;
const ws='00000000-0000-4000-8000-000000000001',account='AC'+'a'.repeat(32),sender='+15550001111',phone='+15550002222';
const employee={user:{id:'alerts-owner',name:'Owner',email:'alerts-owner@example.test'},workspace:{id:ws,name:'Tailored Agents',slug:'tailored-agents'},role:'owner' as const};
const other={...employee,user:{id:'alerts-other',name:'Other',email:'alerts-other@example.test'}};
const prefs={smsEnabled:true,completions:true,pushEnabled:false,timezone:'America/New_York',quietStart:'00:00',quietEnd:'00:00'};
let db:Pool;
async function enable(c=employee,p=phone){await db.query("INSERT INTO assistant_notification_preferences(workspace_id,user_id,phone,verified_at,sms_enabled,completions,quiet_start,quiet_end) VALUES($1,$2,$3,now()-interval '1 day',true,true,'00:00','00:00') ON CONFLICT(workspace_id,user_id) DO UPDATE SET phone=EXCLUDED.phone,verified_at=EXCLUDED.verified_at,sms_enabled=true,completions=true,quiet_start='00:00',quiet_end='00:00'",[ws,c.user.id,p]);}
async function turn(c=employee,status='completed'){
 const thread=randomUUID(),id=randomUUID();await db.query("INSERT INTO assistant_chat_threads(id,workspace_id,user_id,title) VALUES($1,$2,$3,'Private assignment')",[thread,ws,c.user.id]);await db.query("INSERT INTO assistant_chat_turns(id,thread_id,user_message,status) VALUES($1,$2,'Help with my work','queued')",[id,thread]);await db.query('UPDATE assistant_chat_turns SET status=$2,finished_at=now() WHERE id=$1',[id,status]);return {id,thread};
}
const provider=(status='queued')=>({sid:'SM'+'b'.repeat(32),accountSid:account,from:sender,to:phone,status});

describe('Employee notification input validation',()=>{
 it('requires explicit verification consent, bounded codes and valid time zones',()=>{
  expect(workRequestSchema.safeParse({operation:'verify_phone',phone}).success).toBe(false);
  expect(workRequestSchema.safeParse({operation:'verify_phone',phone,consent:true}).success).toBe(true);
  expect(notificationPreferencesSchema.safeParse({...prefs,timezone:'not/a-zone'}).success).toBe(false);
  expect(notificationPreferencesSchema.safeParse({...prefs,quietStart:'25:00'}).success).toBe(false);
 });
});
describe.skipIf(!url)('Employee notification database and delivery',()=>{
 beforeAll(async()=>{
  const target=new URL(url!);if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/ta_assistant_notifications_test')throw Error('Use the dedicated disposable notification database.');
  vi.stubEnv('DATABASE_URL',url);vi.stubEnv('BETTER_AUTH_URL','http://localhost:3162');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-notifications-only-secret-32-chars');vi.stubEnv('DASHBOARD_AUTH_MODE','password');vi.stubEnv('DASHBOARD_ALLOWED_EMAILS','alerts-owner@example.test,alerts-other@example.test');
  db=getDatabasePool();await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  for(const f of (await readdir('db/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.query(await readFile('db/migrations/'+f,'utf8'));
  for(const c of [employee,other]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[c.user.id,c.user.name,c.user.email]);await db.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')",[randomUUID(),ws,c.user.id]);}
 },30000);
 beforeEach(async()=>{
  vi.stubEnv('TWILIO_SMS_ENABLED','true');vi.stubEnv('ASSISTANT_NOTIFICATIONS_ENABLED','true');vi.stubEnv('TWILIO_ACCOUNT_SID',account);vi.stubEnv('TWILIO_AUTH_TOKEN','a'.repeat(32));vi.stubEnv('TWILIO_API_KEY_SID','SK'+'a'.repeat(32));vi.stubEnv('TWILIO_API_KEY_SECRET','b'.repeat(32));vi.stubEnv('TWILIO_PHONE_NUMBER',sender);
  await db.query('TRUNCATE assistant_notification_preferences,assistant_phone_challenges,assistant_employee_notifications,assistant_staff_sms_receipts,assistant_chat_threads,assistant_grants,crm_channel_preferences CASCADE');
  await db.query("UPDATE workspace_memberships SET status='active' WHERE user_id=ANY($1)",[[employee.user.id,other.user.id]]);
  gateway.create.mockReset().mockResolvedValue(provider());gateway.fetch.mockReset().mockResolvedValue(provider('delivered'));
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('Unexpected real network call')));
 });
 afterAll(async()=>{await db?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('creates the event atomically, deduplicates status changes and keeps feeds private',async()=>{
  const t=await turn();await db.query("UPDATE assistant_chat_turns SET status='completed' WHERE id=$1",[t.id]);
  expect((await employeeWorkState(employee)).notifications).toHaveLength(1);expect((await employeeWorkState(other)).notifications).toHaveLength(0);
  const id=(await employeeWorkState(employee)).notifications[0].id;await markEmployeeNotificationRead(other,id);expect((await employeeWorkState(employee)).notifications[0].read).toBe(false);
  const tx=await db.connect();await tx.query('BEGIN');await tx.query("UPDATE assistant_chat_turns SET status='failed' WHERE id=$1",[t.id]);await tx.query('ROLLBACK');tx.release();expect((await employeeWorkState(employee)).notifications).toHaveLength(1);
 });
 it('does not enable SMS until the employee verifies and opts in; codes have bounded attempts',async()=>{
  await expect(saveEmployeeNotificationPreferences(employee,prefs)).rejects.toThrow('Verify');
  const r=await requestEmployeePhoneVerification(employee,phone),text=gateway.create.mock.calls[0][0].text;
  expect(text).toMatch(/\b\d{6}\b/);const code=text.match(/\b\d{6}\b/)[0];
  await expect(confirmEmployeePhone(other,r.challengeId,code)).rejects.toThrow('expired');
  await expect(confirmEmployeePhone(employee,r.challengeId,'000000')).rejects.toThrow('match');
  expect((await db.query('SELECT attempts FROM assistant_phone_challenges WHERE id=$1',[r.challengeId])).rows[0].attempts).toBe(1);
  await confirmEmployeePhone(employee,r.challengeId,code);expect((await employeeWorkState(employee)).preferences.smsEnabled).toBe(false);
  await saveEmployeeNotificationPreferences(employee,prefs);expect((await employeeWorkState(employee)).preferences.smsEnabled).toBe(true);
  await expect(requestEmployeePhoneVerification(employee,phone)).rejects.toThrow('Wait');
 });
 it('locks an invalid code after five attempts and rejects use of the business number',async()=>{
  await expect(requestEmployeePhoneVerification(employee,sender)).rejects.toThrow('personal');
  const r=await requestEmployeePhoneVerification(employee,phone);for(let i=0;i<5;i++)await expect(confirmEmployeePhone(employee,r.challengeId,'000000')).rejects.toThrow();
  const code=gateway.create.mock.calls[0][0].text.match(/\b\d{6}\b/)[0];await expect(confirmEmployeePhone(employee,r.challengeId,code)).rejects.toThrow('expired');
 });
 it('coalesces updates and sends once under concurrent workers, with no customer content',async()=>{
  await enable();await turn();await turn();await Promise.all([runEmployeeNotificationWorker(),runEmployeeNotificationWorker()]);
  expect(gateway.create).toHaveBeenCalledTimes(1);const body=gateway.create.mock.calls[0][0].text;expect(body).not.toContain('Private assignment');expect(body.length).toBeLessThanOrEqual(160);
  const rows=(await db.query('SELECT status FROM assistant_notification_deliveries')).rows;expect(rows.map(r=>r.status).sort()).toEqual(['accepted','suppressed']);
  await runEmployeeNotificationWorker();expect(gateway.create).toHaveBeenCalledTimes(1);
 });
 it('retains unknown sends and never retries them blindly',async()=>{
  await enable();await turn();gateway.create.mockRejectedValueOnce(Error('response lost'));await runEmployeeNotificationWorker();await runEmployeeNotificationWorker();
  expect(gateway.create).toHaveBeenCalledTimes(1);expect((await db.query('SELECT status FROM assistant_notification_deliveries')).rows[0].status).toBe('unknown');
 });
 it('honors quiet hours, read state, opt-out and revoked membership',async()=>{
  await enable();const t=await turn();await db.query("UPDATE assistant_notification_preferences SET quiet_start='00:00',quiet_end='23:59:59.999999'");await runEmployeeNotificationWorker();expect(gateway.create).not.toHaveBeenCalled();
  await enable();await db.query("INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status) VALUES($1,'sms',$2,'blocked')",[ws,phone]);await runEmployeeNotificationWorker();expect(gateway.create).not.toHaveBeenCalled();await db.query('TRUNCATE crm_channel_preferences');
  await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[employee.user.id]);await runEmployeeNotificationWorker();expect(gateway.create).not.toHaveBeenCalled();await expect(employeeWorkState(employee)).rejects.toThrow('unavailable');
  await db.query("UPDATE workspace_memberships SET status='active' WHERE user_id=$1",[employee.user.id]);const n=(await employeeWorkState(employee)).notifications[0];await markEmployeeNotificationRead(employee,n.id);await runEmployeeNotificationWorker();expect(gateway.create).not.toHaveBeenCalled();expect(n.url).toContain(t.thread);
 });
 it('keeps provider status monotonic, validates callback identity and reconciles uncertain sends',async()=>{
  await enable();await turn();gateway.create.mockRejectedValueOnce(Error('lost'));await runEmployeeNotificationWorker();const id=(await db.query('SELECT id FROM assistant_notification_deliveries')).rows[0].id;
  const callback={AccountSid:account,MessageSid:provider().sid,MessageStatus:'delivered',From:sender,To:phone};
  await expect(receiveEmployeeNotificationStatus(id,{...callback,To:'+15550003333'})).rejects.toThrow('identity');
  await receiveEmployeeNotificationStatus(id,callback);await receiveEmployeeNotificationStatus(id,{...callback,MessageStatus:'sent'});expect((await db.query('SELECT status FROM assistant_notification_deliveries')).rows[0].status).toBe('delivered');
 });
 it('does not create customer records from staff replies; STOP replay cannot be undone by replayed START',async()=>{
  await enable();const start={AccountSid:account,MessageSid:'SM'+'c'.repeat(32),From:phone,To:sender,Body:'START'};
  expect(await receiveEmployeeAlertReply(start)).toBe(true);await receiveEmployeeAlertReply({...start,MessageSid:'SM'+'d'.repeat(32),Body:'STOP'});await receiveEmployeeAlertReply(start);
  expect((await db.query('SELECT status FROM crm_channel_preferences')).rows[0].status).toBe('blocked');expect((await employeeWorkState(employee)).preferences.smsEnabled).toBe(false);
  expect((await db.query('SELECT id FROM sms_conversations')).rowCount).toBe(0);await expect(saveEmployeeNotificationPreferences(employee,prefs)).rejects.toThrow('opted out');
  expect(await receiveEmployeeAlertReply({...start,MessageSid:'SM'+'e'.repeat(32),Body:'approve'})).toBe(true);expect((await db.query('SELECT id FROM assistant_actions')).rowCount).toBe(0);
 });
 it('suppresses expired review requests and resolves alerts with their action',async()=>{
  await enable();const grant=randomUUID(),action=randomUUID();await db.query("INSERT INTO assistant_grants(id,client_id,user_id,workspace_id,scopes,resource,expires_at) VALUES($1,'ta_native_dashboard',$2,$3,ARRAY['operations:read'],'http://localhost:3162/api/mcp/operations',now()+interval '1 hour')",[grant,employee.user.id,ws]);
  await db.query("INSERT INTO assistant_actions(id,grant_id,workspace_id,user_id,tool,input_hash,idempotency_key,status,input,review_context) VALUES($1,$2,$3,$4,'save_goal','synthetic','test-key-123','awaiting_approval','{}','{}')",[action,grant,ws,employee.user.id]);
  expect((await employeeWorkState(employee)).notifications[0].title).toContain('review');await db.query("UPDATE assistant_actions SET status='cancelled' WHERE id=$1",[action]);expect((await employeeWorkState(employee)).notifications[0].resolved).toBe(true);await runEmployeeNotificationWorker();expect(gateway.create).not.toHaveBeenCalled();
 });
 it('does not send when disabled and does not treat provider acceptance as delivery',async()=>{
  await enable();await turn();vi.stubEnv('ASSISTANT_NOTIFICATIONS_ENABLED','false');await runEmployeeNotificationWorker();expect(gateway.create).not.toHaveBeenCalled();vi.stubEnv('ASSISTANT_NOTIFICATIONS_ENABLED','true');await runEmployeeNotificationWorker();expect((await employeeWorkState(employee)).notifications[0].delivery).toBe('accepted');
 });
 it('enforces the employee rolling-day cap without discarding the feed',async()=>{
  await enable();
  for(let i=0;i<10;i++){const t=await turn();await db.query("INSERT INTO assistant_notification_deliveries(id,notification_id,channel,status,recipient,created_at) SELECT $1,id,'sms','accepted',$2,now()-interval '10 minutes' FROM assistant_employee_notifications WHERE source_id=$3",[randomUUID(),phone,t.id]);}
  await turn();await runEmployeeNotificationWorker();expect(gateway.create).not.toHaveBeenCalled();expect((await employeeWorkState(employee)).notifications).toHaveLength(11);
 });
 it('disables future alerts when the provider reports an opt-out',async()=>{
  await enable();await turn();gateway.create.mockRejectedValueOnce(new TwilioProviderError('rejected','Opted out',21610));await runEmployeeNotificationWorker();
  expect((await employeeWorkState(employee)).preferences.smsEnabled).toBe(false);
  expect((await db.query('SELECT status FROM crm_channel_preferences')).rows[0].status).toBe('blocked');await turn();await runEmployeeNotificationWorker();expect(gateway.create).toHaveBeenCalledTimes(1);
 });
 it('does not overwrite a delivery callback that arrives before the create response',async()=>{
  await enable();await turn();gateway.create.mockImplementationOnce(async(input:{attemptId:string})=>{await receiveEmployeeNotificationStatus(input.attemptId,{AccountSid:account,MessageSid:provider().sid,MessageStatus:'delivered',From:sender,To:phone});return provider();});
  await runEmployeeNotificationWorker();expect((await db.query('SELECT status FROM assistant_notification_deliveries')).rows[0].status).toBe('delivered');
 });
});
