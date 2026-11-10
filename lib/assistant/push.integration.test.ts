import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID,randomBytes,generateKeyPairSync,verify} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import type {Pool} from 'pg';
vi.mock('server-only',()=>({}));
const gateway=vi.hoisted(()=>({push:vi.fn(),sms:vi.fn()}));
vi.mock('./apns',async original=>({...await original<typeof import('./apns')>(),sendPush:gateway.push}));
vi.mock('@/lib/twilio/provider',async original=>({...await original<typeof import('@/lib/twilio/provider')>(),createSms:gateway.sms}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {registerPushDevice,confirmPushDevice,pushDeviceStatus,revokePushInstallation,openPushNotification,removeOwnedPushDevice} from './push-devices';
import {runEmployeeNotificationWorker} from './notification-worker';
import {apnsAuthorization,apnsConfiguration} from './apns';
import {pushRequestSchema} from './push-contract';
const url=process.env.ASSISTANT_PUSH_TEST_DATABASE_URL,ws='00000000-0000-4000-8000-000000000001';
const employee={user:{id:'push-owner',name:'Owner',email:'push-owner@example.test'},workspace:{id:ws,name:'Tailored Agents',slug:'tailored-agents'},role:'owner' as const},other={...employee,user:{id:'push-other',name:'Other',email:'push-other@example.test'}};
const account='AC'+'a'.repeat(32),sender='+15550001111',phone='+15550002222';let db:Pool;
const registration=()=>({operation:'register' as const,installationId:randomUUID(),secret:randomBytes(32).toString('base64url'),token:randomBytes(32).toString('hex'),environment:'development' as const,permission:'authorized' as const});
async function enabled(){
 const v=registration(),device=await registerPushDevice(employee,v),code=gateway.push.mock.calls.at(-1)![0].payload.ta_verify;
 await confirmPushDevice(employee,{operation:'confirm',installationId:v.installationId,secret:v.secret,id:device.id,code});
 await db.query("UPDATE assistant_push_devices SET verified_at=now()-interval '1 day'");
 await db.query("UPDATE assistant_notification_preferences SET phone=$1,verified_at=now()-interval '1 day',sms_enabled=true,completions=true,quiet_start='00:00',quiet_end='00:00' WHERE user_id=$2",[phone,employee.user.id]);gateway.push.mockClear();return {v,device};
}
async function event(){const id=randomUUID();await db.query("INSERT INTO assistant_employee_notifications(id,workspace_id,user_id,event_key,category,source_type,source_id) VALUES($1,$2,$3,$4,'completed','turn',$5)",[id,ws,employee.user.id,'event:'+id,randomUUID()]);return id;}
describe('APNs signing and request boundaries',()=>{
 it('signs an ES256 token and caches it within Apple’s allowed refresh interval',()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const config={...apnsConfiguration(),team:'ABCDEFGHIJ',keyId:'1234567890',key:privateKey.export({type:'pkcs8',format:'pem'}).toString(),environment:'development'};
  const now=1800000000000,token=apnsAuthorization(config,now),[head,body,sig]=token.split('.');expect(JSON.parse(Buffer.from(head,'base64url').toString())).toEqual({alg:'ES256',kid:config.keyId});expect(JSON.parse(Buffer.from(body,'base64url').toString())).toEqual({iss:config.team,iat:now/1000});expect(verify('sha256',Buffer.from(head+'.'+body),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url'))).toBe(true);expect(apnsAuthorization(config,now+1800000)).toBe(token);expect(apnsAuthorization(config,now+3100000)).not.toBe(token);
 });
 it('rejects arbitrary device credentials, caller-selected users, origins and environments',()=>{
  expect(pushRequestSchema.safeParse({...registration(),userId:'another-employee'}).success).toBe(false);expect(pushRequestSchema.safeParse({...registration(),token:'https://other.test'}).success).toBe(false);expect(pushRequestSchema.safeParse({...registration(),environment:'custom'}).success).toBe(false);
 });
});
describe.skipIf(!url)('Private native push and SMS fallback',()=>{
 beforeAll(async()=>{
  const target=new URL(url!);if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/ta_assistant_push_test')throw Error('Use the dedicated disposable push database.');
  vi.stubEnv('DATABASE_URL',url);vi.stubEnv('BETTER_AUTH_URL','http://localhost:3162');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-push-only-secret-at-least32');vi.stubEnv('DASHBOARD_AUTH_MODE','password');vi.stubEnv('DASHBOARD_ALLOWED_EMAILS','push-owner@example.test,push-other@example.test');
  db=getDatabasePool();await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');for(const f of (await readdir('db/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.query(await readFile('db/migrations/'+f,'utf8'));
  for(const c of [employee,other]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[c.user.id,c.user.name,c.user.email]);await db.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')",[randomUUID(),ws,c.user.id]);}
 },30000);
 beforeEach(async()=>{
  vi.stubEnv('ASSISTANT_PUSH_ENABLED','true');vi.stubEnv('ASSISTANT_APNS_TEAM_ID','ABCDEFGHIJ');vi.stubEnv('ASSISTANT_APNS_KEY_ID','1234567890');vi.stubEnv('ASSISTANT_APNS_PRIVATE_KEY','-----BEGIN PRIVATE KEY----- synthetic mocked provider only');vi.stubEnv('ASSISTANT_APNS_ENVIRONMENT','development');vi.stubEnv('ASSISTANT_NOTIFICATIONS_ENABLED','true');
  vi.stubEnv('TWILIO_SMS_ENABLED','true');vi.stubEnv('TWILIO_ACCOUNT_SID',account);vi.stubEnv('TWILIO_AUTH_TOKEN','a'.repeat(32));vi.stubEnv('TWILIO_API_KEY_SID','SK'+'a'.repeat(32));vi.stubEnv('TWILIO_API_KEY_SECRET','b'.repeat(32));vi.stubEnv('TWILIO_PHONE_NUMBER',sender);
  await db.query('TRUNCATE assistant_push_devices,assistant_employee_notifications,assistant_notification_preferences,crm_channel_preferences CASCADE');await db.query("UPDATE workspace_memberships SET status='active'");
  gateway.push.mockReset().mockResolvedValue({status:'accepted'});gateway.sms.mockReset().mockResolvedValue({sid:'SM'+'b'.repeat(32),accountSid:account,from:sender,to:phone,status:'queued'});vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('No real network calls in tests')));
 });
 afterAll(async()=>{await db?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('requires the verification push, installation secret and signed-in owner before enabling push',async()=>{
  const v=registration(),r=await registerPushDevice(employee,v),code=gateway.push.mock.calls[0][0].payload.ta_verify;
  expect(r.verified).toBe(false);const raw=(await db.query('SELECT * FROM assistant_push_devices')).rows[0];expect(raw.token_encrypted).not.toContain(v.token);expect(raw.binding_secret_hash).not.toContain(v.secret);
  await expect(confirmPushDevice(other,{operation:'confirm',installationId:v.installationId,secret:v.secret,id:r.id,code})).rejects.toThrow();await expect(confirmPushDevice(employee,{operation:'confirm',installationId:v.installationId,secret:'a'.repeat(43),id:r.id,code})).rejects.toThrow();
  await confirmPushDevice(employee,{operation:'confirm',installationId:v.installationId,secret:v.secret,id:r.id,code});expect((await pushDeviceStatus(employee,{...v,operation:'status'})).device?.verified).toBe(true);expect((await pushDeviceStatus(other,{...v,operation:'status'})).device).toBeNull();
 });
 it('prefers a verified device, coalesces safely, and never texts just because push is unread',async()=>{
  await enabled();await event();await event();await Promise.all([runEmployeeNotificationWorker(),runEmployeeNotificationWorker()]);expect(gateway.push).toHaveBeenCalledTimes(1);expect(gateway.sms).not.toHaveBeenCalled();const payload=gateway.push.mock.calls[0][0].payload;expect(JSON.stringify(payload)).not.toContain(employee.user.email);expect(payload.ta_notification).toBeTruthy();await runEmployeeNotificationWorker();expect(gateway.sms).not.toHaveBeenCalled();expect((await db.query("SELECT status FROM assistant_notification_deliveries ORDER BY status")).rows.map(r=>r.status)).toEqual(['accepted','suppressed']);
 });
 it('falls back to opted-in SMS only on a definite push failure and disables invalid tokens',async()=>{
  await enabled();await event();gateway.push.mockResolvedValueOnce({status:'failed',reason:'Unregistered',invalidDevice:true});await runEmployeeNotificationWorker();expect(gateway.sms).toHaveBeenCalledTimes(1);expect((await db.query('SELECT enabled FROM assistant_push_devices')).rows[0].enabled).toBe(false);
 });
 it('retains unknown push outcomes and does not produce a duplicate text',async()=>{
  await enabled();await event();gateway.push.mockResolvedValueOnce({status:'unknown',reason:'lost_response'});await runEmployeeNotificationWorker();await runEmployeeNotificationWorker();expect(gateway.push).toHaveBeenCalledTimes(1);expect(gateway.sms).not.toHaveBeenCalled();
 });
 it('does not spill a later employee into SMS when the push batch is full',async()=>{
  await enabled();const v=registration(),device=await registerPushDevice(other,v),code=gateway.push.mock.calls.at(-1)![0].payload.ta_verify;
  await confirmPushDevice(other,{operation:'confirm',installationId:v.installationId,secret:v.secret,id:device.id,code});
  await db.query("UPDATE assistant_push_devices SET verified_at=now()-interval '1 day'");
  await db.query("UPDATE assistant_notification_preferences SET sms_enabled=true,phone='+15550003333',verified_at=now()-interval '1 day',completions=true,quiet_start='00:00',quiet_end='00:00' WHERE user_id=$1",[other.user.id]);
  await event();const second=await event();await db.query('UPDATE assistant_employee_notifications SET user_id=$2 WHERE id=$1',[second,other.user.id]);gateway.push.mockClear();
  await runEmployeeNotificationWorker(1);expect(gateway.push).toHaveBeenCalledTimes(1);expect(gateway.sms).not.toHaveBeenCalled();await runEmployeeNotificationWorker(1);expect(gateway.push).toHaveBeenCalledTimes(2);expect(gateway.sms).not.toHaveBeenCalled();
 });
 it('keeps SMS available after device revocation',async()=>{
  const {v}=await enabled();await revokePushInstallation({...v,operation:'revoke'});await event();await runEmployeeNotificationWorker();expect(gateway.push).not.toHaveBeenCalled();expect(gateway.sms).toHaveBeenCalledTimes(1);
 });
 it.each(['unverified','disabled','opted_out'])('keeps opted-in SMS available when push is %s',async(reason)=>{
  await enabled();
  if(reason==='unverified')await db.query('UPDATE assistant_push_devices SET verified_at=NULL');
  if(reason==='disabled')vi.stubEnv('ASSISTANT_PUSH_ENABLED','false');
  if(reason==='opted_out')await db.query('UPDATE assistant_notification_preferences SET push_enabled=false');
  await event();await runEmployeeNotificationWorker();expect(gateway.push).not.toHaveBeenCalled();expect(gateway.sms).toHaveBeenCalledTimes(1);
 });
 it('opens only the signed-in employee’s alert and rejects a revoked binding',async()=>{
  const {v,device}=await enabled(),id=await event(),input={operation:'open' as const,installationId:v.installationId,secret:v.secret,id:device.id,notificationId:id};
  await expect(openPushNotification(other,input)).rejects.toThrow();await expect(openPushNotification(employee,{...input,secret:'a'.repeat(43)})).rejects.toThrow();
  expect((await db.query('SELECT read_at FROM assistant_employee_notifications WHERE id=$1',[id])).rows[0].read_at).toBeNull();
  expect(await openPushNotification(employee,input)).toEqual({path:'/dashboard/assistant'});
  await removeOwnedPushDevice(other,device.id);expect((await pushDeviceStatus(employee,{...v,operation:'status'})).device?.enabled).toBe(true);
  await removeOwnedPushDevice(employee,device.id);await expect(openPushNotification(employee,input)).rejects.toThrow();
 });
 it('requires new verification after token rotation and consumes verification only once',async()=>{
  const {v}=await enabled();const rotated={...v,token:randomBytes(32).toString('hex')};const result=await registerPushDevice(employee,rotated);expect(result.verified).toBe(false);
  const code=gateway.push.mock.calls.at(-1)![0].payload.ta_verify,input={operation:'confirm' as const,installationId:v.installationId,secret:v.secret,id:result.id,code};
  await confirmPushDevice(employee,input);await expect(confirmPushDevice(employee,input)).rejects.toThrow();
  gateway.push.mockClear();expect((await registerPushDevice(employee,rotated)).verified).toBe(true);expect(gateway.push).not.toHaveBeenCalled();
 });
 it('account switching revokes the old binding, demands new verification and cannot steal another installation',async()=>{
  const {v}=await enabled();await expect(registerPushDevice(other,{...v,secret:'a'.repeat(43)})).rejects.toThrow();const r=await registerPushDevice(other,v);expect(r.verified).toBe(false);expect((await pushDeviceStatus(employee,{...v,operation:'status'})).device).toBeNull();await event();await runEmployeeNotificationWorker();expect(gateway.sms).toHaveBeenCalledTimes(1);
 });
 it('respects quiet hours and employee access at dispatch',async()=>{
  await enabled();await event();await db.query("UPDATE assistant_notification_preferences SET quiet_start='00:00',quiet_end='23:59:59.999999'");await runEmployeeNotificationWorker();expect(gateway.push).not.toHaveBeenCalled();expect(gateway.sms).not.toHaveBeenCalled();await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[employee.user.id]);await db.query("UPDATE assistant_notification_preferences SET quiet_start='00:00',quiet_end='00:00'");await runEmployeeNotificationWorker();expect(gateway.push).not.toHaveBeenCalled();expect(gateway.sms).not.toHaveBeenCalled();
 });
});
