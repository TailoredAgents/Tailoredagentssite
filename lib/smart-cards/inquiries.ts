import 'server-only';
import {campaignDetails} from '@/lib/campaigns/catalog';
import {lockCalendar,requireOpenSlot,getLeadBooking,type PublicSlot} from '@/lib/booking/calendar';
import {formatEasternTime} from '@/lib/time';
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
 const campaign=campaignDetails(profile.campaign);
 const hash=createHash('sha256').update(JSON.stringify([v.profile,profile.campaign,v.card??null,v.card?v.channel:'direct',v.email.toLowerCase(),v.name,v.organization,v.phone??'',v.interest,v.message,v.requestKind,v.preferredTime,v.handoff,v.slotId??null])).digest('hex');
 const key=`smart-card:${v.submissionId}`,db=await getDatabasePool().connect();let leadId='',duplicate=false;let booking:(PublicSlot&{status:string})|null=null;
 try{
  await db.query('BEGIN');if(v.slotId)await lockCalendar(db,CARD_WORKSPACE);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`card-inquiry:${hash}`]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
  const prior=(await db.query<{id:string;fingerprint:string}>(`SELECT id,fingerprint FROM leads WHERE workspace_id=$1 AND source='smart_card' AND (submission_id=$2 OR (fingerprint=$3 AND created_at>now()-interval '15 minutes')) ORDER BY created_at DESC LIMIT 1`,[CARD_WORKSPACE,key,hash])).rows[0];
  if(prior){if(prior.fingerprint!==hash)throw new CardError('This request was already submitted. Refresh the page to send another.',409);leadId=prior.id;duplicate=true;booking=await getLeadBooking(db,leadId);}
  else {
   const live=(await db.query<{login_email:string}>(`SELECT login_email FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2 AND published FOR SHARE`,[CARD_WORKSPACE,v.profile])).rows[0];if(!live)throw new CardError('This profile is unavailable.',404);
   if(v.card && !(await db.query('SELECT 1 FROM smart_cards WHERE workspace_id=$1 AND code=$2 AND profile_slug=$3 AND active FOR SHARE',[CARD_WORKSPACE,v.card,v.profile])).rowCount)throw new CardError('Please scan your card again.',409);
   const owner=(await db.query<{id:string}>(`SELECT u.id FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=$1 AND m.status='active' AND m.role<>'viewer' AND lower(trim(u.email))=$2 LIMIT 1`,[CARD_WORKSPACE,live.login_email])).rows[0];
   const slot=v.slotId?await requireOpenSlot(db,v.slotId,v.profile):null;
   if(slot&&campaign&&Date.parse(slot.endsAt)-Date.parse(slot.startsAt)!==30*60000)throw new CardError('Please choose a 30-minute workflow review slot.',409);
   leadId=randomUUID();
   await db.query(`INSERT INTO leads(id,workspace_id,submission_id,fingerprint,source,status,name,organization,email,phone,interest,description,owner_user_id,delivery_status,smart_card_context) VALUES($1,$2,$3,$4,'smart_card','new',$5,$6,$7,$8,$9,$10,$11,'pending',$12::jsonb)`,[leadId,CARD_WORKSPACE,key,hash,v.name,v.organization,v.email.toLowerCase(),v.phone||null,v.interest,`${campaign?`${campaign.label} campaign — introduced by ${profile.display_name}. The offer is a 20-minute workflow review.`:`Introduced through ${profile.display_name}’s Tailored Agents card.`}\n\n${v.message||'Requested a conversation.'}\n\n${slot?`Confirmed phone consultation: ${formatEasternTime(slot.startsAt)} to ${formatEasternTime(slot.endsAt)}. Call the visitor at their provided number.`:v.requestKind==='appointment'?`Appointment requested — not booked. Preferred time / timezone: ${v.preferredTime||'To be arranged'}.`:'General inquiry.'}${v.handoff==='assistant'?' Visitor reviewed an AI-assisted draft.':''}\n\nVisitor agreed to be contacted about this request.`,owner?.id??null,JSON.stringify({profile:v.profile,card:v.card,campaign:profile.campaign,channel:v.card?v.channel:'direct',slotId:v.slotId??null,requestKind:v.requestKind,preferredTime:v.requestKind==='appointment'?v.preferredTime:'',handoff:v.handoff,consentedAt:new Date().toISOString()})]);
   if(slot){await db.query("UPDATE booking_slots SET status='booked',lead_id=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2",[CARD_WORKSPACE,slot.id,leadId]);booking={...slot,status:'booked'};await insertAuditLog(db,{workspaceId:CARD_WORKSPACE,action:'appointment.booked',targetType:'booking_slot',targetId:slot.id});}
   await insertAuditLog(db,{workspaceId:CARD_WORKSPACE,action:'lead.received',targetType:'lead',targetId:leadId,metadata:{source:'smart_card',profile:v.profile,campaign:profile.campaign}});
   // Only explicit slot selection confirms an appointment. No research, automated text or build is started.
  }
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 if(!duplicate)await notifyCardInquiry(leadId,profile.display_name,v,booking,profile.campaign);
 return {received:true,requestKind:v.requestKind,booking};
}
async function notifyCardInquiry(leadId:string,person:string,v:ReturnType<typeof inquirySchema.parse>,booking:(PublicSlot&{status:string})|null,campaign:string|null){
 const cfg=getInquiryNotificationConfiguration();let status:'sent'|'failed'|'not_configured'='not_configured';
 if(cfg){try{const r=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${cfg.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`smart-card:${v.submissionId}`},body:JSON.stringify({from:cfg.from,to:cfg.to,reply_to:v.email,subject:`${campaignDetails(campaign)?`${campaignDetails(campaign)!.label} inquiry`:'Smart Card inquiry'} — ${v.name}`,text:`${campaignDetails(campaign)?`Campaign: ${campaignDetails(campaign)!.label} — 20-minute workflow review offer\n`:''}Introduced by ${person}\nInterest: ${v.interest}\nRequest: ${booking?`CONFIRMED phone consultation — ${formatEasternTime(booking.startsAt)} to ${formatEasternTime(booking.endsAt)}`:v.requestKind==='appointment'?'Appointment request (not booked)':'Inquiry'}\nPreferred time / timezone: ${v.requestKind==='appointment'?(v.preferredTime||'To be arranged'):'Not requested'}\nName: ${v.name}\nBusiness: ${v.organization||'Not provided'}\nEmail: ${v.email}\nPhone: ${v.phone||'Not provided'}\n\n${v.message}\n\nOpen lead: https://www.tailoredagents.com/dashboard/leads/${leadId}`}),signal:AbortSignal.timeout(10000)});status=r.ok?'sent':'failed';await r.body?.cancel();}catch{status='failed';}}
 try{await recordInquiryDelivery(leadId,{status});}catch{/* The saved lead remains authoritative. */}
}
