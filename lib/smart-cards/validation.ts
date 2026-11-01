import { z } from 'zod';
import { normalizePhone } from '@/lib/sales/import';
export const slugSchema=z.string().regex(/^[a-z][a-z0-9-]{1,39}$/);
export const codeSchema=z.string().regex(/^[a-z0-9-]{3,60}$/);
const phone=z.string().trim().max(40).refine(v=>Boolean(normalizePhone(v)), 'Enter a valid phone number, including the country code.');
export const profileSchema=z.object({slug:slugSchema,display_name:z.string().trim().min(1).max(100),title:z.string().trim().min(1).max(100),email:z.email().max(254),phone,intro:z.string().trim().min(5).max(240),published:z.boolean()});
export const attributionSchema=z.object({profile:slugSchema,card:codeSchema.optional(),channel:z.enum(['nfc','qr','direct']).default('direct')});
export const inquirySchema=attributionSchema.extend({submissionId:z.uuid(),name:z.string().trim().min(2).max(100),email:z.email().max(254),phone:z.union([z.literal(''),phone]).optional(),organization:z.string().trim().max(140).default(''),interest:z.enum(['Website','AI & automation','Custom software','Smart cards','Let’s talk']),message:z.string().trim().max(2000).default(''),consent:z.literal(true),website:z.string().max(200).default(''),startedAt:z.number()});
export const chatSchema=attributionSchema.extend({requestId:z.uuid(),sessionId:z.uuid(),messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(2000)})).min(1).max(15)}).superRefine((v,c)=>{if(v.messages.some((m,i)=>m.role!==(i%2===0?'user':'assistant'))||v.messages.at(-1)?.role!=='user')c.addIssue({code:'custom',message:'Please start a new conversation.'});});
export const eventSchema=attributionSchema.extend({id:z.uuid(),sessionId:z.uuid(),event:z.enum(['visit','contact_download','phone_click','email_click','assistant_open','inquiry_open','work_click'])});
export function vcard(profile:{display_name:string;title:string;email:string;phone:string;slug:string}) {
  const escape=(v:string)=>v.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const lines=['BEGIN:VCARD','VERSION:3.0',`FN:${escape(profile.display_name)}`,`N:;${escape(profile.display_name)};;;`,'ORG:Tailored Agents',`TITLE:${escape(profile.title)}`,`EMAIL;TYPE=WORK:${escape(profile.email)}`,`TEL;TYPE=WORK,VOICE:${escape(profile.phone)}`,`URL:https://www.tailoredagents.com/c/${profile.slug}`,'END:VCARD'];
  // Fold by UTF-8 bytes, preserving Unicode code points and the 75-octet limit.
  return lines.map(line=>{let out='',width=0;for(const ch of line){const bytes=new TextEncoder().encode(ch).length;if(width+bytes>75){out+='\r\n ';width=1;}out+=ch;width+=bytes;}return out;}).join('\r\n')+'\r\n';
}
