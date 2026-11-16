import {exceptionAllocation,type ExceptionApproval} from './exception-allocation';
import {businessDateKey} from '@/lib/time';
import {allocateCents} from '@/lib/commercial/calculation';
import type {BillingReview,InvoiceFacts} from './contract';

/** Verified processor evidence is still reversible; fees never reduce the contractual gross base here. */
export function collectionEvidence(facts:InvoiceFacts,review:Pick<BillingReview,'policy'|'lines'|'bankEvidence'>,today=businessDateKey(),approval?:ExceptionApproval){
 const exceptions=exceptionAllocation(facts,review,today,approval?.bankEvidence),holds=[...facts.holds,...exceptions.holds],cleared:{chargeId:string;clearedOn:string;grossCents:number;refundCents:number;disputeLossCents:number;netCents:number}[]=[];
 if(exceptions.requiresReview&&!approval)holds.push('Dispute or credit-note allocation requires explicit finance exception review.');
 let pendingCents=0;
 if(facts.currency!=='usd')holds.push('Only USD is supported; currency conversion requires review.');
 if(!['open','paid'].includes(facts.status)||facts.totalCents<=0)holds.push('This invoice is not a positive finalized invoice.');
 if(review.lines.reduce((s,l)=>s+l.amountCents,0)!==facts.totalCents)holds.push('Reviewed line totals do not reconcile to the invoice.');
 if(facts.receipts.reduce((s,r)=>s+r.allocatedCents,0)!==facts.paidCents)holds.push('Invoice payment credits do not reconcile to processor receipts.');
 if(facts.paidCents>facts.totalCents)holds.push('Overpayments need explicit allocation review.');
 const seen=new Set<string>(),refundIds=new Set<string>();
 for(const r of facts.receipts){
  holds.push(...r.holds);
  if(seen.has(r.chargeId))holds.push('A processor charge has multiple invoice allocations; reconcile it before calculating.');seen.add(r.chargeId);
  if(r.currency!==facts.currency||r.allocatedCents!==r.amountCents)holds.push('Split-payment allocation or currency requires review.');
  if(!r.paid)holds.push('A credited processor payment is not successfully captured.');
  let refunds=0;
  for(const refund of r.refunds){
   if(refundIds.has(refund.id))holds.push('Duplicate refund evidence.');refundIds.add(refund.id);
   if(refund.status==='succeeded')refunds+=refund.amountCents;
   else if(!['failed','canceled'].includes(refund.status))holds.push('A refund is still pending.');
  }
  if(refunds!==r.refundedCents||refunds>r.amountCents)holds.push('Refund totals do not reconcile to the original captured amount.');
  const loss=exceptions.losses[r.chargeId]??0,net=Math.max(0,r.amountCents-refunds-loss),bank=review.bankEvidence.find(b=>b.chargeId===r.chargeId);
  const available=r.paid&&r.balanceStatus==='available'&&r.availableOn!==null&&r.availableOn<=today&&r.collectedOn<=today;
  if(!available||review.policy==='bank_verified'&&(!bank||bank.clearedOn>today)){pendingCents+=net;continue;}
  const clearedOn=[r.collectedOn,r.availableOn!,...(review.policy==='bank_verified'?[bank!.clearedOn]:[])].sort().at(-1)!;
  cleared.push({chargeId:r.chargeId,clearedOn,grossCents:r.amountCents,refundCents:refunds,disputeLossCents:loss,netCents:net});
 }
 const grossCents=cleared.reduce((s,r)=>s+r.grossCents,0),refundCents=cleared.reduce((s,r)=>s+r.refundCents,0),disputeLossCents=cleared.reduce((s,r)=>s+r.disputeLossCents,0),netCents=Math.max(0,grossCents-refundCents-disputeLossCents);
 const effectiveLines=exceptions.holds.length?review.lines:exceptions.effectiveLines,lineCents=allocateCents(netCents,effectiveLines.map(l=>l.amountCents));
 return {holds:[...new Set(holds)],cleared,grossCents,refundCents,disputeLossCents,netCents,pendingCents,effectiveLines,exceptions,exceptionApprovalId:approval?.id??null,feeCents:facts.receipts.reduce((s,r)=>s+r.feeCents,0),lineCents,excludedCents:lineCents.reduce((s,n,i)=>s+(review.lines[i].classification==='recurring'?0:n),0)};
}
