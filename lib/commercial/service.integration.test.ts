import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import type {DashboardContext} from '@/lib/dashboard/data';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {createPartner,changeFinanceAccess} from '@/lib/partners/service';
import {setAccountManager} from '@/lib/relationships/service';
import {saveCommercialDocument,changeCommercialDocument,commercialWorkspace,getCommercialDocument,submitReferral,decideReferral} from './service';
import {invoiceProposalReview,saveAssistantInvoice,assistantInvoiceSchema} from './assistant-invoices';
import {simulateCommercialInvoice} from './simulation';
import {createCustomerEntitlement,addEligibilityPeriod,endEligibilityPeriod,recordEligibilityEvidence,openEligibilityReview,resolveEligibilityReview,listCustomerEligibility,getCustomerEligibility} from './eligibility';
const url=process.env.OPERATING_TEST_DATABASE_URL,ws='00000000-0000-4000-8000-000000000001',other='183f6ee6-e2eb-4e47-a576-adf6c1228135';
const req=()=>randomUUID();
function actor(id:string,role:DashboardContext['role']='member',workspace=ws):DashboardContext{return {user:{id,name:id,email:id+'@example.test'},workspace:{id:workspace,name:'Synthetic commercial test',slug:'test'},role};}
const owner=actor('commercial-owner','owner'),member=actor('commercial-member'),viewer=actor('commercial-viewer','viewer'),foreign=actor('commercial-foreign','owner',other);
let db:ReturnType<typeof getDatabasePool>,client:string,partner:string;
const terms={documentReference:'Synthetic private draft reference',scope:'Synthetic ongoing service only.',rules:[{role:'external',rateBps:730,windowMonths:13,eligibility:'Synthetic accepted source.',termination:'Synthetic surviving rights.',refunds:'Synthetic adjustments.'}],exclusions:'Synthetic upfront and tax exclusions.',paymentTerms:'Synthetic reviewed monthly statement.',reviewNotes:''};
const invoice={currency:'USD',dueOn:'2026-12-01',recipientEmail:'billing@example.test',lines:[{description:'Synthetic support month',classification:'recurring',amountCents:12345,startsOn:'2026-11-01',endsOn:'2026-11-30'}],notes:''};
function draft(extra:Record<string,unknown>={}){return {requestId:req(),kind:'external_referral',partnerId:partner,title:'Synthetic referral draft',details:terms,...extra};}
async function executed(role='originator',userId=member.user.id){
 const d=await saveCommercialDocument(owner,role==='external'?draft():{requestId:req(),kind:'internal_commission',userId,title:'Synthetic signed staff rule',details:{...terms,rules:[{...terms.rules[0],role,windowMonths:null}]}});
 await changeCommercialDocument(owner,{requestId:req(),id:d.id,revision:1,operation:'review',evidence:'Synthetic internal review'});
 await changeCommercialDocument(owner,{requestId:req(),id:d.id,revision:2,operation:'execute',effectiveOn:'2026-01-01',evidence:'Synthetic recorded signed reference'});return d.id;
}
async function attributed(role='originator',userId=member.user.id){
 const documentId=await executed(role,userId);
 return createCustomerEntitlement(owner,{requestId:req(),clientId:client,documentId,role,basis:role==='manager'?'assignment':'direct_origination',evidence:'Synthetic independently approved source'});
}
async function accepted(){
 const r=await submitReferral(owner,{requestId:req(),partnerId:partner,kind:'client',id:client,submittedOn:'2026-01-01',decisionDueOn:'2026-01-10',evidence:'Synthetic authorized source'});
 await decideReferral(owner,{requestId:req(),id:r.id,revision:1,status:'accepted',note:'Synthetic written acceptance',acceptedOn:'2026-01-02',conversionDueOn:'2027-01-01'});return r.id;
}
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
 it('pins executed customer authority and rejects unsigned, foreign and incorrect source records',async()=>{
  const d=await saveCommercialDocument(owner,draft()),referralId=await accepted();
  const input={requestId:req(),clientId:client,documentId:d.id,role:'external',basis:'accepted_referral',referralId,evidence:'Synthetic accepted source approval'};
  await expect(createCustomerEntitlement(owner,input)).rejects.toThrow(/execution evidence/);
  const signed=await executed('external');
  await expect(createCustomerEntitlement(foreign,{...input,documentId:signed})).rejects.toThrow(/client in this workspace/);
  const otherClient=req();await db.query("INSERT INTO clients(id,workspace_id,name) VALUES($1,$2,'Synthetic unrelated client')",[otherClient,ws]);
  await expect(createCustomerEntitlement(owner,{...input,documentId:signed,clientId:otherClient})).rejects.toThrow(/accepted referral bound/);
  await expect(createCustomerEntitlement(owner,{...input,documentId:signed,role:'manager',basis:'assignment',referralId:undefined})).rejects.toThrow(/recipient type/);
  const e=await createCustomerEntitlement(owner,{...input,documentId:signed});
  const stored=await getCustomerEligibility(owner,e.id);expect(stored.entitlement.rule_snapshot.rateBps).toBe(730);expect(stored.entitlement.source_snapshot.acceptedOn).toBe('2026-01-02');expect(stored.holds.join(' ')).toMatch(/first verified/);
  expect(Number((await db.query('SELECT count(*) FROM crm_referral_earnings')).rows[0].count)).toBe(0);
 });
 it('preserves pinned rights through supersession and prevents customer clock resets and backdated signed revisions',async()=>{
  const documentId=await executed('external'),referralId=await accepted();
  const input={requestId:req(),clientId:client,documentId,role:'external',basis:'accepted_referral',referralId,evidence:'Synthetic original attribution'};
  const [a,b]=await Promise.all([createCustomerEntitlement(owner,input),createCustomerEntitlement(owner,input)]);expect(a).toEqual(b);
  await expect(createCustomerEntitlement(owner,{...input,evidence:'Changed source evidence'})).rejects.toThrow(/different details/);
  await expect(changeCommercialDocument(owner,{requestId:req(),id:documentId,revision:3,operation:'supersede',effectiveOn:'2026-02-01',evidence:'Attempted effective date change'})).rejects.toThrow(/Only execution/);
  await changeCommercialDocument(owner,{requestId:req(),id:documentId,revision:3,operation:'supersede',evidence:'Synthetic replacement signed elsewhere'});
  await expect(createCustomerEntitlement(owner,{...input,requestId:req(),documentId:await executed('external')})).rejects.toThrow(/already has that attribution/);
  const p=await addEligibilityPeriod(owner,{requestId:req(),id:a.id,revision:1,startsOn:'2026-01-02',evidence:'Synthetic continuing accepted rights'});
  await expect(endEligibilityPeriod(owner,{requestId:req(),id:a.id,revision:2,periodId:p.periodId,endsBefore:'2027-01-01',reason:'term_end',evidence:'Attempted blanket cancellation'})).rejects.toThrow(/survive agreement termination/);
  expect((await getCustomerEligibility(owner,a.id)).entitlement.document_status).toBe('superseded');
 });
 it('keeps recruiter provenance distinct and serializes competing customer originators',async()=>{
  const referralId=await accepted(),documentId=await executed();
  const input={clientId:client,documentId,role:'originator',basis:'partner_recruitment',referralId,evidence:'Synthetic partner recruitment approval'};
  const results=await Promise.allSettled([createCustomerEntitlement(owner,{...input,requestId:req()}),createCustomerEntitlement(owner,{...input,requestId:req()})]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const rows=(await listCustomerEligibility(owner,client)).records;expect(rows).toHaveLength(1);expect(rows[0].partner_id).toBeNull();expect(rows[0].user_id).toBe(member.user.id);expect(rows[0].source_snapshot.partnerId).toBe(partner);
 });
 it('enforces finance access, current grants and exact revisions on eligibility actions',async()=>{
  const e=await attributed();
  await expect(getCustomerEligibility(member,e.id)).rejects.toThrow(/Finance access/);
  await expect(getCustomerEligibility(foreign,e.id)).rejects.toThrow(/unavailable/);
  await changeFinanceAccess(owner,{requestId:req(),userId:member.user.id,permission:'read'});expect((await getCustomerEligibility(member,e.id)).manage).toBe(false);
  const input={requestId:req(),id:e.id,revision:1,startsOn:'2026-01-01',evidence:'Synthetic verified service evidence'};
  await expect(addEligibilityPeriod(member,input)).rejects.toThrow(/Finance access/);
  const a=await addEligibilityPeriod(owner,input);expect(await addEligibilityPeriod(owner,input)).toEqual(a);
  await expect(recordEligibilityEvidence(owner,{requestId:req(),id:e.id,revision:1,kind:'protected_leave',startsOn:'2026-02-01',endsBefore:'2026-02-03',evidence:'Synthetic approved absence'})).rejects.toThrow(/changed/);
  await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);await expect(listCustomerEligibility(member)).rejects.toThrow(/workspace access/);
 });
 it('retains past eligibility after offboarding without authorizing new future periods',async()=>{
  const e=await attributed();
  await addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:1,startsOn:'2026-01-01',endsBefore:'2026-03-01',evidence:'Synthetic historical service evidence'});
  await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);
  await expect(addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:2,startsOn:'2026-03-01',evidence:'Attempted future reactivation'})).rejects.toThrow(/active teammate/);
  await addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:2,startsOn:'2026-03-01',endsBefore:'2026-04-01',evidence:'Synthetic verified historical correction'});
  expect((await getCustomerEligibility(owner,e.id)).periods).toHaveLength(2);
 });
 it('requires manager source coverage and nonoverlapping eligibility across transfers',async()=>{
  const outgoing=await attributed('manager'),incoming=await attributed('manager',owner.user.id);
  const a=req(),b=req();
  await db.query("INSERT INTO crm_client_manager_history(id,workspace_id,client_id,user_id,starts_at,ends_at,reason,history_basis) VALUES($1,$2,$3,$4,'2026-01-01T05:00Z','2026-02-12T05:00Z','Synthetic historic assignment','recorded_change'),($5,$2,$3,$6,'2026-02-12T05:00Z','2026-03-01T05:00Z','Synthetic transfer','recorded_change')",[a,ws,client,member.user.id,b,owner.user.id]);
  await expect(addEligibilityPeriod(owner,{requestId:req(),id:outgoing.id,revision:1,startsOn:'2025-12-31',endsBefore:'2026-02-12',assignmentId:a,evidence:'Attempted prior history inference'})).rejects.toThrow(/cannot precede/);
  await expect(addEligibilityPeriod(owner,{requestId:req(),id:outgoing.id,revision:1,startsOn:'2026-01-01',assignmentId:a,evidence:'Attempted unbounded period'})).rejects.toThrow(/fit the recorded assignment/);
  await addEligibilityPeriod(owner,{requestId:req(),id:outgoing.id,revision:1,startsOn:'2026-01-01',endsBefore:'2026-02-12',assignmentId:a,evidence:'Synthetic approved outgoing dates'});
  await expect(addEligibilityPeriod(owner,{requestId:req(),id:incoming.id,revision:1,startsOn:'2026-02-11',endsBefore:'2026-03-01',assignmentId:b,evidence:'Attempted wrong transfer day'})).rejects.toThrow(/fit the recorded assignment/);
  await addEligibilityPeriod(owner,{requestId:req(),id:incoming.id,revision:1,startsOn:'2026-02-12',endsBefore:'2026-03-01',assignmentId:b,evidence:'Synthetic incoming duty evidence'});
  expect((await listCustomerEligibility(owner,client)).records).toHaveLength(2);
 });
 it('rejects overlapping periods and historical forfeiture while preserving prospective end history',async()=>{
  const e=await attributed(),p=await addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:1,startsOn:'2026-01-01',evidence:'Synthetic ongoing eligibility'});
  await expect(addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:2,startsOn:'2026-02-01',evidence:'Attempted overlapping eligibility'})).rejects.toThrow(/cannot overlap/);
  await expect(endEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:2,periodId:p.periodId,endsBefore:'2026-02-01',reason:'departure',evidence:'Attempted retroactive departure'})).rejects.toThrow(/prospectively/);
  await endEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:2,periodId:p.periodId,endsBefore:'2027-01-01',reason:'departure',evidence:'Synthetic future departure approval'});
  await expect(endEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:3,periodId:p.periodId,endsBefore:'2027-02-01',reason:'departure',evidence:'Attempted closed history rewrite'})).rejects.toThrow(/Closed periods are preserved/);
  const stored=await getCustomerEligibility(owner,e.id);expect(stored.events.some(x=>x.operation==='period_ended')).toBe(true);expect(stored.periods[0].starts_on.toISOString().slice(0,10)).toBe('2026-01-01');
 });
 it('separates review kinds, requires delivered notices and does not end eligibility during cure',async()=>{
  const e=await attributed();await addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:1,startsOn:'2026-01-01',evidence:'Synthetic ongoing eligibility'});
  const input={requestId:req(),id:e.id,revision:2,kind:'inactivity',observedFrom:'2026-02-01',observedThrough:'2026-03-01',noticeOn:'2026-03-02',cureDueOn:'9999-01-01',policyEvidence:'Synthetic distinct inactivity calendar and delivered notice'};
  await expect(openEligibilityReview(owner,{...input,kind:'performance'})).rejects.toThrow(/performance reviews apply/);
  await expect(openEligibilityReview(owner,{...input,noticeOn:'9998-12-31'})).rejects.toThrow(/actual delivered/);
  const r=await openEligibilityReview(owner,input);
  await expect(resolveEligibilityReview(owner,{requestId:req(),id:e.id,revision:3,reviewId:r.reviewId,outcome:'ended',endsBefore:'9999-01-02',evidence:'Attempted future automatic cancellation'})).rejects.toThrow(/cure period must finish/);
  await expect(endEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:3,periodId:(await getCustomerEligibility(owner,e.id)).periods[0].id,endsBefore:'9999-01-02',reason:'term_end',evidence:'Attempted cure bypass'})).rejects.toThrow(/do not bypass/);
  await resolveEligibilityReview(owner,{requestId:req(),id:e.id,revision:3,reviewId:r.reviewId,outcome:'retained',evidence:'Synthetic evidence of resumed activity'});
  expect((await getCustomerEligibility(owner,e.id)).periods[0].ends_before).toBeNull();
 });
 it('protects leave and qualifying work from inactivity forfeiture and preserves dismissed reviews',async()=>{
  const e=await attributed();await addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:1,startsOn:'2026-01-01',evidence:'Synthetic historical eligibility'});
  await recordEligibilityEvidence(owner,{requestId:req(),id:e.id,revision:2,kind:'protected_leave',startsOn:'2026-02-01',endsBefore:'2026-02-10',evidence:'Synthetic protected leave approval reference'});
  const r=await openEligibilityReview(owner,{requestId:req(),id:e.id,revision:3,kind:'inactivity',observedFrom:'2026-02-01',observedThrough:'2026-03-01',noticeOn:'2026-03-02',cureDueOn:'2026-03-20',policyEvidence:'Synthetic reviewed calendar and actual notice'});
  await expect(resolveEligibilityReview(owner,{requestId:req(),id:e.id,revision:4,reviewId:r.reviewId,outcome:'ended',endsBefore:'2027-01-01',evidence:'Attempted exclusion of protected leave'})).rejects.toThrow(/Protected leave/);
  await resolveEligibilityReview(owner,{requestId:req(),id:e.id,revision:4,reviewId:r.reviewId,outcome:'dismissed',evidence:'Synthetic notice withdrawn after leave review'});
  const stored=await getCustomerEligibility(owner,e.id);expect(stored.reviews[0].status).toBe('dismissed');expect(stored.periods[0].ends_before).toBeNull();
 });
 it('ends only future service after an expired cure and retains historical periods for late collections',async()=>{
  const e=await attributed();await addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:1,startsOn:'2026-01-01',evidence:'Synthetic existing service period'});
  const r=await openEligibilityReview(owner,{requestId:req(),id:e.id,revision:2,kind:'inactivity',observedFrom:'2026-02-01',observedThrough:'2026-03-01',noticeOn:'2026-03-02',cureDueOn:'2026-03-20',policyEvidence:'Synthetic independently reviewed notice and cure calendar'});
  const input={requestId:req(),id:e.id,revision:3,reviewId:r.reviewId,outcome:'ended',endsBefore:'2027-01-01',evidence:'Synthetic authorized prospective decision after cure'};
  const a=await resolveEligibilityReview(owner,input);expect(await resolveEligibilityReview(owner,input)).toEqual(a);
  const stored=await getCustomerEligibility(owner,e.id);expect(stored.reviews[0].status).toBe('ended');expect(stored.periods[0].starts_on.toISOString().slice(0,10)).toBe('2026-01-01');expect(stored.periods[0].ends_before.toISOString().slice(0,10)).toBe('2027-01-01');expect(stored.postingEnabled).toBe(false);
 });
 it('serializes different manager recipients and holds coverage when the assignment later changes',async()=>{
  const a=await attributed('manager'),b=await attributed('manager',owner.user.id),assignmentA=req(),assignmentB=req();
  await db.query("UPDATE crm_client_manager_history SET ends_at=now() WHERE client_id=$1",[client]);
  await db.query("INSERT INTO crm_client_manager_history(id,workspace_id,client_id,user_id,starts_at,ends_at,reason,history_basis) VALUES($1,$2,$3,$4,'2026-01-01T05:00Z',NULL,'Synthetic known baseline','cutover'),($5,$2,$3,$6,'2026-01-01T05:00Z','2026-11-01T05:00Z','Synthetic conflicting imported interval','recorded_change')",[assignmentA,ws,client,member.user.id,assignmentB,owner.user.id]);
  const inputs=[{id:a.id,assignmentId:assignmentA},{id:b.id,assignmentId:assignmentB}].map(x=>({...x,requestId:req(),revision:1,startsOn:'2026-01-01',endsBefore:'2026-11-01',evidence:'Synthetic approved manager service evidence'}));
  const results=await Promise.allSettled(inputs.map(v=>addEligibilityPeriod(owner,v)));expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:expect.objectContaining({message:expect.stringMatching(/cannot overlap/)})});
  const winner=results[0].status==='fulfilled'?a:b,assignment=winner.id===a.id?assignmentA:assignmentB;
  await db.query("UPDATE crm_client_manager_history SET ends_at='2026-08-01T05:00Z' WHERE id=$1",[assignment]);
  expect((await getCustomerEligibility(owner,winner.id)).holds.join(' ')).toMatch(/Assignment coverage changed/);
 });
 it('blocks inactivity forfeiture after qualifying work and flags changed referral acceptance',async()=>{
  const e=await attributed();await addEligibilityPeriod(owner,{requestId:req(),id:e.id,revision:1,startsOn:'2026-01-01',evidence:'Synthetic verified historical service'});
  await recordEligibilityEvidence(owner,{requestId:req(),id:e.id,revision:2,kind:'substantive_work',startsOn:'2026-03-04',endsBefore:'2026-03-05',evidence:'Synthetic genuine resumed work evidence'});
  const r=await openEligibilityReview(owner,{requestId:req(),id:e.id,revision:3,kind:'inactivity',observedFrom:'2026-02-01',observedThrough:'2026-03-01',noticeOn:'2026-03-02',cureDueOn:'2026-03-20',policyEvidence:'Synthetic actual notice and calendar approval'});
  await expect(resolveEligibilityReview(owner,{requestId:req(),id:e.id,revision:4,reviewId:r.reviewId,outcome:'ended',endsBefore:'2027-01-01',evidence:'Attempted disregard of resumed work'})).rejects.toThrow(/qualifying work/);
  const referralId=await accepted(),ext=await createCustomerEntitlement(owner,{requestId:req(),clientId:client,documentId:await executed('external'),role:'external',basis:'accepted_referral',referralId,evidence:'Synthetic accepted customer source'});
  await decideReferral(owner,{requestId:req(),id:referralId,revision:2,status:'disputed',note:'Synthetic later source dispute'});
  expect((await getCustomerEligibility(owner,ext.id)).holds.join(' ')).toMatch(/referral decision changed/);
 });
 it('previews exact invoice details and creates only a replay-safe local draft',async()=>{
  const v={requestId:req(),clientId:client,title:'Synthetic reviewed invoice',details:invoice};
  const preview=await invoiceProposalReview(owner,v);expect(preview.totalCents).toBe(12345);expect(preview.recipient).toBe(invoice.recipientEmail);expect(preview.collection).toMatch(/Local draft/);
  const [a,b]=await Promise.all([saveAssistantInvoice(owner,v),saveAssistantInvoice(owner,v)]);expect(a).toEqual(b);expect(a.providerInvoiceCreated).toBe(false);expect(a.customerNotified).toBe(false);expect(a.status).toBe('draft');expect(a.url).toBe('/dashboard/finance/'+a.id);
  await expect(saveAssistantInvoice(owner,{...v,title:'Changed content'})).rejects.toThrow(/different details/);
 });
 it('requires finance management at both proposal and saving time',async()=>{
  const v={requestId:req(),clientId:client,title:'Synthetic proposal',details:invoice};
  await expect(invoiceProposalReview(member,v)).rejects.toThrow(/Finance access/);await expect(saveAssistantInvoice(member,v)).rejects.toThrow(/Finance access/);
  await changeFinanceAccess(owner,{requestId:req(),userId:member.user.id,permission:'manage'});await invoiceProposalReview(member,v);
  await changeFinanceAccess(owner,{requestId:req(),userId:member.user.id,permission:'read'});await expect(saveAssistantInvoice(member,v)).rejects.toThrow(/Finance access/);
  await expect(invoiceProposalReview(foreign,v)).rejects.toThrow(/client in this workspace/);
 });
 it('refuses a changed source revision or a newer invoice version after proposal review',async()=>{
  const original=await saveAssistantInvoice(owner,{requestId:req(),clientId:client,title:'Synthetic original',details:invoice});
  const next={requestId:req(),clientId:client,previousId:original.id,expectedPreviousRevision:1,title:'Synthetic revision',details:invoice};await invoiceProposalReview(owner,next);
  await changeCommercialDocument(owner,{requestId:req(),id:original.id,revision:1,operation:'review',evidence:'Synthetic finance review'});
  await expect(saveAssistantInvoice(owner,next)).rejects.toThrow(/changed after review/);
  const revised=await saveAssistantInvoice(owner,{...next,expectedPreviousRevision:2});expect(revised.version).toBe(2);
  await expect(invoiceProposalReview(owner,{...next,expectedPreviousRevision:2})).rejects.toThrow(/newer invoice/);
 });
 it('rejects incomplete periods, missing revision pins and provider/approval fields',()=>{
  const v={requestId:req(),clientId:client,title:'Synthetic draft',details:invoice};
  expect(assistantInvoiceSchema.safeParse({...v,previousId:req()}).success).toBe(false);
  expect(assistantInvoiceSchema.safeParse({...v,autoAdvance:true}).success).toBe(false);
  expect(assistantInvoiceSchema.safeParse({...v,details:{...invoice,lines:[{...invoice.lines[0],startsOn:null}]}}).success).toBe(false);
 });
 it('pauses assistant proposals and saves without disabling the manual finance workspace',async()=>{
  vi.stubEnv('ASSISTANT_BILLING_DRAFTS_ENABLED','false');try{const v={requestId:req(),clientId:client,title:'Synthetic paused',details:invoice};await expect(invoiceProposalReview(owner,v)).rejects.toThrow(/paused/);await expect(saveAssistantInvoice(owner,v)).rejects.toThrow(/paused/);expect((await saveCommercialDocument(owner,{...v,kind:'invoice'})).status).toBe('draft');}finally{vi.stubEnv('ASSISTANT_BILLING_DRAFTS_ENABLED','true');}
 });

});
