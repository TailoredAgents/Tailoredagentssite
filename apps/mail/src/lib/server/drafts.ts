import type {D1Database,R2Bucket} from '@cloudflare/workers-types';
import {saveDraft,getDraft} from './mail-store';
import {assertOutboundAttachments,resolveFromAddress} from './outbox';
import {cleanComposedHtml,retainObject} from './content';
import {indexFullText} from './search';
import {sha256Hex} from './send-attempts';
import {base64ToBytes,bytesToBase64} from './attachments';
import type {OutboundAttachmentInput,User} from '$lib/types';
export type DraftContext={targetId:string;mode:'reply'|'forward'|'forwardAll';includeAttachments?:boolean};
export type DraftInput={context?:DraftContext;id?:string;fromAddressId?:string;to?:string;cc?:string;bcc?:string;subject?:string;text?:string;html?:string;attachments?:OutboundAttachmentInput[]};
type FileReference=Omit<OutboundAttachmentInput,'content'>&{storageKey:string;size:number};
type DraftContent={text:string;html:string;context?:DraftContext;files?:FileReference[];attachments?:OutboundAttachmentInput[]};
export async function readDraftContent(bucket:R2Bucket,key:string):Promise<DraftContent&{attachments:OutboundAttachmentInput[]}>{
 const stored=await bucket.get(key);if(!stored)throw new Error('This saved draft is temporarily unavailable. Contact the owner.');
 const body=await stored.json<DraftContent>();
 const attachments=body.files?await Promise.all(body.files.map(async({storageKey,size,...file})=>{
  const bytes=await bucket.get(storageKey);if(!bytes)throw new Error('A saved draft attachment is unavailable. Contact the owner.');
  return {...file,content:bytesToBase64(new Uint8Array(await bytes.arrayBuffer()))};
 })):body.attachments??[];
 return {...body,attachments};
}
export async function storeDraft(db:D1Database,bucket:R2Bucket,user:User,input:DraftInput):Promise<string>{
 const id=input.id??crypto.randomUUID();
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw new Error('Invalid draft');
 const existing=await db.prepare('SELECT user_id,status,content_key FROM emails WHERE id=?').bind(id).first<{user_id:string;status:string;content_key:string|null}>();
 if(existing&&(existing.user_id!==user.id||existing.status!=='draft'))throw new Error('Draft unavailable');
 if(input.context){
  if(!['reply','forward','forwardAll'].includes(input.context.mode)||typeof input.context.targetId!=='string')throw new Error('Invalid reply draft');
  if(!await db.prepare('SELECT id FROM emails WHERE user_id=? AND (id=? OR thread_id=?) LIMIT 1').bind(user.id,input.context.targetId,input.context.targetId).first())throw new Error('Conversation unavailable');
 }
 const from=await resolveFromAddress(db,user,input.fromAddressId);
 let previous:DraftContent|undefined;
 if(existing?.content_key){const object=await bucket.get(existing.content_key);if(!object)throw new Error('Saved draft unavailable');previous=await object.json<DraftContent>();}
 const files:FileReference[]=[];
 if(input.attachments!==undefined||previous?.attachments){
  const attachments=input.attachments??previous?.attachments??[];assertOutboundAttachments(attachments);
  for(const {content,...file} of attachments){
   const storageKey=`draft-files/${user.id}/${await sha256Hex(JSON.stringify(file)+content)}`;
   const bytes=base64ToBytes(content);
   if(!await bucket.head(storageKey))await bucket.put(storageKey,bytes,{httpMetadata:{contentType:file.type}});
   files.push({...file,storageKey,size:bytes.byteLength});
  }
 }else files.push(...(previous?.files??[]));
 const html=cleanComposedHtml(input.html??'');
 const key=`drafts/${user.id}/${id}/${crypto.randomUUID()}.json`;
 await bucket.put(key,JSON.stringify({text:input.text??'',html,files,...(input.context?{context:input.context}:{})}));
 await saveDraft(db,user.id,{id,from:from.address,to:input.to??'',cc:input.cc,bcc:input.bcc,subject:input.subject??'',bodyText:input.text??'',bodyHtml:html,domainId:from.domain_id,addressId:from.id});
 const statements=[db.prepare("UPDATE emails SET content_key=? WHERE id=? AND user_id=? AND status='draft'").bind(key,id,user.id),db.prepare('DELETE FROM draft_files WHERE draft_id=? AND user_id=?').bind(id,user.id)];
 for(const file of files)statements.push(db.prepare('INSERT OR IGNORE INTO draft_files(id,user_id,draft_id,filename,content_type,size_bytes,storage_key,content_id) VALUES (?,?,?,?,?,?,?,?)').bind(await sha256Hex(id+file.storageKey),user.id,id,file.filename,file.type,file.size,file.storageKey,file.contentId??null));
 await db.batch(statements);
 await indexFullText(db,user.id,id,input.text??'');
 if(existing?.content_key)await retainObject(db,existing.content_key);
 for(const file of previous?.files??[])if(!files.some(f=>f.storageKey===file.storageKey))await retainObject(db,file.storageKey);
 return id;
}
