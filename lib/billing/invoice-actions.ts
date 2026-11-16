import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {workTransaction} from '@/lib/relationships/transactions';
import {commercialAccess} from '@/lib/commercial/access';
import {invoiceDetails} from '@/lib/commercial/contract';
import {SalesAccessError} from '@/lib/sales/data';
import {stripeDraftConfig,DraftProviderError,type DraftConfig} from './stripe-drafts';
import {StripeInvoiceClient,type InvoiceAction} from './stripe-invoice-actions';
import {STRIPE_VERSION} from './config';

export const invoiceActionPreviewSchema=z.object({exportId:z.uuid(),operation:z.enum(['issue','send'])}).strict();
export const invoiceActionSchema=invoiceActionPreviewSchema.extend({fingerprint:z.string().regex(/^[a-f0-9]{64}$/)});
function configured(c:DashboardContext,operation:InvoiceAction){
 const config=stripeDraftConfig(),flag=operation==='issue'?'BILLING_STRIPE_INVOICE_ISSUE_ENABLED':'BILLING_STRIPE_INVOICE_SEND_ENABLED';
 if(!config||config.workspaceId!==c.workspace.id||process.env[flag]!=='true')throw new SalesAccessError('This Stripe invoice action is not enabled for this workspace.');return config;
}
async function source(db:PoolClient,c:DashboardContext,exportId:string,config:DraftConfig){
 const e=(await db.query(`SELECT e.*,b.account_id,b.mode,b.api_version FROM crm_billing_draft_exports e
 JOIN crm_billing_connections b ON b.id=e.connection_id WHERE e.id=$1 AND e.workspace_id=$2 FOR UPDATE OF e`,[exportId,c.workspace.id])).rows[0];
 if(!e||e.status!=='ready'||!e.provider_invoice_id||e.account_id!==config.accountId||e.mode!==config.mode||e.api_version!==STRIPE_VERSION)throw new SalesAccessError('Choose a verified draft export in the configured account and mode.');
 const d=(await db.query('SELECT * FROM crm_commercial_documents WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[e.document_id,c.workspace.id])).rows[0];
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commercial:${c.workspace.id}:${e.family_id}`]);
 if(!d||d.kind!=='invoice'||d.status!=='reviewed'||d.revision!==e.document_revision||(await db.query('SELECT 1 FROM crm_commercial_documents WHERE workspace_id=$1 AND family_id=$2 AND version>$3',[c.workspace.id,e.family_id,d.version])).rowCount)throw new SalesAccessError('The reviewed local invoice changed. Reconcile before issuing or sending.');
 if(!(await db.query('SELECT 1 FROM crm_billing_customer_maps WHERE workspace_id=$1 AND connection_id=$2 AND customer_id=$3 AND client_id=$4 FOR SHARE',[c.workspace.id,e.connection_id,e.customer_id,d.client_id])).rowCount)throw new SalesAccessError('Review the current customer mapping first.');
 return {exportId:e.id,invoiceId:e.provider_invoice_id,customerId:e.customer_id,title:d.title,details:invoiceDetails.parse(d.details)};
}
async function prerequisite(db:PoolClient,exportId:string,operation:InvoiceAction){
 if(operation==='send'&&!(await db.query("SELECT 1 FROM crm_billing_invoice_actions WHERE export_id=$1 AND operation='issue' AND status='confirmed'",[exportId])).rowCount)throw new SalesAccessError('Confirm the reviewed invoice issue operation before sending.');
}
export async function previewStripeInvoiceAction(c:DashboardContext,input:unknown){
 const v=invoiceActionPreviewSchema.parse(input),config=configured(c,v.operation);
 return workTransaction(c,true,async(db,role)=>{
  await commercialAccess(db,c,role,true);const s=await source(db,c,v.exportId,config);await prerequisite(db,v.exportId,v.operation);
  if((await db.query('SELECT 1 FROM crm_billing_invoice_actions WHERE export_id=$1 AND operation=$2',[v.exportId,v.operation])).rowCount)throw new SalesAccessError('This action already has a receipt. Read the export; do not retry or resend.');
  const review=await new StripeInvoiceClient(config).inspect(s,v.operation);
  return {...review,operation:v.operation,notice:v.operation==='issue'?'Finalize this exact invoice. This makes its amount and billing details final; it does not request email delivery or charge a payment method.':'Send this exact finalized invoice through Stripe to the displayed billing email. No charge request. Provider acceptance does not prove email delivery. Test mode does not deliver an email.'};
 });
}
export async function stripeInvoiceActionReview(c:DashboardContext,input:unknown){const v=invoiceActionSchema.parse(input),r=await previewStripeInvoiceAction(c,{exportId:v.exportId,operation:v.operation});if(r.fingerprint!==v.fingerprint)throw new SalesAccessError('The invoice changed since preview. Read it again and prepare a fresh review.');return r;}
export async function performStripeInvoiceAction(c:DashboardContext,input:unknown){
 const v=invoiceActionSchema.parse(input),config=configured(c,v.operation);
 const claim=await workTransaction(c,true,async(db,role)=>{
  await commercialAccess(db,c,role,true);const s=await source(db,c,v.exportId,config);
  const old=(await db.query('SELECT id,status,result,fingerprint FROM crm_billing_invoice_actions WHERE export_id=$1 AND operation=$2',[v.exportId,v.operation])).rows[0];
  if(old){if(old.fingerprint!==v.fingerprint)throw new SalesAccessError('That invoice action already has a different reviewed request. Reconcile its receipt.');return {existing:old};}
  await prerequisite(db,v.exportId,v.operation);
  const review=await new StripeInvoiceClient(config).inspect(s,v.operation);if(review.fingerprint!==v.fingerprint)throw new SalesAccessError('The exact reviewed invoice changed.');
  const id=randomUUID();await db.query("INSERT INTO crm_billing_invoice_actions(id,workspace_id,export_id,operation,fingerprint,review,status,created_by) VALUES($1,$2,$3,$4,$5,$6,'running',$7)",[id,c.workspace.id,v.exportId,v.operation,v.fingerprint,JSON.stringify(review),c.user.id]);return {id,source:s};
 });
 if('existing' in claim)return {id:claim.existing.id,status:claim.existing.status,result:claim.existing.result,notice:'Existing receipt preserved; no provider retry.'};
 try{
  const result=await new StripeInvoiceClient(config).perform(claim.id!,claim.source!,v.operation,v.fingerprint);
  await getDatabasePool().query("UPDATE crm_billing_invoice_actions SET status='confirmed',result=$2,updated_at=now() WHERE id=$1",[claim.id,JSON.stringify(result)]);
  return {id:claim.id,status:'confirmed',result};
 }catch(e){
  await getDatabasePool().query("UPDATE crm_billing_invoice_actions SET status='needs_review',last_error=$2,updated_at=now() WHERE id=$1",[claim.id,e instanceof DraftProviderError?e.message:'OUTCOME_UNCONFIRMED']);
  return {id:claim.id,status:'needs_review',notice:'The provider may have completed this action. Inspect this receipt and Stripe before doing anything else. Never retry with a different invoice or request.'};
 }
}
