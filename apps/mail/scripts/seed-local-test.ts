/** Only local, disposable browser-test accounts. Never runs against Cloudflare. */
import {readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {hashPassword} from '../src/lib/server/password';
const directory='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const files=readdirSync(directory).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite');
if(files.length!==1)throw new Error('Run the local migrations first; expected one local test database.');
const db=new DatabaseSync(directory+'/'+files[0]);
const hash=await hashPassword('Local browser test password');
for(const [id,name] of [['local-owner','Alex Morgan'],['local-teammate','Taylor Chen'],['local-crm-owner','Casey Rivera']]){
 const isAdmin=id!=='local-teammate'?1:0;
 db.prepare("INSERT INTO users(id,email,name,password_hash,is_admin,must_change_password,dashboard_access) VALUES (?,?,?,?,?,0,?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,disabled_at=NULL,must_change_password=0,dashboard_access=CASE WHEN users.is_admin=1 THEN 1 ELSE users.dashboard_access END").run(id,id+'@tailoredagents.com',name,hash,isAdmin,isAdmin);
}
db.prepare("INSERT OR IGNORE INTO domains(id,name,status,sending_enabled,receiving_enabled) VALUES ('local-domain','tailoredagents.com','verified',1,1)").run();
for(const id of ['local-owner','local-teammate','local-crm-owner'])db.prepare("INSERT OR IGNORE INTO addresses(id,user_id,domain_id,address,is_default) VALUES (?,?,'local-domain',?,1)").run(id+'-address',id,id+'@tailoredagents.com');
for(const [i,name,subject,text] of [[1,'Jamie Park','Your workspace is ready','Welcome to Tailored Agents Mail. Your team now has a focused place to communicate.'],[2,'Morgan Lee','Proposal for Friday’s meeting','Hi Alex, the updated proposal is ready for your review. Could we meet on Friday?'],[3,'Taylor Chen','A quick introduction','Looking forward to working together. Let me know if there is anything I can help with.']] as const){
 db.prepare("INSERT OR IGNORE INTO emails(id,user_id,direction,from_addr,from_name,to_addr,subject,body_text,thread_id,domain_id,address_id,category,import_state) VALUES (?,?,'inbound',?,?,?,?,?,?,'local-domain','local-owner-address','primary','complete')").run('local-message-'+i,'local-owner','sender'+i+'@example.net',name,'local-owner@tailoredagents.com',subject,text,'local-message-'+i);
}
db.prepare('DELETE FROM rate_limits').run();
db.prepare('UPDATE emails SET body_html=? WHERE id=?').run('<p>Welcome to Tailored Agents Mail. This is a safe-viewer test.</p><script>parent.emailExecuted=true</script><img src="https://tracker.invalid/pixel"><form action="https://tracker.invalid"><input name="secret"></form>','local-message-1');
db.prepare("INSERT OR IGNORE INTO email_attachments(id,email_id,filename,content_type,size_bytes,content_base64) VALUES ('local-dangerous-file','local-message-1','example.html','text/html',21,?)").run(Buffer.from('<script>alert(1)</script>').toString('base64'));
db.close();console.log('Local test users and sample messages are ready. No live services were contacted.');
