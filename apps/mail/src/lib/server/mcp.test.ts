import {recoverOutgoing} from './outgoing-recovery';
import {confirmDeletion} from './mcp-deletion';
import {revokeClientForUser} from './oauth';
import {issueGrant,getUserByOAuthToken} from './oauth';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { R2Bucket } from '@cloudflare/workers-types';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { User } from '$lib/types';
import type { EmailProvider } from './email-provider';
import { createMcpServer } from './mcp';
import type { OutboundMailInput } from './send-mail';
import { createTestDb, insertTestUser } from './test-db';

const user: User = {
	id: 'user-1',
	email: 'ada@example.com',
	name: 'Ada',
	is_admin: false,
	must_change_password: false,
	created_at: '2026-01-01T00:00:00.000Z'
};

async function connect(options: { sendEnabled?: boolean; scopes?: string[]; sendFailure?: boolean } = {}) {
	const { db, sqlite } = createTestDb();
	insertTestUser(sqlite, user.id);
	sqlite.query(`INSERT INTO domains (id, name) VALUES ('dom-1', 'example.com')`).run();
	sqlite
		.query(
			`INSERT INTO addresses (id, user_id, domain_id, address, is_default)
			 VALUES ('addr-1', ?, 'dom-1', 'ada@example.com', 1)`
		)
		.run(user.id);
	const insert = sqlite.query(
		`INSERT INTO emails (id, user_id, direction, from_addr, to_addr, subject, thread_id, created_at)
		 VALUES (?, ?, 'inbound', 'sam@other.test', 'ada@example.com', 'Plans', 'm1', ?)`
	);
	insert.run('m1', user.id, '2026-09-01 10:00:00');

	const objects=new Map<string,string|Uint8Array>();
 const bucket={put:async(k:string,v:string|Uint8Array)=>{objects.set(k,v);},get:async(k:string)=>{
 const v=objects.get(k);if(v===undefined)return null;
 return {json:async()=>JSON.parse(String(v)),arrayBuffer:async()=>typeof v==='string'?new TextEncoder().encode(v).buffer:v.buffer};
 },head:async(k:string)=>objects.has(k)?{}:null,list:async()=>({objects:[],truncated:false})} as unknown as R2Bucket;
 sqlite.query("INSERT INTO oauth_clients(client_id,client_name,redirect_uris,created_at) VALUES('test-client','Test','[]',datetime('now'))").run();
 const token=await issueGrant(db,{clientId:'test-client',userId:user.id,scope:(options.scopes??['mail:read','mail:send','mail:manage']) as any,resource:'https://mail.example.com/mcp'});
 const auth=await getUserByOAuthToken(db,token.access_token,'https://mail.example.com/mcp');
 const sent: OutboundMailInput[] = [];
	const provider = {
		kind: 'cloudflare',
		async send(input: OutboundMailInput) {
			sent.push(input);
            if(options.sendFailure) throw new Error('Simulated ambiguous provider result');
			return { providerId: `provider-${sent.length}` };
		}
	} as unknown as EmailProvider;

	const server = createMcpServer({
		db,
		bucket,
		authorization:{familyId:auth!.familyId,resource:'https://mail.example.com/mcp'},
		provider: () => provider,
		user,
		scopes: options.scopes ?? ['mail:read', 'mail:send','mail:manage'],
		origin: 'https://mail.example.com',
		sendPolicy: { enabled: options.sendEnabled ?? true, dailyLimit: 100 }
	});
	const client = new Client({ name: 'test', version: '1.0.0' });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

	const call = async (name: string, args: Record<string, unknown>) => {
		const result = (await client.callTool({ name, arguments: args })) as {
			content: { text: string }[];
			isError?: boolean;
		};
		const text = result.content[0]?.text ?? '';
		return { isError: Boolean(result.isError), text, json: () => JSON.parse(text) };
	};
	const addInbound = (id: string, at: string) => insert.run(id, user.id, at);
	/** A reply sent from the web app, outside this MCP session. */
	const addOutbound = (id: string, at: string) =>
		sqlite
			.query(
				`INSERT INTO emails (id, user_id, direction, from_addr, to_addr, subject, thread_id, created_at)
				 VALUES (?, ?, 'outbound', 'ada@example.com', 'sam@other.test', 'Re: Plans', 'm1', ?)`
			)
			.run(id, user.id, at);
	return { client, call, sent, addInbound, addOutbound, db, sqlite, bucket, objects, auth, token };
}

describe('hosted MCP tools', () => {
	test('marks read tools read-only and send tools as irreversible', async () => {
		const { client } = await connect();
		const { tools } = await client.listTools();
		const byName = new Map(tools.map((tool) => [tool.name, tool.annotations ?? {}]));

		for (const name of ['whoami', 'list_threads', 'search_mail', 'list_attachments', 'list_labels']) {
			assert.equal(byName.get(name)?.readOnlyHint, true, name);
		}
		for (const name of ['send_message', 'reply']) {
			assert.equal(byName.get(name)?.destructiveHint, true, name);
		}
	});

	test('reply has no way to add recipients beyond the reviewed target', async () => {
		const { client } = await connect();
		const reply = (await client.listTools()).tools.find((tool) => tool.name === 'reply');
		const fields = Object.keys(reply?.inputSchema.properties ?? {});

		assert.ok(fields.includes('expected_recipients'));
		for (const field of ['to', 'cc', 'bcc']) assert.ok(!fields.includes(field), field);
	});

	test('the instance switch removes the send tools but keeps triage', async () => {
		const { client } = await connect({ sendEnabled: false });
		const names = (await client.listTools()).tools.map((tool) => tool.name);

		assert.ok(!names.includes('send_message'));
		assert.ok(!names.includes('reply'));
		assert.ok(names.includes('update_thread'));
	});

	test('get_thread tells the agent where a reply would go', async () => {
		const { call } = await connect();
		const thread = (await call('get_thread', { id: 'm1' })).json();

		assert.deepEqual(thread.messages[0].reply_target, ['sam@other.test']);
	});

	test('authorized MCP sends once through durable outbox; retries replay', async () => {
		const { call, sent } = await connect();
		const args = {
			id: 'm1',
			expected_recipients: ['sam@other.test'],
			text: 'Thursday works.',
			idempotency_key: 'reply-key-0001'
		};

		const first = await call('reply', args);
		const retry = await call('reply', args);

		assert.equal(first.isError, false, first.text);
		assert.equal(retry.isError, false, retry.text);
		assert.equal(sent.length, 1);
	});

	test('reply refuses once a newer message arrived', async () => {
		const { call, sent, addInbound } = await connect();
		addInbound('m2', '2026-09-01 12:00:00');

		const result = await call('reply', {
			id: 'm1',
			expected_recipients: ['sam@other.test'],
			text: 'Thursday works.',
			idempotency_key: 'reply-key-0002'
		});

		assert.equal(result.isError, true);
		assert.equal(result.json().error.code, 'conversation_advanced');
		assert.equal(sent.length, 0);
	});

	test('reply refuses once the person already answered from the web app', async () => {
		const { call, sent, addOutbound } = await connect();
		addOutbound('m2', '2026-09-01 11:00:00');

		const result = await call('reply', {
			id: 'm1',
			expected_recipients: ['sam@other.test'],
			text: 'Thursday works.',
			idempotency_key: 'reply-key-0004'
		});

		assert.equal(result.json().error.code, 'conversation_advanced');
		assert.equal(sent.length, 0);
	});

	test('reply refuses recipients the agent was not shown', async () => {
		const { call, sent } = await connect();

		const result = await call('reply', {
			id: 'm1',
			expected_recipients: ['attacker@evil.test'],
			text: 'Here are the files.',
			idempotency_key: 'reply-key-0003'
		});

		assert.equal(result.json().error.code, 'recipient_changed');
		assert.equal(sent.length, 0);
	});
});


test('read-only grants cannot send or mutate; passive reads preserve all mailbox flags',async()=>{
 const {client,call,sqlite,sent}=await connect({scopes:['mail:read']});
 const names=(await client.listTools()).tools.map(t=>t.name);
 for(const name of ['send_message','reply','forward','send_draft','save_draft','update_thread','manage_label','request_permanent_delete']) assert.ok(!names.includes(name),name);
 const before=sqlite.query("SELECT * FROM emails WHERE id='m1'").all();
 for(const name of ['get_thread','list_attachments']) assert.equal((await call(name,{id:'m1'})).isError,false);
 await call('search_mail',{q:'Plans'});await call('list_threads',{view:'inbox'});
 assert.deepEqual(sqlite.query("SELECT * FROM emails WHERE id='m1'").all(),before);
 assert.equal((await call('get_thread',{id:'m1',markRead:true})).isError,true);
 assert.equal((await call('send_message',{to:'x@example.com',subject:'No',text:'No',idempotency_key:'readonly-test'})).isError,true);
 assert.equal(sent.length,0);
});

test('mail:send does not grant mailbox management; mail:manage does not grant sending',async()=>{
 for(const scopes of [['mail:send'],['mail:manage']]) {
  const {client}=await connect({scopes});const names=(await client.listTools()).tools.map(t=>t.name);
  assert.equal(names.includes('update_thread'),scopes.includes('mail:manage'));
  assert.equal(names.includes('send_message'),scopes.includes('mail:send'));
  assert.equal(names.includes('get_thread'),false);
 }
});

test('cross-user message, thread, sender, draft and attachment access is denied',async()=>{
 const {call,sqlite,sent}=await connect();insertTestUser(sqlite,'other');
 sqlite.query("INSERT INTO addresses(id,user_id,domain_id,address) VALUES('other-address','other','dom-1','other@example.com')").run();
 sqlite.query("INSERT INTO emails(id,user_id,direction,from_addr,to_addr,subject,thread_id) VALUES('other-message','other','inbound','secret@other.test','other@example.com','Secret','other-message')").run();
 sqlite.query("INSERT INTO email_attachments(id,email_id,filename,content_type,size_bytes,content_base64) VALUES('secret-file','other-message','secret.txt','text/plain',6,'c2VjcmV0')").run();
 for(const name of ['get_thread','get_message_body','list_attachments']) assert.equal((await call(name,{id:'other-message'})).isError,true,name);
 assert.equal((await call('get_attachment',{email_id:'other-message',attachment_id:'secret-file'})).isError,true);
 assert.equal((await call('get_attachment',{email_id:'m1',attachment_id:'secret-file'})).isError,true);
 assert.equal((await call('update_thread',{id:'other-message',isRead:true})).isError,true);
 assert.equal((await call('save_draft',{id:'other-message',subject:'Overwrite',text:'No'})).isError,true);
 assert.equal((await call('send_message',{fromAddressId:'other-address',to:'x@example.com',subject:'No',text:'No',idempotency_key:'cross-user-send'})).isError,true);
 assert.equal(sent.length,0);
 assert.equal(sqlite.query("SELECT is_read FROM emails WHERE id='other-message'").all()[0].is_read,0);
});

test('R2 bodies and attachments are paginated, searches show latest response in both folders',async()=>{
 const {call,sqlite,objects,addOutbound}=await connect();
 objects.set('body.json',JSON.stringify({text:'A'.repeat(25000)+'tail',html:'<p>full</p>'}));
 sqlite.query("UPDATE emails SET body_text='excerpt',content_key='body.json' WHERE id='m1'").run();
 const thread=(await call('get_thread',{id:'m1',markRead:false})).json();
 assert.equal(thread.messages[0].body_text.length,20000);assert.equal(thread.messages[0].body_truncated,true);
 const tail=(await call('get_message_body',{id:'m1',offset:20000})).json();assert.equal(tail.content,'A'.repeat(5000)+'tail');assert.equal(tail.next_offset,null);
 sqlite.query("INSERT INTO email_attachments(id,email_id,filename,content_type,size_bytes,storage_key,content_base64) VALUES('file','m1','large.txt','text/plain',70000,'attachment','')").run();objects.set('attachment',new Uint8Array(70000).fill(65));
 const chunk=(await call('get_attachment',{email_id:'m1',attachment_id:'file'})).json();assert.equal(chunk.next_offset,65536);assert.equal(Buffer.from(chunk.content,'base64').length,65536);
 const end=(await call('get_attachment',{email_id:'m1',attachment_id:'file',offset:65536})).json();assert.equal(end.next_offset,null);assert.equal(Buffer.from(end.content,'base64').length,4464);
 addOutbound('reply','2026-09-01 12:00:00');
 for(const view of ['inbox','sent']) {const page=(await call('search_mail',{q:'Plans',view})).json();assert.equal(page.threads[0].last_message.direction,'outbound');assert.equal(page.threads[0].last_message.from_addr,'ada@example.com');}
 objects.delete('body.json');assert.equal((await call('get_thread',{id:'m1'})).isError,true);
});

test('explicit mailbox actions support unread, archive, trash, restoration and labels',async()=>{
 const {call,sqlite}=await connect();
 for(const flags of [{isRead:true,archived:true},{isRead:false,archived:false},{trashed:true},{trashed:false}]) assert.equal((await call('update_thread',{id:'m1',...flags})).isError,false);
 const row=sqlite.query("SELECT is_read,archived_at,deleted_at FROM emails WHERE id='m1'").all()[0];assert.deepEqual(row,{is_read:0,archived_at:null,deleted_at:null});
 const label=(await call('manage_label',{action:'create',name:'Prospect'})).json().label;
 assert.equal((await call('set_thread_labels',{id:'m1',labelIds:[label.id]})).isError,false);
 assert.equal((await call('manage_label',{action:'update',id:label.id,name:'Client'})).json().label.name,'Client');
 assert.equal((await call('manage_label',{action:'delete',id:label.id})).isError,false);assert.equal(sqlite.query('SELECT * FROM email_labels').all().length,0);
});

test('draft lifecycle preserves omitted content; sending a reviewed revision is idempotent',async()=>{
 const {call,sent}=await connect();
 assert.equal((await call('save_draft',{id:'draft1',to:'sam@other.test',subject:'Draft',text:'Original body'})).isError,false);
 assert.equal((await call('save_draft',{id:'draft1',subject:'Revised'})).isError,false);
 const draft=(await call('get_draft',{id:'draft1'})).json();assert.equal(draft.text,'Original body');assert.equal(draft.subject,'Revised');
 assert.equal((await call('send_draft',{id:'draft1',revision:'stale',idempotency_key:'draft-send-key'})).isError,true);
 const args={id:'draft1',revision:draft.draft_revision,idempotency_key:'draft-send-key'};
 const first=await call('send_draft',args);assert.equal(first.isError,false,first.text);assert.equal((await call('send_draft',args)).isError,false);assert.equal(sent.length,1);
 assert.equal((await call('restore_message',{id:'draft1'})).isError,false);
 assert.equal((await call('delete_draft',{id:'draft1'})).isError,false);
});

test('reply honors Reply-To and preserves threading headers; forwards start a new conversation',async()=>{
 const {call,sqlite,sent}=await connect();
 sqlite.query("UPDATE emails SET reply_to_addr='reply@other.test',message_id='original@other.test',references_header='<older@other.test>',body_text='Original' WHERE id='m1'").run();
 const reply=await call('reply',{id:'m1',expected_recipients:['reply@other.test'],text:'Answer',idempotency_key:'thread-reply-key'});assert.equal(reply.isError,false,reply.text);
 assert.deepEqual(sent[0].to,['reply@other.test']);assert.equal(sent[0].headers?.['In-Reply-To'],'<original@other.test>');assert.match(sent[0].headers?.References??'',/older@other.test/);
 const forward=await call('forward',{id:'m1',to:'new@other.test',text:'For review',idempotency_key:'forward-test-key'});assert.equal(forward.isError,false,forward.text);
 assert.match(sent[1].text,/Original/);assert.equal(sent[1].headers?.['In-Reply-To'],undefined);
});

test('revoked send grant blocks delivery; permanent deletion requires owner confirmation',async()=>{
 const {call,db,sqlite,sent}=await connect();
 assert.equal((await call('request_permanent_delete',{id:'m1'})).isError,true);
 await call('update_thread',{id:'m1',trashed:true});
 const pending=(await call('request_permanent_delete',{id:'m1'})).json();const requestId=pending.url.split('/').pop();
 assert.ok(sqlite.query("SELECT id FROM emails WHERE id='m1'").all().length);
 await assert.rejects(confirmDeletion(db,undefined,'other',requestId));
 assert.equal(await confirmDeletion(db,undefined,user.id,requestId),1);
 await assert.rejects(confirmDeletion(db,undefined,user.id,requestId));
 await revokeClientForUser(db,user.id,'test-client');
 assert.equal((await call('send_message',{to:'x@example.com',subject:'No',text:'No',idempotency_key:'revoked-send'})).isError,true);assert.equal(sent.length,0);
});


test('uncertain MCP sends stay deduplicated and recovery cannot resend after disconnect',async()=>{
 const {call,db,sqlite,bucket,sent}=await connect({sendFailure:true});
 const input={to:'sam@other.test',subject:'Mock only',text:'Never sent externally',idempotency_key:'uncertain-test-key'};
 assert.equal((await call('send_message',input)).isError,true);
 assert.equal((await call('send_message',input)).isError,true);assert.equal(sent.length,1);
 const attempt=sqlite.query('SELECT id FROM send_attempts').all()[0];
 sqlite.query("UPDATE send_attempts SET updated_at=datetime('now','-10 minutes') WHERE id=?").run(attempt.id);
 await revokeClientForUser(db,user.id,'test-client');
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('Unexpected network in test');};
 try{await recoverOutgoing({DB:db,ATTACHMENTS:bucket,RESEND_API_KEY:'fake-local-test',MAIL_DOMAIN:'example.com',APP_URL:'https://mail.example.com',API_SEND_ENABLED:'true'});}finally{globalThis.fetch=originalFetch;}
 assert.equal(calls,0);assert.equal(sqlite.query('SELECT status FROM send_attempts').all()[0].status,'sending');
});
