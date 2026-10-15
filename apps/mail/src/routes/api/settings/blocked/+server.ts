import {json,type RequestHandler} from '@sveltejs/kit';
export const GET:RequestHandler=async({platform,locals})=>json({addresses:(await platform!.env.DB.prepare('SELECT address FROM blocked_senders WHERE user_id=? ORDER BY address').bind(locals.user!.id).all()).results});
export const POST:RequestHandler=async({request,platform,locals})=>{
 const {address}=await request.json();if(typeof address!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))return json({error:'Enter a valid email address.'},{status:400});
 await platform!.env.DB.prepare('INSERT OR IGNORE INTO blocked_senders(user_id,address) VALUES (?,?)').bind(locals.user!.id,address.trim().toLowerCase()).run();return json({ok:true});
};
export const DELETE:RequestHandler=async({request,platform,locals})=>{const {address}=await request.json();await platform!.env.DB.prepare('DELETE FROM blocked_senders WHERE user_id=? AND address=?').bind(locals.user!.id,address).run();return json({ok:true});};
