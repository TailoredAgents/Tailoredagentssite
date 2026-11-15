import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {businessDateKey} from '@/lib/time';
import {STRIPE_VERSION,type StripeConfig} from './config';
import {invoiceFactsSchema,providerId,type InvoiceFacts} from './contract';

type Obj=Record<string,unknown>;
const obj=(v:unknown):Obj=>z.record(z.string(),z.unknown()).parse(v);
const str=(v:unknown)=>z.string().parse(v);
const num=(v:unknown)=>z.number().int().safe().parse(v);
const nullableId=(v:unknown):string|null=>v==null?null:providerId.parse(typeof v==='string'?v:obj(v).id);
const list=(v:unknown)=>z.array(z.unknown()).parse(v).map(obj);
const date=(v:unknown)=>businessDateKey(new Date(num(v)*1000));
export class StripeReadError extends Error{constructor(readonly code:string){super(code);}}
export interface StripeReader{account():Promise<string>;invoicePage(cursor?:string|null):Promise<{ids:string[];more:boolean}>;invoice(id:string):Promise<InvoiceFacts>;}

/** Only GETs to fixed Stripe resource paths; no caller URL, redirects or provider writes. */
export class StripeReadClient implements StripeReader{
 private requests=0;
 constructor(private config:StripeConfig,private transport:typeof fetch=fetch,private signal:AbortSignal=AbortSignal.timeout(100_000)){}
 private async get(path:string,params:Record<string,string>={}){
  if(++this.requests>150)throw new StripeReadError('REQUEST_LIMIT');
  const url=new URL('https://api.stripe.com/v1/'+path);for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  let response:Response;try{response=await this.transport(url,{method:'GET',redirect:'error',cache:'no-store',headers:{Authorization:`Bearer ${this.config.key}`,'Stripe-Version':STRIPE_VERSION},signal:AbortSignal.any([this.signal,AbortSignal.timeout(15_000)])});}catch{throw new StripeReadError('NETWORK_RETRY');}
  if(!response.ok)throw new StripeReadError(response.status===429?'RATE_LIMIT':response.status===401||response.status===403?'ACCESS_DENIED':response.status===404?'SOURCE_MISSING':'PROVIDER_RETRY');
  const raw=await boundedBody(response,2_000_000);return obj(JSON.parse(raw));
 }
 private async all(path:string,params:Record<string,string>={}){
  const rows:Obj[]=[];let cursor='';const seen=new Set<string>();
  for(let page=0;page<5;page++){
   const result=await this.get(path,{...params,limit:'100',...(cursor?{starting_after:cursor}:{})});
   const entries=list(result.data);for(const entry of entries){const id=providerId.parse(entry.id);if(seen.has(id))throw new StripeReadError('PAGINATION_CONFLICT');seen.add(id);rows.push(entry);}
   if(result.has_more===false)return rows;
   if(result.has_more!==true||!entries.length)throw new StripeReadError('PAGINATION_CONFLICT');cursor=str(entries.at(-1)!.id);
  }throw new StripeReadError('PAGINATION_LIMIT');
 }
 private mode(v:Obj){if(v.livemode!==undefined&&v.livemode!==(this.config.mode==='live'))throw new StripeReadError('MODE_MISMATCH');}
 async account(){return str((await this.get('account')).id);}
 async invoicePage(cursor?:string|null){const r=await this.get('invoices',{limit:'50',...(cursor?{starting_after:providerId.parse(cursor)}:{})});const ids=list(r.data).map(v=>{this.mode(v);return providerId.parse(v.id);});if(typeof r.has_more!=='boolean'||r.has_more&&!ids.length)throw new StripeReadError('PAGINATION_CONFLICT');return {ids,more:r.has_more};}
 async invoice(id:string):Promise<InvoiceFacts>{
  if(!/^in_[A-Za-z0-9]+$/.test(id))throw new StripeReadError('INVALID_INVOICE');
  const i=await this.get('invoices/'+id);this.mode(i);if(i.id!==id)throw new StripeReadError('IDENTITY_MISMATCH');
  const [lines,payments,credits]=await Promise.all([this.all(`invoices/${id}/lines`),this.all('invoice_payments',{invoice:id}),this.all('credit_notes',{invoice:id})]);
  const holds:string[]=[],receipts:InvoiceFacts['receipts']=[];
  for(const payment of payments){
   this.mode(payment);if(nullableId(payment.invoice)!==id)throw new StripeReadError('IDENTITY_MISMATCH');
   if(payment.status!=='paid')continue;
   const p=obj(payment.payment);let chargeId=nullableId(p.charge);
   if(p.type==='payment_intent'){
    const intent=await this.get('payment_intents/'+providerId.parse(p.payment_intent));this.mode(intent);
    if(intent.status!=='succeeded'){holds.push('A payment intent has not succeeded.');continue;}chargeId=nullableId(intent.latest_charge);
   }else if(p.type!=='charge'){holds.push('An out-of-band/payment-record credit requires separate receipt reconciliation.');continue;}
   if(!chargeId){holds.push('A paid allocation has no verifiable processor charge.');continue;}
   const charge=await this.get('charges/'+chargeId);this.mode(charge);
   const [refunds,disputes]=await Promise.all([this.all('refunds',{charge:chargeId}),this.all('disputes',{charge:chargeId})]);
   const balanceId=nullableId(charge.balance_transaction),balance=balanceId?await this.get('balance_transactions/'+balanceId):null;
   const receiptHolds:string[]=[];
   if(nullableId(charge.customer)!==nullableId(i.customer))receiptHolds.push('Charge and invoice customer identities differ.');
   if(balance&&(nullableId(balance.source)!==chargeId||balance.currency!==charge.currency||num(balance.amount)!==num(charge.amount_captured)||num(balance.net)+num(balance.fee)!==num(balance.amount)))receiptHolds.push('Charge gross, fees and balance evidence do not reconcile.');
   if(charge.disputed===true&&!disputes.length)receiptHolds.push('A disputed charge has incomplete dispute evidence.');
   for(const r of refunds){this.mode(r);if(nullableId(r.charge)!==chargeId||r.currency!==charge.currency)receiptHolds.push('Refund identity or currency needs review.');}
   for(const d of disputes){this.mode(d);if(nullableId(d.charge)!==chargeId||d.currency!==charge.currency)receiptHolds.push('Dispute identity or currency needs review.');}
   receipts.push({paymentId:providerId.parse(payment.id),chargeId,amountCents:num(charge.amount_captured),allocatedCents:num(payment.amount_paid),currency:str(charge.currency),paid:charge.paid===true&&charge.captured===true&&charge.status==='succeeded',collectedOn:date(obj(payment.status_transitions).paid_at),balanceId,balanceStatus:balance?str(balance.status):'missing',availableOn:balance?date(balance.available_on):null,feeCents:balance?num(balance.fee):0,refundedCents:num(charge.amount_refunded),refunds:refunds.map(r=>({id:providerId.parse(r.id),amountCents:num(r.amount),status:str(r.status),createdOn:date(r.created)})),disputes:disputes.map(d=>({id:providerId.parse(d.id),amountCents:num(d.amount),status:str(d.status)})),holds:receiptHolds});
  }
  for(const c of credits){this.mode(c);if(nullableId(c.invoice)!==id||c.currency!==i.currency)throw new StripeReadError('IDENTITY_MISMATCH');}
  for(const r of receipts){r.refunds.sort((a,b)=>a.id.localeCompare(b.id));r.disputes.sort((a,b)=>a.id.localeCompare(b.id));}
  return invoiceFactsSchema.parse({providerId:id,customerId:nullableId(i.customer),currency:str(i.currency),status:str(i.status),totalCents:num(i.total),paidCents:num(i.amount_paid),remainingCents:num(i.amount_remaining),holds,receipts:receipts.sort((a,b)=>a.paymentId.localeCompare(b.paymentId)),credits:credits.map(c=>{const links=list(c.refunds??[]);return {id:providerId.parse(c.id),amountCents:num(c.amount),status:str(c.status),refundId:links.length===1&&links[0].type!=='payment_record_refund'&&links[0].amount_refunded===c.amount?nullableId(links[0].refund):null};}).sort((a,b)=>a.id.localeCompare(b.id)),lines:lines.map(l=>{
   this.mode(l);const parent=l.parent?obj(l.parent):{},source=parent.subscription_item_details??parent.invoice_item_details,period=l.period?obj(l.period):{};
   if(l.currency!==i.currency)holds.push('Invoice line currency differs from invoice currency.');
   return {id:providerId.parse(l.id),description:String(l.description??'Invoice line').slice(0,240),amountCents:num(l.amount),discountCents:list(l.discount_amounts??[]).reduce((s,x)=>s+num(x.amount),0),taxCents:list(l.taxes??[]).reduce((s,x)=>s+num(x.amount),0),periodStart:period.start==null?null:num(period.start),periodEnd:period.end==null?null:num(period.end),subscriptionId:source?nullableId(obj(source).subscription):null};
  }).sort((a,b)=>a.id.localeCompare(b.id))});
 }
}
export async function boundedBody(input:Request|Response,limit:number){
 const reader=input.body?.getReader();if(!reader)return '';let size=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new StripeReadError('PAYLOAD_LIMIT');}chunks.push(value);}
 return Buffer.concat(chunks).toString('utf8');
}
export function verifyStripeSignature(body:string,header:string|null,secret:string,now=Math.floor(Date.now()/1000)){
 if(!header||!secret||header.length>2000)return false;
 const parts=header.split(',').map(p=>p.split('=')),timestamps=parts.filter(p=>p[0]==='t');
 if(timestamps.length!==1||!/^\d+$/.test(timestamps[0][1]??''))return false;
 const stamp=Number(timestamps[0][1]);if(!Number.isSafeInteger(stamp)||Math.abs(now-stamp)>300)return false;
 const expected=createHmac('sha256',secret).update(`${stamp}.${body}`).digest();
 return parts.some(([key,value])=>key==='v1'&&/^[0-9a-f]{64}$/.test(value??'')&&timingSafeEqual(expected,Buffer.from(value,'hex')));
}
