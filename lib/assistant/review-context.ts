import 'server-only';
import {getSalesRecord} from '@/lib/sales/data';
import {getWorkspaceMembers,getLead,getClient,getContact,getSite,getProject} from '@/lib/operations/data';
import {listConversationWorkspace} from '@/lib/conversations/data';
import {cardAccess} from '@/lib/smart-cards/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError} from './config';
import {getCalendarEntry} from '@/lib/booking/staff';
import {smsReview} from './sms';
import {emailReview,callReview} from './outbound';
import {notificationSender} from './booking-notifications';
import {getCallFollowUpOptions,getCallFollowUpTask} from '@/lib/voice/follow-up-tasks';
import {getManagedProfile,getManagedCard,getCardAiSettings} from '@/lib/smart-cards/settings';
import {readMailDraft,readSmsDraft} from './drafts';
import type {Principal} from './oauth';
import {targetSchema} from '@/lib/relationships/contract';
import {readRelationship} from '@/lib/relationships/service';
import {getRelationshipOverview} from '@/lib/relationships/overview';
import {getHandoff} from '@/lib/relationships/handoffs';
import {listSolutionBriefs} from '@/lib/relationships/solutions';
import {getClientService} from '@/lib/client-services/service';
import {financeReviewContext} from '@/lib/partners/service';
// Save human-readable target identity alongside the exact proposed input. Never
// accept these labels from the assistant. Re-resolve before executing the change.
export async function reviewContext(p:Principal,tool:string,input:Record<string,unknown>){
 const context=p.context;const result:Record<string,unknown>={requestedFor:context.user.name,workspace:context.workspace.name};
 if(['create_referral_partner','draft_referral_agreement','record_referral_earning','reverse_referral_earning','draft_referral_statement'].includes(tool))result.finance=await financeReviewContext(context,input);
 if(tool==='save_solution_brief'){
  const target=targetSchema.parse(input),overview=await getRelationshipOverview(context,target);
  result.relationship={id:target.id,kind:target.kind,name:overview.current.name};result.notice='Team-visible solution brief. Internal review is not client approval, a contract or authorization to build.';
  if(input.briefId){const brief=(await listSolutionBriefs(context,target)).briefs.find(b=>b.id===input.briefId);if(!brief)throw new AssistantError('not_found','That brief is unavailable.',404);result.currentBrief={id:brief.id,title:brief.title,revision:brief.revision,status:brief.status};}
 }
 if(typeof input.serviceId==='string'){
  const service=(await getClientService(context,input.serviceId)).service;
  result.service={id:service.id,name:service.name,client:service.client_name,revision:service.revision,health:service.health};
 }
 if(tool==='resolve_service_incident'){
  const incident=(await getDatabasePool().query('SELECT service_id FROM crm_service_incidents WHERE workspace_id=$1 AND id=$2',[context.workspace.id,input.incidentId])).rows[0];
  if(!incident)throw new AssistantError('not_found','That incident is unavailable.',404);
  const data=await getClientService(context,incident.service_id),current=data.incidents.find(i=>i.id===input.incidentId);
  if(!current)throw new AssistantError('not_found','That incident is unavailable in the current view.',404);
  result.incident={id:current.id,title:current.title,service:data.service.name,status:current.status,revision:current.revision};
 }
 if(tool==='capture_encounter'){
  result.notice=input.leadId?'Append encounter context; preserve existing ownership and campaign source.':'Create a sparse manual prospect and encounter; no automatic message or booking.';
  if(input.appointmentSetterUserId){const setter=(await getWorkspaceMembers(context)).find(m=>m.id===input.appointmentSetterUserId&&m.role!=='viewer');if(!setter)throw new AssistantError('not_found','Choose an active appointment setter.',404);result.appointmentSetter=setter.name;}
  if(input.partnerId){const partner=(await getDatabasePool().query('SELECT name,organization FROM crm_referral_partners WHERE workspace_id=$1 AND id=$2',[context.workspace.id,input.partnerId])).rows[0];if(!partner)throw new AssistantError('not_found','That introducer is unavailable.',404);result.introducer=partner;}
 }
 if(['save_business_discovery','record_introduction','request_relationship_handoff'].includes(tool)){
  const overview=await getRelationshipOverview(context,targetSchema.parse(input));
  result.relationship={id:overview.current.id,kind:overview.current.kind,name:overview.current.name};
  result.notice='Internal team-visible record. No message, booking, ownership transfer or financial agreement.';
  if(tool==='record_introduction'&&input.partnerId){const partner=(await readRelationship(context,targetSchema.parse(input))).partners.find(x=>x.id===input.partnerId);if(!partner)throw new AssistantError('not_found','Choose a referral partner in this workspace.',404);result.introducer={id:partner.id,name:partner.name,organization:partner.organization};}
 }
 if(tool==='update_relationship_handoff'){
  const h=await getHandoff(context,String(input.handoffId));
  result.handoff={id:h.id,nextAction:h.next_action,recipient:h.recipient,status:h.status,revision:h.revision};
 }
 if(tool==='request_relationship_handoff'||tool==='set_account_manager'){
  const selected=String(input.recipientUserId??input.userId??'');
  const member=(await getWorkspaceMembers(context)).find(m=>m.id===selected&&m.role!=='viewer');
  if(selected&&!member)throw new AssistantError('invalid_assignee','Choose an active teammate with editing access.',409);
  result.assignedTeammate=member?.name??'Unassigned';
 }
 if(tool==='send_email')result.email=await emailReview(p,input);
 if(tool==='call_customer')result.call=await callReview(p,input);
 if(tool==='save_mail_draft')result.currentPrivateDraft=await readMailDraft(p,input);
 if(tool==='save_sms_draft')result.currentPrivateDraft=await readSmsDraft(p,input);
 if(['save_card_profile','create_card_link','update_card_link','set_card_assistant'].includes(tool)){
  await cardAccess(context,true);
  if(tool==='set_card_assistant'){
   result.currentPublicAssistant=await getCardAiSettings(context);
   result.notice='Enabling allows visitor requests within the existing monthly allowance. This does not change the allowance.';
  }else{
   const profile=await getManagedProfile(context,String(input.slug??input.profile));
   if(!profile)throw new AssistantError('not_found','This card profile is unavailable.',404);
   result.profile=profile;
   if(tool==='update_card_link'){
    const card=await getManagedCard(context,String(input.code));
    if(!card)throw new AssistantError('not_found','This card is unavailable.',404);
    result.currentCard=card;
   }
   result.notice='These settings affect public Smart Card pages and permanent links.';
  }
 }
 if(tool==='create_call_follow_up'){
  const r=await getCallFollowUpOptions(context,String(input.recordingId),Number(input.suggestionIndex));
  if(r.taskId)throw new AssistantError('task_exists','This suggestion already has a task. Read and update that task instead.',409);
  result.callFollowUp={customer:r.customer,conversationId:r.conversationId,suggestion:r.suggestion};
 }
 if(tool==='update_call_follow_up'||tool==='complete_call_follow_up'){
  const r=await getCallFollowUpTask(context,String(input.taskId));
  result.callTask={id:r.id,title:r.title,customer:r.customer,owner:r.ownerName,dueAt:r.dueAt,status:r.status,updatedAt:r.updatedAt};
 }
 if(tool==='send_sms'){
  result.message=await smsReview(p,input);
  result.sendingNotice='This action sends this exact text. Standard messaging charges apply. Sent texts cannot be recalled.';
 }
 if(typeof input.leadId==='string'){
  const record=await getLead(context,input.leadId);
  if(!record)throw new AssistantError('not_found','This lead is unavailable.',404);
  result.lead=record.organization||record.name;result.leadEmail=record.email;result.leadPhone=record.phone;
 }
 if(typeof input.clientId==='string'){
  const record=await getClient(context,input.clientId);
  if(!record)throw new AssistantError('not_found','This client is unavailable.',404);
  result.client=record.name;
  if(tool==='save_contact'&&input.isPrimary)result.currentPrimaryContacts=record.contacts.filter(c=>c.isPrimary).map(c=>({id:c.id,name:c.name}));
 }
 if(typeof input.contactId==='string'){
  const record=await getContact(context,String(input.clientId),input.contactId);
  if(!record)throw new AssistantError('not_found','This client contact is unavailable.',404);
  result.contact=record.name;result.contactEmail=record.email;result.contactPhone=record.phone;
 }
 if(typeof input.siteId==='string'){
  const record=await getSite(context,input.siteId);
  if(!record)throw new AssistantError('not_found','This site is unavailable.',404);
  result.site=record.name;result.siteUrl=record.url;result.siteClient=record.client_name;
 }
 if(typeof input.projectId==='string'){
  const record=await getProject(context,input.projectId);
  if(!record)throw new AssistantError('not_found','This project is unavailable.',404);
  result.project=record.name;result.projectClient=record.client_name;
  if(typeof input.milestoneId==='string'){
   const milestone=record.milestones.find(m=>m.id===input.milestoneId);
   if(!milestone)throw new AssistantError('not_found','This milestone is unavailable.',404);
   result.milestone=milestone.title;
  }
 }
 if(typeof input.opportunityId==='string'){
  const record=await getSalesRecord(context,input.opportunityId);
  if(!record)throw new AssistantError('not_found','This sales record is unavailable.',404);
  result.customer=record.business.name;result.opportunity=record.title;
  result.currentStage=record.stage;
  if(typeof input.taskId==='string'){
   const task=record.tasks.find(t=>t.id===input.taskId);
   if(!task)throw new AssistantError('not_found','This task is unavailable.',404);
   result.task=task.title;result.currentTaskOwner=task.ownerName;result.currentStart=task.dueAt;result.currentEnd=task.endAt;
  }
 }
 const assignedId=input.ownerUserId??input.ownerId;
 if(typeof assignedId==='string'&&assignedId){
  const member=(await getWorkspaceMembers(context)).find(m=>m.id===assignedId&&m.role!=='viewer');
  if(!member)throw new AssistantError('not_found','Choose an active teammate who can edit records.',404);
  result.assignedTo=member.name;result.assignedEmail=member.email;
 }
 if(tool==='save_goal'&&typeof input.id==='string'){
  const row=(await getDatabasePool().query('SELECT title,revision FROM assistant_goals WHERE id=$1 AND workspace_id=$2 AND user_id=$3',[input.id,context.workspace.id,context.user.id])).rows[0];
  if(!row)throw new AssistantError('not_found','This private goal is unavailable.',404);
  result.existingGoal=row.title;result.revision=row.revision;
 }
 if(tool==='add_conversation_note'){
  const r=await listConversationWorkspace(context,{conversation:String(input.conversationId)});
  const source=r.selected&&r.selected.conversation.id===input.conversationId?r.selected.sources.find(s=>s.id===input.audienceSourceId):null;
  if(!source)throw new AssistantError('not_found','This conversation or note audience is unavailable.',404);
  result.customer=r.selected!.conversation.personName;result.source=source.label;result.channel=source.channel;result.addresses=source.externalAddresses;
 }
 if(tool==='save_conversation_work'){
  const r=await listConversationWorkspace(context,{conversation:String(input.conversationId)});
  const c=r.selected?.conversation;
  if(!c||c.id!==input.conversationId)throw new AssistantError('not_found','This conversation is unavailable.',404);
  result.customer=c.personName;result.currentStatus=c.status;result.currentOwner=c.ownerName;result.lastActivityAt=c.lastActivityAt;result.workUpdatedAt=c.workUpdatedAt;
 }
 if(tool==='block_time'||tool==='publish_consultation_time'){
  await cardAccess(context,true);
  const profile=(await getDatabasePool().query('SELECT display_name,login_email FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2',[context.workspace.id,input.profile])).rows[0];
  if(!profile)throw new AssistantError('not_found','This calendar profile is unavailable.',404);
  result.calendar=profile.display_name;result.calendarOwner=profile.login_email;result.timezone='America/New_York';
 }
 if(['book_consultation','reschedule_consultation','close_calendar_entry','cancel_consultation','book_consultation_and_notify','reschedule_consultation_and_notify','cancel_consultation_and_notify'].includes(tool)){
  await cardAccess(context,true);
  for(const [label,id] of [['currentBooking',input.bookingId??input.id],['selectedTime',input.slotId]]){
   if(typeof id!=='string')continue;
   const entry=await getCalendarEntry(context,id);
   if(!entry)throw new AssistantError('not_found','This calendar entry is unavailable.',404);
   result[String(label)]=entry;
  }
  result.timezone='America/New_York';
  if(tool.endsWith('_and_notify')){result.notificationSender=await notificationSender(p);result.visitorNotification='Automatically queues a text with the confirmed appointment time or cancellation to this customer. Standard SMS charges apply. Check its notification receipt for acceptance.';}
  else result.visitorNotification='This action sends no message.';
 }
 return result;
}
