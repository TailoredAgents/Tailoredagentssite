import 'server-only';
import {randomUUID} from 'node:crypto';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {checkInboxSend} from '@/lib/inbox/service';
import {principal,hash} from './oauth';
import {asAssistant,requireScopes} from './access';
import {AssistantError} from './config';
import {canonical} from './actions';
import {reviewContext} from './review-context';
import {emailSchema} from './email-contract';
import {findChange} from './tools/changes';

async function owned(c:DashboardContext,id:string){
 const row=(await getDatabasePool().query('SELECT * FROM assistant_actions WHERE id=$1 AND workspace_id=$2 AND user_id=$3',[id,c.workspace.id,c.user.id])).rows[0];
 if(!row)throw new AssistantError('not_found','This review is unavailable.',404);
 const grant=(await getDatabasePool().query('SELECT * FROM assistant_grants WHERE id=$1',[row.grant_id])).rows[0],p=await principal(grant),tool=findChange(row.tool);
 if(!tool)throw new AssistantError('not_found','This action is unavailable.',404);requireScopes(p,tool.scopes);return {row,p};
}
export async function inlineReview(c:DashboardContext,id:string){
 const {row,p}=await owned(c,id);let stale=false;
 if(row.status==='awaiting_approval')try{stale=await asAssistant(p,findChange(row.tool)!.scopes,false,async fresh=>canonical(await reviewContext(fresh,row.tool,row.input))!==canonical(row.review_context));}catch{stale=true;}
 return {id:row.id,tool:row.tool,status:row.status,inputHash:row.input_hash,input:row.input,review:row.review_context,result:row.result,stale,canApprove:!stale&&!p.writesPaused&&c.role!=='viewer'&&new Date(row.expires_at)>new Date(),expiresAt:row.expires_at};
}
/** Replace a pending email with a distinct proposal. The old review can never approve the edited content. */
export async function editInlineEmail(c:DashboardContext,id:string,expectedHash:string,edit:{text:string;subject:string;to:string;cc:string[];bcc:string[];attachments:{id:string;hash:string}[]}){
 const {row,p}=await owned(c,id);if(row.tool!=='send_email'||row.status!=='awaiting_approval'||row.input_hash!==expectedHash)throw new AssistantError('review_changed','This review changed. Refresh it first.',409);
 const previous=emailSchema.parse(row.input);
 if(previous.replyMode!=='new'&&(edit.subject!==previous.subject||edit.to!==previous.to||canonical(edit.cc)!==canonical(previous.cc)||canonical(edit.bcc)!==canonical(previous.bcc)))throw new AssistantError('reply_target','Reply recipients and subject come from the current conversation. Ask for a new reply or reply-all proposal to change them.');
 const input=emailSchema.parse({...previous,...edit,requestId:randomUUID()}),nextId=randomUUID(),fingerprint=hash(canonical({name:'send_email',input}));
 return asAssistant(p,['conversations:read','mail:send'],true,async fresh=>{
  const review=await reviewContext(fresh,'send_email',input),db=await getDatabasePool().connect();
  try{await db.query('BEGIN');const old=await db.query("UPDATE assistant_actions SET status='cancelled',error_code='edited_proposal',updated_at=now() WHERE id=$1 AND input_hash=$2 AND status='awaiting_approval' RETURNING id",[id,expectedHash]);if(!old.rowCount)throw new AssistantError('review_changed','This review changed. Refresh it first.',409);
   await db.query("INSERT INTO assistant_actions(id,grant_id,workspace_id,user_id,tool,input_hash,idempotency_key,status,input,review_context) VALUES($1,$2,$3,$4,'send_email',$5,$6,'awaiting_approval',$7::jsonb,$8::jsonb)",[nextId,p.grantId,c.workspace.id,c.user.id,fingerprint,'edit-'+nextId,JSON.stringify(input),JSON.stringify(review)]);
   await db.query("UPDATE assistant_chat_turns SET waiting_action_id=$2,activity=(SELECT COALESCE(jsonb_agg(CASE WHEN item->>'reviewUrl' LIKE '%'||$1::uuid::text||'%' THEN jsonb_set(item,'{reviewUrl}',to_jsonb(replace(item->>'reviewUrl',$1::uuid::text,$2::uuid::text))) ELSE item END ORDER BY position),'[]'::jsonb) FROM jsonb_array_elements(activity) WITH ORDINALITY AS entries(item,position)) WHERE waiting_action_id=$1 AND status='waiting'",[id,nextId]);
   await db.query("UPDATE assistant_employee_notifications SET resolved_at=now() WHERE source_type='action' AND source_id=$1 AND resolved_at IS NULL",[id]);await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  return inlineReview(c,nextId);
 });
}
export async function checkInlineEmail(c:DashboardContext,id:string){
 const {row,p}=await owned(c,id);if(row.tool!=='send_email'||!['running','outcome_unknown','succeeded','failed'].includes(row.status))throw new AssistantError('review_state','This email has not been submitted.');
 const input=emailSchema.parse(row.input),status=await asAssistant(p,['conversations:read'],false,fresh=>checkInboxSend(fresh.context,input.mailboxId,input.requestId));
 const db=getDatabasePool();if(status.state!=='unknown'){
  await db.query("UPDATE assistant_actions SET status=$2,result=$3::jsonb,error_code=NULL,updated_at=now() WHERE id=$1 AND status IN ('running','outcome_unknown','succeeded')",[id,status.state==='accepted'?'succeeded':'failed',JSON.stringify(status)]);
  if(status.state==='accepted')await db.query("UPDATE assistant_chat_turns SET status='waiting' WHERE waiting_action_id=$1 AND status='outcome_unknown' AND engine_state IS NOT NULL",[id]);
 }
 return inlineReview(c,id);
}
