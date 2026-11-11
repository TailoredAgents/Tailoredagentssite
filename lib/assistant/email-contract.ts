import {z} from 'zod';
const address=z.email().max(254).transform(s=>s.toLowerCase());
const identifier=z.string().min(1).max(200);
export const emailRecipients=z.object({to:z.array(address).min(1).max(20),cc:z.array(address).max(20),bcc:z.array(address).max(20)});
export const emailReplyContextSchema=z.object({messageId:identifier,subject:z.string().max(1000),reply:emailRecipients,replyAll:emailRecipients,revision:z.string().regex(/^[a-f0-9]{64}$/)});
export const emailSchema=z.object({
 mailboxId:identifier,to:z.string().trim().min(1).max(4000).transform(s=>s.split(',').map(a=>address.parse(a.trim())).join(', ')),cc:z.array(address).max(20).default([]),bcc:z.array(address).max(20).default([]),
 subject:z.string().trim().min(1).max(500),text:z.string().trim().min(1).max(12000),requestId:z.uuid(),
 replyMode:z.enum(['new','reply','reply_all']).default('new'),threadId:identifier.nullable().default(null),replyToMessageId:identifier.nullable().default(null),threadRevision:z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null),
 attachments:z.array(z.object({id:z.uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(5).default([]),
}).strict();
export type AssistantEmail=z.output<typeof emailSchema>;
export type EmailEnvelope={to:string[];cc:string[];bcc:string[];replyMode:AssistantEmail['replyMode'];threadRevision:string|null;attachments:{id:string;name:string;mime:string;hash:string;bytes:number;content?:string}[]};
export function emailEnvelopeIdentity(e:EmailEnvelope){return {to:e.to,cc:e.cc,bcc:e.bcc,replyMode:e.replyMode,threadRevision:e.threadRevision,attachments:e.attachments.map(file=>({id:file.id,name:file.name,mime:file.mime,hash:file.hash,bytes:file.bytes}))};}
