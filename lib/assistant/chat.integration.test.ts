import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import type {Pool} from 'pg';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {connectNative,nativePrincipal,chatState,beginChatTurn,saveChatBudget,stopChatTurn,assertTurnActive,chatHistory} from './chat-store';
import {invokeNativeTool,nativeCatalog,discoverNativeTools} from './chat-tools';
import {runChatTurn} from './chat-runner';
import {requestChatResponse} from './chat-provider';
import {manageConnection,reviewAction} from './actions';
import {listGoals} from './goals';
const url=process.env.ASSISTANT_CHAT_TEST_DATABASE_URL;
const ws='00000000-0000-4000-8000-000000000001';
const owner={user:{id:'chat-owner',name:'Owner',email:'chat-owner@example.test'},workspace:{id:ws,name:'Tailored Agents',slug:'tailored-agents'},role:'owner' as const};
const other={...owner,user:{id:'chat-other',name:'Other',email:'chat-other@example.test'}};
let pool:Pool;
const answer=(text='Done.')=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],usage:{input_tokens:100,output_tokens:20}});
const call=(name:string,args:unknown)=>({...answer(),output:[{type:'function_call',call_id:randomUUID(),name,arguments:JSON.stringify(args)}]});
async function connection(mode:'read'|'review'|'direct'='direct',conversations=true){await connectNative(owner,'chat-session',mode,conversations);return nativePrincipal(owner,'chat-session');}
async function turn(){const p=await connection(),id=randomUUID(),thread=randomUUID();await beginChatTurn(p,thread,id,'Help with my work.');return{p,id,thread};}
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
  await pool.query('TRUNCATE assistant_chat_turns,assistant_chat_threads,assistant_chat_requests,assistant_chat_usage,assistant_chat_settings,assistant_actions,assistant_grants,assistant_goals,assistant_activity CASCADE');
  await pool.query("UPDATE workspace_memberships SET role='owner',status='active' WHERE user_id=ANY($1)",[[owner.user.id,other.user.id]]);
  await pool.query(`INSERT INTO "session"(id,"userId",token,"expiresAt") VALUES('chat-session',$1,'synthetic-chat-session',now()+interval '2 days'),('other-session',$2,'synthetic-other-session',now()+interval '2 days') ON CONFLICT(id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt"`,[owner.user.id,other.user.id]);
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Unexpected provider call in test')));
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
 it('expires interrupted turns without retrying and blocks model calls after stop',async()=>{
  const {p,id,thread}=await turn();await pool.query("UPDATE assistant_chat_turns SET deadline=now()-interval '1 second' WHERE id=$1",[id]);
  expect((await chatState(owner,'chat-session',thread)).turns[0].status).toBe('interrupted');
  await expect(requestChatResponse(p,id,0,{input:'test'})).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 });
 it('renders schemas for every permitted tool without replacing runtime validation',async()=>{
  const p=await connection();for(const t of nativeCatalog(p))expect(discoverNativeTools(p,t.name).tools.length).toBeGreaterThan(0);
 });
});
