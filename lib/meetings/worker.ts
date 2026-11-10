import 'server-only';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '@/lib/dashboard/db';
import {factoryStorage} from '@/lib/factory/storage';
import type {DashboardContext} from '@/lib/dashboard/data';
import {finishUpload,audioPrefix} from './service';
import {transcribeMeeting,analyzeMeeting} from './provider';
import type {MeetingRecord} from './contract';

// Reservations are deliberately conservative, not an invoice. No uncertain
// charge is released or silently retried. Separate from assistant/build budgets.
export const MEETING_TRANSCRIBE_RESERVE=300_000,MEETING_ANALYZE_RESERVE=250_000;
async function maintenance(){
 const db=getDatabasePool();
 await db.query(`DELETE FROM crm_discovery_notes n WHERE EXISTS(SELECT 1 FROM leads l WHERE l.id=n.lead_id AND l.anonymized_at IS NOT NULL) OR EXISTS(SELECT 1 FROM crm_businesses b WHERE b.id=n.business_id AND b.anonymized_at IS NOT NULL)`);
 await db.query(`DELETE FROM crm_introductions n WHERE EXISTS(SELECT 1 FROM leads l WHERE l.id=n.lead_id AND l.anonymized_at IS NOT NULL) OR EXISTS(SELECT 1 FROM crm_businesses b WHERE b.id=n.business_id AND b.anonymized_at IS NOT NULL)`);
 await db.query(`UPDATE meetings SET status='deleting',title='Expired meeting',transcript=NULL,findings=NULL,review_notes='',consent_note='',lease_token=NULL,lease_until=NULL,deleted_at=now() WHERE status NOT IN ('deleting','deleted') AND (expires_at<=now() OR (status='uploading' AND updated_at<now()-interval '24 hours'))`);
 await db.query("UPDATE meetings SET status='failed',error_code='processing_interrupted',lease_token=NULL,lease_until=NULL WHERE status IN ('transcribing','analyzing') AND lease_until<now()");
 const expired=(await db.query("SELECT id,workspace_id FROM meetings WHERE status='deleting' AND (lease_until IS NULL OR lease_until<now()) ORDER BY updated_at LIMIT 1")).rows[0];
 if(expired){const lease=randomUUID();const claim=await db.query("UPDATE meetings SET lease_token=$2,lease_until=now()+interval '2 minutes' WHERE id=$1 AND status='deleting' AND (lease_until IS NULL OR lease_until<now()) RETURNING id",[expired.id,lease]);if(claim.rowCount){await db.query('DELETE FROM meeting_upload_chunks WHERE meeting_id=$1',[expired.id]);await factoryStorage().deletePrefix(audioPrefix(expired.workspace_id,expired.id));await db.query("UPDATE meetings SET status='deleted',audio_key=NULL,audio_hash=NULL,received_bytes=0,expected_bytes=0,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",[expired.id,lease]);return true;}}
 return false;
}
async function finishCapture(){
 const r=(await getDatabasePool().query(`SELECT m.*,u.name,u.email,w.name workspace_name,w.slug,wm.role,d.auto_process FROM meetings m JOIN "user" u ON u.id=m.owner_user_id JOIN workspaces w ON w.id=m.workspace_id JOIN workspace_memberships wm ON wm.user_id=m.owner_user_id AND wm.workspace_id=m.workspace_id JOIN meeting_devices d ON d.id=m.device_id WHERE m.status='capturing' AND m.expires_at>now() AND (m.updated_at<now()-interval '3 minutes' OR m.received_bytes>=19200000) AND wm.status='active' AND wm.role<>'viewer' AND w.status='active' ORDER BY m.created_at LIMIT 1`)).rows[0];
 if(!r)return false;
 const c:DashboardContext={user:{id:r.owner_user_id,name:r.name,email:r.email},workspace:{id:r.workspace_id,name:r.workspace_name,slug:r.slug},role:r.role};
 await finishUpload(c,r.id);
 if(r.auto_process&&process.env.MEETING_PROCESSING_ENABLED!=='false'&&process.env.OPENAI_API_KEY)await getDatabasePool().query("UPDATE meetings SET status='queued' WHERE id=$1 AND status='ready' AND consent_at IS NOT NULL",[r.id]);
 return true;
}
export async function reserveMeetingStep(id?:string){
 const db=await getDatabasePool().connect();
 try{
 await db.query('BEGIN');
 const m=(await db.query<MeetingRecord>(`SELECT m.* FROM meetings m JOIN workspace_memberships wm ON wm.workspace_id=m.workspace_id AND wm.user_id=m.owner_user_id JOIN workspaces w ON w.id=m.workspace_id WHERE m.status='queued' AND m.consent_at IS NOT NULL AND m.audio_key IS NOT NULL AND m.expires_at>now() AND wm.status='active' AND wm.role<>'viewer' AND w.status='active' AND ($1::uuid IS NULL OR m.id=$1) ORDER BY m.updated_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED`,[id??null])).rows[0];
 if(!m){await db.query('COMMIT');return null;}
 const stage=m.transcript?'analyze':'transcribe',amount=stage==='transcribe'?MEETING_TRANSCRIBE_RESERVE:MEETING_ANALYZE_RESERVE;
 await db.query('INSERT INTO meeting_settings(workspace_id) VALUES($1) ON CONFLICT DO NOTHING',[m.workspace_id]);
 const settings=(await db.query('SELECT monthly_limit_micros FROM meeting_settings WHERE workspace_id=$1 FOR UPDATE',[m.workspace_id])).rows[0];
 const month=(await db.query("SELECT date_trunc('month',now() AT TIME ZONE 'America/New_York')::date::text AS period")).rows[0].period;
 await db.query('INSERT INTO meeting_usage(workspace_id,month) VALUES($1,$2) ON CONFLICT DO NOTHING',[m.workspace_id,month]);
 const usage=(await db.query('SELECT reserved_micros FROM meeting_usage WHERE workspace_id=$1 AND month=$2 FOR UPDATE',[m.workspace_id,month])).rows[0];
 if(Number(usage.reserved_micros)+amount>Number(settings.monthly_limit_micros)){await db.query("UPDATE meetings SET status='failed',error_code='allowance' WHERE id=$1",[m.id]);await db.query('COMMIT');return null;}
 const attempt=Number((await db.query('SELECT COALESCE(max(attempt),0)+1 attempt FROM meeting_requests WHERE meeting_id=$1 AND stage=$2',[m.id,stage])).rows[0].attempt);
 // A malicious client cannot turn a stuck request into an unbounded automatic loop.
 if(attempt>3){await db.query("UPDATE meetings SET status='failed',error_code='attempt_limit' WHERE id=$1",[m.id]);await db.query('COMMIT');return null;}
 const requestId=randomUUID(),lease=randomUUID();await db.query('UPDATE meeting_usage SET reserved_micros=reserved_micros+$3 WHERE workspace_id=$1 AND month=$2',[m.workspace_id,month,amount]);
 await db.query('INSERT INTO meeting_requests(id,meeting_id,workspace_id,stage,attempt,reserved_micros,month) VALUES($1,$2,$3,$4,$5,$6,$7)',[requestId,m.id,m.workspace_id,stage,attempt,amount,month]);
 await db.query("UPDATE meetings SET status=$2,lease_token=$3,lease_until=now()+interval '5 minutes',updated_at=now(),error_code=NULL WHERE id=$1",[m.id,stage==='transcribe'?'transcribing':'analyzing',lease]);
 await db.query('COMMIT');return {meeting:m,stage,requestId,lease};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function runMeetingWorker(id?:string){
 if(!id){if(await maintenance())return {checked:1,failed:0,more:true};if(await finishCapture())return {checked:1,failed:0,more:true};}
 if(!process.env.OPENAI_API_KEY||process.env.MEETING_PROCESSING_ENABLED==='false')return {checked:0,failed:0,more:false};
 const job=await reserveMeetingStep(id);if(!job)return {checked:0,failed:0,more:false};
 const db=getDatabasePool();try{
 let transcript=job.meeting.transcript;let findings=null;
 const active=async()=>{return Boolean((await db.query(`SELECT 1 FROM meetings m JOIN workspace_memberships wm ON wm.workspace_id=m.workspace_id AND wm.user_id=m.owner_user_id JOIN workspaces w ON w.id=m.workspace_id WHERE m.id=$1 AND m.lease_token=$2 AND m.status IN ('transcribing','analyzing') AND m.expires_at>now() AND wm.status='active' AND wm.role<>'viewer' AND w.status='active'`,[job.meeting.id,job.lease])).rowCount);}
 if(job.stage==='transcribe'){const audio=await factoryStorage().get(job.meeting.audio_key!,24_000_000);if(!await active())throw new Error('processing_interrupted');transcript=await transcribeMeeting(audio,job.meeting.audio_type!);}
 else {if(!await active())throw new Error('processing_interrupted');findings=await analyzeMeeting(transcript!);}
 // A deletion, revoked membership, expiration or a superseding lease wins.
 await db.query(`UPDATE meetings m SET transcript=$3,findings=COALESCE($4::jsonb,findings),status=$5,lease_token=NULL,lease_until=NULL,updated_at=now(),revision=revision+1 WHERE m.id=$1 AND m.lease_token=$2 AND m.status IN ('transcribing','analyzing') AND m.expires_at>now() AND EXISTS(SELECT 1 FROM workspace_memberships wm JOIN workspaces w ON w.id=wm.workspace_id WHERE wm.workspace_id=m.workspace_id AND wm.user_id=m.owner_user_id AND wm.status='active' AND wm.role<>'viewer' AND w.status='active')`,[job.meeting.id,job.lease,transcript,findings?JSON.stringify(findings):null,job.stage==='transcribe'?'queued':'review']);
 await db.query("UPDATE meeting_requests SET state='completed' WHERE id=$1",[job.requestId]);return {checked:1,failed:0,more:true};
 }catch(e){const code=e instanceof Error&&['empty_audio','invalid_analysis'].includes(e.message)?e.message:'provider_unavailable';await db.query("UPDATE meeting_requests SET state='unknown' WHERE id=$1",[job.requestId]);await db.query("UPDATE meetings SET status='failed',error_code=$3,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status IN ('transcribing','analyzing')",[job.meeting.id,job.lease,code]);return {checked:1,failed:1,more:false};}
}
