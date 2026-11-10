import 'server-only';
import {z} from 'zod';
import {requireInboxMailbox,InboxAccessError} from '@/lib/inbox/data';
import {sendInboxMessage,InboxInputError} from '@/lib/inbox/service';
import {createVoiceIntent,startPhoneCall} from '@/lib/voice/service';
import {intentSchema} from '@/lib/voice/validation';
import {getVoiceWorkspace} from '@/lib/voice/data';
import {AssistantError,AssistantOutcomeError} from './config';
import {asAssistant} from './access';
import type {Principal} from './oauth';
export const emailSchema=z.object({mailboxId:z.string().min(1).max(200),to:z.email().max(254).transform(s=>s.toLowerCase()),subject:z.string().trim().min(1).max(500),text:z.string().trim().min(1).max(12000),requestId:z.uuid()});
export async function emailReview(p:Principal,raw:unknown){
 const input=emailSchema.parse(raw),mailbox=await requireInboxMailbox(p.context,input.mailboxId,true);
 return {sender:mailbox,recipient:input.to,subject:input.subject,text:input.text,notice:'Sends this exact new email after your review. Provider acceptance is not proof of delivery.'};
}
export async function executeEmail(p:Principal,raw:unknown){
 try{const result=await sendInboxMessage(p.context,emailSchema.parse(raw),{beforeDelivery:()=>asAssistant(p,['conversations:read','mail:send'],true,async()=>{})});if(result.sendState!=='accepted')throw new AssistantOutcomeError(result.sendState==='rejected'?'failed':'outcome_unknown',result);return result;}
 catch(e){if(e instanceof InboxAccessError||e instanceof InboxInputError)throw new AssistantError('mail_rejected',e.message,409);throw e;}
}
export const callCustomerSchema=intentSchema.omit({mode:true});
export async function callReview(p:Principal,raw:unknown){
 const input=callCustomerSchema.parse(raw),workspace=await getVoiceWorkspace(p.context);
 const line=workspace.lines.find(l=>l.id===input.lineId);
 if(!line)throw new AssistantError('call_unavailable','This calling line is unavailable.',403);
 return {line,customerPhone:input.to,notice:'Rings your approved employee phone. Answer and press 1 to connect the customer. Standard calling charges apply.'};
}
export async function executeCall(p:Principal,raw:unknown){
 const intent=await createVoiceIntent(p.context,{...callCustomerSchema.parse(raw),mode:'phone'});
 const message=await asAssistant(p,['conversations:read','voice:send'],true,fresh=>startPhoneCall(fresh.context,{callId:intent.callId}));
 // Never return the device/intention credential to a model.
 const result={callId:intent.callId,message};
 if(message.includes('awaiting confirmation'))throw new AssistantOutcomeError('outcome_unknown',result);
 return result;
}
