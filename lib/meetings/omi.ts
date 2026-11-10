import 'server-only';
import {randomUUID,randomBytes} from 'node:crypto';
import {z} from 'zod';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {meetingError,meetingRole,meetingTransaction} from './access';
import {digest} from './service';
import {MAX_MEETING_PARTS} from './grouping';
export async function listMeetingDevices(c:DashboardContext){await meetingRole(c);return (await getDatabasePool().query('SELECT id,label,uid,armed_until,auto_process,last_received_at,current_meeting_id,duplicate_deliveries,created_at FROM meeting_devices WHERE workspace_id=$1 AND user_id=$2 AND revoked_at IS NULL ORDER BY created_at',[c.workspace.id,c.user.id])).rows;}
export async function createMeetingDevice(c:DashboardContext,input:unknown){
 const v=z.object({label:z.string().trim().min(2).max(100),uid:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)}).parse(input);
 return meetingTransaction(c,async db=>{await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`device:${c.user.id}`]);if((await db.query('SELECT id FROM meeting_devices WHERE workspace_id=$1 AND user_id=$2 AND revoked_at IS NULL',[c.workspace.id,c.user.id])).rowCount!>=3)throw meetingError('Revoke an old connection before adding another.');const id=randomUUID(),secret=randomBytes(32).toString('base64url');await db.query('INSERT INTO meeting_devices(id,workspace_id,user_id,label,uid,secret_hash) VALUES($1,$2,$3,$4,$5,$6)',[id,c.workspace.id,c.user.id,v.label,v.uid,digest(secret)]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.device_created',targetType:'meeting_device',targetId:id});return {id,secret};});
}
export async function armMeetingDevice(c:DashboardContext,input:unknown){
 const v=z.object({id:z.uuid(),minutes:z.number().int().min(0).max(120),consentNote:z.string().trim().max(1000),autoProcess:z.boolean()}).refine(v=>v.minutes===0||v.consentNote.length>=3,{message:'Record permission before opening a receiving window.'}).parse(input);
 return meetingTransaction(c,async db=>{
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`meetings:${c.workspace.id}`]);
 const d=(await db.query('SELECT *,armed_until>now() active FROM meeting_devices WHERE workspace_id=$1 AND user_id=$2 AND id=$3 AND revoked_at IS NULL FOR UPDATE',[c.workspace.id,c.user.id,v.id])).rows[0];
 if(!d)throw meetingError('This connection is unavailable.',404);
 if(d.current_meeting_id&&d.active)await db.query("UPDATE meetings SET auto_process_requested=$2 WHERE id=$1 AND status='capturing'",[d.current_meeting_id,v.autoProcess]);
 if(d.current_meeting_id&&(!v.minutes||!d.active))await db.query('UPDATE meetings SET part_closed_at=COALESCE(part_closed_at,now()) WHERE id=$1 OR parent_meeting_id=$1',[d.current_meeting_id]);
 await db.query("UPDATE meeting_devices SET armed_until=CASE WHEN $2=0 THEN NULL ELSE now()+$2*interval '1 minute' END,consent_note=CASE WHEN $2=0 THEN consent_note ELSE $3 END,auto_process=$4,current_meeting_id=CASE WHEN $2=0 OR NOT COALESCE($5,false) THEN NULL ELSE current_meeting_id END WHERE id=$1",[d.id,v.minutes,v.consentNote,v.autoProcess,d.active]);
 await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.device_receiving_changed',targetType:'meeting_device',targetId:v.id,metadata:{minutes:v.minutes,autoProcess:v.autoProcess}});
 });
}
export async function nextOmiConversation(c:DashboardContext,id:string){
 z.uuid().parse(id);return meetingTransaction(c,async db=>{
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`meetings:${c.workspace.id}`]);
 const d=(await db.query('SELECT * FROM meeting_devices WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND revoked_at IS NULL AND armed_until>now() FOR UPDATE',[id,c.workspace.id,c.user.id])).rows[0];
 if(!d)throw meetingError('Open a receiving window first.',409);
 if(d.current_meeting_id)await db.query('UPDATE meetings SET part_closed_at=COALESCE(part_closed_at,now()) WHERE id=$1 OR parent_meeting_id=$1',[d.current_meeting_id]);
 await db.query('UPDATE meeting_devices SET current_meeting_id=NULL WHERE id=$1',[id]);
 await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.next_conversation',targetType:'meeting_device',targetId:id});
 });
}
export async function revokeMeetingDevice(c:DashboardContext,id:string){
 z.uuid().parse(id);return meetingTransaction(c,async db=>{
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`meetings:${c.workspace.id}`]);
 await db.query('UPDATE meeting_devices SET revoked_at=now(),armed_until=NULL,current_meeting_id=NULL WHERE workspace_id=$1 AND user_id=$2 AND id=$3',[c.workspace.id,c.user.id,id]);
 await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.device_revoked',targetType:'meeting_device',targetId:id});
 });
}
export async function omiIdentity(secret:string,uid:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(secret)||!uid||uid.length>128)throw meetingError('Unauthorized.',401);
 const d=(await getDatabasePool().query(`SELECT d.*,u.name,u.email,w.name workspace_name,w.slug,m.role FROM meeting_devices d JOIN "user" u ON u.id=d.user_id JOIN workspaces w ON w.id=d.workspace_id JOIN workspace_memberships m ON m.user_id=d.user_id AND m.workspace_id=d.workspace_id WHERE d.secret_hash=$1 AND d.uid=$2 AND d.revoked_at IS NULL AND m.status='active' AND m.role<>'viewer' AND w.status='active'`,[digest(secret),uid])).rows[0];
 if(!d)throw meetingError('Unauthorized.',401);
 const context:DashboardContext={user:{id:d.user_id,name:d.name,email:d.email},workspace:{id:d.workspace_id,name:d.workspace_name,slug:d.slug},role:d.role};return {context,device:d};
}
export async function receiveOmi(secret:string,uid:string,rate:number,bytes:Uint8Array){
 if(![8000,16000].includes(rate)||!bytes.length||bytes.length%2||bytes.length>rate*2*60)throw meetingError('Expected PCM16 mono audio at 8 or 16 kHz, up to 60 seconds.');
 const {context:c,device:d}=await omiIdentity(secret,uid);
 return meetingTransaction(c,async db=>{
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`meetings:${c.workspace.id}`]);
 const active=(await db.query('SELECT *,armed_until>clock_timestamp() receiving FROM meeting_devices WHERE id=$1 AND revoked_at IS NULL FOR UPDATE',[d.id])).rows[0];
 if(!active)throw meetingError('Unauthorized.',401);
 // A successful acknowledgement keeps Omi from counting an intentional pause
 // as a delivery failure. Do not persist even a hash or timestamp of this audio.
 if(!active.receiving)return {accepted:false,discarded:true,reason:'receiving_paused'};
 const hash=digest(Buffer.concat([Buffer.from(`${rate}:`),bytes])),now=Date.now();
 // No Omi audio event ID exists. This is only immediate non-silent retry
 // suppression, including at a part boundary. Silence is never removed.
 if(active.last_chunk_hash===hash&&now-new Date(active.last_chunk_at).getTime()<30_000&&bytes.some(b=>b!==0)){
 await db.query('UPDATE meeting_devices SET duplicate_deliveries=duplicate_deliveries+1 WHERE id=$1',[d.id]);return {accepted:true,duplicate:true};
 }
 const total=(await db.query("SELECT COALESCE(sum(GREATEST(received_bytes,expected_bytes)),0)::float8 bytes,COALESCE(sum(received_bytes) FILTER(WHERE device_id=$2 AND created_at>now()-interval '24 hours'),0)::float8 device_bytes FROM meetings WHERE workspace_id=$1 AND status<>'deleted'",[c.workspace.id,d.id])).rows[0];
 if(total.bytes+bytes.length>2_000_000_000||total.device_bytes+bytes.length>230_400_000)throw meetingError('Recording intake limit reached.',429);
 let root=active.current_meeting_id?(await db.query("SELECT * FROM meetings WHERE id=$1 AND workspace_id=$2 AND owner_user_id=$3 AND parent_meeting_id IS NULL AND status='capturing' AND expires_at>now() FOR UPDATE",[active.current_meeting_id,c.workspace.id,c.user.id])).rows[0]:null;
 let previous=root?(await db.query('SELECT * FROM meetings WHERE id=$1 OR parent_meeting_id=$1 ORDER BY part_order DESC LIMIT 1 FOR UPDATE',[root.id])).rows[0]:null;
 let part=previous;
 const gap=previous?.last_audio_at?Math.max(0,Math.floor((now-new Date(previous.last_audio_at).getTime())/1000-bytes.length/(rate*2))):0;
 if(previous&&(previous.audio_key||previous.part_closed_at||previous.sample_rate!==rate||previous.received_bytes+bytes.length>19_200_000||gap>30)){
 await db.query('UPDATE meetings SET part_closed_at=COALESCE(part_closed_at,now()) WHERE id=$1',[previous.id]);part=null;
 }
 if(!part){
 if(previous&&previous.part_order+1>=MAX_MEETING_PARTS){root=null;previous=null;}
 const id=randomUUID(),order=previous?previous.part_order+1:0;
 part=(await db.query(`INSERT INTO meetings(id,workspace_id,owner_user_id,title,source,status,device_id,sample_rate,consent_note,consent_at,consent_by,parent_meeting_id,part_order,gap_before_seconds,boundary_reason,auto_process_requested,expires_at) VALUES($1,$2,$3,$4,'omi','capturing',$5,$6,$7,now(),$3,$8,$9,$10,$11,$12,COALESCE($13::timestamptz,now()+interval '30 days')) RETURNING *`,[id,c.workspace.id,c.user.id,`${d.label} meeting`,d.id,rate,active.consent_note,root?.id??null,order,previous?gap:0,previous?(previous.sample_rate!==rate?'sample_rate':gap>30?'delivery_gap':'size'):null,active.auto_process,root?.expires_at??null])).rows[0];
 if(!root){root=part;await db.query('UPDATE meeting_devices SET current_meeting_id=$2 WHERE id=$1',[d.id,root.id]);}
 }
 const sequence=Number((await db.query('SELECT COALESCE(max(sequence),-1)+1 sequence FROM meeting_upload_chunks WHERE meeting_id=$1',[part.id])).rows[0].sequence);
 await db.query('INSERT INTO meeting_upload_chunks(meeting_id,sequence,hash,bytes) VALUES($1,$2,$3,$4)',[part.id,sequence,hash,Buffer.from(bytes)]);
 await db.query('UPDATE meetings SET received_bytes=received_bytes+$2,last_audio_at=now(),updated_at=now() WHERE id=$1',[part.id,bytes.length]);
 await db.query('UPDATE meetings SET updated_at=now() WHERE id=$1',[root.id]);
 await db.query('UPDATE meeting_devices SET last_received_at=now(),last_chunk_at=now(),last_chunk_hash=$2 WHERE id=$1',[d.id,hash]);return {accepted:true,duplicate:false};
 });
}
