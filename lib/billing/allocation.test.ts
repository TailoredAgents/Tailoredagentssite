import {describe,it,expect} from 'vitest';
import {collectionEvidence} from './allocation';
import {invoiceFixture,reviewFixture} from './test-fixtures';
describe('Collection allocation evidence',()=>{
 it('conserves gross cents across recurring and excluded lines without deducting processor fees',()=>{
  const r=collectionEvidence(invoiceFixture(),reviewFixture(),'2026-11-15');expect(r.holds).toEqual([]);expect(r.netCents).toBe(15000);expect(r.feeCents).toBe(435);expect(r.lineCents).toEqual([10000,5000]);expect(r.excludedCents).toBe(5000);
 });
 it('defers processing payments and requires bank proof when that gate is selected',()=>{
  const f=invoiceFixture();f.receipts[0].balanceStatus='pending';expect(collectionEvidence(f,reviewFixture()).pendingCents).toBe(15000);
  f.receipts[0].balanceStatus='available';const r={...reviewFixture(),policy:'bank_verified' as const};expect(collectionEvidence(f,r).grossCents).toBe(0);
  r.bankEvidence=[{chargeId:'ch_Synthetic',clearedOn:'2026-01-07',reference:'Synthetic bank settlement reference'}];expect(collectionEvidence(f,r).cleared[0].clearedOn).toBe('2026-01-07');
 });
 it('deducts a linked refund exactly once even when a credit note describes it',()=>{
  const f=invoiceFixture();f.receipts[0].refundedCents=3000;f.receipts[0].refunds=[{id:'re_Synthetic',amountCents:3000,status:'succeeded',createdOn:'2026-02-01'}];f.credits=[{id:'cn_Synthetic',amountCents:3000,status:'issued',refundId:'re_Synthetic'}];
  const r=collectionEvidence(f,reviewFixture());expect(r.holds).toEqual([]);expect(r.netCents).toBe(12000);expect(r.lineCents).toEqual([8000,4000]);
  f.credits.push({...f.credits[0],id:'cn_Duplicate'});expect(collectionEvidence(f,reviewFixture()).holds.join()).toMatch(/twice/);
 });
 it('holds unmatched credits, pending refunds and all dispute recovery states for reconciliation',()=>{
  const f=invoiceFixture();f.credits=[{id:'cn_Unknown',amountCents:3000,status:'issued',refundId:null}];expect(collectionEvidence(f,reviewFixture()).holds.join()).toMatch(/Credit-note/);
  f.credits=[];f.receipts[0].refunds=[{id:'re_Pending',amountCents:1000,status:'pending',createdOn:'2026-02-01'}];expect(collectionEvidence(f,reviewFixture()).holds.join()).toMatch(/pending/);
  f.receipts[0].refunds=[];for(const status of ['needs_response','lost','won']){f.receipts[0].disputes=[{id:'du_Synthetic',amountCents:1000,status}];expect(collectionEvidence(f,reviewFixture()).holds.join()).toMatch(/Dispute/);}
 });
 it('supports partial invoice receipts while rejecting split or duplicate charge allocations',()=>{
  const f=invoiceFixture();f.paidCents=7500;f.remainingCents=7500;f.receipts[0].amountCents=7500;f.receipts[0].allocatedCents=7500;
  expect(collectionEvidence(f,reviewFixture()).lineCents).toEqual([5000,2500]);
  f.receipts[0].amountCents=15000;expect(collectionEvidence(f,reviewFixture()).holds.join()).toMatch(/Split-payment/);
  f.receipts.push({...f.receipts[0],paymentId:'inpay_Duplicate'});expect(collectionEvidence(f,reviewFixture()).holds.join()).toMatch(/multiple invoice/);
 });
 it('does not infer cash from invoice status, unsupported currency, failure or zero totals',()=>{
  const f=invoiceFixture();f.receipts=[];expect(collectionEvidence(f,reviewFixture()).holds.join()).toMatch(/credits do not reconcile/);
  f.currency='eur';f.totalCents=0;expect(collectionEvidence(f,reviewFixture()).holds.join()).toMatch(/Only USD/);
  const failed=invoiceFixture();failed.receipts[0].paid=false;expect(collectionEvidence(failed,reviewFixture()).holds.join()).toMatch(/not successfully captured/);
 });
});
