import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError} from './config';
import type {Principal} from './oauth';
import {assertTurnActive} from './chat-store';
import {DEFAULT_PROFILE,resolveProfile,outputLimit,modelCost,modelReservation,transferableInput,type ModelProfile} from './model-policy';

const outputItem=z.object({type:z.string(),name:z.string().optional(),arguments:z.string().optional(),call_id:z.string().optional(),content:z.array(z.object({type:z.string(),text:z.string().optional(),refusal:z.string().optional()}).passthrough()).optional()}).passthrough();
export const chatResponseSchema=z.object({status:z.literal('completed'),output:z.array(outputItem),usage:z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()})});
export type ChatResponse=z.infer<typeof chatResponseSchema>;
export async function requestChatResponse(p:Principal,turnId:string,step:number,payload:Record<string,unknown>,hosted?:'web'|'calculation'|'image',requested:ModelProfile=DEFAULT_PROFILE):Promise<ChatResponse>{
 if(!process.env.OPENAI_API_KEY?.trim()||process.env.ASSISTANT_CHAT_ENABLED==='false')throw new AssistantError('not_configured','Dashboard chat is not configured yet.',503);
 await assertTurnActive(p,turnId);
 const prior=(await getDatabasePool().query('SELECT status,response FROM assistant_chat_requests WHERE turn_id=$1 AND step=$2 AND workspace_id=$3',[turnId,step,p.context.workspace.id])).rows[0];
 if(prior){if(prior.status==='completed'&&prior.response)return chatResponseSchema.parse(prior.response);throw new AssistantError('provider_outcome_unknown','A previous AI request has an uncertain outcome. Its allowance remains reserved; this step will not be charged again automatically.',409);}
 const history=(await getDatabasePool().query('SELECT model,effort,status FROM assistant_chat_requests WHERE turn_id=$1 AND workspace_id=$2 ORDER BY step DESC',[turnId,p.context.workspace.id])).rows;
 const profile=resolveProfile(requested,history);
 const serialized=JSON.stringify({...payload,input:transferableInput(payload.input,history.some(r=>r.model!==profile.model)),model:profile.model,service_tier:'default',store:false,reasoning:{effort:profile.effort},max_output_tokens:outputLimit(profile),include:['reasoning.encrypted_content']});
 if(hosted&&hosted!=='image'&&!p.scopes.includes('research:use'))throw new AssistantError('insufficient_scope','Enable research and calculations in Chat settings.',403);
 // One hosted call only. Reserve conservatively for intermediate model context
 // and a fresh 1 GB container. Uncertain requests retain this reservation.
 const hostedReservation=hosted==='web'?700000:hosted==='calculation'?6000000:hosted==='image'?250000:0;
 // Visual inputs are server-rendered at <=768px. Reserve 100,000 additional input tokens
 // conservatively, instead of treating base64 bytes as text tokens.
 const estimated=hosted==='image'?serialized.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g,'[bounded document image]'):serialized;
 const reservation=modelReservation(profile,Buffer.byteLength(estimated))+hostedReservation*(profile.model==='gpt-6-astra'?5:1),requestId=randomUUID();
 const db=await getDatabasePool().connect();let month='';
 try{
  await db.query('BEGIN');
  const turn=(await db.query(`SELECT id,max_cost_micros,budget_managed FROM assistant_chat_turns WHERE id=$1 AND grant_id=$2 AND status IN ('queued','running') FOR UPDATE`,[turnId,p.grantId])).rows[0];
  if(!turn)throw new AssistantError('stopped','This reply stopped.',409);
  if(profile.model==='gpt-6-astra'){
   const lockedHistory=(await db.query('SELECT model,effort,status FROM assistant_chat_requests WHERE turn_id=$1',[turnId])).rows;
   if(resolveProfile(profile,lockedHistory).model!==profile.model)throw new AssistantError('routing_changed','Another step used the remaining Astra allowance. Resume with Sol before continuing.',409);
  }
  const spent=Number((await db.query('SELECT COALESCE(sum(amount_micros),0) amount FROM assistant_chat_requests WHERE turn_id=$1',[turnId])).rows[0].amount);
  if(!turn.budget_managed&&spent+reservation>Number(turn.max_cost_micros))throw new AssistantError('assignment_budget','This assignment reached its spending limit. Saved work remains available. Raise this assignment’s limit to continue within the company allowance.',429);
  const setting=(await db.query<{monthly_limit_micros:string;uncapped:boolean}>('SELECT monthly_limit_micros,uncapped FROM assistant_chat_settings WHERE workspace_id=$1 FOR UPDATE',[p.context.workspace.id])).rows[0];
  if(!setting||(!setting.uncapped&&Number(setting.monthly_limit_micros)===0))throw new AssistantError('budget_not_set','An owner or administrator needs to set the company’s monthly assistant allowance.',403);
  month=(await db.query<{month:string}>(`SELECT to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-01') AS month`)).rows[0].month;
  await db.query('INSERT INTO assistant_chat_usage(workspace_id,month) VALUES($1,$2) ON CONFLICT DO NOTHING',[p.context.workspace.id,month]);
  if(!(await db.query(`UPDATE assistant_chat_usage SET amount_micros=amount_micros+$3 WHERE workspace_id=$1 AND month=$2 AND ($5 OR amount_micros+$3<=$4) RETURNING month`,[p.context.workspace.id,month,reservation,setting.monthly_limit_micros,setting.uncapped])).rowCount)throw new AssistantError('budget_exhausted','The company assistant has reached its monthly allowance. Work already recorded remains saved.',429);
  await db.query('INSERT INTO assistant_chat_requests(id,turn_id,workspace_id,month,step,amount_micros,model,effort) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[requestId,turnId,p.context.workspace.id,month,step,reservation,profile.model,profile.effort]);
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 // A provider request is attempted once. Unknown outcomes keep the full reservation.
 const response=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000),
  headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY.trim()}`,'content-type':'application/json'},body:serialized,
 });
 if(!response.ok){await response.body?.cancel();throw new AssistantError('provider_unavailable','The AI service could not finish this reply. Check the activity before repeating any work.',503);}
 const reader=response.body?.getReader();if(!reader)throw new Error('empty_provider_reply');
 const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const c=await reader.read();if(c.done)break;size+=c.value.byteLength;if(size>512000){await reader.cancel();throw new Error('oversized_provider_reply');}chunks.push(c.value);}}finally{reader.releaseLock();}
 const result=chatResponseSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
 const hostedCost=result.output.reduce((sum,item)=>sum+(item.type==='web_search_call'?10000:item.type==='code_interpreter_call'?30000:0),0);
 const cost=modelCost(profile,result.usage.input_tokens,result.usage.output_tokens)+hostedCost;
 const ledger=await getDatabasePool().connect();
 try{
  await ledger.query('BEGIN');
  const claimed=await ledger.query("UPDATE assistant_chat_requests SET status='completed',amount_micros=$2,response=$3::jsonb WHERE id=$1 AND status='reserved' RETURNING id",[requestId,cost,JSON.stringify(result)]);
  if(claimed.rowCount)await ledger.query('UPDATE assistant_chat_usage SET amount_micros=amount_micros-$3+$4 WHERE workspace_id=$1 AND month=$2',[p.context.workspace.id,month,reservation,cost]);
  await ledger.query('COMMIT');
 }catch(e){await ledger.query('ROLLBACK');throw e;}finally{ledger.release();}
 if(cost>reservation)throw new AssistantError('usage_bound','This reply exceeded its usage estimate. Processing stopped; the full usage was recorded.',503);
 return result;
}
