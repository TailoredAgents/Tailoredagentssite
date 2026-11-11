import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {getDatabasePool} from '@/lib/dashboard/db';
import type {Principal} from './oauth';
import {asAssistant} from './access';
import {AssistantError} from './config';
import {dictationDuration,type DictationResult} from './dictation-contract';
const RESERVATION=50000;
// gpt-transcribe, $0.0045/minute. Official pricing checked November 10, 2026.
const cost=(seconds:number)=>Math.ceil(Math.ceil(seconds)*75);
const resultSchema=z.object({text:z.string().max(8000),usage:z.object({type:z.enum(['duration','tokens']),seconds:z.number().nonnegative().max(120).optional()}).optional()});
export async function readDictation(p:Principal,id:string):Promise<DictationResult>{return asAssistant(p,['operations:read'],false,async fresh=>{
 const row=(await getDatabasePool().query('SELECT * FROM assistant_dictations WHERE id=$1 AND workspace_id=$2 AND user_id=$3',[z.uuid().parse(id),fresh.context.workspace.id,fresh.context.user.id])).rows[0];
 if(!row||row.deleted_at||row.expires_at<=new Date())throw new AssistantError('dictation_unavailable','This voice-note preview expired or was discarded.',404);
 return {id:row.id,status:row.status==='reserved'&&row.created_at<new Date(Date.now()-60000)?'unknown':row.status,transcript:row.transcript,cost:Number(row.amount_micros)/1e6,expiresAt:row.expires_at.toISOString(),note:row.status==='completed'?'Review names, numbers and wording before using this text.':'No automatic retry. An uncertain request keeps its allowance reserved.'};
});}
export async function discardDictation(p:Principal,id:string){return asAssistant(p,['operations:read'],false,f=>getDatabasePool().query('UPDATE assistant_dictations SET transcript=NULL,deleted_at=now() WHERE id=$1 AND workspace_id=$2 AND user_id=$3',[z.uuid().parse(id),f.context.workspace.id,f.context.user.id]).then(()=>undefined));}
export async function transcribeDictation(p:Principal,id:string,bytes:Uint8Array){
 z.uuid().parse(id);let seconds:number;try{seconds=dictationDuration(bytes);}catch(e){throw new AssistantError('dictation_audio',e instanceof Error?e.message:'Invalid recording.');}
 const audioHash=createHash('sha256').update(bytes).digest('hex');let month='';
 const existing=await asAssistant(p,['operations:read'],false,async fresh=>{
  if(process.env.ASSISTANT_DICTATION_ENABLED==='false'||process.env.ASSISTANT_CHAT_ENABLED==='false'||!process.env.OPENAI_API_KEY?.trim())throw new AssistantError('dictation_disabled','Voice transcription is unavailable. You can still type your message.',503);
  const db=await getDatabasePool().connect();try{await db.query('BEGIN');
   const settings=(await db.query('SELECT monthly_limit_micros,uncapped FROM assistant_chat_settings WHERE workspace_id=$1 FOR UPDATE',[fresh.context.workspace.id])).rows[0];
   const prior=(await db.query('SELECT * FROM assistant_dictations WHERE id=$1',[id])).rows[0];if(prior){if(prior.workspace_id!==fresh.context.workspace.id||prior.user_id!==fresh.context.user.id||prior.audio_hash!==audioHash)throw new AssistantError('dictation_conflict','This voice-note identifier belongs to another recording.',409);await db.query('COMMIT');return true;}
   if(!settings||(!settings.uncapped&&Number(settings.monthly_limit_micros)<RESERVATION))throw new AssistantError('budget_exhausted','The company assistant allowance cannot cover this voice note.',429);
   if((await db.query("SELECT 1 FROM assistant_dictations WHERE workspace_id=$1 AND user_id=$2 AND status='reserved' AND created_at>now()-interval '1 minute'",[fresh.context.workspace.id,fresh.context.user.id])).rowCount)throw new AssistantError('dictation_busy','Wait for your current voice note to finish.',409);
   month=(await db.query("SELECT to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-01') AS month")).rows[0].month;
   await db.query('INSERT INTO assistant_chat_usage(workspace_id,month) VALUES($1,$2) ON CONFLICT DO NOTHING',[fresh.context.workspace.id,month]);
   if(!(await db.query('UPDATE assistant_chat_usage SET amount_micros=amount_micros+$3 WHERE workspace_id=$1 AND month=$2 AND ($5 OR amount_micros+$3<=$4) RETURNING month',[fresh.context.workspace.id,month,RESERVATION,settings.monthly_limit_micros,settings.uncapped])).rowCount)throw new AssistantError('budget_exhausted','The company assistant has reached its monthly allowance.',429);
   await db.query('INSERT INTO assistant_dictations(id,workspace_id,user_id,grant_id,audio_hash,seconds,month,amount_micros) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,fresh.context.workspace.id,fresh.context.user.id,fresh.grantId,audioHash,seconds,month,RESERVATION]);await db.query('COMMIT');return false;
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 });
 if(existing)return readDictation(p,id);
 let issued=false;
 try{
  await asAssistant(p,['operations:read'],false,async()=>{});
  const form=new FormData();form.set('model','gpt-transcribe');form.set('file',new Blob([new Uint8Array(bytes)],{type:'audio/wav'}),'voice-note.wav');issued=true;
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{authorization:'Bearer '+process.env.OPENAI_API_KEY!.trim()},body:form,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(45000)});
  if(!response.ok){await response.body?.cancel();throw Error('transcription_unconfirmed');}
  const reader=response.body?.getReader();if(!reader)throw Error('transcription_empty');const chunks:Uint8Array[]=[];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>100000){await reader.cancel();throw Error('transcription_large');}chunks.push(r.value);}}finally{reader.releaseLock();}
  const result=resultSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))),amount=cost(Math.max(seconds,result.usage?.seconds??0));
  const db=await getDatabasePool().connect();try{await db.query('BEGIN');const saved=await db.query("UPDATE assistant_dictations SET status='completed',transcript=CASE WHEN deleted_at IS NULL AND expires_at>now() THEN $2 ELSE NULL END,amount_micros=$3,cost_basis=$4 WHERE id=$1 AND status='reserved' RETURNING id",[id,result.text,amount,result.usage?.seconds!==undefined?'provider_duration':'measured_audio']);if(saved.rowCount)await db.query('UPDATE assistant_chat_usage SET amount_micros=amount_micros-$3+$4 WHERE workspace_id=$1 AND month=$2',[p.context.workspace.id,month,RESERVATION,amount]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }catch{
  const db=await getDatabasePool().connect();try{await db.query('BEGIN');const saved=await db.query("UPDATE assistant_dictations SET status=$2,amount_micros=CASE WHEN $3 THEN amount_micros ELSE 0 END WHERE id=$1 AND status='reserved' RETURNING id",[id,issued?'unknown':'failed',issued]);if(saved.rowCount&&!issued)await db.query('UPDATE assistant_chat_usage SET amount_micros=amount_micros-$3 WHERE workspace_id=$1 AND month=$2',[p.context.workspace.id,month,RESERVATION]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 return readDictation(p,id);
}
