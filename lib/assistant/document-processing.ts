import 'server-only';
import {Worker} from 'node:worker_threads';
import {resolve} from 'node:path';
import {z} from 'zod';
import {AssistantError} from './config';
export const extractedDocumentSchema=z.object({kind:z.string(),mime:z.string(),chunks:z.array(z.object({key:z.string().max(40),location:z.string().max(300),text:z.string().max(6000)})).max(12000),warnings:z.array(z.string().max(500)).max(30)}).strict();
export type ExtractedDocument=z.infer<typeof extractedDocumentSchema>;
export async function documentWorker(input:Record<string,unknown>):Promise<unknown>{
 return new Promise((resolveResult,reject)=>{
  const worker=new Worker(resolve(process.cwd(),'scripts/assistant/document-worker.mjs'),{workerData:input,env:{},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:192,maxYoungGenerationSizeMb:24,stackSizeMb:4}});let done=false;
  const finish=(error:Error|null,result?:unknown)=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate();if(error)reject(error);else resolveResult(result);};
  const timer=setTimeout(()=>finish(new AssistantError('document_timeout','This document took too long to process. Split it into smaller files.',422)),20000);
  worker.on('error',()=>finish(new AssistantError('document_failed','This document could not be processed within the memory limit.',422)));
  worker.on('exit',()=>finish(new AssistantError('document_failed','Document processing stopped. Your upload remains saved.',422)));
  worker.on('message',(message)=>{if(message?.ok)finish(null,message.result);else finish(new AssistantError('document_failed',String(message?.error??'This document is unsupported.').slice(0,500),422));});
 });
}
export async function extractDocument(bytes:Uint8Array,extension:string){return extractedDocumentSchema.parse(await documentWorker({operation:'parse',bytes,extension}));}
