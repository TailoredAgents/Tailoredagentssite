import {after} from 'next/server';
import {z} from 'zod';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {AssistantError,json} from '@/lib/assistant/config';
import {checkOrigin,endpoint} from '@/lib/assistant/http';
import {listDocuments,storeDocument,processDocuments} from '@/lib/assistant/documents';
import {DOCUMENT_MAX_BYTES} from '@/lib/assistant/document-contract';
import {cardRateLimit} from '@/lib/smart-cards/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function identity(){const c=await getOptionalDashboardContext();if(!c)throw new AssistantError('unauthorized','Sign in to use your documents.',401);return c;}
export async function GET(){return endpoint(async()=>{const data=await listDocuments(await identity());const pending=data.items.find(d=>d.owned&&['queued','processing'].includes(d.status));if(pending)after(()=>processDocuments(1,pending.id).then(()=>undefined));return json(data);});}
export async function POST(request:Request){return endpoint(async()=>{
 checkOrigin(request,true);const c=await identity();await cardRateLimit('assistant:upload',c.user.id,10,3600);
 const idempotency=z.uuid().parse(request.headers.get('idempotency-key'));let name:string;try{name=decodeURIComponent(request.headers.get('x-file-name')??'');}catch{throw new AssistantError('invalid_name','Choose a file with a valid filename.');}
 if(!name||name.length>180)throw new AssistantError('invalid_name','Use a filename up to 180 characters.');
 const reader=request.body?.getReader();if(!reader)throw new AssistantError('empty_file','Choose a file first.');const parts:Uint8Array[]=[];let size=0;
 try{for(;;){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>DOCUMENT_MAX_BYTES){await reader.cancel();throw new AssistantError('document_size','Choose a file up to 10 MB.',413);}parts.push(v.value);}}finally{reader.releaseLock();}
 const file=await storeDocument(c,{idempotency,name,bytes:Buffer.concat(parts)});after(()=>processDocuments(1,file.id).then(()=>undefined));return json({document:file},202);
});}
