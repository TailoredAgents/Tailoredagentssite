import {json,type RequestHandler} from '@sveltejs/kit';
import type {ReceivedEmail} from '$lib/server/resend';
export const GET:RequestHandler=async({params,platform})=>{
 const env=platform!.env;
 const item=await env.DB.prepare('SELECT content_key FROM unassigned_mail WHERE provider_id=? AND assigned_user_id IS NULL').bind(params.id!).first<{content_key:string}>();
 if(!item)return json({error:'Message unavailable.'},{status:404});
 const file=await env.ATTACHMENTS.get(item.content_key); if(!file)return json({error:'Message temporarily unavailable.'},{status:503});
 const email=await file.json<ReceivedEmail>();return json({html:email.html,text:email.text,attachments:email.attachments?.map(a=>a.filename) ?? []});
};
export const POST:RequestHandler=async({params,request,platform})=>{
 const env=platform!.env;const {userId}=await request.json();
 if(typeof userId!=='string')return json({error:'Choose a team member.'},{status:400});
 const item=await env.DB.prepare('SELECT provider_id FROM unassigned_mail WHERE provider_id=? AND assigned_user_id IS NULL').bind(params.id!).first();
 const user=await env.DB.prepare('SELECT id FROM users WHERE id=? AND disabled_at IS NULL').bind(userId).first();
 if(!item||!user)return json({error:'Message or account unavailable.'},{status:404});
 const id='assign:'+params.id;
 const existing=await env.DB.prepare('SELECT payload,state FROM mail_jobs WHERE id=?').bind(id).first<{payload:string;state:string}>();
 if(existing && JSON.parse(existing.payload).assignedUserId!==userId)return json({error:'This message already has an assignment in progress.'},{status:409});
 await env.DB.prepare("INSERT INTO mail_jobs(id,kind,payload) VALUES (?,'email.received',?) ON CONFLICT(id) DO NOTHING").bind(id,JSON.stringify({type:'email.received',data:{email_id:params.id},assignedUserId:userId})).run();
 await env.MAIL_JOBS.send({id});return json({ok:true});
};
