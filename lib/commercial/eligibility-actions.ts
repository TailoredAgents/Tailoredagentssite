'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import type {OperationActionState} from '@/lib/operations/validation';
import {createCustomerEntitlement,addEligibilityPeriod,endEligibilityPeriod,recordEligibilityEvidence,openEligibilityReview,resolveEligibilityReview} from './eligibility';
export async function eligibilityAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const c=await requireDashboardContext(),v=Object.fromEntries(form);let destination:string|undefined;
 try{
  if(v.confirm!=='yes')throw new SalesAccessError('Confirm the private source evidence and dates before recording eligibility.');
  const key={requestId:v.requestId,id:v.id,revision:Number(v.revision)};
  if(v.action==='create'){
   const result=await createCustomerEntitlement(c,{requestId:v.requestId,clientId:v.clientId,documentId:v.documentId,role:v.role,basis:v.basis,referralId:v.referralId||undefined,evidence:v.evidence});
   destination=`/dashboard/finance/eligibility/${result.id}`;
  }else if(v.action==='period')await addEligibilityPeriod(c,{...key,startsOn:v.startsOn,endsBefore:v.endsBefore||undefined,assignmentId:v.assignmentId||undefined,evidence:v.evidence});
  else if(v.action==='end')await endEligibilityPeriod(c,{...key,periodId:v.periodId,endsBefore:v.endsBefore,reason:v.reason,evidence:v.evidence});
  else if(v.action==='evidence')await recordEligibilityEvidence(c,{...key,kind:v.kind,startsOn:v.startsOn,endsBefore:v.endsBefore,evidence:v.evidence});
  else if(v.action==='review')await openEligibilityReview(c,{...key,kind:v.kind,observedFrom:v.observedFrom,observedThrough:v.observedThrough,noticeOn:v.noticeOn,cureDueOn:v.cureDueOn,policyEvidence:v.policyEvidence});
  else if(v.action==='resolve')await resolveEligibilityReview(c,{...key,reviewId:v.reviewId,outcome:v.outcome,endsBefore:v.endsBefore||undefined,evidence:v.evidence});
  else throw new SalesAccessError('Choose a supported eligibility action.');
  revalidatePath('/dashboard','layout');
 }catch(e){return {status:'error',message:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Check the source, dates and required evidence (at least ten characters).':'Eligibility could not be saved. Refresh and review before retrying.'};}
 if(destination)redirect(destination);
 return {status:'success',message:'Eligibility history saved. No payment, commission posting or customer message was created.'};
}
