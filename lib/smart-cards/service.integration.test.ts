import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {ensureRecurringSlots} from '@/lib/booking/recurring';
import {easternInputValue,easternInputCandidates} from '@/lib/time';
import {changeCalendar,availableSlots,getBookingCalendar,guardSalesAppointment} from '@/lib/booking/calendar';
import {bookConsultation,getCalendarEntry} from '@/lib/booking/staff';
import {askCardAssistant,CARD_AI_RESERVATION} from './assistant';
import {saveCardInquiry} from './inquiries';
import {getInsurancePage} from '@/lib/campaigns/insurance-data';
import {getCampaignPage} from '@/lib/campaigns/data';
import {cardAccess,getCardsDashboard,getCardProfile,resolveCard,validateCardSource} from './data';
import {cardRateLimit,readCardRequest} from './http';
import {CARD_WORKSPACE,CARD_ORIGIN} from './types';
import {POST as eventPost} from '@/app/api/smart-cards/events/route';
import {GET as redirectGet} from '@/app/go/[code]/route';
const databaseUrl=process.env.SMART_CARDS_TEST_DATABASE_URL;
const owner={user:{id:'card-owner',name:'Austin',email:'austin@tailoredagents.com'},workspace:{id:CARD_WORKSPACE,name:'Tailored Agents',slug:'tailored-agents'},role:'owner' as const};
let pool:pg.Pool;
const inquiry=()=>({profile:'austin',card:'austin-giveaway',channel:'qr',submissionId:randomUUID(),name:'Synthetic Visitor',email:'visitor@example.test',organization:'Example Company',interest:'Smart cards',message:'Please tell me more about the cards.',consent:true,startedAt:Date.now()-5000});
const chat=()=>({profile:'austin',requestId:randomUUID(),sessionId:randomUUID(),messages:[{role:'user',content:'What does Tailored Agents do?'}]});
function response(){return Response.json({status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'We build websites, custom software, and AI assistants. What would you like to explore?',draft:null})}]}],usage:{input_tokens:900,output_tokens:100}});}
describe.skipIf(!databaseUrl)('Smart Cards database and public boundaries',()=>{
 beforeAll(async()=>{const target=new URL(databaseUrl!);if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/ta_smart_cards_test')throw new Error('Use the dedicated local disposable Smart Cards database.');vi.stubEnv('DATABASE_URL',databaseUrl);vi.stubEnv('BETTER_AUTH_SECRET','synthetic-smart-card-test-secret-123456789');vi.stubEnv('OPENAI_API_KEY','synthetic-test-key');vi.stubEnv('RESEND_API_KEY','');pool=getDatabasePool();await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');for(const filename of (await readdir('db/migrations')).filter(f=>f.endsWith('.sql')).sort())await pool.query(await readFile(`db/migrations/${filename}`,'utf8'));await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES('card-owner','Austin','austin@tailoredagents.com',true,now(),now()),('card-viewer','Viewer','viewer@example.test',true,now(),now())`);await pool.query(`INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,'card-owner','owner','active'),($3,$2,'card-viewer','viewer','active')`,[randomUUID(),CARD_WORKSPACE,randomUUID()]);},30000);
 beforeEach(async()=>{vi.stubGlobal('fetch',vi.fn(async()=>response()));await pool.query('TRUNCATE smart_card_ai_requests,smart_card_ai_usage,smart_card_events,request_rate_limits');await pool.query('TRUNCATE booking_slots');await pool.query('DELETE FROM booking_schedules');await pool.query("DELETE FROM leads WHERE source='smart_card'");await pool.query('UPDATE smart_cards SET active=true');await pool.query('UPDATE smart_card_profiles SET published=true');await pool.query('UPDATE smart_card_ai_settings SET enabled=true,monthly_limit_micros=25000000');});
 afterAll(async()=>{await pool?.end();delete (globalThis as {tailoredAgentsDatabasePool?:pg.Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('publishes all four approved contacts and keeps login identity private',async()=>{for(const slug of ['austin','jeffrey','devon','conner']){const p=await getCardProfile(slug);expect(p?.phone).toBe('+16785417725');expect(p).not.toHaveProperty('login_email');expect(p?.email).toBe(`${slug}@tailoredagents.com`);}expect(await getCardProfile('../settings')).toBeNull();});
 it('resolves eight stable links, honors pause, and redirects without permanent caching',async()=>{for(const slug of ['austin','jeffrey','devon','conner'])for(const kind of ['personal','giveaway'])expect((await resolveCard(`${slug}-${kind}`))?.profile_slug).toBe(slug);const r=await redirectGet(new Request(`${CARD_ORIGIN}/go/austin-personal?via=qr`),{params:Promise.resolve({code:'austin-personal'})});expect(r.status).toBe(307);expect(r.headers.get('location')).toContain('/c/austin?card=austin-personal&via=qr');expect(r.headers.get('cache-control')).toBe('no-store');await pool.query("UPDATE smart_cards SET active=false WHERE code='austin-personal'");expect(await resolveCard('austin-personal')).toBeNull();});
 it('resolves campaign links separately, including pause and reassignment',async()=>{
  for(const person of ['austin','jeffrey']){
   const r=await redirectGet(new Request(`${CARD_ORIGIN}/go/insurance-${person}?via=qr`),{params:Promise.resolve({code:`insurance-${person}`})});
   expect(r.status).toBe(307);expect(r.headers.get('location')).toContain(`/solutions/commercial-insurance?person=${person}&card=insurance-${person}&via=qr`);
   expect((await getInsurancePage(person))?.profile.slug).toBe(person);
  }
  expect(await getInsurancePage('austin','austin-personal')).toBeNull();expect(await getInsurancePage('../settings')).toBeNull();
  await pool.query("UPDATE smart_cards SET profile_slug='jeffrey' WHERE code='insurance-austin'");
  try{expect((await getInsurancePage('austin','insurance-austin'))?.profile.slug).toBe('jeffrey');await expect(validateCardSource('austin','insurance-austin')).rejects.toThrow('changed');}
  finally{await pool.query("UPDATE smart_cards SET profile_slug='austin',active=false WHERE code='insurance-austin'");}
  expect(await getInsurancePage('austin')).toBeNull();
 });
 it('keeps campaign inquiry identity separate from general cards and derives campaign on the server',async()=>{
  const v={...inquiry(),card:'insurance-austin',interest:'AI & automation'};
  await saveCardInquiry(v);await saveCardInquiry(v);
  const campaign=(await pool.query("SELECT * FROM leads WHERE source='smart_card'")).rows[0];
  expect(campaign.owner_user_id).toBe(owner.user.id);expect(campaign.description).toContain('Commercial insurance campaign');
  expect(campaign.smart_card_context).toMatchObject({campaign:'commercial-insurance',card:'insurance-austin',profile:'austin',channel:'qr'});
  await saveCardInquiry({...v,submissionId:randomUUID(),card:'austin-personal',campaign:'commercial-insurance'});
  const rows=(await pool.query("SELECT smart_card_context FROM leads WHERE source='smart_card'")).rows;
  expect(rows).toHaveLength(2);expect(rows.some(r=>r.smart_card_context.campaign===null)).toBe(true);expect(fetch).not.toHaveBeenCalled();
 });
 it('records campaign events without accepting client-supplied campaign claims',async()=>{
  async function send(card:string,dnt=false){return eventPost(new Request(`${CARD_ORIGIN}/api/smart-cards/events`,{method:'POST',headers:{origin:CARD_ORIGIN,'content-type':'application/json',...(dnt?{dnt:'1'}:{})},body:JSON.stringify({profile:'austin',card,channel:'qr',campaign:'forged',id:randomUUID(),sessionId:randomUUID(),event:'demo_open'})}));}
  expect((await send('insurance-austin',true)).status).toBe(200);expect((await pool.query('SELECT id FROM smart_card_events')).rowCount).toBe(0);
  expect((await send('insurance-austin')).status).toBe(200);expect((await send('austin-personal')).status).toBe(200);
  const events=(await pool.query('SELECT card_code,campaign FROM smart_card_events')).rows;
  expect(events).toContainEqual({card_code:'insurance-austin',campaign:'commercial-insurance'});expect(events).toContainEqual({card_code:'austin-personal',campaign:null});
  const dashboard=await getCardsDashboard(owner);expect(dashboard.campaigns.find(c=>c.code==='insurance-austin')?.demos).toBe('1');
 });
 it('adds insurance-specific AI context only for a verified campaign link',async()=>{
  await askCardAssistant({...chat(),card:'insurance-austin'},'campaign-test');
  const campaign=JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);expect(campaign.instructions).toContain('Campaign context: Tailored Agents designs');expect(campaign.instructions).toContain('synthetic and prewritten');expect(campaign.instructions).toContain('30-minute slot');
  await askCardAssistant({...chat(),campaign:'commercial-insurance'},'general-test');
  expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).instructions).not.toContain('Campaign context: Tailored Agents designs');
 });
 it('routes all three freight links and rejects cross-campaign, paused and reassigned sources',async()=>{
  for(const person of ['austin','jeffrey','devon']){
   const r=await redirectGet(new Request(`${CARD_ORIGIN}/go/freight-${person}?via=qr`),{params:Promise.resolve({code:`freight-${person}`})});
   expect(r.status).toBe(307);const url=new URL(r.headers.get('location')!);
   expect(url.pathname).toBe('/solutions/freight-automation');expect(url.searchParams.get('utm_campaign')).toBe('freight-automation');
   expect(url.searchParams.get('person')).toBe(person);expect((await getCampaignPage('freight-automation',person))?.profile.slug).toBe(person);
  }
  expect(await getCampaignPage('freight-automation','austin','insurance-austin')).toBeNull();
  expect(await getInsurancePage('austin','freight-austin')).toBeNull();
  expect(await getCampaignPage('freight-automation','unknown')).toBeNull();
  await pool.query("UPDATE smart_cards SET profile_slug='devon' WHERE code='freight-austin'");
  try{expect((await getCampaignPage('freight-automation','austin','freight-austin'))?.profile.slug).toBe('devon');await expect(validateCardSource('austin','freight-austin')).rejects.toThrow('changed');}
  finally{await pool.query("UPDATE smart_cards SET profile_slug='austin',active=false WHERE code='freight-austin'");}
  expect(await getCampaignPage('freight-automation','austin')).toBeNull();
 });
 it('saves separate freight/insurance inquiries with server-derived attribution and no automation',async()=>{
  const v={...inquiry(),card:'freight-austin',interest:'AI & automation',campaign:'commercial-insurance'};
  await Promise.all([saveCardInquiry(v),saveCardInquiry(v)]);
  await saveCardInquiry({...v,card:'insurance-austin',submissionId:randomUUID()});
  const rows=(await pool.query("SELECT * FROM leads WHERE source='smart_card'")).rows;expect(rows).toHaveLength(2);
  const freight=rows.find(r=>r.smart_card_context.campaign==='freight-automation');
  expect(freight.owner_user_id).toBe(owner.user.id);expect(freight.description).toContain('Freight & 3PL campaign');
  expect(freight.smart_card_context).toMatchObject({card:'freight-austin',profile:'austin',channel:'qr'});
  expect((await pool.query('SELECT id FROM factory_projects WHERE lead_id=$1',[freight.id])).rowCount).toBe(0);
  expect((await pool.query('SELECT id FROM lead_intro_jobs WHERE lead_id=$1',[freight.id])).rowCount).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
 });
 it('reports freight independently, respects privacy, and cannot forge campaign events',async()=>{
  async function send(card:string,gpc=false){return eventPost(new Request(`${CARD_ORIGIN}/api/smart-cards/events`,{method:'POST',headers:{origin:CARD_ORIGIN,'content-type':'application/json',...(gpc?{'sec-gpc':'1'}:{})},body:JSON.stringify({profile:'austin',card,channel:'qr',campaign:'commercial-insurance',id:randomUUID(),sessionId:randomUUID(),event:'calculator_use'})}));}
  await send('freight-austin',true);expect((await pool.query('SELECT id FROM smart_card_events')).rowCount).toBe(0);
  await send('freight-austin');await send('insurance-austin');await send('austin-personal');
  const rows=(await pool.query('SELECT card_code,campaign FROM smart_card_events')).rows;
  expect(rows).toContainEqual({card_code:'freight-austin',campaign:'freight-automation'});
  expect(rows).toContainEqual({card_code:'austin-personal',campaign:null});
  const dashboard=await getCardsDashboard(owner);
  expect(dashboard.campaigns).toHaveLength(5);
  expect(dashboard.campaigns.find(c=>c.code==='freight-austin')).toMatchObject({campaign:'freight-automation',calculators:'1'});
  expect(dashboard.campaigns.find(c=>c.code==='insurance-austin')?.calculators).toBe('1');
 });
 it('uses freight AI context only for a verified link and shares the existing allowance',async()=>{
  await askCardAssistant({...chat(),card:'freight-austin'},'freight-test');
  const request=JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(request.instructions).toContain('Campaign context: Freight Document & Operations Automation');
  expect(request.instructions).toContain('$160 difference');expect(request.instructions).toContain('Do not publish fixed or per-document pricing');
  expect(request.instructions).not.toContain('Campaign context: Tailored Agents designs');expect(request.tools).toBeUndefined();expect(request.store).toBe(false);
  await askCardAssistant({...chat(),campaign:'freight-automation'},'general-test');
  expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).instructions).not.toContain('Campaign context: Freight');
  expect(Number((await pool.query('SELECT amount_micros FROM smart_card_ai_usage')).rows[0].amount_micros)).toBe(5600);
  expect((await pool.query("SELECT id FROM leads WHERE source='smart_card'")).rowCount).toBe(0);
 });
 it('enforces freight 30-minute bookings and accounts for cancellation in campaign reporting',async()=>{
  const start=new Date(Date.now()+3*86400000);start.setUTCMinutes(0,0,0);
  await changeCalendar(owner,{operation:'publish',profile:'austin',startsAt:start.toISOString(),minutes:15,mode:'open'});
  await changeCalendar(owner,{operation:'publish',profile:'austin',startsAt:new Date(start.getTime()+3600000).toISOString(),minutes:30,mode:'open'});
  const all=await availableSlots('austin');const short=all.find(s=>Date.parse(s.endsAt)-Date.parse(s.startsAt)===900000)!;
  const freight=await availableSlots('austin','freight-austin');expect(freight.every(s=>Date.parse(s.endsAt)-Date.parse(s.startsAt)===1800000)).toBe(true);
  const input={...inquiry(),card:'freight-austin',requestKind:'appointment',phone:'+16785550123'};
  await expect(saveCardInquiry({...input,slotId:short.id})).rejects.toThrow('30-minute');
  expect((await pool.query("SELECT id FROM leads WHERE source='smart_card'")).rowCount).toBe(0);
  const saved=await saveCardInquiry({...input,slotId:freight[0].id});expect(saved.booking?.status).toBe('booked');
  expect((await getCardsDashboard(owner)).campaigns.find(c=>c.code==='freight-austin')).toMatchObject({inquiries:'1',bookings:'1'});
  await pool.query("UPDATE booking_slots SET status='cancelled' WHERE id=$1",[saved.booking!.id]);
  expect((await getCardsDashboard(owner)).campaigns.find(c=>c.code==='freight-austin')?.bookings).toBe('0');
 });
 it('rejects mismatched or unpublished profile attribution',async()=>{await expect(validateCardSource('austin','devon-personal')).rejects.toThrow();await pool.query("UPDATE smart_card_profiles SET published=false WHERE slug='austin'");await expect(validateCardSource('austin')).rejects.toThrow();});
 it('saves one inquiry under concurrent retries, assigns the introducer, and starts no automation',async()=>{const v=inquiry();await Promise.all([saveCardInquiry(v),saveCardInquiry(v)]);const rows=(await pool.query("SELECT * FROM leads WHERE source='smart_card'")).rows;expect(rows).toHaveLength(1);expect(rows[0].owner_user_id).toBe(owner.user.id);expect(rows[0].smart_card_context).toMatchObject({profile:'austin',channel:'qr',card:'austin-giveaway'});expect((await pool.query('SELECT id FROM factory_projects WHERE lead_id=$1',[rows[0].id])).rowCount).toBe(0);expect((await pool.query('SELECT id FROM lead_intro_jobs WHERE lead_id=$1',[rows[0].id])).rowCount).toBe(0);expect(fetch).not.toHaveBeenCalled();});
 it('rejects an idempotency key reused for different content',async()=>{const v=inquiry();await saveCardInquiry(v);await expect(saveCardInquiry({...v,message:'A different request'})).rejects.toThrow('already submitted');});
 it('requires live admin membership for changes, not the caller-supplied role',async()=>{expect(await cardAccess(owner,true)).toBe('owner');await expect(cardAccess({...owner,user:{...owner.user,id:'card-viewer'}},true)).rejects.toThrow();await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id='card-owner'");await expect(cardAccess(owner,true)).rejects.toThrow();await pool.query("UPDATE workspace_memberships SET status='active' WHERE user_id='card-owner'");});
 it('rejects cross-site public requests and oversized bodies',async()=>{await expect(readCardRequest(new Request(`${CARD_ORIGIN}/api/smart-cards/chat`,{method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},body:'{}'}))).rejects.toThrow('website');await expect(readCardRequest(new Request(`${CARD_ORIGIN}/api/smart-cards/chat`,{method:'POST',headers:{origin:CARD_ORIGIN,'content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(100)})}),50)).rejects.toThrow('long');});
 it('deduplicates events and respects visitor privacy signals',async()=>{const body={profile:'austin',card:'austin-personal',channel:'nfc',id:randomUUID(),sessionId:randomUUID(),event:'visit'};const req=(dnt=false)=>new Request(`${CARD_ORIGIN}/api/smart-cards/events`,{method:'POST',headers:{origin:CARD_ORIGIN,'content-type':'application/json',...(dnt?{dnt:'1'}:{})},body:JSON.stringify(body)});expect((await eventPost(req(true))).status).toBe(200);expect((await pool.query('SELECT id FROM smart_card_events')).rowCount).toBe(0);await eventPost(req());await eventPost(req());expect((await pool.query('SELECT id FROM smart_card_events')).rowCount).toBe(1);});
 it('applies atomic rate limits',async()=>{await cardRateLimit('test','key',1,60);await expect(cardRateLimit('test','key',1,60)).rejects.toThrow('wait');});
 it('answers using only approved context and accounts for actual token use',async()=>{expect((await askCardAssistant(chat(),'ip-one')).answer).toContain('websites');const body=JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);expect(body.store).toBe(false);expect(body.tools).toBeUndefined();expect(body.instructions).toContain('austin@tailoredagents.com');expect(body.instructions).not.toContain('Synthetic Visitor');expect(Number((await pool.query('SELECT amount_micros FROM smart_card_ai_usage')).rows[0].amount_micros)).toBe(2800);});
 it('keeps uncertain charges reserved and never retries the same request',async()=>{vi.mocked(fetch).mockRejectedValue(new Error('timeout'));const v=chat();await expect(askCardAssistant(v,'ip-one')).rejects.toThrow('finish');expect(Number((await pool.query('SELECT amount_micros FROM smart_card_ai_usage')).rows[0].amount_micros)).toBe(CARD_AI_RESERVATION);await expect(askCardAssistant(v,'ip-one')).rejects.toThrow('already');expect(fetch).toHaveBeenCalledTimes(1);});
 it('prevents simultaneous requests from overspending the shared budget',async()=>{await pool.query('UPDATE smart_card_ai_settings SET monthly_limit_micros=$1',[CARD_AI_RESERVATION]);let finish:(r:Response)=>void=()=>{};const wait=new Promise<Response>(resolve=>{finish=resolve;});vi.mocked(fetch).mockReturnValue(wait);const first=askCardAssistant(chat(),'ip-a');await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));await expect(askCardAssistant({...chat(),profile:'devon'},'ip-b')).rejects.toThrow('allowance');finish(response());await first;expect(fetch).toHaveBeenCalledTimes(1);});
 it('honors assistant pause and the eight-message session limit',async()=>{await pool.query('UPDATE smart_card_ai_settings SET enabled=false');await expect(askCardAssistant(chat(),'ip-one')).rejects.toThrow('break');expect(fetch).not.toHaveBeenCalled();await pool.query('UPDATE smart_card_ai_settings SET enabled=true');const v=chat();for(let i=0;i<8;i++)await pool.query(`INSERT INTO smart_card_ai_requests(id,workspace_id,month,session_id,request_hash,amount_micros,status) VALUES($1,$2,current_date,$3,'test',0,'completed')`,[randomUUID(),CARD_WORKSPACE,v.sessionId]);await expect(askCardAssistant(v,'ip-two')).rejects.toThrow('longer');});
 it('retains current records and removes expired engagement and usage data',async()=>{await pool.query(`INSERT INTO smart_card_events(id,workspace_id,profile_slug,session_id,channel,event_name,created_at) VALUES($1,$2,'austin',$3,'direct','visit',now()-interval '26 months')`,[randomUUID(),CARD_WORKSPACE,randomUUID()]);await pool.query('SELECT perform_reporting_retention()');expect((await pool.query('SELECT id FROM smart_card_events')).rowCount).toBe(0);expect(await getCardProfile('austin')).not.toBeNull();});
 it('returns an editable draft without writing a lead or appointment',async()=>{
  const draft={name:'Visitor',email:'visitor@example.test',phone:'',organization:'',message:'I would like a website.',interest:'Website',requestKind:'appointment',preferredTime:'Tuesday afternoon Eastern'};
  vi.mocked(fetch).mockResolvedValue(Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Review your request below. Nothing is booked yet.',draft})}]}],usage:{input_tokens:900,output_tokens:100}}));
  const result=await askCardAssistant(chat(),'ip-one');expect(result.draft).toEqual(draft);expect((await pool.query("SELECT id FROM leads WHERE source='smart_card'")).rowCount).toBe(0);
  const body=JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);expect(body.text.format.strict).toBe(true);expect(body.tools).toBeUndefined();
 });
 it('rejects malformed AI output and preserves its spend reservation',async()=>{
  vi.mocked(fetch).mockResolvedValue(Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"answer":"Booked!","draft":{"execute":"book"}}'}]}],usage:{input_tokens:900,output_tokens:100}}));
  await expect(askCardAssistant(chat(),'ip-one')).rejects.toThrow('finish');expect((await pool.query('SELECT id FROM booking_slots')).rowCount).toBe(0);
 });
 it('saves reviewed appointment requests without pretending to reserve a time',async()=>{
  const result=await saveCardInquiry({...inquiry(),handoff:'assistant',requestKind:'appointment',preferredTime:'Tuesday afternoon Eastern'});expect(result.booking).toBeNull();
  const lead=(await pool.query("SELECT description,smart_card_context FROM leads WHERE source='smart_card'")).rows[0];expect(lead.description).toContain('not booked');expect(lead.smart_card_context).toMatchObject({handoff:'assistant',requestKind:'appointment',preferredTime:'Tuesday afternoon Eastern'});
 });
 const publish=async()=>{await changeCalendar(owner,{operation:'publish',profile:'austin',startsAt:new Date(Date.now()+86400000).toISOString(),minutes:30,mode:'open'});return (await availableSlots('austin'))[0];};
 it('publishes only real staff times, rejects overlap and protects staff controls',async()=>{
  const slot=await publish();expect(slot.id).toBeTruthy();expect(await availableSlots('devon')).toEqual([]);
  await expect(changeCalendar(owner,{operation:'publish',profile:'austin',startsAt:slot.startsAt,minutes:30,mode:'open'})).rejects.toThrow('overlaps');
  await expect(changeCalendar({...owner,user:{...owner.user,id:'card-viewer'}},{operation:'close',id:slot.id})).rejects.toThrow();
  await changeCalendar(owner,{operation:'close',id:slot.id});expect(await availableSlots('austin')).toEqual([]);
 });
 it('books atomically, rejects a second visitor, and replays confirmation safely',async()=>{
  const slot=await publish(),first={...inquiry(),requestKind:'appointment',phone:'+16785550123',slotId:slot.id};
  const second={...first,submissionId:randomUUID(),name:'Another Visitor',email:'another@example.test'};
  const results=await Promise.allSettled([saveCardInquiry(first),saveCardInquiry(second)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  expect((await pool.query("SELECT id FROM leads WHERE source='smart_card'")).rowCount).toBe(1);expect(await availableSlots('austin')).toEqual([]);
  const winner=results[0].status==='fulfilled'?first:second;expect((await saveCardInquiry(winner)).booking?.id).toBe(slot.id);
  const row=(await getBookingCalendar(owner)).slots[0];expect(row.status).toBe('booked');expect(row.phone).toBe('+16785550123');
  const db=await pool.connect();try{await db.query('BEGIN');await expect(guardSalesAppointment(db,CARD_WORKSPACE,'card-owner',slot.startsAt,slot.endsAt)).rejects.toThrow('booking');await db.query('ROLLBACK');}finally{db.release();}
  await expect(changeCalendar(owner,{operation:'cancel',id:slot.id})).rejects.toThrow('Contact');await changeCalendar(owner,{operation:'cancel',id:slot.id,contacted:'on'});expect((await saveCardInquiry(winner)).booking?.status).toBe('cancelled');expect(await availableSlots('austin')).toEqual([]);
 });
 it('serializes public booking against a staff booking of the same time',async()=>{
  const slot=await publish();
  await saveCardInquiry({...inquiry(),email:'staff-existing@example.test',phone:'+16785550123'});
  const lead=(await pool.query("SELECT id,updated_at FROM leads WHERE email='staff-existing@example.test'")).rows[0];
  const results=await Promise.allSettled([
   bookConsultation(owner,{leadId:lead.id,expectedLeadUpdatedAt:lead.updated_at.toISOString(),profile:'austin',slotId:slot.id}),
   saveCardInquiry({...inquiry(),requestKind:'appointment',phone:'+16785550124',slotId:slot.id}),
  ]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  expect((await pool.query("SELECT id FROM booking_slots WHERE status='booked'")).rowCount).toBe(1);
  expect(await availableSlots('austin')).toEqual([]);
 });
 it('refuses booking without consent or phone, and refuses mismatched or stale slots',async()=>{
  const slot=await publish(),v={...inquiry(),requestKind:'appointment',slotId:slot.id};
  await expect(saveCardInquiry(v)).rejects.toThrow();await expect(saveCardInquiry({...v,phone:'+16785550123',consent:false})).rejects.toThrow();
  await expect(saveCardInquiry({...v,profile:'devon',card:'devon-personal',phone:'+16785550123'})).rejects.toThrow('no longer available');
  await pool.query("UPDATE booking_slots SET starts_at=now()+interval '30 minutes',ends_at=now()+interval '60 minutes'");expect(await availableSlots('austin')).toEqual([]);await expect(saveCardInquiry({...v,phone:'+16785550123'})).rejects.toThrow('no longer available');
 });
 it('hides slots when the owner is suspended or the card is paused',async()=>{
  await publish();await pool.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id='card-owner'");expect(await availableSlots('austin')).toEqual([]);await pool.query("UPDATE workspace_memberships SET status='active' WHERE user_id='card-owner'");await pool.query("UPDATE smart_cards SET active=false WHERE code='austin-personal'");await expect(availableSlots('austin','austin-personal')).rejects.toThrow();
 });

 it('rechecks sales appointments created after availability was published',async()=>{
  const slot=await publish(),conversation=randomUUID(),source=randomUUID(),task=randomUUID();
  await pool.query('INSERT INTO crm_conversations(id,workspace_id) VALUES($1,$2)',[conversation,CARD_WORKSPACE]);
  await pool.query("INSERT INTO crm_conversation_sources(id,workspace_id,conversation_id,channel,mailbox_id,thread_id) VALUES($1,$2,$3,'email','synthetic-mailbox',$4)",[source,CARD_WORKSPACE,conversation,source]);
  await pool.query("INSERT INTO crm_tasks(id,workspace_id,conversation_source_id,owner_user_id,kind,title,due_at,end_at) VALUES($1,$2,$3,'card-owner','appointment','Synthetic sales call',$4,$5)",[task,CARD_WORKSPACE,source,slot.startsAt,slot.endsAt]);
  expect(await availableSlots('austin')).toEqual([]);
  await pool.query('UPDATE crm_tasks SET end_at=due_at WHERE id=$1',[task]);expect(await availableSlots('austin')).toEqual([]);
  await expect(saveCardInquiry({...inquiry(),requestKind:'appointment',phone:'+16785550123',slotId:slot.id})).rejects.toThrow('no longer available');
  expect((await pool.query("SELECT id FROM leads WHERE source='smart_card'")).rowCount).toBe(0);
  await pool.query('DELETE FROM crm_tasks WHERE id=$1',[task]);await pool.query('DELETE FROM crm_conversation_sources WHERE id=$1',[source]);await pool.query('DELETE FROM crm_conversations WHERE id=$1',[conversation]);
 });

 const enableDaily=async()=>{await pool.query('INSERT INTO booking_schedules(workspace_id,profile_slug) SELECT workspace_id,slug FROM smart_card_profiles');};
 const tomorrow=async()=>(await pool.query("SELECT ((now() AT TIME ZONE 'America/New_York')::date+1)::text AS date_key")).rows[0].date_key as string;
 const manual=(startsAt:string,endsAt:string,profile='austin')=>({operation:'create_event',profile,title:'Client workflow review',kind:'appointment',startsAt,endsAt,location:'Office',notes:'Synthetic client discussion'});
 it('creates, edits and removes named events while restoring only the released availability',async()=>{
  await enableDaily();const day=await tomorrow(),slots=await availableSlots('austin',undefined,day),first=slots[0],second=slots[1];
  const created=await changeCalendar(owner,manual(first.startsAt,first.endsAt));
  expect(await availableSlots('austin',undefined,day)).toHaveLength(21);
  let row=(await getBookingCalendar(owner,{start:day,end:new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10)})).slots.find(s=>s.id===created.id)!;
  expect(row).toMatchObject({title:'Client workflow review',kind:'appointment',location:'Office',notes:'Synthetic client discussion',isBlock:true});
  expect(await getCalendarEntry(owner,created.id!)).toMatchObject({title:'Client workflow review',notes:'Synthetic client discussion',allDay:false});
  await changeCalendar(owner,{...manual(second.startsAt,second.endsAt),operation:'update_event',id:row.id,expectedUpdatedAt:row.updatedAt,title:'Updated client meeting'});
  expect((await availableSlots('austin',undefined,day)).some(s=>s.id===first.id)).toBe(true);
  await expect(changeCalendar(owner,{...manual(first.startsAt,first.endsAt),operation:'update_event',id:row.id,expectedUpdatedAt:row.updatedAt})).rejects.toThrow('changed');
  row=(await getBookingCalendar(owner)).slots.find(s=>s.id===created.id)!;
  await expect(changeCalendar(owner,{operation:'remove_event',id:row.id,expectedUpdatedAt:row.updatedAt})).rejects.toThrow('Confirm');
  await changeCalendar(owner,{operation:'remove_event',id:row.id,expectedUpdatedAt:row.updatedAt,confirmed:'on'});
  expect(await availableSlots('austin',undefined,day)).toHaveLength(22);expect(fetch).not.toHaveBeenCalled();
 });
 it('allows members to manage their own events but denies other calendars and viewer writes',async()=>{
  const start=new Date(Date.now()+3*86400000).toISOString(),end=new Date(Date.parse(start)+3600000).toISOString();
  await pool.query("UPDATE workspace_memberships SET role='member' WHERE user_id='card-owner'");
  try{
   const data=await getBookingCalendar(owner);expect(data.profiles.filter(p=>p.editable).map(p=>p.slug)).toEqual(['austin']);
   const own=await changeCalendar(owner,manual(start,end));
   await expect(changeCalendar(owner,manual(start,end,'devon'))).rejects.toThrow('own calendar');
   const row=(await getBookingCalendar(owner)).slots.find(s=>s.id===own.id)!;
   await expect(changeCalendar(owner,{...manual(start,end,'devon'),operation:'update_event',id:own.id,expectedUpdatedAt:row.updatedAt})).rejects.toThrow('own calendar');
   await expect(changeCalendar({...owner,user:{...owner.user,id:'card-viewer'}},manual(start,end,'jeffrey'))).rejects.toThrow('own calendar');
   await expect(changeCalendar({...owner,user:{...owner.user,id:'card-viewer'}},{operation:'remove_event',id:own.id,expectedUpdatedAt:row.updatedAt,confirmed:'on'})).rejects.toThrow('own calendar');
  }finally{await pool.query("UPDATE workspace_memberships SET role='owner' WHERE user_id='card-owner'");}
 });
 it('serializes overlapping writes, protects confirmed calls, and allows different teammate overlap',async()=>{
  await enableDaily();const day=await tomorrow(),slot=(await availableSlots('austin',undefined,day))[0];
  const results=await Promise.allSettled([changeCalendar(owner,manual(slot.startsAt,slot.endsAt)),changeCalendar(owner,manual(slot.startsAt,slot.endsAt))]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  await changeCalendar(owner,manual(slot.startsAt,slot.endsAt,'devon'));
  const next=(await availableSlots('austin',undefined,day))[0];await saveCardInquiry({...inquiry(),phone:'+16785550123',requestKind:'appointment',slotId:next.id});
  await expect(changeCalendar(owner,manual(next.startsAt,next.endsAt))).rejects.toThrow('already has');
  const booked=(await getBookingCalendar(owner)).slots.find(s=>s.id===next.id)!;
  await expect(changeCalendar(owner,{...manual(next.startsAt,next.endsAt),operation:'update_event',id:booked.id,expectedUpdatedAt:booked.updatedAt})).rejects.toThrow('no longer editable');
  await expect(guardWithEvent()).rejects.toThrow('booking or blocked');
  async function guardWithEvent(){const db=await pool.connect();try{await db.query('BEGIN');await guardSalesAppointment(db,CARD_WORKSPACE,owner.user.id,slot.startsAt,slot.endsAt);}finally{await db.query('ROLLBACK');db.release();}}
 });
 it('blocks whole Eastern days and supports future range queries without exposing records outside the window',async()=>{
  await enableDaily();const day=await tomorrow(),next=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  await changeCalendar(owner,{...manual(easternInputCandidates(day+'T00:00')[0],easternInputCandidates(next+'T00:00')[0]),allDay:true,kind:'time_off',title:'Day off'});
  expect(await availableSlots('austin',undefined,day)).toEqual([]);expect(await availableSlots('devon',undefined,day)).toHaveLength(22);
  expect((await getBookingCalendar(owner,{start:day,end:next})).slots).toHaveLength(1);
  const after=new Date(Date.parse(next+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  expect((await getBookingCalendar(owner,{start:next,end:after})).slots).toHaveLength(0);
  const future=new Date(Date.now()+180*86400000).toISOString(),end=new Date(Date.parse(future)+3600000).toISOString();await changeCalendar(owner,manual(future,end,'jeffrey'));
  await expect(changeCalendar(owner,{...manual(future,end),allDay:true})).rejects.toThrow('midnight');
  await expect(getBookingCalendar(owner,{start:day,end:'2029-01-01'})).rejects.toThrow('93 days');
 });
 it('refuses an internal event over an existing CRM appointment',async()=>{
  const start=new Date(Date.now()+3*86400000).toISOString(),end=new Date(Date.parse(start)+3600000).toISOString(),conversation=randomUUID(),source=randomUUID(),task=randomUUID();
  await pool.query('INSERT INTO crm_conversations(id,workspace_id) VALUES($1,$2)',[conversation,CARD_WORKSPACE]);
  await pool.query("INSERT INTO crm_conversation_sources(id,workspace_id,conversation_id,channel,mailbox_id,thread_id) VALUES($1,$2,$3,'email','synthetic-calendar-mailbox',$4)",[source,CARD_WORKSPACE,conversation,source]);
  try{await pool.query("INSERT INTO crm_tasks(id,workspace_id,conversation_source_id,owner_user_id,kind,title,due_at,end_at) VALUES($1,$2,$3,'card-owner','appointment','Existing client meeting',$4,$5)",[task,CARD_WORKSPACE,source,start,end]);await expect(changeCalendar(owner,manual(start,end))).rejects.toThrow('sales appointment');}
  finally{await pool.query('DELETE FROM crm_tasks WHERE id=$1',[task]);await pool.query('DELETE FROM crm_conversation_sources WHERE id=$1',[source]);await pool.query('DELETE FROM crm_conversations WHERE id=$1',[conversation]);}
 });
 it('offers daily 8 AM–7 PM Eastern times for all four profiles without requiring a first staff login',async()=>{
  await enableDaily();const day=await tomorrow();
  for(const profile of ['austin','devon','jeffrey','conner']){const slots=await availableSlots(profile,undefined,day);expect(slots).toHaveLength(22);expect(easternInputValue(slots[0].startsAt)).toBe(day+'T08:00');expect(easternInputValue(slots.at(-1)!.endsAt)).toBe(day+'T19:00');}
  const totals=(await pool.query('SELECT profile_slug,count(*)::int total FROM booking_slots GROUP BY profile_slug')).rows;expect(totals).toHaveLength(4);expect(totals.every(r=>r.total===91*22)).toBe(true);
  const weekends=(await pool.query("SELECT count(*)::int total FROM booking_slots WHERE profile_slug='devon' AND extract(isodow from starts_at AT TIME ZONE 'America/New_York') IN (6,7)")).rows[0];expect(weekends.total).toBeGreaterThan(0);
  const calendar=await getBookingCalendar(owner);expect(calendar.slots).toHaveLength(0);expect(calendar.profiles.every(p=>p.opens_minute===480&&p.closes_minute===1140)).toBe(true);
 });
 it('refills the rolling horizon once without resurrecting closed or cancelled slots',async()=>{
  await enableDaily();await Promise.all([ensureRecurringSlots(CARD_WORKSPACE),ensureRecurringSlots(CARD_WORKSPACE)]);const day=await tomorrow(),first=(await availableSlots('austin',undefined,day))[0];
  await changeCalendar(owner,{operation:'close',id:first.id});
  // Simulate yesterday's generation watermark, leaving the current day records intact.
  await pool.query("DELETE FROM booking_slots WHERE (starts_at AT TIME ZONE 'America/New_York')::date=(now() AT TIME ZONE 'America/New_York')::date+90");
  await pool.query('UPDATE booking_schedules SET generated_through=generated_through-1');
  await Promise.all([ensureRecurringSlots(CARD_WORKSPACE),ensureRecurringSlots(CARD_WORKSPACE)]);
  expect((await pool.query('SELECT count(*)::int total FROM booking_slots')).rows[0].total).toBe(4*91*22);
  expect((await availableSlots('austin',undefined,day)).some(s=>s.id===first.id)).toBe(false);
 });
 it('blocks full days and weeks without deleting recurring availability, and restores it on removal',async()=>{
  await enableDaily();const day=await tomorrow(),slots=await availableSlots('austin',undefined,day);
  await changeCalendar(owner,{operation:'publish',profile:'austin',startsAt:slots[0].startsAt,minutes:660,mode:'blocked'});
  expect(await availableSlots('austin',undefined,day)).toEqual([]);expect(await availableSlots('devon',undefined,day)).toHaveLength(22);
  const block=(await pool.query("SELECT id FROM booking_slots WHERE status='blocked'")).rows[0];await changeCalendar(owner,{operation:'close',id:block.id});expect(await availableSlots('austin',undefined,day)).toHaveLength(22);
  await changeCalendar(owner,{operation:'publish',profile:'jeffrey',startsAt:slots[0].startsAt,minutes:10080,mode:'blocked'});expect(await availableSlots('jeffrey',undefined,day)).toEqual([]);
 });
 it('preserves an existing manual opening when recurring hours begin',async()=>{
  const first=await publish();await enableDaily();const slots=await availableSlots('austin',undefined,easternInputValue(first.startsAt).slice(0,10));expect(slots.some(s=>s.id===first.id)).toBe(true);
  expect(slots.filter(s=>s.id!==first.id).every(s=>Date.parse(s.endsAt)<=Date.parse(first.startsAt)||Date.parse(s.startsAt)>=Date.parse(first.endsAt))).toBe(true);
 });
 it('confirms a recurring slot only once and refuses time off over a booking',async()=>{
  await enableDaily();const day=await tomorrow(),slot=(await availableSlots('devon',undefined,day))[0];
  const request={...inquiry(),profile:'devon',card:'devon-personal',requestKind:'appointment',phone:'+16785550123',slotId:slot.id};
  const results=await Promise.allSettled([saveCardInquiry(request),saveCardInquiry({...request,submissionId:randomUUID(),email:'second@example.test'})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(await availableSlots('devon',undefined,day)).toHaveLength(21);
  await expect(changeCalendar(owner,{operation:'publish',profile:'devon',startsAt:slot.startsAt,minutes:660,mode:'blocked'})).rejects.toThrow('overlaps');
 });

 it('uses the existing calendar for campaign bookings and reports confirmed appointments',async()=>{
  await enableDaily();const day=await tomorrow(),slot=(await availableSlots('austin','insurance-austin',day))[0];
  const request={...inquiry(),card:'insurance-austin',requestKind:'appointment',phone:'+16785550123',slotId:slot.id};
  const result=await saveCardInquiry(request);expect(result.booking?.status).toBe('booked');
  expect((await availableSlots('austin','austin-personal',day)).some(s=>s.id===slot.id)).toBe(false);
  let metrics=(await getCardsDashboard(owner)).campaigns.find(c=>c.code==='insurance-austin');expect(metrics).toMatchObject({inquiries:'1',bookings:'1'});
  await changeCalendar(owner,{operation:'cancel',id:slot.id,contacted:'on'});
  metrics=(await getCardsDashboard(owner)).campaigns.find(c=>c.code==='insurance-austin');expect(metrics).toMatchObject({inquiries:'1',bookings:'0'});
 });
 it('rejects short extra openings for the campaign review',async()=>{
  const start=new Date(Date.now()+3*86400000).toISOString();
  await changeCalendar(owner,{operation:'publish',profile:'austin',startsAt:start,minutes:15,mode:'open'});
  const general=await availableSlots('austin');expect(general).toHaveLength(1);
  expect(await availableSlots('austin','insurance-austin')).toEqual([]);
  await expect(saveCardInquiry({...inquiry(),card:'insurance-austin',requestKind:'appointment',phone:'+16785550123',slotId:general[0].id})).rejects.toThrow('30-minute');
  expect((await pool.query("SELECT id FROM leads WHERE source='smart_card'")).rowCount).toBe(0);
 });

});
