import {z} from 'zod';

export const chatRequestSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('connect'),mode:z.enum(['read','review','direct']),conversations:z.boolean()}).strict(),
 z.object({operation:z.literal('budget'),dollars:z.number().int().min(0).max(1000)}).strict(),
 z.object({operation:z.literal('send'),threadId:z.uuid(),requestId:z.uuid(),message:z.string().trim().min(1).max(8000)}).strict(),
 z.object({operation:z.literal('stop'),threadId:z.uuid(),requestId:z.uuid()}).strict(),
]);
export type ChatActivity={label:string;status:string;reviewUrl?:string};
export type ChatTurn={id:string;user_message:string;assistant_message:string;status:'running'|'completed'|'failed'|'interrupted';activity:ChatActivity[];created_at:string};
export type ChatState={threads:{id:string;title:string}[];hasMore:boolean;turns:ChatTurn[];historyLimited:boolean;connection:{mode:string;paused:boolean;conversations:boolean}|null;configured:boolean;monthlyLimit:number;monthlyUsed:number;canManageBudget:boolean;viewer:boolean};
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
