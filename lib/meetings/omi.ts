import 'server-only';
import {randomUUID,randomBytes} from 'node:crypto';
import {z} from 'zod';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {meetingError,meetingRole,meetingTransaction} from './access';
import {digest} from './service';
export async function listMeetingDevices(c:DashboardContext){await meetingRole(c);return (await getDatabasePool().query('SELECT id,label,uid,armed_until,auto_process,last_received_at,created_at FROM meeting_devices WHERE workspace_id=$1 AND user_id=$2 AND revoked_at IS NULL ORDER BY created_at',[c.workspace.id,c.user.id])).rows;}
export async function createMeetingDevice(c:DashboardContext,input:unknown){
 const v=z.object({label:z.string().trim().min(2).max(100),uid:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)}).parse(input);
 return meetingTransaction(c,async db=>{await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`device:${c.user.id}`]);if((await db.query('SELECT id FROM meeting_devices WHERE workspace_id=$1 AND user_id=$2 AND revoked_at IS NULL',[c.workspace.id,c.user.id])).rowCount!>=3)throw meetingError('Revoke an old connection before adding another.');const id=randomUUID(),secret=randomBytes(32).toString('base64url');await db.query('INSERT INTO meeting_devices(id,workspace_id,user_id,label,uid,secret_hash) VALUES($1,$2,$3,$4,$5,$6)',[id,c.workspace.id,c.user.id,v.label,v.uid,digest(secret)]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.device_created',targetType:'meeting_device',targetId:id});return {id,secret};});
}
export async function armMeetingDevice(c:DashboardContext,input:unknown){
 const v=z.object({id:z.uuid(),minutes:z.number().int().min(0).max(120),consentNote:z.string().trim().max(1000),autoProcess:z.boolean()}).refine(v=>v.minutes===0||v.consentNote.length>=3,{message:'Record permission before opening a capture window.'}).parse(input);
 return meetingTransaction(c,async db=>{const r=await db.query("UPDATE meeting_devices SET armed_until=CASE WHEN $4=0 THEN NULL ELSE now()+$4*interval '1 minute' END,consent_note=CASE WHEN $4=0 THEN consent_note ELSE $5 END,auto_process=$6 WHERE workspace_id=$1 AND user_id=$2 AND id=$3 AND revoked_at IS NULL RETURNING id",[c.workspace.id,c.user.id,v.id,v.minutes,v.consentNote,v.autoProcess]);if(!r.rowCount)throw meetingError('This connection is unavailable.',404);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.device_capture_changed',targetType:'meeting_device',targetId:v.id,metadata:{minutes:v.minutes,autoProcess:v.autoProcess}});});
}
export async function revokeMeetingDevice(c:DashboardContext,id:string){z.uuid().parse(id);return meetingTransaction(c,async db=>{await db.query('UPDATE meeting_devices SET revoked_at=now(),armed_until=NULL WHERE workspace_id=$1 AND user_id=$2 AND id=$3',[c.workspace.id,c.user.id,id]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.device_revoked',targetType:'meeting_device',targetId:id});});}
export async function omiIdentity(secret:string,uid:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(secret)||!uid||uid.length>128)throw meetingError('Unauthorized.',401);
 const d=(await getDatabasePool().query(`SELECT d.*,u.name,u.email,w.name workspace_name,w.slug,m.role FROM meeting_devices d JOIN "user" u ON u.id=d.user_id JOIN workspaces w ON w.id=d.workspace_id JOIN workspace_memberships m ON m.user_id=d.user_id AND m.workspace_id=d.workspace_id WHERE d.secret_hash=$1 AND d.uid=$2 AND d.revoked_at IS NULL AND m.status='active' AND m.role<>'viewer' AND w.status='active'`,[digest(secret),uid])).rows[0];
 if(!d)throw meetingError('Unauthorized.',401);
 if(!d.armed_until||new Date(d.armed_until).getTime()<=Date.now())throw meetingError('Capture is paused. Enable a recording window in Meeting Inbox.',409);
 const context:DashboardContext={user:{id:d.user_id,name:d.name,email:d.email},workspace:{id:d.workspace_id,name:d.workspace_name,slug:d.slug},role:d.role};return {context,device:d};
}
export async function receiveOmi(secret:string,uid:string,rate:number,bytes:Uint8Array){
 if(![8000,16000].includes(rate)||!bytes.length||bytes.length%2||bytes.length>rate*2*60)throw meetingError('Expected PCM16 mono audio at 8 or 16 kHz, up to 60 seconds.');
 const {context:c,device:d}=await omiIdentity(secret,uid);
 return meetingTransaction(c,async db=>{
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`meetings:${c.workspace.id}`]);
 const active=(await db.query('SELECT * FROM meeting_devices WHERE id=$1 AND revoked_at IS NULL AND armed_until>now() FOR UPDATE',[d.id])).rows[0];if(!active)throw meetingError('Capture is paused.',409);
 const total=(await db.query("SELECT COALESCE(sum(GREATEST(received_bytes,expected_bytes)),0)::float8 bytes,COALESCE(sum(received_bytes) FILTER(WHERE device_id=$2 AND created_at>now()-interval '24 hours'),0)::float8 device_bytes FROM meetings WHERE workspace_id=$1 AND status<>'deleted'",[c.workspace.id,d.id])).rows[0];
 if(total.bytes+bytes.length>2_000_000_000||total.device_bytes+bytes.length>230_400_000)throw meetingError('Recording intake limit reached.',429);
 let m=(await db.query("SELECT * FROM meetings WHERE device_id=$1 AND status='capturing' AND sample_rate=$2 AND updated_at>now()-interval '3 minutes' AND received_bytes+$3<=19200000 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[d.id,rate,bytes.length])).rows[0];
 if(!m){m=(await db.query(`INSERT INTO meetings(id,workspace_id,owner_user_id,title,source,status,device_id,sample_rate,consent_note,consent_at,consent_by) VALUES($1,$2,$3,$4,'omi','capturing',$5,$6,$7,now(),$3) RETURNING *`,[randomUUID(),c.workspace.id,c.user.id,`${d.label} recording`,d.id,rate,active.consent_note])).rows[0];}
 const last=(await db.query('SELECT sequence,hash,created_at FROM meeting_upload_chunks WHERE meeting_id=$1 ORDER BY sequence DESC LIMIT 1',[m.id])).rows[0],hash=digest(bytes);
 // Omi has no delivery ID. Suppress immediate identical non-silent retries;
 // retain silence so gaps aren't silently removed. Completeness is never claimed.
 const duplicate=last&&last.hash===hash&&Date.now()-new Date(last.created_at).getTime()<30_000&&bytes.some(b=>b!==0);
 if(!duplicate){await db.query('INSERT INTO meeting_upload_chunks(meeting_id,sequence,hash,bytes) VALUES($1,$2,$3,$4)',[m.id,last?last.sequence+1:0,hash,Buffer.from(bytes)]);await db.query('UPDATE meetings SET received_bytes=received_bytes+$2,updated_at=now() WHERE id=$1',[m.id,bytes.length]);}
 await db.query('UPDATE meeting_devices SET last_received_at=now() WHERE id=$1',[d.id]);return {accepted:true,duplicate:!!duplicate};
 });
}
