import 'server-only';
import {getSalesRecord} from '@/lib/sales/data';
import {getWorkspaceMembers,getLead,getClient,getContact,getSite,getProject} from '@/lib/operations/data';
import {listConversationWorkspace} from '@/lib/conversations/data';
import {cardAccess} from '@/lib/smart-cards/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError} from './config';
import {getCalendarEntry} from '@/lib/booking/staff';
import {smsReview} from './sms';
import type {Principal} from './oauth';
// Save human-readable target identity alongside the exact proposed input. Never
// accept these labels from the assistant. Re-resolve before executing the change.
export async function reviewContext(p:Principal,tool:string,input:Record<string,unknown>){
 const context=p.context;const result:Record<string,unknown>={requestedFor:context.user.name,workspace:context.workspace.name};
 if(tool==='send_sms'){
  result.message=await smsReview(p,input);
  result.sendingNotice='Approval sends this exact text. Standard messaging charges apply. Sent texts cannot be recalled.';
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
 if(['book_consultation','reschedule_consultation','close_calendar_entry','cancel_consultation'].includes(tool)){
  await cardAccess(context,true);
  for(const [label,id] of [['currentBooking',input.bookingId??input.id],['selectedTime',input.slotId]]){
   if(typeof id!=='string')continue;
   const entry=await getCalendarEntry(context,id);
   if(!entry)throw new AssistantError('not_found','This calendar entry is unavailable.',404);
   result[String(label)]=entry;
  }
  result.timezone='America/New_York';result.visitorNotification='This action sends no message.';
 }
 return result;
}
