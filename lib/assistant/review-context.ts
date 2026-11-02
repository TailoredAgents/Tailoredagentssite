import 'server-only';
import {getSalesRecord} from '@/lib/sales/data';
import {getWorkspaceMembers} from '@/lib/operations/data';
import {listConversationWorkspace} from '@/lib/conversations/data';
import {cardAccess} from '@/lib/smart-cards/data';
import {getDatabasePool} from '@/lib/dashboard/db';
import {AssistantError} from './config';
import type {Principal} from './oauth';
// Save human-readable target identity alongside the exact proposed input. Never
// accept these labels from the assistant. Re-resolve before executing the change.
export async function reviewContext(p:Principal,tool:string,input:Record<string,unknown>){
 const context=p.context;const result:Record<string,unknown>={requestedFor:context.user.name,workspace:context.workspace.name};
 if(typeof input.opportunityId==='string'){
  const record=await getSalesRecord(context,input.opportunityId);
  if(!record)throw new AssistantError('not_found','This sales record is unavailable.',404);
  result.customer=record.business.name;result.opportunity=record.title;
  result.currentStage=record.stage;
 }
 if(typeof input.ownerUserId==='string'&&input.ownerUserId){
  const member=(await getWorkspaceMembers(context)).find(m=>m.id===input.ownerUserId&&m.role!=='viewer');
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
 if(tool==='block_time'){
  await cardAccess(context,true);
  const profile=(await getDatabasePool().query('SELECT display_name,login_email FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2',[context.workspace.id,input.profile])).rows[0];
  if(!profile)throw new AssistantError('not_found','This calendar profile is unavailable.',404);
  result.calendar=profile.display_name;result.calendarOwner=profile.login_email;result.timezone='America/New_York';
 }
 return result;
}
