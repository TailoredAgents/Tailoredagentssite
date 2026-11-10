import {z} from 'zod';
import {assignmentControlSchema,workCostSchema,type WorkStep} from './assignment-contract';

export const chatRequestSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('connect'),mode:z.enum(['read','review','direct']),conversations:z.boolean(),background:z.boolean().default(false),meetings:z.boolean().default(false),research:z.boolean().default(false),sms:z.boolean().default(false),email:z.boolean().default(false),calls:z.boolean().default(false),routines:z.boolean().default(false),notificationNumberId:z.union([z.uuid(),z.literal('')]).default('')}).strict(),
 z.object({operation:z.literal('forget'),id:z.uuid(),revision:z.number().int().positive()}).strict(),
 z.object({operation:z.literal('routine'),id:z.uuid(),revision:z.number().int().positive(),enabled:z.boolean()}).strict(),
 z.object({operation:z.literal('budget'),dollars:z.number().int().min(0).max(1000)}).strict(),
 z.object({operation:z.literal('send'),threadId:z.uuid(),requestId:z.uuid(),message:z.string().trim().min(1).max(8000),maxCostDollars:workCostSchema.default(1)}).strict(),
 assignmentControlSchema,
 z.object({operation:z.literal('stop'),threadId:z.uuid(),requestId:z.uuid()}).strict(),
]);
export type ChatActivity={label:string;status:string;reviewUrl?:string};
export type ChatTurn={id:string;user_message:string;assistant_message:string;status:'queued'|'running'|'waiting'|'waiting_input'|'paused'|'blocked'|'outcome_unknown'|'completed'|'failed'|'interrupted';activity:ChatActivity[];created_at:string;work_plan?:WorkStep[];employee_replies?:{text:string;createdAt:string}[];max_cost_micros?:string;used_micros?:string;blocked_reason?:string|null};
export type ChatCapabilities={background?:boolean;meetings?:boolean;research:boolean;sms:boolean;email:boolean;calls:boolean;routines:boolean;notificationNumberId:string};
export type ChatState={threads:{id:string;title:string}[];hasMore:boolean;turns:ChatTurn[];historyLimited:boolean;connection:({mode:string;paused:boolean;conversations:boolean;expiresAt?:string}&ChatCapabilities)|null;backgroundAvailable?:boolean;configured:boolean;monthlyLimit:number;monthlyUsed:number;canManageBudget:boolean;viewer:boolean;numbers:{id:string;phone:string}[];memories:{id:string;title:string;body:string;revision:number}[];routines:{id:string;title:string;instruction:string;cadence:string;local_time:string;enabled:boolean;revision:number;next_run_at:string;last_error:string|null}[];notifications:{id:string;phone:string;status:string;result:unknown}[]};
export const CHAT_MODEL='gpt-6.1-sol';
export const CHAT_MAX_OUTPUT=3000;
export const CHAT_MAX_INPUT_BYTES=100000;
// Conservative cache-write rate ($2.50/M input, $10/M output), standard service.
// Count every serialized byte as a token, plus protocol allowance. No paid hosted tools.
export function chatReservation(bytes:number){
 if(bytes>CHAT_MAX_INPUT_BYTES)throw new Error('This conversation is too large. Start a new chat.');
 return Math.ceil((bytes+8192)*2.5+CHAT_MAX_OUTPUT*10);
}
export function chatUsageCost(input:number,output:number){return Math.ceil(input*2.5+output*10);}
