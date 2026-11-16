import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {workTransaction,once} from '@/lib/relationships/transactions';
import {commercialAccess} from '@/lib/commercial/access';
import {SalesAccessError} from '@/lib/sales/data';
import {businessDateKey} from '@/lib/time';
import {validateCommissionStatementSources} from './service';
import {statementSettlementData} from './settlement-data';
const evidence=z.string().trim().min(10).max(4000),reference=z.string().trim().min(10).max(1000),amount=z.number().int().positive().max(1_000_000_000_000);
const base=z.object({requestId:z.uuid(),id:z.uuid(),revision:z.number().int().positive(),expectedTotalCents:z.number().safe(),evidence});
export const settlementInput=base.extend({amountCents:amount.optional(),settledOn:z.iso.date(),reference}).strict();
export const offsetInput=base.extend({creditId:z.uuid(),creditRevision:z.number().int().positive(),amountCents:amount,settledOn:z.iso.date(),reference}).strict();
export const reversalInput=base.extend({settlementId:z.uuid(),settledOn:z.iso.date(),reference}).strict();
export const statementNoteInput=base.extend({kind:z.enum(['delivery','dispute','resolution']),resolvesId:z.uuid().optional(),occurredOn:z.iso.date(),reference}).strict();
const fail=(s:string):never=>{throw new SalesAccessError(s);};
async function statement(db:PoolClient,c:DashboardContext,id:string){const s=(await db.query("SELECT * FROM crm_referral_statements WHERE workspace_id=$1 AND id=$2 AND program='recurring' FOR UPDATE",[c.workspace.id,id])).rows[0];if(!s)fail('That recurring statement is unavailable.');return s;}
function current(s:Record<string,any>,v:z.infer<typeof base>){if(s.revision!==v.revision||Number(s.total_cents)!==v.expectedTotalCents)fail('Review the current statement revision and exact total.');}
function date(value:string){if(value>businessDateKey())fail('Record an actual past or present event date.');}
async function eligible(db:PoolClient,c:DashboardContext,s:Record<string,any>){
 if(!['approved','paid'].includes(s.status))fail('Only approved statements can be settled.');
 const d=await statementSettlementData(db,s.id,Number(s.total_cents));if(d.openDisputes.length)fail('Resolve the recorded statement dispute before settlement.');
 await validateCommissionStatementSources(db,c,s.id);return d;
}
async function event(db:PoolClient,c:DashboardContext,s:Record<string,any>,note:string,ref:string){
 const d=await statementSettlementData(db,s.id,Number(s.total_cents));
 const status=Number(s.total_cents)>0?(d.outstandingCents===0?'paid':'approved'):s.status;
 await db.query('UPDATE crm_referral_statements SET status=$2,revision=revision+1,payment_reference=$3 WHERE id=$1',[s.id,status,status==='paid'?ref:s.payment_reference]);
 await db.query('INSERT INTO crm_referral_statement_events(id,statement_id,actor_user_id,status,note) VALUES($1,$2,$3,$4,$5)',[randomUUID(),s.id,c.user.id,status,note]);return {id:s.id,status,outstandingCents:d.outstandingCents,moneyMoved:false};
}
export async function recordStatementSettlement(c:DashboardContext,input:unknown){const v=settlementInput.parse(input);date(v.settledOn);return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'statement_settlement',v.requestId,v,async()=>{
 const s=await statement(db,c,v.id);current(s,v);const d=await eligible(db,c,s),cents=v.amountCents??d.outstandingCents;
 if(Number(s.total_cents)<=0||!Number.isSafeInteger(cents)||cents<=0||cents>d.outstandingCents)fail('Payment must be positive and no greater than the remaining approved balance.');
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`settlement-reference:${c.workspace.id}:${s.mode}:${v.reference}`]);
 if((await db.query("SELECT 1 FROM crm_commission_settlements p JOIN crm_referral_statements s ON s.id=p.statement_id WHERE p.workspace_id=$1 AND s.mode=$2 AND p.reference=$3 AND p.kind IN ('payment','legacy_payment') AND NOT EXISTS(SELECT 1 FROM crm_commission_settlements r WHERE r.reverses_id=p.id)",[c.workspace.id,s.mode,v.reference])).rowCount)fail('That external payment reference was already recorded. Reconcile the original payment instead of duplicating it.');
 await db.query("INSERT INTO crm_commission_settlements(id,workspace_id,statement_id,kind,amount_cents,group_id,settled_on,reference,evidence,created_by) VALUES($1,$2,$3,'payment',$4,$5,$6,$7,$8,$9)",[randomUUID(),c.workspace.id,s.id,cents,randomUUID(),v.settledOn,v.reference,v.evidence,c.user.id]);
 return event(db,c,s,v.evidence,v.reference);
});});}
export async function offsetCommissionStatements(c:DashboardContext,input:unknown){const v=offsetInput.parse(input);date(v.settledOn);if(v.id===v.creditId)fail('Choose a different credit statement.');return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'statement_offset',v.requestId,v,async()=>{
 const rows=[];for(const id of [v.id,v.creditId].sort())rows.push(await statement(db,c,id));const s=rows.find(s=>s.id===v.id)!,credit=rows.find(s=>s.id===v.creditId)!;current(s,v);
 if(credit.revision!==v.creditRevision||credit.recipient_id!==s.recipient_id||credit.mode!==s.mode||Number(s.total_cents)<=0||Number(credit.total_cents)>=0)fail('Offset only the same recipient and mode, with current positive and negative statements.');
 const positive=await eligible(db,c,s),negative=await eligible(db,c,credit);if(v.amountCents>positive.outstandingCents||v.amountCents>-negative.outstandingCents)fail('The offset exceeds an available statement balance.');
 const group=randomUUID();for(const [row,cents] of [[s,v.amountCents],[credit,-v.amountCents]] as const)await db.query("INSERT INTO crm_commission_settlements(id,workspace_id,statement_id,kind,amount_cents,group_id,settled_on,reference,evidence,created_by) VALUES($1,$2,$3,'offset',$4,$5,$6,$7,$8,$9)",[randomUUID(),c.workspace.id,row.id,cents,group,v.settledOn,v.reference,v.evidence,c.user.id]);
 const result=await event(db,c,s,v.evidence,v.reference);await event(db,c,credit,v.evidence,v.reference);return result;
});});}
export async function reverseStatementSettlement(c:DashboardContext,input:unknown){const v=reversalInput.parse(input);date(v.settledOn);return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'statement_settlement_reversal',v.requestId,v,async()=>{
 const first=(await db.query('SELECT * FROM crm_commission_settlements WHERE workspace_id=$1 AND statement_id=$2 AND id=$3',[c.workspace.id,v.id,v.settlementId])).rows[0];if(!first||first.kind==='reversal')fail('Choose an original settlement to correct.');
 const entries=(await db.query("SELECT * FROM crm_commission_settlements WHERE workspace_id=$1 AND group_id=$2 AND kind<>'reversal' ORDER BY statement_id",[c.workspace.id,first.group_id])).rows;
 const rows=[];for(const e of entries)rows.push(await statement(db,c,e.statement_id));const s=rows.find(s=>s.id===v.id)!;current(s,v);
 if((await db.query('SELECT 1 FROM crm_commission_settlements WHERE reverses_id=ANY($1::uuid[])',[entries.map(e=>e.id)])).rowCount)fail('This settlement was already reversed.');
 if(entries.some(e=>new Date(e.settled_on).toISOString().slice(0,10)>v.settledOn))fail('A correction cannot precede the original settlement.');
 // Correcting a recorded payment is allowed even when sources are now disputed;
 // it creates no payment and releases no payable. An offset reverses both sides.
 const group=randomUUID();for(const e of entries)await db.query("INSERT INTO crm_commission_settlements(id,workspace_id,statement_id,kind,amount_cents,group_id,reverses_id,settled_on,reference,evidence,created_by) VALUES($1,$2,$3,'reversal',$4,$5,$6,$7,$8,$9,$10)",[randomUUID(),c.workspace.id,e.statement_id,-Number(e.amount_cents),group,e.id,v.settledOn,v.reference,v.evidence,c.user.id]);
 let result;for(const row of rows){const out=await event(db,c,row,v.evidence,v.reference);if(row.id===v.id)result=out;}return result!;
});});}
export async function recordStatementNote(c:DashboardContext,input:unknown){const v=statementNoteInput.parse(input);date(v.occurredOn);return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'statement_note',v.requestId,v,async()=>{
 const s=await statement(db,c,v.id);current(s,v);if(s.status==='void')fail('A void statement cannot receive operational events.');
 if(v.kind==='resolution'){
  if(!v.resolvesId)fail('Choose the specific open dispute.');const dispute=(await db.query("SELECT * FROM crm_commission_statement_notes WHERE workspace_id=$1 AND statement_id=$2 AND id=$3 AND kind='dispute'",[c.workspace.id,s.id,v.resolvesId])).rows[0];
  if(!dispute||new Date(dispute.occurred_on).toISOString().slice(0,10)>v.occurredOn||(await db.query('SELECT 1 FROM crm_commission_statement_notes WHERE resolves_id=$1',[v.resolvesId])).rowCount)fail('Choose an unresolved dispute and a valid resolution date.');
 }else if(v.resolvesId)fail('Only a resolution can reference a dispute.');
 const id=randomUUID();await db.query('INSERT INTO crm_commission_statement_notes(id,workspace_id,statement_id,kind,resolves_id,occurred_on,reference,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,c.workspace.id,s.id,v.kind,v.resolvesId??null,v.occurredOn,v.reference,v.evidence,c.user.id]);
 await db.query('UPDATE crm_referral_statements SET revision=revision+1 WHERE id=$1',[s.id]);return {id,moneyMoved:false,messageSent:false};
});});}
