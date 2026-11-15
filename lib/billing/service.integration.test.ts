import {randomUUID,createHmac} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import type {DashboardContext} from '@/lib/dashboard/data';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {changeFinanceAccess} from '@/lib/partners/service';
import {saveCommercialDocument,changeCommercialDocument} from '@/lib/commercial/service';
import {createCustomerEntitlement,addEligibilityPeriod} from '@/lib/commercial/eligibility';
import {billingConnection,runBillingWorkerStep,receiveBillingEvent,queueBillingJob,claimBillingJob,finishBillingInvoice} from './reconciliation';
import {reviewBillingInvoice,billingWorkspace,getBillingInvoice,retryBillingReconciliation} from './service';
import {invoiceFixture,reviewFixture,billingTestConfig} from './test-fixtures';
import {STRIPE_VERSION} from './config';
import {StripeReadError,type StripeReader} from './stripe';
import {POST} from '@/app/api/integrations/stripe/events/route';
const url=process.env.OPERATING_TEST_DATABASE_URL,ws=billingTestConfig.workspaceId,other='183f6ee6-e2eb-4e47-a576-adf6c1228135',req=()=>randomUUID();
function actor(id:string,role:DashboardContext['role']='member',workspace=ws):DashboardContext{return {user:{id,name:id,email:id+'@example.test'},workspace:{id:workspace,name:'Synthetic billing workspace',slug:'test'},role};}
const owner=actor('billing-owner','owner'),member=actor('billing-member'),viewer=actor('billing-viewer','viewer'),foreign=actor('billing-foreign','owner',other);
let db:ReturnType<typeof getDatabasePool>,client:string,source:ReturnType<typeof invoiceFixture>,reader:StripeReader;
async function drain(){for(let n=0;n<15;n++){const r=await runBillingWorkerStep({config:billingTestConfig,reader});if(r.error)throw new Error(r.error);if(!r.processed)return;}throw new Error('Test queue did not drain.');}
async function imported(){await drain();return (await billingWorkspace(owner)).invoices[0];}
async function review(id:string){const i=await getBillingInvoice(owner,id);return {requestId:req(),invoiceId:id,snapshotId:i.invoice.snapshot_id,revision:i.invoice.revision,clientId:client,...reviewFixture()};}
async function queue(id='in_Synthetic'){const c=(await billingWorkspace(owner)).connections[0],p=await db.connect();try{await queueBillingJob(p,c.id,id);}finally{p.release();}}
describe.skipIf(!url)('Billing reconciliation',()=>{
 beforeAll(async()=>{
  const u=new URL(url!);if(!['localhost','127.0.0.1'].includes(u.hostname)||u.pathname!=='/ta_operating_test'||u.search||u.hash)throw new Error('Only isolated ta_operating_test is allowed.');
  vi.stubEnv('DATABASE_URL',url!);vi.stubEnv('NODE_ENV','test');vi.stubEnv('BILLING_STRIPE_IMPORT_ENABLED','false');vi.stubEnv('OPENAI_API_KEY','');db=getDatabasePool();
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())');
  for(const file of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort()){if((await db.query('SELECT 1 FROM schema_migrations WHERE filename=$1',[file])).rowCount)continue;await db.query(await readFile('db/migrations/'+file,'utf8'));await db.query('INSERT INTO schema_migrations(filename) VALUES($1)',[file]);}
 },30000);
 beforeEach(async()=>{
  await db.query('TRUNCATE crm_billing_connections,"user",leads,clients,crm_businesses,crm_opportunities,audit_logs CASCADE');
  await db.query("INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,'billing-other','Other','internal','active') ON CONFLICT(id) DO NOTHING",[other]);
  for(const a of [owner,member,viewer,foreign]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[a.user.id,a.user.name,a.user.email]);await db.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",[req(),a.workspace.id,a.user.id,a.role]);}
  client=req();await db.query("INSERT INTO clients(id,workspace_id,name) VALUES($1,$2,'Synthetic billing customer')",[client,ws]);source=invoiceFixture();reader={account:async()=>billingTestConfig.accountId,invoicePage:async()=>({ids:['in_Synthetic'],more:false}),invoice:async()=>structuredClone(source)};vi.stubEnv('BILLING_STRIPE_IMPORT_ENABLED','false');
 });
 afterAll(async()=>{await db?.end();vi.unstubAllEnvs();});
 it('does no work while disabled and rejects wrong merchant/workspace bindings',async()=>{
  expect(await runBillingWorkerStep()).toEqual({disabled:true,processed:0});expect((await billingWorkspace(owner)).connections).toEqual([]);
  await expect(billingConnection(billingTestConfig,{...reader,account:async()=>'acct_Wrong'})).rejects.toThrow(/ACCOUNT_MISMATCH/);
  await billingConnection(billingTestConfig,reader);await expect(billingConnection({...billingTestConfig,workspaceId:other},reader)).rejects.toThrow(/CONNECTION_MISMATCH/);
 });
 it('imports complete snapshots, verifies finance-reviewed mapping and leaves the legacy ledger untouched',async()=>{
  const i=await imported();expect((await getBillingInvoice(owner,i.id)).holds.join()).toMatch(/needs finance review/);
  await reviewBillingInvoice(owner,await review(i.id));const d=await getBillingInvoice(owner,i.id);expect(d.holds).toEqual([]);expect(d.collection?.netCents).toBe(15000);expect(d.calculation?.eligibleCents).toBe(10000);expect(d.calculation?.excludedCents).toBe(5000);expect(d.moneyMoved).toBe(false);
  expect(Number((await db.query('SELECT count(*) FROM crm_referral_earnings')).rows[0].count)).toBe(0);
 });
 it('enforces current finance authority and cross-workspace isolation',async()=>{
  const i=await imported(),input=await review(i.id);await expect(billingWorkspace(member)).rejects.toThrow(/Finance access/);await expect(reviewBillingInvoice(viewer,input)).rejects.toThrow(/workspace access/);await expect(getBillingInvoice(foreign,i.id)).rejects.toThrow(/unavailable/);
  await changeFinanceAccess(owner,{requestId:req(),userId:member.user.id,permission:'read'});expect((await getBillingInvoice(member,i.id)).manage).toBe(false);await expect(reviewBillingInvoice(member,input)).rejects.toThrow(/Finance access/);
  await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);await expect(billingWorkspace(member)).rejects.toThrow(/workspace access/);
 });
 it('deduplicates requests and processor identities independently of event IDs',async()=>{
  const i=await imported(),input=await review(i.id);const [a,b]=await Promise.all([reviewBillingInvoice(owner,input),reviewBillingInvoice(owner,input)]);expect(a).toEqual(b);
  await expect(reviewBillingInvoice(owner,{...input,evidence:'Changed private source evidence'})).rejects.toThrow(/different details/);
  const body=JSON.stringify({id:'evt_One',type:'invoice.paid',api_version:STRIPE_VERSION,livemode:false,data:{object:{id:'in_Synthetic'}}});expect(await receiveBillingEvent(billingTestConfig,body)).toEqual({queued:true});expect(await receiveBillingEvent(billingTestConfig,body)).toEqual({duplicate:true});await receiveBillingEvent(billingTestConfig,body.replace('evt_One','evt_Two'));await drain();
  expect(Number((await db.query('SELECT count(*) FROM crm_billing_receipts')).rows[0].count)).toBe(1);expect(Number((await db.query('SELECT count(*) FROM crm_billing_snapshots')).rows[0].count)).toBe(1);expect((await getBillingInvoice(owner,i.id)).holds).toEqual([]);
 });
 it('preserves immutable snapshots and reviews and invalidates approval when canonical facts change',async()=>{
  const i=await imported();await reviewBillingInvoice(owner,await review(i.id));source.receipts[0].refundedCents=3000;source.receipts[0].refunds=[{id:'re_Later',amountCents:3000,status:'succeeded',createdOn:'2026-02-01'}];await queue();await drain();
  const d=await getBillingInvoice(owner,i.id);expect(d.versions).toHaveLength(2);expect(d.reviews).toHaveLength(1);expect(d.holds.join()).toMatch(/needs finance review/);
  await expect(db.query('UPDATE crm_billing_snapshots SET fingerprint=$1 WHERE id=$2',['bad',d.versions[1].id])).rejects.toThrow(/append-only/);
  await expect(db.query('DELETE FROM crm_billing_reviews WHERE invoice_id=$1',[i.id])).rejects.toThrow(/append-only/);
  await reviewBillingInvoice(owner,await review(i.id));expect((await getBillingInvoice(owner,i.id)).collection?.netCents).toBe(12000);
 });
 it('rejects stale reviews, unclassified lines, tax laundering and customer mapping conflicts',async()=>{
  const i=await imported(),v=await review(i.id);await expect(reviewBillingInvoice(owner,{...v,lines:v.lines.slice(0,1)})).rejects.toThrow(/Classify every/);await reviewBillingInvoice(owner,v);await expect(reviewBillingInvoice(owner,{...v,requestId:req()})).rejects.toThrow(/source changed/);
  const otherClient=req();await db.query("INSERT INTO clients(id,workspace_id,name) VALUES($1,$2,'Other customer')",[otherClient,ws]);await expect(reviewBillingInvoice(owner,{...await review(i.id),clientId:otherClient})).rejects.toThrow(/different CRM client/);
  source.lines[0].taxCents=100;await queue();await drain();await expect(reviewBillingInvoice(owner,await review(i.id))).rejects.toThrow(/Separate the imported tax/);
 });
 it('fences abandoned leases so an older worker cannot overwrite a newer canonical snapshot',async()=>{
  const i=await imported();await queue();const con=(await billingWorkspace(owner)).connections[0],old=(await claimBillingJob(con.id))!;
  await db.query("UPDATE crm_billing_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[old.id]);const current=(await claimBillingJob(con.id))!;source.remainingCents=1;
  await finishBillingInvoice(current,ws,source);await expect(finishBillingInvoice(old,ws,invoiceFixture())).rejects.toThrow(/LEASE_LOST/);expect((await getBillingInvoice(owner,i.id)).invoice.facts.remainingCents).toBe(1);
 });
 it('persists provider errors, retries from the queue and exposes failed work for recovery',async()=>{
  const i=await imported();await queue();const failing={...reader,invoice:async()=>{throw new StripeReadError('RATE_LIMIT');}};
  expect((await runBillingWorkerStep({config:billingTestConfig,reader:failing})).error).toBe('RATE_LIMIT');const con=(await billingWorkspace(owner)).connections[0];
  await db.query("UPDATE crm_billing_jobs SET attempts=4,available_at=now() WHERE connection_id=$1 AND kind='invoice'",[con.id]);await runBillingWorkerStep({config:billingTestConfig,reader:failing});expect((await billingWorkspace(owner)).jobs[0].status).toBe('failed');
  await retryBillingReconciliation(owner,{requestId:req(),connectionId:con.id});await drain();expect((await billingWorkspace(owner)).jobs).toEqual([]);expect((await getBillingInvoice(owner,i.id)).versions).toHaveLength(1);
 });
 it('uses pagination checkpoints and rejects source allocation reuse across invoices',async()=>{
  reader.invoicePage=async cursor=>cursor?{ids:['in_Second'],more:false}:{ids:['in_Synthetic'],more:true};reader.invoice=async id=>({...structuredClone(source),providerId:id,receipts:[{...structuredClone(source.receipts[0]),paymentId:id==='in_Second'?'inpay_Second':'inpay_Synthetic'}]});await drain();
  const list=await billingWorkspace(owner);expect(list.invoices).toHaveLength(2);for(const i of list.invoices){await reviewBillingInvoice(owner,await review(i.id));expect((await getBillingInvoice(owner,i.id)).holds.join()).toMatch(/linked more than once/);}
 });
 it('calculates actual pinned internal rules and historical service periods after employee offboarding',async()=>{
  const d=await saveCommercialDocument(owner,{requestId:req(),kind:'internal_commission',userId:member.user.id,title:'Synthetic signed originator rule',details:{documentReference:'Synthetic executed document',scope:'Synthetic service',rules:[{role:'originator',rateBps:730,windowMonths:null,eligibility:'Synthetic historical eligible work',termination:'Synthetic earned history preserved',refunds:'Synthetic adjustments'}],exclusions:'Synthetic excluded setup',paymentTerms:'Synthetic monthly statements',reviewNotes:''}});
  await changeCommercialDocument(owner,{requestId:req(),id:d.id,revision:1,operation:'review',evidence:'Synthetic internal review'});await changeCommercialDocument(owner,{requestId:req(),id:d.id,revision:2,operation:'execute',effectiveOn:'2026-01-01',evidence:'Synthetic signed proof'});
  const e=await createCustomerEntitlement(owner,{requestId:req(),clientId:client,documentId:d.id,role:'originator',basis:'direct_origination',evidence:'Synthetic customer origination approval'});await addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:1,startsOn:'2026-01-01',endsBefore:'2026-02-01',evidence:'Synthetic service evidence'});
  await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);const i=await imported();await reviewBillingInvoice(owner,await review(i.id));const out=await getBillingInvoice(owner,i.id);expect(out.calculation?.commissionCents).toBe(730);expect(out.calculation?.entries[0].agreementId).toBe(d.id);
 });
 it('holds stale source evidence and bank-policy receipts until evidence is supplied',async()=>{
  const i=await imported();await reviewBillingInvoice(owner,{...await review(i.id),policy:'bank_verified'});expect((await getBillingInvoice(owner,i.id)).collection?.pendingCents).toBe(15000);
  await reviewBillingInvoice(owner,{...await review(i.id),policy:'bank_verified',bankEvidence:[{chargeId:'ch_Synthetic',clearedOn:'2026-01-07',reference:'Synthetic private bank reconciliation'}]});expect((await getBillingInvoice(owner,i.id)).collection?.netCents).toBe(15000);
  await db.query("UPDATE crm_billing_invoices SET observed_at=now()-interval '2 days' WHERE id=$1",[i.id]);expect((await getBillingInvoice(owner,i.id)).calculation).toBeNull();
 });
 it('accepts only signed configured webhook events and supports balance events without an object ID',async()=>{
  expect((await POST(new Request('http://localhost/api/integrations/stripe/events',{method:'POST',body:'{}'}))).status).toBe(503);await imported();
  vi.stubEnv('BILLING_STRIPE_IMPORT_ENABLED','true');vi.stubEnv('BILLING_STRIPE_MODE','test');vi.stubEnv('BILLING_STRIPE_READ_KEY',billingTestConfig.key);vi.stubEnv('BILLING_STRIPE_ACCOUNT_ID',billingTestConfig.accountId);vi.stubEnv('BILLING_STRIPE_WORKSPACE_ID',ws);vi.stubEnv('BILLING_STRIPE_WEBHOOK_SECRET',billingTestConfig.webhookSecret);
  const body=JSON.stringify({id:'evt_Balance',type:'balance.available',api_version:STRIPE_VERSION,livemode:false,data:{object:{object:'balance'}}}),t=Math.floor(Date.now()/1000),signature=createHmac('sha256',billingTestConfig.webhookSecret).update(`${t}.${body}`).digest('hex');
  expect((await POST(new Request('http://localhost/api/integrations/stripe/events',{method:'POST',body,headers:{'stripe-signature':`t=${t},v1=${signature}`}}))).status).toBe(200);
  expect((await POST(new Request('http://localhost/api/integrations/stripe/events',{method:'POST',body:body+' ',headers:{'stripe-signature':`t=${t},v1=${signature}`}}))).status).toBe(400);
  await expect(receiveBillingEvent(billingTestConfig,body.replace('"livemode":false','"livemode":true'))).rejects.toThrow(/IDENTITY_MISMATCH/);
 });
});
