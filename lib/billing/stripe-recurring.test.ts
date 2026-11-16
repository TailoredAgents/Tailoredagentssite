import {describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
vi.mock('server-only',()=>({}));
import {StripeRecurringClient} from './stripe-recurring';
import {recurringPreviewSchema,recurringEnd,type RecurringTerms} from './recurring-contract';
const config={workspaceId:'00000000-0000-4000-8000-000000000001',accountId:'acct_Synthetic',mode:'test' as const,key:'rk_test_SYNTHETIC'};
const v:RecurringTerms={documentId:randomUUID(),revision:3,customerId:'cus_Synthetic',priceId:'price_Synthetic',quantity:2,startsAt:'2028-01-05T14:00:00Z',months:3,daysUntilDue:15,recipientEmail:'billing@example.test',authorizationReference:'Synthetic executed customer authorization',taxReviewReference:'Synthetic inclusive tax review'};
function fixture(change:(path:string,d:Record<string,unknown>)=>Record<string,unknown>=(p,d)=>d){
 const calls:{path:string;init:RequestInit}[]=[];let body:URLSearchParams;
 const transport=vi.fn(async(url:unknown,init:RequestInit)=>{
  const path=String(url).replace('https://api.stripe.com/v1/','');calls.push({path,init});let d:Record<string,unknown>;
  if(path==='account')d={id:config.accountId};
  else if(path.endsWith('/cash_balance'))d={customer:v.customerId,livemode:false,available:null};
  else if(path.startsWith('customers/'))d={id:v.customerId,name:'Synthetic',email:v.recipientEmail,livemode:false,balance:0,tax_exempt:'none'};
  else if(path.startsWith('prices/'))d={id:v.priceId,active:true,livemode:false,currency:'usd',type:'recurring',billing_scheme:'per_unit',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},unit_amount:14500,product:'prod_Synthetic',tax_behavior:'inclusive'};
  else if(path.startsWith('products/'))d={id:'prod_Synthetic',active:true,livemode:false,name:'Synthetic support'};
  else if(path.includes('?'))d={has_more:false,data:[]};
  else {if(init.method==='POST')body=init.body as URLSearchParams;d={id:'sub_sched_Synthetic',customer:v.customerId,livemode:false,status:'not_started',end_behavior:'cancel',subscription:null,metadata:{ta_recurring_setup:body.get('metadata[ta_recurring_setup]')},default_settings:{collection_method:'send_invoice',automatic_tax:{enabled:false},invoice_settings:{days_until_due:15,issuer:{type:'self'}}},phases:[{currency:'usd',start_date:Date.parse(v.startsAt)/1000,end_date:Date.parse(recurringEnd(v))/1000,collection_method:'send_invoice',automatic_tax:{enabled:false},invoice_settings:{days_until_due:15,issuer:{type:'self'}},proration_behavior:'none',items:[{price:v.priceId,quantity:2}]}]};}
  return new Response(JSON.stringify(change(path,d)));
 });return {calls,client:new StripeRecurringClient(config,transport as typeof fetch)};
}
describe('Bounded recurring invoice schedule adapter',()=>{
 it('creates a future finite schedule with manual collection and no inherited discounts or tax rates',async()=>{
  const f=fixture(),r=await f.client.inspect(v),id=randomUUID(),checkpoint=vi.fn();const out=await f.client.createSchedule(id,v,r.fingerprint,checkpoint);
  expect(out.monthlyTotalCents).toBe(29000);expect(out.endsAt).toBe('2028-04-05T14:00:00.000Z');expect(checkpoint).toHaveBeenCalledWith('sub_sched_Synthetic');
  const writes=f.calls.filter(c=>c.init.method==='POST');expect(writes).toHaveLength(1);expect(writes[0].path).toBe('subscription_schedules');const body=writes[0].init.body as URLSearchParams;
  expect(body.get('end_behavior')).toBe('cancel');expect(body.get('default_settings[collection_method]')).toBe('send_invoice');expect(body.get('phases[0][proration_behavior]')).toBe('none');expect(body.get('phases[0][discounts]')).toBe('');expect((writes[0].init.headers as Record<string,string>)['Idempotency-Key']).toBe('ta-recurring-'+id);
 });
 it.each(['existing_subscription','existing_schedule','pending_item','open_invoice','truncated','metered','price_mode','recipient','cash','malformed_cash','tax'])('holds %s before creating any recurring obligation',async kind=>{
  const f=fixture((p,d)=>{
   if(p.startsWith('subscriptions?')&&kind==='existing_subscription'||p.startsWith('subscription_schedules?')&&kind==='existing_schedule'||p.startsWith('invoiceitems?')&&kind==='pending_item'||p.startsWith('invoices?')&&kind==='open_invoice')return {...d,data:[{status:'active'}]};
   if(kind==='truncated'&&p.startsWith('invoices?'))return {...d,has_more:true};
   if(kind==='metered'&&p.startsWith('prices/'))return {...d,recurring:{interval:'month',interval_count:1,usage_type:'metered'}};
   if(kind==='price_mode'&&p.startsWith('prices/'))return {...d,livemode:true};if(kind==='tax'&&p.startsWith('prices/'))return {...d,tax_behavior:'unspecified'};
   if(kind==='recipient'&&p==='customers/cus_Synthetic')return {...d,email:'other@example.test'};if(kind==='malformed_cash'&&p.endsWith('/cash_balance'))return {...d,available:'unknown'};if(kind==='cash'&&p.endsWith('/cash_balance'))return {...d,available:{usd:1}};return d;
  });await expect(f.client.createSchedule(randomUUID(),v,'a'.repeat(64),async()=>{})).rejects.toThrow();expect(f.calls.some(c=>c.init.method==='POST')).toBe(false);
 });
 it('rejects near starts and ambiguous month-end anchors',async()=>{expect(recurringPreviewSchema.safeParse({...v,startsAt:'2028-01-31T14:00:00Z'}).success).toBe(false);await expect(fixture().client.inspect({...v,startsAt:new Date(Date.now()+1000).toISOString()})).rejects.toThrow();});
 it('rejects changed price or product presentation after approval',async()=>{let changed=false;const f=fixture((p,d)=>changed&&p.startsWith('products/')?{...d,name:'Different service'}:d),r=await f.client.inspect(v);changed=true;await expect(f.client.createSchedule(randomUUID(),v,r.fingerprint,async()=>{})).rejects.toThrow(/RECURRING_REVIEW_CHANGED/);expect(f.calls.some(c=>c.init.method==='POST')).toBe(false);});
 it('checkpoints a created schedule before rejecting a changed provider phase',async()=>{const f=fixture((p,d)=>p==='subscription_schedules/sub_sched_Synthetic'?{...d,end_behavior:'release'}:d),r=await f.client.inspect(v),checkpoint=vi.fn();await expect(f.client.createSchedule(randomUUID(),v,r.fingerprint,checkpoint)).rejects.toThrow(/UNCONFIRMED/);expect(checkpoint).toHaveBeenCalledWith('sub_sched_Synthetic');});
});
