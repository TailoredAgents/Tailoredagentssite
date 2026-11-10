import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {AssistantError,json} from '@/lib/assistant/config';
import {body,checkOrigin,endpoint} from '@/lib/assistant/http';
import {pushRequestSchema} from '@/lib/assistant/push-contract';
import {confirmPushDevice,pushDeviceStatus,registerPushDevice,revokePushInstallation,openPushNotification} from '@/lib/assistant/push-devices';
import {cardRateLimit} from '@/lib/smart-cards/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return endpoint(async()=>{
 checkOrigin(request,true);const v=pushRequestSchema.parse(await body(request,4096));
 // This token only removes the native installation binding, including after sign-out.
 if(v.operation==='revoke'){await cardRateLimit('assistant:push-revoke',v.installationId,10,60);return json(await revokePushInstallation(v));}
 const c=await getOptionalDashboardContext();if(!c)throw new AssistantError('unauthorized','Sign in to bind this iPhone to your profile.',401);
 await cardRateLimit('assistant:push',c.user.id,30,60);
 if(v.operation==='status')return json(await pushDeviceStatus(c,v));
 if(v.operation==='confirm')return json(await confirmPushDevice(c,v));
 if(v.operation==='open')return json(await openPushNotification(c,v));
 await cardRateLimit('assistant:push-register',c.user.id,3,3600);return json(await registerPushDevice(c,v));
});}
