'use server';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireDashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {cardAccess} from './data';
import {codeSchema,profileSchema,slugSchema} from './validation';
export type CardActionState={ok:boolean;message:string};
export async function saveCardSettings(_previous:CardActionState,form:FormData):Promise<CardActionState>{
 const context=await requireDashboardContext(),db=await getDatabasePool().connect();
 try{
  await db.query('BEGIN');await cardAccess(context,true,db);
  const action=String(form.get('operation'));
  if(action==='profile'){
   const data=profileSchema.parse({...Object.fromEntries(form),published:form.get('published')==='on'});
   const updated=await db.query(`UPDATE smart_card_profiles SET display_name=$3,title=$4,email=$5,phone=$6,intro=$7,published=$8,updated_at=now() WHERE workspace_id=$1 AND slug=$2 RETURNING slug`,[context.workspace.id,data.slug,data.display_name,data.title,data.email,data.phone,data.intro,data.published]);if(!updated.rowCount)throw new Error('Profile unavailable.');
  }else if(action==='create'){
   const value=z.object({profile:slugSchema,label:z.string().trim().min(1).max(100),kind:z.enum(['personal','giveaway'])}).parse(Object.fromEntries(form));
   if(!(await db.query('SELECT 1 FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2',[context.workspace.id,value.profile])).rowCount)throw new Error('Profile unavailable.');
   const code=`${value.profile}-${randomBytes(6).toString('hex')}`;
   await db.query('INSERT INTO smart_cards(code,workspace_id,profile_slug,label,kind) VALUES($1,$2,$3,$4,$5)',[code,context.workspace.id,value.profile,value.label,value.kind]);
  }else if(action==='card'){
   const code=codeSchema.parse(form.get('code')),profile=slugSchema.parse(form.get('profile'));
   if(!(await db.query('SELECT 1 FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2',[context.workspace.id,profile])).rowCount)throw new Error('Profile unavailable.');
   const updated=await db.query('UPDATE smart_cards SET active=$3,profile_slug=$4 WHERE workspace_id=$1 AND code=$2 RETURNING code',[context.workspace.id,code,form.get('active')==='on',profile]);if(!updated.rowCount)throw new Error('Card unavailable.');
  }else if(action==='assistant'){
   await db.query('UPDATE smart_card_ai_settings SET enabled=$2 WHERE workspace_id=$1',[context.workspace.id,form.get('enabled')==='on']);
  }else throw new Error('Unknown action.');
  await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:`smart_cards.${action}_saved`,targetType:'smart_cards'});
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');return {ok:false,message:e instanceof z.ZodError?'Please check the fields and use a valid email and phone number.':e instanceof Error?e.message:'Changes could not be saved.'};}finally{db.release();}
 revalidatePath('/dashboard/smart-cards');revalidatePath('/c','layout');return {ok:true,message:'Saved. Your card links use the updated settings.'};
}
