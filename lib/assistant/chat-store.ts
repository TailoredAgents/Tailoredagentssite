import 'server-only';
import {randomUUID} from 'node:crypto';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError,resourceUri,type AssistantScope} from './config';
import {principal,type Principal} from './oauth';
import {asAssistant} from './access';
import type {ChatActivity,ChatState,ChatTurn} from './chat-contract';
import {chatLease} from './chat-lease';
import {requireSmsNumber} from '@/lib/sms/data';
import {searchMemories} from './memory';
import {listRoutines} from './routines';
import {listBookingNotifications} from './booking-notifications';
import {BACKGROUND_CLIENT,authorizeBackgroundIdentity,releaseBackgroundIdentity,revokeBackgroundIdentity,type BackgroundIdentity} from './background-identity';

export const NATIVE_CLIENT='ta_native_dashboard';
const owner=(c:DashboardContext)=>[c.workspace.id,c.user.id];
const unavailable=()=>new AssistantError('not_found','This conversation is unavailable.',404);
export async function nativePrincipal(c:DashboardContext,sessionId:string):Promise<Principal>{
 const row=(await getDatabasePool().query(`SELECT * FROM assistant_grants WHERE workspace_id=$1 AND user_id=$2 AND ((session_id=$3 AND client_id=$4) OR (authority='background' AND client_id=$5)) AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`,[...owner(c),sessionId,NATIVE_CLIENT,BACKGROUND_CLIENT])).rows[0];
 if(!row)throw new AssistantError('connect_required','Enable your dashboard assistant to start chatting.',403);
 return principal(row);
}
export async function connectNative(c:DashboardContext,sessionId:string,mode:'read'|'review'|'direct',conversations:boolean,options:{background?:boolean;meetings?:boolean;research?:boolean;sms?:boolean;email?:boolean;calls?:boolean;routines?:boolean;notificationNumberId?:string}={}){
 if(c.role==='viewer'&&mode!=='read')throw new AssistantError('read_only','Your account is read-only.',403);
 const scopes:AssistantScope[]=['operations:read','personal:read','memory:read','routines:read'];
 if(conversations)scopes.push('conversations:read');
 if(options.meetings)scopes.push('meetings:read');
 if(mode!=='read')scopes.push('operations:write','personal:write','memory:write');
 if(options.research)scopes.push('research:use');
 if(options.notificationNumberId){if(mode==='read'||!options.sms||!conversations)throw new AssistantError('notification_setup','Enable text sending to use booking notifications.',409);await requireSmsNumber(c,options.notificationNumberId,true);}
 if(mode!=='read'){
  if(options.sms&&conversations)scopes.push('conversations:send');
  if(options.email&&conversations)scopes.push('mail:send');
  if(options.calls&&conversations)scopes.push('voice:send');
  if(options.routines)scopes.push('routines:write');
 }
 const db=await getDatabasePool().connect();let identity:BackgroundIdentity|undefined;const grantId=randomUUID();
 try{
  await db.query('BEGIN');
  await db.query("INSERT INTO assistant_clients(id,name,redirect_uris) VALUES($1,'Dashboard assistant','[]') ON CONFLICT DO NOTHING",[NATIVE_CLIENT]);
  // Serialize explicit reconnects. A revoked connection is only replaced by this human action.
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${c.workspace.id}:${c.user.id}:native`]);
  const retired=await db.query(`UPDATE assistant_grants SET revoked_at=now() WHERE workspace_id=$1 AND user_id=$2 AND ((session_id=$3 AND client_id=$4) OR client_id=$5) AND revoked_at IS NULL RETURNING id`,[...owner(c),sessionId,NATIVE_CLIENT,BACKGROUND_CLIENT]);
  if(options.background)identity=await authorizeBackgroundIdentity(c,sessionId,grantId,scopes,db);
  const inserted=identity?await db.query(`INSERT INTO assistant_grants(id,client_id,workspace_id,user_id,session_id,scopes,resource,expires_at,direct_actions,authority,identity_kind,identity_credential,consented_session_id)
   SELECT $1,$2,$3,$4,NULL,$6,$7,$8,$9,'background',$10,$11,s.id FROM "session" s JOIN workspace_memberships m ON m.user_id=s."userId" AND m.workspace_id=$3 AND m.status='active' JOIN workspaces w ON w.id=m.workspace_id AND w.status='active' WHERE s.id=$5 AND s."userId"=$4 AND s."expiresAt">now() AND (m.role<>'viewer' OR $12='read') RETURNING *`,[grantId,BACKGROUND_CLIENT,...owner(c),sessionId,scopes,resourceUri(),identity.expires_at,mode==='direct',identity.identity_kind,identity.identity_credential,mode]):await db.query(`INSERT INTO assistant_grants(id,client_id,workspace_id,user_id,session_id,scopes,resource,expires_at,direct_actions)
   SELECT $1,$2,$3,$4,s.id,$6,$7,s."expiresAt",$8 FROM "session" s
   JOIN workspace_memberships m ON m.user_id=s."userId" AND m.workspace_id=$3 AND m.status='active'
   JOIN workspaces w ON w.id=m.workspace_id AND w.status='active'
   WHERE s.id=$5 AND s."userId"=$4 AND s."expiresAt">now() AND (m.role<>'viewer' OR $9='read') RETURNING *`,
   [grantId,NATIVE_CLIENT,...owner(c),sessionId,scopes,resourceUri(),mode==='direct',mode]);
  if(!inserted.rows[0])throw unavailable();
  await principal(inserted.rows[0],db);
  await db.query('UPDATE assistant_grants SET notification_number_id=$2 WHERE id=$1',[inserted.rows[0].id,options.notificationNumberId||null]);
  await db.query('COMMIT');
  for(const g of retired.rows)await revokeBackgroundIdentity(g.id,c).catch(()=>{});
 }catch(e){await db.query('ROLLBACK');if(identity)await releaseBackgroundIdentity(identity).catch(()=>{});throw e;}finally{db.release();}
}
export async function saveChatBudget(c:DashboardContext,dollars:number){
 const r=await getDatabasePool().query(`INSERT INTO assistant_chat_settings(workspace_id,monthly_limit_micros,updated_by)
  SELECT w.id,$3,u.id FROM workspaces w JOIN workspace_memberships m ON m.workspace_id=w.id JOIN "user" u ON u.id=m.user_id
  WHERE w.id=$1 AND u.id=$2 AND w.status='active' AND m.status='active' AND m.role IN ('owner','admin')
  ON CONFLICT(workspace_id) DO UPDATE SET monthly_limit_micros=EXCLUDED.monthly_limit_micros,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING workspace_id`,[...owner(c),dollars*1000000]);
 if(!r.rowCount)throw new AssistantError('forbidden','Only an owner or administrator can set the company allowance.',403);
}
export async function chatState(c:DashboardContext,sessionId:string,threadId?:string):Promise<ChatState>{
 const db=getDatabasePool();
 let turns:ChatTurn[]=[];
 if(threadId){
  if(!(await db.query('SELECT id FROM assistant_chat_threads WHERE workspace_id=$1 AND user_id=$2 AND id=$3',[...owner(c),threadId])).rowCount)throw unavailable();
  turns=(await db.query<ChatTurn>('SELECT id,user_message,assistant_message,status,activity,created_at FROM assistant_chat_turns WHERE thread_id=$1 ORDER BY created_at DESC,id DESC LIMIT 101',[threadId])).rows;
 }
 const [threads,settings,connection]=await Promise.all([
  db.query<{id:string;title:string}>('SELECT id,title FROM assistant_chat_threads WHERE workspace_id=$1 AND user_id=$2 ORDER BY updated_at DESC,id DESC LIMIT 101',owner(c)),
  db.query<{monthly_limit_micros:string;used:string}>(`SELECT s.monthly_limit_micros,COALESCE(u.amount_micros,0) used FROM assistant_chat_settings s LEFT JOIN assistant_chat_usage u ON u.workspace_id=s.workspace_id AND u.month=date_trunc('month',now() AT TIME ZONE 'America/New_York')::date WHERE s.workspace_id=$1`,[c.workspace.id]),
  nativePrincipal(c,sessionId).catch(()=>null),
 ]);
 const candidates=(await db.query<{id:string}>('SELECT number_id id FROM sms_number_grants WHERE workspace_id=$1 AND user_id=$2 AND can_send=true',owner(c))).rows;
 const numbers=(await Promise.all(candidates.map(n=>requireSmsNumber(c,n.id,true).then(r=>({id:r.id,phone:r.phone})).catch(()=>null)))).filter((n):n is {id:string;phone:string}=>!!n);
 const [memories,routines,notifications]=connection?await Promise.all([searchMemories(connection),listRoutines(connection),connection.scopes.includes('conversations:read')?listBookingNotifications(connection):{items:[]}]):[{items:[]},{items:[]},{items:[]}];
 const notificationNumberId=connection?(await db.query('SELECT notification_number_id FROM assistant_grants WHERE id=$1',[connection.grantId])).rows[0]?.notification_number_id??'':'';
 return {numbers,memories:memories.items,routines:routines.items,notifications:notifications.items,threads:threads.rows.slice(0,100),hasMore:threads.rows.length>100,turns:turns.slice(0,100).reverse(),historyLimited:turns.length>100,
  backgroundAvailable:process.env.ASSISTANT_BACKGROUND_ENABLED==='true',
  connection:connection?{background:connection.authority==='background',expiresAt:connection.expiresAt.toISOString(),mode:connection.directActions?'direct':connection.scopes.includes('operations:write')?'review':'read',paused:connection.writesPaused,conversations:connection.scopes.includes('conversations:read'),meetings:connection.scopes.includes('meetings:read'),research:connection.scopes.includes('research:use'),sms:connection.scopes.includes('conversations:send'),email:connection.scopes.includes('mail:send'),calls:connection.scopes.includes('voice:send'),routines:connection.scopes.includes('routines:write'),notificationNumberId}:null,
  configured:!!process.env.OPENAI_API_KEY?.trim()&&process.env.ASSISTANT_CHAT_ENABLED!=='false'&&process.env.OPERATIONS_ASSISTANT_ENABLED!=='false',
  monthlyLimit:Number(settings.rows[0]?.monthly_limit_micros??0)/1000000,monthlyUsed:Number(settings.rows[0]?.used??0)/1000000,canManageBudget:['owner','admin'].includes(c.role),viewer:c.role==='viewer'};
}
export async function beginChatTurn(p:Principal,threadId:string,id:string,message:string){
 return asAssistant(p,[],false,async fresh=>{
  const db=await getDatabasePool().connect();
  try{
   await db.query('BEGIN');
   await db.query(`INSERT INTO assistant_chat_threads(id,workspace_id,user_id,title) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[threadId,...owner(fresh.context),message.slice(0,100)]);
   if(!(await db.query('SELECT id FROM assistant_chat_threads WHERE workspace_id=$1 AND user_id=$2 AND id=$3 FOR UPDATE',[...owner(fresh.context),threadId])).rowCount)throw unavailable();
   const existing=(await db.query('SELECT thread_id,user_message FROM assistant_chat_turns WHERE id=$1',[id])).rows[0];
   if(existing){if(existing.thread_id!==threadId||existing.user_message!==message)throw new AssistantError('conflict','This request identifier already belongs to another message.',409);await db.query('COMMIT');return false;}
   if((await db.query("SELECT id FROM assistant_chat_turns WHERE thread_id=$1 AND status IN ('queued','running')",[threadId])).rowCount)throw new AssistantError('busy','Wait for the current reply or stop it first.',409);
   await db.query("INSERT INTO assistant_chat_turns(id,thread_id,grant_id,user_message,status) VALUES($1,$2,$3,$4,'queued')",[id,threadId,p.grantId,message]);
   await db.query('UPDATE assistant_chat_threads SET updated_at=now() WHERE id=$1',[threadId]);
   await db.query('COMMIT');return true;
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 });
}
export async function assertTurnActive(p:Principal,id:string){
 await asAssistant(p,[],false,async()=>{
  if(process.env.ASSISTANT_CHAT_ENABLED==='false')throw new AssistantError('paused','Dashboard chat is paused.',503);
  const lease=chatLease.getStore();
  const r=await getDatabasePool().query(`SELECT t.id FROM assistant_chat_turns t JOIN assistant_chat_threads c ON c.id=t.thread_id WHERE t.id=$1 AND t.grant_id=$2 AND c.workspace_id=$3 AND c.user_id=$4 AND t.status IN ('queued','running') AND (t.routine_id IS NULL OR EXISTS(SELECT 1 FROM assistant_routines r WHERE r.id=t.routine_id AND r.enabled AND r.grant_id=t.grant_id)) AND ($5::uuid IS NULL OR (t.lease_token=$5 AND t.lease_until>now()))`,[id,p.grantId,...owner(p.context),lease?.turnId===id?lease.token:null]);
  if(!r.rowCount)throw new AssistantError('stopped','This reply stopped. Check its activity before repeating work.',409);
 });
}
export async function stopChatTurn(c:DashboardContext,threadId:string,id:string){
 await getDatabasePool().query(`UPDATE assistant_chat_turns t SET status='interrupted',lease_token=NULL,lease_until=NULL,engine_state=NULL,finished_at=now(),assistant_message='Stopped. An action already in progress may still finish; check the activity and action receipts.' FROM assistant_chat_threads c WHERE c.id=t.thread_id AND c.workspace_id=$1 AND c.user_id=$2 AND c.id=$3 AND t.id=$4 AND t.status IN ('queued','running')`,[...owner(c),threadId,id]);
}
export async function recordChatActivity(id:string,activity:ChatActivity){
 await getDatabasePool().query('UPDATE assistant_chat_turns SET activity=activity || $2::jsonb WHERE id=$1',[id,JSON.stringify([activity])]);
}
export async function finishChatTurn(id:string,message:string,status:'completed'|'failed'){
 const lease=chatLease.getStore();
 const finished=await getDatabasePool().query("UPDATE assistant_chat_turns SET assistant_message=$2,status=$3,finished_at=now(),engine_state=NULL,lease_token=NULL,lease_until=NULL WHERE id=$1 AND status IN ('queued','running') AND ($4::uuid IS NULL OR lease_token=$4) RETURNING routine_id",[id,message,status,lease?.turnId===id?lease.token:null]);
 if(finished.rows[0]?.routine_id)await getDatabasePool().query('UPDATE assistant_routines SET last_error=$2 WHERE id=$1',[finished.rows[0].routine_id,status==='failed'?message:null]);
}
export async function chatHistory(p:Principal,threadId:string){
 const r=await getDatabasePool().query<{user_message:string;assistant_message:string;status:string}>(`SELECT t.user_message,t.assistant_message,t.status FROM assistant_chat_turns t JOIN assistant_chat_threads c ON c.id=t.thread_id WHERE c.workspace_id=$1 AND c.user_id=$2 AND c.id=$3 ORDER BY t.created_at DESC,t.id DESC LIMIT 20`,[...owner(p.context),threadId]);
 const items: {role:'user'|'assistant';content:string}[]=[];
 let bytes=0;
 for(const t of r.rows){
  const content=t.assistant_message+(t.status==='completed'?'':`\n[Turn status: ${t.status}. Check action receipts before retrying any work.]`);
  const size=Buffer.byteLength(t.user_message+content);if(bytes+size>32000)break;bytes+=size;
  items.unshift({role:'user',content:t.user_message},...(t.assistant_message?[{role:'assistant' as const,content}]:[]));
 }
 return items;
}
