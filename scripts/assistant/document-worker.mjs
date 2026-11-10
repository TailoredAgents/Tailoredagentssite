import {parentPort,workerData} from 'node:worker_threads';
// A bounded parser worker receives only document bytes, never application secrets.
globalThis.fetch=async()=>{throw Error('Remote resources are disabled for documents.');};
try{
 const {parseDocument,documentImage}=await import('./document-parser.mjs');
 if(workerData.operation==='export'){const bytes=await (await import('./document-renderer.mjs')).renderDocument(workerData.input);const extracted=await parseDocument(bytes,workerData.input.format);parentPort.postMessage({ok:true,result:{bytes,extracted}});}
 else {
 const result=workerData.operation==='render'?await (await import('./document-renderer.mjs')).renderDocument(workerData.input):workerData.operation==='image'?await documentImage(workerData.bytes,workerData.extension,workerData.page):await parseDocument(workerData.bytes,workerData.extension);
 parentPort.postMessage({ok:true,result});
 }
}catch(error){parentPort.postMessage({ok:false,error:error instanceof Error?error.message:'Document processing failed.'});}
