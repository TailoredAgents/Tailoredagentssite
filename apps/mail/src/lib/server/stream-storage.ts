import type { R2Bucket, R2UploadedPart } from '@cloudflare/workers-types';
/** Multipart writes accept streams without Content-Length and keep memory bounded. */
export async function storeResponse(bucket: R2Bucket,key: string,response: Response,contentType='application/octet-stream',limit=100*1024*1024): Promise<void> {
  if (!response.body) throw new Error('Download body missing');
  if (Number(response.headers.get('content-length'))>limit) throw new Error('Incoming file exceeds storage safety limit');
  const upload=await bucket.createMultipartUpload(key,{httpMetadata:{contentType}});
  const reader=response.body.getReader(), parts:R2UploadedPart[]=[];
  let buffer=new Uint8Array(5*1024*1024), used=0, total=0;
  try {
    while(true){
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;if(total>limit)throw new Error('Incoming file exceeds storage safety limit');
      for(let offset=0;offset<value.length;){
        const n=Math.min(buffer.length-used,value.length-offset);buffer.set(value.subarray(offset,offset+n),used);used+=n;offset+=n;
        if(used===buffer.length){parts.push(await upload.uploadPart(parts.length+1,buffer));buffer=new Uint8Array(buffer.length);used=0;}
      }
    }
    if(used)parts.push(await upload.uploadPart(parts.length+1,buffer.subarray(0,used)));
    if(parts.length)await upload.complete(parts);else{await upload.abort();await bucket.put(key,'',{httpMetadata:{contentType}});}
  }catch(error){await reader.cancel().catch(()=>{});await upload.abort().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
}
