import 'server-only';
import {z} from 'zod';
import {operationChanges} from './operation-changes';
import {communicationChanges} from './communication-changes';
import {callChanges} from './call-changes';
import {cardChanges} from './card-changes';
import {draftChanges} from './draft-changes';
import {personalChanges} from './personal-changes';
import {relationshipChanges} from './relationship-changes';
import {operatingModelChanges} from './operating-model-changes';
import type {Principal} from '../oauth';
import type {AssistantScope} from '../config';
import {goalSchema,saveGoal} from '../goals';
import {createOpportunity,updateOpportunity,logActivity,saveTask,completeTask,requestMockup,SalesInputError} from '@/lib/sales/service';
import {createOpportunitySchema,updateOpportunitySchema,activitySchema,taskSchema,completeTaskSchema,requestMockupSchema} from '@/lib/sales/validation';
import {AssistantError} from '../config';
import {noteSchema} from '@/lib/conversations/validation';
import {addConversationNote} from '@/lib/conversations/service';
import {changeCalendar,CalendarInputError} from '@/lib/booking/calendar';
import {bookConsultation,bookConsultationSchema,moveConsultationSchema} from '@/lib/booking/staff';
import {CardError} from '@/lib/smart-cards/http';
import {bookingNotificationHook} from '../booking-notifications';
export type ChangeTool={name:string;title:string;description:string;schema:z.ZodObject;scopes:AssistantScope[];external?:boolean;reviewRequired?:boolean;run:(p:Principal,input:unknown)=>Promise<unknown>};
function change<S extends z.ZodObject>(name:string,title:string,description:string,schema:S,run:(p:Principal,input:z.output<S>)=>Promise<unknown>,scopes:AssistantScope[]=['operations:write']):ChangeTool{
 return {name,title,description,schema,scopes,async run(p,input){try{return await run(p,schema.parse(input));}catch(error){if(error instanceof SalesInputError||error instanceof CalendarInputError||error instanceof CardError)throw new AssistantError('change_rejected',error.message,409);throw error;}}};
}
export const changeTools:ChangeTool[]=[
 ...operatingModelChanges,
 ...relationshipChanges,
 ...personalChanges,
 ...operationChanges,
 ...communicationChanges,
 ...callChanges,
 ...cardChanges,
 ...draftChanges,
 change('save_goal','Save private goal','Create or update a private goal. Existing goals require their current revision. Progress must reflect facts supplied by the user.',goalSchema,(p,v)=>saveGoal(p.context,v),['personal:write']),
 change('create_opportunity','Create sales opportunity','Create an opportunity with contact identity and owner. Does not contact anyone.',createOpportunitySchema,(p,v)=>createOpportunity(p.context,v)),
 change('update_opportunity','Update sales opportunity','Update a sales opportunity using the exact current opportunity and business revision timestamps.',updateOpportunitySchema,(p,v)=>updateOpportunity(p.context,v)),
 change('log_activity','Add sales note','Record an internal sales note. Do not invent calls, messages, outcomes or promises.',activitySchema.omit({kind:true,direction:true}).extend({kind:z.literal('note').default('note'),direction:z.literal('internal').default('internal')}),(p,v)=>logActivity(p.context,v)),
 change('create_follow_up','Create follow-up task','Create an internal follow-up task for an active teammate. Supply an ISO time with offset; business time is Eastern. Does not send a message.',z.object(taskSchema.shape).omit({taskId:true,kind:true}).extend({kind:z.literal('follow_up').default('follow_up')}),(p,v)=>saveTask(p.context,v)),
 change('save_sales_task','Save follow-up or appointment','Create or edit an opportunity’s task or appointment. Read get_opportunity for current fields and updatedAt before editing. Preserve optional fields you do not want to clear. Appointments require an active teammate and must not overlap bookings, blocks or another appointment. Times need an explicit offset; business time is Eastern. Does not send a notification.',z.object(taskSchema.shape).superRefine((v,c)=>{
  if(v.taskId&&!v.expectedUpdatedAt)c.addIssue({code:'custom',path:['expectedUpdatedAt'],message:'Supply the current task updatedAt.'});
  if(v.kind==='appointment'&&!v.ownerUserId)c.addIssue({code:'custom',path:['ownerUserId'],message:'An appointment needs an assigned teammate.'});
  if(v.endAt&&Date.parse(v.endAt)<=Date.parse(v.dueAt))c.addIssue({code:'custom',path:['endAt'],message:'End must follow start.'});
 }),(p,v)=>saveTask(p.context,v)),
 change('complete_sales_task','Complete or cancel task','Complete or cancel an opportunity’s task or appointment with its current updatedAt and a factual outcome supplied by the user. Does not notify the customer.',completeTaskSchema.extend({expectedUpdatedAt:z.iso.datetime({offset:true})}),(p,v)=>completeTask(p.context,v)),
 change('request_mockup','Request a mockup','Save a mockup request and brief for the team. This does not run a paid Website Builder build.',requestMockupSchema,(p,v)=>requestMockup(p.context,v)),
 change('add_conversation_note','Add customer conversation note','Append a note visible to the permitted source audience. This does not send a message.',noteSchema,(p,v)=>addConversationNote(p.context,v),['operations:write','conversations:read']),
 change('block_time','Block calendar time','Block a teammate’s calendar. Existing bookings and appointments must not overlap. Owner/admin permission required; maximum seven-day block within the next 90 days.',z.object({profile:z.enum(['austin','jeffrey','devon','conner']),startsAt:z.iso.datetime({offset:true}),minutes:z.number().int().min(15).max(10080)}),(p,v)=>changeCalendar(p.context,{...v,operation:'publish',mode:'blocked'})),
 change('publish_consultation_time','Add extra consultation time','Publish an extra public consultation slot, 15–120 minutes, at least two hours ahead and within 90 days. Cannot overlap existing availability, appointments, bookings or blocks. Owner/admin only. Regular availability is already 8 AM–7 PM Eastern daily.',z.object({profile:z.enum(['austin','jeffrey','devon','conner']),startsAt:z.iso.datetime({offset:true}),minutes:z.union([z.literal(15),z.literal(30),z.literal(45),z.literal(60),z.literal(90),z.literal(120)])}),(p,v)=>changeCalendar(p.context,{...v,operation:'publish',mode:'open'})),
 change('book_consultation','Book phone consultation','Book an existing lead into a public time returned by get_availability. Read the lead first; a phone number and its current updatedAt are required. Owner/admin only. No visitor notification is sent; do not claim otherwise.',bookConsultationSchema,(p,v)=>bookConsultation(p.context,v)),
 change('reschedule_consultation','Reschedule phone consultation','Move an existing booked or cancelled consultation to a different available slot. Read get_calendar_entry for its current updatedAt. Owner/admin only. No visitor notification is sent; arrange any message separately.',moveConsultationSchema,(p,v)=>bookConsultation(p.context,v,true)),
 change('book_consultation_and_notify','Book and notify customer','Book a prospect into a time from get_availability and automatically queue a customer text. Read the prospect first. Requires current updatedAt, a valid phone, owner/admin access and a booking notification number in Chat settings. Check get_booking_notifications for its receipt; queued is not delivered.',bookConsultationSchema,async(p,v)=>bookConsultation(p.context,v,false,await bookingNotificationHook(p)),['operations:write','conversations:read','conversations:send']),
 change('reschedule_consultation_and_notify','Reschedule and notify customer','Move a consultation and automatically queue the customer’s new time by text. Read get_calendar_entry for current updatedAt. Requires owner/admin and configured booking notifications. Check get_booking_notifications for the result.',moveConsultationSchema,async(p,v)=>bookConsultation(p.context,v,true,await bookingNotificationHook(p)),['operations:write','conversations:read','conversations:send']),
 change('close_calendar_entry','Remove time block or extra opening','Close an existing open time or time block using its current updatedAt. Cannot cancel a booked appointment. Owner/admin only.',z.object({id:z.uuid(),expectedUpdatedAt:z.iso.datetime({offset:true})}),(p,v)=>changeCalendar(p.context,{...v,operation:'close'})),
 change('cancel_consultation','Cancel phone consultation','Cancel a booked consultation using its current updatedAt. The user must confirm the visitor has already been contacted; never infer this from a draft or a requested message. Owner/admin only. This action itself sends no notification.',z.object({id:z.uuid(),expectedUpdatedAt:z.iso.datetime({offset:true}),visitorAlreadyContacted:z.literal(true)}),(p,v)=>changeCalendar(p.context,{id:v.id,expectedUpdatedAt:v.expectedUpdatedAt,operation:'cancel',contacted:'on'})),
 change('cancel_consultation_and_notify','Cancel and notify customer','Cancel a booked consultation and automatically queue a customer text. Requires current updatedAt, owner/admin and configured booking notifications. Check get_booking_notifications; queued is not delivered.',z.object({id:z.uuid(),expectedUpdatedAt:z.iso.datetime({offset:true})}),async(p,v)=>changeCalendar(p.context,{...v,operation:'cancel'},await bookingNotificationHook(p)),['operations:write','conversations:read','conversations:send']),
];
export const findChange=(name:string)=>changeTools.find(t=>t.name===name);
