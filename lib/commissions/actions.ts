'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import type {OperationActionState} from '@/lib/operations/validation';
import {createCommissionPolicy,approveCommissionAnchor,correctCommissionAnchor,retainRefundedAnchor,saveCommissionRun,approveCommissionPosting,postCommissionRun,createCommissionStatement,changeCommissionStatement} from './service';
import {decimalCents} from '@/lib/commercial/contract';
import {recordStatementSettlement,offsetCommissionStatements,reverseStatementSettlement,recordStatementNote} from './settlements';
export async function commissionAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const c=await requireDashboardContext(),v=Object.fromEntries(form);let destination='';
 try{
  if(v.confirm!=='yes')throw new SalesAccessError('Confirm the evidence and exact calculation before saving.');
  const base={requestId:v.requestId,evidence:v.evidence};
  if(v.action==='policy'){const out=await createCommissionPolicy(c,{...base,clientId:v.clientId,mode:v.mode,convention:'calendar-month-v2'});destination='/dashboard/finance/commissions/'+out.id;}
  else if(v.action==='anchor')await approveCommissionAnchor(c,{...base,policyId:v.policyId,entitlementId:v.entitlementId,invoiceId:v.invoiceId,chargeId:v.chargeId,fingerprint:v.fingerprint,retainReversed:v.retainReversed==='yes'});
  else if(v.action==='anchor_correct')await correctCommissionAnchor(c,{...base,policyId:v.policyId,anchorId:v.anchorId,expectedCorrectionId:v.expectedCorrectionId||null,invoiceId:v.invoiceId,chargeId:v.chargeId,fingerprint:v.fingerprint,retainReversed:v.retainReversed==='yes'});
  else if(v.action==='retain')await retainRefundedAnchor(c,{...base,anchorId:v.anchorId,snapshotId:v.snapshotId});
  else if(v.action==='run')await saveCommissionRun(c,{requestId:v.requestId,policyId:v.policyId,invoiceId:v.invoiceId,asOf:v.asOf});
  else if(v.action==='activate')await approveCommissionPosting(c,{...base,runId:v.runId});
  else if(v.action==='post')await postCommissionRun(c,{...base,runId:v.runId});
  else if(v.action==='statement'){const out=await createCommissionStatement(c,{...base,recipientId:v.recipientId,mode:v.mode,month:v.month,dueOn:v.dueOn});destination='/dashboard/finance/commissions/statements/'+out.id;}
  else if(v.action==='statement_change')await changeCommissionStatement(c,{...base,id:v.id,revision:Number(v.revision),expectedTotalCents:Number(v.expectedTotalCents),operation:v.operation,paymentReference:v.paymentReference||undefined});
  else if(['settlement','offset','settlement_reverse','statement_note'].includes(String(v.action))){
   const common={...base,id:v.id,revision:Number(v.revision),expectedTotalCents:Number(v.expectedTotalCents),reference:v.reference};
   if(v.action==='settlement')await recordStatementSettlement(c,{...common,amountCents:decimalCents(v.amount),settledOn:v.settledOn});
   else if(v.action==='offset'){const [creditId,revision]=String(v.credit).split(':');await offsetCommissionStatements(c,{...common,creditId,creditRevision:Number(revision),amountCents:decimalCents(v.amount),settledOn:v.settledOn});}
   else if(v.action==='settlement_reverse')await reverseStatementSettlement(c,{...common,settlementId:v.settlementId,settledOn:v.settledOn});
   else await recordStatementNote(c,{...common,kind:v.kind,resolvesId:v.resolvesId||undefined,occurredOn:v.occurredOn});
  }else throw new SalesAccessError('Choose a supported commission action.');
  revalidatePath('/dashboard/finance','layout');
 }catch(e){return {status:'error',message:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Check the dates, selected records and evidence reference (at least ten characters).':'Unable to save this record. Refresh and check the latest evidence.'};}
 if(destination)redirect(destination);
 return {status:'success',message:'Recorded. No money was transferred and no message was sent.'};
}
