import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import type {DashboardContext} from '@/lib/dashboard/data';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {createPartner,changeFinanceAccess} from '@/lib/partners/service';
import {setAccountManager} from '@/lib/relationships/service';
import {saveCommercialDocument,changeCommercialDocument,commercialWorkspace,getCommercialDocument,submitReferral,decideReferral} from './service';
import {simulateCommercialInvoice} from './simulation';
const url=process.env.OPERATING_TEST_DATABASE_URL,ws='00000000-0000-4000-8000-000000000001',other='183f6ee6-e2eb-4e47-a576-adf6c1228135';
const req=()=>randomUUID();
function actor(id:string,role:DashboardContext['role']='member',workspace=ws):DashboardContext{return {user:{id,name:id,email:id+'@example.test'},workspace:{id:workspace,name:'Synthetic commercial test',slug:'test'},role};}
const owner=actor('commercial-owner','owner'),member=actor('commercial-member'),viewer=actor('commercial-viewer','viewer'),foreign=actor('commercial-foreign','owner',other);
let db:ReturnType<typeof getDatabasePool>,client:string,partner:string;
const terms={documentReference:'Synthetic private draft reference',scope:'Synthetic ongoing service only.',rules:[{role:'external',rateBps:730,windowMonths:13,eligibility:'Synthetic accepted source.',termination:'Synthetic surviving rights.',refunds:'Synthetic adjustments.'}],exclusions:'Synthetic upfront and tax exclusions.',paymentTerms:'Synthetic reviewed monthly statement.',reviewNotes:''};
const invoice={currency:'USD',dueOn:'2026-12-01',recipientEmail:'billing@example.test',lines:[{description:'Synthetic support month',classification:'recurring',amountCents:12345,startsOn:'2026-11-01',endsOn:'2026-11-30'}],notes:''};
function draft(extra:Record<string,unknown>={}){return {requestId:req(),kind:'external_referral',partnerId:partner,title:'Synthetic referral draft',details:terms,...extra};}
describe.skipIf(!url)('Commercial preparation',()=>{
 beforeAll(async()=>{
  const u=new URL(url!);if(!['localhost','127.0.0.1'].includes(u.hostname)||u.pathname!=='/ta_operating_test'||u.search||u.hash)throw new Error('Only isolated local ta_operating_test is allowed.');
  vi.stubEnv('DATABASE_URL',url!);vi.stubEnv('NODE_ENV','test');vi.stubEnv('STRIPE_SECRET_KEY','');vi.stubEnv('OPENAI_API_KEY','');
  db=getDatabasePool();await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())');
  for(const file of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort()){if((await db.query('SELECT 1 FROM schema_migrations WHERE filename=$1',[file])).rowCount)continue;await db.query(await readFile('db/migrations/'+file,'utf8'));await db.query('INSERT INTO schema_migrations(filename) VALUES($1)',[file]);}
 },30000);
 beforeEach(async()=>{
  await db.query('TRUNCATE "user",leads,clients,crm_businesses,crm_opportunities,audit_logs CASCADE');
  await db.query("INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,'commercial-other','Other','internal','active') ON CONFLICT(id) DO NOTHING",[other]);
  for(const a of [owner,member,viewer,foreign]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[a.user.id,a.user.name,a.user.email]);await db.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",[req(),a.workspace.id,a.user.id,a.role]);}
  client=req();await db.query("INSERT INTO clients(id,workspace_id,name) VALUES($1,$2,'Synthetic customer')",[client,ws]);partner=(await createPartner(owner,{requestId:req(),name:'Synthetic partner'})).id;
 });
 afterAll(async()=>{await db?.end();vi.unstubAllEnvs();});
 it('enforces finance, membership and workspace access on every read and mutation',async()=>{
  await expect(commercialWorkspace(member)).rejects.toThrow(/Finance access/);
  await expect(saveCommercialDocument(viewer,draft())).rejects.toThrow(/workspace access/);
  const d=await saveCommercialDocument(owner,draft());await expect(getCommercialDocument(foreign,d.id)).rejects.toThrow(/unavailable/);
  await changeFinanceAccess(owner,{requestId:req(),userId:member.user.id,permission:'read'});expect((await commercialWorkspace(member)).manage).toBe(false);
  await expect(saveCommercialDocument(member,draft())).rejects.toThrow(/Finance access/);
  await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);await expect(commercialWorkspace(member)).rejects.toThrow(/workspace access/);
 });
 it('keeps immutable version contents, serializes revisions and does not activate financial rules',async()=>{
  const input=draft(),[a,b]=await Promise.all([saveCommercialDocument(owner,input),saveCommercialDocument(owner,input)]);expect(a).toEqual(b);
  await expect(saveCommercialDocument(owner,{...input,title:'Changed facts'})).rejects.toThrow(/different details/);
  await changeCommercialDocument(owner,{requestId:req(),id:a.id,revision:1,operation:'review',evidence:'Synthetic internal review'});
  await expect(changeCommercialDocument(owner,{requestId:req(),id:a.id,revision:1,operation:'execute',evidence:'Synthetic signed reference',effectiveOn:'2026-11-01'})).rejects.toThrow(/changed/);
  const confirmed=await changeCommercialDocument(owner,{requestId:req(),id:a.id,revision:2,operation:'execute',evidence:'Synthetic signed reference',effectiveOn:'2026-11-01'});expect(confirmed.financialRulesActivated).toBe(false);
  const outcomes=await Promise.allSettled([saveCommercialDocument(owner,draft({previousId:a.id})),saveCommercialDocument(owner,draft({previousId:a.id}))]);expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await getCommercialDocument(owner,a.id)).document.details).toEqual(terms);
  expect(Number((await db.query('SELECT count(*) FROM crm_referral_earnings')).rows[0].count)).toBe(0);
 });
 it('requires signed evidence and does not treat invoice review as issuing an invoice',async()=>{
  const d=await saveCommercialDocument(owner,{requestId:req(),kind:'invoice',clientId:client,title:'Synthetic invoice',details:invoice});
  await changeCommercialDocument(owner,{requestId:req(),id:d.id,revision:1,operation:'review',evidence:'Synthetic reviewed amount'});
  await expect(changeCommercialDocument(owner,{requestId:req(),id:d.id,revision:2,operation:'execute',evidence:'Cannot issue from preparation',effectiveOn:'2026-11-01'})).rejects.toThrow(/cannot be issued/);
  await expect(saveCommercialDocument(owner,{requestId:req(),kind:'invoice',clientId:client,title:'Missing dates',details:{...invoice,lines:[{...invoice.lines[0],startsOn:null}]}})).rejects.toThrow();
  expect((await commercialWorkspace(owner)).stripeConnected).toBe(false);
 });
 it('keeps internal recipients separate from external partners and rejects inappropriate roles',async()=>{
  await saveCommercialDocument(owner,{requestId:req(),kind:'internal_commission',userId:member.user.id,title:'Synthetic internal terms',details:{...terms,rules:[{...terms.rules[0],role:'originator'}]}});
  expect(Number((await db.query('SELECT count(*) FROM crm_referral_partners')).rows[0].count)).toBe(1);
  await expect(saveCommercialDocument(owner,draft({details:{...terms,rules:[{...terms.rules[0],role:'manager'}]}}))).rejects.toThrow(/appropriate/);
  await expect(saveCommercialDocument(owner,{requestId:req(),kind:'customer_service',clientId:client,title:'Customer terms',details:terms})).rejects.toThrow(/appropriate/);
 });
 it('serializes acceptance, preserves decisions and checks client relationship binding',async()=>{
  const input={requestId:req(),partnerId:partner,kind:'client',id:client,submittedOn:'2026-11-01',decisionDueOn:'2026-11-03',evidence:'Synthetic authorized introduction'};
  const a=await submitReferral(owner,input),b=await submitReferral(owner,{...input,requestId:req()});
  const decisions=await Promise.allSettled([a,b].map(r=>decideReferral(owner,{requestId:req(),id:r.id,revision:1,status:'accepted',note:'Synthetic prior relationship review',acceptedOn:'2026-11-02',conversionDueOn:'2026-12-20'})));
  expect(decisions.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(Number((await db.query('SELECT count(*) FROM crm_referral_decisions')).rows[0].count)).toBe(1);
  const otherClient=req();await db.query("INSERT INTO clients(id,workspace_id,name) VALUES($1,$2,'Unrelated')",[otherClient,ws]);
  await expect(decideReferral(owner,{requestId:req(),id:a.id,revision:1,status:'accepted',note:'Wrong client binding',clientId:otherClient,acceptedOn:'2026-11-02',conversionDueOn:'2026-12-20'})).rejects.toThrow();
 });
 it('records assignment and unassignment with dates, actor and reason across existing service writes',async()=>{
  await setAccountManager(owner,{clientId:client,userId:member.user.id,reason:'Synthetic handoff accepted'});
  await setAccountManager(owner,{clientId:client,userId:'',reason:'Synthetic temporary coverage gap'});
  const rows=(await db.query('SELECT * FROM crm_client_manager_history WHERE client_id=$1 ORDER BY starts_at,id',[client])).rows;
  expect(rows).toHaveLength(3);expect(rows.filter(r=>r.ends_at===null)).toHaveLength(1);expect(rows[1].user_id).toBe(member.user.id);expect(rows[1].actor_user_id).toBe(owner.user.id);expect(rows[2].reason).toBe('Synthetic temporary coverage gap');
  expect(rows[1].ends_at.getTime()).toBe(rows[2].starts_at.getTime());
 });
 it('simulates using saved private rules without recording a collection or earning',async()=>{
  const a=await saveCommercialDocument(owner,draft());
  const inv=await saveCommercialDocument(owner,{requestId:req(),kind:'invoice',clientId:client,title:'Synthetic invoice preview',details:invoice});
  const scenario={invoiceId:inv.id,asOf:'2026-11-30',collectedOn:'2026-11-01',cleared:true,collectedCents:12345,refundedCents:0,roles:[{documentId:a.id,role:'external',startsOn:'2026-01-01',endsOn:null,windowStartsOn:'2026-01-01'}]};
  expect((await simulateCommercialInvoice(owner,scenario)).commissionCents).toBe(901);
  await expect(simulateCommercialInvoice(member,scenario)).rejects.toThrow(/Finance access/);
  await expect(simulateCommercialInvoice(foreign,scenario)).rejects.toThrow(/unavailable/);
  expect(Number((await db.query('SELECT count(*) FROM crm_referral_earnings')).rows[0].count)).toBe(0);
 });
 it('requires an actual client project and keeps project budgets separate from recurring rules',async()=>{
  const project=req();await db.query("INSERT INTO projects(id,workspace_id,client_id,name) VALUES($1,$2,$3,'Synthetic project')",[project,ws,client]);
  const details={projectId:project,expectedCents:310000,directCostCents:50000,participants:[{userId:member.user.id,role:'developer',amountCents:170000,condition:'Synthetic delivery acceptance'}],approval:'Synthetic project authority'};
  const d=await saveCommercialDocument(owner,{requestId:req(),kind:'project_budget',clientId:client,title:'Synthetic budget',details});
  expect((await getCommercialDocument(owner,d.id)).document.details).toEqual(details);
  await expect(saveCommercialDocument(owner,{requestId:req(),kind:'project_budget',clientId:client,title:'Over budget',details:{...details,expectedCents:100}})).rejects.toThrow();
  await expect(saveCommercialDocument(owner,{requestId:req(),kind:'project_budget',clientId:client,title:'Unknown project',details:{...details,projectId:req()}})).rejects.toThrow(/belonging/);
 });
 it('checks canonical links when different relationship records compete for attribution',async()=>{
  const lead=req();await db.query("INSERT INTO leads(id,workspace_id,name,organization,email,phone,source,client_id) VALUES($1,$2,'Synthetic linked prospect','',NULL,'+17705550191','manual',$3)",[lead,ws,client]);
  const base={partnerId:partner,submittedOn:'2026-11-01',decisionDueOn:'2026-11-03',evidence:'Synthetic authorized introduction'};
  const a=await submitReferral(owner,{...base,requestId:req(),kind:'lead',id:lead}),b=await submitReferral(owner,{...base,requestId:req(),kind:'client',id:client});
  const decision={revision:1,status:'accepted',note:'Synthetic source reviewed',acceptedOn:'2026-11-02',conversionDueOn:'2026-12-20'};
  await decideReferral(owner,{...decision,requestId:req(),id:a.id});
  await expect(decideReferral(owner,{...decision,requestId:req(),id:b.id})).rejects.toThrow(/connected relationship/);
 });
 it('preserves original acceptance and rejects future submission or premature expiration',async()=>{
  const base={partnerId:partner,kind:'client',id:client,submittedOn:'2026-11-01',decisionDueOn:'2026-11-03',evidence:'Synthetic referral'};
  await expect(submitReferral(owner,{...base,requestId:req(),submittedOn:'9999-01-01',decisionDueOn:'9999-01-02'})).rejects.toThrow(/future/);
  const a=await submitReferral(owner,{...base,requestId:req()});
  await decideReferral(owner,{requestId:req(),id:a.id,revision:1,status:'accepted',note:'Synthetic accepted source',acceptedOn:'2026-11-02',conversionDueOn:'9999-01-01'});
  await expect(decideReferral(owner,{requestId:req(),id:a.id,revision:2,status:'accepted',note:'Attempted anchor rewrite',acceptedOn:'2026-11-03',conversionDueOn:'9999-01-01'})).rejects.toThrow(/original acceptance/);
  await expect(decideReferral(owner,{requestId:req(),id:a.id,revision:2,status:'expired',note:'Premature expiration attempt'})).rejects.toThrow(/past its recorded/);
 });
});
