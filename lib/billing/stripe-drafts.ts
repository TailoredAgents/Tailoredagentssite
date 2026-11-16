import 'server-only';
import {z} from 'zod';
import {STRIPE_VERSION} from './config';
import {boundedBody} from './stripe';
import {invoiceDetails,type InvoiceDetails} from '@/lib/commercial/contract';
import {localInstant,addDays} from '@/lib/client-success/calendar';
export type DraftConfig={workspaceId:string;accountId:string;mode:'test'|'live';key:string};
export function stripeDraftConfig():DraftConfig|null{
 if(process.env.BILLING_STRIPE_DRAFT_WRITES_ENABLED!=='true')return null;
 const mode=z.enum(['test','live']).parse(process.env.BILLING_STRIPE_MODE);
 return {mode,workspaceId:z.uuid().parse(process.env.BILLING_STRIPE_WORKSPACE_ID),accountId:z.string().regex(/^acct_[A-Za-z0-9]+$/).parse(process.env.BILLING_STRIPE_ACCOUNT_ID),key:z.string().regex(new RegExp(`^rk_${mode}_[A-Za-z0-9]+$`)).parse(process.env.BILLING_STRIPE_WRITE_KEY)};
}
export class DraftProviderError extends Error{}
export class StripeDraftClient{
 private signal=AbortSignal.timeout(80000);
 constructor(private config:DraftConfig,private transport:typeof fetch=fetch){}
 private async call(path:string,body?:URLSearchParams,key?:string):Promise<Record<string,unknown>>{
  let response:Response;try{response=await this.transport('https://api.stripe.com/v1/'+path,{method:body?'POST':'GET',redirect:'error',cache:'no-store',signal:AbortSignal.any([this.signal,AbortSignal.timeout(15000)]),headers:{Authorization:'Bearer '+this.config.key,'Stripe-Version':STRIPE_VERSION,...(body?{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':key!}:{})},body});}catch{throw new DraftProviderError('PROVIDER_OUTCOME_UNCONFIRMED');}
  if(!response.ok)throw new DraftProviderError('PROVIDER_REQUEST_NOT_CONFIRMED');
  try{return z.record(z.string(),z.unknown()).parse(JSON.parse(await boundedBody(response,2_000_000)));}catch{throw new DraftProviderError('PROVIDER_RESPONSE_UNCONFIRMED');}
 }
 async customer(id:string){
  if(!/^cus_[A-Za-z0-9]+$/.test(id))throw new DraftProviderError('INVALID_CUSTOMER');
  if((await this.call('account')).id!==this.config.accountId)throw new DraftProviderError('ACCOUNT_MISMATCH');
  const c=await this.call('customers/'+id);if(c.id!==id||c.deleted===true||c.livemode!==(this.config.mode==='live')||typeof c.email!=='string')throw new DraftProviderError('CUSTOMER_IDENTITY_MISMATCH');
  return {id,name:typeof c.name==='string'?c.name:'',email:c.email};
 }
 private invoice(r:Record<string,unknown>,customer:string,id?:string){
  if(typeof r.id!=='string'||!/^in_[A-Za-z0-9]+$/.test(r.id)||id&&r.id!==id||r.customer!==customer||r.livemode!==(this.config.mode==='live')||r.status!=='draft'||r.auto_advance!==false||r.collection_method!=='send_invoice'||r.currency!=='usd')throw new DraftProviderError('DRAFT_IDENTITY_MISMATCH');return r.id;
 }
 async create(operationId:string,customer:string,title:string,raw:InvoiceDetails,recordId:(id:string)=>Promise<void>){
  z.uuid().parse(operationId);const d=invoiceDetails.parse(raw),c=await this.customer(customer);
  if(c.email.toLowerCase()!==d.recipientEmail.toLowerCase())throw new DraftProviderError('RECIPIENT_CHANGED');
  const due=Math.floor(Date.parse(localInstant(d.dueOn,1439))/1000);if(due<=Date.now()/1000)throw new DraftProviderError('DUE_DATE_EXPIRED');
  const body=new URLSearchParams({customer,currency:'usd',auto_advance:'false',collection_method:'send_invoice',pending_invoice_items_behavior:'exclude','automatic_tax[enabled]':'false',discounts:'',default_tax_rates:'',due_date:String(due),description:title,footer:d.notes,'metadata[ta_draft_export]':operationId});
  const first=await this.call('invoices',body,'ta-draft-'+operationId),id=this.invoice(first,customer);await recordId(id);
  for(const [index,line] of d.lines.entries()){
   const item=new URLSearchParams({customer,invoice:id,currency:'usd',amount:String(line.amountCents),description:line.description,discountable:'false',tax_rates:'','metadata[ta_line_index]':String(index),'metadata[ta_classification]':line.classification});
   if(line.startsOn&&line.endsOn){item.set('period[start]',String(Date.parse(localInstant(line.startsOn,0))/1000));item.set('period[end]',String(Date.parse(localInstant(addDays(line.endsOn,1),0))/1000-1));}
   const r=await this.call('invoiceitems',item,`ta-draft-${operationId}-line-${index}`);
   if(r.invoice!==id||r.customer!==customer||r.amount!==line.amountCents||r.livemode!==(this.config.mode==='live'))throw new DraftProviderError('LINE_IDENTITY_MISMATCH');
  }
  const final=await this.call('invoices/'+id);this.invoice(final,customer,id);
  const lines=await this.call('invoices/'+id+'/lines?limit=100') as {data?:Record<string,unknown>[];has_more?:boolean};
  if(final.total!==d.lines.reduce((n,l)=>n+l.amountCents,0)||final.customer_email!==c.email||!lines||lines.has_more!==false||lines.data?.length!==d.lines.length)throw new DraftProviderError('DRAFT_TOTAL_OR_RECIPIENT_MISMATCH');
  if(lines.data!.some((line,index)=>{const metadata=line.metadata as Record<string,string>|undefined;const position=Number(metadata?.ta_line_index);const expected=d.lines[position];return !expected||metadata?.ta_line_index===undefined||line.amount!==expected.amountCents||line.description!==expected.description||lines.data!.findIndex(l=>(l.metadata as Record<string,string>)?.ta_line_index===metadata.ta_line_index)!==index;}))throw new DraftProviderError('DRAFT_LINES_CHANGED');
  return id;
 }
}
