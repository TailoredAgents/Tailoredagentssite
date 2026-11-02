import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID,createHash,randomBytes} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import type {Pool} from 'pg';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {registerClient,validateAuthorization,createConsent,finishConsent,exchange,authenticate,hash} from './oauth';
import {prepareAction,reviewAction,manageConnection,listActions,readAction} from './actions';
import {listGoals} from './goals';
import {POST} from '@/app/api/mcp/operations/route';
import {GET as metadata} from '@/app/.well-known/oauth-protected-resource/api/mcp/operations/route';
import {readTools} from './tools/reads';
import {getClient,getContact,getSite,getProject} from '@/lib/operations/data';
import {saveClient} from '@/lib/operations/service';
import {availableSlots} from '@/lib/booking/calendar';
import {getCalendarEntry} from '@/lib/booking/staff';
import {getSalesRecord} from '@/lib/sales/data';
const url=process.env.ASSISTANT_TEST_DATABASE_URL;
const workspace='00000000-0000-4000-8000-000000000001';
const owner={user:{id:'assistant-owner',name:'Owner',email:'owner@example.test'},workspace:{id:workspace,name:'Tailored Agents',slug:'tailored-agents'},role:'owner' as const};
const other={...owner,user:{id:'assistant-other',name:'Other',email:'other@example.test'}};
const origin='http://localhost:3162',resource=origin+'/api/mcp/operations',callback='https://chatgpt.com/connector_platform/oauth/callback';
const allScopes=['operations:read','operations:write','conversations:read','personal:read','personal:write'];
let pool:Pool;
async function authorization(scopes=allScopes){
 const client=await registerClient({client_name:'Synthetic ChatGPT',redirect_uris:[callback]});
 const verifier=randomBytes(32).toString('base64url');
 const request=await validateAuthorization({client_id:client.client_id,redirect_uri:callback,response_type:'code',resource,scope:scopes.join(' '),state:'test-state',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
 const nonce=await createConsent(request,owner,'owner-session');
 const location=new URL(await finishConsent(nonce,owner,'owner-session',scopes,true));
 return {client,verifier,code:location.searchParams.get('code')!,location};
}
async function connection(scopes=allScopes){
 const c=await authorization(scopes),tokens=await exchange({grant_type:'authorization_code',client_id:c.client.client_id,code:c.code,redirect_uri:callback,code_verifier:c.verifier,resource});
 const request=new Request(resource,{headers:{authorization:'Bearer '+tokens.access_token}});
 const p=await authenticate(request);return {...c,tokens,p,request};
}
function rpc(token:string,method:string,params?:unknown){return POST(new Request(resource,{method:'POST',headers:{authorization:'Bearer '+token,accept:'application/json, text/event-stream','content-type':'application/json','mcp-protocol-version':'2025-03-26'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));}
describe.skipIf(!url)('Operations OAuth and execution integration',()=>{
 beforeAll(async()=>{
  const target=new URL(url!);if(!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/ta_assistant_test')throw new Error('Use only the dedicated local disposable assistant database.');
  vi.stubEnv('DATABASE_URL',url);vi.stubEnv('BETTER_AUTH_URL',origin);vi.stubEnv('DASHBOARD_AUTH_MODE','password');vi.stubEnv('DASHBOARD_ALLOWED_EMAILS','owner@example.test,other@example.test');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-assistant-only-secret-at-least32');vi.stubEnv('OPERATIONS_ASSISTANT_ENABLED','true');vi.stubEnv('OPERATIONS_ASSISTANT_WRITES_ENABLED','true');
  pool=getDatabasePool();await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await pool.query('CREATE TABLE schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())');
  for(const filename of (await readdir('db/migrations')).filter(x=>x.endsWith('.sql')).sort()){await pool.query(await readFile('db/migrations/'+filename,'utf8'));await pool.query('INSERT INTO schema_migrations(filename) VALUES($1)',[filename]);}
  for(const u of [owner,other]){await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[u.user.id,u.user.name,u.user.email]);await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')",[randomUUID(),workspace,u.user.id]);}
 },30000);
 beforeEach(async()=>{
  await pool.query('TRUNCATE assistant_actions,assistant_tokens,assistant_codes,assistant_consents,assistant_grants,assistant_clients,assistant_goals,request_rate_limits CASCADE');
  await pool.query("UPDATE workspace_memberships SET role='owner',status='active' WHERE user_id=$1",[owner.user.id]);
  await pool.query(`INSERT INTO "session"(id,"userId",token,"expiresAt") VALUES('owner-session',$1,'synthetic-session-token',now()+interval '2 days') ON CONFLICT(id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt"`,[owner.user.id]);
 });
 afterAll(async()=>{await pool?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();});
 it('binds OAuth to exact callback, resource, identity and scopes; stores only token hashes',async()=>{
  const c=await connection();expect(c.location.searchParams.get('state')).toBe('test-state');expect(c.p.context.user.id).toBe(owner.user.id);expect(c.p.scopes).toEqual(allScopes);
  const saved=(await pool.query('SELECT * FROM assistant_tokens')).rows;expect(saved).toHaveLength(2);expect(JSON.stringify(saved)).not.toContain(c.tokens.access_token);expect(saved.some(t=>t.token_hash===hash(c.tokens.access_token))).toBe(true);
  await expect(validateAuthorization({client_id:c.client.client_id,redirect_uri:'https://evil.example',response_type:'code',resource,scope:'operations:read',state:'s',code_challenge:'a'.repeat(43),code_challenge_method:'S256'})).rejects.toThrow();
  await expect(exchange({grant_type:'refresh_token',client_id:c.client.client_id,refresh_token:c.tokens.refresh_token,resource:origin+'/api/mail'})).rejects.toThrow();
 });
 it('rejects wrong PKCE and client without consuming a valid code',async()=>{
  const c=await authorization();const args={grant_type:'authorization_code',client_id:c.client.client_id,code:c.code,redirect_uri:callback,code_verifier:c.verifier,resource};
  await expect(exchange({...args,code_verifier:'b'.repeat(43)})).rejects.toThrow();await expect(exchange({...args,client_id:'wrong-client'})).rejects.toThrow();expect((await exchange(args)).access_token).toMatch(/^ta_ops_/);
 });
 it('consumes consent once and blocks a forged user, session or expanded scopes',async()=>{
  const client=await registerClient({client_name:'test',redirect_uris:[callback]});const request=await validateAuthorization({client_id:client.client_id,redirect_uri:callback,response_type:'code',resource,state:'s',scope:'operations:read',code_challenge:'a'.repeat(43),code_challenge_method:'S256'});const nonce=await createConsent(request,owner,'owner-session');
  await expect(finishConsent(nonce,other,'owner-session',['operations:read'],true)).rejects.toThrow();await expect(finishConsent(nonce,owner,'wrong-session',['operations:read'],true)).rejects.toThrow();await expect(finishConsent(nonce,owner,'owner-session',['operations:write'],true)).rejects.toThrow();
  expect(new URL(await finishConsent(nonce,owner,'owner-session',['operations:read'],true)).searchParams.has('code')).toBe(true);await expect(finishConsent(nonce,owner,'owner-session',['operations:read'],true)).rejects.toThrow();
 });
 it('rotates refresh tokens, prevents expansion and revokes a replayed family',async()=>{
  const c=await connection(['operations:read']);const args={grant_type:'refresh_token',client_id:c.client.client_id,refresh_token:c.tokens.refresh_token,resource};
  await expect(exchange({...args,scope:'operations:write'})).rejects.toThrow();const fresh=await exchange(args);expect(fresh.refresh_token).not.toBe(c.tokens.refresh_token);await expect(exchange(args)).rejects.toThrow();await expect(authenticate(new Request(resource,{headers:{authorization:'Bearer '+fresh.access_token}}))).rejects.toThrow();
 });
 it('blocks expired, revoked, suspended, signed-out and wrong-workspace identities',async()=>{
  const c=await connection();await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[owner.user.id]);await expect(authenticate(c.request)).rejects.toThrow();await pool.query("UPDATE workspace_memberships SET status='active' WHERE user_id=$1",[owner.user.id]);
  await pool.query('UPDATE assistant_grants SET expires_at=now()-interval \'1 second\' WHERE id=$1',[c.p.grantId]);await expect(authenticate(c.request)).rejects.toThrow();await pool.query('UPDATE assistant_grants SET expires_at=now()+interval \'1 day\' WHERE id=$1',[c.p.grantId]);
  await pool.query('DELETE FROM "session" WHERE id=$1',['owner-session']);await expect(authenticate(c.request)).rejects.toThrow();
 });
 it('requires a live editor role and exact granted scopes for proposals',async()=>{
  const c=await connection(['operations:read']);await expect(prepareAction(c.p,'save_goal',{title:'Private'},'request-0001')).rejects.toThrow();
  const full=await connection();await pool.query("UPDATE workspace_memberships SET role='viewer' WHERE user_id=$1",[owner.user.id]);await expect(prepareAction(full.p,'save_goal',{title:'Private'},'request-0001')).rejects.toThrow();await expect(authorization()).rejects.toThrow();
 });
 it('prepares without changing data, requires the same human owner, and executes once despite concurrent approvals',async()=>{
  const c=await connection();const requests=await Promise.all([prepareAction(c.p,'save_goal',{title:'Weekly target'},'request-0001'),prepareAction(c.p,'save_goal',{title:'Weekly target'},'request-0001')]);expect(requests[0].id).toBe(requests[1].id);expect((await listGoals(owner)).total).toBe(0);
  await expect(prepareAction(c.p,'save_goal',{title:'Different target'},'request-0001')).rejects.toThrow('original content');await expect(reviewAction(other,requests[0].id,'approve')).rejects.toThrow();
  await Promise.all([reviewAction(owner,requests[0].id,'approve'),reviewAction(owner,requests[0].id,'approve')]);expect((await listGoals(owner)).total).toBe(1);expect((await readAction(c.p,requests[0].id)).status).toBe('succeeded');expect((await listGoals(other)).total).toBe(0);
 });
 it('rejects stale goal changes and never overwrites another user’s goal',async()=>{
  const c=await connection(),a=await prepareAction(c.p,'save_goal',{title:'Initial'},'goal-create');await reviewAction(owner,a.id,'approve');const goal=(await listGoals(owner)).items[0];
  const b=await prepareAction(c.p,'save_goal',{id:goal.id,expectedRevision:1,title:'Stale'},'goal-change');await pool.query('UPDATE assistant_goals SET revision=2,title=\'Human edit\' WHERE id=$1',[goal.id]);expect((await reviewAction(owner,b.id,'approve')).status).toBe('failed');expect((await listGoals(owner)).items[0].title).toBe('Human edit');
 });
 it('honors pause, revoke, expiry and reject before approval',async()=>{
  const c=await connection(),a=await prepareAction(c.p,'save_goal',{title:'Target'},'request-0001');await manageConnection(owner,c.p.grantId,'pause');await expect(reviewAction(owner,a.id,'approve')).rejects.toThrow();await manageConnection(owner,c.p.grantId,'resume');
  await pool.query("UPDATE assistant_actions SET expires_at=now()-interval '1 second' WHERE id=$1",[a.id]);await expect(reviewAction(owner,a.id,'approve')).rejects.toThrow('expired');expect((await reviewAction(owner,a.id,'reject')).status).toBe('cancelled');
  await manageConnection(owner,c.p.grantId,'revoke');await expect(authenticate(c.request)).rejects.toThrow();expect((await listGoals(owner)).total).toBe(0);
 });
 it('isolates receipts to a single grant and provides stateless MCP discovery and structured output',async()=>{
  const c=await connection(),otherConnection=await connection();const a=await prepareAction(c.p,'save_goal',{title:'One connection'},'request-0001');await expect(readAction(otherConnection.p,a.id)).rejects.toThrow();expect((await listActions(otherConnection.p)).items).toHaveLength(0);
  const discovery=await metadata();expect((await discovery.json()).resource).toBe(resource);
  expect((await POST(new Request(resource,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).status).toBe(401);
  const init=await rpc(c.tokens.access_token,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}});expect(init.status).toBe(200);
  const list=await rpc(c.tokens.access_token,'tools/list');const listed=await list.json();expect(listed.result.tools.length).toBeGreaterThan(30);expect(listed.result.tools.find((t:{name:string})=>t.name==='prepare_save_goal').inputSchema.properties.change).toBeDefined();
  const who=await rpc(c.tokens.access_token,'tools/call',{name:'whoami',arguments:{}});const result=await who.json();expect(result.result.structuredContent.data.user.id).toBe(owner.user.id);expect(result.result.isError).not.toBe(true);
  const rejected=await POST(new Request(resource,{method:'POST',headers:{origin:'https://evil.example',authorization:'Bearer '+c.tokens.access_token,'content-type':'application/json'},body:'{}'}));expect(rejected.status).toBe(403);
 });
 it('returns only granted tools and refuses an unlisted mutation',async()=>{
  const c=await connection(['operations:read']);const listed=await (await rpc(c.tokens.access_token,'tools/list')).json();expect(listed.result.tools.some((t:{name:string})=>t.name==='list_goals')).toBe(false);expect(listed.result.tools.some((t:{name:string})=>t.name.startsWith('prepare_'))).toBe(false);
  const result=await (await rpc(c.tokens.access_token,'tools/call',{name:'prepare_save_goal',arguments:{idempotencyKey:'test-key',change:{title:'No'}}})).json();expect(result.result?.isError??!!result.error).toBe(true);
 });
 it('runs reviewed sales notes, follow-ups and mockup requests through shared services',async()=>{
  const c=await connection();const created=await prepareAction(c.p,'create_opportunity',{businessName:'Synthetic company',title:'Website consultation',email:'synthetic@example.test',ownerUserId:owner.user.id},'create-sales');
  const saved=await reviewAction(owner,created.id,'approve');expect(saved.status).toBe('succeeded');const opportunityId=saved.result as string;
  const note=await prepareAction(c.p,'log_activity',{opportunityId,body:'The user confirmed these needs.'},'sales-note');expect((await reviewAction(owner,note.id,'approve')).status).toBe('succeeded');
  const task=await prepareAction(c.p,'create_follow_up',{opportunityId,title:'Prepare consultation',ownerUserId:other.user.id,dueAt:new Date(Date.now()+86400000).toISOString()},'sales-task');
  const reviewed=(await pool.query('SELECT review_context FROM assistant_actions WHERE id=$1',[task.id])).rows[0].review_context;expect(reviewed.customer).toBe('Synthetic company');expect(reviewed.assignedTo).toBe('Other');
  expect((await reviewAction(owner,task.id,'approve')).status).toBe('succeeded');await reviewAction(owner,task.id,'approve');expect((await pool.query('SELECT id FROM crm_tasks WHERE opportunity_id=$1',[opportunityId])).rowCount).toBe(1);
  const mockup=await prepareAction(c.p,'request_mockup',{opportunityId,brief:'Prepare a website demonstrating the agreed service.'},'sales-mockup');expect((await reviewAction(owner,mockup.id,'approve')).status).toBe('succeeded');expect((await pool.query('SELECT id FROM factory_build_requests')).rowCount).toBe(0);
  const stale=await prepareAction(c.p,'log_activity',{opportunityId,body:'Another user-confirmed note.'},'sales-stale');await pool.query("UPDATE crm_opportunities SET title='Changed by a teammate' WHERE id=$1",[opportunityId]);expect((await reviewAction(owner,stale.id,'approve')).status).toBe('failed');
 });
 it('creates a reviewed time block without booking or contacting a visitor',async()=>{
  const c=await connection();const a=await prepareAction(c.p,'block_time',{profile:'austin',startsAt:new Date(Date.now()+86400000).toISOString(),minutes:60},'block-calendar');
  expect((await reviewAction(owner,a.id,'approve')).status).toBe('succeeded');expect((await pool.query("SELECT id FROM booking_slots WHERE status='blocked'")).rowCount).toBe(1);expect((await pool.query("SELECT id FROM booking_slots WHERE status='booked'")).rowCount).toBe(0);
 });
 it('creates client delivery records through review, returning usable IDs and revisions',async()=>{
  const c=await connection();
  const perform=async(tool:string,input:unknown,key:string)=>{
   const action=await prepareAction(c.p,tool,input,key);
   const result=await reviewAction(owner,action.id,'approve');expect(result.status).toBe('succeeded');
   await reviewAction(owner,action.id,'approve');
   return (result.result as {recordId:string}).recordId;
  };
  const clientId=await perform('save_client',{name:'Delivery customer'},'delivery-client');
  const contactId=await perform('save_contact',{clientId,name:'Customer contact',email:'delivery@example.test',isPrimary:true},'delivery-contact');
  expect((await getContact(owner,clientId,contactId))?.is_primary).toBe(true);
  const siteId=await perform('save_site',{name:'Delivery website',url:'https://delivery.example.test'},'delivery-site');
  const projectId=await perform('save_project',{clientId,siteId,name:'Delivery project',ownerUserId:owner.user.id},'delivery-project');
  expect((await getSite(owner,siteId))?.client_id).toBe(clientId);
  const milestoneId=await perform('add_milestone',{projectId,title:'Review first draft',dueAt:'2026-12-01'},'delivery-milestone');
  const recordId=await perform('add_project_record',{projectId,kind:'decision',title:'Approved color direction',body:'Customer supplied blue.'},'delivery-decision');
  const project=await getProject(owner,projectId);expect(project?.records.map(r=>r.id)).toContain(recordId);expect(project?.milestones).toHaveLength(1);
  const milestone=project!.milestones.find(m=>m.id===milestoneId)!;
  await perform('update_milestone_status',{projectId,milestoneId,status:'completed',expectedUpdatedAt:milestone.updatedAt},'delivery-complete');
  expect((await getProject(owner,projectId))?.milestones[0].status).toBe('completed');
  expect((await getClient(owner,clientId))?.contacts).toHaveLength(1);
 });
 it('rejects stale edits inside the domain transaction and preserves newer changes',async()=>{
  const c=await connection(),created=await prepareAction(c.p,'save_client',{name:'Revision customer'},'revision-create');
  const clientId=((await reviewAction(owner,created.id,'approve')).result as {recordId:string}).recordId;
  const client=(await getClient(owner,clientId))!;
  await expect(prepareAction(c.p,'save_client',{clientId,name:'Missing revision'},'revision-missing')).rejects.toThrow();
  const proposal=await prepareAction(c.p,'save_client',{clientId,name:'Stale change',expectedUpdatedAt:client.updatedAt},'revision-stale');
  // Preserve the reviewed identity to exercise CAS rather than label comparison.
  await pool.query("UPDATE clients SET notes='A teammate added this',updated_at=updated_at+interval '1 second' WHERE id=$1",[clientId]);
  expect((await reviewAction(owner,proposal.id,'approve')).status).toBe('failed');
  expect((await getClient(owner,clientId))?.notes).toBe('A teammate added this');
  const fresh=(await getClient(owner,clientId))!;
  const changes=await Promise.all(['First edit','Second edit'].map((name,i)=>prepareAction(c.p,'save_client',{clientId,name,expectedUpdatedAt:fresh.updatedAt},'revision-race-'+i)));
  const results=await Promise.all(changes.map(a=>reviewAction(owner,a.id,'approve')));
  expect(results.filter(r=>r.status==='succeeded')).toHaveLength(1);expect(results.filter(r=>r.status==='failed')).toHaveLength(1);
 });
 it('authorizes the shared service against current membership rather than a supplied role',async()=>{
  const form=new FormData();form.set('name','Denied customer');
  await pool.query("UPDATE workspace_memberships SET role='viewer' WHERE user_id=$1",[owner.user.id]);
  expect((await saveClient(owner,form)).status).toBe('error');
  expect((await pool.query("SELECT id FROM clients WHERE name='Denied customer'")).rowCount).toBe(0);
 });
 it('reviews appointment edits, rejects concurrent overlaps and completes with a real outcome',async()=>{
  const c=await connection();
  const proposal=await prepareAction(c.p,'create_opportunity',{businessName:'Calendar customer',title:'Discovery',email:'calendar@example.test'},'calendar-opportunity');
  const opportunityId=(await reviewAction(owner,proposal.id,'approve')).result as string;
  const dueAt=new Date(Date.now()+10*86400000).toISOString();
  const input={opportunityId,ownerUserId:owner.user.id,title:'Discovery appointment',kind:'appointment',dueAt};
  const first=await prepareAction(c.p,'save_sales_task',input,'appointment-first');
  const second=await prepareAction(c.p,'save_sales_task',input,'appointment-second');
  const results=await Promise.all([reviewAction(owner,first.id,'approve'),reviewAction(owner,second.id,'approve')]);
  expect(results.filter(r=>r.status==='succeeded')).toHaveLength(1);expect(results.filter(r=>r.status==='failed')).toHaveLength(1);
  let task=(await getSalesRecord(owner,opportunityId))!.tasks[0];
  // Updating its own notes must not conflict with the appointment itself.
  const edit=await prepareAction(c.p,'save_sales_task',{...input,taskId:task.id,expectedUpdatedAt:task.updatedAt,notes:'Customer requested a website discussion.'},'appointment-edit');
  expect((await reviewAction(owner,edit.id,'approve')).status).toBe('succeeded');
  const stale=await prepareAction(c.p,'complete_sales_task',{opportunityId,taskId:task.id,expectedUpdatedAt:task.updatedAt,status:'completed',outcome:'Discussion finished.'},'appointment-stale');
  expect((await reviewAction(owner,stale.id,'approve')).status).toBe('failed');
  task=(await getSalesRecord(owner,opportunityId))!.tasks[0];
  const done=await prepareAction(c.p,'complete_sales_task',{opportunityId,taskId:task.id,expectedUpdatedAt:task.updatedAt,status:'completed',outcome:'User confirmed the discussion finished.'},'appointment-complete');
  expect((await reviewAction(owner,done.id,'approve')).status).toBe('succeeded');
  expect((await getSalesRecord(owner,opportunityId))!.tasks[0].status).toBe('completed');
 });
 it('books and moves a lead through shared availability, rejects stale cancellation and sends nothing',async()=>{
  const c=await connection(),leadId=randomUUID();
  await pool.query("INSERT INTO leads(id,workspace_id,submission_id,fingerprint,source,status,name,organization,email,phone,description) VALUES($1,$2,$3,'fixture','manual','new','Booking visitor','Example','booking@example.test','+16785550123','User requested a consultation.')",[leadId,workspace,leadId]);
  const revision=(await pool.query('SELECT updated_at FROM leads WHERE id=$1',[leadId])).rows[0].updated_at.toISOString();
  const day=new Date(Date.now()+21*86400000).toISOString().slice(0,10),slots=await availableSlots('austin',undefined,day);
  const book=await prepareAction(c.p,'book_consultation',{leadId,expectedLeadUpdatedAt:revision,profile:'austin',slotId:slots[0].id},'consultation-book');
  const result=await reviewAction(owner,book.id,'approve');expect(result.status).toBe('succeeded');expect(result.result).toMatchObject({notificationSent:false,id:slots[0].id});
  const original=(await getCalendarEntry(owner,slots[0].id))!;
  const move=await prepareAction(c.p,'reschedule_consultation',{bookingId:original.id,expectedUpdatedAt:original.updatedAt,profile:'austin',slotId:slots[2].id},'consultation-move');
  expect((await reviewAction(owner,move.id,'approve')).status).toBe('succeeded');
  expect((await getCalendarEntry(owner,original.id))?.status).toBe('open');
  expect((await getCalendarEntry(owner,slots[2].id))?.leadId).toBe(leadId);
  await expect(prepareAction(c.p,'cancel_consultation',{id:slots[2].id,expectedUpdatedAt:original.updatedAt,visitorAlreadyContacted:false},'consultation-denied')).rejects.toThrow();
  const stale=await prepareAction(c.p,'cancel_consultation',{id:slots[2].id,expectedUpdatedAt:original.updatedAt,visitorAlreadyContacted:true},'consultation-stale');
  expect((await reviewAction(owner,stale.id,'approve')).status).toBe('failed');
  const moved=(await getCalendarEntry(owner,slots[2].id))!;
  const cancel=await prepareAction(c.p,'cancel_consultation',{id:moved.id,expectedUpdatedAt:moved.updatedAt,visitorAlreadyContacted:true},'consultation-cancel');
  expect((await reviewAction(owner,cancel.id,'approve')).status).toBe('succeeded');
  expect((await getCalendarEntry(owner,moved.id))?.status).toBe('cancelled');
 });
 it('keeps client search and record lookup isolated across workspaces',async()=>{
  const c=await connection(),workspaceId=randomUUID(),clientId=randomUUID();
  await pool.query("INSERT INTO workspaces(id,slug,name,kind) VALUES($1,$2,'Another company','client')",[workspaceId,workspaceId]);
  await pool.query("INSERT INTO clients(id,workspace_id,name) VALUES($1,$2,'Secret other client')",[clientId,workspaceId]);
  const search=readTools.find(t=>t.name==='search_clients')!;const get=readTools.find(t=>t.name==='get_client')!;
  expect(JSON.stringify(await search.run(c.p,{q:'Secret other'}))).not.toContain('Secret other client');
  expect(await get.run(c.p,{id:clientId})).toBeNull();
  await pool.query('UPDATE assistant_grants SET workspace_id=$2 WHERE id=$1',[c.p.grantId,workspaceId]);
  await expect(authenticate(c.request)).rejects.toThrow();
 });
 it('records access without contents and retires expired/uncertain work without rerunning',async()=>{
  const c=await connection();await rpc(c.tokens.access_token,'tools/call',{name:'whoami',arguments:{}});
  const event=(await pool.query('SELECT * FROM assistant_activity WHERE grant_id=$1',[c.p.grantId])).rows[0];expect(event.tool).toBe('whoami');expect(event).not.toHaveProperty('result');
  const a=await prepareAction(c.p,'save_goal',{title:'Expired'},'expiry-test');
  const b=await prepareAction(c.p,'save_goal',{title:'Interrupted'},'crash-test');
  await pool.query("UPDATE assistant_actions SET expires_at=now()-interval '1 second' WHERE id=$1",[a.id]);
  await pool.query("UPDATE assistant_actions SET status='running',updated_at=now()-interval '16 minutes' WHERE id=$1",[b.id]);
  await pool.query('SELECT perform_assistant_retention()');
  expect((await readAction(c.p,a.id)).status).toBe('cancelled');expect((await readAction(c.p,b.id)).status).toBe('outcome_unknown');
  expect((await listGoals(owner)).total).toBe(0);
 });
 it('keeps workspace reading scoped and sanitized',async()=>{
  const c=await connection();for(const name of ['search_leads','search_clients','list_sites','list_projects','list_goals','get_seo_status','get_integration_health']){
   const t=readTools.find(t=>t.name===name)!;const result=await t.run(c.p,{});expect(JSON.stringify(result)).not.toContain('synthetic-assistant-only-secret');
  }
 });
});
