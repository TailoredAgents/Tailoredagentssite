import {z} from 'zod';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {checkOrigin,endpoint} from '@/lib/assistant/http';
import {json} from '@/lib/assistant/config';
import {meetingError} from '@/lib/meetings/access';
import {uploadChunk} from '@/lib/meetings/service';
import {UPLOAD_CHUNK_BYTES} from '@/lib/meetings/contract';
import {boundedAudioBody} from '@/lib/meetings/http';
import {cardRateLimit} from '@/lib/smart-cards/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){return endpoint(async()=>{
 checkOrigin(request,true);const c=await getOptionalDashboardContext();if(!c)throw meetingError('Sign in first.',401);
 await cardRateLimit('meetings:upload',c.user.id,80,60);
 const {id}=await params;z.uuid().parse(id);const sequence=Number(new URL(request.url).searchParams.get('sequence'));
 await uploadChunk(c,id,sequence,await boundedAudioBody(request,UPLOAD_CHUNK_BYTES));return json({ok:true});
});}
