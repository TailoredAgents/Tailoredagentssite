import {z} from 'zod';
import {assignmentControlSchema,type WorkStep} from './assignment-contract';

const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const notificationPreferencesSchema=z.object({smsEnabled:z.boolean(),completions:z.boolean(),pushEnabled:z.boolean(),timezone:z.string().max(80).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}),quietStart:time,quietEnd:time}).strict();
export const workRequestSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('preferences'),preferences:notificationPreferencesSchema}).strict(),
 z.object({operation:z.literal('verify_phone'),phone:z.string().regex(/^\+1[2-9]\d{9}$/),consent:z.literal(true)}).strict(),
 z.object({operation:z.literal('confirm_phone'),id:z.uuid(),code:z.string().regex(/^\d{6}$/)}).strict(),
 z.object({operation:z.literal('read'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('remove_push_device'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('stop'),id:z.uuid(),threadId:z.uuid()}).strict(),
 assignmentControlSchema,
]);
export const notificationTitles={review:'Your assistant needs your review',failed:'Your assistant needs attention',completed:'Your assistant finished working',reminder:'Your assistant has a reminder'} as const;
export type NotificationCategory=keyof typeof notificationTitles;
export function notificationDestination(n:{source_type:string;source_id:string;thread_id:string|null}){
 return n.source_type==='action'?'/dashboard/assistant?action='+n.source_id:n.thread_id?'/dashboard/assistant?thread='+n.thread_id:'/dashboard/assistant';
}
export type WorkState={smsAvailable:boolean;pushAvailable:boolean;devices:{id:string;verified:boolean;enabled:boolean;lastSeenAt:string}[];preferences:{phone:string|null;verified:boolean;smsEnabled:boolean;completions:boolean;pushEnabled:boolean;timezone:string;quietStart:string;quietEnd:string};notifications:{id:string;title:string;url:string;createdAt:string;read:boolean;resolved:boolean;delivery:string|null}[];work:{id:string;threadId:string;title:string;status:string;createdAt:string;finishedAt:string|null;reviewUrl:string|null;plan:WorkStep[];reason:string|null;maxCost:number;used:number}[]};
