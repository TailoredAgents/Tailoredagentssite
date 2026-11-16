import type {InvoiceFacts,BillingReview} from './contract';
export type RecoveryBankEvidence={disputeId:string;clearedOn:string;reference:string};
export type ExceptionApproval={id:string;bankEvidence:RecoveryBankEvidence[]};
/** Only canonical provider movements change the cash basis. Human review cannot
 * manufacture a receipt, resolve an open dispute or override an unsupported credit. */
export function exceptionAllocation(f:InvoiceFacts,review:Pick<BillingReview,'lines'|'policy'>,today:string,bank:RecoveryBankEvidence[]=[]){
 const holds:string[]=[],losses:Record<string,number>={},weights=review.lines.map(l=>l.amountCents),usedMovements=new Set<string>(),usedRefunds=new Map<string,number>();let requiresReview=false;
 const recovered=new Set<string>();
 for(const r of f.receipts){let loss=0;
  for(const d of r.disputes){requiresReview=true;
   if(!['lost','won','warning_closed'].includes(d.status)){holds.push('An open dispute cannot be released by a finance override.');continue;}
   if(!d.movements){holds.push('Refresh the dispute’s complete balance movements before reviewing it.');continue;}
   if(d.movements.length>2||new Set(d.movements.map(m=>m.id)).size!==d.movements.length||d.movements.some(m=>m.currency!==f.currency||m.status!=='available'||m.availableOn>today||usedMovements.has(m.id))){holds.push('Dispute balance movements are incomplete, pending or duplicated.');continue;}
   for(const m of d.movements)usedMovements.add(m.id);
   const principal=d.movements.reduce((n,m)=>n+m.amountCents,0);
   if(principal>0||principal < -d.amountCents||d.status!=='lost'&&principal!==0){holds.push('Dispute principal does not reconcile to its final outcome.');continue;}
   if(d.status==='lost'&&principal===0&&r.refundedCents<d.amountCents){holds.push('A lost dispute has no verified withdrawal or covering refund.');continue;}
   if(d.movements.some(m=>m.amountCents>0)){
    recovered.add(d.id);const b=bank.find(b=>b.disputeId===d.id),available=d.movements.map(m=>m.availableOn).sort().at(-1)!;
    if(review.policy==='bank_verified'&&(!b||b.clearedOn<available||b.clearedOn>today))holds.push('Recovered dispute funds need fresh bank-clearing evidence.');
   }
   loss-=principal;
  }
  if(loss+r.refundedCents>r.amountCents)holds.push('Refunds and dispute withdrawals exceed the captured receipt; reconcile overlapping evidence.');
  losses[r.chargeId]=loss;
 }
 if(new Set(bank.map(b=>b.disputeId)).size!==bank.length||bank.some(b=>!recovered.has(b.disputeId)||b.reference.trim().length<10))holds.push('Use one valid bank reference per actual dispute recovery.');
 for(const credit of f.credits){
  if(credit.status==='void'||credit.amountCents===0)continue;
  if(credit.status!=='issued'){holds.push('A credit note is not final.');continue;}
  if((credit.prePaymentCents!==undefined||credit.postPaymentCents!==undefined)&&(credit.prePaymentCents===undefined||credit.postPaymentCents===undefined||credit.prePaymentCents+credit.postPaymentCents!==credit.amountCents||credit.customerBalanceId||credit.outOfBandCents||credit.prePaymentCents&&credit.postPaymentCents)){requiresReview=true;holds.push('Credit allocation is unresolved: mixed, customer-balance and out-of-band credits need separate reconciliation.');continue;}
  const legacy=f.receipts.flatMap(r=>r.refunds).find(r=>r.id===credit.refundId&&r.status==='succeeded'&&r.amountCents===credit.amountCents);
  if(legacy){const used=usedRefunds.get(legacy.id)??0;if(used)holds.push('A refund is credited more than once.');usedRefunds.set(legacy.id,used+credit.amountCents);continue;}
  requiresReview=true;
  if(credit.prePaymentCents===undefined||credit.postPaymentCents===undefined||credit.prePaymentCents+credit.postPaymentCents!==credit.amountCents||credit.customerBalanceId||credit.outOfBandCents||credit.prePaymentCents&&credit.postPaymentCents){holds.push('Credit allocation is unresolved: mixed, customer-balance and out-of-band credits need separate reconciliation.');continue;}
  if(credit.postPaymentCents){
   if(!credit.refundLinks?.length||credit.refundLinks.reduce((n,x)=>n+x.amountCents,0)!==credit.amountCents){holds.push('Credit refunds do not reconcile to the credit amount.');continue;}
   for(const link of credit.refundLinks){const refund=f.receipts.flatMap(r=>r.refunds).find(r=>r.id===link.refundId&&r.status==='succeeded'),used=usedRefunds.get(link.refundId)??0;
    if(!refund||link.amountCents<=0||used+link.amountCents>refund.amountCents)holds.push('A credit’s refund allocation is missing, pending or consumed more than once.');usedRefunds.set(link.refundId,used+link.amountCents);
   }
  }else{
   if(!credit.lines?.length||credit.refundLinks?.length||credit.lines.reduce((n,l)=>n+l.amountCents+l.taxCents,0)!==credit.amountCents){holds.push('Unpaid credit lines do not reconcile to the credit amount.');continue;}
   for(const line of credit.lines){const index=review.lines.findIndex(l=>l.sourceId===line.sourceId),taxIndex=review.lines.findIndex(l=>l.sourceId==='tax'&&l.classification==='tax');
    if(index<0||!line.sourceId){holds.push('An unpaid credit lacks a verified original invoice line.');continue;}
    weights[index]-=line.amountCents;
    if(line.taxCents){if(taxIndex<0)holds.push('Credited tax lacks a separate reviewed tax allocation.');else weights[taxIndex]-=line.taxCents;}
   }
  }
 }
 if(weights.some(n=>n<0)||f.paidCents>weights.reduce((n,x)=>n+x,0))holds.push('Credits exceed a reviewed line or leave less invoice basis than collected cash.');
 return {holds:[...new Set(holds)],requiresReview,losses,effectiveLines:review.lines.map((l,i)=>({...l,amountCents:Math.max(0,weights[i])}))};
}
