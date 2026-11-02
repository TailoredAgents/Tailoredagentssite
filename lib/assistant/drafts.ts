import 'server-only';
import type {Principal} from './oauth';
import {getDatabasePool} from '@/lib/dashboard/db';
import {requireInboxMailbox} from '@/lib/inbox/data';
import {requireSmsNumber,SmsAccessError} from '@/lib/sms/data';
import {getMailThread} from '@/lib/inbox/mail-provider';
import {draftSchema as mailSchema} from '@/lib/inbox/validation';
import {draftSchema as smsSchema} from '@/lib/sms/validation';

export const mailDraftTarget=mailSchema.pick({mailboxId:true,threadId:true,composeKey:true});
export const smsDraftTarget=smsSchema.pick({numberId:true,conversationId:true,composeKey:true});
export async function readMailDraft(p:Principal,raw:unknown){
 const input=mailDraftTarget.parse(raw),mailbox=await requireInboxMailbox(p.context,input.mailboxId);
 if(input.threadId)await getMailThread(p.context,input.mailboxId,input.threadId);
 const row=(await getDatabasePool().query('SELECT id,recipient AS "to",subject,body AS text,reply_to_message_id AS "replyToMessageId",updated_at FROM inbox_drafts WHERE workspace_id=$1 AND mailbox_id=$2 AND thread_key=$3 AND author_user_id=$4 AND updated_at>now()-interval \'90 days\'',[p.context.workspace.id,input.mailboxId,input.threadId||input.composeKey||'',p.context.user.id])).rows[0];
 const draft=row?{id:row.id,to:row.to,subject:row.subject,text:row.text,replyToMessageId:row.replyToMessageId,updatedAt:row.updated_at.toISOString()}:null;
 return {mailbox:{id:mailbox.id,name:mailbox.name,email:mailbox.email},target:input,draft,visibility:'Private to your account. Saving does not send.'};
}
export async function readSmsDraft(p:Principal,raw:unknown){
 const input=smsDraftTarget.parse(raw),number=await requireSmsNumber(p.context,input.numberId);
 if(input.conversationId&&!(await getDatabasePool().query('SELECT 1 FROM sms_conversations WHERE workspace_id=$1 AND number_id=$2 AND id=$3 AND deleted_at IS NULL',[p.context.workspace.id,input.numberId,input.conversationId])).rowCount)throw new SmsAccessError('This conversation is unavailable.');
 const row=(await getDatabasePool().query('SELECT id,recipient AS "to",body AS text,updated_at FROM sms_drafts WHERE workspace_id=$1 AND number_id=$2 AND author_user_id=$3 AND thread_key=$4 AND updated_at>now()-interval \'90 days\'',[p.context.workspace.id,input.numberId,p.context.user.id,input.conversationId||input.composeKey||''])).rows[0];
 const draft=row?{id:row.id,to:row.to,text:row.text,updatedAt:row.updated_at.toISOString()}:null;
 return {number:{id:number.id,phone:number.phone},target:input,draft,visibility:'Private to your account. Saving does not send.'};
}
