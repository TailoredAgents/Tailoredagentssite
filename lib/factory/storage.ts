import "server-only";
import {S3Client,PutObjectCommand,GetObjectCommand,ListObjectsV2Command,DeleteObjectsCommand} from "@aws-sdk/client-s3";
import {factoryStorageConfiguration} from "./build-config";

export type FactoryStorage={put(key:string,bytes:Uint8Array,contentType:string):Promise<void>;get(key:string,maximumBytes?:number):Promise<Uint8Array>;deletePrefix(prefix:string):Promise<void>};
const keyPattern=/^factory\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-zA-Z0-9_./-]+$/;
export function validFactoryObjectKey(key:string){
  if(!keyPattern.test(key)||key.length>500||key.includes("//")||key.split("/").some(p=>p==="."||p===".."))throw new Error("Invalid website storage path.");
  return key;
}
export function factoryStorage():FactoryStorage {
  const config=factoryStorageConfiguration();if(!config)throw new Error("Website storage is not configured.");
  const client=new S3Client({region:"auto",endpoint:`https://${config.accountId}.r2.cloudflarestorage.com`,credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey},maxAttempts:2});
  const bucket=config.bucket;
  return {
    async put(key,bytes,contentType){
      validFactoryObjectKey(key);if(bytes.byteLength>64_000_000)throw new Error("Website artifact is too large.");
      await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:contentType,CacheControl:"private, no-store"}),{abortSignal:AbortSignal.timeout(60000)});
    },
    async get(key,maximumBytes=64_000_000){
      validFactoryObjectKey(key);
      const object=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(60000)});
      if(!object.Body)throw new Error("The website artifact is unavailable.");
      if((object.ContentLength??0)>maximumBytes){await object.Body.transformToWebStream().cancel();throw new Error("Website artifact is too large.");}
      const reader=object.Body.transformToWebStream().getReader(),chunks:Uint8Array[]=[];let length=0;
      try{for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>maximumBytes){await reader.cancel();throw new Error("Website artifact is too large.");}chunks.push(r.value);}}finally{reader.releaseLock();}
      return Buffer.concat(chunks);
    },
    async deletePrefix(prefix){
      validFactoryObjectKey(prefix);
      // A cleanup key is an exact image or a complete project/version directory.
      if(!prefix.endsWith("/")&&!/\/uploads\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(prefix))throw new Error("Invalid website cleanup scope.");
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
