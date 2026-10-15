import {json,type RequestHandler} from '@sveltejs/kit';
export const POST:RequestHandler=async({request,platform})=>{
 const {id}=await request.json(); if(typeof id!=='string')return json({error:'Choose a mail job.'},{status:400});
 const env=platform!.env;
 const row=await env.DB.prepare("UPDATE mail_jobs SET state='pending',attempts=0,lease_until=NULL WHERE id=? AND state IN ('attention','retry') RETURNING id").bind(id).first();
 if(!row)return json({error:'This job is not available to retry.'},{status:409});
 await env.MAIL_JOBS.send({id});return json({ok:true});
};
