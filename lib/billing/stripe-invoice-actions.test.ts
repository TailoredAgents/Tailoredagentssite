import {describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
vi.mock('server-only',()=>({}));
import {StripeInvoiceClient,type InvoiceActionSource} from './stripe-invoice-actions';
import {localInstant} from '@/lib/client-success/calendar';
const config={workspaceId:'00000000-0000-4000-8000-000000000001',accountId:'acct_Synthetic',mode:'test' as const,key:'rk_test_SYNTHETIC'};
const source:InvoiceActionSource={exportId:randomUUID(),invoiceId:'in_Synthetic',customerId:'cus_Synthetic',title:'Synthetic reviewed invoice',details:{currency:'USD',recipientEmail:'billing@example.test',dueOn:'2028-12-01',lines:[{description:'Synthetic support',classification:'recurring',amountCents:14500,startsOn:'2028-11-01',endsOn:'2028-11-30'}],notes:'Synthetic notes'}};
function fixture(change:(path:string,data:Record<string,unknown>)=>Record<string,unknown>=(p,d)=>d,status='draft'){
 const calls:{path:string;init:RequestInit}[]=[];
 const transport=vi.fn(async(url:unknown,init:RequestInit)=>{
  const path=String(url).replace('https://api.stripe.com/v1/','');calls.push({path,init});let data:Record<string,unknown>;
  if(path==='account')data={id:config.accountId};
  else if(path.endsWith('/cash_balance'))data={customer:source.customerId,livemode:false,available:null};
  else if(path.startsWith('customers/'))data={id:source.customerId,email:source.details.recipientEmail,name:'Synthetic customer',livemode:false,balance:0};
  else if(path.endsWith('/lines?limit=100'))data={has_more:false,data:[{id:'il_Synthetic',description:'Synthetic support',amount:14500,currency:'usd',discountable:false,metadata:{ta_line_index:'0',ta_classification:'recurring'},period:{start:Date.parse(localInstant('2028-11-01',0))/1000,end:Date.parse(localInstant('2028-12-01',0))/1000-1}}]};
  else {if(path.endsWith('/finalize'))status='open';data={id:source.invoiceId,customer:source.customerId,status,auto_advance:false,collection_method:'send_invoice',currency:'usd',livemode:false,billing_reason:'manual',total:14500,amount_due:14500,amount_remaining:14500,amount_paid:0,starting_balance:0,amount_shipping:0,due_date:Date.parse(localInstant(source.details.dueOn,1439))/1000,customer_email:source.details.recipientEmail,description:source.title,footer:source.details.notes,metadata:{ta_draft_export:source.exportId},automatic_tax:{enabled:false},issuer:{type:'self'}};}
  return new Response(JSON.stringify(change(path,data)));
 });return {calls,client:new StripeInvoiceClient(config,transport as typeof fetch)};
}
describe('Exact reviewed invoice provider actions',()=>{
 it('finalizes with auto advance off and a stable key, without sending or charging',async()=>{
  const f=fixture(),r=await f.client.inspect(source,'issue'),id=randomUUID();expect((await f.client.perform(id,source,'issue',r.fingerprint)).providerAccepted).toBe(true);
  const writes=f.calls.filter(c=>c.init.method==='POST');expect(writes).toHaveLength(1);expect(writes[0].path).toBe('invoices/in_Synthetic/finalize');expect((writes[0].init.body as URLSearchParams).get('auto_advance')).toBe('false');expect((writes[0].init.headers as Record<string,string>)['Idempotency-Key']).toBe('ta-invoice-issue-'+id);
 });
 it('distinguishes test send acceptance from email delivery',async()=>{const f=fixture(undefined,'open'),r=await f.client.inspect(source,'send');expect(await f.client.perform(randomUUID(),source,'send',r.fingerprint)).toMatchObject({providerAccepted:true,emailDeliveryConfirmed:false,mode:'test'});expect(f.calls.filter(c=>c.init.method==='POST').map(c=>c.path)).toEqual(['invoices/in_Synthetic/send']);});
 it.each(['recipient','total','status','tax','period','classification','cash','balance','account','mode','extra_line','ambiguous_index','malformed_cash','footer'])('blocks changed %s without provider writes',async kind=>{
  const f=fixture((p,d)=>{
   if(kind==='account'&&p==='account')return {id:'acct_Other'};
   if(kind==='malformed_cash'&&p.endsWith('/cash_balance'))return {...d,available:'unknown'};
   if(kind==='cash'&&p.endsWith('/cash_balance'))return {...d,available:{usd:100}};
   if(kind==='balance'&&p==='customers/cus_Synthetic')return {...d,balance:-100};
   if(p==='invoices/in_Synthetic')return {...d,...({recipient:{customer_email:'different@example.test'},total:{total:1},status:{status:'paid'},tax:{automatic_tax:{enabled:true}},mode:{livemode:true},footer:{footer:'Different instructions'}}[kind])};
   if(p.endsWith('/lines?limit=100')){const l=(d.data as Record<string,unknown>[])[0];if(kind==='ambiguous_index')return {...d,data:[{...l,metadata:{ta_line_index:'00',ta_classification:'recurring'}}]};if(kind==='period')return {...d,data:[{...l,period:{start:1,end:2}}]};if(kind==='classification')return {...d,data:[{...l,metadata:{ta_line_index:'0',ta_classification:'upfront'}}]};if(kind==='extra_line')return {...d,data:[l,l]};}
   return d;
  });await expect(f.client.perform(randomUUID(),source,'issue','a'.repeat(64))).rejects.toThrow();expect(f.calls.some(c=>c.init.method==='POST')).toBe(false);
 });
 it('pins the displayed customer and presentation even when amounts are unchanged',async()=>{let changed=false;const f=fixture((p,d)=>changed&&p==='customers/cus_Synthetic'?{...d,name:'Changed billing identity'}:d),r=await f.client.inspect(source,'issue');changed=true;await expect(f.client.perform(randomUUID(),source,'issue',r.fingerprint)).rejects.toThrow(/EXACT_REVIEW_CHANGED/);expect(f.calls.some(c=>c.init.method==='POST')).toBe(false);});
 it('holds the receipt if terms change after the provider accepts',async()=>{let written=false;const f=fixture((p,d)=>{if(p.endsWith('/finalize'))written=true;return written&&p==='invoices/in_Synthetic'?{...d,amount_remaining:0}:d;}),r=await f.client.inspect(source,'issue');await expect(f.client.perform(randomUUID(),source,'issue',r.fingerprint)).rejects.toThrow();expect(f.calls.filter(c=>c.init.method==='POST')).toHaveLength(1);});
});
