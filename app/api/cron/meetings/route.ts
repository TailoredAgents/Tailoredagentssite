import {timingSafeEqual} from 'node:crypto';
import {json} from '@/lib/assistant/config';
import {runMeetingWorker} from '@/lib/meetings/worker';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=180;
export async function POST(request:Request){
 const expected=Buffer.from(process.env.SEARCH_CONSOLE_SYNC_SECRET?.trim()||''),supplied=Buffer.from(request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'');
 if(expected.length<32||supplied.length!==expected.length||!timingSafeEqual(expected,supplied))return json({ok:false},401);
 try{return json({ok:true,...await runMeetingWorker()});}catch{return json({ok:false,error:'meeting_worker_unavailable'},503);}
}
