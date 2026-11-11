'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import type {OperationActionState} from '@/lib/operations/validation';
import {saveSolutionBrief} from './solutions';
import {briefFields} from './solution-contract';
import {captureEncounter,saveWorkFocus} from './capture';
export async function relationshipWorkAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const c=await requireDashboardContext(),v=Object.fromEntries(form);let destination:string|undefined;
 try {
  if(v.action==='brief')await saveSolutionBrief(c,{...v,briefId:v.briefId||undefined,revision:v.revision?Number(v.revision):undefined,fields:Object.fromEntries(Object.keys(briefFields).map(k=>[k,v[k]??''])),sources:form.getAll('source').map(s=>{const [kind,id]=String(s).split(':');return {kind,id};})});
  else if(v.action==='focus')await saveWorkFocus(c,v);
  else if(v.action==='encounter'){const r=await captureEncounter(c,{...v,leadId:v.leadId||undefined,metAt:v.metAt||undefined,partnerId:v.partnerId||undefined,createSeparate:v.createSeparate==='yes'});destination=`/dashboard/relationships/lead/${r.leadId}`;}
  else throw new SalesAccessError('Choose a supported action.');
  revalidatePath('/dashboard','layout');
 }catch(e){return {status:'error',message:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Check the required details and any date or contact fields.':'Unable to save. Refresh and check the record before retrying.'};}
 if(destination)redirect(destination);return {status:'success',message:'Saved. No customer message, booking or paid research was started.'};
}
