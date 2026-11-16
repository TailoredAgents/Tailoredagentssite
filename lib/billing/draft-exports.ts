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
import {stripeDraftConfig,StripeDraftClient,DraftProviderError,type DraftConfig} from './stripe-drafts';
import {STRIPE_VERSION} from './config';
export const draftExportSchema=z.object({documentId:z.uuid(),revision:z.number().int().positive(),customerId:z.string().regex(/^cus_[A-Za-z0-9]+$/)}).strict();
function configured(c:DashboardContext){const config=stripeDraftConfig();if(!config||config.workspaceId!==c.workspace.id)throw new SalesAccessError('Stripe draft creation is not enabled for this workspace.');return config;}
async function source(db:PoolClient,c:DashboardContext,v:z.infer<typeof draftExportSchema>,config:DraftConfig){
 const d=(await db.query("SELECT * FROM crm_commercial_documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE",[c.workspace.id,v.documentId])).rows[0];
 if(!d||d.kind!=='invoice'||d.status!=='reviewed'||d.revision!==v.revision)throw new SalesAccessError('Choose the exact finance-reviewed invoice revision.');
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commercial:${c.workspace.id}:${d.family_id}`]);
 if((await db.query('SELECT 1 FROM crm_commercial_documents WHERE workspace_id=$1 AND family_id=$2 AND version>$3',[c.workspace.id,d.family_id,d.version])).rowCount)throw new SalesAccessError('A newer invoice version exists. Review it first.');
 const connection=(await db.query('SELECT b.id FROM crm_billing_connections b JOIN crm_billing_customer_maps m ON m.connection_id=b.id AND m.workspace_id=b.workspace_id WHERE b.workspace_id=$1 AND b.account_id=$2 AND b.mode=$3 AND b.api_version=$4 AND m.customer_id=$5 AND m.client_id=$6 FOR SHARE OF b,m',[c.workspace.id,config.accountId,config.mode,STRIPE_VERSION,v.customerId,d.client_id])).rows[0];
 if(!connection)throw new SalesAccessError('Review the Stripe customer mapping and account connection first.');
 return {d,connection,details:invoiceDetails.parse(d.details)};
}
export async function stripeDraftReview(c:DashboardContext,input:unknown){const v=draftExportSchema.parse(input),config=configured(c);return workTransaction(c,true,async(db,role)=>{
 await commercialAccess(db,c,role,true);const {d,details,connection}=await source(db,c,v,config),customer=await new StripeDraftClient(config).customer(v.customerId);
 if(customer.email.toLowerCase()!==details.recipientEmail.toLowerCase())throw new SalesAccessError('The Stripe customer email differs from the reviewed invoice recipient.');
 return {account:config.accountId,mode:config.mode,connectionId:connection.id,documentId:d.id,revision:d.revision,title:d.title,customer,details,totalCents:details.lines.reduce((n,l)=>n+l.amountCents,0),notice:'Create a Stripe draft only. Automatic advancement, collection and tax calculation are disabled. Pending items and customer discounts are excluded. No finalization, email, payment or subscription. Uncertain results require reconciliation before any new export.'};
 });}
export async function createStripeDraft(c:DashboardContext,input:unknown){
 const v=draftExportSchema.parse(input),config=configured(c);
 const claim=await workTransaction(c,true,async(db,role)=>{
  await commercialAccess(db,c,role,true);const s=await source(db,c,v,config);
  const existing=(await db.query('SELECT * FROM crm_billing_draft_exports WHERE connection_id=$1 AND family_id=$2',[s.connection.id,s.d.family_id])).rows[0];if(existing)return {existing};
  const id=randomUUID();await db.query("INSERT INTO crm_billing_draft_exports(id,workspace_id,connection_id,document_id,family_id,document_revision,customer_id,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'running',$8)",[id,c.workspace.id,s.connection.id,s.d.id,s.d.family_id,s.d.revision,v.customerId,c.user.id]);return {id,...s};
 });
 if('existing' in claim)return {id:claim.existing.id,status:claim.existing.status,providerInvoiceId:claim.existing.provider_invoice_id,notice:'Existing export preserved. Do not retry under a new invoice family.'};
 const pool=getDatabasePool();try{
  const id=await new StripeDraftClient(config).create(claim.id!,v.customerId,claim.d!.title,claim.details!,async invoice=>{await pool.query('UPDATE crm_billing_draft_exports SET provider_invoice_id=$2,updated_at=now() WHERE id=$1',[claim.id,invoice]);});
  await pool.query("UPDATE crm_billing_draft_exports SET status='ready',updated_at=now() WHERE id=$1",[claim.id]);return {id:claim.id,status:'ready',providerInvoiceId:id,notice:'Stripe draft created. Not finalized, sent, charged or posted to commissions.'};
 }catch(e){await pool.query("UPDATE crm_billing_draft_exports SET status='needs_review',last_error=$2,updated_at=now() WHERE id=$1",[claim.id,e instanceof DraftProviderError?e.message:'OUTCOME_UNCONFIRMED']);return {id:claim.id,status:'needs_review',notice:'The export may be incomplete. Inspect the recorded provider invoice and reconcile before any new attempt. No automatic retry.'};}
}
export async function getStripeDraftExport(c:DashboardContext,id:string){z.uuid().parse(id);return workTransaction(c,false,async(db,role)=>{await commercialAccess(db,c,role);const row=(await db.query('SELECT e.*,b.account_id,b.mode FROM crm_billing_draft_exports e JOIN crm_billing_connections b ON b.id=e.connection_id WHERE e.workspace_id=$1 AND e.id=$2',[c.workspace.id,id])).rows[0];if(!row)throw new SalesAccessError('That export is unavailable.');return {...row,notice:row.status==='running'?'If this operation is no longer active, treat its outcome as unknown. Reconcile in Stripe before another export.':null};});}
