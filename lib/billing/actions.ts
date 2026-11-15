'use server';
import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import type {OperationActionState} from '@/lib/operations/validation';
import {decimalCents} from '@/lib/commercial/contract';
import {reviewBillingInvoice,retryBillingReconciliation} from './service';
export async function billingAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const c=await requireDashboardContext(),v=Object.fromEntries(form);
 try{
  if(v.confirm!=='yes')throw new SalesAccessError('Confirm the reviewed evidence before saving.');
  if(v.action==='retry')await retryBillingReconciliation(c,{requestId:v.requestId,connectionId:v.connectionId});
  else if(v.action==='review'){
   const all=(key:string)=>form.getAll(key).map(String);
   await reviewBillingInvoice(c,{requestId:v.requestId,invoiceId:v.invoiceId,snapshotId:v.snapshotId,revision:Number(v.revision),clientId:v.clientId,policy:v.policy,evidence:v.evidence,
    lines:all('sourceId').map((sourceId,i)=>({sourceId,description:all('description')[i],classification:all('classification')[i],amountCents:decimalCents(all('amount')[i]),startsOn:all('startsOn')[i]||null,endsOn:all('endsOn')[i]||null})),
    bankEvidence:all('chargeId').map((chargeId,i)=>({chargeId,clearedOn:all('clearedOn')[i],reference:all('bankReference')[i]})).filter(b=>b.clearedOn||b.reference)});
  }else throw new SalesAccessError('Choose a supported billing action.');
  revalidatePath('/dashboard/finance','layout');
 }catch(e){return {status:'error',message:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Check every line, date and evidence reference (at least ten characters).':'The billing review could not be saved. Refresh the current source and try again.'};}
 return {status:'success',message:'Saved for reconciliation. No invoice, charge, payout or commission was created.'};
}
