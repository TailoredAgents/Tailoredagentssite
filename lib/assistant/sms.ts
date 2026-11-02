import 'server-only';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {Principal} from './oauth';
import {getDatabasePool} from '@/lib/dashboard/db';
import {requireSmsNumber,SmsAccessError} from '@/lib/sms/data';
import {sendSmsMessage,SmsInputError} from '@/lib/sms/service';
import {phoneSchema} from '@/lib/sms/validation';
import {AssistantError,AssistantOutcomeError,type AssistantScope} from './config';
import {asAssistant} from './access';

export const smsSendScopes:AssistantScope[]=['conversations:read','conversations:send'];
export const smsRecipientSchema=z.object({numberId:z.uuid(),to:phoneSchema});
export const assistantSmsSchema=smsRecipientSchema.extend({
 requestId:z.uuid().describe('Stable send identifier. Keep this identifier on retries and status checks.'),
 expectedConversationId:z.uuid().nullable(),
 expectedLastMessageId:z.uuid().nullable(),
 text:z.string().min(1).max(1600).refine(v=>!!v.trim(),'Write a message.'),
});
type Reader=Pick<PoolClient,'query'>;
async function recipientState(db:Reader,p:Principal,input:{numberId:string;to:string},excludeRequest?:string){
 const row=(await db.query<{id:string;phone:string;lastMessageId:string|null;lastMessageAt:Date|null}>(`SELECT c.id,c.remote_phone phone,m.id "lastMessageId",m.created_at "lastMessageAt" FROM sms_conversations c LEFT JOIN LATERAL(SELECT id,created_at FROM sms_messages WHERE workspace_id=c.workspace_id AND conversation_id=c.id AND ($4::uuid IS NULL OR id IS DISTINCT FROM (SELECT message_id FROM sms_outbound_intents WHERE workspace_id=c.workspace_id AND request_id=$4 AND actor_user_id=$5)) ORDER BY created_at DESC,id DESC LIMIT 1) m ON true WHERE c.workspace_id=$1 AND c.number_id=$2 AND c.remote_phone=$3 AND c.deleted_at IS NULL`,[p.context.workspace.id,input.numberId,input.to,excludeRequest??null,p.context.user.id])).rows[0];
 return {conversationId:row?.id??null,lastMessageId:row?.lastMessageId??null,lastMessageAt:row?.lastMessageAt?.toISOString()??null};
}
export async function getSmsRecipient(p:Principal,raw:unknown){
 const input=smsRecipientSchema.parse(raw),number=await requireSmsNumber(p.context,input.numberId);
 const current=await recipientState(getDatabasePool(),p,input);
 const blocked=(await getDatabasePool().query("SELECT 1 FROM crm_channel_preferences WHERE workspace_id=$1 AND channel='sms' AND normalized_address=$2 AND status='blocked'",[p.context.workspace.id,input.to])).rowCount!==0;
 return {numberId:input.numberId,sendingFrom:number.phone,recipient:input.to,canSend:number.canSend&&!blocked,unavailableReason:blocked?'This recipient opted out.':number.sendUnavailableReason,...current};
}
export async function smsReview(p:Principal,raw:unknown){
 const input=assistantSmsSchema.parse(raw),current=await getSmsRecipient(p,input);
 if(!current.canSend)throw new AssistantError('sending_unavailable',current.unavailableReason??'Sending is unavailable.',403);
 if(current.conversationId!==input.expectedConversationId||current.lastMessageId!==input.expectedLastMessageId)throw new AssistantError('conversation_changed','Read the recipient’s latest conversation before preparing this text.',409);
 return current;
}
export async function executeSms(p:Principal,raw:unknown){
 const input=assistantSmsSchema.parse(raw);let reservedConversationId:string|undefined;
 const guard=async(db:Reader,beforeDelivery=false)=>{
  const current=await recipientState(db,p,input,beforeDelivery?input.requestId:undefined);
  if(current.conversationId!==(beforeDelivery?reservedConversationId:input.expectedConversationId)||current.lastMessageId!==input.expectedLastMessageId)throw new SmsInputError('The recipient or conversation changed after review. Nothing new was sent; read the latest conversation and prepare a new proposal.');
 };
 try{
  const result=await sendSmsMessage(p.context,{numberId:input.numberId,conversationId:input.expectedConversationId??undefined,to:input.to,text:input.text,requestId:input.requestId},{
   beforeReserve:async(db,phone)=>{if(phone!==input.to)throw new SmsInputError('The reviewed recipient changed.');await guard(db);},
   onReserved:async(db,id)=>{
    reservedConversationId=id;
    // This is an explicitly reviewed staff text, so cancel a competing intro.
    await db.query("UPDATE lead_intro_jobs SET status='cancelled',reason='assistant_text',lease_token=NULL,updated_at=now() WHERE workspace_id=$1 AND phone=$2 AND status IN ('queued','generating','ready')",[p.context.workspace.id,input.to]);
   },
   beforeDelivery:async()=>{
    try{await asAssistant(p,smsSendScopes,true,()=>guard(getDatabasePool(),true));}
    catch(error){if(error instanceof AssistantError)throw new SmsInputError(error.message);throw error;}
   },
  });
  if(result.sendState!=='accepted')throw new AssistantOutcomeError(result.sendState==='rejected'?'failed':'outcome_unknown',result);
  return result; // Accepted by the provider is distinct from delivered.
 }catch(error){
  if(error instanceof SmsAccessError||error instanceof SmsInputError)throw new AssistantError('message_rejected',error.message,409);
  throw error;
 }
}
