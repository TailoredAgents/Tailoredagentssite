import 'server-only';
import {ensureRecurringSlots,fillRecurringSlots} from './recurring';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import type {DashboardContext} from '@/lib/dashboard/data';
import {cardAccess,validateCardSource} from '@/lib/smart-cards/data';
import {CARD_WORKSPACE} from '@/lib/smart-cards/types';
import {slugSchema} from '@/lib/smart-cards/validation';
import {CardError} from '@/lib/smart-cards/http';
export class CalendarInputError extends Error {}
export type PublicSlot={id:string;startsAt:string;endsAt:string};
type SlotRow={id:string;starts_at:Date;ends_at:Date;status:string;profile_slug:string;updated_at:Date};
export const slotResult=(s:SlotRow):PublicSlot=>({id:s.id,startsAt:s.starts_at.toISOString(),endsAt:s.ends_at.toISOString()});
export async function lockCalendar(db:PoolClient,workspaceId:string){await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`booking-calendar:${workspaceId}`]);}
// The CRM's existing appointments also occupy time. Follow-up reminders do not.
const freeOfTasks=`NOT EXISTS(SELECT 1 FROM crm_tasks t JOIN "user" u ON u.id=t.owner_user_id WHERE t.workspace_id=s.workspace_id AND lower(trim(u.email))=lower(trim(p.login_email)) AND t.kind='appointment' AND t.status='open' AND t.due_at<s.ends_at AND COALESCE(NULLIF(t.end_at,t.due_at),t.due_at+interval '30 minutes')>s.starts_at)`;
// A profile without a staff login can still receive bookings in the shared calendar.
// An explicitly suspended existing staff membership stops online booking.
const ownerAllowed=`NOT EXISTS(SELECT 1 FROM "user" u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=p.workspace_id AND lower(trim(u.email))=lower(trim(p.login_email)) AND (m.status<>'active' OR m.role='viewer'))`;
const freeOfExceptions=`NOT EXISTS(SELECT 1 FROM booking_slots b WHERE b.workspace_id=s.workspace_id AND b.profile_slug=s.profile_slug AND b.id<>s.id AND b.starts_at<s.ends_at AND b.ends_at>s.starts_at AND (b.status IN ('booked','blocked') OR (s.recurring AND NOT b.recurring AND NOT b.is_block AND b.status IN ('open','closed','cancelled'))))`;
const eligible=`s.status='open' AND p.published AND ${ownerAllowed} AND s.starts_at>=now()+interval '2 hours' AND s.starts_at<=now()+interval '90 days' AND ${freeOfTasks} AND ${freeOfExceptions}`;
export async function availableSlots(profile:string,card?:string,day?:string){
 const source=await validateCardSource(profile,card);
 if(day!==undefined)z.iso.date().parse(day);
 await ensureRecurringSlots(CARD_WORKSPACE);
 const rows=await getDatabasePool().query<SlotRow>(`SELECT s.* FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug WHERE s.workspace_id=$1 AND s.profile_slug=$2 AND ${eligible} AND ($3::date IS NULL OR (s.starts_at AT TIME ZONE 'America/New_York')::date=$3) ORDER BY s.starts_at LIMIT 80`,[CARD_WORKSPACE,profile,day??null]);
 return rows.rows.filter(s=>source.campaign!=='commercial-insurance'||s.ends_at.getTime()-s.starts_at.getTime()===30*60000).map(slotResult);
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
export async function guardSalesAppointment(db:PoolClient,workspace:string,owner:string|null|undefined,start:string,end?:string|null,excludeTaskId?:string){
 await lockCalendar(db,workspace);
 if(!owner)return;
 const busy=await db.query(`SELECT s.id FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug JOIN "user" u ON lower(trim(u.email))=lower(trim(p.login_email)) WHERE s.workspace_id=$1 AND u.id=$2 AND s.status IN ('booked','blocked') AND s.starts_at<COALESCE(NULLIF($4::timestamptz,$3::timestamptz),$3::timestamptz+interval '30 minutes') AND s.ends_at>$3::timestamptz`,[workspace,owner,start,end||null]);
 if(busy.rowCount)throw new CalendarInputError('This teammate has a booking or blocked time in the shared calendar. Choose another time.');
 const tasks=await db.query(`SELECT id FROM crm_tasks WHERE workspace_id=$1 AND owner_user_id=$2 AND kind='appointment' AND status='open' AND ($5::uuid IS NULL OR id<>$5) AND due_at<COALESCE(NULLIF($4::timestamptz,$3::timestamptz),$3::timestamptz+interval '30 minutes') AND COALESCE(NULLIF(end_at,due_at),due_at+interval '30 minutes')>$3::timestamptz LIMIT 1`,[workspace,owner,start,end||null,excludeTaskId??null]);
 if(tasks.rowCount)throw new CalendarInputError('This teammate already has a sales appointment at that time. Choose another time.');
}
const publishSchema=z.object({profile:slugSchema,startsAt:z.iso.datetime({offset:true}),minutes:z.coerce.number().int().min(15).max(10080),mode:z.enum(['open','blocked'])});
export async function changeCalendar(context:DashboardContext,raw:Record<string,unknown>){
 const db=await getDatabasePool().connect();let changedId:string|undefined;
 try{
  await db.query('BEGIN');await cardAccess(context,true,db);await lockCalendar(db,context.workspace.id);
  if(raw.operation==='publish'){
   const v=publishSchema.parse(raw);if(v.mode==='open'&&![15,30,45,60,90,120].includes(v.minutes))throw new CalendarInputError('Extra consultation times must be 15–120 minutes.');await fillRecurringSlots(db,context.workspace.id);const start=new Date(v.startsAt),end=new Date(start.getTime()+v.minutes*60000);
   if(start.getTime()<(v.mode==='open'?Date.now()+2*3600000:Date.now()-86400000)||start.getTime()>Date.now()+90*86400000||end.getTime()<=Date.now())throw new CalendarInputError('Choose a future consultation at least two hours ahead, or a time-off block that ends in the future, within the next 90 days.');
   const person=(await db.query(`SELECT p.slug FROM smart_card_profiles p WHERE p.workspace_id=$1 AND p.slug=$2 AND ${ownerAllowed}`,[context.workspace.id,v.profile])).rows[0];
   if(!person)throw new CalendarInputError('This profile is unavailable or its staff account has been suspended.');
   const overlap=await db.query(`SELECT id FROM booking_slots WHERE workspace_id=$1 AND profile_slug=$2 AND status=ANY($5::text[]) AND starts_at<$4 AND ends_at>$3`,[context.workspace.id,v.profile,start,end,v.mode==='blocked'?['booked','blocked']:['open','booked','blocked']]);
   if(overlap.rowCount)throw new CalendarInputError('This time overlaps another open time, booking or block for this teammate.');
   const tasks=await db.query(`SELECT t.id FROM crm_tasks t JOIN "user" u ON u.id=t.owner_user_id JOIN smart_card_profiles p ON lower(trim(p.login_email))=lower(trim(u.email)) AND p.workspace_id=t.workspace_id WHERE t.workspace_id=$1 AND p.slug=$2 AND t.kind='appointment' AND t.status='open' AND t.due_at<$4 AND COALESCE(NULLIF(t.end_at,t.due_at),t.due_at+interval '30 minutes')>$3`,[context.workspace.id,v.profile,start,end]);
   if(tasks.rowCount)throw new CalendarInputError('This time overlaps an existing sales appointment.');
   changedId=randomUUID();
   await db.query('INSERT INTO booking_slots(id,workspace_id,profile_slug,starts_at,ends_at,status,created_by,is_block) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[changedId,context.workspace.id,v.profile,start,end,v.mode,context.user.id,v.mode==='blocked']);
  }else if(raw.operation==='close'||raw.operation==='cancel'){
   const id=z.uuid().parse(raw.id);
   if(raw.expectedUpdatedAt!==undefined){
    const expected=z.iso.datetime({offset:true}).parse(raw.expectedUpdatedAt);
    const current=(await db.query<{updated_at:Date}>('SELECT updated_at FROM booking_slots WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[context.workspace.id,id])).rows[0];
    if(!current||current.updated_at.getTime()!==Date.parse(expected))throw new CalendarInputError('This calendar entry changed. Read it again before editing.');
   }
   if(raw.operation==='cancel'&&raw.contacted!=='on')throw new CalendarInputError('Contact the visitor about the cancellation before confirming it here.');
   const r=await db.query(`UPDATE booking_slots SET status=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND status=ANY($4::text[]) RETURNING id,lead_id`,[context.workspace.id,id,raw.operation==='cancel'?'cancelled':'closed',raw.operation==='cancel'?['booked']:['open','blocked']]);
   changedId=id;
   if(!r.rowCount)throw new CalendarInputError('This calendar entry has changed. Refresh to see its current status.');
   if(raw.operation==='cancel'&&r.rows[0].lead_id)await db.query("UPDATE leads SET description=description||E'\\n\\nCalendar update: this consultation was cancelled after the team contacted the visitor.',updated_at=now() WHERE workspace_id=$1 AND id=$2 AND anonymized_at IS NULL",[context.workspace.id,r.rows[0].lead_id]);
  }else throw new CalendarInputError('Unknown calendar action.');
  await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:`booking_calendar.${raw.operation}`,targetType:'booking_slot',targetId:changedId,metadata:{profile:raw.profile??null,slot:raw.id??null}});
  await db.query('COMMIT');return {id:changedId,notificationSent:false};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function getBookingCalendar(context:DashboardContext){
 const role=await cardAccess(context);await ensureRecurringSlots(context.workspace.id);const pool=getDatabasePool();
 const [slots,profiles,tasks]=await Promise.all([
  pool.query<SlotRow&{display_name:string;lead_id:string|null;name:string|null;email:string|null;phone:string|null}>(`SELECT s.*,p.display_name,l.name,l.email,l.phone FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug LEFT JOIN leads l ON l.id=s.lead_id AND l.workspace_id=s.workspace_id AND l.anonymized_at IS NULL WHERE s.workspace_id=$1 AND s.ends_at>now()-interval '30 days' AND s.status<>'closed' AND NOT (s.recurring AND s.status='open') ORDER BY s.starts_at LIMIT 1000`,[context.workspace.id]),
  pool.query<{slug:string;display_name:string;opens_minute:number|null;closes_minute:number|null;slot_minutes:number|null}>(`SELECT p.slug,p.display_name,r.opens_minute,r.closes_minute,r.slot_minutes FROM smart_card_profiles p LEFT JOIN booking_schedules r ON r.workspace_id=p.workspace_id AND r.profile_slug=p.slug WHERE p.workspace_id=$1 ORDER BY p.display_name`,[context.workspace.id]),
  pool.query<{id:string;title:string;due_at:Date;end_at:Date|null;owner_name:string|null;profile_slug:string|null;opportunity_id:string|null}>(`SELECT t.id,t.title,t.due_at,t.end_at,u.name owner_name,p.slug profile_slug,t.opportunity_id FROM crm_tasks t LEFT JOIN "user" u ON u.id=t.owner_user_id LEFT JOIN smart_card_profiles p ON p.workspace_id=t.workspace_id AND lower(trim(p.login_email))=lower(trim(u.email)) WHERE t.workspace_id=$1 AND t.kind='appointment' AND t.status='open' AND t.due_at>now()-interval '30 days' AND t.due_at<now()+interval '90 days' ORDER BY t.due_at LIMIT 1000`,[context.workspace.id]),
 ]);
 return {canEdit:['owner','admin'].includes(role),profiles:profiles.rows,slots:slots.rows.map(s=>({...slotResult(s),updatedAt:s.updated_at.toISOString(),status:s.status,profile:s.profile_slug,person:s.display_name,leadId:s.name?s.lead_id:null,name:s.name,email:s.email,phone:s.phone})),tasks:tasks.rows.map(t=>({...t,due_at:t.due_at.toISOString(),end_at:t.end_at?.toISOString()??null}))};
}
export async function upcomingBookings(context:DashboardContext,scope:'mine'|'team'){
 await cardAccess(context);
 const rows=await getDatabasePool().query<{id:string;starts_at:Date;ends_at:Date;display_name:string;name:string|null;phone:string|null;lead_id:string|null}>(`SELECT s.id,s.starts_at,s.ends_at,p.display_name,l.name,l.phone,l.id lead_id FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug LEFT JOIN leads l ON l.id=s.lead_id AND l.workspace_id=s.workspace_id AND l.anonymized_at IS NULL WHERE s.workspace_id=$1 AND s.status='booked' AND s.ends_at>now() AND s.starts_at<now()+interval '30 days' AND ($2='team' OR lower(trim(p.login_email))=lower(trim($3))) ORDER BY s.starts_at LIMIT 30`,[context.workspace.id,scope,context.user.email]);
 return rows.rows;
}
