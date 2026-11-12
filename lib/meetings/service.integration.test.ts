import {randomUUID,createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import * as service from './service';
import {getMeeting} from './access';
import {pcmWav} from './audio';
import {createMeetingDevice,armMeetingDevice,receiveOmi,revokeMeetingDevice,nextOmiConversation} from './omi';
import {runMeetingWorker,reserveMeetingStep} from './worker';
import {saveDiscovery,readRelationship,addIntroduction,setAccountManager} from '@/lib/relationships/service';
import {createManualLead} from '@/lib/operations/manual-leads';
import {linkInquiry,convertOpportunity} from '@/lib/sales/service';
const fixture=vi.hoisted(()=>({objects:new Map<string,Uint8Array>(),context:null as DashboardContext|null,transcribe:vi.fn(),analyze:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/dashboard/data',()=>({getOptionalDashboardContext:async()=>fixture.context,requireDashboardContext:async()=>fixture.context}));
vi.mock('next/server',()=>({after:vi.fn()}));
vi.mock('@/lib/factory/storage',()=>({factoryStorage:()=>({put:async(k:string,b:Uint8Array)=>{fixture.objects.set(k,b);},get:async(k:string)=>{const b=fixture.objects.get(k);if(!b)throw new Error('missing');return b;},deletePrefix:async(p:string)=>{for(const k of fixture.objects.keys())if(k.startsWith(p))fixture.objects.delete(k);}})}));
vi.mock('./provider',()=>({transcribeMeeting:fixture.transcribe,analyzeMeeting:fixture.analyze}));
import {GET,POST} from '@/app/api/meetings/route';
import {POST as omiPost} from '@/app/api/integrations/omi/audio/route';
import {GET as audioGet} from '@/app/api/meetings/[id]/audio/route';
const url=process.env.TEST_MEETINGS_DATABASE_URL;
const ws='00000000-0000-4000-8000-000000000001',otherWs='a07b7fd3-886e-432a-8abb-16d06180a889';
function context(id='meeting-owner',workspace=ws,role:DashboardContext['role']='owner'):DashboardContext{return {user:{id,name:id==='meeting-owner'?'Austin (synthetic)':id==='meeting-member'?'Jeffrey (synthetic)':id,email:id+'@example.test'},workspace:{id:workspace,name:'Meeting fixture',slug:'fixture'},role};}
const owner=context(),member=context('meeting-member',ws,'member'),viewer=context('meeting-viewer',ws,'viewer'),other=context('meeting-other',otherWs);
let db:ReturnType<typeof getDatabasePool>;
const wav=pcmWav(Buffer.alloc(32000,1),16000);
async function upload(c=owner,bytes=wav){const r=await service.startUpload(c,{id:randomUUID(),title:'Synthetic discovery meeting',size:bytes.length,hash:service.digest(bytes),consentNote:'Synthetic test recording; no real participants.',retentionDays:30});if(r.status!=='uploading')return r.id;for(let offset=0,i=0;offset<bytes.length;offset+=1_000_000,i++)await service.uploadChunk(c,r.id,i,bytes.subarray(offset,offset+1_000_000));await service.finishUpload(c,r.id);return r.id;}
describe.skipIf(!url)('Meeting Intelligence with isolated PostgreSQL',()=>{
 beforeAll(async()=>{const u=new URL(url!);if(!['localhost','127.0.0.1'].includes(u.hostname)||u.pathname!=='/ta_meetings_test'||u.search||u.hash)throw new Error('Only the local ta_meetings_test database is allowed.');vi.stubEnv('DATABASE_URL',url!);vi.stubEnv('BETTER_AUTH_URL','http://localhost:3100');vi.stubEnv('BETTER_AUTH_SECRET','test-private-secret-'.repeat(3));vi.stubEnv('NODE_ENV','test');vi.stubEnv('OPENAI_API_KEY','synthetic-not-a-real-key');db=getDatabasePool();expect((await db.query('SELECT current_database() name')).rows[0].name).toBe('ta_meetings_test');await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY,applied_at timestamptz DEFAULT now())');for(const f of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort()){if((await db.query('SELECT 1 FROM schema_migrations WHERE filename=$1',[f])).rowCount)continue;await db.query(await readFile('db/migrations/'+f,'utf8'));await db.query('INSERT INTO schema_migrations(filename) VALUES($1)',[f]);}},30000);
 beforeEach(async()=>{await db.query('TRUNCATE meeting_usage,"user",leads,crm_businesses,clients,contacts,crm_opportunities,audit_logs CASCADE');await db.query('INSERT INTO workspaces(id,slug,name,kind,status) VALUES($1,\'meeting-other\',\'Other\',\'internal\',\'active\') ON CONFLICT(id) DO NOTHING',[otherWs]);for(const c of [owner,member,viewer,other]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[c.user.id,c.user.name,c.user.email]);await db.query('INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,$4,\'active\')',[randomUUID(),c.workspace.id,c.user.id,c.role]);}fixture.objects.clear();fixture.context=owner;fixture.transcribe.mockReset().mockResolvedValue('We use Excel. We spend five hours retyping orders.');fixture.analyze.mockReset().mockResolvedValue({summary:'Orders are entered manually.',findings:[{category:'tool',detail:'Uses Excel',evidence:'We use Excel.',basis:'stated'}]});});
 afterAll(async()=>{await db?.end();delete (globalThis as {tailoredAgentsDatabasePool?:unknown}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();});
 it('uploads, listens, deduplicates and does not create a prospect automatically',async()=>{const id=await upload();expect((await getMeeting(owner,id)).status).toBe('ready');expect(await upload()).toBe(id);expect((await db.query('SELECT id FROM leads')).rowCount).toBe(0);expect((await service.readAudio(owner,id)).bytes).toEqual(wav);});
 it('resumes chunk uploads and refuses conflicting retries',async()=>{const bytes=pcmWav(Buffer.alloc(1_100_000,2),16000),r=await service.startUpload(owner,{id:randomUUID(),title:'Resume',size:bytes.length,hash:service.digest(bytes),consentNote:'Fixture permission'});await service.uploadChunk(owner,r.id,0,bytes.subarray(0,1_000_000));await service.uploadChunk(owner,r.id,0,bytes.subarray(0,1_000_000));await expect(service.uploadChunk(owner,r.id,0,Buffer.alloc(1_000_000))).rejects.toThrow('different chunk');await expect(service.finishUpload(owner,r.id)).rejects.toThrow('incomplete');await service.uploadChunk(owner,r.id,1,bytes.subarray(1_000_000));await service.finishUpload(owner,r.id);expect((await getMeeting(owner,r.id)).received_bytes).toBe(bytes.length);});
 it('denies another user and another workspace even with guessed meeting IDs',async()=>{const id=await upload();await expect(getMeeting(member,id)).rejects.toThrow('unavailable');await expect(service.readAudio(other,id)).rejects.toThrow('unavailable');expect((await service.listMeetings(member)).items).toHaveLength(0);expect((await service.listMeetings(other)).items).toHaveLength(0);});
 it('shares only through an owner action; viewers can read shared audio but cannot mutate',async()=>{const id=await upload(),m=await getMeeting(owner,id);await service.updateMeeting(owner,{id,revision:m.revision,title:m.title,visibility:'team',classification:'unmatched',notes:'Reviewed',retentionDays:30});expect((await getMeeting(viewer,id)).review_notes).toBe('Reviewed');await expect(service.deleteMeeting(viewer,id,true)).rejects.toThrow();await expect(service.updateMeeting(member,{id,revision:m.revision,title:'Changed',visibility:'team',classification:'unmatched',notes:'',retentionDays:30})).rejects.toThrow('unavailable');});
 it('denies revoked membership despite an old context',async()=>{const id=await upload();await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[owner.user.id]);await expect(getMeeting(owner,id)).rejects.toThrow();await expect(service.uploadChunk(owner,id,0,wav)).rejects.toThrow();});
 it('does not process without a budget and retains recording',async()=>{const id=await upload();await service.queueMeeting(owner,id,'Synthetic consent');await runMeetingWorker(id);expect((await getMeeting(owner,id)).error_code).toBe('allowance');expect(fixture.transcribe).not.toHaveBeenCalled();});
 it('processes durable stages exactly once with bounded reservations',async()=>{const id=await upload();await service.saveMeetingBudget(owner,10);await service.queueMeeting(owner,id,'Synthetic consent');await Promise.all([runMeetingWorker(id),runMeetingWorker(id)]);expect(fixture.transcribe).toHaveBeenCalledTimes(1);await runMeetingWorker(id);expect(fixture.analyze).toHaveBeenCalledTimes(1);expect((await getMeeting(owner,id)).status).toBe('review');expect((await service.meetingSettings(owner)).reserved).toBe(.256);await runMeetingWorker(id);expect(fixture.analyze).toHaveBeenCalledTimes(1);});
 it('preserves analysis diagnostics and charges, then reuses the transcript only on explicit retry',async()=>{
 const id=await upload();await service.saveMeetingBudget(owner,10);await service.queueMeeting(owner,id,'Synthetic consent');await runMeetingWorker(id);
 fixture.analyze.mockRejectedValueOnce(new Error('analysis_evidence'));expect(await runMeetingWorker(id)).toMatchObject({failed:1});
 const failed=await getMeeting(owner,id);expect(failed).toMatchObject({status:'failed',error_code:'analysis_evidence',findings:null});expect(failed.transcript).toContain('We use Excel.');
 expect((await service.meetingSettings(owner)).reserved).toBe(.256);await runMeetingWorker(id);expect(fixture.analyze).toHaveBeenCalledTimes(1);
 await service.queueMeeting(owner,id,'Synthetic consent');await runMeetingWorker(id);expect((await getMeeting(owner,id)).status).toBe('review');
 expect(fixture.transcribe).toHaveBeenCalledTimes(1);expect(fixture.analyze).toHaveBeenCalledTimes(2);expect((await service.meetingSettings(owner)).reserved).toBe(.506);
 await expect(getMeeting(member,id)).rejects.toThrow('unavailable');
 });
 it('retains uncertain provider charges and never retries automatically',async()=>{const id=await upload();await service.saveMeetingBudget(owner,1);fixture.transcribe.mockRejectedValueOnce(new Error('network lost'));await service.queueMeeting(owner,id,'Synthetic consent');await runMeetingWorker(id);await runMeetingWorker(id);expect(fixture.transcribe).toHaveBeenCalledTimes(1);expect((await service.meetingSettings(owner)).reserved).toBe(.006);await service.queueMeeting(owner,id,'Synthetic consent');await runMeetingWorker(id);expect((await service.meetingSettings(owner)).reserved).toBe(.012);});
 it('serializes spending so parallel meetings cannot exceed the allowance',async()=>{const a=await upload(),b=await upload(owner,pcmWav(Buffer.alloc(64000,3),16000));await service.saveMeetingBudget(owner,1);await db.query('UPDATE meeting_settings SET monthly_limit_micros=6000 WHERE workspace_id=$1',[ws]);await service.queueMeeting(owner,a,'Fixture consent');await service.queueMeeting(owner,b,'Fixture consent');const jobs=await Promise.all([reserveMeetingStep(a),reserveMeetingStep(b)]);expect(jobs.filter(Boolean)).toHaveLength(1);expect((await service.meetingSettings(owner)).reserved).toBe(.006);});
 it('requires deletion confirmation and prevents stale worker resurrection',async()=>{const id=await upload();await service.saveMeetingBudget(owner,1);await service.queueMeeting(owner,id,'Fixture consent');fixture.transcribe.mockImplementationOnce(async()=>{await service.deleteMeeting(owner,id,true);return 'Private text';});await runMeetingWorker(id);await expect(getMeeting(owner,id)).rejects.toThrow();expect((await db.query('SELECT transcript FROM meetings WHERE id=$1',[id])).rows[0].transcript).toBeNull();await runMeetingWorker();expect(fixture.objects.size).toBe(0);});
 it('expires audio, chunks, transcript and findings through maintenance',async()=>{const id=await upload();await expect(service.deleteMeeting(owner,id,false)).rejects.toThrow('Confirm');await db.query("UPDATE meetings SET expires_at=now()-interval '1 second',transcript='private' WHERE id=$1",[id]);await expect(getMeeting(owner,id)).rejects.toThrow();await runMeetingWorker();expect((await db.query('SELECT status,transcript,audio_key FROM meetings WHERE id=$1',[id])).rows[0]).toEqual({status:'deleted',transcript:null,audio_key:null});});
 it('supports a deliberately created sparse prospect without a fake email or automatic SMS',async()=>{const id=await upload();const v={id,name:'Meeting visitor',organization:'',email:'',phone:'',confirmed:true};const a=await service.createMeetingProspect(owner,v);expect(await service.createMeetingProspect(owner,v)).toEqual(a);expect((await db.query('SELECT email,phone,source,owner_user_id FROM leads WHERE id=$1',[a.id])).rows[0]).toEqual({email:null,phone:null,source:'manual',owner_user_id:owner.user.id});});
 it('rejects duplicate prospects and cross-workspace links',async()=>{const id=await upload();const {leadId}=await createManualLead(owner,{submissionId:randomUUID(),name:'Known person',phone:'7705550149'});await expect(service.createMeetingProspect(owner,{id,name:'Known person',organization:'',email:'',phone:'',confirmed:true})).rejects.toThrow('already matches');const {leadId:foreign}=await createManualLead(other,{submissionId:randomUUID(),name:'Other',phone:'7705550150'});await expect(service.linkMeeting(owner,id,'lead',foreign)).rejects.toThrow();await service.linkMeeting(owner,id,'lead',leadId);expect((await getMeeting(owner,id)).lead_id).toBe(leadId);});
 it('rejects stale edits and lets the owner unlink a meeting without deleting CRM records',async()=>{const id=await upload(),m=await getMeeting(owner,id);const {leadId}=await createManualLead(owner,{submissionId:randomUUID(),name:'Linked visitor',phone:'7705550193'});await service.linkMeeting(owner,id,'lead',leadId);await expect(service.updateMeeting(owner,{id,revision:m.revision,title:'Stale',visibility:'private',classification:'linked',notes:'',retentionDays:30})).rejects.toThrow('changed');await expect(service.unlinkMeeting(member,id,'lead')).rejects.toThrow();await service.unlinkMeeting(owner,id,'lead');expect((await getMeeting(owner,id)).classification).toBe('unmatched');expect((await db.query('SELECT id FROM leads WHERE id=$1',[leadId])).rowCount).toBe(1);});
 it('does not redirect a repeated upload to an expired inaccessible record',async()=>{const id=await upload();await db.query("UPDATE meetings SET expires_at=now()-interval '1 second' WHERE id=$1",[id]);await expect(upload()).rejects.toThrow('expired');await runMeetingWorker();expect(await upload()).not.toBe(id);});
 it('keeps discovery and referral attribution through conversion and owner reassignment',async()=>{const {leadId}=await createManualLead(owner,{submissionId:randomUUID(),name:'Morgan Example',organization:'Fixture company',email:'morgan@example.test'}),target={kind:'lead' as const,id:leadId};await saveDiscovery(owner,{...target,fields:{problems:'Retyping invoices',software:'Excel',opportunities:'Explore a document agent'}});await addIntroduction(owner,{...target,partnerId:'',name:'Referral partner',organization:'Network',note:'Introduced at a meetup'});const opportunity=await linkInquiry(owner,leadId);const converted=await convertOpportunity(owner,{opportunityId:opportunity,projectName:'Document automation',createSite:false});const clientId=(await db.query('SELECT client_id FROM crm_opportunities WHERE id=$1',[opportunity])).rows[0].client_id;expect(converted).toBeTruthy();await db.query('UPDATE crm_opportunities SET owner_user_id=$2 WHERE id=$1',[opportunity,member.user.id]);await setAccountManager(owner,{clientId,userId:member.user.id});const record=await readRelationship(owner,{kind:'client',id:clientId});expect(record.notes[0].fields.problems).toBe('Retyping invoices');expect(record.introductions[0].name).toBe('Referral partner');expect((await db.query('SELECT account_manager_user_id FROM clients WHERE id=$1',[clientId])).rows[0].account_manager_user_id).toBe(member.user.id);});
 it('authenticates Omi mapping, capture windows, UID, format, revocation and replay handling',async()=>{const d=await createMeetingDevice(owner,{label:'Fixture Omi',uid:'omi_fixture'});expect(await receiveOmi(d.secret,'omi_fixture',16000,Buffer.alloc(32000,1))).toMatchObject({discarded:true});await armMeetingDevice(owner,{id:d.id,minutes:60,consentNote:'Synthetic participants only',autoProcess:false});await expect(receiveOmi('x'.repeat(43),'omi_fixture',16000,Buffer.alloc(32000))).rejects.toThrow('Unauthorized');await expect(receiveOmi(d.secret,'other',16000,Buffer.alloc(32000))).rejects.toThrow('Unauthorized');expect(await receiveOmi(d.secret,'omi_fixture',16000,Buffer.alloc(32000,1))).toMatchObject({accepted:true,duplicate:false});expect(await receiveOmi(d.secret,'omi_fixture',16000,Buffer.alloc(32000,1))).toMatchObject({duplicate:true});const m=(await service.listMeetings(owner)).items[0];await service.finishUpload(owner,m.id);expect((await service.readAudio(owner,m.id)).mime).toBe('audio/wav');await expect(getMeeting(member,m.id)).rejects.toThrow();await armMeetingDevice(owner,{id:d.id,minutes:0,consentNote:'',autoProcess:false});expect(await receiveOmi(d.secret,'omi_fixture',16000,Buffer.alloc(32000))).toMatchObject({discarded:true});await revokeMeetingDevice(owner,d.id);await expect(receiveOmi(d.secret,'omi_fixture',16000,Buffer.alloc(32000))).rejects.toThrow('Unauthorized');});
 it('denies unauthenticated routes and wrong-origin writes; audio supports authenticated ranges',async()=>{const id=await upload();fixture.context=null;expect((await GET(new Request('http://localhost:3100/api/meetings'))).status).toBe(401);expect((await audioGet(new Request('http://localhost:3100/audio'),{params:Promise.resolve({id})})).status).toBe(401);fixture.context=owner;const bad=await POST(new Request('http://localhost:3100/api/meetings',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({operation:'delete',id,confirmed:true})}));expect(bad.status).toBe(403);const range=await audioGet(new Request('http://localhost:3100/audio',{headers:{range:'bytes=0-43'}}),{params:Promise.resolve({id})});expect(range.status).toBe(206);expect((await range.arrayBuffer()).byteLength).toBe(44);expect(range.headers.get('cache-control')).toContain('no-store');});
 it.each([8000,16000])('keeps a 90-minute %i Hz meeting in one ordered private review',async(rate)=>{
 const c=rate===8000?member:owner,otherPerson=rate===8000?owner:member;
 const d=await createMeetingDevice(c,{label:c.user.name+' Omi',uid:'long_'+rate});
 await armMeetingDevice(c,{id:d.id,minutes:120,consentNote:'Synthetic long meeting',autoProcess:true});
 const incoming=createHash('sha256');
 for(let minute=0;minute<90;minute++){const bytes=Buffer.alloc(rate*2*60,minute+1);incoming.update(bytes);await receiveOmi(d.secret,'long_'+rate,rate,bytes);}
 const list=await service.listMeetings(c);expect(list.items).toHaveLength(1);const id=list.items[0].id;
 expect((await getMeeting(c,id)).parts).toHaveLength(rate===16000?9:5);
 expect((await getMeeting(c,id)).receiving).toBe(true);
 await service.saveMeetingBudget(owner,10);await runMeetingWorker(id);expect(fixture.transcribe).not.toHaveBeenCalled();
 await expect(getMeeting(otherPerson,id)).rejects.toThrow('unavailable');
 await service.finishUpload(c,id);
 const m=await getMeeting(c,id),saved=createHash('sha256');
 expect(m.total_seconds).toBe(5400);expect(m.processing_estimate).toBe(.79);
 for(const p of m.parts){saved.update((await service.readAudio(c,id,p.id)).bytes.subarray(44));if(p.id!==id)await expect(getMeeting(c,p.id)).rejects.toThrow('unavailable');}
 expect(saved.digest('hex')).toBe(incoming.digest('hex'));
 fixture.transcribe.mockImplementation(async()=>`Part ${fixture.transcribe.mock.calls.length}: We use Excel.`);
 for(let i=0;i<m.parts.length+2;i++)await runMeetingWorker(id);
 const finished=await getMeeting(c,id);expect(finished.status).toBe('review');expect(finished.transcript).toContain(`Part ${m.parts.length}: We use Excel.`);
 expect(fixture.transcribe).toHaveBeenCalledTimes(m.parts.length);expect(fixture.analyze).toHaveBeenCalledTimes(1);expect((await service.meetingSettings(c)).reserved).toBe(.79);
 expect((await service.listMeetings(c)).items).toHaveLength(1);
 },60000);
 it('flags interruptions and sample-rate changes without creating extra meetings',async()=>{
 const d=await createMeetingDevice(owner,{label:'Austin gaps',uid:'gaps'});await armMeetingDevice(owner,{id:d.id,minutes:120,consentNote:'Synthetic gaps',autoProcess:false});
 await receiveOmi(d.secret,'gaps',16000,Buffer.alloc(32000,1));const id=(await service.listMeetings(owner)).items[0].id;
 await db.query("UPDATE meetings SET last_audio_at=now()-interval '5 minutes' WHERE id=$1",[id]);
 await receiveOmi(d.secret,'gaps',16000,Buffer.alloc(32000,2));await receiveOmi(d.secret,'gaps',8000,Buffer.alloc(16000,3));
 await service.finishUpload(owner,id);const m=await getMeeting(owner,id);expect(m.parts).toHaveLength(3);expect(m.parts[1].gap_before_seconds).toBeGreaterThan(290);expect(m.parts[2].boundary_reason).toBe('sample_rate');expect(m.total_seconds).toBe(3);
 });
 it('acknowledges paused valid HTTP deliveries without persisting audio or delivery metadata',async()=>{
 const d=await createMeetingDevice(owner,{label:'Paused fixture',uid:'paused'}),endpoint=`http://localhost:3100/api/integrations/omi/audio?token=${d.secret}&uid=paused&sample_rate=16000`;
 const post=(target=endpoint,bytes=Buffer.alloc(32000,1),type='application/octet-stream')=>omiPost(new Request(target,{method:'POST',headers:{'content-type':type},body:new Uint8Array(bytes)}));
 for(let i=0;i<4;i++){const r=await post();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({accepted:false,discarded:true,reason:'receiving_paused'});}
 expect((await db.query('SELECT id FROM meetings')).rowCount).toBe(0);expect((await db.query('SELECT * FROM meeting_upload_chunks')).rowCount).toBe(0);expect(fixture.objects.size).toBe(0);expect((await db.query('SELECT last_received_at,last_chunk_hash FROM meeting_devices WHERE id=$1',[d.id])).rows[0]).toEqual({last_received_at:null,last_chunk_hash:null});
 expect((await post(endpoint.replace('uid=paused','uid=not-this-person'))).status).toBe(401);
 expect((await post(endpoint.replace('sample_rate=16000','sample_rate=44100'))).status).toBe(400);
 expect((await post(endpoint,Buffer.alloc(3))).status).toBe(400);expect((await post(endpoint,Buffer.alloc(0))).status).toBe(400);expect((await post(endpoint,Buffer.alloc(32000),'application/json')).status).toBe(415);
 expect((await post(endpoint,Buffer.alloc(1_920_002))).status).toBe(413);
 await armMeetingDevice(owner,{id:d.id,minutes:30,consentNote:'Synthetic permission',autoProcess:false});await db.query("UPDATE meeting_devices SET armed_until=now()-interval '1 second' WHERE id=$1",[d.id]);expect((await post()).status).toBe(200);expect((await db.query('SELECT id FROM meetings')).rowCount).toBe(0);
 await revokeMeetingDevice(owner,d.id);expect((await post()).status).toBe(401);
 });
 it('rejects revoked membership and unauthorized device changes despite stale sessions',async()=>{
 const d=await createMeetingDevice(owner,{label:'Access fixture',uid:'access'});
 await expect(armMeetingDevice(member,{id:d.id,minutes:30,consentNote:'Permission',autoProcess:true})).rejects.toThrow('unavailable');
 await expect(nextOmiConversation(member,d.id)).rejects.toThrow();await armMeetingDevice(owner,{id:d.id,minutes:30,consentNote:'Permission',autoProcess:true});
 await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[owner.user.id]);
 await expect(receiveOmi(d.secret,'access',16000,Buffer.alloc(32000,1))).rejects.toThrow('Unauthorized');expect((await db.query('SELECT id FROM meetings')).rowCount).toBe(0);
 });
 it('deduplicates concurrent immediate retries, retains silence and resumes after pausing in a new meeting',async()=>{
 const d=await createMeetingDevice(owner,{label:'Retries fixture',uid:'retry'});const arm=(minutes:number)=>armMeetingDevice(owner,{id:d.id,minutes,consentNote:'Synthetic permission',autoProcess:false});await arm(60);
 const result=await Promise.all([receiveOmi(d.secret,'retry',16000,Buffer.alloc(32000,1)),receiveOmi(d.secret,'retry',16000,Buffer.alloc(32000,1))]);expect(result.filter(r=>'duplicate' in r&&r.duplicate)).toHaveLength(1);
 const first=(await service.listMeetings(owner)).items[0].id;await service.finishRecording(owner,first);
 expect(await receiveOmi(d.secret,'retry',16000,Buffer.alloc(32000,1))).toMatchObject({duplicate:true});
 await receiveOmi(d.secret,'retry',16000,Buffer.alloc(32000));await receiveOmi(d.secret,'retry',16000,Buffer.alloc(32000));
 expect((await getMeeting(owner,first)).parts).toHaveLength(2);expect((await getMeeting(owner,first)).parts[1].received_bytes).toBe(64000);
 await arm(0);expect(await receiveOmi(d.secret,'retry',16000,Buffer.alloc(32000,2))).toMatchObject({discarded:true});await arm(60);await receiveOmi(d.secret,'retry',16000,Buffer.alloc(32000,2));expect((await service.listMeetings(owner)).items).toHaveLength(2);
 });
 it('starts separate networking conversations without changing the hardware or receiving deadline',async()=>{
 const d=await createMeetingDevice(member,{label:'Jeffrey networking',uid:'network'});await armMeetingDevice(member,{id:d.id,minutes:120,consentNote:'Synthetic networking event',autoProcess:false});const until=(await db.query('SELECT armed_until FROM meeting_devices WHERE id=$1',[d.id])).rows[0].armed_until;
 for(let i=0;i<5;i++){if(i)await nextOmiConversation(member,d.id);await receiveOmi(d.secret,'network',8000,Buffer.alloc(16000,i+1));}
 expect((await service.listMeetings(member)).items).toHaveLength(5);expect((await service.listMeetings(owner)).items).toHaveLength(0);expect((await db.query('SELECT armed_until FROM meeting_devices WHERE id=$1',[d.id])).rows[0].armed_until).toEqual(until);
 });
 it('separates saved recordings privately, reuses transcripts and keeps the correct prospect on each meeting',async()=>{
 const d=await createMeetingDevice(owner,{label:'Split fixture',uid:'split'});await armMeetingDevice(owner,{id:d.id,minutes:60,consentNote:'Synthetic permission',autoProcess:false});
 await receiveOmi(d.secret,'split',16000,Buffer.alloc(32000,1));await receiveOmi(d.secret,'split',8000,Buffer.alloc(16000,2));await receiveOmi(d.secret,'split',16000,Buffer.alloc(32000,3));
 const id=(await service.listMeetings(owner)).items[0].id;await service.finishUpload(owner,id);await service.saveMeetingBudget(owner,10);await service.queueMeeting(owner,id,'Synthetic permission');for(let i=0;i<4;i++)await runMeetingWorker(id);
 let m=await getMeeting(owner,id);const part=m.parts[1],original=await service.readAudio(owner,id,part.id);
 const first=await service.createMeetingProspect(owner,{id,name:'First owner',organization:'',email:'',phone:'',confirmed:true});m=await getMeeting(owner,id);
 await service.updateMeeting(owner,{id,revision:m.revision,title:m.title,visibility:'team',classification:'linked',notes:'Original owner only',retentionDays:30});m=await getMeeting(owner,id);
 expect((await service.readAudio(member,id,part.id)).bytes).toEqual(original.bytes);
 await expect(service.separateMeeting(member,{id,partId:part.id,revision:m.revision,title:'Wrong owner'})).rejects.toThrow('unavailable');
 await expect(service.separateMeeting(owner,{id,partId:part.id,revision:m.revision-1,title:'Stale'})).rejects.toThrow('changed');
 const result=await service.separateMeeting(owner,{id,partId:part.id,revision:m.revision,title:'Second business owner'});
 expect(result.id).toBe(part.id);const next=await getMeeting(owner,result.id);expect(next.parts).toHaveLength(2);expect(next.visibility).toBe('private');expect(next.lead_id).toBeNull();expect(next.findings).toBeNull();expect(next.processing_estimate).toBe(.25);
 expect((await getMeeting(owner,id)).lead_id).toBe(first.id);await expect(service.readAudio(member,id,part.id)).rejects.toThrow('unavailable');await expect(service.readAudio(member,result.id)).rejects.toThrow('unavailable');expect((await service.readAudio(owner,result.id)).bytes).toEqual(original.bytes);
 await service.createMeetingProspect(owner,{id:result.id,name:'Second owner',organization:'',email:'',phone:'',confirmed:true});await service.queueMeeting(owner,result.id,'Synthetic permission');await runMeetingWorker(result.id);expect(fixture.transcribe).toHaveBeenCalledTimes(3);expect(fixture.analyze).toHaveBeenCalledTimes(2);
 await service.deleteMeeting(owner,id,true);for(let i=0;i<4;i++)await runMeetingWorker();expect((await service.readAudio(owner,result.id)).bytes).toEqual(original.bytes);
 });
 it('retains full oversized combined transcripts and stops before charging for an analysis it cannot perform',async()=>{
 const d=await createMeetingDevice(owner,{label:'Length fixture',uid:'length'});await armMeetingDevice(owner,{id:d.id,minutes:60,consentNote:'Synthetic permission',autoProcess:false});await receiveOmi(d.secret,'length',16000,Buffer.alloc(32000,1));await receiveOmi(d.secret,'length',8000,Buffer.alloc(16000,2));const id=(await service.listMeetings(owner)).items[0].id;await service.finishUpload(owner,id);await db.query("UPDATE meetings SET part_transcript=repeat('x',100000) WHERE id=$1 OR parent_meeting_id=$1",[id]);await service.saveMeetingBudget(owner,10);await service.queueMeeting(owner,id,'Synthetic permission');await runMeetingWorker(id);const m=await getMeeting(owner,id);expect(m.error_code).toBe('transcript_too_long');expect(m.transcript!.length).toBeGreaterThan(200000);expect(fixture.analyze).not.toHaveBeenCalled();expect((await service.meetingSettings(owner)).reserved).toBe(0);
 });
 it('expires and deletes every grouped audio object and prevents stale worker content returning',async()=>{
 const d=await createMeetingDevice(owner,{label:'Delete fixture',uid:'delete'});await armMeetingDevice(owner,{id:d.id,minutes:60,consentNote:'Synthetic permission',autoProcess:false});await receiveOmi(d.secret,'delete',16000,Buffer.alloc(32000,1));await receiveOmi(d.secret,'delete',8000,Buffer.alloc(16000,2));const id=(await service.listMeetings(owner)).items[0].id;await service.finishUpload(owner,id);expect(fixture.objects.size).toBe(2);await service.saveMeetingBudget(owner,10);await service.queueMeeting(owner,id,'Synthetic permission');fixture.transcribe.mockImplementationOnce(async()=>{await service.deleteMeeting(owner,id,true);return 'Must not return';});await runMeetingWorker(id);
 expect((await db.query('SELECT id FROM meetings WHERE part_transcript IS NOT NULL OR transcript IS NOT NULL')).rowCount).toBe(0);for(let i=0;i<3;i++)await runMeetingWorker();expect(fixture.objects.size).toBe(0);
 });

 it('finalizes parts in the scheduled worker but performs one automatic analysis only after the window expires',async()=>{
 const d=await createMeetingDevice(owner,{label:'Auto fixture',uid:'auto'});await armMeetingDevice(owner,{id:d.id,minutes:60,consentNote:'Synthetic permission',autoProcess:false});await service.saveMeetingBudget(owner,10);
 await receiveOmi(d.secret,'auto',16000,Buffer.alloc(32000,1));const id=(await service.listMeetings(owner)).items[0].id;
 // Changing the explicit auto-processing choice applies to this open meeting.
 await armMeetingDevice(owner,{id:d.id,minutes:60,consentNote:'Synthetic permission',autoProcess:true});
 await receiveOmi(d.secret,'auto',8000,Buffer.alloc(16000,2));await runMeetingWorker();await runMeetingWorker();expect((await getMeeting(owner,id)).status).toBe('capturing');expect(fixture.transcribe).not.toHaveBeenCalled();expect(fixture.objects.size).toBe(1);
 await db.query("UPDATE meeting_devices SET armed_until=now()-interval '1 second' WHERE id=$1",[d.id]);for(let i=0;i<6;i++)await runMeetingWorker();expect((await getMeeting(owner,id)).status).toBe('review');expect(fixture.transcribe).toHaveBeenCalledTimes(2);expect(fixture.analyze).toHaveBeenCalledTimes(1);expect(fixture.objects.size).toBe(2);
 });
 it('pauses a grouped review at its budget and reuses completed transcripts after an explicit retry',async()=>{
 const d=await createMeetingDevice(owner,{label:'Budget fixture',uid:'budget'});await armMeetingDevice(owner,{id:d.id,minutes:60,consentNote:'Synthetic permission',autoProcess:false});await receiveOmi(d.secret,'budget',16000,Buffer.alloc(32000,1));await receiveOmi(d.secret,'budget',8000,Buffer.alloc(16000,2));const id=(await service.listMeetings(owner)).items[0].id;await service.finishUpload(owner,id);await service.saveMeetingBudget(owner,1);await db.query('UPDATE meeting_settings SET monthly_limit_micros=12000 WHERE workspace_id=$1',[ws]);await service.queueMeeting(owner,id,'Synthetic permission');for(let i=0;i<3;i++)await runMeetingWorker(id);expect((await getMeeting(owner,id)).error_code).toBe('allowance');expect((await service.meetingSettings(owner)).reserved).toBe(.012);expect(fixture.analyze).not.toHaveBeenCalled();
 await service.saveMeetingBudget(owner,10);await service.queueMeeting(owner,id,'Synthetic permission');await runMeetingWorker(id);expect(fixture.transcribe).toHaveBeenCalledTimes(2);expect(fixture.analyze).toHaveBeenCalledTimes(1);expect((await service.meetingSettings(owner)).reserved).toBe(.262);
 });
 it('keeps always-ready sessions private and automatically processes each idle recording without rearming',async()=>{
 const d=await createMeetingDevice(owner,{label:'Always ready fixture',uid:'always'});
 const grant={id:d.id,mode:'always_ready',minutes:0,consentNote:'I start recording only with permission; synthetic test.',autoProcess:true};
 await expect(armMeetingDevice(owner,{...grant,consentNote:''})).rejects.toThrow('acknowledgement');
 await expect(armMeetingDevice(member,grant)).rejects.toThrow('unavailable');
 await armMeetingDevice(owner,grant);await service.saveMeetingBudget(owner,10);
 for(let i=1;i<=2;i++){
  await receiveOmi(d.secret,'always',16000,Buffer.alloc(32000,i));
  const id=(await db.query('SELECT current_meeting_id FROM meeting_devices WHERE id=$1',[d.id])).rows[0].current_meeting_id;
  const m=await getMeeting(owner,id);expect(m.receiving).toBe(true);expect(m.consent_note).toContain('Standing recording-permission acknowledgement');expect(m.visibility).toBe('private');
  expect(new Date(m.expires_at).getTime()-new Date(m.created_at).getTime()).toBeCloseTo(30*86400000,-3);
  await runMeetingWorker();expect(fixture.transcribe).toHaveBeenCalledTimes(i-1);
  await db.query("UPDATE meeting_devices SET last_received_at=now()-interval '4 minutes' WHERE id=$1",[d.id]);
  for(let j=0;j<4;j++)await runMeetingWorker();
  expect((await getMeeting(owner,id)).status).toBe('review');expect((await service.readAudio(owner,id)).bytes.subarray(44)).toEqual(Buffer.alloc(32000,i));
  await expect(getMeeting(member,id)).rejects.toThrow('unavailable');await expect(service.readAudio(other,id)).rejects.toThrow('unavailable');
  expect((await db.query('SELECT always_ready,armed_until,current_meeting_id,secret_hash FROM meeting_devices WHERE id=$1',[d.id])).rows[0]).toEqual({always_ready:true,armed_until:null,current_meeting_id:null,secret_hash:service.digest(d.secret)});
 }
 expect((await service.listMeetings(owner)).items).toHaveLength(2);expect(fixture.transcribe).toHaveBeenCalledTimes(2);expect(fixture.analyze).toHaveBeenCalledTimes(2);expect((await service.meetingSettings(owner)).reserved).toBe(.512);
 await armMeetingDevice(owner,{id:d.id,minutes:0,consentNote:'',autoProcess:true});expect(await receiveOmi(d.secret,'always',16000,Buffer.alloc(32000,3))).toMatchObject({discarded:true});
 await armMeetingDevice(owner,grant);await revokeMeetingDevice(owner,d.id);await expect(receiveOmi(d.secret,'always',16000,Buffer.alloc(32000,3))).rejects.toThrow('Unauthorized');
 });
 it('splits an idle always-ready recording on the next delivery even before the worker runs and respects the budget',async()=>{
 const d=await createMeetingDevice(owner,{label:'Idle intake fixture',uid:'idle'});await armMeetingDevice(owner,{id:d.id,mode:'always_ready',minutes:0,consentNote:'Synthetic intentional recording',autoProcess:true});
 await receiveOmi(d.secret,'idle',16000,Buffer.alloc(32000,1));const first=(await service.listMeetings(owner)).items[0].id;
 await db.query("UPDATE meeting_devices SET last_received_at=now()-interval '4 minutes' WHERE id=$1",[d.id]);
 await Promise.all([receiveOmi(d.secret,'idle',16000,Buffer.alloc(32000,2)),receiveOmi(d.secret,'idle',16000,Buffer.alloc(32000,2))]);
 expect((await service.listMeetings(owner)).items).toHaveLength(2);expect((await getMeeting(owner,first)).receiving).toBe(false);
 for(let i=0;i<4;i++)await runMeetingWorker();expect((await getMeeting(owner,first)).error_code).toBe('allowance');expect(fixture.transcribe).not.toHaveBeenCalled();
 await nextOmiConversation(owner,d.id);await receiveOmi(d.secret,'idle',16000,Buffer.alloc(32000,3));const current=(await db.query('SELECT current_meeting_id FROM meeting_devices WHERE id=$1',[d.id])).rows[0].current_meeting_id;
 await service.finishUpload(owner,current);expect((await db.query('SELECT always_ready FROM meeting_devices WHERE id=$1',[d.id])).rows[0].always_ready).toBe(true);
 await receiveOmi(d.secret,'idle',16000,Buffer.alloc(32000,4));expect((await service.listMeetings(owner)).items).toHaveLength(4);
 await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[owner.user.id]);await expect(receiveOmi(d.secret,'idle',16000,Buffer.alloc(32000,5))).rejects.toThrow('Unauthorized');
 });
 it('does not turn retries into an unbounded stream of paid requests',async()=>{
 const id=await upload();await service.saveMeetingBudget(owner,10);fixture.transcribe.mockRejectedValue(new Error('uncertain provider failure'));
 for(let i=0;i<4;i++){await service.queueMeeting(owner,id,'Synthetic permission');await runMeetingWorker(id);}
 expect((await getMeeting(owner,id)).error_code).toBe('attempt_limit');expect(fixture.transcribe).toHaveBeenCalledTimes(3);expect((await service.meetingSettings(owner)).reserved).toBe(.018);
 });

});
