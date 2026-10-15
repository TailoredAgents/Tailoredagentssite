import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {hashPassword,validatePassword} from '../src/lib/server/password';
const args=process.argv.slice(2);
const option=(name:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const email=option('--email'),env=option('--env'),local=args.includes('--local');
if(!email||!/^[^\s@']+@[^\s@']+$/.test(email)||(!local&&!['staging','production'].includes(env??''))||(local&&env)){
 console.error('Usage: npm run recover-owner -- --email owner@tailoredagents.com --env production\nFor local testing use --local instead of --env.');process.exit(1);
}
async function hiddenPassword():Promise<string>{
 if(!process.stdin.isTTY)throw new Error('Use a terminal, or --password-file with a private local file.');
 process.stdout.write('New temporary password (12–128 characters; hidden): ');
 return new Promise((resolve,reject)=>{
  let value='';process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
  const finish=()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',read);process.stdout.write('\n');};
  const read=(chunk:string)=>{for(const c of chunk){if(c==='\u0003'){finish();reject(new Error('Cancelled'));return;}if(c==='\r'||c==='\n'){finish();resolve(value);return;}if(c==='\u007f'){value=value.slice(0,-1);}else if(c>=' ')value+=c;}};
  process.stdin.on('data',read);
 });
}
const passwordFile=option('--password-file');
const password=passwordFile?(await readFile(passwordFile,'utf8')).replace(/\r?\n$/,''):await hiddenPassword();
validatePassword(password);const hash=await hashPassword(password);
const directory=await mkdtemp(join(tmpdir(),'tailored-owner-recovery-'));
try{
 const file=join(directory,'recovery.sql');
 const owner=`SELECT id FROM users WHERE email='${email.toLowerCase()}' AND is_admin=1`;
 const command=['node_modules/wrangler/bin/wrangler.js','d1','execute','DB',...(local?['--local']:['--remote','--env',env!])];
 // Remote --file imports report import metadata, not SELECT rows. Check the
 // intended owner separately before changing anything.
 const lookup=spawnSync(process.execPath,[...command,'--command',`SELECT id,email FROM users WHERE id IN (${owner})`,'--json'],{encoding:'utf8'});
 if(lookup.status!==0)throw new Error('Could not check the owner account. Verify Cloudflare access and the database configuration.');
 const responses=JSON.parse(lookup.stdout.slice(lookup.stdout.indexOf('[')));
 if(!responses.some((r:any)=>r.results?.some((row:any)=>row.email===email.toLowerCase())))throw new Error('No owner account matched that email address.');
 await writeFile(file,`UPDATE users SET password_hash='${hash}',must_change_password=1,disabled_at=NULL WHERE id IN (${owner});\nDELETE FROM sessions WHERE user_id IN (${owner});\nDELETE FROM api_tokens WHERE user_id IN (${owner});\nDELETE FROM oauth_grants WHERE user_id IN (${owner});\nDELETE FROM oauth_codes WHERE user_id IN (${owner});\n`,{mode:0o600});
 const result=spawnSync(process.execPath,[...command,'--file',file,'--json'],{encoding:'utf8'});
 if(result.status!==0)throw new Error('Recovery command failed. Verify Cloudflare access and the database configuration.');
 console.log('Owner password reset. Existing sessions are closed. Sign in and choose a new password.');
}finally{await rm(directory,{recursive:true,force:true});}
