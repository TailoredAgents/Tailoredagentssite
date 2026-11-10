import {after} from 'next/server';
import {z} from 'zod';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {body,checkOrigin,endpoint} from '@/lib/assistant/http';
import {json} from '@/lib/assistant/config';
import {cardRateLimit} from '@/lib/smart-cards/http';
import {getMeeting,meetingError} from '@/lib/meetings/access';
import * as service from '@/lib/meetings/service';
import * as omi from '@/lib/meetings/omi';
import {meetingKinds} from '@/lib/meetings/contract';
import {runMeetingWorker} from '@/lib/meetings/worker';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=180;
async function identity(){const c=await getOptionalDashboardContext();if(!c)throw meetingError('Sign in to use Meeting Inbox.',401);return c;}
export async function GET(request:Request){return endpoint(async()=>{
 const c=await identity(),u=new URL(request.url);
 if(u.searchParams.get('search'))return json(await service.searchMeetingTargets(c,u.searchParams.get('search')!));
 if(u.searchParams.get('id'))return json(service.meetingPublicRecord(await getMeeting(c,u.searchParams.get('id')!)));
 return json(await service.listMeetings(c,u.searchParams.get('q')||'',Number(u.searchParams.get('page')||1)));
});}
export async function POST(request:Request){return endpoint(async()=>{
 checkOrigin(request,true);const c=await identity();await cardRateLimit('meetings:control',c.user.id,120,60);
 const v=await body(request,60000),id=()=>z.uuid().parse(v.id);let result:unknown={ok:true};
 switch(v.operation){
 case 'start':{const {operation:_operation,...input}=v;result=await service.startUpload(c,input);break;}
 case 'finish':result=await service.finishUpload(c,id());break;
 case 'separate':result=await service.separateMeeting(c,v);break;
 case 'process':await service.queueMeeting(c,id(),z.string().parse(v.consentNote));after(()=>runMeetingWorker(id()).then(()=>undefined));break;
 case 'update':await service.updateMeeting(c,v);break;
 case 'link':await service.linkMeeting(c,id(),z.enum(meetingKinds).parse(v.kind),z.uuid().parse(v.targetId));break;
 case 'unlink':await service.unlinkMeeting(c,id(),z.enum(meetingKinds).parse(v.kind));break;
 case 'createProspect':result=await service.createMeetingProspect(c,v);break;
 case 'delete':await service.deleteMeeting(c,id(),z.literal(true).parse(v.confirmed));break;
 case 'budget':await service.saveMeetingBudget(c,z.number().parse(v.dollars));break;
 case 'deviceCreate':result=await omi.createMeetingDevice(c,v);break;
 case 'deviceArm':await omi.armMeetingDevice(c,v);break;
 case 'deviceNext':await omi.nextOmiConversation(c,id());break;
 case 'deviceRevoke':await omi.revokeMeetingDevice(c,id());break;
 default:throw meetingError('Choose a supported action.');
 }
 return json(result);
});}
