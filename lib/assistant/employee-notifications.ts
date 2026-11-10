import 'server-only';
import {createHmac,randomInt,randomUUID,timingSafeEqual} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {resolveDashboardConfiguration} from '@/lib/dashboard/config';
import {createSms,fetchSms,TwilioProviderError} from '@/lib/twilio/provider';
import {getTwilioConfiguration,TWILIO_MESSAGE_SID} from '@/lib/twilio/config';
import {TwilioWebhookError} from '@/lib/twilio/webhook';
import {AssistantError} from './config';
import {notificationDestination,notificationPreferencesSchema,notificationTitles,type NotificationCategory,type WorkState} from './notification-contract';

type Database=Pick<PoolClient,'query'>;
const owner=(c:DashboardContext)=>[c.workspace.id,c.user.id];
const unavailable=()=>new AssistantError('unavailable','This employee notification is unavailable.',404);
async function active(c:DashboardContext,db:Database=getDatabasePool()){
 if(!(await db.query("SELECT 1 FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.status='active' AND w.status='active'",owner(c))).rowCount)throw unavailable();
}
function codeHash(id:string,code:string){
 const key=resolveDashboardConfiguration().authSecret;if(key.length<32)throw new AssistantError('unavailable','Phone verification is not configured.',503);
 return createHmac('sha256',key).update('employee-phone:'+id+':'+code).digest('hex');
}
function messaging(){const config=getTwilioConfiguration();if(!config.enabled||process.env.ASSISTANT_NOTIFICATIONS_ENABLED==='false')throw new AssistantError('sms_unavailable','Employee text alerts are not enabled on the server.',503);return config;}
export async function requestEmployeePhoneVerification(c:DashboardContext,phone:string){
 const config=messaging();if(!/^\+1[2-9]\d{9}$/.test(phone)||phone===config.phoneNumber)throw new AssistantError('invalid_phone','Use your personal US or Canadian mobile number.');
 const id=randomUUID(),code=String(randomInt(100000,1000000)),db=await getDatabasePool().connect();
 try{
  await db.query('BEGIN');await active(c,db);
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[c.workspace.id+':employee-phone:'+c.user.id]);
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['employee-phone-destination:'+phone]);
  const limits=(await db.query(`SELECT count(*) FILTER(WHERE created_at>now()-interval '1 hour')::int hourly,count(*) FILTER(WHERE created_at>now()-interval '1 minute')::int recent FROM assistant_phone_challenges WHERE workspace_id=$1 AND user_id=$2 AND created_at>now()-interval '1 day'`,owner(c))).rows[0];
  const phoneCount=(await db.query("SELECT count(*)::int n FROM assistant_phone_challenges WHERE phone=$1 AND created_at>now()-interval '1 hour'",[phone])).rows[0].n;
  if(limits.hourly>=3||limits.recent||phoneCount>=3)throw new AssistantError('rate_limited','Wait before requesting another verification code.',429);
  if((await db.query("SELECT 1 FROM crm_channel_preferences WHERE workspace_id=$1 AND channel='sms' AND normalized_address=$2 AND status='blocked'",[c.workspace.id,phone])).rowCount)throw new AssistantError('sms_opted_out','This number has opted out of texts. Use START with the business number before verifying.',409);
  if((await db.query('SELECT 1 FROM assistant_notification_preferences WHERE workspace_id=$1 AND phone=$2 AND verified_at IS NOT NULL AND user_id<>$3',[c.workspace.id,phone,c.user.id])).rowCount)throw new AssistantError('phone_in_use','This phone is already assigned to another employee.',409);
  await db.query('INSERT INTO assistant_phone_challenges(id,workspace_id,user_id,phone,code_hash,account_sid,sender_phone) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,...owner(c),phone,codeHash(id,code),config.accountSid,config.phoneNumber]);await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 try{
  const r=await createSms({from:config.phoneNumber,to:phone,text:`Tailored Agents verification code: ${code}. Expires in 10 minutes. Do not share this code. Reply STOP to opt out.`,attemptId:id});
  if(r.accountSid!==config.accountSid||r.from!==config.phoneNumber||r.to!==phone)throw Error('provider_identity_mismatch');
  await getDatabasePool().query("UPDATE assistant_phone_challenges SET provider_sid=$2,status=CASE WHEN $3 IN ('failed','undelivered') THEN 'failed' ELSE 'accepted' END WHERE id=$1 AND status='sending'",[id,r.sid,r.status]);
 }catch(e){await getDatabasePool().query("UPDATE assistant_phone_challenges SET status=$2 WHERE id=$1 AND status='sending'",[id,e instanceof TwilioProviderError&&e.outcome==='rejected'?'failed':'unknown']);}
 return {challengeId:id,message:'If the text arrives, enter its code. An uncertain send is not retried automatically.'};
}
export async function confirmEmployeePhone(c:DashboardContext,id:string,code:string){
 const db=await getDatabasePool().connect();let wrong=false;
 try{
  await db.query('BEGIN');await active(c,db);
  const r=(await db.query('SELECT * FROM assistant_phone_challenges WHERE id=$1 AND workspace_id=$2 AND user_id=$3 FOR UPDATE',[id,...owner(c)])).rows[0];
  if(!r||r.expires_at<=new Date()||r.attempts>=5||r.status==='failed'||r.status==='verified')throw new AssistantError('invalid_code','This code expired or was used. Request a new one.',409);
  if(!/^\d{6}$/.test(code)||!timingSafeEqual(Buffer.from(codeHash(id,code)),Buffer.from(r.code_hash))){await db.query('UPDATE assistant_phone_challenges SET attempts=attempts+1 WHERE id=$1',[id]);wrong=true;}
  else{
   // Changing a phone does not enable sending; the employee saves alert preferences separately.
   await db.query(`INSERT INTO assistant_notification_preferences(workspace_id,user_id,phone,verified_at) VALUES($1,$2,$3,now()) ON CONFLICT(workspace_id,user_id) DO UPDATE SET phone=EXCLUDED.phone,verified_at=now(),sms_enabled=false,revision=assistant_notification_preferences.revision+1,updated_at=now()`,[...owner(c),r.phone]);
   await db.query("UPDATE assistant_phone_challenges SET status='verified' WHERE id=$1",[id]);
  }
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 if(wrong)throw new AssistantError('invalid_code','That code did not match.',400);
}
export async function saveEmployeeNotificationPreferences(c:DashboardContext,raw:unknown){
 const v=notificationPreferencesSchema.parse(raw),db=getDatabasePool();await active(c);
 if(!(await db.query('SELECT 1 FROM pg_timezone_names WHERE name=$1',[v.timezone])).rowCount)throw new AssistantError('timezone','Choose a supported time zone.');
 if(v.smsEnabled){messaging();const p=(await db.query('SELECT phone FROM assistant_notification_preferences WHERE workspace_id=$1 AND user_id=$2 AND verified_at IS NOT NULL',owner(c))).rows[0];if(!p)throw new AssistantError('verify_phone','Verify your mobile number first.',409);if((await db.query("SELECT 1 FROM crm_channel_preferences WHERE workspace_id=$1 AND channel='sms' AND normalized_address=$2 AND status='blocked'",[c.workspace.id,p.phone])).rowCount)throw new AssistantError('sms_opted_out','Your number has opted out. Send START to the business number first.',409);}
 await db.query('INSERT INTO assistant_notification_preferences(workspace_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',owner(c));
 const saved=await db.query(`UPDATE assistant_notification_preferences SET sms_enabled=$3,completions=$4,push_enabled=$5,timezone=$6,quiet_start=$7,quiet_end=$8,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND user_id=$2 AND (NOT $3::boolean OR verified_at IS NOT NULL) RETURNING user_id`,[...owner(c),v.smsEnabled,v.completions,v.pushEnabled,v.timezone,v.quietStart,v.quietEnd]);
 if(!saved.rowCount)throw new AssistantError('verify_phone','Verify your mobile number first.',409);
}
export async function employeeWorkState(c:DashboardContext):Promise<WorkState>{
 const db=getDatabasePool();await active(c);
 const [prefs,events,work]=await Promise.all([
  db.query('SELECT * FROM assistant_notification_preferences WHERE workspace_id=$1 AND user_id=$2',owner(c)),
  db.query(`SELECT n.*, (SELECT d.status FROM assistant_notification_deliveries d WHERE d.notification_id=n.id ORDER BY d.created_at DESC LIMIT 1) delivery FROM assistant_employee_notifications n WHERE n.workspace_id=$1 AND n.user_id=$2 ORDER BY n.created_at DESC,n.id LIMIT 50`,owner(c)),
  db.query(`SELECT t.id,t.thread_id,c.title,t.status,t.created_at,t.finished_at,(SELECT a.id FROM assistant_actions a WHERE a.grant_id=t.grant_id AND a.user_id=c.user_id AND a.workspace_id=c.workspace_id AND a.status='awaiting_approval' AND a.expires_at>now() AND EXISTS(SELECT 1 FROM jsonb_array_elements(t.activity) x WHERE x->>'reviewUrl' LIKE '%'||a.id::text||'%') ORDER BY a.created_at LIMIT 1) review_id FROM assistant_chat_turns t JOIN assistant_chat_threads c ON c.id=t.thread_id WHERE c.workspace_id=$1 AND c.user_id=$2 ORDER BY t.created_at DESC,t.id LIMIT 30`,owner(c)),
 ]);
 const p=prefs.rows[0];return {smsAvailable:getTwilioConfiguration().enabled&&process.env.ASSISTANT_NOTIFICATIONS_ENABLED!=='false',preferences:{phone:p?.phone??null,verified:!!p?.verified_at,smsEnabled:p?.sms_enabled??false,completions:p?.completions??false,pushEnabled:p?.push_enabled??false,timezone:p?.timezone??'America/New_York',quietStart:p?.quiet_start?.slice(0,5)??'21:00',quietEnd:p?.quiet_end?.slice(0,5)??'08:00'},notifications:events.rows.map(n=>({id:n.id,title:notificationTitles[n.category as NotificationCategory],url:notificationDestination(n),createdAt:n.created_at.toISOString(),read:!!n.read_at,resolved:!!n.resolved_at,delivery:n.delivery})),work:work.rows.map(w=>({id:w.id,threadId:w.thread_id,title:w.title,status:w.review_id?'waiting for review':w.status,createdAt:w.created_at.toISOString(),finishedAt:w.finished_at?.toISOString()??null,reviewUrl:w.review_id?'/dashboard/assistant?action='+w.review_id:null}))};
}
export async function markEmployeeNotificationRead(c:DashboardContext,id:string){await active(c);await getDatabasePool().query('UPDATE assistant_employee_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND workspace_id=$2 AND user_id=$3',[id,...owner(c)]);}

export async function suppressEmployeeSms(phone:string){
 const db=await getDatabasePool().connect();try{await db.query('BEGIN');
 await db.query("INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status,evidence) SELECT workspace_id,'sms',phone,'blocked','Twilio reported employee SMS opt-out (21610).' FROM assistant_notification_preferences WHERE phone=$1 AND verified_at IS NOT NULL ON CONFLICT(workspace_id,channel,normalized_address) DO UPDATE SET status='blocked',evidence=EXCLUDED.evidence,actor_user_id=NULL,updated_at=now()",[phone]);
 await db.query('UPDATE assistant_notification_preferences SET sms_enabled=false,revision=revision+1,updated_at=now() WHERE phone=$1 AND verified_at IS NOT NULL',[phone]);await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}

/** The shared Twilio endpoint verifies the signature before calling this function. */
export async function receiveEmployeeNotificationStatus(id:string,params:Record<string,string>){
 const db=getDatabasePool();let challenge=false;
 let job=(await db.query("SELECT account_sid,sender_phone,recipient,provider_sid,status,status_rank FROM assistant_notification_deliveries WHERE id=$1 AND channel='sms'",[id])).rows[0];
 if(!job){job=(await db.query('SELECT account_sid,sender_phone,phone recipient,provider_sid,status,0 status_rank FROM assistant_phone_challenges WHERE id=$1',[id])).rows[0];challenge=true;}
 if(!job)return false;
 const sid=params.MessageSid||params.SmsSid,status=params.MessageStatus||params.SmsStatus;
 if(!TWILIO_MESSAGE_SID.test(sid??'')||!['accepted','queued','sending','sent','delivered','undelivered','failed'].includes(status)||(params.ErrorCode&&!/^\d{1,20}$/.test(params.ErrorCode)))throw new TwilioWebhookError(400,'invalid_employee_alert_status');
 if(job.account_sid!==params.AccountSid||(job.provider_sid&&job.provider_sid!==sid))throw new TwilioWebhookError(403,'employee_alert_identity_mismatch');
 const identity=params.From&&params.To?{from:params.From,to:params.To,accountSid:params.AccountSid}:await fetchSms(sid);
 if(identity.from!==job.sender_phone||identity.to!==job.recipient||identity.accountSid!==job.account_sid)throw new TwilioWebhookError(403,'employee_alert_identity_mismatch');
 if(params.ErrorCode==='21610')await suppressEmployeeSms(job.recipient);
 if(challenge){await db.query("UPDATE assistant_phone_challenges SET provider_sid=$2,status=$3 WHERE id=$1 AND status IN ('sending','unknown','accepted') AND (provider_sid IS NULL OR provider_sid=$2)",[id,sid,['failed','undelivered'].includes(status)?'failed':'accepted']);return true;}
 const rank=['failed','undelivered','delivered'].includes(status)?50:10;
 await db.query("UPDATE assistant_notification_deliveries SET provider_sid=$2,status=$3,status_rank=$4,error_code=$5,updated_at=now() WHERE id=$1 AND status_rank<$4 AND status<>'suppressed' AND (provider_sid IS NULL OR provider_sid=$2)",[id,sid,status==='delivered'?'delivered':['failed','undelivered'].includes(status)?'failed':'accepted',rank,params.ErrorCode??null]);return true;
}

/** Staff alert replies never become prospects, customer messages or approval instructions. */
export async function receiveEmployeeAlertReply(params:Record<string,string>){
 const config=getTwilioConfiguration(),sid=params.MessageSid||params.SmsSid||'';
 if(params.AccountSid!==config.accountSid||params.To!==config.phoneNumber||!TWILIO_MESSAGE_SID.test(sid))return false;
 const preference=params.OptOutType?.toUpperCase()==='STOP'||['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT'].includes((params.Body??'').trim().toUpperCase())?'stop':params.OptOutType?.toUpperCase()==='START'||['START','UNSTOP'].includes((params.Body??'').trim().toUpperCase())?'start':'none';
 const db=await getDatabasePool().connect();
 try{
  await db.query('BEGIN');
  const existing=(await db.query('SELECT * FROM assistant_staff_sms_receipts WHERE provider_sid=$1',[sid])).rows[0];
  if(existing){if(existing.sender_phone!==params.From||existing.recipient_phone!==params.To||existing.account_sid!==params.AccountSid||existing.preference!==preference)throw new TwilioWebhookError(403,'staff_reply_identity_mismatch');await db.query('COMMIT');return true;}
  const rows=(await db.query('SELECT workspace_id,user_id FROM assistant_notification_preferences WHERE phone=$1 AND verified_at IS NOT NULL FOR UPDATE',[params.From])).rows;
  if(!rows.length){await db.query('COMMIT');return false;}
  const inserted=await db.query('INSERT INTO assistant_staff_sms_receipts(provider_sid,sender_phone,recipient_phone,account_sid,preference) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING provider_sid',[sid,params.From,params.To,params.AccountSid,preference]);
  if(!inserted.rowCount){await db.query('COMMIT');return true;}
  if(preference!=='none')for(const r of rows){
   await db.query(`INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status,evidence) VALUES($1,'sms',$2,$3,'Verified staff SMS preference') ON CONFLICT(workspace_id,channel,normalized_address) DO UPDATE SET status=EXCLUDED.status,evidence=EXCLUDED.evidence,actor_user_id=NULL,updated_at=now()`,[r.workspace_id,params.From,preference==='stop'?'blocked':'allowed']);
   if(preference==='stop')await db.query('UPDATE assistant_notification_preferences SET sms_enabled=false,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND user_id=$2',[r.workspace_id,r.user_id]);
  }
  await db.query('COMMIT');return true;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
