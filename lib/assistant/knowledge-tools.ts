import 'server-only';
import {z} from 'zod';
import type {Principal} from './oauth';
import {routinePolicy} from './routine-policy';
import {AssistantError} from './config';
import {asAssistant} from './access';
import {assertTurnActive} from './chat-store';
import {knowledgeDraftSchema} from './knowledge-contract';
import {listKnowledge,readKnowledge,draftKnowledge,knowledgeDraftKey} from './knowledge';
const tools=[
 {name:'find_company_knowledge',description:'Search explicitly published company guidance with current employee access. Private chats and draft guesses are not company knowledge. Search by topic, read the entry before relying on it, and report stale or conflicting guidance.',schema:z.object({query:z.string().max(200)}).strict()},
 {name:'read_company_knowledge',description:'Read a published, permissioned source version with its author, effective/review dates, citations and conflicting-topic count. Cite its real URL and version. If stale or conflicting, flag uncertainty and request human confirmation instead of silently choosing a policy.',schema:z.object({id:z.uuid()}).strict()},
 {name:'draft_company_knowledge',description:'When the employee explicitly asks to save shared guidance, prepare a PRIVATE draft for their review. Include provenance and actual source chunk IDs. Use replaces to correct a prior version owned by this employee. This tool NEVER publishes, changes sharing, or makes a guess approved company policy.',schema:knowledgeDraftSchema},
];
export const knowledgeModelTools=tools.map(t=>({type:'function',name:t.name,description:t.description,strict:true,parameters:z.toJSONSchema(t.schema,{io:'input'})}));
export const isKnowledgeTool=(name:string)=>tools.some(t=>t.name===name);
export async function invokeKnowledgeTool(p:Principal,turnId:string,name:string,raw:string){
 if(name==='draft_company_knowledge'&&routinePolicy.getStore()?.recommendationsOnly)throw new AssistantError('routine_read_only','This routine can read guidance but cannot change it.',403);
 await assertTurnActive(p,turnId);const input=tools.find(t=>t.name===name)!.schema.parse(JSON.parse(raw));
 return asAssistant(p,[name==='draft_company_knowledge'?'operations:write':'operations:read'],name==='draft_company_knowledge',async fresh=>{
  if(name==='find_company_knowledge'){const result=await listKnowledge(fresh.context,(input as {query:string}).query);return {...result,items:result.items.slice(0,15),hasMore:result.hasMore||result.items.length>15};}
  if(name==='read_company_knowledge')return readKnowledge(fresh.context,(input as {id:string}).id,turnId);
  const value=knowledgeDraftSchema.parse(input);return {draft:await draftKnowledge(fresh.context,value,knowledgeDraftKey(turnId,value)),notice:'Private draft only. The employee must review it and publish from its link. Do not claim this is approved company guidance.'};
 });
}
