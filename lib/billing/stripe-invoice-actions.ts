import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {StripeDraftClient,DraftProviderError} from './stripe-drafts';
import {invoiceDetails,type InvoiceDetails} from '@/lib/commercial/contract';
import {localInstant,addDays} from '@/lib/client-success/calendar';

export type InvoiceAction='issue'|'send';
export type InvoiceActionSource={exportId:string;invoiceId:string;customerId:string;title:string;details:InvoiceDetails};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function stable(v:unknown):string {if(v===null||typeof v!=='object')return JSON.stringify(v)??'null';if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+stable(x)).join(',')+'}';}
export const billingFingerprint=(v:unknown)=>createHash('sha256').update(stable(v)).digest('hex');
export const zeroCashBalance=(v:unknown)=>v===null||!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(n=>n===0);
const empty=(v:unknown)=>v==null||Array.isArray(v)&&v.length===0;
const fail=(code:string):never=>{throw new DraftProviderError(code);};

export class StripeInvoiceClient extends StripeDraftClient {
 // Only our verified, manually collected invoices can enter this path. Inspect
 // canonical current objects, not a stale local draft-export success receipt.
 async inspect(source:InvoiceActionSource,operation:InvoiceAction){
  z.uuid().parse(source.exportId);if(!/^in_[A-Za-z0-9]+$/.test(source.invoiceId))fail('INVALID_INVOICE');
  const d=invoiceDetails.parse(source.details),customer=await this.customer(source.customerId);
  const rawCustomer=await this.call('customers/'+source.customerId);
  if(rawCustomer.balance!==0||rawCustomer.delinquent===true||!empty(rawCustomer.discount)||!empty(rawCustomer.discounts))fail('CUSTOMER_BALANCE_OR_DISCOUNT_REQUIRES_REVIEW');
  if(rawCustomer.email!==customer.email||rawCustomer.id!==customer.id||rawCustomer.livemode!==(this.config.mode==='live')||rawCustomer.deleted===true)fail('CUSTOMER_CHANGED');
  const cash=await this.call('customers/'+source.customerId+'/cash_balance');
  if(cash.customer!==source.customerId||cash.livemode!==(this.config.mode==='live')||!zeroCashBalance(cash.available))fail('CUSTOMER_CASH_BALANCE_REQUIRES_REVIEW');
  const r=await this.call('invoices/'+source.invoiceId),lines=await this.call('invoices/'+source.invoiceId+'/lines?limit=100');
  const total=d.lines.reduce((n,l)=>n+l.amountCents,0),due=Date.parse(localInstant(d.dueOn,1439))/1000;
  if(r.id!==source.invoiceId||r.customer!==source.customerId||r.livemode!==(this.config.mode==='live')||r.status!==(operation==='issue'?'draft':'open')||r.auto_advance!==false||r.collection_method!=='send_invoice'||r.currency!=='usd'||r.billing_reason!=='manual'||r.parent!=null||r.latest_revision!=null)fail('INVOICE_STATE_CHANGED');
  if(total<50||r.total!==total||r.amount_due!==total||r.amount_remaining!==total||r.amount_paid!==0||r.starting_balance!==0||r.amount_shipping!==0||r.due_date!==due||due<=Date.now()/1000||r.customer_email!==d.recipientEmail||customer.email!==d.recipientEmail||r.description!==source.title||(r.footer??'')!==d.notes||object(r.metadata).ta_draft_export!==source.exportId)fail('INVOICE_TERMS_CHANGED');
  if(object(r.automatic_tax).enabled!==false||!empty(r.discounts)||!empty(r.default_tax_rates)||!empty(r.total_discount_amounts)||!empty(r.total_taxes)||!empty(r.total_tax_amounts)||!empty(r.custom_fields)||r.shipping_cost!=null||r.shipping_details!=null||r.on_behalf_of!=null||r.transfer_data!=null||r.application_fee_amount!=null||object(r.issuer).type!=='self')fail('INVOICE_ADJUSTMENTS_REQUIRE_REVIEW');
  if(lines.has_more!==false||!Array.isArray(lines.data)||lines.data.length!==d.lines.length)fail('INVOICE_LINES_INCOMPLETE');
  const seen=new Set<string>();
  const checked=(lines.data as unknown[]).map((raw:unknown)=>{
   const l=object(raw),meta=object(l.metadata),index=String(meta.ta_line_index),expected=d.lines[Number(index)];
   if(!/^\d+$/.test(index)||String(Number(index))!==index||typeof l.id!=='string'||!/^il_[A-Za-z0-9]+$/.test(l.id)||!expected||seen.has(index)||meta.ta_classification!==expected.classification||l.amount!==expected.amountCents||l.description!==expected.description||l.currency!=='usd'||l.discountable!==false||!empty(l.discount_amounts)||!empty(l.taxes)||!empty(l.tax_amounts)||!empty(l.tax_rates))fail('INVOICE_LINES_CHANGED');
   seen.add(index);const period=object(l.period);
   if(expected.startsOn&&expected.endsOn&&(period.start!==Date.parse(localInstant(expected.startsOn,0))/1000||period.end!==Date.parse(localInstant(addDays(expected.endsOn,1),0))/1000-1))fail('INVOICE_SERVICE_PERIOD_CHANGED');
   return {index:Number(index),id:l.id,amountCents:l.amount,description:l.description,classification:meta.ta_classification,period};
  }).sort((a,b)=>a.index-b.index);
  // Include customer-facing presentation and payment settings in the exact review.
  const terms={account:this.config.accountId,mode:this.config.mode,invoiceId:source.invoiceId,exportId:source.exportId,customer:{...customer,address:rawCustomer.address??null,taxExempt:rawCustomer.tax_exempt??null},title:r.description,notes:r.footer??'',currency:'USD',totalCents:total,dueOn:d.dueOn,lines:checked,customerAddress:r.customer_address??null,customerName:r.customer_name??null,customerTaxIds:r.customer_tax_ids??[],accountTaxIds:r.account_tax_ids??[],paymentSettings:r.payment_settings??null,rendering:r.rendering??null,statementDescriptor:r.statement_descriptor??null,collection:'send_invoice',automaticAdvancement:false};
  return {terms,fingerprint:billingFingerprint(terms)};
 }
 async perform(id:string,source:InvoiceActionSource,operation:InvoiceAction,expected:string){
  z.uuid().parse(id);const before=await this.inspect(source,operation);
  if(before.fingerprint!==expected)fail('EXACT_REVIEW_CHANGED');
  const r=await this.call(`invoices/${source.invoiceId}/${operation==='issue'?'finalize':'send'}`,new URLSearchParams(operation==='issue'?{auto_advance:'false'}:{}),`ta-invoice-${operation}-${id}`);
  if(r.id!==source.invoiceId||r.status!=='open'||r.auto_advance!==false||r.livemode!==(this.config.mode==='live')||r.customer!==source.customerId)fail('INVOICE_ACTION_OUTCOME_UNCONFIRMED');
  // Finalization can change balances even with auto_advance off. Never describe
  // that as a clean issue/send if the resulting invoice differs from the review.
  const after=await this.inspect(source,'send');
  if(after.fingerprint!==expected)fail('INVOICE_ACTION_TERMS_CHANGED');
  return {invoiceId:source.invoiceId,status:'open',operation,mode:this.config.mode,providerAccepted:true,emailDeliveryConfirmed:false,notice:operation==='issue'?'Invoice finalized. No send request or charge request made.':this.config.mode==='test'?'Stripe accepted the test send request. Stripe does not deliver invoice emails in test mode.':'Stripe accepted the invoice email request. This is not proof of email delivery or payment.'};
 }
}
