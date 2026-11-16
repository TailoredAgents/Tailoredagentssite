import 'server-only';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {workTransaction,once} from '@/lib/relationships/transactions';
import {commercialAccess} from '@/lib/commercial/access';
import {SalesAccessError} from '@/lib/sales/data';
import {billingConfig,STRIPE_VERSION,type StripeConfig} from './config';
import {StripeDraftClient} from './stripe-drafts';
import {billingFingerprint} from './stripe-invoice-actions';
export const customerMappingPreviewSchema=z.object({clientId:z.uuid(),customerId:z.string().regex(/^cus_[A-Za-z0-9]+$/)}).strict();
export const customerMappingSchema=customerMappingPreviewSchema.extend({requestId:z.uuid(),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),evidence:z.string().trim().min(10).max(2000)});
function configured(c:DashboardContext){const config=billingConfig();if(!config||config.workspaceId!==c.workspace.id)throw new SalesAccessError('Configure read-only billing for this workspace first.');return config;}
async function review(db:PoolClient,c:DashboardContext,v:z.infer<typeof customerMappingPreviewSchema>,config:StripeConfig){
 const client=(await db.query('SELECT id,name,status,updated_at FROM clients WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,v.clientId])).rows[0];if(!client)throw new SalesAccessError('Choose a customer in this workspace.');
 const connection=(await db.query('SELECT id FROM crm_billing_connections WHERE workspace_id=$1 AND account_id=$2 AND mode=$3 AND api_version=$4 FOR SHARE',[c.workspace.id,config.accountId,config.mode,STRIPE_VERSION])).rows[0];if(!connection)throw new SalesAccessError('Initialize the verified read-only billing connection first.');
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`billing-customer:${connection.id}:${v.customerId}`]);
 const existing=(await db.query('SELECT client_id FROM crm_billing_customer_maps WHERE connection_id=$1 AND customer_id=$2',[connection.id,v.customerId])).rows[0];if(existing&&existing.client_id!==client.id)throw new SalesAccessError('This Stripe customer is already mapped to another CRM customer. Reconcile the identity; do not overwrite it.');
 // Uses the separate read key and only account/customer GETs. A first invoice
 // or fabricated payment is not required to establish a reviewed identity map.
 const customer=await new StripeDraftClient(config).customer(v.customerId);
 const terms={connectionId:connection.id,account:config.accountId,mode:config.mode,client:{...client,updated_at:client.updated_at.toISOString()},customer,notice:'Link these exact identities in the CRM. This does not create a Stripe customer, invoice, payment, subscription or notification. Matching names or email alone do not prove identity.'};
 return {...terms,fingerprint:billingFingerprint(terms)};
}
export async function previewStripeCustomerMapping(c:DashboardContext,input:unknown){const v=customerMappingPreviewSchema.parse(input),config=configured(c);return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return review(db,c,v,config);});}
export async function stripeCustomerMappingReview(c:DashboardContext,input:unknown){const v=customerMappingSchema.parse(input),r=await previewStripeCustomerMapping(c,{clientId:v.clientId,customerId:v.customerId});if(r.fingerprint!==v.fingerprint)throw new SalesAccessError('The customer identity changed. Preview and review it again.');return {...r,evidence:v.evidence};}
export async function mapStripeCustomer(c:DashboardContext,input:unknown){const v=customerMappingSchema.parse(input),config=configured(c);return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'stripe_customer_map',v.requestId,v,async()=>{
 const r=await review(db,c,v,config);if(r.fingerprint!==v.fingerprint)throw new SalesAccessError('The exact reviewed customer identity changed.');
 await db.query('INSERT INTO crm_billing_customer_maps(connection_id,customer_id,workspace_id,client_id,evidence,actor_user_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[r.connectionId,v.customerId,c.workspace.id,v.clientId,v.evidence,c.user.id]);
 return {clientId:v.clientId,customerId:v.customerId,connectionId:r.connectionId,mapped:true,providerWrites:false};
});});}
