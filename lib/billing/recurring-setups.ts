import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {workTransaction} from '@/lib/relationships/transactions';
import {commercialAccess} from '@/lib/commercial/access';
import {SalesAccessError} from '@/lib/sales/data';
import {stripeDraftConfig,DraftProviderError,type DraftConfig} from './stripe-drafts';
import {StripeRecurringClient} from './stripe-recurring';
import {billingFingerprint} from './stripe-invoice-actions';
import {recurringPreviewSchema,recurringSetupSchema,type RecurringTerms} from './recurring-contract';
import {STRIPE_VERSION} from './config';
const notice='Approve a bounded recurring billing commitment: Stripe can generate and send monthly invoices automatically during this term. Manual collection only; no automatic card charge. The recorded signed agreement must authorize the amount, taxes, dates and notifications. Disabling our feature flag does not cancel a schedule already created in Stripe.';
function configured(c:DashboardContext){const config=stripeDraftConfig();if(!config||config.workspaceId!==c.workspace.id||process.env.BILLING_STRIPE_RECURRING_ENABLED!=='true')throw new SalesAccessError('Recurring Stripe setup is not enabled for this workspace.');return config;}
async function source(db:PoolClient,c:DashboardContext,v:RecurringTerms,config:DraftConfig){
 const d=(await db.query('SELECT * FROM crm_commercial_documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,v.documentId])).rows[0];
 if(!d||d.kind!=='customer_service'||d.status!=='executed'||d.revision!==v.revision||!d.client_id)throw new SalesAccessError('Choose the exact executed customer service agreement.');
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commercial:${c.workspace.id}:${d.family_id}`]);
 if((await db.query('SELECT 1 FROM crm_commercial_documents WHERE workspace_id=$1 AND family_id=$2 AND version>$3',[c.workspace.id,d.family_id,d.version])).rowCount)throw new SalesAccessError('A newer agreement version exists. Review the current signed terms first.');
 if(new Date(d.effective_on).toISOString().slice(0,10)>v.startsAt.slice(0,10))throw new SalesAccessError('Recurring billing cannot start before the recorded agreement effective date.');
 const b=(await db.query(`SELECT b.id FROM crm_billing_connections b JOIN crm_billing_customer_maps m ON m.connection_id=b.id AND m.workspace_id=b.workspace_id
 WHERE b.workspace_id=$1 AND b.account_id=$2 AND b.mode=$3 AND b.api_version=$4 AND m.client_id=$5 AND m.customer_id=$6 FOR SHARE OF b,m`,[c.workspace.id,config.accountId,config.mode,STRIPE_VERSION,d.client_id,v.customerId])).rows[0];
 if(!b)throw new SalesAccessError('Review the exact Stripe customer mapping first.');
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`stripe-recurring:${c.workspace.id}:${b.id}:${d.client_id}`]);
 return {d,connectionId:b.id};
}
async function reviewed(s:Awaited<ReturnType<typeof source>>,v:RecurringTerms,config:DraftConfig){
 const provider=await new StripeRecurringClient(config).inspect(v);
 const agreement={id:s.d.id,revision:s.d.revision,version:s.d.version,title:s.d.title,clientId:s.d.client_id,effectiveOn:new Date(s.d.effective_on).toISOString().slice(0,10),details:s.d.details,evidence:s.d.evidence};
 const content={provider,agreement,connectionId:s.connectionId,notice};return {...content,fingerprint:billingFingerprint(content)};
}
export async function previewStripeRecurring(c:DashboardContext,input:unknown){const v=recurringPreviewSchema.parse(input),config=configured(c);return workTransaction(c,true,async(db,role)=>{
 await commercialAccess(db,c,role,true);const s=await source(db,c,v,config);
 if((await db.query('SELECT 1 FROM crm_billing_recurring_setups WHERE connection_id=$1 AND client_id=$2',[s.connectionId,s.d.client_id])).rowCount)throw new SalesAccessError('This customer already has a recurring setup receipt. Reconcile in Stripe; do not create another subscription.');
 return reviewed(s,v,config);
});}
export async function stripeRecurringReview(c:DashboardContext,input:unknown){const v=recurringSetupSchema.parse(input),r=await previewStripeRecurring(c,recurringPreviewSchema.parse(Object.fromEntries(Object.entries(v).filter(([key])=>key!=='fingerprint'))));if(r.fingerprint!==v.fingerprint)throw new SalesAccessError('Recurring terms changed since preview. Review again.');return r;}
export async function createStripeRecurring(c:DashboardContext,input:unknown){
 const v=recurringSetupSchema.parse(input),terms=recurringPreviewSchema.parse(Object.fromEntries(Object.entries(v).filter(([key])=>key!=='fingerprint'))),config=configured(c);
 const claim=await workTransaction(c,true,async(db,role)=>{
  await commercialAccess(db,c,role,true);const s=await source(db,c,terms,config);
  const old=(await db.query('SELECT * FROM crm_billing_recurring_setups WHERE connection_id=$1 AND client_id=$2',[s.connectionId,s.d.client_id])).rows[0];
  if(old){if(old.fingerprint!==v.fingerprint)throw new SalesAccessError('This customer already has a different recurring setup. Reconcile before any further billing.');return {existing:old};}
  const review=await reviewed(s,terms,config);if(review.fingerprint!==v.fingerprint)throw new SalesAccessError('The exact recurring terms changed.');
  const id=randomUUID();await db.query("INSERT INTO crm_billing_recurring_setups(id,workspace_id,connection_id,document_id,family_id,client_id,customer_id,fingerprint,review,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'running',$10)",[id,c.workspace.id,s.connectionId,s.d.id,s.d.family_id,s.d.client_id,v.customerId,v.fingerprint,JSON.stringify(review),c.user.id]);return {id,providerFingerprint:review.provider.fingerprint};
 });
 if('existing' in claim)return {id:claim.existing.id,status:claim.existing.status,result:claim.existing.result,notice:'Existing recurring setup receipt preserved. No provider retry.'};
 try{
  const result=await new StripeRecurringClient(config).createSchedule(claim.id!,terms,claim.providerFingerprint!,async schedule=>{await getDatabasePool().query('UPDATE crm_billing_recurring_setups SET provider_schedule_id=$2,updated_at=now() WHERE id=$1',[claim.id,schedule]);});
  await getDatabasePool().query("UPDATE crm_billing_recurring_setups SET status='confirmed',result=$2,updated_at=now() WHERE id=$1",[claim.id,JSON.stringify(result)]);return {id:claim.id,status:'confirmed',result};
 }catch(e){await getDatabasePool().query("UPDATE crm_billing_recurring_setups SET status='needs_review',last_error=$2,updated_at=now() WHERE id=$1",[claim.id,e instanceof DraftProviderError?e.message:'OUTCOME_UNCONFIRMED']);return {id:claim.id,status:'needs_review',notice:'A recurring schedule may already exist and could start billing later. Inspect Stripe immediately and cancel or correct it there if needed. Do not retry, even with a new agreement or request.'};}
}
export async function getStripeRecurringSetup(c:DashboardContext,id:string){z.uuid().parse(id);return workTransaction(c,false,async(db,role)=>{await commercialAccess(db,c,role);const row=(await db.query('SELECT r.*,b.account_id,b.mode FROM crm_billing_recurring_setups r JOIN crm_billing_connections b ON b.id=r.connection_id WHERE r.workspace_id=$1 AND r.id=$2',[c.workspace.id,id])).rows[0];if(!row)throw new SalesAccessError('That recurring setup is unavailable.');return {...row,notice:'This is the recorded setup outcome, not live subscription status. Check Stripe for subsequent changes and cancellations; never retry an uncertain operation.'};});}
