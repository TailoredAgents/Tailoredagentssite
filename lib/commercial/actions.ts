'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {ZodError} from 'zod';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import type {OperationActionState} from '@/lib/operations/validation';
import {decimalCents} from './contract';
import {saveCommercialDocument,changeCommercialDocument,submitReferral,decideReferral} from './service';
export async function commercialAction(_:OperationActionState,form:FormData):Promise<OperationActionState>{
 const c=await requireDashboardContext(),v=Object.fromEntries(form);let destination:string|undefined;
 try{
  if(v.action==='document'){
   const entries=(name:string)=>form.getAll(name).map(String);
   let details:unknown;
   if(v.kind==='invoice')details={currency:'USD',dueOn:v.dueOn,recipientEmail:v.recipientEmail,notes:v.notes||'',lines:entries('description').map((description,i)=>({description,classification:entries('classification')[i],amountCents:decimalCents(entries('amount')[i]),startsOn:entries('startsOn')[i]||null,endsOn:entries('endsOn')[i]||null}))};
   else if(v.kind==='project_budget')details={projectId:v.projectId,expectedCents:decimalCents(v.expected),directCostCents:decimalCents(v.directCosts),approval:v.approval,participants:entries('participant').map((userId,i)=>({userId,role:entries('participantRole')[i],amountCents:decimalCents(entries('participantAmount')[i]),condition:entries('condition')[i]}))};
   else details={documentReference:v.documentReference,scope:v.scope,exclusions:v.exclusions,paymentTerms:v.paymentTerms,reviewNotes:v.reviewNotes||'',rules:['external','originator','manager'].filter(role=>String(v[role+'Rate']||'')!=='').map(role=>({role,rateBps:decimalCents(v[role+'Rate']),windowMonths:v[role+'Months']?Number(v[role+'Months']):null,eligibility:v[role+'Eligibility'],termination:v[role+'Termination'],refunds:v[role+'Refunds']}))};
   const result=await saveCommercialDocument(c,{requestId:v.requestId,previousId:v.previousId||undefined,kind:v.kind,clientId:v.clientId||undefined,partnerId:v.partnerId||undefined,userId:v.userId||undefined,title:v.title,details});destination=`/dashboard/finance/${result.id}`;
  }else if(v.action==='transition'){
   if(v.confirm!=='yes')throw new SalesAccessError('Confirm the reviewed document and evidence.');
   await changeCommercialDocument(c,{requestId:v.requestId,id:v.id,revision:Number(v.revision),operation:v.operation,evidence:v.evidence,effectiveOn:v.effectiveOn||undefined});
  }else if(v.action==='referral'){
   const [kind,id]=String(v.target||'').split(':');
   await submitReferral(c,{requestId:v.requestId,partnerId:v.partnerId,kind,id,submittedOn:v.submittedOn,decisionDueOn:v.decisionDueOn,evidence:v.evidence});
  }
  else if(v.action==='decision'){
   if(v.confirm!=='yes')throw new SalesAccessError('Review the existing attribution before recording this decision.');
   await decideReferral(c,{requestId:v.requestId,id:v.id,revision:Number(v.revision),status:v.status,note:v.note,acceptedOn:v.acceptedOn||undefined,conversionDueOn:v.conversionDueOn||undefined,clientId:v.clientId||undefined});
  }else throw new SalesAccessError('Choose a supported change.');
  revalidatePath('/dashboard','layout');
 }catch(e){return {status:'error',message:e instanceof SalesAccessError?e.message:e instanceof ZodError?'Check the required fields, dates, amounts and agreement rules.':'The change could not be saved. Check the amounts and refresh before retrying.'};}
 if(destination)redirect(destination);
 return {status:'success',message:'Saved. No invoice was sent, financial rule activated or money transferred.'};
}
