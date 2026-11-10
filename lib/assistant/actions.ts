import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getDatabasePool} from '@/lib/dashboard/db';
import type {DashboardContext} from '@/lib/dashboard/data';
import {hash,principal,type Principal} from './oauth';
import {AssistantError,AssistantOutcomeError,isWriteScope,assistantOrigin} from './config';
import {asAssistant,requireScopes} from './access';
import {reviewContext} from './review-context';
import {findChange} from './tools/changes';
import {assistantExecution} from './execution-context';
import {revokeBackgroundIdentity} from './background-identity';
// Hash canonical, parsed values. Unknown fields cannot become authority or approvals.
export function canonical(value:unknown):string{
 if(value===undefined)return 'null';
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
}
export const keySchema=z.string().min(8).max(120).regex(/^[a-zA-Z0-9_-]+$/);
type ActionRow={id:string;grant_id:string;user_id:string;workspace_id:string;tool:string;execution_authority:'dashboard'|'delegated';input:Record<string,unknown>;input_hash:string;review_context:Record<string,unknown>;status:string;result:unknown;error_code:string|null;created_at:Date;updated_at:Date;expires_at:Date};
function receipt(r:ActionRow){return {id:r.id,action:r.tool,executionAuthority:r.execution_authority,status:r.status,result:r.result,error:r.error_code,createdAt:r.created_at,updatedAt:r.updated_at,expiresAt:r.expires_at,reviewUrl:`${assistantOrigin()}/dashboard/assistant?action=${r.id}`,message:r.status==='awaiting_approval'?'Prepared only. The account owner must review this exact change in the Assistant dashboard.':r.status==='running'||r.status==='outcome_unknown'?'Check the affected record before taking any further action. Do not retry with a new key.':undefined};}
export async function prepareAction(p:Principal,name:string,raw:unknown,key:string){
 const tool=findChange(name);if(!tool)throw new AssistantError('unsupported_action','This action is not available.');
 const input=tool.schema.parse(raw);keySchema.parse(key);const fingerprint=hash(canonical({name,input}));
 return asAssistant(p,tool.scopes,true,async fresh=>{
  const db=getDatabasePool(),id=randomUUID();
  const existing=(await db.query<ActionRow>('SELECT * FROM assistant_actions WHERE grant_id=$1 AND idempotency_key=$2',[fresh.grantId,key])).rows[0];
  if(existing){if(existing.input_hash!==fingerprint)throw new AssistantError('idempotency_conflict','Use the original content for this request key. A different change needs a new key.',409);return receipt(existing);}
  const review=await reviewContext(fresh,name,input);
  await db.query(`INSERT INTO assistant_actions(id,grant_id,workspace_id,user_id,tool,input_hash,idempotency_key,status,input,review_context) VALUES($1,$2,$3,$4,$5,$6,$7,'awaiting_approval',$8::jsonb,$9::jsonb) ON CONFLICT(grant_id,idempotency_key) DO NOTHING`,[id,fresh.grantId,fresh.context.workspace.id,fresh.context.user.id,name,fingerprint,key,JSON.stringify(input),JSON.stringify(review)]);
  const row=(await db.query<ActionRow>('SELECT * FROM assistant_actions WHERE grant_id=$1 AND idempotency_key=$2',[fresh.grantId,key])).rows[0];
  if(row.input_hash!==fingerprint)throw new AssistantError('idempotency_conflict','Use the original content for this request key. A different change needs a new key.',409);
  return receipt(row);
 });
}
export async function readAction(p:Principal,id:string){
 const r=(await getDatabasePool().query<ActionRow>('SELECT * FROM assistant_actions WHERE id=$1 AND grant_id=$2 AND user_id=$3 AND workspace_id=$4',[z.uuid().parse(id),p.grantId,p.context.user.id,p.context.workspace.id])).rows[0];
 if(!r)throw new AssistantError('not_found','This action is unavailable.',404);
 const tool=findChange(r.tool);if(!tool)throw new AssistantError('not_found','This action is no longer supported.',404);
 requireScopes(p,tool.scopes);return receipt(r);
}
export async function listActions(p:Principal,page=1){
 const rows=await getDatabasePool().query<ActionRow>('SELECT * FROM assistant_actions WHERE grant_id=$1 AND user_id=$2 AND workspace_id=$3 ORDER BY created_at DESC,id LIMIT 31 OFFSET $4',[p.grantId,p.context.user.id,p.context.workspace.id,(page-1)*30]);
 return {items:rows.rows.slice(0,30).filter(r=>findChange(r.tool)?.scopes.every(s=>p.scopes.includes(s))).map(receipt),hasMore:rows.rows.length>30,page};
}
// Dashboard approval and explicitly delegated execution share one claim/receipt path.
// Claim first, then execute once. A crash after claim is intentionally not retried:
// a domain transaction may have committed even if its receipt was not saved.
export async function reviewAction(context:DashboardContext,id:string,decision:'approve'|'reject'){return performAction(context,id,decision);}
export async function executeAction(p:Principal,name:string,raw:unknown,key:string){
 const tool=findChange(name);if(!tool)throw new AssistantError('unsupported_action','This action is unavailable.');
 if(tool.reviewRequired)return prepareAction(p,name,raw,key);
 return asAssistant(p,tool.scopes,true,async fresh=>{
  const proposal=await prepareAction(fresh,name,raw,key);
  return performAction(fresh.context,proposal.id,'approve',fresh.grantId);
 },true);
}
async function performAction(context:DashboardContext,id:string,decision:'approve'|'reject',delegateGrantId?:string){
 const db=await getDatabasePool().connect();let row:ActionRow;let p:Principal;
 try{
  await db.query('BEGIN');
  const r=(await db.query<ActionRow>('SELECT * FROM assistant_actions WHERE id=$1 AND user_id=$2 AND workspace_id=$3 FOR UPDATE',[z.uuid().parse(id),context.user.id,context.workspace.id])).rows[0];
  if(!r||(delegateGrantId&&r.grant_id!==delegateGrantId))throw new AssistantError('not_found','This action is unavailable.',404);row=r;
  if(row.status!=='awaiting_approval'){await db.query('COMMIT');return receipt(row);}
  if(decision==='reject'){await db.query("UPDATE assistant_actions SET status='cancelled',updated_at=now() WHERE id=$1",[id]);await db.query('COMMIT');return receipt({...row,status:'cancelled'});}
  if(row.expires_at.getTime()<=Date.now())throw new AssistantError('expired','This proposal expired. Ask your assistant to prepare it again.',409);
  const tool=findChange(row.tool);if(!tool)throw new AssistantError('unsupported_action','This action is no longer available.');
  const grant=(await db.query('SELECT * FROM assistant_grants WHERE id=$1 FOR SHARE',[row.grant_id])).rows[0];
  p=await principal(grant,db);requireScopes(p,tool.scopes,true);
  if(delegateGrantId&&!p.directActions)throw new AssistantError('direct_actions_disabled','Direct actions are no longer enabled for this connection.',403);
  if(hash(canonical({name:row.tool,input:tool.schema.parse(row.input)}))!==row.input_hash)throw new AssistantError('changed_action','The proposal changed. Prepare a new one.',409);
  row.execution_authority=delegateGrantId?'delegated':'dashboard';
  await db.query("UPDATE assistant_actions SET status='running',approved_at=CASE WHEN $2='dashboard' THEN now() ELSE NULL END,execution_authority=$2,updated_at=now() WHERE id=$1",[id,row.execution_authority]);await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 const tool=findChange(row.tool)!;
 try{
  const value=await asAssistant(p!,tool.scopes,true,async fresh=>{
   if(canonical(await reviewContext(fresh,row.tool,row.input))!==canonical(row.review_context))throw new AssistantError('review_changed','The reviewed customer, teammate or record changed. Prepare a new proposal.',409);
   if(row.tool==='send_email'){
    if(delegateGrantId)throw new AssistantError('review_required','Email needs your exact review.',403);
    return assistantExecution.run({...assistantExecution.getStore()!,reviewedEmailActionId:row.id},()=>tool.run(fresh,row.input));
   }
   return tool.run(fresh,row.input);
  },!!delegateGrantId);
  const result=value??{saved:true};
  await getDatabasePool().query("UPDATE assistant_actions SET status='succeeded',result=$2::jsonb,updated_at=now() WHERE id=$1 AND status='running'",[id,JSON.stringify(result)]);
  return receipt({...row,status:'succeeded',result});
 }catch(e){
  // Only our pre-execution authorization/CAS errors are known failures. Other
  // domain/provider errors are conservatively uncertain; never auto-retry.
  const known=e instanceof AssistantError||e instanceof z.ZodError;
  const status=e instanceof AssistantOutcomeError?e.outcome:known?'failed':'outcome_unknown';const code=e instanceof AssistantError?e.code:e instanceof AssistantOutcomeError?'check_message_status':known?'invalid_input':'check_record_before_retry';
  const result=e instanceof AssistantOutcomeError?e.result:e instanceof AssistantError?{message:e.message}:null;
  await getDatabasePool().query('UPDATE assistant_actions SET status=$2,error_code=$3,result=$4::jsonb,updated_at=now() WHERE id=$1 AND status=\'running\'',[id,status,code,JSON.stringify(result)]);
  return receipt({...row,status,error_code:code,result});
 }
}
export async function manageConnection(context:DashboardContext,id:string,operation:'revoke'|'pause'|'resume'|'direct'|'reviewed'){
 if(operation==='direct'||operation==='reviewed'){
  const db=await getDatabasePool().connect();
  try{
   await db.query('BEGIN');
   const grant=(await db.query('SELECT * FROM assistant_grants WHERE id=$1 AND user_id=$2 AND workspace_id=$3 FOR UPDATE',[z.uuid().parse(id),context.user.id,context.workspace.id])).rows[0];
   if(!grant)throw new AssistantError('not_found','This connection is unavailable.',404);
   const live=await principal(grant,db);
   if(operation==='direct'&&(live.context.role==='viewer'||!live.scopes.some(isWriteScope)))throw new AssistantError('insufficient_scope','This connection needs a change permission and an active editor account.',403);
   await db.query('UPDATE assistant_grants SET direct_actions=$2 WHERE id=$1',[id,operation==='direct']);
   await db.query("INSERT INTO assistant_activity(id,grant_id,tool,outcome) VALUES($1,$2,$3,'succeeded')",[randomUUID(),id,'control:'+operation]);
   await db.query('COMMIT');return;
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 }
 const sql=operation==='revoke'?'revoked_at=now()':operation==='pause'?'writes_paused=true':'writes_paused=false';
 await getDatabasePool().query(`UPDATE assistant_grants SET ${sql} WHERE id=$1 AND user_id=$2 AND workspace_id=$3`,[z.uuid().parse(id),context.user.id,context.workspace.id]);
 if(operation==='revoke')await revokeBackgroundIdentity(id,context).catch(()=>{/* Local revocation already stops every future use. Remote credentials also expire. */});
}
export async function stopAllWrites(context:DashboardContext){
 await getDatabasePool().query('UPDATE assistant_grants SET writes_paused=true WHERE user_id=$1 AND workspace_id=$2',[context.user.id,context.workspace.id]);
}
