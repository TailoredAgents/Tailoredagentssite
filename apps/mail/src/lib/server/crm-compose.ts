import type {EmailRow,OutboundAttachmentInput} from '$lib/types';
import {parseEmailAddresses} from './email-address';
import {crmMessagePerspective} from './crm-mail-perspective';
import {displaySubject} from './threads';
import {sha256Hex} from './send-attempts';

export type CrmReplyMessage=Pick<EmailRow,'id'|'direction'|'from_addr'|'to_addr'|'cc_addr'|'reply_to_addr'|'subject'|'status'|'message_id'|'references_header'>&{team_copy:number};
const addresses=(items:string[])=>[...new Set(items.map(s=>s.trim().toLowerCase()))];
export async function crmReplyPlan(message:CrmReplyMessage,sender:string,internal:Set<string>){
 const self=sender.toLowerCase(),perspective=crmMessagePerspective(message,internal);
 const to=addresses(perspective.reply_target).filter(a=>a!==self);
 const additional=perspective.direction==='inbound'?[...parseEmailAddresses(message.to_addr),...parseEmailAddresses(message.cc_addr??'')]:parseEmailAddresses(message.cc_addr??'');
 const cc=addresses(additional).filter(a=>a!==self&&!to.includes(a));
 const subject=`Re: ${displaySubject(message.subject)}`;
 return {messageId:message.id,subject,reply:{to,cc:[] as string[],bcc:[] as string[]},replyAll:{to,cc,bcc:[] as string[]},revision:await sha256Hex(JSON.stringify([sender,message.id,message.direction,message.from_addr,message.to_addr,message.cc_addr,message.reply_to_addr,message.message_id,message.references_header,subject,to,cc,message.team_copy]))};
}
export type CrmEnvelope={to:string[];cc:string[];bcc:string[];replyMode:'new'|'reply'|'reply_all';threadRevision:string|null;attachments:{id:string;name:string;mime:string;hash:string;bytes:number;content:string}[]};
const email=/^[^\s<>,;@]+@[^\s<>,;@]+\.[^\s<>,;@]+$/;
const types:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',csv:'text/csv',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export async function crmEnvelope(raw:unknown):Promise<{envelope:CrmEnvelope;attachments:OutboundAttachmentInput[]}> {
 if(!raw||typeof raw!=='object')throw Error('invalid_envelope');const v=raw as CrmEnvelope;
 if(!['new','reply','reply_all'].includes(v.replyMode)||!(v.threadRevision===null||typeof v.threadRevision==='string'&&/^[a-f0-9]{64}$/.test(v.threadRevision)))throw Error('invalid_envelope');
 for(const field of [v.to,v.cc,v.bcc])if(!Array.isArray(field)||field.some(a=>typeof a!=='string'||a.length>254||!email.test(a)||a!==a.toLowerCase()))throw Error('invalid_envelope');
 const all=[...v.to,...v.cc,...v.bcc];if(!v.to.length||all.length>20||new Set(all).size!==all.length||!Array.isArray(v.attachments)||v.attachments.length>5)throw Error('invalid_envelope');
 const attachments:OutboundAttachmentInput[]=[];let total=0;
 for(const file of v.attachments){
  if(!file||typeof file.name!=='string'||file.name.length>180||/[\x00-\x1f\x7f/\\]/.test(file.name)||typeof file.mime!=='string'||typeof file.hash!=='string'||!/^[a-f0-9]{64}$/.test(file.hash)||!Number.isSafeInteger(file.bytes)||file.bytes<=0||typeof file.content!=='string'||file.content.length>6666668||(file.content.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.content)))throw Error('invalid_attachment');
  const extension=file.name.split('.').at(-1)?.toLowerCase();if(!extension||types[extension]!==file.mime)throw Error('invalid_attachment');
  const bytes=Uint8Array.from(atob(file.content),c=>c.charCodeAt(0));total+=bytes.length;if(bytes.length!==file.bytes||total>5000000)throw Error('invalid_attachment');
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(digest!==file.hash)throw Error('invalid_attachment');
  if(extension==='pdf'&&String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('invalid_attachment');
  if(['docx','xlsx'].includes(extension)&&(bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4))throw Error('invalid_attachment');
  attachments.push({filename:file.name,type:file.mime,content:file.content});
 }
 return {envelope:v,attachments};
}
