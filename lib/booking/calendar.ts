import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import type {DashboardContext} from '@/lib/dashboard/data';
import {cardAccess,validateCardSource} from '@/lib/smart-cards/data';
import {CARD_WORKSPACE} from '@/lib/smart-cards/types';
import {slugSchema} from '@/lib/smart-cards/validation';
import {CardError} from '@/lib/smart-cards/http';
export type PublicSlot={id:string;startsAt:string;endsAt:string};
type SlotRow={id:string;starts_at:Date;ends_at:Date;status:string;profile_slug:string};
export const slotResult=(s:SlotRow):PublicSlot=>({id:s.id,startsAt:s.starts_at.toISOString(),endsAt:s.ends_at.toISOString()});
export async function lockCalendar(db:PoolClient,workspaceId:string){await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`booking-calendar:${workspaceId}`]);}
// The CRM's existing appointments also occupy time. Follow-up reminders do not.
const freeOfTasks=`NOT EXISTS(SELECT 1 FROM crm_tasks t JOIN "user" u ON u.id=t.owner_user_id WHERE t.workspace_id=s.workspace_id AND lower(trim(u.email))=lower(trim(p.login_email)) AND t.kind='appointment' AND t.status='open' AND t.due_at<s.ends_at AND COALESCE(NULLIF(t.end_at,t.due_at),t.due_at+interval '30 minutes')>s.starts_at)`;
const ownerActive=`EXISTS(SELECT 1 FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=p.workspace_id AND m.status='active' AND m.role<>'viewer' AND lower(trim(u.email))=lower(trim(p.login_email)))`;
const eligible=`s.status='open' AND p.published AND ${ownerActive} AND s.starts_at>=now()+interval '2 hours' AND s.starts_at<=now()+interval '90 days' AND ${freeOfTasks}`;
export async function availableSlots(profile:string,card?:string){
 await validateCardSource(profile,card);
 const rows=await getDatabasePool().query<SlotRow>(`SELECT s.* FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug WHERE s.workspace_id=$1 AND s.profile_slug=$2 AND ${eligible} ORDER BY s.starts_at LIMIT 80`,[CARD_WORKSPACE,profile]);
 return rows.rows.map(slotResult);
}
export async function requireOpenSlot(db:PoolClient,id:string,profile:string){
 const row=(await db.query<SlotRow>(`SELECT s.* FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug WHERE s.workspace_id=$1 AND s.id=$2 AND s.profile_slug=$3 AND ${eligible} FOR UPDATE OF s`,[CARD_WORKSPACE,id,profile])).rows[0];
 if(!row)throw new CardError('That time is no longer available. Refresh the times and choose another, or send an appointment request.',409);
 return slotResult(row);
}
export async function getLeadBooking(db:PoolClient,leadId:string){
 const row=(await db.query<SlotRow>('SELECT * FROM booking_slots WHERE workspace_id=$1 AND lead_id=$2',[CARD_WORKSPACE,leadId])).rows[0];
 return row?{...slotResult(row),status:row.status}:null;
}
export async function guardSalesAppointment(db:PoolClient,workspace:string,owner:string|null|undefined,start:string,end?:string|null){
 await lockCalendar(db,workspace);
 if(!owner)return;
 const busy=await db.query(`SELECT s.id FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug JOIN "user" u ON lower(trim(u.email))=lower(trim(p.login_email)) WHERE s.workspace_id=$1 AND u.id=$2 AND s.status IN ('booked','blocked') AND s.starts_at<COALESCE(NULLIF($4::timestamptz,$3::timestamptz),$3::timestamptz+interval '30 minutes') AND s.ends_at>$3::timestamptz`,[workspace,owner,start,end||null]);
 if(busy.rowCount)throw new Error('This teammate has a booking or blocked time in the shared calendar. Choose another time.');
}
const publishSchema=z.object({profile:slugSchema,startsAt:z.iso.datetime({offset:true}),minutes:z.coerce.number().int().refine(v=>[15,30,45,60,90,120].includes(v)),mode:z.enum(['open','blocked'])});
export async function changeCalendar(context:DashboardContext,raw:Record<string,unknown>){
 const db=await getDatabasePool().connect();
 try{
  await db.query('BEGIN');await cardAccess(context,true,db);await lockCalendar(db,context.workspace.id);
  if(raw.operation==='publish'){
   const v=publishSchema.parse(raw);const start=new Date(v.startsAt),end=new Date(start.getTime()+v.minutes*60000);
   if(start.getTime()<Date.now()+2*3600000||start.getTime()>Date.now()+90*86400000)throw new Error('Choose a time at least two hours ahead and within the next 90 days.');
   const person=(await db.query(`SELECT p.slug FROM smart_card_profiles p WHERE p.workspace_id=$1 AND p.slug=$2 AND ${ownerActive}`,[context.workspace.id,v.profile])).rows[0];
   if(!person)throw new Error('This teammate must sign in and have an active team account before times can be published.');
   const overlap=await db.query(`SELECT id FROM booking_slots WHERE workspace_id=$1 AND profile_slug=$2 AND status IN ('open','booked','blocked') AND starts_at<$4 AND ends_at>$3`,[context.workspace.id,v.profile,start,end]);
   if(overlap.rowCount)throw new Error('This time overlaps another open time, booking or block for this teammate.');
   const tasks=await db.query(`SELECT t.id FROM crm_tasks t JOIN "user" u ON u.id=t.owner_user_id JOIN smart_card_profiles p ON lower(trim(p.login_email))=lower(trim(u.email)) AND p.workspace_id=t.workspace_id WHERE t.workspace_id=$1 AND p.slug=$2 AND t.kind='appointment' AND t.status='open' AND t.due_at<$4 AND COALESCE(NULLIF(t.end_at,t.due_at),t.due_at+interval '30 minutes')>$3`,[context.workspace.id,v.profile,start,end]);
   if(tasks.rowCount)throw new Error('This time overlaps an existing sales appointment.');
   await db.query('INSERT INTO booking_slots(id,workspace_id,profile_slug,starts_at,ends_at,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),context.workspace.id,v.profile,start,end,v.mode,context.user.id]);
  }else if(raw.operation==='close'||raw.operation==='cancel'){
   const id=z.uuid().parse(raw.id);
   if(raw.operation==='cancel'&&raw.contacted!=='on')throw new Error('Contact the visitor about the cancellation before confirming it here.');
   const r=await db.query(`UPDATE booking_slots SET status=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND status=ANY($4::text[]) RETURNING id,lead_id`,[context.workspace.id,id,raw.operation==='cancel'?'cancelled':'closed',raw.operation==='cancel'?['booked']:['open','blocked']]);
   if(!r.rowCount)throw new Error('This calendar entry has changed. Refresh to see its current status.');
   if(raw.operation==='cancel'&&r.rows[0].lead_id)await db.query("UPDATE leads SET description=description||E'\\n\\nCalendar update: this consultation was cancelled after the team contacted the visitor.',updated_at=now() WHERE workspace_id=$1 AND id=$2 AND anonymized_at IS NULL",[context.workspace.id,r.rows[0].lead_id]);
  }else throw new Error('Unknown calendar action.');
  await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:`booking_calendar.${raw.operation}`,targetType:'booking_slot',metadata:{profile:raw.profile??null,slot:raw.id??null}});
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function getBookingCalendar(context:DashboardContext){
 const role=await cardAccess(context);const pool=getDatabasePool();
 const [slots,profiles,tasks]=await Promise.all([
  pool.query<SlotRow&{display_name:string;lead_id:string|null;name:string|null;email:string|null;phone:string|null}>(`SELECT s.*,p.display_name,l.name,l.email,l.phone FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug LEFT JOIN leads l ON l.id=s.lead_id AND l.workspace_id=s.workspace_id AND l.anonymized_at IS NULL WHERE s.workspace_id=$1 AND s.ends_at>now()-interval '30 days' AND s.status<>'closed' ORDER BY s.starts_at LIMIT 1000`,[context.workspace.id]),
  pool.query<{slug:string;display_name:string}>('SELECT slug,display_name FROM smart_card_profiles WHERE workspace_id=$1 ORDER BY display_name',[context.workspace.id]),
  pool.query<{id:string;title:string;due_at:Date;end_at:Date|null;owner_name:string|null;profile_slug:string|null;opportunity_id:string|null}>(`SELECT t.id,t.title,t.due_at,t.end_at,u.name owner_name,p.slug profile_slug,t.opportunity_id FROM crm_tasks t LEFT JOIN "user" u ON u.id=t.owner_user_id LEFT JOIN smart_card_profiles p ON p.workspace_id=t.workspace_id AND lower(trim(p.login_email))=lower(trim(u.email)) WHERE t.workspace_id=$1 AND t.kind='appointment' AND t.status='open' AND t.due_at>now()-interval '30 days' AND t.due_at<now()+interval '90 days' ORDER BY t.due_at LIMIT 1000`,[context.workspace.id]),
 ]);
 return {canEdit:['owner','admin'].includes(role),profiles:profiles.rows,slots:slots.rows.map(s=>({...slotResult(s),status:s.status,profile:s.profile_slug,person:s.display_name,leadId:s.name?s.lead_id:null,name:s.name,email:s.email,phone:s.phone})),tasks:tasks.rows.map(t=>({...t,due_at:t.due_at.toISOString(),end_at:t.end_at?.toISOString()??null}))};
}
export async function upcomingBookings(context:DashboardContext,scope:'mine'|'team'){
 await cardAccess(context);
 const rows=await getDatabasePool().query<{id:string;starts_at:Date;ends_at:Date;display_name:string;name:string|null;phone:string|null;lead_id:string|null}>(`SELECT s.id,s.starts_at,s.ends_at,p.display_name,l.name,l.phone,l.id lead_id FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug LEFT JOIN leads l ON l.id=s.lead_id AND l.workspace_id=s.workspace_id AND l.anonymized_at IS NULL WHERE s.workspace_id=$1 AND s.status='booked' AND s.ends_at>now() AND s.starts_at<now()+interval '30 days' AND ($2='team' OR lower(trim(p.login_email))=lower(trim($3))) ORDER BY s.starts_at LIMIT 30`,[context.workspace.id,scope,context.user.email]);
 return rows.rows;
}
