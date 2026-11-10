import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {factoryStorage} from '@/lib/factory/storage';
import {relationshipAccess} from '@/lib/relationships/service';
import {normalizePhone} from '@/lib/sales/import';
import {uploadSchema,UPLOAD_CHUNK_BYTES,MAX_AUDIO_BYTES,meetingKinds,type MeetingRecord} from './contract';
import {getMeeting,meetingError,meetingRole,meetingTransaction} from './access';
import {inspectAudio,pcmWav} from './audio';
export const audioPrefix=(workspace:string,id:string)=>`meetings/${workspace}/${id}/audio/`;
export const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
export async function listMeetings(c:DashboardContext,q='',page=1){
 await meetingRole(c);const search=z.string().max(120).parse(q),offset=(z.number().int().min(1).max(1000).parse(page)-1)*20;
 const r=await getDatabasePool().query(`SELECT m.id,m.title,m.status,m.classification,m.source,m.visibility,m.created_at,m.expires_at,m.duration_seconds,m.error_code,u.name owner_name FROM meetings m JOIN "user" u ON u.id=m.owner_user_id WHERE m.workspace_id=$1 AND (m.owner_user_id=$2 OR m.visibility='team') AND m.status NOT IN ('deleting','deleted') AND m.expires_at>now() AND ($3='' OR m.title ILIKE '%'||$3||'%' OR m.transcript ILIKE '%'||$3||'%') ORDER BY m.created_at DESC,m.id DESC LIMIT 21 OFFSET $4`,[c.workspace.id,c.user.id,search,offset]);
 return {items:r.rows.slice(0,20),hasMore:r.rows.length>20,page};
}
export async function meetingSettings(c:DashboardContext){
 const role=await meetingRole(c);
 const r=await getDatabasePool().query(`SELECT s.monthly_limit_micros,COALESCE(u.reserved_micros,0) used FROM meeting_settings s LEFT JOIN meeting_usage u ON u.workspace_id=s.workspace_id AND u.month=date_trunc('month',now() AT TIME ZONE 'America/New_York')::date WHERE s.workspace_id=$1`,[c.workspace.id]);
 return {limit:Number(r.rows[0]?.monthly_limit_micros??0)/1e6,reserved:Number(r.rows[0]?.used??0)/1e6,canManage:['owner','admin'].includes(role),configured:!!process.env.OPENAI_API_KEY?.trim()&&process.env.MEETING_PROCESSING_ENABLED!=='false'};
}
export async function saveMeetingBudget(c:DashboardContext,dollars:number){
 z.number().int().min(0).max(1000).parse(dollars);
 return meetingTransaction(c,async db=>{const role=await meetingRole(c,true,db);if(!['owner','admin'].includes(role))throw meetingError('Only an owner or administrator can set the allowance.',403);await db.query('INSERT INTO meeting_settings(workspace_id,monthly_limit_micros,updated_by) VALUES($1,$2,$3) ON CONFLICT(workspace_id) DO UPDATE SET monthly_limit_micros=EXCLUDED.monthly_limit_micros,updated_by=EXCLUDED.updated_by,updated_at=now()',[c.workspace.id,dollars*1e6,c.user.id]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meetings.allowance_changed',targetType:'workspace',targetId:c.workspace.id,metadata:{dollars}});});
}
export async function startUpload(c:DashboardContext,input:unknown){
 const v=uploadSchema.parse(input);
 return meetingTransaction(c,async db=>{
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`meetings:${c.workspace.id}`]);
 const found=(await db.query("SELECT id,status,owner_user_id,audio_hash,expected_bytes,expires_at FROM meetings WHERE workspace_id=$1 AND (id=$2 OR (owner_user_id=$3 AND audio_hash=$4 AND source='upload' AND status NOT IN ('deleting','deleted'))) ORDER BY created_at LIMIT 1",[c.workspace.id,v.id,c.user.id,v.hash])).rows[0];
 if(found&&new Date(found.expires_at).getTime()<=Date.now())throw meetingError('This recording has expired and is awaiting cleanup. Try again after the next worker run.',409);
 if(found){if(found.owner_user_id!==c.user.id||found.audio_hash!==v.hash||found.expected_bytes!==v.size)throw meetingError('This upload identifier is already in use.',409);return {id:found.id,status:found.status,duplicate:true};}
 const quota=(await db.query("SELECT COALESCE(sum(GREATEST(received_bytes,expected_bytes)),0)::float8 bytes,count(*) FILTER(WHERE created_at>now()-interval '1 day')::int recent FROM meetings WHERE workspace_id=$1 AND status<>'deleted'",[c.workspace.id])).rows[0];
 if(quota.bytes+v.size>2_000_000_000||quota.recent>=100)throw meetingError('Meeting storage or daily intake limit reached. Remove old recordings or try tomorrow.',429);
 await db.query(`INSERT INTO meetings(id,workspace_id,owner_user_id,title,source,expected_bytes,audio_hash,consent_note,consent_at,consent_by,expires_at) VALUES($1,$2,$3,$4,'upload',$5,$6,$7,now(),$3,now()+$8*interval '1 day')`,[v.id,c.workspace.id,c.user.id,v.title,v.size,v.hash,v.consentNote,v.retentionDays]);
 await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.upload_started',targetType:'meeting',targetId:v.id});return {id:v.id,status:'uploading',duplicate:false};
 });
}
export async function uploadChunk(c:DashboardContext,id:string,sequence:number,bytes:Uint8Array){
 z.number().int().min(0).max(23).parse(sequence);if(!bytes.length||bytes.length>UPLOAD_CHUNK_BYTES)throw meetingError('Invalid upload chunk.');
 return meetingTransaction(c,async db=>{
 const m=await getMeeting(c,id,true,db,true);if(m.status!=='uploading')throw meetingError('This upload is already finished.',409);
 const expected=Math.min(UPLOAD_CHUNK_BYTES,m.expected_bytes-sequence*UPLOAD_CHUNK_BYTES);if(bytes.length!==expected||expected<=0)throw meetingError('This chunk does not match the upload size.');
 const hash=digest(bytes);const old=(await db.query('SELECT hash FROM meeting_upload_chunks WHERE meeting_id=$1 AND sequence=$2',[id,sequence])).rows[0];
 if(old){if(old.hash!==hash)throw meetingError('A different chunk is already saved here.',409);return;}
 await db.query('INSERT INTO meeting_upload_chunks(meeting_id,sequence,hash,bytes) VALUES($1,$2,$3,$4)',[id,sequence,hash,Buffer.from(bytes)]);
 await db.query('UPDATE meetings SET received_bytes=received_bytes+$2,updated_at=now() WHERE id=$1',[id,bytes.length]);
 });
}
export async function finishUpload(c:DashboardContext,id:string){
 return meetingTransaction(c,async db=>{
 const m=await getMeeting(c,id,true,db,true);if(!['uploading','capturing'].includes(m.status))return {id:m.id,status:m.status};
 const chunks=(await db.query<{bytes:Buffer;sequence:number}>('SELECT bytes,sequence FROM meeting_upload_chunks WHERE meeting_id=$1 ORDER BY sequence',[id])).rows;
 if(chunks.some((p,i)=>p.sequence!==i))throw meetingError('The upload is incomplete. Select the same file to resume.');
 let bytes=Buffer.concat(chunks.map(p=>p.bytes));if(!bytes.length||bytes.length!==m.received_bytes)throw meetingError('The recording is incomplete.');
 if(m.source==='upload'&&(bytes.length!==m.expected_bytes||digest(bytes)!==(await db.query('SELECT audio_hash FROM meetings WHERE id=$1',[id])).rows[0].audio_hash))throw meetingError('The file is incomplete or changed. Select the original file to resume.');
 if(m.source==='omi')bytes=pcmWav(bytes,m.sample_rate!);
 let info;try{info=await inspectAudio(bytes);}catch{throw meetingError('Use valid WAV, MP3, M4A or WebM audio, up to 24 MB and 60 minutes.');}
 const key=`${audioPrefix(c.workspace.id,id)}recording.${info.extension}`;
 try{await factoryStorage().put(key,bytes,info.mime);}catch{throw meetingError('Private storage is unavailable. The uploaded chunks are saved; try Finish upload again.',503);}
 await db.query("UPDATE meetings SET status='ready',audio_key=$2,audio_type=$3,duration_seconds=$4,updated_at=now(),revision=revision+1,error_code=NULL WHERE id=$1",[id,key,info.mime,info.seconds]);
 await db.query('DELETE FROM meeting_upload_chunks WHERE meeting_id=$1',[id]);return {id,status:'ready'};
 });
}
export async function queueMeeting(c:DashboardContext,id:string,consentNote:string){
 z.string().trim().min(3).max(1000).parse(consentNote);
 return meetingTransaction(c,async db=>{const m=await getMeeting(c,id,true,db,true);if(!['ready','failed'].includes(m.status)||!m.audio_key)throw meetingError('Finish uploading before processing this meeting.');if(!process.env.OPENAI_API_KEY||process.env.MEETING_PROCESSING_ENABLED==='false')throw meetingError('Meeting AI processing is not enabled on the server.');await db.query("UPDATE meetings SET status='queued',consent_note=$2,consent_at=now(),consent_by=$3,error_code=NULL,updated_at=now(),revision=revision+1 WHERE id=$1",[id,consentNote,c.user.id]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.processing_requested',targetType:'meeting',targetId:id});});
}
export async function updateMeeting(c:DashboardContext,input:unknown){
 const v=z.object({id:z.uuid(),revision:z.number().int(),title:z.string().trim().min(1).max(160),visibility:z.enum(['private','team']),classification:z.enum(['unmatched','linked','unrelated']),notes:z.string().max(6000),retentionDays:z.number().int().min(1).max(180)}).parse(input);
 return meetingTransaction(c,async db=>{const m=await getMeeting(c,v.id,true,db,true);if(m.revision!==v.revision)throw meetingError('This meeting changed. Refresh before saving.',409);if(v.classification==='linked'&&![m.lead_id,m.client_id,m.business_id,m.contact_id,m.opportunity_id].some(Boolean))throw meetingError('Link a CRM record first.');await db.query('UPDATE meetings SET title=$2,visibility=$3,classification=$4,review_notes=$5,expires_at=created_at+$6*interval \'1 day\',revision=revision+1,updated_at=now() WHERE id=$1',[v.id,v.title,v.visibility,v.classification,v.notes,v.retentionDays]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.review_updated',targetType:'meeting',targetId:v.id,metadata:{visibility:v.visibility}});});
}
export async function linkMeeting(c:DashboardContext,id:string,kind:typeof meetingKinds[number],targetId:string){
 await relationshipAccess(c,{kind,id:targetId});return meetingTransaction(c,async db=>{await getMeeting(c,id,true,db,true);await db.query(`UPDATE meetings SET ${kind}_id=$2,classification='linked',revision=revision+1,updated_at=now() WHERE id=$1`,[id,targetId]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.linked',targetType:'meeting',targetId:id,metadata:{kind,targetId}});});
}
export async function unlinkMeeting(c:DashboardContext,id:string,kind:typeof meetingKinds[number]){
 z.enum(meetingKinds).parse(kind);return meetingTransaction(c,async db=>{await getMeeting(c,id,true,db,true);await db.query(`UPDATE meetings SET ${kind}_id=NULL,revision=revision+1,updated_at=now() WHERE id=$1`,[id]);await db.query("UPDATE meetings SET classification='unmatched' WHERE id=$1 AND num_nonnulls(lead_id,business_id,opportunity_id,client_id,contact_id)=0 AND classification='linked'",[id]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.unlinked',targetType:'meeting',targetId:id,metadata:{kind}});});
}
export async function createMeetingProspect(c:DashboardContext,input:unknown){
 const v=z.object({id:z.uuid(),name:z.string().trim().min(2).max(100),organization:z.string().trim().max(140),email:z.union([z.email(),z.literal('')]),phone:z.string().trim().max(40),confirmed:z.literal(true)}).parse(input);
 return meetingTransaction(c,async db=>{
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`agency-sales:${c.workspace.id}`]);const m=await getMeeting(c,v.id,true,db,true);
 if(m.lead_id)return {id:m.lead_id};const email=v.email.toLowerCase()||null,phone=v.phone?normalizePhone(v.phone):null;if(v.phone&&!phone)throw meetingError('Enter a valid phone number or leave it blank.');
 const duplicate=(await db.query(`SELECT id FROM leads WHERE workspace_id=$1 AND anonymized_at IS NULL AND (($2::text IS NOT NULL AND lower(email)=$2) OR ($3::text IS NOT NULL AND crm_normalized_phone(phone)=$3) OR lower(name)=lower($4)) LIMIT 1`,[c.workspace.id,email,phone,v.name])).rows[0];
 const contact=(await db.query(`SELECT id FROM contacts WHERE workspace_id=$1 AND (($2::text IS NOT NULL AND lower(email)=$2) OR ($3::text IS NOT NULL AND crm_normalized_phone(phone)=$3) OR lower(name)=lower($4)) LIMIT 1`,[c.workspace.id,email,phone,v.name])).rows[0];
 if(duplicate||contact)throw meetingError('A prospect or contact already matches. Search and link the existing record instead.',409);
 const id=randomUUID();await db.query(`INSERT INTO leads(id,workspace_id,submission_id,source,status,name,organization,email,phone,owner_user_id,delivery_status) VALUES($1,$2,$3,'manual','new',$4,$5,$6,$7,$8,'not_configured')`,[id,c.workspace.id,`meeting:${c.workspace.id}:${v.id}`,v.name,v.organization,email,phone,c.user.id]);
 await db.query("UPDATE meetings SET lead_id=$2,classification='linked',revision=revision+1,updated_at=now() WHERE id=$1",[v.id,id]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.prospect_created',targetType:'lead',targetId:id,metadata:{meetingId:v.id}});return {id};
 });
}
export async function deleteMeeting(c:DashboardContext,id:string,confirmed:boolean){
 if(confirmed!==true)throw meetingError('Confirm permanent deletion first.');return meetingTransaction(c,async db=>{await getMeeting(c,id,true,db,true);await db.query("UPDATE meetings SET status='deleting',transcript=NULL,findings=NULL,review_notes='',consent_note='',title='Deleted meeting',lease_token=NULL,lease_until=NULL,deleted_at=now(),updated_at=now() WHERE id=$1",[id]);await db.query('DELETE FROM meeting_upload_chunks WHERE meeting_id=$1',[id]);await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'meeting.deletion_requested',targetType:'meeting',targetId:id});});
}
export async function readAudio(c:DashboardContext,id:string){const m=await getMeeting(c,id);if(!m.audio_key)throw meetingError('Audio is still uploading.',409);const bytes=await factoryStorage().get(m.audio_key,MAX_AUDIO_BYTES);await getMeeting(c,id);return {bytes,mime:m.audio_type||'application/octet-stream'};}
export async function searchMeetingTargets(c:DashboardContext,q:string){
 await meetingRole(c);z.string().min(2).max(120).parse(q);
 return (await getDatabasePool().query(`SELECT 'lead' kind,id,name label FROM leads WHERE workspace_id=$1 AND anonymized_at IS NULL AND (name ILIKE '%'||$2||'%' OR organization ILIKE '%'||$2||'%') UNION ALL SELECT 'client',id,name FROM clients WHERE workspace_id=$1 AND name ILIKE '%'||$2||'%' UNION ALL SELECT 'opportunity',id,title FROM crm_opportunities WHERE workspace_id=$1 AND title ILIKE '%'||$2||'%' UNION ALL SELECT 'contact',id,name FROM contacts WHERE workspace_id=$1 AND name ILIKE '%'||$2||'%' UNION ALL SELECT 'business',id,name FROM crm_businesses WHERE workspace_id=$1 AND anonymized_at IS NULL AND name ILIKE '%'||$2||'%' LIMIT 30`,[c.workspace.id,q])).rows;
}
export function meetingPublicRecord(m:MeetingRecord){const {audio_key:_key,lease_token:_lease,...record}=m;return record;}
