import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {endpoint} from '@/lib/assistant/http';
import {privateHeaders} from '@/lib/assistant/config';
import {meetingError} from '@/lib/meetings/access';
import {readAudio} from '@/lib/meetings/service';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return endpoint(async()=>{
 const c=await getOptionalDashboardContext();if(!c)throw meetingError('Sign in first.',401);
 const {id}=await params,{bytes,mime}=await readAudio(c,id);const headers={...privateHeaders,'Content-Type':mime,'Accept-Ranges':'bytes','Content-Disposition':'inline; filename="meeting-audio"'};
 const range=request.headers.get('range');if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});const start=Number(match[1]),end=Math.min(match[2]?Number(match[2]):bytes.length-1,bytes.length-1);if(start>end||!Number.isSafeInteger(start))return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});return new Response(new Uint8Array(bytes.slice(start,end+1)),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${bytes.length}`}});}
 return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Length':String(bytes.length)}});
});}
