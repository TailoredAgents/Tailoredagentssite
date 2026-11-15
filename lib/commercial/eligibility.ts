import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {insertAuditLog} from '@/lib/dashboard/db';
import {SalesAccessError} from '@/lib/sales/data';
import {businessDateKey} from '@/lib/time';
import {workTransaction,once,activeTeammate} from '@/lib/relationships/transactions';
import {commercialAccess} from './access';
import {agreementDetails} from './contract';
import {entitlementInput,periodInput,endPeriodInput,reviewInput,resolutionInput,eligibilityEvidenceInput} from './eligibility-contract';

const day=(value:Date|string)=>new Date(value).toISOString().slice(0,10);
const fail=(message:string):never=>{throw new SalesAccessError(message);};
type Entitlement={id:string;client_id:string;document_id:string;role:string;user_id:string|null;partner_id:string|null;revision:number;rule_snapshot:{windowMonths:number|null};source_snapshot:{effectiveOn:string;acceptedOn?:string};};

async function record(db:PoolClient,c:DashboardContext,id:string,operation:string,details:unknown){
 await db.query('INSERT INTO crm_eligibility_events(id,workspace_id,entitlement_id,actor_user_id,operation,details) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),c.workspace.id,id,c.user.id,operation,details]);
 await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'commercial.eligibility_'+operation,targetType:'commercial_record',targetId:id});
}
async function lockClient(db:PoolClient,c:DashboardContext,clientId:string){
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`eligibility:${c.workspace.id}:${clientId}`]);
}
async function locked(db:PoolClient,c:DashboardContext,id:string,revision:number){
 const first=(await db.query<Entitlement>('SELECT * FROM crm_customer_entitlements WHERE workspace_id=$1 AND id=$2',[c.workspace.id,id])).rows[0];
 if(!first)fail('This customer eligibility record is unavailable.');
 await lockClient(db,c,first.client_id);
 const e=(await db.query<Entitlement>('SELECT * FROM crm_customer_entitlements WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,id])).rows[0];
 if(e.revision!==revision)fail('Eligibility changed. Refresh and review the current revision.');
 return e;
}
async function revised(db:PoolClient,c:DashboardContext,e:Entitlement,operation:string,details:unknown){
 await db.query('UPDATE crm_customer_entitlements SET revision=revision+1 WHERE workspace_id=$1 AND id=$2',[c.workspace.id,e.id]);
 await record(db,c,e.id,operation,details);
 return {id:e.id,revision:e.revision+1,moneyMoved:false,postingEnabled:false};
}

export async function createCustomerEntitlement(c:DashboardContext,input:unknown){
 const v=entitlementInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{
  await commercialAccess(db,c,role,true);
  return once(db,c,'entitlement_create',v.requestId,v,async()=>{
   // Same lock order as referral decisions; snapshot a committed acceptance.
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`referral-accept:${c.workspace.id}`]);
   await lockClient(db,c,v.clientId);
   if(!(await db.query('SELECT 1 FROM clients WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,v.clientId])).rowCount)fail('Choose a client in this workspace.');
   const d=(await db.query(`SELECT d.* FROM crm_commercial_documents d WHERE d.workspace_id=$1 AND d.id=$2 AND d.effective_on IS NOT NULL AND EXISTS(SELECT 1 FROM crm_commercial_events e WHERE e.workspace_id=d.workspace_id AND e.document_id=d.id AND e.operation='executed') FOR SHARE OF d`,[c.workspace.id,v.documentId])).rows[0];
   if(!d)fail('Choose an exact agreement version with recorded execution evidence.');
   if(d.kind!==(v.role==='external'?'external_referral':'internal_commission'))fail('This agreement does not authorize that recipient type.');
   const rule=agreementDetails.parse(d.details).rules.find(r=>r.role===v.role);
   if(!rule)fail('The exact agreement does not include this role.');
   if(v.role==='external'&&v.basis!=='accepted_referral'||v.role==='manager'&&v.basis!=='assignment'||v.role==='originator'&&!['direct_origination','partner_recruitment'].includes(v.basis))fail('Choose the source appropriate to this role.');
   const needsReferral=['accepted_referral','partner_recruitment'].includes(v.basis);
   if(needsReferral!==!!v.referralId)fail('An accepted customer referral is required only for referral or recruiter attribution.');
   const referral=v.referralId?(await db.query('SELECT * FROM crm_referral_submissions WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,v.referralId])).rows[0]:null;
   if(needsReferral&&(!referral||referral.status!=='accepted'||referral.client_id!==v.clientId||!referral.accepted_on||!referral.conversion_due_on||v.role==='external'&&referral.partner_id!==d.partner_id))fail('Choose an accepted referral bound to this customer and the agreement partner.');
   if((await db.query("SELECT 1 FROM crm_customer_entitlements WHERE workspace_id=$1 AND client_id=$2 AND role=$3 AND ($3<>'manager' OR user_id=$4)",[c.workspace.id,v.clientId,v.role,d.user_id])).rowCount)fail('This customer already has that attribution. Reuse its history; renewals and replacements cannot reset it. Exceptional splits require a separate reviewed implementation.');
   const id=randomUUID(),source={effectiveOn:day(d.effective_on),documentVersion:d.version,documentFamily:d.family_id,executionEvidence:(await db.query("SELECT note FROM crm_commercial_events WHERE workspace_id=$1 AND document_id=$2 AND operation='executed' ORDER BY created_at,id LIMIT 1",[c.workspace.id,d.id])).rows[0].note,...(referral?{referralRevision:referral.revision,partnerId:referral.partner_id,acceptedOn:day(referral.accepted_on),conversionDueOn:day(referral.conversion_due_on),acceptanceEvidence:referral.decision_note}:{} )};
   await db.query('INSERT INTO crm_customer_entitlements(id,workspace_id,client_id,document_id,role,partner_id,user_id,basis,referral_id,rule_snapshot,source_snapshot,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,c.workspace.id,v.clientId,d.id,v.role,d.partner_id,d.user_id,v.basis,v.referralId??null,rule,source,v.evidence,c.user.id]);
   await record(db,c,id,'created',{source,rule,evidence:v.evidence});
   return {id,revision:1,postingEnabled:false,moneyMoved:false};
  });
 });
}

export async function addEligibilityPeriod(c:DashboardContext,input:unknown){
 const v=periodInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'eligibility_period',v.requestId,v,async()=>{
  const e=await locked(db,c,v.id,v.revision);
  if(v.startsOn<e.source_snapshot.effectiveOn||e.source_snapshot.acceptedOn&&v.startsOn<e.source_snapshot.acceptedOn)fail('Eligibility cannot precede the recorded agreement effective date or referral acceptance.');
  if((await db.query("SELECT 1 FROM crm_eligibility_reviews WHERE workspace_id=$1 AND entitlement_id=$2 AND status='open'",[c.workspace.id,e.id])).rowCount)fail('Resolve the open eligibility review before adding a period.');
  // Offboarding never removes history. New/future internal periods still need active membership.
  if(e.user_id&&(!v.endsBefore||v.endsBefore>businessDateKey()))await activeTeammate(db,c,e.user_id);
  if(e.role==='manager'){
   if(!v.assignmentId)fail('Choose the recorded manager assignment for this period.');
   const a=(await db.query('SELECT * FROM crm_client_manager_history WHERE workspace_id=$1 AND id=$2 AND client_id=$3 AND user_id=$4 FOR SHARE',[c.workspace.id,v.assignmentId,e.client_id,e.user_id])).rows[0];
   if(!a||v.startsOn<businessDateKey(a.starts_at)||a.ends_at&&(!v.endsBefore||v.endsBefore>businessDateKey(a.ends_at)))fail('The eligible dates must fit the recorded assignment. Earlier cutover history and transfer-day exceptions need separate review.');
  }else if(v.assignmentId)fail('Only manager periods use assignment history.');
  if((await db.query(`SELECT 1 FROM crm_eligibility_periods p JOIN crm_customer_entitlements e ON e.workspace_id=p.workspace_id AND e.id=p.entitlement_id WHERE e.workspace_id=$1 AND e.client_id=$2 AND e.role=$3 AND daterange(p.starts_on,p.ends_before,'[)') && daterange($4::date,$5::date,'[)')`,[c.workspace.id,e.client_id,e.role,v.startsOn,v.endsBefore??null])).rowCount)fail('Eligible periods for the same customer role cannot overlap. Close the outgoing period first.');
  const periodId=randomUUID();await db.query('INSERT INTO crm_eligibility_periods(id,workspace_id,entitlement_id,starts_on,ends_before,assignment_id,evidence) VALUES($1,$2,$3,$4,$5,$6,$7)',[periodId,c.workspace.id,e.id,v.startsOn,v.endsBefore??null,v.assignmentId??null,v.evidence]);
  return {...await revised(db,c,e,'period_added',{...v,periodId}),periodId};
 });});
}

async function closePeriod(db:PoolClient,c:DashboardContext,e:Entitlement,periodId:string,endsBefore:string){
 const p=(await db.query('SELECT * FROM crm_eligibility_periods WHERE workspace_id=$1 AND entitlement_id=$2 AND id=$3 FOR UPDATE',[c.workspace.id,e.id,periodId])).rows[0];
 if(!p||p.ends_before||endsBefore<=day(p.starts_on))fail('Choose an open period and an end after its first eligible day. Closed periods are preserved.');
 await db.query('UPDATE crm_eligibility_periods SET ends_before=$3 WHERE workspace_id=$1 AND id=$2',[c.workspace.id,p.id,endsBefore]);
}
export async function endEligibilityPeriod(c:DashboardContext,input:unknown){
 const v=endPeriodInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'eligibility_end',v.requestId,v,async()=>{
  const e=await locked(db,c,v.id,v.revision);
  if(v.endsBefore<businessDateKey())fail('End future eligibility prospectively. Historical corrections require separate review.');
  if(e.role==='external')fail('External customer windows survive agreement termination. Receipt/window verification or a specific exception must be reviewed separately.');
  if(v.reason==='transfer'&&e.role!=='manager')fail('Only a manager period can end for an assignment transfer.');
  if((await db.query("SELECT 1 FROM crm_eligibility_reviews WHERE workspace_id=$1 AND entitlement_id=$2 AND status='open'",[c.workspace.id,e.id])).rowCount)fail('Resolve the open review; do not bypass its notice and cure history.');
  await closePeriod(db,c,e,v.periodId,v.endsBefore);
  return revised(db,c,e,'period_ended',v);
 });});
}

export async function recordEligibilityEvidence(c:DashboardContext,input:unknown){
 const v=eligibilityEvidenceInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'eligibility_evidence',v.requestId,v,async()=>{
  const e=await locked(db,c,v.id,v.revision);
  if(e.role==='external')fail('Work and leave evidence belongs to internal eligibility.');
  const tomorrow=new Date(`${businessDateKey()}T12:00:00Z`);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  if(v.kind==='substantive_work'&&(v.startsOn>businessDateKey()||v.endsBefore>day(tomorrow)))fail('Record work that actually occurred.');
  await db.query('INSERT INTO crm_eligibility_evidence(id,workspace_id,entitlement_id,kind,starts_on,ends_before,evidence) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),c.workspace.id,e.id,v.kind,v.startsOn,v.endsBefore,v.evidence]);
  return revised(db,c,e,'evidence_recorded',v);
 });});
}

export async function openEligibilityReview(c:DashboardContext,input:unknown){
 const v=reviewInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'eligibility_review',v.requestId,v,async()=>{
  const e=await locked(db,c,v.id,v.revision);
  if(v.kind==='inactivity'&&e.role!=='originator'||v.kind==='performance'&&e.role!=='manager')fail('Inactivity reviews apply to originators; performance reviews apply to managers.');
  if(v.noticeOn>businessDateKey())fail('Record the actual delivered notice date. This action does not send notice.');
  if((await db.query("SELECT 1 FROM crm_eligibility_reviews WHERE workspace_id=$1 AND entitlement_id=$2 AND status='open'",[c.workspace.id,e.id])).rowCount)fail('Resolve the existing review first.');
  const reviewId=randomUUID();await db.query('INSERT INTO crm_eligibility_reviews(id,workspace_id,entitlement_id,kind,observed_from,observed_through,notice_on,cure_due_on,policy_evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[reviewId,c.workspace.id,e.id,v.kind,v.observedFrom,v.observedThrough,v.noticeOn,v.cureDueOn,v.policyEvidence]);
  return {...await revised(db,c,e,'review_opened',{...v,reviewId}),reviewId};
 });});
}
export async function resolveEligibilityReview(c:DashboardContext,input:unknown){
 const v=resolutionInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'eligibility_resolve',v.requestId,v,async()=>{
  const e=await locked(db,c,v.id,v.revision);
  const r=(await db.query('SELECT * FROM crm_eligibility_reviews WHERE workspace_id=$1 AND entitlement_id=$2 AND id=$3 FOR UPDATE',[c.workspace.id,e.id,v.reviewId])).rows[0];
  if(!r||r.status!=='open')fail('Choose an open eligibility review.');
  if(v.outcome==='ended'){
   const today=businessDateKey(),endsBefore=z.iso.date().parse(v.endsBefore);
   if(endsBefore<today||day(r.cure_due_on)>=today||endsBefore<=day(r.cure_due_on))fail('A cure period must finish before a human can end future eligibility.');
   const conflict=(await db.query(`SELECT 1 FROM crm_eligibility_evidence WHERE workspace_id=$1 AND entitlement_id=$2 AND starts_on<$4::date AND ends_before>$3::date AND (kind='protected_leave' OR $5='inactivity')`,[c.workspace.id,e.id,day(r.observed_from),endsBefore,r.kind])).rowCount;
   if(conflict)fail('Protected leave or qualifying work overlaps this review. Retain or dismiss it and review the evidence; do not forfeit eligibility automatically.');
   const periods=(await db.query('SELECT id,starts_on,ends_before FROM crm_eligibility_periods WHERE workspace_id=$1 AND entitlement_id=$2 AND (ends_before IS NULL OR ends_before>$3::date)',[c.workspace.id,e.id,endsBefore])).rows;
   if(periods.length!==1||periods[0].ends_before||day(periods[0].starts_on)>=endsBefore)fail('Review the periods first. Ending eligibility requires one open period spanning the effective date and no later periods.');
   await closePeriod(db,c,e,periods[0].id,endsBefore);
  }else if(v.endsBefore)fail('Only an end decision records a first excluded day.');
  await db.query('UPDATE crm_eligibility_reviews SET status=$3,decision_evidence=$4,ends_before=$5 WHERE workspace_id=$1 AND id=$2',[c.workspace.id,r.id,v.outcome,v.evidence,v.endsBefore??null]);
  return revised(db,c,e,'review_resolved',v);
 });});
}

export async function listCustomerEligibility(c:DashboardContext,clientId?:string,page=1){
 if(clientId)z.uuid().parse(clientId);z.number().int().min(1).max(10000).parse(page);
 return workTransaction(c,false,async(db,role)=>{
  const access=await commercialAccess(db,c,role);
  const rows=(await db.query(`SELECT e.*,cl.name client,COALESCE(p.name,u.name) recipient,d.title document_title,d.version document_version FROM crm_customer_entitlements e JOIN clients cl ON cl.id=e.client_id AND cl.workspace_id=e.workspace_id JOIN crm_commercial_documents d ON d.id=e.document_id AND d.workspace_id=e.workspace_id LEFT JOIN crm_referral_partners p ON p.id=e.partner_id AND p.workspace_id=e.workspace_id LEFT JOIN "user" u ON u.id=e.user_id WHERE e.workspace_id=$1 AND ($2::uuid IS NULL OR e.client_id=$2) ORDER BY e.created_at DESC,e.id LIMIT 51 OFFSET $3`,[c.workspace.id,clientId??null,(page-1)*50])).rows;
  return {...access,records:rows.slice(0,50),more:rows.length>50,page,postingEnabled:false};
 });
}
export async function eligibilityChoices(c:DashboardContext){
 return workTransaction(c,false,async(db,role)=>{
  await commercialAccess(db,c,role);
  const clients=(await db.query('SELECT id,name FROM clients WHERE workspace_id=$1 ORDER BY name,id LIMIT 501',[c.workspace.id])).rows;
  const documents=(await db.query(`SELECT d.id,d.title,d.version,d.kind,COALESCE(p.name,u.name) recipient FROM crm_commercial_documents d LEFT JOIN crm_referral_partners p ON p.id=d.partner_id AND p.workspace_id=d.workspace_id LEFT JOIN "user" u ON u.id=d.user_id WHERE d.workspace_id=$1 AND d.kind IN ('external_referral','internal_commission') AND EXISTS(SELECT 1 FROM crm_commercial_events e WHERE e.workspace_id=d.workspace_id AND e.document_id=d.id AND e.operation='executed') ORDER BY d.created_at DESC,d.id LIMIT 501`,[c.workspace.id])).rows;
  const referrals=(await db.query(`SELECT r.id,r.client_id,p.name partner,cl.name client FROM crm_referral_submissions r JOIN clients cl ON cl.id=r.client_id AND cl.workspace_id=r.workspace_id JOIN crm_referral_partners p ON p.id=r.partner_id AND p.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND r.status='accepted' ORDER BY r.created_at DESC,r.id LIMIT 501`,[c.workspace.id])).rows;
  return {clients:clients.slice(0,500),documents:documents.slice(0,500),referrals:referrals.slice(0,500),truncated:clients.length>500||documents.length>500||referrals.length>500};
 });
}
export async function getCustomerEligibility(c:DashboardContext,id:string){
 z.uuid().parse(id);
 return workTransaction(c,false,async(db,role)=>{
  const access=await commercialAccess(db,c,role);
  const e=(await db.query(`SELECT e.*,cl.name client,COALESCE(p.name,u.name) recipient,d.title document_title,d.version document_version,d.status document_status FROM crm_customer_entitlements e JOIN clients cl ON cl.id=e.client_id AND cl.workspace_id=e.workspace_id JOIN crm_commercial_documents d ON d.id=e.document_id AND d.workspace_id=e.workspace_id LEFT JOIN crm_referral_partners p ON p.id=e.partner_id AND p.workspace_id=e.workspace_id LEFT JOIN "user" u ON u.id=e.user_id WHERE e.workspace_id=$1 AND e.id=$2`,[c.workspace.id,id])).rows[0];
  if(!e)fail('This customer eligibility record is unavailable.');
  const periods=(await db.query('SELECT p.*,a.starts_at assignment_start,a.ends_at assignment_end,a.history_basis FROM crm_eligibility_periods p LEFT JOIN crm_client_manager_history a ON a.workspace_id=p.workspace_id AND a.id=p.assignment_id WHERE p.workspace_id=$1 AND p.entitlement_id=$2 ORDER BY p.starts_on,p.id LIMIT 501',[c.workspace.id,id])).rows;
  const reviews=(await db.query('SELECT * FROM crm_eligibility_reviews WHERE workspace_id=$1 AND entitlement_id=$2 ORDER BY created_at DESC,id LIMIT 101',[c.workspace.id,id])).rows;
  const evidence=(await db.query('SELECT * FROM crm_eligibility_evidence WHERE workspace_id=$1 AND entitlement_id=$2 ORDER BY starts_on DESC,id LIMIT 101',[c.workspace.id,id])).rows;
  const events=(await db.query('SELECT e.*,u.name actor FROM crm_eligibility_events e LEFT JOIN "user" u ON u.id=e.actor_user_id WHERE e.workspace_id=$1 AND e.entitlement_id=$2 ORDER BY created_at DESC,e.id LIMIT 101',[c.workspace.id,id])).rows;
  const assignments=(await db.query('SELECT * FROM crm_client_manager_history WHERE workspace_id=$1 AND client_id=$2 AND user_id=$3 ORDER BY starts_at DESC,id LIMIT 101',[c.workspace.id,e.client_id,e.user_id])).rows;
  const referral=e.referral_id?(await db.query('SELECT status,revision,conversion_due_on FROM crm_referral_submissions WHERE workspace_id=$1 AND id=$2',[c.workspace.id,e.referral_id])).rows[0]:null;
  const holds=['Payment verification and recurring posting are not enabled.'];
  if(e.rule_snapshot.windowMonths!==null)holds.push('The customer window awaits its first verified qualifying receipt. No clock has been started or reset.');
  if(!periods.length)holds.push('No eligibility period has been recorded.');
  if(reviews.some(r=>r.status==='open'))holds.push('An eligibility review is open; no automatic forfeiture is applied.');
  if(periods.some(p=>p.assignment_end&&(!p.ends_before||day(p.ends_before)>businessDateKey(p.assignment_end))))holds.push('Assignment coverage changed. Reconcile the manager periods before any financial calculation. Historical periods remain recorded.');
  if(referral&&referral.revision!==e.source_snapshot.referralRevision)holds.push('The referral decision changed after attribution was recorded. Reconcile the current decision with its preserved acceptance before financial activation.');
  const historyTruncated=periods.length>500||reviews.length>100||evidence.length>100||events.length>100||assignments.length>100;
  if(historyTruncated)holds.push('This display is incomplete. Review complete stored history before financial activation.');
  return {...access,entitlement:e,periods:periods.slice(0,500),reviews:reviews.slice(0,100),evidence:evidence.slice(0,100),events:events.slice(0,100),assignments:assignments.slice(0,100),referral,historyTruncated,holds,postingEnabled:false};
 });
}
