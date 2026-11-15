import {businessDateKey} from '@/lib/time';
import {allocateCents} from '@/lib/commercial/calculation';
import type {BillingReview,InvoiceFacts} from './contract';

/** Verified processor evidence is still reversible; fees never reduce the contractual gross base here. */
export function collectionEvidence(facts:InvoiceFacts,review:Pick<BillingReview,'policy'|'lines'|'bankEvidence'>,today=businessDateKey()){
 const holds=[...facts.holds],cleared:{chargeId:string;clearedOn:string;grossCents:number;refundCents:number;netCents:number}[]=[];
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
  if(r.disputes.length)holds.push('Dispute and recovery evidence requires explicit reconciliation; no disputed cash is released automatically.');
  let refunds=0;
  for(const refund of r.refunds){
   if(refundIds.has(refund.id))holds.push('Duplicate refund evidence.');refundIds.add(refund.id);
   if(refund.status==='succeeded')refunds+=refund.amountCents;
   else if(!['failed','canceled'].includes(refund.status))holds.push('A refund is still pending.');
  }
  if(refunds!==r.refundedCents||refunds>r.amountCents)holds.push('Refund totals do not reconcile to the original captured amount.');
  const net=Math.max(0,r.amountCents-refunds),bank=review.bankEvidence.find(b=>b.chargeId===r.chargeId);
  const available=r.paid&&r.balanceStatus==='available'&&r.availableOn!==null&&r.availableOn<=today&&r.collectedOn<=today;
  if(!available||review.policy==='bank_verified'&&(!bank||bank.clearedOn>today)){pendingCents+=net;continue;}
  const clearedOn=[r.collectedOn,r.availableOn!,...(review.policy==='bank_verified'?[bank!.clearedOn]:[])].sort().at(-1)!;
  cleared.push({chargeId:r.chargeId,clearedOn,grossCents:r.amountCents,refundCents:refunds,netCents:net});
 }
 const linkedRefunds=new Set<string>();
 for(const credit of facts.credits){
  if(credit.status==='void'||credit.amountCents===0)continue;
  const refund=facts.receipts.flatMap(r=>r.refunds).find(r=>r.id===credit.refundId&&r.status==='succeeded');
  if(!refund||refund.amountCents!==credit.amountCents||linkedRefunds.has(refund.id))holds.push('Credit-note allocation is unresolved. Do not subtract a credit and its cash refund twice.');
  else linkedRefunds.add(refund.id);
 }
 const grossCents=cleared.reduce((s,r)=>s+r.grossCents,0),refundCents=cleared.reduce((s,r)=>s+r.refundCents,0),netCents=grossCents-refundCents;
 const lineCents=allocateCents(netCents,review.lines.map(l=>l.amountCents));
 return {holds:[...new Set(holds)],cleared,grossCents,refundCents,netCents,pendingCents,feeCents:facts.receipts.reduce((s,r)=>s+r.feeCents,0),lineCents,excludedCents:lineCents.reduce((s,n,i)=>s+(review.lines[i].classification==='recurring'?0:n),0)};
}
