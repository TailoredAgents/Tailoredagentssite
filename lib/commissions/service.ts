import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {insertAuditLog} from '@/lib/dashboard/db';
import {workTransaction,once} from '@/lib/relationships/transactions';
import {SalesAccessError} from '@/lib/sales/data';
import {commercialAccess} from '@/lib/commercial/access';
import {businessDateKey} from '@/lib/time';
import {allocateCents,windowEnd} from '@/lib/commercial/calculation';
import {statementSettlementData} from './settlement-data';
import {collectionEvidence} from '@/lib/billing/allocation';
import {invoiceFactsSchema,type BillingReview} from '@/lib/billing/contract';
import {calculateCommissions,nextDay,monthEnd,type CommissionRole} from './calculation';
import {policyInput,anchorInput,anchorCorrectionInput,refundDecisionInput,runInput,postInput,statementInput,statementChangeInput,type Component} from './contract';

const fail=(message:string):never=>{throw new SalesAccessError(message);};
const day=(v:Date|string)=>new Date(v).toISOString().slice(0,10);
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const commissionPostingEnabled=()=>process.env.COMMISSION_LEDGER_POSTING_ENABLED==='true';
async function audit(db:PoolClient,c:DashboardContext,action:string,id:string){await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'commission.'+action,targetType:'commission_record',targetId:id});}
async function policy(db:PoolClient,c:DashboardContext,id:string){
 const p=(await db.query('SELECT * FROM crm_commission_policies WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,id])).rows[0];
 if(!p)fail('That commission policy is unavailable.');return p;
}
export async function createCommissionPolicy(c:DashboardContext,input:unknown){
 const v=policyInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'commission_policy',v.requestId,v,async()=>{
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commission-policy:${c.workspace.id}:${v.clientId}:${v.mode}`]);
  if(!(await db.query('SELECT 1 FROM clients WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,v.clientId])).rowCount)fail('Choose a customer in this workspace.');
  if((await db.query('SELECT 1 FROM crm_commission_policies WHERE workspace_id=$1 AND client_id=$2 AND mode=$3',[c.workspace.id,v.clientId,v.mode])).rowCount)fail('This customer already has a preserved policy in that mode. Reuse its original history.');
  const id=randomUUID();await db.query('INSERT INTO crm_commission_policies(id,workspace_id,client_id,mode,convention,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,c.workspace.id,v.clientId,v.mode,v.convention,v.evidence,c.user.id]);await audit(db,c,'policy_recorded',id);
  return {id,postingEnabled:false,moneyMoved:false};
 });});
}

/** The entire mapped customer history is bounded and checked, not just the selected invoice.
 * Human historical-completeness evidence is still required when approving the first receipt. */
async function evidenceContext(db:PoolClient,c:DashboardContext,p:Record<string,any>,asOf:string,correctingAnchor?:string){
 if(asOf>businessDateKey())fail('Use a calculation date no later than today.');
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`eligibility:${c.workspace.id}:${p.client_id}`]);
 const invoices=(await db.query(`SELECT i.*,s.facts,co.mode,co.last_scan_at,r.id review_id,r.snapshot_id reviewed_snapshot,r.client_id reviewed_client,r.policy clearing_policy,r.lines,r.bank_evidence,r.evidence review_evidence,x.id exception_id,x.details exception_details
 FROM crm_billing_invoices i JOIN crm_billing_connections co ON co.id=i.connection_id JOIN crm_billing_snapshots s ON s.id=i.snapshot_id
 LEFT JOIN crm_billing_customer_maps m ON m.connection_id=i.connection_id AND m.customer_id=s.facts->>'customerId'
 LEFT JOIN LATERAL(SELECT * FROM crm_billing_reviews r WHERE r.invoice_id=i.id ORDER BY r.created_at DESC,r.id DESC LIMIT 1) r ON true
 LEFT JOIN crm_billing_exception_reviews x ON x.invoice_id=i.id AND x.snapshot_id=i.snapshot_id AND x.review_id=r.id
 WHERE i.workspace_id=$1 AND co.mode=$2 AND (m.client_id=$3 OR r.client_id=$3) ORDER BY i.id LIMIT 501 FOR SHARE OF i,co`,[c.workspace.id,p.mode,p.client_id])).rows;
 const holds:string[]=[];
 if(!invoices.length)holds.push('Import and review this customer’s invoices first.');
 if(invoices.length>500)holds.push('Customer history exceeds the complete-calculation limit.');
 const connectionIds=[...new Set(invoices.map(i=>i.connection_id))];
 const pending=(await db.query("SELECT id,status,requested_revision FROM crm_billing_jobs WHERE connection_id=ANY($1::uuid[]) AND status<>'done' ORDER BY id",[connectionIds])).rows;
 if(pending.length)holds.push('Complete all reconciliation jobs for the source connections before calculating.');
 const duplicates=(await db.query('SELECT charge_id FROM crm_billing_payment_links WHERE connection_id=ANY($1::uuid[]) GROUP BY connection_id,charge_id HAVING count(*)>1',[connectionIds])).rows;
 const candidates:{invoiceId:string;snapshotId:string;reviewId:string;chargeId:string;startsOn:string;netCents:number}[]=[];
 const reviewed=invoices.map(i=>{
  const f=invoiceFactsSchema.parse(i.facts),r=i.review_id&&i.reviewed_snapshot===i.snapshot_id&&i.reviewed_client===p.client_id?{policy:i.clearing_policy,lines:i.lines,bankEvidence:i.bank_evidence} as Pick<BillingReview,'policy'|'lines'|'bankEvidence'>:null;
  if(!r)holds.push('Every mapped invoice needs review of its current source snapshot.');
  if(!i.last_scan_at||Date.now()-new Date(i.last_scan_at).getTime()>86400000||Date.now()-new Date(i.observed_at).getTime()>86400000)holds.push('Refresh the complete customer history; source evidence is missing or more than a day old.');
  if(duplicates.some(d=>f.receipts.some(r=>r.chargeId===d.charge_id)))holds.push('A receipt is linked more than once. Resolve its invoice allocation.');
  // A historical as-of cannot reconstruct provider facts from before today. It only caps service recognition.
  const collection=r?collectionEvidence(f,r,businessDateKey(),i.exception_id?{id:i.exception_id,bankEvidence:i.exception_details.bankEvidence}:undefined):null;
  if(collection){holds.push(...collection.holds);if(r!.lines.some(l=>l.classification==='recurring')&&f.receipts.some(receipt=>receipt.paid&&!collection.cleared.some(cleared=>cleared.chargeId===receipt.chargeId)))holds.push('A recurring receipt still needs clearing evidence; the earliest payment is not yet verified.');for(const receipt of collection.cleared){
   const recurring=allocateCents(receipt.grossCents,collection.effectiveLines.map(l=>l.amountCents)).reduce((n,cents,index)=>n+(r!.lines[index].classification==='recurring'?cents:0),0);
   if(recurring>0)candidates.push({invoiceId:i.id,snapshotId:i.snapshot_id,reviewId:i.review_id,chargeId:receipt.chargeId,startsOn:receipt.clearedOn,netCents:receipt.netCents});
  }}
  return {...i,parsed:f,review:r,collection};
 });
 candidates.sort((a,b)=>a.startsOn.localeCompare(b.startsOn)||a.chargeId.localeCompare(b.chargeId)||a.invoiceId.localeCompare(b.invoiceId));
 const entitlements=(await db.query('SELECT * FROM crm_customer_entitlements WHERE workspace_id=$1 AND client_id=$2 ORDER BY id LIMIT 101 FOR SHARE',[c.workspace.id,p.client_id])).rows;
 if(!entitlements.length)holds.push('Record the customer’s executed attribution and eligibility first.');
 if(entitlements.length>100)holds.push('Eligibility exceeds the complete-calculation limit.');
 const originals=(await db.query('SELECT * FROM crm_commission_anchors WHERE policy_id=$1 ORDER BY id',[p.id])).rows;
 const corrections=(await db.query('SELECT x.* FROM crm_commission_anchor_corrections x JOIN crm_commission_anchors a ON a.id=x.anchor_id WHERE a.policy_id=$1 ORDER BY x.sequence',[p.id])).rows;
 const anchors=originals.map(a=>{const history=corrections.filter(x=>x.anchor_id===a.id),latest=history.at(-1);return {...a,...(latest?{invoice_id:latest.invoice_id,snapshot_id:latest.snapshot_id,review_id:latest.review_id,charge_id:latest.charge_id,starts_on:latest.starts_on,ends_before:latest.ends_before}:{}),correction_id:latest?.id??null,original_starts_on:a.starts_on,corrections:history};});
 const roles:CommissionRole[]=[],periodEvidence:unknown[]=[],decisions:unknown[]=[];
 for(const e of entitlements){
  const anchor=anchors.find(a=>a.entitlement_id===e.id);
  if(e.referral_id){const r=(await db.query('SELECT revision,status FROM crm_referral_submissions WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,e.referral_id])).rows[0];
   if(!r||r.status!=='accepted'||r.revision!==e.source_snapshot.referralRevision)holds.push('Referral acceptance changed; resolve its pinned attribution before calculation.');
   if(!candidates[0]||candidates[0].startsOn<e.source_snapshot.acceptedOn||candidates[0].startsOn>e.source_snapshot.conversionDueOn)holds.push('The first cleared recurring receipt does not meet the preserved referral conversion dates.');
  }
  if((await db.query("SELECT 1 FROM crm_eligibility_reviews WHERE workspace_id=$1 AND entitlement_id=$2 AND status='open'",[c.workspace.id,e.id])).rowCount)holds.push('Resolve open eligibility reviews before calculating.');
  if(anchor){
   const first=candidates[0];
   if(!correctingAnchor&&(!first||first.invoiceId!==anchor.invoice_id||first.chargeId!==anchor.charge_id||first.startsOn!==day(anchor.starts_on)))holds.push('Original receipt evidence changed or an earlier receipt was found. The preserved window cannot be reset automatically.');
   if(first&&first.netCents===0){
    const d=(await db.query('SELECT * FROM crm_commission_anchor_decisions WHERE anchor_id=$1 AND snapshot_id=$2',[anchor.id,first.snapshotId])).rows[0];
    if(d)decisions.push(d);else if(!correctingAnchor)holds.push('The original receipt was fully reversed. Record a specific decision before using its preserved window.');
   }
  }
  const periods=(await db.query('SELECT p.*,a.starts_at assignment_start,a.ends_at assignment_end FROM crm_eligibility_periods p LEFT JOIN crm_client_manager_history a ON a.workspace_id=p.workspace_id AND a.id=p.assignment_id WHERE p.workspace_id=$1 AND p.entitlement_id=$2 ORDER BY p.starts_on,p.id LIMIT 101 FOR SHARE OF p',[c.workspace.id,e.id])).rows;
  if(!periods.length||periods.length>100)holds.push('Every attributed role needs complete, bounded eligibility periods.');periodEvidence.push(...periods);
  for(const t of periods){
   if(e.role==='manager'&&(!t.assignment_start||day(t.starts_on)<businessDateKey(t.assignment_start)||t.assignment_end&&(!t.ends_before||day(t.ends_before)>businessDateKey(t.assignment_end))))holds.push('Manager eligibility exceeds recorded assignment coverage.');
   roles.push({id:e.id,recipientKey:e.partner_id?'partner:'+e.partner_id:'user:'+e.user_id,agreementId:e.document_id,role:e.role,rateBps:e.rule_snapshot.rateBps,startsOn:day(t.starts_on),endsBefore:t.ends_before?day(t.ends_before):null,anchor:anchor?day(anchor.starts_on):null,windowMonths:e.rule_snapshot.windowMonths});
  }
 }
 if(roles.length>200)holds.push('Combined eligibility history exceeds 200 calculation segments.');
 const inputs={policy:p,asOf,invoices:reviewed.map(i=>({id:i.id,snapshotId:i.snapshot_id,reviewId:i.review_id,revision:i.revision,collection:i.collection,lines:i.review?.lines})),entitlements,periods:periodEvidence,anchors,decisions,roles};
 return {reviewed,entitlements,anchors,candidates,roles,holds:[...new Set(holds)],inputs,fingerprint:hash(inputs)};
}
export async function approveCommissionAnchor(c:DashboardContext,input:unknown){
 const v=anchorInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'commission_anchor',v.requestId,v,async()=>{
  const p=await policy(db,c,v.policyId),ctx=await evidenceContext(db,c,p,businessDateKey()),e=ctx.entitlements.find(e=>e.id===v.entitlementId),first=ctx.candidates[0];
  if(ctx.fingerprint!==v.fingerprint)fail('Evidence changed. Refresh and review the original receipt again.');
  if(ctx.holds.length)fail(ctx.holds.join(' '));
  if(!e||!e.rule_snapshot.windowMonths)fail('Choose an attributed role with a fixed window.');
  if(ctx.anchors.some(a=>a.entitlement_id===e.id))fail('This original window is already preserved.');
  if(!first||first.invoiceId!==v.invoiceId||first.chargeId!==v.chargeId||first.netCents<0)fail('Choose the earliest verified recurring receipt.');
  if(first.netCents===0&&(!v.retainReversed||!['owner','admin'].includes(role)))fail('An owner or administrator must explicitly preserve the fully reversed first receipt under the signed policy.');
  const id=randomUUID(),end=nextDay(windowEnd(first.startsOn,e.rule_snapshot.windowMonths));
  await db.query('INSERT INTO crm_commission_anchors(id,workspace_id,entitlement_id,policy_id,invoice_id,snapshot_id,review_id,charge_id,starts_on,ends_before,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,c.workspace.id,e.id,p.id,first.invoiceId,first.snapshotId,first.reviewId,first.chargeId,first.startsOn,end,v.evidence,c.user.id]);await audit(db,c,'anchor_approved',id);
  if(first.netCents===0)await db.query("INSERT INTO crm_commission_anchor_decisions(id,anchor_id,snapshot_id,decision,evidence,created_by) VALUES($1,$2,$3,'retain_original_after_full_refund',$4,$5)",[randomUUID(),id,first.snapshotId,v.evidence,c.user.id]);
  return {id,startsOn:first.startsOn,endsBefore:end,moneyMoved:false};
 });});
}
export async function retainRefundedAnchor(c:DashboardContext,input:unknown){
 const v=refundDecisionInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'commission_anchor_refund',v.requestId,v,async()=>{
  const original=(await db.query('SELECT * FROM crm_commission_anchors WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.anchorId])).rows[0];if(!original)fail('That original window is unavailable.');
  const p=await policy(db,c,original.policy_id),ctx=await evidenceContext(db,c,p,businessDateKey(),v.anchorId),a=ctx.anchors.find(a=>a.id===v.anchorId)!,first=ctx.candidates[0];
  if(ctx.holds.length)fail(ctx.holds.join(' '));
  if(!first||first.invoiceId!==a.invoice_id||first.chargeId!==a.charge_id||first.startsOn!==day(a.starts_on)||first.snapshotId!==v.snapshotId||first.netCents!==0)fail('Review the current fully refunded original receipt.');
  const id=randomUUID();await db.query("INSERT INTO crm_commission_anchor_decisions(id,anchor_id,snapshot_id,decision,evidence,created_by) VALUES($1,$2,$3,'retain_original_after_full_refund',$4,$5)",[id,a.id,v.snapshotId,v.evidence,c.user.id]);await audit(db,c,'anchor_refund_decided',id);return {id,moneyMoved:false};
 });});
}
/** A correction replaces effective evidence, never deletes the original or grants an arbitrary renewal. */
export async function correctCommissionAnchor(c:DashboardContext,input:unknown){
 const v=anchorCorrectionInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);if(!['owner','admin'].includes(role))fail('Only an owner or administrator can correct an original window.');
  return once(db,c,'commission_anchor_correction',v.requestId,v,async()=>{
   const p=await policy(db,c,v.policyId),ctx=await evidenceContext(db,c,p,businessDateKey(),v.anchorId),a=ctx.anchors.find(a=>a.id===v.anchorId),first=ctx.candidates[0];
   if(!a||ctx.fingerprint!==v.fingerprint||a.correction_id!==v.expectedCorrectionId)fail('Original-window evidence changed. Refresh before correcting it.');
   if(ctx.holds.length)fail(ctx.holds.join(' '));
   if(!first||first.invoiceId!==v.invoiceId||first.chargeId!==v.chargeId)fail('A correction must use the earliest verified recurring receipt across the complete customer history.');
   if(first.netCents===0&&!v.retainReversed)fail('Explicit signed-policy authority is required to retain a fully reversed first receipt.');
   if(first.invoiceId===a.invoice_id&&first.chargeId===a.charge_id&&first.startsOn===day(a.starts_on))fail('The effective receipt already matches. Use the specific reversal decision if required.');
   const entitlement=ctx.entitlements.find(e=>e.id===a.entitlement_id),months=entitlement?.rule_snapshot.windowMonths;
   if(!months)fail('A fixed original window is required.');
   const id=randomUUID(),end=nextDay(windowEnd(first.startsOn,months));
   await db.query('INSERT INTO crm_commission_anchor_corrections(id,anchor_id,invoice_id,snapshot_id,review_id,charge_id,starts_on,ends_before,previous_id,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,a.id,first.invoiceId,first.snapshotId,first.reviewId,first.chargeId,first.startsOn,end,a.correction_id,v.evidence,c.user.id]);
   if(first.netCents===0)await db.query("INSERT INTO crm_commission_anchor_decisions(id,anchor_id,snapshot_id,decision,evidence,created_by) VALUES($1,$2,$3,'retain_original_after_full_refund',$4,$5) ON CONFLICT(anchor_id,snapshot_id) DO NOTHING",[randomUUID(),a.id,first.snapshotId,v.evidence,c.user.id]);
   await audit(db,c,'anchor_corrected',id);return {id,startsOn:first.startsOn,endsBefore:end,moneyMoved:false};
  });
 });
}
function runResult(ctx:Awaited<ReturnType<typeof evidenceContext>>,invoiceId:string,asOf:string){
 const i=ctx.reviewed.find(i=>i.id===invoiceId);if(!i)fail('Choose a reviewed invoice for this customer and mode.');
 const holds=[...ctx.holds];let calculation:ReturnType<typeof calculateCommissions>|null=null;
 if(i.review&&i.collection&&!holds.length){
  if(i.collection.pendingCents)holds.push('Some cash still lacks the approved clearing evidence.');
  try{calculation=calculateCommissions({asOf,netCents:i.collection.netCents,lines:i.collection.effectiveLines,roles:ctx.roles});holds.push(...calculation.holds);}catch{holds.push('The source or eligibility allocation cannot be calculated safely.');}
 }
 return {holds:[...new Set(holds)],calculation:holds.length?null:calculation};
}
export async function saveCommissionRun(c:DashboardContext,input:unknown){
 const v=runInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'commission_run',v.requestId,v,async()=>{
  const p=await policy(db,c,v.policyId),ctx=await evidenceContext(db,c,p,v.asOf),result=runResult(ctx,v.invoiceId,v.asOf);
  const prior=(await db.query('SELECT id FROM crm_commission_runs WHERE policy_id=$1 AND invoice_id=$2 AND as_of=$3 AND fingerprint=$4',[p.id,v.invoiceId,v.asOf,ctx.fingerprint])).rows[0];if(prior)return {id:prior.id,moneyMoved:false};
  const id=randomUUID();await db.query('INSERT INTO crm_commission_runs(id,workspace_id,policy_id,invoice_id,as_of,fingerprint,inputs,result,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,c.workspace.id,p.id,v.invoiceId,v.asOf,ctx.fingerprint,JSON.stringify(ctx.inputs),JSON.stringify(result),c.user.id]);await audit(db,c,'shadow_saved',id);return {id,moneyMoved:false};
 });});
}
async function currentRun(db:PoolClient,c:DashboardContext,id:string){
 const r=(await db.query('SELECT * FROM crm_commission_runs WHERE workspace_id=$1 AND id=$2',[c.workspace.id,id])).rows[0];if(!r)fail('That calculation is unavailable.');
 const p=await policy(db,c,r.policy_id),ctx=await evidenceContext(db,c,p,day(r.as_of));
 if(ctx.fingerprint!==r.fingerprint||runResult(ctx,r.invoice_id,day(r.as_of)).holds.length||!r.result.calculation)fail('The calculation is held or its evidence changed. Save and review a fresh calculation.');
 return {r,p,ctx};
}
export async function approveCommissionPosting(c:DashboardContext,input:unknown){
 const v=postInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);if(!['owner','admin'].includes(role))fail('Only an owner or administrator can activate a customer’s ledger.');
  if(!commissionPostingEnabled())fail('Ledger posting is disabled. Complete the final activation checklist first.');
  return once(db,c,'commission_activate',v.requestId,v,async()=>{const {r,p}=await currentRun(db,c,v.runId);
   if((await db.query('SELECT 1 FROM crm_commission_posting_approvals WHERE policy_id=$1',[p.id])).rowCount)fail('This customer and mode already have posting approval.');
   await db.query('INSERT INTO crm_commission_posting_approvals(policy_id,run_id,evidence,created_by) VALUES($1,$2,$3,$4)',[p.id,r.id,v.evidence,c.user.id]);await audit(db,c,'posting_approved',p.id);return {id:p.id,moneyMoved:false};
  });
 });
}
export async function postCommissionRun(c:DashboardContext,input:unknown){
 const v=postInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);if(!commissionPostingEnabled())fail('Ledger posting is disabled.');
  return once(db,c,'commission_post',v.requestId,v,async()=>{
   const {r,p}=await currentRun(db,c,v.runId);
   if(!(await db.query('SELECT 1 FROM crm_commission_posting_approvals WHERE policy_id=$1',[p.id])).rowCount)fail('Review a shadow calculation and approve this customer and mode before posting.');
   const history=(await db.query('SELECT r.id,r.as_of FROM crm_commission_postings p JOIN crm_commission_runs r ON r.id=p.run_id WHERE r.policy_id=$1 AND r.invoice_id=$2 ORDER BY p.sequence',[p.id,r.invoice_id])).rows;
   if(history.some(h=>day(h.as_of)>day(r.as_of)))fail('A newer service date is already posted. Recalculate at that date or later.');
   if(history.some(h=>h.id===r.id))return {id:r.id,entries:0,moneyMoved:false};
   const posted=(await db.query(`SELECT e.*,r.as_of FROM crm_referral_earnings e JOIN crm_commission_runs r ON r.id=e.run_id WHERE e.workspace_id=$1 AND r.policy_id=$2 AND r.invoice_id=$3 ORDER BY e.created_at,e.id`,[c.workspace.id,p.id,r.invoice_id])).rows;
   const old=new Map<string,{amount:number;details:Component;id:string}>();for(const e of posted){const previous=old.get(e.component_key);old.set(e.component_key,{amount:(previous?.amount??0)+Number(e.amount_cents),details:e.details.component,id:e.id});}
   const target=new Map<string,Component>((r.result.calculation.entries as Component[]).map(e=>[e.key,e]));
   const changes=[...new Set([...old.keys(),...target.keys()])].sort().map(key=>({key,component:target.get(key)??old.get(key)!.details,prior:old.get(key),amount:(target.get(key)?.amountCents??0)-(old.get(key)?.amount??0)})).filter(e=>e.amount!==0);
   if(changes.length>1000)fail('This run exceeds the complete posting limit.');
   await db.query('INSERT INTO crm_commission_postings(run_id,evidence,created_by) VALUES($1,$2,$3)',[r.id,v.evidence,c.user.id]);
   if(!changes.length){await audit(db,c,'run_reconciled_without_difference',r.id);return {id:r.id,entries:0,moneyMoved:false};}
   const sourceKey='recurring:'+p.id+':'+r.invoice_id;let source=(await db.query('SELECT id FROM crm_referral_sources WHERE workspace_id=$1 AND source_key=$2 AND program=\'recurring\'',[c.workspace.id,sourceKey])).rows[0];
   if(!source){source={id:randomUUID()};await db.query("INSERT INTO crm_referral_sources(id,workspace_id,source_key,client_id,kind,units,amount_cents,basis,occurred_on,reference,program) VALUES($1,$2,$3,$4,'non_document_revenue',0,$5,'collected',$6,$7,'recurring')",[source.id,c.workspace.id,sourceKey,p.client_id,r.inputs.invoices.find((i:{id:string})=>i.id===r.invoice_id).collection.grossCents,businessDateKey(),'Original collection; subsequent facts preserved in calculation runs.']);}
   for(const change of changes){
    const part=change.component,isPartner=part.recipientKey.startsWith('partner:'),payee=part.recipientKey.slice(part.recipientKey.indexOf(':')+1);
    await db.query('INSERT INTO crm_commission_recipients(id,workspace_id,partner_id,user_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[randomUUID(),c.workspace.id,isPartner?payee:null,isPartner?null:payee]);
    const recipient=(await db.query('SELECT id FROM crm_commission_recipients WHERE workspace_id=$1 AND (partner_id=$2 OR user_id=$3)',[c.workspace.id,isPartner?payee:null,isPartner?null:payee])).rows[0];
    await db.query("INSERT INTO crm_referral_earnings(id,workspace_id,source_id,allocation_bps,amount_cents,earned_on,eligibility_note,created_by,program,recipient_id,run_id,component_key,service_month,details) VALUES($1,$2,$3,10000,$4,$5,$6,$7,'recurring',$8,$9,$10,$11,$12)",[randomUUID(),c.workspace.id,source.id,change.amount,businessDateKey(),v.evidence,c.user.id,recipient.id,r.id,change.key,part.month,JSON.stringify({component:part,priorCents:change.prior?.amount??0,targetCents:target.get(change.key)?.amountCents??0,adjustsEntryId:change.prior?.id??null,mode:p.mode})]);
   }
   await audit(db,c,'run_posted',r.id);return {id:r.id,entries:changes.length,moneyMoved:false};
  });
 });
}

export async function commissionWorkspace(c:DashboardContext){
 return workTransaction(c,false,async(db,role)=>{const access=await commercialAccess(db,c,role);
  const policies=(await db.query('SELECT p.*,c.name client,EXISTS(SELECT 1 FROM crm_commission_posting_approvals a WHERE a.policy_id=p.id) approved FROM crm_commission_policies p JOIN clients c ON c.id=p.client_id WHERE p.workspace_id=$1 ORDER BY p.created_at DESC,p.id LIMIT 101',[c.workspace.id])).rows;
  const clients=(await db.query('SELECT id,name FROM clients WHERE workspace_id=$1 ORDER BY name,id LIMIT 501',[c.workspace.id])).rows;
  const recipients=(await db.query('SELECT r.*,COALESCE(p.name,u.name) name FROM crm_commission_recipients r LEFT JOIN crm_referral_partners p ON p.id=r.partner_id LEFT JOIN "user" u ON u.id=r.user_id WHERE r.workspace_id=$1 ORDER BY name,r.id LIMIT 501',[c.workspace.id])).rows;
  const statements=(await db.query("SELECT s.*,COALESCE(p.name,u.name) name FROM crm_referral_statements s JOIN crm_commission_recipients r ON r.id=s.recipient_id LEFT JOIN crm_referral_partners p ON p.id=r.partner_id LEFT JOIN \"user\" u ON u.id=r.user_id WHERE s.workspace_id=$1 AND s.program='recurring' ORDER BY s.created_at DESC,s.id LIMIT 101",[c.workspace.id])).rows;
  return {...access,policies:policies.slice(0,100),clients:clients.slice(0,500),recipients:recipients.slice(0,500),statements:statements.slice(0,100),truncated:policies.length>100||clients.length>500||recipients.length>500||statements.length>100,postingEnabled:commissionPostingEnabled()};
 });
}
export async function getCommissionPolicy(c:DashboardContext,id:string){
 z.uuid().parse(id);
 return workTransaction(c,false,async(db,role)=>{const access=await commercialAccess(db,c,role),p=await policy(db,c,id),ctx=await evidenceContext(db,c,p,businessDateKey());
  const client=(await db.query('SELECT name FROM clients WHERE workspace_id=$1 AND id=$2',[c.workspace.id,p.client_id])).rows[0];
  const runs=(await db.query('SELECT id,invoice_id,as_of,result,created_at FROM crm_commission_runs WHERE workspace_id=$1 AND policy_id=$2 ORDER BY created_at DESC,id DESC LIMIT 101',[c.workspace.id,id])).rows;
  const approval=(await db.query('SELECT * FROM crm_commission_posting_approvals WHERE policy_id=$1',[id])).rows[0];
  return {...access,canCorrect:['owner','admin'].includes(role),policy:p,client:client.name,holds:ctx.holds,fingerprint:ctx.fingerprint,candidates:ctx.candidates,anchors:ctx.anchors,entitlements:ctx.entitlements,invoices:ctx.reviewed.map(i=>({id:i.id,providerId:i.provider_id})),runs:runs.slice(0,100),truncated:runs.length>100,approval:approval??null,postingEnabled:commissionPostingEnabled()};
 });
}

export async function createCommissionStatement(c:DashboardContext,input:unknown){
 const v=statementInput.parse(input),end=monthEnd(v.month);if(end>=businessDateKey()||v.dueOn<end)fail('Use a completed booking month and the agreed due date after month-end.');
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'commission_statement',v.requestId,v,async()=>{
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commission-statement:${c.workspace.id}:${v.recipientId}:${v.mode}`]);
  if(!(await db.query('SELECT 1 FROM crm_commission_recipients WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.recipientId])).rowCount)fail('That recipient is unavailable.');
  const rows=(await db.query(`SELECT e.id,e.amount_cents FROM crm_referral_earnings e JOIN crm_commission_runs r ON r.id=e.run_id JOIN crm_commission_policies p ON p.id=r.policy_id WHERE e.workspace_id=$1 AND e.program='recurring' AND e.recipient_id=$2 AND p.mode=$3 AND e.earned_on BETWEEN $4 AND $5 AND e.statement_id IS NULL ORDER BY e.earned_on,e.id LIMIT 1001 FOR UPDATE OF e`,[c.workspace.id,v.recipientId,v.mode,v.month,end])).rows;
  if(!rows.length||rows.length>1000)fail('Choose a completed month with 1–1,000 unassigned entries.');
  const total=rows.reduce((n,e)=>n+Number(e.amount_cents),0);if(!Number.isSafeInteger(total)||Math.abs(total)>1000000000000)fail('The statement total exceeds the supported limit.');
  const id=randomUUID();await db.query("INSERT INTO crm_referral_statements(id,workspace_id,starts_on,ends_on,total_cents,created_by,program,recipient_id,mode,due_on) VALUES($1,$2,$3,$4,$5,$6,'recurring',$7,$8,$9)",[id,c.workspace.id,v.month,end,total,c.user.id,v.recipientId,v.mode,v.dueOn]);
  for(const e of rows)await db.query('INSERT INTO crm_referral_statement_items(statement_id,earning_id,amount_cents) VALUES($1,$2,$3)',[id,e.id,e.amount_cents]);
  await db.query('UPDATE crm_referral_earnings SET statement_id=$1 WHERE id=ANY($2::uuid[])',[id,rows.map(e=>e.id)]);
  await db.query("INSERT INTO crm_referral_statement_events(id,statement_id,actor_user_id,status,note) VALUES($1,$2,$3,'draft',$4)",[randomUUID(),id,c.user.id,v.evidence]);await audit(db,c,'statement_created',id);return {id,totalCents:total,moneyMoved:false};
 });});
}
export async function validateCommissionStatementSources(db:PoolClient,c:DashboardContext,id:string){
 const d=await statementSettlementData(db,id,0);if(d.openDisputes.length)fail('Resolve the recorded statement dispute first.');
 const heads=(await db.query(`SELECT DISTINCT ON (head.policy_id,head.invoice_id) head.id
  FROM crm_referral_statement_items si JOIN crm_referral_earnings item ON item.id=si.earning_id JOIN crm_commission_runs original ON original.id=item.run_id
  JOIN crm_commission_runs head ON head.policy_id=original.policy_id AND head.invoice_id=original.invoice_id
  JOIN crm_commission_postings posted ON posted.run_id=head.id
  WHERE si.statement_id=$1 ORDER BY head.policy_id,head.invoice_id,posted.sequence DESC`,[id])).rows;
 if(!heads.length)fail('This statement has no reconciled posted source evidence.');
 for(const h of heads)await currentRun(db,c,h.id);
}
export async function getCommissionStatement(c:DashboardContext,id:string){
 z.uuid().parse(id);
 return workTransaction(c,false,async(db,role)=>{const access=await commercialAccess(db,c,role),s=(await db.query("SELECT s.*,COALESCE(p.name,u.name) name FROM crm_referral_statements s JOIN crm_commission_recipients r ON r.id=s.recipient_id LEFT JOIN crm_referral_partners p ON p.id=r.partner_id LEFT JOIN \"user\" u ON u.id=r.user_id WHERE s.workspace_id=$1 AND s.id=$2 AND s.program='recurring'",[c.workspace.id,id])).rows[0];if(!s)fail('That statement is unavailable.');
  const items=(await db.query('SELECT i.amount_cents,e.id,e.earned_on,e.service_month,e.details,e.run_id,r.invoice_id,c.name client FROM crm_referral_statement_items i JOIN crm_referral_earnings e ON e.id=i.earning_id JOIN crm_commission_runs r ON r.id=e.run_id JOIN crm_commission_policies p ON p.id=r.policy_id JOIN clients c ON c.id=p.client_id WHERE i.statement_id=$1 ORDER BY c.name,e.service_month,e.id',[id])).rows;
  const events=(await db.query('SELECT e.*,u.name actor FROM crm_referral_statement_events e LEFT JOIN "user" u ON u.id=e.actor_user_id WHERE e.statement_id=$1 ORDER BY e.created_at,e.id',[id])).rows;
  const settlement=await statementSettlementData(db,id,Number(s.total_cents));
  const credits=(await db.query("SELECT s.id,s.revision,s.starts_on,s.total_cents-COALESCE((SELECT sum(amount_cents) FROM crm_commission_settlements p WHERE p.statement_id=s.id),0) outstanding_cents FROM crm_referral_statements s WHERE s.workspace_id=$1 AND s.program='recurring' AND s.recipient_id=$2 AND s.mode=$3 AND s.status='approved' AND s.total_cents<0 ORDER BY s.starts_on,s.id LIMIT 101",[c.workspace.id,s.recipient_id,s.mode])).rows;
  return {...access,statement:s,items,events,settlement,credits:credits.slice(0,100).filter(r=>Number(r.outstanding_cents)<0),creditsTruncated:credits.length>100};
 });
}
export async function changeCommissionStatement(c:DashboardContext,input:unknown){
 const v=statementChangeInput.parse(input);
 if(v.operation==='record_paid'){
  const {recordStatementSettlement}=await import('./settlements');
  return recordStatementSettlement(c,{requestId:v.requestId,id:v.id,revision:v.revision,expectedTotalCents:v.expectedTotalCents,evidence:v.evidence,reference:v.paymentReference,settledOn:businessDateKey()});
 }
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'commission_statement_change',v.requestId,v,async()=>{
  const s=(await db.query("SELECT * FROM crm_referral_statements WHERE workspace_id=$1 AND id=$2 AND program='recurring' FOR UPDATE",[c.workspace.id,v.id])).rows[0];
  if(!s||s.revision!==v.revision||Number(s.total_cents)!==v.expectedTotalCents)fail('Review the statement’s current total and revision.');
  const expected={review:'draft',approve:'reviewed',record_paid:'approved',void:''}[v.operation];if(v.operation==='void'?!['draft','reviewed'].includes(s.status):s.status!==expected)fail('That transition is unavailable. Approved or paid statements require later adjustment entries.');
  if(v.operation!=='void'){
   await validateCommissionStatementSources(db,c,s.id);
  }
  const status={review:'reviewed',approve:'approved',record_paid:'paid',void:'void'}[v.operation];
  await db.query('UPDATE crm_referral_statements SET status=$2,revision=revision+1,payment_reference=$3 WHERE id=$1',[s.id,status,v.paymentReference??null]);
  if(status==='void')await db.query('UPDATE crm_referral_earnings SET statement_id=NULL WHERE statement_id=$1',[s.id]);
  await db.query('INSERT INTO crm_referral_statement_events(id,statement_id,actor_user_id,status,note) VALUES($1,$2,$3,$4,$5)',[randomUUID(),s.id,c.user.id,status,v.evidence]);await audit(db,c,'statement_'+status,s.id);return {id:s.id,status,moneyMoved:false};
 });});
}
