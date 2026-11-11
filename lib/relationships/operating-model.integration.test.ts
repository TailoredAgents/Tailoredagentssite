import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import type {DashboardContext} from '@/lib/dashboard/data';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {createManualLead} from '@/lib/operations/manual-leads';
import {addIntroduction,saveDiscovery} from './service';
import {createPartner,changeFinanceAccess,changePartnerAccess,createAgreement,changeAgreement,recordEarning,reverseEarning,createStatement,changeStatement,partnerWorkspace,partnersWorkspace,getStatement} from '@/lib/partners/service';
import {earningCents,type AgreementTerms} from '@/lib/partners/contract';
import {captureEncounter,encounterMatches,getWorkFocus,saveWorkFocus,listEncounters} from './capture';
import {saveSolutionBrief,listSolutionBriefs} from './solutions';
import {saveClientService,recordServiceReview,recordServiceIncident,resolveServiceIncident,recordServiceMeasurement,listClientServices,getClientService} from '@/lib/client-services/service';
const url=process.env.OPERATING_TEST_DATABASE_URL,ws='00000000-0000-4000-8000-000000000001',otherWs='9ca8330b-c162-46e4-8b56-f648cce5e7c0';
function actor(id:string,role:DashboardContext['role']='member',workspace=ws):DashboardContext{return {user:{id,name:id,email:id+'@example.test'},workspace:{id:workspace,name:'Synthetic work',slug:'test'},role};}
const owner=actor('work-owner','owner'),finance=actor('work-finance'),member=actor('work-member'),partnerUser=actor('work-partner','viewer'),viewer=actor('work-viewer','viewer'),foreign=actor('work-foreign','owner',otherWs);
let db:ReturnType<typeof getDatabasePool>,client:string,lead:string,partner:string,introduction:string;
const req=()=>randomUUID();
const terms:AgreementTerms={currency:'USD',documentRateCents:17,nonDocumentBps:800,startsOn:'2026-01-01',endsOn:'2026-12-31',basis:'collected',documentEligibility:'Synthetic unique completed and paid document.',eligibleServices:'Synthetic eligible services excluding document revenue.',paymentTiming:'Synthetic month-end review.',durationPolicy:'Synthetic one-year term.',refundPolicy:'Reverse original and record corrected net activity.',splitPolicy:'Explicit approved allocation; total at most 100%.'};
async function agreement(){const a=await createAgreement(owner,{requestId:req(),partnerId:partner,terms});await changeAgreement(owner,{requestId:req(),agreementId:a.id,revision:1,operation:'activate'});return a.id;}
function source(agreementId:string,extra:Record<string,unknown>={}){return {requestId:req(),agreementId,clientId:client,introductionId:introduction,sourceKey:'synthetic-batch-1',kind:'documents',units:100,amountCents:0,basis:'collected',occurredOn:'2026-11-10',reference:'Synthetic paid batch receipt',allocationBps:10000,eligibilityNote:'Confirmed against synthetic agreement by test operator.',...extra};}
function service(extra:Record<string,unknown>={}){return {requestId:req(),clientId:client,name:'Synthetic document intake',kind:'automation',status:'active',ownerUserId:member.user.id,deploymentUrl:'https://example.test/service',supportScope:'Synthetic agreed review and incident triage.',reviewEveryDays:30,nextReviewOn:'2026-01-01',...extra};}
function measurement(id:string,extra:Record<string,unknown>={}){return {requestId:req(),serviceId:id,sourceKey:'synthetic-report-1',startsOn:'2026-11-01',endsOn:'2026-11-10',basis:'observed',baselineBasis:'observed',documents:100,baselineSecondsPerDocument:120,actualSeconds:3000,evidence:'Synthetic timing sample report',methodology:'Same 100-document cohort; exceptions included.',...extra};}
describe.skipIf(!url)('Relationship operating model phases 2–5',()=>{
 beforeAll(async()=>{
  const u=new URL(url!);if(!['localhost','127.0.0.1'].includes(u.hostname)||u.pathname!=='/ta_operating_test'||u.search||u.hash)throw new Error('Only isolated local ta_operating_test is allowed.');
  vi.stubEnv('DATABASE_URL',url!);vi.stubEnv('NODE_ENV','test');vi.stubEnv('OPENAI_API_KEY','');vi.stubEnv('RESEND_API_KEY','');vi.stubEnv('TWILIO_SMS_ENABLED','false');
  db=getDatabasePool();await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())');
  for(const file of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort()){if((await db.query('SELECT 1 FROM schema_migrations WHERE filename=$1',[file])).rowCount)continue;await db.query(await readFile('db/migrations/'+file,'utf8'));await db.query('INSERT INTO schema_migrations(filename) VALUES($1)',[file]);}
 },30000);
 beforeEach(async()=>{
  await db.query('TRUNCATE "user",leads,clients,crm_businesses,crm_opportunities,audit_logs CASCADE');
  await db.query("INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,'work-other','Other','internal','active') ON CONFLICT(id) DO NOTHING",[otherWs]);
  for(const c of [owner,finance,member,partnerUser,viewer,foreign]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[c.user.id,c.user.name,c.user.email]);await db.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",[req(),c.workspace.id,c.user.id,c.role]);}
  lead=(await createManualLead(owner,{submissionId:req(),name:'Synthetic client person',phone:'7705550191'})).leadId;client=req();await db.query("INSERT INTO clients(id,workspace_id,lead_id,name) VALUES($1,$2,$3,'Synthetic client')",[client,ws,lead]);await db.query('UPDATE leads SET client_id=$2 WHERE id=$1',[lead,client]);
  partner=(await createPartner(owner,{requestId:req(),name:'Synthetic introducer'})).id;
  introduction=await addIntroduction(owner,{kind:'lead',id:lead,partnerId:partner,name:'',organization:'',note:'Synthetic personal introduction'});
 });
 afterAll(async()=>{await db?.end();vi.unstubAllEnvs();});
 it('requires finance grants, active membership and same workspace without inferring roles from names',async()=>{
  await expect(createAgreement(member,{requestId:req(),partnerId:partner,terms})).rejects.toThrow(/Finance access/);
  await expect(changeFinanceAccess(member,{requestId:req(),userId:member.user.id,permission:'manage'})).rejects.toThrow(/owner or administrator/);
  await changeFinanceAccess(owner,{requestId:req(),userId:finance.user.id,permission:'manage'});
  expect((await createAgreement(finance,{requestId:req(),partnerId:partner,terms})).status).toBe('draft');
  await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[finance.user.id]);
  await expect(partnerWorkspace(finance,partner)).rejects.toThrow(/workspace access/);
  await expect(partnerWorkspace(foreign,partner)).rejects.toThrow(/unavailable/);
  await expect(createAgreement(viewer,{requestId:req(),partnerId:partner,terms})).rejects.toThrow(/workspace access/);
 });
 it('keeps grants and approved partner views bounded to the selected partner',async()=>{
  const second=(await createPartner(owner,{requestId:req(),name:'Different partner'})).id;
  await changePartnerAccess(owner,{requestId:req(),userId:partnerUser.user.id,partnerId:partner,allow:true});
  await createAgreement(owner,{requestId:req(),partnerId:partner,terms});
  expect((await partnersWorkspace(partnerUser)).partners.map(x=>x.id)).toEqual([partner]);
  expect((await partnerWorkspace(partnerUser,partner)).agreements).toEqual([]);
  await expect(partnerWorkspace(partnerUser,second)).rejects.toThrow(/Finance access/);
  await changePartnerAccess(owner,{requestId:req(),userId:partnerUser.user.id,partnerId:partner,allow:false});
  await expect(partnerWorkspace(partnerUser,partner)).rejects.toThrow(/Finance access/);
 });
 it('does not activate drafts, silently change policy, or allow overlapping active versions',async()=>{
  const draft=await createAgreement(owner,{requestId:req(),partnerId:partner,terms});
  await expect(recordEarning(owner,source(draft.id))).rejects.toThrow(/Activate/);
  const second=await createAgreement(owner,{requestId:req(),partnerId:partner,terms:{...terms,documentRateCents:23}});
  const results=await Promise.allSettled([draft,second].map(a=>changeAgreement(owner,{requestId:req(),agreementId:a.id,revision:1,operation:'activate'})));
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  expect((await partnerWorkspace(owner,partner)).agreements).toHaveLength(2);
  await expect(createAgreement(owner,{requestId:req(),partnerId:partner,terms:{...terms,refundPolicy:''}})).rejects.toThrow();
 });
 it('calculates documents and other revenue independently with integer rounding and source-based duplicate protection',async()=>{
  const a=await agreement(),input=source(a);const result=await Promise.all([recordEarning(owner,input),recordEarning(owner,input)]);
  expect(result[0]).toEqual(result[1]);expect(result[0].amountCents).toBe(1700);
  expect((await recordEarning(owner,source(a,{sourceKey:'other-revenue-1',kind:'non_document_revenue',units:0,amountCents:1301}))).amountCents).toBe(104);
  expect(earningCents('documents',19,0,terms,5000)).toBe(162);
  await expect(recordEarning(owner,{...input,requestId:req()})).rejects.toThrow(/counted twice/);
  await expect(recordEarning(owner,{...input,units:200})).rejects.toThrow(/different details/);
  await expect(recordEarning(owner,source(a,{sourceKey:'bad-mix',amountCents:500}))).rejects.toThrow(/never both/);
 });
 it('checks source facts, basis, date, client introduction and total split allocations',async()=>{
  const a=await agreement();await recordEarning(owner,source(a,{allocationBps:6000}));
  const p2=(await createPartner(owner,{requestId:req(),name:'Second introducer'})).id,i2=await addIntroduction(owner,{kind:'client',id:client,partnerId:p2,name:'',organization:'',note:''});
  const a2=await createAgreement(owner,{requestId:req(),partnerId:p2,terms});await changeAgreement(owner,{requestId:req(),agreementId:a2.id,revision:1,operation:'activate'});
  await expect(recordEarning(owner,source(a2.id,{introductionId:i2,allocationBps:5000}))).rejects.toThrow(/exceed 100/);
  expect((await recordEarning(owner,source(a2.id,{introductionId:i2,allocationBps:4000}))).amountCents).toBe(680);
  await expect(recordEarning(owner,source(a,{sourceKey:'basis',basis:'invoiced'}))).rejects.toThrow(/basis/);
  await expect(recordEarning(owner,source(a,{sourceKey:'outside',occurredOn:'2027-01-01'}))).rejects.toThrow(/date/);
  await expect(recordEarning(owner,source(a,{sourceKey:'intro',introductionId:i2}))).rejects.toThrow(/introduction/);
  await expect(recordEarning(owner,source(a,{sourceKey:'synthetic-batch-1',units:90}))).rejects.toThrow(/different facts/);
 });
 it('preserves approved statement snapshots and carries refunds as new correcting entries',async()=>{
  const a=await agreement(),e=await recordEarning(owner,source(a));
  const s=await createStatement(owner,{requestId:req(),partnerId:partner,startsOn:'2026-11-01',endsOn:'2026-11-10'});
  await changePartnerAccess(owner,{requestId:req(),userId:partnerUser.user.id,partnerId:partner,allow:true});
  await expect(getStatement(partnerUser,s.id)).rejects.toThrow(/not approved/);
  await expect(changeStatement(owner,{requestId:req(),statementId:s.id,revision:1,expectedTotalCents:1700,operation:'approve',note:'Synthetic review'})).rejects.toThrow(/transition/);
  await changeStatement(owner,{requestId:req(),statementId:s.id,revision:1,expectedTotalCents:1700,operation:'review',note:'Verified synthetic source'});
  await expect(changeStatement(owner,{requestId:req(),statementId:s.id,revision:1,expectedTotalCents:1700,operation:'approve',note:'Synthetic approval'})).rejects.toThrow(/changed/);
  await changeStatement(owner,{requestId:req(),statementId:s.id,revision:2,expectedTotalCents:1700,operation:'approve',note:'Synthetic approval'});
  expect((await getStatement(partnerUser,s.id)).items).toHaveLength(1);
  await expect(changeStatement(owner,{requestId:req(),statementId:s.id,revision:3,expectedTotalCents:1700,operation:'record_paid',note:'No payment reference'})).rejects.toThrow();
  const payment=await changeStatement(owner,{requestId:req(),statementId:s.id,revision:3,expectedTotalCents:1700,operation:'record_paid',note:'Synthetic external settlement',paymentReference:'TEST-ONLY-NO-PAYMENT'});expect(payment.moneyMoved).toBe(false);
  const reversed=await reverseEarning(owner,{requestId:req(),earningId:e.id,occurredOn:'2026-11-11',reason:'Synthetic refund'});expect(reversed.amountCents).toBe(-1700);
  await expect(reverseEarning(owner,{requestId:req(),earningId:e.id,occurredOn:'2026-11-11',reason:'Again'})).rejects.toThrow(/already/);
  expect(Number((await getStatement(owner,s.id)).statement.total_cents)).toBe(1700);
  const credit=await createStatement(owner,{requestId:req(),partnerId:partner,startsOn:'2026-11-11',endsOn:'2026-11-11'});expect(credit.totalCents).toBe(-1700);
 });
 it('claims source entries only once across concurrent statements and retains void history',async()=>{
  await recordEarning(owner,source(await agreement()));
  const results=await Promise.allSettled([1,2].map(()=>createStatement(owner,{requestId:req(),partnerId:partner,startsOn:'2026-11-10',endsOn:'2026-11-10'})));
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  const s=results.find(x=>x.status==='fulfilled');if(s?.status!=='fulfilled')throw new Error('statement expected');
  await changeStatement(owner,{requestId:req(),statementId:s.value.id,revision:1,expectedTotalCents:1700,operation:'void',note:'Synthetic correction before approval'});
  expect((await getStatement(owner,s.value.id)).items).toHaveLength(1);
  expect((await createStatement(owner,{requestId:req(),partnerId:partner,startsOn:'2026-11-10',endsOn:'2026-11-10'})).totalCents).toBe(1700);
 });
 it('captures sparse encounters atomically and retries without duplicate prospects or introductions',async()=>{
  const v={requestId:req(),notes:'Met someone interested in document workflows. Details to follow.',channel:'meetup',eventName:'Synthetic meetup',ownerUserId:member.user.id,appointmentSetterUserId:finance.user.id,partnerId:partner};
  const [a,b]=await Promise.all([captureEncounter(member,v),captureEncounter(member,v)]);expect(a).toEqual(b);
  const rows=await listEncounters(owner,{kind:'lead',id:a.leadId});expect(rows).toHaveLength(1);expect(rows[0].appointment_setter).toBe(finance.user.name);
  expect((await db.query('SELECT source,email,phone,owner_user_id FROM leads WHERE id=$1',[a.leadId])).rows[0]).toMatchObject({source:'manual',email:null,phone:null,owner_user_id:member.user.id});
  expect((await db.query('SELECT id FROM crm_introductions WHERE lead_id=$1',[a.leadId])).rowCount).toBe(1);
  await expect(captureEncounter(member,{...v,notes:'Different request'})).rejects.toThrow(/different details/);
 });
 it('requires an explicit choice for existing contact matches and preserves campaign attribution and owner',async()=>{
  await db.query("UPDATE leads SET source='smart_card',smart_card_context=$2 WHERE id=$1",[lead,JSON.stringify({campaign:'Synthetic freight campaign'})]);
  expect((await encounterMatches(member,undefined,'(770) 555-0191')).map(x=>x.id)).toEqual([lead]);
  const input={requestId:req(),phone:'7705550191',channel:'business_visit',notes:'Follow-up encounter',ownerUserId:member.user.id};
  await expect(captureEncounter(member,input)).rejects.toThrow(/already uses/);
  await captureEncounter(member,{...input,leadId:lead});
  expect((await db.query('SELECT source,smart_card_context,owner_user_id FROM leads WHERE id=$1',[lead])).rows[0]).toMatchObject({source:'smart_card',smart_card_context:{campaign:'Synthetic freight campaign'},owner_user_id:owner.user.id});
  await expect(captureEncounter(foreign,{...input,leadId:lead})).rejects.toThrow();
  await expect(captureEncounter(viewer,input)).rejects.toThrow(/workspace access/);
 });
 it('keeps solution drafts, revisions and connected citations without implying client acceptance',async()=>{
  const note=await saveDiscovery(owner,{kind:'lead',id:lead,fields:{workflows:'Synthetic document intake'}});
  const input={requestId:req(),kind:'lead',id:lead,title:'Document-intake pilot',status:'draft',fields:{workflow:'Synthetic observed process',assumptions:'Volumes not yet confirmed'},sources:[{kind:'discovery',id:note}]};
  const b=await saveSolutionBrief(member,input);expect(await saveSolutionBrief(member,input)).toEqual(b);
  await expect(saveSolutionBrief(member,{...input,requestId:req(),briefId:b.id,revision:1,status:'reviewed'})).rejects.toThrow(/reviewed brief/);
  await saveSolutionBrief(member,{...input,requestId:req(),briefId:b.id,revision:1,fields:{workflow:'Updated after discovery',pilot:'One source type only',acceptance:'Team validates a test set',delivery:'Assigned internal development team'},status:'reviewed'});
  const view=await listSolutionBriefs(owner,{kind:'client',id:client});expect(view.briefs[0].revision).toBe(2);expect(view.versions).toHaveLength(2);expect(view.versions[1].fields.assumptions).toBe('Volumes not yet confirmed');
  await expect(saveSolutionBrief(member,{...input,requestId:req(),briefId:b.id,revision:1})).rejects.toThrow(/changed/);
  await expect(listSolutionBriefs(foreign,{kind:'client',id:client})).rejects.toThrow();
 });
 it('rejects private or unrelated meetings as team brief citations',async()=>{
  const meeting=req();await db.query("INSERT INTO meetings(id,workspace_id,owner_user_id,title,source,status,lead_id) VALUES($1,$2,$3,'Synthetic private discovery','upload','ready',$4)",[meeting,ws,member.user.id,lead]);
  const input={requestId:req(),kind:'lead',id:lead,title:'Private evidence draft',status:'draft',fields:{assumptions:'Need authorized shared source'},sources:[{kind:'meeting',id:meeting}]};
  await expect(saveSolutionBrief(member,input)).rejects.toThrow(/shared with the team/);
  await db.query("UPDATE meetings SET visibility='team' WHERE id=$1",[meeting]);
  expect((await saveSolutionBrief(member,input)).status).toBe('draft');
  await expect(saveSolutionBrief(member,{...input,requestId:req(),sources:[{kind:'discovery',id:req()}]})).rejects.toThrow(/connected/);
 });
 it('saves personal work focus without creating permissions or changing other users',async()=>{
  await saveWorkFocus(member,{focus:'finance'});expect(await getWorkFocus(member)).toBe('finance');expect(await getWorkFocus(owner)).toBe('relationships');
  expect((await partnersWorkspace(member)).full).toBe(false);
  await expect(createAgreement(member,{requestId:req(),partnerId:partner,terms})).rejects.toThrow(/Finance access/);
 });
 it('tracks service review/incident lifecycle with stale-write and cross-workspace protection',async()=>{
  const created=await saveClientService(member,service());expect((await getClientService(owner,created.id)).service.health).toBe('unknown');
  expect((await listClientServices(member,{scope:'mine',attention:true})).items.map(x=>x.id)).toContain(created.id);
  const incident=await recordServiceIncident(member,{requestId:req(),serviceId:created.id,title:'Synthetic failed import',nextAction:'Review the error log',ownerUserId:finance.user.id,dueAt:new Date().toISOString()});
  let d=await getClientService(member,created.id);expect(d.service.health).toBe('incident');
  expect((await listClientServices(finance,{scope:'mine',attention:true})).items.map(x=>x.id)).toContain(created.id);
  await expect(recordServiceReview(member,{requestId:req(),serviceId:created.id,revision:d.service.revision,health:'healthy',reviewedAt:new Date().toISOString(),nextReviewOn:'2027-01-01',outcome:'Unresolved issue'})).rejects.toThrow(/Resolve open incidents/);
  await resolveServiceIncident(member,{requestId:req(),incidentId:incident.id,revision:1,resolution:'Synthetic input corrected and checked'});
  d=await getClientService(member,created.id);expect(d.service.health).toBe('unknown');
  await recordServiceReview(member,{requestId:req(),serviceId:created.id,revision:d.service.revision,health:'healthy',reviewedAt:new Date().toISOString(),nextReviewOn:'2027-01-01',outcome:'Synthetic test set passed'});
  expect((await getClientService(member,created.id)).service.health).toBe('healthy');
  await expect(saveClientService(member,service({serviceId:created.id,revision:1}))).rejects.toThrow(/Refresh/);
  await expect(getClientService(foreign,created.id)).rejects.toThrow(/unavailable/);
  await expect(saveClientService(viewer,service())).rejects.toThrow(/workspace access/);
 });
 it('separates observed and estimated outcomes, hides costs without finance access, and never creates payables',async()=>{
  const s=await saveClientService(member,service());
  await expect(recordServiceMeasurement(member,measurement(s.id,{costCents:2500}))).rejects.toThrow(/Finance management/);
  const m=measurement(s.id,{costCents:2500});expect(await recordServiceMeasurement(owner,m)).toEqual(await recordServiceMeasurement(owner,m));
  const privateView=await getClientService(member,s.id),financeView=await getClientService(owner,s.id);
  expect(privateView.measurements[0]).not.toHaveProperty('cost_cents');expect(financeView.measurements[0].cost_cents).toBe('2500');expect(privateView.measurements[0].outcome.savedSeconds).toBe(9000);
  await recordServiceMeasurement(member,measurement(s.id,{sourceKey:'estimate-2',baselineBasis:'estimate',actualSeconds:20000}));
  const estimate=(await getClientService(member,s.id)).measurements.find(x=>x.source_key==='estimate-2');expect(estimate?.outcome.savedSeconds).toBe(-8000);expect(estimate?.outcome.classification).toMatch(/Estimate/);
  await expect(recordServiceMeasurement(owner,{...m,requestId:req()})).rejects.toThrow(/already recorded/);
  expect((await db.query('SELECT count(*)::int n FROM crm_referral_earnings')).rows[0].n).toBe(0);
 });
 it('rejects an unrelated project and keeps older health observations from overwriting recent evidence',async()=>{
  const otherClient=req(),project=req();await db.query("INSERT INTO clients(id,workspace_id,name) VALUES($1,$2,'Other synthetic client')",[otherClient,ws]);await db.query("INSERT INTO projects(id,workspace_id,client_id,name) VALUES($1,$2,$3,'Unrelated project')",[project,ws,otherClient]);
  await expect(saveClientService(member,service({projectId:project}))).rejects.toThrow(/belonging to this client/);
  const s=await saveClientService(member,service());await recordServiceReview(member,{requestId:req(),serviceId:s.id,revision:1,health:'degraded',reviewedAt:new Date().toISOString(),nextReviewOn:'2027-01-01',outcome:'Most recent check'});
  await recordServiceReview(member,{requestId:req(),serviceId:s.id,revision:2,health:'healthy',reviewedAt:'2026-01-01T10:00:00-05:00',nextReviewOn:'2026-02-01',outcome:'Older historical evidence'});
  const d=await getClientService(member,s.id);expect(d.service.health).toBe('degraded');expect(d.reviews).toHaveLength(2);
 });
});
