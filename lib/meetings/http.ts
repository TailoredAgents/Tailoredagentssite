import {meetingError} from './access';
export async function boundedAudioBody(request:Request,limit:number){
 if(!request.headers.get('content-type')?.startsWith('application/octet-stream'))throw meetingError('Use binary audio.',415);
 if(Number(request.headers.get('content-length')||0)>limit)throw meetingError('Audio chunk is too large.',413);
 const reader=request.body?.getReader();if(!reader)throw meetingError('Audio bytes are required.');const parts:Uint8Array[]=[];let size=0;
 try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>limit){await reader.cancel();throw meetingError('Audio chunk is too large.',413);}parts.push(r.value);}}finally{reader.releaseLock();}
 return Buffer.concat(parts);
}
