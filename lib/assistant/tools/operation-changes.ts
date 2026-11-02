import 'server-only';
import {z} from 'zod';
import * as service from '@/lib/operations/service';
import {clientSchema,contactSchema,siteSchema,projectSchema,updateLeadSchema,leadNoteSchema,milestoneSchema,milestoneStatusSchema,projectRecordSchema} from '@/lib/operations/validation';
import type {DashboardContext} from '@/lib/dashboard/data';
import type {ChangeTool} from './changes';
import {AssistantError} from '../config';

const revision=z.iso.datetime({offset:true}).describe('Exact updatedAt returned by the latest record read.');
function editable<S extends z.ZodRawShape>(schema:z.ZodObject<S>,key:keyof S){
 return schema.extend({expectedUpdatedAt:revision.optional()}).superRefine((value,ctx)=>{
  const fields=value as Record<string,unknown>;
  if(fields[String(key)]&&!fields.expectedUpdatedAt)ctx.addIssue({code:'custom',path:['expectedUpdatedAt'],message:'Read the existing record and supply its updatedAt before editing.'});
 });
}
type Operation=(actor:DashboardContext,form:FormData)=>Promise<service.OperationServiceResult>;
function tool(name:string,title:string,description:string,schema:z.ZodObject,operation:Operation):ChangeTool{
 return {name,title,description,schema,scopes:['operations:write'],async run(p,raw){
  const values=schema.parse(raw),form=new FormData();
  for(const [key,value] of Object.entries(values))if(value!==undefined&&value!==null)form.set(key,typeof value==='boolean'?(value?'on':''):String(value));
  const result=await operation(p.context,form);
  if(result.outcomeUnknown)throw new Error('Check the affected record before retrying.');
  if(result.status!=='success')throw new AssistantError('change_rejected',result.message,409);
  return result;
 }};
}
const editDescription='For an existing record, first read it and supply its exact updatedAt. This replaces the editable fields: preserve existing optional values you do not intend to clear.';
export const operationChanges:ChangeTool[]=[
 tool('update_lead','Update lead',`Update lead ownership, status, next action and outcome. ${editDescription}`,updateLeadSchema.extend({expectedUpdatedAt:revision}),service.updateLead),
 tool('update_lead_status','Update lead status','Change only a lead’s status using the latest updatedAt.',updateLeadSchema.pick({leadId:true,status:true}).extend({expectedUpdatedAt:revision}),service.updateLeadStatus),
 tool('add_lead_note','Add lead note','Append a factual internal lead note. Does not send a message.',leadNoteSchema,service.addLeadNote),
 tool('save_client','Save client',`Create or update a client. ${editDescription}`,editable(clientSchema,'clientId'),service.saveClient),
 tool('save_contact','Save client contact',`Create or update a contact under the specified client. Selecting primary replaces that client’s current primary contact. ${editDescription}`,editable(contactSchema.extend({isPrimary:z.boolean().default(false)}),'contactId'),service.saveContact),
 tool('save_site','Save site record',`Create or update an internal site record; does not publish or change website content. ${editDescription}`,editable(siteSchema,'siteId'),service.saveSite),
 tool('save_project','Save project',`Create or update a project. An unassigned site will be linked to the selected client. ${editDescription}`,editable(projectSchema,'projectId'),service.saveProject),
 tool('add_milestone','Add project milestone','Add an internal project milestone with an optional date-only deadline.',milestoneSchema,service.addMilestone),
 tool('update_milestone_status','Update milestone status','Update one project milestone using its latest updatedAt from get_project.',milestoneStatusSchema.extend({expectedUpdatedAt:revision}),service.updateMilestoneStatus),
 tool('add_project_record','Add project note, decision or deliverable','Record a factual project note, decision or deliverable. Do not invent approval or completion.',projectRecordSchema,service.addProjectRecord),
];
