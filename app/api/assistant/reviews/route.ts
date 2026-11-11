import {z} from 'zod';
import {headers} from 'next/headers';
import {after} from 'next/server';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {getDashboardAuth} from '@/lib/dashboard/auth';
import {AssistantError,json} from '@/lib/assistant/config';
import {body,checkOrigin,endpoint} from '@/lib/assistant/http';
import {inlineReview,editInlineEmail,checkInlineEmail} from '@/lib/assistant/inline-review';
import {reviewAction} from '@/lib/assistant/actions';
import {advanceReviewedWork} from '@/lib/assistant/chat-worker';
import {cardRateLimit} from '@/lib/smart-cards/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=180;
async function identity(){const context=await getOptionalDashboardContext(),session=await getDashboardAuth()?.api.getSession({headers:await headers()});if(!context||session?.user.id!==context.user.id)throw new AssistantError('unauthorized','Sign in again.',401);return context;}
const schema=z.discriminatedUnion('operation',[
 z.object({operation:z.enum(['approve','reject']),id:z.uuid(),inputHash:z.string().length(64)}).strict(),
 z.object({operation:z.literal('status'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('edit'),id:z.uuid(),inputHash:z.string().length(64),text:z.string().min(1).max(12000),subject:z.string().min(1).max(500),to:z.string().min(1).max(4000),cc:z.array(z.email()).max(20),bcc:z.array(z.email()).max(20),attachments:z.array(z.object({id:z.uuid(),hash:z.string().length(64)}).strict()).max(5)}).strict(),
]);
export async function GET(request:Request){return endpoint(async()=>json(await inlineReview(await identity(),z.uuid().parse(new URL(request.url).searchParams.get('id')))));}
export async function POST(request:Request){return endpoint(async()=>{
 checkOrigin(request,true);const c=await identity(),v=schema.parse(await body(request,30000));await cardRateLimit('assistant:review',c.user.id,30,60);
 if(v.operation==='edit')return json(await editInlineEmail(c,v.id,v.inputHash,v));
 if(v.operation==='status'){const result=await checkInlineEmail(c,v.id);after(()=>advanceReviewedWork(c,v.id));return json(result);}
 await reviewAction(c,v.id,v.operation,v.inputHash);after(()=>advanceReviewedWork(c,v.id));return json(await inlineReview(c,v.id));
});}
