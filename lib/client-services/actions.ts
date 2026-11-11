'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import type {OperationActionState} from '@/lib/operations/validation';
import {saveClientService,recordServiceReview,recordServiceIncident,resolveServiceIncident,recordServiceMeasurement} from './service';
export async function clientServiceAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const c=await requireDashboardContext(),v=Object.fromEntries(form);let destination:string|undefined;
 try{
  if(v.action==='service'){const r=await saveClientService(c,{...v,serviceId:v.serviceId||undefined,revision:v.revision?Number(v.revision):undefined,projectId:v.projectId||undefined,renewalOn:v.renewalOn||undefined,reviewEveryDays:Number(v.reviewEveryDays)});if(!v.serviceId)destination=`/dashboard/services/${r.id}`;}
  else if(v.action==='review')await recordServiceReview(c,{...v,revision:Number(v.revision)});
  else if(v.action==='incident')await recordServiceIncident(c,v);
  else if(v.action==='resolve')await resolveServiceIncident(c,{...v,revision:Number(v.revision)});
  else if(v.action==='measurement'){
   let costCents:number|undefined;if(v.cost){if(!/^\d+(\.\d{1,2})?$/.test(String(v.cost)))throw new SalesAccessError('Enter a cost with at most two decimal places.');const [whole,fraction='']=String(v.cost).split('.');costCents=Number(whole)*100+Number(fraction.padEnd(2,'0'));}
   await recordServiceMeasurement(c,{...v,documents:Number(v.documents),baselineSecondsPerDocument:Math.round(Number(v.baselineMinutes)*60),actualSeconds:Math.round(Number(v.actualMinutes)*60),costCents});
  }else throw new SalesAccessError('Choose a supported action.');
  revalidatePath('/dashboard','layout');
 }catch(e){return {status:'error',message:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Check the required details, dates and measurements.':'Unable to save. Refresh and check the service before retrying.'};}
 if(destination)redirect(destination);return {status:'success',message:'Service record saved. No deployment or customer message was started.'};
}
