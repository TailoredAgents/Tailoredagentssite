import 'server-only';
import {z} from 'zod';
import type {ChangeTool} from './changes';
import type {DashboardContext} from '@/lib/dashboard/data';
import {callFollowUpCreateSchema,callFollowUpUpdateSchema,callFollowUpCompleteSchema,createCallFollowUpTask,updateCallFollowUpTask,completeCallFollowUpTask} from '@/lib/voice/follow-up-tasks';
import {VoiceAccessError,VoiceInputError} from '@/lib/voice/data';
import {AssistantError} from '../config';

function task(name:string,title:string,description:string,schema:z.ZodObject,run:(context:DashboardContext,input:unknown)=>Promise<unknown>):ChangeTool{
 return {name,title,description,schema,scopes:['operations:write','conversations:read'],async run(p,input){
  try{return await run(p.context,input);}catch(error){if(error instanceof VoiceInputError||error instanceof VoiceAccessError)throw new AssistantError('call_task_unavailable',error.message,409);throw error;}
 }};
}
const revision=z.iso.datetime({offset:true});
export const callChanges:ChangeTool[]=[
 task('create_call_follow_up','Schedule call follow-up','Create a task from an existing call suggestion. First read get_call_follow_up_options; supply its exact suggestion text and quote, and select an eligible teammate. The quote must still occur in the retained transcript. If a task already exists, update it instead. Does not request paid analysis or contact anyone.',callFollowUpCreateSchema.required({expectedSuggestion:true}),createCallFollowUpTask),
 task('update_call_follow_up','Update call follow-up','Edit an open task originating from a call. Read get_call_follow_up_task and use its updatedAt. Preserve fields you do not intend to change and choose a teammate with access to that call. Business times are Eastern; supply an explicit time offset.',callFollowUpUpdateSchema.extend({expectedUpdatedAt:revision}),updateCallFollowUpTask),
 task('complete_call_follow_up','Complete or cancel call follow-up','Complete or cancel a call task using its current updatedAt and an actual outcome supplied by the user. Does not send a message or make a call.',callFollowUpCompleteSchema.extend({expectedUpdatedAt:revision}),completeCallFollowUpTask),
];
