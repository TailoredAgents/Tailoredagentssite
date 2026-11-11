import {z} from 'zod';
import {headers} from 'next/headers';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {getDashboardAuth} from '@/lib/dashboard/auth';
import {AssistantError,json} from '@/lib/assistant/config';
import {checkOrigin,endpoint} from '@/lib/assistant/http';
import {nativePrincipal} from '@/lib/assistant/chat-store';
import {readDictation,discardDictation,transcribeDictation} from '@/lib/assistant/dictation';
import {DICTATION_MAX_BYTES} from '@/lib/assistant/dictation-contract';
import {cardRateLimit} from '@/lib/smart-cards/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
async function identity(){const c=await getOptionalDashboardContext(),session=await getDashboardAuth()?.api.getSession({headers:await headers()});if(!c||session?.user.id!==c.user.id)throw new AssistantError('unauthorized','Sign in again.',401);return nativePrincipal(c,session.session.id);}
const id=(r:Request)=>z.uuid().parse(new URL(r.url).searchParams.get('id'));
export async function GET(r:Request){return endpoint(async()=>json(await readDictation(await identity(),id(r))))}
export async function DELETE(r:Request){return endpoint(async()=>{checkOrigin(r,true);await discardDictation(await identity(),id(r));return json({discarded:true});});}
export async function POST(r:Request){return endpoint(async()=>{
 checkOrigin(r,true);const p=await identity(),requestId=id(r);await cardRateLimit('assistant:dictation',p.context.user.id,6,60);
 if(r.headers.get('content-type')!=='audio/wav')throw new AssistantError('dictation_audio','Use the voice-note recorder.');
 if(Number(r.headers.get('content-length'))>DICTATION_MAX_BYTES)throw new AssistantError('dictation_size','Keep voice notes under two minutes.',413);
 const reader=r.body?.getReader();if(!reader)throw new AssistantError('dictation_audio','No recording was received.');const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>DICTATION_MAX_BYTES){await reader.cancel();throw new AssistantError('dictation_size','Keep voice notes under two minutes.',413);}chunks.push(next.value);}}finally{reader.releaseLock();}
 return json(await transcribeDictation(p,requestId,Buffer.concat(chunks)));
});}
