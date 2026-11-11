'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import type {OperationActionState} from '@/lib/operations/validation';
import * as service from './service';
function scaled(value:FormDataEntryValue|undefined) {
 const raw=String(value??'');if(!/^\d+(\.\d{1,2})?$/.test(raw))throw new SalesAccessError('Enter an amount or percentage with at most two decimal places.');
 const [whole,fraction='']=raw.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export async function referralAction(_:OperationActionState,form:FormData):Promise<OperationActionState> {
 const c=await requireDashboardContext(),v=Object.fromEntries(form);let destination:string|undefined;
 try {
  switch(v.action){
   case 'partner': {const r=await service.createPartner(c,v);destination=`/dashboard/partners/${r.id}`;break;}
   case 'agreement': await service.createAgreement(c,{...v,terms:{currency:'USD',documentRateCents:scaled(v.documentRate),nonDocumentBps:scaled(v.nonDocumentPercent),startsOn:v.startsOn,endsOn:v.endsOn,basis:v.basis,documentEligibility:v.documentEligibility,eligibleServices:v.eligibleServices,paymentTiming:v.paymentTiming,durationPolicy:v.durationPolicy,refundPolicy:v.refundPolicy,splitPolicy:v.splitPolicy}});break;
   case 'agreement_state': if(v.confirm!=='yes')throw new SalesAccessError('Review the agreement and confirm this change.');await service.changeAgreement(c,{...v,revision:Number(v.revision)});break;
   case 'earning': await service.recordEarning(c,{...v,units:Number(v.units||0),amountCents:scaled(v.amount||'0'),allocationBps:scaled(v.allocationPercent)});break;
   case 'reversal': if(v.confirm!=='yes')throw new SalesAccessError('Confirm the correcting reversal.');await service.reverseEarning(c,v);break;
   case 'statement': {const r=await service.createStatement(c,v);destination=`/dashboard/partners/statements/${r.id}`;break;}
   case 'statement_state': if(v.confirm!=='yes')throw new SalesAccessError('Review the exact total and confirm this change.');await service.changeStatement(c,{...v,revision:Number(v.revision),expectedTotalCents:Number(v.expectedTotalCents)});break;
   case 'finance_access': await service.changeFinanceAccess(c,v);break;
   case 'partner_access': await service.changePartnerAccess(c,{...v,allow:v.allow==='true'});break;
   default: throw new SalesAccessError('Choose a supported action.');
  }
  revalidatePath('/dashboard','layout');
 }catch(e){return {status:'error',message:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Check the required fields, dates, amounts and policies.':'The change could not be saved. Refresh and check the record before retrying.'};}
 if(destination)redirect(destination);
 return {status:'success',message:'Saved. No money was transferred and no message was sent.'};
}
