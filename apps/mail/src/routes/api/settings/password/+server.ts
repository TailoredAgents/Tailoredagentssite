import {json,type RequestHandler} from '@sveltejs/kit';
import {hashPassword,verifyPassword,validatePassword} from '$lib/server/password';
import {checkRateLimit} from '$lib/server/auth';
export const POST:RequestHandler=async({request,platform,locals,cookies})=>{
 const db=platform!.env.DB,user=locals.user!;
 if(!await checkRateLimit(db,'password:'+user.id,5,900))return json({error:'Please wait 15 minutes before trying again.'},{status:429});
 const body=await request.json();
 const row=await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first<{password_hash:string}>();
 if(!row||!await verifyPassword(body.currentPassword,row.password_hash))return json({error:'Your current password was not correct.'},{status:400});
 try{validatePassword(body.newPassword);}catch{return json({error:'Use a password or phrase between 15 and 128 characters.'},{status:400});}
 const hash=await hashPassword(body.newPassword);
 await db.batch([db.prepare('UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?').bind(hash,user.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
 cookies.delete('mail_session',{path:'/'});return json({ok:true});
};
