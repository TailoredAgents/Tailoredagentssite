import 'server-only';
import {z} from 'zod';
import {StripeDraftClient,DraftProviderError} from './stripe-drafts';
import {billingFingerprint,zeroCashBalance} from './stripe-invoice-actions';
import {recurringPreviewSchema,recurringEnd,type RecurringTerms} from './recurring-contract';
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const empty=(v:unknown)=>v==null||Array.isArray(v)&&v.length===0;
const fail=(code:string):never=>{throw new DraftProviderError(code);};
export class StripeRecurringClient extends StripeDraftClient {
 async inspect(raw:RecurringTerms){
  const v=recurringPreviewSchema.parse(raw),start=Date.parse(v.startsAt);
  if(start<Date.now()+86400000||start>Date.now()+366*2*86400000)fail('RECURRING_START_REQUIRES_REVIEW');
  const customer=await this.customer(v.customerId),c=await this.call('customers/'+v.customerId),cash=await this.call('customers/'+v.customerId+'/cash_balance');
  if(customer.email!==v.recipientEmail||c.id!==customer.id||c.email!==customer.email||c.deleted===true||c.livemode!==(this.config.mode==='live')||c.balance!==0||c.delinquent===true||!empty(c.discount)||!empty(c.discounts)||cash.customer!==customer.id||cash.livemode!==(this.config.mode==='live')||!zeroCashBalance(cash.available))fail('RECURRING_CUSTOMER_REQUIRES_REVIEW');
  const price=await this.call('prices/'+v.priceId),recurring=obj(price.recurring);
  if(price.id!==v.priceId||price.active!==true||price.livemode!==(this.config.mode==='live')||price.currency!=='usd'||price.type!=='recurring'||price.billing_scheme!=='per_unit'||recurring.interval!=='month'||recurring.interval_count!==1||recurring.usage_type!=='licensed'||!empty(recurring.trial_period_days)||price.transform_quantity!=null||price.custom_unit_amount!=null||price.tiers_mode!=null||typeof price.unit_amount!=='number'||!Number.isSafeInteger(price.unit_amount)||price.unit_amount<50||price.unit_amount*v.quantity>1_000_000_000||(price.tax_behavior!=='inclusive'&&c.tax_exempt!=='exempt')||typeof price.product!=='string'||!/^prod_[A-Za-z0-9]+$/.test(price.product))fail('RECURRING_PRICE_REQUIRES_REVIEW');
  const product=await this.call('products/'+price.product);
  if(product.id!==price.product||product.active!==true||product.livemode!==(this.config.mode==='live')||typeof product.name!=='string')fail('RECURRING_PRODUCT_CHANGED');
  // Bound each list and hold if incomplete. Existing pending obligations must be
  // resolved, rather than implicitly attached or duplicated by a new schedule.
  for(const [path,terminal] of [['subscriptions?status=all&', ['canceled','incomplete_expired']],['subscription_schedules?', ['canceled','completed','released']],['invoices?', ['paid','void']],['invoiceitems?pending=true&', []]] as const){
   const list=await this.call(path+'customer='+v.customerId+'&limit=100');
   if(list.has_more!==false||!Array.isArray(list.data)||(list.data as unknown[]).some(x=>!(terminal as readonly unknown[]).includes(obj(x).status)))fail('EXISTING_BILLING_REQUIRES_RECONCILIATION');
  }
  const terms={account:this.config.accountId,mode:this.config.mode,customer:{...customer,address:c.address??null,taxExempt:c.tax_exempt??null},price:{id:price.id,product:product.id,name:product.name,currency:'USD',unitAmountCents:price.unit_amount,quantity:v.quantity,monthlyTotalCents:(price.unit_amount as number)*v.quantity,taxBehavior:price.tax_behavior},startsAt:v.startsAt,endsAt:recurringEnd(v),months:v.months,daysUntilDue:v.daysUntilDue,collection:'send_invoice',automaticTax:false,endBehavior:'cancel',proration:'none',authorizationReference:v.authorizationReference,taxReviewReference:v.taxReviewReference};
  return {terms,fingerprint:billingFingerprint(terms)};
 }
 async createSchedule(id:string,v:RecurringTerms,fingerprint:string,checkpoint:(id:string)=>Promise<void>){
  z.uuid().parse(id);const before=await this.inspect(v);if(before.fingerprint!==fingerprint)fail('RECURRING_REVIEW_CHANGED');
  const body=new URLSearchParams({customer:v.customerId,start_date:String(Date.parse(v.startsAt)/1000),end_behavior:'cancel','metadata[ta_recurring_setup]':id,
   'default_settings[collection_method]':'send_invoice','default_settings[automatic_tax][enabled]':'false','default_settings[invoice_settings][days_until_due]':String(v.daysUntilDue),'default_settings[invoice_settings][issuer][type]':'self',
   'phases[0][items][0][price]':v.priceId,'phases[0][items][0][quantity]':String(v.quantity),'phases[0][items][0][tax_rates]':'','phases[0][items][0][discounts]':'',
   'phases[0][end_date]':String(Date.parse(recurringEnd(v))/1000),'phases[0][collection_method]':'send_invoice','phases[0][automatic_tax][enabled]':'false',
   'phases[0][invoice_settings][days_until_due]':String(v.daysUntilDue),'phases[0][invoice_settings][issuer][type]':'self','phases[0][proration_behavior]':'none','phases[0][discounts]':'','phases[0][default_tax_rates]':'','phases[0][metadata][ta_recurring_setup]':id});
  const first=await this.call('subscription_schedules',body,'ta-recurring-'+id);
  if(typeof first.id!=='string'||!/^sub_sched_[A-Za-z0-9]+$/.test(first.id)||first.customer!==v.customerId||first.livemode!==(this.config.mode==='live'))fail('RECURRING_IDENTITY_UNCONFIRMED');
  await checkpoint(first.id as string);const r=await this.call('subscription_schedules/'+first.id),settings=obj(r.default_settings),phases=r.phases;
  if(r.id!==first.id||r.customer!==v.customerId||r.livemode!==(this.config.mode==='live')||r.status!=='not_started'||r.end_behavior!=='cancel'||r.subscription!=null||obj(r.metadata).ta_recurring_setup!==id||settings.on_behalf_of!=null||settings.transfer_data!=null||settings.application_fee_percent!=null&&settings.application_fee_percent!==0||obj(obj(settings.invoice_settings).issuer).type!=='self'||settings.collection_method!=='send_invoice'||obj(settings.automatic_tax).enabled!==false||obj(settings.invoice_settings).days_until_due!==v.daysUntilDue||!Array.isArray(phases)||phases.length!==1)fail('RECURRING_SETUP_UNCONFIRMED');
  const phase=obj((phases as unknown[])[0]),items=phase.items;
  if(phase.start_date!==Date.parse(v.startsAt)/1000||phase.end_date!==Date.parse(recurringEnd(v))/1000||phase.on_behalf_of!=null||phase.transfer_data!=null||phase.application_fee_percent!=null&&phase.application_fee_percent!==0||obj(obj(phase.invoice_settings).issuer).type!=='self'||phase.currency!=='usd'||phase.collection_method!=='send_invoice'||obj(phase.automatic_tax).enabled!==false||obj(phase.invoice_settings).days_until_due!==v.daysUntilDue||phase.proration_behavior!=='none'||!empty(phase.discounts)||!empty(phase.default_tax_rates)||!empty(phase.add_invoice_items)||phase.trial_end!=null||!Array.isArray(items)||items.length!==1)fail('RECURRING_PHASE_UNCONFIRMED');
  const item=obj((items as unknown[])[0]);if(item.price!==v.priceId||item.quantity!==v.quantity||!empty(item.tax_rates)||!empty(item.discounts))fail('RECURRING_PRICE_UNCONFIRMED');
  return {scheduleId:first.id,mode:this.config.mode,observedStatus:'not_started',startsAt:v.startsAt,endsAt:recurringEnd(v),monthlyTotalCents:before.terms.price.monthlyTotalCents,notice:'Recurring schedule created. Stripe can generate and send monthly invoices during this approved term. No automatic card charging was configured. Future invoice delivery, payments and changes require monitoring; disabling our write switch does not cancel this Stripe schedule.'};
 }
}
