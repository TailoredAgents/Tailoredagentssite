import {endpoint,limitRequest} from '@/lib/assistant/http';
import {json} from '@/lib/assistant/config';
import {boundedAudioBody} from '@/lib/meetings/http';
import {omiIdentity,receiveOmi} from '@/lib/meetings/omi';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export async function POST(request:Request){return endpoint(async()=>{
 // Omi currently only configures a URL, not a custom Authorization header.
 // This revocable 256-bit query credential is never logged by this handler.
 const u=new URL(request.url),secret=u.searchParams.get('token')||'',uid=u.searchParams.get('uid')||'',rate=Number(u.searchParams.get('sample_rate'));
 await limitRequest(request,'omi-edge',240);
 await omiIdentity(secret,uid);const bytes=await boundedAudioBody(request,1_920_000);
 return json(await receiveOmi(secret,uid,rate,bytes));
});}
