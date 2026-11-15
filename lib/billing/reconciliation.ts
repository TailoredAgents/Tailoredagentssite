import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {getDatabasePool} from '@/lib/dashboard/db';
import {billingConfig,STRIPE_VERSION,type StripeConfig} from './config';
import {invoiceFactsSchema,providerId,type InvoiceFacts} from './contract';
import {StripeReadClient,StripeReadError,type StripeReader} from './stripe';

async function transaction<T>(work:(db:PoolClient)=>Promise<T>){const db=await getDatabasePool().connect();try{await db.query('BEGIN');const result=await work(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
export async function queueBillingJob(db:PoolClient,connectionId:string,invoiceId?:string){
 const key=invoiceId?'invoice:'+invoiceId:'scan';
 await db.query(`INSERT INTO crm_billing_jobs(id,connection_id,job_key,kind,object_id) VALUES($1,$2,$3,$4,$5)
 ON CONFLICT(connection_id,job_key) DO UPDATE SET requested_revision=crm_billing_jobs.requested_revision+1,
 status=CASE WHEN crm_billing_jobs.status='running' THEN 'running' ELSE 'queued' END,
 cursor=CASE WHEN crm_billing_jobs.status='running' THEN crm_billing_jobs.cursor ELSE NULL END,
 attempts=0,available_at=now(),last_error=NULL,updated_at=now()`,[randomUUID(),connectionId,key,invoiceId?'invoice':'scan',invoiceId??null]);
}
export async function billingConnection(config:StripeConfig,reader:StripeReader){
 if(await reader.account()!==config.accountId)throw new StripeReadError('ACCOUNT_MISMATCH');
 return transaction(async db=>{
  if(!(await db.query("SELECT 1 FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[config.workspaceId])).rowCount)throw new StripeReadError('WORKSPACE_INACTIVE');
  await db.query('INSERT INTO crm_billing_connections(id,workspace_id,account_id,mode,api_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,mode) DO NOTHING',[randomUUID(),config.workspaceId,config.accountId,config.mode,STRIPE_VERSION]);
  const c=(await db.query('SELECT * FROM crm_billing_connections WHERE account_id=$1 AND mode=$2 FOR UPDATE',[config.accountId,config.mode])).rows[0];
  if(c.workspace_id!==config.workspaceId||c.api_version!==STRIPE_VERSION)throw new StripeReadError('CONNECTION_MISMATCH');
  const active=(await db.query("SELECT 1 FROM crm_billing_jobs WHERE connection_id=$1 AND kind='scan' AND status<>'done'",[c.id])).rowCount;
  if(!active&&(!c.last_scan_at||Date.now()-c.last_scan_at.getTime()>86400000))await queueBillingJob(db,c.id);
  return c as {id:string;workspace_id:string;mode:string;account_id:string};
 });
}
export async function receiveBillingEvent(config:StripeConfig,body:string){
 const event=z.object({id:providerId,type:z.string().max(150),api_version:z.literal(STRIPE_VERSION),livemode:z.boolean(),account:z.string().optional(),data:z.object({object:z.object({id:providerId.optional()})})}).parse(JSON.parse(body));
 if(event.livemode!==(config.mode==='live')||event.account&&event.account!==config.accountId)throw new StripeReadError('EVENT_IDENTITY_MISMATCH');
 const supported=/^(invoice\.|invoice_payment\.|charge\.|refund\.|credit_note\.|customer\.subscription\.|balance\.available$|payout\.)/.test(event.type);
 if(!supported)return {ignored:true};
 const objectId=event.data.object.id??(event.type==='balance.available'?'balance':null);if(!objectId)throw new StripeReadError('EVENT_OBJECT_MISSING');
 return transaction(async db=>{
  const c=(await db.query("SELECT c.id FROM crm_billing_connections c JOIN workspaces w ON w.id=c.workspace_id WHERE c.workspace_id=$1 AND c.account_id=$2 AND c.mode=$3 AND c.api_version=$4 AND w.status='active' FOR SHARE OF c,w",[config.workspaceId,config.accountId,config.mode,STRIPE_VERSION])).rows[0];
  if(!c)throw new StripeReadError('CONNECTION_NOT_VERIFIED');
  const hash=createHash('sha256').update(body).digest('hex');
  const inserted=await db.query('INSERT INTO crm_billing_events(connection_id,event_id,event_type,object_id,payload_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[c.id,event.id,event.type,objectId,hash]);
  if(!inserted.rowCount)return {duplicate:true};
  await queueBillingJob(db,c.id,event.type.startsWith('invoice.')&&/^in_[A-Za-z0-9]+$/.test(objectId)?objectId:undefined);
  return {queued:true};
 });
}

type Job={id:string;connection_id:string;kind:'invoice'|'scan';object_id:string|null;cursor:string|null;requested_revision:number;attempts:number;lease_token:string};
export async function claimBillingJob(connectionId:string){
 return transaction(async db=>{
  const j=(await db.query(`SELECT * FROM crm_billing_jobs WHERE connection_id=$1 AND ((status IN ('queued','retry') AND available_at<=now()) OR (status='running' AND lease_until<now())) ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,[connectionId])).rows[0];
  if(!j)return null;const token=randomUUID();
  await db.query("UPDATE crm_billing_jobs SET status='running',lease_token=$2,lease_until=now()+interval '150 seconds',attempts=attempts+1,updated_at=now() WHERE id=$1",[j.id,token]);
  return {...j,attempts:j.attempts+1,lease_token:token} as Job;
 });
}
async function lease(db:PoolClient,j:Job){
 const current=(await db.query("SELECT * FROM crm_billing_jobs WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>now() FOR UPDATE",[j.id,j.lease_token])).rows[0];
 if(!current)throw new StripeReadError('LEASE_LOST');return current;
}
export async function finishBillingInvoice(job:Job,workspaceId:string,input:unknown){
 const facts=invoiceFactsSchema.parse(input);if(facts.providerId!==job.object_id)throw new StripeReadError('IDENTITY_MISMATCH');
 return transaction(async db=>{
  const current=await lease(db,job);
  if(!(await db.query("SELECT 1 FROM crm_billing_connections c JOIN workspaces w ON w.id=c.workspace_id WHERE c.id=$1 AND c.workspace_id=$2 AND w.status='active' FOR SHARE OF c,w",[job.connection_id,workspaceId])).rowCount)throw new StripeReadError('WORKSPACE_INACTIVE');
  await db.query('INSERT INTO crm_billing_invoices(id,workspace_id,connection_id,provider_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[randomUUID(),workspaceId,job.connection_id,facts.providerId]);
  const i=(await db.query('SELECT i.*,s.fingerprint FROM crm_billing_invoices i LEFT JOIN crm_billing_snapshots s ON s.id=i.snapshot_id WHERE i.connection_id=$1 AND i.provider_id=$2 FOR UPDATE OF i',[job.connection_id,facts.providerId])).rows[0];
  const hash=createHash('sha256').update(JSON.stringify(facts)).digest('hex');
  if(i.fingerprint!==hash){
   const snapshot=randomUUID();await db.query('INSERT INTO crm_billing_snapshots(id,invoice_id,fingerprint,facts) VALUES($1,$2,$3,$4)',[snapshot,i.id,hash,facts]);
   await db.query('UPDATE crm_billing_invoices SET snapshot_id=$2,revision=revision+1,observed_at=now() WHERE id=$1',[i.id,snapshot]);
  }else await db.query('UPDATE crm_billing_invoices SET observed_at=now() WHERE id=$1',[i.id]);
  for(const receipt of facts.receipts){
   await db.query('INSERT INTO crm_billing_receipts(connection_id,charge_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[job.connection_id,receipt.chargeId]);
   await db.query('INSERT INTO crm_billing_payment_links(connection_id,payment_id,charge_id,invoice_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[job.connection_id,receipt.paymentId,receipt.chargeId,i.id]);
   const link=(await db.query('SELECT charge_id,invoice_id FROM crm_billing_payment_links WHERE connection_id=$1 AND payment_id=$2',[job.connection_id,receipt.paymentId])).rows[0];
   if(link.charge_id!==receipt.chargeId||link.invoice_id!==i.id)throw new StripeReadError('PAYMENT_IDENTITY_CHANGED');
  }
  await db.query("UPDATE crm_billing_jobs SET status=$2,lease_token=NULL,lease_until=NULL,attempts=0,last_error=NULL,available_at=now(),updated_at=now() WHERE id=$1",[job.id,current.requested_revision===job.requested_revision?'done':'queued']);
  return {invoiceId:i.id,changed:i.fingerprint!==hash};
 });
}
async function finishScan(job:Job,page:{ids:string[];more:boolean}){
 return transaction(async db=>{
  const current=await lease(db,job);
  for(const id of page.ids)await queueBillingJob(db,job.connection_id,id);
  const repeat=current.requested_revision!==job.requested_revision;
  if(!page.more&&!repeat)await db.query('UPDATE crm_billing_connections SET last_scan_at=now() WHERE id=$1',[job.connection_id]);
  await db.query("UPDATE crm_billing_jobs SET status=$2,cursor=$3,lease_token=NULL,lease_until=NULL,attempts=0,last_error=NULL,available_at=now(),updated_at=now() WHERE id=$1",[job.id,page.more||repeat?'queued':'done',repeat?null:page.more?page.ids.at(-1):null]);
 });
}
async function failed(job:Job,error:unknown){
 const code=error instanceof StripeReadError?error.code:'SOURCE_VALIDATION_FAILED';
 await getDatabasePool().query("UPDATE crm_billing_jobs SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'retry' END,last_error=$3,available_at=now()+make_interval(secs=>$4),lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='running'",[job.id,job.lease_token,code,Math.min(3600,30*2**Math.min(job.attempts,7))]);
 return code;
}
export async function runBillingWorkerStep(options?:{config:StripeConfig;reader:StripeReader}){
 const config=options?.config??billingConfig();if(!config)return {disabled:true,processed:0};
 const reader=options?.reader??new StripeReadClient(config),connection=await billingConnection(config,reader),job=await claimBillingJob(connection.id);
 if(!job)return {processed:0};
 try{
  if(job.kind==='scan')await finishScan(job,await reader.invoicePage(job.cursor));
  else await finishBillingInvoice(job,connection.workspace_id,await reader.invoice(job.object_id!));
  return {processed:1};
 }catch(e){return {processed:0,error:await failed(job,e)};}
}
export type {Job,InvoiceFacts};
