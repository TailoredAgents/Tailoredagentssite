import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getDatabasePool} from '@/lib/dashboard/db';
import type {Principal} from './oauth';
import {AssistantError} from './config';
export const memorySchema=z.object({id:z.uuid().optional(),expectedRevision:z.number().int().positive().optional(),title:z.string().trim().min(1).max(200),body:z.string().trim().min(1).max(4000)}).refine(v=>!v.id||!!v.expectedRevision,'Read the memory revision before changing it.');
export async function searchMemories(p:Principal,query='',page=1){
 const r=await getDatabasePool().query(`SELECT id,title,body,revision,updated_at FROM assistant_memories WHERE workspace_id=$1 AND user_id=$2 AND archived_at IS NULL AND ($3='' OR to_tsvector('simple',title||' '||body) @@ plainto_tsquery('simple',$3)) ORDER BY updated_at DESC,id LIMIT 21 OFFSET $4`,[p.context.workspace.id,p.context.user.id,query,(page-1)*20]);
 return {items:r.rows.slice(0,20),hasMore:r.rows.length>20,page,visibility:'Private to this employee. Saved until explicitly forgotten; not proof of a completed action.'};
}
export async function saveMemory(p:Principal,raw:unknown){
 const v=memorySchema.parse(raw),values=[v.id??randomUUID(),p.context.workspace.id,p.context.user.id,v.title,v.body];
 const r=v.id?await getDatabasePool().query(`UPDATE assistant_memories SET title=$4,body=$5,revision=revision+1,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND archived_at IS NULL AND revision=$6 RETURNING id,revision`,[...values,v.expectedRevision]):await getDatabasePool().query('INSERT INTO assistant_memories(id,workspace_id,user_id,title,body) VALUES($1,$2,$3,$4,$5) RETURNING id,revision',values);
 if(!r.rowCount)throw new AssistantError('stale_memory','This memory changed or is unavailable. Read it again.',409);return r.rows[0];
}
export async function forgetMemory(p:Principal,id:string,revision:number){
 const r=await getDatabasePool().query(`UPDATE assistant_memories SET archived_at=now(),body='',title='Forgotten memory',revision=revision+1,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND revision=$4 AND archived_at IS NULL RETURNING id`,[id,p.context.workspace.id,p.context.user.id,revision]);
 if(!r.rowCount)throw new AssistantError('stale_memory','This memory changed or is unavailable.',409);return {forgotten:true,id};
}
export async function searchChatHistory(p:Principal,query:string,page=1){
 const r=await getDatabasePool().query(`SELECT t.id,t.thread_id,c.title,t.created_at,left(t.user_message,4000) user_message,left(t.assistant_message,6000) assistant_message,t.status,length(t.user_message)>4000 OR length(t.assistant_message)>6000 excerpt FROM assistant_chat_turns t JOIN assistant_chat_threads c ON c.id=t.thread_id WHERE c.workspace_id=$1 AND c.user_id=$2 AND to_tsvector('simple',t.user_message||' '||t.assistant_message) @@ plainto_tsquery('simple',$3) ORDER BY t.created_at DESC,t.id DESC LIMIT 11 OFFSET $4`,[p.context.workspace.id,p.context.user.id,query,(page-1)*10]);
 return {items:r.rows.slice(0,10),hasMore:r.rows.length>10,page,notice:'Historical statements may be outdated. Search covers all retained private conversations, not just recent model context. Excerpts are labeled.'};
}
