import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import type {Pool} from 'pg';
vi.mock('server-only',()=>({}));
const smsGateway=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('@/lib/twilio/provider',async original=>({...await original<typeof import('@/lib/twilio/provider')>(),createSms:smsGateway.create}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {connectNative,nativePrincipal,chatState,beginChatTurn,saveChatBudget,stopChatTurn,assertTurnActive,chatHistory} from './chat-store';
import {invokeNativeTool,nativeCatalog,discoverNativeTools} from './chat-tools';
import {runChatTurn} from './chat-runner';
import {requestChatResponse} from './chat-provider';
import {manageConnection,reviewAction} from './actions';
import {listGoals} from './goals';
import {runAssistantWorker,enqueueDueRoutine} from './chat-worker';
import {saveMemory,searchMemories,forgetMemory,searchChatHistory} from './memory';
import {saveRoutine,nextRoutineTime,setRoutineEnabled} from './routines';
import {availableSlots} from '@/lib/booking/calendar';
import {getCalendarEntry} from '@/lib/booking/staff';
import {runBookingNotificationWorker} from './booking-notifications';
import {refreshPrincipal} from './oauth';
import {controlAssignment,claimAssignment} from './assignments';
import {workPlanSchema} from './assignment-contract';
const url=process.env.ASSISTANT_CHAT_TEST_DATABASE_URL;
const ws='00000000-0000-4000-8000-000000000001';
const owner={user:{id:'chat-owner',name:'Owner',email:'chat-owner@example.test'},workspace:{id:ws,name:'Tailored Agents',slug:'tailored-agents'},role:'owner' as const};
const other={...owner,user:{id:'chat-other',name:'Other',email:'chat-other@example.test'}};
let pool:Pool;
const answer=(text='Done.')=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],usage:{input_tokens:100,output_tokens:20}});
const call=(name:string,args:unknown)=>({...answer(),output:[{type:'function_call',call_id:randomUUID(),name,arguments:JSON.stringify(args)}]});
async function connection(mode:'read'|'review'|'direct'='direct',conversations=true){await connectNative(owner,'chat-session',mode,conversations);return nativePrincipal(owner,'chat-session');}
async function turn(){const p=await connection(),id=randomUUID(),thread=randomUUID();await beginChatTurn(p,thread,id,'Help with my work.');return{p,id,thread};}
async function background(){
 vi.stubEnv('ASSISTANT_BACKGROUND_ENABLED','true');
 await pool.query(`INSERT INTO "account"(id,"accountId","providerId","userId",password) VALUES('chat-password','chat-owner','credential',$1,'synthetic-password-hash') ON CONFLICT(id) DO UPDATE SET password=EXCLUDED.password`,[owner.user.id]);
 await connectNative(owner,'chat-session','direct',false,{background:true,routines:true});return nativePrincipal(owner,'chat-session');
}
describe.skipIf(!url)('Native employee assistant integration',()=>{
 beforeAll(async()=>{
  const target=new URL(url!);if(!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/ta_assistant_chat_test')throw Error('Use the dedicated local disposable chat database.');
  vi.stubEnv('DATABASE_URL',url);vi.stubEnv('BETTER_AUTH_URL','http://localhost:3162');vi.stubEnv('DASHBOARD_AUTH_MODE','password');vi.stubEnv('DASHBOARD_ALLOWED_EMAILS','chat-owner@example.test,chat-other@example.test');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-assistant-only-secret-at-least32');
  pool=getDatabasePool();await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  for(const f of (await readdir('db/migrations')).filter(x=>x.endsWith('.sql')).sort())await pool.query(await readFile('db/migrations/'+f,'utf8'));
  for(const c of [owner,other]){await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[c.user.id,c.user.name,c.user.email]);await pool.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')",[randomUUID(),ws,c.user.id]);}
 },30000);
 beforeEach(async()=>{
  vi.stubEnv('OPENAI_API_KEY','synthetic-never-sent-to-provider');vi.stubEnv('ASSISTANT_CHAT_ENABLED','true');vi.stubEnv('OPERATIONS_ASSISTANT_ENABLED','true');vi.stubEnv('OPERATIONS_ASSISTANT_WRITES_ENABLED','true');vi.stubEnv('OPERATIONS_ASSISTANT_DIRECT_ENABLED','true');
  await pool.query('TRUNCATE assistant_memories,assistant_routines,assistant_chat_turns,assistant_chat_threads,assistant_chat_requests,assistant_chat_usage,assistant_chat_settings,assistant_actions,assistant_grants,assistant_goals,assistant_activity CASCADE');
  await pool.query("UPDATE workspace_memberships SET role='owner',status='active' WHERE user_id=ANY($1)",[[owner.user.id,other.user.id]]);
  await pool.query(`INSERT INTO "session"(id,"userId",token,"expiresAt") VALUES('chat-session',$1,'synthetic-chat-session',now()+interval '2 days'),('other-session',$2,'synthetic-other-session',now()+interval '2 days') ON CONFLICT(id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt"`,[owner.user.id,other.user.id]);
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Unexpected provider call in test')));
  smsGateway.create.mockReset();
  vi.stubEnv('ASSISTANT_BACKGROUND_ENABLED','false');
 });
 afterAll(async()=>{await pool?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('keeps chats private across employees and workspaces and rejects forged session ownership',async()=>{
  const {p,id,thread}=await turn();
  expect((await chatState(owner,'chat-session',thread)).turns[0].id).toBe(id);
  await expect(chatState(other,'other-session',thread)).rejects.toThrow('unavailable');
  expect((await chatState(other,'other-session')).threads).toHaveLength(0);
  await expect(connectNative(other,'chat-session','direct',true)).rejects.toThrow();
  await connectNative(other,'other-session','direct',true);const q=await nativePrincipal(other,'other-session');
  await expect(beginChatTurn(q,thread,randomUUID(),'Hijack')).rejects.toThrow();
  expect(await chatHistory(q,thread)).toEqual([]);
  await expect(chatState({...owner,workspace:{...owner.workspace,id:randomUUID()}},'chat-session',thread)).rejects.toThrow();
  await stopChatTurn(other,thread,id);await assertTurnActive(p,id);
 });
 it('does not expand read-only/channel permissions, and rechecks viewer membership at action time',async()=>{
  const p=await connection('read',false);
  expect(nativeCatalog(p).some(t=>t.kind==='change'||t.scopes.includes('conversations:read'))).toBe(false);
  expect(nativeCatalog(p).some(t=>t.scopes.includes('conversations:send'))).toBe(false);
  await pool.query("UPDATE workspace_memberships SET role='viewer' WHERE user_id=$1",[owner.user.id]);
  await expect(connectNative({...owner,role:'viewer'},'chat-session','direct',true)).rejects.toThrow();
  await expect(saveChatBudget({...owner,role:'viewer'},25)).rejects.toThrow();
 });
 it('does not automatically recreate a revoked grant and stops on expired sessions',async()=>{
  const {p,id}=await turn();await manageConnection(owner,p.grantId,'revoke');
  await expect(nativePrincipal(owner,'chat-session')).rejects.toThrow('Enable');
  await expect(assertTurnActive(p,id)).rejects.toThrow();
  const renewed=await connection();expect(renewed.grantId).not.toBe(p.grantId);
  await pool.query('UPDATE "session" SET "expiresAt"=now()-interval \'1 second\' WHERE id=\'chat-session\'');
  await expect(nativePrincipal(owner,'chat-session')).rejects.toThrow();
 });
 it('serializes turns and makes retries idempotent without accepting different content',async()=>{
  const p=await connection(),thread=randomUUID(),id=randomUUID();
  expect(await Promise.all([beginChatTurn(p,thread,id,'One'),beginChatTurn(p,thread,id,'One')])).toEqual(expect.arrayContaining([true,false]));
  await expect(beginChatTurn(p,thread,id,'Different')).rejects.toThrow('identifier');
  await expect(beginChatTurn(p,thread,randomUUID(),'Overlapping')).rejects.toThrow('Wait');
  await stopChatTurn(owner,thread,id);await expect(assertTurnActive(p,id)).rejects.toThrow('stopped');
  expect(await beginChatTurn(p,thread,randomUUID(),'Next')).toBe(true);
 });
 it('continues explicit background work after sign-out and preserves selected scopes',async()=>{
  const p=await background();expect(p.authority).toBe('background');expect(p.sessionId).toBeNull();expect(p.scopes).not.toContain('mail:send');
  expect(p.expiresAt.getTime()-Date.now()).toBeLessThan(30*86400000);expect(p.expiresAt.getTime()-Date.now()).toBeGreaterThan(29*86400000);
  await pool.query('DELETE FROM "session" WHERE id=\'chat-session\'');
  const id=randomUUID();await beginChatTurn(p,randomUUID(),id,'Save my goal while away');
  const r=await invokeNativeTool(p,id,'save_goal','{"title":"Background result"}') as {status:string};expect(r.status).toBe('succeeded');
  await expect(invokeNativeTool(p,id,'send_sms','{}')).rejects.toThrow();
  await expect(connectNative(owner,'chat-session','direct',false,{background:true})).rejects.toThrow();
  expect((await refreshPrincipal(p)).grantId).toBe(p.grantId);
 });
 it('permanently revokes background access on a password change even if restored',async()=>{
  const p=await background();await pool.query('UPDATE "account" SET password=\'changed\' WHERE id=\'chat-password\'');
  await pool.query('UPDATE "account" SET password=\'synthetic-password-hash\' WHERE id=\'chat-password\'');
  await expect(refreshPrincipal(p)).rejects.toThrow();
 });
 it('permanently revokes background access when membership is suspended',async()=>{
  const p=await background();await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[owner.user.id]);
  await pool.query("UPDATE workspace_memberships SET status='active' WHERE user_id=$1",[owner.user.id]);await expect(refreshPrincipal(p)).rejects.toThrow();
 });
 it('honors background pause, expiry, explicit disconnect and the server switch',async()=>{
  const p=await background(),id=randomUUID();await beginChatTurn(p,randomUUID(),id,'Wait for my next action');
  await manageConnection(owner,p.grantId,'pause');await expect(invokeNativeTool(p,id,'save_goal','{"title":"Paused"}')).rejects.toThrow('paused');
  await manageConnection(owner,p.grantId,'resume');vi.stubEnv('ASSISTANT_BACKGROUND_ENABLED','false');await expect(refreshPrincipal(p)).rejects.toThrow();vi.stubEnv('ASSISTANT_BACKGROUND_ENABLED','true');
  await manageConnection(other,p.grantId,'revoke');expect((await refreshPrincipal(p)).grantId).toBe(p.grantId);
  await pool.query("UPDATE assistant_grants SET expires_at=now()-interval '1 second' WHERE id=$1",[p.grantId]);await expect(refreshPrincipal(p)).rejects.toThrow();
  const renewed=await background();await manageConnection(owner,renewed.grantId,'revoke');await expect(refreshPrincipal(renewed)).rejects.toThrow();
 });
 it('switching back to session access ends background work without silently moving routines',async()=>{
  const p=await background();const r=await saveRoutine(p,{title:'Morning priorities',instruction:'Summarize priorities',cadence:'daily',time:'09:00'});
  await connectNative(owner,'chat-session','read',false);await expect(refreshPrincipal(p)).rejects.toThrow();
  expect((await nativePrincipal(owner,'chat-session')).sessionId).toBe('chat-session');expect((await pool.query('SELECT grant_id FROM assistant_routines WHERE id=$1',[r.id])).rows[0].grant_id).toBe(p.grantId);
 });
 it('supports reviewed and direct actions with real receipts, once per parsed intent',async()=>{
  const p=await connection('review'),thread=randomUUID(),id=randomUUID();await beginChatTurn(p,thread,id,'Save my goal');
  const prepared=await invokeNativeTool(p,id,'save_goal','{"title":"Ship client onboarding"}') as {id:string;status:string};
  expect(prepared.status).toBe('awaiting_approval');expect((await listGoals(owner)).total).toBe(0);
  await reviewAction(owner,prepared.id,'approve');expect((await listGoals(owner)).total).toBe(1);
  const direct=await connection(),next=randomUUID();await beginChatTurn(direct,randomUUID(),next,'Save another goal');
  const a=await invokeNativeTool(direct,next,'save_goal','{"title":"Review documents"}') as {id:string;status:string};
  const b=await invokeNativeTool(direct,next,'save_goal','{ "title": "Review documents" }') as {id:string};
  expect(a.status).toBe('succeeded');expect(b.id).toBe(a.id);expect((await listGoals(owner)).total).toBe(2);
  await manageConnection(owner,direct.grantId,'pause');await expect(invokeNativeTool(direct,next,'save_goal','{"title":"Paused"}')).rejects.toThrow('paused');
 });
 it('runs a real tool round trip, preserves reasoning, and saves a final answer with activity',async()=>{
  const p=await connection();await saveChatBudget(owner,25);
  const responses=[call('find_business_tools',{query:'save_goal'}),{...call('use_business_tool',{name:'save_goal',arguments:'{"title":"Finish agent onboarding"}'}),output:[{type:'reasoning',id:'rs_test',encrypted_content:'synthetic-reasoning',summary:[]},...call('use_business_tool',{name:'save_goal',arguments:'{"title":"Finish agent onboarding"}'}).output]},answer('Your goal is saved.')];
  const fetcher=vi.fn().mockImplementation(async()=>Response.json(responses.shift()));vi.stubGlobal('fetch',fetcher);
  const thread=randomUUID(),id=randomUUID();await runChatTurn(p,thread,id,'Save a goal to finish agent onboarding.');
  const state=await chatState(owner,'chat-session',thread);expect(state.turns[0].status).toBe('completed');expect(state.turns[0].assistant_message).toBe('Your goal is saved.');expect(state.turns[0].activity.some(a=>a.status==='succeeded')).toBe(true);
  expect((await listGoals(owner)).total).toBe(1);expect(state.monthlyUsed).toBeGreaterThan(0);expect(state.monthlyUsed).toBeLessThan(.01);
  const last=JSON.parse(fetcher.mock.calls[2][1].body);expect(last.store).toBe(false);expect(last.input.some((x:{type:string})=>x.type==='reasoning')).toBe(true);expect(last.input.some((x:{type:string})=>x.type==='function_call_output')).toBe(true);
  await runChatTurn(p,thread,id,'Save a goal to finish agent onboarding.');expect(fetcher).toHaveBeenCalledTimes(3);
 });
 it('requires a budget, enforces concurrent shared allowance, and retains unknown usage',async()=>{
  const {p,id}=await turn();await expect(requestChatResponse(p,id,0,{input:'test'})).rejects.toThrow('allowance');expect(fetch).not.toHaveBeenCalled();
  await saveChatBudget(owner,1);await pool.query('UPDATE assistant_chat_settings SET monthly_limit_micros=60000 WHERE workspace_id=$1',[ws]);
  const results=await Promise.allSettled([requestChatResponse(p,id,0,{input:'test'}),requestChatResponse(p,id,1,{input:'test'})]);
  expect(results.every(r=>r.status==='rejected')).toBe(true);expect(fetch,JSON.stringify(results.map(r=>r.status==='rejected'?String(r.reason):r.value))).toHaveBeenCalledTimes(1);
  expect(Number((await pool.query('SELECT amount_micros FROM assistant_chat_usage')).rows[0].amount_micros)).toBeGreaterThan(0);
  await expect(requestChatResponse(p,id,0,{input:'test'})).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('stops after a failed tool without retrying and rejects external tools',async()=>{
  const p=await connection();await saveChatBudget(owner,25);
  const fetcher=vi.fn().mockResolvedValue(Response.json(call('use_business_tool',{name:'send_sms',arguments:'{}'})));vi.stubGlobal('fetch',fetcher);
  const thread=randomUUID();await runChatTurn(p,thread,randomUUID(),'Plan a text');
  const state=await chatState(owner,'chat-session',thread);expect(state.turns[0].status).toBe('failed');expect(fetcher).toHaveBeenCalledTimes(1);expect((await pool.query('SELECT id FROM assistant_actions')).rowCount).toBe(0);
 });
 it('preserves queued work after the HTTP deadline and blocks model calls after explicit stop',async()=>{
  const {p,id,thread}=await turn();await pool.query("UPDATE assistant_chat_turns SET deadline=now()-interval '1 second' WHERE id=$1",[id]);
  expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('queued');
  await stopChatTurn(owner,thread,id);
  await expect(requestChatResponse(p,id,0,{input:'test'})).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 });
 it('resumes a saved provider response after worker restart without another paid request or duplicate action',async()=>{
  const {p,id,thread}=await turn();await saveChatBudget(owner,25);
  const fetcher=vi.fn().mockImplementationOnce(async()=>Response.json(call('use_business_tool',{name:'save_goal',arguments:'{"title":"Restart-proof goal"}'}))).mockImplementationOnce(async()=>Response.json(answer('Saved after restart.')));vi.stubGlobal('fetch',fetcher);
  await runAssistantWorker(id,1);
  expect((await pool.query('SELECT engine_state FROM assistant_chat_turns WHERE id=$1',[id])).rows[0].engine_state.response).toBeTruthy();
  await pool.query("UPDATE assistant_chat_turns SET status='running',lease_token=$2,lease_until=now()-interval '1 second' WHERE id=$1",[id,randomUUID()]);
  await runAssistantWorker(id,1);expect((await listGoals(owner)).total).toBe(1);
  // Simulate a crash after the action committed but before its checkpoint.
  const saved=(await pool.query('SELECT response FROM assistant_chat_requests WHERE turn_id=$1 AND step=0',[id])).rows[0].response;
  await pool.query("UPDATE assistant_chat_turns SET engine_state=jsonb_build_object('input','[]'::jsonb,'instructions','test','step',0,'response',$2::jsonb) WHERE id=$1",[id,JSON.stringify(saved)]);
  await runAssistantWorker(id,10);
  expect((await listGoals(owner)).total).toBe(1);expect(fetcher).toHaveBeenCalledTimes(2);
  expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('completed');
  await expect(assertTurnActive(p,id)).rejects.toThrow();
 });
 it('does not repeat an uncertain paid request when reclaiming a crashed worker',async()=>{
  const {p,id,thread}=await turn();await saveChatBudget(owner,25);
  await expect(requestChatResponse(p,id,0,{input:'test'})).rejects.toThrow();
  await runAssistantWorker(id,2);
  expect(fetch).toHaveBeenCalledTimes(1);expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('outcome_unknown');
 });
 it('waits for exact review, then resumes dependent work from the same plan and allowance',async()=>{
  const p=await connection('review');await saveChatBudget(owner,25);
  const steps=[{id:'goal',label:'Save onboarding goal',status:'working',dependsOn:[],evidence:''}];
  const responses=[call('update_work_plan',{steps}),call('use_business_tool',{name:'save_goal',arguments:'{"title":"Reviewed background goal"}'}),call('update_work_plan',{steps:[{...steps[0],status:'done',evidence:'Saved goal action receipt confirmed success.'}]}),answer('Your reviewed goal is saved.')];
  const fetcher=vi.fn().mockImplementation(async()=>Response.json(responses.shift()));vi.stubGlobal('fetch',fetcher);
  const id=randomUUID(),thread=randomUUID();await beginChatTurn(p,thread,id,'Save this goal after my review.');await runAssistantWorker(id,30);
  expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('waiting');expect(fetcher).toHaveBeenCalledTimes(2);expect((await listGoals(owner)).total).toBe(0);
  await runAssistantWorker(id,30);expect(fetcher).toHaveBeenCalledTimes(2);
  const action=(await pool.query('SELECT id FROM assistant_actions')).rows[0].id;await reviewAction(owner,action,'approve');await runAssistantWorker(id,30);
  const state=await chatState(owner,'chat-session',thread);expect(state.turns[0].status).toBe('completed');expect(state.turns[0].work_plan?.[0].status).toBe('done');expect((await listGoals(owner)).total).toBe(1);expect(fetcher).toHaveBeenCalledTimes(4);
  const sent=JSON.parse(fetcher.mock.calls[2][1].body);expect(JSON.stringify(sent.input)).toContain('Exact human review completed');
 });
 it('uses one assignment ceiling across continuations and can raise it only through employee control',async()=>{
  const p=await connection();await saveChatBudget(owner,25);const id=randomUUID(),thread=randomUUID();await beginChatTurn(p,thread,id,'Continue within my cap',.25);
  await pool.query("INSERT INTO assistant_chat_requests(id,turn_id,workspace_id,month,step,amount_micros,status) VALUES($1,$2,$3,current_date,98,240000,'completed')",[randomUUID(),id,ws]);
  await runAssistantWorker(id,1);expect(fetch).not.toHaveBeenCalled();expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('blocked');
  await expect(controlAssignment(other,{operation:'assignment',id,threadId:thread,action:'resume',maxCostDollars:1})).rejects.toThrow('unavailable');
  await controlAssignment(owner,{operation:'assignment',id,threadId:thread,action:'resume',maxCostDollars:1});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(answer('Completed within the raised ceiling.'))));await runAssistantWorker(id,3);
  expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('completed');expect((await pool.query('SELECT count(*) n FROM assistant_chat_turns WHERE thread_id=$1',[thread])).rows[0].n).toBe('1');
 });
 it('asks for missing input without spending while waiting and includes the human reply on resume',async()=>{
  const {id,thread}=await turn();await saveChatBudget(owner,25);const fetcher=vi.fn().mockResolvedValueOnce(Response.json(call('request_employee_input',{question:'Which onboarding project?'}))).mockResolvedValueOnce(Response.json(answer('I have the project context.')));vi.stubGlobal('fetch',fetcher);
  await runAssistantWorker(id,10);expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('waiting_input');await runAssistantWorker(id,10);expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(controlAssignment(owner,{operation:'assignment',id,threadId:thread,action:'resume'})).rejects.toThrow('Reply');
  await controlAssignment(owner,{operation:'assignment',id,threadId:thread,action:'resume',message:'Document onboarding for the test client.'});await runAssistantWorker(id,10);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).input.at(-1)).toEqual({role:'user',content:'Document onboarding for the test client.'});expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('completed');
 });
 it('pauses during a provider call, retains its response, and resumes without rebilling that request',async()=>{
  const {id,thread}=await turn();await saveChatBudget(owner,25);let finish!:(r:Response)=>void,start!:()=>void;const started=new Promise<void>(r=>{start=r;});
  const fetcher=vi.fn().mockImplementationOnce(()=>{start();return new Promise<Response>(r=>{finish=r;});}).mockResolvedValueOnce(Response.json(answer('Goal saved once.')));vi.stubGlobal('fetch',fetcher);
  const worker=runAssistantWorker(id,1);await started;await controlAssignment(owner,{operation:'assignment',id,threadId:thread,action:'pause'});finish(Response.json(call('use_business_tool',{name:'save_goal',arguments:'{"title":"Pause-safe goal"}'})));await worker;
  expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('paused');expect((await listGoals(owner)).total).toBe(0);
  await controlAssignment(owner,{operation:'assignment',id,threadId:thread,action:'resume'});await runAssistantWorker(id,10);expect(fetcher).toHaveBeenCalledTimes(2);expect((await listGoals(owner)).total).toBe(1);
 });
 it('serializes live workspace steps and gives the next employee a turn',async()=>{
  const {id}=await turn();await connectNative(other,'other-session','read',false);const q=await nativePrincipal(other,'other-session'),second=randomUUID();await beginChatTurn(q,randomUUID(),second,'Read my tasks');
  const claims=await Promise.all([claimAssignment(),claimAssignment()]);expect(claims.filter(Boolean)).toHaveLength(1);const first=claims.find(Boolean)!;
  expect([id,second]).toContain(first.id);await pool.query("UPDATE assistant_chat_turns SET lease_token=NULL,lease_until=NULL,status='queued' WHERE id=$1",[first.id]);
  expect((await claimAssignment())?.id).not.toBe(first.id);
 });
 it('rejects cyclic or unproven work plans and stops uncertain work from auto-resuming',async()=>{
  expect(workPlanSchema.safeParse({steps:[{id:'a',label:'Do work',status:'done',dependsOn:['a'],evidence:''}]}).success).toBe(false);
  const {id,thread}=await turn();await saveChatBudget(owner,25);await runAssistantWorker(id,1);expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('outcome_unknown');
  await expect(controlAssignment(owner,{operation:'assignment',id,threadId:thread,action:'resume'})).rejects.toThrow('receipts');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('continues beyond twelve steps without resetting its total ceiling and stops at thirty-six',async()=>{
  const {id,thread}=await turn();await saveChatBudget(owner,25);
  const steps=[{id:'review',label:'Review saved records',status:'working',dependsOn:[],evidence:''}];
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json(call('update_work_plan',{steps}))));
  await runAssistantWorker(id,30);expect((await pool.query('SELECT engine_state FROM assistant_chat_turns WHERE id=$1',[id])).rows[0].engine_state.step).toBe(15);
  await runAssistantWorker(id,60);const t=(await chatState(owner,'chat-session',thread)).turns[0];expect(t.status).toBe('blocked');expect(t.blocked_reason).toContain('36');expect(fetch).toHaveBeenCalledTimes(36);expect(t.max_cost_micros).toBe('1000000');
  await expect(controlAssignment(owner,{operation:'assignment',id,threadId:thread,action:'resume'})).rejects.toThrow('total step limit');
 });
 it('searches durable personal memory and old chats without crossing employee boundaries',async()=>{
  const {p,id}=await turn();const note=await saveMemory(p,{title:'Onboarding preference',body:'Devon handles document onboarding.'});
  expect((await searchMemories(p,'Devon')).items).toHaveLength(1);
  await connectNative(other,'other-session','direct',true);const q=await nativePrincipal(other,'other-session');
  expect((await searchMemories(q,'Devon')).items).toHaveLength(0);
  await expect(forgetMemory(q,note.id,note.revision)).rejects.toThrow();
  await pool.query("UPDATE assistant_chat_turns SET user_message='The archival pineapple preference',created_at=now()-interval '2 years' WHERE id=$1",[id]);
  expect((await searchChatHistory(p,'pineapple')).items).toHaveLength(1);expect((await searchChatHistory(q,'pineapple')).items).toHaveLength(0);
  await forgetMemory(p,note.id,note.revision);expect((await searchMemories(p,'Devon')).items).toHaveLength(0);
 });
 it('queues recurring work once, uses Eastern DST, and pauses revoked authorization',async()=>{
  await connectNative(owner,'chat-session','direct',true,{routines:true});const p=await nativePrincipal(owner,'chat-session');
  const r=await saveRoutine(p,{title:'Morning priorities',instruction:'Summarize my priorities',cadence:'weekdays',time:'09:00'});
  await pool.query("UPDATE assistant_routines SET next_run_at=now()-interval '1 day' WHERE id=$1",[r.id]);
  await Promise.all([enqueueDueRoutine(),enqueueDueRoutine()]);expect((await pool.query('SELECT id FROM assistant_chat_turns WHERE routine_id=$1',[r.id])).rowCount).toBe(1);
  expect((await nextRoutineTime(pool,'daily','09:00',1,new Date('2026-03-07T15:00:00Z'))).toISOString()).toBe('2026-03-08T13:00:00.000Z');
  expect((await nextRoutineTime(pool,'weekdays','09:00',1,new Date('2026-10-30T15:00:00Z'))).toISOString()).toBe('2026-11-02T14:00:00.000Z');
  await setRoutineEnabled(p,r.id,r.revision,false);
  expect((await pool.query('SELECT enabled FROM assistant_routines WHERE id=$1',[r.id])).rows[0].enabled).toBe(false);
  await pool.query("UPDATE assistant_routines SET enabled=true,next_run_at=now()-interval '1 day' WHERE id=$1",[r.id]);await manageConnection(owner,p.grantId,'revoke');await enqueueDueRoutine();
  expect((await pool.query('SELECT enabled,last_error FROM assistant_routines WHERE id=$1',[r.id])).rows[0]).toMatchObject({enabled:false,last_error:expect.stringContaining('Reconnect')});
 });
 it('requires opt-in for paid research and includes hosted tool costs in the shared allowance',async()=>{
  const {p,id}=await turn();await saveChatBudget(owner,25);
  await expect(requestChatResponse(p,id,1,{input:'test'},'web')).rejects.toThrow('Enable research');expect(fetch).not.toHaveBeenCalled();
  await connectNative(owner,'chat-session','direct',true,{research:true,sms:true,email:true,calls:true});const q=await nativePrincipal(owner,'chat-session');const next=randomUUID();await beginChatTurn(q,randomUUID(),next,'Research');
  expect(nativeCatalog(q).map(t=>t.name)).toEqual(expect.arrayContaining(['send_sms','send_email','call_customer']));
  expect(nativeCatalog(q).some(t=>t.name==='book_consultation')).toBe(false);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...answer(),output:[{type:'web_search_call'},...answer().output]})));
  await requestChatResponse(q,next,0,{input:'test'},'web');
  const cost=Number((await pool.query('SELECT amount_micros FROM assistant_chat_requests WHERE turn_id=$1',[next])).rows[0].amount_micros);expect(cost).toBe(10450);
  await requestChatResponse(q,next,0,{input:'test'},'web');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('isolates public research from chat context and preserves clickable source citations',async()=>{
  await connectNative(owner,'chat-session','direct',true,{research:true});const p=await nativePrincipal(owner,'chat-session');await saveChatBudget(owner,25);
  const research={...answer(),output:[{type:'web_search_call'},{type:'message',content:[{type:'output_text',text:'Public result',annotations:[{type:'url_citation',url:'https://example.test/report',title:'Source report'}]}]}]};
  const responses=[call('research_or_calculate',{kind:'web',question:'What is the public benchmark?'}),research,answer('Here is the benchmark.')];
  const fetcher=vi.fn().mockImplementation(async()=>Response.json(responses.shift()));vi.stubGlobal('fetch',fetcher);
  const thread=randomUUID();await runChatTurn(p,thread,randomUUID(),'Research the benchmark. Private internal note: private-fixture-value');
  const isolated=JSON.parse(fetcher.mock.calls[1][1].body);expect(isolated.tools).toEqual([{type:'web_search',return_token_budget:'default'}]);expect(isolated.max_tool_calls).toBe(1);expect(JSON.stringify(isolated)).not.toContain('private-fixture-value');
  const result=(await chatState(owner,'chat-session',thread)).turns[0];expect(result.status).toBe('completed');expect(result.assistant_message).toContain('[Source report](https://example.test/report)');
  expect(nativeCatalog({...p,scopes:['personal:read']}).some(t=>t.name==='search_chat_history'||t.name==='search_memories')).toBe(false);
 });
 it('atomically queues booking texts, suppresses superseded notices, and stops after revocation',async()=>{
  const number=randomUUID(),account='AC'+'1'.repeat(32),phone='+16785550100';
  for(const [key,value] of Object.entries({TWILIO_ACCOUNT_SID:account,TWILIO_AUTH_TOKEN:'synthetic-token-'.repeat(3),TWILIO_API_KEY_SID:'SK'+'2'.repeat(32),TWILIO_API_KEY_SECRET:'synthetic-key-'.repeat(3),TWILIO_PHONE_NUMBER:phone,TWILIO_SMS_ENABLED:'true'}))vi.stubEnv(key,value);
  await pool.query("INSERT INTO sms_numbers(id,workspace_id,account_sid,phone,provider_sid,status) VALUES($1,$2,$3,$4,$5,'active')",[number,ws,account,phone,'PN'+'1'.repeat(32)]);
  await pool.query('INSERT INTO sms_number_grants(workspace_id,number_id,user_id,can_send) VALUES($1,$2,$3,true)',[ws,number,owner.user.id]);
  await connectNative(owner,'chat-session','direct',true,{sms:true,notificationNumberId:number});const p=await nativePrincipal(owner,'chat-session');
  const lead=randomUUID();await pool.query("INSERT INTO leads(id,workspace_id,submission_id,fingerprint,source,status,name,organization,email,phone,description) VALUES($1,$2,$3,'notification-fixture','manual','new','Test customer','Example','notice@example.test','+16785550123','Requested consultation')",[lead,ws,lead]);
  const revision=(await pool.query('SELECT updated_at FROM leads WHERE id=$1',[lead])).rows[0].updated_at.toISOString();
  const slots=await availableSlots('austin',undefined,new Date(Date.now()+35*86400000).toISOString().slice(0,10));
  // A failure while creating the outbox must roll back the calendar mutation.
  await pool.query("INSERT INTO crm_channel_preferences(workspace_id,channel,normalized_address,status) VALUES($1,'sms','+16785550123','blocked')",[ws]);
  const {bookConsultation}=await import('@/lib/booking/staff');const {bookingNotificationHook}=await import('./booking-notifications');
  await expect(bookConsultation(owner,{leadId:lead,expectedLeadUpdatedAt:revision,profile:'austin',slotId:slots[0].id},false,await bookingNotificationHook(p))).rejects.toThrow('opted out');
  expect((await getCalendarEntry(owner,slots[0].id))?.status).toBe('open');expect((await pool.query('SELECT id FROM assistant_booking_notifications')).rowCount).toBe(0);
  await pool.query("DELETE FROM crm_channel_preferences WHERE workspace_id=$1 AND channel='sms' AND normalized_address='+16785550123'",[ws]);
  const id=randomUUID();await beginChatTurn(p,randomUUID(),id,'Book, reschedule and cancel test consultation');
  const result=await invokeNativeTool(p,id,'book_consultation_and_notify',JSON.stringify({leadId:lead,expectedLeadUpdatedAt:revision,profile:'austin',slotId:slots[0].id}));expect(result).toMatchObject({status:'succeeded',result:{notificationStatus:'queued',notificationSent:false}});
  expect(smsGateway.create).not.toHaveBeenCalled();
  smsGateway.create.mockImplementation(async(input)=>({sid:'SM'+randomUUID().replaceAll('-',''),status:'queued',accountSid:account,from:phone,to:input.to}));
  await runBookingNotificationWorker();await runBookingNotificationWorker();expect(smsGateway.create).toHaveBeenCalledTimes(1);
  const original=(await getCalendarEntry(owner,slots[0].id))!;
  await invokeNativeTool(p,id,'reschedule_consultation_and_notify',JSON.stringify({bookingId:original.id,expectedUpdatedAt:original.updatedAt,profile:'austin',slotId:slots[2].id}));
  const moved=(await getCalendarEntry(owner,slots[2].id))!;
  await invokeNativeTool(p,id,'cancel_consultation_and_notify',JSON.stringify({id:moved.id,expectedUpdatedAt:moved.updatedAt}));
  await runBookingNotificationWorker();expect(smsGateway.create).toHaveBeenCalledTimes(1); // moved notice is obsolete
  await runBookingNotificationWorker();expect(smsGateway.create).toHaveBeenCalledTimes(2);
  const cancelled=(await getCalendarEntry(owner,moved.id))!;
  await invokeNativeTool(p,id,'reschedule_consultation_and_notify',JSON.stringify({bookingId:cancelled.id,expectedUpdatedAt:cancelled.updatedAt,profile:'austin',slotId:slots[4].id}));
  await manageConnection(owner,p.grantId,'revoke');await runBookingNotificationWorker();expect(smsGateway.create).toHaveBeenCalledTimes(2);
  const rows=(await pool.query('SELECT status FROM assistant_booking_notifications ORDER BY created_at')).rows;expect(rows.map(r=>r.status)).toEqual(['accepted','failed','accepted','failed']);
  await pool.query('DELETE FROM leads WHERE id=$1',[lead]);expect((await pool.query('SELECT id FROM assistant_booking_notifications')).rowCount).toBe(0);
 });
 it('renders schemas for every permitted tool without replacing runtime validation',async()=>{
  const p=await connection();for(const t of nativeCatalog(p))expect(discoverNativeTools(p,t.name).tools.length).toBeGreaterThan(0);
 });
});
