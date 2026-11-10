import 'server-only';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '@/lib/dashboard/db';
import {getTwilioConfiguration} from '@/lib/twilio/config';
import {createSms,TwilioProviderError} from '@/lib/twilio/provider';
import {suppressEmployeeSms} from './employee-notifications';
import {principal} from './oauth';

export async function runEmployeeNotificationWorker(limit=3){
 const config=getTwilioConfiguration();if(!config.enabled||process.env.ASSISTANT_NOTIFICATIONS_ENABLED==='false')return {checked:0,failed:0,more:false};
 const pool=getDatabasePool();let checked=0,failed=0;
 await pool.query("UPDATE assistant_notification_deliveries SET status='unknown',updated_at=now() WHERE status='sending' AND created_at<now()-interval '2 minutes'");
 await pool.query("UPDATE assistant_employee_notifications n SET resolved_at=now() WHERE n.resolved_at IS NULL AND n.source_type='action' AND NOT EXISTS(SELECT 1 FROM assistant_actions a JOIN assistant_grants g ON g.id=a.grant_id WHERE a.id=n.source_id AND a.status='awaiting_approval' AND a.expires_at>now() AND g.revoked_at IS NULL AND g.expires_at>now())");
 for(let i=0;i<Math.min(limit,10);i++){
  const db=await pool.connect();let job:{id:string;phone:string;workspace_id:string;user_id:string;grant_id:string|null;revision:number}|undefined;const attempt=randomUUID();
  try{
   await db.query('BEGIN');
   // The short global claim lock makes workspace and employee caps exact under concurrent workers.
   await db.query('SELECT pg_advisory_xact_lock(8129130053)');
   job=(await db.query(`SELECT n.id,p.phone,n.workspace_id,n.user_id,n.grant_id,p.revision FROM assistant_employee_notifications n
    JOIN assistant_notification_preferences p ON p.workspace_id=n.workspace_id AND p.user_id=n.user_id AND p.sms_enabled AND p.verified_at IS NOT NULL
    JOIN workspace_memberships m ON m.workspace_id=n.workspace_id AND m.user_id=n.user_id AND m.status='active'
    JOIN workspaces w ON w.id=n.workspace_id AND w.status='active'
    WHERE n.expires_at>now() AND n.created_at>p.verified_at AND n.read_at IS NULL AND n.resolved_at IS NULL
    AND (n.category<>'review' OR n.created_at<now()-interval '30 seconds')
    AND (n.category<>'completed' OR p.completions) AND p.phone<>$1
    AND (p.quiet_start=p.quiet_end OR NOT(CASE WHEN p.quiet_start<p.quiet_end THEN (now() AT TIME ZONE p.timezone)::time>=p.quiet_start AND (now() AT TIME ZONE p.timezone)::time<p.quiet_end ELSE (now() AT TIME ZONE p.timezone)::time>=p.quiet_start OR (now() AT TIME ZONE p.timezone)::time<p.quiet_end END))
    AND NOT EXISTS(SELECT 1 FROM crm_channel_preferences c WHERE c.workspace_id=n.workspace_id AND c.channel='sms' AND c.normalized_address=p.phone AND c.status='blocked')
    AND NOT EXISTS(SELECT 1 FROM assistant_notification_deliveries d WHERE d.notification_id=n.id)
    AND NOT EXISTS(SELECT 1 FROM assistant_notification_deliveries d JOIN assistant_employee_notifications prior ON prior.id=d.notification_id WHERE prior.workspace_id=n.workspace_id AND prior.user_id=n.user_id AND d.created_at>now()-interval '5 minutes' AND d.status<>'suppressed')
    AND (SELECT count(*) FROM assistant_notification_deliveries d JOIN assistant_employee_notifications prior ON prior.id=d.notification_id WHERE prior.workspace_id=n.workspace_id AND d.channel='sms' AND d.created_at>now()-interval '24 hours' AND d.status<>'suppressed')<50
    AND (SELECT count(*) FROM assistant_notification_deliveries d JOIN assistant_employee_notifications prior ON prior.id=d.notification_id WHERE prior.workspace_id=n.workspace_id AND prior.user_id=n.user_id AND d.channel='sms' AND d.created_at>now()-interval '24 hours' AND d.status<>'suppressed')<10
    ORDER BY CASE n.category WHEN 'review' THEN 0 WHEN 'failed' THEN 1 ELSE 2 END,n.created_at LIMIT 1 FOR UPDATE OF n,p SKIP LOCKED`,[config.phoneNumber])).rows[0];
   if(job)await db.query("INSERT INTO assistant_notification_deliveries(id,notification_id,channel,status,recipient,account_sid,sender_phone) VALUES($1,$2,'sms','sending',$3,$4,$5)",[attempt,job.id,job.phone,config.accountSid,config.phoneNumber]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  if(!job)break;
  // Recheck preferences, membership, resolution and opt-out after claiming, immediately before sending.
  let allowed=!!(await pool.query(`SELECT 1 FROM assistant_notification_preferences p JOIN workspace_memberships m ON m.workspace_id=p.workspace_id AND m.user_id=p.user_id AND m.status='active' JOIN workspaces w ON w.id=p.workspace_id AND w.status='active' JOIN assistant_employee_notifications n ON n.id=$4 AND n.workspace_id=p.workspace_id AND n.user_id=p.user_id WHERE p.workspace_id=$1 AND p.user_id=$2 AND p.phone=$3 AND p.sms_enabled AND p.revision=$5 AND n.read_at IS NULL AND n.resolved_at IS NULL AND n.expires_at>now() AND NOT EXISTS(SELECT 1 FROM crm_channel_preferences c WHERE c.workspace_id=p.workspace_id AND c.channel='sms' AND c.normalized_address=p.phone AND c.status='blocked')`,[job.workspace_id,job.user_id,job.phone,job.id,job.revision])).rowCount;
  if(allowed&&job.grant_id){try{const p=await principal((await pool.query('SELECT * FROM assistant_grants WHERE id=$1',[job.grant_id])).rows[0]);allowed=p.context.user.id===job.user_id&&p.context.workspace.id===job.workspace_id;}catch{allowed=false;}}
  if(!allowed){await pool.query("UPDATE assistant_notification_deliveries SET status='suppressed',updated_at=now() WHERE id=$1",[attempt]);continue;}
  checked++;
  try{
   // One generic alert opens the durable feed, which groups additional outstanding work.
   const r=await createSms({from:config.phoneNumber,to:job.phone,text:`Your Tailored Agents assistant has an update: ${config.baseUrl}/dashboard/assistant#my-work Reply STOP to opt out.`,attemptId:attempt});
   if(r.accountSid!==config.accountSid||r.from!==config.phoneNumber||r.to!==job.phone)throw Error('provider_identity_mismatch');
   const terminal=['failed','undelivered','delivered'].includes(r.status);
   await pool.query("UPDATE assistant_notification_deliveries SET provider_sid=$2,status=$3,status_rank=$4,updated_at=now() WHERE id=$1 AND status_rank<$4 AND status IN ('sending','unknown','accepted') AND (provider_sid IS NULL OR provider_sid=$2)",[attempt,r.sid,r.status==='delivered'?'delivered':['failed','undelivered'].includes(r.status)?'failed':'accepted',terminal?50:10]);
   // A definitive rejection must not suppress other outstanding notifications.
   if(['failed','undelivered'].includes(r.status))continue;
   // Coalesce notifications already represented in this feed alert; later events remain eligible.
   await pool.query(`INSERT INTO assistant_notification_deliveries(id,notification_id,channel,status,recipient,error_code) SELECT gen_random_uuid(),n.id,'sms','suppressed',$3,'included_in_feed_alert' FROM assistant_employee_notifications n JOIN assistant_notification_preferences p ON p.workspace_id=n.workspace_id AND p.user_id=n.user_id WHERE n.workspace_id=$1 AND n.user_id=$2 AND n.id<>$4 AND n.created_at<=(SELECT created_at FROM assistant_notification_deliveries WHERE id=$5) AND n.read_at IS NULL AND n.resolved_at IS NULL AND (n.category<>'completed' OR p.completions) ON CONFLICT DO NOTHING`,[job.workspace_id,job.user_id,job.phone,job.id,attempt]);
  }catch(e){failed++;if(e instanceof TwilioProviderError&&e.providerCode===21610)await suppressEmployeeSms(job.phone);await pool.query("UPDATE assistant_notification_deliveries SET status=$2,error_code=$3,updated_at=now() WHERE id=$1 AND status='sending'",[attempt,e instanceof TwilioProviderError&&e.outcome==='rejected'?'failed':'unknown',e instanceof TwilioProviderError?e.providerCode?.toString()??'provider_rejected':'check_provider_status']);}
 }
 return {checked,failed,more:checked===Math.min(limit,10)};
}
