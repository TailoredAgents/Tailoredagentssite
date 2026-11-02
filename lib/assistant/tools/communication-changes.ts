import 'server-only';
import type {ChangeTool} from './changes';
import {assistantSmsSchema,executeSms,smsSendScopes} from '../sms';
import {z} from 'zod';
import {workSchema} from '@/lib/conversations/validation';
import {saveConversationWork,ConversationInputError} from '@/lib/conversations/service';
import {AssistantError} from '../config';
export const communicationChanges:ChangeTool[]=[{
 name:'send_sms',title:'Send text message',
 description:'Prepare an exact text message for human approval. First call get_sms_recipient and inspect the conversation; supply its conversationId and lastMessageId (null for none). Use a stable requestId. The recipient and newest message are rechecked before sending. The existing number grant, opt-out and hourly limits apply. Standard SMS charges apply; a sent text cannot be recalled. Check get_sms_send_status for delivery; an accepted request is not proof of delivery.',
 schema:assistantSmsSchema,scopes:smsSendScopes,external:true,run:executeSms,
},{
 name:'save_conversation_work',title:'Update conversation follow-up',
 description:'Assign an active teammate, set Needs reply / Waiting / Done / Archived, or save a reminder. Done means no outstanding follow-up; it does not erase history or prove a sale. Read get_conversation and preserve current optional values. Supply workUpdatedAt and lastActivityAt from its conversation. Requires access to every linked source. Sends no message.',
 schema:workSchema.extend({expectedWorkUpdatedAt:z.iso.datetime({offset:true}),expectedLastActivityAt:z.iso.datetime({offset:true})}),
 scopes:['operations:write','conversations:read'],async run(p,input){
  try{return await saveConversationWork(p.context,input);}catch(error){if(error instanceof ConversationInputError)throw new AssistantError('conversation_changed',error.message,409);throw error;}
 },
}];
