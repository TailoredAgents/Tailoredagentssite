import 'server-only';
import type {PoolClient} from 'pg';
export async function statementSettlementData(db:PoolClient,id:string,total:number){
 const applied=Number((await db.query('SELECT COALESCE(sum(amount_cents),0) amount FROM crm_commission_settlements WHERE statement_id=$1',[id])).rows[0].amount);
 const entries=(await db.query('SELECT s.*,EXISTS(SELECT 1 FROM crm_commission_settlements r WHERE r.reverses_id=s.id) reversed FROM crm_commission_settlements s WHERE statement_id=$1 ORDER BY created_at DESC,id LIMIT 101',[id])).rows;
 const notes=(await db.query("SELECT n.*,EXISTS(SELECT 1 FROM crm_commission_statement_notes r WHERE r.resolves_id=n.id) resolved FROM crm_commission_statement_notes n WHERE statement_id=$1 ORDER BY (kind='dispute' AND NOT EXISTS(SELECT 1 FROM crm_commission_statement_notes r WHERE r.resolves_id=n.id)) DESC,created_at DESC,id LIMIT 101",[id])).rows;
 const disputes=(await db.query("SELECT n.id FROM crm_commission_statement_notes n WHERE n.statement_id=$1 AND kind='dispute' AND NOT EXISTS(SELECT 1 FROM crm_commission_statement_notes r WHERE r.resolves_id=n.id)",[id])).rows;
 return {appliedCents:applied,outstandingCents:total-applied,entries:entries.slice(0,100),notes:notes.slice(0,100),openDisputes:disputes.map(r=>r.id as string),truncated:entries.length>100||notes.length>100};
}
