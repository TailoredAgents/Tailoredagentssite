import 'server-only';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '@/lib/dashboard/db';
import {decryptCredential} from '@/lib/search-console/crypto';
import {apnsConfiguration,sendPush,type PushEnvironment,type PushResult} from './apns';
import {pushKey} from './push-devices';
import {principal} from './oauth';
export async function runPushNotificationWorker(limit=3){
 const config=apnsConfiguration();if(!config.ready||process.env.ASSISTANT_NOTIFICATIONS_ENABLED==='false')return {checked:0,failed:0,more:false};
 const pool=getDatabasePool();let checked=0,failed=0;
 await pool.query("UPDATE assistant_notification_deliveries SET status='unknown',updated_at=now() WHERE channel='push' AND status='sending' AND created_at<now()-interval '2 minutes'");
 for(let i=0;i<Math.min(limit,10);i++){
  const db=await pool.connect(),attempt=randomUUID();let job:{id:string;device_id:string;user_id:string;workspace_id:string;grant_id:string|null;preference_revision:number;token_encrypted:string;environment:PushEnvironment;expires_at:Date}|undefined;
  try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(8129130053)');
   job=(await db.query(`SELECT n.id,n.user_id,n.workspace_id,n.grant_id,n.expires_at,p.revision preference_revision,d.id device_id,d.token_encrypted,d.environment FROM assistant_employee_notifications n
    JOIN assistant_notification_preferences p ON p.workspace_id=n.workspace_id AND p.user_id=n.user_id AND p.push_enabled
    JOIN workspace_memberships m ON m.workspace_id=n.workspace_id AND m.user_id=n.user_id AND m.status='active' JOIN workspaces w ON w.id=n.workspace_id AND w.status='active'
    JOIN LATERAL(SELECT * FROM assistant_push_devices device WHERE device.workspace_id=n.workspace_id AND device.user_id=n.user_id AND device.enabled AND device.revoked_at IS NULL AND device.verified_at IS NOT NULL AND device.permission IN ('authorized','provisional') AND device.environment=$1 ORDER BY device.last_seen_at DESC LIMIT 1)d ON true
    WHERE n.created_at>d.verified_at AND n.expires_at>now() AND n.read_at IS NULL AND n.resolved_at IS NULL AND (n.category<>'completed' OR p.completions)
    AND (n.category<>'review' OR (n.created_at<now()-interval '30 seconds' AND EXISTS(SELECT 1 FROM assistant_actions a WHERE a.id=n.source_id AND a.status='awaiting_approval' AND a.expires_at>now())))
    AND (p.quiet_start=p.quiet_end OR NOT(CASE WHEN p.quiet_start<p.quiet_end THEN (now() AT TIME ZONE p.timezone)::time>=p.quiet_start AND (now() AT TIME ZONE p.timezone)::time<p.quiet_end ELSE (now() AT TIME ZONE p.timezone)::time>=p.quiet_start OR (now() AT TIME ZONE p.timezone)::time<p.quiet_end END))
    AND NOT EXISTS(SELECT 1 FROM assistant_notification_deliveries prior WHERE prior.notification_id=n.id)
    AND NOT EXISTS(SELECT 1 FROM assistant_notification_deliveries a JOIN assistant_employee_notifications b ON b.id=a.notification_id WHERE b.workspace_id=n.workspace_id AND b.user_id=n.user_id AND a.created_at>now()-interval '5 minutes' AND a.status NOT IN ('suppressed','failed'))
    AND (SELECT count(*) FROM assistant_notification_deliveries a JOIN assistant_employee_notifications b ON b.id=a.notification_id WHERE b.workspace_id=n.workspace_id AND b.user_id=n.user_id AND a.channel='push' AND a.created_at>now()-interval '24 hours' AND a.status<>'suppressed')<10
    AND (SELECT count(*) FROM assistant_notification_deliveries a JOIN assistant_employee_notifications b ON b.id=a.notification_id WHERE b.workspace_id=n.workspace_id AND a.channel='push' AND a.created_at>now()-interval '24 hours' AND a.status<>'suppressed')<50
    ORDER BY CASE n.category WHEN 'review' THEN 0 WHEN 'failed' THEN 1 ELSE 2 END,n.created_at LIMIT 1 FOR UPDATE OF n,p SKIP LOCKED`,[config.environment])).rows[0];
   if(job)await db.query("INSERT INTO assistant_notification_deliveries(id,notification_id,device_id,channel,status,recipient) VALUES($1,$2,$3::uuid,'push','sending',$3::text)",[attempt,job.id,job.device_id]);await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  if(!job)break;
  let allowed=!!(await pool.query(`SELECT 1 FROM assistant_push_devices d JOIN assistant_notification_preferences p ON p.workspace_id=d.workspace_id AND p.user_id=d.user_id AND p.push_enabled JOIN workspace_memberships m ON m.workspace_id=d.workspace_id AND m.user_id=d.user_id AND m.status='active' JOIN workspaces w ON w.id=d.workspace_id AND w.status='active' JOIN assistant_employee_notifications n ON n.id=$2 AND n.workspace_id=d.workspace_id AND n.user_id=d.user_id WHERE d.id=$1 AND d.token_encrypted=$3 AND p.revision=$4 AND d.enabled AND d.verified_at IS NOT NULL AND d.revoked_at IS NULL AND d.permission IN ('authorized','provisional') AND n.read_at IS NULL AND n.resolved_at IS NULL AND n.expires_at>now()`,[job.device_id,job.id,job.token_encrypted,job.preference_revision])).rowCount;
  if(allowed&&job.grant_id){try{const p=await principal((await pool.query('SELECT * FROM assistant_grants WHERE id=$1',[job.grant_id])).rows[0]);allowed=p.context.user.id===job.user_id&&p.context.workspace.id===job.workspace_id;}catch{allowed=false;}}
  if(!allowed){await pool.query("UPDATE assistant_notification_deliveries SET status='suppressed',updated_at=now() WHERE id=$1",[attempt]);continue;}
  checked++;let result:PushResult;
  let token:string|undefined;try{token=decryptCredential(job.token_encrypted,pushKey());}catch{result={status:'failed',reason:'device_unavailable',invalidDevice:true};}
  if(token){try{result=await sendPush({token,environment:job.environment,id:attempt,expiresAt:job.expires_at,collapseId:'assistant-work',payload:{aps:{alert:{title:'Tailored Agents',body:'Your assistant has an update. Open your private work list.'},sound:'default'},ta_notification:job.id,ta_device:job.device_id}});}catch{result={status:'unknown',reason:'push_outcome_unknown'};}}
  const r=result!;if(r.status!=='accepted')failed++;
  await pool.query("UPDATE assistant_notification_deliveries SET status=$2,provider_sid=$3,error_code=$4,updated_at=now() WHERE id=$1 AND status IN ('sending','unknown')",[attempt,r.status,r.status==='accepted'?attempt:null,r.reason??null]);
  if(r.invalidDevice)await pool.query("UPDATE assistant_push_devices SET enabled=false,verified_at=NULL,revoked_at=now() WHERE id=$1 AND token_encrypted=$2",[job.device_id,job.token_encrypted]);
  if(r.status==='accepted')await pool.query(`INSERT INTO assistant_notification_deliveries(id,notification_id,device_id,channel,status,recipient,error_code) SELECT gen_random_uuid(),n.id,$3::uuid,'push','suppressed',$3::text,'included_in_feed_alert' FROM assistant_employee_notifications n JOIN assistant_notification_preferences p ON p.workspace_id=n.workspace_id AND p.user_id=n.user_id WHERE n.workspace_id=$1 AND n.user_id=$2 AND n.id<>$4 AND n.created_at<=(SELECT created_at FROM assistant_notification_deliveries WHERE id=$5) AND n.read_at IS NULL AND n.resolved_at IS NULL AND (n.category<>'completed' OR p.completions) ON CONFLICT DO NOTHING`,[job.workspace_id,job.user_id,job.device_id,job.id,attempt]);
 }
 return {checked,failed,more:checked===Math.min(limit,10)};
}
