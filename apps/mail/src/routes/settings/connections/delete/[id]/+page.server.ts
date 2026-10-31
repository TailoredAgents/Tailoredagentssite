import {error,fail} from '@sveltejs/kit';
import type {PageServerLoad,Actions} from './$types';
import {loadDeletionRequest,confirmDeletion} from '$lib/server/mcp-deletion';
export const load:PageServerLoad=async({locals,platform,params})=>{
 if(!locals.user || !platform?.env.DB) error(401,'Sign in');
 const pending=await loadDeletionRequest(platform.env.DB,locals.user.id,params.id);
 if(!pending) {
  const done=await platform.env.DB.prepare('SELECT r.id FROM mcp_delete_requests r WHERE r.id=? AND r.user_id=? AND r.consumed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM emails e WHERE e.id=r.email_id AND e.user_id=r.user_id)').bind(params.id,locals.user.id).first();
  if(done) return {pending:null,completed:true};
  error(404,'Confirmation expired or unavailable');
 }
 return {pending,completed:false};
};
export const actions:Actions={default:async({locals,platform,params,request,url})=>{
 if(!locals.user || !platform?.env.DB) error(401,'Sign in');
 if(request.headers.get('origin')!==url.origin) error(403,'Invalid origin');
 if((await request.formData()).get('confirmation')!=='DELETE') return fail(400,{message:'Type DELETE to confirm.'});
 try {const count=await confirmDeletion(platform.env.DB,platform.env.ATTACHMENTS,locals.user.id,params.id);return {deleted:count};}
 catch{return fail(409,{message:'Confirmation expired, authorization changed, or message is no longer in Trash. Request a new confirmation.'});}
}};
