import 'server-only';
import {z} from 'zod';
import type {DashboardContext} from '@/lib/dashboard/data';
import {workTransaction} from '@/lib/relationships/transactions';
import {SalesAccessError} from '@/lib/sales/data';
import {commercialAccess} from './access';
import {invoiceDetails} from './contract';
import {saveCommercialDocument} from './service';
export const assistantInvoiceSchema=z.object({requestId:z.uuid(),clientId:z.uuid(),previousId:z.uuid().optional(),expectedPreviousRevision:z.number().int().positive().optional(),title:z.string().trim().min(2).max(160),details:invoiceDetails}).strict().superRefine((v,c)=>{if(!!v.previousId!==(v.expectedPreviousRevision!==undefined))c.addIssue({code:'custom',message:'A revision needs the exact previous document and revision.'});});
function enabled(){if(process.env.ASSISTANT_BILLING_DRAFTS_ENABLED==='false')throw new SalesAccessError('Assistant invoice drafting is paused.');}
export async function invoiceProposalReview(c:DashboardContext,input:unknown){
 enabled();const v=assistantInvoiceSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  await commercialAccess(db,c,role,true);
  const client=(await db.query('SELECT id,name,status,updated_at FROM clients WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.clientId])).rows[0];if(!client)throw new SalesAccessError('Choose a client in this workspace.');
  let previous=null;
  if(v.previousId){const d=(await db.query('SELECT id,kind,client_id,version,revision,status,family_id FROM crm_commercial_documents WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.previousId])).rows[0];
   if(!d||d.kind!=='invoice'||d.client_id!==v.clientId||d.revision!==v.expectedPreviousRevision)throw new SalesAccessError('The invoice changed. Read its current version before preparing a revision.');
   if((await db.query('SELECT 1 FROM crm_commercial_documents WHERE workspace_id=$1 AND family_id=$2 AND version>$3',[c.workspace.id,d.family_id,d.version])).rowCount)throw new SalesAccessError('A newer invoice version exists.');previous=d;
  }
  return {client:{...client,updated_at:client.updated_at.toISOString()},previous,title:v.title,currency:v.details.currency,recipient:v.details.recipientEmail,dueOn:v.details.dueOn,lines:v.details.lines,totalCents:v.details.lines.reduce((sum,line)=>sum+line.amountCents,0),notes:v.details.notes,collection:'None. Local draft only; no recurring charge schedule.',notice:'Approval saves an internal draft in Finance. It does not create a Stripe invoice, send email, charge a customer, sign an agreement or post commissions.'};
 });
}
export async function saveAssistantInvoice(c:DashboardContext,input:unknown){
 enabled();const v=assistantInvoiceSchema.parse(input);
 const result=await saveCommercialDocument(c,{...v,kind:'invoice'});
 return {...result,url:'/dashboard/finance/'+result.id,providerInvoiceCreated:false,customerNotified:false};
}
