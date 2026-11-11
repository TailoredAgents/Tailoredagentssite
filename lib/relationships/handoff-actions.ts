'use server';
import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import type {OperationActionState} from '@/lib/operations/validation';
import {requestHandoff,transitionHandoff} from './handoffs';

export async function handoffAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const c=await requireDashboardContext();
 try{
  const v=Object.fromEntries(form);
  if(v.operation==='request')await requestHandoff(c,v);else await transitionHandoff(c,{...v,revision:Number(v.revision)});
  revalidatePath('/dashboard','layout');
  return {status:'success',message:v.operation==='request'?'Handoff saved. It is waiting for your teammate to accept.':'Handoff updated.'};
 }catch(e){return {status:'error',message:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Add a next action, teammate, due time and any required outcome.':'The handoff could not be saved. Refresh and check before trying again.'};}
}
