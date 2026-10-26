import "server-only";
import {S3Client,PutObjectCommand,GetObjectCommand,ListObjectsV2Command,DeleteObjectsCommand} from "@aws-sdk/client-s3";
import {factoryStorageConfiguration} from "./build-config";

export type FactoryStorage={put(key:string,bytes:Uint8Array,contentType:string):Promise<void>;get(key:string,maximumBytes?:number):Promise<Uint8Array>;deletePrefix(prefix:string):Promise<void>};
const maximumArtifactBytes=64_000_000;
const keyPattern=/^factory\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-zA-Z0-9_./-]+$/;
export function validFactoryObjectKey(key:string){
  if(!keyPattern.test(key)||key.length>500||key.includes("//")||key.split("/").some(p=>p==="."||p===".."))throw new Error("Invalid website storage path.");
  return key;
}
function validCleanupScope(prefix:string){
  validFactoryObjectKey(prefix);
  // Only a complete build directory or an exact uploaded image may be removed.
  if(!/^factory\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(?:[0-9a-f-]{36}\/|uploads\/[0-9a-f-]{36}\.(?:png|jpg|webp))$/.test(prefix))throw new Error("Invalid website cleanup scope.");
}
function validMaximumBytes(value:number){
  if(!Number.isSafeInteger(value)||value<1||value>maximumArtifactBytes)throw new Error("Invalid website artifact size limit.");
}
function validContentType(value:string){
  if(value.length>255||!/^[-\w.+]+\/[-\w.+]+(?:;[\x20-\x7e]*)?$/.test(value))throw new Error("Invalid website artifact content type.");
}
class FactoryStorageRequestError extends Error {}
async function readArtifact(body:ReadableStream<Uint8Array>,maximumBytes:number,contentLength?:number){
  if(contentLength!==undefined&&(!Number.isSafeInteger(contentLength)||contentLength<0)){
    await body.cancel();throw new FactoryStorageRequestError("The website artifact is unavailable.");
  }
  if((contentLength??0)>maximumBytes){await body.cancel();throw new FactoryStorageRequestError("Website artifact is too large.");}
  const reader=body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>maximumBytes){await reader.cancel();throw new FactoryStorageRequestError("Website artifact is too large.");}chunks.push(r.value);}}finally{reader.releaseLock();}
  if(contentLength!==undefined&&contentLength!==length)throw new FactoryStorageRequestError("The website artifact is unavailable.");
  return Buffer.concat(chunks);
}
function renderStorage(origin:string,secret:string):FactoryStorage {
  async function request(path:string,params:Record<string,string>,options:RequestInit,expectedStatus:number){
    const url=new URL(path,origin);url.search=new URLSearchParams(params).toString();
    try{
      const response=await fetch(url,{...options,headers:{...options.headers,authorization:`Bearer ${secret}`},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(60000)});
      if(response.status!==expectedStatus||response.redirected){
        await response.body?.cancel();
        throw new FactoryStorageRequestError(response.status===404?"The website artifact is unavailable.":"Website storage could not complete the request.");
      }
      return response;
    }catch(error){
      if(error instanceof FactoryStorageRequestError)throw error;
      throw new FactoryStorageRequestError("Website storage could not complete the request.");
    }
  }
  return {
    async put(key,bytes,contentType){
      validFactoryObjectKey(key);validContentType(contentType);
      if(bytes.byteLength>maximumArtifactBytes)throw new Error("Website artifact is too large.");
      const response=await request("/internal/storage/object",{key},{method:"PUT",headers:{"content-type":contentType},body:new Uint8Array(bytes)},204);
      await response.body?.cancel();
    },
    async get(key,maximumBytes=maximumArtifactBytes){
      validFactoryObjectKey(key);validMaximumBytes(maximumBytes);
      const response=await request("/internal/storage/object",{key,maxBytes:String(maximumBytes)},{method:"GET"},200);
      if(!response.body)throw new FactoryStorageRequestError("The website artifact is unavailable.");
      try{
        const contentLength=response.headers.get("content-length");
        if(contentLength!==null&&!/^\d+$/.test(contentLength)){await response.body.cancel();throw new FactoryStorageRequestError("The website artifact is unavailable.");}
        return await readArtifact(response.body,maximumBytes,contentLength===null?undefined:Number(contentLength));
      }catch(error){
        if(error instanceof FactoryStorageRequestError)throw error;
        throw new FactoryStorageRequestError("The website artifact is unavailable.");
      }
    },
    async deletePrefix(prefix){
      validCleanupScope(prefix);
      const response=await request("/internal/storage/prefix",{prefix},{method:"DELETE"},204);
      await response.body?.cancel();
    },
  };
}
export function factoryStorage():FactoryStorage {
  const config=factoryStorageConfiguration();if(!config)throw new Error("Website storage is not configured.");
  if(config.backend==="render")return renderStorage(config.origin,config.secret);
  const client=new S3Client({region:"auto",endpoint:`https://${config.accountId}.r2.cloudflarestorage.com`,credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},maxAttempts:2});
  const bucket=config.bucket;
  return {
    async put(key,bytes,contentType){
      validFactoryObjectKey(key);validContentType(contentType);if(bytes.byteLength>maximumArtifactBytes)throw new Error("Website artifact is too large.");
      await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:contentType,CacheControl:"private, no-store"}),{abortSignal:AbortSignal.timeout(60000)});
    },
    async get(key,maximumBytes=maximumArtifactBytes){
      validFactoryObjectKey(key);validMaximumBytes(maximumBytes);
      const object=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(60000)});
      if(!object.Body)throw new Error("The website artifact is unavailable.");
      return readArtifact(object.Body.transformToWebStream(),maximumBytes,object.ContentLength);
    },
    async deletePrefix(prefix){
      validCleanupScope(prefix);
      let cursor:string|undefined;const deadline=Date.now()+9*60*1000;
      do{
        if(Date.now()>=deadline)throw new Error("Website cleanup needs another bounded pass.");
        const listing=await client.send(new ListObjectsV2Command({Bucket:bucket,Prefix:prefix,ContinuationToken:cursor,MaxKeys:1000}),{abortSignal:AbortSignal.timeout(60000)});
        const keys=(listing.Contents||[]).flatMap(o=>o.Key&&o.Key.startsWith(prefix)?[{Key:o.Key}]:[]);
        if(keys.length){if(Date.now()>=deadline)throw new Error("Website cleanup needs another bounded pass.");const result=await client.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:keys,Quiet:true}}),{abortSignal:AbortSignal.timeout(60000)});if(result.Errors?.length)throw new Error("Some website artifacts need another cleanup attempt.");}
        cursor=listing.IsTruncated?listing.NextContinuationToken:undefined;
      }while(cursor);
    },
  };
}
