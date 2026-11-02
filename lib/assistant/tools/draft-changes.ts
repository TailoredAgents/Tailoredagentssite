import 'server-only';
import type {ChangeTool} from './changes';
import {AssistantError} from '../config';
import {draftSchema as mailSchema} from '@/lib/inbox/validation';
import {draftSchema as smsSchema} from '@/lib/sms/validation';
import {saveDraft,InboxInputError} from '@/lib/inbox/service';
import {saveSmsDraft,SmsInputError} from '@/lib/sms/service';
import {InboxAccessError} from '@/lib/inbox/data';
import {SmsAccessError} from '@/lib/sms/data';
const description='Save a private draft for the connected user, without sending it. First read the matching draft tool; supply expectedDraft as {id,updatedAt}, or null only when no draft exists. Preserve all existing fields you do not intend to replace. Empty text clears the saved body. A draft is not approval to send.';
function guarded(tool:ChangeTool):ChangeTool{return {...tool,async run(p,input){try{return await tool.run(p,input);}catch(error){if(error instanceof InboxInputError||error instanceof InboxAccessError||error instanceof SmsInputError||error instanceof SmsAccessError)throw new AssistantError('draft_unavailable',error.message,409);throw error;}}};}
export const draftChanges:ChangeTool[]=[
 guarded({name:'save_mail_draft',title:'Save private email draft',description,schema:mailSchema.required({expectedDraft:true}),scopes:['conversations:read','operations:write'],run:(p,input)=>saveDraft(p.context,input)}),
 guarded({name:'save_sms_draft',title:'Save private text draft',description,schema:smsSchema.required({expectedDraft:true}),scopes:['conversations:read','operations:write'],run:(p,input)=>saveSmsDraft(p.context,input)}),
];
