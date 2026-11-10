import 'server-only';
import {z} from 'zod';
import type {DashboardContext} from '@/lib/dashboard/data';
import {getDatabasePool,insertAuditLog} from '@/lib/dashboard/db';
import {cardAccess} from '@/lib/smart-cards/data';
import {CardError} from '@/lib/smart-cards/http';
import {formatEasternTime} from '@/lib/time';
import {lockCalendar,requireOpenSlot} from './calendar';

const revision=z.iso.datetime({offset:true});
export const bookConsultationSchema=z.object({leadId:z.uuid(),expectedLeadUpdatedAt:revision,profile:z.enum(['austin','jeffrey','devon','conner']),slotId:z.uuid()});
export const moveConsultationSchema=z.object({bookingId:z.uuid(),expectedUpdatedAt:revision,profile:z.enum(['austin','jeffrey','devon','conner']),slotId:z.uuid()});
type Entry={event_title:string|null;event_kind:string|null;event_location:string;event_notes:string;all_day:boolean;id:string;profile:string;person:string;status:string;starts_at:Date;ends_at:Date;updated_at:Date;leadId:string|null;name:string|null;phone:string|null;email:string|null};
export async function getCalendarEntry(context:DashboardContext,id:string){
 await cardAccess(context);z.uuid().parse(id);
 const row=(await getDatabasePool().query<Entry>(`SELECT s.event_title,s.event_kind,s.event_location,s.event_notes,s.all_day,s.id,s.profile_slug profile,p.display_name person,s.status,s.starts_at,s.ends_at,s.updated_at,l.id "leadId",l.name,l.phone,l.email FROM booking_slots s JOIN smart_card_profiles p ON p.workspace_id=s.workspace_id AND p.slug=s.profile_slug LEFT JOIN leads l ON l.id=s.lead_id AND l.workspace_id=s.workspace_id AND l.anonymized_at IS NULL WHERE s.workspace_id=$1 AND s.id=$2`,[context.workspace.id,id])).rows[0];
 if(!row)return null;
 return {title:row.event_title,kind:row.event_kind,location:row.event_location,notes:row.event_notes,allDay:row.all_day,id:row.id,profile:row.profile,person:row.person,status:row.status,startsAt:row.starts_at.toISOString(),endsAt:row.ends_at.toISOString(),updatedAt:row.updated_at.toISOString(),leadId:row.leadId,name:row.name,phone:row.phone,email:row.email};
}
// Both staff and public bookings take the same workspace calendar lock and use
// the same availability query. No email, SMS, research or paid build is started.
export async function bookConsultation(context:DashboardContext,raw:unknown,move=false){
 const input=move?moveConsultationSchema.parse(raw):bookConsultationSchema.parse(raw);
 const db=await getDatabasePool().connect();
 try{
  await db.query('BEGIN');await lockCalendar(db,context.workspace.id);await cardAccess(context,true,db);
  let leadId:string,previousId:string|undefined;
  if('bookingId' in input){
   const previous=(await db.query<{lead_id:string|null;updated_at:Date;status:string}>('SELECT lead_id,updated_at,status FROM booking_slots WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[context.workspace.id,input.bookingId])).rows[0];
   if(!previous?.lead_id||!['booked','cancelled'].includes(previous.status)||previous.updated_at.getTime()!==Date.parse(input.expectedUpdatedAt))throw new CardError('This booking changed. Read it again before moving it.',409);
   if(input.slotId===input.bookingId)throw new CardError('Choose a different available time.');
   leadId=previous.lead_id;previousId=input.bookingId;
  }else leadId=input.leadId;
  const lead=(await db.query<{updated_at:Date;phone:string|null}>('SELECT updated_at,phone FROM leads WHERE workspace_id=$1 AND id=$2 AND anonymized_at IS NULL FOR UPDATE',[context.workspace.id,leadId])).rows[0];
  if(!lead||('expectedLeadUpdatedAt' in input&&lead.updated_at.getTime()!==Date.parse(input.expectedLeadUpdatedAt)))throw new CardError('This lead changed or is unavailable. Read it again.',409);
  if(!lead.phone)throw new CardError('Add the visitor’s phone number before booking a phone consultation.');
  if(!move&&(await db.query('SELECT id FROM booking_slots WHERE workspace_id=$1 AND lead_id=$2',[context.workspace.id,leadId])).rowCount)throw new CardError('This lead already has a booking record. Use reschedule with that booking instead.',409);
  // requireOpenSlot is restricted to the Smart Cards workspace; cardAccess
  // verifies this context is that workspace before any row is modified.
  const slot=await requireOpenSlot(db,input.slotId,input.profile);
  if(previousId)await db.query("UPDATE booking_slots SET lead_id=NULL,status=CASE WHEN status='booked' THEN 'open' ELSE status END,updated_at=now() WHERE workspace_id=$1 AND id=$2",[context.workspace.id,previousId]);
  await db.query("UPDATE booking_slots SET status='booked',lead_id=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2",[context.workspace.id,slot.id,leadId]);
  await db.query("UPDATE leads SET description=COALESCE(description,'')||$3,updated_at=now() WHERE workspace_id=$1 AND id=$2",[context.workspace.id,leadId,`\n\nCalendar update: phone consultation ${move?'rescheduled':'booked'} for ${formatEasternTime(slot.startsAt)} to ${formatEasternTime(slot.endsAt)}. No visitor notification was sent by this action.`]);
  await insertAuditLog(db,{workspaceId:context.workspace.id,actorUserId:context.user.id,action:move?'appointment.rescheduled':'appointment.staff_booked',targetType:'booking_slot',targetId:slot.id,metadata:{leadId,previousSlotId:previousId??null,profile:input.profile,notificationSent:false}});
  await db.query('COMMIT');return {...slot,leadId,previousSlotId:previousId??null,notificationSent:false};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
