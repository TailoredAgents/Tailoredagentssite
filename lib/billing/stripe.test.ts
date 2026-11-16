import {createHmac} from 'node:crypto';
import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {StripeReadClient,verifyStripeSignature,boundedBody} from './stripe';
import {STRIPE_VERSION} from './config';
import {billingTestConfig} from './test-fixtures';
function transport(overrides:Record<string,unknown>={}){
 const responses:Record<string,unknown>={
  '/v1/account':{id:'acct_Synthetic'},
  '/v1/invoices/in_Synthetic':{id:'in_Synthetic',customer:'cus_Synthetic',livemode:false,currency:'usd',status:'paid',total:15000,amount_paid:15000,amount_remaining:0},
  '/v1/invoices/in_Synthetic/lines':{data:[{id:'il_Recurring',currency:'usd',livemode:false,amount:15000,description:'Synthetic monthly service',discount_amounts:[],taxes:[],period:{start:1767243600,end:1769922000},parent:{subscription_item_details:{subscription:'sub_Synthetic'}}}],has_more:false},
  '/v1/invoice_payments':{data:[{id:'inpay_Synthetic',invoice:'in_Synthetic',livemode:false,amount_paid:15000,status:'paid',payment:{type:'payment_intent',payment_intent:'pi_Synthetic'},status_transitions:{paid_at:1767330000}}],has_more:false},
  '/v1/payment_intents/pi_Synthetic':{id:'pi_Synthetic',status:'succeeded',livemode:false,latest_charge:'ch_Synthetic'},
  '/v1/charges/ch_Synthetic':{id:'ch_Synthetic',livemode:false,customer:'cus_Synthetic',amount_captured:15000,amount_refunded:0,currency:'usd',paid:true,captured:true,status:'succeeded',balance_transaction:'txn_Synthetic',disputed:false},
  '/v1/balance_transactions/txn_Synthetic':{id:'txn_Synthetic',amount:15000,net:14565,fee:435,currency:'usd',source:'ch_Synthetic',status:'available',available_on:1767589200},
  '/v1/refunds':{data:[],has_more:false},'/v1/disputes':{data:[],has_more:false},'/v1/credit_notes':{data:[],has_more:false},...overrides
 };
 return vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const u=new URL(String(input));expect(u.origin).toBe('https://api.stripe.com');expect(init?.method).toBe('GET');expect(init?.redirect).toBe('error');expect(((init?.headers??{}) as Record<string,string>)['Stripe-Version']).toBe(STRIPE_VERSION);
  if(!(u.pathname in responses))throw new Error('Unexpected path '+u.pathname);return Response.json(responses[u.pathname]);
 });
}
describe('Stripe read-only adapter',()=>{
 it('retrieves canonical receipt, subscription association and gross/fee evidence using only GET',async()=>{
  const fetcher=transport(),client=new StripeReadClient(billingTestConfig,fetcher);expect(await client.account()).toBe('acct_Synthetic');const f=await client.invoice('in_Synthetic');expect(f.receipts[0]).toMatchObject({amountCents:15000,feeCents:435,balanceStatus:'available'});expect(f.lines[0].subscriptionId).toBe('sub_Synthetic');expect(f.holds).toEqual([]);expect(fetcher).toHaveBeenCalledTimes(10);
 });
 it('normalizes modern credit note refund links without counting them as new cash',async()=>{
  const client=new StripeReadClient(billingTestConfig,transport({'/v1/credit_notes':{data:[{id:'cn_Synthetic',invoice:'in_Synthetic',currency:'usd',amount:500,status:'issued',livemode:false,refunds:[{refund:'re_Synthetic',amount_refunded:500,type:'refund'}]}],has_more:false}}));expect((await client.invoice('in_Synthetic')).credits[0].refundId).toBe('re_Synthetic');
 });
 it('rejects mixed modes and unavailable access without exposing provider response bodies',async()=>{
  await expect(new StripeReadClient(billingTestConfig,transport({'/v1/invoices/in_Synthetic':{id:'in_Synthetic',livemode:true}})).invoice('in_Synthetic')).rejects.toThrow(/MODE_MISMATCH/);
  const denied=vi.fn(async()=>new Response('Sensitive provider error',{status:403}));await expect(new StripeReadClient(billingTestConfig,denied).account()).rejects.toThrow(/^ACCESS_DENIED$/);
 });
 it('holds out-of-band payment records rather than manufacturing a receipt',async()=>{
  const f=await new StripeReadClient(billingTestConfig,transport({'/v1/invoice_payments':{data:[{id:'inpay_External',invoice:'in_Synthetic',livemode:false,status:'paid',payment:{type:'payment_record',payment_record:'pyr_Synthetic'}}],has_more:false}})).invoice('in_Synthetic');expect(f.receipts).toHaveLength(0);expect(f.holds.join()).toMatch(/out-of-band/);
 });
 it('rejects truncated or looping pagination',async()=>{
  await expect(new StripeReadClient(billingTestConfig,transport({'/v1/refunds':{data:[],has_more:true}})).invoice('in_Synthetic')).rejects.toThrow(/PAGINATION_CONFLICT/);
 });
 it('verifies raw-body HMAC, rotation signatures, freshness, malformed timestamps and payload bounds',async()=>{
  const body='{"id":"evt_Synthetic"}',secret='whsec_SYNTHETIC',stamp=1800000000,valid=createHmac('sha256',secret).update(`${stamp}.${body}`).digest('hex');
  expect(verifyStripeSignature(body,`t=${stamp},v1=${'0'.repeat(64)},v1=${valid}`,secret,stamp)).toBe(true);
  expect(verifyStripeSignature(body+' ',`t=${stamp},v1=${valid}`,secret,stamp)).toBe(false);
  expect(verifyStripeSignature(body,`t=${stamp},v1=${valid}`,secret,stamp+301)).toBe(false);
  expect(verifyStripeSignature(body,`t=${stamp},t=${stamp},v1=${valid}`,secret,stamp)).toBe(false);
  await expect(boundedBody(new Response('oversized'),3)).rejects.toThrow(/PAYLOAD_LIMIT/);
 });
 it('fetches canonical dispute balance movements and complete pre-payment credit lines',async()=>{
  const fetcher=transport({'/v1/disputes':{data:[{id:'du_Final',charge:'ch_Synthetic',currency:'usd',amount:3000,status:'lost',balance_transactions:[{id:'txn_Loss',amount:-1}]}],has_more:false},'/v1/balance_transactions/txn_Loss':{id:'txn_Loss',source:'du_Final',amount:-3000,net:-4500,fee:1500,currency:'usd',status:'available',available_on:1767589200},'/v1/credit_notes':{data:[{id:'cn_Unpaid',invoice:'in_Synthetic',currency:'usd',amount:2000,status:'issued',pre_payment_amount:2000,post_payment_amount:0,refunds:[]}],has_more:false},'/v1/credit_notes/cn_Unpaid/lines':{data:[{id:'cnli_Original',invoice_line_item:'il_Recurring',amount:2100,discount_amount:100,taxes:[]}],has_more:false}});
  const f=await new StripeReadClient(billingTestConfig,fetcher).invoice('in_Synthetic');expect(f.receipts[0].disputes[0].movements?.[0].amountCents).toBe(-3000);expect(f.receipts[0].holds).toEqual([]);expect(f.credits[0].lines).toEqual([{sourceId:'il_Recurring',amountCents:2000,taxCents:0}]);
 });
 it('holds dispute balances belonging to another source or currency',async()=>{const f=await new StripeReadClient(billingTestConfig,transport({'/v1/disputes':{data:[{id:'du_Final',charge:'ch_Synthetic',currency:'usd',amount:3000,status:'lost',balance_transactions:[{id:'txn_Loss'}]}],has_more:false},'/v1/balance_transactions/txn_Loss':{id:'txn_Loss',source:'du_Other',amount:-3000,net:-3000,fee:0,currency:'eur',status:'available',available_on:1767589200}})).invoice('in_Synthetic');expect(f.receipts[0].holds.join()).toMatch(/identity/);});

});
