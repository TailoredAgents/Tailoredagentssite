import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import type {Pool} from 'pg';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {connectNative,nativePrincipal,saveChatBudget} from './chat-store';
import {transcribeDictation,readDictation,discardDictation} from './dictation';
import {dictationWav} from './dictation-contract';
import type {Principal} from './oauth';
const url=process.env.ASSISTANT_DICTATION_TEST_DATABASE_URL,ws='00000000-0000-4000-8000-000000000001';let db:Pool,p:Principal,q:Principal;
const owner={user:{id:'dictation-owner',name:'Owner',email:'owner@example.test'},workspace:{id:ws,name:'Tailored Agents',slug:'tailored-agents'},role:'owner' as const},other={...owner,user:{id:'dictation-other',name:'Other',email:'other@example.test'}};
const wav=()=>dictationWav(new Float32Array(16000));
describe.skipIf(!url)('Private employee voice-note transcription',()=>{
 beforeAll(async()=>{
  const target=new URL(url!);if(!['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/ta_assistant_dictation_test')throw Error('Use the isolated dictation database.');
  vi.stubEnv('DATABASE_URL',url);vi.stubEnv('BETTER_AUTH_URL','http://localhost:3162');vi.stubEnv('DASHBOARD_AUTH_MODE','password');vi.stubEnv('DASHBOARD_ALLOWED_EMAILS','owner@example.test,other@example.test');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-dictation-secret-at-least32');
  db=getDatabasePool();await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');for(const f of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.query(await readFile('db/migrations/'+f,'utf8'));
  for(const c of [owner,other]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[c.user.id,c.user.name,c.user.email]);await db.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')",[randomUUID(),ws,c.user.id]);}
 },30000);
 beforeEach(async()=>{
  vi.stubEnv('OPERATIONS_ASSISTANT_ENABLED','true');vi.stubEnv('OPERATIONS_ASSISTANT_WRITES_ENABLED','true');vi.stubEnv('ASSISTANT_BACKGROUND_ENABLED','false');vi.stubEnv('ASSISTANT_CHAT_ENABLED','true');vi.stubEnv('ASSISTANT_DICTATION_ENABLED','true');vi.stubEnv('OPENAI_API_KEY','synthetic-never-sent');
  await db.query('TRUNCATE assistant_dictations,assistant_grants,assistant_chat_usage,assistant_chat_settings CASCADE');await db.query("UPDATE workspace_memberships SET status='active'");
  for(const c of [owner,other]){await db.query('INSERT INTO "session"(id,"userId",token,"expiresAt") VALUES($1,$2,$1,now()+interval \'1 day\') ON CONFLICT(id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt"',[c.user.id+'-session',c.user.id]);await connectNative(c,c.user.id+'-session','read',false);}
  p=await nativePrincipal(owner,owner.user.id+'-session');q=await nativePrincipal(other,other.user.id+'-session');await saveChatBudget(owner,25);vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json({text:'Ask Devon about discovery.',usage:{type:'duration',seconds:1}})));
 });
 afterAll(async()=>{await db?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('honors uncapped spending without losing dictation receipts or the pause switch',async()=>{
  await saveChatBudget(owner,0,true);const result=await transcribeDictation(p,randomUUID(),wav());expect(result.status).toBe('completed');expect(Number((await db.query('SELECT amount_micros FROM assistant_chat_usage')).rows[0].amount_micros)).toBeGreaterThan(0);
  await saveChatBudget(owner,0,false);await expect(transcribeDictation(p,randomUUID(),wav())).rejects.toThrow('allowance');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('transcribes once, settles the shared ledger, and keeps the preview separate from chat instructions',async()=>{
  const id=randomUUID(),result=await transcribeDictation(p,id,wav());expect(result).toMatchObject({status:'completed',transcript:'Ask Devon about discovery.',cost:.000075});expect((await transcribeDictation(p,id,wav())).transcript).toBe(result.transcript);expect(fetch).toHaveBeenCalledTimes(1);const body=vi.mocked(fetch).mock.calls[0][1]!.body as FormData;expect(body.get('model')).toBe('gpt-transcribe');expect((await db.query('SELECT amount_micros FROM assistant_chat_usage')).rows[0].amount_micros).toBe('75');expect((await db.query('SELECT id FROM assistant_chat_turns')).rowCount).toBe(0);expect((await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='assistant_dictations'")).rows.some(r=>r.column_name==='audio')).toBe(false);
 });
 it('keeps uncertain charges reserved and never retransmits the same recording',async()=>{
  vi.mocked(fetch).mockRejectedValueOnce(Error('timeout'));const id=randomUUID();expect((await transcribeDictation(p,id,wav())).status).toBe('unknown');expect((await transcribeDictation(p,id,wav())).status).toBe('unknown');expect(fetch).toHaveBeenCalledTimes(1);expect((await db.query('SELECT amount_micros FROM assistant_chat_usage')).rows[0].amount_micros).toBe('50000');await expect(transcribeDictation(p,id,dictationWav(new Float32Array(32000)))).rejects.toThrow('another recording');
 });
 it('isolates employees, discards previews, and retains only the usage receipt',async()=>{
  const id=randomUUID();await transcribeDictation(p,id,wav());await expect(readDictation(q,id)).rejects.toThrow('expired');await discardDictation(p,id);await expect(readDictation(p,id)).rejects.toThrow('discarded');await expect(transcribeDictation(p,id,wav())).rejects.toThrow('discarded');expect(fetch).toHaveBeenCalledTimes(1);expect((await db.query('SELECT transcript,amount_micros FROM assistant_dictations WHERE id=$1',[id])).rows[0]).toMatchObject({transcript:null,amount_micros:'75'});
 });
 it('reserves against the same monthly allowance under concurrent employees',async()=>{
  await db.query("INSERT INTO assistant_chat_usage(workspace_id,month,amount_micros) VALUES($1,(date_trunc('month',now() AT TIME ZONE 'America/New_York'))::date,24940000)",[ws]);let release!:()=>void;const held=new Promise<void>(r=>{release=r;});vi.mocked(fetch).mockImplementationOnce(async()=>{await held;return Response.json({text:'Preview'});});const first=transcribeDictation(p,randomUUID(),wav());await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));await expect(transcribeDictation(q,randomUUID(),wav())).rejects.toThrow('monthly allowance');release();await first;expect(fetch).toHaveBeenCalledTimes(1);expect(Number((await db.query('SELECT amount_micros FROM assistant_chat_usage')).rows[0].amount_micros)).toBeLessThanOrEqual(25000000);
 });
 it('rejects long audio, disabled features, exhausted budgets and revoked accounts before charging',async()=>{
  await expect(transcribeDictation(p,randomUUID(),new Uint8Array(4000000))).rejects.toThrow();await saveChatBudget(owner,0);await expect(transcribeDictation(p,randomUUID(),wav())).rejects.toThrow('allowance');await saveChatBudget(owner,25);vi.stubEnv('ASSISTANT_DICTATION_ENABLED','false');await expect(transcribeDictation(p,randomUUID(),wav())).rejects.toThrow('unavailable');vi.stubEnv('ASSISTANT_DICTATION_ENABLED','true');await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[owner.user.id]);await expect(transcribeDictation(p,randomUUID(),wav())).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 });
 it('does not restore a discarded preview when the pending provider response arrives',async()=>{
  let release!:()=>void;const held=new Promise<void>(r=>{release=r;});vi.mocked(fetch).mockImplementationOnce(async()=>{await held;return Response.json({text:'Private pending words'});});const id=randomUUID(),pending=transcribeDictation(p,id,wav());await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));await discardDictation(p,id);release();await expect(pending).rejects.toThrow('discarded');expect((await db.query('SELECT transcript,status FROM assistant_dictations WHERE id=$1',[id])).rows[0]).toEqual({transcript:null,status:'completed'});
 });
});
