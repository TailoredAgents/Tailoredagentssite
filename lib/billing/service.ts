import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {DashboardContext} from '@/lib/dashboard/data';
import {insertAuditLog} from '@/lib/dashboard/db';
import {workTransaction,once} from '@/lib/relationships/transactions';
import {SalesAccessError} from '@/lib/sales/data';
import {businessDateKey} from '@/lib/time';
import {commercialAccess} from '@/lib/commercial/access';
import {previewRecurringCalculation,type CalculationInput} from '@/lib/commercial/calculation';
import {currentExceptionApproval,exceptionFingerprint} from './exceptions';
import {collectionEvidence} from './allocation';
import {invoiceFactsSchema,reviewInput,retryInput,type BillingReview} from './contract';
import {queueBillingJob} from './reconciliation';

const day=(v:Date|string)=>new Date(v).toISOString().slice(0,10);
const previous=(v:Date|string)=>new Date(new Date(v).getTime()-86400000).toISOString().slice(0,10);
const fail=(message:string):never=>{throw new SalesAccessError(message);};
export async function reviewBillingInvoice(c:DashboardContext,input:unknown){
 const v=reviewInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'billing_review',v.requestId,v,async()=>{
  const i=(await db.query('SELECT i.*,s.facts FROM crm_billing_invoices i JOIN crm_billing_snapshots s ON s.id=i.snapshot_id WHERE i.workspace_id=$1 AND i.id=$2 FOR UPDATE OF i',[c.workspace.id,v.invoiceId])).rows[0];
  if(!i||i.revision!==v.revision||i.snapshot_id!==v.snapshotId)fail('The source changed. Review the latest imported invoice before saving.');
  const facts=invoiceFactsSchema.parse(i.facts);
  if(!facts.customerId)fail('This invoice has no provider customer identity to map.');
  if(!(await db.query('SELECT 1 FROM clients WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,v.clientId])).rowCount)fail('Choose a client in this workspace.');
  if(facts.currency!=='usd'||facts.totalCents<=0)fail('Only a positive USD invoice can be classified for this calculation.');
  const sources=new Set(facts.lines.map(l=>l.id)),seen=new Set<string>();
  for(const line of v.lines){
   if(seen.has(line.sourceId))fail('Use each source line once.');seen.add(line.sourceId);
   if(!sources.has(line.sourceId)&&line.sourceId!=='tax')fail('Use imported line IDs or the separate tax line.');
   if(line.sourceId==='tax'&&line.classification!=='tax')fail('A tax allocation cannot become recurring revenue.');
  }
  if([...sources].some(id=>!seen.has(id))||v.lines.reduce((s,l)=>s+l.amountCents,0)!==facts.totalCents)fail('Classify every imported line and reconcile the reviewed gross amounts to the invoice total.');
  if(v.lines.filter(l=>l.classification==='tax').reduce((s,l)=>s+l.amountCents,0)!==facts.lines.reduce((s,l)=>s+l.taxCents,0))fail('Separate the imported tax amount from service revenue.');
  if(new Set(v.bankEvidence.map(b=>b.chargeId)).size!==v.bankEvidence.length)fail('Use one bank evidence reference per charge.');
  for(const bank of v.bankEvidence){const r=facts.receipts.find(r=>r.chargeId===bank.chargeId);if(!r||bank.clearedOn<r.collectedOn||bank.clearedOn>businessDateKey())fail('Bank evidence must reference an actual payment and a valid past/present clearing date.');}
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`billing-customer:${i.connection_id}:${facts.customerId}`]);
  const existing=(await db.query('SELECT client_id FROM crm_billing_customer_maps WHERE connection_id=$1 AND customer_id=$2',[i.connection_id,facts.customerId])).rows[0];
  if(existing&&existing.client_id!==v.clientId)fail('This provider customer is already mapped to a different CRM client. Resolve the identity conflict before calculating.');
  await db.query('INSERT INTO crm_billing_customer_maps(connection_id,customer_id,workspace_id,client_id,evidence,actor_user_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[i.connection_id,facts.customerId,c.workspace.id,v.clientId,v.evidence,c.user.id]);
  const id=randomUUID();await db.query('INSERT INTO crm_billing_reviews(id,workspace_id,invoice_id,snapshot_id,client_id,policy,lines,bank_evidence,evidence,actor_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,c.workspace.id,i.id,i.snapshot_id,v.clientId,v.policy,JSON.stringify(v.lines),JSON.stringify(v.bankEvidence),v.evidence,c.user.id]);
  await db.query('UPDATE crm_billing_invoices SET revision=revision+1 WHERE id=$1',[i.id]);
  await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'billing.invoice_reviewed',targetType:'billing_invoice',targetId:i.id});
  return {id,invoiceId:i.id,postingEnabled:false,moneyMoved:false};
 });});
}
export async function retryBillingReconciliation(c:DashboardContext,input:unknown){
 const v=retryInput.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'billing_retry',v.requestId,v,async()=>{
  if(!(await db.query('SELECT 1 FROM crm_billing_connections WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.connectionId])).rowCount)fail('That billing connection is unavailable.');
  await queueBillingJob(db,v.connectionId);
  await db.query("UPDATE crm_billing_jobs SET status='queued',attempts=0,available_at=now(),last_error=NULL WHERE connection_id=$1 AND status IN ('retry','failed')",[v.connectionId]);
  await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'billing.reconciliation_requested',targetType:'billing_connection',targetId:v.connectionId});
  return {queued:true,providerWrites:false};
 });});
}
export async function billingWorkspace(c:DashboardContext,page=1){
 z.number().int().min(1).max(10000).parse(page);
 return workTransaction(c,false,async(db,role)=>{
  const access=await commercialAccess(db,c,role);
  const connections=(await db.query('SELECT * FROM crm_billing_connections WHERE workspace_id=$1 ORDER BY created_at,id',[c.workspace.id])).rows;
  const invoices=(await db.query(`SELECT i.*,s.facts->>'currency' currency,s.facts->>'totalCents' total_cents,s.facts->>'status' source_status,c.mode,m.client_id,cl.name client,
   EXISTS(SELECT 1 FROM crm_billing_reviews r WHERE r.invoice_id=i.id AND r.snapshot_id=i.snapshot_id) reviewed
   FROM crm_billing_invoices i JOIN crm_billing_connections c ON c.id=i.connection_id JOIN crm_billing_snapshots s ON s.id=i.snapshot_id LEFT JOIN crm_billing_customer_maps m ON m.connection_id=i.connection_id AND m.customer_id=s.facts->>'customerId' LEFT JOIN clients cl ON cl.id=m.client_id AND cl.workspace_id=i.workspace_id WHERE i.workspace_id=$1 ORDER BY i.observed_at DESC,i.id LIMIT 51 OFFSET $2`,[c.workspace.id,(page-1)*50])).rows;
  const jobs=(await db.query("SELECT j.* FROM crm_billing_jobs j JOIN crm_billing_connections c ON c.id=j.connection_id WHERE c.workspace_id=$1 AND j.status<>'done' ORDER BY j.updated_at DESC,j.id LIMIT 101",[c.workspace.id])).rows;
  return {...access,connections,invoices:invoices.slice(0,50),more:invoices.length>50,page,jobs:jobs.slice(0,100),jobsTruncated:jobs.length>100,postingEnabled:false};
 });
}
export async function getBillingInvoice(c:DashboardContext,id:string){
 z.uuid().parse(id);
 return workTransaction(c,false,async(db,role)=>{
  const access=await commercialAccess(db,c,role);
  const i=(await db.query('SELECT i.*,s.facts,c.mode,c.account_id,c.last_scan_at FROM crm_billing_invoices i JOIN crm_billing_snapshots s ON s.id=i.snapshot_id JOIN crm_billing_connections c ON c.id=i.connection_id WHERE i.workspace_id=$1 AND i.id=$2',[c.workspace.id,id])).rows[0];
  if(!i)fail('That imported invoice is unavailable.');
  const facts=invoiceFactsSchema.parse(i.facts),reviews=(await db.query('SELECT r.*,u.name actor FROM crm_billing_reviews r LEFT JOIN "user" u ON u.id=r.actor_user_id WHERE r.workspace_id=$1 AND r.invoice_id=$2 ORDER BY r.created_at DESC,r.id DESC LIMIT 101',[c.workspace.id,id])).rows;
  const clients=(await db.query('SELECT id,name FROM clients WHERE workspace_id=$1 ORDER BY name,id LIMIT 501',[c.workspace.id])).rows;
  const versions=(await db.query('SELECT id,fingerprint,observed_at FROM crm_billing_snapshots WHERE invoice_id=$1 ORDER BY observed_at DESC,id LIMIT 101',[id])).rows;
  const review=reviews[0],holds:string[]=[];
  if(!review||review.snapshot_id!==i.snapshot_id)holds.push('The current source snapshot needs finance review.');
  const stale=Date.now()-new Date(i.observed_at).getTime()>86400000;if(stale)holds.push('Source evidence is more than a day old; reconcile it before calculation.');
  if((await db.query("SELECT 1 FROM crm_billing_jobs WHERE connection_id=$1 AND status<>'done' AND (kind='scan' OR object_id=$2)",[i.connection_id,i.provider_id])).rowCount)holds.push('Reconciliation is queued, retrying or needs recovery.');
  const duplicates=(await db.query('SELECT charge_id FROM crm_billing_payment_links WHERE connection_id=$1 AND charge_id=ANY($2::text[]) GROUP BY charge_id HAVING count(*)>1',[i.connection_id,facts.receipts.map(r=>r.chargeId)])).rows;
  if(duplicates.length)holds.push('A processor charge is linked more than once. Its invoice allocations require review.');
  const current=review&&review.snapshot_id===i.snapshot_id?{policy:review.policy,lines:review.lines,bankEvidence:review.bank_evidence} as Pick<BillingReview,'policy'|'lines'|'bankEvidence'>:null;
  const exceptionApproval=current?await currentExceptionApproval(db,id,i.snapshot_id,review.id):undefined;
  const collection=current?collectionEvidence(facts,current,businessDateKey(),exceptionApproval):null;
  if(collection)holds.push(...collection.holds);
  const roles:CalculationInput['roles']=[];
  if(current){
   const entitlements=(await db.query('SELECT * FROM crm_customer_entitlements WHERE workspace_id=$1 AND client_id=$2 ORDER BY role,id LIMIT 101',[c.workspace.id,review.client_id])).rows;
   if(entitlements.length>100)holds.push('Eligibility exceeds the complete-calculation limit.');
   for(const e of entitlements){
    if(e.rule_snapshot.windowMonths!==null)holds.push('A fixed customer window needs its verified, approved original receipt anchor. Review it in Finance → Recurring commissions.');
    if(e.referral_id){const r=(await db.query('SELECT revision,status FROM crm_referral_submissions WHERE workspace_id=$1 AND id=$2',[c.workspace.id,e.referral_id])).rows[0];if(!r||r.status!=='accepted'||r.revision!==e.source_snapshot.referralRevision)holds.push('Referral attribution changed; review its preserved acceptance and deadline.');}
    if((await db.query("SELECT 1 FROM crm_eligibility_reviews WHERE workspace_id=$1 AND entitlement_id=$2 AND status='open'",[c.workspace.id,e.id])).rowCount)holds.push('An eligibility review is unresolved.');
    const periods=(await db.query('SELECT p.*,a.ends_at assignment_end FROM crm_eligibility_periods p LEFT JOIN crm_client_manager_history a ON a.workspace_id=p.workspace_id AND a.id=p.assignment_id WHERE p.workspace_id=$1 AND p.entitlement_id=$2 ORDER BY p.starts_on,p.id LIMIT 101',[c.workspace.id,e.id])).rows;
    if(periods.length>100)holds.push('Eligibility period history exceeds the complete-calculation limit.');
    if(!periods.length)holds.push('An attributed recipient has no reviewed eligible service periods.');
    for(const p of periods){
     if(p.assignment_end&&(!p.ends_before||day(p.ends_before)>businessDateKey(p.assignment_end)))holds.push('Manager service dates exceed recorded assignment coverage.');
     roles.push({recipientId:e.partner_id??e.user_id,agreementId:e.document_id,role:e.role,rateBps:e.rule_snapshot.rateBps,startsOn:day(p.starts_on),endsOn:p.ends_before?previous(p.ends_before):null,windowStartsOn:null,windowMonths:e.rule_snapshot.windowMonths});
    }
   }
  }
  let calculation:ReturnType<typeof previewRecurringCalculation>|null=null;
  if(collection&&current&&!holds.length){
   try{calculation=previewRecurringCalculation({asOf:businessDateKey(),collectedOn:collection.cleared.map(r=>r.clearedOn).sort().at(-1)??businessDateKey(),cleared:true,collectedCents:collection.netCents,refundedCents:0,lines:collection.effectiveLines.map(l=>({description:l.description,classification:l.classification,amountCents:l.amountCents,startsOn:l.startsOn,endsOn:l.endsOn})),roles});holds.push(...calculation.holds);}catch{holds.push('Source allocations or eligibility do not reconcile; review before calculating.');}
  }
  const exceptionReviews=(await db.query('SELECT * FROM crm_billing_exception_reviews WHERE workspace_id=$1 AND invoice_id=$2 ORDER BY created_at DESC LIMIT 101',[c.workspace.id,id])).rows;
  return {...access,exceptionApproval:exceptionApproval??null,exceptionFingerprint:current?exceptionFingerprint(i.snapshot_id,review.id):null,exceptionReviews:exceptionReviews.slice(0,100),exceptionsTruncated:exceptionReviews.length>100,invoice:{...i,facts},review:review??null,reviews:reviews.slice(0,100),versions:versions.slice(0,100),clients:clients.slice(0,500),historyTruncated:reviews.length>100||versions.length>100,choicesTruncated:clients.length>500,collection,calculation:holds.length?null:calculation,holds:[...new Set(holds)],postingEnabled:false,moneyMoved:false};
 });
}
