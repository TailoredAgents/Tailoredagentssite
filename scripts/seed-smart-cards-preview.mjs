import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {hashPassword} from 'better-auth/crypto';
const url=new URL(process.env.DATABASE_URL||'');
if(url.hostname!=='127.0.0.1'||url.port!=='55433'||url.pathname!=='/ta_smart_cards_test')throw new Error('Only the isolated Smart Cards database is allowed.');
const pool=new pg.Pool({connectionString:url.toString()});
try{
const password=await hashPassword('Smart-cards-test-password-2026');
for(const id of ['card-owner','card-viewer']){await pool.query(`DELETE FROM account WHERE "userId"=$1`,[id]);await pool.query(`INSERT INTO account(id,"accountId","providerId","userId",password) VALUES($1,$2,'credential',$2,$3)`,[randomUUID(),id,password]);}
await pool.query('UPDATE smart_card_ai_settings SET enabled=true,monthly_limit_micros=25000000');await pool.query('TRUNCATE smart_card_ai_requests,smart_card_ai_usage,request_rate_limits,"rateLimit"');
}finally{await pool.end();}
