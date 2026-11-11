import {z} from 'zod';
import {headers} from 'next/headers';
import {after} from 'next/server';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {getDashboardAuth} from '@/lib/dashboard/auth';
import {AssistantError,json} from '@/lib/assistant/config';
import {body,checkOrigin,endpoint} from '@/lib/assistant/http';
import {chatRequestSchema} from '@/lib/assistant/chat-contract';
import {chatState,connectNative,nativePrincipal,saveChatBudget,stopChatTurn,beginChatTurn} from '@/lib/assistant/chat-store';
import {runAssistantWorker} from '@/lib/assistant/chat-worker';
import {cardRateLimit} from '@/lib/smart-cards/http';
import {forgetMemory} from '@/lib/assistant/memory';
import {setRoutineEnabled} from '@/lib/assistant/routines';
import {controlAssignment} from '@/lib/assistant/assignments';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=180;
async function identity(){
 const context=await getOptionalDashboardContext();
 const session=await getDashboardAuth()?.api.getSession({headers:await headers()});
 if(!context||!session||session.user.id!==context.user.id)throw new AssistantError('unauthorized','Sign in again to use your assistant.',401);
 return {context,sessionId:session.session.id};
}
export async function GET(request:Request){return endpoint(async()=>{
 const {context,sessionId}=await identity();
 const raw=new URL(request.url).searchParams.get('thread');const thread=raw?z.uuid().parse(raw):undefined;
 return json(await chatState(context,sessionId,thread));
});}
export async function POST(request:Request){return endpoint(async()=>{
 checkOrigin(request,true);
 const {context,sessionId}=await identity();const v=chatRequestSchema.parse(await body(request,40000));
 if(v.operation==='connect')await connectNative(context,sessionId,v.mode,v.conversations,v);
 if(v.operation==='budget')await saveChatBudget(context,v.dollars,v.uncapped);
 if(v.operation==='stop')await stopChatTurn(context,v.threadId,v.requestId);
 if(v.operation==='assignment'){await controlAssignment(context,v);if(v.action==='resume')after(()=>runAssistantWorker(v.id,30).then(()=>undefined));}
 if(v.operation==='forget')await forgetMemory(await nativePrincipal(context,sessionId),v.id,v.revision);
 if(v.operation==='routine')await setRoutineEnabled(await nativePrincipal(context,sessionId),v.id,v.revision,v.enabled);
 if(v.operation==='send'){
  await cardRateLimit('assistant:chat',context.user.id,6,60);
  const p=await nativePrincipal(context,sessionId);
  if(await beginChatTurn(p,v.threadId,v.requestId,v.message,v.maxCostDollars,v.fileIds,v.maxCostDollars===undefined))after(()=>runAssistantWorker(v.requestId,30).then(()=>undefined));
 }
 return json(await chatState(context,sessionId,'threadId' in v?v.threadId:undefined));
});}
