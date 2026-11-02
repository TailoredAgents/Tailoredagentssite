import 'server-only';
import {z} from 'zod';
import {codeSchema,profileSchema,slugSchema} from '@/lib/smart-cards/validation';
import {changeCardSettings} from '@/lib/smart-cards/settings';
import type {ChangeTool} from './changes';
import {AssistantError} from '../config';
function card(name:string,title:string,description:string,operation:string,schema:z.ZodObject):ChangeTool{
 return {name,title,description,schema,scopes:['operations:write'],external:true,async run(p,input){
  const form=new FormData();form.set('operation',operation);
  for(const [key,value] of Object.entries(schema.parse(input)))if(value!==undefined)form.set(key,typeof value==='boolean'?(value?'on':''):String(value));
  const result=await changeCardSettings(p.context,form);
  if(result.outcomeUnknown)throw new Error('Check the saved card settings before retrying.');
  if(!result.ok)throw new AssistantError('card_change_rejected',result.message,409);
  return result;
 }};
}
export const cardChanges:ChangeTool[]=[
 card('save_card_profile','Update public Smart Card profile','Change the public name, role, contact details, introduction or publication state. Read get_card_profile and preserve all fields you do not intend to change. Requires its exact updatedAt and owner/admin role. Portrait files and login identity are managed separately. Changes affect everyone opening this profile.', 'profile',profileSchema.extend({expectedUpdatedAt:z.iso.datetime({offset:true})})),
 card('create_card_link','Create permanent card link','Create one permanent NFC/QR link for a reusable card or a labeled giveaway batch. A shared batch link identifies that batch, not each physical card or anonymous visitor. Returns URLs to program or print; it does not order or produce cards. Owner/admin only.', 'create',z.object({profile:slugSchema,label:z.string().trim().min(1).max(100),kind:z.enum(['personal','giveaway'])})),
 card('update_card_link','Reassign or pause a card link','Change which team profile an existing permanent link opens, or enable/disable it. The programmed URL stays the same. First read get_card and supply its current profile_slug and active as expectedProfile/expectedActive. Owner/admin only.', 'card',z.object({code:codeSchema,profile:slugSchema,active:z.boolean(),expectedProfile:slugSchema,expectedActive:z.boolean()})),
 card('set_card_assistant','Pause or resume public card assistant','Enable or disable the public Tailored Agents agent, preserving its existing monthly cap and usage. Read get_card_assistant_settings first and supply its enabled and budgetMicros. Enabling permits visitors to incur API usage within that existing cap. Does not change Operations access or private goals. Owner/admin only.', 'assistant',z.object({enabled:z.boolean(),expectedEnabled:z.boolean(),expectedBudgetMicros:z.number().int().min(0).max(25000000)})),
];
