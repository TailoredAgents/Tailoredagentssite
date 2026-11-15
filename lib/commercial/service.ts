import 'server-only';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DashboardContext} from '@/lib/dashboard/data';
import {insertAuditLog} from '@/lib/dashboard/db';
import {SalesAccessError} from '@/lib/sales/data';
import {businessDateKey} from '@/lib/time';
import {workTransaction,once,activeTeammate} from '@/lib/relationships/transactions';
import {relationshipIds,relationshipAccess} from '@/lib/relationships/service';
import {commercialAccess} from './access';
import {commercialDocumentSchema,agreementDetails,budgetDetails,invoiceDetails,documentTransition,referralSubmission,referralDecision} from './contract';

async function audit(db:PoolClient,c:DashboardContext,action:string,id:string){await insertAuditLog(db,{workspaceId:c.workspace.id,actorUserId:c.user.id,action:'commercial.'+action,targetType:'commercial_record',targetId:id});}
async function clientExists(db:PoolClient,c:DashboardContext,id:string){if(!(await db.query('SELECT 1 FROM clients WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,id])).rowCount)throw new SalesAccessError('Choose a client in this workspace.');}
async function partnerExists(db:PoolClient,c:DashboardContext,id:string){if(!(await db.query('SELECT 1 FROM crm_referral_partners WHERE workspace_id=$1 AND id=$2 FOR SHARE',[c.workspace.id,id])).rowCount)throw new SalesAccessError('Choose a partner in this workspace.');}

export async function saveCommercialDocument(c:DashboardContext,input:unknown){
 const v=commercialDocumentSchema.parse(input);
 const details=v.kind==='invoice'?invoiceDetails.parse(v.details):v.kind==='project_budget'?budgetDetails.parse(v.details):agreementDetails.parse(v.details);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'commercial_document',v.requestId,{...v,details},async()=>{
  if(v.kind==='external_referral'){if(!v.partnerId||v.userId||v.clientId)throw new SalesAccessError('An external agreement needs only its partner.');await partnerExists(db,c,v.partnerId);}
  else if(v.kind==='internal_commission'){if(!v.userId||v.partnerId||v.clientId)throw new SalesAccessError('An internal agreement needs only its teammate.');await activeTeammate(db,c,v.userId);}
  else {if(!v.clientId||v.partnerId||v.userId)throw new SalesAccessError('Choose the customer for this document.');await clientExists(db,c,v.clientId);}
  if(v.kind==='external_referral'||v.kind==='internal_commission'||v.kind==='customer_service'){
   const d=agreementDetails.parse(details),roles=d.rules.map(r=>r.role);
   if(new Set(roles).size!==roles.length||roles.some(r=>v.kind==='external_referral'?r!=='external':v.kind==='internal_commission'?r==='external':true))throw new SalesAccessError('Use distinct rules appropriate to this agreement type. Customer service agreements do not set staff commissions.');
   if(v.kind!=='customer_service'&&!roles.length)throw new SalesAccessError('Record the proposed commission rule.');
  }
  if(v.kind==='project_budget'){const d=budgetDetails.parse(details);if(!(await db.query('SELECT 1 FROM projects WHERE workspace_id=$1 AND id=$2 AND client_id=$3 FOR SHARE',[c.workspace.id,d.projectId,v.clientId])).rowCount)throw new SalesAccessError('Choose a project belonging to this client.');for(const p of d.participants)await activeTeammate(db,c,p.userId);}
  let family=randomUUID(),version=1;
  if(v.previousId){
   const old=(await db.query('SELECT * FROM crm_commercial_documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,v.previousId])).rows[0];
   if(!old||old.kind!==v.kind||old.client_id!==(v.clientId??null)||old.partner_id!==(v.partnerId??null)||old.user_id!==(v.userId??null))throw new SalesAccessError('Revisions must retain the same document type and counterparty.');
   family=old.family_id;await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commercial:${c.workspace.id}:${family}`]);
   const latest=Number((await db.query('SELECT max(version) AS version FROM crm_commercial_documents WHERE workspace_id=$1 AND family_id=$2',[c.workspace.id,family])).rows[0].version);
   if(latest!==old.version)throw new SalesAccessError('A newer version exists. Start from the latest document.');version=latest+1;
  }
  const id=randomUUID();await db.query('INSERT INTO crm_commercial_documents(id,workspace_id,family_id,version,kind,client_id,partner_id,user_id,title,details,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,c.workspace.id,family,version,v.kind,v.clientId??null,v.partnerId??null,v.userId??null,v.title,details,c.user.id]);
  await audit(db,c,'document_drafted',id);return {id,version,status:'draft',moneyMoved:false};
 });});
}

export async function changeCommercialDocument(c:DashboardContext,input:unknown){
 const v=documentTransition.parse(input);return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'commercial_transition',v.requestId,v,async()=>{
  const d=(await db.query('SELECT * FROM crm_commercial_documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,v.id])).rows[0];
  if(!d||d.revision!==v.revision)throw new SalesAccessError('The document changed. Review its current revision.');
  if(v.operation==='review'&&d.status!=='draft'||v.operation==='execute'&&(d.status!=='reviewed'||d.kind==='invoice'||!v.effectiveOn)||v.operation==='supersede'&&d.status==='superseded')throw new SalesAccessError('This transition is unavailable. Invoices cannot be issued from preparation.');
  if(v.operation!=='execute'&&v.effectiveOn)throw new SalesAccessError('Only execution records an effective date. Preserve the signed version when superseding.');
  const status={review:'reviewed',execute:'executed',supersede:'superseded'}[v.operation];
  if(status==='executed'){
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commercial:${c.workspace.id}:${d.family_id}`]);
   if((await db.query("SELECT 1 FROM crm_commercial_documents WHERE workspace_id=$1 AND family_id=$2 AND status='executed' AND id<>$3",[c.workspace.id,d.family_id,d.id])).rowCount)throw new SalesAccessError('Record the prior version as superseded before confirming a replacement. Its history remains.');
  }
  await db.query('UPDATE crm_commercial_documents SET status=$3,revision=revision+1,evidence=$4,effective_on=COALESCE($5,effective_on) WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.id,status,v.evidence,v.effectiveOn??null]);
  await db.query('INSERT INTO crm_commercial_events(id,workspace_id,document_id,actor_user_id,operation,note) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),c.workspace.id,v.id,c.user.id,status,v.evidence]);
  await audit(db,c,'document_'+status,v.id);return {id:v.id,status,financialRulesActivated:false};
 });});
}

export async function submitReferral(c:DashboardContext,input:unknown){
 const v=referralSubmission.parse(input);if(v.submittedOn>businessDateKey())throw new SalesAccessError('A submission date cannot be in the future.');await relationshipIds(c,v);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'referral_submit',v.requestId,v,async()=>{
  await relationshipAccess(c,v,db);await partnerExists(db,c,v.partnerId);const id=randomUUID();
  await db.query('INSERT INTO crm_referral_submissions(id,workspace_id,partner_id,target_kind,target_id,submitted_on,decision_due_on,evidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,c.workspace.id,v.partnerId,v.kind,v.id,v.submittedOn,v.decisionDueOn,v.evidence,c.user.id]);await audit(db,c,'referral_submitted',id);return {id,status:'submitted'};
 });});
}

export async function decideReferral(c:DashboardContext,input:unknown){
 const v=referralDecision.parse(input);
 return workTransaction(c,true,async(db,role)=>{await commercialAccess(db,c,role,true);return once(db,c,'referral_decision',v.requestId,v,async()=>{
  // Workspace acceptance lock covers linked targets as well as concurrent client binding.
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`referral-accept:${c.workspace.id}`]);
  const r=(await db.query('SELECT * FROM crm_referral_submissions WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[c.workspace.id,v.id])).rows[0];
  if(!r||r.revision!==v.revision)throw new SalesAccessError('This referral changed. Review it again.');
  const related=await relationshipIds(c,{kind:r.target_kind,id:r.target_id});
  const clientId=v.clientId??r.client_id??related.find(x=>x.kind==='client')?.id??null;
  if(clientId&&!related.some(x=>x.kind==='client'&&x.id===clientId))throw new SalesAccessError('The client must be linked to the submitted relationship.');
  if(v.status==='accepted'){
   if(!v.acceptedOn||v.acceptedOn>businessDateKey()||v.acceptedOn<new Date(r.submitted_on).toISOString().slice(0,10)||!v.conversionDueOn||v.conversionDueOn<v.acceptedOn)throw new SalesAccessError('Record the actual acceptance and conversion deadline from the agreed terms.');
   if(r.accepted_on&&new Date(r.accepted_on).toISOString().slice(0,10)!==v.acceptedOn)throw new SalesAccessError('Preserve the original acceptance date. Record any extension using the conversion deadline and evidence.');
   if((await db.query("SELECT 1 FROM crm_referral_submissions WHERE workspace_id=$1 AND id<>$2 AND status='accepted' AND (target_id=ANY($3::uuid[]) OR ($4::uuid IS NOT NULL AND client_id=$4))",[c.workspace.id,v.id,related.map(x=>x.id),clientId])).rowCount)throw new SalesAccessError('A connected relationship already has an accepted referral. Resolve the conflict before accepting another.');
  }
  if(v.status==='expired'&&(!r.conversion_due_on||new Date(r.conversion_due_on).toISOString().slice(0,10)>=businessDateKey()))throw new SalesAccessError('Only a referral past its recorded conversion deadline can be marked expired.');
  await db.query('UPDATE crm_referral_submissions SET status=$3,revision=revision+1,client_id=$4,accepted_on=COALESCE($5,accepted_on),conversion_due_on=COALESCE($6,conversion_due_on),decision_note=$7 WHERE workspace_id=$1 AND id=$2',[c.workspace.id,v.id,v.status,clientId,v.acceptedOn??null,v.conversionDueOn??null,v.note]);
  await db.query('INSERT INTO crm_referral_decisions(id,workspace_id,submission_id,actor_user_id,status,note,details) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),c.workspace.id,v.id,c.user.id,v.status,v.note,v]);
  await audit(db,c,'referral_'+v.status,v.id);return {id:v.id,status:v.status,commissionCreated:false};
 });});
}

export async function commercialWorkspace(c:DashboardContext,page=1){
 if(!Number.isInteger(page)||page<1||page>10000)throw new SalesAccessError('Choose a valid page.');
 return workTransaction(c,false,async(db,role)=>{
  const access=await commercialAccess(db,c,role);
  const documents=(await db.query(`SELECT d.*,COALESCE(cl.name,p.name,u.name) counterparty FROM crm_commercial_documents d LEFT JOIN clients cl ON cl.id=d.client_id AND cl.workspace_id=d.workspace_id LEFT JOIN crm_referral_partners p ON p.id=d.partner_id AND p.workspace_id=d.workspace_id LEFT JOIN "user" u ON u.id=d.user_id WHERE d.workspace_id=$1 ORDER BY d.created_at DESC,d.id LIMIT 51 OFFSET $2`,[c.workspace.id,(page-1)*50])).rows;
  const referrals=(await db.query('SELECT r.*,p.name partner FROM crm_referral_submissions r JOIN crm_referral_partners p ON p.id=r.partner_id AND p.workspace_id=r.workspace_id WHERE r.workspace_id=$1 ORDER BY r.created_at DESC,r.id LIMIT 51 OFFSET $2',[c.workspace.id,(page-1)*50])).rows;
  const clients=(await db.query('SELECT id,name FROM clients WHERE workspace_id=$1 ORDER BY name,id LIMIT 500',[c.workspace.id])).rows;
  const partners=(await db.query('SELECT id,name FROM crm_referral_partners WHERE workspace_id=$1 ORDER BY name,id LIMIT 500',[c.workspace.id])).rows;
  const members=(await db.query('SELECT u.id,u.name FROM workspace_memberships m JOIN "user" u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.status=\'active\' AND m.role<>\'viewer\' ORDER BY u.name LIMIT 500',[c.workspace.id])).rows;
  const projects=(await db.query('SELECT p.id,p.name,p.client_id FROM projects p WHERE p.workspace_id=$1 ORDER BY p.name,p.id LIMIT 500',[c.workspace.id])).rows;
  const targets=(await db.query(`SELECT kind,id,name FROM (
   SELECT 'client' kind,id,name FROM clients WHERE workspace_id=$1 UNION ALL
   SELECT 'lead',id,name FROM leads WHERE workspace_id=$1 AND anonymized_at IS NULL UNION ALL
   SELECT 'business',id,name FROM crm_businesses WHERE workspace_id=$1 AND anonymized_at IS NULL UNION ALL
   SELECT 'opportunity',id,title FROM crm_opportunities WHERE workspace_id=$1 UNION ALL
   SELECT 'contact',id,name FROM contacts WHERE workspace_id=$1
  ) t ORDER BY name,id LIMIT 500`,[c.workspace.id])).rows;
  return {...access,documents:documents.slice(0,50),referrals:referrals.slice(0,50),more:documents.length>50||referrals.length>50,clients,partners,members,projects,targets,page,stripeConnected:false,mode:'preparation'};
 });
}

export async function getCommercialDocument(c:DashboardContext,id:string){
 return workTransaction(c,false,async(db,role)=>{
  const access=await commercialAccess(db,c,role);
  const document=(await db.query(`SELECT d.*,COALESCE(cl.name,p.name,u.name) counterparty FROM crm_commercial_documents d LEFT JOIN clients cl ON cl.id=d.client_id AND cl.workspace_id=d.workspace_id LEFT JOIN crm_referral_partners p ON p.id=d.partner_id AND p.workspace_id=d.workspace_id LEFT JOIN "user" u ON u.id=d.user_id WHERE d.workspace_id=$1 AND d.id=$2`,[c.workspace.id,id])).rows[0];
  if(!document)throw new SalesAccessError('That commercial document is unavailable.');
  const events=(await db.query('SELECT e.*,u.name actor FROM crm_commercial_events e LEFT JOIN "user" u ON u.id=e.actor_user_id WHERE e.workspace_id=$1 AND e.document_id=$2 ORDER BY e.created_at,e.id LIMIT 100',[c.workspace.id,id])).rows;
  const versions=(await db.query('SELECT id,version,status FROM crm_commercial_documents WHERE workspace_id=$1 AND family_id=$2 ORDER BY version DESC LIMIT 100',[c.workspace.id,document.family_id])).rows;
  return {...access,document,events,versions};
 });
}
