import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import type {DashboardContext} from '@/lib/dashboard/data';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {getRelationshipOverview} from './overview';
import {requestHandoff,transitionHandoff,getHandoff,listHandoffs} from './handoffs';
import {saveDiscovery,addIntroduction,setAccountManager} from './service';
import {createManualLead} from '@/lib/operations/manual-leads';
import {linkInquiry,convertOpportunity} from '@/lib/sales/service';
const url=process.env.TEST_RELATIONSHIPS_DATABASE_URL;
const ws='00000000-0000-4000-8000-000000000001',otherWs='d1c585a1-7d67-466f-98a1-9087e82ea990';
function context(id:string,role:DashboardContext['role']='member',workspace=ws):DashboardContext{return {user:{id,name:id,email:id+'@example.test'},workspace:{id:workspace,name:'Synthetic relationships',slug:'fixture'},role};}
const owner=context('relationship-owner','owner'),member=context('relationship-member'),third=context('relationship-third'),viewer=context('relationship-viewer','viewer'),foreign=context('relationship-foreign','owner',otherWs);
let db:ReturnType<typeof getDatabasePool>,lead:string;
function input(){return {kind:'lead' as const,id:lead,requestId:randomUUID(),recipientUserId:member.user.id,nextAction:'Prepare the workflow review',context:'Owner asked about document intake; scope still open.',dueAt:'2026-11-12T10:00:00-05:00'};}
describe.skipIf(!url)('Relationship overview and accountable handoffs',()=>{
 beforeAll(async()=>{
  const u=new URL(url!);if(!['localhost','127.0.0.1'].includes(u.hostname)||u.pathname!=='/ta_relationships_test'||u.search||u.hash)throw new Error('Only isolated local ta_relationships_test is allowed.');
  vi.stubEnv('DATABASE_URL',url!);vi.stubEnv('NODE_ENV','test');vi.stubEnv('OPENAI_API_KEY','');vi.stubEnv('RESEND_API_KEY','');vi.stubEnv('TWILIO_SMS_ENABLED','false');
  db=getDatabasePool();await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())');
  for(const file of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort()){if((await db.query('SELECT 1 FROM schema_migrations WHERE filename=$1',[file])).rowCount)continue;await db.query(await readFile('db/migrations/'+file,'utf8'));await db.query('INSERT INTO schema_migrations(filename) VALUES($1)',[file]);}
 },30000);
 beforeEach(async()=>{
  await db.query('TRUNCATE "user",leads,clients,crm_businesses,crm_opportunities,audit_logs CASCADE');
  await db.query("INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,'relationship-other','Other','internal','active') ON CONFLICT(id) DO NOTHING",[otherWs]);
  for(const c of [owner,member,third,viewer,foreign]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[c.user.id,c.user.name,c.user.email]);await db.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')",[randomUUID(),c.workspace.id,c.user.id,c.role]);}
  lead=(await createManualLead(owner,{submissionId:randomUUID(),name:'Morgan Sample',phone:'7705550191'})).leadId;
 });
 afterAll(async()=>{await db?.end();delete (globalThis as {tailoredAgentsDatabasePool?:unknown}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();});
 it('supports sparse prospects and reads without changing records or messages',async()=>{
  const before=(await db.query('SELECT updated_at FROM leads WHERE id=$1',[lead])).rows[0];const result=await getRelationshipOverview(member,{kind:'lead',id:lead});
  expect(result.current.name).toBe('Morgan Sample');expect(result.projects).toEqual([]);expect(result.meetings).toEqual([]);expect(result.handoffs).toEqual([]);
  expect((await db.query('SELECT updated_at FROM leads WHERE id=$1',[lead])).rows[0]).toEqual(before);
 });
 it('denies foreign records, viewers, inactive recipients and stale membership',async()=>{
  await expect(getRelationshipOverview(foreign,{kind:'lead',id:lead})).rejects.toThrow('unavailable');
  await expect(requestHandoff(viewer,input())).rejects.toThrow();
  await expect(requestHandoff(owner,{...input(),recipientUserId:foreign.user.id})).rejects.toThrow('active teammate');
  await expect(requestHandoff(owner,{...input(),recipientUserId:viewer.user.id})).rejects.toThrow('active teammate');
  await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[member.user.id]);
  await expect(requestHandoff(owner,input())).rejects.toThrow('active teammate');await expect(listHandoffs(member)).rejects.toThrow();
 });
 it('deduplicates concurrent creates and rejects a reused identifier with changed content',async()=>{
  const v=input();const result=await Promise.all([requestHandoff(owner,v),requestHandoff(owner,v)]);expect(result.filter(r=>r.replayed)).toHaveLength(1);
  expect((await db.query('SELECT id FROM crm_relationship_handoffs')).rowCount).toBe(1);expect((await db.query('SELECT id FROM crm_relationship_handoff_events')).rowCount).toBe(1);
  await expect(requestHandoff(owner,{...v,nextAction:'Changed request'})).rejects.toThrow('already used');
 });
 it('requires recipient acceptance, rejects stale updates and records completed outcomes',async()=>{
  const {id}=await requestHandoff(owner,input());const first=await getHandoff(member,id);expect(first.status).toBe('pending');
  await expect(transitionHandoff(owner,{handoffId:id,revision:1,operation:'accept'})).rejects.toThrow('assigned teammate');
  await expect(transitionHandoff(member,{handoffId:id,revision:1,operation:'complete',note:'Completed'})).rejects.toThrow('not waiting');
  await transitionHandoff(member,{handoffId:id,revision:1,operation:'accept'});
  await expect(transitionHandoff(member,{handoffId:id,revision:1,operation:'complete',note:'Done'})).rejects.toThrow('changed');
  await expect(transitionHandoff(member,{handoffId:id,revision:2,operation:'complete',note:''})).rejects.toThrow();
  await transitionHandoff(member,{handoffId:id,revision:2,operation:'complete',note:'Discovery brief ready; customer has not been contacted.'});
  const done=await getHandoff(owner,id);expect(done.status).toBe('completed');expect(done.events.map(e=>e.status)).toEqual(['pending','accepted','completed']);expect(done.events[2].actor).toBe(member.user.name);
  await expect(transitionHandoff(member,{handoffId:id,revision:3,operation:'accept'})).rejects.toThrow('not waiting');
 });
 it('limits cancellation, keeps history and does not change sales ownership',async()=>{
  const before=(await db.query('SELECT owner_user_id FROM leads WHERE id=$1',[lead])).rows[0];const {id}=await requestHandoff(member,{...input(),recipientUserId:owner.user.id});
  await expect(transitionHandoff(third,{handoffId:id,revision:1,operation:'cancel',note:'Unrelated'})).rejects.toThrow('sender, recipient');
  await transitionHandoff(member,{handoffId:id,revision:1,operation:'cancel',note:'Customer changed the requested date.'});
  expect((await getHandoff(owner,id)).events[1].note).toContain('changed');expect((await db.query('SELECT owner_user_id FROM leads WHERE id=$1',[lead])).rows[0]).toEqual(before);
 });
 it('keeps sender/recipient queues separate from team visibility and denies foreign history',async()=>{
  const {id}=await requestHandoff(owner,input());expect(await listHandoffs(third)).toHaveLength(0);expect(await listHandoffs(owner)).toHaveLength(1);expect(await listHandoffs(member)).toHaveLength(1);expect(await listHandoffs(third,'team')).toHaveLength(1);
  await expect(getHandoff(foreign,id)).rejects.toThrow('unavailable');expect(await listHandoffs(foreign,'team')).toHaveLength(0);
 });
 it('preserves canonical discovery, introducer and handoff context after client conversion',async()=>{
  const target={kind:'lead' as const,id:lead};await saveDiscovery(owner,{...target,fields:{problems:'Retyping data',opportunities:'Explore document automation'}});await addIntroduction(owner,{...target,partnerId:'',name:'Introducer sample',organization:'',note:'Met at a business meetup'});const {id}=await requestHandoff(owner,input());
  const opportunity=await linkInquiry(owner,lead);await convertOpportunity(owner,{opportunityId:opportunity,projectName:'Document workflow pilot',createSite:false});const client=(await db.query('SELECT client_id FROM crm_opportunities WHERE id=$1',[opportunity])).rows[0].client_id;
  const result=await getRelationshipOverview(owner,{kind:'client',id:client});expect(result.handoffs[0].id).toBe(id);expect(result.introductions[0].name).toBe('Introducer sample');expect(result.discovery[0].fields.problems).toBe('Retyping data');expect(result.projects[0].name).toBe('Document workflow pilot');
  await setAccountManager(owner,{clientId:client,userId:member.user.id,expectedUpdatedAt:result.current.updated_at});
  await expect(setAccountManager(owner,{clientId:client,userId:third.user.id,expectedUpdatedAt:result.current.updated_at})).rejects.toThrow('changed');expect((await getRelationshipOverview(owner,{kind:'client',id:client})).current.owner).toBe(member.user.name);
 });
 it('never exposes another employee private meetings and omits all meetings without explicit include',async()=>{
  const privateId=randomUUID(),teamId=randomUUID();for(const [id,visibility,title] of [[privateId,'private','Private title'],[teamId,'team','Team title']])await db.query("INSERT INTO meetings(id,workspace_id,owner_user_id,title,source,status,visibility,lead_id) VALUES($1,$2,$3,$4,'upload','review',$5,$6)",[id,ws,owner.user.id,title,visibility,lead]);
  expect((await getRelationshipOverview(member,{kind:'lead',id:lead})).meetings).toHaveLength(0);
  expect((await getRelationshipOverview(member,{kind:'lead',id:lead},true)).meetings.map(m=>m.id)).toEqual([teamId]);
  expect((await getRelationshipOverview(owner,{kind:'lead',id:lead},true)).meetings).toHaveLength(2);
 });
 it('shows saved prospect next actions and does not merge unrelated matching names',async()=>{
  await db.query("UPDATE leads SET next_action='Ask about document volume',next_action_at=now() WHERE id=$1",[lead]);const duplicate=(await createManualLead(owner,{submissionId:randomUUID(),name:'Morgan Sample',phone:'7705550192'})).leadId;
  const result=await getRelationshipOverview(owner,{kind:'lead',id:lead});expect(result.leadSteps[0].title).toContain('document volume');expect(result.records.some(r=>r.id===duplicate)).toBe(false);
 });
});
