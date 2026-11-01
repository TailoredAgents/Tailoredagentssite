import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {getInquiryNotificationConfiguration} from '@/lib/inquiry-notifications';
import {recordInquiryDelivery} from '@/lib/operations/public-inquiries';
import {inquirySchema} from './validation';
import {CARD_WORKSPACE} from './types';
import {validateCardSource} from './data';
import {CardError} from './http';
export async function saveCardInquiry(raw:unknown){
 const result=inquirySchema.safeParse(raw);if(!result.success)throw new CardError('Please enter your name, a valid email, and permission to contact you.');
 const v=result.data;
 if(v.website||Date.now()-v.startedAt<2000||v.startedAt>Date.now())throw new CardError('Please review your details and try again.');
 const profile=await validateCardSource(v.profile,v.card);
 const hash=createHash('sha256').update(JSON.stringify([v.profile,v.email.toLowerCase(),v.name,v.interest,v.message])).digest('hex');
 const key=`smart-card:${v.submissionId}`,db=await getDatabasePool().connect();let leadId='',duplicate=false;
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`card-inquiry:${hash}`]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
  const prior=(await db.query<{id:string;fingerprint:string}>(`SELECT id,fingerprint FROM leads WHERE workspace_id=$1 AND source='smart_card' AND (submission_id=$2 OR (fingerprint=$3 AND created_at>now()-interval '15 minutes')) ORDER BY created_at DESC LIMIT 1`,[CARD_WORKSPACE,key,hash])).rows[0];
  if(prior){if(prior.fingerprint!==hash)throw new CardError('This request was already submitted. Refresh the page to send another.',409);leadId=prior.id;duplicate=true;}
  else {
   const live=(await db.query<{login_email:string}>(`SELECT login_email FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2 AND published FOR SHARE`,[CARD_WORKSPACE,v.profile])).rows[0];if(!live)throw new CardError('This profile is unavailable.',404);
   if(v.card && !(await db.query('SELECT 1 FROM smart_cards WHERE workspace_id=$1 AND code=$2 AND profile_slug=$3 AND active FOR SHARE',[CARD_WORKSPACE,v.card,v.profile])).rowCount)throw new CardError('Please scan your card again.',409);
   const owner=(await db.query<{id:string}>(`SELECT u.id FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=$1 AND m.status='active' AND m.role<>'viewer' AND lower(trim(u.email))=$2 LIMIT 1`,[CARD_WORKSPACE,live.login_email])).rows[0];
   leadId=randomUUID();
   await db.query(`INSERT INTO leads(id,workspace_id,submission_id,fingerprint,source,status,name,organization,email,phone,interest,description,owner_user_id,delivery_status,smart_card_context) VALUES($1,$2,$3,$4,'smart_card','new',$5,$6,$7,$8,$9,$10,$11,'pending',$12::jsonb)`,[leadId,CARD_WORKSPACE,key,hash,v.name,v.organization,v.email.toLowerCase(),v.phone||null,v.interest,`Introduced through ${profile.display_name}’s Tailored Agents card.\n\n${v.message||'Requested a conversation.'}\n\nVisitor agreed to be contacted about this request.`,owner?.id??null,JSON.stringify({profile:v.profile,card:v.card,channel:v.card?v.channel:'direct',consentedAt:new Date().toISOString()})]);
   await insertAuditLog(db,{workspaceId:CARD_WORKSPACE,action:'lead.received',targetType:'lead',targetId:leadId,metadata:{source:'smart_card',profile:v.profile}});
   // A networking inquiry does not authorize research, an automated text, or a build.
  }
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 if(!duplicate)await notifyCardInquiry(leadId,profile.display_name,v);
 return {received:true};
}
async function notifyCardInquiry(leadId:string,person:string,v:ReturnType<typeof inquirySchema.parse>){
 const cfg=getInquiryNotificationConfiguration();let status:'sent'|'failed'|'not_configured'='not_configured';
 if(cfg){try{const r=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${cfg.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`smart-card:${v.submissionId}`},body:JSON.stringify({from:cfg.from,to:cfg.to,reply_to:v.email,subject:`Smart Card inquiry — ${v.name}`,text:`Introduced by ${person}\nInterest: ${v.interest}\nName: ${v.name}\nBusiness: ${v.organization||'Not provided'}\nEmail: ${v.email}\nPhone: ${v.phone||'Not provided'}\n\n${v.message}\n\nOpen lead: https://www.tailoredagents.com/dashboard/leads/${leadId}`}),signal:AbortSignal.timeout(10000)});status=r.ok?'sent':'failed';await r.body?.cancel();}catch{status='failed';}}
 try{await recordInquiryDelivery(leadId,{status});}catch{/* The saved lead remains authoritative. */}
}
