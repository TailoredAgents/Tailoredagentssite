import {z} from 'zod';
import {getDashboardAuth} from '@/lib/dashboard/auth';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {finishConsent} from '@/lib/assistant/oauth';
import {checkOrigin,endpoint,body,limitRequest} from '@/lib/assistant/http';
import {AssistantError,privateHeaders} from '@/lib/assistant/config';
export const runtime='nodejs';
export async function POST(request:Request){return endpoint(async()=>{
 checkOrigin(request,true);await limitRequest(request,'consent',20);
 const context=await getOptionalDashboardContext(),session=await getDashboardAuth()?.api.getSession({headers:request.headers});
 if(!context||!session||session.user.id!==context.user.id)throw new AssistantError('access_denied','Sign in again.',401);
 const v=z.object({nonce:z.string().regex(/^[A-Za-z0-9_-]{43}$/),decision:z.enum(['allow','deny']),scopes:z.string().max(1000).optional()}).passthrough().parse(await body(request,8000));
 const selected=Object.entries(v).filter(([k,value])=>k.startsWith('scope:')&&value==='on').map(([k])=>k.slice(6));
 const location=await finishConsent(v.nonce,context,session.session.id,selected,v.decision==='allow');
 return new Response(null,{status:303,headers:{...privateHeaders,Location:location}});
});}
