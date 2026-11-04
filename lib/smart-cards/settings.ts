import 'server-only';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import type {DashboardContext} from '@/lib/dashboard/data';
import {cardUrl} from './types';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {cardAccess,publicColumns} from './data';
import {codeSchema,profileSchema,slugSchema} from './validation';
export type CardSettingsResult={ok:boolean;message:string;outcomeUnknown?:boolean;code?:string;nfcUrl?:string;qrUrl?:string};
export class CardSettingsError extends Error {}
export async function getManagedProfile(context:DashboardContext,slug:string){
 await cardAccess(context);
 const r=(await getDatabasePool().query(`SELECT ${publicColumns},updated_at FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2`,[context.workspace.id,slugSchema.parse(slug)])).rows[0];
 if(!r)return null;
 const {updated_at,...profile}=r;return {...profile,updatedAt:updated_at.toISOString()};
}
export async function getManagedCard(context:DashboardContext,code:string){
 await cardAccess(context);
 const r=(await getDatabasePool().query('SELECT code,profile_slug,label,kind,active,campaign FROM smart_cards WHERE workspace_id=$1 AND code=$2',[context.workspace.id,codeSchema.parse(code)])).rows[0];
 return r?{...r,nfcUrl:cardUrl(r.code,'nfc'),qrUrl:cardUrl(r.code,'qr')}:null;
}
export async function getCardAiSettings(context:DashboardContext){
 await cardAccess(context);
 const r=(await getDatabasePool().query('SELECT enabled,monthly_limit_micros FROM smart_card_ai_settings WHERE workspace_id=$1',[context.workspace.id])).rows[0];
 return r?{enabled:r.enabled,budgetMicros:Number(r.monthly_limit_micros),budgetDollars:Number(r.monthly_limit_micros)/1000000}:null;
}
export async function changeCardSettings(context:DashboardContext,form:FormData):Promise<CardSettingsResult>{
 const db=await getDatabasePool().connect();let savedCode:string|undefined;
 try{
  await db.query('BEGIN');try{await cardAccess(context,true,db);}catch{throw new CardSettingsError('Only active owners and administrators can change Smart Cards.');}
  const action=String(form.get('operation'));
  if(action==='profile'){
   const data=profileSchema.parse({...Object.fromEntries(form),published:form.get('published')==='on'});
   const current=(await db.query('SELECT updated_at FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2 FOR UPDATE',[context.workspace.id,data.slug])).rows[0];
   if(!current)throw new CardSettingsError('Profile unavailable.');
   if(form.has('expectedUpdatedAt')&&current.updated_at.getTime()!==Date.parse(z.iso.datetime({offset:true}).parse(form.get('expectedUpdatedAt'))))throw new CardSettingsError('This profile changed. Read it again before editing.');
   const updated=await db.query(`UPDATE smart_card_profiles SET display_name=$3,title=$4,email=$5,phone=$6,intro=$7,published=$8,updated_at=now() WHERE workspace_id=$1 AND slug=$2 RETURNING slug`,[context.workspace.id,data.slug,data.display_name,data.title,data.email,data.phone,data.intro,data.published]);if(!updated.rowCount)throw new CardSettingsError('Profile unavailable.');
  }else if(action==='create'){
   const value=z.object({profile:slugSchema,label:z.string().trim().min(1).max(100),kind:z.enum(['personal','giveaway'])}).parse(Object.fromEntries(form));
   if(!(await db.query('SELECT 1 FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2',[context.workspace.id,value.profile])).rowCount)throw new CardSettingsError('Profile unavailable.');
   const code=`${value.profile}-${randomBytes(6).toString('hex')}`;savedCode=code;
   await db.query('INSERT INTO smart_cards(code,workspace_id,profile_slug,label,kind) VALUES($1,$2,$3,$4,$5)',[code,context.workspace.id,value.profile,value.label,value.kind]);
  }else if(action==='card'){
   const code=codeSchema.parse(form.get('code')),profile=slugSchema.parse(form.get('profile'));
   if(!(await db.query('SELECT 1 FROM smart_card_profiles WHERE workspace_id=$1 AND slug=$2',[context.workspace.id,profile])).rowCount)throw new CardSettingsError('Profile unavailable.');
   const current=(await db.query('SELECT active,profile_slug FROM smart_cards WHERE workspace_id=$1 AND code=$2 FOR UPDATE',[context.workspace.id,code])).rows[0];
   if(!current)throw new CardSettingsError('Card unavailable.');
   if((form.has('expectedActive')&&current.active!==(form.get('expectedActive')==='on'))||(form.has('expectedProfile')&&current.profile_slug!==form.get('expectedProfile')))throw new CardSettingsError('This card changed. Read it again before editing.');
   savedCode=code;
   const updated=await db.query('UPDATE smart_cards SET active=$3,profile_slug=$4 WHERE workspace_id=$1 AND code=$2 RETURNING code',[context.workspace.id,code,form.get('active')==='on',profile]);if(!updated.rowCount)throw new CardSettingsError('Card unavailable.');
  }else if(action==='assistant'){
   const current=(await db.query('SELECT enabled,monthly_limit_micros FROM smart_card_ai_settings WHERE workspace_id=$1 FOR UPDATE',[context.workspace.id])).rows[0];
   if(!current)throw new CardSettingsError('Settings unavailable.');
   if((form.has('expectedEnabled')&&current.enabled!==(form.get('expectedEnabled')==='on'))||(form.has('expectedBudgetMicros')&&Number(current.monthly_limit_micros)!==Number(form.get('expectedBudgetMicros'))))throw new CardSettingsError('These settings changed. Read them again before editing.');
   await db.query('UPDATE smart_card_ai_settings SET enabled=$2 WHERE workspace_id=$1',[context.workspace.id,form.get('enabled')==='on']);
  }else throw new CardSettingsError('Unknown action.');
  await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:`smart_cards.${action}_saved`,targetType:'smart_cards',metadata:{code:savedCode??null}});
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');return {ok:false,message:e instanceof z.ZodError?'Please check the fields and use a valid email and phone number.':e instanceof CardSettingsError?e.message:'Changes could not be confirmed. Refresh the record before trying again.',outcomeUnknown:!(e instanceof z.ZodError||e instanceof CardSettingsError)};}finally{db.release();}
 return {ok:true,message:'Saved. Your card links use the updated settings.',...(savedCode?{code:savedCode,nfcUrl:cardUrl(savedCode,'nfc'),qrUrl:cardUrl(savedCode,'qr')}:{})};
}
