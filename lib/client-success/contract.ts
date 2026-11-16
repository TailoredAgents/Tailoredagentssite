import {z} from 'zod';
export const evidence=z.string().trim().min(10).max(3000);
const minute=z.number().int().min(0).max(1439),day=z.iso.date();
export const calendarConfig=z.object({timezone:z.literal('America/New_York'),weekdays:z.array(z.number().int().min(1).max(7)).min(1).max(7),opens:minute,closes:minute,responseMinutes:z.number().int().min(1).max(10080),afterHoursDue:minute,loggingDays:z.number().int().min(1).max(30),validFrom:day,validThrough:day,holidays:z.array(day).max(1000)}).strict().superRefine((v,c)=>{
 if(v.closes<=v.opens||v.afterHoursDue<v.opens||v.afterHoursDue>v.closes)c.addIssue({code:'custom',message:'Choose same-day hours and an after-hours deadline within those hours.'});
 if(new Set(v.weekdays).size!==v.weekdays.length||new Set(v.holidays).size!==v.holidays.length||v.validThrough<v.validFrom||v.holidays.some(d=>d<v.validFrom||d>v.validThrough))c.addIssue({code:'custom',message:'Check the calendar coverage, weekdays and holiday dates.'});
});
export type BusinessCalendar=z.infer<typeof calendarConfig>;
export const calendarInput=z.object({requestId:z.uuid(),name:z.string().trim().min(2).max(150),config:calendarConfig,evidence}).strict();
export const planInput=z.object({requestId:z.uuid(),clientId:z.uuid(),revision:z.number().int().positive().optional(),calendarId:z.uuid(),mode:z.enum(['off','observe','remind']),checkinMonths:z.number().int().min(1).max(12),reviewMonths:z.number().int().min(1).max(24),checkinAnchor:day,reviewAnchor:day,reminderMinutes:z.number().int().min(0).max(1440),evidence}).strict();
export const requestInput=z.object({requestId:z.uuid(),clientId:z.uuid(),kind:z.enum(['response','logging','followup']),sourceKey:z.string().trim().min(3).max(200),title:z.string().trim().min(2).max(250),occurredAt:z.iso.datetime({offset:true}),dueAt:z.iso.datetime({offset:true}).optional(),reference:evidence}).strict();
export const taskChangeInput=z.object({requestId:z.uuid(),id:z.uuid(),revision:z.number().int().positive(),operation:z.enum(['complete','record_auto','reschedule','excuse']),evidence,evidenceAt:z.iso.datetime({offset:true}).optional(),dueAt:z.iso.datetime({offset:true}).optional(),human:z.boolean().default(false)}).strict();
export const poolInput=z.object({requestId:z.uuid(),userId:z.string().min(1).max(200),enabled:z.boolean(),capacity:z.number().int().min(1).max(500),specialties:z.string().trim().min(2).max(1000),evidence}).strict();
export const availabilityInput=z.object({requestId:z.uuid(),userId:z.string().min(1).max(200),startsOn:day,endsBefore:day,evidence}).strict().refine(v=>v.endsBefore>v.startsOn,'Availability end must follow start.');
export const assignmentInput=z.object({requestId:z.uuid(),clientId:z.uuid(),expectedManagerId:z.string().nullable(),userId:z.string().min(1).max(200),evidence}).strict();
export const searchInput=z.object({scope:z.enum(['mine','team']).default('mine'),page:z.number().int().min(1).max(10000).default(1)}).strict();
