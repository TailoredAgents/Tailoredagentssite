import 'server-only';
import {z} from 'zod';
import {hash} from './oauth';
import {AssistantError,assistantOrigin,failure,json} from './config';
import {cardRateLimit} from '@/lib/smart-cards/http';

export async function body(request:Request,limit=65536):Promise<Record<string,unknown>>{
 const reader=request.body?.getReader();if(!reader)throw new AssistantError('invalid_request','A request body is required.');
 let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>limit){await reader.cancel();throw new AssistantError('invalid_request','Request is too large.',413);}chunks.push(v.value);}}finally{reader.releaseLock();}
 const raw=Buffer.concat(chunks).toString('utf8');
 try{
  if(request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')){
   const p=new URLSearchParams(raw);if(new Set(p.keys()).size!==Array.from(p.keys()).length)throw new Error();return Object.fromEntries(p);
  }
  const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v))throw new Error();return v;
 }catch{throw new AssistantError('invalid_request','Use a valid JSON or form body.');}
}
export function checkOrigin(request:Request,required=false){
 const origin=request.headers.get('origin');
 if((required&&!origin)||(origin!==null&&origin!==assistantOrigin()))throw new AssistantError('access_denied','Use the Tailored Agents website for this action.',403);
}
export async function limitRequest(request:Request,bucket:string,limit=60){
 const ip=request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown';
 await cardRateLimit(`assistant:${bucket}`,hash(ip),limit,60);
}
export async function endpoint(fn:()=>Promise<Response>){
 try{return await fn();}catch(e){
  if(e instanceof z.ZodError)return json({error:'invalid_request',error_description:'Check the required fields and supported values.'},400);
  if(e && typeof e==='object' && 'status' in e && e.status===429)return json({error:'rate_limited',error_description:'Too many requests. Try again shortly.'},429);
  return failure(e);
 }
}
