import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import type {Pool} from 'pg';
import {zipSync,strToU8,unzipSync} from 'fflate';
vi.mock('server-only',()=>({}));
import {getDatabasePool} from '@/lib/dashboard/db';
import {storeDocument,processDocuments,readDocument,documentDownload,controlDocument,exportDocument,expireDocuments,recordDocumentUse,validateDocumentAttachments,listDocuments} from './documents';
import {extractDocument,documentWorker} from './document-processing';
const url=process.env.ASSISTANT_DOCUMENTS_TEST_DATABASE_URL,ws='00000000-0000-4000-8000-000000000001';let db:Pool;
const employee={user:{id:'doc-owner',name:'Owner',email:'doc-owner@example.test'},workspace:{id:ws,name:'Tailored Agents',slug:'tailored-agents'},role:'owner' as const},other={...employee,user:{id:'doc-other',name:'Other',email:'doc-other@example.test'}};
const sample={title:'Onboarding brief',body:'Prepared for José.\nConfirm the discovery meeting.',columns:['Customer','Amount'],rows:[['Client',-25],['=HYPERLINK("https://example.test")',null]],sources:[]};
describe('Bounded document processing and safe exports',()=>{
 it.each(['pdf','docx','csv','xlsx'])('creates an actual %s with usable text, numeric values and safe formulas',async format=>{
  const rendered=await documentWorker({operation:'render',input:{...sample,format}});expect(rendered).toBeInstanceOf(Uint8Array);const parsed=await extractDocument(rendered as Uint8Array,format);const text=parsed.chunks.map(c=>c.text).join('\n');expect(text).toContain('Client');expect(text).toContain('-25');expect(parsed.mime).not.toContain('html');if(format==='pdf'||format==='docx')expect(text).toContain('José');if(format==='csv')expect(Buffer.from(rendered as Uint8Array).toString()).toContain("'=HYPERLINK");
  const again=await documentWorker({operation:'render',input:{...sample,format}});expect(Buffer.from(again as Uint8Array).equals(Buffer.from(rendered as Uint8Array))).toBe(true);
 },15000);
 it('preserves quoted CSV fields and rejects ambiguous quoting, binary text and spoofed signatures',async()=>{
  const parsed=await extractDocument(Buffer.from('Name,Notes\r\n"Doe, Jane","Line one\nLine two"\r\n'),'csv');expect(parsed.chunks[1].text).toContain('Doe, Jane');expect(parsed.chunks[1].text).toContain('Line one\nLine two');
  for(const [value,ext] of [['"bad','csv'],['<html>not a document</html>','txt'],['not PDF','pdf'],['not Office','docx'],['not PNG','png'],['nul\u0000byte','txt']])await expect(extractDocument(Buffer.from(value),ext)).rejects.toThrow();
 });
 it('can render a selected PDF page for visual reading without remote resources',async()=>{
  const bytes=await documentWorker({operation:'render',input:{...sample,format:'pdf'}});const png=await documentWorker({operation:'image',bytes,extension:'pdf',page:1});expect(Buffer.from(png as Uint8Array).subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');await expect(documentWorker({operation:'image',bytes,extension:'pdf',page:2})).rejects.toThrow('page does not exist');
 });
 it('rejects excessive output data and unsupported PDF characters without silently dropping them',async()=>{
  await expect(documentWorker({operation:'render',input:{...sample,format:'pdf',title:'客户'}})).rejects.toThrow('DOCX');await expect(documentWorker({operation:'render',input:{...sample,format:'xlsx',rows:Array.from({length:501},()=>['x',1])}})).rejects.toThrow('limits');
 });
 it('rejects XML entities, archive traversal, macro parts and expansion bombs',async()=>{
  const parts={'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Safe</w:t></w:r></w:p></w:body></w:document>')};
  for(const values of [
   {...parts,'word/document.xml':strToU8('<!DOCTYPE x [<!ENTITY payload SYSTEM "file:///private">]><x>&payload;</x>')},
   {...parts,'../outside.txt':strToU8('No traversal')},
   {...parts,'word/vbaProject.bin':strToU8('No macros')},
   {...parts,'word/oversized.xml':strToU8('x'.repeat(13_000_000))},
  ])await expect(extractDocument(zipSync(values), 'docx')).rejects.toThrow();
 });
 it('stores spreadsheet formula-like strings as text and keeps source notes in a separate sheet',async()=>{
  const bytes=await documentWorker({operation:'render',input:{...sample,format:'xlsx',sources:['Approved source v1']}});const parts=unzipSync(bytes as Uint8Array);expect(new TextDecoder().decode(parts['xl/worksheets/sheet1.xml'])).not.toContain('<f>');expect(new TextDecoder().decode(parts['xl/worksheets/sheet1.xml'])).toContain('t="inlineStr"');expect(new TextDecoder().decode(parts['xl/worksheets/sheet2.xml'])).toContain('Approved source v1');
 });
});
describe.skipIf(!url)('Private documents and source lifecycle',()=>{
 beforeAll(async()=>{
  const target=new URL(url!);if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/ta_assistant_documents_test')throw Error('Use the disposable documents database.');
  vi.stubEnv('DATABASE_URL',url);vi.stubEnv('BETTER_AUTH_URL','http://localhost:3162');vi.stubEnv('BETTER_AUTH_SECRET','synthetic-document-only-secret-at-least32');vi.stubEnv('DASHBOARD_AUTH_MODE','password');vi.stubEnv('DASHBOARD_ALLOWED_EMAILS','doc-owner@example.test,doc-other@example.test');
  db=getDatabasePool();await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');for(const f of (await readdir('db/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.query(await readFile('db/migrations/'+f,'utf8'));
  for(const c of [employee,other]){await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)',[c.user.id,c.user.name,c.user.email]);await db.query("INSERT INTO workspace_memberships(id,workspace_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')",[randomUUID(),ws,c.user.id]);}
 },30000);
 beforeEach(async()=>{await db.query('TRUNCATE assistant_documents,assistant_chat_threads CASCADE');await db.query("UPDATE workspace_memberships SET status='active'");});
 afterAll(async()=>{await db?.end();delete (globalThis as {tailoredAgentsDatabasePool?:Pool}).tailoredAgentsDatabasePool;vi.unstubAllEnvs();});
 async function file(c=employee){const doc=await storeDocument(c,{idempotency:randomUUID(),name:'discovery.txt',bytes:Buffer.from('Customer asked about document automation.\nBudget is not confirmed.')});await processDocuments(1,doc.id);return doc;}
 async function turn(c=employee){const thread=randomUUID(),id=randomUUID(),grant=randomUUID();await db.query("INSERT INTO assistant_clients(id,name,redirect_uris) VALUES('document-tests','Tests','[]') ON CONFLICT DO NOTHING");await db.query(`INSERT INTO "session"(id,"userId",token,"expiresAt") VALUES($1,$2,$3,now()+interval '1 day')`,[id,c.user.id,randomUUID()]);await db.query("INSERT INTO assistant_grants(id,client_id,workspace_id,user_id,session_id,scopes,resource,expires_at) VALUES($1,'document-tests',$2,$3,$4,ARRAY['operations:read'],'http://localhost:3162/api/mcp/operations',now()+interval '1 day')",[grant,ws,c.user.id,id]);await db.query('INSERT INTO assistant_chat_threads(id,workspace_id,user_id,title) VALUES($1,$2,$3,$4)',[thread,ws,c.user.id,'Document work']);await db.query("INSERT INTO assistant_chat_turns(id,thread_id,grant_id,user_message,status,engine_state) VALUES($1,$2,$3,'Summarize','queued','{\"sourceText\":\"cached private text\"}')",[id,thread,grant]);return id;}
 it('encrypts saved bytes, defaults to private, and exposes only authorized sources',async()=>{
  const doc=await file();const raw=(await db.query('SELECT bytes_encrypted FROM assistant_documents WHERE id=$1',[doc.id])).rows[0].bytes_encrypted;expect(raw.toString()).not.toContain('Customer asked');expect((await readDocument(employee,doc.id)).chunks[0].text).toContain('document automation');expect((await documentDownload(employee,doc.id)).bytes.toString()).toContain('Budget is not confirmed');await expect(readDocument(other,doc.id)).rejects.toThrow('unavailable');await expect(readDocument({...employee,workspace:{...employee.workspace,id:randomUUID()}},doc.id)).rejects.toThrow();
 });
 it('shares explicitly, rejects stale edits, and removes access after withdrawal',async()=>{
  const doc=await file();await controlDocument(employee,doc.id,{operation:'share',revision:1,audience:'employees',employees:[other.user.id]});expect((await readDocument(other,doc.id)).document.owned).toBe(false);await expect(controlDocument(employee,doc.id,{operation:'share',revision:1,audience:'workspace'})).rejects.toThrow('changed');await controlDocument(employee,doc.id,{operation:'share',revision:2,audience:'private'});await expect(documentDownload(other,doc.id)).rejects.toThrow();
 });
 it('searches extracted text with current sharing and recovers an expired extraction lease',async()=>{
  const first=await storeDocument(employee,{idempotency:randomUUID(),name:'first.txt',bytes:Buffer.from('Customer wants document automation.')}),second=await storeDocument(employee,{idempotency:randomUUID(),name:'second.txt',bytes:Buffer.from('Schedule discovery')});
  await db.query("UPDATE assistant_documents SET status='processing',lease_token=$2,lease_until=now()+interval '1 minute',attempts=1 WHERE id=$1",[first.id,randomUUID()]);expect((await processDocuments(1,second.id)).checked).toBe(0);await db.query("UPDATE assistant_documents SET lease_until=now()-interval '1 minute' WHERE id=$1",[first.id]);expect((await processDocuments(2)).checked).toBe(2);
  expect((await listDocuments(employee,'automation')).items.map(d=>d.id)).toEqual([first.id]);expect((await listDocuments(other,'automation')).items).toHaveLength(0);await controlDocument(employee,first.id,{operation:'share',revision:1,audience:'workspace'});expect((await listDocuments(other,'automation')).items[0].id).toBe(first.id);
 });
 it('stops work and erases derived files and text when a source is deleted',async()=>{
  const doc=await file(),id=await turn();await recordDocumentUse(employee,doc.id,id);const generated=await exportDocument(employee,id,{...sample,format:'docx',sources:[{id:doc.id,chunk:'c1'}]});expect(generated.status).toBe('ready');expect((await exportDocument(employee,id,{...sample,format:'docx',sources:[{id:doc.id,chunk:'c1'}]})).id).toBe(generated.id);
  await controlDocument(employee,doc.id,{operation:'delete',revision:1});await expect(documentDownload(employee,generated.id)).rejects.toThrow();expect((await db.query('SELECT count(*)::int n FROM assistant_document_chunks')).rows[0].n).toBe(0);expect((await db.query('SELECT status,engine_state FROM assistant_chat_turns WHERE id=$1',[id])).rows[0]).toMatchObject({status:'interrupted',engine_state:null});expect((await db.query('SELECT count(*)::int n FROM assistant_documents WHERE bytes_encrypted IS NOT NULL')).rows[0].n).toBe(0);
 });
 it('rechecks source permissions through multiple generations of results',async()=>{
  const source=await file();await controlDocument(employee,source.id,{operation:'share',revision:1,audience:'workspace'});const id=await turn(other),first=await exportDocument(other,id,{...sample,format:'docx',sources:[{id:source.id,chunk:'c1'}]}),second=await exportDocument(other,id,{...sample,title:'Second generation',format:'pdf',sources:[{id:first.id,chunk:'c1'}]});await controlDocument(employee,source.id,{operation:'share',revision:2,audience:'private'});await expect(readDocument(other,second.id)).rejects.toThrow();
 });
 it('expires uploads and rejects suspended access, unfinished attachments and reused upload keys',async()=>{
  const key=randomUUID(),input={idempotency:key,name:'notes.txt',bytes:Buffer.from('Private note')},doc=await storeDocument(employee,input);expect((await storeDocument(employee,input)).id).toBe(doc.id);await expect(storeDocument(employee,{...input,bytes:Buffer.from('Different note')})).rejects.toThrow('identifier');await expect(validateDocumentAttachments(employee,[doc.id])).rejects.toThrow('processing');await processDocuments(1,doc.id);await db.query("UPDATE workspace_memberships SET status='suspended' WHERE user_id=$1",[employee.user.id]);await expect(documentDownload(employee,doc.id)).rejects.toThrow();await db.query("UPDATE assistant_documents SET expires_at=now()-interval '1 day' WHERE id=$1",[doc.id]);await expireDocuments();expect((await db.query('SELECT bytes_encrypted,status FROM assistant_documents WHERE id=$1',[doc.id])).rows[0]).toMatchObject({bytes_encrypted:null,status:'deleted'});
 });
 it('records parser errors as failed uploads and never charges AI for extraction',async()=>{
  const doc=await storeDocument(employee,{idempotency:randomUUID(),name:'bad.pdf',bytes:Buffer.from('not a PDF')});await processDocuments(1,doc.id);expect((await readDocument(employee,doc.id)).document.status).toBe('failed');expect((await db.query('SELECT count(*)::int n FROM assistant_chat_requests')).rows[0].n).toBe(0);
 });
});
