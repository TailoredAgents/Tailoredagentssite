import {z} from 'zod';
import {workCostSchema} from './assignment-contract';
export const routineTemplates={
 custom:{title:'Custom routine',description:'Run the specific work you request on a schedule.'},
 morning:{title:'Morning priorities',description:'Review your due tasks, today’s meetings and blocked projects.'},
 meeting_prep:{title:'Meeting preparation',description:'Prepare a brief for your meetings in the next day.'},
 follow_up:{title:'Unanswered follow-ups',description:'Surface your assigned conversations waiting two days for a reply.'},
 weekly_summary:{title:'Weekly work summary',description:'Summarize your recent task outcomes and delivery work.'},
 watch:{title:'Watch for changes',description:'Group new replies, overdue tasks, meeting changes and blocked delivery work.'},
} as const;
export const routineTriggerSchema=z.enum(['reply','overdue','meeting','blocked']);
export const timezoneSchema=z.string().max(80).regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}},'Choose an IANA time zone.').transform(value=>new Intl.DateTimeFormat('en',{timeZone:value}).resolvedOptions().timeZone);
export const routineSchema=z.object({id:z.uuid().optional(),expectedRevision:z.number().int().positive().optional(),title:z.string().trim().min(1).max(200),instruction:z.string().trim().max(6000),cadence:z.enum(['daily','weekdays','weekly']),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),weekday:z.number().int().min(0).max(6).default(1),enabled:z.boolean().default(true),template:z.enum(['custom','morning','meeting_prep','follow_up','weekly_summary','watch']).default('custom'),timezone:timezoneSchema.default('America/New_York'),maxCostDollars:workCostSchema.default(1),notify:z.boolean().default(false),triggers:z.array(routineTriggerSchema).max(4).default([]),dailyRunLimit:z.number().int().min(1).max(3).default(1)}).strict().refine(v=>!v.id||!!v.expectedRevision,'Read the current revision first.').refine(v=>v.template!=='custom'||v.instruction.trim().length>0,'Describe the custom routine.').refine(v=>v.template!=='watch'||v.triggers.length>0,'Select at least one change to watch.');
export type RoutineInput=z.infer<typeof routineSchema>;
export type RoutineSource={kind:'task'|'booking'|'project'|'milestone'|'conversation';id:string;revision:string;reason:string;url:string;title:string;key:string};
export type RoutineSummary={id:string;title:string;instruction:string;template:RoutineInput['template'];cadence:string;local_time:string;weekday:number;timezone:string;max_cost_micros:string;notify:boolean;triggers:RoutineInput['triggers'];daily_run_limit:number;enabled:boolean;revision:number;next_run_at:string;last_run_at:string|null;last_error:string|null};
