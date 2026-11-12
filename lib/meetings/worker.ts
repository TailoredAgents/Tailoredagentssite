import 'server-only';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '@/lib/dashboard/db';
import {factoryStorage} from '@/lib/factory/storage';
import type {DashboardContext} from '@/lib/dashboard/data';
import {finishRecording,settleMeeting,audioPrefix} from './service';
import {MEETING_ANALYZE_RESERVE,transcriptionReserve,combineTranscripts,MAX_COMBINED_TRANSCRIPT_BYTES} from './grouping';
import {transcribeMeeting,analyzeMeeting} from './provider';
import type {MeetingRecord} from './contract';
import {closeIdleOmiMeetings} from './omi-sessions';

// Reservations are deliberately conservative, not an invoice. No uncertain
// charge is released or silently retried. Separate from assistant/build budgets.
export {MEETING_ANALYZE_RESERVE} from './grouping';
async function maintenance(){
 const db=getDatabasePool();
 await db.query(`DELETE FROM crm_discovery_notes n WHERE EXISTS(SELECT 1 FROM leads l WHERE l.id=n.lead_id AND l.anonymized_at IS NOT NULL) OR EXISTS(SELECT 1 FROM crm_businesses b WHERE b.id=n.business_id AND b.anonymized_at IS NOT NULL)`);
 await db.query(`DELETE FROM crm_introductions n WHERE EXISTS(SELECT 1 FROM leads l WHERE l.id=n.lead_id AND l.anonymized_at IS NOT NULL) OR EXISTS(SELECT 1 FROM crm_businesses b WHERE b.id=n.business_id AND b.anonymized_at IS NOT NULL)`);
 await db.query(`UPDATE meetings SET status='deleting',title='Expired meeting',transcript=NULL,part_transcript=NULL,findings=NULL,review_notes='',consent_note='',lease_token=NULL,lease_until=NULL,deleted_at=now() WHERE status NOT IN ('deleting','deleted') AND (expires_at<=now() OR (status='uploading' AND updated_at<now()-interval '24 hours') OR parent_meeting_id IN (SELECT id FROM meetings WHERE status IN ('deleting','deleted') OR expires_at<=now()))`);
 await db.query("UPDATE meetings SET status='failed',error_code='processing_interrupted',lease_token=NULL,lease_until=NULL WHERE status IN ('transcribing','analyzing') AND lease_until<now()");
 const expired=(await db.query("SELECT id,workspace_id FROM meetings WHERE status='deleting' AND (lease_until IS NULL OR lease_until<now()) ORDER BY updated_at LIMIT 1")).rows[0];
 if(expired){const lease=randomUUID();const claim=await db.query("UPDATE meetings SET lease_token=$2,lease_until=now()+interval '2 minutes' WHERE id=$1 AND status='deleting' AND (lease_until IS NULL OR lease_until<now()) RETURNING id",[expired.id,lease]);if(claim.rowCount){await db.query('DELETE FROM meeting_upload_chunks WHERE meeting_id=$1',[expired.id]);await factoryStorage().deletePrefix(audioPrefix(expired.workspace_id,expired.id));await db.query("UPDATE meetings SET status='deleted',audio_key=NULL,audio_hash=NULL,received_bytes=0,expected_bytes=0,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",[expired.id,lease]);return true;}}
 return false;
}
async function finishCapture(){
 // End an idle session without closing the owner's always-ready connection.
 // Serialize with audio intake, then recheck the deadline under the same lock.
 const idle=(await getDatabasePool().query("SELECT workspace_id FROM meeting_devices WHERE always_ready AND revoked_at IS NULL AND current_meeting_id IS NOT NULL AND last_received_at<now()-interval '3 minutes' LIMIT 1")).rows[0];
 if(idle){const db=await getDatabasePool().connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`meetings:${idle.workspace_id}`]);await closeIdleOmiMeetings(db,idle.workspace_id);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 const r=(await getDatabasePool().query(`SELECT m.*,u.name,u.email,w.name workspace_name,w.slug,wm.role FROM meetings m JOIN "user" u ON u.id=m.owner_user_id JOIN workspaces w ON w.id=m.workspace_id JOIN workspace_memberships wm ON wm.user_id=m.owner_user_id AND wm.workspace_id=m.workspace_id JOIN meeting_devices d ON d.id=m.device_id WHERE m.status='capturing' AND m.audio_key IS NULL AND m.expires_at>now() AND (m.part_closed_at IS NOT NULL OR COALESCE(m.last_audio_at,m.updated_at)<now()-interval '3 minutes' OR (NOT d.always_ready AND (d.armed_until IS NULL OR d.armed_until<=now())) OR d.revoked_at IS NOT NULL OR d.current_meeting_id IS DISTINCT FROM COALESCE(m.parent_meeting_id,m.id)) AND wm.status='active' AND wm.role<>'viewer' AND w.status='active' ORDER BY m.created_at,m.part_order LIMIT 1`)).rows[0];
 if(r){const c:DashboardContext={user:{id:r.owner_user_id,name:r.name,email:r.email},workspace:{id:r.workspace_id,name:r.workspace_name,slug:r.slug},role:r.role};await finishRecording(c,r.parent_meeting_id||r.id,r.id);await settleMeeting(c,r.parent_meeting_id||r.id);return true;}
 // A window can end after its last part has already been saved.
 const ready=(await getDatabasePool().query(`SELECT m.*,u.name,u.email,w.name workspace_name,w.slug,wm.role FROM meetings m JOIN "user" u ON u.id=m.owner_user_id JOIN workspaces w ON w.id=m.workspace_id JOIN workspace_memberships wm ON wm.user_id=m.owner_user_id AND wm.workspace_id=m.workspace_id WHERE m.parent_meeting_id IS NULL AND m.status='capturing' AND m.expires_at>now() AND wm.status='active' AND wm.role<>'viewer' AND w.status='active' AND NOT EXISTS(SELECT 1 FROM meeting_devices d WHERE d.current_meeting_id=m.id AND (d.always_ready OR d.armed_until>now()) AND d.revoked_at IS NULL) AND NOT EXISTS(SELECT 1 FROM meetings p WHERE (p.id=m.id OR p.parent_meeting_id=m.id) AND p.audio_key IS NULL) ORDER BY m.updated_at LIMIT 1`)).rows[0];
 if(ready){await settleMeeting({user:{id:ready.owner_user_id,name:ready.name,email:ready.email},workspace:{id:ready.workspace_id,name:ready.workspace_name,slug:ready.slug},role:ready.role},ready.id);return true;}
 return false;
}
export async function reserveMeetingStep(id?:string){
 const db=await getDatabasePool().connect();
 try{
 await db.query('BEGIN');
 const m=(await db.query<MeetingRecord>(`SELECT m.* FROM meetings m JOIN workspace_memberships wm ON wm.workspace_id=m.workspace_id AND wm.user_id=m.owner_user_id JOIN workspaces w ON w.id=m.workspace_id WHERE m.parent_meeting_id IS NULL AND m.status='queued' AND m.consent_at IS NOT NULL AND m.audio_key IS NOT NULL AND m.expires_at>now() AND wm.status='active' AND wm.role<>'viewer' AND w.status='active' AND ($1::uuid IS NULL OR m.id=$1) ORDER BY m.updated_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED`,[id??null])).rows[0];
 if(!m){await db.query('COMMIT');return null;}
 const parts=(await db.query(`SELECT * FROM meetings WHERE id=$1 OR parent_meeting_id=$1 ORDER BY part_order,id FOR UPDATE`,[m.id])).rows;
 // Preserve a transcript completed by the old worker during a rolling deploy.
 if(parts.length===1&&!parts[0].part_transcript&&m.transcript){parts[0].part_transcript=m.transcript;await db.query('UPDATE meetings SET part_transcript=transcript WHERE id=$1',[m.id]);}
 if(parts.some(p=>!p.audio_key)||!!(await db.query('SELECT 1 FROM meeting_devices WHERE current_meeting_id=$1 AND (always_ready OR armed_until>now()) AND revoked_at IS NULL',[m.id])).rowCount){await db.query('COMMIT');return null;}
 const recording=parts.find(p=>!p.part_transcript),stage=recording?'transcribe':'analyze';
 const transcript=combineTranscripts(parts);
 if(stage==='analyze'&&Buffer.byteLength(transcript)>MAX_COMBINED_TRANSCRIPT_BYTES){await db.query("UPDATE meetings SET status='failed',error_code='transcript_too_long',transcript=$2 WHERE id=$1",[m.id,transcript]);await db.query('COMMIT');return null;}
 const amount=recording?transcriptionReserve(recording.duration_seconds):MEETING_ANALYZE_RESERVE;
 const requestMeetingId=recording?.id??m.id,version=recording?1:m.content_version;
 await db.query('INSERT INTO meeting_settings(workspace_id) VALUES($1) ON CONFLICT DO NOTHING',[m.workspace_id]);
 const settings=(await db.query('SELECT monthly_limit_micros FROM meeting_settings WHERE workspace_id=$1 FOR UPDATE',[m.workspace_id])).rows[0];
 const month=(await db.query("SELECT date_trunc('month',now() AT TIME ZONE 'America/New_York')::date::text AS period")).rows[0].period;
 await db.query('INSERT INTO meeting_usage(workspace_id,month) VALUES($1,$2) ON CONFLICT DO NOTHING',[m.workspace_id,month]);
 const usage=(await db.query('SELECT reserved_micros FROM meeting_usage WHERE workspace_id=$1 AND month=$2 FOR UPDATE',[m.workspace_id,month])).rows[0];
 if(Number(usage.reserved_micros)+amount>Number(settings.monthly_limit_micros)){await db.query("UPDATE meetings SET status='failed',error_code='allowance' WHERE id=$1",[m.id]);await db.query('COMMIT');return null;}
 const attempt=Number((await db.query('SELECT COALESCE(max(attempt),0)+1 attempt FROM meeting_requests WHERE meeting_id=$1 AND stage=$2 AND content_version=$3',[requestMeetingId,stage,version])).rows[0].attempt);
 // A malicious client cannot turn a stuck request into an unbounded automatic loop.
 if(attempt>3){await db.query("UPDATE meetings SET status='failed',error_code='attempt_limit' WHERE id=$1",[m.id]);await db.query('COMMIT');return null;}
 const requestId=randomUUID(),lease=randomUUID();await db.query('UPDATE meeting_usage SET reserved_micros=reserved_micros+$3 WHERE workspace_id=$1 AND month=$2',[m.workspace_id,month,amount]);
 await db.query('INSERT INTO meeting_requests(id,meeting_id,workspace_id,stage,attempt,reserved_micros,month,content_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[requestId,requestMeetingId,m.workspace_id,stage,attempt,amount,month,version]);
 await db.query("UPDATE meetings SET status=$2,lease_token=$3,lease_until=now()+interval '5 minutes',updated_at=now(),error_code=NULL WHERE id=$1",[m.id,stage==='transcribe'?'transcribing':'analyzing',lease]);
 await db.query('COMMIT');return {meeting:{...m,transcript},recording,stage,requestId,lease};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function runMeetingWorker(id?:string){
 if(!id){if(await maintenance())return {checked:1,failed:0,more:true};if(await finishCapture())return {checked:1,failed:0,more:true};}
 if(!process.env.OPENAI_API_KEY||process.env.MEETING_PROCESSING_ENABLED==='false')return {checked:0,failed:0,more:false};
 const job=await reserveMeetingStep(id);if(!job)return {checked:0,failed:0,more:false};
 const db=getDatabasePool();try{
 let transcript=job.meeting.transcript;let findings=null;
 const active=async()=>{return Boolean((await db.query(`SELECT 1 FROM meetings m JOIN workspace_memberships wm ON wm.workspace_id=m.workspace_id AND wm.user_id=m.owner_user_id JOIN workspaces w ON w.id=m.workspace_id WHERE m.id=$1 AND m.lease_token=$2 AND m.status IN ('transcribing','analyzing') AND m.expires_at>now() AND wm.status='active' AND wm.role<>'viewer' AND w.status='active'`,[job.meeting.id,job.lease])).rowCount);}
 if(job.stage==='transcribe'){const audio=await factoryStorage().get(job.recording.audio_key,24_000_000);if(!await active())throw new Error('processing_interrupted');transcript=await transcribeMeeting(audio,job.recording.audio_type);}
 else {if(!await active())throw new Error('processing_interrupted');findings=await analyzeMeeting(transcript!);}
 // Atomically save the part and rebuild the root transcript. A deleted root,
 // revoked membership or superseding lease cannot resurrect private content.
 const connection=await db.connect();try{
 await connection.query('BEGIN');
 const valid=await connection.query(`SELECT 1 FROM meetings m JOIN workspace_memberships wm ON wm.workspace_id=m.workspace_id AND wm.user_id=m.owner_user_id JOIN workspaces w ON w.id=m.workspace_id WHERE m.id=$1 AND m.lease_token=$2 AND m.status IN ('transcribing','analyzing') AND m.expires_at>now() AND wm.status='active' AND wm.role<>'viewer' AND w.status='active' FOR UPDATE OF m FOR SHARE OF wm,w`,[job.meeting.id,job.lease]);
 if(valid.rowCount){
 if(job.stage==='transcribe')await connection.query('UPDATE meetings SET part_transcript=$2 WHERE id=$1 AND (id=$3 OR parent_meeting_id=$3)',[job.recording.id,transcript,job.meeting.id]);
 const parts=(await connection.query('SELECT part_order,part_transcript,gap_before_seconds,boundary_reason FROM meetings WHERE id=$1 OR parent_meeting_id=$1 ORDER BY part_order,id',[job.meeting.id])).rows;
 const combined=combineTranscripts(parts);
 await connection.query(`UPDATE meetings SET transcript=$3,findings=COALESCE($4::jsonb,findings),status=$5,lease_token=NULL,lease_until=NULL,updated_at=now(),revision=revision+1 WHERE id=$1 AND lease_token=$2`,[job.meeting.id,job.lease,combined,findings?JSON.stringify(findings):null,job.stage==='transcribe'?'queued':'review']);
 }
 await connection.query("UPDATE meeting_requests SET state='completed' WHERE id=$1",[job.requestId]);await connection.query('COMMIT');
 }catch(e){await connection.query('ROLLBACK');throw e;}finally{connection.release();}
 return {checked:1,failed:0,more:true};
 }catch(e){const code=e instanceof Error&&['empty_audio','invalid_analysis'].includes(e.message)?e.message:'provider_unavailable';await db.query("UPDATE meeting_requests SET state='unknown' WHERE id=$1",[job.requestId]);await db.query("UPDATE meetings SET status='failed',error_code=$3,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status IN ('transcribing','analyzing')",[job.meeting.id,job.lease,code]);return {checked:1,failed:1,more:false};}
}
