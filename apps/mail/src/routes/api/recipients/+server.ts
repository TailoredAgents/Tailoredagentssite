import {json,type RequestHandler} from '@sveltejs/kit';
import {parseEmailAddresses} from '$lib/server/email-address';
export const GET:RequestHandler=async({locals,platform})=>{
 const rows=await platform!.env.DB.prepare('SELECT from_addr,to_addr,cc_addr FROM emails WHERE user_id=? AND deleted_at IS NULL AND spam_at IS NULL ORDER BY created_at DESC LIMIT 200').bind(locals.user!.id).all<{from_addr:string;to_addr:string;cc_addr:string|null}>();
 const addresses=new Set<string>();
 for(const row of rows.results)for(const address of parseEmailAddresses([row.from_addr,row.to_addr,row.cc_addr??'']))addresses.add(address);
 for(const address of locals.addresses)addresses.add(address.address);
 return json({addresses:[...addresses].slice(0,300).sort()});
};
