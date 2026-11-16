'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import type {OperationActionState} from '@/lib/operations/validation';
import * as service from './service';
export async function clientSuccessAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const c=await requireDashboardContext(),s=(k:string)=>String(form.get(k)??''),n=(k:string)=>Number(s(k)),requestId=s('requestId'),evidence=s('evidence');let destination:string|undefined;
 try {
  switch(s('action')){
   case 'calendar':{const minutes=(k:string)=>{const [h,m]=s(k).split(':').map(Number);return h*60+m;};await service.createCalendar(c,{requestId,name:s('name'),evidence,config:{timezone:'America/New_York',weekdays:form.getAll('weekdays').map(Number),opens:minutes('opens'),closes:minutes('closes'),responseMinutes:n('responseMinutes'),afterHoursDue:minutes('afterHoursDue'),loggingDays:n('loggingDays'),validFrom:s('validFrom'),validThrough:s('validThrough'),holidays:s('holidays').split(/[\s,]+/).filter(Boolean)}});break;}
   case 'plan':await service.saveSuccessPlan(c,{requestId,evidence,clientId:s('clientId'),revision:s('revision')?n('revision'):undefined,calendarId:s('calendarId'),mode:s('mode'),checkinMonths:n('checkinMonths'),reviewMonths:n('reviewMonths'),checkinAnchor:s('checkinAnchor'),reviewAnchor:s('reviewAnchor'),reminderMinutes:n('reminderMinutes')});break;
   case 'request':{const r=await service.recordSuccessRequest(c,{requestId,clientId:s('clientId'),kind:s('kind'),sourceKey:s('sourceKey'),title:s('title'),occurredAt:s('occurredAt'),dueAt:s('dueAt')||undefined,reference:s('reference')});destination='/dashboard/tasks/'+r.id;break;}
   case 'task':await service.changeSuccessTask(c,{requestId,id:s('id'),revision:n('revision'),operation:s('operation'),evidence,evidenceAt:s('evidenceAt')||undefined,dueAt:s('dueAt')||undefined,human:s('human')==='yes'});break;
   case 'pool':await service.saveManagerPool(c,{requestId,evidence,userId:s('userId'),enabled:s('enabled')==='yes',capacity:n('capacity'),specialties:s('specialties')});break;
   case 'availability':await service.recordAvailability(c,{requestId,evidence,userId:s('userId'),startsOn:s('startsOn'),endsBefore:s('endsBefore')});break;
   case 'assign':await service.assignSuccessManager(c,{requestId,evidence,clientId:s('clientId'),expectedManagerId:s('expectedManagerId')||null,userId:s('userId')});break;
   default:throw new SalesAccessError('Choose a supported action.');
  }
  revalidatePath('/dashboard','layout');
 }catch(error){return {status:'error',message:error instanceof SalesAccessError?error.message:error instanceof ZodError?'Check required fields, calendar dates and evidence.':error instanceof Error&&/calendar|deadline|time change/i.test(error.message)?error.message:'Unable to confirm this change. Refresh and check the current record before retrying.'};}
 if(destination)redirect(destination);return {status:'success',message:'Client-success record saved.'};
}
