import 'server-only';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {insertAuditLog} from '@/lib/dashboard/db';
import {SalesAccessError} from '@/lib/sales/data';
import {relationshipIds} from '@/lib/relationships/service';
import {workTransaction,once,activeTeammate} from '@/lib/relationships/transactions';
import {partnerSchema,agreementSchema,agreementStateSchema,agreementTermsSchema,sourceSchema,reversalSchema,statementSchema,statementStateSchema,financeGrantSchema,partnerGrantSchema,earningCents} from './contract';

async function access(db:PoolClient,c:DashboardContext,role:string,partnerId?:string,write=false) {
 const admin=['owner','admin'].includes(role);
 const grant=(await db.query('SELECT permission FROM crm_finance_access WHERE workspace_id=$1 AND user_id=$2 FOR SHARE',[c.workspace.id,c.user.id])).rows[0]?.permission;
 const full=admin||!!grant,manage=admin||grant==='manage';
 const own=partnerId&&(await db.query('SELECT 1 FROM crm_partner_access WHERE workspace_id=$1 AND user_id=$2 AND partner_id=$3 FOR SHARE',[c.workspace.id,c.user.id,partnerId])).rowCount;
 if((write&&!manage)||(!full&&!own))throw new SalesAccessError('Finance access or an explicit grant for this partner is required.');
 return {admin,full,manage};
}
async function partnerExists(db:PoolClient,c:DashboardContext,id:string) {
 const p=(await db.query('SELECT id,name,organization FROM crm_referral_partners WHERE workspace_id=$1 AND id=$2',[c.workspace.id,id])).rows[0];
 if(!p)throw new SalesAccessError('That partner is unavailable.');return p;
}
async function audit(db:PoolClient,c:DashboardContext,action:string,id:string) {
 await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:`referral.${action}`,targetType:'referral_record',targetId:id});
}
export async function createPartner(c:DashboardContext,input:unknown) {
 const v=partnerSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  await access(db,c,role,undefined,true);
  return once(db,c,'partner_create',v.requestId,v,async()=>{
   const id=randomUUID();await db.query('INSERT INTO crm_referral_partners(id,workspace_id,name,organization,created_by) VALUES($1,$2,$3,$4,$5)',[id,c.workspace.id,v.name,v.organization,c.user.id]);await audit(db,c,'partner_created',id);return {id};
  });
 });
}
export async function partnersWorkspace(c:DashboardContext) {
 return workTransaction(c,false,async(db,role)=>{
  const admin=['owner','admin'].includes(role),grant=(await db.query('SELECT permission FROM crm_finance_access WHERE workspace_id=$1 AND user_id=$2',[c.workspace.id,c.user.id])).rows[0]?.permission;
  const full=admin||!!grant,manage=admin||grant==='manage';
  const partners=(await db.query(`SELECT p.id,p.name,p.organization FROM crm_referral_partners p WHERE p.workspace_id=$1 AND ($3 OR EXISTS(SELECT 1 FROM crm_partner_access a WHERE a.workspace_id=p.workspace_id AND a.partner_id=p.id AND a.user_id=$2)) ORDER BY p.name,p.id LIMIT 200`,[c.workspace.id,c.user.id,full])).rows;
  const grants=admin?(await db.query(`SELECT f.user_id,u.name,f.permission FROM crm_finance_access f JOIN "user" u ON u.id=f.user_id WHERE f.workspace_id=$1 ORDER BY u.name`,[c.workspace.id])).rows:[];
  return {admin,full,manage,partners,grants,limit:200};
 });
}
export async function partnerWorkspace(c:DashboardContext,partnerId:string) {
 return workTransaction(c,false,async(db,role)=>{
  const permission=await access(db,c,role,partnerId),partner=await partnerExists(db,c,partnerId);
  const agreements=(await db.query(`SELECT a.*,u.name activated_by_name FROM crm_referral_agreements a LEFT JOIN "user" u ON u.id=a.activated_by WHERE a.workspace_id=$1 AND a.partner_id=$2 AND ($3 OR a.status<>'draft') ORDER BY a.version DESC LIMIT 100`,[c.workspace.id,partnerId,permission.full])).rows;
  const statements=(await db.query(`SELECT * FROM crm_referral_statements WHERE workspace_id=$1 AND partner_id=$2 AND ($3 OR status IN ('approved','paid')) ORDER BY created_at DESC,id LIMIT 100`,[c.workspace.id,partnerId,permission.full])).rows;
  const earnings=(await db.query(`SELECT e.id,e.agreement_id,a.version,e.source_id,e.introduction_id,e.amount_cents::float8,e.allocation_bps,e.earned_on::text,e.eligibility_note,e.reverses_id,e.statement_id,s.source_key,s.kind,s.units,s.amount_cents::float8 source_amount_cents,s.basis,s.occurred_on::text,s.reference,cl.name client_name FROM crm_referral_earnings e JOIN crm_referral_sources s ON s.id=e.source_id AND s.workspace_id=e.workspace_id JOIN crm_referral_agreements a ON a.id=e.agreement_id AND a.workspace_id=e.workspace_id LEFT JOIN clients cl ON cl.id=s.client_id AND cl.workspace_id=s.workspace_id LEFT JOIN crm_referral_statements st ON st.id=e.statement_id AND st.workspace_id=e.workspace_id WHERE e.workspace_id=$1 AND e.partner_id=$2 AND ($3 OR st.status IN ('approved','paid')) ORDER BY e.created_at DESC,e.id LIMIT 200`,[c.workspace.id,partnerId,permission.full])).rows;
  const clients=permission.manage?(await db.query('SELECT id,name FROM clients WHERE workspace_id=$1 ORDER BY name,id LIMIT 500',[c.workspace.id])).rows:[];
  const introductions=permission.manage?(await db.query(`SELECT i.id,i.note,COALESCE(i.lead_id,i.business_id,i.opportunity_id,i.client_id,i.contact_id) target_id,CASE WHEN i.lead_id IS NOT NULL THEN 'lead' WHEN i.business_id IS NOT NULL THEN 'business' WHEN i.opportunity_id IS NOT NULL THEN 'opportunity' WHEN i.client_id IS NOT NULL THEN 'client' ELSE 'contact' END kind FROM crm_introductions i WHERE i.workspace_id=$1 AND i.partner_id=$2 ORDER BY i.created_at DESC LIMIT 500`,[c.workspace.id,partnerId])).rows:[];
  const grants=permission.admin?(await db.query(`SELECT a.user_id,u.name FROM crm_partner_access a JOIN "user" u ON u.id=a.user_id WHERE a.workspace_id=$1 AND a.partner_id=$2`,[c.workspace.id,partnerId])).rows:[];
  return {...permission,partner,agreements,statements,earnings:permission.full?earnings:earnings.map(e=>({...e,reference:undefined,eligibility_note:undefined,introduction_id:undefined})),clients,introductions,grants,limits:{agreements:100,statements:100,earnings:200,choices:500}};
 });
}
export async function changeFinanceAccess(c:DashboardContext,input:unknown) {
 const v=financeGrantSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  if(!['owner','admin'].includes(role))throw new SalesAccessError('Only a workspace owner or administrator can grant finance access.');
  return once(db,c,'finance_access',v.requestId,v,async()=>{
   if(v.permission==='revoke')await db.query('DELETE FROM crm_finance_access WHERE workspace_id=$1 AND user_id=$2',[c.workspace.id,v.userId]);
   else {await activeTeammate(db,c,v.userId);await db.query(`INSERT INTO crm_finance_access(workspace_id,user_id,permission,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,user_id) DO UPDATE SET permission=EXCLUDED.permission,granted_by=EXCLUDED.granted_by,updated_at=now()`,[c.workspace.id,v.userId,v.permission,c.user.id]);}
   await audit(db,c,'finance_access_changed',c.workspace.id);return {saved:true};
  });
 });
}
export async function changePartnerAccess(c:DashboardContext,input:unknown) {
 const v=partnerGrantSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  if(!['owner','admin'].includes(role))throw new SalesAccessError('Only a workspace owner or administrator can grant partner access.');
  await partnerExists(db,c,v.partnerId);
  return once(db,c,'partner_access',v.requestId,v,async()=>{
   if(v.allow){if(!(await db.query("SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2 AND status='active' FOR SHARE",[c.workspace.id,v.userId])).rowCount)throw new SalesAccessError('Choose an active teammate.');await db.query('INSERT INTO crm_partner_access(workspace_id,partner_id,user_id,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[c.workspace.id,v.partnerId,v.userId,c.user.id]);}
   else await db.query('DELETE FROM crm_partner_access WHERE workspace_id=$1 AND partner_id=$2 AND user_id=$3',[c.workspace.id,v.partnerId,v.userId]);
   await audit(db,c,'partner_access_changed',v.partnerId);return {saved:true};
  });
 });
}
export async function createAgreement(c:DashboardContext,input:unknown) {
 const v=agreementSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  await access(db,c,role,v.partnerId,true);await partnerExists(db,c,v.partnerId);
  return once(db,c,'agreement_create',v.requestId,v,async()=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`agreement:${v.partnerId}`]);
   const version=Number((await db.query('SELECT COALESCE(max(version),0)+1 version FROM crm_referral_agreements WHERE workspace_id=$1 AND partner_id=$2',[c.workspace.id,v.partnerId])).rows[0].version),id=randomUUID();
   await db.query('INSERT INTO crm_referral_agreements(id,workspace_id,partner_id,version,terms,created_by) VALUES($1,$2,$3,$4,$5,$6)',[id,c.workspace.id,v.partnerId,version,v.terms,c.user.id]);
   await audit(db,c,'agreement_drafted',id);return {id,version,status:'draft'};
  });
 });
}
export async function changeAgreement(c:DashboardContext,input:unknown) {
 const v=agreementStateSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  await access(db,c,role,undefined,true);
  return once(db,c,'agreement_state',v.requestId,v,async()=>{
   // Serialize changes for the workspace so concurrent activations cannot overlap.
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`agreement-activation:${c.workspace.id}`]);
   const a=(await db.query('SELECT * FROM crm_referral_agreements WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,v.agreementId])).rows[0];
   if(!a||a.revision!==v.revision)throw new SalesAccessError('The agreement changed. Refresh and review its exact version.');
   if(v.operation==='activate'){
    if(a.status!=='draft')throw new SalesAccessError('Only a draft agreement can be activated.');
    const t=agreementTermsSchema.parse(a.terms);
    if((await db.query(`SELECT 1 FROM crm_referral_agreements WHERE workspace_id=$1 AND partner_id=$2 AND status='active' AND (terms->>'startsOn')::date<=COALESCE(NULLIF($4,'')::date,'infinity'::date) AND COALESCE(NULLIF(terms->>'endsOn','')::date,'infinity'::date)>=$3::date`,[c.workspace.id,a.partner_id,t.startsOn,t.endsOn])).rowCount)throw new SalesAccessError('This period overlaps an active agreement. Retire or end that agreement before activating a replacement.');
    await db.query("UPDATE crm_referral_agreements SET status='active',revision=revision+1,activated_by=$3,activated_at=now() WHERE workspace_id=$1 AND id=$2",[c.workspace.id,a.id,c.user.id]);
   }else{if(a.status==='retired')throw new SalesAccessError('This agreement is already retired.');await db.query("UPDATE crm_referral_agreements SET status='retired',revision=revision+1 WHERE workspace_id=$1 AND id=$2",[c.workspace.id,a.id]);}
   await audit(db,c,`agreement_${v.operation}`,a.id);return {id:a.id,status:v.operation==='activate'?'active':'retired'};
  });
 });
}
export async function recordEarning(c:DashboardContext,input:unknown) {
 const v=sourceSchema.parse(input);
 // Canonical relationship links establish attribution; text/name matches never do.
 const linked=await relationshipIds(c,{kind:'client',id:v.clientId});
 return workTransaction(c,true,async(db,role)=>{
  await access(db,c,role,undefined,true);
  return once(db,c,'earning_record',v.requestId,v,async()=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`source:${c.workspace.id}:${v.sourceKey}`]);
   const a=(await db.query('SELECT * FROM crm_referral_agreements WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,v.agreementId])).rows[0];
   if(!a||a.status!=='active')throw new SalesAccessError('Activate an agreed policy before recording eligible earnings.');
   const terms=agreementTermsSchema.parse(a.terms);
   if(v.basis!==terms.basis||v.occurredOn<terms.startsOn||(terms.endsOn&&v.occurredOn>terms.endsOn))throw new SalesAccessError('The source date or revenue basis does not match this agreement.');
   if(!(await db.query('SELECT 1 FROM clients WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,v.clientId])).rowCount)throw new SalesAccessError('That client is unavailable.');
   if(!(await db.query(`SELECT 1 FROM crm_introductions WHERE workspace_id=$1 AND id=$2 AND partner_id=$3 AND COALESCE(lead_id,business_id,opportunity_id,client_id,contact_id)=ANY($4::uuid[]) FOR SHARE`,[c.workspace.id,v.introductionId,a.partner_id,linked.map(r=>r.id)])).rowCount)throw new SalesAccessError('Choose this partner’s recorded introduction for the connected client.');
   let source=(await db.query('SELECT * FROM crm_referral_sources WHERE workspace_id=$1 AND source_key=$2',[c.workspace.id,v.sourceKey])).rows[0];
   if(source){if(source.client_id!==v.clientId||source.kind!==v.kind||Number(source.units)!==v.units||Number(source.amount_cents)!==v.amountCents||source.basis!==v.basis||new Date(source.occurred_on).toISOString().slice(0,10)!==v.occurredOn||source.reference!==v.reference)throw new SalesAccessError('That source ID already has different facts. Record a reversal and a corrected source instead.');}
   else {const id=randomUUID();source=(await db.query('INSERT INTO crm_referral_sources(id,workspace_id,source_key,client_id,kind,units,amount_cents,basis,occurred_on,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[id,c.workspace.id,v.sourceKey,v.clientId,v.kind,v.units,v.amountCents,v.basis,v.occurredOn,v.reference])).rows[0];}
   const allocations=(await db.query('SELECT partner_id,allocation_bps FROM crm_referral_earnings WHERE workspace_id=$1 AND source_id=$2 AND reverses_id IS NULL',[c.workspace.id,source.id])).rows;
   if(allocations.some(e=>e.partner_id===a.partner_id))throw new SalesAccessError('This partner already has an entry for this source. It cannot be counted twice.');
   if(allocations.reduce((sum,e)=>sum+e.allocation_bps,0)+v.allocationBps>10000)throw new SalesAccessError('Combined introducer allocations cannot exceed 100% of this source.');
   const cents=earningCents(v.kind,v.units,v.amountCents,terms,v.allocationBps),id=randomUUID();
   await db.query('INSERT INTO crm_referral_earnings(id,workspace_id,partner_id,agreement_id,source_id,introduction_id,allocation_bps,amount_cents,earned_on,eligibility_note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,c.workspace.id,a.partner_id,a.id,source.id,v.introductionId,v.allocationBps,cents,v.occurredOn,v.eligibilityNote,c.user.id]);
   await audit(db,c,'earning_recorded',id);return {id,amountCents:cents};
  });
 });
}
export async function reverseEarning(c:DashboardContext,input:unknown) {
 const v=reversalSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  await access(db,c,role,undefined,true);
  return once(db,c,'earning_reverse',v.requestId,v,async()=>{
   const e=(await db.query('SELECT * FROM crm_referral_earnings WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,v.earningId])).rows[0];
   if(!e||e.reverses_id||(await db.query('SELECT 1 FROM crm_referral_earnings WHERE workspace_id=$1 AND reverses_id=$2',[c.workspace.id,e.id])).rowCount)throw new SalesAccessError('Choose an original earning that has not already been reversed.');
   const id=randomUUID();
   await db.query('INSERT INTO crm_referral_earnings(id,workspace_id,partner_id,agreement_id,source_id,introduction_id,allocation_bps,amount_cents,earned_on,eligibility_note,reverses_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,c.workspace.id,e.partner_id,e.agreement_id,e.source_id,e.introduction_id,e.allocation_bps,-Number(e.amount_cents),v.occurredOn,v.reason,e.id,c.user.id]);
   await audit(db,c,'earning_reversed',id);return {id,amountCents:-Number(e.amount_cents)};
  });
 });
}
export async function createStatement(c:DashboardContext,input:unknown) {
 const v=statementSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  await access(db,c,role,v.partnerId,true);await partnerExists(db,c,v.partnerId);
  return once(db,c,'statement_create',v.requestId,v,async()=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`statement:${v.partnerId}`]);
   const earnings=(await db.query('SELECT id,amount_cents FROM crm_referral_earnings WHERE workspace_id=$1 AND partner_id=$2 AND statement_id IS NULL AND earned_on BETWEEN $3 AND $4 ORDER BY earned_on,id LIMIT 1001 FOR UPDATE',[c.workspace.id,v.partnerId,v.startsOn,v.endsOn])).rows;
   if(!earnings.length||earnings.length>1000)throw new SalesAccessError(earnings.length?'Use a shorter period (maximum 1,000 entries per statement).':'No unassigned earnings in that period.');
   const total=earnings.reduce((sum,e)=>sum+Number(e.amount_cents),0),id=randomUUID();
   if(!Number.isSafeInteger(total)||Math.abs(total)>1000000000000)throw new SalesAccessError('Use a smaller statement period.');
   await db.query('INSERT INTO crm_referral_statements(id,workspace_id,partner_id,starts_on,ends_on,total_cents,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,c.workspace.id,v.partnerId,v.startsOn,v.endsOn,total,c.user.id]);
   for(const e of earnings)await db.query('INSERT INTO crm_referral_statement_items(statement_id,earning_id,amount_cents) VALUES($1,$2,$3)',[id,e.id,e.amount_cents]);
   await db.query('UPDATE crm_referral_earnings SET statement_id=$3 WHERE workspace_id=$1 AND id=ANY($2::uuid[])',[c.workspace.id,earnings.map(e=>e.id),id]);
   await db.query("INSERT INTO crm_referral_statement_events(id,statement_id,actor_user_id,status,note) VALUES($1,$2,$3,'draft','Source entries and amounts captured for review.')",[randomUUID(),id,c.user.id]);
   await audit(db,c,'statement_drafted',id);return {id,totalCents:total,entries:earnings.length};
  });
 });
}
export async function getStatement(c:DashboardContext,id:string) {
 return workTransaction(c,false,async(db,role)=>{
  const statement=(await db.query('SELECT * FROM crm_referral_statements WHERE workspace_id=$1 AND id=$2',[c.workspace.id,id])).rows[0];
  if(!statement)throw new SalesAccessError('That statement is unavailable.');
  const permission=await access(db,c,role,statement.partner_id);
  if(!permission.full&&!['approved','paid'].includes(statement.status))throw new SalesAccessError('That statement is not approved for partner access.');
  const items=(await db.query(`SELECT i.earning_id,i.amount_cents::float8,e.earned_on::text,e.reverses_id,e.agreement_id,a.version,s.source_key,s.kind,s.units,s.amount_cents::float8 source_amount_cents,e.allocation_bps,cl.name client_name FROM crm_referral_statement_items i JOIN crm_referral_earnings e ON e.id=i.earning_id AND e.workspace_id=$1 JOIN crm_referral_agreements a ON a.id=e.agreement_id AND a.workspace_id=e.workspace_id JOIN crm_referral_sources s ON s.id=e.source_id AND s.workspace_id=e.workspace_id LEFT JOIN clients cl ON cl.id=s.client_id AND cl.workspace_id=s.workspace_id WHERE i.statement_id=$2 ORDER BY e.earned_on,e.id`,[c.workspace.id,id])).rows;
  const events=(await db.query(`SELECT e.status,e.note,e.created_at,u.name actor FROM crm_referral_statement_events e LEFT JOIN "user" u ON u.id=e.actor_user_id WHERE e.statement_id=$1 ORDER BY e.created_at,e.id`,[id])).rows;
  const partner=await partnerExists(db,c,statement.partner_id);
  return {...permission,partner,statement,items,events};
 });
}
export async function changeStatement(c:DashboardContext,input:unknown) {
 const v=statementStateSchema.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  await access(db,c,role,undefined,true);
  return once(db,c,'statement_state',v.requestId,v,async()=>{
   const s=(await db.query('SELECT * FROM crm_referral_statements WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,v.statementId])).rows[0];
   if(!s||s.revision!==v.revision||Number(s.total_cents)!==v.expectedTotalCents)throw new SalesAccessError('The statement changed. Review the current total and revision.');
   const expected={review:'draft',approve:'reviewed',record_paid:'approved',void:''}[v.operation];
   if(v.operation==='void'?!['draft','reviewed'].includes(s.status):s.status!==expected)throw new SalesAccessError('That transition is not available. Approved records require a separate correction.');
   const status={review:'reviewed',approve:'approved',record_paid:'paid',void:'void'}[v.operation];
   await db.query('UPDATE crm_referral_statements SET status=$3,revision=revision+1,payment_reference=$4 WHERE workspace_id=$1 AND id=$2',[c.workspace.id,s.id,status,v.paymentReference||null]);
   if(status==='void')await db.query('UPDATE crm_referral_earnings SET statement_id=NULL WHERE workspace_id=$1 AND statement_id=$2',[c.workspace.id,s.id]);
   await db.query('INSERT INTO crm_referral_statement_events(id,statement_id,actor_user_id,status,note) VALUES($1,$2,$3,$4,$5)',[randomUUID(),s.id,c.user.id,status,v.note]);
   await audit(db,c,`statement_${status}`,s.id);return {id:s.id,status,totalCents:Number(s.total_cents),moneyMoved:false};
  });
 });
}
export async function financeReviewContext(c:DashboardContext,input:Record<string,unknown>){
 return workTransaction(c,false,async(db,role)=>{
  await access(db,c,role,undefined,true);
  const result:Record<string,unknown>={notice:'Private internal finance record. No payment, agreement activation, approval or access grant is performed by this assistant action.'};
  if(input.partnerId)result.partner=await partnerExists(db,c,String(input.partnerId));
  if(input.agreementId){const a=(await db.query('SELECT a.id,a.version,a.status,a.terms,p.name partner FROM crm_referral_agreements a JOIN crm_referral_partners p ON p.id=a.partner_id AND p.workspace_id=a.workspace_id WHERE a.workspace_id=$1 AND a.id=$2',[c.workspace.id,input.agreementId])).rows[0];if(!a)throw new SalesAccessError('That agreement is unavailable.');result.agreement=a;}
  if(input.earningId){const e=(await db.query('SELECT e.id,e.amount_cents,e.reverses_id,s.source_key,p.name partner FROM crm_referral_earnings e JOIN crm_referral_sources s ON s.id=e.source_id AND s.workspace_id=e.workspace_id JOIN crm_referral_partners p ON p.id=e.partner_id AND p.workspace_id=e.workspace_id WHERE e.workspace_id=$1 AND e.id=$2',[c.workspace.id,input.earningId])).rows[0];if(!e)throw new SalesAccessError('That earning is unavailable.');result.earning=e;}
  return result;
 });
}
