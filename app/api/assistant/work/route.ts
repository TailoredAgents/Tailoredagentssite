import {after} from 'next/server';
import {getOptionalDashboardContext} from '@/lib/dashboard/data';
import {AssistantError,json} from '@/lib/assistant/config';
import {body,checkOrigin,endpoint} from '@/lib/assistant/http';
import {workRequestSchema} from '@/lib/assistant/notification-contract';
import {confirmEmployeePhone,employeeWorkState,markEmployeeNotificationRead,requestEmployeePhoneVerification,saveEmployeeNotificationPreferences} from '@/lib/assistant/employee-notifications';
import {runEmployeeNotificationWorker} from '@/lib/assistant/notification-worker';
import {stopChatTurn} from '@/lib/assistant/chat-store';
import {cardRateLimit} from '@/lib/smart-cards/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function identity(){const c=await getOptionalDashboardContext();if(!c)throw new AssistantError('unauthorized','Sign in again to view your work.',401);return c;}
export async function GET(){return endpoint(async()=>json(await employeeWorkState(await identity())));}
export async function POST(request:Request){return endpoint(async()=>{
 checkOrigin(request,true);const c=await identity();const v=workRequestSchema.parse(await body(request,4096));
 await cardRateLimit('assistant:work',c.user.id,20,60);
 if(v.operation==='verify_phone')return json(await requestEmployeePhoneVerification(c,v.phone));
 if(v.operation==='confirm_phone')await confirmEmployeePhone(c,v.id,v.code);
 if(v.operation==='preferences')await saveEmployeeNotificationPreferences(c,v.preferences);
 if(v.operation==='read')await markEmployeeNotificationRead(c,v.id);
 if(v.operation==='stop')await stopChatTurn(c,v.threadId,v.id);
 after(async()=>{try{await runEmployeeNotificationWorker();}catch{console.error('employee_notification_worker_failed');}});
 return json(await employeeWorkState(c));
});}
