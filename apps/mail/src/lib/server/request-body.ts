export class BodyLimitError extends Error {}
/** Bound bytes while reading, including requests without Content-Length. */
export async function readLimitedText(body:ReadableStream<Uint8Array>|null,limit:number):Promise<string>{
 if(!body)return '';const reader=body.getReader(),decoder=new TextDecoder();let size=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new BodyLimitError('Request too large');}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}
}
