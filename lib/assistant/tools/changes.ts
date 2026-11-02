import 'server-only';
import {z} from 'zod';
import {operationChanges} from './operation-changes';
import type {Principal} from '../oauth';
import type {AssistantScope} from '../config';
import {goalSchema,saveGoal} from '../goals';
import {createOpportunity,updateOpportunity,logActivity,saveTask,requestMockup} from '@/lib/sales/service';
import {createOpportunitySchema,updateOpportunitySchema,activitySchema,taskSchema,requestMockupSchema} from '@/lib/sales/validation';
import {noteSchema} from '@/lib/conversations/validation';
import {addConversationNote} from '@/lib/conversations/service';
import {changeCalendar} from '@/lib/booking/calendar';
export type ChangeTool={name:string;title:string;description:string;schema:z.ZodObject;scopes:AssistantScope[];run:(p:Principal,input:unknown)=>Promise<unknown>};
function change<S extends z.ZodObject>(name:string,title:string,description:string,schema:S,run:(p:Principal,input:z.output<S>)=>Promise<unknown>,scopes:AssistantScope[]=['operations:write']):ChangeTool{
 return {name,title,description,schema,scopes,run:(p,input)=>run(p,schema.parse(input))};
}
export const changeTools:ChangeTool[]=[
 ...operationChanges,
 change('save_goal','Save private goal','Create or update a private goal. Existing goals require their current revision. Progress must reflect facts supplied by the user.',goalSchema,(p,v)=>saveGoal(p.context,v),['personal:write']),
 change('create_opportunity','Create sales opportunity','Create an opportunity with contact identity and owner. Does not contact anyone.',createOpportunitySchema,(p,v)=>createOpportunity(p.context,v)),
 change('update_opportunity','Update sales opportunity','Update a sales opportunity using the exact current opportunity and business revision timestamps.',updateOpportunitySchema,(p,v)=>updateOpportunity(p.context,v)),
 change('log_activity','Add sales note','Record an internal sales note. Do not invent calls, messages, outcomes or promises.',activitySchema.omit({kind:true,direction:true}).extend({kind:z.literal('note').default('note'),direction:z.literal('internal').default('internal')}),(p,v)=>logActivity(p.context,v)),
 change('create_follow_up','Create follow-up task','Create an internal follow-up task for an active teammate. Supply an ISO time with offset; business time is Eastern. Does not send a message.',z.object(taskSchema.shape).omit({taskId:true,kind:true}).extend({kind:z.literal('follow_up').default('follow_up')}),(p,v)=>saveTask(p.context,v)),
 change('request_mockup','Request a mockup','Save a mockup request and brief for the team. This does not run a paid Website Builder build.',requestMockupSchema,(p,v)=>requestMockup(p.context,v)),
 change('add_conversation_note','Add customer conversation note','Append a note visible to the permitted source audience. This does not send a message.',noteSchema,(p,v)=>addConversationNote(p.context,v),['operations:write','conversations:read']),
 change('block_time','Block calendar time','Block a teammate’s calendar. Existing bookings and appointments must not overlap. Owner/admin permission required; maximum seven-day block within the next 90 days.',z.object({profile:z.enum(['austin','jeffrey','devon']),startsAt:z.iso.datetime({offset:true}),minutes:z.number().int().min(15).max(10080)}),(p,v)=>changeCalendar(p.context,{...v,operation:'publish',mode:'blocked'})),
];
export const findChange=(name:string)=>changeTools.find(t=>t.name===name);
