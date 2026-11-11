import 'server-only';
import type {ChangeTool} from './changes';
import {assistantSmsSchema,executeSms,smsSendScopes} from '../sms';
import {z} from 'zod';
import {workSchema} from '@/lib/conversations/validation';
import {saveConversationWork,ConversationInputError} from '@/lib/conversations/service';
import {AssistantError} from '../config';
import {emailSchema,executeEmail,callCustomerSchema,executeCall} from '../outbound';
export const communicationChanges:ChangeTool[]=[{
 name:'send_email',title:'Send email',description:'Prepare an email or reply from an allowed mailbox. Exact human review is always required. For replies, read get_email_reply_context and preserve its message ID, revision, subject and selected reply/reply-all recipients. New email may include explicit To/CC/BCC. Attach only generated PDF/DOCX/CSV/XLSX results by document ID and immutable hash; five files, 5 MB combined. Read current customer records first. Keep requestId stable; acceptance is not delivery.',schema:emailSchema,scopes:['conversations:read','mail:send'],external:true,reviewRequired:true,run:executeEmail,
},{
 name:'call_customer',title:'Connect employee to customer',description:'Call the employee’s saved approved phone, then connect the customer after the employee answers and presses 1. Read get_voice_status and the customer first. Supply an exact phone and stable requestId. Standard calling charges apply. This is not an AI voice call.',schema:callCustomerSchema,scopes:['conversations:read','voice:send'],external:true,run:executeCall,
},{
 name:'send_sms',title:'Send text message',
 description:'Send an exact text message using the connection’s execution mode. First call get_sms_recipient and inspect the conversation; supply its conversationId and lastMessageId (null for none). Use a stable requestId. The recipient and newest message are rechecked before sending. The existing number grant, opt-out and hourly limits apply. Standard SMS charges apply; a sent text cannot be recalled. Check get_sms_send_status for delivery; an accepted request is not proof of delivery.',
 schema:assistantSmsSchema,scopes:smsSendScopes,external:true,run:executeSms,
},{
 name:'save_conversation_work',title:'Update conversation follow-up',
 description:'Assign an active teammate, set Needs reply / Waiting / Done / Archived, or save a reminder. Done means no outstanding follow-up; it does not erase history or prove a sale. Read get_conversation and preserve current optional values. Supply workUpdatedAt and lastActivityAt from its conversation. Requires access to every linked source. Sends no message.',
 schema:workSchema.extend({expectedWorkUpdatedAt:z.iso.datetime({offset:true}),expectedLastActivityAt:z.iso.datetime({offset:true})}),
 scopes:['operations:write','conversations:read'],async run(p,input){
  try{return await saveConversationWork(p.context,input);}catch(error){if(error instanceof ConversationInputError)throw new AssistantError('conversation_changed',error.message,409);throw error;}
 },
}];
