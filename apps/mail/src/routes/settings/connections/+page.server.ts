import { error } from '@sveltejs/kit';
import {listConnectedApps,revokeClientForUser} from '$lib/server/oauth';
import type {PageServerLoad,Actions} from './$types';
export const load:PageServerLoad=async({locals,platform})=>{
 if(!locals.user || !platform?.env.DB) error(401,'Sign in');
 return {apps:await listConnectedApps(platform.env.DB,locals.user.id)};
};
export const actions:Actions={revoke:async({locals,platform,request,url})=>{
 if(!locals.user || !platform?.env.DB) error(401,'Sign in');
 if(request.headers.get('origin')!==url.origin) error(403,'Invalid origin');
 const id=(await request.formData()).get('client_id');
 if(typeof id!=='string') error(400,'Client required');
 await revokeClientForUser(platform.env.DB,locals.user.id,id);
 return {ok:true};
}};
