import 'server-only';
import {z} from 'zod';
import type {DashboardContext} from '@/lib/dashboard/data';
import {SalesAccessError} from '@/lib/sales/data';
import {workTransaction} from '@/lib/relationships/transactions';
import {commercialAccess} from './access';
import {agreementDetails,invoiceDetails,money,roleSchema} from './contract';
import {previewRecurringCalculation} from './calculation';
export const simulationSchema=z.object({invoiceId:z.uuid(),asOf:z.iso.date(),collectedOn:z.iso.date(),cleared:z.boolean(),collectedCents:money,refundedCents:money,roles:z.array(z.object({documentId:z.uuid(),role:roleSchema,startsOn:z.iso.date(),endsOn:z.iso.date().nullable(),windowStartsOn:z.iso.date().nullable()})).max(30)}).strict();
export async function simulateCommercialInvoice(c:DashboardContext,input:unknown){
 const v=simulationSchema.parse(input);
 return workTransaction(c,false,async(db,role)=>{
  await commercialAccess(db,c,role);
  const invoice=(await db.query("SELECT details FROM crm_commercial_documents WHERE workspace_id=$1 AND id=$2 AND kind='invoice'",[c.workspace.id,v.invoiceId])).rows[0];
  if(!invoice)throw new SalesAccessError('That invoice draft is unavailable.');
  const lines=invoiceDetails.parse(invoice.details).lines,roles=[];
  for(const r of v.roles){
   const d=(await db.query("SELECT * FROM crm_commercial_documents WHERE workspace_id=$1 AND id=$2 AND kind IN ('external_referral','internal_commission')",[c.workspace.id,r.documentId])).rows[0];
   if(!d)throw new SalesAccessError('Choose a commission document in this workspace.');
   const rule=agreementDetails.parse(d.details).rules.find(x=>x.role===r.role);
   if(!rule)throw new SalesAccessError('That document does not contain the selected role.');
   roles.push({recipientId:d.partner_id??d.user_id,agreementId:d.id,role:r.role,rateBps:rule.rateBps,startsOn:r.startsOn,endsOn:r.endsOn,windowStartsOn:r.windowStartsOn,windowMonths:rule.windowMonths});
  }
  return {...previewRecurringCalculation({asOf:v.asOf,collectedOn:v.collectedOn,cleared:v.cleared,collectedCents:v.collectedCents,refundedCents:v.refundedCents,roles,lines}),assumptions:{asOf:v.asOf,collectedOn:v.collectedOn,cleared:v.cleared},notice:'Hypothetical scenario only. Collection, acceptance and role eligibility have not been verified; no earnings or payments are created.'};
 });
}
