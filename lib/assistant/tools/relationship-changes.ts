import 'server-only';
import {z} from 'zod';
import {discoverySchema,introductionSchema,accountManagerSchema,handoffSchema,handoffTransitionSchema} from '@/lib/relationships/contract';
import {saveDiscovery,addIntroduction,setAccountManager} from '@/lib/relationships/service';
import {requestHandoff,transitionHandoff} from '@/lib/relationships/handoffs';
import {SalesAccessError} from '@/lib/sales/data';
import type {DashboardContext} from '@/lib/dashboard/data';
import {AssistantError} from '../config';
import type {ChangeTool} from './changes';
function relationship(name:string,title:string,description:string,schema:z.ZodObject,run:(c:DashboardContext,input:unknown)=>Promise<unknown>):ChangeTool{
 return {name,title,description,schema,scopes:['operations:write'],async run(p,input){try{return await run(p.context,schema.parse(input))??{saved:true};}catch(e){if(e instanceof SalesAccessError)throw new AssistantError('change_rejected',e.message,409);throw e;}}};
}
export const relationshipChanges:ChangeTool[]=[
 relationship('save_business_discovery','Record discovery notes','Append team-visible discovery facts supplied or confirmed by the user. Keep possible automations in opportunities; never invent requirements or copy private meeting/mail content without an explicit sharing instruction. Read get_relationship_overview first.',discoverySchema,saveDiscovery),
 relationship('record_introduction','Record an introduction','Record the user-specified introducer separately from acquisition source and sales owner. Read get_business_discovery for existing partner IDs; use an empty partnerId and a name only for a new partner. This creates no agreement, earnings or payout.',introductionSchema,addIntroduction),
 relationship('set_account_manager','Assign client account manager','Change only the client account manager. Read get_client or get_relationship_overview for its current updatedAt. Supply an active teammate userId, or empty to unassign. Sales and project ownership stay separate.',accountManagerSchema.extend({expectedUpdatedAt:z.iso.datetime({offset:true})}),setAccountManager),
 relationship('request_relationship_handoff','Hand off a relationship next step','Request a next action from an active teammate with an Eastern due time expressed as ISO with offset. Read get_relationship_overview first. Keep one UUID requestId across retries. No message, sales ownership transfer or calendar reservation. Recipient accepts in My day.',handoffSchema,requestHandoff),
 relationship('update_relationship_handoff','Update relationship handoff','Read get_relationship_handoff for its current revision. Only the assigned teammate can accept or complete. Completion/cancellation needs a factual outcome/reason. Cancel does not cancel calendar bookings or customer messages.',handoffTransitionSchema,transitionHandoff),
];
